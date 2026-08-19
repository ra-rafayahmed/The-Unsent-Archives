import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithRouter } from "../../test/utils";
import NoteHeader from "./NoteHeader";

const setup = (props = {}) => {
  const onToggleFollow = vi.fn();
  const view = renderWithRouter(
    <NoteHeader
      authorId="author"
      authorName="midnight_pen"
      viewerId={undefined}
      isFollowing={false}
      onToggleFollow={onToggleFollow}
      {...props}
    />
  );
  return { ...view, onToggleFollow };
};

describe("NoteHeader", () => {
  beforeEach(() => vi.clearAllMocks());

  it("links a named writer to their profile between two flourishes", () => {
    const { container } = setup();
    expect(screen.getByRole("link", { name: "@midnight_pen" })).toHaveAttribute(
      "href",
      "/profile/author"
    );
    expect(container.querySelectorAll(".manuscript-flourish")).toHaveLength(2);
  });

  it("renders an anonymous writer as plain text with no link or follow button", () => {
    setup({ authorId: null, authorName: "Anonymous" });
    expect(screen.getByText("Anonymous")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("falls back to a generic name when there is neither an id nor a name", () => {
    setup({ authorId: null, authorName: undefined });
    expect(screen.getByText("Writer")).toBeInTheDocument();
  });

  it("hides the follow button from signed-out readers", () => {
    setup();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("hides the follow button from the writer themselves", () => {
    setup({ viewerId: "author" });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers Follow to another signed-in reader and reports the click", () => {
    const { onToggleFollow } = setup({ viewerId: "someone-else" });
    const btn = screen.getByRole("button", { name: "Follow" });
    expect(btn).toBeEnabled();

    fireEvent.click(btn);
    expect(onToggleFollow).toHaveBeenCalledTimes(1);
  });

  it("reads Following once the reader follows the writer", () => {
    setup({ viewerId: "someone-else", isFollowing: true });
    expect(screen.getByRole("button", { name: "Following" })).toBeInTheDocument();
  });

  it("disables the button and shows an ellipsis while the toggle is in flight", () => {
    setup({ viewerId: "someone-else", isFollowLoading: true });
    expect(screen.getByRole("button", { name: "..." })).toBeDisabled();
  });
});
