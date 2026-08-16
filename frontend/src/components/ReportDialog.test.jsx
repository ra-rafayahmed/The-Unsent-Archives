import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import api from "../api/axios";
import ReportDialog from "./ReportDialog";

vi.mock("../api/axios", () => ({ default: { post: vi.fn() } }));

describe("ReportDialog", () => {
  beforeEach(() => api.post.mockReset());

  it("renders nothing when closed", () => {
    const { container } = render(
      <ReportDialog open={false} targetType="post" targetId="p1" onClose={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("titles itself by target type and shows the label", () => {
    render(<ReportDialog open targetType="user" targetId="u1" targetLabel="@someone" />);
    expect(screen.getByRole("heading", { name: "Report this writer" })).toBeInTheDocument();
    expect(screen.getByText("@someone")).toBeInTheDocument();
  });

  it("submits reason + note and shows the thank-you state; Close resets and calls onClose", async () => {
    api.post.mockResolvedValueOnce({ data: {} });
    const onClose = vi.fn();
    render(<ReportDialog open targetType="post" targetId="p1" onClose={onClose} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "harassment" } });
    fireEvent.change(screen.getByPlaceholderText(/Add context/), {
      target: { value: "threatening replies" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/reports", {
        targetType: "post",
        targetId: "p1",
        reason: "harassment",
        note: "threatening replies",
      })
    );
    expect(await screen.findByText(/An admin will review/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the API error and keeps the form usable", async () => {
    api.post.mockRejectedValueOnce({ response: { data: { message: "Already reported" } } });
    render(<ReportDialog open targetType="post" targetId="p1" />);
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    expect(await screen.findByText("Already reported")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit report" })).toBeEnabled();
  });

  it("Cancel and backdrop click call onClose; clicks inside the card do not", () => {
    const onClose = vi.fn();
    const { container } = render(
      <ReportDialog open targetType="post" targetId="p1" onClose={onClose} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(container.querySelector(".modal-card"));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(container.querySelector(".modal-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
