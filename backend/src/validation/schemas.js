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
});

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

export const mediaQuerySchema = z.object({
  kind: z.enum(["media", "files", "audio"]).optional().default("media"),
  before: objectId().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(48),
});

// ---- Messages ------------------------------------------------------------

export const attachmentSchema = z.object({
  kind: z.enum(["image", "video", "audio", "file"]),
  url: z.string().min(1).max(600),
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

export const sendMessageSchema = z
  .object({
    ...messageBody,
    clientId: z.string().regex(/^[\w-]{6,64}$/, "Invalid client id").optional(),
  })
  .refine(notEmpty, { message: "Message is empty", path: ["text"] });

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
