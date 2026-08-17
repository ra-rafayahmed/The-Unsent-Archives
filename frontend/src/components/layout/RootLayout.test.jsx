import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";
import RootLayout from "./RootLayout";

const authState = { user: null, isAuthenticated: false, isAdmin: false, logout: vi.fn() };
vi.mock("../../context/AuthContext", () => ({ useAuth: () => authState }));

// Purely decorative drifting SVGs — stubbed so the shell test stays focused.
vi.mock("../decor/AmbientDoodles", () => ({
  default: () => <div data-testid="ambient-doodles" />,
}));

const ExploreScreen = () => (
  <div>
    <p>explore screen</p>
    <Link to="/library">go to library</Link>
  </div>
);

const renderShell = (route = "/explore") =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/explore" element={<ExploreScreen />} />
          <Route path="/library" element={<p>library screen</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

describe("RootLayout", () => {
  beforeEach(() => {
    authState.user = null;
    authState.isAuthenticated = false;
    authState.isAdmin = false;
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("wraps the routed page in the chrome: doodles, navbar and mobile nav", () => {
    renderShell();

    expect(screen.getByTestId("ambient-doodles")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "The Unsent Archives" })).toBeInTheDocument();
    expect(screen.getByText("explore screen")).toBeInTheDocument();
    // desktop topbar nav + bottom mobile nav
    expect(screen.getAllByRole("navigation")).toHaveLength(2);
    expect(screen.getByText("collections_bookmark")).toBeInTheDocument();
  });

  it("renders the routed page inside the main page shell", () => {
    const { container } = renderShell();
    const main = container.querySelector("main.page-shell");
    expect(main).toBeInTheDocument();
    expect(main.querySelector(".page-fade")).toContainElement(screen.getByText("explore screen"));
  });

  it("hides the compose shortcut when signed out and shows it when signed in", () => {
    const { unmount } = renderShell();
    expect(screen.queryByRole("link", { name: "Create a new note" })).not.toBeInTheDocument();
    unmount();

    authState.isAuthenticated = true;
    authState.user = { id: "u1", username: "pen" };
    renderShell();
    expect(screen.getByRole("link", { name: "Create a new note" })).toHaveAttribute(
      "href",
      "/write"
    );
  });

  it("swaps the outlet content when the reader navigates", () => {
    renderShell();
    fireEvent.click(screen.getByRole("link", { name: "go to library" }));

    expect(screen.getByText("library screen")).toBeInTheDocument();
    expect(screen.queryByText("explore screen")).not.toBeInTheDocument();
  });

  it("scrolls back to the top on mount and again on every route change", () => {
    renderShell();
    // jsdom supports scroll-behavior, so the instant jump is requested.
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
    expect(window.scrollTo).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("link", { name: "go to library" }));
    expect(window.scrollTo).toHaveBeenCalledTimes(2);
  });

  it("falls back to auto scrolling where scroll-behavior is unsupported", () => {
    const style = document.documentElement.style;
    const had = "scrollBehavior" in style;
    if (had) delete style.scrollBehavior;
    try {
      renderShell();
      expect(window.scrollTo).toHaveBeenCalledWith({
        top: 0,
        behavior: "scrollBehavior" in style ? "instant" : "auto",
      });
    } finally {
      if (had && !("scrollBehavior" in style)) style.scrollBehavior = "";
    }
  });
});
