/**
 * Feature flags.
 *
 * LORE_MODE keeps the group-lore prompt source available for a future opt-in
 * game, but it defaults to off. No engine game may depend on member_profiles.
 */
export function loreModeEnabled() {
  return process.env.LORE_MODE === "true";
}
