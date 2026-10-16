/**
 * Zero-setup local development: starts a real MongoDB (downloaded once by
 * mongodb-memory-server), keeps its data in backend/.data/db between runs,
 * then boots the API. No Atlas account needed to try BlinkChat.
 *
 *   npm run dev:memory
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoMemoryServer } from "mongodb-memory-server";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Cache the MongoDB binary inside backend/ no matter where npm was run from
// (otherwise launching from the repo root downloads it again).
process.env.MONGOMS_DOWNLOAD_DIR ||= path.join(root, "node_modules", ".cache", "mongodb-memory-server");
const dataDir = path.join(root, ".data");
const dbPath = path.join(dataDir, "db");
fs.mkdirSync(dbPath, { recursive: true });

// A stable dev secret so sessions survive restarts.
const secretFile = path.join(dataDir, "dev-jwt-secret");
if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(48).toString("hex"));

const mongod = await MongoMemoryServer.create({
  instance: { dbPath, storageEngine: "wiredTiger", port: Number(process.env.DEV_MONGO_PORT) || 27027 },
});

process.env.MONGODB_URI = mongod.getUri("blinkchat");
process.env.JWT_SECRET ||= fs.readFileSync(secretFile, "utf8").trim();
console.log(`[dev] Local MongoDB running at ${process.env.MONGODB_URI} (data in backend/.data/db)`);

const stop = async () => {
  await mongod.stop({ doCleanup: false }).catch(() => {});
};
process.on("exit", () => mongod.stop({ doCleanup: false }).catch(() => {}));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

await import("../src/index.js");
