# GroupLore UI decisions

Visual and UX only. No server routes, socket events, stores, data shapes or game rules were changed.

## Foundation

- **Direction:** playful neo-brutalism: flat blocks, hard offset shadows, heavy type, generous space.
- **Theme:** light / dark / system, persisted as `grouplore-theme` in localStorage. The inline script in `app/layout.tsx` applies `data-theme` before paint. All storage access is guarded with try/catch.
- **Fonts:** Space Grotesk for display and body, JetBrains Mono for codes, numbers and timers, loaded with `next/font` and `display: swap`.
- **Tokens:** the supplied light and dark palettes are CSS variables in `globals.css`, mapped through Tailwind v4 `@theme inline`. Coloured controls use `--on-accent` (#111) so text on bright fills passes AA in both themes.
- **Texture:** one 24px dot grid on the page background at 6% ink opacity. No orbs, gradients, blur, glass or glow.
- **Geometry:** 8px cards and inputs; 999px only for pills, chips and avatars. 3px borders on desktop, 2px on mobile. Hard shadows are 3/6/10px with no blur.
- **Motion:** buttons and cards lift 2px on hover and press to the shadow offset on active with a 500/30 spring. Reduced motion disables translation and looping decoration.
- **Accessibility:** 44px minimum targets, visible 3px accent focus rings, labels 12px/700/0.08em, and a repeatable token contrast check.

## Game identity

- `client/src/lib/gameMeta.ts` is the single map for emoji, category, accent index and short card copy.
- Categories: Write, Draw, Trivia, Social, Real-time, Strategy.
- Unknown ids use the neutral fallback card and the `Social` category, so a newly added server game still renders.
- Game identity supplements the server catalog; names, player ranges and modes still come from the API.

## Screens

- **Landing:** one primary action, secondary join/guest actions, a static game strip, and three numbered how-it-works blocks.
- **Auth and join:** centred 720px-max card, 48px inputs, inline validation, explicit danger blocks, and a 6-slot mono room code.
- **Dashboard:** title is “Your hub”. The user lives in the avatar menu. Order is Live now, primary actions, then Groups / Activity tabs. Empty states always offer an action.
- **Group:** name, avatar stack, Open Lobby, invite, members and recent sessions.
- **Lobby:** 720px content, code block, player grid with waiting seats, searchable/filterable 3-column game grid, labelled mode control, and a sticky bottom bar whose measured height reserves page padding.
- **Game shells:** shared top bar, horizontal timer, heavy phase banner, stamped winner cards, ranked scoreboard, theme-coloured confetti. Individual games keep their existing event props and only inherit shared styling.
- **TV:** read-only display uses the same tokens, timer bar and ranked rows.

## Component policy

- New surfaces use `components/ui` primitives. Legacy `.party-card`, `.glass-card`, `.neon-input` and `.neon-btn` remain only as compatibility shims for untouched game internals.
- `/dev/ui` is the kitchen sink for every primitive and both themes.
- No new runtime dependencies were added.

## Verification

- `npm run check:contrast` checks every token text pair at 4.5:1.
- Typecheck, lint and production build run after each implementation step.
- Screenshot targets are 390×844 and 1280×800 in both themes. Auth-gated states require a live Supabase session; any blocked capture is recorded rather than replaced with a fabricated screen.
