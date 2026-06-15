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
  const fileRef = useRef();

  function handleFile(f) {
    if (!f) return;
    const video = f.type.startsWith("video/");
    if (video && f.size > MAX_VIDEO_MB * 1024 * 1024) {
      alert(`Video must be under ${MAX_VIDEO_MB} MB`);
      return;
    }
    setFile(f);
    setIsVideo(video);
    setPreview(URL.createObjectURL(f));
  }

  function clearFile(e) {
    e.stopPropagation();
    setFile(null);
    setPreview(null);
    setIsVideo(false);
    fileRef.current.value = "";
  }

  async function submit() {
    if (!file || !currentUser) return;
    setLoading(true);
    setUploadProgress("Uploading…");
    try {
      const { url, mediaType } = await uploadToCloudinary(file);
      setUploadProgress("Saving post…");
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
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Drag & drop or click to upload</div>
                <div style={{ fontSize: 13, color: "var(--dark-gray)", marginBottom: 4 }}>
                  Images: JPG, PNG, GIF, WebP
                </div>
                <div style={{ fontSize: 13, color: "var(--dark-gray)" }}>
                  Videos: MP4, WebM, MOV (max {MAX_VIDEO_MB} MB)
                </div>
              </>
            )}
          </div>

          {}
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

          <textarea
            className="modal-textarea"
            placeholder="Write a caption…"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
          />

          <button className="modal-submit-btn" onClick={submit} disabled={!file || loading}>
            {loading ? (uploadProgress || "Sharing…") : "Share"}
          </button>
        </div>
      </div>
    </div>
  );
}
