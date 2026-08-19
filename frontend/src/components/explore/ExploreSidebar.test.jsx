import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithRouter } from "../../test/utils";
import ExploreSidebar from "./ExploreSidebar";

const tags = [
  { _id: "t1", slug: "grief" },
  { _id: "t2", slug: "quiet hope" },
];

const searchUsers = [
  { _id: "u1", username: "found", avatarUrl: "", profile: { displayName: "Found Writer" } },
  { _id: "u2", username: "other", avatarUrl: "http://img/o.png" },
];

const topWriters = [
  { _id: "w1", username: "loud", avatarUrl: "" },
  { _id: "w2", username: "steady", avatarUrl: "http://img/s.png" },
];

const setup = (props = {}) => {
  const onTagSelect = vi.fn();
  const view = renderWithRouter(
    <ExploreSidebar
      trendingTags={[]}
      onTagSelect={onTagSelect}
      showingSearch={false}
      searchUsers={[]}
      topWriters={[]}
      {...props}
    />
  );
  return { onTagSelect, ...view };
};

describe("ExploreSidebar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("always shows the trending tags panel and the archivist quote", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Trending tags" })).toBeInTheDocument();
    expect(
      screen.getByText("Some letters were never meant to be sent. They were meant to be kept.")
    ).toBeInTheDocument();
    expect(screen.getByText("— the archivist")).toBeInTheDocument();
  });

  it("shows the empty state when nothing is trending", () => {
    setup();
    expect(screen.getByText("No tags trending yet.")).toBeInTheDocument();
  });

  it("links each trending tag to an encoded explore search", () => {
    setup({ trendingTags: tags });
    expect(screen.queryByText("No tags trending yet.")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "#grief" })).toHaveAttribute(
      "href",
      "/explore?q=grief"
    );
    expect(screen.getByRole("link", { name: "#quiet hope" })).toHaveAttribute(
      "href",
      "/explore?q=quiet%20hope"
    );
  });

  it("reports the chosen tag's slug when a chip is clicked", () => {
    const { onTagSelect } = setup({ trendingTags: tags });
    fireEvent.click(screen.getByRole("link", { name: "#quiet hope" }));
    expect(onTagSelect).toHaveBeenCalledWith("quiet hope");
  });

  it("shows matching writers with their display names while a search is active", () => {
    setup({ showingSearch: true, searchUsers, topWriters });
    expect(screen.getByRole("heading", { name: "Writers" })).toBeInTheDocument();
    expect(screen.getByText("@found")).toBeInTheDocument();
    expect(screen.getByText("· Found Writer")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /@found/ })).toHaveAttribute("href", "/profile/u1");
    // the browse-mode panel stays hidden during a search
    expect(screen.queryByRole("heading", { name: "Voices to follow" })).not.toBeInTheDocument();
    expect(screen.queryByText("@loud")).not.toBeInTheDocument();
  });

  it("omits the writers panel when a search matched nobody", () => {
    setup({ showingSearch: true, searchUsers: [], topWriters });
    expect(screen.queryByRole("heading", { name: "Writers" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Voices to follow" })).not.toBeInTheDocument();
  });

  it("shows top voices while browsing", () => {
    setup({ topWriters, searchUsers });
    expect(screen.getByRole("heading", { name: "Voices to follow" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /@steady/ })).toHaveAttribute("href", "/profile/w2");
    expect(screen.queryByRole("heading", { name: "Writers" })).not.toBeInTheDocument();
    expect(screen.queryByText("@found")).not.toBeInTheDocument();
  });

  it("hides the voices panel when there are no top writers", () => {
    setup();
    expect(screen.queryByRole("heading", { name: "Voices to follow" })).not.toBeInTheDocument();
  });

  it("uses an initial when a writer has no portrait and the image when they do", () => {
    const { container } = setup({ topWriters });
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(container.querySelector('img[src="http://img/s.png"]')).toBeInTheDocument();
  });
});
