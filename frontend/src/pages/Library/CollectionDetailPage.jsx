import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Masonry from "react-masonry-css";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import NoteCard from "../../components/cards/NoteCard";
import { toUserMessage } from "../../utils/apiError";

const CollectionDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data } = await api.get(`/collections/${id}`);
      setCollection(data.collection);
    } catch (err) {
      setError(toUserMessage(err, "Failed to load collection"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const isOwner = useMemo(() => {
    return Boolean(collection?.ownerId?._id && user?.id && collection.ownerId._id === user.id);
  }, [collection, user]);

  const removePost = async (postId) => {
    setError("");
    setStatus("");

    try {
      await api.delete(`/collections/${id}/posts/${postId}`);
      setCollection((prev) => ({
        ...prev,
        postIds: (prev?.postIds || []).filter((post) => post._id !== postId),
        postCount: Math.max(0, (prev?.postCount || 0) - 1),
      }));
      setStatus("Post removed from collection");
    } catch (err) {
      setError(toUserMessage(err, "Could not remove post"));
    }
  };

  if (loading) {
    return <section className="panel">Loading collection...</section>;
  }

  if (!collection) {
    return <section className="panel">{error || "Collection not available"}</section>;
  }

  const ownerName =
    collection.ownerId?.profile?.displayName || collection.ownerId?.username || "Unknown";
  const ownerId = collection.ownerId?._id;
  const noteCount = collection.postCount || collection.postIds?.length || 0;

  return (
    <section className="library-page">
      <header className="library-hero collection-hero">
        <span className="auth-eyebrow">
          {collection.visibility === "public" ? "◆ Public shelf" : "◇ Private shelf"}
        </span>
        <h1 className="library-title">{collection.name}</h1>
        <p className="library-sub">{collection.description || "A curated stack of notes."}</p>
        <div className="collection-meta">
          <span>
            {noteCount} {noteCount === 1 ? "note" : "notes"}
          </span>
          <span className="meta-dot">·</span>
          <span>
            Curated by{" "}
            {ownerId ? (
              <Link to={`/profile/${ownerId}`} className="manuscript-author-link">
                @{collection.ownerId.username}
              </Link>
            ) : (
              ownerName
            )}
          </span>
        </div>
      </header>

      {status ? <p className="manuscript-flash">{status}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {(collection.postIds || []).length === 0 ? (
        <div className="empty-state">
          <h3>No notes on this shelf yet</h3>
          <p>
            {isOwner
              ? "Save notes from any reader to start filling this stack."
              : "Check back later — the shelf is fresh."}
          </p>
        </div>
      ) : (
        <Masonry
          breakpointCols={{ default: 3, 1100: 2, 700: 1 }}
          className="masonry-grid"
          columnClassName="masonry-col"
        >
          {(collection.postIds || []).map((post, i) => (
            <NoteCard
              key={post._id}
              post={post}
              variantSeed={i}
              canDelete={isOwner}
              onDelete={removePost}
              deleteLabel="Remove"
              canEdit={Boolean(user?.id && post.authorId?._id === user.id)}
            />
          ))}
        </Masonry>
      )}
    </section>
  );
};

export default CollectionDetailPage;
