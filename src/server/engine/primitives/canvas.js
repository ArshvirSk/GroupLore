export const MAX_STROKES = 250;
export const MAX_POINTS_PER_STROKE = 400;
export const MAX_TOTAL_POINTS = 20_000;

export function normalizeStroke(raw) {
  if (!raw || typeof raw !== "object") return null;
  const points = Array.isArray(raw.points)
    ? raw.points
        .slice(0, MAX_POINTS_PER_STROKE)
        .map((point) => ({
          x: Math.max(0, Math.min(1, Number(point?.x))),
          y: Math.max(0, Math.min(1, Number(point?.y))),
        }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    : [];
  if (!points.length) return null;
  return {
    id: String(raw.id || "").slice(0, 64),
    color: /^#[0-9a-f]{6}$/i.test(String(raw.color || ""))
      ? String(raw.color)
      : "#23182f",
    width: Math.max(1, Math.min(24, Number(raw.width) || 4)),
    points,
  };
}

export function appendStroke(state, raw) {
  const stroke = normalizeStroke(raw);
  if (!stroke) return null;
  state.strokes = Array.isArray(state.strokes) ? state.strokes : [];
  if (state.strokes.length >= MAX_STROKES) return null;
  const total = state.strokes.reduce(
    (count, item) => count + item.points.length,
    0,
  );
  if (total + stroke.points.length > MAX_TOTAL_POINTS) return null;
  state.strokes.push(stroke);
  return stroke;
}

export function publicStrokes(state) {
  return (state.strokes || []).map((stroke) => ({
    id: stroke.id,
    color: stroke.color,
    width: stroke.width,
    points: stroke.points,
  }));
}
