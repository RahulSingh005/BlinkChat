import bcrypt from "bcryptjs";
import { env, validateEnv } from "../config/env.js";
import { connectDB, disconnectDB } from "../lib/db.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import { directKeyFor } from "../services/conversation.service.js";

/**
 * Seeds demo accounts (password: demo1234) plus a couple of conversations.
 * Safe to run repeatedly. The previous seed stored plain-text passwords, so
 * none of the seeded users could actually sign in.
 */
const PASSWORD = "demo1234";

const DEMO_USERS = [
  { email: "ava@demo.blinkchat.app", fullName: "Ava Wilson", about: "Product designer · coffee enthusiast ☕", timezone: "America/New_York" },
  { email: "liam@demo.blinkchat.app", fullName: "Liam Patel", about: "Building things at night 🌙", timezone: "Asia/Kolkata" },
  { email: "sofia@demo.blinkchat.app", fullName: "Sofía García", about: "Hola! Escríbeme en español o inglés", timezone: "Europe/Madrid", language: "es" },
  { email: "noah@demo.blinkchat.app", fullName: "Noah Kim", about: "Available", timezone: "Asia/Seoul" },
  { email: "mia@demo.blinkchat.app", fullName: "Mia Johnson", about: "At work", timezone: "Europe/London" },
];

async function upsertUsers() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const users = [];
  for (const u of DEMO_USERS) {
    const user = await User.findOneAndUpdate(
      { email: u.email },
      {
        $setOnInsert: { email: u.email, password: hash, hasPassword: true },
        $set: { fullName: u.fullName, about: u.about, timezone: u.timezone, "settings.language": u.language || "en" },
      },
      { upsert: true, new: true }
    );
    users.push(user);
  }
  return users;
}

async function seedChat(a, b, lines) {
  const directKey = directKeyFor(a._id, b._id);
  if (await Conversation.exists({ directKey })) return;
  const start = Date.now() - lines.length * 7 * 60 * 1000;
  const conv = await Conversation.create({
    type: "direct",
    directKey,
    createdBy: a._id,
    members: [
      { user: a._id, joinedAt: new Date(start - 1000), lastReadAt: new Date(start - 1000) },
      { user: b._id, joinedAt: new Date(start - 1000), lastReadAt: new Date() },
    ],
    lastMessageAt: new Date(start + (lines.length - 1) * 7 * 60 * 1000),
  });
  let unreadForA = 0;
  for (const [i, [from, text]] of lines.entries()) {
    const sender = from === "a" ? a : b;
    if (sender === b) unreadForA += 1;
    const at = new Date(start + i * 7 * 60 * 1000);
    await Message.create({ conversation: conv._id, sender: sender._id, text, createdAt: at, updatedAt: at });
  }
  await Conversation.updateOne({ _id: conv._id, "members.user": a._id }, { $set: { "members.$.unreadCount": unreadForA } });
}

async function main() {
  validateEnv();
  await connectDB(env.MONGODB_URI, { retries: 1 });
  const [ava, liam, sofia, noah] = await upsertUsers();

  await seedChat(ava, liam, [
    ["b", "Hey Ava! Did you get a chance to look at the new onboarding flow?"],
    ["a", "Yes! Loved the illustrations. The second step feels a bit long though."],
    ["b", "Agreed. Could we sync tomorrow at 10am your time to trim it down?"],
  ]);
  await seedChat(ava, sofia, [
    ["b", "¡Hola Ava! ¿Vienes a la cena del viernes? 🍝"],
    ["b", "Reservé para las 8 en el restaurante de siempre."],
  ]);
  await seedChat(liam, noah, [
    ["a", "Noah, can you review my PR before the release?"],
    ["b", "On it 👍"],
  ]);

  console.log(`[seed] Demo users ready (password: ${PASSWORD}):`);
  for (const u of DEMO_USERS) console.log(`  - ${u.email}`);
  await disconnectDB();
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
