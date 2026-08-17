import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import { toUserMessage } from "../utils/apiError";

/** Style block a brand-new note starts from (also the fallback when a saved note omits fields). */
const defaultStyle = () => ({
  font: "serif",
  background: "#ffffff",
  textColor: "#1c1c1a",
  fontSize: 1.15,
  lineHeight: 1.6,
  letterSpacing: 0,
  textAlign: "center",
});

const emptyForm = () => ({
  content: "",
  visibility: "public",
  style: defaultStyle(),
  media: [],
});

/** Spotify links are embedded, so they are kept apart from plain audio URLs. */
const isSpotifyTrack = (url) => /spotify\.com\/track\//i.test(url);

/**
 * Everything the note composer needs that is not rendering: loading the note
 * being edited, uploading cover image / soundtrack files, and creating or
 * updating the note.
 *
 * @param {string|undefined} id  post id when editing (`/write/:id`), undefined when composing
 *
 * Navigation is left to the caller: `saveNote()` resolves `true` on success and
 * `false` after a failure (the reason is exposed as `error`).
 */
export default function useNoteEditor(id) {
  const [form, setForm] = useState(emptyForm);
  const [tagsInput, setTagsInput] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [loadError, setLoadError] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [error, setError] = useState("");

  // Load the note being edited. Composing a new note fetches nothing.
  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;

    api
      .get(`/posts/${id}`)
      .then(({ data }) => {
        if (cancelled) return;
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
        const isSpotify = isSpotifyTrack(existingAudioUrl);
        setSpotifyUrl(isSpotify ? existingAudioUrl : "");
        setAudioUrl(isSpotify ? "" : existingAudioUrl);
        setTagsInput((p.tagSlugs || []).join(", "));
      })
      .catch((err) => {
        // A silent failure left an empty composer that would PUT a blank note
        // over the real one if the writer pressed Update.
        if (!cancelled) setLoadError(toUserMessage(err, "Could not load this note"));
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  /** Patch one top-level form field (`content`, `visibility`). */
  const setField = useCallback((name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
  }, []);

  /** Patch one entry of the style block. */
  const setStyleField = useCallback((name, value) => {
    setForm((f) => ({ ...f, style: { ...f.style, [name]: value } }));
  }, []);

  /**
   * The media array as the API wants it: at most one image and one audio track,
   * where a Spotify link wins over a direct audio URL.
   */
  const buildMedia = useCallback(() => {
    const media = [];

    if (imageUrl.trim()) {
      media.push({ url: imageUrl.trim(), type: "image" });
    }

    if (spotifyUrl.trim()) {
      media.push({ url: spotifyUrl.trim(), type: "audio" });
    } else if (audioUrl.trim()) {
      media.push({ url: audioUrl.trim(), type: "audio" });
    }

    return media;
  }, [imageUrl, spotifyUrl, audioUrl]);

  /** Create (POST) or update (PUT) the note. Resolves true on success. */
  const saveNote = useCallback(async () => {
    setError("");

    const payload = {
      ...form,
      media: buildMedia(),
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
      return true;
    } catch (err) {
      setError(toUserMessage(err, "Could not save note"));
      return false;
    }
  }, [form, buildMedia, tagsInput, id]);

  /**
   * Upload one file to the asset store and point the matching field at it.
   * Resolves true on success, false when there was no file or the upload failed.
   */
  const uploadMedia = useCallback(async (file, mediaType) => {
    if (!file) return false;

    setError("");
    const setBusy = mediaType === "image" ? setIsUploadingImage : setIsUploadingAudio;
    setBusy(true);

    try {
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
      return true;
    } catch (err) {
      setError(
        toUserMessage(err, mediaType === "image" ? "Image upload failed" : "Audio upload failed")
      );
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const uploadImage = useCallback((file) => uploadMedia(file, "image"), [uploadMedia]);
  const uploadAudio = useCallback((file) => uploadMedia(file, "audio"), [uploadMedia]);

  return {
    form,
    setField,
    setStyleField,
    tagsInput,
    setTagsInput,
    imageUrl,
    setImageUrl,
    audioUrl,
    setAudioUrl,
    spotifyUrl,
    setSpotifyUrl,
    loadError,
    isUploadingImage,
    isUploadingAudio,
    error,
    isEditing: Boolean(id),
    uploadImage,
    uploadAudio,
    saveNote,
  };
}
