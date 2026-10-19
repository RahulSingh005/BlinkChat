import { z } from "zod";

export const objectId = (message = "Invalid id") => z.string({ error: message }).regex(/^[a-f\d]{24}$/i, message);

export const emailField = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .max(254, "Email is too long")
  .email("Please enter a valid email address");

export const passwordField = z
  .string({ error: "Password is required" })
  .min(6, "Password must be at least 6 characters")
  .max(128, "Password is too long (max 128 characters)");

const fullNameField = z
  .string({ error: "Full name is required" })
  .trim()
  .min(1, "Full name is required")
  .max(60, "Name is too long (max 60 characters)");

const timezoneField = z.string().trim().max(64).optional();

// ---- Auth ------------------------------------------------------------------

export const signupSchema = z.object({
  fullName: fullNameField,
  email: emailField,
  password: passwordField,
  timezone: timezoneField,
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string({ error: "Password is required" }).min(1, "Password is required").max(128),
});

export const googleSchema = z.object({
  credential: z.string({ error: "Missing Google credential" }).min(20, "Missing Google credential").max(8000),
  timezone: timezoneField,
});

export const forgotPasswordSchema = z.object({ email: emailField });

export const verifyOtpSchema = z.object({
  email: emailField,
  otp: z.string({ error: "Enter the 6-digit code" }).trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const resetPasswordSchema = z.object({
  email: emailField,
  resetToken: z.string({ error: "Reset session expired" }).regex(/^[a-f\d]{64}$/i, "Reset session expired. Please start again."),
  newPassword: passwordField,
});

const statusSchema = z
  .object({
    emoji: z.string().trim().max(16).default(""),
    text: z.string().trim().max(80, "Status is too long (max 80 characters)").default(""),
    expiresAt: z.coerce.date().nullable().optional(),
  })
  .nullable();

export const updateProfileSchema = z.object({
  fullName: fullNameField.optional(),
  about: z.string().trim().max(150, "About is too long (max 150 characters)").optional(),
  phone: z
    .string()
    .trim()
    .max(24, "Phone number is too long")
    .regex(/^[+\d\s().-]*$/, "Phone number can only contain digits, spaces and + ( ) -")
    .optional(),
  timezone: timezoneField,
  profilePic: z.string().max(600).optional(),
  settings: z
    .object({
      showLastSeen: z.boolean().optional(),
      readReceipts: z.boolean().optional(),
      shareLocalTime: z.boolean().optional(),
      notificationPreviews: z.boolean().optional(),
      language: z.string().trim().min(2).max(12).optional(),
    })
    .optional(),
  status: statusSchema.optional(),
  focus: z
    .object({
      until: z.coerce.date().nullable(),
      allowUrgent: z.boolean().optional(),
    })
    .optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().max(128).optional(),
  newPassword: passwordField,
});

export const deleteAccountSchema = z.object({
  password: z.string().max(128).optional(),
  confirm: z.literal("DELETE", { error: 'Type "DELETE" to confirm' }),
  deleteMessages: z.boolean().optional().default(false),
});

// ---- Users ---------------------------------------------------------------

export const searchUsersSchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

// ---- Conversations ---------------------------------------------------------

export const directSchema = z.object({ userId: objectId("Invalid user") });

export const createGroupSchema = z.object({
  name: z.string({ error: "Group name is required" }).trim().min(1, "Group name is required").max(80, "Group name is too long"),
  description: z.string().trim().max(300).optional().default(""),
  avatar: z.string().max(600).optional().default(""),
  memberIds: z.array(objectId("Invalid member")).min(1, "Add at least one member").max(255, "Groups are limited to 256 members"),
});

export const updateGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(80, "Group name is too long").optional(),
  description: z.string().trim().max(300).optional(),
  avatar: z.string().max(600).optional(),
});

export const addMembersSchema = z.object({
  userIds: z.array(objectId("Invalid member")).min(1, "Pick at least one person").max(50),
});

export const memberRoleSchema = z.object({ role: z.enum(["admin", "member"]) });

export const conversationSettingsSchema = z.object({
  // null = unmute, -1 = always, otherwise seconds from now.
  muteFor: z.number().int().min(-1).max(10 * 365 * 24 * 3600).nullable().optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  favorite: z.boolean().optional(),
});

export const pinMessageSchema = z.object({ messageId: objectId("Invalid message") });

export const DISAPPEARING_OPTIONS = [0, 24 * 3600, 7 * 24 * 3600, 90 * 24 * 3600];
export const disappearingSchema = z.object({
  seconds: z.number().int().refine((v) => DISAPPEARING_OPTIONS.includes(v), "Unsupported timer"),
});

export const messagesQuerySchema = z.object({
  before: objectId().optional(),
  after: objectId().optional(),
  around: objectId().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(40),
});

export const searchMessagesSchema = z.object({
  q: z.string({ error: "Type something to search" }).trim().min(1, "Type something to search").max(100),
});

export const globalSearchSchema = z.object({
  q: z.string({ error: "Type something to search" }).trim().min(2, "Type at least 2 characters").max(100),
  limit: z.coerce.number().int().min(1).max(50).optional().default(30),
});

export const pageQuerySchema = z.object({
  before: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const mediaQuerySchema = z.object({
  kind: z.enum(["media", "files", "audio"]).optional().default("media"),
  before: objectId().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(48),
});

// ---- Messages ------------------------------------------------------------

export const attachmentSchema = z.object({
  kind: z.enum(["image", "video", "audio", "file", "gif", "sticker"]),
  url: z.string().min(1).max(600),
  mp4: z.string().max(600).optional().default(""),
  provider: z.string().max(20).optional().default(""),
  // HMAC from the GIF proxy (proves the URL came from /api/media).
  sig: z.string().max(128).optional(),
  name: z.string().max(200).optional().default(""),
  mime: z.string().max(120).optional().default(""),
  size: z.number().min(0).max(200 * 1024 * 1024).optional().default(0),
  width: z.number().min(0).max(20000).nullable().optional(),
  height: z.number().min(0).max(20000).nullable().optional(),
  duration: z.number().min(0).max(24 * 3600).nullable().optional(),
  voice: z.boolean().optional().default(false),
  waveform: z.array(z.number().min(0).max(1)).max(64).optional(),
  publicId: z.string().max(300).optional().default(""),
  storage: z.enum(["cloudinary", "local"]).optional().default("local"),
});

const messageBody = {
  text: z.string().max(4000, "Message is too long (max 4000 characters)").optional().default(""),
  attachments: z.array(attachmentSchema).max(10, "You can attach up to 10 files").optional().default([]),
  replyTo: objectId().nullable().optional(),
  urgent: z.boolean().optional().default(false),
};

const notEmpty = (m) => m.text.trim().length > 0 || m.attachments.length > 0;

export const pollInputSchema = z.object({
  question: z.string({ error: "Ask a question" }).trim().min(1, "Ask a question").max(200, "Question is too long"),
  options: z
    .array(z.string().trim().min(1, "Options can't be empty").max(100, "Option is too long"))
    .min(2, "Add at least 2 options")
    .max(12, "Polls can have up to 12 options")
    .refine((opts) => new Set(opts.map((o) => o.toLowerCase())).size === opts.length, "Options must be different"),
  multiple: z.boolean().optional().default(false),
});

export const locationInputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000).nullable().optional(),
  label: z.string().trim().max(120).optional().default(""),
});

export const sendMessageSchema = z
  .object({
    ...messageBody,
    clientId: z.string().regex(/^[\w-]{6,64}$/, "Invalid client id").optional(),
    poll: pollInputSchema.optional(),
    location: locationInputSchema.optional(),
    contactUserId: objectId("Invalid contact").optional(),
    mentions: z.array(objectId()).max(50).optional().default([]),
    viewOnce: z.boolean().optional().default(false),
  })
  .refine((m) => notEmpty(m) || m.poll || m.location || m.contactUserId, { message: "Message is empty", path: ["text"] })
  .refine((m) => [m.poll, m.location, m.contactUserId].filter(Boolean).length <= 1, {
    message: "Send polls, locations and contacts as separate messages",
    path: ["poll"],
  })
  .refine((m) => !m.viewOnce || (m.attachments.length === 1 && ["image", "video"].includes(m.attachments[0].kind)), {
    message: "View once works with a single photo or video",
    path: ["viewOnce"],
  });

export const pollVoteSchema = z.object({
  optionIds: z.array(z.string().max(16)).max(12),
});

export const starSchema = z.object({ starred: z.boolean() });

export const scheduleMessageSchema = z
  .object({ ...messageBody, sendAt: z.coerce.date({ error: "Pick a valid time" }) })
  .refine(notEmpty, { message: "Message is empty", path: ["text"] });

export const editMessageSchema = z.object({
  text: z.string({ error: "Message can't be empty" }).trim().min(1, "Message can't be empty").max(4000, "Message is too long"),
});

export const reactSchema = z.object({
  emoji: z.string({ error: "Pick an emoji" }).trim().min(1, "Pick an emoji").max(16).regex(/^[^\s<>]+$/u, "Invalid reaction"),
});

export const deleteMessageSchema = z.object({ scope: z.enum(["me", "everyone"]).optional().default("me") });

export const forwardSchema = z.object({
  conversationIds: z.array(objectId()).min(1, "Pick a chat").max(5, "You can forward to up to 5 chats at once"),
});

export const reminderSchema = z.object({
  remindAt: z.coerce.date({ error: "Pick a valid time" }),
  note: z.string().trim().max(200).optional().default(""),
});

// ---- GIFs / stories / invites ----------------------------------------------

export const gifQuerySchema = z.object({
  q: z.string().trim().max(60).optional().default(""),
  page: z.coerce.number().int().min(1).max(50).optional().default(1),
  limit: z.coerce.number().int().min(8).max(50).optional().default(24),
  locale: z
    .string()
    .regex(/^[a-z]{2}(_[A-Z]{2})?$/)
    .optional()
    .default("en_US"),
});

export const STORY_BACKGROUNDS = [
  "#5B5BD6",
  "#E5484D",
  "#12A594",
  "#F76B15",
  "#8E4EC6",
  "#0090FF",
  "#D6409F",
  "#3E63DD",
  "#29A383",
  "#1C2024",
];

export const createStorySchema = z
  .object({
    kind: z.enum(["text", "image", "video"]),
    text: z.string().trim().max(700, "Status is too long").optional().default(""),
    background: z
      .string()
      .refine((v) => STORY_BACKGROUNDS.includes(v), "Pick a background")
      .optional()
      .default(STORY_BACKGROUNDS[0]),
    font: z.enum(["sans", "serif", "mono", "display"]).optional().default("sans"),
    caption: z.string().trim().max(300).optional().default(""),
    media: z
      .object({
        url: z.string().min(1).max(600),
        kind: z.enum(["image", "video"]),
        width: z.number().min(0).max(20000).nullable().optional(),
        height: z.number().min(0).max(20000).nullable().optional(),
        duration: z.number().min(0).max(60).nullable().optional(),
        publicId: z.string().max(300).optional().default(""),
        storage: z.enum(["cloudinary", "local"]).optional().default("local"),
      })
      .optional(),
  })
  .refine((s) => (s.kind === "text" ? s.text.length > 0 : Boolean(s.media) && s.media.kind === s.kind), {
    message: "Your status is empty",
    path: ["text"],
  });

export const storyReactSchema = z.object({
  emoji: z.string().trim().min(1).max(16).regex(/^[^\s<>]+$/u, "Invalid reaction"),
});

export const storyReplySchema = z.object({
  text: z.string({ error: "Write a reply" }).trim().min(1, "Write a reply").max(1000),
});

export const INVITE_CODE = /^[A-Za-z0-9_-]{8,32}$/;

// ---- Push / AI -------------------------------------------------------------

export const pushSubscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(1000),
    keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(4).max(100) }),
  }),
});

export const pushUnsubscribeSchema = z.object({ endpoint: z.string().max(1000) });

export const aiSummarizeSchema = z.object({
  conversationId: objectId(),
  mode: z.enum(["unread", "recent"]).optional().default("unread"),
  since: z.coerce.date().optional(),
});

export const aiSmartReplySchema = z.object({ conversationId: objectId() });

export const REWRITE_STYLES = ["fix", "friendly", "professional", "concise", "expand", "emoji"];
export const aiRewriteSchema = z.object({
  text: z.string({ error: "Write something first" }).trim().min(1, "Write something first").max(4000),
  style: z.enum(REWRITE_STYLES).optional().default("fix"),
  conversationId: objectId().optional(),
});

export const aiTranslateSchema = z
  .object({
    messageIds: z.array(objectId()).max(30).optional(),
    text: z.string().trim().max(4000).optional(),
    lang: z.string().trim().min(2).max(40),
  })
  .refine((d) => (d.messageIds && d.messageIds.length) || d.text, { message: "Nothing to translate" });

export const aiTranscribeSchema = z.object({ messageId: objectId() });
