import { describe, it, expect, vi, beforeEach } from "vitest";
import { cloneElement } from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithRouter } from "../../test/utils";
import api from "../../api/axios";
import AnalyticsDashboard from "./AnalyticsDashboard";

vi.mock("../../api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const authState = { user: { id: "u1", username: "penpal" } };
vi.mock("../../context/AuthContext", () => ({ useAuth: () => authState }));

/**
 * recharts draws into an SVG that jsdom never lays out, so the real charts render
 * nothing measurable. Light stubs keep the surrounding markup real while exposing
 * each chart's `data` as JSON we can assert on, and render the custom `Tooltip`
 * content both active and inactive.
 */
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: ({ data, children }) => (
    <div data-testid="bar-chart" data-chart={JSON.stringify(data)}>
      {children}
    </div>
  ),
  PieChart: ({ children }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ data, children }) => (
    <div data-testid="pie" data-chart={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Bar: ({ dataKey }) => <span data-testid="bar" data-key={dataKey} />,
  Cell: ({ fill }) => <span data-testid="cell" data-fill={fill} />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: ({ content }) => (
    <div data-testid="tooltip">
      {cloneElement(content, { active: true, label: "Reads", payload: [{ name: "n", value: 7 }] })}
      {cloneElement(content, { active: false, payload: [] })}
    </div>
  ),
}));

const chartData = (el) => JSON.parse(el.getAttribute("data-chart"));

const notes = [
  { _id: "p1", content: "first note" },
  { _id: "p2", content: "second note" },
];

const analyticsPayload = {
  totals: { totalViews: 120, totalSaves: 9, totalReactions: 34 },
  eventBreakdown: { view: 120, save: 9 },
};

const postAnalytics = {
  p1: {
    views: 100,
    saves: 5,
    reactions: 20,
    comments: 3,
    engagementRate: 28.5,
    events: { view: 100 },
  },
  p2: { views: 20, saves: 4, reactions: 14, comments: 1, engagementRate: 95, events: {} },
};

/** Route the mocked GET by URL so each test can shape the responses. */
const mockApi = ({ analytics = analyticsPayload, posts = notes, perPost = postAnalytics } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === "/users/u1/analytics") return Promise.resolve({ data: analytics });
    if (url === "/users/u1/posts") return Promise.resolve({ data: { posts } });
    const match = /^\/posts\/(.+)\/analytics$/.exec(url);
    if (match) return Promise.resolve({ data: { analytics: perPost[match[1]] ?? null } });
    return Promise.reject(new Error(`unmocked GET ${url}`));
  });
};

const renderDashboard = () =>
  renderWithRouter(<AnalyticsDashboard />, { route: "/analytics", path: "/analytics" });

describe("AnalyticsDashboard", () => {
  beforeEach(() => {
    api.get.mockReset();
    authState.user = { id: "u1", username: "penpal" };
  });

  it("fetches the user's totals and notes on mount and renders the stat tiles", async () => {
    mockApi();
    renderDashboard();

    expect(await screen.findByText("120")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/users/u1/analytics");
    expect(api.get).toHaveBeenCalledWith("/users/u1/posts", { params: { limit: 100 } });

    expect(screen.getByRole("heading", { level: 1, name: "Analytics" })).toBeInTheDocument();
    expect(screen.getByText("Total reads").previousSibling).toHaveTextContent("120");
    expect(screen.getByText("Saves").previousSibling).toHaveTextContent("9");
    expect(screen.getByText("Reactions").previousSibling).toHaveTextContent("34");
    // "Notes" is the count of the fetched posts, not an API field.
    expect(screen.getByText("Notes").previousSibling).toHaveTextContent("2");
  });

  it("shows a loading state rather than a flash of zeros before the requests resolve", async () => {
    mockApi();
    renderDashboard();

    expect(screen.getByText("Reading the archive...")).toBeInTheDocument();
    expect(screen.queryByText("Total reads")).not.toBeInTheDocument();
    expect(screen.queryByText("No events tracked yet.")).not.toBeInTheDocument();

    // ...and it settles into the real numbers.
    expect(await screen.findByText("120")).toBeInTheDocument();
    expect(screen.queryByText("Reading the archive...")).not.toBeInTheDocument();
  });

  it("does not call the API at all when there is no signed-in user id", async () => {
    authState.user = null;
    mockApi();
    renderDashboard();

    await waitFor(() => expect(screen.getByText("Total reads")).toBeInTheDocument());
    expect(api.get).not.toHaveBeenCalled();
    expect(screen.getByText("No data yet — share a note to start the count.")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("feeds the totals pie and the event bar chart from the analytics response", async () => {
    mockApi();
    renderDashboard();
    await screen.findByText("120");

    expect(chartData(screen.getByTestId("pie"))).toEqual([
      { name: "Views", value: 120 },
      { name: "Saves", value: 9 },
      { name: "Reactions", value: 34 },
    ]);
    expect(screen.getAllByTestId("cell")).toHaveLength(3);

    const [eventChart] = screen.getAllByTestId("bar-chart");
    expect(chartData(eventChart)).toEqual([
      { name: "view", count: 120 },
      { name: "save", count: 9 },
    ]);
  });

  it("renders the custom tooltip content when a chart slice is active", async () => {
    mockApi();
    renderDashboard();
    await screen.findByText("120");

    const [tooltip] = screen.getAllByTestId("tooltip");
    expect(tooltip).toHaveTextContent("Reads");
    expect(tooltip).toHaveTextContent("n: 7");
    // The inactive clone renders nothing, so the label appears exactly once.
    expect(tooltip.querySelectorAll("strong")).toHaveLength(1);
  });

  it("auto-selects the first note, loads its analytics and shows the engagement rate", async () => {
    mockApi();
    renderDashboard();

    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/posts/p1/analytics"));

    expect(await screen.findByText("28.5%")).toBeInTheDocument();
    expect(screen.getByText("Engagement rate")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("p1");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "first note",
      "second note",
    ]);

    const perPostChart = screen.getAllByTestId("bar-chart")[1];
    expect(chartData(perPostChart)).toEqual([
      { name: "Views", value: 100 },
      { name: "Saves", value: 5 },
      { name: "Reactions", value: 20 },
      { name: "Comments", value: 3 },
    ]);

    // p1 has events, so the "Event mix" panel renders a third bar chart.
    expect(screen.getByRole("heading", { name: "Event mix" })).toBeInTheDocument();
    expect(chartData(screen.getAllByTestId("bar-chart")[2])).toEqual([
      { name: "view", count: 100 },
    ]);
  });

  it("re-fetches per-note analytics when a different note is selected", async () => {
    mockApi();
    renderDashboard();
    await screen.findByText("28.5%");

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "p2" } });

    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/posts/p2/analytics"));
    expect(await screen.findByText("95%")).toBeInTheDocument();
    expect(chartData(screen.getAllByTestId("bar-chart")[1])).toEqual([
      { name: "Views", value: 20 },
      { name: "Saves", value: 4 },
      { name: "Reactions", value: 14 },
      { name: "Comments", value: 1 },
    ]);
    // p2 has no events: the "Event mix" panel is dropped.
    expect(screen.queryByRole("heading", { name: "Event mix" })).not.toBeInTheDocument();
  });

  it("labels untitled notes and truncates long note content to 60 characters", async () => {
    const long = "x".repeat(90);
    mockApi({
      posts: [
        { _id: "p1", content: "" },
        { _id: "p2", content: long },
      ],
      perPost: { p1: postAnalytics.p1, p2: postAnalytics.p2 },
    });
    renderDashboard();

    expect(await screen.findByRole("option", { name: "Untitled" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "x".repeat(60) })).toBeInTheDocument();
  });

  it("keeps the empty states when the user has no data and no notes", async () => {
    mockApi({ analytics: { totals: {}, eventBreakdown: {} }, posts: [] });
    renderDashboard();

    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/users/u1/posts", expect.anything()));

    expect(screen.getByText("No data yet — share a note to start the count.")).toBeInTheDocument();
    expect(screen.getByText("No events tracked yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No notes to analyze yet" })).toBeInTheDocument();
    expect(
      screen.getByText("Publish a note and its numbers will appear here.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    // No selected note means no per-note request.
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it("tolerates an analytics response with no totals or breakdown", async () => {
    mockApi({ analytics: {}, posts: [] });
    renderDashboard();

    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/users/u1/analytics"));
    expect(screen.getByText("Total reads").previousSibling).toHaveTextContent("0");
    expect(screen.getByText("No events tracked yet.")).toBeInTheDocument();
  });

  it("surfaces the API message when the dashboard load fails", async () => {
    api.get.mockRejectedValue({ response: { data: { message: "Analytics are disabled" } } });
    renderDashboard();

    expect(await screen.findByText("Analytics are disabled")).toBeInTheDocument();
    expect(screen.getByText("Total reads").previousSibling).toHaveTextContent("0");
  });

  it("says the server is unreachable when the dashboard request gets no response", async () => {
    api.get.mockRejectedValue(new Error("boom"));
    renderDashboard();

    expect(await screen.findByText(/Cannot reach the server/)).toBeInTheDocument();
  });

  it("falls back to a generic message when an HTTP failure carries no detail", async () => {
    api.get.mockRejectedValue({ response: { status: 400, data: {} } });
    renderDashboard();

    expect(await screen.findByText("Failed to load analytics")).toBeInTheDocument();
  });

  it("shows a per-note error and hides the engagement rate when that request fails", async () => {
    api.get.mockImplementation((url) => {
      if (url === "/users/u1/analytics") return Promise.resolve({ data: analyticsPayload });
      if (url === "/users/u1/posts") return Promise.resolve({ data: { posts: notes } });
      return Promise.reject({ response: { data: { message: "Note analytics unavailable" } } });
    });
    renderDashboard();

    expect(await screen.findByText("Note analytics unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Engagement rate")).not.toBeInTheDocument();
    // The chart panel still renders, just with no data.
    expect(chartData(screen.getAllByTestId("bar-chart")[1])).toEqual([]);
  });

  it("hides the engagement rate when the response carries no analytics object", async () => {
    mockApi({ perPost: {} });
    renderDashboard();

    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/posts/p1/analytics"));
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.queryByText("Engagement rate")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Event mix" })).not.toBeInTheDocument();
  });

  it("renders 0% when a note has no engagement rate", async () => {
    mockApi({ perPost: { p1: { views: 1, saves: 0, reactions: 0, comments: 0 } } });
    renderDashboard();

    expect(await screen.findByText("0%")).toBeInTheDocument();
  });
});
