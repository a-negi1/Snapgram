const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: false, index: true },
    reelId: { type: mongoose.Schema.Types.ObjectId, ref: "Reel", required: false, index: true },
    uid: { type: String, required: true },
    username: { type: String, required: true },
    photoURL: { type: String, default: "" },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

commentSchema.index({ postId: 1, createdAt: 1 });
commentSchema.index({ reelId: 1, createdAt: 1 });

module.exports = mongoose.model("Comment", commentSchema);
