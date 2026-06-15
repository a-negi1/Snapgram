const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    toUid: { type: String, required: true, index: true },
    fromUid: { type: String, required: true },
    fromUsername: { type: String, required: true },
    fromPhotoURL: { type: String, default: "" },
    type: { type: String, enum: ["like", "comment", "follow"], required: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", default: null },
    postImageURL: { type: String, default: null },
    commentText: { type: String, default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ toUid: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
