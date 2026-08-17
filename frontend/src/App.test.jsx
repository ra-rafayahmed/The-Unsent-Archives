import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

vi.mock("./api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const authState = {
  user: null,
  loading: false,
  isAuthenticated: false,
  isAdmin: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  updateCurrentUser: vi.fn(),
};
vi.mock("./context/AuthContext", () => ({ useAuth: () => authState }));
vi.mock("./components/decor/Doodles", () => ({ default: () => null }));
vi.mock("./components/decor/AmbientDoodles", () => ({ default: () => null }));

import api from "./api/axios";

const renderAt = (route) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>
  );

describe("App routing", () => {
  beforeEach(() => {
    api.get.mockResolvedValue({ data: { posts: [], collections: [], tags: [], users: [] } });
    api.post.mockResolvedValue({ data: {} });
    authState.user = null;
    authState.isAuthenticated = false;
    authState.isAdmin = false;
  });

  it("renders the eagerly-loaded home route without a Suspense fallback", async () => {
    renderAt("/");
    // HomePage is bundled with the entry chunk, so it paints immediately.
    expect(await screen.findByText(/The Unsent Archives/i)).toBeInTheDocument();
  });

  it("renders the eagerly-loaded login route", () => {
    renderAt("/login");
    expect(screen.getByRole("heading", { name: "Sign in to your shelf" })).toBeInTheDocument();
  });

  it.each([
    ["/register", "Create your writer profile"],
    ["/forgot-password", "Recover your account"],
    ["/recover", "Recover with a backup code"],
  ])("lazily loads %s", async (route, heading) => {
    renderAt(route);
    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
  });

  it("lazily loads the explore route inside the layout", async () => {
    renderAt("/explore");
    expect(
      await screen.findByRole("heading", { name: "Explore the Archives" })
    ).toBeInTheDocument();
  });

  it("sends an unauthenticated visitor from a protected route to login", async () => {
    renderAt("/library");
    expect(
      await screen.findByRole("heading", { name: "Sign in to your shelf" })
    ).toBeInTheDocument();
  });

  it("lazily loads a protected route for a signed-in reader", async () => {
    authState.user = { id: "u1", username: "pen" };
    authState.isAuthenticated = true;
    renderAt("/library");
    expect(await screen.findByRole("heading", { name: "My Library" })).toBeInTheDocument();
  });

  it("redirects an unknown path home", async () => {
    renderAt("/no-such-page");
    expect(await screen.findByText(/The Unsent Archives/i)).toBeInTheDocument();
  });
});
