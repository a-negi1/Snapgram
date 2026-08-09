/**
 * Centralised Groq model names.
 *
 * Swap a model for the entire app by setting the matching env var in .env —
 * no source-code changes required.
 *
 * GROQ_FAST_MODEL   — lightweight text model used for chat and content
 *                     moderation (comment + image-guard stage 2).
 *                     Replaced llama-3.1-8b-instant (deprecated Aug 2026).
 *
 * GROQ_VISION_MODEL — multimodal model used for image captioning and the
 *                     vision-describe stage of image moderation.
 */
module.exports = {
  GROQ_FAST_MODEL:   process.env.GROQ_FAST_MODEL   || "openai/gpt-oss-20b",
  GROQ_VISION_MODEL: process.env.GROQ_VISION_MODEL || "qwen/qwen3.6-27b",
};
