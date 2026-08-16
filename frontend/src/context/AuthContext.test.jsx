import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import api from "../api/axios";
import { AuthProvider, useAuth } from "./AuthContext";
import ProtectedRoute from "../components/layout/ProtectedRoute";

vi.mock("../api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

/** Tiny consumer that exposes context state and actions to the DOM. */
const Probe = () => {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(auth.loading)}</span>
      <span data-testid="authed">{String(auth.isAuthenticated)}</span>
      <span data-testid="admin">{String(auth.isAdmin)}</span>
      <span data-testid="user">{auth.user ? auth.user.username : "-"}</span>
      <span data-testid="uid">{auth.user ? auth.user.id : "-"}</span>
      <button onClick={() => auth.login({ email: "a@b.c", password: "x" })}>login</button>
      <button onClick={() => auth.logout()}>logout</button>
    </div>
  );
};

const renderProbe = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );

describe("AuthProvider", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts unauthenticated with no token and does not call /auth/me", async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("authed")).toHaveTextContent("false");
    expect(api.get).not.toHaveBeenCalled();
  });

  it("bootstraps the session from a stored token via /auth/me", async () => {
    localStorage.setItem("token", "t0k");
    api.get.mockResolvedValueOnce({
      data: { user: { _id: "abc", username: "alice", role: "admin" } },
    });

    renderProbe();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    expect(api.get).toHaveBeenCalledWith("/auth/me");
    expect(screen.getByTestId("authed")).toHaveTextContent("true");
    expect(screen.getByTestId("admin")).toHaveTextContent("true");
    expect(screen.getByTestId("user")).toHaveTextContent("alice");
    // normalizeUser maps _id -> id
    expect(screen.getByTestId("uid")).toHaveTextContent("abc");
  });

  it("clears a stale token when /auth/me fails", async () => {
    localStorage.setItem("token", "expired");
    api.get.mockRejectedValueOnce(new Error("401"));

    renderProbe();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    expect(screen.getByTestId("authed")).toHaveTextContent("false");
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("login stores the token and sets the user; logout clears both", async () => {
    api.post.mockResolvedValueOnce({
      data: { token: "new-token", user: { id: "u9", username: "bob", role: "user" } },
    });
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    await act(async () => {
      screen.getByText("login").click();
    });
    expect(api.post).toHaveBeenCalledWith("/auth/login", { email: "a@b.c", password: "x" });
    expect(localStorage.getItem("token")).toBe("new-token");
    expect(screen.getByTestId("user")).toHaveTextContent("bob");
    expect(screen.getByTestId("admin")).toHaveTextContent("false");

    await act(async () => {
      screen.getByText("logout").click();
    });
    expect(localStorage.getItem("token")).toBeNull();
    expect(screen.getByTestId("authed")).toHaveTextContent("false");
  });
});

describe("ProtectedRoute", () => {
  const renderRoutes = () =>
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/secret"]}>
          <Routes>
            <Route path="/login" element={<div>Login page</div>} />
            <Route
              path="/secret"
              element={
                <ProtectedRoute>
                  <div>Secret content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

  it("redirects unauthenticated visitors to /login", async () => {
    renderRoutes();
    expect(await screen.findByText("Login page")).toBeInTheDocument();
    expect(screen.queryByText("Secret content")).not.toBeInTheDocument();
  });

  it("renders children once the session is restored", async () => {
    localStorage.setItem("token", "t0k");
    api.get.mockResolvedValueOnce({ data: { user: { _id: "1", username: "z" } } });
    renderRoutes();
    expect(screen.getByText("Checking session...")).toBeInTheDocument();
    expect(await screen.findByText("Secret content")).toBeInTheDocument();
  });
});
