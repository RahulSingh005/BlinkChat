import mongoose from "mongoose";
import { directKeyFor } from "../services/conversation.service.js";

/**
 * Idempotent startup migrations. Each one runs once and is recorded in the
 * `migrations` collection, so existing deployments upgrade in place without
 * losing chats.
 */
const MIGRATIONS = [
  {
    id: "2026-10-legacy-messages-to-conversations",
    // v1 stored messages as { senderId, receiverId, text, image }. v2 groups
    // them into conversations with per-member state.
    async up(db) {
      const messages = db.collection("messages");
      const conversations = db.collection("conversations");
      const legacy = { conversation: { $exists: false }, senderId: { $exists: true } };

      const count = await messages.countDocuments(legacy);
      if (!count) return "nothing to migrate";

      const pairs = await messages
        .aggregate([
          { $match: legacy },
          {
            $group: {
              _id: {
                a: { $cond: [{ $lt: ["$senderId", "$receiverId"] }, "$senderId", "$receiverId"] },
                b: { $cond: [{ $lt: ["$senderId", "$receiverId"] }, "$receiverId", "$senderId"] },
              },
              first: { $min: "$createdAt" },
              last: { $max: "$createdAt" },
            },
          },
        ])
        .toArray();

      for (const { _id: pair, first, last } of pairs) {
        if (!pair.a || !pair.b) continue;
        const directKey = directKeyFor(pair.a, pair.b);
        let conv = await conversations.findOne({ directKey });
        if (!conv) {
          const member = (user) => ({
            user,
            role: "member",
            joinedAt: first,
            lastReadAt: last, // treat history as read: no surprise badges
            lastDeliveredAt: last,
            unreadCount: 0,
            mutedUntil: null,
            pinnedAt: null,
            archived: false,
            clearedAt: null,
            hidden: false,
          });
          const now = new Date();
          const { insertedId } = await conversations.insertOne({
            type: "direct",
            directKey,
            name: "",
            description: "",
            avatar: "",
            createdBy: pair.a,
            members: [member(pair.a), member(pair.b)],
            lastMessageAt: last,
            disappearingSeconds: 0,
            createdAt: first || now,
            updatedAt: now,
          });
          conv = { _id: insertedId };
        }

        await messages.updateMany(
          {
            ...legacy,
            $or: [
              { senderId: pair.a, receiverId: pair.b },
              { senderId: pair.b, receiverId: pair.a },
            ],
          },
          [
            {
              $set: {
                conversation: conv._id,
                sender: "$senderId",
                type: "user",
                text: { $ifNull: ["$text", ""] },
                attachments: {
                  $cond: [
                    { $gt: [{ $strLenCP: { $ifNull: ["$image", ""] } }, 0] },
                    [
                      {
                        kind: "image",
                        url: "$image",
                        name: "",
                        mime: "image/jpeg",
                        size: 0,
                        width: null,
                        height: null,
                        duration: null,
                        voice: false,
                        publicId: "",
                        storage: "cloudinary",
                      },
                    ],
                    [],
                  ],
                },
                replyTo: null,
                forwarded: false,
                urgent: false,
                scheduled: false,
                reactions: [],
                editedAt: null,
                deletedAt: null,
                hiddenFor: [],
                system: null,
                call: null,
              },
            },
            { $unset: ["senderId", "receiverId", "image"] },
          ]
        );
      }
      return `migrated ${count} messages into ${pairs.length} conversations`;
    },
  },
  {
    id: "2026-10-users-v2",
    async up(db) {
      const users = db.collection("users");
      await users.updateMany({ hasPassword: { $exists: false }, authProvider: "google" }, { $set: { hasPassword: false } });
      await users.updateMany({ hasPassword: { $exists: false } }, { $set: { hasPassword: true } });
      await users.updateMany(
        {
          $or: [
            { resetPasswordOtp: { $exists: true } },
            { resetPasswordOtpExpiry: { $exists: true } },
            { resetPasswordVerified: { $exists: true } },
          ],
        },
        { $unset: { resetPasswordOtp: "", resetPasswordOtpExpiry: "", resetPasswordVerified: "" } }
      );

      // Emails are now case-insensitive. Lowercase existing ones unless that
      // would collide with another account.
      const mixed = await users.find({ email: /[A-Z\s]/ }).project({ email: 1 }).toArray();
      let changed = 0;
      for (const u of mixed) {
        const lower = String(u.email).trim().toLowerCase();
        const clash = await users.findOne({ email: lower, _id: { $ne: u._id } });
        if (clash) {
          console.warn(`[migrate] Could not lowercase email ${u.email}: another account uses ${lower}`);
          continue;
        }
        await users.updateOne({ _id: u._id }, { $set: { email: lower } });
        changed += 1;
      }
      return `normalized ${changed} emails`;
    },
  },
];

export async function runMigrations() {
  const db = mongoose.connection.db;
  const log = db.collection("migrations");
  for (const migration of MIGRATIONS) {
    if (await log.findOne({ _id: migration.id })) continue;
    const started = Date.now();
    const result = await migration.up(db);
    await log.insertOne({ _id: migration.id, at: new Date(), result: String(result || "done") });
    console.log(`[migrate] ${migration.id}: ${result || "done"} (${Date.now() - started}ms)`);
  }
}
