import { env, features } from "../config/env.js";
import { aiStatus } from "../lib/ai.js";
import { turnProvider } from "../lib/ice.js";
import { passwordResetAvailable } from "../lib/mailer.js";
import { pushEnabled, vapidPublicKey } from "../lib/push.js";
import { SIZE_LIMITS } from "../lib/storage.js";
import { EDIT_WINDOW_MS } from "../services/message.service.js";
import { GROUP_MAX_MEMBERS } from "../services/conversation.service.js";

/**
 * Public runtime configuration. The frontend reads this on boot, so keys
 * like the Google client id live only in backend/.env.
 */
export const getConfig = (req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json({
    googleClientId: env.GOOGLE_CLIENT_ID || null,
    vapidPublicKey: vapidPublicKey(),
    features: {
      googleAuth: features.google,
      passwordReset: passwordResetAvailable(),
      push: pushEnabled(),
      ai: aiStatus(),
      storage: features.cloudinary ? "cloudinary" : "local",
      turn: Boolean(turnProvider()),
      publicDirectory: env.PUBLIC_DIRECTORY,
    },
    limits: {
      messageLength: 4000,
      attachments: 10,
      uploadBytes: SIZE_LIMITS,
      editWindowMs: EDIT_WINDOW_MS,
      groupMembers: GROUP_MAX_MEMBERS,
    },
  });
};
