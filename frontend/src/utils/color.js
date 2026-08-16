// Small colour helpers used to derive a per-note palette from the note's
// background colour. All functions accept a 6-digit hex string ("#rrggbb")
// and degrade gracefully on anything else.

export const hexToRgb = (hex = "") => {
  const v = String(hex || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return null;
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
};

/** Relative luminance in [0, 1]; invalid input is treated as white (1). */
export const getLuminance = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
};

/** Mix `amount` (0..1) of white into the colour. Returns the input if invalid. */
export const lighten = (hex, amount) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const m = (c) => Math.round(c + (255 - c) * amount);
  return `rgb(${m(rgb.r)}, ${m(rgb.g)}, ${m(rgb.b)})`;
};

/** Mix `amount` (0..1) of black into the colour. Returns the input if invalid. */
export const darken = (hex, amount) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const m = (c) => Math.round(c * (1 - amount));
  return `rgb(${m(rgb.r)}, ${m(rgb.g)}, ${m(rgb.b)})`;
};

/** rgba() string with the given alpha; invalid input falls back to black. */
export const rgba = (hex, a) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(0,0,0,${a})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
};

export const DEFAULT_NOTE_BG = "#fbf6e9";
const DARK_THRESHOLD = 0.4;

/**
 * Derive the CSS custom properties for a note page from its background and
 * optional explicit text colour.
 * @returns {{ isDark: boolean, vars: Record<string, string> }}
 */
export const buildNoteTheme = (background, textColor) => {
  const noteBg = background || DEFAULT_NOTE_BG;
  const isDark = getLuminance(noteBg) < DARK_THRESHOLD;
  const text = textColor || (isDark ? "#f5ecd8" : "#1c130a");
  return {
    isDark,
    vars: {
      "--note-bg": noteBg,
      "--note-text": text,
      "--note-surface": isDark ? lighten(noteBg, 0.06) : darken(noteBg, 0.03),
      "--note-surface-soft": isDark ? lighten(noteBg, 0.12) : darken(noteBg, 0.06),
      "--note-border": isDark ? rgba("#ffffff", 0.12) : rgba("#000000", 0.1),
      "--note-muted": isDark ? rgba("#f5ecd8", 0.62) : rgba("#1c130a", 0.55),
      "--note-accent": isDark ? "#e7b35a" : "#9a3412",
      "--note-glow-a": isDark ? rgba(noteBg, 0.55) : rgba("#f1c97a", 0.45),
      "--note-glow-b": isDark ? rgba("#e7b35a", 0.18) : rgba("#d2521a", 0.18),
    },
  };
};
