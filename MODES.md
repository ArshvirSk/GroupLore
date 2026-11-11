# MODES.md — Extending the GroupLore game set

Spec for adding **28 new, non-group-specific games** to the existing 15. None read `member_profiles`; each uses only its own prompt bank. Group-lore personalization is deferred.

The final section is a ready-to-paste **agent prompt**.

---

## 1. Ground rules

- **Server-authoritative.** Clients send intents, the server validates, mutates state, and broadcasts per-player views via `viewFor` and room-wide views via `publicFor`. Never trust client timestamps for scoring; use server receive time.
- **Engine contract** (from README): `id`, `name`, `minPlayers`, `maxPlayers`, `modes`, `init`, `onEvent`, `onPhaseEnd`, `onPlayerLeave`, `viewFor`, `publicFor`.
- **Hidden info goes only through `viewFor(playerId)`.** Roles, secret words, own drawings-in-progress, unrevealed votes and answers must never appear in `publicFor`.
- **Phase-driven.** Each game is a list of named phases with a server timer. `onPhaseEnd` advances. Every phase must also be able to end early when all required inputs are in.
- **Leave handling.** `onPlayerLeave` must never deadlock: drop the player from required-input sets, reassign roles/turns, and abort gracefully if below `minPlayers`.
- **Modes** are config objects (timers, round counts, rule flags), not forks of the module. A mode is a data difference wherever possible.
- **Scoring** is an integer per player per round, returned in a standard `roundScores` object so the existing reveal/leaderboard UI works unchanged.
- **Guests** are normal players for gameplay. Use stable `playerId`s, not socket ids.
- **Reconnect.** A returning player must get a full `viewFor` snapshot for the current phase.

### Prompt bank format

`server/data/prompts/<game-id>.json`, an array of objects with a unique `id` (stable, never reused), plus game-specific fields. Required: `id`, `text` (or the game's primary field), optional `tags`, `difficulty` (1–3), `nsfw` (bool, default false; exclude by default). Minimum bank sizes are listed per game. Tests must assert: unique ids, no empty fields, minimum size, and that a full session never repeats an item.

### Definition of done (per game)

1. Engine module + registry entry + DB migration adding the id to the `game_type` CHECK.
2. Prompt bank meeting the minimum size.
3. Client screen in `client/src/components/game/`, routed by `room.gameId`.
4. Lobby card shows player requirement and mode selector.
5. Tests: mechanics (phase flow, scoring, early-end, leave/reconnect) and bank validation.

---

## 2. Build tiers

| Tier                                    | Why                                                    | Games                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Reuse write → vote → reveal**      | Cheapest, reuses Bluff/Caption/Most Likely To plumbing | Roast Battle, Acronym Wars, Pitch Perfect, Mad Libs Chaos, Two Truths One Lie, Fact or Fiction                                          |
| **2. New prompt banks + small scoring** | Mostly data                                            | Chameleon, Spyfall, Closest Wins, Timeline, Rank It, Speed Trivia, Flag/Map Rush, Emoji Decode, Just One, Split or Steal, Auction Bluff |
| **3. New real-time input**              | Needs low-latency events and live progress             | Bomb Party, Word Chain, Type Race, Wordle Race, Hot Potato, The Mind                                                                    |
| **4. Canvas sync**                      | Stroke streaming, replay                               | Draw & Guess, Draw Telephone, Bad Artist                                                                                                |
| **5. Heavy state machines**             | Hidden roles, multi-phase, per-player views            | Werewolf, Resistance-lite                                                                                                               |

Build in this order. Finish and test a tier before starting the next.

---

## 3. Specs

Format: **players** · **modes** · **flow** · **scoring** · **notes** · **bank**.

### Tier 1 — Write and vote

#### 🔥 Roast Battle (`roast-battle`)

- **Players:** 3–12 · **Modes:** Classic (3 rounds, 45s write, 20s vote) / Quick (2 rounds, 30s write, 15s vote)
- **Flow:** `write` → `duel` (per matchup) → `reveal` → next round → `final`. Each prompt is assigned to exactly two players; with odd counts, one player gets a second prompt. Everyone answers 1–2 prompts. Each matchup shows both answers anonymously; all others vote. Authors cannot vote on their own matchup.
- **Scoring:** 100 per vote received; +300 bonus for a unanimous win ("Quiplash"); no-answer forfeits the matchup.
- **Notes:** Answer max 80 chars. Authors hidden until after the vote. Ties split points.
- **Bank:** 150 prompts, e.g. `{ "id": "rb-001", "text": "The worst name for a pet goldfish" }`

#### 🔤 Acronym Wars (`acronym-wars`)

- **Players:** 3–12 · **Modes:** Classic (5 rounds, 40s) / Speed (5 rounds, 20s)
- **Flow:** `write` → `vote` → `reveal`. Server generates 3–5 random letters (weighted, no Q/X/Z/V runs; optional topic from bank). Players submit an expansion; each word must start with the matching letter (server-validated).
- **Scoring:** 100 per vote; +200 if every voter voted for you; small participation bonus (25).
- **Bank:** 60 topics + letter-weight table.

#### 🦈 Pitch Perfect (`pitch-perfect`)

- **Players:** 3–12 · **Modes:** Classic (4 rounds) / Quick (3 rounds, shorter timers)
- **Flow:** `write` → `vote` → `reveal`. Show an absurd product; players write a tagline or one-sentence pitch. Optional final round: top 2 pitch against each other ("investor round").
- **Scoring:** same as Roast Battle; last-round votes worth double.
- **Bank:** 100 absurd products.

#### 📝 Mad Libs Chaos (`mad-libs`)

- **Players:** 3–12 · **Modes:** Classic (3 stories)
- **Flow:** `fill` → `read` → `rate`. Each player is asked for 1–3 blanks ("a verb ending in -ing") from the same story without seeing the story. The server assembles it; it is revealed with each filler's word highlighted. Everyone rates 1–5 (not their own blank).
- **Scoring:** average rating of your words × 100.
- **Bank:** 25 story templates: `{ id, title, template: "…{0}…{1}…", blanks: [{ id, type, hint }] }`. Distribute blanks evenly.

#### 🤥 Two Truths, One Lie (`two-truths`)

- **Players:** 3–12 · **Modes:** Classic / Rapid (15s vote)
- **Flow:** `write` (each player writes 2 truths + 1 lie about themselves, 60s) → per player: `vote` → `reveal`. Writer can't vote on theirs.
- **Scoring:** guesser +100 for finding the lie; writer +100 per player fooled.
- **Notes:** Order shuffled, lie position randomized. Optional "ice-breaker prompts" bank to help blank-page players; players may skip hints.
- **Bank:** 40 hint prompts (optional).

#### ✅ Fact or Fiction (`fact-or-fiction`)

- **Players:** 3–12 · **Modes:** Classic (10 statements, 10s) / Sudden Death (wrong answer eliminates; last standing wins)
- **Flow:** `question` → `reveal` (with a one-line explanation).
- **Scoring:** 100 per correct; streak multiplier ×1, ×1.5, ×2 at streaks 3 and 6; speed bonus up to +50.
- **Bank:** 300 statements: `{ id, text, isTrue, explanation, tags }`. Keep ~50/50 true/false.

### Tier 2 — Prompt banks and small scoring

#### 🦎 Chameleon (`chameleon`)

- **Players:** 4–12 · **Modes:** Classic / Blind (no discussion, straight to vote)
- **Flow:** `deal` (topic card with 16 words; all see the topic, all but one see the secret word) → `clues` (each player in turn gives one word, 20s) → `discuss` (45s, Classic only) → `vote` → `reveal` → `steal` (if the chameleon survives or is caught, they get one guess at the secret word).
- **Scoring:** chameleon uncaught +300; caught but guesses word +150; caught otherwise: each correct voter +100.
- **Notes:** Chameleon's `viewFor` shows the grid but no highlighted word. Turn order randomized.
- **Bank:** 40 topics × 16 words.

#### 📍 Spyfall (`spyfall`)

- **Players:** 4–12 · **Modes:** Classic / Double Spy (6+ players)
- **Flow:** `deal` (location + role card; spy gets none) → `interrogate` (turn-based Q&A: asker picks target, 8-minute global timer, asked-player answers verbally; server tracks turn) → `vote` (anyone can call a vote at any time; unanimous needed) → `spy-guess` → `reveal`.
- **Scoring:** spy survives and timer expires +200; spy guesses location +300; spy caught +100 each to others.
- **Bank:** 30 locations × 6–8 roles.

#### 🎯 Closest Wins (`closest-wins`)

- **Players:** 3–12 · **Modes:** Classic (8 questions) / Bet (players wager on the best guess)
- **Flow:** `guess` (number, 20s) → `reveal` → (Bet only) `bet` → `payout`. Closest without going over wins; if everyone overshoots, the lowest wins.
- **Scoring:** closest +200; Bet: 2:1 on a correct bet from a chip stack.
- **Bank:** 120 questions: `{ id, text, answer, unit, source }`. Answers must be verifiable and stable.

#### 📅 Timeline (`timeline`)

- **Players:** 3–12 · **Modes:** Classic (6 rounds, 5 items) / Speed (3 items, 10s)
- **Flow:** `order` (drag/tap into order) → `reveal`.
- **Scoring:** partial credit via correct adjacent pairs (e.g. 5 items = up to 4 × 50) plus a +100 bonus for a perfect order.
- **Bank:** 80 sets of 5 items with true ordering key (date/year).

#### 🧠 Rank It (`rank-it`)

- **Players:** 3–12 · **Modes:** Classic (6 rounds)
- **Flow:** `rank` (order 4–5 items by a stat) → `reveal`. Same scoring as Timeline.
- **Bank:** 80 sets: `{ id, prompt, items: [{ label, value }] }`.

#### ⚡ Speed Trivia (`speed-trivia`)

- **Players:** 3–12 · **Modes:** Classic (10 questions) / Marathon (25)
- **Flow:** `question` (4 options, 15s, ends early when all answered) → `reveal`.
- **Scoring:** 1000 × (remaining time ÷ total) for correct, floor 300; wrong 0.
- **Notes:** Options shuffled per player in `viewFor`; server maps back to canonical index.
- **Bank:** 400 questions with `category`, `difficulty`.

#### 🌍 Flag/Map Rush (`flag-rush`)

- **Players:** 3–12 · **Modes:** Classic (10 rounds) / Landmarks
- **Flow:** typed or multiple-choice answer; first correct gets the most. Use normalized matching with an alias list.
- **Bank:** 200 entries: `{ id, image, answer, aliases[] }`. Use public-domain or self-hosted assets only.

#### 😀 Emoji Decode (`emoji-decode`)

- **Players:** 3–12 · **Modes:** Classic (8 rounds, 30s) / Speed (15s)
- **Flow:** `guess` (free-text, live "someone got it" signal without revealing who or what) → `reveal`.
- **Scoring:** first correct 300, then 200, 100, rest 50. Optional hint at 50% time halves points.
- **Bank:** 200: `{ id, emojis, answer, aliases[], category }`.

#### 🤝 Just One (`just-one`)

- **Players:** 3–12 · **Modes:** Classic (13 cards)
- **Flow:** `deal` (guesser gets nothing; others see the word) → `clue` (everyone but guesser writes one word) → `dedupe` (server cancels identical/near-identical clues, case-insensitively and by stem) → `guess` → `reveal`.
- **Scoring:** cooperative: shared team score +1 per correct; wrong ends the card; pass is allowed once per round.
- **Notes:** Guesser sees only surviving clues; writers see duplicates only in the reveal.
- **Bank:** 300 words.

#### 🤑 Split or Steal (`split-or-steal`)

- **Players:** 3–12 (paired; odd player sits out rotating) · **Modes:** Classic (5 rounds) / Tournament (bracket, pot grows)
- **Flow:** `negotiate` (30s, in-room chat or verbal) → `choose` (secret) → `reveal`.
- **Scoring:** both split → 500 each; one steals → 1000/0; both steal → 0/0.
- **Bank:** none needed; optional pot values.

#### 🏷️ Auction Bluff (`auction-bluff`)

- **Players:** 3–10 · **Modes:** Classic (8 items) / Quick (5)
- **Flow:** `preview` (one player sees the item's true value and may lie in chat) → `bid` (sealed, from a limited coin stack) → `reveal`.
- **Scoring:** profit = true value − bid; the highest bid wins the item. Final score = coins + item values.
- **Bank:** 80 items with value ranges.

### Tier 3 — Real-time

#### 💣 Bomb Party (`bomb-party`)

- **Players:** 2–12 (set min 3 for consistency) · **Modes:** Classic (3 lives) / Sudden Death (1 life)
- **Flow:** continuous `turn` loop. Server shows a 2–3 letter syllable and the active player; they must type a valid unused word containing it before the fuse expires (fuse 8–15s, shrinking). Wrong or expired costs a life; the bomb passes.
- **Scoring:** last survivor wins; bonus for using all letters of the alphabet across turns (+1 life).
- **Notes:** Needs a server-side dictionary (e.g. a bundled word list) plus syllable frequency table that guarantees ≥ 50 valid answers per syllable. Enforce no repeated words. Stream live typing text to the room (throttled to ~5 Hz).
- **Bank:** dictionary file + syllable list, not a prompt bank. Tests: every syllable has enough valid words.

#### 🔗 Word Chain (`word-chain`)

- **Players:** 3–12 · **Modes:** Classic (last-letter) / Category (words must fit a category)
- **Flow:** turn-based with a per-turn timer (10s); invalid, repeated or late = elimination or lost life.
- **Notes:** Validate with the same dictionary as Bomb Party; Category mode needs a category word list.

#### ⌨️ Type Race (`type-race`)

- **Players:** 3–12 · **Modes:** Sprint (1 short passage) / Marathon (3 passages)
- **Flow:** `countdown` → `race` → `results`. Clients send progress (chars correct); server verifies against the passage and computes WPM/accuracy from server time.
- **Scoring:** placement points 1000/700/500/300/…; accuracy below 90% penalised.
- **Bank:** 80 passages, 150–300 chars, public-domain or original text.

#### 🟩 Wordle Race (`wordle-race`)

- **Players:** 2–12 · **Modes:** Classic (shared word, 6 guesses)
- **Flow:** each player has their own board; the server returns tile colours per guess; the room sees only progress (colour pattern without letters) in `publicFor`.
- **Scoring:** first solver 1000; fewer guesses better; failure 0.
- **Bank:** answer list + larger valid-guess list.

#### 🔥 Hot Potato (`hot-potato`)

- **Players:** 3–12 · **Modes:** Classic
- **Flow:** hidden server timer (random 20–45s). The holder must complete a micro-challenge ("name 3 X") by typing/choosing within 5s to pass to someone of their choice. Explodes on the holder when the timer ends.
- **Scoring:** survive rounds; the exploded lose a life.
- **Notes:** Never leak the timer to any client. Add jitter and a minimum 3 passes before the earliest explosion.

#### 🧘 The Mind (`the-mind`)

- **Players:** 2–4 · **Modes:** levels 2–4 (cards per player = level)
- **Flow:** players hold secret numbers 1–100; they must play them in ascending order with no communication. Server checks each play; a play out of order costs a life and discards lower cards.
- **Notes:** Real-time; no hint mechanics except an optional shared "star" to discard each player's lowest card. Chat disabled in this game.

### Tier 4 — Drawing

Shared infrastructure first: a canvas component, stroke event format (`{ id, color, width, points[] }`), batching (≈30 Hz), server-side stroke log for replay and late joiners, and per-phase canvas clear. Cap total stroke points per drawing.

#### ✏️ Draw & Guess (`draw-guess`)

- **Players:** 3–12 · **Modes:** Classic (each player draws once, 60–80s) / Speed (40s)
- **Flow:** `choose` (drawer picks 1 of 3 words) → `draw` (strokes broadcast live) → `guess` (concurrent with draw) → `reveal`.
- **Scoring:** guesser: 500 × remaining time share; drawer: +100 per correct guesser. Guesses matching the word, or within edit distance 1, are flagged "close" privately.
- **Notes:** Correct guessers stop seeing others' guesses; the word is never in `publicFor` until reveal. Add hints (letter reveals) at 50% and 75%.
- **Bank:** 400 words with difficulty.

#### 📞 Draw Telephone (`draw-telephone`)

- **Players:** 4–12 · **Modes:** Classic
- **Flow:** every player starts a chain with a written prompt → next draws it → next captions the drawing → alternating until each chain has visited everyone → `reveal` plays each chain.
- **Notes:** Chains rotate so nobody sees their own chain until the reveal. Timers skip AFK players by submitting a blank.

#### 🎨 Bad Artist (`bad-artist`)

- **Players:** 3–12 · **Modes:** Classic
- **Flow:** each draws a prompt (45s) → others write captions → vote on captions → reveal.
- **Scoring:** vote-based for the caption writer; the artist gets +100 per caption written.

### Tier 5 — Heavy state

#### 🐺 Werewolf (`werewolf`)

- **Players:** 6–12 · **Modes:** Classic / Quick (shorter discussion)
- **Flow:** `deal` → loop of `night` (wolves choose a target; seer inspects; doctor protects, in sub-phases) → `dawn` (announce deaths) → `discuss` → `vote` → `elimination` → win check.
- **Roles:** Villager, Werewolf, Seer, Doctor; add Hunter at 9+, second wolf at 8+.
- **Notes:** Dead players are spectators with a separate chat. `viewFor` must hide roles (wolves see each other). The night uses per-role action phases that end early when everyone has acted; fake-wait the minimum so timing doesn't reveal roles. Needs a spectator mode and a robust `onPlayerLeave` (a leaving player's role is revealed or silently killed, pick one).

#### 🗳️ Resistance-lite (`resistance`)

- **Players:** 5–10 · **Modes:** Classic
- **Flow:** `leader-picks-team` → `team-vote` (public) → `mission` (secret success/fail cards) → `reveal` → first to 3 wins.
- **Notes:** Spies see each other; mission results show only the fail count. Five rejected proposals in a row auto-fail the mission.

---

## CONVENTIONS

Observed from the current engine, modules, migrations, tests and client screens before implementation:

- **Module shape:** every registry module exports `id`, `name`, `description`, `emoji`, `accent`, `minPlayers`, `maxPlayers`, `modes`, `init`, `onEvent`, `onPhaseEnd`, `onPlayerLeave`, `viewFor` and `publicFor`. `init(room, mode) -> state` stores `state` on `room.state`, sets `room.mode`, and returns that same object. The engine resets `room.scores` and calls `init`; modules never reset the global score map themselves.
- **Phases:** a phase is represented by `state.phase` plus an absolute `state.endsAt` epoch-ms. `onEvent` mutates state and may return `"results"`; otherwise the engine re-arms the timer and broadcasts. `onPhaseEnd(room, { reason })` advances the phase or returns `"results"`; it must set the next `endsAt`. Every phase ends early when `allSubmitted`/`allVoted` says all connected players have acted.
- **Leave safety:** use a local `activePlayers(room)` helper filtered by `player.connected`; `onPlayerLeave` removes that player's submissions/votes before checking early completion. A departure below the game minimum (or a role/driver departure where the mechanic cannot continue) sets `state.done = true` and returns `"results"`. Never leave required-input sets waiting on a removed player.
- **Hidden information:** `viewFor(room, viewerId)` is the only place that receives viewer-private data. `publicFor(room)` is the TV/spectator view and must omit roles, secret words, unrevealed answers/votes and secret numbers until reveal. Tests assert secrets are absent from `publicFor` and other players' views.
- **Events:** client `send(type, data)` becomes `onEvent(room, playerId, { type, ...data, playerId })`. Validate turn/role ownership server-side and throw `failure(code, message)` for invalid actions. Use stable player ids, never socket ids.
- **Scoring:** modules add integer points directly to `room.scores[playerId]` and expose a `roundPoints`/`roundWinners` array shaped `{ playerId, name, points }` in the reveal for the existing UI. The engine owns final ranking, winners and persistence.
- **Modes:** modes are config objects with `label`, `description`, timers/round counts and rule flags. Fall back to `classic` for unknown modes. The mode is selected in the lobby through `selectGame`.
- **Prompt banks:** JSON arrays in `server/data/prompts/<game-id>.json`, loaded with `createRequire` because the server is ESM. Each run tracks `usedPromptIds` and cycles only after exhausting the bank. Tests assert minimum size, non-empty primary text, unique stable ids and full-session non-repetition where applicable.
- **Migrations:** existing phases add all ids for that phase to the `game_sessions_game_type_check` in one migration. Follow that tier-level pattern rather than one migration per individual game; note it in `DECISIONS`. Update `supabase-schema.sql` for fresh installs as well.
- **Client:** the game page casts `room.game` to the screen's exported view type and renders by `room.gameId`, passing `{ room, view, send }`. `GameShell` owns the timer ring from `room.endsAt`/`room.serverNow`, round labels and exit handling; the game screen renders phase content and its own reveal/round-points UI. No client source of truth for timers or scoring.
- **Lobby:** cards are generated from the registry, so adding a module exposes it automatically. Player minimums and modes come from module metadata. Optional metadata can be added for tags without hard-coding a card.
- **Tests:** `node:test` suites build a plain room object with a `players` Map, `scores` and `state`, then call module methods directly. Add bank validation beside the mechanics test. The full suite and client lint/build run after each game.

**Deviations from the spec noted for implementation:** the codebase has no shared `phases.js`, `scoring.js`, `normalize.js`, `dictionary.js` or `shuffle.js` wrapper yet; existing modules inline phase logic and import `shuffle` from `utils/helpers.js`. Shared helpers will be introduced only when a second game genuinely needs the same non-trivial logic. Tier migrations follow the existing phase-migration convention above.

## 4. Cross-cutting work

1. **Shared modules:** `phases.js` (timers and early-end helper), `scoring.js`, `normalize.js` (answer normalization, aliasing, edit distance), `dictionary.js`, `shuffle.js` (seedable for tests).
2. **Lobby:** catalogue generated from registry; each card shows min/max players, modes, estimated duration, and a "needs N more" badge. Add tags: `Write`, `Draw`, `Trivia`, `Social`, `Real-time` and filtering.
3. **Content safety:** all user-written text goes through a length cap and basic profanity filter hook (configurable). Host can mute or skip a player.
4. **Rate limits:** per-socket event caps (strokes, typing, guesses) to prevent flooding.
5. **Migrations:** one migration per tier adding ids to the `game_type` CHECK.
6. **Docs:** update the README games table when each game lands.

---

## DECISIONS

- **Mad Libs player cap (3–9, not 3–12):** the spec requires one fixed story template, 1–3 blanks per player, and support for 12 players. Those constraints cannot all hold: 12 players need at least 12 blanks, while 3 players may fill at most 9. The bank uses nine blanks per story and the module caps the room at nine so every player always gets 1–3 blanks. Lobby metadata reflects the real 3–9 range.
- **Tier migrations:** one migration file per tier (`supabase-migration-tier1-games.sql`) follows the existing phase-migration pattern; ids are added to it as each game lands rather than creating one migration per game.
- **Pitch Perfect final round:** the final-round multiplier applies to both vote points and the unanimous bonus, so every scoring event in that round is doubled.

