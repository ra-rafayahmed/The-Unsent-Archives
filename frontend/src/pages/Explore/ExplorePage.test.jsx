import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithRouter } from "../../test/utils";
import api from "../../api/axios";
import ExplorePage from "./ExplorePage";

vi.mock("../../api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

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
const mockApi = ({ trending = [], feed = [], tags = [], search = {} } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === "/feed/trending") return Promise.resolve({ data: { posts: trending } });
    if (url === "/feed") return Promise.resolve({ data: { posts: feed } });
    if (url === "/tags/trending") return Promise.resolve({ data: { tags } });
    if (url === "/search") return Promise.resolve({ data: search });
    return Promise.reject(new Error(`unmocked GET ${url}`));
  });
};

describe("ExplorePage", () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it("loads trending posts and tags on mount, and derives top writers", async () => {
    mockApi({
      trending: [
        post("a", { reactionCount: 10 }),
        post("b", { isAnonymous: true, reactionCount: 100 }),
      ],
      tags: [
        { _id: "t1", slug: "grief" },
        { _id: "t2", slug: "hope" },
      ],
    });

    renderWithRouter(<ExplorePage />, { route: "/explore", path: "/explore" });

    expect(await screen.findByText("note a")).toBeInTheDocument();
    expect(screen.getByText("note b")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/feed/trending");
    expect(api.get).toHaveBeenCalledWith("/tags/trending");

    // trending tag chips
    expect(screen.getByRole("link", { name: "#grief" })).toHaveAttribute(
      "href",
      "/explore?q=grief"
    );

    // anonymous posts must not surface their author as a top writer
    expect(screen.getAllByText("@writer_a").length).toBeGreaterThan(0);
    expect(screen.queryByText("@writer_b")).not.toBeInTheDocument();
  });

  it("switches to the /feed endpoint when a different sort is chosen", async () => {
    mockApi({ trending: [post("t")], feed: [post("f")] });
    renderWithRouter(<ExplorePage />, { route: "/explore", path: "/explore" });
    await screen.findByText("note t");

    fireEvent.click(screen.getByRole("button", { name: /Fresh ink/ }));

    expect(await screen.findByText("note f")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/feed", {
      params: { sort: "recent", limit: 24 },
    });
  });

  it("shows the empty state when there is nothing to show", async () => {
    mockApi();
    renderWithRouter(<ExplorePage />, { route: "/explore", path: "/explore" });
    expect(await screen.findByText("The shelf is quiet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Write a note" })).toHaveAttribute("href", "/write");
  });

  it("runs a search from the ?q= param and shows the result count", async () => {
    mockApi({
      trending: [post("hidden")],
      search: {
        posts: [post("s1"), post("s2")],
        users: [{ _id: "u", username: "found" }],
        tags: [],
      },
    });
    renderWithRouter(<ExplorePage />, { route: "/explore?q=rain", path: "/explore" });

    expect(await screen.findByText("note s1")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/search", { params: { q: "rain" } });
    expect(screen.getByText(/2 notes for/)).toBeInTheDocument();
    expect(screen.getByText('"rain"')).toBeInTheDocument();
    expect(screen.getByText("@found")).toBeInTheDocument();
    // trending posts are hidden while a search is active
    expect(screen.queryByText("note hidden")).not.toBeInTheDocument();
  });

  it("submitting the search box triggers /search and Clear restores browsing", async () => {
    mockApi({ trending: [post("home")], search: { posts: [], users: [], tags: [] } });
    renderWithRouter(<ExplorePage />, { route: "/explore", path: "/explore" });
    await screen.findByText("note home");

    fireEvent.change(screen.getByPlaceholderText(/Search notes/), { target: { value: "  x  " } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/search", { params: { q: "x" } }));
    expect(await screen.findByText("No matches yet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(await screen.findByText("note home")).toBeInTheDocument();
  });
});
