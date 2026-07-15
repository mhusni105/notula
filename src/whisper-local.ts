/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * whisper-local.ts — Manages the local OpenAI Whisper STT middleware process.
 *
 * Starts a Python FastAPI server (whisper-server/whisper_server.py) as a
 * child process and provides a client to call its transcription endpoint.
 */

import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import net from "net";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WHISPER_DIR = path.join(process.cwd(), "whisper-server");
const SERVER_SCRIPT = path.join(WHISPER_DIR, "whisper_server.py");
const REQUIREMENTS_FILE = path.join(WHISPER_DIR, "requirements.txt");

const DEFAULT_PORT = 9090;
const STARTUP_TIMEOUT_MS = 60_000;   // 60s to download + load model
const POLL_INTERVAL_MS = 500;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let serverProcess: ChildProcess | null = null;
let serverPort: number = DEFAULT_PORT;
let serverStarted = false;
let serverPid: number | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Detect the system Python command. */
function findPython(): string {
  // Try common names; prefer python3 on non-Windows, python on Windows
  const candidates = process.platform === "win32"
    ? ["python", "py", "python3"]
    : ["python3", "python"];

  for (const cmd of candidates) {
    try {
      const r = require("child_process").spawnSync(cmd, ["--version"], {
        stdio: "pipe",
        encoding: "utf-8",
        timeout: 5_000,
      });
      if (r.status === 0) return cmd;
    } catch {
      continue;
    }
  }
  throw new Error(
    "Python tidak ditemukan. Install Python 3.9+ dari https://www.python.org/ " +
    "atau pastikan 'python' ada di PATH."
  );
}

/** Find a free TCP port starting from the preferred port. */
function findFreePort(preferred: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(preferred, "127.0.0.1", () => {
      const addr = server.address();
      server.close(() => {
        if (addr && typeof addr === "object") {
          resolve(addr.port);
        } else {
          resolve(preferred);
        }
      });
    });
    server.on("error", () => {
      // Port in use, try a random port
      const fallback = server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        server.close(() => {
          if (addr && typeof addr === "object") {
            resolve(addr.port);
          } else {
            resolve(0);
          }
        });
      });
      fallback.on("error", reject);
    });
  });
}

/** Wait for the Whisper server health endpoint to respond. */
async function waitForServer(port: number, timeoutMs: number): Promise<void> {
  const url = `http://127.0.0.1:${port}/health`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json() as { status: string };
        if (data.status === "ok") return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(
    `Whisper server tidak merespon dalam ${timeoutMs / 1000} dtk di port ${port}. ` +
    `Periksa log di atas untuk detail error.`
  );
}

/** Ensure Python dependencies are installed. */
async function ensureDependencies(pythonCmd: string): Promise<void> {
  if (!fs.existsSync(REQUIREMENTS_FILE)) return;

  console.log(`[whisper-local] Memastikan dependensi Python terinstal...`);
  return new Promise((resolve, reject) => {
    const proc = spawn(pythonCmd, [
      "-m", "pip", "install", "-r", REQUIREMENTS_FILE,
      "--quiet",
    ], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    proc.stderr?.on("data", (chunk: string) => { stderr += chunk; });

    proc.on("close", (code) => {
      if (code === 0) {
        console.log(`[whisper-local] Dependensi Python siap.`);
        resolve();
      } else {
        console.error(`[whisper-local] Gagal install dependensi: ${stderr.slice(0, 500)}`);
        reject(new Error(
          `pip install gagal (kode ${code}). Jalankan manual:\n` +
          `  ${pythonCmd} -m pip install -r "${REQUIREMENTS_FILE}"`
        ));
      }
    });

    proc.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface WhisperServerInfo {
  running: boolean;
  port: number;
  pid: number | null;
}

/**
 * Start the local Whisper server.
 * - Detects Python
 * - Installs dependencies (if needed)
 * - Finds a free port
 * - Spawns the Python server
 * - Waits for it to be ready
 */
export async function startWhisperServer(model?: string, port?: number): Promise<WhisperServerInfo> {
  if (serverStarted) {
    return { running: true, port: serverPort, pid: serverPid };
  }

  const pythonCmd = findPython();
  const preferredPort = port || (process.env.WHISPER_PORT ? parseInt(process.env.WHISPER_PORT) : DEFAULT_PORT);
  const whisperModel = model || process.env.WHISPER_MODEL || "base";

  // Find a free port
  serverPort = await findFreePort(preferredPort);
  if (serverPort !== preferredPort) {
    console.log(`[whisper-local] Port ${preferredPort} sudah digunakan, menggunakan port ${serverPort}.`);
  }

  // Install dependencies
  await ensureDependencies(pythonCmd);

  // Start the server
  const serverScript = SERVER_SCRIPT;
  if (!fs.existsSync(serverScript)) {
    throw new Error(`File server Whisper tidak ditemukan di: ${serverScript}`);
  }

  console.log(`[whisper-local] Memulai Whisper server (model=${whisperModel}, port=${serverPort})...`);

  serverProcess = spawn(pythonCmd, [serverScript, "--model", whisperModel, "--port", String(serverPort)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      WHISPER_MODEL: whisperModel,
      WHISPER_PORT: String(serverPort),
    },
  });

  serverPid = serverProcess.pid ?? null;

  // Pipe logs to console
  serverProcess.stdout?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.log(`[whisper-server] ${msg}`);
  });

  serverProcess.stderr?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.error(`[whisper-server] ${msg}`);
  });

  serverProcess.on("exit", (code, signal) => {
    console.log(`[whisper-local] Server Whisper berhenti (code=${code}, signal=${signal})`);
    serverStarted = false;
    serverProcess = null;
    serverPid = null;
  });

  serverProcess.on("error", (err) => {
    console.error(`[whisper-local] Gagal menjalankan Whisper server:`, err.message);
    serverStarted = false;
    serverProcess = null;
    serverPid = null;
  });

  // Wait for the server to be ready
  try {
    await waitForServer(serverPort, STARTUP_TIMEOUT_MS);
    serverStarted = true;
    console.log(`[whisper-local] Whisper server siap di http://127.0.0.1:${serverPort}`);
    return { running: true, port: serverPort, pid: serverPid };
  } catch (err) {
    // Cleanup on failure
    stopWhisperServer();
    throw err;
  }
}

/**
 * Stop the local Whisper server gracefully.
 */
export function stopWhisperServer(): void {
  if (serverProcess) {
    console.log(`[whisper-local] Menghentikan Whisper server (PID ${serverPid})...`);
    if (process.platform === "win32") {
      // On Windows, use taskkill to ensure the process tree is killed
      try {
        require("child_process").spawnSync("taskkill", ["/F", "/T", "/PID", String(serverPid)], {
          stdio: "ignore",
        });
      } catch {
        serverProcess.kill("SIGTERM");
      }
    } else {
      serverProcess.kill("SIGTERM");
    }
    serverProcess = null;
    serverStarted = false;
    serverPid = null;
  }
}

/**
 * Get current server status.
 */
export function getWhisperStatus(): WhisperServerInfo {
  return {
    running: serverStarted && serverProcess !== null,
    port: serverPort,
    pid: serverPid,
  };
}

/**
 * Check if the server is currently running.
 */
export function isWhisperRunning(): boolean {
  return serverStarted && serverProcess !== null;
}

/**
 * Transcribe an audio file using the local Whisper server.
 * Returns the transcribed text.
 */
export async function transcribeWithWhisper(
  audioFilePath: string,
  mimeType: string,
  signal?: AbortSignal
): Promise<string> {
  if (!serverStarted) {
    throw new Error("Whisper server belum dimulai. Panggil startWhisperServer() terlebih dahulu.");
  }

  const audioBuffer = fs.readFileSync(audioFilePath);
  const blob = new Blob([audioBuffer], { type: mimeType });
  const formData = new FormData();
  const ext = path.extname(audioFilePath) || ".webm";
  formData.append("file", blob, `audio${ext}`);
  formData.append("model", "whisper-1");
  formData.append("response_format", "text");
  formData.append("language", process.env.WHISPER_LANGUAGE || "id");
  formData.append("temperature", "0.0");

  const url = `http://127.0.0.1:${serverPort}/v1/audio/transcriptions`;

  const res = await fetch(url, {
    method: "POST",
    body: formData,
    signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Whisper server HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const text = await res.text();
  return text.trim() || "[Tidak ada teks terdeteksi]";
}
