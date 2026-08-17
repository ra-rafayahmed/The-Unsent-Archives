import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithRouter } from "../../test/utils";
import MobileNav from "./MobileNav";

/**
 * The icon <span>s are not aria-hidden, so their ligature text ends up in the
 * accessible name (e.g. "homeHome"). Match on the visible label instead.
 */
const tab = (label) => screen.getByText(label, { selector: "a" });

describe("MobileNav", () => {
  it("shows the four primary destinations with their icons", () => {
    renderWithRouter(<MobileNav />);

    expect(tab("Home")).toHaveAttribute("href", "/");
    expect(tab("Explore")).toHaveAttribute("href", "/explore");
    expect(tab("Library")).toHaveAttribute("href", "/library");
    expect(tab("Profile")).toHaveAttribute("href", "/profile");

    expect(screen.getByText("collections_bookmark")).toBeInTheDocument();
    expect(screen.getByText("person")).toBeInTheDocument();
  });

  it("highlights only the tab matching the current route", () => {
    renderWithRouter(<MobileNav />, { route: "/explore" });

    expect(tab("Explore")).toHaveClass("active");
    expect(tab("Home")).not.toHaveClass("active");
    expect(tab("Library")).not.toHaveClass("active");
  });

  it("highlights Home only on the exact landing route", () => {
    const { unmount } = renderWithRouter(<MobileNav />, { route: "/" });
    expect(tab("Home")).toHaveClass("active");
    unmount();

    renderWithRouter(<MobileNav />, { route: "/posts/abc" });
    expect(tab("Home")).not.toHaveClass("active");
  });

  it("keeps a nested route's parent tab highlighted", () => {
    renderWithRouter(<MobileNav />, { route: "/library/shelf-1" });
    expect(tab("Library")).toHaveClass("active");
  });

  it("is exposed as a navigation landmark", () => {
    renderWithRouter(<MobileNav />);
    expect(screen.getByRole("navigation")).toHaveClass("mobile-nav");
  });
});
