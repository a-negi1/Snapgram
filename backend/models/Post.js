const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, index: true },
    username: { type: String, required: true },
    photoURL: { type: String, default: "" },
    imageURL: { type: String, default: "" },   

    mediaType: { type: String, enum: ["image", "video"], default: "image" },
    caption: { type: String, default: "" },
    likes: { type: [String], default: [] },     

    likeCount: { type: Number, default: 0 },
    savedBy: { type: [String], default: [] },   

    commentCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);



postSchema.index({ uid: 1, createdAt: -1 });


postSchema.index({ likeCount: -1 });

module.exports = mongoose.model("Post", postSchema);
