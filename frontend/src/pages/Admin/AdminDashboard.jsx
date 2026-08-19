import PostsPanel from "../../components/admin/PostsPanel";
import ReportsPanel from "../../components/admin/ReportsPanel";
import UsersPanel from "../../components/admin/UsersPanel";
import { useAuth } from "../../context/AuthContext";
import useAdminDashboard from "../../hooks/useAdminDashboard";

const TABS = [
  { id: "reports", label: "Reports", glyph: "⚑" },
  { id: "users", label: "Users", glyph: "✦" },
  { id: "posts", label: "Notes", glyph: "✒" },
];

const AdminDashboard = () => {
  const { isAdmin } = useAuth();

  const {
    tab,
    setTab,
    users,
    posts,
    reports,
    reportFilter,
    setReportFilter,
    sort,
    setSort,
    error,
    flash,
    issued,
    setIssued,
    deleteUser: deleteUserById,
    deletePost: deletePostById,
    toggleRole,
    toggleSuspend,
    issueResetForUser,
    resolveReport,
  } = useAdminDashboard({ enabled: isAdmin });

  if (!isAdmin) {
    return <div className="panel">Admin access only.</div>;
  }

  const deleteUser = async (id) => {
    if (!window.confirm("Delete this account and all related data?")) return false;
    return deleteUserById(id);
  };

  // Returns false when the operator cancels, so callers can skip follow-up work.
  const deletePost = async (id) => {
    if (!window.confirm("Delete this post?")) return false;
    return deletePostById(id);
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
        <ReportsPanel
          reports={reports}
          reportFilter={reportFilter}
          onFilterChange={setReportFilter}
          onResolve={resolveReport}
          onDeletePost={deletePost}
          onToggleSuspend={toggleSuspend}
        />
      )}

      {tab === "users" && (
        <UsersPanel
          users={users}
          sort={sort}
          onSortChange={setSort}
          onIssueReset={issueResetForUser}
          onToggleRole={toggleRole}
          onToggleSuspend={toggleSuspend}
          onDelete={deleteUser}
        />
      )}

      {tab === "posts" && (
        <PostsPanel posts={posts} sort={sort} onSortChange={setSort} onDelete={deletePost} />
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
