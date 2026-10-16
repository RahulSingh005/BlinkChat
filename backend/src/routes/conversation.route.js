import express from "express";
import {
  addMembers,
  clearChat,
  createGroup,
  createScheduled,
  deleteChat,
  getConversation,
  getMedia,
  getMessages,
  listConversations,
  listScheduled,
  markRead,
  openDirect,
  removeMember,
  searchMessages,
  sendMessage,
  setDisappearing,
  setMemberRole,
  updateGroup,
  updateMySettings,
} from "../controllers/conversation.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { messageLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import {
  addMembersSchema,
  conversationSettingsSchema,
  createGroupSchema,
  directSchema,
  disappearingSchema,
  mediaQuerySchema,
  memberRoleSchema,
  messagesQuerySchema,
  scheduleMessageSchema,
  searchMessagesSchema,
  sendMessageSchema,
  updateGroupSchema,
} from "../validation/schemas.js";

const router = express.Router();

router.use(protectRoute);

router.get("/", listConversations);
router.post("/direct", validate(directSchema), openDirect);
router.post("/group", validate(createGroupSchema), createGroup);

router.get("/:id", getConversation);
router.patch("/:id", validate(updateGroupSchema), updateGroup);
router.delete("/:id", deleteChat);

router.post("/:id/members", validate(addMembersSchema), addMembers);
router.delete("/:id/members/:userId", removeMember);
router.patch("/:id/members/:userId", validate(memberRoleSchema), setMemberRole);

router.post("/:id/read", markRead);
router.patch("/:id/settings", validate(conversationSettingsSchema), updateMySettings);
router.post("/:id/clear", clearChat);
router.put("/:id/disappearing", validate(disappearingSchema), setDisappearing);

router.get("/:id/messages", validate(messagesQuerySchema, "query"), getMessages);
router.get("/:id/messages/search", validate(searchMessagesSchema, "query"), searchMessages);
router.get("/:id/media", validate(mediaQuerySchema, "query"), getMedia);
router.post("/:id/messages", messageLimiter, validate(sendMessageSchema), sendMessage);

router.get("/:id/scheduled", listScheduled);
router.post("/:id/scheduled", messageLimiter, validate(scheduleMessageSchema), createScheduled);

export default router;
