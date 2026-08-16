import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Login from "./Login";

const login = vi.fn();
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ login }),
}));
vi.mock("../../components/decor/Doodles", () => ({ default: () => null }));

const renderLogin = (initialEntry = "/login") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<div>Home page</div>} />
        <Route path="/secret" element={<div>Secret page</div>} />
      </Routes>
    </MemoryRouter>
  );

const fill = () => {
  fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
    target: { value: "me@example.com" },
  });
  fireEvent.change(screen.getByPlaceholderText("Your secret line"), {
    target: { value: "hunter22" },
  });
};

describe("Login page", () => {
  beforeEach(() => login.mockReset());

  it("renders the form and helper links", () => {
    renderLogin();
    expect(screen.getByRole("heading", { name: "Sign in to your shelf" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Forgot?" })).toHaveAttribute(
      "href",
      "/forgot-password"
    );
    expect(screen.getByRole("link", { name: "Start your archive" })).toHaveAttribute(
      "href",
      "/register"
    );
    expect(screen.getByRole("link", { name: "Recover with a code" })).toHaveAttribute(
      "href",
      "/recover"
    );
  });

  it("submits credentials and navigates home on success", async () => {
    login.mockResolvedValueOnce({});
    renderLogin();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({ email: "me@example.com", password: "hunter22" })
    );
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });

  it("redirects back to the page the user came from", async () => {
    login.mockResolvedValueOnce({});
    render(
      <MemoryRouter
        initialEntries={[{ pathname: "/login", state: { from: { pathname: "/secret" } } }]}
      >
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/secret" element={<div>Secret page</div>} />
        </Routes>
      </MemoryRouter>
    );
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Secret page")).toBeInTheDocument();
  });

  it("shows the API error message on failure and re-enables the button", async () => {
    login.mockRejectedValueOnce({ response: { data: { message: "Invalid email or password" } } });
    renderLogin();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(screen.queryByText("Home page")).not.toBeInTheDocument();
  });

  it("falls back to a generic error when the failure has no message", async () => {
    login.mockRejectedValueOnce(new Error("network"));
    renderLogin();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Login failed")).toBeInTheDocument();
  });
});
