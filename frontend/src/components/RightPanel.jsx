import { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { apiFetch } from "../api";
import Avatar from "./Avatar";

export default function RightPanel({ currentUser, currentUserProfile, onProfileClick, onSeeAll }) {
  const [suggestions, setSuggestions] = useState([]);
  const [followed, setFollowed] = useState(new Set());

  useEffect(() => {
    if (!currentUser) return;
    apiFetch("/api/users/suggestions")
      .then((users) => setSuggestions(users.slice(0, 5)))
      .catch(console.error);
  }, [currentUser, currentUserProfile?.following]);

  async function follow(user) {
    if (!currentUser) return;
    setFollowed((s) => new Set([...s, user._id]));
    try {
      await apiFetch(`/api/users/${user.uid}/follow`, { method: "POST" });
      setTimeout(() => setSuggestions((s) => s.filter((u) => u._id !== user._id)), 800);
    } catch (e) {
      console.error("Follow error:", e);
      setFollowed((s) => { const n = new Set(s); n.delete(user._id); return n; });
    }
  }

  return (
    <div className="right-panel">
      {currentUserProfile && (
        <div className="right-panel-user">
          <div style={{ cursor: "pointer" }} onClick={() => onProfileClick(currentUser?.uid)}>
            <Avatar src={currentUserProfile.photoURL} name={currentUserProfile.username} size={44} />
          </div>
          <div style={{ flex: 1, cursor: "pointer" }} onClick={() => onProfileClick(currentUser?.uid)}>
            <div className="right-username">{currentUserProfile.username}</div>
            <div className="right-name">{currentUserProfile.displayName}</div>
          </div>
          <button className="switch-btn" onClick={() => signOut(auth)}>Log out</button>
        </div>
      )}

      {suggestions.length > 0 && (
        <>
          <div className="suggestions-header">
            <span className="suggestions-label">Suggested For You</span>
            <button className="switch-btn" onClick={onSeeAll}>See All</button>
          </div>
          {suggestions.map((u) => (
            <div key={u._id} className="suggestion-item">
              <div style={{ cursor: "pointer" }} onClick={() => onProfileClick(u.uid)}>
                <Avatar src={u.photoURL} name={u.username} size={32} />
              </div>
              <div className="suggestion-info">
                <div className="suggestion-username" style={{ cursor: "pointer" }} onClick={() => onProfileClick(u.uid)}>
                  {u.username}
                </div>
                <div className="suggestion-sub">Suggested for you</div>
              </div>
              <button
                className="follow-link"
                onClick={() => follow(u)}
                disabled={followed.has(u._id)}
                style={{ opacity: followed.has(u._id) ? 0.5 : 1 }}
              >
                {followed.has(u._id) ? "Following" : "Follow"}
              </button>
            </div>
          ))}
        </>
      )}

      <div style={{ marginTop: 24, fontSize: 11, color: "var(--dark-gray)", lineHeight: 2 }}>
        About · Help · Press · API · Jobs · Privacy · Terms<br />
        © 2025 SNAPGRAM BY ADHEESH NEGI
      </div>
    </div>
  );
}
