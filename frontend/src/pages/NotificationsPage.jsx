import { useEffect, useCallback } from "react";
import { apiFetch } from "../api";
import { getSocket } from "../socket";
import Avatar from "../components/Avatar.jsx";
import { timeAgo } from "../utils";
import { useCursorPagination } from "../hooks/useCursorPagination.js";

export default function NotificationsPage({ currentUser, onProfileClick }) {

  const notifFetchFn = useCallback(
    (cursor) =>
      apiFetch(`/api/notifications?limit=20${cursor ? `&cursor=${cursor}` : ""}`),

    [currentUser?.uid]
  );

  const {
    items: notifs,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    reset,
    sentinelRef,
  } = useCursorPagination(notifFetchFn);

  useEffect(() => {
    if (!currentUser) return;
    apiFetch("/api/notifications/mark-read", { method: "PUT" }).catch(() => { });
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser) return;
    let sock;
    getSocket().then((s) => {
      sock = s;
      s.on("notification", (notif) => {

        reset();
        apiFetch("/api/notifications/mark-read", { method: "PUT" }).catch(() => { });
      });
    });

    return () => {
      if (sock) sock.off("notification");
    };
  }, [currentUser, reset]);

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

      {notifs.length === 0 && !hasMore ? (
        <div className="empty-state">
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
          <h3>No notifications yet</h3>
          <p>When someone likes or comments on your posts, you'll see it here.</p>
        </div>
      ) : (
        <>
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


          {hasMore && (
            <div ref={sentinelRef} style={{ height: 1 }} />
          )}


          {loadingMore && (
            <div className="loading-spinner" style={{ padding: "12px 0", fontSize: 13 }}>Loading more…</div>
          )}


          {error && !loadingMore && (
            <div className="load-more-retry">
              <span>Failed to load.</span>
              <button onClick={loadMore}>Tap to retry</button>
            </div>
          )}

        </>
      )}
    </div>
  );
}
