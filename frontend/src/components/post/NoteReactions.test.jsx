import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithRouter } from "../../test/utils";
import NoteReactions from "./NoteReactions";

const setup = (props = {}) => {
  const onReact = vi.fn();
  const view = renderWithRouter(<NoteReactions reactions={{}} onReact={onReact} {...props} />);
  return { ...view, onReact };
};

describe("NoteReactions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders one chip per reaction", () => {
    setup();
    expect(screen.getAllByRole("button")).toHaveLength(4);
    ["Love", "Felt", "Cried", "Wow"].forEach((label) => {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    });
  });

  it("shows the counts it is given", () => {
    setup({ reactions: { like: 4, love: 2 } });
    expect(screen.getByRole("button", { name: /Love/ })).toHaveTextContent("4");
    expect(screen.getByRole("button", { name: /Felt/ })).toHaveTextContent("2");
  });

  it("shows zero for reactions with no count yet", () => {
    setup({ reactions: { like: 4 } });
    expect(screen.getByRole("button", { name: /Cried/ })).toHaveTextContent("0");
    expect(screen.getByRole("button", { name: /Wow/ })).toHaveTextContent("0");
  });

  it("defaults to zeroes when no summary is passed at all", () => {
    const onReact = vi.fn();
    renderWithRouter(<NoteReactions onReact={onReact} />);
    expect(screen.getByRole("button", { name: /Love/ })).toHaveTextContent("0");
  });

  it("reports the reaction type of whichever chip is clicked", () => {
    const { onReact } = setup();

    const cases = [
      ["Love", "like"],
      ["Felt", "love"],
      ["Cried", "sad"],
      ["Wow", "wow"],
    ];
    cases.forEach(([label, type]) => {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(label) }));
      expect(onReact).toHaveBeenCalledWith(type);
    });
    expect(onReact).toHaveBeenCalledTimes(4);
  });

  it("hides the decorative glyphs from assistive tech", () => {
    const { container } = setup();
    expect(container.querySelectorAll('.reaction-glyph[aria-hidden="true"]')).toHaveLength(4);
  });
});
