import { describe, it, expect } from "vitest";
import { getFontFamily, getPostTextStyle, FONT_OPTIONS, BG_PRESETS } from "./postStyle";

describe("getFontFamily", () => {
  it("maps every FONT_OPTION to a concrete font stack", () => {
    for (const { value } of FONT_OPTIONS) {
      expect(getFontFamily(value)).toEqual(expect.any(String));
      expect(getFontFamily(value).length).toBeGreaterThan(0);
    }
  });

  it("falls back to the serif stack for unknown keys", () => {
    expect(getFontFamily("comic-sans")).toBe(getFontFamily("serif"));
    expect(getFontFamily(undefined)).toBe(getFontFamily("serif"));
  });
});

describe("getPostTextStyle", () => {
  it("returns sensible defaults for an empty style", () => {
    expect(getPostTextStyle()).toEqual({
      color: "#1c1c1a",
      fontFamily: getFontFamily("serif"),
      fontSize: "1.15rem",
      lineHeight: 1.6,
      letterSpacing: "0em",
      textAlign: "center",
    });
  });

  it("passes through explicit values", () => {
    const style = getPostTextStyle({
      textColor: "#fff",
      font: "monospace",
      fontSize: 1.5,
      lineHeight: 2,
      letterSpacing: 0.1,
      textAlign: "left",
    });
    expect(style).toMatchObject({
      color: "#fff",
      fontFamily: getFontFamily("monospace"),
      fontSize: "1.5rem",
      lineHeight: 2,
      letterSpacing: "0.1em",
      textAlign: "left",
    });
  });

  it("clamps out-of-range numeric values", () => {
    const big = getPostTextStyle({ fontSize: 99, lineHeight: 99, letterSpacing: 99 });
    expect(big.fontSize).toBe("2.4rem");
    expect(big.lineHeight).toBe(2.4);
    expect(big.letterSpacing).toBe("0.2em");

    const small = getPostTextStyle({ fontSize: 0.1, lineHeight: 0.1, letterSpacing: -5 });
    expect(small.fontSize).toBe("0.8rem");
    expect(small.lineHeight).toBe(1);
    expect(small.letterSpacing).toBe("-0.03em");
  });

  it("ignores non-numeric strings and uses defaults", () => {
    const style = getPostTextStyle({ fontSize: "huge", lineHeight: "tall" });
    expect(style.fontSize).toBe("1.15rem");
    expect(style.lineHeight).toBe(1.6);
  });
});

describe("BG_PRESETS", () => {
  it("are all valid hex colours", () => {
    for (const bg of BG_PRESETS) expect(bg).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
