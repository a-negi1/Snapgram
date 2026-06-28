import { useState, useCallback } from "react";
import { apiFetch } from "../api";
import Avatar from "../components/Avatar.jsx";
import PostCard from "../components/PostCard.jsx";
import { SearchIcon } from "../components/Icons.jsx";
import { useCursorPagination } from "../hooks/useCursorPagination.js";

function SkeletonGridItem() {
  return <div className="skeleton-grid-item" />;
}

export default function ExplorePage({ currentUser, currentUserProfile, onProfileClick }) {
  const [searchVal, setSearchVal] = useState("");
  const [users, setUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [lightboxPost, setLightboxPost] = useState(null);

const exploreFetchFn = useCallback(
    (cursor) =>
      apiFetch(`/api/posts/explore?limit=12${cursor ? `&cursor=${cursor}` : ""}`),
    []
  );

  const {
    items: posts,
    loading,
    loadingMore,
    hasMore,
    error: exploreError,
    loadMore,
    sentinelRef,
    reset: resetExplore,
  } = useCursorPagination(exploreFetchFn);

  async function searchUsers(val) {
    setSearchVal(val);
    if (!val.trim()) { setUsers([]); return; }
    setSearching(true);
    try {
      const results = await apiFetch(`/api/users/search?q=${encodeURIComponent(val)}`);
      setUsers(results);
    } catch (e) {
      console.error(e);
    }
    setSearching(false);
  }

  return (
    <div className="explore-page">
      <div className="search-bar">
        <SearchIcon />
        <input
          className="search-input"
          placeholder="Search users…"
          value={searchVal}
          onChange={(e) => searchUsers(e.target.value)}
          autoComplete="off"
        />
        {searchVal && (
          <button
            onClick={() => { setSearchVal(""); setUsers([]); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dark-gray)", fontSize: 18, lineHeight: 1, padding: "0 4px" }}
          >×</button>
        )}
      </div>

      {searchVal ? (
        <div style={{ marginBottom: 24 }}>
          {searching && <div style={{ color: "var(--dark-gray)", padding: "8px 0" }}>Searching…</div>}
          {users.map((u) => (
            <div key={u._id} className="suggestion-item" style={{ cursor: "pointer" }}
              onClick={() => { onProfileClick(u.uid); setSearchVal(""); setUsers([]); }}>
              <Avatar src={u.photoURL} name={u.username} size={44} />
              <div className="suggestion-info">
                <div className="suggestion-username">{u.username}</div>
                <div className="suggestion-sub">{u.displayName || ""}</div>
              </div>
            </div>
          ))}
          {!searching && users.length === 0 && (
            <div style={{ color: "var(--dark-gray)", padding: "12px 0" }}>No users found for "{searchVal}"</div>
          )}
        </div>
      ) : (
        <>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--dark-gray)", marginBottom: 12 }}>Top Posts</div>

          {loading ? (
            <div className="loading-spinner">Loading…</div>
          ) : (
            <>
              <div className="explore-grid">
                {posts.map((p) => (
                  <div key={p._id} className="profile-grid-item" onClick={() => setLightboxPost(p)}>
                    {p.imageURL ? (
                      p.mediaType === "video" ? (
                        <>
                          <video
                            src={p.imageURL}
                            preload="metadata"
                            muted
                            playsInline
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }}
                          />
                          <div style={{ position: "absolute", top: 6, right: 8, background: "rgba(0,0,0,0.55)", borderRadius: 4, padding: "2px 5px", display: "flex", alignItems: "center", gap: 3 }}>
                            <svg viewBox="0 0 10 10" fill="white" width="10" height="10"><polygon points="2,1 9,5 2,9"/></svg>
                          </div>
                        </>
                      ) : (
                        <img src={p.imageURL} alt="" />
                      )
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "var(--light-gray)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 32 }}>📷</span>
                      </div>
                    )}
                    <div className="grid-overlay">
                      <span>❤️ {p.likeCount || 0}</span>
                      <span>💬 {p.commentCount || 0}</span>
                    </div>
                  </div>
                ))}

                {}
                {loadingMore && (
                  <>
                    <SkeletonGridItem />
                    <SkeletonGridItem />
                    <SkeletonGridItem />
                  </>
                )}
              </div>

              {}
              {hasMore && (
                <div ref={sentinelRef} style={{ height: 1 }} />
              )}

              {}
              {exploreError && !loadingMore && (
                <div className="load-more-retry">
                  <span>Failed to load.</span>
                  <button onClick={loadMore}>Tap to retry</button>
                </div>
              )}

            </>
          )}
        </>
      )}

      {}
      {lightboxPost && (
        <div className="modal-overlay" onClick={() => setLightboxPost(null)}>
          <div className="lightbox-card" onClick={(e) => e.stopPropagation()}>
            <PostCard
              post={lightboxPost}
              currentUser={currentUser}
              currentUserProfile={currentUserProfile}
              onProfileClick={(uid) => { setLightboxPost(null); onProfileClick(uid); }}
              onPostDeleted={() => { setLightboxPost(null); resetExplore(); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
