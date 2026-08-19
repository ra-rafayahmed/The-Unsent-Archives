import { Link } from "react-router-dom";

/**
 * The users tab: the sort control and one row per account, with the four
 * moderation actions (issue reset, flip role, suspend, delete).
 *
 * Purely presentational — the caller owns the data and every action, including
 * the confirm dialog in front of `onDelete`.
 */
const UsersPanel = ({
  users = [],
  sort,
  onSortChange,
  onIssueReset,
  onToggleRole,
  onToggleSuspend,
  onDelete,
}) => {
  return (
    <div className="panel admin-pane">
      <div className="row-between admin-toolbar">
        <h3 className="side-title">Users</h3>
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
        {users.map((u) => (
          <div key={u._id} className="admin-row admin-row-v2">
            <div className="admin-row-main">
              <Link to={`/profile/${u._id}`} className="manuscript-author-link">
                @{u.username}
              </Link>
              <span className="muted">{u.email}</span>
              <div className="row-inline">
                <span className={`pill ${u.role === "admin" ? "active" : ""}`}>{u.role}</span>
                {u.isSuspended ? <span className="pill is-warn">suspended</span> : null}
                {u.reportCount ? <span className="pill is-warn">⚑ {u.reportCount}</span> : null}
              </div>
            </div>
            <div className="row-inline">
              <button type="button" className="ghost-btn small" onClick={() => onIssueReset(u)}>
                Issue reset
              </button>
              <button
                type="button"
                className="ghost-btn small"
                onClick={() => onToggleRole(u._id, u.role)}
              >
                Make {u.role === "admin" ? "user" : "admin"}
              </button>
              <button
                type="button"
                className="ghost-btn small"
                onClick={() => onToggleSuspend(u._id, u.isSuspended)}
              >
                {u.isSuspended ? "Unsuspend" : "Suspend"}
              </button>
              <button
                type="button"
                className="ghost-btn small is-danger"
                onClick={() => onDelete(u._id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UsersPanel;
