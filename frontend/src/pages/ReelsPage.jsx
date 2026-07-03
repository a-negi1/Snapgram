import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "../api";
import { getSocket } from "../socket";
import ReelCard from "../components/ReelCard";
import { useCursorPagination } from "../hooks/useCursorPagination.js";

export default function ReelsPage({ currentUser, currentUserProfile, onProfileClick }) {
  const syncCallbacks = useRef({});

  function registerSync(reelId, cb) {
    syncCallbacks.current[reelId] = cb;
  }

  const reelFetchFn = useCallback(
    (cursor) =>
      apiFetch(`/api/reels/feed?limit=10${cursor ? `&cursor=${cursor}` : ""}`),
    []
  );

  const {
    items: reels,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    sentinelRef,
  } = useCursorPagination(reelFetchFn);

  useEffect(() => {
    if (!currentUser) return;
    let sock;
    let mounted = true;

    getSocket().then((s) => {
      if (!mounted) return;
      sock = s;

      function onReelUpdated({ reelId, likeCount, likes }) {
        if (syncCallbacks.current[reelId]) {
          syncCallbacks.current[reelId](likeCount, likes);
        }
      }

      function onReelDeleted({ reelId }) {
        handleReelDeleted(reelId);
      }

      function onReelComment({ reelId, commentCount }) {
        if (syncCallbacks.current[reelId]) {
          syncCallbacks.current[reelId](undefined, undefined, commentCount);
        }
      }

      s.on("reel-updated", onReelUpdated);
      s.on("reel-deleted", onReelDeleted);
      s.on("reel-comment", onReelComment);

      sock._reelsPageHandlers = { onReelUpdated, onReelDeleted, onReelComment };
    });

    return () => {
      mounted = false;
      if (sock) {
        const h = sock._reelsPageHandlers || {};
        sock.off("reel-updated", h.onReelUpdated);
        sock.off("reel-deleted", h.onReelDeleted);
        sock.off("reel-comment", h.onReelComment);
        delete sock._reelsPageHandlers;
      }
    };
  }, [currentUser]);

  const [deletedIds, setDeletedIds] = useState(new Set());

  function handleReelDeleted(id) {
    setDeletedIds((prev) => new Set([...prev, id]));
  }

  const visibleReels = reels.filter((r) => !deletedIds.has(r._id));

  return (
    <div className="reels-feed">
      {visibleReels.length === 0 && !loading && (
        <div className="reel-empty-state">
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎬</div>
          <h2 style={{ color: "white", marginBottom: 8 }}>No Reels Yet</h2>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
            Be the first to share a reel!
          </p>
        </div>
      )}

      {error && (
        <div style={{ color: "#ed4956", textAlign: "center", padding: 24 }}>
          {error}
        </div>
      )}

      {visibleReels.map((reel) => (
        <ReelCard
          key={reel._id}
          reel={reel}
          currentUser={currentUser}
          currentUserProfile={currentUserProfile}
          onProfileClick={onProfileClick}
          onReelDeleted={handleReelDeleted}
          onLikeSync={(id, cb) => registerSync(id, cb)}
        />
      ))}

      {hasMore && (
        <div ref={sentinelRef} style={{ height: "1px", flexShrink: 0 }} />
      )}

      {loading && (
        <div className="reel-loading">
          <div className="reel-spinner" />
        </div>
      )}

      {loadingMore && (
        <div className="reel-loading">
          <div className="reel-spinner" />
        </div>
      )}
    </div>
  );
}
