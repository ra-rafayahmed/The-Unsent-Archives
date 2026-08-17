import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import api from "../api/axios";
import useUserProfile from "./useUserProfile";

vi.mock("../api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const profileDoc = {
  _id: "u1",
  username: "pen",
  bio: "hi",
  avatarUrl: "",
  profile: { displayName: "Pen", location: "here" },
  followerCount: 2,
};

const mockGet = ({ isFollowing = false, collections, posts } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === "/users/u1") return Promise.resolve({ data: { user: profileDoc } });
    if (url === "/users/u1/posts")
      return Promise.resolve({ data: { posts: posts ?? [{ _id: "p1" }, { _id: "p2" }] } });
    if (url === "/users/u1/collections")
      return Promise.resolve({
        data: {
          collections: collections ?? [
            { _id: "c1", visibility: "public" },
            { _id: "c2", visibility: "private" },
          ],
        },
      });
    if (url === "/users/u1/follow/status") return Promise.resolve({ data: { isFollowing } });
    return Promise.reject(new Error(`unmocked GET ${url}`));
  });
};

describe("useUserProfile", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.put.mockReset();
    api.delete.mockReset();
  });

  it("does nothing without a userId", () => {
    const { result } = renderHook(() => useUserProfile(undefined));
    expect(result.current.profile).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
  });

  it("loads profile, posts and only public collections for a visitor; checks follow status", async () => {
    mockGet({ isFollowing: true });
    const { result } = renderHook(() =>
      useUserProfile("u1", { own: false, viewer: { id: "viewer" } })
    );
    await waitFor(() => expect(result.current.profile).toEqual(profileDoc));
    expect(result.current.posts).toHaveLength(2);
    expect(result.current.collections.map((c) => c._id)).toEqual(["c1"]);
    expect(result.current.isFollowing).toBe(true);
    expect(api.get).toHaveBeenCalledWith("/users/u1/follow/status");
  });

  it("shows private collections on my own profile and skips the follow lookup", async () => {
    mockGet();
    const { result } = renderHook(() => useUserProfile("u1", { own: true, viewer: { id: "u1" } }));
    await waitFor(() => expect(result.current.profile).not.toBeNull());
    expect(result.current.collections.map((c) => c._id)).toEqual(["c1", "c2"]);
    expect(api.get).not.toHaveBeenCalledWith("/users/u1/follow/status");
  });

  it("exposes loadError when the profile request fails", async () => {
    api.get.mockRejectedValue({ response: { data: { message: "User not found" } } });
    const { result } = renderHook(() => useUserProfile("u1"));
    await waitFor(() => expect(result.current.loadError).toBe("User not found"));
  });

  it("saveProfile PUTs merged profile fields, updates state and returns the user", async () => {
    mockGet();
    const { result } = renderHook(() => useUserProfile("u1", { own: true, viewer: { id: "u1" } }));
    await waitFor(() => expect(result.current.profile).not.toBeNull());

    const updated = {
      ...profileDoc,
      bio: "new",
      profile: { displayName: "New", location: "here" },
    };
    api.put.mockResolvedValueOnce({ data: { user: updated } });

    let ret;
    await act(async () => {
      ret = await result.current.saveProfile({ bio: "new", displayName: "New", avatarUrl: "" });
    });
    expect(api.put).toHaveBeenCalledWith("/users/u1", {
      bio: "new",
      avatarUrl: "",
      profile: { displayName: "New", location: "here" },
    });
    expect(ret).toEqual(updated);
    expect(result.current.profile).toEqual(updated);
    expect(result.current.status).toBe("Profile updated");
  });

  it("saveProfile surfaces the API error and returns null", async () => {
    mockGet();
    const { result } = renderHook(() => useUserProfile("u1", { own: true, viewer: { id: "u1" } }));
    await waitFor(() => expect(result.current.profile).not.toBeNull());
    api.put.mockRejectedValueOnce({ response: { data: { message: "Bio too long" } } });
    let ret;
    await act(async () => {
      ret = await result.current.saveProfile({ bio: "x", displayName: "", avatarUrl: "" });
    });
    expect(ret).toBeNull();
    expect(result.current.error).toBe("Bio too long");
  });

  it("uploadAvatar posts multipart and returns the hosted url", async () => {
    mockGet();
    const { result } = renderHook(() => useUserProfile("u1", { own: true, viewer: { id: "u1" } }));
    await waitFor(() => expect(result.current.profile).not.toBeNull());
    api.post.mockResolvedValueOnce({ data: { asset: { url: "http://x/a.png" } } });

    let url;
    await act(async () => {
      url = await result.current.uploadAvatar(new File(["x"], "a.png", { type: "image/png" }));
    });
    expect(url).toBe("http://x/a.png");
    expect(api.post).toHaveBeenCalledWith("/uploads", expect.any(FormData));
    expect(result.current.isUploadingAvatar).toBe(false);
    expect(result.current.status).toMatch(/Avatar uploaded/);
    // no file → no request
    await act(async () => {
      url = await result.current.uploadAvatar(undefined);
    });
    expect(url).toBe("");
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it("toggleFollow follows/unfollows and adjusts followerCount optimistically", async () => {
    mockGet({ isFollowing: false });
    const { result } = renderHook(() =>
      useUserProfile("u1", { own: false, viewer: { id: "viewer" } })
    );
    await waitFor(() => expect(result.current.profile).not.toBeNull());
    api.post.mockResolvedValueOnce({ data: {} });
    api.delete.mockResolvedValueOnce({ data: {} });

    await act(() => result.current.toggleFollow());
    expect(api.post).toHaveBeenCalledWith("/users/u1/follow");
    expect(result.current.isFollowing).toBe(true);
    expect(result.current.profile.followerCount).toBe(3);
    expect(result.current.status).toBe("Following");

    await act(() => result.current.toggleFollow());
    expect(api.delete).toHaveBeenCalledWith("/users/u1/follow");
    expect(result.current.isFollowing).toBe(false);
    expect(result.current.profile.followerCount).toBe(2);
  });

  it("toggleFollow is a no-op on my own profile or when signed out", async () => {
    mockGet();
    const own = renderHook(() => useUserProfile("u1", { own: true, viewer: { id: "u1" } }));
    await waitFor(() => expect(own.result.current.profile).not.toBeNull());
    await act(() => own.result.current.toggleFollow());
    const anon = renderHook(() => useUserProfile("u1", { own: false, viewer: null }));
    await waitFor(() => expect(anon.result.current.profile).not.toBeNull());
    await act(() => anon.result.current.toggleFollow());
    expect(api.post).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("deletePost removes the post from the list", async () => {
    mockGet();
    const { result } = renderHook(() => useUserProfile("u1", { own: true, viewer: { id: "u1" } }));
    await waitFor(() => expect(result.current.posts).toHaveLength(2));
    api.delete.mockResolvedValueOnce({ data: {} });
    await act(() => result.current.deletePost("p1"));
    expect(api.delete).toHaveBeenCalledWith("/posts/p1");
    expect(result.current.posts.map((p) => p._id)).toEqual(["p2"]);
  });
});
