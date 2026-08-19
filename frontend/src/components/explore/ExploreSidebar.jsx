import { Link } from "react-router-dom";

/** One row in a "writers" panel: portrait (or initial) plus the handle. */
const WriterRow = ({ user, children }) => (
  <li>
    <Link to={`/profile/${user._id}`} className="writer-row">
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt="" className="nav-avatar writer-avatar" />
      ) : (
        <span className="writer-avatar writer-avatar-fallback">
          {(user.username || "?")[0].toUpperCase()}
        </span>
      )}
      {children}
    </Link>
  </li>
);

/**
 * The Explore page's side rail: trending tags, the writers panel (search hits
 * while searching, top voices while browsing) and the archivist's quote.
 */
const ExploreSidebar = ({
  trendingTags = [],
  onTagSelect,
  showingSearch = false,
  searchUsers = [],
  topWriters = [],
}) => {
  return (
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
                onClick={() => onTagSelect(t.slug)}
              >
                #{t.slug}
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted">No tags trending yet.</p>
        )}
      </div>

      {showingSearch && searchUsers.length > 0 && (
        <div className="panel side-panel">
          <h3 className="side-title">Writers</h3>
          <ul className="writer-list">
            {searchUsers.map((u) => (
              <WriterRow key={u._id} user={u}>
                <span>
                  <strong>@{u.username}</strong>
                  {u.profile?.displayName && (
                    <span className="muted"> · {u.profile.displayName}</span>
                  )}
                </span>
              </WriterRow>
            ))}
          </ul>
        </div>
      )}

      {!showingSearch && topWriters.length > 0 && (
        <div className="panel side-panel">
          <h3 className="side-title">Voices to follow</h3>
          <ul className="writer-list">
            {topWriters.map((u) => (
              <WriterRow key={u._id} user={u}>
                <strong>@{u.username}</strong>
              </WriterRow>
            ))}
          </ul>
        </div>
      )}

      <div className="panel side-panel quote-panel">
        <p className="quote-mark">"</p>
        <p className="quote-body">
          Some letters were never meant to be sent. They were meant to be kept.
        </p>
        <span className="quote-attr">— the archivist</span>
      </div>
    </aside>
  );
};

export default ExploreSidebar;
