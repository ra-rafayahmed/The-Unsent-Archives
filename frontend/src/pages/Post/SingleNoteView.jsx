import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

const SingleNoteView = () => {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const [post, setPost] = useState(null);
  const [commentsText, setCommentsText] = useState("");
  const [reactions, setReactions] = useState({});
  const [collections, setCollections] = useState([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const loadPost = async () => {
    const { data } = await api.get(`/posts/${id}`);
    setPost(data.post);
  };

  const loadReactions = async () => {
    const { data } = await api.get(`/posts/${id}/reactions`);
    setReactions(data.reactions || {});
  };

  const loadCollections = async () => {
    if (!user?.id) return;

    const { data } = await api.get(`/users/${user.id}/collections`);
    const rows = data.collections || [];
    setCollections(rows);
    if (rows.length > 0 && !selectedCollectionId) {
      setSelectedCollectionId(rows[0]._id);
    }
  };

  useEffect(() => {
    loadPost();
    loadReactions();
    api.post("/events", { type: "view", postId: id }).catch(() => {});
  }, [id]);

  useEffect(() => {
    loadCollections().catch(() => {});
  }, [user?.id]);

  const react = async (type) => {
    setError("");
    setStatus("");

    try {
      await api.post(`/posts/${id}/reactions`, { type });
      await loadReactions();
      setStatus("Reaction updated");
    } catch (err) {
      setError(err?.response?.data?.message || "Could not update reaction");
    }
  };

  const comment = async () => {
    if (!commentsText.trim()) return;
    setError("");

    try {
      await api.post(`/posts/${id}/comments`, { text: commentsText.trim() });
      setCommentsText("");
      await loadPost();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not add comment");
    }
  };

  const saveToCollection = async () => {
    if (!selectedCollectionId) return;
    setError("");
    setStatus("");

    try {
      await api.post(`/collections/${selectedCollectionId}/posts`, { postId: id });
      setStatus("Saved to collection");
    } catch (err) {
      setError(err?.response?.data?.message || "Could not save post to collection");
    }
  };

  if (!post) return <div className="panel">Loading note...</div>;

  return (
    <section className="single-wrap">
      <article className="single-card">
        <h1>{post.content}</h1>

        <div className="chip-row">
          {(post.tagSlugs || []).map((tag) => (
            <span key={tag} className="chip">#{tag}</span>
          ))}
        </div>

        <div className="reaction-strip">
          {[
            ["like", "❤️ Love"],
            ["love", "🫂 Felt"],
            ["sad", "💧 Cried"],
            ["wow", "✨ Saved"],
          ].map(([type, label]) => (
            <button key={type} type="button" className="pill" onClick={() => react(type)}>
              {label} ({reactions[type] || 0})
            </button>
          ))}
        </div>

        {isAuthenticated ? (
          <div className="panel">
            <h3>Save to Collection</h3>
            {collections.length === 0 ? (
              <p>Create a collection first in your library.</p>
            ) : (
              <div className="row-inline">
                <select value={selectedCollectionId} onChange={(e) => setSelectedCollectionId(e.target.value)}>
                  {collections.map((c) => (
                    <option key={c._id} value={c._id}>{c.name} ({c.visibility})</option>
                  ))}
                </select>
                <button type="button" className="primary-btn" onClick={saveToCollection}>Save</button>
              </div>
            )}
          </div>
        ) : null}

        {status ? <p>{status}</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <div className="panel">
          <h3>Letters to the Writer</h3>
          <textarea value={commentsText} onChange={(e) => setCommentsText(e.target.value)} placeholder="Write a response..." />
          <button type="button" className="primary-btn" onClick={comment}>Post</button>

          <div className="comment-list">
            {(post.comments || []).map((c) => (
              <div key={c._id} className="comment-item">
                <strong>{c.userId?.username || "Writer"}</strong>
                <p>{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </article>
    </section>
  );
};

export default SingleNoteView;
