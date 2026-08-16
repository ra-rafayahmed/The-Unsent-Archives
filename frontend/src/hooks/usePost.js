import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";

/**
 * Loads everything the single-note page needs for post `id`:
 * the post itself, its reaction summary, the viewer's collections (for the
 * "save to" picker) and whether the viewer follows the author.
 *
 * `user` is the current auth user (or null). Reloaders are returned so
 * mutations (react, comment, follow…) can refresh just what changed.
 */
export default function usePost(id, user) {
  const [post, setPost] = useState(null);
  const [reactions, setReactions] = useState({});
  const [collections, setCollections] = useState([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [isFollowing, setIsFollowing] = useState(false);
  const [error, setError] = useState("");

  const userId = user?.id;

  const reloadPost = useCallback(async () => {
    const { data } = await api.get(`/posts/${id}`);
    setPost(data.post);
    return data.post;
  }, [id]);

  const reloadReactions = useCallback(async () => {
    const { data } = await api.get(`/posts/${id}/reactions`);
    setReactions(data.reactions || {});
  }, [id]);

  const reloadCollections = useCallback(async () => {
    if (!userId) {
      setCollections([]);
      return;
    }
    const { data } = await api.get(`/users/${userId}/collections`);
    const rows = data.collections || [];
    setCollections(rows);
    setSelectedCollectionId((current) => current || (rows.length > 0 ? rows[0]._id : ""));
  }, [userId]);

  // Post + reactions + view event whenever the id changes.
  useEffect(() => {
    let cancelled = false;
    setError("");
    Promise.all([reloadPost(), reloadReactions()]).catch((err) => {
      if (!cancelled) setError(err?.response?.data?.message || "Could not load this note");
    });
    api.post("/events", { type: "view", postId: id }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, reloadPost, reloadReactions]);

  // Viewer's collections whenever the viewer changes.
  useEffect(() => {
    reloadCollections().catch(() => {});
  }, [reloadCollections]);

  // Follow status once we know who wrote the post.
  const authorId = post?.authorId?._id;
  const isAnonymous = Boolean(post?.isAnonymous);
  useEffect(() => {
    let cancelled = false;
    if (!userId || !authorId || isAnonymous || authorId === userId) {
      setIsFollowing(false);
      return undefined;
    }
    api
      .get(`/users/${authorId}/follow/status`)
      .then(({ data }) => {
        if (!cancelled) setIsFollowing(Boolean(data.isFollowing));
      })
      .catch(() => {
        if (!cancelled) setIsFollowing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authorId, isAnonymous, userId]);

  return {
    post,
    reactions,
    collections,
    selectedCollectionId,
    setSelectedCollectionId,
    isFollowing,
    setIsFollowing,
    loadError: error,
    reloadPost,
    reloadReactions,
    reloadCollections,
  };
}
