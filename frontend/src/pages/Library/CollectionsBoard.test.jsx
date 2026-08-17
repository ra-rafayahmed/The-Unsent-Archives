import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithRouter } from "../../test/utils";
import api from "../../api/axios";
import CollectionsBoard from "./CollectionsBoard";

vi.mock("../../api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const authState = { user: { id: "u1", username: "pen" } };
vi.mock("../../context/AuthContext", () => ({ useAuth: () => authState }));

const shelf = (id, extra = {}) => ({
  _id: id,
  name: `Shelf ${id}`,
  visibility: "private",
  postCount: 0,
  ...extra,
});

/** Resolve the collections GET with successive payloads (mount, then reload). */
const mockCollections = (...pages) => {
  api.get.mockImplementation((url) => {
    if (url === "/users/u1/collections") {
      const collections = pages.length > 1 ? pages.shift() : pages[0];
      return Promise.resolve({ data: { collections } });
    }
    return Promise.reject(new Error(`unmocked GET ${url}`));
  });
};

const render = () => renderWithRouter(<CollectionsBoard />, { route: "/library" });

const openCreateForm = () =>
  fireEvent.click(screen.getByRole("button", { name: /New collection/ }));

describe("CollectionsBoard", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    authState.user = { id: "u1", username: "pen" };
  });

  it("loads the signed-in reader's shelves and renders each one as a link", async () => {
    mockCollections([
      shelf("c1", { name: "Letters at Midnight", postCount: 1 }),
      shelf("c2", { name: "Open Wounds", visibility: "public", postCount: 4 }),
    ]);
    render();

    expect(await screen.findByText("Letters at Midnight")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/users/u1/collections");

    expect(screen.getByRole("link", { name: /Letters at Midnight/ })).toHaveAttribute(
      "href",
      "/collections/c1"
    );
    expect(screen.getByRole("link", { name: /Open Wounds/ })).toHaveAttribute(
      "href",
      "/collections/c2"
    );

    // visibility wording and singular/plural note counts
    expect(screen.getByText("◇ Private shelf")).toBeInTheDocument();
    expect(screen.getByText("◆ Public shelf")).toBeInTheDocument();
    expect(screen.getByText("1 note")).toBeInTheDocument();
    expect(screen.getByText("4 notes")).toBeInTheDocument();
  });

  it("shows the empty state when the reader has no shelves", async () => {
    mockCollections([]);
    render();

    expect(await screen.findByText("No shelves yet")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "My Library" })).toBeInTheDocument();
  });

  it("does not call the API until a user is available", () => {
    authState.user = null;
    render();

    expect(api.get).not.toHaveBeenCalled();
    expect(screen.getByText("No shelves yet")).toBeInTheDocument();
  });

  it("toggles the create form open and closed", async () => {
    mockCollections([]);
    render();
    await screen.findByText("No shelves yet");

    expect(screen.queryByPlaceholderText(/Collection name/)).not.toBeInTheDocument();

    openCreateForm();
    expect(screen.getByPlaceholderText(/Collection name/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByPlaceholderText(/Collection name/)).not.toBeInTheDocument();
  });

  it("creates a public shelf, then closes the form and shows the reloaded list", async () => {
    mockCollections([], [shelf("c9", { name: "Rain Letters", visibility: "public" })]);
    api.post.mockResolvedValueOnce({ data: {} });
    render();
    await screen.findByText("No shelves yet");

    openCreateForm();
    fireEvent.change(screen.getByPlaceholderText(/Collection name/), {
      target: { value: "  Rain Letters  " },
    });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "public" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/collections", {
        name: "Rain Letters",
        visibility: "public",
      })
    );

    expect(await screen.findByText("Rain Letters")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Collection name/)).not.toBeInTheDocument();
    expect(screen.queryByText("No shelves yet")).not.toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it("ignores a blank name instead of creating an untitled shelf", async () => {
    mockCollections([]);
    render();
    await screen.findByText("No shelves yet");

    openCreateForm();
    fireEvent.change(screen.getByPlaceholderText(/Collection name/), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText(/Collection name/)).toBeInTheDocument();
  });

  it("surfaces the API's message and keeps the typed name when creation fails", async () => {
    mockCollections([]);
    api.post.mockRejectedValueOnce({
      response: { data: { message: "You already have a shelf with that name" } },
    });
    render();
    await screen.findByText("No shelves yet");

    openCreateForm();
    fireEvent.change(screen.getByPlaceholderText(/Collection name/), {
      target: { value: "Duplicate" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("You already have a shelf with that name")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Duplicate")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it("says the server is unreachable when the request never got a response", async () => {
    mockCollections([]);
    api.post.mockRejectedValueOnce(new Error("network down"));
    render();
    await screen.findByText("No shelves yet");

    openCreateForm();
    fireEvent.change(screen.getByPlaceholderText(/Collection name/), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText(/Cannot reach the server/)).toBeInTheDocument();
  });

  it("falls back to a generic message when an HTTP failure carries no detail", async () => {
    mockCollections([]);
    api.post.mockRejectedValueOnce({ response: { status: 400, data: {} } });
    render();
    await screen.findByText("No shelves yet");

    openCreateForm();
    fireEvent.change(screen.getByPlaceholderText(/Collection name/), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Failed to create collection")).toBeInTheDocument();
  });

  it("reports a failed load instead of showing an empty shelf list", async () => {
    api.get.mockRejectedValue({ response: { status: 500, data: {} } });
    render();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Could not load your shelves/)).toBeInTheDocument();
    expect(screen.queryByText("No shelves yet")).not.toBeInTheDocument();

    // Retrying re-requests and recovers.
    mockCollections([{ _id: "c1", name: "Keeps", visibility: "public", postCount: 1 }]);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Keeps")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
