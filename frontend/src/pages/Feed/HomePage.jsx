import { useEffect, useMemo, useState } from "react";
import Masonry from "react-masonry-css";
import api from "../../api/axios";
import NoteCard from "../../components/cards/NoteCard";

const FEED_FILTERS = ["All", "Trending", "Recent"];

const HomePage = () => {
  const [posts, setPosts] = useState([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (activeFilter === "Trending") {
          const { data } = await api.get("/feed/trending");
          setPosts(data.posts || []);
        } else {
          const params = activeFilter === "Recent" ? { sort: "recent" } : {};
          const { data } = await api.get("/feed", { params });
          setPosts(data.posts || []);
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [activeFilter]);

  const breakpointCols = useMemo(() => ({ default: 3, 900: 2, 600: 1 }), []);

  return (
    <section>
      <div className="filter-row">
        {FEED_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            className={filter === activeFilter ? "pill active" : "pill"}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="panel">Loading feed...</div>
      ) : (
        <Masonry breakpointCols={breakpointCols} className="masonry-grid" columnClassName="masonry-col">
          {posts.map((post) => (
            <NoteCard key={post._id} post={post} />
          ))}
        </Masonry>
      )}
    </section>
  );
};

export default HomePage;
