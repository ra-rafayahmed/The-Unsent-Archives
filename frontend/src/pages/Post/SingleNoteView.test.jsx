import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithRouter } from "../../test/utils";
import api from "../../api/axios";
import SingleNoteView from "./SingleNoteView";

vi.mock("../../api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const authState = { user: null, isAuthenticated: false, isAdmin: false };
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => authState,
}));

const basePost = {
  _id: "p1",
  content: "I kept this one.",
  authorId: { _id: "author", username: "midnight_pen" },
  tagSlugs: ["grief"],
  media: [],
  style: { background: "#1f2430" },
  comments: [
    { _id: "c1", text: "same.", userId: { _id: "u2", username: "reader" }, isAnonymous: false },
    { _id: "c2", text: "hidden", userId: null, isAnonymous: true },
  ],
};

const mockApi = ({ post = basePost, reactions = { like: 4 }, collections = [] } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === "/posts/p1") return Promise.resolve({ data: { post } });
    if (url === "/posts/p1/reactions") return Promise.resolve({ data: { reactions } });
    if (url.endsWith("/collections")) return Promise.resolve({ data: { collections } });
    if (url.endsWith("/follow/status")) return Promise.resolve({ data: { isFollowing: false } });
    return Promise.reject(new Error(`unmocked GET ${url}`));
  });
  api.post.mockResolvedValue({ data: {} });
};

const renderPage = () =>
  renderWithRouter(<SingleNoteView />, { route: "/posts/p1", path: "/posts/:id" });

describe("SingleNoteView", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    authState.user = null;
    authState.isAuthenticated = false;
    authState.isAdmin = false;
  });

  it("renders the note, author link, tags, reactions and comments; dark theme from background", async () => {
    mockApi();
    const { container } = renderPage();

    expect(screen.getByText("Loading note...")).toBeInTheDocument();
    expect(await screen.findByText("I kept this one.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "@midnight_pen" })).toHaveAttribute(
      "href",
      "/profile/author"
    );
    expect(screen.getByText("#grief")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Love/ })).toHaveTextContent("4");
    expect(screen.getByText("same.")).toBeInTheDocument();
    expect(screen.getByText("hidden")).toBeInTheDocument();
    expect(container.querySelector(".note-shell")).toHaveAttribute("data-theme", "dark");

    // signed-out visitors are invited to sign in rather than shown the composer
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.queryByPlaceholderText("Write a response...")).not.toBeInTheDocument();
  });

  it("shows the API error instead of the loader when the post cannot be loaded", async () => {
    api.get.mockRejectedValue({ response: { data: { message: "This post is private" } } });
    api.post.mockResolvedValue({ data: {} });
    renderPage();
    expect(await screen.findByText("This post is private")).toBeInTheDocument();
  });

  it("posting a reaction calls the API and refreshes the counts", async () => {
    mockApi();
    renderPage();
    await screen.findByText("I kept this one.");

    mockApi({ reactions: { like: 5 } });
    fireEvent.click(screen.getByRole("button", { name: /Love/ }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/posts/p1/reactions", { type: "like" })
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Love/ })).toHaveTextContent("5")
    );
  });

  it("lets a signed-in reader send a letter and reloads the post", async () => {
    authState.user = { id: "u2" };
    authState.isAuthenticated = true;
    mockApi();
    renderPage();
    await screen.findByText("I kept this one.");

    fireEvent.change(screen.getByPlaceholderText("Write a response..."), {
      target: { value: "  me too  " },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Send anonymously/ }));
    fireEvent.click(screen.getByRole("button", { name: "Send anonymously" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/posts/p1/comments", {
        text: "me too",
        isAnonymous: true,
      })
    );
    // post is re-fetched after commenting
    await waitFor(() =>
      expect(api.get.mock.calls.filter(([u]) => u === "/posts/p1").length).toBeGreaterThan(1)
    );
    expect(screen.getByPlaceholderText("Write a response...")).toHaveValue("");
  });

  it("shows Edit/Delete for the author and a Follow button for other signed-in readers", async () => {
    authState.user = { id: "author" };
    authState.isAuthenticated = true;
    mockApi();
    const { unmount } = renderPage();
    await screen.findByText("I kept this one.");
    expect(screen.getByRole("link", { name: /Edit/ })).toHaveAttribute("href", "/write/p1");
    expect(screen.getByRole("button", { name: "🗑 Delete" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Follow$/ })).not.toBeInTheDocument();
    unmount();

    authState.user = { id: "someone-else" };
    mockApi();
    renderPage();
    await screen.findByText("I kept this one.");
    expect(await screen.findByRole("button", { name: "Follow" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Edit/ })).not.toBeInTheDocument();
  });
});
