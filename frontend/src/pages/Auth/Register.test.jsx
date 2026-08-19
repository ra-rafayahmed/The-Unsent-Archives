import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Register from "./Register";

const register = vi.fn();
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ register }) }));
vi.mock("../../components/decor/Doodles", () => ({ default: () => null }));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<div>Home page</div>} />
      </Routes>
    </MemoryRouter>
  );

const fill = ({ username = "quiet_ink", email = "q@example.com", password = "hunter22" } = {}) => {
  fireEvent.change(screen.getByPlaceholderText("e.g. midnight_pen"), {
    target: { value: username },
  });
  fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByPlaceholderText("At least 6 characters"), {
    target: { value: password },
  });
};

const submit = () => fireEvent.click(screen.getByRole("button", { name: "Begin writing" }));

describe("Register page", () => {
  beforeEach(() => register.mockReset());

  it("submits the form and shows one-time backup codes gated behind an acknowledgement", async () => {
    register.mockResolvedValueOnce({ backupCodes: ["aaaa-bbbb-cccc", "dddd-eeee-ffff"] });
    renderPage();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Begin writing" }));

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith({
        username: "quiet_ink",
        email: "q@example.com",
        password: "hunter22",
      })
    );
    expect(await screen.findByText("Your recovery codes")).toBeInTheDocument();
    expect(screen.getByText("aaaa-bbbb-cccc")).toBeInTheDocument();
    expect(screen.getByText("dddd-eeee-ffff")).toBeInTheDocument();

    const cont = screen.getByRole("button", { name: "Continue to my archive" });
    expect(cont).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(cont).toBeEnabled();
    fireEvent.click(cont);
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });

  it("navigates straight home when the API returns no backup codes", async () => {
    register.mockResolvedValueOnce({});
    renderPage();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Begin writing" }));
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });

  it("shows the API error message on failure", async () => {
    register.mockRejectedValueOnce({
      response: { data: { message: "Username is already taken" } },
    });
    renderPage();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Begin writing" }));
    expect(await screen.findByText("Username is already taken")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Begin writing" })).toBeEnabled();
  });

  it("links back to sign in", () => {
    renderPage();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  describe("client-side validation (mirrors the backend Joi schema)", () => {
    it("rejects a username shorter than 3 characters without calling the API", async () => {
      renderPage();
      fill({ username: "ab" });
      submit();

      expect(await screen.findByText("Username must be at least 3 characters")).toBeInTheDocument();
      expect(register).not.toHaveBeenCalled();
    });

    it("rejects a username longer than 30 characters without calling the API", async () => {
      renderPage();
      fill({ username: "a".repeat(31) });
      submit();

      expect(await screen.findByText("Username must be at most 30 characters")).toBeInTheDocument();
      expect(register).not.toHaveBeenCalled();
    });

    it("rejects a username with characters outside the pattern without calling the API", async () => {
      renderPage();
      fill({ username: "midnight pen!" });
      submit();

      expect(
        await screen.findByText("Username can only contain letters, numbers, and underscores")
      ).toBeInTheDocument();
      expect(register).not.toHaveBeenCalled();
    });

    // `type="email"` already blocks the obviously broken shapes, so these cases
    // use addresses the browser accepts but the backend's Joi `.email()` would not.
    it("rejects an email with no top-level domain without calling the API", async () => {
      renderPage();
      fill({ email: "q@example" });
      submit();

      expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
      expect(register).not.toHaveBeenCalled();
    });

    it("rejects a password shorter than 6 characters without calling the API", async () => {
      renderPage();
      fill({ password: "short" });
      submit();

      expect(await screen.findByText("Password must be at least 6 characters")).toBeInTheDocument();
      expect(register).not.toHaveBeenCalled();
    });

    it("shows every failing field at once and clears them on a valid resubmit", async () => {
      register.mockResolvedValueOnce({});
      renderPage();
      fill({ username: "a b", email: "nope@nope", password: "x" });
      submit();

      expect(
        await screen.findByText("Username can only contain letters, numbers, and underscores")
      ).toBeInTheDocument();
      expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
      expect(screen.getByText("Password must be at least 6 characters")).toBeInTheDocument();
      expect(register).not.toHaveBeenCalled();

      fill();
      submit();

      await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
      expect(screen.queryByText("Enter a valid email address")).not.toBeInTheDocument();
    });
  });
});
