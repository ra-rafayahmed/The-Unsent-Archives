import { useEffect, useState } from "react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

const CollectionsBoard = () => {
  const { user } = useAuth();
  const [collections, setCollections] = useState([]);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [error, setError] = useState("");

  const load = async () => {
    if (!user?.id) return;
    const { data } = await api.get(`/users/${user.id}/collections`);
    setCollections(data.collections || []);
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
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create collection");
    }
  };

  return (
    <section>
      <div className="panel row-between">
        <div>
          <h1>My Collections</h1>
          <p>Curate your archives.</p>
        </div>
        <div className="row-inline">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New collection name" />
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
          <button type="button" className="primary-btn" onClick={create}>Create</button>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="card-grid">
        {collections.map((c) => (
          <article key={c._id} className="panel">
            <h3>{c.name}</h3>
            <p>{c.visibility}</p>
            <p>{c.postCount || 0} notes</p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default CollectionsBoard;
