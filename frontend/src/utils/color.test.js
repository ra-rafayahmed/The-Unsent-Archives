import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  getLuminance,
  lighten,
  darken,
  rgba,
  buildNoteTheme,
  DEFAULT_NOTE_BG,
} from "./color";

describe("hexToRgb", () => {
  it("parses 6-digit hex with or without #", () => {
    expect(hexToRgb("#ff8000")).toEqual({ r: 255, g: 128, b: 0 });
    expect(hexToRgb("FF8000")).toEqual({ r: 255, g: 128, b: 0 });
  });

  it("returns null for anything that is not 6 hex digits", () => {
    for (const bad of ["#fff", "#gggggg", "", null, undefined, "rgb(1,2,3)", "#1234567"]) {
      expect(hexToRgb(bad)).toBeNull();
    }
  });
});

describe("getLuminance", () => {
  it("is 0 for black, 1 for white, and monotonic in between", () => {
    expect(getLuminance("#000000")).toBe(0);
    expect(getLuminance("#ffffff")).toBeCloseTo(1, 10);
    expect(getLuminance("#808080")).toBeCloseTo(0.5, 1);
    expect(getLuminance("#404040")).toBeLessThan(getLuminance("#c0c0c0"));
  });

  it("treats invalid input as white so pages default to the light theme", () => {
    expect(getLuminance("nope")).toBe(1);
  });
});

describe("lighten / darken", () => {
  it("move towards white / black by the given amount", () => {
    expect(lighten("#000000", 0.5)).toBe("rgb(128, 128, 128)");
    expect(lighten("#000000", 1)).toBe("rgb(255, 255, 255)");
    expect(darken("#ffffff", 0.5)).toBe("rgb(128, 128, 128)");
    expect(darken("#ffffff", 1)).toBe("rgb(0, 0, 0)");
  });

  it("are identity at amount 0", () => {
    expect(lighten("#123456", 0)).toBe("rgb(18, 52, 86)");
    expect(darken("#123456", 0)).toBe("rgb(18, 52, 86)");
  });

  it("pass invalid input through untouched", () => {
    expect(lighten("transparent", 0.3)).toBe("transparent");
    expect(darken("transparent", 0.3)).toBe("transparent");
  });
});

describe("rgba", () => {
  it("formats with the given alpha", () => {
    expect(rgba("#ff0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
  });
  it("falls back to black on invalid input", () => {
    expect(rgba("bad", 0.2)).toBe("rgba(0,0,0,0.2)");
  });
});

describe("buildNoteTheme", () => {
  it("uses the default parchment background and light theme when unset", () => {
    const { isDark, vars } = buildNoteTheme();
    expect(isDark).toBe(false);
    expect(vars["--note-bg"]).toBe(DEFAULT_NOTE_BG);
    expect(vars["--note-text"]).toBe("#1c130a");
    expect(vars["--note-accent"]).toBe("#9a3412");
  });

  it("switches to the dark palette for dark backgrounds", () => {
    const { isDark, vars } = buildNoteTheme("#1f2430");
    expect(isDark).toBe(true);
    expect(vars["--note-text"]).toBe("#f5ecd8");
    expect(vars["--note-accent"]).toBe("#e7b35a");
    expect(vars["--note-surface"]).toBe(lighten("#1f2430", 0.06));
    expect(vars["--note-border"]).toBe("rgba(255, 255, 255, 0.12)");
  });

  it("respects an explicit text colour", () => {
    expect(buildNoteTheme("#ffffff", "#ff00ff").vars["--note-text"]).toBe("#ff00ff");
  });

  it("always returns the full set of custom properties", () => {
    const keys = Object.keys(buildNoteTheme("#ffffff").vars);
    expect(keys).toEqual([
      "--note-bg",
      "--note-text",
      "--note-surface",
      "--note-surface-soft",
      "--note-border",
      "--note-muted",
      "--note-accent",
      "--note-glow-a",
      "--note-glow-b",
    ]);
  });
});
