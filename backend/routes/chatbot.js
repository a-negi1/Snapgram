const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const Groq = require("groq-sdk");


function stripThink(text) {
  if (!text) return "";

  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");

  cleaned = cleaned.replace(/<think>[\s\S]*/gi, "");
  return cleaned.trim();
}

const { GROQ_FAST_MODEL, GROQ_VISION_MODEL } = require("../config/models");

const SYSTEM_PROMPT = `You are Snap, a friendly and helpful AI assistant for Snapgram — a social media platform similar to Instagram.

Snapgram has the following pages/sections:
- **Home (Feed)**: The main feed showing posts from people the user follows, plus Stories at the top.
- **Explore**: A grid of trending posts from all users, plus a user search bar to find people by username.
- **Reels**: A vertical full-screen reel/short-video feed, similar to TikTok or Instagram Reels.
- **Profile**: A user's profile page showing their avatar, bio, follower/following counts, and a grid of their posts, reels, and saved posts.
- **Notifications**: A list of recent activity — likes, comments, and new followers.

Features available to all users:
- Creating posts (photos/videos) and reels
- Liking, commenting, and saving posts
- Following/unfollowing other users
- Editing their own profile (avatar, bio, username, display name)
- Real-time notifications via push and in-app alerts

You help users with anything related to Snapgram:
- Navigating and using any feature on any page
- Tips for creating great posts, reels, and stories
- Growing followers and engagement
- Creative caption ideas and hashtag suggestions
- Troubleshooting issues on any page
- General social media and photography advice

**CRITICAL VISUAL RULES — follow these strictly:**
- You can ONLY describe visual content when an actual image or screenshot has been explicitly attached to the current message.
- NEVER invent, fabricate, or guess at visual content. Only describe exactly what you observe.
- When a screenshot of the app is provided, describe what you see on the actual screen accurately.
- When an individual post image is provided, describe that specific image.
- If NO image is attached and the user asks what you see — honestly say you have no visual and suggest they try again (the screenshot capture button 📸 will attach the current screen).

Keep responses concise, friendly, and engaging. Use occasional emojis to feel more social.`;


function isValidImageSrc(src) {
  if (typeof src !== "string") return false;
  return src.startsWith("http") || src.startsWith("data:image/");
}

router.post("/chat", authenticate, async (req, res) => {

  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === "your_groq_api_key_here") {
    return res.status(500).json({ error: "Chatbot is not configured on the server." });
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  try {



    const { messages, imageURL, screenshotDataURL, pageContext } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }


    const validRoles = ["user", "assistant"];
    const cleanMessages = messages
      .filter((m) => m && validRoles.includes(m.role) && m.content && m.content !== "")
      .map((m) => {
        const content = typeof m.content === "string" ? m.content.trim() : String(m.content).trim();
        return { role: m.role, content };
      })
      .filter((m) => m.content.length > 0);


    while (cleanMessages.length > 0 && cleanMessages[0].role === "assistant") {
      cleanMessages.shift();
    }

    if (cleanMessages.length === 0) {
      return res.status(400).json({ error: "No valid user messages found" });
    }



    const activeImageSrc = isValidImageSrc(imageURL) ? imageURL
      : isValidImageSrc(screenshotDataURL) ? screenshotDataURL
        : null;

    const hasImage = activeImageSrc !== null;
    const isScreenshot = hasImage && !isValidImageSrc(imageURL) && isValidImageSrc(screenshotDataURL);


    const historySlice = cleanMessages.slice(-20);
    let model = hasImage ? GROQ_VISION_MODEL : GROQ_FAST_MODEL;

    if (hasImage) {

      const lastIdx = historySlice.length - 1;
      if (historySlice[lastIdx].role === "user") {
        historySlice[lastIdx] = {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: activeImageSrc },
            },
            {
              type: "text",
              text: historySlice[lastIdx].content,
            },
          ],
        };
      }
    }


    const systemMessages = [{ role: "system", content: SYSTEM_PROMPT }];

    if (hasImage) {
      const imageLabel = isScreenshot
        ? "a full screenshot of the user's current Snapgram screen"
        : "the specific post image the user has in focus";
      systemMessages.push({
        role: "system",
        content: `[Image attached] The vision model has been activated. You are looking at ${imageLabel}. Describe ONLY what you actually see — do not fabricate or guess at anything not visible.`,
      });
    } else {
      systemMessages.push({
        role: "system",
        content: "[No image attached] No image or screenshot has been provided this turn. You cannot see the user's screen. If asked about visual content, honestly say you have no visual context and suggest they use the 📸 screenshot button to share their screen.",
      });
    }

    if (pageContext && typeof pageContext === "string" && pageContext.trim().length > 0) {
      systemMessages.push({
        role: "system",
        content: `[Current page context]\n${pageContext.trim()}`,
      });
    }

    const completion = await groq.chat.completions.create({
      model,
      messages: [
        ...systemMessages,
        ...historySlice,
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const reply = stripThink(completion.choices?.[0]?.message?.content) || "Sorry, I couldn't generate a response.";
    res.json({ reply });

  } catch (err) {
    console.error("[chatbot] error:", err?.message || err);
    res.status(500).json({ error: "Failed to get AI response. Please try again." });
  }
});

module.exports = router;
