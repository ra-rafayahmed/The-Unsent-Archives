import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithRouter } from "../../test/utils";
import api from "../../api/axios";
import HomePage from "./HomePage";

vi.mock("../../api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const authState = { isAuthenticated: false, user: null };
vi.mock("../../context/AuthContext", () => ({ useAuth: () => authState }));

const post = (id, extra = {}) => ({
  _id: id,
  content: `note ${id}`,
  authorId: { _id: `author-${id}`, username: `writer_${id}` },
  tagSlugs: [],
  reactionCount: 1,
  viewCount: 5,
  media: [],
  ...extra,
});

/** Route the mocked GET by URL so each test can shape the responses. */
const mockApi = ({ feed = [], trending = [], following = [], recommendations = [] } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === "/feed") return Promise.resolve({ data: { posts: feed } });
    if (url === "/feed/trending") return Promise.resolve({ data: { posts: trending } });
    if (url === "/feed/following") return Promise.resolve({ data: { posts: following } });
    if (url === "/recommendations") return Promise.resolve({ data: { posts: recommendations } });
    return Promise.reject(new Error(`unmocked GET ${url}`));
  });
};

const signIn = () => {
  authState.isAuthenticated = true;
  authState.user = { id: "u1", username: "penpal" };
};

const renderHome = () => renderWithRouter(<HomePage />, { route: "/", path: "/" });

describe("HomePage", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    authState.isAuthenticated = false;
    authState.user = null;
  });

  describe("signed out", () => {
    it("loads the public feed on mount and shows the guest hero", async () => {
      mockApi({ feed: [post("a"), post("b")] });
      renderHome();

      // Loading: the skeleton grid is up, so neither notes nor the empty state show.
      expect(screen.queryByText("note a")).not.toBeInTheDocument();
      expect(screen.queryByText("The shelf is quiet")).not.toBeInTheDocument();

      expect(await screen.findByText("note a")).toBeInTheDocument();
      expect(screen.getByText("note b")).toBeInTheDocument();
      expect(api.get).toHaveBeenCalledWith("/feed", { params: {} });
      expect(api.get).toHaveBeenCalledTimes(1);

      expect(screen.getByText("A quiet shelf for unsent words,")).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/The Unsent\s*Archives/);
      expect(screen.getByRole("link", { name: /Start writing/ })).toHaveAttribute(
        "href",
        "/register"
      );
      expect(screen.getByRole("link", { name: /Browse Stacks/ })).toHaveAttribute(
        "href",
        "/explore"
      );
    });

    it("hides the personalised filters and the refresh button", async () => {
      mockApi({ feed: [post("a")] });
      renderHome();
      await screen.findByText("note a");

      expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Trending" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Recent" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "For you" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Following" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Refresh/ })).not.toBeInTheDocument();
    });

    it("shows the quiet-shelf empty state without a write link", async () => {
      mockApi();
      renderHome();

      expect(await screen.findByText("The shelf is quiet")).toBeInTheDocument();
      expect(
        screen.getByText("Be the first to leave something for the archive.")
      ).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Write a note" })).not.toBeInTheDocument();
    });

    it("switches to /feed/trending and to /feed?sort=recent from the filter pills", async () => {
      mockApi({ feed: [post("all")], trending: [post("hot")] });
      renderHome();
      await screen.findByText("note all");

      fireEvent.click(screen.getByRole("button", { name: "Trending" }));
      expect(await screen.findByText("note hot")).toBeInTheDocument();
      expect(api.get).toHaveBeenCalledWith("/feed/trending");
      expect(screen.queryByText("note all")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Recent" }));
      await waitFor(() =>
        expect(api.get).toHaveBeenCalledWith("/feed", { params: { sort: "recent" } })
      );
      expect(await screen.findByText("note all")).toBeInTheDocument();
    });
  });

  describe("signed in", () => {
    it('defaults to "For you" and requests /recommendations with a limit of 30', async () => {
      signIn();
      mockApi({ recommendations: [post("rec")] });
      renderHome();

      expect(await screen.findByText("note rec")).toBeInTheDocument();
      expect(api.get).toHaveBeenCalledWith("/recommendations", { params: { limit: 30 } });
      expect(api.get).toHaveBeenCalledTimes(1);

      expect(screen.getByText("Welcome back, penpal,")).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        /What never made it\s*out today\?/
      );
      expect(screen.getByRole("link", { name: /New Note/ })).toHaveAttribute("href", "/write");
      expect(screen.getByRole("button", { name: "For you" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Following" })).toBeInTheDocument();
    });

    it('falls back to "writer" in the greeting when the user has no username', async () => {
      authState.isAuthenticated = true;
      authState.user = { id: "u1" };
      mockApi({ recommendations: [post("rec")] });
      renderHome();

      expect(await screen.findByText("Welcome back, writer,")).toBeInTheDocument();
    });

    it("recomputes recommendations via POST when Refresh is pressed", async () => {
      signIn();
      mockApi({ recommendations: [post("old")] });
      let resolveRefresh;
      api.post.mockImplementation(
        () => new Promise((resolve) => (resolveRefresh = () => resolve({ data: { posts: [] } })))
      );
      renderHome();
      await screen.findByText("note old");

      fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));

      expect(api.post).toHaveBeenCalledWith("/recommendations/refresh", { limit: 30 });
      const busy = await screen.findByRole("button", { name: /Refreshing/ });
      expect(busy).toBeDisabled();

      resolveRefresh();
      // Refreshed to an empty set: the "For you" empty state takes over.
      expect(await screen.findByText("Still learning your taste")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Refresh/ })).toBeEnabled();
      expect(screen.getByRole("link", { name: "Write a note" })).toHaveAttribute("href", "/write");
    });

    it("hides Refresh on any filter other than For you", async () => {
      signIn();
      mockApi({ recommendations: [post("rec")], following: [post("f")] });
      renderHome();
      await screen.findByText("note rec");

      fireEvent.click(screen.getByRole("button", { name: "Following" }));
      expect(await screen.findByText("note f")).toBeInTheDocument();
      expect(api.get).toHaveBeenCalledWith("/feed/following");
      expect(screen.queryByRole("button", { name: /Refresh/ })).not.toBeInTheDocument();
    });

    it("shows the follow-someone copy when the Following feed is empty", async () => {
      signIn();
      mockApi({ recommendations: [post("rec")] });
      renderHome();
      await screen.findByText("note rec");

      fireEvent.click(screen.getByRole("button", { name: "Following" }));

      expect(await screen.findByText("The shelf is quiet")).toBeInTheDocument();
      expect(
        screen.getByText("Follow a few writers and their words will gather here.")
      ).toBeInTheDocument();
    });

    it("refetches when the user signs out mid-session", async () => {
      signIn();
      mockApi({ recommendations: [post("rec")], feed: [post("public")] });
      const { unmount } = renderHome();
      await screen.findByText("note rec");
      unmount();

      authState.isAuthenticated = false;
      authState.user = null;
      renderHome();

      expect(await screen.findByText("note public")).toBeInTheDocument();
      expect(api.get).toHaveBeenCalledWith("/feed", { params: {} });
    });
  });

  it("treats a response without a posts array as an empty feed", async () => {
    api.get.mockResolvedValue({ data: {} });
    renderHome();

    expect(await screen.findByText("The shelf is quiet")).toBeInTheDocument();
  });

  it("reports a failed feed request instead of showing the empty state", async () => {
    api.get.mockRejectedValue({ response: { status: 500, data: {} } });
    renderHome();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/server had a problem/i)).toBeInTheDocument();
    expect(screen.queryByText("The shelf is quiet")).not.toBeInTheDocument();
  });

  it("retries the feed when 'Try again' is pressed", async () => {
    api.get.mockRejectedValueOnce({ response: { status: 500, data: {} } });
    renderHome();
    await screen.findByRole("alert");

    api.get.mockResolvedValue({ data: { posts: [post("a")] } });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("note a")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
