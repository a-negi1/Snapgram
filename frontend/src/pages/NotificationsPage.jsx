import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import { getSocket } from "../socket";
import Avatar from "../components/Avatar.jsx";
import { timeAgo } from "../utils";

export default function NotificationsPage({ currentUser, onProfileClick }) {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    

    apiFetch("/api/notifications")
      .then((data) => {
        setNotifs(data);
        setLoading(false);
        

        apiFetch("/api/notifications/mark-read", { method: "PUT" }).catch(() => {});
      })
      .catch(() => setLoading(false));

    

    let sock;
    getSocket().then((s) => {
      sock = s;
      s.on("notification", (notif) => {
        setNotifs((prev) => {
          // Remove any existing notif with same fromUid + type + postId to avoid duplicates
          const filtered = prev.filter(
            (n) => !(n.fromUid === notif.fromUid && n.type === notif.type && String(n.postId) === String(notif.postId))
          );
          return [{ ...notif, read: true }, ...filtered];
        });
        

        apiFetch("/api/notifications/mark-read", { method: "PUT" }).catch(() => {});
      });
    });

    return () => {
      if (sock) sock.off("notification");
    };
  }, [currentUser]);


  function notifText(n) {
    if (n.type === "like") return "liked your post.";
    if (n.type === "comment") return `commented: "${n.commentText || ""}"`;
    if (n.type === "follow") return "started following you.";
    return "";
  }

  if (loading) return <div className="loading-spinner">Loading notifications…</div>;

  return (
    <div className="notif-page">
      <div className="notif-header-row">
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Notifications</h2>
      </div>

      {notifs.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
          <h3>No notifications yet</h3>
          <p>When someone likes or comments on your posts, you'll see it here.</p>
        </div>
      ) : (
        <div className="notif-list">
          {notifs.map((n) => (
            <div key={n._id} className={`notif-item ${!n.read ? "notif-unread" : ""}`}>
              <div style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => onProfileClick(n.fromUid)}>
                <Avatar src={n.fromPhotoURL} name={n.fromUsername} size={44} />
              </div>
              <div className="notif-body">
                <span className="notif-username" onClick={() => onProfileClick(n.fromUid)}>{n.fromUsername}</span>
                {" "}
                <span className="notif-text">{notifText(n)}</span>
                <div className="notif-time">{timeAgo(n.createdAt)}</div>
              </div>
              {n.postImageURL && (
                <img
                  src={n.postImageURL}
                  alt=""
                  className="notif-thumb"
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              )}
              {!n.read && <div className="notif-dot-new" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
