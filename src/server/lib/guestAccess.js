/**
 * Guests may join an existing room, but never groups or lobby creation.
 * Explicit ALLOW_GUESTS=false wins; otherwise local development defaults on.
 */
export function guestsAllowed() {
  return (
    process.env.ALLOW_GUESTS === "true" ||
    (process.env.NODE_ENV !== "production" &&
      process.env.ALLOW_GUESTS !== "false")
  );
}
