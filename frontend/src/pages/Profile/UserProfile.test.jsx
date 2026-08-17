import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithRouter } from "../../test/utils";
import api from "../../api/axios";
import UserProfile from "./UserProfile";

vi.mock("../../api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const authState = { user: null, updateCurrentUser: vi.fn() };
vi.mock("../../context/AuthContext", () => ({ useAuth: () => authState }));

const profileDoc = {
  _id: "u1",
  username: "pen",
  bio: "letters, mostly",
  avatarUrl: "",
  profile: { displayName: "Pen Name" },
  followerCount: 2,
};

const mockGet = ({ isFollowing = false } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === "/users/u1") return Promise.resolve({ data: { user: profileDoc } });
    if (url === "/users/u1/posts")
      return Promise.resolve({
        data: { posts: [{ _id: "p1", content: "first note", authorId: profileDoc, media: [] }] },
      });
    if (url === "/users/u1/collections")
      return Promise.resolve({
        data: { collections: [{ _id: "c1", name: "Keeps", visibility: "public", postCount: 1 }] },
      });
    if (url === "/users/u1/follow/status") return Promise.resolve({ data: { isFollowing } });
    return Promise.reject(new Error(`unmocked GET ${url}`));
  });
};

const renderVisitor = () =>
  renderWithRouter(<UserProfile />, { route: "/profile/u1", path: "/profile/:id" });
const renderOwn = () => renderWithRouter(<UserProfile own />, { route: "/me", path: "/me" });

describe("UserProfile", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.put.mockReset();
    api.delete.mockReset();
    authState.user = null;
    authState.updateCurrentUser.mockReset();
  });

  it("renders the profile header, posts and public collections for a signed-out visitor", async () => {
    mockGet();
    renderVisitor();
    expect(screen.getByText("Loading profile...")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Pen Name" })).toBeInTheDocument();
    expect(screen.getByText("@pen", { selector: ".profile-handle" })).toBeInTheDocument();
    expect(screen.getByText("first note")).toBeInTheDocument();
    expect(screen.getByText("Keeps")).toBeInTheDocument();
    // signed out: no follow / edit / report controls
    expect(screen.queryByRole("button", { name: /Follow/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit profile/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Report/ })).not.toBeInTheDocument();
  });

  it("shows the load error when the user does not exist", async () => {
    api.get.mockRejectedValue({ response: { data: { message: "User not found" } } });
    renderVisitor();
    expect(await screen.findByText("User not found")).toBeInTheDocument();
  });

  it("lets a signed-in visitor follow, updating the button and follower count", async () => {
    authState.user = { id: "viewer" };
    mockGet({ isFollowing: false });
    api.post.mockResolvedValueOnce({ data: {} });
    renderVisitor();

    const followBtn = await screen.findByRole("button", { name: "Follow" });
    expect(screen.getByText("2")).toBeInTheDocument();
    fireEvent.click(followBtn);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/users/u1/follow"));
    expect(await screen.findByRole("button", { name: "Following" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Report/ })).toBeInTheDocument();
  });

  it("on my own profile: edit, save, and propagate the updated user to auth context", async () => {
    authState.user = { id: "u1" };
    mockGet();
    renderOwn();
    fireEvent.click(await screen.findByRole("button", { name: /Edit profile/ }));

    const nameInput = screen.getByDisplayValue("Pen Name");
    fireEvent.change(nameInput, { target: { value: "Quiet Pen" } });
    fireEvent.change(screen.getByDisplayValue("letters, mostly"), {
      target: { value: "new bio" },
    });

    const updated = { ...profileDoc, bio: "new bio", profile: { displayName: "Quiet Pen" } };
    api.put.mockResolvedValueOnce({ data: { user: updated } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/users/u1", {
        bio: "new bio",
        avatarUrl: "",
        profile: { displayName: "Quiet Pen" },
      })
    );
    expect(await screen.findByRole("heading", { name: "Quiet Pen" })).toBeInTheDocument();
    expect(authState.updateCurrentUser).toHaveBeenCalledWith(updated);
    expect(screen.getByText("Profile updated")).toBeInTheDocument();
    // editor closed
    expect(screen.queryByRole("button", { name: "Save profile" })).not.toBeInTheDocument();
  });

  it("cancel restores the form and hides the editor", async () => {
    authState.user = { id: "u1" };
    mockGet();
    renderOwn();
    fireEvent.click(await screen.findByRole("button", { name: /Edit profile/ }));
    fireEvent.change(screen.getByDisplayValue("Pen Name"), { target: { value: "scratch" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByDisplayValue("scratch")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Edit profile/ }));
    expect(screen.getByDisplayValue("Pen Name")).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });
});
