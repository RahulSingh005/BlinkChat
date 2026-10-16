import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Always load backend/.env, no matter which directory the process was started
// from (the root `npm start` runs the backend with `--prefix backend`).
// This module must be imported before anything that reads process.env.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const str = (v) => (typeof v === "string" ? v.trim() : "");
const list = (v) =>
  str(v)
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
const bool = (v, fallback = false) => {
  const s = str(v).toLowerCase();
  if (!s) return fallback;
  return ["1", "true", "yes", "on"].includes(s);
};
const int = (v, fallback) => {
  const n = Number.parseInt(str(v), 10);
  return Number.isFinite(n) ? n : fallback;
};

const NODE_ENV = str(process.env.NODE_ENV) || "development";
const isProd = NODE_ENV === "production";
const isTest = NODE_ENV === "test";

export const BACKEND_ROOT = path.resolve(__dirname, "../..");

export const env = {
  NODE_ENV,
  isProd,
  isTest,
  PORT: int(process.env.PORT, 5001),

  MONGODB_URI: str(process.env.MONGODB_URI),
  JWT_SECRET: str(process.env.JWT_SECRET),
  JWT_EXPIRES_DAYS: int(process.env.JWT_EXPIRES_DAYS, 30),

  // Origins allowed to call the API from a browser (comma separated). Only
  // needed when the frontend is hosted on a different domain (e.g. Vercel).
  CLIENT_URLS: [...list(process.env.CLIENT_URL), ...list(process.env.CLIENT_URLS)],

  // "lax" is safest when frontend + backend share a domain. Use "none" when
  // the frontend lives on another site (requires HTTPS).
  COOKIE_SAMESITE: (str(process.env.COOKIE_SAMESITE) || (isProd ? "none" : "lax")).toLowerCase(),
  COOKIE_SECURE: bool(process.env.COOKIE_SECURE, isProd),

  // Number of proxies in front of the app (Render, Railway, Nginx...).
  TRUST_PROXY: int(process.env.TRUST_PROXY, isProd ? 1 : 0),

  // Allow anyone to browse the people directory in "New chat". Set to false
  // for large deployments; users can then only be found by name/email search.
  PUBLIC_DIRECTORY: bool(process.env.PUBLIC_DIRECTORY, true),

  GOOGLE_CLIENT_ID: str(process.env.GOOGLE_CLIENT_ID),

  CLOUDINARY_CLOUD_NAME: str(process.env.CLOUDINARY_CLOUD_NAME),
  CLOUDINARY_API_KEY: str(process.env.CLOUDINARY_API_KEY),
  CLOUDINARY_API_SECRET: str(process.env.CLOUDINARY_API_SECRET),

  EMAIL_HOST: str(process.env.EMAIL_HOST) || "smtp.gmail.com",
  EMAIL_PORT: int(process.env.EMAIL_PORT, 587),
  EMAIL_USER: str(process.env.EMAIL_USER),
  EMAIL_PASS: str(process.env.EMAIL_PASS),
  EMAIL_FROM: str(process.env.EMAIL_FROM),

  VAPID_PUBLIC_KEY: str(process.env.VAPID_PUBLIC_KEY),
  VAPID_PRIVATE_KEY: str(process.env.VAPID_PRIVATE_KEY),
  VAPID_SUBJECT: str(process.env.VAPID_SUBJECT) || "mailto:admin@blinkchat.app",

  // AI features (all optional). See README for the free providers.
  AI_PROVIDER: str(process.env.AI_PROVIDER).toLowerCase(),
  AI_API_KEY: str(process.env.AI_API_KEY),
  AI_MODEL: str(process.env.AI_MODEL),
  AI_BASE_URL: str(process.env.AI_BASE_URL).replace(/\/+$/, ""),
  GROQ_API_KEY: str(process.env.GROQ_API_KEY),
  GEMINI_API_KEY: str(process.env.GEMINI_API_KEY),
  OPENROUTER_API_KEY: str(process.env.OPENROUTER_API_KEY),
  OPENAI_API_KEY: str(process.env.OPENAI_API_KEY),
  ANTHROPIC_API_KEY: str(process.env.ANTHROPIC_API_KEY),
  AI_DAILY_LIMIT_PER_USER: int(process.env.AI_DAILY_LIMIT_PER_USER, 150),

  // WebRTC relay (TURN). Without one, calls only connect on friendly networks.
  METERED_DOMAIN: str(process.env.METERED_DOMAIN).replace(/^https?:\/\//, "").replace(/\/+$/, ""),
  METERED_API_KEY: str(process.env.METERED_API_KEY),
  CLOUDFLARE_TURN_KEY_ID: str(process.env.CLOUDFLARE_TURN_KEY_ID),
  CLOUDFLARE_TURN_API_TOKEN: str(process.env.CLOUDFLARE_TURN_API_TOKEN),
  TURN_URLS: list(process.env.TURN_URLS),
  TURN_USERNAME: str(process.env.TURN_USERNAME),
  TURN_CREDENTIAL: str(process.env.TURN_CREDENTIAL),

  // Serve the built frontend (frontend/dist) from this server. Defaults to
  // on in production when the build exists.
  SERVE_FRONTEND: str(process.env.SERVE_FRONTEND),
};

export const features = {
  cloudinary: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
  email: Boolean(env.EMAIL_USER && env.EMAIL_PASS),
  google: Boolean(env.GOOGLE_CLIENT_ID),
};

export function validateEnv() {
  const missing = [];
  if (!env.MONGODB_URI) missing.push("MONGODB_URI");
  if (!env.JWT_SECRET) missing.push("JWT_SECRET");
  if (missing.length) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        "Copy backend/.env.example to backend/.env and fill them in."
    );
  }
  if (env.isProd && env.JWT_SECRET.length < 32) {
    console.warn("[config] JWT_SECRET is shorter than 32 characters. Use a long random value in production.");
  }
  if (!["lax", "strict", "none"].includes(env.COOKIE_SAMESITE)) {
    throw new Error("COOKIE_SAMESITE must be one of: lax, strict, none");
  }
  if (env.COOKIE_SAMESITE === "none" && !env.COOKIE_SECURE) {
    console.warn("[config] COOKIE_SAMESITE=none requires COOKIE_SECURE=true; browsers will reject the cookie otherwise.");
  }
}
