import fs from "node:fs";
import path from "node:path";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import { BACKEND_ROOT, env } from "./config/env.js";
import { UPLOADS_DIR } from "./lib/storage.js";
import { errorHandler, notFoundApi } from "./middleware/error.middleware.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { requireAjaxHeader } from "./middleware/security.middleware.js";
import authRoutes from "./routes/auth.route.js";
import conversationRoutes from "./routes/conversation.route.js";
import messageRoutes from "./routes/message.route.js";
import {
  aiRouter,
  callRouter,
  configRouter,
  inviteRouter,
  mediaRouter,
  pushRouter,
  reminderRouter,
  scheduledRouter,
  storyRouter,
  uploadRouter,
} from "./routes/misc.route.js";
import userRoutes from "./routes/user.route.js";

const FRONTEND_DIST = path.resolve(BACKEND_ROOT, "../frontend/dist");

const DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/**
 * An origin may call the API when it's explicitly allowed (CLIENT_URL), when
 * it is this server's own host (frontend served by this backend), or when
 * it's a localhost origin during development.
 */
export function isAllowedOrigin(origin, host) {
  if (!origin) return true;
  const normalized = origin.replace(/\/+$/, "");
  if (env.CLIENT_URLS.includes(normalized)) return true;
  if (!env.isProd && DEV_ORIGIN.test(normalized)) return true;
  if (host) {
    try {
      return new URL(normalized).host === String(host).split(",")[0].trim();
    } catch {
      return false;
    }
  }
  return false;
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (env.TRUST_PROXY) app.set("trust proxy", env.TRUST_PROXY);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
          scriptSrc: ["'self'", "https://accounts.google.com/gsi/client"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com/gsi/style"],
          imgSrc: ["'self'", "data:", "blob:", "https:"],
          mediaSrc: ["'self'", "data:", "blob:", "https:"],
          fontSrc: ["'self'", "data:"],
          connectSrc: ["'self'", "ws:", "wss:", "https://accounts.google.com/gsi/"],
          frameSrc: ["https://accounts.google.com/gsi/"],
          workerSrc: ["'self'", "blob:"],
          manifestSrc: ["'self'"],
        },
      },
      // Google Identity Services opens a popup that must talk back to us.
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      // Uploaded media is loaded by the frontend, which may be on another domain.
      crossOriginResourcePolicy: { policy: "cross-origin" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    })
  );
  app.use(compression());
  app.use(
    cors((req, cb) => {
      const origin = req.headers.origin;
      const allowed = isAllowedOrigin(origin, req.headers["x-forwarded-host"] || req.headers.host);
      cb(allowed ? null : new Error("Not allowed by CORS"), {
        origin: allowed ? origin || true : false,
        credentials: true,
        exposedHeaders: ["RateLimit", "RateLimit-Policy", "Retry-After"],
        maxAge: 600,
      });
    })
  );
  app.use(express.json({ limit: "512kb" }));
  app.use(cookieParser());

  app.get("/api/health", (req, res) => {
    const db = mongoose.connection.readyState === 1 ? "up" : "down";
    res.status(db === "up" ? 200 : 503).json({ status: db === "up" ? "ok" : "degraded", db, uptime: Math.round(process.uptime()) });
  });

  app.use("/api", apiLimiter, requireAjaxHeader);
  app.use("/api/config", configRouter);
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/conversations", conversationRoutes);
  app.use("/api/messages", messageRoutes);
  app.use("/api/uploads", uploadRouter);
  app.use("/api/push", pushRouter);
  app.use("/api/reminders", reminderRouter);
  app.use("/api/scheduled", scheduledRouter);
  app.use("/api/calls", callRouter);
  app.use("/api/ai", aiRouter);
  app.use("/api/media", mediaRouter);
  app.use("/api/stories", storyRouter);
  app.use("/api/invites", inviteRouter);
  app.use("/api", notFoundApi);

  // Locally stored uploads (used when Cloudinary isn't configured). Random
  // file names, immutable caching, and non-media files are forced to
  // download so nothing user-supplied can render as a page on our origin.
  app.use(
    "/uploads",
    express.static(UPLOADS_DIR, {
      maxAge: "30d",
      immutable: true,
      index: false,
      dotfiles: "deny",
      setHeaders(res, filePath) {
        res.setHeader("X-Content-Type-Options", "nosniff");
        if (!/\.(jpe?g|png|webp|gif|avif|heic|heif|mp4|webm|mov|3gp|ogg|opus|mp3|m4a|aac|wav)$/i.test(filePath)) {
          res.setHeader("Content-Disposition", "attachment");
        }
      },
    })
  );
  app.use("/uploads", (req, res) => res.status(404).end());

  const serveFrontend =
    env.SERVE_FRONTEND === "true" ||
    (env.SERVE_FRONTEND !== "false" && env.isProd && fs.existsSync(path.join(FRONTEND_DIST, "index.html")));

  if (serveFrontend) {
    app.use(
      express.static(FRONTEND_DIST, {
        index: false,
        setHeaders(res, filePath) {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          } else if (/(sw\.js|index\.html|manifest\.webmanifest)$/.test(filePath)) {
            res.setHeader("Cache-Control", "no-cache");
          }
        },
      })
    );
    // Every client-side route (/chat, /chat/:id, /settings, /forgot-password,
    // ...) gets the SPA shell. The old server only listed five paths, so a
    // refresh on /chat returned "Cannot GET /chat".
    app.get(/^(?!\/(api|socket\.io|uploads)(\/|$)).*/, (req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(FRONTEND_DIST, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}
