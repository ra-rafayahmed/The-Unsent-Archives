import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithRouter } from "../../test/utils";
import NoteToolbar from "./NoteToolbar";

const collections = [
  { _id: "col1", name: "Kept" },
  { _id: "col2", name: "Sent" },
];

const setup = (props = {}) => {
  const handlers = {
    onSelectCollection: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onReport: vi.fn(),
  };
  const view = renderWithRouter(
    <NoteToolbar
      postId="p1"
      isAuthenticated={false}
      collections={[]}
      selectedCollectionId=""
      {...handlers}
      {...props}
    />
  );
  return { ...view, ...handlers };
};

describe("NoteToolbar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders nothing for a signed-out reader with no rights", () => {
    const { container } = setup();
    expect(container.querySelector(".manuscript-toolbar")).not.toBeInTheDocument();
  });

  it("still renders for a viewer whose only right is delete", () => {
    const { container } = setup({ canDelete: true });
    expect(container.querySelector(".manuscript-toolbar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🗑 Delete" })).toBeInTheDocument();
  });

  it("omits the collection picker when the reader has no collections", () => {
    setup({ isAuthenticated: true });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save/ })).not.toBeInTheDocument();
  });

  it("lists the reader's collections and reports a new selection", () => {
    const h = setup({ isAuthenticated: true, collections, selectedCollectionId: "col1" });

    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("col1");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Kept", "Sent"]);

    fireEvent.change(select, { target: { value: "col2" } });
    expect(h.onSelectCollection).toHaveBeenCalledWith("col2");
  });

  it("saves to the chosen collection", () => {
    const h = setup({ isAuthenticated: true, collections, selectedCollectionId: "col1" });
    fireEvent.click(screen.getByRole("button", { name: /Save/ }));
    expect(h.onSave).toHaveBeenCalledTimes(1);
  });

  it("links the author to the editor for this post", () => {
    setup({ isAuthenticated: true, canEdit: true });
    expect(screen.getByRole("link", { name: /Edit/ })).toHaveAttribute("href", "/write/p1");
  });

  it("hides Edit from readers who are not the author", () => {
    setup({ isAuthenticated: true });
    expect(screen.queryByRole("link", { name: /Edit/ })).not.toBeInTheDocument();
  });

  it("deletes on request", () => {
    const h = setup({ isAuthenticated: true, canEdit: true, canDelete: true });
    fireEvent.click(screen.getByRole("button", { name: "🗑 Delete" }));
    expect(h.onDelete).toHaveBeenCalledTimes(1);
  });

  it("offers Report to a signed-in reader who is not the author", () => {
    const h = setup({ isAuthenticated: true });
    fireEvent.click(screen.getByRole("button", { name: /Report/ }));
    expect(h.onReport).toHaveBeenCalledTimes(1);
  });

  it("does not offer Report to the author or to signed-out visitors", () => {
    setup({ isAuthenticated: true, canEdit: true });
    expect(screen.queryByRole("button", { name: /Report/ })).not.toBeInTheDocument();

    setup({ canDelete: true });
    expect(screen.queryByRole("button", { name: /Report/ })).not.toBeInTheDocument();
  });
});
