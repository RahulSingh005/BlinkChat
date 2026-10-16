import { env, validateEnv } from "../config/env.js";
import { connectDB, disconnectDB } from "../lib/db.js";
import { runMigrations } from "./index.js";

// Manual entry point: `npm run migrate` (migrations also run on startup).
validateEnv();
await connectDB(env.MONGODB_URI, { retries: 1 });
await runMigrations();
await disconnectDB();
console.log("[migrate] done");
