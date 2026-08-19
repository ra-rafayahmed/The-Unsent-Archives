import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithRouter } from "../../test/utils";
import ReportsPanel from "./ReportsPanel";

const postReport = {
  _id: "r1",
  reason: "spam",
  status: "open",
  targetType: "post",
  note: "this is junk",
  reporterId: { _id: "u2", username: "reader" },
  target: {
    _id: "p1",
    content: "a note left unsent",
    authorId: { _id: "u1", username: "pen" },
  },
};

const userReport = {
  _id: "r2",
  reason: "harassment",
  status: "open",
  targetType: "user",
  reporterId: { _id: "u2", username: "reader" },
  target: { _id: "u1", username: "pen", reportCount: 3, isSuspended: false },
};

const setup = (props = {}) => {
  const handlers = {
    onFilterChange: vi.fn(),
    onResolve: vi.fn().mockResolvedValue(true),
    onDeletePost: vi.fn().mockResolvedValue(true),
    onToggleSuspend: vi.fn(),
  };
  renderWithRouter(<ReportsPanel reports={[]} reportFilter="open" {...handlers} {...props} />);
  return handlers;
};

describe("ReportsPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the calm empty state when there are no reports", () => {
    setup();
    expect(screen.getByText("No reports here. The archive is calm.")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("titles the pane after the active filter", () => {
    setup({ reportFilter: "resolved" });
    expect(screen.getByRole("heading", { name: "resolved reports" })).toBeInTheDocument();
  });

  it("titles the pane 'All reports' for the all filter", () => {
    setup({ reportFilter: "all" });
    expect(screen.getByRole("heading", { name: "All reports" })).toBeInTheDocument();
  });

  it("marks the active filter pill and reports a click on another", () => {
    const h = setup({ reportFilter: "resolved" });
    expect(screen.getByRole("button", { name: "resolved" })).toHaveClass("pill", "active");
    expect(screen.getByRole("button", { name: "dismissed" })).not.toHaveClass("active");

    fireEvent.click(screen.getByRole("button", { name: "dismissed" }));
    expect(h.onFilterChange).toHaveBeenCalledWith("dismissed");
  });

  it("renders a post report with its reason, note, reporter and target", () => {
    setup({ reports: [postReport] });
    expect(screen.getByText("spam")).toBeInTheDocument();
    expect(screen.getByText('"this is junk"')).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "@reader" })).toHaveAttribute("href", "/profile/u2");
    expect(screen.getByText("Note · filed by")).toBeInTheDocument();
    expect(screen.getByText('"a note left unsent"')).toBeInTheDocument();
    expect(screen.getByText("by @pen")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /a note left unsent/ })).toHaveAttribute(
      "href",
      "/posts/p1"
    );
  });

  it("renders a user report with the account's report count", () => {
    setup({ reports: [userReport] });
    expect(screen.getByText("harassment")).toBeInTheDocument();
    expect(screen.getByText("Account · filed by")).toBeInTheDocument();
    expect(screen.getByText("· 3 report(s)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /@pen/ })).toHaveAttribute("href", "/profile/u1");
    // avatar falls back to the first initial
    expect(screen.getByText("P")).toBeInTheDocument();
  });

  it("falls back to 'anon' when the reporter is gone", () => {
    setup({ reports: [{ ...postReport, reporterId: null }] });
    expect(screen.getByText("Note · filed by anon")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "@reader" })).not.toBeInTheDocument();
  });

  it("says so when the reported note no longer exists", () => {
    setup({ reports: [{ ...postReport, target: null }] });
    expect(screen.getByText("Post no longer exists")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete note/ })).not.toBeInTheDocument();
  });

  it("says so when the reported account no longer exists", () => {
    setup({ reports: [{ ...userReport, target: null }] });
    expect(screen.getByText("User no longer exists")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Suspend user/ })).not.toBeInTheDocument();
  });

  it("resolves and dismisses a report by id", () => {
    const h = setup({ reports: [postReport] });

    fireEvent.click(screen.getByRole("button", { name: /Mark resolved/ }));
    expect(h.onResolve).toHaveBeenCalledWith("r1", "resolved");

    fireEvent.click(screen.getByRole("button", { name: /Dismiss/ }));
    expect(h.onResolve).toHaveBeenLastCalledWith("r1", "dismissed");
  });

  it("deletes the reported note and then resolves the report", async () => {
    const h = setup({ reports: [postReport] });

    fireEvent.click(screen.getByRole("button", { name: /Delete note/ }));
    await waitFor(() => expect(h.onDeletePost).toHaveBeenCalledWith("p1"));
    await waitFor(() => expect(h.onResolve).toHaveBeenCalledWith("r1", "resolved"));
  });

  it("leaves the report open when the delete is refused", async () => {
    const h = setup({ reports: [postReport] });
    h.onDeletePost.mockResolvedValue(false);

    fireEvent.click(screen.getByRole("button", { name: /Delete note/ }));
    await waitFor(() => expect(h.onDeletePost).toHaveBeenCalledWith("p1"));
    expect(h.onResolve).not.toHaveBeenCalled();
  });

  it("suspends the reported account, passing the current flag", () => {
    const h = setup({ reports: [userReport] });
    fireEvent.click(screen.getByRole("button", { name: "Suspend user" }));
    expect(h.onToggleSuspend).toHaveBeenCalledWith("u1", false);
  });

  it("offers to unsuspend an already suspended account", () => {
    const suspended = { ...userReport, target: { ...userReport.target, isSuspended: true } };
    const h = setup({ reports: [suspended] });
    fireEvent.click(screen.getByRole("button", { name: "Unsuspend user" }));
    expect(h.onToggleSuspend).toHaveBeenCalledWith("u1", true);
  });

  it("offers no suspend action on a post report", () => {
    setup({ reports: [postReport] });
    expect(screen.queryByRole("button", { name: /suspend user/i })).not.toBeInTheDocument();
  });

  it("offers no delete-note action on a user report", () => {
    setup({ reports: [userReport] });
    expect(screen.queryByRole("button", { name: /Delete note/ })).not.toBeInTheDocument();
  });

  it("hides the action row for reports that are already closed", () => {
    setup({ reports: [{ ...postReport, status: "dismissed" }] });
    expect(screen.getByText("dismissed", { selector: ".report-status" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mark resolved/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Dismiss/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete note/ })).not.toBeInTheDocument();
  });

  it("renders every report in the list", () => {
    setup({ reports: [postReport, userReport], reportFilter: "all" });
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
