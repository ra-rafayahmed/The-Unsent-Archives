import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithRouter } from "../../test/utils";
import PostsPanel from "./PostsPanel";

const post = {
  _id: "p1",
  content: "a note left unsent",
  authorId: { _id: "u1", username: "pen" },
  visibility: "public",
  viewCount: 4,
  reactionCount: 2,
  reportCount: 1,
};

const setup = (props = {}) => {
  const handlers = { onSortChange: vi.fn(), onDelete: vi.fn() };
  renderWithRouter(<PostsPanel posts={[]} sort="recent" {...handlers} {...props} />);
  return handlers;
};

describe("PostsPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders just the toolbar when there are no notes", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("renders a note row with its excerpt, author, visibility and counters", () => {
    setup({ posts: [post] });
    expect(screen.getByRole("link", { name: "a note left unsent" })).toHaveAttribute(
      "href",
      "/posts/p1"
    );
    expect(screen.getByText("by @pen · public")).toBeInTheDocument();
    expect(screen.getByText("4 reads · 2 hearts")).toBeInTheDocument();
    expect(screen.getByText("⚑ 1")).toBeInTheDocument();
  });

  it("truncates a long note to 80 characters", () => {
    const long = "x".repeat(120);
    setup({ posts: [{ ...post, content: long }] });
    expect(screen.getByRole("link", { name: "x".repeat(80) })).toBeInTheDocument();
  });

  it("labels an empty note 'Untitled' and falls back for a missing author", () => {
    setup({
      posts: [{ ...post, content: "", authorId: null, reportCount: 0, viewCount: 0 }],
    });
    expect(screen.getByRole("link", { name: "Untitled" })).toBeInTheDocument();
    expect(screen.getByText("by @unknown · public")).toBeInTheDocument();
    expect(screen.getByText("0 reads · 2 hearts")).toBeInTheDocument();
    expect(screen.queryByText(/⚑/)).not.toBeInTheDocument();
  });

  it("renders one row per note", () => {
    setup({ posts: [post, { ...post, _id: "p2", content: "another note" }] });
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(2);
  });

  it("reflects the current sort and reports a change", () => {
    const h = setup({ sort: "reports" });
    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("reports");

    fireEvent.change(select, { target: { value: "recent" } });
    expect(h.onSortChange).toHaveBeenCalledWith("recent");
  });

  it("deletes a note by id", () => {
    const h = setup({ posts: [post] });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(h.onDelete).toHaveBeenCalledWith("p1");
  });
});
