const express = require("express");
const router = express.Router();
const Story = require("../models/Story");
const User = require("../models/User");
const { authenticate } = require("../middleware/auth");

router.get("/", authenticate, async (req, res) => {
  try {

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const me = await User.findOne({ uid: req.user.uid });
    const allowedUids = [req.user.uid, ...(me?.following || [])];

    const stories = await Story.find({
      createdAt: { $gte: since },
      uid: { $in: allowedUids },
    }).sort({ createdAt: -1 });

    const grouped = {};
    stories.forEach((s) => {
      if (!grouped[s.uid]) {
        grouped[s.uid] = { uid: s.uid, username: s.username, photoURL: s.photoURL, stories: [] };
      }
      grouped[s.uid].stories.push(s);
    });

const arr = Object.values(grouped).sort((a, b) => {
      if (a.uid === req.user.uid) return -1;
      if (b.uid === req.user.uid) return 1;
      return 0;
    });

    res.json(arr);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", authenticate, async (req, res) => {
  try {
    const { imageURL, username, photoURL } = req.body;
    if (!imageURL) return res.status(400).json({ error: "imageURL is required" });
    const story = await Story.create({
      uid: req.user.uid,
      username: username || "user",
      photoURL: photoURL || "",
      imageURL,
    });

    const me = await User.findOne({ uid: req.user.uid });
    const recipients = [req.user.uid, ...(me?.followers || [])];
    recipients.forEach((uid) => {
      req.app.io.to(uid).emit("new-story", {
        uid: story.uid,
        username: story.username,
        photoURL: story.photoURL,
        story,
      });
    });

    res.status(201).json(story);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
