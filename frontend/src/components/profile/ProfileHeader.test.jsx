import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithRouter } from "../../test/utils";
import ProfileHeader from "./ProfileHeader";

const profile = {
  _id: "u1",
  username: "pen",
  bio: "letters, mostly",
  avatarUrl: "",
  profile: { displayName: "Pen Name" },
  followerCount: 2,
  followingCount: 7,
};

const setup = (props = {}) => {
  const handlers = { onToggleFollow: vi.fn(), onEdit: vi.fn(), onReport: vi.fn() };
  renderWithRouter(
    <ProfileHeader
      profile={profile}
      displayName="Pen Name"
      avatar=""
      postCount={3}
      own={false}
      viewerId={undefined}
      editing={false}
      isFollowing={false}
      isFollowLoading={false}
      {...handlers}
      {...props}
    />
  );
  return handlers;
};

describe("ProfileHeader", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the identity, bio and the three counters", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Pen Name" })).toBeInTheDocument();
    expect(screen.getByText("@pen", { selector: ".profile-handle" })).toBeInTheDocument();
    expect(screen.getByText("letters, mostly")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Followers")).toBeInTheDocument();
    expect(screen.getByText("Following")).toBeInTheDocument();
  });

  it("shows the portrait when there is one and an initial when there is not", () => {
    setup({ avatar: "http://img/a.png" });
    expect(screen.getByRole("img", { name: "Pen Name" })).toHaveAttribute(
      "src",
      "http://img/a.png"
    );

    setup();
    expect(screen.getByText("P")).toBeInTheDocument();
  });

  it("falls back to zero for missing follower / following counts", () => {
    setup({ profile: { _id: "u1", username: "pen" }, postCount: 0 });
    expect(screen.getAllByText("0")).toHaveLength(3);
  });

  it("nudges the owner to add a bio, and tells visitors there is none", () => {
    setup({ profile: { ...profile, bio: "" }, own: true, viewerId: "u1" });
    expect(
      screen.getByText("Add a bio so readers know whose pages they're turning.")
    ).toBeInTheDocument();

    setup({ profile: { ...profile, bio: "" } });
    expect(screen.getByText("No bio yet.")).toBeInTheDocument();
  });

  it("hides every action from a signed-out visitor", () => {
    setup();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers follow and report to a signed-in visitor", () => {
    const h = setup({ viewerId: "viewer" });

    const follow = screen.getByRole("button", { name: "Follow" });
    expect(follow).toHaveClass("primary-btn");
    fireEvent.click(follow);
    expect(h.onToggleFollow).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Report/ }));
    expect(h.onReport).toHaveBeenCalledTimes(1);

    expect(screen.queryByRole("button", { name: /Edit profile/ })).not.toBeInTheDocument();
  });

  it("relabels the follow button once following", () => {
    setup({ viewerId: "viewer", isFollowing: true });
    expect(screen.getByRole("button", { name: "Following" })).toHaveClass("ghost-btn");
  });

  it("disables the follow button while the request is in flight", () => {
    setup({ viewerId: "viewer", isFollowLoading: true });
    expect(screen.getByRole("button", { name: "..." })).toBeDisabled();
  });

  it("hides follow when the viewer is looking at their own profile by id", () => {
    setup({ viewerId: "u1" });
    expect(screen.queryByRole("button", { name: "Follow" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Report/ })).not.toBeInTheDocument();
  });

  it("offers edit on my own profile and calls back", () => {
    const h = setup({ own: true, viewerId: "u1" });
    fireEvent.click(screen.getByRole("button", { name: /Edit profile/ }));
    expect(h.onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Follow" })).not.toBeInTheDocument();
  });

  it("hides the edit button while the editor is already open", () => {
    setup({ own: true, viewerId: "u1", editing: true });
    expect(screen.queryByRole("button", { name: /Edit profile/ })).not.toBeInTheDocument();
  });
});
