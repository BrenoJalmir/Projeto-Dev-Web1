const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const { users } = require("../utils/database");
const auth = require("../middleware/auth");
const router = express.Router();

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || "fallback_secret", {
    expiresIn: "7d",
  });
};

router.post(
  "/register",
  [
    body("username")
      .isLength({ min: 3, max: 30 })
      .withMessage("Username must be between 3 and 30 characters")
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage(
        "Username can only contain letters, numbers, and underscores"
      ),
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
    body("displayName")
      .isLength({ min: 1, max: 50 })
      .withMessage("Display name must be between 1 and 50 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation errors",
          errors: errors.array(),
        });
      }

      const { username, email, password, displayName } = req.body;

      const existingUser =
        users.getByEmail(email) || users.getByUsername(username);
      if (existingUser) {
        return res.status(400).json({
          message:
            existingUser.email === email
              ? "Email is already registered"
              : "Username is already taken",
        });
      }

      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);
      const verificationToken = crypto.randomBytes(32).toString("hex");

      const user = users.create({
        username,
        email,
        password: hashedPassword,
        displayName,
        verificationToken,
        isVerified: false,
        avatar: "",
        bio: "",
        location: "",
        joinDate: new Date().toISOString(),
      });

      const token = generateToken(user.id);

      const { password: _, verificationToken: __, ...userResponse } = user;

      res.status(201).json({
        message: "User registered successfully",
        token,
        user: userResponse,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Server error during registration" });
    }
  }
);

router.post(
  "/login",
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation errors",
          errors: errors.array(),
        });
      }

      const { email, password } = req.body;

      const user = users.getByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = generateToken(user.id);

      const {
        password: _,
        verificationToken: __,
        resetPasswordToken: ___,
        ...userResponse
      } = user;

      res.json({
        message: "Login successful",
        token,
        user: userResponse,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Server error during login" });
    }
  }
);

router.get("/me", auth, async (req, res) => {
  try {
    const user = users.getById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const {
      password: _,
      verificationToken: __,
      resetPasswordToken: ___,
      ...userResponse
    } = user;

    res.json({ user: userResponse });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/logout", auth, (req, res) => {
  res.json({ message: "Logout successful" });
});

router.post(
  "/forgot-password",
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation errors",
          errors: errors.array(),
        });
      }

      const { email } = req.body;
      const user = users.getByEmail(email);

      if (!user) {
        return res.json({
          message:
            "If an account with that email exists, a reset link has been sent",
        });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      users.update(user.id, {
        resetPasswordToken: resetToken,
        resetPasswordExpires: Date.now() + 3600000,
      });

      res.json({
        message: "Password reset link sent to your email",
        resetToken,
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/reset-password",
  [
    body("token").notEmpty().withMessage("Reset token is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation errors",
          errors: errors.array(),
        });
      }

      const { token, password } = req.body;

      const allUsers = users.getAll();
      const user = allUsers.find(
        (u) =>
          u.resetPasswordToken === token && u.resetPasswordExpires > Date.now()
      );

      if (!user) {
        return res
          .status(400)
          .json({ message: "Invalid or expired reset token" });
      }

      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);

      users.update(user.id, {
        password: hashedPassword,
        resetPasswordToken: undefined,
        resetPasswordExpires: undefined,
      });

      const authToken = generateToken(user.id);

      res.json({
        message: "Password reset successful",
        token: authToken,
      });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/verify-email",
  [body("token").notEmpty().withMessage("Verification token is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation errors",
          errors: errors.array(),
        });
      }

      const { token } = req.body;

      const allUsers = users.getAll();
      const user = allUsers.find((u) => u.verificationToken === token);

      if (!user) {
        return res.status(400).json({ message: "Invalid verification token" });
      }

      users.update(user.id, {
        isVerified: true,
        verificationToken: undefined,
      });

      res.json({ message: "Email verified successfully" });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/change-password",
  auth,
  [
    body("currentPassword")
      .notEmpty()
      .withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters long"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation errors",
          errors: errors.array(),
        });
      }

      const { currentPassword, newPassword } = req.body;
      const user = users.getById(req.user.userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isCurrentPasswordValid) {
        return res
          .status(400)
          .json({ message: "Current password is incorrect" });
      }

      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      users.update(user.id, { password: hashedPassword });

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
