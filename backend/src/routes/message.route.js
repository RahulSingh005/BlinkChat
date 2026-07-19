import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  clearChat,
  getMessages,
  getUsersForSidebar,
  sendMessage,
  toggleBlockUser,
} from "../controllers/message.controller.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);

router.get("/:id", protectRoute, getMessages);

router.post("/send/:id", protectRoute, sendMessage);

router.delete("/clear/:id", protectRoute, clearChat);
router.put("/block/:id", protectRoute, toggleBlockUser);

export default router;
