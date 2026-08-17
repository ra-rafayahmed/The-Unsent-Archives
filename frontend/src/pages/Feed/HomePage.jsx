import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Masonry from "react-masonry-css";
import api from "../../api/axios";
import NoteCard from "../../components/cards/NoteCard";
import { useAuth } from "../../context/AuthContext";
import { toUserMessage } from "../../utils/apiError";

const FEED_FILTERS = [
  { id: "ForYou", label: "For you" },
  { id: "All", label: "All" },
  { id: "Trending", label: "Trending" },
  { id: "Recent", label: "Recent" },
  { id: "Following", label: "Following" },
];

const HomePage = () => {
  const { isAuthenticated, user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [activeFilter, setActiveFilter] = useState(isAuthenticated ? "ForYou" : "All");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  // Bumped by "Try again"; setting the same filter again would not re-run the effect.
  const [reloadToken, setReloadToken] = useState(0);

  const filters = useMemo(
    () =>
      isAuthenticated
        ? FEED_FILTERS
        : FEED_FILTERS.filter((f) => f.id !== "Following" && f.id !== "ForYou"),
    [isAuthenticated]
  );

  const fetchFeed = async ({ refresh = false } = {}) => {
    let data;
    if (activeFilter === "ForYou" && isAuthenticated) {
      if (refresh) {
        ({ data } = await api.post("/recommendations/refresh", { limit: 30 }));
      } else {
        ({ data } = await api.get("/recommendations", { params: { limit: 30 } }));
      }
    } else if (activeFilter === "Trending") {
      ({ data } = await api.get("/feed/trending"));
    } else if (activeFilter === "Following" && isAuthenticated) {
      ({ data } = await api.get("/feed/following"));
    } else {
      const params = activeFilter === "Recent" ? { sort: "recent" } : {};
      ({ data } = await api.get("/feed", { params }));
    }
    return data?.posts || [];
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const next = await fetchFeed();
        if (!cancelled) {
          setPosts(next);
          setLoadError("");
        }
      } catch (err) {
        // Without this the rejection escaped unhandled and the reader saw the
        // "shelf is quiet" empty state, indistinguishable from an empty feed.
        if (!cancelled) setLoadError(toUserMessage(err, "Could not load the feed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, isAuthenticated, reloadToken]);

  const refreshForYou = async () => {
    if (activeFilter !== "ForYou") return;
    setRefreshing(true);
    try {
      const next = await fetchFeed({ refresh: true });
      setPosts(next);
      setLoadError("");
    } catch (err) {
      setLoadError(toUserMessage(err, "Could not refresh your recommendations"));
    } finally {
      setRefreshing(false);
    }
  };

  const breakpointCols = useMemo(() => ({ default: 3, 1100: 2, 700: 1 }), []);

  return (
    <section className="home-page">
      <header className="hero-paper">
        <span className="hero-tape hero-tape-l" aria-hidden="true" />
        <span className="hero-tape hero-tape-r" aria-hidden="true" />

        <span className="hero-eyebrow">
          {isAuthenticated
            ? `Welcome back, ${user?.username || "writer"},`
            : "A quiet shelf for unsent words,"}
        </span>

        <h1 className="hero-title">
          {isAuthenticated ? (
            <>
              What never made it
              <br />
              out today?
            </>
          ) : (
            <>
              The Unsent
              <br />
              Archives
            </>
          )}
          <svg className="hero-underline" viewBox="0 0 320 20" aria-hidden="true">
            <path
              d="M4 12 C 60 4, 140 18, 200 8 S 300 14, 316 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </h1>

        <p className="hero-sub">
          Notes, letters, and confessions left on the page.
          <br />
          Read, reflect, and add to the shelf.
        </p>

        <div className="hero-cta">
          {isAuthenticated ? (
            <Link to="/write" className="primary-btn">
              <span aria-hidden="true">✒</span> New Note
            </Link>
          ) : (
            <Link to="/register" className="primary-btn">
              <span aria-hidden="true">✒</span> Start writing
            </Link>
          )}
          <Link to="/explore" className="ghost-btn">
            <span aria-hidden="true">☰</span> Browse Stacks
          </Link>
        </div>

        <svg className="hero-quill" viewBox="0 0 120 140" aria-hidden="true">
          <path
            d="M30 130 C 50 100, 75 70, 100 25 C 104 18, 110 18, 112 24 C 108 50, 90 80, 60 110 C 48 122, 38 128, 30 130 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            className="hero-quill-stroke"
          />
          <path
            d="M30 130 L 22 138"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            className="hero-quill-stroke"
          />
          <ellipse
            cx="20"
            cy="134"
            rx="9"
            ry="4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M70 60 L 84 74 M62 70 L 76 84 M54 80 L 68 94"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
          />
          <path
            d="M30 130 C 50 132, 80 132, 100 128"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            fill="none"
            opacity="0.55"
          />
        </svg>
      </header>

      <div className="feed-controls">
        <div className="filter-row filter-row-pill">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={filter.id === activeFilter ? "pill-tab active" : "pill-tab"}
              onClick={() => setActiveFilter(filter.id)}
            >
              <span className="pill-tab-icon" aria-hidden="true">
                {filter.id === "ForYou"
                  ? "✨"
                  : filter.id === "Trending"
                    ? "🔥"
                    : filter.id === "Recent"
                      ? "🕒"
                      : filter.id === "Following"
                        ? "♡"
                        : "✦"}
              </span>
              {filter.label}
            </button>
          ))}
        </div>

        {activeFilter === "ForYou" && isAuthenticated ? (
          <button
            type="button"
            className="ghost-btn small feed-refresh"
            onClick={refreshForYou}
            disabled={refreshing}
            title="Recompute your recommendations"
          >
            <span className={refreshing ? "feed-refresh-glyph spin" : "feed-refresh-glyph"}>↻</span>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="card-skeleton-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card-skeleton" />
          ))}
        </div>
      ) : posts.length ? (
        <Masonry
          breakpointCols={breakpointCols}
          className="masonry-grid"
          columnClassName="masonry-col"
        >
          {posts.map((post, i) => (
            <NoteCard key={post._id} post={post} variantSeed={i} />
          ))}
        </Masonry>
      ) : loadError ? (
        <div className="empty-state" role="alert">
          <h3>Could not load the feed</h3>
          <p>{loadError}</p>
          <button type="button" className="ghost-btn" onClick={() => setReloadToken((n) => n + 1)}>
            Try again
          </button>
        </div>
      ) : (
        <div className="empty-state">
          <h3>{activeFilter === "ForYou" ? "Still learning your taste" : "The shelf is quiet"}</h3>
          <p>
            {activeFilter === "ForYou"
              ? "React to a few notes, follow some writers, and we'll pick pages that fit your shelf."
              : activeFilter === "Following"
                ? "Follow a few writers and their words will gather here."
                : "Be the first to leave something for the archive."}
          </p>
          {isAuthenticated && (
            <Link to="/write" className="primary-btn">
              Write a note
            </Link>
          )}
        </div>
      )}
    </section>
  );
};

export default HomePage;
