const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const Groq = require("groq-sdk");

const MODEL = "llama-3.1-8b-instant";

const SYSTEM_PROMPT = `You are Snap, a friendly and helpful AI assistant for Snapgram — a social media platform similar to Instagram.
You help users with:
- Discovering content and exploring the feed
- Tips on creating great posts, reels, and stories
- Understanding features like likes, comments, follows, and notifications
- General questions about social media and photography
- Creative caption ideas and hashtag suggestions
Keep responses concise, friendly, and engaging. Use occasional emojis to feel more social.`;

router.post("/chat", authenticate, async (req, res) => {

  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === "your_groq_api_key_here") {
    return res.status(500).json({ error: "Chatbot is not configured on the server." });
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const validRoles = ["user", "assistant"];
    const cleanMessages = messages
      .filter((m) => m && validRoles.includes(m.role) && typeof m.content === "string" && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content.trim() }));

    while (cleanMessages.length > 0 && cleanMessages[0].role === "assistant") {
      cleanMessages.shift();
    }

    if (cleanMessages.length === 0) {
      return res.status(400).json({ error: "No valid user messages found" });
    }

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...cleanMessages.slice(-20),
      ],
      temperature: 0.7,
      max_tokens: 512,
    });

    const reply = completion.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";
    res.json({ reply });

  } catch (err) {
    console.error("[chatbot] error:", err?.message || err);
    res.status(500).json({ error: "Failed to get AI response. Please try again." });
  }
});

module.exports = router;

