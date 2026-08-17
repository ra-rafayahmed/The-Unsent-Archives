import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import api from "../../api/axios";
import ResetPassword from "./ResetPassword";

vi.mock("../../api/axios", () => ({ default: { post: vi.fn() } }));

const updateCurrentUser = vi.fn();
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ updateCurrentUser }) }));
vi.mock("../../components/decor/Doodles", () => ({ default: () => null }));

const renderPage = (route = "/reset-password?token=tok-123") =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<div>Home page</div>} />
      </Routes>
    </MemoryRouter>
  );

const fill = ({ password = "hunter22", confirm = "hunter22" } = {}) => {
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: confirm } });
};

const submit = () => fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

describe("ResetPassword page", () => {
  beforeEach(() => {
    api.post.mockReset();
    updateCurrentUser.mockReset();
    localStorage.clear();
  });

  it("prefills the reset token from the URL and links back to login", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Set a new password" })).toBeInTheDocument();
    expect(screen.getByLabelText("Reset token")).toHaveValue("tok-123");
    expect(screen.getByRole("link", { name: "login" })).toHaveAttribute("href", "/login");
  });

  it("starts with an empty token that the user can paste in themselves", async () => {
    api.post.mockResolvedValueOnce({ data: {} });
    renderPage("/reset-password");
    const tokenField = screen.getByLabelText("Reset token");
    expect(tokenField).toHaveValue("");

    fireEvent.change(tokenField, { target: { value: "pasted-token" } });
    fill();
    submit();

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/auth/reset-password", {
        token: "pasted-token",
        password: "hunter22",
      })
    );
  });

  it("rejects a password shorter than 6 characters without calling the API", async () => {
    renderPage();
    fill({ password: "short", confirm: "short" });
    submit();

    expect(await screen.findByText("Password must be at least 6 characters")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords without calling the API", async () => {
    renderPage();
    fill({ password: "hunter22", confirm: "hunter23" });
    submit();

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("saves the password, signs the user in and lands on the home page", async () => {
    api.post.mockResolvedValueOnce({
      data: { token: "session-token", user: { _id: "u1", username: "alice" } },
    });
    renderPage();
    fill();
    submit();

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/auth/reset-password", {
        token: "tok-123",
        password: "hunter22",
      })
    );
    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(localStorage.getItem("token")).toBe("session-token");
    expect(updateCurrentUser).toHaveBeenCalledWith({ _id: "u1", username: "alice" });
  });

  it("still navigates home when the API returns no session token", async () => {
    api.post.mockResolvedValueOnce({ data: {} });
    renderPage();
    fill();
    submit();

    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(localStorage.getItem("token")).toBeNull();
    expect(updateCurrentUser).not.toHaveBeenCalled();
  });

  it("shows the API error message and stays on the form", async () => {
    api.post.mockRejectedValueOnce({
      response: { data: { message: "Reset link is invalid or expired" } },
    });
    renderPage();
    fill();
    submit();

    expect(await screen.findByText("Reset link is invalid or expired")).toBeInTheDocument();
    expect(screen.queryByText("Home page")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset password" })).toBeEnabled();
  });

  it("falls back to a generic error when the failure carries no message", async () => {
    api.post.mockRejectedValueOnce(new Error("network"));
    renderPage();
    fill();
    submit();
    expect(await screen.findByText("Could not reset password")).toBeInTheDocument();
  });

  it("disables the submit button while saving", async () => {
    let resolvePost;
    api.post.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        })
    );
    renderPage();
    fill();
    submit();

    expect(await screen.findByRole("button", { name: "Saving..." })).toBeDisabled();

    resolvePost({ data: {} });
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });
});
