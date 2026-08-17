import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import api from "../../api/axios";
import RecoverWithCode from "./RecoverWithCode";

vi.mock("../../api/axios", () => ({ default: { post: vi.fn() } }));

const updateCurrentUser = vi.fn();
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ updateCurrentUser }) }));
vi.mock("../../components/decor/Doodles", () => ({ default: () => null }));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/recover"]}>
      <Routes>
        <Route path="/recover" element={<RecoverWithCode />} />
        <Route path="/" element={<div>Home page</div>} />
      </Routes>
    </MemoryRouter>
  );

const fill = ({
  email = "me@example.com",
  code = "aaaa-bbbb-cccc",
  password = "hunter22",
  confirm = "hunter22",
} = {}) => {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Backup code"), { target: { value: code } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: confirm } });
};

const submit = () => fireEvent.click(screen.getByRole("button", { name: "Recover account" }));

describe("RecoverWithCode page", () => {
  beforeEach(() => {
    api.post.mockReset();
    updateCurrentUser.mockReset();
    localStorage.clear();
  });

  it("renders the form and the escape hatches", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Recover with a backup code" })).toBeInTheDocument();
    expect(screen.getByLabelText("Backup code")).toHaveAttribute("autocomplete", "off");
    expect(screen.getByRole("link", { name: "Email a reset link" })).toHaveAttribute(
      "href",
      "/forgot-password"
    );
    expect(screen.getByRole("link", { name: "login" })).toHaveAttribute("href", "/login");
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
    fill({ confirm: "hunter23" });
    submit();

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("redeems the code, signs the user in and lands on the home page", async () => {
    api.post.mockResolvedValueOnce({
      data: { token: "session-token", user: { _id: "u7", username: "bob" } },
    });
    renderPage();
    fill();
    submit();

    // The confirmation field is local-only and must not be sent to the API.
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/auth/recover", {
        email: "me@example.com",
        code: "aaaa-bbbb-cccc",
        password: "hunter22",
      })
    );
    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(localStorage.getItem("token")).toBe("session-token");
    expect(updateCurrentUser).toHaveBeenCalledWith({ _id: "u7", username: "bob" });
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
      response: { data: { message: "That code has already been used" } },
    });
    renderPage();
    fill();
    submit();

    expect(await screen.findByText("That code has already been used")).toBeInTheDocument();
    expect(screen.queryByText("Home page")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recover account" })).toBeEnabled();
  });

  it("says the server is unreachable when the request never got a response", async () => {
    api.post.mockRejectedValueOnce(new Error("network"));
    renderPage();
    fill();
    submit();
    expect(await screen.findByText(/Cannot reach the server/)).toBeInTheDocument();
  });

  it("falls back to a generic error when an HTTP failure carries no message", async () => {
    api.post.mockRejectedValueOnce({ response: { status: 400, data: {} } });
    renderPage();
    fill();
    submit();
    expect(await screen.findByText("Recovery failed")).toBeInTheDocument();
  });

  it("disables the submit button while recovering", async () => {
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

    expect(await screen.findByRole("button", { name: "Recovering..." })).toBeDisabled();

    resolvePost({ data: {} });
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });
});
