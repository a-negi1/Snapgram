import { useState, useEffect, useRef } from "react";
import { apiFetch } from "../api";
import { getSocket } from "../socket";
import { timeAgo } from "../utils";
import Avatar from "./Avatar";
import { HeartIcon, CommentIcon, ShareIcon, BookmarkIcon, TrashIcon } from "./Icons";

export default function PostCard({ post, currentUser, currentUserProfile, onProfileClick, onPostDeleted }) {
  const [liked, setLiked] = useState(post.likes?.includes(currentUser?.uid));
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [saved, setSaved] = useState(post.savedBy?.includes(currentUser?.uid));
  const [comment, setComment] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [shareCopied, setShareCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount || 0);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const videoRef = useRef(null);

  function handlePlayClick(e) {
    e.stopPropagation();
    setVideoPlaying(true);
    setTimeout(() => videoRef.current?.play(), 50);
  }

  const isOwner = currentUser?.uid === post.uid;

  

  useEffect(() => {
    let sock;
    let mounted = true;

    getSocket().then((s) => {
      if (!mounted) return;
      sock = s;

      function onPostUpdated({ postId, likeCount: newCount, likes }) {
        if (postId === post._id?.toString() || postId === post._id) {
          setLikeCount(newCount);
          setLiked(likes?.includes(currentUser?.uid) ?? false);
        }
      }
      function onNewComment({ postId, commentCount: newCount }) {
        if (postId === post._id?.toString() || postId === post._id) {
          setCommentCount(newCount);
        }
      }

      s.on("post-updated", onPostUpdated);
      s.on("new-comment", onNewComment);

      

      sock._postHandlers = sock._postHandlers || {};
      sock._postHandlers[post._id] = { onPostUpdated, onNewComment };
    });

    return () => {
      mounted = false;
      if (sock) {
        const h = sock._postHandlers?.[post._id];
        if (h) {
          sock.off("post-updated", h.onPostUpdated);
          sock.off("new-comment", h.onNewComment);
          delete sock._postHandlers[post._id];
        }
      }
    };
  }, [post._id, currentUser?.uid]);


  async function toggleLike() {
    if (!currentUser) return;
    

    const nowLiked = !liked;
    setLiked(nowLiked);
    setLikeCount((c) => c + (nowLiked ? 1 : -1));
    try {
      await apiFetch(`/api/posts/${post._id}/like`, { method: "POST" });
    } catch {
      

      setLiked(!nowLiked);
      setLikeCount((c) => c + (nowLiked ? -1 : 1));
    }
  }

  async function toggleSave() {
    if (!currentUser) return;
    setSaved((s) => !s);
    try {
      await apiFetch(`/api/posts/${post._id}/save`, { method: "POST" });
    } catch {
      setSaved((s) => !s);
    }
  }

  async function postComment() {
    if (!comment.trim() || !currentUser) return;
    const text = comment.trim();
    setComment("");
    try {
      await apiFetch(`/api/comments/${post._id}`, {
        method: "POST",
        body: JSON.stringify({
          text,
          username: currentUserProfile?.username || currentUser.displayName || "user",
          photoURL: currentUserProfile?.photoURL || "",
        }),
      });
      if (showComments) setTimeout(loadComments, 300);
    } catch (e) {
      alert("Failed to post comment: " + e.message);
    }
  }

  async function loadComments() {
    try {
      const data = await apiFetch(`/api/comments/${post._id}`);
      setComments(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function deletePost() {
    if (!window.confirm("Delete this post?")) return;
    try {
      await apiFetch(`/api/posts/${post._id}`, { method: "DELETE" });
      if (onPostDeleted) onPostDeleted(post._id);
    } catch {
      alert("Failed to delete post.");
    }
  }

  async function handleShare() {
    const url = post.imageURL || window.location.href;
    const text = post.caption ? `${post.username}: "${post.caption}"` : `Check this post by ${post.username} on Snapgram`;
    if (navigator.share) {
      try { await navigator.share({ title: "Snapgram Post", text, url }); return; }
      catch {  }
    }
    setShowShareMenu((v) => !v);
  }

  async function copyLink() {
    const url = post.imageURL || window.location.href;
    try { await navigator.clipboard.writeText(url); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = url; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setShareCopied(true); setShowShareMenu(false);
    setTimeout(() => setShareCopied(false), 2500);
  }

  function shareToWhatsApp() {
    const txt = encodeURIComponent(`${post.caption ? post.caption + " — " : ""}${post.imageURL || window.location.href}`);
    window.open(`https://wa.me/?text=${txt}`, "_blank");
    setShowShareMenu(false);
  }

  function shareToTwitter() {
    const txt = encodeURIComponent(post.caption || "Check this post on Snapgram");
    const url = encodeURIComponent(post.imageURL || window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${txt}&url=${url}`, "_blank");
    setShowShareMenu(false);
  }

  function openComments() { setShowComments(true); loadComments(); }

  return (
    <>
      <div className="post-card">
        <div className="post-header">
          <div onClick={() => onProfileClick(post.uid)} style={{ cursor: "pointer" }}>
            <Avatar src={post.photoURL} name={post.username} size={36} />
          </div>
          <span className="post-username" onClick={() => onProfileClick(post.uid)} style={{ flex: 1 }}>{post.username}</span>
          <span className="post-time" style={{ marginRight: isOwner ? 10 : 0 }}>{timeAgo(post.createdAt)}</span>
          {isOwner && (
            <button className="post-menu-btn" onClick={deletePost} style={{ color: "var(--red)" }} title="Delete Post">
              <TrashIcon />
            </button>
          )}
        </div>

        {post.imageURL ? (
          post.mediaType === "video" ? (
            <div className="post-video-wrapper" onDoubleClick={toggleLike}>
              <video
                ref={videoRef}
                src={post.imageURL}
                className="post-video"
                preload="metadata"
                loop
                playsInline
                controls={videoPlaying}
              />
              {!videoPlaying && (
                <div className="video-play-overlay" onClick={handlePlayClick}>
                  <div className="video-play-btn">
                    <svg viewBox="0 0 24 24" fill="white" width="38" height="38">
                      <circle cx="12" cy="12" r="12" fill="rgba(0,0,0,0.55)" />
                      <polygon points="9.5,7 18,12 9.5,17" fill="white" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <img
              src={post.imageURL}
              alt=""
              className="post-image"
              onDoubleClick={toggleLike}
              onError={(e) => { e.target.style.display = "none"; }}
            />
          )
        ) : (
          <div className="post-image-placeholder" onDoubleClick={toggleLike}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}

        <div className="post-actions">
          <button className={`action-btn ${liked ? "liked" : ""}`} onClick={toggleLike} title="Like">
            <HeartIcon filled={liked} />
          </button>
          <button className="action-btn" onClick={openComments} title="Comment">
            <CommentIcon />
          </button>
          <div style={{ position: "relative" }}>
            <button className={`action-btn ${shareCopied ? "share-copied" : ""}`} onClick={handleShare} title="Share">
              {shareCopied ? <CheckIcon /> : <ShareIcon />}
            </button>
            {showShareMenu && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => setShowShareMenu(false)} />
                <div className="share-menu">
                  <button className="share-menu-item" onClick={copyLink}><LinkIcon /> Copy link</button>
                  <button className="share-menu-item" onClick={shareToWhatsApp}><WhatsAppIcon /> WhatsApp</button>
                  <button className="share-menu-item" onClick={shareToTwitter}><XIcon /> X (Twitter)</button>
                </div>
              </>
            )}
          </div>
          <button className={`action-btn save-btn ${saved ? "saved" : ""}`} onClick={toggleSave} title={saved ? "Unsave" : "Save"}>
            <BookmarkIcon filled={saved} />
          </button>
        </div>

        {shareCopied && <div className="share-toast">Link copied!</div>}
        {likeCount > 0 && (
          <div className="post-likes">{likeCount.toLocaleString()} {likeCount === 1 ? "like" : "likes"}</div>
        )}
        {post.caption && (
          <div className="post-caption">
            <strong onClick={() => onProfileClick(post.uid)}>{post.username}</strong>{" "}{post.caption}
          </div>
        )}
        {commentCount > 0 && (
          <button className="post-comments-link" onClick={openComments}>View all {commentCount} comments</button>
        )}
        <div className="comment-input-row">
          <input className="comment-input" placeholder="Add a comment…"
            value={comment} onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && postComment()} />
          <button className={`comment-post-btn ${comment.trim() ? "active" : ""}`} onClick={postComment}>Post</button>
        </div>
      </div>

      {}
      {showComments && (
        <div className="modal-overlay" onClick={() => setShowComments(false)}>
          <div className="comments-modal" onClick={(e) => e.stopPropagation()}>
            {post.imageURL && (
              <div className="comments-modal-image">
                {post.mediaType === "video" ? (
                  <video src={post.imageURL} controls loop muted playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : (
                  <img src={post.imageURL} alt="post" />
                )}
              </div>
            )}
            <div className="comments-modal-right">
              <div className="post-header" style={{ borderBottom: "1px solid var(--border)" }}>
                <Avatar src={post.photoURL} name={post.username} size={32} />
                <span className="post-username" style={{ fontSize: 14 }}>{post.username}</span>
              </div>
              <div className="comments-list">
                {post.caption && (
                  <div className="comment-item">
                    <Avatar src={post.photoURL} name={post.username} size={28} />
                    <div>
                      <div className="comment-text"><strong>{post.username}</strong> {post.caption}</div>
                      <div className="comment-meta">{timeAgo(post.createdAt)}</div>
                    </div>
                  </div>
                )}
                {comments.map((c) => (
                  <div key={c._id} className="comment-item">
                    <Avatar src={c.photoURL} name={c.username} size={28} />
                    <div>
                      <div className="comment-text"><strong>{c.username}</strong> {c.text}</div>
                      <div className="comment-meta">{timeAgo(c.createdAt)}</div>
                    </div>
                  </div>
                ))}
                {comments.length === 0 && !post.caption && (
                  <div style={{ color: "var(--dark-gray)", fontSize: 14, textAlign: "center", padding: "20px 0" }}>
                    No comments yet. Be the first!
                  </div>
                )}
              </div>
              <div className="comment-input-row">
                <input className="comment-input" placeholder="Add a comment…"
                  value={comment} onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") postComment(); }} />
                <button className={`comment-post-btn ${comment.trim() ? "active" : ""}`} onClick={postComment}>Post</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CheckIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>; }
function LinkIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>; }
function WhatsAppIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>; }
function XIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>; }
