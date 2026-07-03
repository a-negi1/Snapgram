import { useState, useRef, useEffect } from "react";
import { apiFetch } from "../api";

const BOT_AVATAR = "✨";


const GREETING = {
  role: "assistant",
  content: "Hey! I'm Snap ✨ your AI assistant for Snapgram. Ask me anything",
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
        {msg.content}
      </div>
    </div>
  );
}

export default function ChatbotCard({ open, onClose, isMobile }) {

  const [messages, setMessages] = useState([GREETING]);

  const [apiHistory, setApiHistory] = useState([]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
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

  async function sendMessage(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text };
    const newApiHistory = [...apiHistory, userMsg];


    setMessages((prev) => [...prev, userMsg]);
    setApiHistory(newApiHistory);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const { reply } = await apiFetch("/api/chatbot/chat", {
        method: "POST",
        body: JSON.stringify({

          messages: newApiHistory,
        }),
      });

      const botMsg = { role: "assistant", content: reply };
      setMessages((prev) => [...prev, botMsg]);
      setApiHistory((prev) => [...prev, botMsg]);
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

  return (
    <>

      {isMobile && <div className="chatbot-backdrop" onClick={onClose} />}

      <div className={`chatbot-card ${isMobile ? "chatbot-card--mobile" : "chatbot-card--desktop"}`}>

        <div className="chatbot-header">
          <div className="chatbot-header-left">
            <div className="chatbot-header-avatar">✨</div>
            <div>
              <div className="chatbot-header-name">Snap AI</div>
              <div className="chatbot-header-status">
                <span className="chatbot-status-dot" />
                Online
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

        <form className="chatbot-input-row" onSubmit={sendMessage}>
          <textarea
            ref={inputRef}
            className="chatbot-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Snap AI anything…"
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
