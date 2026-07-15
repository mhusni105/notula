"""
whisper_server.py — Local Whisper STT Middleware for Notula

Exposes a FastAPI HTTP server that loads an OpenAI Whisper model once
and provides a /v1/audio/transcriptions endpoint (OpenAI-compatible)
plus health-check endpoints.

Usage:
    python whisper_server.py --model base --port 9090
"""

import argparse
import os
import sys
import tempfile
import time
from pathlib import Path

import whisper
import uvicorn
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.responses import PlainTextResponse, Response

app = FastAPI(title="Whisper Local STT", version="1.0.0")

whisper_model = None
model_name = "base"
load_time = 0.0


# ---------------------------------------------------------------------------
# Startup: load model once
# ---------------------------------------------------------------------------
@app.on_event("startup")
def load_model():
    global whisper_model, model_name, load_time
    model_name = os.environ.get("WHISPER_MODEL", "base")
    device = os.environ.get("WHISPER_DEVICE", "cpu")

    print(f"[whisper-server] Memuat model '{model_name}' di perangkat '{device}'...")
    t0 = time.time()
    whisper_model = whisper.load_model(model_name, device=device)
    load_time = time.time() - t0
    print(f"[whisper-server] Model '{model_name}' siap dalam {load_time:.2f} dtk.")


# ---------------------------------------------------------------------------
# Health / Info
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {
        "status": "ok" if whisper_model is not None else "no_model",
        "model": model_name,
        "load_time_seconds": round(load_time, 2),
    }


@app.get("/v1/models")
def list_models():
    return {
        "object": "list",
        "data": [
            {
                "id": model_name,
                "object": "model",
                "created": int(time.time()),
                "owned_by": "whisper-local",
            }
        ],
    }


# ---------------------------------------------------------------------------
# OpenAI-compatible transcription endpoint
# ---------------------------------------------------------------------------
@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: UploadFile = File(...),
    model: str = Form("whisper-1"),
    response_format: str = Form("text"),
    language: str = Form(None),
    prompt: str = Form(None),
    temperature: float = Form(0.0),
):
    if whisper_model is None:
        raise HTTPException(503, "Model Whisper belum dimuat.")

    # Save uploaded file to a temp location
    suffix = Path(file.filename or "audio.webm").suffix or ".webm"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        content = await file.read()
        tmp.write(content)
        tmp.close()

        transcribe_kwargs = {"temperature": temperature}
        if language:
            transcribe_kwargs["language"] = language
        if prompt:
            transcribe_kwargs["initial_prompt"] = prompt

        result = whisper_model.transcribe(tmp.name, **transcribe_kwargs)

        text = result.get("text", "").strip()

        if response_format == "json":
            return {
                "text": text,
                "segments": [
                    {
                        "id": s["id"],
                        "start": s["start"],
                        "end": s["end"],
                        "text": s["text"].strip(),
                    }
                    for s in result.get("segments", [])
                ],
                "language": result.get("language", ""),
            }
        else:
            return Response(content=text or "[Tidak ada teks terdeteksi]", media_type="text/plain")

    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Whisper Local STT Server")
    parser.add_argument("--model", default="base", help="Model size: tiny, base, small, medium, large, turbo")
    parser.add_argument("--port", type=int, default=9090, help="Port to listen on")
    parser.add_argument("--host", default="127.0.0.1", help="Bind address")
    parser.add_argument("--device", default="cpu", help="Device: cpu or cuda")
    args = parser.parse_args()

    os.environ.setdefault("WHISPER_MODEL", args.model)
    os.environ.setdefault("WHISPER_DEVICE", args.device)

    print(f"[whisper-server] Memulai Whisper STT Server di {args.host}:{args.port} ...")
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
