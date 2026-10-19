import express from "express";
import {
  addMembers,
  clearChat,
  createGroup,
  createInvite,
  createScheduled,
  deleteChat,
  exportChat,
  getConversation,
  getMedia,
  getMessages,
  listConversations,
  listScheduled,
  markRead,
  openDirect,
  openSelf,
  pinMessage,
  removeMember,
  revokeInvite,
  searchMessages,
  sendMessage,
  setDisappearing,
  setMemberRole,
  unpinMessage,
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
  pinMessageSchema,
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
router.get("/self", openSelf);

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
router.get("/:id/export", exportChat);

router.post("/:id/pins", validate(pinMessageSchema), pinMessage);
router.delete("/:id/pins/:messageId", unpinMessage);

router.post("/:id/invite", createInvite);
router.delete("/:id/invite", revokeInvite);

router.get("/:id/messages", validate(messagesQuerySchema, "query"), getMessages);
router.get("/:id/messages/search", validate(searchMessagesSchema, "query"), searchMessages);
router.get("/:id/media", validate(mediaQuerySchema, "query"), getMedia);
router.post("/:id/messages", messageLimiter, validate(sendMessageSchema), sendMessage);

router.get("/:id/scheduled", listScheduled);
router.post("/:id/scheduled", messageLimiter, validate(scheduleMessageSchema), createScheduled);

export default router;
