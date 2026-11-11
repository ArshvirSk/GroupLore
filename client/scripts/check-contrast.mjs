const themes = {
  light: {
    bg: "#FFF8E7",
    surface: "#FFFFFF",
    surface2: "#FFEFC2",
    ink: "#111111",
    muted: "#4A4A4A",
    primary: "#FF5C8A",
    secondary: "#3D5AFE",
    accent: "#FFD400",
    success: "#00C853",
    danger: "#FF3B30",
    info: "#00B8D9",
    onAccent: "#111111",
    onSecondary: "#FFFFFF",
  },
  dark: {
    bg: "#0E0E10",
    surface: "#1A1A1F",
    surface2: "#26262E",
    ink: "#FFFFFF",
    muted: "#B8B8C4",
    primary: "#FF6F9C",
    secondary: "#6C83FF",
    accent: "#FFD93D",
    success: "#2EE66B",
    danger: "#FF5A4F",
    info: "#36D1F0",
    onAccent: "#111111",
    onSecondary: "#111111",
  },
};

const textPairs = [
  ["ink", "bg"],
  ["ink", "surface"],
  ["ink", "surface2"],
  ["muted", "bg"],
  ["muted", "surface"],
  ["muted", "surface2"],
  ["onAccent", "primary"],
  ["onSecondary", "secondary"],
  ["onAccent", "accent"],
  ["onAccent", "success"],
  ["onAccent", "danger"],
  ["onAccent", "info"],
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
