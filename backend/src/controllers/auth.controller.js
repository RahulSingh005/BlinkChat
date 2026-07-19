import { generateToken, generateOtp } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";
import { OAuth2Client } from "google-auth-library";
import { sendOtpEmail } from "../lib/mailer.js";

const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Shape the user object the same way everywhere so the frontend always
// receives the fields it needs (fullName, about, phone, createdAt, etc.)
// right away — previously signup/login only returned a partial object,
// which is why parts of the app (like the Profile page) looked broken
// until the page was refreshed.
const sanitizeUser = (user) => ({
  _id: user._id,
  fullName: user.fullName,
  email: user.email,
  profilePic: user.profilePic,
  about: user.about,
  phone: user.phone,
  authProvider: user.authProvider,
  blockedUsers: user.blockedUsers,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const signup = async (req, res) => {
  const { fullName, email, password } = req.body;
  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({ email });

    if (user) return res.status(400).json({ message: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
    });

    if (newUser) {
      // generate jwt token here
      generateToken(newUser._id, res);
      await newUser.save();

      res.status(201).json(sanitizeUser(newUser));
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.log("Error in signup controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (user.authProvider === "google" && !user.password) {
      return res.status(400).json({
        message: "This account uses Google sign-in. Please continue with Google.",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    generateToken(user._id, res);

    res.status(200).json(sanitizeUser(user));
  } catch (error) {
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const logout = (req, res) => {
  try {
    // Must match the attributes used when the cookie was set (SameSite,
    // Secure), or some browsers treat this as a different cookie and won't
    // actually clear the original session.
    const isProd = process.env.NODE_ENV === "production";
    res.cookie("jwt", "", {
      maxAge: 0,
      httpOnly: true,
      sameSite: isProd ? "None" : "Lax",
      secure: isProd,
    });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Sign in / sign up with a Google ID token obtained on the client via
// Google Identity Services. If no account exists yet for the verified
// email, one is created automatically (with a random password so the
// schema's `password` requirement is still satisfied).
export const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: "Missing Google credential" });
    }

    if (!googleClient) {
      console.log("GOOGLE_CLIENT_ID is not set in the backend .env file");
      return res.status(500).json({
        message: "Google sign-in isn't configured on the server yet",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload?.email) {
      return res.status(400).json({ message: "Could not verify Google account" });
    }

    const { email, name, picture, sub: googleId } = payload;

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (!user) {
      const randomPassword = await bcrypt.hash(
        `${googleId}-${Date.now()}-${Math.random()}`,
        10
      );

      user = await User.create({
        fullName: name || email.split("@")[0],
        email,
        password: randomPassword,
        profilePic: picture || "",
        authProvider: "google",
        googleId,
      });
    } else if (!user.googleId) {
      // Existing local account with a matching email — link the Google
      // identity so either sign-in method works going forward.
      user.googleId = googleId;
      if (!user.profilePic && picture) user.profilePic = picture;
      await user.save();
    }

    generateToken(user._id, res);

    res.status(200).json(sanitizeUser(user));
  } catch (error) {
    console.log("Error in googleAuth controller", error.message);
    res.status(500).json({ message: "Google sign-in failed. Please try again." });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic, removeProfilePic, fullName, about, phone } = req.body;
    const userId = req.user._id;

    const update = {};

    if (profilePic) {
      const uploadResponse = await cloudinary.uploader.upload(profilePic);
      update.profilePic = uploadResponse.secure_url;
    } else if (removeProfilePic) {
      update.profilePic = "";
    }

    if (typeof fullName === "string" && fullName.trim()) {
      update.fullName = fullName.trim();
    }

    if (typeof about === "string") {
      update.about = about.slice(0, 150);
    }

    if (typeof phone === "string") {
      update.phone = phone.trim();
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const updatedUser = await User.findByIdAndUpdate(userId, update, {
      new: true,
    }).select("-password");

    res.status(200).json(sanitizeUser(updatedUser));
  } catch (error) {
    console.log("error in update profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const checkAuth = (req, res) => {
  try {
    res.status(200).json(sanitizeUser(req.user));
  } catch (error) {
    console.log("Error in checkAuth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// --- Forgot password (OTP-based) -----------------------------------------

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });

    // Always respond with the same generic message so this endpoint can't
    // be used to check which emails have an account.
    const genericResponse = {
      message: "If an account exists for that email, a verification code has been sent.",
    };

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    const otp = generateOtp();
    const salt = await bcrypt.genSalt(10);
    user.resetPasswordOtp = await bcrypt.hash(otp, salt);
    user.resetPasswordOtpExpiry = new Date(Date.now() + OTP_TTL_MS);
    user.resetPasswordVerified = false;
    await user.save();

    await sendOtpEmail(user.email, otp);

    res.status(200).json(genericResponse);
  } catch (error) {
    console.log("Error in forgotPassword controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and code are required" });
    }

    const user = await User.findOne({ email }).select(
      "+resetPasswordOtp +resetPasswordOtpExpiry"
    );

    if (!user || !user.resetPasswordOtp || !user.resetPasswordOtpExpiry) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    if (user.resetPasswordOtpExpiry.getTime() < Date.now()) {
      return res.status(400).json({ message: "This code has expired. Please request a new one." });
    }

    const isMatch = await bcrypt.compare(otp, user.resetPasswordOtp);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect code. Please try again." });
    }

    user.resetPasswordVerified = true;
    await user.save();

    res.status(200).json({ message: "Code verified" });
  } catch (error) {
    console.log("Error in verifyResetOtp controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ message: "Email and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({ email }).select(
      "+resetPasswordVerified +resetPasswordOtpExpiry"
    );

    if (!user || !user.resetPasswordVerified) {
      return res.status(400).json({ message: "Please verify the code sent to your email first" });
    }

    if (user.resetPasswordOtpExpiry && user.resetPasswordOtpExpiry.getTime() < Date.now()) {
      return res.status(400).json({ message: "Your verification has expired. Please start again." });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordOtp = null;
    user.resetPasswordOtpExpiry = null;
    user.resetPasswordVerified = false;
    await user.save();

    res.status(200).json({ message: "Password reset successfully. You can now log in." });
  } catch (error) {
    console.log("Error in resetPassword controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
