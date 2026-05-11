import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Masonry from "react-masonry-css";
import api from "../../api/axios";
import NoteCard from "../../components/cards/NoteCard";

const SORTS = [
  { id: "trending", label: "Trending" },
  { id: "popular", label: "Top of all time" },
  { id: "recent", label: "Fresh ink" },
];

const ExplorePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery);
  const [results, setResults] = useState({ posts: [], users: [], tags: [] });
  const [searching, setSearching] = useState(false);

  const [sort, setSort] = useState("trending");
  const [topPosts, setTopPosts] = useState([]);
  const [trendingTags, setTrendingTags] = useState([]);
  const [topWriters, setTopWriters] = useState([]);
  const [topLoading, setTopLoading] = useState(true);

  const breakpointCols = useMemo(
    () => ({ default: 3, 1100: 2, 700: 1 }),
    []
  );

  // Top posts + trending tags load
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setTopLoading(true);
      try {
        const [postsRes, tagsRes] = await Promise.all([
          sort === "trending"
            ? api.get("/feed/trending")
            : api.get("/feed", {
                params: { sort: sort === "popular" ? "popular" : "recent", limit: 24 },
              }),
          api.get("/tags/trending"),
        ]);

        if (cancelled) return;
        setTopPosts(postsRes.data.posts || []);
        setTrendingTags((tagsRes.data.tags || []).slice(0, 12));

        const writerMap = new Map();
        (postsRes.data.posts || []).forEach((post) => {
          const author = post?.authorId;
          if (!author || post.isAnonymous) return;
          const id = author._id || author.id;
          if (!id) return;
          const entry = writerMap.get(id) || {
            _id: id,
            username: author.username,
            avatarUrl: author.avatarUrl,
            score: 0,
          };
          entry.score += (post.reactionCount || 0) + (post.viewCount || 0) / 5;
          writerMap.set(id, entry);
        });
        setTopWriters(
          [...writerMap.values()].sort((a, b) => b.score - a.score).slice(0, 6)
        );
      } finally {
        if (!cancelled) setTopLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [sort]);

  // Run search when query in URL changes
  useEffect(() => {
    const q = activeQuery.trim();
    if (!q) {
      setResults({ posts: [], users: [], tags: [] });
      return;
    }
    let cancelled = false;
    const run = async () => {
      setSearching(true);
      try {
        const { data } = await api.get("/search", { params: { q } });
        if (cancelled) return;
        setResults({
          posts: data.posts || [],
          users: data.users || [],
          tags: data.tags || [],
        });
      } finally {
        if (!cancelled) setSearching(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [activeQuery]);

  const onSearch = (e) => {
    e.preventDefault();
    const trimmed = query.trim();
    setActiveQuery(trimmed);
    if (trimmed) {
      setSearchParams({ q: trimmed });
    } else {
      setSearchParams({});
    }
  };

  const clearSearch = () => {
    setQuery("");
    setActiveQuery("");
    setSearchParams({});
  };

  const showingSearch = Boolean(activeQuery);
  const postsToShow = showingSearch ? results.posts : topPosts;

  return (
    <section className="explore-layout">
      <div>
        <header className="explore-hero">
          <span className="auth-eyebrow">The shelf at large</span>
          <h1 className="library-title">Explore the Archives</h1>
          <p className="library-sub">
            Wander the stacks. Find writers, themes, and notes that have caught
            the most light.
          </p>

          <form className="search-form explore-search" onSubmit={onSearch}>
            <span className="explore-search-glyph" aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes, writers, tags..."
            />
            <button type="submit" className="primary-btn">
              Search
            </button>
            {showingSearch && (
              <button type="button" className="ghost-btn" onClick={clearSearch}>
                Clear
              </button>
            )}
          </form>

          {!showingSearch && (
            <div className="filter-row-pill">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={s.id === sort ? "pill-tab active" : "pill-tab"}
                  onClick={() => setSort(s.id)}
                >
                  <span className="pill-tab-icon" aria-hidden="true">
                    {s.id === "trending" ? "🔥" : s.id === "popular" ? "✦" : "🕒"}
                  </span>
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </header>

        {showingSearch && (
          <div className="explore-meta">
            {searching ? (
              <span>Searching the stacks...</span>
            ) : (
              <span>
                {results.posts.length} note
                {results.posts.length === 1 ? "" : "s"} for{" "}
                <strong>"{activeQuery}"</strong>
              </span>
            )}
          </div>
        )}

        {topLoading && !showingSearch ? (
          <div className="card-skeleton-grid">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card-skeleton" />
            ))}
          </div>
        ) : postsToShow.length ? (
          <Masonry
            breakpointCols={breakpointCols}
            className="masonry-grid"
            columnClassName="masonry-col"
          >
            {postsToShow.map((post) => (
              <NoteCard key={post._id} post={post} />
            ))}
          </Masonry>
        ) : (
          <div className="empty-state">
            <h3>{showingSearch ? "No matches yet" : "The shelf is quiet"}</h3>
            <p>
              {showingSearch
                ? "Try a different word, or clear the search to browse top notes."
                : "Be the first to leave a note for the archive."}
            </p>
            {!showingSearch && (
              <Link to="/write" className="primary-btn">
                Write a note
              </Link>
            )}
          </div>
        )}
      </div>

      <aside className="side-stack">
        <div className="panel side-panel">
          <h3 className="side-title">Trending tags</h3>
          {trendingTags.length ? (
            <div className="chip-row">
              {trendingTags.map((t) => (
                <Link
                  key={t._id}
                  to={`/explore?q=${encodeURIComponent(t.slug)}`}
                  className="chip chip-link"
                  onClick={() => {
                    setQuery(t.slug);
                    setActiveQuery(t.slug);
                  }}
                >
                  #{t.slug}
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted">No tags trending yet.</p>
          )}
        </div>

        {showingSearch && results.users.length > 0 && (
          <div className="panel side-panel">
            <h3 className="side-title">Writers</h3>
            <ul className="writer-list">
              {results.users.map((u) => (
                <li key={u._id}>
                  <Link to={`/profile/${u._id}`} className="writer-row">
                    {u.avatarUrl ? (
                      <img
                        src={u.avatarUrl}
                        alt=""
                        className="nav-avatar writer-avatar"
                      />
                    ) : (
                      <span className="writer-avatar writer-avatar-fallback">
                        {(u.username || "?")[0].toUpperCase()}
                      </span>
                    )}
                    <span>
                      <strong>@{u.username}</strong>
                      {u.profile?.displayName && (
                        <span className="muted">
                          {" "}
                          · {u.profile.displayName}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!showingSearch && topWriters.length > 0 && (
          <div className="panel side-panel">
            <h3 className="side-title">Voices to follow</h3>
            <ul className="writer-list">
              {topWriters.map((u) => (
                <li key={u._id}>
                  <Link to={`/profile/${u._id}`} className="writer-row">
                    {u.avatarUrl ? (
                      <img
                        src={u.avatarUrl}
                        alt=""
                        className="nav-avatar writer-avatar"
                      />
                    ) : (
                      <span className="writer-avatar writer-avatar-fallback">
                        {(u.username || "?")[0].toUpperCase()}
                      </span>
                    )}
                    <strong>@{u.username}</strong>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="panel side-panel quote-panel">
          <p className="quote-mark">"</p>
          <p className="quote-body">
            Some letters were never meant to be sent. They were meant to be
            kept.
          </p>
          <span className="quote-attr">— the archivist</span>
        </div>
      </aside>
    </section>
  );
};

export default ExplorePage;
