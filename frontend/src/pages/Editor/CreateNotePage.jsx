import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";
import { BG_PRESETS, FONT_OPTIONS, getFontFamily, getPostTextStyle } from "../../utils/postStyle";

const CreateNotePage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [tagsInput, setTagsInput] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    content: "",
    visibility: "public",
    style: {
      font: "serif",
      background: "#ffffff",
      textColor: "#1c1c1a",
      fontSize: 1.15,
      lineHeight: 1.6,
      letterSpacing: 0,
      textAlign: "center",
    },
    media: [],
  });

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const { data } = await api.get(`/posts/${id}`);
      const p = data.post;
      setForm({
        content: p.content || "",
        visibility: p.isAnonymous ? "anonymous" : p.visibility,
        style: {
          font: p.style?.font || "serif",
          background: p.style?.background || "#ffffff",
          textColor: p.style?.textColor || "#1c1c1a",
          fontSize: Number(p.style?.fontSize) || 1.15,
          lineHeight: Number(p.style?.lineHeight) || 1.6,
          letterSpacing: Number(p.style?.letterSpacing) || 0,
          textAlign: p.style?.textAlign || "center",
        },
        media: p.media || [],
      });

      const imageMedia = (p.media || []).find((m) => m.type === "image");
      const audioMedia = (p.media || []).find((m) => m.type === "audio");
      setImageUrl(imageMedia?.url || "");
      const existingAudioUrl = audioMedia?.url || "";
      const isSpotify = /spotify\.com\/track\//i.test(existingAudioUrl);
      setSpotifyUrl(isSpotify ? existingAudioUrl : "");
      setAudioUrl(isSpotify ? "" : existingAudioUrl);
      setTagsInput((p.tagSlugs || []).join(", "));
    };

    load();
  }, [id]);

  const charCount = useMemo(() => form.content.length, [form.content]);

  const save = async () => {
    setError("");

    const media = [];

    if (imageUrl.trim()) {
      media.push({
        url: imageUrl.trim(),
        type: "image",
      });
    }

    if (spotifyUrl.trim()) {
      media.push({
        url: spotifyUrl.trim(),
        type: "audio",
      });
    } else if (audioUrl.trim()) {
      media.push({
        url: audioUrl.trim(),
        type: "audio",
      });
    }

    const payload = {
      ...form,
      media,
      tagSlugs: tagsInput
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    };

    try {
      if (id) {
        await api.put(`/posts/${id}`, payload);
      } else {
        await api.post("/posts", payload);
      }

      navigate("/");
    } catch (err) {
      setError(err?.response?.data?.message || "Could not save note");
    }
  };

  const uploadMediaFile = async (file, mediaType) => {
    const formData = new FormData();
    formData.append("file", file);

    // Do NOT set Content-Type manually — axios will set the correct
    // multipart boundary automatically. Setting it strips the boundary.
    const { data } = await api.post("/uploads", formData);

    const uploaded = data.asset;

    if (mediaType === "image") {
      setImageUrl(uploaded.url);
    } else {
      setAudioUrl(uploaded.url);
      setSpotifyUrl("");
    }
  };

  const onImageFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setIsUploadingImage(true);

    try {
      await uploadMediaFile(file, "image");
    } catch (err) {
      setError(err?.response?.data?.message || "Image upload failed");
    } finally {
      setIsUploadingImage(false);
      event.target.value = "";
    }
  };

  const onAudioFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setIsUploadingAudio(true);

    try {
      await uploadMediaFile(file, "audio");
    } catch (err) {
      setError(err?.response?.data?.message || "Audio upload failed");
    } finally {
      setIsUploadingAudio(false);
      event.target.value = "";
    }
  };

  const previewFontFamily = useMemo(() => {
    return getFontFamily(form.style.font);
  }, [form.style.font]);

  const previewTextStyle = useMemo(() => getPostTextStyle(form.style), [form.style]);

  return (
    <section className="editor-layout">
      <aside className="panel">
        <h3>Editor settings</h3>

        <label>
          Visibility
          <select value={form.visibility} onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value }))}>
            <option value="public">Public</option>
            <option value="anonymous">Anonymous</option>
            <option value="private">Private</option>
          </select>
        </label>

        <label>
          Font
          <select value={form.style.font} onChange={(e) => setForm((f) => ({ ...f, style: { ...f.style, font: e.target.value } }))}>
            {FONT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label>
          Text color
          <input
            type="color"
            value={form.style.textColor}
            onChange={(e) => setForm((f) => ({ ...f, style: { ...f.style, textColor: e.target.value } }))}
          />
        </label>

        <label>
          Font size
          <input
            type="range"
            min="0.9"
            max="2.2"
            step="0.05"
            value={form.style.fontSize}
            onChange={(e) => setForm((f) => ({ ...f, style: { ...f.style, fontSize: Number(e.target.value) } }))}
          />
        </label>

        <label>
          Line height
          <input
            type="range"
            min="1"
            max="2.2"
            step="0.05"
            value={form.style.lineHeight}
            onChange={(e) => setForm((f) => ({ ...f, style: { ...f.style, lineHeight: Number(e.target.value) } }))}
          />
        </label>

        <label>
          Letter spacing
          <input
            type="range"
            min="-0.03"
            max="0.18"
            step="0.01"
            value={form.style.letterSpacing}
            onChange={(e) => setForm((f) => ({ ...f, style: { ...f.style, letterSpacing: Number(e.target.value) } }))}
          />
        </label>

        <label>
          Text alignment
          <select
            value={form.style.textAlign}
            onChange={(e) => setForm((f) => ({ ...f, style: { ...f.style, textAlign: e.target.value } }))}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
            <option value="justify">Justify</option>
          </select>
        </label>

        <div>
          <p>Background presets</p>
          <div className="preset-row">
            {BG_PRESETS.map((bg) => (
              <button
                key={bg}
                type="button"
                className={form.style.background === bg ? "swatch active" : "swatch"}
                style={{ background: bg }}
                onClick={() => setForm((f) => ({ ...f, style: { ...f.style, background: bg } }))}
              />
            ))}
          </div>
        </div>

        <div className="upload-block">
          <span className="upload-label">Cover image / GIF</span>
          {imageUrl ? (
            <div className="upload-preview">
              <img src={imageUrl} alt="" />
              <button
                type="button"
                className="ghost-btn small upload-clear"
                onClick={() => setImageUrl("")}
              >
                Remove
              </button>
            </div>
          ) : null}
          <label className={`dropzone ${isUploadingImage ? "is-busy" : ""}`}>
            <input type="file" accept="image/*,.gif" onChange={onImageFileChange} hidden />
            <span className="dropzone-icon">🖼️</span>
            <span>
              {isUploadingImage
                ? "Uploading image..."
                : "Drop or pick a JPG / PNG / GIF / WEBP"}
            </span>
            <span className="dropzone-hint">stored in the archive (max 15MB)</span>
          </label>
          <details className="upload-or-url">
            <summary>or paste a URL</summary>
            <input
              type="url"
              placeholder="https://..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </details>
        </div>

        <div className="upload-block">
          <span className="upload-label">Soundtrack</span>
          {audioUrl ? (
            <div className="upload-preview audio">
              <audio src={audioUrl} controls className="single-audio" />
              <button
                type="button"
                className="ghost-btn small upload-clear"
                onClick={() => setAudioUrl("")}
              >
                Remove
              </button>
            </div>
          ) : null}
          <label className={`dropzone ${isUploadingAudio ? "is-busy" : ""}`}>
            <input type="file" accept="audio/*" onChange={onAudioFileChange} hidden />
            <span className="dropzone-icon">🎵</span>
            <span>
              {isUploadingAudio
                ? "Uploading audio..."
                : "Drop or pick an MP3 / WAV / OGG / M4A"}
            </span>
            <span className="dropzone-hint">stored in the archive (max 15MB)</span>
          </label>
          <details className="upload-or-url">
            <summary>or use a Spotify / external URL</summary>
            <input
              type="url"
              placeholder="https://open.spotify.com/track/..."
              value={spotifyUrl}
              onChange={(e) => setSpotifyUrl(e.target.value)}
            />
            <input
              type="url"
              placeholder="Or any direct audio URL"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
            />
          </details>
        </div>

        <label>
          Tags (comma separated)
          <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
        </label>

        <button type="button" className="primary-btn" onClick={save}>{id ? "Update" : "Publish"}</button>
        {error ? <p className="error">{error}</p> : null}
      </aside>

      <article className="editor-canvas" style={{ background: form.style.background, color: form.style.textColor }}>
        {imageUrl ? <div className="editor-image-preview" style={{ backgroundImage: `url(${imageUrl})` }} /> : null}

        <textarea
          style={{
            ...previewTextStyle,
            fontFamily: previewFontFamily,
            color: form.style.textColor,
          }}
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          placeholder="Write your unsent archive..."
          maxLength={5000}
        />
        <div className="note-meta">
          <span>{charCount}/5000</span>
          <span>{form.visibility}</span>
        </div>
      </article>
    </section>
  );
};

export default CreateNotePage;
