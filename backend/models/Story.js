const mongoose = require("mongoose");

const storySchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, index: true },
    username: { type: String, required: true },
    photoURL: { type: String, default: "" },
    imageURL: { type: String, required: true },

createdAt: { type: Date, default: Date.now, expires: 86400 },
  }
);

storySchema.index({ createdAt: -1 });

module.exports = mongoose.model("Story", storySchema);
