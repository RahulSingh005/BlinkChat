import express from "express";
import { getStatus, rewrite, smartReplies, summarize, transcribe, translate } from "../controllers/ai.controller.js";
import { getConfig } from "../controllers/config.controller.js";
import { joinByInvite, previewInvite } from "../controllers/invite.controller.js";
import { callHistory, searchGifs } from "../controllers/media.controller.js";
import {
  createStory,
  deleteStory,
  listStories,
  reactToStory,
  replyToStory,
  storyViewers,
  viewStory,
} from "../controllers/story.controller.js";
import { getPublicKey, sendTest, subscribe, unsubscribe } from "../controllers/push.controller.js";
import {
  cancelScheduled,
  deleteReminder,
  listReminders,
  rescheduleScheduled,
  updateReminder,
} from "../controllers/reminder.controller.js";
import { uploadFile, uploadMiddleware } from "../controllers/upload.controller.js";
import { getIceServers } from "../lib/ice.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { aiLimiter, gifLimiter, inviteLimiter, messageLimiter, storyLimiter, uploadLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import {
  aiRewriteSchema,
  aiSmartReplySchema,
  aiSummarizeSchema,
  aiTranscribeSchema,
  aiTranslateSchema,
  createStorySchema,
  gifQuerySchema,
  pageQuerySchema,
  pushSubscribeSchema,
  pushUnsubscribeSchema,
  storyReactSchema,
  storyReplySchema,
} from "../validation/schemas.js";

export const configRouter = express.Router().get("/", getConfig);

export const uploadRouter = express.Router().post("/", protectRoute, uploadLimiter, uploadMiddleware, uploadFile);

export const pushRouter = express
  .Router()
  .get("/public-key", getPublicKey)
  .post("/subscribe", protectRoute, validate(pushSubscribeSchema), subscribe)
  .post("/unsubscribe", protectRoute, validate(pushUnsubscribeSchema), unsubscribe)
  .post("/test", protectRoute, sendTest);

export const reminderRouter = express
  .Router()
  .use(protectRoute)
  .get("/", listReminders)
  .patch("/:id", updateReminder)
  .delete("/:id", deleteReminder);

export const scheduledRouter = express
  .Router()
  .use(protectRoute)
  .patch("/:id", rescheduleScheduled)
  .delete("/:id", cancelScheduled);

export const callRouter = express
  .Router()
  .get("/ice-servers", protectRoute, async (req, res) => {
    res.set("Cache-Control", "private, max-age=600");
    res.json({ iceServers: await getIceServers() });
  })
  .get("/history", protectRoute, validate(pageQuerySchema, "query"), callHistory);

export const mediaRouter = express
  .Router()
  .use(protectRoute, gifLimiter)
  .get("/gifs", validate(gifQuerySchema, "query"), searchGifs("gif"))
  .get("/stickers", validate(gifQuerySchema, "query"), searchGifs("sticker"));

export const storyRouter = express
  .Router()
  .use(protectRoute)
  .get("/", listStories)
  .post("/", storyLimiter, validate(createStorySchema), createStory)
  .delete("/:id", deleteStory)
  .post("/:id/view", viewStory)
  .post("/:id/react", validate(storyReactSchema), reactToStory)
  .post("/:id/reply", messageLimiter, validate(storyReplySchema), replyToStory)
  .get("/:id/viewers", storyViewers);

export const inviteRouter = express
  .Router()
  .use(protectRoute, inviteLimiter)
  .get("/:code", previewInvite)
  .post("/:code/join", joinByInvite);

export const aiRouter = express
  .Router()
  .use(protectRoute)
  .get("/status", getStatus)
  .post("/summarize", aiLimiter, validate(aiSummarizeSchema), summarize)
  .post("/smart-replies", aiLimiter, validate(aiSmartReplySchema), smartReplies)
  .post("/rewrite", aiLimiter, validate(aiRewriteSchema), rewrite)
  .post("/translate", aiLimiter, validate(aiTranslateSchema), translate)
  .post("/transcribe", aiLimiter, validate(aiTranscribeSchema), transcribe);
