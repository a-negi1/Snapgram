import { useState, useRef } from "react";
import { apiFetch } from "../api";
import { uploadToCloudinary } from "../utils";

const MAX_DURATION_SECS = 40;
const MAX_VIDEO_MB = 200;

export default function NewReelModal({ currentUser, currentUserProfile, onClose, onPosted }) {
  const [file, setFile]                   = useState(null);
  const [preview, setPreview]             = useState(null);
  const [caption, setCaption]             = useState("");
  const [loading, setLoading]             = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [error, setError]                 = useState("");
  const [captionLoading, setCaptionLoading] = useState(false);
  const [captionError, setCaptionError]   = useState(null);
  const fileRef                           = useRef();
  const previewUrlRef                     = useRef(null);

  function handleFile(f) {
    if (!f) return;
    setError("");

    if (!f.type.startsWith("video/")) {
      setError("Reels only accept video files.");
      return;
    }
    if (f.size > MAX_VIDEO_MB * 1024 * 1024) {
      setError(`Video must be under ${MAX_VIDEO_MB} MB.`);
      return;
    }

const url = URL.createObjectURL(f);
    const vid = document.createElement("video");
    vid.preload = "metadata";
    vid.src = url;
    vid.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      if (vid.duration > MAX_DURATION_SECS) {
        setError(`Reels must be 40 seconds or shorter. Your video is ${Math.round(vid.duration)}s.`);
        if (fileRef.current) fileRef.current.value = "";
        return;
      }

      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const previewUrl = URL.createObjectURL(f);
      previewUrlRef.current = previewUrl;
      setFile(f);
      setPreview(previewUrl);
    };
    vid.onerror = () => {
      URL.revokeObjectURL(url);
      setError("Could not read video metadata. Please try another file.");
    };
  }

  function clearFile(e) {
    e.stopPropagation();
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setFile(null);
    setPreview(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function extractVideoFrame(f) {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.muted = true;
      video.crossOrigin = "anonymous";
      const objectUrl = URL.createObjectURL(f);
      video.src = objectUrl;
      video.addEventListener("loadeddata", () => {
        video.currentTime = 0;
      });
      video.addEventListener("seeked", () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      });
      video.addEventListener("error", () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Failed to extract video frame"));
      });
    });
  }

  async function generateCaption() {
    if (!file) return;
    setCaptionLoading(true);
    setCaptionError(null);
    try {
      const imageBase64 = await extractVideoFrame(file);
      const data = await apiFetch("/api/posts/generate-caption", {
        method: "POST",
        body: JSON.stringify({ imageBase64 }),
      });
      setCaption(data.caption || "");
    } catch (e) {
      setCaptionError("✗ Caption generation failed: " + e.message);
    } finally {
      setCaptionLoading(false);
    }
  }

  async function submit() {
    if (!file || !currentUser) return;
    setLoading(true);
    setUploadProgress(0);
    setError("");
    try {
      const { url } = await uploadToCloudinary(file, (pct) => setUploadProgress(pct));
      setUploadProgress("saving");
      await apiFetch("/api/reels", {
        method: "POST",
        body: JSON.stringify({
          videoURL: url,
          caption: caption.trim(),
          username: currentUserProfile?.username || currentUser.displayName || "user",
          photoURL: currentUserProfile?.photoURL || "",
        }),
      });
      onPosted();
    } catch (e) {
      setError("Upload failed: " + e.message);
    }
    setLoading(false);
    setUploadProgress(null);
  }

  const progressLabel =
    uploadProgress === "saving"
      ? "Saving reel…"
      : typeof uploadProgress === "number"
      ? `Uploading… ${uploadProgress}%`
      : "Sharing…";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="new-post-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>New Reel</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div
            className={`upload-zone ${preview ? "has-file" : ""}`}
            onClick={() => fileRef.current.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
          >
            {preview ? (
              <>
                <video
                  src={preview}
                  className="upload-preview"
                  style={{ aspectRatio: "9/16", objectFit: "cover", background: "#000", maxHeight: 320 }}
                  controls
                  muted
                  playsInline
                />
                <button className="upload-clear-btn" onClick={clearFile} title="Remove">×</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🎬</div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Drag & drop or click to upload</div>
                <div style={{ fontSize: 13, color: "var(--dark-gray)", marginBottom: 4 }}>
                  Vertical video (9:16) recommended
                </div>
                <div style={{ fontSize: 13, color: "var(--dark-gray)" }}>
                  MP4, WebM, MOV · Max {MAX_DURATION_SECS}s · Max {MAX_VIDEO_MB} MB
                </div>
              </>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files[0])}
          />

          {preview && (
            <button className="upload-change-btn" onClick={() => fileRef.current.click()} style={{ marginTop: 8 }}>
              Change video
            </button>
          )}

          {error && (
            <div style={{
              background: "rgba(237,73,86,0.1)",
              border: "1px solid rgba(237,73,86,0.3)",
              color: "#ed4956",
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              marginTop: 10,
            }}>
              {error}
            </div>
          )}

          {preview && (
            <button
              id="generate-caption-btn-reel"
              className="generate-caption-btn"
              onClick={generateCaption}
              disabled={captionLoading || loading}
            >
              {captionLoading ? "✨ Analyzing video…" : "✨ Generate Caption using AI"}
            </button>
          )}

          {captionError && (
            <div className="caption-error-toast">{captionError}</div>
          )}

          <textarea
            className="modal-textarea"
            placeholder="Write a caption…"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
          />

          <button className="modal-submit-btn" onClick={submit} disabled={!file || loading}>
            {loading ? progressLabel : "Share Reel"}
          </button>

          {loading && (
            <div className="upload-progress-track">
              <div
                className={`upload-progress-bar${uploadProgress === "saving" ? " indeterminate" : ""}`}
                style={{
                  width: uploadProgress === "saving" ? "100%" : `${uploadProgress ?? 0}%`,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
