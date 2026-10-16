import { env } from "../config/env.js";
import { tooMany, unavailable } from "./errors.js";

/**
 * Pluggable AI provider. The free options (no credit card) are:
 *   - Groq   (recommended): chat + Whisper voice-note transcription
 *   - Gemini (Google AI Studio)
 * OpenRouter, any OpenAI-compatible endpoint (OpenAI, Ollama, LM Studio...)
 * and Anthropic Claude (paid) are also supported.
 *
 * Every feature is opt-in per request: chat content is only sent to the
 * provider when a user explicitly taps an AI action.
 */
const OPENAI_COMPATIBLE = {
  groq: {
    baseURL: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-20b",
    key: () => env.GROQ_API_KEY || env.AI_API_KEY,
    // gpt-oss models reason before answering; keep it short for chat UX.
    extra: (model) => (model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low", include_reasoning: false } : {}),
  },
  gemini: {
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-3.5-flash-lite",
    key: () => env.GEMINI_API_KEY || env.AI_API_KEY,
    extra: () => ({}),
  },
  openrouter: {
    baseURL: "https://openrouter.ai/api/v1",
    model: "",
    key: () => env.OPENROUTER_API_KEY || env.AI_API_KEY,
    extra: () => ({}),
  },
  custom: {
    baseURL: env.AI_BASE_URL,
    model: "",
    key: () => env.AI_API_KEY || env.OPENAI_API_KEY,
    extra: () => ({}),
  },
};

const ANTHROPIC_DEFAULT_MODEL = "claude-opus-5-5";

function resolveProvider() {
  const explicit = env.AI_PROVIDER;
  if (explicit) return explicit;
  if (env.GROQ_API_KEY) return "groq";
  if (env.GEMINI_API_KEY) return "gemini";
  if (env.ANTHROPIC_API_KEY) return "anthropic";
  if (env.OPENROUTER_API_KEY) return "openrouter";
  if (env.AI_BASE_URL) return "custom";
  return null;
}

const provider = resolveProvider();

function resolveModel() {
  if (env.AI_MODEL) return env.AI_MODEL;
  if (provider === "anthropic") return ANTHROPIC_DEFAULT_MODEL;
  return OPENAI_COMPATIBLE[provider]?.model || "";
}

const model = resolveModel();

function providerKey() {
  if (provider === "anthropic") return env.ANTHROPIC_API_KEY || env.AI_API_KEY;
  return OPENAI_COMPATIBLE[provider]?.key() || "";
}

const configured = (() => {
  if (!provider) return false;
  if (provider !== "anthropic" && !OPENAI_COMPATIBLE[provider]) {
    console.warn(`[ai] Unknown AI_PROVIDER "${provider}". AI features are disabled.`);
    return false;
  }
  if (!providerKey() && provider !== "custom") {
    console.warn(`[ai] No API key for provider "${provider}". AI features are disabled.`);
    return false;
  }
  if (provider === "custom" && !env.AI_BASE_URL) return false;
  if (!model) {
    console.warn(`[ai] Set AI_MODEL for provider "${provider}". AI features are disabled.`);
    return false;
  }
  return true;
})();

// Voice-note transcription runs on Groq's Whisper (free tier) whenever a
// Groq key is present, regardless of the chat provider.
const transcribeKey = env.GROQ_API_KEY || (provider === "groq" ? env.AI_API_KEY : "");

export const aiStatus = () => ({
  enabled: configured,
  provider: configured ? provider : null,
  model: configured ? model : null,
  transcription: Boolean(transcribeKey),
});

export const aiEnabled = () => configured;

const mapStatusError = (status) => {
  if (status === 429) return tooMany("The AI service is busy right now (free quota reached). Please try again in a minute.");
  if (status === 401 || status === 403) return unavailable("The AI provider rejected the server's API key.");
  return unavailable("The AI service is unavailable right now. Please try again.");
};

async function completeOpenAICompatible({ system, prompt, maxTokens, temperature }) {
  const cfg = OPENAI_COMPATIBLE[provider];
  const key = cfg.key();
  let res;
  try {
    res = await fetch(`${cfg.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        ...(provider === "openrouter" ? { "X-Title": "BlinkChat" } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature,
        max_tokens: maxTokens,
        ...cfg.extra(model),
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    console.warn("[ai] request failed:", err.message);
    throw unavailable("Couldn't reach the AI service. Please try again.");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(`[ai] ${provider} responded ${res.status}: ${body.slice(0, 300)}`);
    throw mapStatusError(res.status);
  }
  const json = await res.json();
  return String(json?.choices?.[0]?.message?.content || "").trim();
}

let anthropicClient = null;

async function completeAnthropic({ system, prompt }) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: providerKey(), timeout: 60_000, maxRetries: 1 });

  const supportsEffort = /^claude-(opus|fable|sonnet|haiku|mythos)-(5|4-[678])/.test(model);
  const supportsFallback = !/haiku/.test(model);
  let response;
  try {
    response = await anthropicClient.beta.messages.create({
      model,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: prompt }],
      // Short, latency-sensitive chat helpers: low effort is plenty.
      ...(supportsEffort ? { output_config: { effort: "low" } } : {}),
      // If a safety classifier declines, retry server-side on the model
      // Anthropic recommends for that refusal category.
      ...(supportsFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) throw mapStatusError(429);
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) throw mapStatusError(401);
    if (err instanceof Anthropic.APIError) {
      console.warn(`[ai] anthropic error ${err.status}:`, err.message);
      throw mapStatusError(err.status);
    }
    console.warn("[ai] anthropic request failed:", err?.message);
    throw unavailable("Couldn't reach the AI service. Please try again.");
  }

  if (response.stop_reason === "refusal") {
    throw unavailable("The AI declined to help with this content.");
  }
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

/** Single-turn completion returning plain text. */
export async function complete({ system, prompt, maxTokens = 1500, temperature = 0.4 }) {
  if (!configured) throw unavailable("AI features aren't enabled on this server.");
  if (provider === "anthropic") return completeAnthropic({ system, prompt });
  return completeOpenAICompatible({ system, prompt, maxTokens, temperature });
}

/** Extracts the first JSON object from model output (tolerates ``` fences). */
export function parseJsonLoose(text) {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

const AUDIO_EXT = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
};

/** Speech-to-text via Groq Whisper. Returns the transcript text. */
export async function transcribeAudio(buffer, mime = "audio/webm") {
  if (!transcribeKey) throw unavailable("Voice transcription isn't enabled on this server.");
  const type = String(mime).split(";")[0];
  const form = new FormData();
  form.append("file", new Blob([buffer], { type }), `voice.${AUDIO_EXT[type] || "webm"}`);
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "json");

  let res;
  try {
    res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${transcribeKey}` },
      body: form,
      signal: AbortSignal.timeout(60000),
    });
  } catch (err) {
    console.warn("[ai] transcription request failed:", err.message);
    throw unavailable("Couldn't reach the transcription service. Please try again.");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(`[ai] transcription responded ${res.status}: ${body.slice(0, 300)}`);
    throw mapStatusError(res.status);
  }
  const json = await res.json();
  return String(json?.text || "").trim();
}
