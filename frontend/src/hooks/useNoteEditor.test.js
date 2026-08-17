import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import api from "../api/axios";
import useNoteEditor from "./useNoteEditor";

vi.mock("../api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

const savedPost = {
  _id: "p1",
  content: "dear you",
  visibility: "private",
  style: {
    font: "monospace",
    background: "#171717",
    textColor: "#ffffff",
    fontSize: 1.4,
    lineHeight: 1.8,
    letterSpacing: 0.05,
    textAlign: "left",
  },
  media: [
    { url: "http://cdn/cover.png", type: "image" },
    { url: "http://cdn/song.mp3", type: "audio" },
  ],
  tagSlugs: ["regret", "rain"],
};

const mockPost = (post) => {
  api.get.mockImplementation((url) => {
    if (url === "/posts/p1") return Promise.resolve({ data: { post } });
    return Promise.reject(new Error(`unmocked GET ${url}`));
  });
};

/** Mounts the hook in edit mode and waits for the note to be prefilled. */
const renderLoaded = async (post = savedPost) => {
  mockPost(post);
  const hook = renderHook(() => useNoteEditor("p1"));
  await waitFor(() => expect(hook.result.current.form.content).toBe(post.content || ""));
  return hook;
};

const defaultStyle = {
  font: "serif",
  background: "#ffffff",
  textColor: "#1c1c1a",
  fontSize: 1.15,
  lineHeight: 1.6,
  letterSpacing: 0,
  textAlign: "center",
};

describe("useNoteEditor", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.put.mockReset();
  });

  it("starts from an empty note and fetches nothing when composing", () => {
    const { result } = renderHook(() => useNoteEditor(undefined));

    expect(result.current.form).toEqual({
      content: "",
      visibility: "public",
      style: defaultStyle,
      media: [],
    });
    expect(result.current.tagsInput).toBe("");
    expect(result.current.imageUrl).toBe("");
    expect(result.current.audioUrl).toBe("");
    expect(result.current.spotifyUrl).toBe("");
    expect(result.current.error).toBe("");
    expect(result.current.isEditing).toBe(false);
    expect(api.get).not.toHaveBeenCalled();
  });

  it("loads the note being edited into the form, media fields and tags", async () => {
    const { result } = await renderLoaded();

    expect(api.get).toHaveBeenCalledWith("/posts/p1");
    expect(result.current.isEditing).toBe(true);
    expect(result.current.form.visibility).toBe("private");
    expect(result.current.form.style).toEqual(savedPost.style);
    expect(result.current.form.media).toEqual(savedPost.media);
    expect(result.current.imageUrl).toBe("http://cdn/cover.png");
    expect(result.current.audioUrl).toBe("http://cdn/song.mp3");
    expect(result.current.spotifyUrl).toBe("");
    expect(result.current.tagsInput).toBe("regret, rain");
  });

  it("routes a Spotify track to the spotify field, not the direct audio field", async () => {
    const { result } = await renderLoaded({
      ...savedPost,
      media: [{ url: "https://open.spotify.com/track/abc123", type: "audio" }],
    });

    expect(result.current.spotifyUrl).toBe("https://open.spotify.com/track/abc123");
    expect(result.current.audioUrl).toBe("");
    expect(result.current.imageUrl).toBe("");
  });

  it("shows an anonymous note as the 'anonymous' visibility and fills missing style/tags with defaults", async () => {
    const { result } = await renderLoaded({
      _id: "p1",
      content: "no style at all",
      visibility: "public",
      isAnonymous: true,
    });

    expect(result.current.form.visibility).toBe("anonymous");
    expect(result.current.form.style).toEqual(defaultStyle);
    expect(result.current.form.media).toEqual([]);
    expect(result.current.tagsInput).toBe("");
  });

  it("reports a note that could not be loaded instead of leaving a blank composer", async () => {
    api.get.mockRejectedValue({ response: { status: 404, data: { message: "Post not found" } } });
    const { result } = renderHook(() => useNoteEditor("p1"));

    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/posts/p1"));
    // Otherwise pressing Update would PUT an empty note over the real one.
    await waitFor(() => expect(result.current.loadError).toBe("Post not found"));
    expect(result.current.form.content).toBe("");
    // The submit-error channel stays clear; this is a load failure.
    expect(result.current.error).toBe("");
  });

  it("saveNote POSTs a new note with normalised tags and trimmed media", async () => {
    api.post.mockResolvedValueOnce({ data: {} });
    const { result } = renderHook(() => useNoteEditor(undefined));

    act(() => {
      result.current.setField("content", "hello archive");
      result.current.setField("visibility", "anonymous");
      result.current.setStyleField("font", "georgia");
      result.current.setTagsInput("  Rain , ,regret ");
      result.current.setImageUrl("  http://cdn/cover.png  ");
      result.current.setAudioUrl(" http://cdn/song.mp3 ");
    });

    let ok;
    await act(async () => {
      ok = await result.current.saveNote();
    });

    expect(ok).toBe(true);
    expect(api.put).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith("/posts", {
      content: "hello archive",
      visibility: "anonymous",
      style: { ...defaultStyle, font: "georgia" },
      media: [
        { url: "http://cdn/cover.png", type: "image" },
        { url: "http://cdn/song.mp3", type: "audio" },
      ],
      tagSlugs: ["rain", "regret"],
    });
  });

  it("saveNote PUTs to the note being edited", async () => {
    const { result } = await renderLoaded();
    api.put.mockResolvedValueOnce({ data: {} });

    act(() => result.current.setField("content", "edited"));
    let ok;
    await act(async () => {
      ok = await result.current.saveNote();
    });

    expect(ok).toBe(true);
    expect(api.post).not.toHaveBeenCalled();
    expect(api.put).toHaveBeenCalledWith("/posts/p1", {
      content: "edited",
      visibility: "private",
      style: savedPost.style,
      // NOTE: the payload's media is rebuilt from the image/audio fields, so it
      // replaces (rather than extends) whatever the loaded note carried.
      media: savedPost.media,
      tagSlugs: ["regret", "rain"],
    });
  });

  it("saveNote prefers a Spotify url over a direct audio url and omits blank media", async () => {
    api.post.mockResolvedValueOnce({ data: {} });
    const { result } = renderHook(() => useNoteEditor(undefined));

    act(() => {
      result.current.setImageUrl("   ");
      result.current.setSpotifyUrl("https://open.spotify.com/track/abc123");
      result.current.setAudioUrl("http://cdn/song.mp3");
    });
    await act(async () => {
      await result.current.saveNote();
    });

    expect(api.post.mock.calls[0][1].media).toEqual([
      { url: "https://open.spotify.com/track/abc123", type: "audio" },
    ]);
  });

  it("saveNote surfaces the API error, returns false and clears it on the next attempt", async () => {
    const { result } = renderHook(() => useNoteEditor(undefined));

    api.post.mockRejectedValueOnce({ response: { data: { message: "Content is required" } } });
    let ok;
    await act(async () => {
      ok = await result.current.saveNote();
    });
    expect(ok).toBe(false);
    expect(result.current.error).toBe("Content is required");

    api.post.mockResolvedValueOnce({ data: {} });
    await act(async () => {
      ok = await result.current.saveNote();
    });
    expect(ok).toBe(true);
    expect(result.current.error).toBe("");
  });

  it("saveNote falls back to a generic message when the failure carries none", async () => {
    const { result } = renderHook(() => useNoteEditor(undefined));
    api.post.mockRejectedValueOnce({ response: { status: 400, data: {} } });

    await act(async () => {
      await result.current.saveNote();
    });
    expect(result.current.error).toBe("Could not save note");
  });

  it("uploadImage posts multipart form data and stores the hosted url", async () => {
    api.post.mockResolvedValueOnce({ data: { asset: { url: "http://cdn/up.png" } } });
    const { result } = renderHook(() => useNoteEditor(undefined));

    let ok;
    await act(async () => {
      ok = await result.current.uploadImage(new File(["x"], "up.png", { type: "image/png" }));
    });

    expect(ok).toBe(true);
    expect(api.post).toHaveBeenCalledWith("/uploads", expect.any(FormData));
    expect(result.current.imageUrl).toBe("http://cdn/up.png");
    expect(result.current.isUploadingImage).toBe(false);
    expect(result.current.error).toBe("");
  });

  it("uploadAudio stores the hosted url and drops any spotify url", async () => {
    api.post.mockResolvedValueOnce({ data: { asset: { url: "http://cdn/up.mp3" } } });
    const { result } = renderHook(() => useNoteEditor(undefined));

    act(() => result.current.setSpotifyUrl("https://open.spotify.com/track/abc123"));
    await act(async () => {
      await result.current.uploadAudio(new File(["x"], "up.mp3", { type: "audio/mpeg" }));
    });

    expect(result.current.audioUrl).toBe("http://cdn/up.mp3");
    expect(result.current.spotifyUrl).toBe("");
    expect(result.current.isUploadingAudio).toBe(false);
  });

  it("reports upload failures per media type without touching the urls", async () => {
    const { result } = renderHook(() => useNoteEditor(undefined));

    api.post.mockRejectedValueOnce({ response: { status: 413, data: { message: "Max 15MB" } } });
    let ok;
    await act(async () => {
      ok = await result.current.uploadImage(new File(["x"], "big.png", { type: "image/png" }));
    });
    expect(ok).toBe(false);
    expect(result.current.error).toBe("Max 15MB");
    expect(result.current.imageUrl).toBe("");
    expect(result.current.isUploadingImage).toBe(false);

    api.post.mockRejectedValueOnce({ response: { status: 400, data: {} } });
    await act(async () => {
      await result.current.uploadAudio(new File(["x"], "bad.mp3", { type: "audio/mpeg" }));
    });
    expect(result.current.error).toBe("Audio upload failed");
    expect(result.current.audioUrl).toBe("");

    api.post.mockRejectedValueOnce({ response: { status: 400, data: {} } });
    await act(async () => {
      await result.current.uploadImage(new File(["x"], "bad.png", { type: "image/png" }));
    });
    expect(result.current.error).toBe("Image upload failed");
  });

  it("uploads nothing when no file was picked", async () => {
    const { result } = renderHook(() => useNoteEditor(undefined));

    let ok;
    await act(async () => {
      ok = await result.current.uploadImage(undefined);
    });
    expect(ok).toBe(false);
    await act(async () => {
      ok = await result.current.uploadAudio(null);
    });
    expect(ok).toBe(false);
    expect(api.post).not.toHaveBeenCalled();
  });
});
