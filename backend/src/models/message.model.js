import mongoose from "mongoose";

const { ObjectId, Mixed } = mongoose.Schema.Types;

export const ATTACHMENT_KINDS = ["image", "video", "audio", "file", "gif", "sticker"];

const attachmentSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ATTACHMENT_KINDS, required: true },
    url: { type: String, required: true },
    // GIFs play as muted looping video when an mp4 rendition exists.
    mp4: { type: String, default: "" },
    provider: { type: String, default: "" },
    name: { type: String, default: "" },
    mime: { type: String, default: "" },
    size: { type: Number, default: 0 },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    duration: { type: Number, default: null },
    // Recorded in-app voice note (vs. an uploaded audio file).
    voice: { type: Boolean, default: false },
    // Up to 64 normalized peaks (0-1) captured while recording.
    waveform: { type: [Number], default: undefined },
    publicId: { type: String, default: "" },
    storage: { type: String, enum: ["cloudinary", "local"], default: "local" },
  },
  { _id: false }
);

const pollSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, maxlength: 200 },
    options: {
      type: [
        new mongoose.Schema(
          {
            id: { type: String, required: true },
            text: { type: String, required: true, maxlength: 100 },
            voters: { type: [{ type: ObjectId, ref: "User" }], default: [] },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    multiple: { type: Boolean, default: false },
    closedAt: { type: Date, default: null },
  },
  { _id: false }
);

const reactionSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    emoji: { type: String, required: true, maxlength: 16 },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: ObjectId, ref: "Conversation", required: true },
    sender: { type: ObjectId, ref: "User", required: true },
    // user = normal message, system = "Alice added Bob", call = call log.
    type: { type: String, enum: ["user", "system", "call"], default: "user" },
    text: { type: String, default: "", maxlength: 4000 },
    attachments: { type: [attachmentSchema], default: [] },
    replyTo: {
      type: new mongoose.Schema(
        {
          message: { type: ObjectId, ref: "Message" },
          sender: { type: ObjectId, ref: "User" },
          text: { type: String, default: "" },
          kind: { type: String, default: null },
        },
        { _id: false }
      ),
      default: null,
    },
    forwarded: { type: Boolean, default: false },
    poll: { type: pollSchema, default: null },
    location: {
      type: new mongoose.Schema(
        {
          lat: { type: Number, required: true, min: -90, max: 90 },
          lng: { type: Number, required: true, min: -180, max: 180 },
          accuracy: { type: Number, default: null },
          label: { type: String, default: "", maxlength: 120 },
        },
        { _id: false }
      ),
      default: null,
    },
    contactCard: {
      type: new mongoose.Schema(
        {
          user: { type: ObjectId, ref: "User", required: true },
          name: { type: String, default: "" },
          avatar: { type: String, default: "" },
        },
        { _id: false }
      ),
      default: null,
    },
    linkPreview: {
      type: new mongoose.Schema(
        {
          url: String,
          title: String,
          description: String,
          image: String,
          siteName: String,
        },
        { _id: false }
      ),
      default: null,
    },
    // Users @mentioned in a group message.
    mentions: { type: [{ type: ObjectId, ref: "User" }], default: [] },
    // Per-user bookmarks ("Starred messages").
    starredBy: { type: [{ type: ObjectId, ref: "User" }], default: [] },
    // View-once media: URLs are withheld until opened, then it's spent.
    viewOnce: { type: Boolean, default: false },
    viewedBy: { type: [{ type: ObjectId, ref: "User" }], default: [] },
    storyReply: {
      type: new mongoose.Schema(
        {
          story: { type: ObjectId, ref: "Story" },
          owner: { type: ObjectId, ref: "User" },
          storyType: { type: String, default: "text" },
          text: String,
          background: String,
          mediaUrl: String,
          mediaKind: String,
        },
        { _id: false }
      ),
      default: null,
    },
    // Breaks through the recipient's mute / focus mode.
    urgent: { type: Boolean, default: false },
    scheduled: { type: Boolean, default: false },
    reactions: { type: [reactionSchema], default: [] },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    // "Delete for me".
    hiddenFor: { type: [{ type: ObjectId, ref: "User" }], default: [] },
    // Client-generated id for optimistic UI + idempotent retries.
    clientId: { type: String, default: undefined },
    system: {
      type: new mongoose.Schema(
        {
          event: { type: String, required: true },
          targets: { type: [{ type: ObjectId, ref: "User" }], default: [] },
          data: { type: Mixed, default: null },
        },
        { _id: false }
      ),
      default: null,
    },
    call: {
      type: new mongoose.Schema(
        {
          kind: { type: String, enum: ["voice", "video"], required: true },
          status: {
            type: String,
            enum: ["completed", "missed", "declined", "unavailable", "canceled"],
            required: true,
          },
          duration: { type: Number, default: 0 },
        },
        { _id: false }
      ),
      default: null,
    },
    // AI caches: voice-note transcript and per-language translations.
    transcript: { type: String, default: undefined },
    translations: { type: Mixed, default: undefined },
    // Disappearing messages: removed by the TTL index below.
    expiresAt: { type: Date, default: undefined },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index(
  { sender: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: "string" } } }
);
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
messageSchema.index({ starredBy: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, type: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
