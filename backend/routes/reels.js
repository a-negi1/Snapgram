const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { Types: { ObjectId } } = mongoose;
const Reel = require("../models/Reel");
const { authenticate } = require("../middleware/auth");

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 30;

function parseLimit(raw) {
  const n = parseInt(raw);
  if (!n || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function encodeCursor(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeCursor(raw) {
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function buildScoringStages() {
  return [
    {
      $addFields: {
        ageHours: {
          $divide: [{ $subtract: [new Date(), "$createdAt"] }, 3_600_000],
        },
      },
    },
    {
      $addFields: {
        engagementScore: {
          $add: [
            { $multiply: ["$likeCount", 1] },
            { $multiply: ["$commentCount", 2] },
          ],
        },
      },
    },
    {
      $addFields: {
        timePenalty: {
          $multiply: [
            { $add: ["$ageHours", 2] },
            { $sqrt: { $add: ["$ageHours", 2] } },
          ],
        },
      },
    },
    {
      $addFields: {
        feedScore: {
          $cond: {
            if: { $gt: ["$timePenalty", 0] },
            then: { $divide: ["$engagementScore", "$timePenalty"] },
            else: 0,
          },
        },
      },
    },
  ];
}

function buildCursorStage(cursorData) {
  if (!cursorData) return null;
  const { score: lastScore, date: lastDate, id: lastId } = cursorData;
  return {
    $match: {
      $or: [
        { feedScore: { $lt: lastScore } },
        { feedScore: lastScore, createdAt: { $lt: new Date(lastDate) } },
        { feedScore: lastScore, createdAt: new Date(lastDate), _id: { $lt: new ObjectId(lastId) } },
      ],
    },
  };
}

router.get("/feed", authenticate, async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const cursorData = decodeCursor(req.query.cursor || "");

    const pipeline = [...buildScoringStages()];

    const cursorStage = buildCursorStage(cursorData);
    if (cursorStage) pipeline.push(cursorStage);

    pipeline.push({ $sort: { feedScore: -1, createdAt: -1, _id: -1 } });
    pipeline.push({ $limit: limit });
    pipeline.push({ $project: { ageHours: 0, engagementScore: 0, timePenalty: 0 } });

    const data = await Reel.aggregate(pipeline);

    let nextCursor = null;
    if (data.length === limit) {
      const last = data[data.length - 1];
      nextCursor = encodeCursor({ score: last.feedScore, date: last.createdAt, id: String(last._id) });
    }

    const hasMore = data.length === limit;
    data.forEach((d) => delete d.feedScore);

    res.json({ data, nextCursor, hasMore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/explore", authenticate, async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const cursorData = decodeCursor(req.query.cursor || "");

    const pipeline = [...buildScoringStages()];

    const cursorStage = buildCursorStage(cursorData);
    if (cursorStage) pipeline.push(cursorStage);

    pipeline.push({ $sort: { feedScore: -1, createdAt: -1, _id: -1 } });
    pipeline.push({ $limit: limit });
    pipeline.push({ $project: { ageHours: 0, engagementScore: 0, timePenalty: 0 } });

    const data = await Reel.aggregate(pipeline);

    let nextCursor = null;
    if (data.length === limit) {
      const last = data[data.length - 1];
      nextCursor = encodeCursor({ score: last.feedScore, date: last.createdAt, id: String(last._id) });
    }

    const hasMore = data.length === limit;
    data.forEach((d) => delete d.feedScore);

    res.json({ data, nextCursor, hasMore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/user/:uid", authenticate, async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const cursor = req.query.cursor || null;

    const query = { uid: req.params.uid };

    if (cursor) query._id = { $lt: new ObjectId(cursor) };

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
