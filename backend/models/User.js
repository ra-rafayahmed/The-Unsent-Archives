const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    username: { 
      type: String, 
      required: true, 
      unique: true, 
      trim: true,
      minlength: 3, 
      maxlength: 30, 
      match: /^[a-zA-Z0-9_]+$/ 
    },
    email: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true,
      match: /^\S+@\S+\.\S+$/ 
    },
    passwordHash: { 
      type: String, 
      required: true, 
      select: false 
    },
    avatarUrl: { 
      type: String, 
      default: "" 
    },
    bio: { 
      type: String, 
      maxlength: 300, 
      default: "" 
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    profile: {
      displayName: { type: String, maxlength: 50 },
      location:    { type: String, maxlength: 100 },
      website:     { type: String, maxlength: 200 },
    },
    tagInterests: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tag" }],
  },
  { timestamps: true }
);

// Pre-save hook: hash password before saving to DB
userSchema.pre("save", async function (next) {
  if (!this.isModified("passwordHash")) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

// Instance method: compare password
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

// Indexes
userSchema.index({ username: "text", email: 1 });

module.exports = mongoose.model("User", userSchema);
