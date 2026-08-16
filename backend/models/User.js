const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const config = require("../config");

// Cheap rounds under test keep the suite fast; production stays at 12.
const BCRYPT_ROUNDS = config.env === "test" ? 4 : 12;

const backupCodeSchema = new mongoose.Schema(
  {
    codeHash: { type: String, required: true },
    used: { type: Boolean, default: false },
    usedAt: { type: Date },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-zA-Z0-9_]+$/,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: /^\S+@\S+\.\S+$/,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    avatarUrl: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      maxlength: 300,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    profile: {
      displayName: { type: String, maxlength: 50 },
      location:    { type: String, maxlength: 100 },
      website:     { type: String, maxlength: 200 },
    },
    tagInterests: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tag" }],
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    // One-way hashed single-use recovery codes issued at registration.
    backupCodes: { type: [backupCodeSchema], select: false, default: [] },
    // Soft-moderation flags (used by admin/report flows).
    reportCount: { type: Number, default: 0 },
    isSuspended: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// TRIGGER: pre-save → hash password whenever it changes
userSchema.pre("save", async function (next) {
  if (!this.isModified("passwordHash")) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, BCRYPT_ROUNDS);
  next();
});

// TRIGGER: pre-save → keep email lowercased even on direct sets
userSchema.pre("save", function (next) {
  if (this.isModified("email") && this.email) {
    this.email = this.email.toLowerCase().trim();
  }
  next();
});

// Instance method: compare password
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

// Indexes
userSchema.index({ username: "text", email: 1 });

module.exports = mongoose.model("User", userSchema);
