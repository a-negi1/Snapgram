import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "../api";
import { getSocket } from "../socket";
import { uploadToCloudinary } from "../utils";
import PostCard from "../components/PostCard.jsx";
import Avatar from "../components/Avatar.jsx";
import { useCursorPagination } from "../hooks/useCursorPagination.js";


function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-header">
        <div className="skeleton-avatar" />
        <div className="skeleton-line" style={{ width: "40%", height: 12 }} />
      </div>
      <div className="skeleton-image" />
      <div className="skeleton-text">
        <div className="skeleton-line" style={{ width: "70%" }} />
        <div className="skeleton-line" style={{ width: "50%" }} />
      </div>
    </div>
  );
}

export default function FeedPage({ currentUser, currentUserProfile, onProfileClick }) {
  const [stories, setStories] = useState([]);
  const [uploadingStory, setUploadingStory] = useState(false);
  const [viewingGroup, setViewingGroup] = useState(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);

  const [seenStories, setSeenStories] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("seenStories") || "[]")); }
    catch { return new Set(); }
  });
  const storyTimerRef = useRef(null);
  const storyFileRef = useRef();
  const storiesBarRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false });


  const feedFetchFn = useCallback(
    (cursor) =>

      apiFetch(`/api/posts/feed?limit=12${cursor ? `&cursor=${cursor}` : ""}`),

    [currentUserProfile?.uid]
  );

  const {
    items: posts,
    loading,
    loadingMore,
    hasMore,
    error: feedError,
    loadMore,
    reset: resetFeed,
    sentinelRef,
  } = useCursorPagination(feedFetchFn);


  const [extraPosts, setExtraPosts] = useState([]);
  const [deletedPostIds, setDeletedPostIds] = useState(() => new Set());

  function handlePostDeleted(postId) {
    const id = String(postId);
    setDeletedPostIds((prev) => new Set([...prev, id]));
    setExtraPosts((prev) => prev.filter((p) => String(p._id) !== id));
  }

  const allPosts = [...extraPosts, ...posts]
    .reduce((acc, p) => {
      if (!acc.find((x) => x._id === p._id)) acc.push(p);
      return acc;
    }, [])
    .filter((p) => !deletedPostIds.has(String(p._id)));


  useEffect(() => {
    apiFetch("/api/stories")
      .then(setStories)
      .catch(console.error);
  }, [currentUserProfile?.uid]);

  useEffect(() => {
    setExtraPosts([]);
    setDeletedPostIds(new Set());
  }, [currentUserProfile?.uid]);

  useEffect(() => {
    if (!currentUser) return;
    let sock;

    getSocket().then((s) => {
      sock = s;

      s.on("new-post", (post) => {
        setExtraPosts((prev) => {
          if (prev.find((p) => p._id === post._id)) return prev;
          return [post, ...prev];
        });
      });

      s.on("post-deleted", ({ postId }) => {
        handlePostDeleted(postId);
      });

      s.on("post-updated", ({ postId, likeCount, likes }) => {
        setExtraPosts((prev) =>
          prev.map((p) => p._id === postId ? { ...p, likeCount, likes } : p)
        );
      });

      s.on("new-comment", ({ postId, commentCount }) => {
        setExtraPosts((prev) =>
          prev.map((p) => p._id === postId ? { ...p, commentCount } : p)
        );
      });

      s.on("new-story", ({ uid, username, photoURL, story }) => {
        setStories((prev) => {
          const copy = [...prev];
          const idx = copy.findIndex((g) => g.uid === uid);
          if (idx !== -1) {
            copy[idx] = { ...copy[idx], stories: [story, ...copy[idx].stories] };
          } else {
            const newGroup = { uid, username, photoURL, stories: [story] };
            if (uid === currentUser.uid) return [newGroup, ...copy];
            return [...copy, newGroup];
          }
          return copy;
        });
      });
    });

    return () => {
      if (sock) {
        sock.off("new-post");
        sock.off("post-deleted");
        sock.off("post-updated");
        sock.off("new-comment");
        sock.off("new-story");
      }
    };
  }, [currentUser]);

 
  useEffect(() => {
    if (!viewingGroup) return;
    setStoryProgress(0);
    const start = Date.now();
    clearInterval(storyTimerRef.current);
    storyTimerRef.current = setInterval(() => {
      const pct = Math.min(((Date.now() - start) / 5000) * 100, 100);
      setStoryProgress(pct);
      if (pct >= 100) {
        clearInterval(storyTimerRef.current);
        advanceStory(viewingGroup, storyIndex);
      }
    }, 50);
    return () => clearInterval(storyTimerRef.current);
  }, [viewingGroup, storyIndex]);

  function advanceStory(group, idx) {
    if (idx < group.stories.length - 1) setStoryIndex(idx + 1);
    else closeStory();
  }

  function closeStory() {
    clearInterval(storyTimerRef.current);
    setViewingGroup(null);
    setStoryIndex(0);
  }

  function openStory(group) {
    if (dragRef.current.moved) return;
    setViewingGroup(group);
    setStoryIndex(0);
    setSeenStories((prev) => {
      const next = new Set(prev);
      next.add(group.uid);
      try { localStorage.setItem("seenStories", JSON.stringify([...next])); } catch { }
      return next;
    });
  }

  
  function onBarMouseDown(e) {
    const bar = storiesBarRef.current;
    dragRef.current = { active: true, startX: e.pageX - bar.offsetLeft, scrollLeft: bar.scrollLeft, moved: false };
  }
  function onBarMouseMove(e) {
    if (!dragRef.current.active) return;
    e.preventDefault();
    const bar = storiesBarRef.current;
    const dx = e.pageX - bar.offsetLeft - dragRef.current.startX;
    if (Math.abs(dx) > 4) dragRef.current.moved = true;
    bar.scrollLeft = dragRef.current.scrollLeft - dx;
  }
  function onBarMouseUp() { dragRef.current.active = false; }
  function onBarMouseLeave() { dragRef.current.active = false; }

  async function handleAddStory(e) {
    const file = e.target.files[0];
    if (!file || !currentUser) return;
    setUploadingStory(true);
    try {
      const { url: imageURL } = await uploadToCloudinary(file);
      await apiFetch("/api/stories", {
        method: "POST",
        body: JSON.stringify({
          imageURL,
          username: currentUserProfile?.username || currentUser.displayName || "user",
          photoURL: currentUserProfile?.photoURL || "",
        }),
      });
    } catch (err) {
      alert("Story upload failed: " + err.message);
    }
    setUploadingStory(false);
    storyFileRef.current.value = "";
  }

  function stAgo(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    return `${Math.floor(s / 3600)}h`;
  }

  return (
    <div className="feed">
      {/* Stories bar */}
      <div className="stories-wrapper">
        <div
          className="stories-bar"
          ref={storiesBarRef}
          onMouseDown={onBarMouseDown}
          onMouseMove={onBarMouseMove}
          onMouseUp={onBarMouseUp}
          onMouseLeave={onBarMouseLeave}
        >
          <div className="story-item" onClick={() => storyFileRef.current.click()} style={{ opacity: uploadingStory ? 0.6 : 1 }}>
            <div className="story-add-ring">
              <div className="story-avatar-inner">
                <Avatar src={currentUserProfile?.photoURL} name={currentUserProfile?.username || "Me"} size={52} />
              </div>
              <div className="story-add-plus">{uploadingStory ? "…" : "+"}</div>
            </div>
            <span className="story-name">Your story</span>
          </div>
          <input ref={storyFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAddStory} />

          {stories.map((group) => {
            const isSeen = seenStories.has(group.uid);
            const isOwn = group.uid === currentUser?.uid;
            return (
              <div key={group.uid} className="story-item" onClick={() => openStory(group)}>
                <div className={`story-avatar-ring ${isOwn ? "story-own-ring" : ""} ${isSeen && !isOwn ? "story-seen" : ""}`}>
                  <div className="story-avatar-inner">
                    <Avatar src={group.photoURL} name={group.username} size={52} />
                  </div>
                </div>
                <span className="story-name">{isOwn ? "You" : group.username}</span>
              </div>
            );
          })}
          {stories.length === 0 && (
            <div style={{ color: "var(--dark-gray)", fontSize: 13, alignSelf: "center", paddingLeft: 8 }}>No stories yet</div>
          )}
        </div>
      </div>

      
      {loading ? (
        <div className="loading-spinner">Loading…</div>
      ) : allPosts.length === 0 && !hasMore ? (
        <div className="empty-state">
          <h3>Nothing here yet</h3>
          <p>Follow people to see their posts here.</p>
        </div>
      ) : (
        <>
          {allPosts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              currentUser={currentUser}
              currentUserProfile={currentUserProfile}
              onProfileClick={onProfileClick}
              onPostDeleted={handlePostDeleted}
            />
          ))}

          
          {hasMore && (
            <div ref={sentinelRef} style={{ height: 1 }} />
          )}


          {loadingMore && (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          )}


          {feedError && !loadingMore && (
            <div className="load-more-retry">
              <span>Failed to load.</span>
              <button onClick={loadMore}>Tap to retry</button>
            </div>
          )}

        </>
      )}


      {viewingGroup && (
        <div className="story-viewer-overlay" onClick={closeStory}>
          <div className="story-viewer" onClick={(e) => e.stopPropagation()}>
            <div className="story-progress-bars">
              {viewingGroup.stories.map((_, i) => (
                <div key={i} className="story-progress-track">
                  <div className="story-progress-fill" style={{
                    width: i < storyIndex ? "100%" : i === storyIndex ? `${storyProgress}%` : "0%"
                  }} />
                </div>
              ))}
            </div>
            <div className="story-viewer-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                onClick={() => { closeStory(); onProfileClick(viewingGroup.uid); }}>
                <Avatar src={viewingGroup.photoURL} name={viewingGroup.username} size={36} />
                <span style={{ color: "white", fontWeight: 700, fontSize: 14 }}>{viewingGroup.username}</span>
                <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
                  {stAgo(viewingGroup.stories[storyIndex]?.createdAt)} ago
                </span>
              </div>
              <button className="story-close-btn" onClick={closeStory}>×</button>
            </div>
            <img src={viewingGroup.stories[storyIndex]?.imageURL} alt="story" className="story-viewer-img" />
            <div className="story-tap-left" onClick={() => storyIndex > 0 ? setStoryIndex((i) => i - 1) : null} />
            <div className="story-tap-right" onClick={() => advanceStory(viewingGroup, storyIndex)} />
          </div>
        </div>
      )}
    </div>
  );
}
