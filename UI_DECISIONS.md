# GroupLore UI decisions

Visual and copy changes only. Server routes, socket events, stores and data shapes are unchanged.

## Direction

- **Game night, grown-up.** Warm neutral surfaces, one violet signature colour, amber only for wins/host/accent, sentence case throughout.
- Removed thick borders, hard offset shadows, press-down translations, cream/yellow/pink blocks, dot grid, blobs, backdrop blur, surface gradients and neon glow.
- The only playful touches are game emoji tiles, deterministic avatar tints, waiting-friend dashes, win confetti/ribbon and short warm microcopy.
- **Fonts:** Bricolage Grotesque for headings, Inter for UI, JetBrains Mono for room codes and timers. Loaded with `next/font` and `display: swap`.
- **Theme:** light / dark / system, persisted in `grouplore-theme`; inline script applies `data-theme` before paint. Theme control is icon-only.
- **Shape:** 12px controls, 20px cards, 999px chips/avatars/pills; 1px `--border`. Light theme has two soft shadows; dark theme uses surface steps with no shadow.
- **Type:** 12/14/16/18/24/32/48. Body 16px. Labels are sentence-case 13-14px at 500-600. Only room codes are allowed to be uppercase.
- **Motion:** 400/30 springs; hover rises 1px, press scales 0.98, short fade/slide for phase changes. Reduced motion is respected.

## Tokens

The supplied light and dark values are mapped to CSS variables and Tailwind v4 `@theme inline`. Semantic foregrounds (`--primary-ink`, `--on-accent`, `--on-success`, `--on-danger`, `--on-warning`) are included so every filled control can meet AA in both themes. `npm run check:contrast` covers all text/background token pairs.

## Structure

- **Header:** tilted logo mark, GroupLore wordmark, Hub link, icon-only theme toggle, avatar with full name. The dev UI link is compiled out in production.
- **Dashboard:** Live now (only when occupied), a compact Start playing card, compact code join, Groups/Activity tabs, actionable empty states.
- **Group:** member stack, Open lobby primary, Invite secondary, Leave group in the avatar overflow, member list with owner/member pills.
- **Lobby:** two-column desktop, 340px sticky room/player column, searchable + category-filtered game grid on the right, labelled mode control, safe-area action bar with reserved space.
- **Game shell:** slim timer, round context, no per-game rewrite; games inherit the new tokens through shared classes.
- **Auth/landing:** centred auth card and a single radial primary tint behind the landing hero only.

## Known implementation choices

- Live-now lobby cards show the group/room identity because the active-lobby API does not include player profiles; a real connected-player stack needs a data change.
- Recent games is rendered as an empty state because the current group payload does not expose recent sessions.
- Legacy game-specific class names remain as compatibility shims while their internals inherit the new variables. They are tracked in the final report.

## Verification

- `npm run check:contrast`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- Playwright screenshots at 390×844 and 1280×800, both themes, for dashboard, group, lobby and one game when an authenticated session is available.
