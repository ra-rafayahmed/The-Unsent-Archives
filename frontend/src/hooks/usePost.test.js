import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import api from "../api/axios";
import usePost from "./usePost";

vi.mock("../api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const post = { _id: "p1", content: "hello", authorId: { _id: "author", username: "w" } };

const mockGet = (overrides = {}) => {
  api.get.mockImplementation((url) => {
    if (url === "/posts/p1") return Promise.resolve({ data: { post: overrides.post ?? post } });
    if (url === "/posts/p1/reactions")
      return Promise.resolve({ data: { reactions: overrides.reactions ?? { like: 2 } } });
    if (url.endsWith("/collections"))
      return Promise.resolve({ data: { collections: overrides.collections ?? [] } });
    if (url.endsWith("/follow/status"))
      return Promise.resolve({ data: { isFollowing: overrides.isFollowing ?? false } });
    return Promise.reject(new Error(`unmocked GET ${url}`));
  });
  api.post.mockResolvedValue({ data: {} });
};

describe("usePost", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
  });

  it("loads the post and reactions and logs a view event", async () => {
    mockGet();
    const { result } = renderHook(() => usePost("p1", null));

    expect(result.current.post).toBeNull();
    await waitFor(() => expect(result.current.post).toEqual(post));
    expect(result.current.reactions).toEqual({ like: 2 });
    expect(api.post).toHaveBeenCalledWith("/events", { type: "view", postId: "p1" });
    // anonymous viewer: no collections, no follow lookup
    expect(api.get).not.toHaveBeenCalledWith(expect.stringMatching(/\/collections$/));
    expect(api.get).not.toHaveBeenCalledWith(expect.stringMatching(/follow\/status$/));
    expect(result.current.isFollowing).toBe(false);
  });

  it("loads the viewer's collections and preselects the first one", async () => {
    mockGet({
      collections: [
        { _id: "c1", name: "A" },
        { _id: "c2", name: "B" },
      ],
    });
    const { result } = renderHook(() => usePost("p1", { id: "viewer" }));

    await waitFor(() => expect(result.current.collections).toHaveLength(2));
    expect(api.get).toHaveBeenCalledWith("/users/viewer/collections");
    expect(result.current.selectedCollectionId).toBe("c1");

    act(() => result.current.setSelectedCollectionId("c2"));
    expect(result.current.selectedCollectionId).toBe("c2");
  });

  it("looks up follow status for a signed-in viewer who is not the author", async () => {
    mockGet({ isFollowing: true });
    const { result } = renderHook(() => usePost("p1", { id: "viewer" }));
    await waitFor(() => expect(result.current.isFollowing).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/users/author/follow/status");
  });

  it("skips the follow lookup for the author's own post and for anonymous posts", async () => {
    mockGet();
    const own = renderHook(() => usePost("p1", { id: "author" }));
    await waitFor(() => expect(own.result.current.post).not.toBeNull());
    expect(api.get).not.toHaveBeenCalledWith("/users/author/follow/status");

    api.get.mockReset();
    mockGet({ post: { ...post, isAnonymous: true } });
    const anon = renderHook(() => usePost("p1", { id: "viewer" }));
    await waitFor(() => expect(anon.result.current.post).not.toBeNull());
    expect(api.get).not.toHaveBeenCalledWith("/users/author/follow/status");
  });

  it("exposes a load error when the post request fails", async () => {
    api.get.mockRejectedValue({ response: { data: { message: "This post is private" } } });
    api.post.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => usePost("p1", null));
    await waitFor(() => expect(result.current.loadError).toBe("This post is private"));
    expect(result.current.post).toBeNull();
  });

  it("reloadReactions refetches only the reaction summary", async () => {
    mockGet();
    const { result } = renderHook(() => usePost("p1", null));
    await waitFor(() => expect(result.current.post).not.toBeNull());

    api.get.mockClear();
    mockGet({ reactions: { like: 3, wow: 1 } });
    await act(() => result.current.reloadReactions());
    expect(result.current.reactions).toEqual({ like: 3, wow: 1 });
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith("/posts/p1/reactions");
  });
});
