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

const fill = () => {
  fireEvent.change(screen.getByPlaceholderText("e.g. midnight_pen"), {
    target: { value: "quiet_ink" },
  });
  fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
    target: { value: "q@example.com" },
  });
  fireEvent.change(screen.getByPlaceholderText("At least 6 characters"), {
    target: { value: "hunter22" },
  });
};

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
});
