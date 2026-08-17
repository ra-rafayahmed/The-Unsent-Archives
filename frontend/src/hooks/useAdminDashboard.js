import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import { toUserMessage } from "../utils/apiError";

/**
 * Data + moderation actions behind the admin panel.
 *
 * Owns the active tab, the list filters (`sort` for users/posts, `reportFilter`
 * for reports) and the three lists themselves. Only the active tab's list is
 * fetched, and every mutation re-fetches that same list, so the numbers on
 * screen stay honest without pulling data nobody is looking at.
 *
 * Confirmation dialogs are the caller's job (see `useUserProfile.deletePost`).
 *
 * @param {object} opts
 * @param {boolean} opts.enabled  only load once the viewer is known to be an admin
 */
export default function useAdminDashboard({ enabled = true } = {}) {
  const [tab, setTab] = useState("reports");
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [reports, setReports] = useState([]);
  const [reportFilter, setReportFilter] = useState("open");
  const [sort, setSort] = useState("recent");
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [issued, setIssued] = useState(null);

  /** Re-fetch the list for the active tab. Never rejects; failures land in `error`. */
  const refresh = useCallback(async () => {
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
      setError(toUserMessage(err, "Failed to load"));
    }
  }, [tab, sort, reportFilter]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [enabled, refresh]);

  /** Delete an account and everything attached to it (caller confirms first). */
  const deleteUser = useCallback(
    async (id) => {
      await api.delete(`/admin/users/${id}`);
      setFlash("User deleted");
      refresh();
    },
    [refresh]
  );

  /** Delete a note (caller confirms first). */
  const deletePost = useCallback(
    async (id) => {
      await api.delete(`/admin/posts/${id}`);
      setFlash("Post deleted");
      refresh();
    },
    [refresh]
  );

  /** Flip a user between "user" and "admin". */
  const toggleRole = useCallback(
    async (id, currentRole) => {
      const nextRole = currentRole === "admin" ? "user" : "admin";
      await api.put(`/admin/users/${id}/role`, { role: nextRole });
      refresh();
    },
    [refresh]
  );

  /**
   * Suspend or lift a suspension. The flag is always sent explicitly — the API
   * rejects a body without a boolean `suspended` (a missing field used to read
   * as `false` and silently un-suspend).
   */
  const toggleSuspend = useCallback(
    async (id, currentlySuspended) => {
      await api.put(`/admin/users/${id}/suspend`, { suspended: !currentlySuspended });
      setFlash(currentlySuspended ? "User unsuspended" : "User suspended");
      refresh();
    },
    [refresh]
  );

  /** Mint a one-shot password reset link for `user`; the link lands in `issued`. */
  const issueResetForUser = useCallback(async (user) => {
    setFlash("");
    setError("");
    try {
      const { data } = await api.post(`/admin/users/${user._id}/issue-reset`);
      setIssued({ user, ...data });
    } catch (err) {
      setError(toUserMessage(err, "Could not issue reset"));
    }
  }, []);

  /** Close a report: `action` is "resolved" or "dismissed". */
  const resolveReport = useCallback(
    async (id, action) => {
      await api.put(`/admin/reports/${id}/resolve`, { action });
      setFlash(`Report ${action}`);
      refresh();
    },
    [refresh]
  );

  return {
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
    refresh,
    deleteUser,
    deletePost,
    toggleRole,
    toggleSuspend,
    issueResetForUser,
    resolveReport,
  };
}
