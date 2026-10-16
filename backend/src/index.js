import { env, validateEnv } from "./config/env.js";
import http from "node:http";
import { createApp, isAllowedOrigin } from "./app.js";
import { connectDB, disconnectDB } from "./lib/db.js";
import { initPush } from "./lib/push.js";
import { startScheduler, stopScheduler } from "./lib/scheduler.js";
import { runMigrations } from "./migrations/index.js";
import { createSocketServer } from "./socket/index.js";

async function main() {
  validateEnv();
  await connectDB(env.MONGODB_URI);
  await runMigrations();
  initPush();

  const app = createApp();
  const server = http.createServer(app);
  const io = createSocketServer(server, { isAllowedOrigin });

  startScheduler();

  server.listen(env.PORT, () => {
    console.log(`[server] BlinkChat API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] ${signal} received, shutting down gracefully...`);
    stopScheduler();
    io.close();
    server.close();
    await disconnectDB().catch(() => {});
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

process.on("unhandledRejection", (reason) => {
  console.error("[server] Unhandled promise rejection:", reason);
});

main().catch((err) => {
  console.error("[server] Failed to start:", err.message);
  process.exit(1);
});
