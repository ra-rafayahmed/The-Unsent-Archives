import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithRouter } from "../../test/utils";
import UsersPanel from "./UsersPanel";

const user = {
  _id: "u1",
  username: "pen",
  email: "pen@x.io",
  role: "user",
  isSuspended: false,
  reportCount: 3,
};

const suspendedAdmin = {
  ...user,
  _id: "u2",
  username: "quill",
  email: "quill@x.io",
  role: "admin",
  isSuspended: true,
  reportCount: 0,
};

const setup = (props = {}) => {
  const handlers = {
    onSortChange: vi.fn(),
    onIssueReset: vi.fn(),
    onToggleRole: vi.fn(),
    onToggleSuspend: vi.fn(),
    onDelete: vi.fn(),
  };
  renderWithRouter(<UsersPanel users={[]} sort="recent" {...handlers} {...props} />);
  return handlers;
};

describe("UsersPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders just the toolbar when there are no users", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a user row with profile link, email, role and report count", () => {
    setup({ users: [user] });
    expect(screen.getByRole("link", { name: "@pen" })).toHaveAttribute("href", "/profile/u1");
    expect(screen.getByText("pen@x.io")).toBeInTheDocument();
    expect(screen.getByText("user")).toBeInTheDocument();
    expect(screen.getByText("⚑ 3")).toBeInTheDocument();
    expect(screen.queryByText("suspended")).not.toBeInTheDocument();
  });

  it("badges a suspended account and hides the flag pill at zero reports", () => {
    setup({ users: [suspendedAdmin] });
    expect(screen.getByText("suspended")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.queryByText(/⚑/)).not.toBeInTheDocument();
  });

  it("renders one row per user", () => {
    setup({ users: [user, suspendedAdmin] });
    expect(screen.getByRole("link", { name: "@pen" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "@quill" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Issue reset" })).toHaveLength(2);
  });

  it("reflects the current sort and reports a change", () => {
    const h = setup({ sort: "reports" });
    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("reports");

    fireEvent.change(select, { target: { value: "recent" } });
    expect(h.onSortChange).toHaveBeenCalledWith("recent");
  });

  it("issues a reset with the whole user object", () => {
    const h = setup({ users: [user] });
    fireEvent.click(screen.getByRole("button", { name: "Issue reset" }));
    expect(h.onIssueReset).toHaveBeenCalledWith(user);
  });

  it("offers to promote a plain user and passes the current role", () => {
    const h = setup({ users: [user] });
    fireEvent.click(screen.getByRole("button", { name: "Make admin" }));
    expect(h.onToggleRole).toHaveBeenCalledWith("u1", "user");
  });

  it("offers to demote an admin and passes the current role", () => {
    const h = setup({ users: [suspendedAdmin] });
    fireEvent.click(screen.getByRole("button", { name: "Make user" }));
    expect(h.onToggleRole).toHaveBeenCalledWith("u2", "admin");
  });

  it("suspends an active account, passing the current flag", () => {
    const h = setup({ users: [user] });
    fireEvent.click(screen.getByRole("button", { name: "Suspend" }));
    expect(h.onToggleSuspend).toHaveBeenCalledWith("u1", false);
  });

  it("unsuspends a suspended account, passing the current flag", () => {
    const h = setup({ users: [suspendedAdmin] });
    fireEvent.click(screen.getByRole("button", { name: "Unsuspend" }));
    expect(h.onToggleSuspend).toHaveBeenCalledWith("u2", true);
  });

  it("deletes a user by id", () => {
    const h = setup({ users: [user] });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(h.onDelete).toHaveBeenCalledWith("u1");
  });
});
