import { useState, useEffect, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import { apiFetch } from "./api";
import { getSocket, disconnectSocket } from "./socket";
import "./App.css";

import { HomeIcon, SearchIcon, PlusIcon, HeartIcon, LogoutIcon, MoonIcon, SunIcon, ReelIcon } from "./components/Icons.jsx";
import Avatar from "./components/Avatar.jsx";
import NewPostModal from "./components/NewPostModal.jsx";
import NewReelModal from "./components/NewReelModal.jsx";
import RightPanel from "./components/RightPanel.jsx";

import AuthPage from "./pages/AuthPage.jsx";
import FeedPage from "./pages/FeedPage.jsx";
import ExplorePage from "./pages/ExplorePage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import ReelsPage from "./pages/ReelsPage.jsx";
import ChatbotCard from "./components/ChatbotCard.jsx";

export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [page, setPage] = useState("home");
  const [viewingUid, setViewingUid] = useState(null);
  const [showNewPost, setShowNewPost] = useState(false);
  const [showNewReel, setShowNewReel] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [toastNotif, setToastNotif] = useState(null);
  const toastTimer = useRef(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") === "dark");
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [isMobileScreen, setIsMobileScreen] = useState(() => window.innerWidth <= 768);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = (e) => setIsMobileScreen(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
      if (!user) disconnectSocket();
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!authUser) { setCurrentUserProfile(null); return; }
    apiFetch("/api/users/me")
      .then((profile) => {
        if (profile && profile.uid) setCurrentUserProfile(profile);
        else setCurrentUserProfile(null);
      })
      .catch(async () => {

        try {
          const profile = await apiFetch("/api/users/me", {
            method: "POST",
            body: JSON.stringify({
              username: (authUser.displayName || authUser.email?.split("@")[0] || authUser.uid.slice(0, 8))
                .toLowerCase()
                .replace(/\s+/g, "_"),
              displayName: authUser.displayName || "",
              photoURL: authUser.photoURL || "",
            }),
          });

          if (profile && profile.uid) setCurrentUserProfile(profile);
          else setCurrentUserProfile(null);
        } catch (_) {
          setCurrentUserProfile(null);
        }
      });
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    let sock;

    apiFetch("/api/notifications/unread-count")
      .then((d) => setUnreadNotifs(d.count || 0))
      .catch(() => { });

    getSocket().then((s) => {
      sock = s;
      s.on("notification", (notif) => {

        setUnreadNotifs((n) => n + 1);


        setToastNotif(notif);
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToastNotif(null), 4500);

        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "sine";
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.25, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.4);
        } catch (_) { }

        if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
          const title = notif.type === "like"
            ? `${notif.fromUsername} liked your post`
            : notif.type === "comment"
              ? `${notif.fromUsername} commented: "${notif.commentText || ""}"`
              : `${notif.fromUsername} started following you`;

          const n = new Notification("Snapgram", {
            body: title,
            icon: notif.fromPhotoURL || "/favicon.ico",
            image: notif.postImageURL || undefined,
            tag: notif._id || "snapgram-notif",
          });
          n.onclick = () => { window.focus(); };
        }
      });
    });

    return () => {
      if (sock) sock.off("notification");
    };
  }, [authUser]);

  function goToProfile(uid) {
    setViewingUid(uid);
    setPage("profile");
  }

  function goToNotifications() {
    setPage("notifications");
    setUnreadNotifs(0);

    apiFetch("/api/notifications/mark-read", { method: "PUT" }).catch(() => { });
  }

  if (authLoading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0f" }}>
      <div style={{
        fontFamily: "'Dancing Script', cursive",
        fontSize: 42,
        background: "linear-gradient(135deg, #f09433, #dc2743, #bc1888)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        padding: "10px",
        lineHeight: "1.2"
      }}>Snapgram</div>
    </div>
  );

  if (!authUser) return <AuthPage onAuth={setAuthUser} onProfileLoaded={setCurrentUserProfile} />;

  const isReelsPage = page === "reels";

  return (
    <div className="app-layout">
      { }
      <nav className="bottom-nav">
        <button className={`nav-item ${page === "home" ? "active" : ""}`} onClick={() => setPage("home")}>
          <HomeIcon filled={page === "home"} />
        </button>
        <button className={`nav-item ${page === "explore" ? "active" : ""}`} onClick={() => setPage("explore")}>
          <SearchIcon filled={page === "explore"} />
        </button>
        <button className={`nav-item ${page === "reels" ? "active" : ""}`} onClick={() => setPage("reels")}>
          <ReelIcon filled={page === "reels"} />
        </button>
        <button className="nav-item" onClick={() => setShowNewPost(true)}>
          <PlusIcon />
        </button>
        <button className={`nav-item ${page === "notifications" ? "active" : ""}`} onClick={goToNotifications} style={{ position: "relative" }}>
          <HeartIcon filled={page === "notifications"} />
          {unreadNotifs > 0 && <span className="notif-badge">{unreadNotifs > 9 ? "9+" : unreadNotifs}</span>}
        </button>
        <button className={`nav-item ${page === "profile" && viewingUid === authUser?.uid ? "active" : ""}`} onClick={() => goToProfile(authUser?.uid)}>
          <Avatar src={currentUserProfile?.photoURL} name={currentUserProfile?.username || "Me"} size={26} />
        </button>
      </nav>

      { }
      <nav className="sidebar">
        <div className="sidebar-logo">Snapgram</div>
        <button className={`nav-item ${page === "home" ? "active" : ""}`} onClick={() => setPage("home")}>
          <HomeIcon filled={page === "home"} /><span>Home</span>
        </button>
        <button className={`nav-item ${page === "explore" ? "active" : ""}`} onClick={() => setPage("explore")}>
          <SearchIcon filled={page === "explore"} /><span>Explore</span>
        </button>
        <button className={`nav-item ${page === "reels" ? "active" : ""}`} onClick={() => setPage("reels")}>
          <ReelIcon filled={page === "reels"} /><span>Reels</span>
        </button>
        <button className="nav-item" onClick={() => setShowNewPost(true)}>
          <PlusIcon /><span>Create</span>
        </button>
        {page === "reels" && (
          <button className="nav-item" onClick={() => setShowNewReel(true)} style={{ color: "var(--blue)" }}>
            <ReelIcon /><span>New Reel</span>
          </button>
        )}
        <button className={`nav-item ${page === "notifications" ? "active" : ""}`} onClick={goToNotifications} style={{ position: "relative" }}>
          <HeartIcon filled={page === "notifications"} />
          <span>Notifications</span>
          {unreadNotifs > 0 && <span className="notif-badge sidebar-notif-badge">{unreadNotifs > 9 ? "9+" : unreadNotifs}</span>}
        </button>
        <div className="nav-spacer" />
        <button className={`nav-item ${page === "profile" && viewingUid === authUser?.uid ? "active" : ""}`} onClick={() => goToProfile(authUser?.uid)}>
          <Avatar src={currentUserProfile?.photoURL} name={currentUserProfile?.username || "Me"} size={26} />
          <span>Profile</span>
        </button>
        <button className="nav-item" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? <><SunIcon /><span>Light Mode</span></> : <><MoonIcon /><span>Dark Mode</span></>}
        </button>
        <button className="nav-item" onClick={() => signOut(auth)}>
          <LogoutIcon /><span>Log out</span>
        </button>
      </nav>

      { }
      <div className="mobile-header">
        <div className="mobile-header-logo">Snapgram</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {page === "reels" && (
            <button className="mobile-logout-btn" onClick={() => setShowNewReel(true)} title="New Reel">
              <ReelIcon />
            </button>
          )}
          <button className="mobile-logout-btn" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? <SunIcon /> : <MoonIcon />}
          </button>
          <button className="mobile-logout-btn" onClick={() => signOut(auth)}>
            <LogoutIcon />
          </button>
        </div>
      </div>


      {!isMobileScreen ? (
        <div className="chatbot-pill-fixed-wrapper">
          <button
            className="chatbot-pill"
            onClick={() => setChatbotOpen((o) => !o)}
            aria-label="Open Snap AI chatbot"
          >
            <span className="chatbot-pill-icon">✨</span>
            Ask Snap AI
          </button>
          <ChatbotCard
            open={chatbotOpen}
            onClose={() => setChatbotOpen(false)}
            isMobile={false}
          />
        </div>
      ) : (
        <>
          <button
            className="chatbot-fab"
            onClick={() => setChatbotOpen((o) => !o)}
            aria-label="Open Snap AI chatbot"
            title="Ask Snap AI"
          >
            ✨
          </button>
          <ChatbotCard
            open={chatbotOpen}
            onClose={() => setChatbotOpen(false)}
            isMobile={true}
          />
        </>
      )}

      <div className={`main-content ${isReelsPage ? "main-content--reels" : ""}`}>
        {page === "home" && (
          <>
            <FeedPage currentUser={authUser} currentUserProfile={currentUserProfile} onProfileClick={goToProfile} />
            <RightPanel currentUser={authUser} currentUserProfile={currentUserProfile} onProfileClick={goToProfile} onSeeAll={() => setPage("explore")} />
          </>
        )}
        {page === "explore" && <ExplorePage currentUser={authUser} currentUserProfile={currentUserProfile} onProfileClick={goToProfile} />}
        {page === "reels" && (
          <ReelsPage
            currentUser={authUser}
            currentUserProfile={currentUserProfile}
            onProfileClick={goToProfile}
          />
        )}
        {page === "profile" && (
          <ProfilePage
            profileUid={viewingUid}
            currentUser={authUser}
            currentUserProfile={currentUserProfile}
            onProfileClick={goToProfile}
            onProfileUpdated={setCurrentUserProfile}
          />
        )}
        {page === "notifications" && (
          <NotificationsPage currentUser={authUser} onProfileClick={goToProfile} />
        )}
      </div>


      {toastNotif && (
        <div className="notif-toast" onClick={() => { goToNotifications(); setToastNotif(null); }}>
          <div className="notif-toast-avatar">
            {toastNotif.fromPhotoURL
              ? <img src={toastNotif.fromPhotoURL} alt="" />
              : <span>{(toastNotif.fromUsername || "?")[0].toUpperCase()}</span>
            }
          </div>
          <div className="notif-toast-body">
            <div className="notif-toast-title">Snapgram</div>
            <div className="notif-toast-msg">
              <strong>{toastNotif.fromUsername}</strong>
              {" "}
              {toastNotif.type === "like"
                ? "liked your post"
                : toastNotif.type === "comment"
                  ? `commented: "${toastNotif.commentText || ""}"`
                  : "started following you"}
            </div>
          </div>
          <button className="notif-toast-close" onClick={(e) => { e.stopPropagation(); setToastNotif(null); }}>✕</button>
        </div>
      )}

      {showNewPost && (
        <NewPostModal
          currentUser={authUser}
          currentUserProfile={currentUserProfile}
          onClose={() => setShowNewPost(false)}
          onPosted={() => { setShowNewPost(false); setPage("home"); }}
        />
      )}

      {showNewReel && (
        <NewReelModal
          currentUser={authUser}
          currentUserProfile={currentUserProfile}
          onClose={() => setShowNewReel(false)}
          onPosted={() => { setShowNewReel(false); setPage("reels"); }}
        />
      )}
    </div>
  );
}
