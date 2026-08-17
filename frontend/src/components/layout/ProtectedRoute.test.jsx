import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

let auth;
vi.mock("../../context/AuthContext", () => ({ useAuth: () => auth }));

/** Login stand-in that reports where the guard says the visitor came from. */
const LoginStub = () => {
  const location = useLocation();
  return <div>Login page for {location.state?.from?.pathname ?? "nowhere"}</div>;
};

const renderGuarded = () =>
  render(
    <MemoryRouter initialEntries={["/secret"]}>
      <Routes>
        <Route path="/login" element={<LoginStub />} />
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
  );

describe("ProtectedRoute", () => {
  beforeEach(() => {
    auth = { isAuthenticated: false, loading: false };
  });

  it("shows a placeholder instead of the children while the session is being checked", () => {
    auth = { isAuthenticated: false, loading: true };
    renderGuarded();

    expect(screen.getByText("Checking session...")).toBeInTheDocument();
    expect(screen.queryByText("Secret content")).not.toBeInTheDocument();
    expect(screen.queryByText(/Login page/)).not.toBeInTheDocument();
  });

  it("does not flash the login redirect while an authenticated session is still loading", () => {
    auth = { isAuthenticated: true, loading: true };
    renderGuarded();

    expect(screen.getByText("Checking session...")).toBeInTheDocument();
    expect(screen.queryByText("Secret content")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated visitors to /login and remembers where they were headed", () => {
    renderGuarded();

    expect(screen.getByText("Login page for /secret")).toBeInTheDocument();
    expect(screen.queryByText("Secret content")).not.toBeInTheDocument();
  });

  it("renders the children for an authenticated visitor", () => {
    auth = { isAuthenticated: true, loading: false };
    renderGuarded();

    expect(screen.getByText("Secret content")).toBeInTheDocument();
    expect(screen.queryByText(/Login page/)).not.toBeInTheDocument();
    expect(screen.queryByText("Checking session...")).not.toBeInTheDocument();
  });
});
