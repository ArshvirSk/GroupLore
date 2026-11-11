const DEFAULT_PATH = "/dashboard";

/** Only permit same-app paths, never an absolute or protocol-relative URL. */
export function safeNextPath(value: string | null | undefined) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f]/.test(value)
  ) {
    return DEFAULT_PATH;
  }
  return value;
}

export function withNext(path: string, next: string | null | undefined) {
  const target = safeNextPath(next);
  return target === DEFAULT_PATH
    ? path
    : `${path}?next=${encodeURIComponent(target)}`;
}
