const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { Types: { ObjectId } } = mongoose;
const Comment = require("../models/Comment");
const Post = require("../models/Post");
const Reel = require("../models/Reel");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { authenticate } = require("../middleware/auth");
const Groq = require("groq-sdk");


const GUARD_CATEGORIES = {
  S1:  "violent crimes",
  S2:  "non-violent crimes",
  S3:  "sex crimes",
  S4:  "child exploitation",
  S5:  "defamation",
  S6:  "specialized advice",
  S7:  "privacy violations",
  S8:  "intellectual property",
  S9:  "weapons",
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


async function moderateWithLLM(groq, text) {
  const SYSTEM = `You are a content moderator for Snapgram, a social media platform.

Your job is to block genuinely harmful content while ALLOWING free expression, criticism, and debate.

BLOCK only comments that contain:
- Racial, ethnic, or religious slurs (e.g. the n-word, f-slur, etc.)
- Direct threats of violence (e.g. "I will hurt you")
- Targeted personal harassment — repeated insults aimed at a specific person with no other content
- Sexually explicit or graphic content
- Pure abuse with zero substance (e.g. "fuck you", "go die", "kill yourself")

ALLOW — even if negative or harsh:
- Criticism of someone's work, photo, video, or post (e.g. "this is terrible", "bad lighting", "cringe content")
- Constructive feedback (e.g. "the framing is off, you should try X")
- Strong opinions and disagreement (e.g. "I hate this style", "worst reel I've seen")
- Frustration expressed about content, not a person (e.g. "this is trash", "absolute garbage")
- Mild swearing that is not directed as an attack (e.g. "what the hell", "this is bullshit")
- Sarcasm, blunt reviews, and negative reactions to content

Key rule: Is the comment attacking CONTENT/IDEAS, or attacking a PERSON with no substance?
Content attacks = allow. Personal attacks with slurs or pure abuse = block.

Respond with EXACTLY one of:
safe
unsafe: <brief plain-language reason>`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Comment to moderate: "${text}"` },
    ],
    max_tokens: 40,
    temperature: 0,
  });

  const verdict = completion.choices[0]?.message?.content?.trim().toLowerCase() || "safe";
  if (verdict.startsWith("safe")) return { safe: true };

  const reason = verdict.replace(/^unsafe[:\s]*/i, "").trim() || "inappropriate content";
  return { safe: false, reasons: [reason] };
}


async function moderateText(text) {
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === "your_groq_api_key_here") {
    return { safe: true };
  }
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    return await moderateWithLLM(groq, text);
  } catch (err) {
    console.error("[comment-moderation] Groq error:", err?.message || err);
    return { safe: true };
  }
}

function getThumbURL(post) {
  if (!post.imageURL) return null;
  if (post.mediaType !== "video") return post.imageURL;
  return post.imageURL
    .replace("/video/upload/", "/video/upload/so_0,f_jpg/")
    .replace(/\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i, ".jpg");
}

router.get("/:postId", authenticate, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const cursor = req.query.cursor || null;

    const query = { postId: req.params.postId };
    if (cursor) {
      query._id = { $lt: new ObjectId(cursor) };
    }

    const data = await Comment.find(query)
      .sort({ createdAt: cursor ? -1 : 1 })
      .limit(limit);

    const ordered = cursor ? data.reverse() : data;

    const nextCursor = data.length === limit ? ordered[0]._id : null;
    const hasMore = data.length === limit;

    res.json({ data: ordered, nextCursor, hasMore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:postId", authenticate, async (req, res) => {
  try {
    const { text, username, photoURL } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Comment text required" });

    
    const modResult = await moderateText(text.trim());
    if (!modResult.safe) {
      const reasonStr = modResult.reasons.join(", ") || "policy violation";
      return res.status(422).json({
        error: `Comment blocked — flagged for ${reasonStr}.`,
        reasons: modResult.reasons,
      });
    }

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

router.get("/reel/:reelId", authenticate, async (req, res) => {
  try {
    const comments = await Comment.find({ reelId: req.params.reelId })
      .sort({ createdAt: 1 })
      .limit(100);
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/reel/:reelId", authenticate, async (req, res) => {
  try {
    const { text, username, photoURL } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Comment text required" });

    
    const modResult = await moderateText(text.trim());
    if (!modResult.safe) {
      const reasonStr = modResult.reasons.join(", ") || "policy violation";
      return res.status(422).json({
        error: `Comment blocked — flagged for ${reasonStr}.`,
        reasons: modResult.reasons,
      });
    }

    const reel = await Reel.findById(req.params.reelId);
    if (!reel) return res.status(404).json({ error: "Reel not found" });

    const comment = await Comment.create({
      reelId: req.params.reelId,
      uid: req.user.uid,
      username: username || "user",
      photoURL: photoURL || "",
      text: text.trim(),
    });

    const updatedReel = await Reel.findByIdAndUpdate(
      req.params.reelId,
      { $inc: { commentCount: 1 } },
      { new: true }
    );

    req.app.io.emit("reel-comment", {
      reelId: req.params.reelId,
      comment,
      commentCount: updatedReel.commentCount,
    });

    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
