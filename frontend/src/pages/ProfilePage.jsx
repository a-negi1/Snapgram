import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "../api";
import { uploadToCloudinary } from "../utils";
import Avatar from "../components/Avatar.jsx";
import PostCard from "../components/PostCard.jsx";
import NewReelModal from "../components/NewReelModal.jsx";
import { useCursorPagination } from "../hooks/useCursorPagination.js";

function SkeletonGridItem() {
  return <div className="skeleton-grid-item" />;
}

export default function ProfilePage({ profileUid, currentUser, currentUserProfile, onProfileClick, onProfileUpdated }) {
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState("posts");
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [lightboxPost, setLightboxPost] = useState(null);
  const avatarRef = useRef();

  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [followModalType, setFollowModalType] = useState(null);
  const [followModalUsers, setFollowModalUsers] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  const isOwnProfile = currentUser?.uid === profileUid;

  const postsFetchFn = useCallback(
    (cursor) =>
      apiFetch(`/api/posts/user/${profileUid}?limit=12${cursor ? `&cursor=${cursor}` : ""}`),
    [profileUid]
  );

  const {
    items: posts,
    loading: postsLoading,
    loadingMore: postsLoadingMore,
    hasMore: postsHasMore,
    error: postsError,
    loadMore: postsLoadMore,
    reset: resetPosts,
    sentinelRef: postsSentinelRef,
  } = useCursorPagination(postsFetchFn);

  const savedFetchFn = useCallback(
    (cursor) =>
      apiFetch(`/api/posts/saved?limit=12${cursor ? `&cursor=${cursor}` : ""}`),
    [currentUser?.uid]
  );

  const {
    items: savedPosts,
    loading: savedLoading,
    loadingMore: savedLoadingMore,
    hasMore: savedHasMore,
    error: savedError,
    loadMore: savedLoadMore,
    reset: resetSaved,
    sentinelRef: savedSentinelRef,
  } = useCursorPagination(savedFetchFn);

  const reelsFetchFn = useCallback(
    (cursor) =>
      apiFetch(`/api/reels/user/${profileUid}?limit=12${cursor ? `&cursor=${cursor}` : ""}`),
    [profileUid]
  );

  const {
    items: reels,
    loading: reelsLoading,
    loadingMore: reelsLoadingMore,
    hasMore: reelsHasMore,
    error: reelsError,
    loadMore: reelsLoadMore,
    reset: resetReels,
    sentinelRef: reelsSentinelRef,
  } = useCursorPagination(reelsFetchFn);

  const [showNewReelModal, setShowNewReelModal] = useState(false);
  const [deletingReelId, setDeletingReelId] = useState(null);

  useEffect(() => {
    setActiveTab("posts");
    setProfile(null);
    setLoading(true);
  }, [profileUid]);

  useEffect(() => {
    if (activeTab === "saved" && savedPosts.length === 0) resetSaved();
    if (activeTab === "reels" && reels.length === 0) resetReels();
  }, [activeTab]);

  useEffect(() => {
    if (!profileUid || !isOwnProfile) return;
    if (!currentUserProfile) { setLoading(true); return; }
    setProfile(currentUserProfile);
    setLoading(false);
  }, [profileUid, isOwnProfile, currentUserProfile]);

  useEffect(() => {
    if (!profileUid || isOwnProfile) return;
    setLoading(true);

    const fetchUser = () => apiFetch(`/api/users/${profileUid}`).catch(async () => {
      await new Promise((r) => setTimeout(r, 1500));
      return apiFetch(`/api/users/${profileUid}`);
    });

    fetchUser()
      .then((profileData) => {
        setProfile(profileData);
        setFollowing(currentUser && (profileData.followers || []).includes(currentUser.uid));
        setLoading(false);
      })
      .catch(console.error);
  }, [profileUid, isOwnProfile, currentUser]);

  async function toggleFollow() {
    if (!currentUser || !profile) return;
    try {
      const res = await apiFetch(`/api/users/${profileUid}/follow`, { method: "POST" });
      setFollowing(res.following);
      setProfile((p) => ({
        ...p,
        followers: res.following
          ? [...(p.followers || []), currentUser.uid]
          : (p.followers || []).filter((id) => id !== currentUser.uid),
      }));
    } catch (e) {
      console.error(e);
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files[0];
    if (!file || !currentUserProfile) return;
    setUploadingAvatar(true);
    try {
      const { url } = await uploadToCloudinary(file);
      const updated = await apiFetch("/api/users/me", {
        method: "PUT",
        body: JSON.stringify({ photoURL: url }),
      });
      setProfile((p) => ({ ...p, photoURL: url }));
      if (onProfileUpdated) onProfileUpdated(updated);
    } catch {
      alert("Failed to upload picture.");
    }
    setUploadingAvatar(false);
  }

  function openEditModal() {
    setEditName(profile?.displayName || "");
    setEditBio(profile?.bio || "");
    setEditUsername(profile?.username || "");
    setShowEditModal(true);
  }

  async function saveProfile() {
    setEditSaving(true);
    try {
      const updated = await apiFetch("/api/users/me", {
        method: "PUT",
        body: JSON.stringify({
          displayName: editName.trim(),
          bio: editBio.trim(),
          username: editUsername.trim().toLowerCase().replace(/\s+/g, "_"),
        }),
      });
      setProfile((p) => ({ ...p, ...updated }));
      if (onProfileUpdated) onProfileUpdated(updated);
      setShowEditModal(false);
    } catch {
      alert("Failed to save profile.");
    }
    setEditSaving(false);
  }

  async function openFollowModal(type) {
    setFollowModalType(type);
    setModalLoading(true);
    try {
      const res = await apiFetch(`/api/users/${profileUid}/${type}`);
      setFollowModalUsers(res.data || res);
    } catch (e) {
      console.error(e);
    }
    setModalLoading(false);
  }

  const displayPosts = activeTab === "saved" ? savedPosts : posts;
  const displayLoading = activeTab === "saved" ? savedLoading : postsLoading;
  const displayLoadingMore = activeTab === "saved" ? savedLoadingMore : postsLoadingMore;
  const displayHasMore = activeTab === "saved" ? savedHasMore : postsHasMore;
  const displayError = activeTab === "saved" ? savedError : postsError;
  const displayLoadMore = activeTab === "saved" ? savedLoadMore : postsLoadMore;
  const displaySentinelRef = activeTab === "saved" ? savedSentinelRef : postsSentinelRef;

  async function handleDeleteReel(reelId) {
    if (!window.confirm("Delete this reel?")) return;
    setDeletingReelId(reelId);
    try {
      await apiFetch(`/api/reels/${reelId}`, { method: "DELETE" });
      resetReels();
    } catch (e) {
      alert("Failed to delete reel.");
    }
    setDeletingReelId(null);
  }

  if (loading) return <div className="loading-spinner">Loading profile…</div>;
  if (!profile) return <div className="empty-state"><h3>User not found</h3></div>;

  const isOwn = currentUser?.uid === profileUid;

  return (
    <>
      <div className="profile-page">
        <div className="profile-header">
          <div className={isOwn ? "profile-avatar-wrapper" : ""} onClick={() => { if (isOwn) avatarRef.current?.click(); }}>
            <Avatar src={profile.photoURL} name={profile.username} size={150} />
            {isOwn && (
              <div className={`profile-avatar-overlay ${uploadingAvatar ? "uploading-overlay" : ""}`}>
                {uploadingAvatar ? "Uploading..." : "📷"}
              </div>
            )}
            {isOwn && <input type="file" accept="image/*" style={{ display: "none" }} ref={avatarRef} onChange={handleAvatarChange} />}
          </div>

          <div className="profile-info">
            <div className="profile-username-row">
              <span className="profile-username">{profile.username}</span>
              {isOwn ? (
                <button className="profile-edit-btn" onClick={openEditModal}>Edit profile</button>
              ) : currentUser ? (
                <button className={`profile-follow-btn ${following ? "following" : ""}`} onClick={toggleFollow}>
                  {following ? "Following" : "Follow"}
                </button>
              ) : null}
            </div>
            <div className="profile-stats">
              <div className="profile-stat"><strong>{profile.postCount ?? (postsHasMore ? `${posts.length}+` : posts.length)}</strong> posts</div>
              <div className="profile-stat" style={{ cursor: "pointer" }} onClick={() => openFollowModal("followers")}>
                <strong>{(profile.followers || []).length}</strong> followers
              </div>
              <div className="profile-stat" style={{ cursor: "pointer" }} onClick={() => openFollowModal("following")}>
                <strong>{(profile.following || []).length}</strong> following
              </div>
            </div>
            {profile.displayName && <div style={{ fontWeight: 700, marginBottom: 4, textAlign: "left", width: "100%" }}>{profile.displayName}</div>}
            {profile.bio && <div className="profile-bio" style={{ textAlign: "left", width: "100%" }}>{profile.bio}</div>}
          </div>
        </div>

        <div className="profile-tabs">
          <button className={`profile-tab ${activeTab === "posts" ? "active" : ""}`} onClick={() => setActiveTab("posts")}>
            <GridIcon /> Posts
          </button>
          <button className={`profile-tab ${activeTab === "reels" ? "active" : ""}`} onClick={() => setActiveTab("reels")}>
            <ReelTabIcon /> Reels
          </button>
          {isOwn && (
            <button className={`profile-tab ${activeTab === "saved" ? "active" : ""}`} onClick={() => setActiveTab("saved")}>
              <BookmarkTabIcon /> Saved
            </button>
          )}
        </div>

        {activeTab === "reels" ? (
          <>
            {isOwn && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <button
                  className="profile-edit-btn new-reel-btn"
                  onClick={() => setShowNewReelModal(true)}
                >
                  <ReelTabIcon /> New Reel
                </button>
              </div>
            )}
            {reelsLoading ? (
              <div className="loading-spinner">Loading…</div>
            ) : reels.length === 0 && !reelsHasMore ? (
              <div className="empty-state">
                <h3>No reels yet</h3>
                {isOwn && <p>Share your first reel!</p>}
              </div>
            ) : (
              <>
                <div className="profile-grid">
                  {reels.map((r) => (
                    <div key={r._id} className="profile-grid-item" style={{ position: "relative" }}>
                      <video
                        src={r.videoURL}
                        preload="metadata"
                        muted
                        playsInline
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }}
                      />

                      <div style={{ position: "absolute", top: 6, right: 8, background: "rgba(0,0,0,0.55)", borderRadius: 4, padding: "2px 5px", display: "flex", alignItems: "center", gap: 3 }}>
                        <svg viewBox="0 0 10 10" fill="white" width="10" height="10"><polygon points="2,1 9,5 2,9" /></svg>
                      </div>

                      <div className="grid-overlay">
                        <span>❤️ {r.likeCount || 0}</span>
                      </div>

                      {isOwn && (
                        <button
                          className="reel-delete-btn"
                          onClick={() => handleDeleteReel(r._id)}
                          disabled={deletingReelId === r._id}
                          title="Delete reel"
                        >
                          {deletingReelId === r._id ? "…" : "🗑"}
                        </button>
                      )}
                    </div>
                  ))}
                  {reelsLoadingMore && (
                    <>
                      <SkeletonGridItem />
                      <SkeletonGridItem />
                      <SkeletonGridItem />
                    </>
                  )}
                </div>
                {reelsHasMore && <div ref={reelsSentinelRef} style={{ height: 1 }} />}
                {reelsError && !reelsLoadingMore && (
                  <div className="load-more-retry">
                    <span>Failed to load.</span>
                    <button onClick={reelsLoadMore}>Tap to retry</button>
                  </div>
                )}
              </>
            )}
          </>
        ) : displayLoading ? (
          <div className="loading-spinner">Loading…</div>
        ) : displayPosts.length === 0 && !displayHasMore ? (
          <div className="empty-state">
            <h3>{activeTab === "saved" ? "No saved posts" : "No posts yet"}</h3>
            {activeTab === "saved" && <p>Posts you save will appear here.</p>}
          </div>
        ) : (
          <>
            <div className="profile-grid">
              {displayPosts.map((p) => (
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
                          <svg viewBox="0 0 10 10" fill="white" width="10" height="10"><polygon points="2,1 9,5 2,9" /></svg>
                        </div>
                      </>
                    ) : (
                      <img src={p.imageURL} alt="post" />
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

              {displayLoadingMore && (
                <>
                  <SkeletonGridItem />
                  <SkeletonGridItem />
                  <SkeletonGridItem />
                </>
              )}
            </div>

            {displayHasMore && (
              <div ref={displaySentinelRef} style={{ height: 1 }} />
            )}

            {displayError && !displayLoadingMore && (
              <div className="load-more-retry">
                <span>Failed to load.</span>
                <button onClick={displayLoadMore}>Tap to retry</button>
              </div>
            )}
          </>
        )}
      </div>

      {lightboxPost && (
        <div className="modal-overlay" onClick={() => setLightboxPost(null)}>
          <div className="lightbox-card" onClick={(e) => e.stopPropagation()}>
            <PostCard
              post={lightboxPost}
              currentUser={currentUser}
              currentUserProfile={currentUserProfile}
              onProfileClick={(uid) => { setLightboxPost(null); onProfileClick(uid); }}
              onPostDeleted={(id) => {
                resetPosts();
                resetSaved();
                setLightboxPost(null);
              }}
            />
          </div>
        </div>
      )}

      {showNewReelModal && (
        <NewReelModal
          currentUser={currentUser}
          currentUserProfile={currentUserProfile}
          onClose={() => setShowNewReelModal(false)}
          onPosted={() => { setShowNewReelModal(false); resetReels(); setActiveTab("reels"); }}
        />
      )}

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="new-post-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span>Edit Profile</span>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="edit-field-label">Username</label>
                <input className="edit-field-input" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} placeholder="username" />
              </div>
              <div>
                <label className="edit-field-label">Display name</label>
                <input className="edit-field-input" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <label className="edit-field-label">Bio</label>
                <textarea className="modal-textarea" value={editBio} onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Tell people about yourself…" rows={3} style={{ marginTop: 0 }} />
              </div>
              <button className="modal-submit-btn" onClick={saveProfile} disabled={editSaving}>
                {editSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {followModalType && (
        <div className="modal-overlay" onClick={() => setFollowModalType(null)}>
          <div className="new-post-modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span style={{ textTransform: "capitalize" }}>{followModalType}</span>
              <button className="modal-close" onClick={() => setFollowModalType(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: 0, maxHeight: "60vh", overflowY: "auto" }}>
              {modalLoading ? (
                <div className="loading-spinner">Loading...</div>
              ) : followModalUsers.length === 0 ? (
                <div className="empty-state" style={{ padding: "30px 20px" }}>No users yet</div>
              ) : (
                <div style={{ padding: 16 }}>
                  {followModalUsers.map((u) => (
                    <div key={u._id} className="suggestion-item" style={{ cursor: "pointer" }}
                      onClick={() => { setFollowModalType(null); onProfileClick(u.uid); }}>
                      <Avatar src={u.photoURL} name={u.username} size={44} />
                      <div className="suggestion-info">
                        <div className="suggestion-username">{u.username}</div>
                        <div className="suggestion-sub">{u.displayName}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function GridIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>;
}
function BookmarkTabIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>;
}
function ReelTabIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="17" x2="22" y2="17" /><line x1="17" y1="7" x2="22" y2="7" /></svg>;
}
