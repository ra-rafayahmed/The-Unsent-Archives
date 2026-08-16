import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithRouter } from "../../test/utils";
import NoteCard from "./NoteCard";

const basePost = {
  _id: "64b000000000000000000001",
  content: "I never told you this.",
  authorId: { _id: "u1", username: "midnight_pen" },
  tagSlugs: ["grief", "late-night", "third", "fourth", "fifth"],
  reactionCount: 3,
  viewCount: 12,
  media: [],
  style: {},
};

describe("NoteCard", () => {
  it("renders content, author link, tags (max 4) and counters", () => {
    renderWithRouter(<NoteCard post={basePost} />);

    expect(screen.getByText("I never told you this.")).toBeInTheDocument();

    const author = screen.getByRole("link", { name: "@midnight_pen" });
    expect(author).toHaveAttribute("href", "/profile/u1");

    expect(screen.getByText("#grief")).toBeInTheDocument();
    expect(screen.getByText("#fourth")).toBeInTheDocument();
    expect(screen.queryByText("#fifth")).not.toBeInTheDocument();

    expect(screen.getByText("3 hearts")).toBeInTheDocument();
    expect(screen.getByText("12 reads")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      `/posts/${basePost._id}`
    );
  });

  it("shows 'Anonymous' with no profile link for anonymous posts", () => {
    renderWithRouter(<NoteCard post={{ ...basePost, isAnonymous: true }} />);
    expect(screen.getByText("Anonymous")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /@midnight_pen/ })).not.toBeInTheDocument();
  });

  it("falls back to 'Unknown' when the author was not populated", () => {
    renderWithRouter(<NoteCard post={{ ...basePost, authorId: null }} />);
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("renders the image header instead of chips when an image is attached", () => {
    const post = { ...basePost, media: [{ type: "image", url: "http://x/img.png" }] };
    const { container } = renderWithRouter(<NoteCard post={post} />);
    expect(container.querySelector(".note-card-image")).toBeInTheDocument();
    expect(screen.getByText("#grief")).toHaveClass("image-tag");
    expect(container.querySelector(".chip-row")).not.toBeInTheDocument();
  });

  it("shows a recommendation badge when _recReason is set", () => {
    renderWithRouter(<NoteCard post={{ ...basePost, _recReason: "tag-match" }} />);
    expect(screen.getByText("Matches your tags")).toBeInTheDocument();
  });

  it("hides edit/delete actions by default", () => {
    renderWithRouter(<NoteCard post={basePost} />);
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("renders edit/delete actions when allowed and calls onDelete with the id", () => {
    const onDelete = vi.fn();
    renderWithRouter(<NoteCard post={basePost} canEdit canDelete onDelete={onDelete} />);
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      `/write/${basePost._id}`
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith(basePost._id);
  });

  it("picks a deterministic variant from the post id, or from an explicit seed", () => {
    const { container: a } = renderWithRouter(<NoteCard post={basePost} />);
    const { container: b } = renderWithRouter(<NoteCard post={basePost} />);
    expect(b.querySelector("article").className).toBe(a.querySelector("article").className);

    const { container: c } = renderWithRouter(<NoteCard post={basePost} variantSeed={1} />);
    expect(c.querySelector("article")).toHaveClass("note-card-tape");
  });
});
