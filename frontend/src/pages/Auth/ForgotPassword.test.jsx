import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithRouter } from "../../test/utils";
import api from "../../api/axios";
import ForgotPassword from "./ForgotPassword";

vi.mock("../../api/axios", () => ({ default: { post: vi.fn() } }));
vi.mock("../../components/decor/Doodles", () => ({ default: () => null }));

const renderPage = () =>
  renderWithRouter(<ForgotPassword />, { route: "/forgot-password", path: "/forgot-password" });

const typeEmail = (value = "me@example.com") =>
  fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value } });

const submit = () => fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

describe("ForgotPassword page", () => {
  beforeEach(() => api.post.mockReset());

  it("renders the form and a way back to login", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Recover your account" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeRequired();
    expect(screen.getByRole("link", { name: "Back to login" })).toHaveAttribute("href", "/login");
    expect(screen.queryByText(/a reset link has been generated/)).not.toBeInTheDocument();
  });

  it("asks the API to start a reset and echoes back the address used", async () => {
    api.post.mockResolvedValueOnce({ data: {} });
    renderPage();
    typeEmail();
    submit();

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/auth/forgot-password", { email: "me@example.com" })
    );
    expect(await screen.findByText(/a reset link has been generated/)).toBeInTheDocument();
    expect(screen.getByText("me@example.com")).toBeInTheDocument();
    // No dev token in the response, so no one-time link is offered.
    expect(screen.queryByRole("link", { name: "Open reset link" })).not.toBeInTheDocument();
  });

  it("surfaces the one-time reset link when the API returns a dev token", async () => {
    api.post.mockResolvedValueOnce({ data: { resetToken: "tok-123" } });
    renderPage();
    typeEmail("her@example.com");
    submit();

    const link = await screen.findByRole("link", { name: "Open reset link" });
    expect(link).toHaveAttribute("href", "/reset-password?token=tok-123");
    expect(
      screen.getByText(window.location.origin + "/reset-password?token=tok-123")
    ).toBeInTheDocument();
  });

  it("shows the API error message and no confirmation on failure", async () => {
    api.post.mockRejectedValueOnce({ response: { data: { message: "Too many attempts" } } });
    renderPage();
    typeEmail();
    submit();

    expect(await screen.findByText("Too many attempts")).toBeInTheDocument();
    expect(screen.queryByText(/a reset link has been generated/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeEnabled();
  });

  it("says the server is unreachable when the request never got a response", async () => {
    api.post.mockRejectedValueOnce(new Error("network"));
    renderPage();
    typeEmail();
    submit();
    expect(await screen.findByText(/Cannot reach the server/)).toBeInTheDocument();
  });

  it("falls back to a generic error when an HTTP failure carries no message", async () => {
    api.post.mockRejectedValueOnce({ response: { status: 400, data: {} } });
    renderPage();
    typeEmail();
    submit();
    expect(await screen.findByText("Could not start password reset")).toBeInTheDocument();
  });

  it("disables the submit button while the request is in flight", async () => {
    let resolvePost;
    api.post.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        })
    );
    renderPage();
    typeEmail();
    submit();

    expect(await screen.findByRole("button", { name: "Sending..." })).toBeDisabled();

    resolvePost({ data: {} });
    expect(await screen.findByRole("button", { name: "Send reset link" })).toBeEnabled();
  });

  it("clears a previous error when the form is resubmitted", async () => {
    api.post.mockRejectedValueOnce({ response: { data: { message: "Unknown email" } } });
    renderPage();
    typeEmail();
    submit();
    expect(await screen.findByText("Unknown email")).toBeInTheDocument();

    api.post.mockResolvedValueOnce({ data: {} });
    submit();
    await waitFor(() => expect(screen.queryByText("Unknown email")).not.toBeInTheDocument());
    expect(screen.getByText(/a reset link has been generated/)).toBeInTheDocument();
  });
});
