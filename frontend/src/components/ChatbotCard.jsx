import { useState, useRef, useEffect, useCallback } from "react";
import { apiFetch } from "../api";

const BOT_AVATAR = "✨";


const PAGE_LABELS = {
  home: "📰 Home Feed",
  explore: "🔍 Explore",
  reels: "🎬 Reels",
  profile: "👤 Profile",
  notifications: "🔔 Notifications",
};

const GREETING = {
  role: "assistant",
  content: "Hey! I'm Snap ✨ your AI assistant for Snapgram. Ask me anything — or click 📸 to share your screen with me so I can see exactly what you're looking at!",
  isLocal: true,
};

function TypingDots() {
  return (
    <div className="chatbot-typing">
      <span /><span /><span />
    </div>
  );
}

function ChatMessage({ msg }) {
  const isBot = msg.role === "assistant";
  return (
    <div className={`chatbot-msg-row ${isBot ? "chatbot-msg-row--bot" : "chatbot-msg-row--user"}`}>
      {isBot && <div className="chatbot-bot-avatar">{BOT_AVATAR}</div>}
      <div className={`chatbot-bubble ${isBot ? "chatbot-bubble--bot" : "chatbot-bubble--user"}`}>
        {msg.screenshotThumb && (
          <img
            src={msg.screenshotThumb}
            alt="screenshot"
            className="chatbot-screenshot-thumb"
          />
        )}
        {msg.content}
      </div>
    </div>
  );
}

async function captureScreenshot() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Screen capture isn't supported in this browser. Try Chrome or Edge.");
  }


  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      displaySurface: "browser",
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 1 },
    },
    audio: false,
    preferCurrentTab: true,
  }).catch((err) => {
    if (err.name === "NotAllowedError") {
      throw new Error("Permission denied. Allow screen sharing when the browser asks, then try again.");
    }
    throw err;
  });

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;

    const cleanup = () => stream.getTracks().forEach((t) => t.stop());

    video.addEventListener("loadedmetadata", () => {
      video.play().then(() => {

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            try {
              const scale = 0.55;
              const canvas = document.createElement("canvas");
              canvas.width = Math.round(video.videoWidth * scale);
              canvas.height = Math.round(video.videoHeight * scale);
              canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
              cleanup();
              resolve(canvas.toDataURL("image/jpeg", 0.72));
            } catch (e) {
              cleanup();
              reject(e);
            }
          });
        });
      }).catch((e) => { cleanup(); reject(e); });
    });

    video.addEventListener("error", (e) => { cleanup(); reject(e); });
  });
}


export default function ChatbotCard({ open, onClose, isMobile, activePost, page, pageContext }) {

  const [messages, setMessages] = useState([GREETING]);
  const [apiHistory, setApiHistory] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState(null);

  const [pendingScreenshot, setPendingScreenshot] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);


  useEffect(() => {
    if (!open) setPendingScreenshot(null);
  }, [open]);

  const handleScreenshot = useCallback(async () => {
    if (capturing || loading) return;
    setCapturing(true);
    setError(null);
    try {
      const dataURL = await captureScreenshot();
      setPendingScreenshot(dataURL);

      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err) {
      console.error("[chatbot] screenshot error:", err);
      setError("Couldn't capture screenshot. Try again.");
    } finally {
      setCapturing(false);
    }
  }, [capturing, loading]);

  async function sendMessage(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;


    const userMsg = {
      role: "user",
      content: text,
      ...(pendingScreenshot ? { screenshotThumb: pendingScreenshot } : {}),
    };
    const apiUserMsg = { role: "user", content: text };
    const newApiHistory = [...apiHistory, apiUserMsg];

    setMessages((prev) => [...prev, userMsg]);
    setApiHistory(newApiHistory);
    setInput("");
    setLoading(true);
    setError(null);


    const screenshotToSend = pendingScreenshot;
    setPendingScreenshot(null);

    try {
      const body = { messages: newApiHistory };


      if (activePost?.imageURL && activePost.mediaType !== "video") {
        body.imageURL = activePost.imageURL;
      } else if (screenshotToSend) {
        body.screenshotDataURL = screenshotToSend;
      }

      if (pageContext) {
        body.pageContext = pageContext;
      }

      const { reply } = await apiFetch("/api/chatbot/chat", {
        method: "POST",
        body: JSON.stringify(body),
      });

      const botMsg = { role: "assistant", content: reply };
      setMessages((prev) => [...prev, botMsg]);
      setApiHistory((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setError("Failed to get response. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  if (!open) return null;

  const hasImagePost = activePost && activePost.mediaType !== "video";
  const pageLabel = PAGE_LABELS[page] || "Snapgram";
  const contextLabel = hasImagePost
    ? `📷 Seeing post by @${activePost.username || "user"}`
    : pageLabel;

  return (
    <>
      {isMobile && <div className="chatbot-backdrop" onClick={onClose} />}

      <div className={`chatbot-card ${isMobile ? "chatbot-card--mobile" : "chatbot-card--desktop"}`}>

        <div className="chatbot-header">
          <div className="chatbot-header-left">
            <div className="chatbot-header-avatar">✨</div>
            <div>
              <div className="chatbot-header-name">Snap AI</div>
              <div
                className="chatbot-context-badge"
                title={hasImagePost ? `Seeing: ${activePost.caption || activePost.username}` : `Currently on: ${pageLabel}`}
              >
                {hasImagePost && activePost.imageURL && (
                  <img
                    src={activePost.imageURL}
                    alt=""
                    className="chatbot-context-thumb"
                  />
                )}
                {contextLabel}
              </div>
            </div>
          </div>
          <button className="chatbot-close-btn" onClick={onClose} aria-label="Close chatbot">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="chatbot-messages">
          {messages.map((msg, i) => (
            <ChatMessage key={i} msg={msg} />
          ))}
          {loading && (
            <div className="chatbot-msg-row chatbot-msg-row--bot">
              <div className="chatbot-bot-avatar">{BOT_AVATAR}</div>
              <TypingDots />
            </div>
          )}
          {error && (
            <div className="chatbot-error">{error}</div>
          )}
          <div ref={bottomRef} />
        </div>

        { }
        {pendingScreenshot && (
          <div className="chatbot-screenshot-preview">
            <img src={pendingScreenshot} alt="screenshot preview" />
            <div className="chatbot-screenshot-preview-label">
              📸 Screenshot ready — type your question and send
            </div>
            <button
              className="chatbot-screenshot-remove"
              onClick={() => setPendingScreenshot(null)}
              title="Remove screenshot"
            >
              ✕
            </button>
          </div>
        )}

        <form className="chatbot-input-row" onSubmit={sendMessage}>
          { }
          <button
            type="button"
            className={`chatbot-screenshot-btn ${capturing ? "chatbot-screenshot-btn--busy" : ""} ${pendingScreenshot ? "chatbot-screenshot-btn--active" : ""}`}
            onClick={handleScreenshot}
            disabled={capturing || loading}
            title={capturing ? "Capturing…" : "Share screen with Snap AI"}
            aria-label="Capture screenshot"
          >
            {capturing ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10" style={{ animation: "spin 1s linear infinite" }} />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            )}
          </button>

          <textarea
            ref={inputRef}
            className="chatbot-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              pendingScreenshot
                ? "Ask about your screen…"
                : hasImagePost
                  ? "Ask about this post or anything…"
                  : `Ask Snap AI about ${pageLabel}…`
            }
            rows={1}
            maxLength={500}
            disabled={loading}
          />
          <button
            type="submit"
            className="chatbot-send-btn"
            disabled={!input.trim() || loading}
            aria-label="Send message"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}
