import express from "express";
import {
  closePoll,
  deleteMessage,
  editMessage,
  forwardMessage,
  listStarred,
  openViewOnce,
  reactToMessage,
  remindMe,
  searchAllMessages,
  starMessage,
  votePoll,
} from "../controllers/message.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { messageLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import {
  editMessageSchema,
  forwardSchema,
  globalSearchSchema,
  pageQuerySchema,
  pollVoteSchema,
  reactSchema,
  reminderSchema,
  starSchema,
} from "../validation/schemas.js";

const router = express.Router();

router.use(protectRoute);

router.get("/starred", validate(pageQuerySchema, "query"), listStarred);
router.get("/search", validate(globalSearchSchema, "query"), searchAllMessages);

router.patch("/:id", validate(editMessageSchema), editMessage);
router.delete("/:id", deleteMessage);
router.post("/:id/react", validate(reactSchema), reactToMessage);
router.post("/:id/forward", messageLimiter, validate(forwardSchema), forwardMessage);
router.post("/:id/remind", validate(reminderSchema), remindMe);
router.put("/:id/star", validate(starSchema), starMessage);
router.post("/:id/poll/vote", validate(pollVoteSchema), votePoll);
router.post("/:id/poll/close", closePoll);
router.post("/:id/view-once", openViewOnce);

export default router;
