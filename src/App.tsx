/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  Square,
  UploadCloud,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  Plus,
  HardDrive,
  Database,
  Terminal,
  Settings,
  User,
  Lock,
  Unlock,
  Info,
  RefreshCw,
  FileAudio,
  FileText,
  Layers,
  Globe,
  ChevronDown,
  ChevronUp,
  Activity,
  LogOut,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ProcessStatus, ServerLog, NoteTemplate, Note, AccountTier, VirtualDriveFile } from "./types";

export default function App() {
  // Authentication states
  const [token, setToken] = useState<string | null>(localStorage.getItem("note_taker_token"));
  const [currentUser, setCurrentUser] = useState<any>(
    localStorage.getItem("note_taker_user") ? JSON.parse(localStorage.getItem("note_taker_user")!) : null
  );
  const [currentTier, setCurrentTier] = useState<AccountTier | null>(
    localStorage.getItem("note_taker_tier") ? JSON.parse(localStorage.getItem("note_taker_tier")!) : null
  );

  // Auth Form State
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authTier, setAuthTier] = useState("tier-premium");
  const [authError, setAuthError] = useState("");

  // Notes and Templates
  const [notes, setNotes] = useState<Note[]>([]);
  const [templates, setTemplates] = useState<NoteTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedBase64, setRecordedBase64] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [offlineStatus, setOfflineStatus] = useState<string | null>(null);

  // Custom Template Form State
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newTplName, setNewTplName] = useState("");
  const [newTplDesc, setNewTplDesc] = useState("");
  const [newTplSys, setNewTplSys] = useState("");
  const [newTplUser, setNewTplUser] = useState("");
  const [tplError, setTplError] = useState("");

  // Admin Logs & Storage Monitor State
  const [serverLogs, setServerLogs] = useState<ServerLog[]>([]);
  const [gdriveFiles, setGdriveFiles] = useState<VirtualDriveFile[]>([]);
  const [rawDb, setRawDb] = useState<any>(null);
  const [adminTab, setAdminTab] = useState<"logs" | "gdrive" | "database">("logs");
  const [decryptAdminDb, setDecryptAdminDb] = useState(false);

  // UI status helpers
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // References
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // Load Initial Data on Login
  useEffect(() => {
    if (token && currentUser) {
      fetchNotes();
      fetchTemplates();
    }
    fetchAdminLogs();
    fetchAdminGdrive();
    fetchAdminDb();

    // Setup polling for notes status, server logs, and virtual drive
    const interval = setInterval(() => {
      if (token && currentUser) {
        fetchNotesSilently();
      }
      fetchAdminLogsSilently();
      fetchAdminGdriveSilently();
      fetchAdminDbSilently();
    }, 4000);

    return () => clearInterval(interval);
  }, [token, currentUser]);

  // Auto scroll server terminal to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [serverLogs]);

  // APIs Functions
  const fetchNotes = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/notes?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
      }
    } catch (err) {
      console.error("Gagal memuat catatan", err);
    }
  };

  const fetchNotesSilently = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/notes?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        // Update without full reload flickering
        setNotes(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
        if (data.length > 0 && !selectedTemplateId) {
          setSelectedTemplateId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Gagal memuat template", err);
    }
  };

  const fetchAdminLogs = async () => {
    try {
      const res = await fetch("/api/admin/logs");
      if (res.ok) {
        const data = await res.json();
        setServerLogs(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminLogsSilently = async () => {
    try {
      const res = await fetch("/api/admin/logs");
      if (res.ok) {
        const data = await res.json();
        setServerLogs(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminGdrive = async () => {
    try {
      const res = await fetch("/api/admin/gdrive");
      if (res.ok) {
        const data = await res.json();
        setGdriveFiles(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminGdriveSilently = async () => {
    try {
      const res = await fetch("/api/admin/gdrive");
      if (res.ok) {
        const data = await res.json();
        setGdriveFiles(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminDb = async () => {
    try {
      const res = await fetch("/api/admin/db");
      if (res.ok) {
        const data = await res.json();
        setRawDb(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminDbSilently = async () => {
    try {
      const res = await fetch("/api/admin/db");
      if (res.ok) {
        const data = await res.json();
        setRawDb(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Auth Operations
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!authUsername || !authPassword) {
      setAuthError("Semua kolom wajib diisi.");
      return;
    }

    const endpoint = isRegisterMode ? "/api/auth/register" : "/api/auth/login";
    const bodyPayload = isRegisterMode
      ? { username: authUsername, password: authPassword, tierId: authTier }
      : { username: authUsername, password: authPassword };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Terjadi kesalahan autentikasi.");
        return;
      }

      // Save Auth Context
      localStorage.setItem("note_taker_token", data.token);
      localStorage.setItem("note_taker_user", JSON.stringify(data.user));
      localStorage.setItem("note_taker_tier", JSON.stringify(data.tier));

      setToken(data.token);
      setCurrentUser(data.user);
      setCurrentTier(data.tier);
      setAuthUsername("");
      setAuthPassword("");
    } catch (err) {
      setAuthError("Gagal terhubung ke server.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("note_taker_token");
    localStorage.removeItem("note_taker_user");
    localStorage.removeItem("note_taker_tier");
    setToken(null);
    setCurrentUser(null);
    setCurrentTier(null);
    setNotes([]);
  };

  // Audio Recording Operations (Web Audio API & MediaRecorder)
  const startRecording = async () => {
    setOfflineStatus(null);
    setRecordedBlob(null);
    setRecordedBase64(null);
    setRecordingDuration(0);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedBlob(audioBlob);

        // Convert blob to base64 to simulate local resilient storage in state
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          // Extract base64 part only
          const rawBase64 = base64data.split(",")[1];
          setRecordedBase64(rawBase64);

          // FR-02.3: Audio disimpan sementara di lokal client sebelum diupload
          setOfflineStatus(
            "Audio berhasil direkam dan diamankan di memori lokal perangkat offline (IndexedDB/State). Siap disinkronkan."
          );
        };

        // Stop all audio tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250); // Get data slice every 250ms
      setIsRecording(true);
      isRecordingRef.current = true;

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          // Tier limit checks
          if (currentTier && prev >= currentTier.maxDurationSeconds) {
            stopRecording();
            setOfflineStatus(
              `Perekaman otomatis dihentikan karena telah mencapai batas maksimum untuk ${currentTier.name} (${currentTier.maxDurationSeconds / 60} menit).`
            );
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Gagal mengakses mikrofon", err);
      alert("Gagal mengakses mikrofon perangkat. Harap izinkan akses mikrofon.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    isRecordingRef.current = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleUploadAndProcess = async () => {
    if (!recordedBase64 || !currentUser) return;
    if (!noteTitle.trim()) {
      alert("Harap masukkan judul rapat.");
      return;
    }

    setIsUploading(true);
    setUploadError("");

    try {
      const res = await fetch("/api/notes/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          title: noteTitle,
          durationSeconds: recordingDuration,
          audioBase64: recordedBase64,
          templateId: selectedTemplateId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Gagal mengunggah audio.");
        setIsUploading(false);
        return;
      }

      // Reset state on successful upload
      setNoteTitle("");
      setRecordedBlob(null);
      setRecordedBase64(null);
      setRecordingDuration(0);
      setOfflineStatus(null);
      setIsUploading(false);

      // Force fetch notes
      fetchNotes();
    } catch (err) {
      setUploadError("Gagal terhubung ke server.");
      setIsUploading(false);
    }
  };

  // Add Custom Template
  const handleAddTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setTplError("");
    if (!newTplName || !newTplSys || !newTplUser) {
      setTplError("Kolom Nama, System Prompt, dan User Prompt wajib diisi.");
      return;
    }

    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTplName,
          description: newTplDesc,
          systemPrompt: newTplSys,
          userPromptTemplate: newTplUser,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setTplError(data.error || "Gagal menambahkan template.");
        return;
      }

      // Refresh and reset
      fetchTemplates();
      setNewTplName("");
      setNewTplDesc("");
      setNewTplSys("");
      setNewTplUser("");
      setShowAddTemplate(false);
    } catch (err) {
      setTplError("Gagal terhubung ke server.");
    }
  };

  // Clear Database
  const handleClearServer = async () => {
    if (confirm("Apakah Anda yakin ingin menghapus seluruh database, file di Google Drive, dan log server? Tindakan ini tidak dapat dibatalkan.")) {
      try {
        const res = await fetch("/api/admin/clear", { method: "POST" });
        if (res.ok) {
          alert("Semua data berhasil dibersihkan.");
          handleLogout();
          fetchAdminLogs();
          fetchAdminGdrive();
          fetchAdminDb();
        }
      } catch (err) {
        alert("Gagal membersihkan data server.");
      }
    }
  };

  // Helper formatting
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusBadge = (status: ProcessStatus) => {
    switch (status) {
      case ProcessStatus.UPLOADING:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" /> Uploading
          </span>
        );
      case ProcessStatus.TRANSCRIBING:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" /> Transcribing
          </span>
        );
      case ProcessStatus.SUMMARIZING:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" /> Summarizing
          </span>
        );
      case ProcessStatus.COMPLETED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </span>
        );
      case ProcessStatus.FAILED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" /> Failed
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] font-sans text-[#E0E0E0] flex flex-col antialiased select-none">
      {/* GLOBAL HEADER */}
      <header className="bg-[#0F0F10] border-b border-[#262626] py-4 px-6 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2.5 rounded-sm">
              <Mic className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight uppercase text-[#E0E0E0] font-display flex items-center gap-2">
                NOTULA
                <span className="text-[10px] font-mono bg-indigo-950 text-indigo-400 border border-indigo-900/40 px-2 py-0.5 rounded-sm">
                  v1.0-Alpha
                </span>
              </h1>
              <p className="text-xs text-[#A1A1AA]">
                Perekaman Audio, Sinkronisasi Google Drive, &amp; Transkripsi/Rangkuman Terenkripsi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {currentUser && currentTier && (
              <div className="flex items-center gap-3 bg-[#18181B] px-3 py-1.5 rounded-sm border border-[#262626]">
                <div className="bg-indigo-950 text-indigo-400 p-1.5 rounded-sm">
                  <User className="w-4 h-4" />
                </div>
                <div className="text-left text-xs">
                  <p className="font-semibold text-[#E0E0E0]">
                    {currentUser.username} <span className="font-mono text-[10px] text-indigo-400 font-bold">({currentTier.name.toUpperCase()})</span>
                  </p>
                  <p className="text-[10px] text-[#A1A1AA]">
                    Maks: {currentTier.maxDurationSeconds / 60} menit / sesi
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  title="Logout"
                  className="ml-2 p-1 text-[#71717A] hover:text-red-400 hover:bg-[#262626] rounded-sm transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={handleClearServer}
              className="px-3.5 py-1.5 text-xs font-mono font-bold tracking-wider uppercase text-[#E0E0E0] bg-[#18181B] border border-[#262626] hover:bg-[#262626] rounded-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
              Reset Server
            </button>
          </div>
        </div>
      </header>

      {/* DASHBOARD CONTENT */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: THE MOBILE / CLIENT SIMULATOR FRAME */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          <div className="border border-[#262626] rounded-md bg-[#0F0F10] shadow-2xl relative overflow-hidden flex-1 flex flex-col max-h-[820px] min-h-[500px]">
            {/* Top Device Notch Style */}
            <div className="h-4 bg-[#0A0A0B] flex justify-center items-center relative z-20 border-b border-[#262626]">
              <div className="w-20 h-3 bg-black rounded-b-sm absolute top-0"></div>
            </div>

            {/* Mobile App Viewport */}
            <div className="flex-1 p-5 overflow-y-auto flex flex-col bg-[#0A0A0B]">
              {!token ? (
                /* AUTH VIEW */
                <div className="my-auto max-w-md w-full mx-auto bg-[#18181B] p-6 rounded-sm border border-[#262626]">
                  <div className="text-center mb-6">
                    <span className="inline-flex bg-indigo-950/50 border border-indigo-900/30 p-3 rounded-sm text-indigo-400 mb-2">
                      <Mic className="w-8 h-8" />
                    </span>
                    <h2 className="text-base font-black uppercase tracking-tight font-display text-[#E0E0E0]">Selamat Datang di NoteSync</h2>
                    <p className="text-xs text-[#A1A1AA] mt-1">
                      Silakan masuk atau daftar untuk mensinkronisasi rekaman Anda.
                    </p>
                  </div>

                  {authError && (
                    <div className="mb-4 bg-red-950/30 border border-red-900 text-red-400 p-3 rounded-sm text-xs flex items-start gap-2 font-mono">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>{authError}</p>
                    </div>
                  )}

                  <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] mb-1">Username</label>
                      <input
                        type="text"
                        value={authUsername}
                        onChange={(e) => setAuthUsername(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-[#262626] rounded-sm focus:outline-hidden focus:border-indigo-500 bg-[#0F0F10] text-[#E0E0E0]"
                        placeholder="Masukkan username"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] mb-1">Password</label>
                      <input
                        type="password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-[#262626] rounded-sm focus:outline-hidden focus:border-indigo-500 bg-[#0F0F10] text-[#E0E0E0]"
                        placeholder="Masukkan password"
                      />
                    </div>

                    {isRegisterMode && (
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] mb-1">Account Tier</label>
                        <select
                          value={authTier}
                          onChange={(e) => setAuthTier(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-[#262626] rounded-sm bg-[#0F0F10] text-[#E0E0E0] focus:outline-hidden focus:border-indigo-500"
                        >
                          <option value="tier-free" className="bg-[#0F0F10]">Free Tier (Maks. 10 Menit)</option>
                          <option value="tier-premium" className="bg-[#0F0F10]">Premium Tier (Maks. 1 Jam)</option>
                        </select>
                        <p className="text-[10px] text-[#71717A] mt-1 leading-normal font-mono">
                          Tier akun tersimpan di lookup table database relasional secara dinamis.
                        </p>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-widest py-2.5 px-4 rounded-sm text-xs transition-all cursor-pointer"
                    >
                      {isRegisterMode ? "Daftar Akun Baru" : "Masuk"}
                    </button>
                  </form>

                  <div className="mt-4 text-center">
                    <button
                      onClick={() => {
                        setIsRegisterMode(!isRegisterMode);
                        setAuthError("");
                      }}
                      className="text-xs text-indigo-400 hover:underline font-bold uppercase tracking-wider cursor-pointer"
                    >
                      {isRegisterMode ? "Sudah punya akun? Masuk di sini" : "Belum punya akun? Daftar di sini"}
                    </button>
                  </div>
                </div>
              ) : (
                /* MAIN APP RECORDR & LIST */
                <div className="flex flex-col gap-5 flex-1">
                  {/* APP TITLE / SEARCH BAR */}
                  <div className="bg-indigo-600 text-white p-4 rounded-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 opacity-10">
                      <Mic className="w-32 h-32" />
                    </div>
                    <p className="text-[10px] uppercase tracking-widest text-indigo-200 font-mono font-bold">
                      Mobile Client (Simulasi Perangkat)
                    </p>
                    <h3 className="text-base font-black uppercase tracking-tight font-display mt-0.5">Note-Taker Personal Anda</h3>
                  </div>

                  {/* ACTIVE RECORDR CONTAINER */}
                  <div className="bg-[#18181B] p-4 rounded-sm border border-[#262626] flex flex-col items-center">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#A1A1AA] mb-3 self-start">
                      Mulai Sesi Rekaman Baru
                    </h4>

                    {/* Microphone Pulse Animation when recording */}
                    <div className="relative my-4 flex items-center justify-center">
                      {isRecording && (
                        <>
                          <span className="absolute inline-flex h-24 w-24 rounded-full bg-rose-500 opacity-10 animate-ping pointer-events-none"></span>
                          <span className="absolute inline-flex h-20 w-20 rounded-full bg-rose-500 opacity-20 animate-pulse pointer-events-none"></span>
                        </>
                      )}
                      <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`w-16 h-16 rounded-sm flex items-center justify-center text-white transition-all cursor-pointer ${
                          isRecording
                            ? "bg-rose-600 hover:bg-rose-700"
                            : "bg-indigo-600 hover:bg-indigo-700"
                        }`}
                      >
                        {isRecording ? <Square className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                      </button>
                    </div>

                    <p className={`text-sm font-mono font-bold ${isRecording ? "text-rose-500 animate-pulse" : "text-[#E0E0E0]"}`}>
                      {formatTime(recordingDuration)}
                    </p>
                    <p className="text-[10px] text-[#71717A] mt-1 font-mono uppercase tracking-wider">
                      {isRecording ? "Sedang merekam suara dari mikrofon internal..." : "Tekan tombol untuk merekam audio."}
                    </p>

                    {/* Offline Buffer Warning */}
                    {offlineStatus && (
                      <div className="mt-4 bg-indigo-950/40 border border-indigo-900/30 p-2.5 rounded-sm text-[11px] text-indigo-300 flex items-start gap-1.5 text-left font-sans">
                        <HardDrive className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
                        <p>{offlineStatus}</p>
                      </div>
                    )}

                    {/* Sync form when recorded file exists */}
                    {recordedBase64 && !isRecording && (
                      <div className="mt-4 w-full border-t border-[#262626] pt-4 space-y-3 text-left">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#A1A1AA] mb-1">Judul Rapat</label>
                          <input
                            type="text"
                            value={noteTitle}
                            onChange={(e) => setNoteTitle(e.target.value)}
                            placeholder="Contoh: Rapat Proyek AI Note-Taker"
                            className="w-full px-3 py-1.5 text-xs border border-[#262626] rounded-sm bg-[#0F0F10] text-[#E0E0E0] outline-hidden focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#A1A1AA] mb-1">Template AI</label>
                          <select
                            value={selectedTemplateId}
                            onChange={(e) => setSelectedTemplateId(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border border-[#262626] rounded-sm bg-[#0F0F10] text-[#E0E0E0] outline-hidden focus:border-indigo-500"
                          >
                            {templates.map((tpl) => (
                              <option key={tpl.id} value={tpl.id} className="bg-[#0F0F10]">
                                {tpl.name} ({tpl.description})
                              </option>
                            ))}
                          </select>
                        </div>

                        {uploadError && (
                          <p className="text-[11px] text-red-400 bg-red-950/30 p-2 rounded-sm border border-red-900 font-mono">
                            {uploadError}
                          </p>
                        )}

                        <button
                          onClick={handleUploadAndProcess}
                          disabled={isUploading}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white font-bold uppercase tracking-widest text-xs py-2 px-3 rounded-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                        >
                          {isUploading ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <UploadCloud className="w-3.5 h-3.5" />
                          )}
                          {isUploading ? "MENSINKRONKAN..." : "UNGGAH & MULAI PROSES AI"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* NOTE LIST SECTION */}
                  <div className="flex-1 flex flex-col min-h-[250px]">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-[#71717A] uppercase tracking-wider">
                        Daftar Catatan Rapat ({notes.length})
                      </h4>
                      <button
                        onClick={fetchNotes}
                        className="text-xs text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer font-bold uppercase tracking-wider"
                      >
                        <RefreshCw className="w-3 h-3" /> Refresh
                      </button>
                    </div>

                    <div className="space-y-3 overflow-y-auto flex-1 max-h-[420px] pr-1">
                      {notes.length === 0 ? (
                        <div className="bg-[#18181B] rounded-sm border border-dashed border-[#262626] p-8 text-center text-[#71717A] text-xs">
                          <FileAudio className="w-8 h-8 mx-auto mb-2 opacity-50 text-indigo-400" />
                          Belum ada catatan rapat. Mulai merekam untuk menambahkan catatan baru.
                        </div>
                      ) : (
                        notes.map((note) => {
                          const isExpanded = expandedNoteId === note.id;
                          return (
                            <div
                              key={note.id}
                              className="bg-[#18181B] border border-[#262626] rounded-sm overflow-hidden hover:border-[#3F3F46] transition-all text-left"
                            >
                              {/* Accordion Trigger */}
                              <div
                                onClick={() => setExpandedNoteId(isExpanded ? null : note.id)}
                                className={`p-3.5 flex items-start justify-between gap-3 cursor-pointer select-none transition-colors ${
                                  isExpanded ? "border-l-2 border-indigo-500 bg-[#0F0F10]" : ""
                                }`}
                              >
                                <div className="space-y-1">
                                  <h5 className="text-xs font-bold text-[#E0E0E0]">{note.title}</h5>
                                  <div className="flex flex-wrap gap-x-2 gap-y-1 items-center text-[10px] text-[#A1A1AA] font-mono">
                                    <span className="bg-[#0A0A0B] border border-[#262626] px-1.5 py-0.5 rounded-sm">
                                      {formatTime(note.durationSeconds)}
                                    </span>
                                    <span>•</span>
                                    <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {getStatusBadge(note.status)}
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-[#71717A]" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-[#71717A]" />
                                  )}
                                </div>
                              </div>

                              {/* Expanded content */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="border-t border-[#262626] bg-[#0A0A0B] text-xs overflow-hidden"
                                  >
                                    <div className="p-4 space-y-4">
                                      {/* Storage Metadata */}
                                      <div className="bg-[#18181B] p-2.5 rounded-sm border border-[#262626] flex items-center justify-between text-[10px] text-[#A1A1AA] font-mono">
                                        <div className="flex items-center gap-1.5">
                                          <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                                          <span>Cloud Storage: </span>
                                        </div>
                                        <span className="font-semibold text-[#E0E0E0] bg-[#0F0F10] border border-[#262626] px-2 py-0.5 rounded-sm">
                                          Google Drive (ID: {note.gdriveFileId || "Failed"})
                                        </span>
                                      </div>

                                      {/* IF PROCESSED SUCCESSFULLY */}
                                      {note.status === ProcessStatus.COMPLETED && (
                                        <div className="space-y-4">
                                          {/* Transkripsi Audio */}
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <h6 className="font-bold text-[#E0E0E0] flex items-center gap-1 text-[11px] uppercase tracking-wider">
                                                <FileAudio className="w-3.5 h-3.5 text-indigo-400" />
                                                TRANSKRIPSI VERBATIM
                                              </h6>
                                              <span className="text-[9px] bg-green-950/40 text-green-400 border border-green-900/40 px-1.5 py-0.5 rounded-sm flex items-center gap-1 font-mono">
                                                <Unlock className="w-2.5 h-2.5" /> Decrypted (AES-256)
                                              </span>
                                            </div>
                                            <div className="bg-[#18181B] border border-[#262626] p-3 rounded-sm text-[11px] leading-relaxed text-[#A1A1AA] max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
                                              {(note as any).transcription}
                                            </div>
                                          </div>

                                          {/* Rangkuman & Action Items */}
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <h6 className="font-bold text-indigo-400 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                                                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                                                RANGKUMAN &amp; TINDAKAN
                                              </h6>
                                              <span className="text-[9px] bg-green-950/40 text-green-400 border border-green-900/40 px-1.5 py-0.5 rounded-sm flex items-center gap-1 font-mono">
                                                <Unlock className="w-2.5 h-2.5" /> Decrypted (AES-256)
                                              </span>
                                            </div>
                                            <div className="bg-[#18181B] border border-[#262626] p-3.5 rounded-sm text-[11px] leading-relaxed text-[#D4D4D8] whitespace-pre-wrap markdown-body font-sans">
                                              {(note as any).summary}
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* IF PROCESSING OR QUEUED */}
                                      {(note.status === ProcessStatus.UPLOADING ||
                                        note.status === ProcessStatus.TRANSCRIBING ||
                                        note.status === ProcessStatus.SUMMARIZING) && (
                                        <div className="py-6 text-center text-[#A1A1AA] space-y-2">
                                          <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin mx-auto" />
                                          <p className="font-bold uppercase tracking-wider text-[11px]">
                                            Sistem AI sedang memproses berkas audio Anda...
                                          </p>
                                          <p className="text-[10px] text-[#71717A] font-mono">
                                            Fase: {note.status}. Mengambil transkripsi &amp; menyusun ringkasan rapat.
                                          </p>
                                        </div>
                                      )}

                                      {/* IF FAILED */}
                                      {note.status === ProcessStatus.FAILED && (
                                        <div className="bg-red-950/30 border border-red-900 p-3.5 rounded-sm space-y-2">
                                          <div className="flex items-center gap-1.5 text-red-400 font-bold uppercase tracking-wider text-[11px]">
                                            <AlertCircle className="w-4 h-4 shrink-0" />
                                            <span>Kesalahan Sistem (FR-04.1)</span>
                                          </div>
                                          <p className="text-[11px] text-red-300 font-mono whitespace-pre-wrap break-all leading-normal">
                                            {note.errorMessage || "Terjadi kesalahan API yang tidak diketahui."}
                                          </p>
                                          <p className="text-[10px] text-[#71717A] leading-normal font-sans">
                                            Catatan: Sistem tidak melakukan auto-retry untuk mencegah pemborosan kuota API. Harap periksa GEMINI_API_KEY Anda.
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom device bezel decorative bar */}
            <div className="h-6 bg-[#0A0A0B] flex justify-center items-center border-t border-[#262626]">
              <div className="w-32 h-1 bg-[#262626] rounded-full"></div>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: THE SERVER ADMINISTRATIVE PANEL & STORAGE VISUALIZER */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          {/* THE AI TEMPLATE DYNAMIC CONFIGURATOR (FR-04.1 / NFR-04.1) */}
          <div className="bg-[#0F0F10] border border-[#262626] rounded-sm p-5 text-left">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold uppercase tracking-tight text-[#E0E0E0] font-display">
                  Manajer Template AI (NFR-04 Lookup Tables)
                </h3>
              </div>
              <button
                onClick={() => setShowAddTemplate(!showAddTemplate)}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-sm font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Template
              </button>
            </div>

            <p className="text-xs text-[#A1A1AA] mb-4 leading-relaxed">
              Aturan NFR-04.1 mengharuskan skema database dirancang modular. Penambahan template baru (misal: Kuliah, Wawancara) disimpan secara dinamis sebagai entitas baru tanpa mengubah kode server.
            </p>

            {/* Form to Add Dynamic Template */}
            <AnimatePresence>
              {showAddTemplate && (
                <motion.form
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  onSubmit={handleAddTemplate}
                  className="mb-4 bg-[#18181B] p-4 rounded-sm border border-[#262626] space-y-3"
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Daftarkan Template Baru</h4>

                  {tplError && (
                    <p className="text-[11px] text-red-400 bg-red-950/30 p-1.5 rounded-sm border border-red-900 font-mono">
                      {tplError}
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] mb-0.5">Nama Template</label>
                      <input
                        type="text"
                        value={newTplName}
                        onChange={(e) => setNewTplName(e.target.value)}
                        placeholder="Contoh: Kuliah Sejarah"
                        className="w-full px-2 py-1 text-xs border border-[#262626] rounded-sm bg-[#0A0A0B] text-[#E0E0E0]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] mb-0.5">Deskripsi Ringkas</label>
                      <input
                        type="text"
                        value={newTplDesc}
                        onChange={(e) => setNewTplDesc(e.target.value)}
                        placeholder="Contoh: Sangat cocok untuk mencatat rincian materi"
                        className="w-full px-2 py-1 text-xs border border-[#262626] rounded-sm bg-[#0A0A0B] text-[#E0E0E0]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] mb-0.5">System Prompt (AI Persona)</label>
                    <textarea
                      value={newTplSys}
                      onChange={(e) => setNewTplSys(e.target.value)}
                      placeholder="Contoh: Anda adalah asisten akademis profesional. Tugas Anda adalah merangkum poin perkuliahan..."
                      rows={2}
                      className="w-full px-2 py-1 text-xs border border-[#262626] rounded-sm bg-[#0A0A0B] text-[#E0E0E0] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] mb-0.5">
                      User Prompt Template (Gunakan tag {"{{TRANSCRIPTION}}"} )
                    </label>
                    <textarea
                      value={newTplUser}
                      onChange={(e) => setNewTplUser(e.target.value)}
                      placeholder="Rangkumlah transkripsi berikut:\n\n### POIN UTAMA\n...\n\nTranskripsi:\n{{TRANSCRIPTION}}"
                      rows={3}
                      className="w-full px-2 py-1 text-xs border border-[#262626] rounded-sm bg-[#0A0A0B] text-[#E0E0E0] font-mono"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddTemplate(false)}
                      className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[#A1A1AA] bg-[#0A0A0B] border border-[#262626] rounded-sm"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 rounded-sm"
                    >
                      Daftarkan Template
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* List templates dynamically */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {templates.map((tpl) => (
                <div key={tpl.id} className="border border-[#262626] bg-[#18181B] p-3 rounded-sm flex flex-col justify-between hover:border-[#3F3F46] transition-colors">
                  <div>
                    <span className="text-[9px] bg-indigo-950/50 text-indigo-400 font-bold border border-indigo-900/40 px-1.5 py-0.5 rounded-sm">
                      ID: {tpl.id}
                    </span>
                    <h4 className="text-xs font-bold text-[#E0E0E0] mt-1.5">{tpl.name}</h4>
                    <p className="text-[10px] text-[#A1A1AA] mt-0.5 leading-normal">{tpl.description}</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-[#262626] flex items-center justify-between text-[9px] text-[#71717A] font-mono uppercase tracking-wider">
                    <span>Prompt lookup dynamic</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* BACKEND OVERSIGHT & CLOUD INTEGRATION VIEW */}
          <div className="bg-[#0F0F10] text-[#E0E0E0] border border-[#262626] rounded-sm overflow-hidden flex-1 flex flex-col min-h-[480px]">
            {/* Tab header */}
            <div className="bg-[#0A0A0B] border-b border-[#262626] px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400 animate-pulse" />
                <h3 className="text-sm font-bold font-mono tracking-tight uppercase text-[#E0E0E0]">
                  PANEL INTEGRASI AWAN &amp; ADMIN BACKEND
                </h3>
              </div>

              <div className="flex items-center gap-1.5 bg-[#18181B] p-1 rounded-sm border border-[#262626] self-start">
                <button
                  onClick={() => setAdminTab("logs")}
                  className={`px-3 py-1 text-xs font-mono rounded-sm transition-all flex items-center gap-1 cursor-pointer ${
                    adminTab === "logs" ? "bg-[#262626] text-emerald-400 font-bold border border-[#3F3F46]" : "text-[#A1A1AA] hover:text-[#E0E0E0]"
                  }`}
                >
                  <Terminal className="w-3 h-3" /> Server Logs
                </button>
                <button
                  onClick={() => setAdminTab("gdrive")}
                  className={`px-3 py-1 text-xs font-mono rounded-sm transition-all flex items-center gap-1 cursor-pointer ${
                    adminTab === "gdrive" ? "bg-[#262626] text-cyan-400 font-bold border border-[#3F3F46]" : "text-[#A1A1AA] hover:text-[#E0E0E0]"
                  }`}
                >
                  <HardDrive className="w-3 h-3" /> G-Drive Storage
                </button>
                <button
                  onClick={() => setAdminTab("database")}
                  className={`px-3 py-1 text-xs font-mono rounded-sm transition-all flex items-center gap-1 cursor-pointer ${
                    adminTab === "database" ? "bg-[#262626] text-amber-400 font-bold border border-[#3F3F46]" : "text-[#A1A1AA] hover:text-[#E0E0E0]"
                  }`}
                >
                  <Database className="w-3 h-3" /> Relational DB
                </button>
              </div>
            </div>

            {/* Tab Content body */}
            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-left bg-[#0A0A0B]">
              {/* TAB 1: SERVER LOGS TERMINAL */}
              {adminTab === "logs" && (
                <div className="space-y-1.5 h-[340px] overflow-y-auto font-mono bg-[#0F0F10] p-3 rounded-sm border border-[#262626]">
                  <div className="text-[#71717A] text-[10px] pb-1 border-b border-[#262626] uppercase tracking-wider">
                    Console output - Real-time background logging (polling 4s)
                  </div>
                  {serverLogs.length === 0 ? (
                    <div className="text-[#71717A] py-10 text-center text-[11px] uppercase tracking-wider">
                      Menunggu aksi server...
                    </div>
                  ) : (
                    [...serverLogs].reverse().map((log, idx) => {
                      let colorClass = "text-[#E0E0E0]";
                      if (log.level === "success") colorClass = "text-emerald-400";
                      if (log.level === "warning") colorClass = "text-amber-400";
                      if (log.level === "error") colorClass = "text-rose-400";

                      return (
                        <div key={idx} className="leading-relaxed flex items-start gap-1.5 font-mono">
                          <span className="text-[#71717A] shrink-0 select-none">[{log.timestamp}]</span>
                          <span className="text-indigo-400 shrink-0 select-none">[SYS]</span>
                          <div className="space-y-0.5">
                            <p className={`${colorClass} font-semibold`}>{log.message}</p>
                            {log.details && <p className="text-[10px] text-[#71717A] leading-normal">{log.details}</p>}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={logsEndRef} />
                </div>
              )}

              {/* TAB 2: VIRTUAL GOOGLE DRIVE (NFR-02.1 / NFR-02.2) */}
              {adminTab === "gdrive" && (
                <div className="space-y-4">
                  <div className="bg-[#18181B] p-3.5 border border-[#262626] rounded-sm space-y-2">
                    <div className="flex items-center justify-between text-cyan-400 font-bold uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <HardDrive className="w-4 h-4" /> Penyimpanan Cloud Google Drive (Simulasi Awan API)
                      </span>
                      <span className="text-[10px] bg-cyan-950/50 text-cyan-400 border border-cyan-900/40 px-2 py-0.5 rounded-sm">
                        Uptime: 100%
                      </span>
                    </div>
                    <p className="text-[11px] text-[#A1A1AA] leading-relaxed font-sans">
                      Sesuai aturan **NFR-02.1 &amp; NFR-02.2**, file audio disimpan di cloud storage eksternal (Google Drive) untuk menghemat server storage lokal. Segera setelah unggahan audio diverifikasi di Google Drive, salinan fisik lokal di server backend dihapus sepenuhnya.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="bg-[#0A0A0B] p-3 rounded-sm border border-[#262626]">
                        <h4 className="text-[10px] uppercase font-bold tracking-wider text-[#71717A]">Penyimpanan Server Lokal</h4>
                        <div className="flex items-center gap-3 mt-1.5">
                          <div className="bg-rose-950/40 text-rose-400 p-1.5 rounded-sm border border-rose-900/40 font-sans">
                            <HardDrive className="w-4 h-4" />
                          </div>
                          <div className="text-[11px]">
                            <p className="font-semibold text-rose-400">0 Files / 0 MB</p>
                            <p className="text-[10px] text-[#71717A] font-sans leading-none mt-0.5">
                              Penyimpanan Lokal: Bersih (Clean-up Aktif)
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-[#0A0A0B] p-3 rounded-sm border border-[#262626]">
                        <h4 className="text-[10px] uppercase font-bold tracking-wider text-[#71717A]">Penyimpanan Google Drive</h4>
                        <div className="flex items-center gap-3 mt-1.5">
                          <div className="bg-cyan-950/40 text-cyan-400 p-1.5 rounded-sm border border-cyan-900/40 font-sans">
                            <HardDrive className="w-4 h-4 animate-pulse" />
                          </div>
                          <div className="text-[11px]">
                            <p className="font-semibold text-cyan-300">
                              {gdriveFiles.length} Files / {(gdriveFiles.reduce((acc, f) => acc + f.sizeBytes, 0) / 1024 / 1024).toFixed(2)} MB
                            </p>
                            <p className="text-[10px] text-[#71717A] font-sans leading-none mt-0.5">
                              Google Drive Cloud Storage: Terhubung
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-[#A1A1AA] uppercase tracking-wider">
                      Daftar Berkas Cloud Storage (Google Drive Explorer)
                    </h4>
                    <div className="bg-[#18181B] rounded-sm border border-[#262626] overflow-hidden">
                      <table className="w-full text-[11px] font-mono border-collapse text-left">
                        <thead>
                          <tr className="bg-[#0F0F10] border-b border-[#262626] text-[#A1A1AA] font-bold uppercase tracking-wider">
                            <th className="p-3">File ID</th>
                            <th className="p-3">Nama Berkas</th>
                            <th className="p-3">Ukuran</th>
                            <th className="p-3">Tanggal Unggah</th>
                            <th className="p-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gdriveFiles.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-[#71717A] text-[11px] uppercase tracking-wider">
                                Tidak ada berkas di Google Drive. Silakan rekam dan unggah audio dari mobile client simulator.
                              </td>
                            </tr>
                          ) : (
                            gdriveFiles.map((file) => (
                              <tr key={file.id} className="border-b border-[#262626] hover:bg-[#0A0A0B]/60 transition-colors">
                                <td className="p-3 text-cyan-400 font-bold">{file.id}</td>
                                <td className="p-3 text-[#E0E0E0]">{file.name}</td>
                                <td className="p-3 text-[#A1A1AA]">{(file.sizeBytes / 1024).toFixed(1)} KB</td>
                                <td className="p-3 text-[#71717A]">{new Date(file.uploadedAt).toLocaleString()}</td>
                                <td className="p-3 text-right">
                                  <span className="bg-cyan-950/40 text-cyan-400 border border-cyan-900/40 px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider">
                                    Verified Cloud
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SECURE RELATIONAL DB INSPECTOR (NFR-03.2 ENCRYPTION) */}
              {adminTab === "database" && (
                <div className="space-y-4">
                  <div className="bg-[#18181B] p-3.5 border border-[#262626] rounded-sm space-y-2">
                    <div className="flex items-center justify-between text-amber-400 font-bold uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <Database className="w-4 h-4" /> Inspektur Database Enkripsi Tingkat Aplikasi (NFR-03.2)
                      </span>
                      <button
                        onClick={() => setDecryptAdminDb(!decryptAdminDb)}
                        className={`px-2.5 py-1 text-[10px] font-mono rounded-sm border transition-all cursor-pointer flex items-center gap-1 ${
                          decryptAdminDb
                            ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/40"
                            : "bg-amber-950/40 text-amber-400 border-amber-900/40 animate-pulse"
                        }`}
                      >
                        {decryptAdminDb ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        {decryptAdminDb ? "TUTUP DEKRIPSI" : "DEKRIPSI CIPHERTEXT DI DB"}
                      </button>
                    </div>
                    <p className="text-[11px] text-[#A1A1AA] leading-relaxed font-sans">
                      Aturan **NFR-03.2** menyatakan bahwa data teks sensitif (transkripsi verbatim dan rangkuman) **wajib dienkripsi di tingkat aplikasi (AES-256-CBC) sebelum disimpan ke dalam database**. Ini memastikan privasi data tetap terjaga meskipun file database dibobol atau diakses langsung.
                    </p>
                  </div>

                  {/* SHOW NOTES DB TABLE */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-[#A1A1AA] uppercase tracking-wider">
                      Tabel operasional: {"`notes`"} di Database (Look-inside)
                    </h4>
                    <div className="bg-[#18181B] rounded-sm border border-[#262626] overflow-x-auto">
                      <table className="w-full text-[10px] font-mono border-collapse text-left min-w-[600px]">
                        <thead>
                          <tr className="bg-[#0F0F10] border-b border-[#262626] text-[#A1A1AA] font-bold uppercase tracking-wider">
                            <th className="p-3">id</th>
                            <th className="p-3">title</th>
                            <th className="p-3">templateId</th>
                            <th className="p-3">transcription (Verbatim)</th>
                            <th className="p-3">summary &amp; action_items</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!rawDb || rawDb.notes.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-[#71717A] uppercase tracking-wider">
                                Database kosong. Harap buat rekaman baru di mobile client simulator.
                              </td>
                            </tr>
                          ) : (
                            rawDb.notes.map((n: any) => (
                              <tr key={n.id} className="border-b border-[#262626] hover:bg-[#0A0A0B]/60 transition-colors font-mono align-top">
                                <td className="p-3 text-indigo-400 font-bold">{n.id}</td>
                                <td className="p-3 text-[#E0E0E0] font-sans">{n.title}</td>
                                <td className="p-3 text-[#A1A1AA]">{n.templateId}</td>
                                <td className="p-3 max-w-[200px] truncate-text">
                                  {decryptAdminDb ? (
                                    <span className="text-emerald-400 whitespace-pre-wrap font-sans">
                                      {notes.find((note) => note.id === n.id)?.transcription || "..."}
                                    </span>
                                  ) : (
                                    <span className="text-amber-500 font-mono text-[9px] break-all block max-h-16 overflow-y-auto">
                                      {n.transcriptionEncrypted || "NULL"}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 max-w-[200px] truncate-text">
                                  {decryptAdminDb ? (
                                    <span className="text-emerald-400 whitespace-pre-wrap font-sans">
                                      {notes.find((note) => note.id === n.id)?.summary || "..."}
                                    </span>
                                  ) : (
                                    <span className="text-amber-500 font-mono text-[9px] break-all block max-h-16 overflow-y-auto">
                                      {n.summaryEncrypted || "NULL"}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-[#0F0F10] border-t border-[#262626] py-4 px-6 text-center text-xs text-[#71717A] font-sans mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:justify-between items-center gap-2">
          <p>© 2026 NoteSync. Semua hak dilindungi.</p>
          <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-wider">
            <span className="flex items-center gap-1.5 text-emerald-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              Secure AES-256 Encryption Active
            </span>
            <span>|</span>
            <span>Vite + Express Container Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
