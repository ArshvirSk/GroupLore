const themes = {
  light: {
    bg: "#F7F6F3",
    surface: "#FFFFFF",
    surface2: "#EFEDE8",
    ink: "#17171C",
    muted: "#62616B",
    primary: "#5B3DF5",
    primaryInk: "#FFFFFF",
    primarySoft: "#ECE8FF",
    accent: "#E8920B",
    accentSoft: "#FFF1D6",
    onAccent: "#17171C",
    success: "#12803F",
    onSuccess: "#FFFFFF",
    danger: "#D92D20",
    onDanger: "#FFFFFF",
    warning: "#B54708",
    onWarning: "#FFFFFF",
  },
  dark: {
    bg: "#0F0E17",
    surface: "#181726",
    surface2: "#211F33",
    ink: "#F4F3FA",
    muted: "#A9A7BD",
    primary: "#8F7CFF",
    primaryInk: "#0F0E17",
    primarySoft: "#272344",
    accent: "#FFC857",
    accentSoft: "#3A2F14",
    onAccent: "#0F0E17",
    success: "#3DDC97",
    onSuccess: "#0F0E17",
    danger: "#FF7A7A",
    onDanger: "#0F0E17",
    warning: "#FFB24D",
    onWarning: "#0F0E17",
  },
};

const textPairs = [
  ["ink", "bg"],
  ["ink", "surface"],
  ["ink", "surface2"],
  ["ink", "primarySoft"],
  ["ink", "accentSoft"],
  ["muted", "bg"],
  ["muted", "surface"],
  ["muted", "surface2"],
  ["muted", "primarySoft"],
  ["muted", "accentSoft"],
  ["primaryInk", "primary"],
  ["onAccent", "accent"],
  ["onSuccess", "success"],
  ["onDanger", "danger"],
  ["onWarning", "warning"],
];

function rgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
}

function luminance(hex) {
  const [r, g, b] = rgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const first = luminance(a);
  const second = luminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

let failed = 0;
for (const [name, palette] of Object.entries(themes)) {
  console.log(`\n${name.toUpperCase()} THEME`);
  for (const [fg, bg] of textPairs) {
    const value = ratio(palette[fg], palette[bg]);
    const pass = value >= 4.5;
    if (!pass) failed += 1;
    console.log(
      `${pass ? "PASS" : "FAIL"} ${fg} on ${bg}: ${value.toFixed(2)}:1`,
    );
  }
}

if (failed > 0) {
  console.error(`\n${failed} contrast pair(s) below WCAG AA 4.5:1`);
  process.exit(1);
}

console.log("\nAll token text pairs pass WCAG AA (4.5:1).");
