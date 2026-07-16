<div align="center">
  <img width="1200" height="475" alt="Notula Banner" src="/assets/images/logo.png" />
  
  <h1>Notula — AI Note-Taker</h1>
  <p><strong>Self-hosted AI meeting note taker dengan Speech-to-Text & Summarization</strong></p>
  
  <p>
    <a href="#-features">Features</a> •
    <a href="#-architecture">Architecture</a> •
    <a href="#-prerequisites">Prerequisites</a> •
    <a href="#-installation">Installation</a> •
    <a href="#-configuration">Configuration</a> •
    <a href="#-usage">Usage</a> •
    <a href="#-stt-providers">STT Providers</a> •
    <a href="#-api-endpoints">API</a> •
    <a href="#-troubleshooting">Troubleshooting</a>
  </p>
</div>

---

## 📖 Overview

**Notula** adalah aplikasi pencatat rapat (meeting note-taker) yang dijalankan secara **self-hosted**. Sistem ini menerima audio rapat, mentranskripsikannya menjadi teks (STT), lalu merangkumnya menggunakan LLM sesuai template yang dipilih.

### ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🎙️ **Speech-to-Text** | Dukungan multi-provider: Gemini, OpenAI Whisper API, **Whisper Local (offline)** |
| 📝 **Smart Summarization** | Ringkasan otomatis dengan template kustom (Rapat Proyek, Kuliah, Standup, dll) |
| 🔐 **Enkripsi AES-256** | Transkripsi & ringkasan dienkripsi sebelum disimpan ke database |
| ☁️ **Google Drive Sync** | Upload audio ke Google Drive (real/simulasi), auto-cleanup file lokal |
| 👥 **Multi-user & Tier** | Free (10 menit/sesi) & Premium (60 menit/sesi) |
| 🔑 **Auth** | Local (username/password) + Google OAuth 2.0 |
| 📊 **Admin Dashboard** | Real-time logs, provider status, database inspector |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Notula Server (Node.js/Express)          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Upload     │  │  Worker     │  │  API        │             │
│  │  Endpoint   │──│  (Queue)    │──│  Routes     │             │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘             │
│         │                │                                      │
│         ▼                ▼                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Local File  │  │ STT Provider│  │ Google Drive│             │
│  │ Storage     │──│ (Gemini/    │──│ (Optional)  │             │
│  │ (uploads/)  │  │  OpenAI/    │  └─────────────┘             │
│  └─────────────┘  │  Whisper)   │                                │
│                   └──────┬──────┘                                │
│                          ▼                                       │
│                   ┌─────────────┐                                │
│                   │ LLM Provider│                                │
│                   │ (Gemini/    │                                │
│                   │  OpenAI/    │                                │
│                   │  Anthropic) │                                │
│                   └─────────────┘                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
            ┌───────────────┐   ┌─────────────────┐
            │ Whisper Local │   │ Encrypted DB    │
            │ (Python/FastAPI)│  │ (db.json)       │
            │ Port 9090     │   └─────────────────┘
            └───────────────┘
```

### Alur Data (New Flow)
1. **Upload** → Audio disimpan ke `uploads/audio_{noteId}.{ext}`
2. **Worker** → Transkripsi dari file lokal (cepat, tidak butuh download)
3. **Background** → Upload ke Google Drive (async, non-blocking)
4. **Cleanup** → Hapus file lokal **setelah** transkripsi selesai (NFR-02.2)
5. **Summarize** → LLM generate ringkasan dari transkripsi
6. **Encrypt** → Enkripsi AES-256 sebelum simpan ke `db.json`

---

## 📋 Prerequisites

| Tool | Version | Required | Notes |
|------|---------|----------|-------|
| **Node.js** | 18+ | ✅ | `npm install` |
| **Python** | 3.9+ | ✅* | Untuk Whisper Local STT |
| **ffmpeg** | latest | ✅* | **Wajib** untuk Whisper Local (decode audio) |

> **\*Required hanya jika menggunakan `AI_PROVIDER=whisper-local`**

### Install ffmpeg (Windows)
```powershell
# Via winget (recommended)
winget install Gyan.FFmpeg

# Atau manual: download dari https://www.gyan.dev/ffmpeg/builds/
# Extract ke C:\ffmpeg, tambahkan C:\ffmpeg\bin ke PATH
```
**Restart terminal** setelah install ffmpeg.

### Install Python Dependencies (untuk Whisper Local)
```bash
cd whisper-server
pip install -r requirements.txt
```
> Akan menginstall: `openai-whisper`, `fastapi`, `uvicorn`, `python-multipart`

---

## 🚀 Installation

### 1. Clone Repository
```bash
git clone <repo-url> notula
cd notula
```

### 2. Install Node.js Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
```bash
cp .env.example .env.local
```
Edit `.env.local` dengan konfigurasi Anda (lihat [Configuration](#-configuration)).

### 4. (Optional) Setup Whisper Local
```bash
cd whisper-server
pip install -r requirements.txt
cd ..
```
> Server akan auto-start Whisper di port 9090 saat `AI_PROVIDER=whisper-local`

### 5. Run Development Server
```bash
npm run dev
```
Server berjalan di: **http://localhost:3000**

### 6. Build untuk Production
```bash
npm run build
npm start
```

---

## ⚙️ Configuration

### `.env.local` — Konfigurasi Utama

```ini
# ===========================
# AI PROVIDER CONFIGURATION
# ===========================
# Pilih provider: gemini | openai | 9router | anthropic | whisper-local
AI_PROVIDER="whisper-local"

# Gemini (Google AI Studio) - https://aistudio.google.com/apikey
GEMINI_API_KEY="your-gemini-key"

# OpenAI / 9router - https://platform.openai.com/api-keys
OPENAI_API_KEY="your-openai-key"
AI_BASE_URL=""                    # Custom base URL (untuk 9router: https://api.9router.com/v1)
AI_STT_ENDPOINT=""                # Custom STT endpoint override

# Anthropic (Claude) - https://console.anthropic.com/
ANTHROPIC_API_KEY="your-anthropic-key"

# Model Overrides (opsional)
AI_MODEL_STT=""                   # STT model override
AI_MODEL_LLM=""                   # LLM model override

# ===========================
# WHISPER LOCAL CONFIG
# ===========================
WHISPER_MODEL="base"              # tiny | base | small | medium | large | turbo
WHISPER_PORT="9090"               # Port server Whisper lokal
WHISPER_LANGUAGE="id"             # Bahasa: id, en, ja, dll (kosong = auto-detect)
WHISPER_DEVICE="cpu"              # cpu | cuda (butuh GPU NVIDIA + CUDA)

# ===========================
# GOOGLE OAUTH (Optional)
# ===========================
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/google/callback"

# ===========================
# APP CONFIG
# ===========================
APP_URL="http://localhost:3000"
```

### 🎯 Pilihan Provider STT

| Provider | STT Quality | Latency | Cost | Offline? | LLM Fallback |
|----------|-------------|---------|------|----------|--------------|
| **whisper-local** | ⭐⭐⭐⭐⭐ | Rendah (local) | Gratis | ✅ Ya | Butuh API Key terpisah |
| **gemini** | ⭐⭐⭐⭐ | Sedang | Gratis (quota) | ❌ | ✅ Built-in |
| **openai** | ⭐⭐⭐⭐⭐ | Sedang | Bayar/token | ❌ | ✅ Built-in |
| **9router** | ⭐⭐⭐⭐ | Sedang | Bayar/token | ❌ | ✅ Built-in |
| **anthropic** | ❌ Tidak ada | - | Bayar/token | ❌ | ✅ Built-in |

> **Rekomendasi**: Gunakan `whisper-local` untuk privasi & biaya nol, + `GEMINI_API_KEY` untuk LLM summarization.

---

## 🎮 Usage

### 1. Akses Aplikasi
Buka browser: **http://localhost:3000**

### 2. Login / Register
- **Local**: Daftar dengan username/password
- **Google**: Klik "Login with Google" (butuh OAuth config)

### 3. Buat Catatan Baru
1. Klik **"Catatan Baru"**
2. Pilih **Template** (Rapat Proyek, Kuliah, Standup, dll)
3. Rekam audio atau upload file (MP3, WAV, WebM, M4A, dll)
4. Klik **"Upload & Proses"**

### 4. Monitor Proses
- Status real-time: `Uploading` → `Transcribing` → `Summarizing` → `Completed`
- Lihat log di **Admin Panel** (jika admin)

### 5. Hasil
- **Transkripsi** verbatim (full text)
- **Ringkasan** sesuai template terpilih
- Data terenkripsi di database, hanya user pemilik yang bisa decrypt

---

## 🤖 STT Providers Detail

### Whisper Local (Offline, Recommended)
```ini
AI_PROVIDER="whisper-local"
WHISPER_MODEL="base"        # tiny(39MB), base(74MB), small(244MB), medium(769MB), large(1.5GB), turbo(809MB)
WHISPER_DEVICE="cpu"        # "cuda" jika punya GPU NVIDIA
WHISPER_LANGUAGE="id"       # Kosongkan untuk auto-detect
```
- Model di-download otomatis pertama kali (~74MB untuk `base`)
- Tetap di memori (RAM) untuk transkripsi cepat subsequent
- **Butuh ffmpeg terinstall!** (lihat Prerequisites)

### Gemini (Google AI Studio)
```ini
AI_PROVIDER="gemini"
GEMINI_API_KEY="your-key"
```
- Gratis dengan quota harian
- STT & LLM pakai model yang sama (`gemini-1.5-flash`)

### OpenAI / 9router
```ini
AI_PROVIDER="openai"        # atau "9router"
OPENAI_API_KEY="your-key"
AI_BASE_URL="https://api.openai.com/v1"  # default OpenAI
# AI_BASE_URL="https://api.9router.com/v1"  # untuk 9router
```
- Bayar per token (Whisper-1 untuk STT, GPT-4o-mini untuk LLM)

### Anthropic (Claude)
```ini
AI_PROVIDER="anthropic"
ANTHROPIC_API_KEY="your-key"
```
- **Hanya LLM** (tidak punya STT), butuh fallback STT provider lain

---

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user lokal |
| POST | `/api/auth/login` | Login user lokal |
| GET | `/api/auth/google` | Initiate Google OAuth |
| GET | `/api/auth/google/callback` | OAuth callback |
| GET | `/api/auth/google/status` | Cek status Google Drive |
| POST | `/api/auth/google/disconnect` | Putuskan Google account |

### Notes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notes?userId=` | List catatan user (terdekripsi) |
| POST | `/api/notes/upload` | Upload audio + mulai proses |
| GET | `/api/notes/:id` | Detail catatan |
| DELETE | `/api/notes/:id` | Hapus catatan |

### Templates
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/templates` | List template |
| POST | `/api/templates` | Buat template baru |

### Google Drive
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/drive/files?userId=` | List file Google Drive user |

### Admin (Monitoring)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/logs` | Server logs real-time |
| GET | `/api/admin/provider` | Info AI provider aktif |
| GET | `/api/admin/whisper` | Status Whisper Local server |
| GET | `/api/admin/gdrive?userId=` | Inspector Google Drive |
| GET | `/api/admin/db` | Full database dump |
| POST | `/api/admin/clear` | **HAPUS SEMUA DATA** (hati-hati!) |

---

## 📁 Project Structure

```
notula/
├── whisper-server/           # Python Whisper Local STT Server
│   ├── whisper_server.py     # FastAPI server (port 9090)
│   └── requirements.txt      # Python deps
├── src/
│   ├── ai-provider.ts        # AI Provider abstraction (Gemini, OpenAI, Whisper, Anthropic)
│   ├── whisper-local.ts      # Whisper Local lifecycle manager
│   ├── types.ts              # TypeScript types & interfaces
│   ├── App.tsx               # React frontend
│   ├── main.tsx              # Entry point
│   └── index.css             # Tailwind styles
├── uploads/                  # Temporary audio files (auto-cleanup)
├── google_drive_sim/         # Simulated Google Drive storage
├── server.ts                 # Express + Vite backend
├── db.json                   # Encrypted database (JSON)
├── .env.example              # Environment template
├── .env.local                # Your local config (gitignored)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🛠 Troubleshooting

### ❌ `FileNotFoundError: [WinError 2] The system cannot find the file specified`
**Penyebab**: ffmpeg tidak terinstall atau tidak di PATH.

**Solusi**:
```powershell
winget install Gyan.FFmpeg
# RESTART TERMINAL/POWERSHELL
ffmpeg -version  # harus keluar versi
```

### ❌ Whisper Local tidak start / port 9090 sudah digunakan
**Solusi**:
```ini
# Ganti port di .env.local
WHISPER_PORT="9091"
```
Atau kill process yang pakai port 9090:
```powershell
netstat -ano | findstr :9090
taskkill /PID <PID> /F
```

### ❌ `Model Whisper belum dimuat` / 503 Service Unavailable
**Penyebab**: Model belum selesai download/load (pertama kali butuh waktu 30-60s).

**Solusi**: Tunggu sebentar, cek log server: `Memuat model 'base'...` → `Model 'base' siap dalam X dtk.`

### ❌ Google Drive upload gagal
- Pastikan `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` benar
- User sudah login via Google OAuth
- Cek log: `Background: Mengunggah ke Google Drive sungguhan...`

### ❌ Transkripsi hasilnya kosong / "[Tidak ada teks terdeteksi]"
- Cek format audio didukung (MP3, WAV, WebM, M4A, FLAC, OGG)
- Cek durasi audio tidak 0 detik
- Untuk Whisper local: coba `WHISPER_LANGUAGE="id"` (jangan auto-detect)

### ❌ Out of Memory (Whisper Large model)
Gunakan model lebih kecil:
```ini
WHISPER_MODEL="base"    # atau "small", hindari "large" jika RAM < 8GB
WHISPER_DEVICE="cpu"    # "cuda" butuh VRAM GPU
```

---

## 🔒 Security Notes

- **Enkripsi AES-256-CBC** di level aplikasi sebelum simpan ke `db.json`
- **Kunci enkripsi** hardcoded di `server.ts` (ganti untuk production!)
- **File audio** dihapus otomatis setelah transkripsi (NFR-02.2)
- **Jangan commit** `.env.local`, `db.json`, `uploads/`, `google_drive_sim/`

---

## 📝 License

MIT License — Feel free to use, modify, and distribute.

---

## 🤝 Contributing

1. Fork repository
2. Buat branch fitur: `git checkout -b feature/nama-fitur`
3. Commit perubahan: `git commit -m "Add: nama fitur"`
4. Push: `git push origin feature/nama-fitur`
5. Buat Pull Request

---

## 📞 Support

- **Issues**: GitHub Issues untuk bug reports & feature requests
- **Docs**: README ini + komentar di kode (TypeScript + Python)

---

<div align="center">
  <sub>Built with ❤️ using Node.js, React, TypeScript, Express, Vite, TailwindCSS, 
  <br>+ Python FastAPI, OpenAI Whisper, Google Gemini, OpenAI API</sub>
</div>
