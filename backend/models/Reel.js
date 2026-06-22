const mongoose = require("mongoose");

const reelSchema = new mongoose.Schema(
  {
    uid:          { type: String, required: true, index: true },
    username:     { type: String, required: true },
    photoURL:     { type: String, default: "" },
    videoURL:     { type: String, required: true },
    caption:      { type: String, default: "" },
    likes:        { type: [String], default: [] },
    likeCount:    { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

reelSchema.index({ uid: 1, createdAt: -1 });
reelSchema.index({ likeCount: -1 });

module.exports = mongoose.model("Reel", reelSchema);
