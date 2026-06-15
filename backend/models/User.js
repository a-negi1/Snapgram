const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    displayName: { type: String, default: "" },
    bio: { type: String, default: "" },
    photoURL: { type: String, default: "" },
    followers: { type: [String], default: [] },  

    following: { type: [String], default: [] },  

  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
