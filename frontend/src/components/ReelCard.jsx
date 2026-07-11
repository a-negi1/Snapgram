import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "../api";
import { timeAgo } from "../utils";
import { toast } from "../hooks/useToast";
import Avatar from "./Avatar";
import { HeartIcon, CommentIcon, ShareIcon, TrashIcon } from "./Icons";

export default function ReelCard({ reel, currentUser, currentUserProfile, onProfileClick, onReelDeleted, onLikeSync }) {
  const [liked, setLiked] = useState(reel.likes?.includes(currentUser?.uid));
  const [likeCount, setLikeCount] = useState(reel.likeCount || 0);
  const [commentCount, setCommentCount] = useState(reel.commentCount || 0);
  const [muted, setMuted] = useState(true);
  const [showMuteHint, setShowMuteHint] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [heartBurst, setHeartBurst] = useState(null);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);

  const videoRef = useRef(null);
  const cardRef = useRef(null);
  const lastTap = useRef(0);
  const muteTimer = useRef(null);

  const isOwner = currentUser?.uid === reel.uid;

  useEffect(() => {
    if (onLikeSync) {
      onLikeSync(reel._id, (newCount, newLikes, newCommentCount) => {
        if (newCount !== undefined) setLikeCount(newCount);
        if (newLikes !== undefined) setLiked(newLikes?.includes(currentUser?.uid) ?? false);
        if (newCommentCount !== undefined) setCommentCount(newCommentCount);
      });
    }
  }, [reel._id, currentUser?.uid]);

  useEffect(() => {
    const card = cardRef.current;
    const video = videoRef.current;
    if (!card || !video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
          video.play().catch(() => { });
        } else {
          video.pause();
        }
      },
      { threshold: 0.7 }
    );

    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  function handleVideoTap(e) {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      handleDoubleTap(e);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
      setTimeout(() => {
        if (Date.now() - lastTap.current >= 290) {
          const newMuted = !muted;
          setMuted(newMuted);
          if (videoRef.current) videoRef.current.muted = newMuted;
          setShowMuteHint(true);
          clearTimeout(muteTimer.current);
          muteTimer.current = setTimeout(() => setShowMuteHint(false), 900);
        }
      }, 300);
    }
  }

  function handleDoubleTap(e) {
    const rect = cardRef.current?.getBoundingClientRect();
    const x = e.clientX - (rect?.left || 0);
    const y = e.clientY - (rect?.top || 0);
    setHeartBurst({ x, y, key: Date.now() });
    setTimeout(() => setHeartBurst(null), 750);
    if (!liked) {
      toggleLike();
    }
  }

  async function toggleLike() {
    if (!currentUser) return;
    const nowLiked = !liked;
    setLiked(nowLiked);
    setLikeCount((c) => c + (nowLiked ? 1 : -1));
    try {
      await apiFetch(`/api/reels/${reel._id}/like`, { method: "POST" });
    } catch {
      setLiked(!nowLiked);
      setLikeCount((c) => c + (nowLiked ? -1 : 1));
    }
  }

  async function deleteReel() {
    if (!window.confirm("Delete this reel?")) return;
    try {
      await apiFetch(`/api/reels/${reel._id}`, { method: "DELETE" });
      if (onReelDeleted) onReelDeleted(reel._id);
    } catch {
      alert("Failed to delete reel.");
    }
  }

  async function handleShare() {
    const url = reel.videoURL || window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: "Snapgram Reel", text: reel.caption || "", url }); return; }
      catch { }
    }
    try { await navigator.clipboard.writeText(url); }
    catch { }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  async function openComments() {
    setShowComments(true);
    setCommentsLoading(true);
    try {
      const data = await apiFetch(`/api/comments/reel/${reel._id}`);
      setComments(data);
    } catch { }
    setCommentsLoading(false);
  }

  async function postComment() {
    if (!commentText.trim() || !currentUser || commentLoading) return;
    const text = commentText.trim();
    const toastId = toast.loading("Checking comment…");
    setCommentLoading(true);
    try {
      const newComment = await apiFetch(`/api/comments/reel/${reel._id}`, {
        method: "POST",
        body: JSON.stringify({
          text,
          username: currentUserProfile?.username || currentUser.displayName || "user",
          photoURL: currentUserProfile?.photoURL || "",
        }),
      });

      toast.dismiss(toastId);
      setCommentText("");
      setComments((prev) => [...prev, newComment]);
      setCommentCount((c) => c + 1);
    } catch (e) {
      if (e?.status === 422) {

        const reasonStr = (e.data?.reasons || []).join(", ") || "inappropriate content";
        toast.error(toastId, `Comment blocked — flagged for ${reasonStr}.`);
      } else {
        toast.error(toastId, "Failed to post comment. Please try again.");
      }
    } finally {
      setCommentLoading(false);
    }
  }

  const captionLong = reel.caption && reel.caption.length > 80;

  return (
    <>
      <div className="reel-card" ref={cardRef}>
        <video
          ref={videoRef}
          src={reel.videoURL}
          className="reel-video"
          loop
          muted={muted}
          playsInline
          preload="metadata"
          onClick={handleVideoTap}
        />

        <div className={`reel-mute-indicator ${showMuteHint ? "show" : ""}`}>
          {muted ? (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <line x1="23" y1="9" x2="17" y2="15" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <line x1="17" y1="9" x2="23" y2="15" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          )}
        </div>

        {heartBurst && (
          <div
            className="reel-heart-burst"
            key={heartBurst.key}
            style={{ left: heartBurst.x, top: heartBurst.y }}
          >
            ❤️
          </div>
        )}

        <div className="reel-actions">
          <button className={`reel-action-btn ${liked ? "liked" : ""}`} onClick={toggleLike}>
            <HeartIcon filled={liked} />
            <span className="reel-action-count">{likeCount > 0 ? likeCount : ""}</span>
          </button>

          <button className="reel-action-btn" onClick={openComments}>
            <CommentIcon />
            <span className="reel-action-count">{commentCount > 0 ? commentCount : ""}</span>
          </button>

          <button className="reel-action-btn" onClick={handleShare} title="Share">
            {shareCopied ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <ShareIcon />
            )}
            <span className="reel-action-count">{shareCopied ? "Copied!" : ""}</span>
          </button>

          {isOwner && (
            <button className="reel-action-btn" onClick={deleteReel} title="Delete">
              <TrashIcon />
            </button>
          )}
        </div>

        <div className="reel-info">
          <button
            className="reel-username"
            onClick={() => onProfileClick && onProfileClick(reel.uid)}
          >
            <Avatar src={reel.photoURL} name={reel.username} size={32} />
            <span>@{reel.username}</span>
          </button>
          {reel.caption && (
            <p
              className={`reel-caption ${captionExpanded ? "expanded" : ""}`}
              onClick={() => captionLong && setCaptionExpanded((v) => !v)}
            >
              {captionExpanded || !captionLong
                ? reel.caption
                : reel.caption.slice(0, 80) + "… "}
              {captionLong && !captionExpanded && (
                <span className="reel-caption-more">more</span>
              )}
            </p>
          )}
          <span className="reel-time">{timeAgo(reel.createdAt)}</span>
        </div>
      </div>

      {showComments && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 199, background: "rgba(0,0,0,0.5)" }}
            onClick={() => setShowComments(false)}
          />
          <div className="reel-comment-sheet">
            <div className="reel-comment-sheet-header">
              <span>Comments</span>
              <button className="modal-close" onClick={() => setShowComments(false)}>×</button>
            </div>
            <div className="comments-list reel-comments-list">
              {commentsLoading ? (
                <div style={{ color: "var(--dark-gray)", fontSize: 14, textAlign: "center", padding: "24px 0" }}>Loading…</div>
              ) : comments.length === 0 ? (
                <div style={{ color: "var(--dark-gray)", fontSize: 14, textAlign: "center", padding: "24px 0" }}>
                  No comments yet. Be the first!
                </div>
              ) : comments.map((c) => (
                <div key={c._id} className="comment-item">
                  <Avatar src={c.photoURL} name={c.username} size={28} />
                  <div>
                    <div className="comment-text"><strong>{c.username}</strong> {c.text}</div>
                    <div className="comment-meta">{timeAgo(c.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="comment-input-row">
              <input
                className="comment-input"
                placeholder="Add a comment…"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && postComment()}
                autoFocus
                disabled={commentLoading}
              />
              <button
                className={`comment-post-btn ${commentText.trim() ? "active" : ""}`}
                onClick={postComment}
                disabled={commentLoading}
              >
                Post
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
