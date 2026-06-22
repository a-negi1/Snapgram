import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { apiFetch } from "../api";

export default function AuthPage({ onAuth, onProfileLoaded }) {
  const [mode, setMode] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  function switchMode(m) { setMode(m); setError(""); setResetSent(false); setUsername(""); setDisplayName(""); }

async function ensureUserInDB({ uid, displayName, photoURL, usernameOverride }) {
    try {

const profile = await apiFetch("/api/users/me", {
        method: "POST",
        body: JSON.stringify({
          username: usernameOverride || displayName?.toLowerCase().replace(/\s+/g, "_") || uid.slice(0, 8),
          displayName: displayName || "",
          photoURL: photoURL || "",
        }),
      });
      if (onProfileLoaded) onProfileLoaded(profile);
    } catch (_) {

}
  }

  async function handleGoogleSignIn() {
    setError(""); setGoogleLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const user = cred.user;
      await ensureUserInDB({
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
      });
      onAuth(user);
    } catch (e) {
      setError(e.message.replace("Firebase: ", "").replace(/\(auth.*\)\.?/, ""));
    }
    setGoogleLoading(false);
  }

  async function handleSubmit() {
    setError(""); setLoading(true);
    try {
      if (mode === "login") {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        onAuth(cred.user);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: displayName || username });
        await ensureUserInDB({
          uid: cred.user.uid,
          displayName: displayName || username,
          usernameOverride: username.toLowerCase().replace(/\s+/g, "_"),
        });
        onAuth(cred.user);
      }
    } catch (e) {
      setError(e.message.replace("Firebase: ", "").replace(/\(auth.*\)\.?/, ""));
    }
    setLoading(false);
  }

  async function handleForgotPassword() {
    if (!email.trim()) { setError("Please enter your email address first."); return; }
    setError(""); setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
    } catch (e) {
      setError(e.message.replace("Firebase: ", "").replace(/\(auth.*\)\.?/, ""));
    }
    setLoading(false);
  }

  if (mode === "forgot") {
    return (
      <div className="auth-page">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
        <div className="auth-card">
          <span className="auth-logo">Snapgram</span>
          <div className="auth-tagline">Reset your password</div>
          {resetSent ? (
            <div className="reset-success">
              <div style={{ fontSize: 44, marginBottom: 12 }}>📧</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: "var(--black)" }}>Check your email</div>
              <div style={{ fontSize: 14, color: "var(--dark-gray)", lineHeight: 1.6 }}>
                We sent a password reset link to<br />
                <strong style={{ color: "var(--black)" }}>{email}</strong>
              </div>
              <button className="auth-btn" style={{ marginTop: 24 }} onClick={() => switchMode("login")}>Back to Sign In</button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 14, color: "var(--dark-gray)", marginBottom: 20, lineHeight: 1.6 }}>
                Enter the email address linked to your account and we'll send you a reset link.
              </div>
              {error && <div className="auth-error">{error}</div>}
              <div className="auth-field">
                <label className="auth-field-label">Email</label>
                <input className="auth-input" type="email" placeholder="your@email.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleForgotPassword()} autoFocus />
              </div>
              <button className="auth-btn" onClick={handleForgotPassword} disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </button>
              <div className="auth-toggle">
                <button onClick={() => switchMode("login")}>← Back to Sign In</button>
              </div>
            </>
          )}
        </div>
        <div className="auth-watermark">
          © 2026  <span className="auth-watermark-name">ADHEESH NEGI</span>  · All Rights Reserved
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />
      <div className="auth-card">
        <span className="auth-logo">Snapgram</span>
        <div className="auth-tagline">Share your world</div>

        <div className="auth-tabs">
          <button className={`auth-tab ${mode === "login" ? "active" : ""}`} onClick={() => switchMode("login")}>Sign In</button>
          <button className={`auth-tab ${mode === "signup" ? "active" : ""}`} onClick={() => switchMode("signup")}>Create Account</button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button className="auth-google-btn" onClick={handleGoogleSignIn} disabled={googleLoading || loading}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {googleLoading ? "Connecting…" : "Continue with Google"}
        </button>

        <div className="auth-or-row">
          <div className="auth-or-line" />
          <span className="auth-or-txt">or</span>
          <div className="auth-or-line" />
        </div>

        {mode === "signup" && (
          <>
            <div className="auth-field">
              <label className="auth-field-label">Display Name</label>
              <input className="auth-input" placeholder="Your full name" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div className="auth-field">
              <label className="auth-field-label">Username</label>
              <input className="auth-input" placeholder="choose a username" value={username} onChange={e => setUsername(e.target.value)} />
            </div>
          </>
        )}

        <div className="auth-field">
          <label className="auth-field-label">Email</label>
          <input className="auth-input" type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>

        <div className="auth-field">
          <label className="auth-field-label">Password</label>
          <input className="auth-input" type="password" placeholder="••••••••"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          {mode === "login" && (
            <button className="forgot-link" onClick={() => switchMode("forgot")} type="button">Forgot password?</button>
          )}
        </div>

        <button className="auth-btn" onClick={handleSubmit} disabled={loading || googleLoading}>
          {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
        </button>

        <div className="auth-toggle">
          {mode === "login" ? (
            <>Don't have an account? <button onClick={() => switchMode("signup")}>Sign up</button></>
          ) : (
            <>Already have an account? <button onClick={() => switchMode("login")}>Log in</button></>
          )}
        </div>
      </div>
      <div className="auth-watermark">
        © 2026  <span className="auth-watermark-name">ADHEESH NEGI</span>  · All Rights Reserved
      </div>
    </div>
  );
}
