/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */


import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createProvider, AIProvider } from "./src/ai-provider.js";
import { createServer as createViteServer } from "vite";
import { ProcessStatus, ServerLog, NoteTemplate, Note, AccountTier } from "./src/types.js";


// Initialize directories
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const GDRIVE_SIM_DIR = path.join(process.cwd(), "google_drive_sim");
const DB_FILE = path.join(process.cwd(), "db.json");

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(GDRIVE_SIM_DIR)) fs.mkdirSync(GDRIVE_SIM_DIR, { recursive: true });

// Setup Server Logger
const logsBuffer: ServerLog[] = [];
function addLog(level: "info" | "warning" | "error" | "success", message: string, details?: string) {
  const log: ServerLog = {
    timestamp: new Date().toLocaleTimeString(),
    level,
    message,
    details,
  };
  logsBuffer.unshift(log);
  if (logsBuffer.length > 200) {
    logsBuffer.pop();
  }
  console.log(`[${log.level.toUpperCase()}] ${log.message} ${details ? `(${details})` : ""}`);
}

addLog("info", "Sistem AI Note-Taker sedang diinisialisasi...");

// Setup Application-level text encryption (AES-256-CBC)
const ENCRYPTION_KEY = Buffer.alloc(32, "ai-note-taker-secure-secret-key-32-bytes"); // Fallback secret
const IV_LENGTH = 16;

function encryptText(text: string): string {
  if (!text) return "";
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decryptText(encryptedText: string | null): string {
  if (!encryptedText) return "";
  try {
    const textParts = encryptedText.split(":");
    const iv = Buffer.from(textParts.shift()!, "hex");
    const encryptedTextBuffer = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedTextBuffer, undefined, "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    return `[Dekripsi Gagal: ${err instanceof Error ? err.message : String(err)}]`;
  }
}

function getAudioFileExt(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase().replace(/^\./, "");
  return ext || "webm";
}

function getMimeType(ext: string): string {
  const mimeMap: Record<string, string> = {
    webm: "audio/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    flac: "audio/flac",
    aac: "audio/aac",
    mp4: "audio/mp4",
    wma: "audio/x-ms-wma",
  };
  return mimeMap[ext] || "audio/webm";
}
// Relational DB Logic (db.json)
interface DB {
  account_tiers: AccountTier[];
  users: Array<{ id: string; username: string; password_hash: string; tierId: string }>;
  templates: NoteTemplate[];
  notes: Note[];
}

const defaultDB: DB = {
  account_tiers: [
    { id: "tier-free", name: "Free Tier", maxDurationSeconds: 600, description: "Maksimal durasi perekaman 10 menit per sesi (uji coba)." },
    { id: "tier-premium", name: "Premium Tier", maxDurationSeconds: 3600, description: "Maksimal durasi perekaman 1 jam per sesi (Sesuai FR-02.2)." }
  ],
  users: [
    { id: "user-1", username: "admin", password_hash: "admin123", tierId: "tier-premium" },
    { id: "user-2", username: "budi", password_hash: "budi123", tierId: "tier-free" }
  ],
  templates: [
    {
      id: "tpl-rapat-proyek",
      name: "Rapat Proyek",
      description: "Template standar untuk rapat proyek, menghasilkan Ringkasan Eksekutif dan Daftar Tindakan (Action Items).",
      systemPrompt: "Anda adalah asisten pencatat rapat proyek AI. Tugas Anda adalah merangkum transkripsi audio rapat proyek dengan mematuhi format yang ditentukan. Respons harus dalam Bahasa Indonesia yang formal dan terstruktur.",
      userPromptTemplate: "Rangkum rapat proyek berikut berdasarkan transkripsi yang ada:\n\n### RINGKASAN EKSEKUTIF\n[Tuliskan 2-3 paragraf ringkasan jalannya diskusi, keputusan penting, dan agenda utama rapat]\n\n### DAFTAR TINDAKAN (ACTION ITEMS)\n- [Nama PIC]: [Tugas / tindakan konkret yang harus diselesaikan]\n- [Nama PIC]: [Tugas / tindakan konkret yang harus diselesaikan]\n\nTranskripsi Audio:\n{{TRANSCRIPTION}}"
    },
    {
      id: "tpl-kuliah",
      name: "Kuliah / Seminar",
      description: "Template ringkasan materi pembelajaran akademik, kuliah, atau seminar umum.",
      systemPrompt: "Anda adalah asisten akademik AI. Tugas Anda adalah menyusun catatan pembelajaran terstruktur berdasarkan transkripsi kuliah.",
      userPromptTemplate: "Buat ringkasan catatan kuliah yang komprehensif dari transkripsi berikut:\n\n### TOPIK UTAMA & TUJUAN BELAJAR\n- [Tuliskan topik besar kuliah ini]\n\n### POIN-POIN MATERI PENTING\n- [Poin penting 1]\n- [Poin penting 2]\n- [Poin penting 3]\n\n### ISTILAH-ISTILAH KUNCI (GLOSARIUM)\n- [Istilah]: [Definisi singkat]\n\nTranskripsi:\n{{TRANSCRIPTION}}"
    },
    {
      id: "tpl-wawancara",
      name: "Wawancara (Interview)",
      description: "Template ringkasan wawancara kerja, penelitian, atau tanya-jawab mendalam.",
      systemPrompt: "Anda adalah analis wawancara AI. Tugas Anda adalah mengekstrak wawasan penting, profil narasumber, dan kutipan kunci.",
      userPromptTemplate: "Analisislah transkripsi wawancara berikut ke dalam ringkasan terstruktur:\n\n### PROFIL & LATAR BELAKANG NARASUMBER\n- [Latar belakang singkat]\n\n### POIN RESPONS UTAMA\n- [Poin utama dari jawaban narasumber]\n\n### KUTIPAN KUNCI (KEY QUOTES)\n- \"[Kutipan verbatim penting]\"\n\nTranskripsi:\n{{TRANSCRIPTION}}"
    }
  ],
  notes: []
};

function readDB(): DB {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDB, null, 2), "utf8");
    return defaultDB;
  }
  try {
    const data = fs.readFileSync(DB_FILE, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(data);
  } catch (err) {
    addLog("error", "Gagal membaca database file, menggunakan default", String(err));
    // Re-initialize the file with default data so the error doesn't persist
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDB, null, 2), "utf8");
    return defaultDB;
  }
}

function writeDB(db: DB) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
  } catch (err) {
    addLog("error", "Gagal menulis ke database file", String(err));
  }
}

// Initialize database
let db = readDB();
addLog("success", "Database relasional dimuat berhasil", `Users: ${db.users.length}, Templates: ${db.templates.length}`);

// Initialize AI Provider (supports Gemini, OpenAI, 9router, Anthropic via env AI_PROVIDER)
let provider: AIProvider | null = null;
provider = createProvider();
if (provider) {
  const info = provider.getProviderInfo();
  addLog("success", `AI Provider "${info.provider}" berhasil diinisialisasi`, `STT: ${info.modelSTT}, LLM: ${info.modelLLM}`);
} else {
  addLog("warning", "Tidak ada AI API Key terdeteksi. Fitur STT & LLM akan menghasilkan simulasi cerdas.");
}

// Background Worker for processing transcription and summaries
const queueProcessingActive = { value: false };

async function processQueue() {
  if (queueProcessingActive.value) return;
  queueProcessingActive.value = true;

  try {
    db = readDB();
    const pendingNote = db.notes.find(
      (n) => n.status === ProcessStatus.UPLOADING || n.status === ProcessStatus.TRANSCRIBING || n.status === ProcessStatus.SUMMARIZING
    );

    if (pendingNote) {
      addLog("info", `Memproses antrean audio untuk catatan: "${pendingNote.title}" (ID: ${pendingNote.id})`);

      // 1. Speach To Text (STT) Phase
      if (pendingNote.status === ProcessStatus.UPLOADING) {
        db.notes = db.notes.map((n) => (n.id === pendingNote.id ? { ...n, status: ProcessStatus.TRANSCRIBING } : n));
        writeDB(db);
        pendingNote.status = ProcessStatus.TRANSCRIBING;
      }

      if (pendingNote.status === ProcessStatus.TRANSCRIBING) {
        addLog("info", `Fase Transkripsi dimulai untuk catatan: "${pendingNote.title}"`);
        const audioFileExt = pendingNote.fileName ? getAudioFileExt(pendingNote.fileName) : "webm";
        const driveFilePath = pendingNote.gdriveFileId ? path.join(GDRIVE_SIM_DIR, `${pendingNote.gdriveFileId}.${audioFileExt}`) : null;

        if (!driveFilePath || !fs.existsSync(driveFilePath)) {
          throw new Error("File audio tidak ditemukan di Google Drive (gdriveFileId salah atau hilang).");
        }

        let transcriptionResult = "";

        if (provider) {
          try {
            const providerInfo = provider.getProviderInfo();
            addLog("info", `Mengirimkan file audio ke ${providerInfo.provider} untuk proses transkripsi teks (STT)...`);
            const mimeType = getMimeType(audioFileExt);
            transcriptionResult = await provider.transcribeAudio(driveFilePath, mimeType);
            addLog("success", `Proses transkripsi STT via ${providerInfo.provider} selesai berhasil.`);
          } catch (err: any) {
            addLog("error", `Gagal memproses STT`, String(err));
            // If Anthropic (no STT), fall back to simulation
            if (String(err).includes("Anthropic tidak mendukung")) {
              addLog("warning", "Anthropic tidak mendukung STT. Menggunakan SIMULASI transkripsi.");
              await new Promise((r) => setTimeout(r, 2000));
              transcriptionResult = `[SIMULASI TRANSKRIPSI - Anthropic tidak memiliki STT API]
Percakapan ini tidak dapat ditranskripsi karena provider AI yang dipilih (Anthropic/Claude) tidak mendukung transkripsi audio. Silakan ganti ke Gemini atau OpenAI untuk fitur STT.`;
            } else {
              throw new Error(`API STT Gagal: ${err.message || String(err)}`);
            }
          }
        } else {
          // Simulation mode when no API Key is detected
          addLog("warning", "Menggunakan SIMULASI STT karena tidak ada API Key terdeteksi.");
          await new Promise((r) => setTimeout(r, 4000));
          transcriptionResult = `[SIMULASI TRANSKRIPSI]
Halo selamat pagi rekan-rekan sekalian. Terima kasih sudah hadir dalam rapat koordinasi proyek Note-Taker hari ini tanggal 11 Juli 2026.
Hari ini agenda utama kita adalah membahas rilis MVP pertama untuk sistem self-hosted AI Note-Taker kita.
Pertama, untuk backend dan sinkronisasi, Budi sudah berhasil membangun integrasi Google Drive untuk menghemat space lokal, di mana server langsung mendelete salinan audio fisik setelah upload diverifikasi. Bagus sekali Budi.
Kedua, untuk autentikasi dan enkripsi, Ani mengonfirmasi bahwa data teks transkripsi dan rangkuman berhasil dienkripsi di level aplikasi sebelum disimpan ke database menggunakan AES-256-CBC. Ini sangat krusial untuk keamanan data rapat personal kita.
Untuk action items, Budi harap segera selesaikan modul sync offline di mobile, lalu Ani pastikan kunci enkripsi dikelola secara aman dalam env variables. Target kita adalah mendeploy aplikasi ini dalam 2 hari ke depan. Terima kasih semua.`;
        }

        // Apply encryption at application level before saving
        const encryptedSTT = encryptText(transcriptionResult);
        addLog("info", "Enkripsi tingkat aplikasi diterapkan pada teks transkripsi.");

        db = readDB();
        db.notes = db.notes.map((n) =>
          n.id === pendingNote.id
            ? {
                ...n,
                status: ProcessStatus.SUMMARIZING,
                transcriptionEncrypted: encryptedSTT,
              }
            : n
        );
        writeDB(db);
        pendingNote.status = ProcessStatus.SUMMARIZING;
      }

      // 2. LLM Summarization Phase
      if (pendingNote.status === ProcessStatus.SUMMARIZING) {
        addLog("info", `Fase Rangkuman dimulai untuk catatan: "${pendingNote.title}"`);
        db = readDB();
        const currentNote = db.notes.find((n) => n.id === pendingNote.id);
        const decryptedSTT = decryptText(currentNote?.transcriptionEncrypted || "");

        const selectedTemplate = db.templates.find((t) => t.id === pendingNote.templateId) || db.templates[0];
        let summaryResult = "";

        if (provider) {
          try {
            const providerInfo = provider.getProviderInfo();
            addLog("info", `Menggunakan Template: "${selectedTemplate.name}" - Mengirimkan instruksi ke ${providerInfo.provider}...`);
            const finalPrompt = selectedTemplate.userPromptTemplate.replace("{{TRANSCRIPTION}}", decryptedSTT);
            summaryResult = await provider.generateSummary(selectedTemplate.systemPrompt, finalPrompt);
            addLog("success", `Rangkuman berhasil digenerate menggunakan template "${selectedTemplate.name}" via ${providerInfo.provider}`);
          } catch (err: any) {
            addLog("error", `Gagal memproses Ringkasan`, String(err));
            throw new Error(`API LLM Ringkasan Gagal: ${err.message || String(err)}`);
          }
        } else {
          // Simulation mode when no API Key is detected
          addLog("warning", "Menggunakan SIMULASI Rangkuman karena tidak ada API Key terdeteksi.");
          await new Promise((r) => setTimeout(r, 4000));
          summaryResult = `### RINGKASAN EKSEKUTIF
Rapat koordinasi proyek AI Note-Taker pada 11 Juli 2026 berhasil membahas status pengembangan MVP pertama. Agenda utama berfokus pada sinkronisasi penyimpanan cloud, keamanan enkripsi, dan koordinasi rilis. Budi telah menyelesaikan integrasi penyimpanan Google Drive yang hemat penyimpanan lokal dengan langsung menghapus file audio lokal setelah unggahan diverifikasi. Ani mengonfirmasi bahwa enkripsi data teks menggunakan protokol AES-256-CBC pada tingkat aplikasi telah bekerja dengan baik sebelum disimpan ke database, memastikan kerahasiaan data pengguna. Tim menargetkan peluncuran MVP stabil dalam waktu dua hari ke depan.

### DAFTAR TINDAKAN (ACTION ITEMS)
- **Budi**: Selesaikan modul sinkronisasi offline pada aplikasi mobile agar dapat menampung perekaman saat jaringan tidak stabil.
- **Ani**: Pastikan pengelolaan kunci enkripsi disimpan secara aman dalam variabel lingkungan (.env) server backend.
- **Semua Tim**: Lakukan uji coba komprehensif dalam persiapan deployment rilis MVP dalam 2 hari.`;
        }

        // Apply encryption at application level before saving
        const encryptedSummary = encryptText(summaryResult);
        addLog("info", "Enkripsi tingkat aplikasi diterapkan pada teks rangkuman.");

        db = readDB();
        db.notes = db.notes.map((n) =>
          n.id === pendingNote.id
            ? {
                ...n,
                status: ProcessStatus.COMPLETED,
                summaryEncrypted: encryptedSummary,
              }
            : n
        );
        writeDB(db);
        addLog("success", `PEMROSESAN CATATAN SELESAI SUKSES: "${pendingNote.title}"`);
      }
    }
  } catch (err: any) {
    // If anything fails, set state to FAILED and store the raw error message (FR-04.1)
    addLog("error", "KESALAHAN PEMROSESAN ANTRIAN AI", String(err));
    db = readDB();
    const pendingNote = db.notes.find(
      (n) => n.status === ProcessStatus.UPLOADING || n.status === ProcessStatus.TRANSCRIBING || n.status === ProcessStatus.SUMMARIZING
    );
    if (pendingNote) {
      db.notes = db.notes.map((n) =>
        n.id === pendingNote.id
          ? {
              ...n,
              status: ProcessStatus.FAILED,
              errorMessage: err.message || String(err),
            }
          : n
      );
      writeDB(db);
    }
  } finally {
    queueProcessingActive.value = false;
  }
}

// Start polling for background worker (NFR-01 SLA background loop)
setInterval(processQueue, 3000);

// Express App Setup
const app = express();
const PORT = 3000;

// Set high limits for JSON body to accept raw audio base64 uploads easily
app.use(express.json({ limit: "150mb" }));
app.use(express.urlencoded({ limit: "150mb", extended: true }));

// REST API Endpoints

// 1. Auth APIs
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  db = readDB();
  const user = db.users.find((u) => u.username.toLowerCase() === username.toLowerCase());

  if (!user || user.password_hash !== password) {
    addLog("warning", "Gagal login: Username atau password salah", `User: ${username}`);
    return res.status(401).json({ error: "Username atau password salah." });
  }

  // Find account tier
  const tier = db.account_tiers.find((t) => t.id === user.tierId) || db.account_tiers[0];
  const token = `session_${crypto.randomBytes(16).toString("hex")}`;
  addLog("success", "Pengguna berhasil masuk (Login)", `User: ${user.username} (${tier.name})`);

  res.json({
    user: { id: user.id, username: user.username, tierId: user.tierId },
    tier,
    token,
  });
});

app.post("/api/auth/register", (req, res) => {
  const { username, password, tierId } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username dan password wajib diisi." });
  }

  db = readDB();
  const exists = db.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (exists) {
    return res.status(400).json({ error: "Username sudah digunakan." });
  }

  const selectedTierId = tierId || "tier-free";
  const newUser = {
    id: `user-${Date.now()}`,
    username,
    password_hash: password,
    tierId: selectedTierId,
  };

  db.users.push(newUser);
  writeDB(db);

  addLog("success", "Pengguna baru terdaftar", `User: ${username} (Tier: ${selectedTierId})`);
  const tier = db.account_tiers.find((t) => t.id === selectedTierId) || db.account_tiers[0];

  res.status(201).json({
    user: { id: newUser.id, username: newUser.username, tierId: newUser.tierId },
    tier,
    token: `session_${crypto.randomBytes(16).toString("hex")}`,
  });
});

// 2. Templates Lookup API
app.get("/api/templates", (req, res) => {
  db = readDB();
  res.json(db.templates);
});

app.post("/api/templates", (req, res) => {
  const { name, description, systemPrompt, userPromptTemplate } = req.body;
  if (!name || !systemPrompt || !userPromptTemplate) {
    return res.status(400).json({ error: "Kolom Name, System Prompt, dan User Prompt wajib diisi." });
  }

  db = readDB();
  const newTemplate: NoteTemplate = {
    id: `tpl-${Date.now()}`,
    name,
    description: description || "",
    systemPrompt,
    userPromptTemplate,
  };

  db.templates.push(newTemplate);
  writeDB(db);

  addLog("success", `Template AI baru berhasil didaftarkan: "${name}" (NFR-04 Lookup Tables)`);
  res.status(201).json(newTemplate);
});

// 3. Notes management & Ingest Pipeline
app.get("/api/notes", (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: "Query userId diperlukan." });
  }

  db = readDB();
  const userNotes = db.notes.filter((n) => n.userId === userId);

  // Decrypt data at application level before responding to the authenticated client
  const decryptedNotes = userNotes.map((n) => ({
    ...n,
    transcription: decryptText(n.transcriptionEncrypted),
    summary: decryptText(n.summaryEncrypted),
  }));

  res.json(decryptedNotes);
});

app.post("/api/notes/upload", (req, res) => {
  const { userId, title, durationSeconds, audioBase64, templateId, fileName: reqFileName } = req.body;

  if (!userId || !title || !audioBase64 || !templateId) {
    return res.status(400).json({ error: "Parameter wajib diisi: userId, title, audioBase64, templateId." });
  }

  db = readDB();
  const user = db.users.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: "Pengguna tidak ditemukan." });
  }

  const tier = db.account_tiers.find((t) => t.id === user.tierId) || db.account_tiers[0];

  // Enforce tier limitation
  if (durationSeconds > tier.maxDurationSeconds) {
    addLog("warning", `Upload ditolak karena durasi audio melebihi batas tier.`, `Durasi: ${durationSeconds}s, Limit: ${tier.maxDurationSeconds}s`);
    return res.status(400).json({
      error: `Durasi audio (${Math.round(durationSeconds / 60)} menit) melebihi batas maksimum untuk ${tier.name} (${tier.maxDurationSeconds / 60} menit).`,
    });
  }

  const noteId = `note-${Date.now()}`;
  const audioExt = reqFileName ? getAudioFileExt(reqFileName) : "webm";
  const localFileName = `audio_${noteId}.${audioExt}`;
  const localFilePath = path.join(UPLOADS_DIR, localFileName);

  try {
    addLog("info", `Memulai sinkronisasi & ingesti data untuk "${title}"...`);

    // FR-02.3: Audio disimpan sementara di lokal server (atau simulasi physical stream) sebelum diupload ke Drive
    const audioBuffer = Buffer.from(audioBase64, "base64");
    fs.writeFileSync(localFilePath, audioBuffer);
    addLog("info", `File audio tersimpan fisik di server lokal sementara`, `Path: ./uploads/${localFileName} (${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

    // NFR-02.1 & NFR-02.2: Stream/simulasikan unggah ke Google Drive
    const gdriveFileId = `gdrive_${noteId}`;
    const driveFilePath = path.join(GDRIVE_SIM_DIR, `${gdriveFileId}.${audioExt}`);

    addLog("info", `Mulai streaming data dari server lokal ke Google Drive Cloud Storage...`);
    fs.writeFileSync(driveFilePath, audioBuffer); // simulate successful cloud write
    addLog("success", `Unggah berhasil! File terverifikasi di Google Drive Cloud Storage.`, `File ID: ${gdriveFileId}`);

    // NFR-02.2: Segera hapus file fisik lokal di server backend setelah verifikasi
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
      addLog("success", `NFR-02.2 Clean-Up: Salinan fisik lokal di server backend telah BERHASIL DIHAPUS.`);
    }

    // Registrasi transaksi ke database
    const newNote: Note = {
      id: noteId,
      userId,
      title,
      durationSeconds,
      status: ProcessStatus.UPLOADING, // Will trigger worker to start STT/LLM
      gdriveFileId,
      fileName: reqFileName || localFileName,
      transcriptionEncrypted: null,
      summaryEncrypted: null,
      errorMessage: null,
      createdAt: new Date().toISOString(),
      templateId,
    };

    db.notes.push(newNote);
    writeDB(db);

    addLog("success", `Transaksi catatan didaftarkan ke database dengan status UPLOADED`, `ID: ${noteId}`);
    res.status(201).json({
      message: "Audio berhasil diunggah dan sedang diproses.",
      note: newNote,
    });
  } catch (err) {
    addLog("error", "Gagal melakukan ingesti file audio", String(err));
    res.status(500).json({ error: `Gagal mengunggah audio: ${err instanceof Error ? err.message : String(err)}` });
  }
});

// 4. Admin API & Real-time inspector
app.get("/api/admin/logs", (req, res) => {
app.get("/api/admin/provider", (_req, res) => {
  if (provider) {
    res.json(provider.getProviderInfo());
  } else {
    res.json({ provider: "none", modelSTT: "simulasi", modelLLM: "simulasi" });
  }
});
  res.json(logsBuffer);
});

app.get("/api/admin/gdrive", (req, res) => {
  try {
    const files = fs.readdirSync(GDRIVE_SIM_DIR);
    const result = files.map((file) => {
      const stat = fs.statSync(path.join(GDRIVE_SIM_DIR, file));
      return {
        id: path.basename(file, ".webm"),
        name: file,
        sizeBytes: stat.size,
        uploadedAt: stat.mtime.toISOString(),
        contentType: "audio/webm",
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Gagal membaca virtual Google Drive." });
  }
});

app.get("/api/admin/db", (req, res) => {
  db = readDB();
  res.json(db);
});

app.post("/api/admin/clear", (req, res) => {
  // Reset DB
  writeDB(defaultDB);
  // Clear directories
  try {
    const uploads = fs.readdirSync(UPLOADS_DIR);
    for (const f of uploads) fs.unlinkSync(path.join(UPLOADS_DIR, f));
    const drives = fs.readdirSync(GDRIVE_SIM_DIR);
    for (const f of drives) fs.unlinkSync(path.join(GDRIVE_SIM_DIR, f));
    addLog("success", "Administrator membersihkan seluruh database dan file penyimpanan.");
    res.json({ message: "Database dan penyimpanan berhasil dibersihkan." });
  } catch (err) {
    res.status(500).json({ error: "Gagal membersihkan database." });
  }
});

// Configure Vite middleware or static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    addLog("info", "Menjalankan Vite dalam mode Development Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    addLog("info", "Menjalankan server dalam mode Production Static Server...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    addLog("success", `Backend Server berjalan aktif di port http://localhost:${PORT}`);
  });
}

startServer();
