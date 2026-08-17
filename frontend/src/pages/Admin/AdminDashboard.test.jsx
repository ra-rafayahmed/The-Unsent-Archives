import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithRouter } from "../../test/utils";
import api from "../../api/axios";
import AdminDashboard from "./AdminDashboard";

vi.mock("../../api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const authState = { isAdmin: true };
vi.mock("../../context/AuthContext", () => ({ useAuth: () => authState }));

const userRow = {
  _id: "u1",
  username: "pen",
  email: "pen@x.io",
  role: "user",
  isSuspended: false,
  reportCount: 3,
};

const postRow = {
  _id: "p1",
  content: "a note left unsent",
  authorId: { _id: "u1", username: "pen" },
  visibility: "public",
  viewCount: 4,
  reactionCount: 2,
  reportCount: 1,
};

const postReport = {
  _id: "r1",
  reason: "spam",
  status: "open",
  targetType: "post",
  note: "this is junk",
  reporterId: { _id: "u2", username: "reader" },
  target: postRow,
};

const userReport = {
  _id: "r2",
  reason: "harassment",
  status: "open",
  targetType: "user",
  reporterId: { _id: "u2", username: "reader" },
  target: { _id: "u1", username: "pen", reportCount: 3, isSuspended: false },
};

const mockLists = ({ users = [userRow], posts = [postRow], reports = [postReport] } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === "/admin/users") return Promise.resolve({ data: { users } });
    if (url === "/admin/posts") return Promise.resolve({ data: { posts } });
    if (url === "/admin/reports") return Promise.resolve({ data: { reports } });
    return Promise.reject(new Error(`unmocked GET ${url}`));
  });
};

const render = () => renderWithRouter(<AdminDashboard />, { route: "/admin", path: "/admin" });

/** Render, then move to `tab` and wait for its first row. */
const renderOnTab = async (tab, firstRowText) => {
  const view = render();
  fireEvent.click(screen.getByRole("button", { name: new RegExp(tab) }));
  expect(await screen.findByText(firstRowText)).toBeInTheDocument();
  return view;
};

describe("AdminDashboard", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.put.mockReset();
    api.delete.mockReset();
    authState.isAdmin = true;
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockLists();
  });

  afterEach(() => {
    window.confirm.mockRestore?.();
  });

  it("locks non-admins out and fetches nothing", () => {
    authState.isAdmin = false;
    render();
    expect(screen.getByText("Admin access only.")).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it("opens on the reports tab and renders a report card", async () => {
    render();
    expect(await screen.findByText("spam")).toBeInTheDocument();
    expect(screen.getByText('"this is junk"')).toBeInTheDocument();
    expect(screen.getByText("@reader")).toBeInTheDocument();
    expect(screen.getByText('"a note left unsent"')).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "open reports" })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/admin/reports", { params: { status: "open" } });
  });

  it("shows the calm empty state when there are no reports", async () => {
    mockLists({ reports: [] });
    render();
    expect(await screen.findByText(/The archive is calm/)).toBeInTheDocument();
  });

  it("re-queries reports when a status filter pill is clicked", async () => {
    render();
    await screen.findByText("spam");
    fireEvent.click(screen.getByRole("button", { name: "resolved" }));
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith("/admin/reports", { params: { status: "resolved" } })
    );
    expect(await screen.findByRole("heading", { name: "resolved reports" })).toBeInTheDocument();
  });

  it("resolves and dismisses a report from its card", async () => {
    render();
    await screen.findByText("spam");
    api.put.mockResolvedValue({ data: {} });

    fireEvent.click(screen.getByRole("button", { name: /Mark resolved/ }));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/admin/reports/r1/resolve", { action: "resolved" })
    );
    expect(await screen.findByText("Report resolved")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Dismiss/ }));
    await waitFor(() =>
      expect(api.put).toHaveBeenLastCalledWith("/admin/reports/r1/resolve", {
        action: "dismissed",
      })
    );
    expect(await screen.findByText("Report dismissed")).toBeInTheDocument();
  });

  it("deletes the reported note and resolves the report in one click", async () => {
    render();
    await screen.findByText("spam");
    api.delete.mockResolvedValue({ data: {} });
    api.put.mockResolvedValue({ data: {} });

    fireEvent.click(screen.getByRole("button", { name: /Delete note/ }));
    expect(window.confirm).toHaveBeenCalledWith("Delete this post?");
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/admin/posts/p1"));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/admin/reports/r1/resolve", { action: "resolved" })
    );
  });

  it("leaves the report open when the delete confirm is declined", async () => {
    window.confirm.mockReturnValue(false);
    render();
    await screen.findByText("spam");
    api.put.mockResolvedValue({ data: {} });

    fireEvent.click(screen.getByRole("button", { name: /Delete note/ }));

    // Nothing was deleted, so the report must not be marked resolved either.
    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(api.delete).not.toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalledWith("/admin/reports/r1/resolve", { action: "resolved" });
  });

  it("suspends the reported account from a user report, sending an explicit flag", async () => {
    mockLists({ reports: [userReport] });
    render();
    expect(await screen.findByText("harassment")).toBeInTheDocument();
    expect(screen.getByText(/3 report\(s\)/)).toBeInTheDocument();
    api.put.mockResolvedValue({ data: {} });

    fireEvent.click(screen.getByRole("button", { name: "Suspend user" }));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/admin/users/u1/suspend", { suspended: true })
    );
    expect(await screen.findByText("User suspended")).toBeInTheDocument();
  });

  it("hides the action row for reports that are already closed", async () => {
    mockLists({ reports: [{ ...postReport, status: "dismissed" }] });
    render();
    await screen.findByText("spam");
    expect(screen.queryByRole("button", { name: /Mark resolved/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete note/ })).not.toBeInTheDocument();
  });

  it("renders user rows on the users tab", async () => {
    await renderOnTab("Users", "@pen");
    expect(api.get).toHaveBeenCalledWith("/admin/users", { params: { sort: "recent" } });
    expect(screen.getByText("pen@x.io")).toBeInTheDocument();
    expect(screen.getByText("user")).toBeInTheDocument();
    expect(screen.getByText("⚑ 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Make admin" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Suspend" })).toBeInTheDocument();
  });

  it("re-queries users when the sort select changes", async () => {
    await renderOnTab("Users", "@pen");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "reports" } });
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith("/admin/users", { params: { sort: "reports" } })
    );
  });

  it("toggles a user's role", async () => {
    await renderOnTab("Users", "@pen");
    api.put.mockResolvedValue({ data: {} });
    fireEvent.click(screen.getByRole("button", { name: "Make admin" }));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/admin/users/u1/role", { role: "admin" })
    );
  });

  it("offers 'Make user' and 'Unsuspend' for a suspended admin", async () => {
    mockLists({ users: [{ ...userRow, role: "admin", isSuspended: true, reportCount: 0 }] });
    await renderOnTab("Users", "@pen");
    expect(screen.getByText("suspended")).toBeInTheDocument();
    api.put.mockResolvedValue({ data: {} });

    fireEvent.click(screen.getByRole("button", { name: "Make user" }));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/admin/users/u1/role", { role: "user" })
    );

    fireEvent.click(screen.getByRole("button", { name: "Unsuspend" }));
    await waitFor(() =>
      expect(api.put).toHaveBeenLastCalledWith("/admin/users/u1/suspend", { suspended: false })
    );
    expect(await screen.findByText("User unsuspended")).toBeInTheDocument();
  });

  it("deletes a user only after the confirm is accepted", async () => {
    await renderOnTab("Users", "@pen");

    window.confirm.mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(window.confirm).toHaveBeenCalledWith("Delete this account and all related data?");
    expect(api.delete).not.toHaveBeenCalled();

    window.confirm.mockReturnValue(true);
    api.delete.mockResolvedValue({ data: {} });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/admin/users/u1"));
    expect(await screen.findByText("User deleted")).toBeInTheDocument();
  });

  it("issues a reset link and shows it in a dialog that can be dismissed", async () => {
    await renderOnTab("Users", "@pen");
    api.post.mockResolvedValueOnce({
      data: { resetLink: "http://x/reset-password?token=abc" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Issue reset" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/admin/users/u1/issue-reset"));
    expect(await screen.findByText("Reset link issued")).toBeInTheDocument();
    expect(screen.getByText("http://x/reset-password?token=abc")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByText("Reset link issued")).not.toBeInTheDocument());
  });

  it("shows an error when the reset link cannot be issued", async () => {
    await renderOnTab("Users", "@pen");
    api.post.mockRejectedValueOnce({ response: { data: { message: "User not found" } } });
    fireEvent.click(screen.getByRole("button", { name: "Issue reset" }));
    expect(await screen.findByText("User not found")).toBeInTheDocument();
    expect(screen.queryByText("Reset link issued")).not.toBeInTheDocument();
  });

  it("renders note rows on the notes tab and deletes one after confirming", async () => {
    await renderOnTab("Notes", "a note left unsent");
    expect(api.get).toHaveBeenCalledWith("/admin/posts", { params: { sort: "recent" } });
    expect(screen.getByText(/by @pen/)).toBeInTheDocument();
    expect(screen.getByText(/4 reads · 2 hearts/)).toBeInTheDocument();

    api.delete.mockResolvedValue({ data: {} });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(window.confirm).toHaveBeenCalledWith("Delete this post?");
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/admin/posts/p1"));
    expect(await screen.findByText("Post deleted")).toBeInTheDocument();
  });

  it("shows the load error", async () => {
    api.get.mockRejectedValue({ response: { data: { message: "Admins only" } } });
    render();
    expect(await screen.findByText("Admins only")).toBeInTheDocument();
  });
});
