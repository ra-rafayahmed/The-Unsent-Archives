import { Link } from "react-router-dom";

const REPORT_FILTERS = ["open", "resolved", "dismissed", "all"];

/**
 * One filed report: who reported what, and the moderation actions still open
 * on it. Closed reports (resolved/dismissed) show no action row.
 */
const ReportCard = ({ report, onResolve, onDeletePost, onToggleSuspend }) => {
  const r = report;

  return (
    <li className="report-card">
      <div className="report-card-head">
        <span className={`report-pill report-pill-${r.reason}`}>{r.reason}</span>
        <span className="report-meta">
          {r.targetType === "user" ? "Account" : "Note"} · filed by{" "}
          {r.reporterId ? (
            <Link to={`/profile/${r.reporterId._id}`} className="manuscript-author-link">
              @{r.reporterId.username}
            </Link>
          ) : (
            "anon"
          )}
        </span>
        <span className={`report-status status-${r.status}`}>{r.status}</span>
      </div>

      {r.note ? <p className="report-note">"{r.note}"</p> : null}

      <div className="report-target">
        {r.targetType === "user" ? (
          r.target ? (
            <Link to={`/profile/${r.target._id}`} className="report-target-row">
              <span className="writer-avatar writer-avatar-fallback">
                {(r.target.username || "?")[0].toUpperCase()}
              </span>
              <span>
                <strong>@{r.target.username}</strong>{" "}
                <span className="muted">· {r.target.reportCount || 0} report(s)</span>
              </span>
            </Link>
          ) : (
            <span className="muted">User no longer exists</span>
          )
        ) : r.target ? (
          <Link to={`/posts/${r.target._id}`} className="report-target-row">
            <span className="report-snippet">"{(r.target.content || "").slice(0, 120)}"</span>
            <span className="muted">by @{r.target.authorId?.username || "unknown"}</span>
          </Link>
        ) : (
          <span className="muted">Post no longer exists</span>
        )}
      </div>

      {r.status === "open" && (
        <div className="report-actions">
          <button
            type="button"
            className="ghost-btn small"
            onClick={() => onResolve(r._id, "resolved")}
          >
            ✓ Mark resolved
          </button>
          <button
            type="button"
            className="ghost-btn small"
            onClick={() => onResolve(r._id, "dismissed")}
          >
            ✕ Dismiss
          </button>
          {r.targetType === "post" && r.target ? (
            <button
              type="button"
              className="ghost-btn small is-danger"
              onClick={async () => {
                // Only close the report if the note was actually deleted.
                if (!(await onDeletePost(r.target._id))) return;
                await onResolve(r._id, "resolved");
              }}
            >
              🗑 Delete note
            </button>
          ) : null}
          {r.targetType === "user" && r.target ? (
            <button
              type="button"
              className="ghost-btn small is-danger"
              onClick={() => onToggleSuspend(r.target._id, r.target.isSuspended)}
            >
              {r.target.isSuspended ? "Unsuspend user" : "Suspend user"}
            </button>
          ) : null}
        </div>
      )}
    </li>
  );
};

/**
 * The reports tab: the status filter pills and the list of report cards.
 *
 * Purely presentational — the caller owns the data and every action. Deleting
 * a reported note is a two-step callback: `onDeletePost` resolves to `false`
 * when the operator cancels, in which case the report is left open.
 */
const ReportsPanel = ({
  reports = [],
  reportFilter,
  onFilterChange,
  onResolve,
  onDeletePost,
  onToggleSuspend,
}) => {
  return (
    <div className="panel admin-pane">
      <div className="row-between admin-toolbar">
        <h3 className="side-title">
          {reportFilter === "all" ? "All reports" : `${reportFilter} reports`}
        </h3>
        <div className="row-inline">
          {REPORT_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              className={s === reportFilter ? "pill active" : "pill"}
              onClick={() => onFilterChange(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {reports.length === 0 ? (
        <p className="muted">No reports here. The archive is calm.</p>
      ) : (
        <ul className="report-list">
          {reports.map((r) => (
            <ReportCard
              key={r._id}
              report={r}
              onResolve={onResolve}
              onDeletePost={onDeletePost}
              onToggleSuspend={onToggleSuspend}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

export default ReportsPanel;
