import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithRouter } from "../../test/utils";
import FAB from "./FAB";

const authState = { isAuthenticated: false };
vi.mock("../../context/AuthContext", () => ({ useAuth: () => authState }));

describe("FAB", () => {
  beforeEach(() => {
    authState.isAuthenticated = false;
  });

  it("renders nothing for signed-out readers", () => {
    const { container } = renderWithRouter(<FAB />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("offers a labelled shortcut to the composer once signed in", () => {
    authState.isAuthenticated = true;
    renderWithRouter(<FAB />, { route: "/explore" });

    const link = screen.getByRole("link", { name: "Create a new note" });
    expect(link).toHaveAttribute("href", "/write");
    expect(link).toHaveClass("fab");
  });
});
