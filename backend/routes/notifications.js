const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const { authenticate } = require("../middleware/auth");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parseLimit(raw) {
  const n = parseInt(raw);
  if (!n || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

router.get("/", authenticate, async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const cursor = req.query.cursor || null;

    const query = { toUid: req.user.uid };
    if (cursor) query._id = { $lt: cursor };

    const notifs = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

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

    const nextCursor = notifs.length === limit ? notifs[notifs.length - 1]._id : null;
    const hasMore = notifs.length === limit;

    res.json({ data: unique, nextCursor, hasMore });
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
