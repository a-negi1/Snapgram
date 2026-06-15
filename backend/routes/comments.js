const express = require("express");
const router = express.Router();
const Comment = require("../models/Comment");
const Post = require("../models/Post");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { authenticate } = require("../middleware/auth");

function getThumbURL(post) {
  if (!post.imageURL) return null;
  if (post.mediaType !== "video") return post.imageURL;
  return post.imageURL
    .replace("/video/upload/", "/video/upload/so_0,f_jpg/")
    .replace(/\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i, ".jpg");
}



router.get("/:postId", authenticate, async (req, res) => {
  try {
    const comments = await Comment.find({ postId: req.params.postId })
      .sort({ createdAt: 1 })
      .limit(50);
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





router.post("/:postId", authenticate, async (req, res) => {
  try {
    const { text, username, photoURL } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Comment text required" });

    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const comment = await Comment.create({
      postId: req.params.postId,
      uid: req.user.uid,
      username: username || "user",
      photoURL: photoURL || "",
      text: text.trim(),
    });

    

    const updatedPost = await Post.findByIdAndUpdate(
      req.params.postId,
      { $inc: { commentCount: 1 } },
      { new: true }
    );

    

    req.app.io.emit("new-comment", {
      postId: req.params.postId,
      comment,
      commentCount: updatedPost.commentCount,
    });

    

    if (post.uid !== req.user.uid) {
      const me = await User.findOne({ uid: req.user.uid });
      const notif = await Notification.create({
        toUid: post.uid,
        fromUid: req.user.uid,
        fromUsername: me?.username || username || "user",
        fromPhotoURL: me?.photoURL || "",
        type: "comment",
        postId: post._id,
        postImageURL: getThumbURL(post),
        commentText: text.trim(),
      });
      req.app.io.to(post.uid).emit("notification", notif);
    }

    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
