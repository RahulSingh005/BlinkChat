import express from "express";
import {
  changePassword,
  checkAuth,
  deleteAccount,
  forgotPassword,
  getSession,
  googleAuth,
  login,
  logout,
  logoutAll,
  resetPassword,
  signup,
  updateProfile,
  verifyResetOtp,
} from "../controllers/auth.controller.js";
import { optionalAuth, protectRoute } from "../middleware/auth.middleware.js";
import { authLimiter, otpRequestLimiter, otpVerifyLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import {
  changePasswordSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  googleSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  updateProfileSchema,
  verifyOtpSchema,
} from "../validation/schemas.js";

const router = express.Router();

router.post("/signup", authLimiter, validate(signupSchema), signup);
router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/google", authLimiter, validate(googleSchema), googleAuth);
router.post("/logout", logout);

router.post("/forgot-password", otpRequestLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post("/verify-reset-otp", otpVerifyLimiter, validate(verifyOtpSchema), verifyResetOtp);
router.post("/reset-password", otpVerifyLimiter, validate(resetPasswordSchema), resetPassword);

router.get("/session", optionalAuth, getSession);
router.get("/check", protectRoute, checkAuth);
router.put("/profile", protectRoute, validate(updateProfileSchema), updateProfile);
router.put("/password", protectRoute, validate(changePasswordSchema), changePassword);
router.post("/logout-all", protectRoute, logoutAll);
router.delete("/account", protectRoute, validate(deleteAccountSchema), deleteAccount);

export default router;
