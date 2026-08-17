import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import { renderWithRouter } from "../../test/utils";
import api from "../../api/axios";
import CollectionDetailPage from "./CollectionDetailPage";

vi.mock("../../api/axios", () => ({
  default: { get: vi.fn(), delete: vi.fn() },
}));

const authState = { user: null };
vi.mock("../../context/AuthContext", () => ({ useAuth: () => authState }));

const owner = { _id: "o1", username: "keeper", profile: { displayName: "The Keeper" } };

const note = (id, extra = {}) => ({
  _id: id,
  content: `note ${id}`,
  authorId: owner,
  tagSlugs: [],
  media: [],
  ...extra,
});

const collection = (extra = {}) => ({
  _id: "c1",
  name: "Letters at Midnight",
  description: "Things I never sent.",
  visibility: "private",
  ownerId: owner,
  postCount: 2,
  postIds: [note("p1"), note("p2")],
  ...extra,
});

const mockGet = (doc) => {
  api.get.mockImplementation((url) => {
    if (url === "/collections/c1") return Promise.resolve({ data: { collection: doc } });
    return Promise.reject(new Error(`unmocked GET ${url}`));
  });
};

const render = () =>
  renderWithRouter(<CollectionDetailPage />, {
    route: "/collections/c1",
    path: "/collections/:id",
  });

/** The hero header, so the curator credit is not confused with per-note author links. */
const hero = () => within(document.querySelector("header.collection-hero"));

describe("CollectionDetailPage", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.delete.mockReset();
    authState.user = null;
  });

  it("loads the collection for the route id and renders its notes", async () => {
    mockGet(collection());
    render();

    expect(screen.getByText("Loading collection...")).toBeInTheDocument();

    expect(await screen.findByRole("heading", { name: "Letters at Midnight" })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/collections/c1");

    expect(screen.getByText("Things I never sent.")).toBeInTheDocument();
    expect(screen.getByText("◇ Private shelf")).toBeInTheDocument();
    expect(screen.getByText("2 notes")).toBeInTheDocument();
    expect(screen.getByText("note p1")).toBeInTheDocument();
    expect(screen.getByText("note p2")).toBeInTheDocument();
    expect(hero().getByRole("link", { name: "@keeper" })).toHaveAttribute("href", "/profile/o1");
  });

  it("labels a public shelf and falls back to placeholder copy without a description", async () => {
    mockGet(
      collection({ visibility: "public", description: "", postCount: 1, postIds: [note("p1")] })
    );
    render();

    expect(await screen.findByText("◆ Public shelf")).toBeInTheDocument();
    expect(screen.getByText("A curated stack of notes.")).toBeInTheDocument();
    expect(screen.getByText("1 note")).toBeInTheDocument();
  });

  it("shows the API's error message when the collection cannot be loaded", async () => {
    api.get.mockRejectedValueOnce({ response: { data: { message: "Collection is private" } } });
    render();
    expect(await screen.findByText("Collection is private")).toBeInTheDocument();
  });

  it("says the server is unreachable when the request never got a response", async () => {
    api.get.mockRejectedValueOnce(new Error("offline"));
    render();
    expect(await screen.findByText(/Cannot reach the server/)).toBeInTheDocument();
  });

  it("falls back to a generic load error when an HTTP failure carries no detail", async () => {
    api.get.mockRejectedValueOnce({ response: { status: 400, data: {} } });
    render();
    expect(await screen.findByText("Failed to load collection")).toBeInTheDocument();
  });

  it("reports an unavailable collection when the API returns nothing", async () => {
    mockGet(null);
    render();
    expect(await screen.findByText("Collection not available")).toBeInTheDocument();
  });

  it("nudges the owner to start filling an empty shelf", async () => {
    authState.user = { id: "o1" };
    mockGet(collection({ postCount: 0, postIds: [] }));
    render();

    expect(await screen.findByText("No notes on this shelf yet")).toBeInTheDocument();
    expect(
      screen.getByText("Save notes from any reader to start filling this stack.")
    ).toBeInTheDocument();
  });

  it("tells a visitor to check back on an empty shelf", async () => {
    authState.user = { id: "someone-else" };
    mockGet(collection({ postCount: 0, postIds: [] }));
    render();

    expect(await screen.findByText("No notes on this shelf yet")).toBeInTheDocument();
    expect(screen.getByText(/Check back later/)).toBeInTheDocument();
  });

  it("gives the owner Remove controls and no one else", async () => {
    mockGet(collection());
    const { unmount } = render();
    await screen.findByText("note p1");
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    unmount();

    authState.user = { id: "o1" };
    render();
    await screen.findByText("note p1");
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(2);
    // owner also authored these notes, so editing is offered too
    expect(screen.getAllByRole("link", { name: "Edit" })[0]).toHaveAttribute("href", "/write/p1");
  });

  it("removes a note from the shelf and confirms it, dropping the note count", async () => {
    authState.user = { id: "o1" };
    mockGet(collection());
    api.delete.mockResolvedValueOnce({ data: {} });
    render();
    await screen.findByText("note p1");

    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/collections/c1/posts/p1"));
    expect(await screen.findByText("Post removed from collection")).toBeInTheDocument();
    expect(screen.queryByText("note p1")).not.toBeInTheDocument();
    expect(screen.getByText("note p2")).toBeInTheDocument();
    expect(screen.getByText("1 note")).toBeInTheDocument();
  });

  it("keeps the note and explains the failure when removal is rejected", async () => {
    authState.user = { id: "o1" };
    mockGet(collection());
    api.delete.mockRejectedValueOnce({ response: { data: { message: "Not your collection" } } });
    render();
    await screen.findByText("note p1");

    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);

    expect(await screen.findByText("Not your collection")).toBeInTheDocument();
    expect(screen.getByText("note p1")).toBeInTheDocument();
    expect(screen.getByText("2 notes")).toBeInTheDocument();
  });

  it("falls back to a generic removal error when the failure carries no detail", async () => {
    authState.user = { id: "o1" };
    mockGet(collection());
    api.delete.mockRejectedValueOnce({ response: { status: 400, data: {} } });
    render();
    await screen.findByText("note p1");

    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(await screen.findByText("Could not remove post")).toBeInTheDocument();
  });

  it("shows the owner's display name when the owner id is missing", async () => {
    mockGet(collection({ ownerId: { profile: { displayName: "The Keeper" } } }));
    render();

    expect(await screen.findByText(/Curated by The Keeper/)).toBeInTheDocument();
    expect(hero().queryByRole("link")).not.toBeInTheDocument();
  });
});
