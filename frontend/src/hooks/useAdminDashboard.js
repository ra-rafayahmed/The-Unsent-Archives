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
  /**
   * Run a moderation call, turning a failure into a visible message instead of
   * an unhandled rejection escaping an onClick handler.
   * @returns {Promise<boolean>} whether the action succeeded
   */
  const runAction = useCallback(
    async (fn, { success, failure }) => {
      setError("");
      setFlash("");
      try {
        await fn();
        if (success) setFlash(success);
        refresh();
        return true;
      } catch (err) {
        setError(toUserMessage(err, failure));
        return false;
      }
    },
    [refresh]
  );

  const deleteUser = useCallback(
    (id) =>
      runAction(() => api.delete(`/admin/users/${id}`), {
        success: "User deleted",
        failure: "Could not delete the user",
      }),
    [runAction]
  );

  /** Delete a note (caller confirms first). */
  const deletePost = useCallback(
    (id) =>
      runAction(() => api.delete(`/admin/posts/${id}`), {
        success: "Post deleted",
        failure: "Could not delete the post",
      }),
    [runAction]
  );

  /** Flip a user between "user" and "admin". */
  const toggleRole = useCallback(
    (id, currentRole) => {
      const nextRole = currentRole === "admin" ? "user" : "admin";
      return runAction(() => api.put(`/admin/users/${id}/role`, { role: nextRole }), {
        failure: "Could not change the role",
      });
    },
    [runAction]
  );

  /**
   * Suspend or lift a suspension. The flag is always sent explicitly — the API
   * rejects a body without a boolean `suspended` (a missing field used to read
   * as `false` and silently un-suspend).
   */
  const toggleSuspend = useCallback(
    (id, currentlySuspended) =>
      runAction(() => api.put(`/admin/users/${id}/suspend`, { suspended: !currentlySuspended }), {
        success: currentlySuspended ? "User unsuspended" : "User suspended",
        failure: "Could not update the suspension",
      }),
    [runAction]
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
    (id, action) =>
      runAction(() => api.put(`/admin/reports/${id}/resolve`, { action }), {
        success: `Report ${action}`,
        failure: "Could not close the report",
      }),
    [runAction]
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
