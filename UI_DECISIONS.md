# UI Decisions — GroupLore Re-theme

## Why It Felt Industrial (Root Cause Analysis)

The first pass applied the correct tokens and typography but left several specific patterns that read as "SaaS dashboard":

| Pattern | Where | Fix |
|---|---|---|
| `"Primary actions"` dev label | Dashboard hero card | Removed; h2 becomes `"Start playing"` |
| `"Your hub"` eyebrow + identical `h1` | Dashboard | Collapsed to single `h1`, no redundant eyebrow |
| `"Jump into the lobby"` filler | Group cards | → `"Room is open"` / `"No open room"` |
| `border-t-[2px]` / `border-t-[3px]` thick dividers | Dashboard cards | → `border-t` (1px) |
| Flat solid-color stripe on game cards | Lobby game library | → Emoji on tinted rounded tile (tilts -3deg, group-hover:rotate-0) |
| `border-2 border-danger bg-danger text-on-accent` error alerts | Dashboard | → `bg-danger/10 text-danger` (soft inline alert) |
| `"Got an invite?"` heading with separate eyebrow | Dashboard join card | → Single `"Join with a code"` heading |
| `bg-accent-soft` on room code block | Lobby header | → `bg-primary-soft border-primary/15` (on-brand, not orange) |
| `"Open lobby"` button text shown twice (same for both states) | Group page | → `"Join lobby"` when open, `"Open lobby"` when closed |
| Waiting slot shows `+` with thin dashed ring | Lobby players | → `·` pulse with 2px dashed border |
| Hero tint at 12% | globals.css | → 15% |

## Token Decisions

- **`--primary: #5B3DF5`** — violet-purple reads "creative/playful" not "enterprise blue"
- **`--accent: #E8920B`** — amber for wins/host feels game-night, not status/warning
- **`--bg: #F7F6F3`** — slightly warm white (not pure #FFFFFF) avoids clinical feel
- **Surface shadows at 6% opacity** — barely visible; depth without brutalist borders

## Shape & Motion Decisions

| Element | Radius |
|---|---|
| Buttons, inputs | 12px |
| Cards | 20px |
| Chips, avatars, pills | 999px |

Springs: `stiffness: 400, damping: 30`. Hover `y: -1`, press `scale: 0.98`. Game tile tilts `-3deg` → `0` on hover. `prefers-reduced-motion` respected globally.

## Fun Budget

| Element | Touch |
|---|---|
| Game tiles | Emoji on tinted tile, tilts on card hover |
| Avatars | Deterministic soft hue + initials + ★ host crown |
| Waiting slots | Dashed pulsing ring + "Waiting for friends" |
| Hero | Very soft radial primary tint (15%) |
| Room code | Large JetBrains Mono, `tracking-[0.18em]` |

Confetti only in win reveals (ConfettiExplosion, not changed).

## Copy Decisions

| Old | New |
|---|---|
| "Primary actions" | Removed (dev label) |
| "Jump into the lobby" | "Room is open" |
| "Got an invite?" + eyebrow | "Join with a code" (single heading) |
| "Play with your people" | "Start playing" |
| "Your hub" label + "Your hub" h1 | h1 only |
| "Open lobby" (both states) | "Join lobby" / "Open lobby" |

## Files Changed

1. `client/src/app/globals.css` — hero-tint 12%→15%, scrollbar warmth
2. `client/src/app/dashboard/page.tsx` — dev labels, copy, borders, error style
3. `client/src/app/lobby/[sessionId]/page.tsx` — game card emoji-tile, room code card, waiting slot
4. `client/src/app/group/[id]/page.tsx` — button label state fix

## Known Gaps

- Game screens inherit tokens; individual shell restyle is a future step.
- `/dev/ui` already behind `NODE_ENV !== 'production'` in AppHeader.
- Recent games on group page is EmptyState-only (backend not yet implemented).
- Playwright screenshots pending.
