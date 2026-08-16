import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

const TABS = [
  { id: "reports", label: "Reports", glyph: "⚑" },
  { id: "users", label: "Users", glyph: "✦" },
  { id: "posts", label: "Notes", glyph: "✒" },
];

const AdminDashboard = () => {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState("reports");
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [reports, setReports] = useState([]);
  const [reportFilter, setReportFilter] = useState("open");
  const [sort, setSort] = useState("recent");
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [issued, setIssued] = useState(null);

  const refresh = async () => {
    setError("");
    try {
      if (tab === "users") {
        const { data } = await api.get(`/admin/users`, { params: { sort } });
        setUsers(data.users || []);
      } else if (tab === "posts") {
        const { data } = await api.get(`/admin/posts`, { params: { sort } });
        setPosts(data.posts || []);
      } else if (tab === "reports") {
        const { data } = await api.get(`/admin/reports`, { params: { status: reportFilter } });
        setReports(data.reports || []);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load");
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    refresh();
  }, [isAdmin, tab, sort, reportFilter]);

  if (!isAdmin) {
    return <div className="panel">Admin access only.</div>;
  }

  const deleteUser = async (id) => {
    if (!window.confirm("Delete this account and all related data?")) return;
    await api.delete(`/admin/users/${id}`);
    setFlash("User deleted");
    refresh();
  };

  const deletePost = async (id) => {
    if (!window.confirm("Delete this post?")) return;
    await api.delete(`/admin/posts/${id}`);
    setFlash("Post deleted");
    refresh();
  };

  const toggleRole = async (id, currentRole) => {
    const nextRole = currentRole === "admin" ? "user" : "admin";
    await api.put(`/admin/users/${id}/role`, { role: nextRole });
    refresh();
  };

  const toggleSuspend = async (id, currentlySuspended) => {
    await api.put(`/admin/users/${id}/suspend`, { suspended: !currentlySuspended });
    setFlash(currentlySuspended ? "User unsuspended" : "User suspended");
    refresh();
  };

  const issueResetForUser = async (u) => {
    setFlash("");
    setError("");
    try {
      const { data } = await api.post(`/admin/users/${u._id}/issue-reset`);
      setIssued({ user: u, ...data });
    } catch (err) {
      setError(err?.response?.data?.message || "Could not issue reset");
    }
  };

  const resolveReport = async (id, action) => {
    await api.put(`/admin/reports/${id}/resolve`, { action });
    setFlash(`Report ${action}`);
    refresh();
  };

  return (
    <section className="admin-page">
      <header className="library-hero admin-hero">
        <span className="auth-eyebrow">Moderation</span>
        <h1 className="library-title">Admin panel</h1>
        <p className="library-sub">
          Review reports, recover lost accounts, and keep the archive a kind place.
        </p>
      </header>

      <div className="filter-row-pill admin-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={t.id === tab ? "pill-tab active" : "pill-tab"}
            onClick={() => setTab(t.id)}
          >
            <span className="pill-tab-icon" aria-hidden="true">
              {t.glyph}
            </span>
            {t.label}
          </button>
        ))}
      </div>

      {flash ? <p className="manuscript-flash">{flash}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {tab === "reports" && (
        <div className="panel admin-pane">
          <div className="row-between admin-toolbar">
            <h3 className="side-title">
              {reportFilter === "all" ? "All reports" : `${reportFilter} reports`}
            </h3>
            <div className="row-inline">
              {["open", "resolved", "dismissed", "all"].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={s === reportFilter ? "pill active" : "pill"}
                  onClick={() => setReportFilter(s)}
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
                <li key={r._id} className="report-card">
                  <div className="report-card-head">
                    <span className={`report-pill report-pill-${r.reason}`}>{r.reason}</span>
                    <span className="report-meta">
                      {r.targetType === "user" ? "Account" : "Note"} · filed by{" "}
                      {r.reporterId ? (
                        <Link
                          to={`/profile/${r.reporterId._id}`}
                          className="manuscript-author-link"
                        >
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
                        <span className="report-snippet">
                          "{(r.target.content || "").slice(0, 120)}"
                        </span>
                        <span className="muted">
                          by @{r.target.authorId?.username || "unknown"}
                        </span>
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
                        onClick={() => resolveReport(r._id, "resolved")}
                      >
                        ✓ Mark resolved
                      </button>
                      <button
                        type="button"
                        className="ghost-btn small"
                        onClick={() => resolveReport(r._id, "dismissed")}
                      >
                        ✕ Dismiss
                      </button>
                      {r.targetType === "post" && r.target ? (
                        <button
                          type="button"
                          className="ghost-btn small is-danger"
                          onClick={async () => {
                            await deletePost(r.target._id);
                            await resolveReport(r._id, "resolved");
                          }}
                        >
                          🗑 Delete note
                        </button>
                      ) : null}
                      {r.targetType === "user" && r.target ? (
                        <button
                          type="button"
                          className="ghost-btn small is-danger"
                          onClick={() => toggleSuspend(r.target._id, r.target.isSuspended)}
                        >
                          {r.target.isSuspended ? "Unsuspend user" : "Suspend user"}
                        </button>
                      ) : null}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "users" && (
        <div className="panel admin-pane">
          <div className="row-between admin-toolbar">
            <h3 className="side-title">Users</h3>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
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
                  <button
                    type="button"
                    className="ghost-btn small"
                    onClick={() => issueResetForUser(u)}
                  >
                    Issue reset
                  </button>
                  <button
                    type="button"
                    className="ghost-btn small"
                    onClick={() => toggleRole(u._id, u.role)}
                  >
                    Make {u.role === "admin" ? "user" : "admin"}
                  </button>
                  <button
                    type="button"
                    className="ghost-btn small"
                    onClick={() => toggleSuspend(u._id, u.isSuspended)}
                  >
                    {u.isSuspended ? "Unsuspend" : "Suspend"}
                  </button>
                  <button
                    type="button"
                    className="ghost-btn small is-danger"
                    onClick={() => deleteUser(u._id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "posts" && (
        <div className="panel admin-pane">
          <div className="row-between admin-toolbar">
            <h3 className="side-title">Notes</h3>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
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
                  onClick={() => deletePost(p._id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {issued && (
        <div className="modal-backdrop" onClick={() => setIssued(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Reset link issued</h3>
            <p className="muted">
              Share this with <strong>@{issued.user.username}</strong>. It works once and expires in
              30 minutes.
            </p>
            <code className="auth-callout-code">{issued.resetLink}</code>
            <div className="row-inline" style={{ justifyContent: "flex-end", marginTop: "0.6rem" }}>
              <button
                type="button"
                className="ghost-btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(issued.resetLink);
                  } catch {
                    // clipboard unavailable (insecure context / permissions) — ignore
                  }
                }}
              >
                Copy link
              </button>
              <button type="button" className="primary-btn" onClick={() => setIssued(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminDashboard;
