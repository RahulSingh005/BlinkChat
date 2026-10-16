import express from "express";
import { getUser, listBlocked, searchUsers, toggleBlock } from "../controllers/user.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";
import { searchUsersSchema } from "../validation/schemas.js";

const router = express.Router();

router.use(protectRoute);
router.get("/search", validate(searchUsersSchema, "query"), searchUsers);
router.get("/blocked", listBlocked);
router.get("/:id", getUser);
router.put("/:id/block", toggleBlock);

export default router;
