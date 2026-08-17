import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import api from "../api/axios";
import useAdminDashboard from "./useAdminDashboard";

vi.mock("../api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const userRow = { _id: "u1", username: "pen", email: "pen@x.io", role: "user", isSuspended: false };
const postRow = { _id: "p1", content: "a note" };
const reportRow = { _id: "r1", reason: "spam", status: "open", targetType: "post" };

const mockLists = ({ users = [userRow], posts = [postRow], reports = [reportRow] } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === "/admin/users") return Promise.resolve({ data: { users } });
    if (url === "/admin/posts") return Promise.resolve({ data: { posts } });
    if (url === "/admin/reports") return Promise.resolve({ data: { reports } });
    return Promise.reject(new Error(`unmocked GET ${url}`));
  });
};

/** How many times a given list endpoint was fetched. */
const getCalls = (url) => api.get.mock.calls.filter(([u]) => u === url).length;

/** Mount with reports already loaded (the default tab). */
const mountLoaded = async (opts) => {
  mockLists(opts);
  const view = renderHook(() => useAdminDashboard());
  await waitFor(() => expect(view.result.current.reports).toHaveLength(1));
  return view;
};

describe("useAdminDashboard", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.put.mockReset();
    api.delete.mockReset();
  });

  it("fetches nothing until enabled", () => {
    mockLists();
    const { result } = renderHook(() => useAdminDashboard({ enabled: false }));
    expect(api.get).not.toHaveBeenCalled();
    expect(result.current.reports).toEqual([]);
    expect(result.current.tab).toBe("reports");
  });

  it("loads open reports for the default tab", async () => {
    const { result } = await mountLoaded();
    expect(api.get).toHaveBeenCalledWith("/admin/reports", { params: { status: "open" } });
    expect(result.current.reports).toEqual([reportRow]);
    // only the active tab is fetched
    expect(getCalls("/admin/users")).toBe(0);
    expect(getCalls("/admin/posts")).toBe(0);
  });

  it("loads users when the users tab is selected", async () => {
    const { result } = await mountLoaded();
    act(() => result.current.setTab("users"));
    await waitFor(() => expect(result.current.users).toEqual([userRow]));
    expect(api.get).toHaveBeenCalledWith("/admin/users", { params: { sort: "recent" } });
  });

  it("loads posts when the notes tab is selected", async () => {
    const { result } = await mountLoaded();
    act(() => result.current.setTab("posts"));
    await waitFor(() => expect(result.current.posts).toEqual([postRow]));
    expect(api.get).toHaveBeenCalledWith("/admin/posts", { params: { sort: "recent" } });
  });

  it("re-fetches the active list when sort changes", async () => {
    const { result } = await mountLoaded();
    act(() => result.current.setTab("users"));
    await waitFor(() => expect(getCalls("/admin/users")).toBe(1));
    act(() => result.current.setSort("reports"));
    await waitFor(() => expect(getCalls("/admin/users")).toBe(2));
    expect(api.get).toHaveBeenLastCalledWith("/admin/users", { params: { sort: "reports" } });
  });

  it("re-fetches reports when the status filter changes", async () => {
    const { result } = await mountLoaded();
    act(() => result.current.setReportFilter("all"));
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith("/admin/reports", { params: { status: "all" } })
    );
    expect(result.current.reportFilter).toBe("all");
  });

  it("tolerates a response without the list key", async () => {
    api.get.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useAdminDashboard());
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(result.current.reports).toEqual([]);
  });

  it("surfaces the API message when a list fails to load", async () => {
    api.get.mockRejectedValue({ response: { data: { message: "Admins only" } } });
    const { result } = renderHook(() => useAdminDashboard());
    await waitFor(() => expect(result.current.error).toBe("Admins only"));
  });

  it("falls back to 'Failed to load' when the failure carries no message", async () => {
    api.get.mockRejectedValue({ response: { status: 400, data: {} } });
    const { result } = renderHook(() => useAdminDashboard());
    await waitFor(() => expect(result.current.error).toBe("Failed to load"));
  });

  it("deleteUser DELETEs the account, flashes and re-fetches", async () => {
    const { result } = await mountLoaded();
    act(() => result.current.setTab("users"));
    await waitFor(() => expect(getCalls("/admin/users")).toBe(1));

    api.delete.mockResolvedValueOnce({ data: {} });
    await act(() => result.current.deleteUser("u1"));

    expect(api.delete).toHaveBeenCalledWith("/admin/users/u1");
    expect(result.current.flash).toBe("User deleted");
    await waitFor(() => expect(getCalls("/admin/users")).toBe(2));
  });

  it("deletePost DELETEs the note, flashes and re-fetches", async () => {
    const { result } = await mountLoaded();
    act(() => result.current.setTab("posts"));
    await waitFor(() => expect(getCalls("/admin/posts")).toBe(1));

    api.delete.mockResolvedValueOnce({ data: {} });
    await act(() => result.current.deletePost("p1"));

    expect(api.delete).toHaveBeenCalledWith("/admin/posts/p1");
    expect(result.current.flash).toBe("Post deleted");
    await waitFor(() => expect(getCalls("/admin/posts")).toBe(2));
  });

  it("toggleRole promotes a user and demotes an admin", async () => {
    const { result } = await mountLoaded();
    api.put.mockResolvedValue({ data: {} });

    await act(() => result.current.toggleRole("u1", "user"));
    expect(api.put).toHaveBeenCalledWith("/admin/users/u1/role", { role: "admin" });

    await act(() => result.current.toggleRole("u1", "admin"));
    expect(api.put).toHaveBeenLastCalledWith("/admin/users/u1/role", { role: "user" });
    // role changes do not set a flash message
    expect(result.current.flash).toBe("");
  });

  it("toggleSuspend always sends an explicit boolean and re-fetches", async () => {
    const { result } = await mountLoaded();
    act(() => result.current.setTab("users"));
    await waitFor(() => expect(getCalls("/admin/users")).toBe(1));
    api.put.mockResolvedValue({ data: {} });

    await act(() => result.current.toggleSuspend("u1", false));
    expect(api.put).toHaveBeenCalledWith("/admin/users/u1/suspend", { suspended: true });
    expect(result.current.flash).toBe("User suspended");
    await waitFor(() => expect(getCalls("/admin/users")).toBe(2));

    await act(() => result.current.toggleSuspend("u1", true));
    expect(api.put).toHaveBeenLastCalledWith("/admin/users/u1/suspend", { suspended: false });
    expect(result.current.flash).toBe("User unsuspended");
    await waitFor(() => expect(getCalls("/admin/users")).toBe(3));
  });

  it("toggleSuspend sends `true` (never undefined) for a user with no suspension flag", async () => {
    // The API rejects a body whose `suspended` is not a boolean, so the flag is
    // derived with `!currentlySuspended` rather than passed through.
    const { result } = await mountLoaded();
    api.put.mockResolvedValue({ data: {} });
    await act(() => result.current.toggleSuspend("u2", undefined));
    expect(api.put).toHaveBeenCalledWith("/admin/users/u2/suspend", { suspended: true });
  });

  it("issueResetForUser POSTs and exposes the issued link with its user", async () => {
    const { result } = await mountLoaded();
    api.put.mockResolvedValue({ data: {} });
    await act(() => result.current.resolveReport("r1", "resolved"));
    expect(result.current.flash).toBe("Report resolved");

    api.post.mockResolvedValueOnce({
      data: { resetLink: "http://x/reset-password?token=abc", resetToken: "abc" },
    });
    await act(() => result.current.issueResetForUser(userRow));

    expect(api.post).toHaveBeenCalledWith("/admin/users/u1/issue-reset");
    expect(result.current.issued).toEqual({
      user: userRow,
      resetLink: "http://x/reset-password?token=abc",
      resetToken: "abc",
    });
    // issuing clears any previous flash
    expect(result.current.flash).toBe("");
  });

  it("issueResetForUser surfaces the API error and leaves `issued` alone", async () => {
    const { result } = await mountLoaded();
    api.post.mockRejectedValueOnce({ response: { data: { message: "User not found" } } });
    await act(() => result.current.issueResetForUser(userRow));
    expect(result.current.error).toBe("User not found");
    expect(result.current.issued).toBeNull();
  });

  it("issueResetForUser falls back to 'Could not issue reset'", async () => {
    const { result } = await mountLoaded();
    api.post.mockRejectedValueOnce({ response: { status: 400, data: {} } });
    await act(() => result.current.issueResetForUser(userRow));
    expect(result.current.error).toBe("Could not issue reset");
  });

  it("setIssued(null) closes the reset dialog", async () => {
    const { result } = await mountLoaded();
    api.post.mockResolvedValueOnce({ data: { resetLink: "http://x/r" } });
    await act(() => result.current.issueResetForUser(userRow));
    expect(result.current.issued).not.toBeNull();
    act(() => result.current.setIssued(null));
    expect(result.current.issued).toBeNull();
  });

  it("resolveReport closes a report either way, flashes and re-fetches", async () => {
    const { result } = await mountLoaded();
    api.put.mockResolvedValue({ data: {} });

    await act(() => result.current.resolveReport("r1", "resolved"));
    expect(api.put).toHaveBeenCalledWith("/admin/reports/r1/resolve", { action: "resolved" });
    expect(result.current.flash).toBe("Report resolved");
    await waitFor(() => expect(getCalls("/admin/reports")).toBe(2));

    await act(() => result.current.resolveReport("r2", "dismissed"));
    expect(api.put).toHaveBeenLastCalledWith("/admin/reports/r2/resolve", { action: "dismissed" });
    expect(result.current.flash).toBe("Report dismissed");
    await waitFor(() => expect(getCalls("/admin/reports")).toBe(3));
  });

  it("refresh() can be called directly to reload the active list", async () => {
    const { result } = await mountLoaded();
    await act(() => result.current.refresh());
    expect(getCalls("/admin/reports")).toBe(2);
  });

  // NOTE: current behaviour — only the loaders and issueResetForUser catch.
  // A failing moderation action rejects to the caller and sets no `error`
  // message, so the UI shows nothing. Asserted here to pin the behaviour;
  // it is a pre-existing gap, not a deliberate design.
  it("moderation actions reject on failure without setting `error`", async () => {
    const { result } = await mountLoaded();
    api.put.mockRejectedValueOnce({ response: { data: { message: "nope" } } });
    await expect(result.current.resolveReport("r1", "resolved")).rejects.toBeTruthy();
    expect(result.current.error).toBe("");
    expect(result.current.flash).toBe("");

    api.delete.mockRejectedValueOnce({ response: { data: { message: "nope" } } });
    await expect(result.current.deleteUser("u1")).rejects.toBeTruthy();
    expect(result.current.error).toBe("");
  });
});
