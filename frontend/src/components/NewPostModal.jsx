import { useState, useRef } from "react";
import { apiFetch } from "../api";
import { uploadToCloudinary } from "../utils";

const ACCEPTED = "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime,video/x-msvideo";
const MAX_VIDEO_MB = 100;

export default function NewPostModal({ currentUser, currentUserProfile, onClose, onPosted }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isVideo, setIsVideo] = useState(false);
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);


  const [captionLoading, setCaptionLoading] = useState(false);
  const [captionError, setCaptionError] = useState(null);

  const fileRef = useRef();
  const previewUrlRef = useRef(null);

  function handleFile(f) {
    if (!f) return;
    const video = f.type.startsWith("video/");
    if (video && f.size > MAX_VIDEO_MB * 1024 * 1024) {
      alert(`Video must be under ${MAX_VIDEO_MB} MB`);
      return;
    }

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const previewUrl = URL.createObjectURL(f);
    previewUrlRef.current = previewUrl;
    setFile(f);
    setIsVideo(video);
    setPreview(previewUrl);
    setCaptionError(null);
  }

  function clearFile(e) {
    e.stopPropagation();
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setFile(null);
    setPreview(null);
    setIsVideo(false);
    setCaptionError(null);
    fileRef.current.value = "";
  }


  function extractImageBase64(f) {
    return new Promise((resolve, reject) => {
      if (f.type.startsWith("image/")) {

        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to read image file"));
        reader.readAsDataURL(f);
      } else {

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
          reject(new Error("Failed to load video for frame extraction"));
        });
      }
    });
  }


  async function generateCaption() {
    if (!file) return;
    setCaptionLoading(true);
    setCaptionError(null);
    try {
      const imageBase64 = await extractImageBase64(file);
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
    try {
      const { url, mediaType } = await uploadToCloudinary(file, (pct) => {
        setUploadProgress(pct);
      });
      setUploadProgress("saving");
      await apiFetch("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          imageURL: url,
          mediaType,
          caption: caption.trim(),
          username: currentUserProfile?.username || currentUser.displayName || "user",
          photoURL: currentUserProfile?.photoURL || "",
        }),
      });
      onPosted();
    } catch (e) {
      alert("Error posting: " + e.message);
    }
    setLoading(false);
    setUploadProgress(null);
  }

  const progressLabel =
    uploadProgress === "saving"
      ? "Saving post…"
      : typeof uploadProgress === "number"
        ? `Uploading… ${uploadProgress}%`
        : "Sharing…";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="new-post-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>New Post</span>
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
                {isVideo ? (
                  <video
                    src={preview}
                    className="upload-preview"
                    controls
                    muted
                    style={{ background: "#000" }}
                  />
                ) : (
                  <img src={preview} alt="preview" className="upload-preview" />
                )}
                <button className="upload-clear-btn" onClick={clearFile} title="Remove">×</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🖼️🎬</div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Drag &amp; drop or click to upload</div>
                <div style={{ fontSize: 13, color: "var(--dark-gray)", marginBottom: 4 }}>
                  Images: JPG, PNG, GIF, WebP
                </div>
                <div style={{ fontSize: 13, color: "var(--dark-gray)" }}>
                  Videos: MP4, WebM, MOV (max {MAX_VIDEO_MB} MB)
                </div>
              </>
            )}
          </div>

          { }
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED}
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files[0])}
          />

          {preview && (
            <button className="upload-change-btn" onClick={() => fileRef.current.click()} style={{ marginTop: 8 }}>
              Change {isVideo ? "video" : "photo"}
            </button>
          )}


          {preview && (
            <button
              id="generate-caption-btn"
              className="generate-caption-btn"
              onClick={generateCaption}
              disabled={captionLoading || loading}
            >
              {captionLoading ? "✨ Analyzing media…" : "✨ Generate Caption using AI"}
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
            {loading ? progressLabel : "Share"}
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

