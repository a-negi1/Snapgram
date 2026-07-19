const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { Types: { ObjectId } } = mongoose;
const https = require("https");
const crypto = require("crypto");
const Post = require("../models/Post");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { authenticate } = require("../middleware/auth");
const Groq = require("groq-sdk");


function stripThink(text) {
  if (!text) return "";

  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");

  cleaned = cleaned.replace(/<think>[\s\S]*/gi, "");
  return cleaned.trim();
}


const GUARD_CATEGORIES = {
  S1: "violent crimes",
  S2: "non-violent crimes",
  S3: "sex crimes",
  S4: "child exploitation",
  S5: "defamation",
  S6: "specialized advice",
  S7: "privacy violations",
  S8: "intellectual property",
  S9: "weapons",
  S10: "hate speech",
  S11: "self-harm",
  S12: "sexual content",
  S13: "election interference",
};

function translateReasons(codeString) {
  if (!codeString) return [];
  return codeString
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => GUARD_CATEGORIES[c] || c);
}


function cloudinaryDelete(publicId) {
  return new Promise((resolve, reject) => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      console.warn("[moderate-image] Cloudinary creds missing — skipping delete of blocked image.");
      return resolve(false);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash("sha1").update(toSign).digest("hex");

    const body = JSON.stringify({ public_id: publicId, timestamp, api_key: apiKey, signature });

    const options = {
      hostname: "api.cloudinary.com",
      path: `/v1_1/${cloudName}/image/destroy`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.result === "ok");
        } catch {
          resolve(false);
        }
      });
    });
    req.on("error", (err) => {
      console.error("[cloudinaryDelete] error:", err.message);
      resolve(false);
    });
    req.write(body);
    req.end();
  });
}


function extractPublicId(imageURL) {

  try {
    const match = imageURL.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z]+)?$/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}


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
      model: "qwen/qwen3.6-27b",
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
      max_tokens: 1500,
      temperature: 0.85,
    });

    const caption = stripThink(completion.choices[0]?.message?.content) || "";
    res.json({ caption });
  } catch (err) {
    console.error("Groq caption error:", err?.message || err);
    const status = err?.status === 401 ? 401 : 502;
    res.status(status).json({ error: "Caption generation failed: " + (err?.message || "Unknown error") });
  }
});








router.post("/moderate-image", authenticate, async (req, res) => {
  const { imageURL } = req.body;
  if (!imageURL) return res.status(400).json({ error: "imageURL is required" });

  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === "your_groq_api_key_here") {

    return res.json({ safe: true });
  }

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });


    const descResult = await groq.chat.completions.create({
      model: "qwen/qwen3.6-27b",
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageURL } },
          {
            type: "text",
            text: "Describe this image in detail for content moderation. Include all people, objects, actions, weapons, nudity, violence, or sensitive content visible. Be specific and factual.",
          },
        ],
      }],
      max_tokens: 1200,
      temperature: 0,
    });

    const description = stripThink(descResult.choices[0]?.message?.content) || "";
    console.log("[moderate-image] vision description:", description);

    if (!description) {
      console.warn("[moderate-image] Empty description — blocking to be safe.");
      return res.status(422).json({
        safe: false,
        reasons: ["image could not be analysed"],
        error: "Image could not be analysed. Please try a different image.",
      });
    }




    const SYSTEM_PROMPT =
      "You are a strict content moderator for a social media platform.\n" +
      "Read the image description and decide if it is safe to post.\n\n" +
      "BLOCK (respond 'unsafe') if the description mentions ANY of:\n" +
      "- A firearm, rifle, handgun, shotgun, assault rifle, gun, or any weapon being held, aimed, or displayed\n" +
      "- Violence, blood, gore, or graphic bodily harm\n" +
      "- Nudity or sexually explicit content\n" +
      "- Sexual content involving minors\n" +
      "- Hate symbols or hate speech\n" +
      "- Self-harm or suicide depictions\n\n" +
      "CRITICAL RULE: Block ALL firearms with no exceptions — stock photos, cosplay, game props, " +
      "photoshoots, toys that look like real guns. Context does NOT matter. If it looks like a gun, block it.\n\n" +
      "Respond with EXACTLY:\n" +
      "safe\n" +
      "  OR\n" +
      "unsafe\n" +
      "<one short plain-English reason, e.g. 'assault rifle visible'>";

    const modResult = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "Image description:\n" + description },
      ],
      max_tokens: 60,
      temperature: 0,
    });

    const rawVerdict = modResult.choices[0]?.message?.content?.trim() || "";
    console.log("[moderate-image] classification verdict:", rawVerdict);

    const verdictLines = rawVerdict.split("\n").map((l) => l.trim());
    const isSafe = verdictLines[0]?.toLowerCase() === "safe";

    if (isSafe) {
      return res.json({ safe: true });
    }


    const reason = verdictLines[1] || "policy violation";
    console.warn("[moderate-image] BLOCKED —", reason);

    const publicId = extractPublicId(imageURL);
    if (publicId) {
      await cloudinaryDelete(publicId);
    }

    return res.status(422).json({
      safe: false,
      reasons: [reason],
      error: `Image blocked — ${reason}.`,
    });

  } catch (err) {
    console.error("[moderate-image] error:", err?.message || err);

    return res.status(422).json({
      safe: false,
      reasons: ["moderation check failed"],
      error: "Image could not be verified. Please try again or use a different image.",
    });
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
