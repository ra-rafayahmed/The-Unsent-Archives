import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";

const BG_PRESETS = ["#ffffff", "#fff4ed", "#f7efe2", "#f1f6f0", "#f9ecee"];

const CreateNotePage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [tagsInput, setTagsInput] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    content: "",
    visibility: "public",
    style: { font: "serif", background: "#ffffff", textColor: "#1c1c1a" },
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
        style: p.style || { font: "serif", background: "#ffffff", textColor: "#1c1c1a" },
        media: p.media || [],
      });

      const imageMedia = (p.media || []).find((m) => m.type === "image");
      const audioMedia = (p.media || []).find((m) => m.type === "audio");
      setImageUrl(imageMedia?.url || "");
      setAudioUrl(audioMedia?.url || "");
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

    if (audioUrl.trim()) {
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

    const { data } = await api.post("/uploads", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    const uploaded = data.asset;

    if (mediaType === "image") {
      setImageUrl(uploaded.url);
    } else {
      setAudioUrl(uploaded.url);
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
    if (form.style.font === "monospace") return "ui-monospace, SFMono-Regular, Menlo, monospace";
    if (form.style.font === "sans") return '"Work Sans", sans-serif';
    return '"Newsreader", serif';
  }, [form.style.font]);

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
            <option value="serif">Serif</option>
            <option value="sans">Minimal</option>
            <option value="monospace">Typewriter</option>
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

        <label>
          Image URL
          <input
            type="url"
            placeholder="https://..."
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </label>

        <label>
          Upload image file
          <input type="file" accept="image/*" onChange={onImageFileChange} />
        </label>
        {isUploadingImage ? <p>Uploading image...</p> : null}

        <label>
          Audio URL
          <input
            type="url"
            placeholder="https://..."
            value={audioUrl}
            onChange={(e) => setAudioUrl(e.target.value)}
          />
        </label>

        <label>
          Upload audio file
          <input type="file" accept="audio/*" onChange={onAudioFileChange} />
        </label>
        {isUploadingAudio ? <p>Uploading audio...</p> : null}

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
          style={{ fontFamily: previewFontFamily }}
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
