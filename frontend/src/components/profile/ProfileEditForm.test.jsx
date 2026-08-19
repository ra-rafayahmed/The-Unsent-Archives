import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithRouter } from "../../test/utils";
import ProfileEditForm from "./ProfileEditForm";

const baseForm = { displayName: "Pen Name", bio: "letters, mostly", avatarUrl: "" };

const setup = (props = {}) => {
  const handlers = {
    onDisplayNameChange: vi.fn(),
    onBioChange: vi.fn(),
    onAvatarUrlChange: vi.fn(),
    onAvatarFileChange: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };
  const { container } = renderWithRouter(
    <ProfileEditForm form={baseForm} isUploadingAvatar={false} {...handlers} {...props} />
  );
  return { ...handlers, container };
};

describe("ProfileEditForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the panel seeded with the current form values", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Edit profile" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Display name/)).toHaveValue("Pen Name");
    expect(screen.getByLabelText(/Bio/)).toHaveValue("letters, mostly");
    expect(screen.getByText("Avatar (JPG / PNG / GIF / WEBP)")).toBeInTheDocument();
  });

  it("reports display name and bio edits through their callbacks", () => {
    const h = setup();

    fireEvent.change(screen.getByLabelText(/Display name/), { target: { value: "Quiet Pen" } });
    expect(h.onDisplayNameChange).toHaveBeenCalledWith("Quiet Pen");

    fireEvent.change(screen.getByLabelText(/Bio/), { target: { value: "new bio" } });
    expect(h.onBioChange).toHaveBeenCalledWith("new bio");
  });

  it("reports a pasted avatar URL", () => {
    const h = setup();
    const urlInput = h.container.querySelector('input[type="url"]');
    fireEvent.change(urlInput, { target: { value: "http://img/a.png" } });
    expect(h.onAvatarUrlChange).toHaveBeenCalledWith("http://img/a.png");
  });

  it("hides the preview until there is an avatar, then offers Remove", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();

    const h = setup({ form: { ...baseForm, avatarUrl: "http://img/a.png" } });
    expect(h.container.querySelector(".upload-preview img")).toHaveAttribute(
      "src",
      "http://img/a.png"
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(h.onAvatarUrlChange).toHaveBeenCalledWith("");
  });

  it("passes a picked file through to the upload handler", () => {
    const h = setup();
    const fileInput = h.container.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [new File(["x"], "a.png")] } });
    expect(h.onAvatarFileChange).toHaveBeenCalledTimes(1);
  });

  it("marks the dropzone busy while an upload is running", () => {
    const idle = setup();
    expect(idle.container.querySelector(".dropzone")).not.toHaveClass("is-busy");
    expect(screen.getByText("Drop or pick a portrait")).toBeInTheDocument();

    const busy = setup({ isUploadingAvatar: true });
    expect(busy.container.querySelector(".dropzone")).toHaveClass("is-busy");
    expect(screen.getByText("Uploading...")).toBeInTheDocument();
  });

  it("wires up save and cancel", () => {
    const h = setup();

    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(h.onSave).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(h.onCancel).toHaveBeenCalledTimes(1);
  });
});
