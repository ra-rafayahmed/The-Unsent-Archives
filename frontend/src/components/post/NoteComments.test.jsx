import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithRouter } from "../../test/utils";
import NoteComments from "./NoteComments";

const named = {
  _id: "c1",
  text: "same.",
  userId: { _id: "u2", username: "reader", avatarUrl: "" },
  isAnonymous: false,
};
const anon = { _id: "c2", text: "hidden", userId: null, isAnonymous: true };

const setup = (props = {}) => {
  const handlers = {
    onDraftChange: vi.fn(),
    onAnonymousChange: vi.fn(),
    onSubmit: vi.fn(),
    onDelete: vi.fn(),
  };
  renderWithRouter(
    <NoteComments
      comments={[]}
      isAuthenticated={false}
      viewerId={undefined}
      draft=""
      isAnonymous={false}
      {...handlers}
      {...props}
    />
  );
  return handlers;
};

describe("NoteComments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invites signed-out readers to sign in rather than showing the composer", () => {
    setup();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.queryByPlaceholderText("Write a response...")).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no replies", () => {
    setup();
    expect(screen.getByText("No letters yet. Be the first to reply.")).toBeInTheDocument();
  });

  it("renders a named commenter with a profile link and an anonymous one without", () => {
    setup({ comments: [named, anon] });

    expect(screen.getByRole("link", { name: "reader" })).toHaveAttribute("href", "/profile/u2");
    expect(screen.getByText("same.")).toBeInTheDocument();

    expect(screen.getByText("Anonymous")).toBeInTheDocument();
    expect(screen.getByText("anonymous")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Anonymous" })).not.toBeInTheDocument();
    expect(screen.getByText("hidden")).toBeInTheDocument();
  });

  it("falls back to an initial avatar when the commenter has no image", () => {
    setup({ comments: [named] });
    expect(screen.getByText("R")).toBeInTheDocument();
  });

  it("drives the composer through its callbacks", () => {
    const h = setup({ isAuthenticated: true, draft: "hi" });

    fireEvent.change(screen.getByPlaceholderText("Write a response..."), {
      target: { value: "hello" },
    });
    expect(h.onDraftChange).toHaveBeenCalledWith("hello");

    fireEvent.click(screen.getByRole("checkbox"));
    expect(h.onAnonymousChange).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Send letter" }));
    expect(h.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("relabels the submit button when sending anonymously", () => {
    setup({ isAuthenticated: true, isAnonymous: true });
    expect(screen.getByRole("button", { name: "Send anonymously" })).toBeInTheDocument();
  });

  it("offers delete to the comment's own author", () => {
    const h = setup({ comments: [named], viewerId: "u2" });
    fireEvent.click(screen.getByRole("button", { name: "Delete comment" }));
    expect(h.onDelete).toHaveBeenCalledWith("c1");
  });

  it("offers delete to the note's author for any comment", () => {
    setup({ comments: [named, anon], viewerId: "owner", canModerate: true });
    expect(screen.getAllByRole("button", { name: "Delete comment" })).toHaveLength(2);
  });

  it("hides delete from an unrelated reader and from signed-out visitors", () => {
    setup({ comments: [named], viewerId: "stranger" });
    expect(screen.queryByRole("button", { name: "Delete comment" })).not.toBeInTheDocument();

    setup({ comments: [named] });
    expect(screen.queryByRole("button", { name: "Delete comment" })).not.toBeInTheDocument();
  });
});
