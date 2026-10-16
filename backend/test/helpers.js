import http from "node:http";
import os from "node:os";
import path from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { io as ioClient } from "socket.io-client";

// Must be set before any app module is imported (env.js reads them once).
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.UPLOADS_DIR = path.join(os.tmpdir(), `blinkchat-test-uploads-${process.pid}`);

let mongod;
let server;
let baseUrl;
const sockets = new Set();

export async function setup() {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("blinkchat-test");

  const { connectDB } = await import("../src/lib/db.js");
  const { createApp, isAllowedOrigin } = await import("../src/app.js");
  const { createSocketServer } = await import("../src/socket/index.js");
  const { runMigrations } = await import("../src/migrations/index.js");

  await connectDB(process.env.MONGODB_URI, { retries: 0 });
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  await runMigrations();

  const app = createApp();
  server = http.createServer(app);
  createSocketServer(server, { isAllowedOrigin });
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  return { app, baseUrl };
}

export async function teardown() {
  for (const s of sockets) s.disconnect();
  sockets.clear();
  const { getIO, resetPresence } = await import("../src/lib/realtime.js");
  resetPresence();
  const { clearPresenceTimers } = await import("../src/socket/index.js");
  const { resetCalls } = await import("../src/socket/calls.js");
  resetCalls();
  clearPresenceTimers();
  getIO()?.close();
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongod.stop();
}

export async function resetDb() {
  const { clearCaches } = await import("../src/lib/cache.js");
  clearCaches();
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

/** supertest agent that sends the CSRF header like the real client. */
export function client() {
  const agent = request.agent(baseUrl);
  const wrap = (method) => (url) => agent[method](url).set("X-Requested-With", "XMLHttpRequest");
  return {
    agent,
    get: wrap("get"),
    post: wrap("post"),
    put: wrap("put"),
    patch: wrap("patch"),
    delete: wrap("delete"),
  };
}

let counter = 0;
export async function createUser(name = "Test User", extra = {}) {
  counter += 1;
  const c = client();
  const email = `user${counter}_${Date.now()}@example.com`;
  const res = await c.post("/api/auth/signup").send({ fullName: name, email, password: "secret123", ...extra });
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  const cookie = res.headers["set-cookie"].find((x) => x.startsWith("jwt=")).split(";")[0];
  return { ...c, user: res.body.user, email, password: "secret123", cookie };
}

export function connectSocket(cookie, { visible = true } = {}) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(baseUrl, {
      transports: ["websocket"],
      extraHeaders: { Cookie: cookie, Origin: "http://localhost:5173" },
      auth: { visible },
      reconnection: false,
      forceNew: true,
    });
    sockets.add(socket);
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", (err) => reject(err));
  });
}

export function waitFor(socket, event, predicate = () => true, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for "${event}"`));
    }, timeout);
    function handler(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    }
    socket.on(event, handler);
  });
}

export const getBaseUrl = () => baseUrl;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const emitAck = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));
