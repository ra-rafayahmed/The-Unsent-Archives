import { Link } from "react-router-dom";

/**
 * The notes tab: the sort control and one row per note, each linking to the
 * note itself and offering a delete.
 *
 * Purely presentational — the caller owns the data and the action, including
 * the confirm dialog in front of `onDelete`.
 */
const PostsPanel = ({ posts = [], sort, onSortChange, onDelete }) => {
  return (
    <div className="panel admin-pane">
      <div className="row-between admin-toolbar">
        <h3 className="side-title">Notes</h3>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="analytics-post-select"
        >
          <option value="recent">Sort: recent</option>
          <option value="reports">Sort: most reported</option>
        </select>
      </div>

      <div className="admin-table">
        {posts.map((p) => (
          <div key={p._id} className="admin-row admin-row-v2">
            <div className="admin-row-main">
              <Link to={`/posts/${p._id}`} className="manuscript-author-link">
                {(p.content || "").slice(0, 80) || "Untitled"}
              </Link>
              <span className="muted">
                by @{p.authorId?.username || "unknown"} · {p.visibility}
              </span>
              <div className="row-inline">
                {p.reportCount ? <span className="pill is-warn">⚑ {p.reportCount}</span> : null}
                <span className="muted small-meta">
                  {p.viewCount || 0} reads · {p.reactionCount || 0} hearts
                </span>
              </div>
            </div>
            <button
              type="button"
              className="ghost-btn small is-danger"
              onClick={() => onDelete(p._id)}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PostsPanel;
