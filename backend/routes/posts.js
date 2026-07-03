const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { Types: { ObjectId } } = mongoose;
const Post = require("../models/Post");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { authenticate } = require("../middleware/auth");
const Groq = require("groq-sdk");


router.post("/generate-caption", authenticate, async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "imageBase64 is required" });
    }

    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === "your_groq_api_key_here") {
      return res.status(500).json({ error: "GROQ_API_KEY is not configured on the server." });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Act as an expert social media manager. Analyze this image and write an engaging, catchy Instagram-style caption with relevant emojis and 3-5 popular hashtags. Return only the caption text, nothing else.",
            },
            {
              type: "image_url",
              image_url: { url: imageBase64 },
            },
          ],
        },
      ],
      max_tokens: 300,
      temperature: 0.85,
    });

    const caption = completion.choices[0]?.message?.content?.trim() || "";
    res.json({ caption });
  } catch (err) {
    console.error("Groq caption error:", err?.message || err);
    const status = err?.status === 401 ? 401 : 502;
    res.status(status).json({ error: "Caption generation failed: " + (err?.message || "Unknown error") });
  }
});

function getThumbURL(post) {
  if (!post.imageURL) return null;
  if (post.mediaType !== "video") return post.imageURL;

  return post.imageURL
    .replace("/video/upload/", "/video/upload/so_0,f_jpg/")
    .replace(/\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i, ".jpg");
}

function parseLimit(raw, defaultVal = 12, max = 30) {
  const n = parseInt(raw);
  if (!n || n < 1) return defaultVal;
  return Math.min(n, max);
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

router.get("/feed", authenticate, async (req, res) => {
  try {
    const me = await User.findOne({ uid: req.user.uid });
    const uids = [...new Set([req.user.uid, ...(me?.following || [])])].slice(0, 30);

    const limit = parseLimit(req.query.limit);
    const cursorParam = req.query.cursor || null;
    const cursorData = cursorParam ? decodeCursor(cursorParam) : null;

    const pipeline = [
      {
        $match: {
          uid: { $in: uids },
        },
      },
      {
        $addFields: {
          saveCount: { $size: "$savedBy" },
          ageHours: {
            $divide: [
              { $subtract: [new Date(), "$createdAt"] },
              3_600_000,
            ],
          },
        },
      },
      {
        $addFields: {
          engagementScore: {
            $add: [
              { $multiply: ["$likeCount", 1] },
              { $multiply: ["$commentCount", 2] },
              { $multiply: ["$saveCount", 3] },
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

    if (cursorData) {
      const { score: lastScore, date: lastDate, id: lastId } = cursorData;
      pipeline.push({
        $match: {
          $or: [
            { feedScore: { $lt: lastScore } },
            { feedScore: lastScore, createdAt: { $lt: new Date(lastDate) } },
            { feedScore: lastScore, createdAt: new Date(lastDate), _id: { $lt: new ObjectId(lastId) } },
          ],
        },
      });
    }

    pipeline.push({ $sort: { feedScore: -1, createdAt: -1, _id: -1 } });
    pipeline.push({ $limit: limit });
    pipeline.push({ $project: { ageHours: 0, engagementScore: 0, timePenalty: 0 } });

    const data = await Post.aggregate(pipeline);

    let nextCursor = null;
    if (data.length === limit) {
      const last = data[data.length - 1];
      nextCursor = encodeCursor({
        score: last.feedScore,
        date: last.createdAt,
        id: String(last._id),
      });
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
    const cursorParam = req.query.cursor || null;
    const cursorData = cursorParam ? decodeCursor(cursorParam) : null;

    const pipeline = [
      {
        $addFields: {
          saveCount: { $size: "$savedBy" },
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
              { $multiply: ["$saveCount", 3] },
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

    if (cursorData) {
      const { score: lastScore, date: lastDate, id: lastId } = cursorData;
      pipeline.push({
        $match: {
          $or: [
            { feedScore: { $lt: lastScore } },
            { feedScore: lastScore, createdAt: { $lt: new Date(lastDate) } },
            { feedScore: lastScore, createdAt: new Date(lastDate), _id: { $lt: new ObjectId(lastId) } },
          ],
        },
      });
    }

    pipeline.push({ $sort: { feedScore: -1, createdAt: -1, _id: -1 } });
    pipeline.push({ $limit: limit });
    pipeline.push({ $project: { ageHours: 0, engagementScore: 0, timePenalty: 0 } });

    const data = await Post.aggregate(pipeline);

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

router.get("/saved", authenticate, async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const cursor = req.query.cursor || null;

    const query = { savedBy: req.user.uid };

    if (cursor) query._id = { $lt: new ObjectId(cursor) };

    const data = await Post.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    const nextCursor = data.length === limit ? data[data.length - 1]._id : null;
    const hasMore = data.length === limit;

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

    const data = await Post.find(query)
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
    const { imageURL, caption, username, photoURL, mediaType } = req.body;
    if (!imageURL) return res.status(400).json({ error: "imageURL is required" });

    const post = await Post.create({
      uid: req.user.uid,
      username: username || "user",
      photoURL: photoURL || "",
      imageURL,
      mediaType: mediaType === "video" ? "video" : "image",
      caption: caption?.trim() || "",
    });

    const me = await User.findOne({ uid: req.user.uid });
    const followers = me?.followers || [];
    followers.forEach((followerUid) => {
      req.app.io.to(followerUid).emit("new-post", post);
    });

    req.app.io.to(req.user.uid).emit("new-post", post);

    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", authenticate, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.uid !== req.user.uid) return res.status(403).json({ error: "Forbidden" });
    await post.deleteOne();

    req.app.io.emit("post-deleted", { postId: req.params.id });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/like", authenticate, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const uid = req.user.uid;
    const alreadyLiked = post.likes.includes(uid);

    if (alreadyLiked) {
      post.likes.pull(uid);
      post.likeCount = Math.max(0, post.likeCount - 1);

      if (post.uid !== uid) {
        await Notification.deleteMany({
          toUid: post.uid,
          fromUid: uid,
          type: "like",
          postId: post._id,
        });
      }
    } else {
      post.likes.addToSet(uid);
      post.likeCount = post.likes.length;
      if (post.uid !== uid) {
        const me = await User.findOne({ uid });
        const notifFilter = { toUid: post.uid, fromUid: uid, type: "like", postId: post._id };

        await Notification.deleteMany(notifFilter);
        const notif = await Notification.create({
          toUid: post.uid,
          fromUid: uid,
          fromUsername: me?.username || req.body.username || "user",
          fromPhotoURL: me?.photoURL || "",
          type: "like",
          postId: post._id,
          postImageURL: getThumbURL(post),
          read: false,
        });
        req.app.io.to(post.uid).emit("notification", notif);
      }
    }
    await post.save();

    req.app.io.emit("post-updated", {
      postId: post._id.toString(),
      likeCount: post.likeCount,
      likes: post.likes,
    });

    res.json({ liked: !alreadyLiked, likeCount: post.likeCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/save", authenticate, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });
    const uid = req.user.uid;
    const alreadySaved = post.savedBy.includes(uid);
    if (alreadySaved) {
      post.savedBy.pull(uid);
    } else {
      post.savedBy.addToSet(uid);
    }
    await post.save();
    res.json({ saved: !alreadySaved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
