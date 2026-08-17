import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { toUserMessage } from "../../utils/apiError";

const CollectionsBoard = () => {
  const { user } = useAuth();
  const [collections, setCollections] = useState([]);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState("");

  const load = async () => {
    if (!user?.id) return;
    // Without this catch a failed request left the board showing the "no
    // shelves yet" empty state, which reads as "you have none" rather than
    // "we could not load them".
    try {
      const { data } = await api.get(`/users/${user.id}/collections`);
      setCollections(data.collections || []);
      setLoadError("");
    } catch (err) {
      setLoadError(toUserMessage(err, "Could not load your shelves"));
    }
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const create = async () => {
    if (!name.trim()) return;
    setError("");

    try {
      await api.post("/collections", { name: name.trim(), visibility });
      setName("");
      setCreating(false);
      await load();
    } catch (err) {
      setError(toUserMessage(err, "Failed to create collection"));
    }
  };

  return (
    <section className="library-page">
      <header className="library-hero">
        <span className="auth-eyebrow">Your shelves</span>
        <h1 className="library-title">My Library</h1>
        <p className="library-sub">
          Curated stacks of unsent letters. Mark them private to keep them close, or public to share
          the spine of your archive.
        </p>

        <div className="library-cta">
          <button
            type="button"
            className={creating ? "ghost-btn" : "primary-btn"}
            onClick={() => setCreating((v) => !v)}
          >
            {creating ? "Cancel" : "✦ New collection"}
          </button>
        </div>

        {creating && (
          <div className="library-create">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Collection name (e.g. Letters at Midnight)"
              autoFocus
            />
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
              <option value="private">Private shelf</option>
              <option value="public">Public shelf</option>
            </select>
            <button type="button" className="primary-btn" onClick={create}>
              Create
            </button>
          </div>
        )}
        {error ? <p className="error">{error}</p> : null}
      </header>

      {collections.length ? (
        <div className="shelf-grid">
          {collections.map((c, i) => (
            <Link
              key={c._id}
              to={`/collections/${c._id}`}
              className="shelf-card"
              style={{ "--shelf-tilt": `${((i % 3) - 1) * 0.6}deg` }}
            >
              <span className="shelf-spine" aria-hidden="true" />
              <span className="shelf-tape" aria-hidden="true" />
              <div className="shelf-card-body">
                <span className="shelf-eyebrow">
                  {c.visibility === "public" ? "◆ Public shelf" : "◇ Private shelf"}
                </span>
                <h3 className="shelf-name">{c.name}</h3>
                <p className="shelf-count">
                  {c.postCount || 0} {c.postCount === 1 ? "note" : "notes"}
                </p>
              </div>
              <span className="shelf-corner" aria-hidden="true" />
            </Link>
          ))}
        </div>
      ) : loadError ? (
        <div className="empty-state" role="alert">
          <h3>Could not load your shelves</h3>
          <p>{loadError}</p>
          <button type="button" className="ghost-btn" onClick={load}>
            Try again
          </button>
        </div>
      ) : (
        <div className="empty-state">
          <h3>No shelves yet</h3>
          <p>Create your first collection above and start filing your favorite notes.</p>
        </div>
      )}
    </section>
  );
};

export default CollectionsBoard;
