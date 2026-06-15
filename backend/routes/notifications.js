const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const { authenticate } = require("../middleware/auth");





router.get("/", authenticate, async (req, res) => {
  try {
    const notifs = await Notification.find({ toUid: req.user.uid })
      .sort({ createdAt: -1 })
      .limit(200);

    // Deduplicate like notifications: keep only the latest per (fromUid, postId)
    const seen = new Set();
    const toDelete = [];
    const unique = [];
    for (const n of notifs) {
      if (n.type === "like" && n.postId) {
        const key = `${n.fromUid}::${n.postId}`;
        if (seen.has(key)) {
          toDelete.push(n._id);
        } else {
          seen.add(key);
          unique.push(n);
        }
      } else {
        unique.push(n);
      }
    }
    if (toDelete.length > 0) {
      await Notification.deleteMany({ _id: { $in: toDelete } });
    }

    res.json(unique.slice(0, 50));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





router.get("/unread-count", authenticate, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      toUid: req.user.uid,
      read: false,
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





router.put("/mark-read", authenticate, async (req, res) => {
  try {
    await Notification.updateMany(
      { toUid: req.user.uid, read: false },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
