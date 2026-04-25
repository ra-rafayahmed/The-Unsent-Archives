import { useState } from "react";
import Masonry from "react-masonry-css";
import api from "../../api/axios";
import NoteCard from "../../components/cards/NoteCard";

const ExplorePage = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ posts: [], users: [], tags: [] });
  const [loading, setLoading] = useState(false);

  const onSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const { data } = await api.get("/search", { params: { q: query.trim() } });
      setResults({
        posts: data.posts || [],
        users: data.users || [],
        tags: data.tags || [],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="explore-layout">
      <div>
        <form className="search-form" onSubmit={onSearch}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes, writers, tags..." />
          <button type="submit" className="primary-btn">Search</button>
        </form>

        {loading ? <div className="panel">Searching...</div> : null}

        <Masonry breakpointCols={{ default: 2, 700: 1 }} className="masonry-grid" columnClassName="masonry-col">
          {results.posts.map((post) => (
            <NoteCard key={post._id} post={post} />
          ))}
        </Masonry>
      </div>

      <aside className="side-stack">
        <div className="panel">
          <h3>Writers</h3>
          {results.users.map((u) => (
            <p key={u._id}>@{u.username}</p>
          ))}
        </div>
        <div className="panel">
          <h3>Tags</h3>
          <div className="chip-row">
            {results.tags.map((t) => (
              <span key={t._id} className="chip">#{t.slug}</span>
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
};

export default ExplorePage;
