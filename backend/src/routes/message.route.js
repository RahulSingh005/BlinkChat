import express from "express";
import {
  deleteMessage,
  editMessage,
  forwardMessage,
  reactToMessage,
  remindMe,
} from "../controllers/message.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { messageLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { editMessageSchema, forwardSchema, reactSchema, reminderSchema } from "../validation/schemas.js";

const router = express.Router();

router.use(protectRoute);

router.patch("/:id", validate(editMessageSchema), editMessage);
router.delete("/:id", deleteMessage);
router.post("/:id/react", validate(reactSchema), reactToMessage);
router.post("/:id/forward", messageLimiter, validate(forwardSchema), forwardMessage);
router.post("/:id/remind", validate(reminderSchema), remindMe);

export default router;
