/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * AI Provider abstraction — supports Gemini, OpenAI, 9router, Anthropic, and Whisper Local.
 */

import { GoogleGenAI } from "@google/genai";

export type AIProviderType = "gemini" | "openai" | "9router" | "anthropic" | "whisper-local";

export interface AIProvider {
  transcribeAudio(audioFilePath: string, mimeType: string, signal?: AbortSignal): Promise<string>;
  generateSummary(systemPrompt: string, userPrompt: string, signal?: AbortSignal): Promise<string>;
  getProviderInfo(): { provider: AIProviderType; modelSTT: string; modelLLM: string };
}

async function fetchJSON(url: string, options: RequestInit): Promise<any> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error("HTTP " + res.status + " from " + url + ": " + body.slice(0, 300));
  }
  return res.json();
}

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

class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private baseURL: string;
  private sttEndpoint?: string;
  private modelSTT = "whisper-1";
  private modelLLM = "gpt-4o-mini";

  constructor(apiKey: string, baseURL: string, modelLLM?: string, sttEndpoint?: string) {
    this.apiKey = apiKey;
    this.baseURL = baseURL.replace(/\/+$/, "");
    if (modelLLM) this.modelLLM = modelLLM;
    if (sttEndpoint) this.sttEndpoint = sttEndpoint;
  }

  async transcribeAudio(audioFilePath: string, _mimeType: string, signal?: AbortSignal): Promise<string> {
    const fs = await import("fs");
    const audioBuffer = fs.readFileSync(audioFilePath);

    const blob = new Blob([audioBuffer], { type: _mimeType });
    const formData = new FormData();
    formData.append("file", blob, "audio." + (_mimeType.split("/")[1] || "webm"));
    formData.append("model", this.modelSTT);
    formData.append("response_format", "text");

    const sttUrl = this.sttEndpoint || (this.baseURL + "/audio/transcriptions");
    const res = await fetch(sttUrl, {
      method: "POST",
      headers: { Authorization: "Bearer " + this.apiKey },
      body: formData,
      signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error("HTTP " + res.status + " dari " + sttUrl + " \u2014 " + body.slice(0, 300));
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

    const data = await fetchJSON(this.baseURL + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + this.apiKey,
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

class AnthropicProvider implements AIProvider {
  private apiKey: string;
  private modelLLM = "claude-3-5-haiku-latest";
  private anthropicVersion = "2023-06-01";

  constructor(apiKey: string, modelLLM?: string) {
    this.apiKey = apiKey;
    if (modelLLM) this.modelLLM = modelLLM;
  }

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

class WhisperLocalProvider implements AIProvider {
  private modelSTT = "whisper-local";
  private modelLLM = "(fallback)";
  private llmProvider: AIProvider | null = null;

  constructor() {
    this.llmProvider = this.createLLMProvider();
  }

  private createLLMProvider(): AIProvider | null {
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const baseURL = process.env.AI_BASE_URL;
    const modelLLM = process.env.AI_MODEL_LLM;

    if (geminiKey) {
      const { GoogleGenAI } = require("@google/genai");
      const client = new GoogleGenAI({ apiKey: geminiKey });
      return new GeminiProvider(client);
    }
    if (openaiKey) {
      const url = baseURL || "https://api.openai.com/v1";
      return new OpenAIProvider(openaiKey, url, modelLLM);
    }
    if (anthropicKey) {
      return new AnthropicProvider(anthropicKey, modelLLM);
    }
    return null;
  }

  async transcribeAudio(audioFilePath: string, mimeType: string, signal?: AbortSignal): Promise<string> {
    const { transcribeWithWhisper } = await import("./whisper-local.js");
    return transcribeWithWhisper(audioFilePath, mimeType, signal);
  }

  async generateSummary(systemPrompt: string, userPrompt: string, signal?: AbortSignal): Promise<string> {
    if (!this.llmProvider) {
      throw new Error(
        "Whisper Local hanya menyediakan STT. Untuk ringkasan (LLM), konfigurasikan salah satu API key: " +
        "GEMINI_API_KEY, OPENAI_API_KEY, atau ANTHROPIC_API_KEY di .env.local"
      );
    }
    this.modelLLM = this.llmProvider.getProviderInfo().modelLLM;
    return this.llmProvider.generateSummary(systemPrompt, userPrompt, signal);
  }

  getProviderInfo() {
    const llmInfo = this.llmProvider?.getProviderInfo();
    return {
      provider: "whisper-local" as AIProviderType,
      modelSTT: this.modelSTT,
      modelLLM: llmInfo ? (llmInfo.provider + ": " + llmInfo.modelLLM) : "(tidak dikonfigurasi)",
    };
  }
}

export function createProvider(): AIProvider | null {
  const providerType = (process.env.AI_PROVIDER || "gemini") as AIProviderType;
  const modelLLM = process.env.AI_MODEL_LLM;
  const baseURL = process.env.AI_BASE_URL;
  const sttEndpoint = process.env.AI_STT_ENDPOINT;

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
      return new OpenAIProvider(key, url, modelLLM, sttEndpoint);
    }

    case "9router": {
      const key = process.env.OPENAI_API_KEY;
      if (!key) return null;
      const url = baseURL || "https://api.9router.com/v1";
      return new OpenAIProvider(key, url, modelLLM, sttEndpoint);
    }

    case "anthropic": {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return null;
      return new AnthropicProvider(key, modelLLM);
    }

    case "whisper-local": {
      return new WhisperLocalProvider();
    }

    default:
      return null;
  }
}
