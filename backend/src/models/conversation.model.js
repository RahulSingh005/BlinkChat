import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// Per-member state lives on the conversation so a single query gives the
// sidebar everything it needs (unread count, mute, pin, archive...).
const memberSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["admin", "member"], default: "member" },
    joinedAt: { type: Date, default: Date.now },
    lastReadAt: { type: Date, default: Date.now },
    lastDeliveredAt: { type: Date, default: Date.now },
    unreadCount: { type: Number, default: 0, min: 0 },
    // Unread messages that @mention this member (shown as "@" in the list).
    mentionCount: { type: Number, default: 0, min: 0 },
    mutedUntil: { type: Date, default: null },
    pinnedAt: { type: Date, default: null },
    favorite: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
    // Messages before this are hidden for this member only ("Clear chat").
    clearedAt: { type: Date, default: null },
    // "Delete chat": hidden from the list until a new message arrives.
    hidden: { type: Boolean, default: false },
  },
  { _id: false }
);

const pinnedSchema = new mongoose.Schema(
  {
    message: { type: ObjectId, ref: "Message", required: true },
    by: { type: ObjectId, ref: "User" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    // self = "Saved Messages" (a private notes chat with yourself).
    type: { type: String, enum: ["direct", "group", "self"], required: true },
    // Sorted "<userA>:<userB>" for direct chats; guarantees one per pair.
    directKey: { type: String, default: undefined },
    name: { type: String, trim: true, maxlength: 80, default: "" },
    description: { type: String, trim: true, maxlength: 300, default: "" },
    avatar: { type: String, default: "" },
    createdBy: { type: ObjectId, ref: "User" },
    members: { type: [memberSchema], default: [] },
    pinned: { type: [pinnedSchema], default: [] },
    // Group invite link (join by code).
    inviteCode: { type: String, default: undefined },
    lastMessageAt: { type: Date, default: null },
    // 0 = off. Otherwise new messages expire after this many seconds.
    disappearingSeconds: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

conversationSchema.index(
  { directKey: 1 },
  { unique: true, partialFilterExpression: { directKey: { $type: "string" } } }
);
conversationSchema.index(
  { inviteCode: 1 },
  { unique: true, partialFilterExpression: { inviteCode: { $type: "string" } } }
);
conversationSchema.index({ "members.user": 1, lastMessageAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
