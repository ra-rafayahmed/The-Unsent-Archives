export const FONT_OPTIONS = [
  { value: "serif", label: "Classic Serif" },
  { value: "sans", label: "Modern Sans" },
  { value: "monospace", label: "Typewriter" },
  { value: "literata", label: "Bookish" },
  { value: "georgia", label: "Editorial" },
  { value: "courier", label: "Courier" },
];

export const BG_PRESETS = [
  "#ffffff",
  "#fff4ed",
  "#f7efe2",
  "#f1f6f0",
  "#f9ecee",
  "#2b1f1b",
  "#1f2430",
  "#2a2f21",
  "#2b2b36",
  "#171717",
];

const fontFamilyMap = {
  monospace: "ui-monospace, SFMono-Regular, Menlo, monospace",
  sans: '"Work Sans", system-ui, sans-serif',
  literata: '"Palatino Linotype", Palatino, "Book Antiqua", serif',
  georgia: "Georgia, serif",
  courier: '"Courier New", Courier, monospace',
  serif: '"Newsreader", Georgia, serif',
};

export const getFontFamily = (fontKey) => {
  return fontFamilyMap[fontKey] || fontFamilyMap.serif;
};

export const getPostTextStyle = (style = {}) => {
  const fontSize = Number(style.fontSize) || 1.15;
  const lineHeight = Number(style.lineHeight) || 1.6;
  const letterSpacing = Number(style.letterSpacing) || 0;
  const textAlign = style.textAlign || "center";

  return {
    color: style.textColor || "#1c1c1a",
    fontFamily: getFontFamily(style.font),
    fontSize: `${Math.max(0.8, Math.min(fontSize, 2.4))}rem`,
    lineHeight: Math.max(1, Math.min(lineHeight, 2.4)),
    letterSpacing: `${Math.max(-0.03, Math.min(letterSpacing, 0.2))}em`,
    textAlign,
  };
};
