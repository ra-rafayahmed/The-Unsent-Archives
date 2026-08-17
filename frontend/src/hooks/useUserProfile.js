import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import { toUserMessage } from "../utils/apiError";

/**
 * Data + mutations for the profile page of `userId`.
 *
 * @param {string|undefined} userId   profile being viewed
 * @param {object} opts
 * @param {boolean} opts.own          viewing my own profile (shows private collections, no follow)
 * @param {object|null} opts.viewer   the signed-in user (or null)
 */
export default function useUserProfile(userId, { own = false, viewer = null } = {}) {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  const viewerId = viewer?.id;

  const clearMessages = useCallback(() => {
    setStatus("");
    setError("");
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;

    const load = async () => {
      setLoadError("");
      try {
        const [pRes, postRes, colRes] = await Promise.all([
          api.get(`/users/${userId}`),
          api.get(`/users/${userId}/posts`),
          api.get(`/users/${userId}/collections`),
        ]);
        if (cancelled) return;
        const loaded = pRes.data.user;
        setProfile(loaded);
        setPosts(postRes.data.posts || []);
        setCollections(
          (colRes.data.collections || []).filter((c) => c.visibility === "public" || own)
        );

        if (!own && viewerId && loaded?._id !== viewerId) {
          try {
            const followRes = await api.get(`/users/${userId}/follow/status`);
            if (!cancelled) setIsFollowing(Boolean(followRes.data.isFollowing));
          } catch {
            if (!cancelled) setIsFollowing(false);
          }
        } else {
          setIsFollowing(false);
        }
      } catch (err) {
        if (!cancelled) setLoadError(toUserMessage(err, "Could not load profile"));
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, own, viewerId]);

  /** Delete one of the listed posts (caller handles any confirm dialog). */
  const deletePost = useCallback(async (postId) => {
    await api.delete(`/posts/${postId}`);
    setPosts((prev) => prev.filter((p) => p._id !== postId));
  }, []);

  /**
   * Persist bio / displayName / avatarUrl. Resolves with the updated user, or
   * null on failure (error message is exposed via `error`).
   */
  const saveProfile = useCallback(
    async ({ bio, displayName, avatarUrl }) => {
      if (!userId) return null;
      clearMessages();
      try {
        const payload = {
          bio,
          avatarUrl,
          profile: { ...(profile?.profile || {}), displayName },
        };
        const { data } = await api.put(`/users/${userId}`, payload);
        setProfile(data.user);
        setStatus("Profile updated");
        return data.user;
      } catch (err) {
        setError(toUserMessage(err, "Could not update profile"));
        return null;
      }
    },
    [userId, profile, clearMessages]
  );

  /** Upload an avatar file; resolves with the hosted URL ("" on failure). */
  const uploadAvatar = useCallback(
    async (file) => {
      if (!file) return "";
      clearMessages();
      setIsUploadingAvatar(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const { data } = await api.post("/uploads", formData);
        setStatus("Avatar uploaded. Save profile to apply.");
        return data.asset?.url || "";
      } catch (err) {
        setError(toUserMessage(err, "Avatar upload failed"));
        return "";
      } finally {
        setIsUploadingAvatar(false);
      }
    },
    [clearMessages]
  );

  const toggleFollow = useCallback(async () => {
    if (!userId || !viewerId || own) return;
    clearMessages();
    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        await api.delete(`/users/${userId}/follow`);
        setIsFollowing(false);
        setProfile((prev) => ({
          ...prev,
          followerCount: Math.max(0, (prev?.followerCount || 0) - 1),
        }));
        setStatus("Unfollowed");
      } else {
        await api.post(`/users/${userId}/follow`);
        setIsFollowing(true);
        setProfile((prev) => ({ ...prev, followerCount: (prev?.followerCount || 0) + 1 }));
        setStatus("Following");
      }
    } catch (err) {
      setError(toUserMessage(err, "Could not update follow status"));
    } finally {
      setIsFollowLoading(false);
    }
  }, [userId, viewerId, own, isFollowing, clearMessages]);

  return {
    profile,
    posts,
    collections,
    isFollowing,
    isFollowLoading,
    isUploadingAvatar,
    status,
    error,
    loadError,
    clearMessages,
    deletePost,
    saveProfile,
    uploadAvatar,
    toggleFollow,
  };
}
