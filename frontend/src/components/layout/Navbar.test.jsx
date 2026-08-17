import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Navbar from "./Navbar";

const authState = { user: null, isAuthenticated: false, isAdmin: false, logout: vi.fn() };
vi.mock("../../context/AuthContext", () => ({ useAuth: () => authState }));

/**
 * Renders the navbar above a tiny route table so navigation triggered by the
 * navbar itself (logout -> "/") is observable.
 */
const renderNavbar = (route = "/library") =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <Navbar />
      <Routes>
        <Route path="/" element={<p>landing screen</p>} />
        <Route path="*" element={<p>some other screen</p>} />
      </Routes>
    </MemoryRouter>
  );

const signIn = (overrides = {}) => {
  authState.user = { id: "u1", username: "midnight_pen", ...overrides };
  authState.isAuthenticated = true;
};

describe("Navbar", () => {
  beforeEach(() => {
    authState.user = null;
    authState.isAuthenticated = false;
    authState.isAdmin = false;
    authState.logout.mockReset();
  });

  it("always links the brand home and offers Home / Explore", () => {
    renderNavbar();
    expect(screen.getByRole("link", { name: "The Unsent Archives" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Explore" })).toHaveAttribute("href", "/explore");
  });

  it("offers Login and Join, and hides member-only links, when signed out", () => {
    renderNavbar();
    expect(screen.getByRole("link", { name: "Login" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Join" })).toHaveAttribute("href", "/register");

    expect(screen.queryByRole("link", { name: "Library" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Analytics" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Logout" })).not.toBeInTheDocument();
  });

  it("swaps Login/Join for the profile link and Logout when signed in", () => {
    signIn();
    renderNavbar();

    expect(screen.getByRole("link", { name: "Library" })).toHaveAttribute("href", "/library");
    expect(screen.getByRole("link", { name: "Analytics" })).toHaveAttribute("href", "/analytics");
    expect(screen.getByRole("link", { name: "midnight_pen" })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();

    expect(screen.queryByRole("link", { name: "Login" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Join" })).not.toBeInTheDocument();
  });

  it("shows the Admin link only for admins", () => {
    signIn();
    const { unmount } = renderNavbar();
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
    unmount();

    authState.isAdmin = true;
    renderNavbar();
    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
  });

  it("renders the avatar when the user has one", () => {
    signIn({ avatarUrl: "http://cdn/me.png" });
    renderNavbar();
    expect(screen.getByAltText("avatar")).toHaveAttribute("src", "http://cdn/me.png");
  });

  it("labels the profile link 'Profile' when the user has no username", () => {
    signIn({ username: "" });
    renderNavbar();
    const profileLink = screen.getByRole("link", { name: "Profile" });
    expect(profileLink).toHaveAttribute("href", "/profile");
    expect(screen.queryByAltText("avatar")).not.toBeInTheDocument();
  });

  it("logs out and sends the reader back to the landing page", () => {
    signIn();
    renderNavbar("/library");
    expect(screen.getByText("some other screen")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    expect(authState.logout).toHaveBeenCalledTimes(1);
    expect(screen.getByText("landing screen")).toBeInTheDocument();
  });

  it("marks the nav link for the current route as active", () => {
    renderNavbar("/explore");
    expect(screen.getByRole("link", { name: "Explore" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveClass("active");
  });
});
