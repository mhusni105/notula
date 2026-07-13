/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * AI Provider abstraction — supports Gemini, OpenAI, 9router, and Anthropic.
 */

import { GoogleGenAI } from "@google/genai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AIProviderType = "gemini" | "openai" | "9router" | "anthropic";

export interface AIProvider {
  /** Transcribe an audio file on disk and return the text. */
  transcribeAudio(audioFilePath: string, mimeType: string, signal?: AbortSignal): Promise<string>;
  /** Generate a summary / structured text from a system prompt and a user prompt. */
  generateSummary(systemPrompt: string, userPrompt: string, signal?: AbortSignal): Promise<string>;
  /** Human-readable info about the provider and models in use. */
  getProviderInfo(): { provider: AIProviderType; modelSTT: string; modelLLM: string };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchJSON(url: string, options: RequestInit): Promise<any> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} from ${url}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Gemini Provider (uses existing @google/genai SDK)
// ---------------------------------------------------------------------------

class GeminiProvider implements AIProvider {
  private client: GoogleGenAI;
  private modelSTT = "gemini-3.5-flash";
  private modelLLM = "gemini-3.5-flash";

  constructor(client: GoogleGenAI) {
    this.client = client;
  }

  async transcribeAudio(audioFilePath: string, mimeType: string, signal?: AbortSignal): Promise<string> {
    const fs = await import("fs");
    const audioData = fs.readFileSync(audioFilePath);
    const base64Audio = audioData.toString("base64");

    const response = await this.client.models.generateContent({
      model: this.modelSTT,
      contents: [
        {
          inlineData: { mimeType, data: base64Audio },
        },
        "Lakukan transkripsi verbatim (kata-demi-kata) secara lengkap dan akurat dari audio terlampir dalam Bahasa Indonesia dan Bahasa Inggris jika bercampur. Tuliskan teks transkripsi saja tanpa komentar pembuka, penjelasan, atau penutup.",
      ],
      config: { },
    });

    return response.text || "[Tidak ada teks terdeteksi]";
  }

  async generateSummary(systemPrompt: string, userPrompt: string, signal?: AbortSignal): Promise<string> {
    const response = await this.client.models.generateContent({
      model: this.modelLLM,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
      },
    });
    return response.text || "[Gagal merangkum]";
  }

  getProviderInfo() {
    return { provider: "gemini" as AIProviderType, modelSTT: this.modelSTT, modelLLM: this.modelLLM };
  }
}

// ---------------------------------------------------------------------------
// OpenAI / 9router Provider (OpenAI-compatible REST API)
// ---------------------------------------------------------------------------

class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private baseURL: string;
  private modelSTT = "whisper-1";
  private modelLLM = "gpt-4o-mini";

  constructor(apiKey: string, baseURL: string, modelLLM?: string) {
    this.apiKey = apiKey;
    this.baseURL = baseURL.replace(/\/+$/, "");
    if (modelLLM) this.modelLLM = modelLLM;
  }

  async transcribeAudio(audioFilePath: string, _mimeType: string, signal?: AbortSignal): Promise<string> {
    const fs = await import("fs");
    const audioBuffer = fs.readFileSync(audioFilePath);

    // Build multipart form-data manually (Node 18+ has FormData but needs a Blob/File)
    const blob = new Blob([audioBuffer], { type: _mimeType });
    const formData = new FormData();
    formData.append("file", blob, "audio." + (_mimeType.split("/")[1] || "webm"));
    formData.append("model", this.modelSTT);
    formData.append("response_format", "text");

    const res = await fetch(`${this.baseURL}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: formData,
      signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} from Whisper API: ${body.slice(0, 300)}`);
    }

    const text = await res.text();
    return text.trim() || "[Tidak ada teks terdeteksi]";
  }

  async generateSummary(systemPrompt: string, userPrompt: string, signal?: AbortSignal): Promise<string> {
    const body = {
      model: this.modelLLM,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };

    const data = await fetchJSON(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    return data.choices?.[0]?.message?.content || "[Gagal merangkum]";
  }

  getProviderInfo() {
    const providerType: AIProviderType = this.baseURL.includes("api.openai.com") ? "openai" : "9router";
    return { provider: providerType, modelSTT: this.modelSTT, modelLLM: this.modelLLM };
  }
}

// ---------------------------------------------------------------------------
// Anthropic Provider
// ---------------------------------------------------------------------------

class AnthropicProvider implements AIProvider {
  private apiKey: string;
  private modelLLM = "claude-3-5-haiku-latest";
  private anthropicVersion = "2023-06-01";

  constructor(apiKey: string, modelLLM?: string) {
    this.apiKey = apiKey;
    if (modelLLM) this.modelLLM = modelLLM;
  }

  // Anthropic does not have a dedicated STT API; fall back to simulation marker
  async transcribeAudio(_audioFilePath: string, _mimeType: string, _signal?: AbortSignal): Promise<string> {
    throw new Error("Anthropic tidak mendukung transkripsi audio langsung. Gunakan Gemini atau OpenAI untuk STT.");
  }

  async generateSummary(systemPrompt: string, userPrompt: string, signal?: AbortSignal): Promise<string> {
    const body = {
      model: this.modelLLM,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    };

    const data = await fetchJSON("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": this.anthropicVersion,
      },
      body: JSON.stringify(body),
      signal,
    });

    return data.content?.[0]?.text || "[Gagal merangkum]";
  }

  getProviderInfo() {
    return { provider: "anthropic" as AIProviderType, modelSTT: "(tidak didukung)", modelLLM: this.modelLLM };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an AI provider based on environment variables.
 * 
 * | Variable          | Purpose                                          |
 * |-------------------|--------------------------------------------------|
 * | `AI_PROVIDER`     | `gemini` (default), `openai`, `9router`, `anthropic` |
 * | `GEMINI_API_KEY`  | API key for Gemini (used when AI_PROVIDER=gemini) |
 * | `OPENAI_API_KEY`  | API key for OpenAI / 9router                     |
 * | `ANTHROPIC_API_KEY`| API key for Anthropic (Claude)                   |
 * | `AI_BASE_URL`     | Custom base URL (required for 9router, optional for openai) |
 * | `AI_MODEL_STT`    | Override the STT model name                      |
 * | `AI_MODEL_LLM`    | Override the LLM model name                      |
 */
export function createProvider(): AIProvider | null {
  const providerType = (process.env.AI_PROVIDER || "gemini") as AIProviderType;
  const modelLLM = process.env.AI_MODEL_LLM;
  const baseURL = process.env.AI_BASE_URL;

  switch (providerType) {
    case "gemini": {
      const key = process.env.GEMINI_API_KEY;
      if (!key) return null;
      const client = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: { "User-Agent": "aistudio-build" },
        },
      });
      const provider = new GeminiProvider(client);
      return provider;
    }

    case "openai": {
      const key = process.env.OPENAI_API_KEY;
      if (!key) return null;
      const url = baseURL || "https://api.openai.com/v1";
      return new OpenAIProvider(key, url, modelLLM);
    }

    case "9router": {
      const key = process.env.OPENAI_API_KEY;
      if (!key) return null;
      const url = baseURL || "https://api.9router.com/v1";  // sensible default
      return new OpenAIProvider(key, url, modelLLM);
    }

    case "anthropic": {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return null;
      return new AnthropicProvider(key, modelLLM);
    }

    default:
      return null;
  }
}
