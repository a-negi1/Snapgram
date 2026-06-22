const express = require("express");
const router = express.Router();
const Reel = require("../models/Reel");
const { authenticate } = require("../middleware/auth");

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 30;

function parseLimit(raw) {
  const n = parseInt(raw);
  if (!n || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

router.get("/feed", authenticate, async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const cursor = req.query.cursor || null;

    const query = {};
    if (cursor) query._id = { $lt: cursor };

    const data = await Reel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    const nextCursor = data.length === limit ? data[data.length - 1]._id : null;
    const hasMore = data.length === limit;

    res.json({ data, nextCursor, hasMore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/explore", authenticate, async (req, res) => {
  try {
    const reels = await Reel.find().sort({ likeCount: -1 }).limit(20);
    res.json(reels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/user/:uid", authenticate, async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const cursor = req.query.cursor || null;

    const query = { uid: req.params.uid };
    if (cursor) query._id = { $lt: cursor };

    const data = await Reel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    const nextCursor = data.length === limit ? data[data.length - 1]._id : null;
    const hasMore = data.length === limit;

    res.json({ data, nextCursor, hasMore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", authenticate, async (req, res) => {
  try {
    const { videoURL, caption, username, photoURL } = req.body;
    if (!videoURL) return res.status(400).json({ error: "videoURL is required" });

    const reel = await Reel.create({
      uid: req.user.uid,
      username: username || "user",
      photoURL: photoURL || "",
      videoURL,
      caption: caption?.trim() || "",
    });

    res.status(201).json(reel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/like", authenticate, async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) return res.status(404).json({ error: "Reel not found" });

    const uid = req.user.uid;
    const alreadyLiked = reel.likes.includes(uid);

    if (alreadyLiked) {
      reel.likes.pull(uid);
      reel.likeCount = Math.max(0, reel.likeCount - 1);
    } else {
      reel.likes.addToSet(uid);
      reel.likeCount = reel.likes.length;
    }

    await reel.save();

    req.app.io.emit("reel-updated", {
      reelId: reel._id.toString(),
      likeCount: reel.likeCount,
      likes: reel.likes,
    });

    res.json({ liked: !alreadyLiked, likeCount: reel.likeCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", authenticate, async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) return res.status(404).json({ error: "Reel not found" });
    if (reel.uid !== req.user.uid) return res.status(403).json({ error: "Forbidden" });

    await reel.deleteOne();

    req.app.io.emit("reel-deleted", { reelId: req.params.id });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
