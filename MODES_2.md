# MODES_2.md — GroupLore game set, round 2

The 28 games from MODES.md are built. This doc specs **15 more**, plus the one shared primitive several of them need (**teams**). The final section is a paste-ready agent prompt.

All rules from MODES.md still apply: server-authoritative, hidden info only through `viewFor`, phases with early-end, `onPlayerLeave` never deadlocks, modes are config, standard `roundScores`, stable `playerId`s, full snapshot on reconnect, banks with unique stable ids and tests.

---

## 1. New shared work (build first)

### 1.1 Teams primitive

Needed by Codenames, Password, Blind Sketch. Do not hard-code teams inside any game.

- Room state gains `teams: { id, name, color, playerIds[] }[]` when the selected game declares `teams: { count, minPerTeam }` in its engine metadata.
- Lobby UI: team assignment panel (auto-balance, shuffle, tap to switch, host can lock). Game cannot start until every team has `minPerTeam` and sizes differ by at most 1 (unless the game allows uneven).
- Engine helpers: `teamOf(playerId)`, `teammates(playerId)`, `rotateTeam()`, `teamScores(roundScores)`.
- `viewFor` receives the player's team so role-based views are easy (spymaster, drawer, guesser).
- Odd counts: one team may have an extra player; games must handle that (rotating roles, byes).
- Leave handling: if a team falls below `minPerTeam`, pause for 20s waiting for a rejoin, then end the game gracefully.
- Scoring: standard per-player `roundScores` plus `teamScores`; the leaderboard shows teams for team games.

### 1.2 Per-client latency estimate

Needed by Reaction Duel and Buzzer Trivia. Measure RTT with periodic pings; keep a smoothed median per player; expose `latencyOf(playerId)` capped at 250ms. Never trust client-reported timestamps.

### 1.3 Asset pipeline (Blur Guess)

A static asset folder (`server/data/assets/blur/`) with a build script that generates N pre-blurred variants per image. Serve variants only when the phase reaches them. License manifest required (see the game).

### 1.4 Chain helper (Story Chain)

If Draw Telephone already has a chain-rotation helper, reuse it; otherwise extract it: rotates chain ownership so nobody sees their own chain until the reveal.

---

## 2. Build order

| Order | Game            | Why                                     |
| ----- | --------------- | --------------------------------------- |
| 1     | Teams primitive | Unblocks three games                    |
| 2     | Fill the Blank  | Highest replay value, reuses write/vote |
| 3     | Connections     | Bank only                               |
| 4     | Survey Says     | Bank only                               |
| 5     | Scattergories   | Reuses answer normalisation             |
| 6     | Pattern Memory  | Simple real-time                        |
| 7     | Reaction Duel   | Needs latency estimate                  |
| 8     | Story Chain     | Reuses chain helper                     |
| 9     | Password        | First team game, low risk               |
| 10    | Boggle Rush     | Dictionary reuse plus grid solver       |
| 11    | Buzzer Trivia   | Low-latency fairness                    |
| 12    | Liar's Dice     | Hidden state                            |
| 13    | Blur Guess      | Needs assets                            |
| 14    | Codenames       | Flagship team game                      |
| 15    | Blind Sketch    | Canvas plus teams plus blind rendering  |
| 16    | Duel Bracket    | Sub-engines                             |

---

## 3. Specs

Format: **players** · **modes** · **flow** · **scoring** · **notes** · **bank**.

### 🃏 Fill the Blank (`fill-the-blank`)

- **Players:** 3–12 · **Modes:** Classic (judge rotates, first to 5) / Quick (8 rounds)
- **Flow:** `deal` (each player holds 7 answer cards; a rotating judge reveals a prompt card with 1 blank, or 2 for "pick 2") → `play` (everyone except the judge submits 1 card or 2, 40s, ends early when all are in) → `judge` (submissions shown anonymously and shuffled; judge picks the best) → `reveal` (winner's name, card) → refill hands to 7 → next judge.
- **Scoring:** winner +1 point (displayed as 100); first to the target wins.
- **Notes:** judge's `viewFor` hides authors until the pick. A judge who times out (30s) gets a random pick and loses the next turn. Players may swap 1 card per round for a one-round penalty (optional flag). Hands are persisted per player in session state, never sent to others.
- **Bank:** **original** content only: 120 prompts and 500 answer cards with `{ id, text, type: 'prompt'|'answer', blanks }`. Do not copy any commercial deck. Provide a content-rating tag and exclude NSFW by default.

### 🧩 Connections (`connections`)

- **Players:** 2–12 · **Modes:** Race (everyone solves the same board independently; faster correct groups score more) / Co-op (shared board, 4 shared mistakes)
- **Flow:** `solve` (16 words; select 4; submit; the server answers correct/one-away/wrong and reveals the group's category if correct) → `reveal` after 120s or all done.
- **Scoring:** Race: group 1 to 4 worth 100/150/200/300 (harder groups worth more) minus 25 per mistake, plus a speed bonus up to +100. Co-op: team score = groups solved × 200 minus mistakes.
- **Notes:** "One away" feedback computed server-side. Shuffle per player in Race. Board states are per player in `viewFor`; `publicFor` shows only progress (groups solved), not which words.
- **Bank:** 100 puzzles `{ id, groups: [{ category, words[4], level 1-4 }] }`. Test: no puzzle repeats a word across its own groups, all words unique, and each group has exactly 4.

### 📊 Survey Says (`survey-says`)

- **Players:** 3–12 · **Modes:** Classic (8 questions, 30s) / Fast Money (3 questions, 15s, higher multipliers)
- **Flow:** `guess` (each player types up to 3 guesses for the question) → `reveal` (answers flipped in rank order, showing who matched which) → `scores`.
- **Scoring:** matched answer gives its points (rank 1 = 40, down to rank 8 = 5); duplicate guesses by others don't reduce your points; a bonus for sweeping 3 matches.
- **Notes:** matching via `normalize.js` with an alias list; fuzzy matching at edit distance 1 for words ≥ 5 letters. Show "so close" privately for near-misses.
- **Bank:** 150 questions `{ id, text, answers: [{ text, aliases[], points }] }`. **Rankings are editorial, not real survey data;** do not label them as such.

### 🗂️ Scattergories (`scattergories`)

- **Players:** 3–12 · **Modes:** Classic (5 rounds, 8 categories, 90s) / Blitz (6 categories, 45s)
- **Flow:** `answer` (a letter plus categories; one answer per category, must start with the letter) → `compare` (answers shown per category; players may challenge invalid answers) → `scores`.
- **Scoring:** a unique valid answer = 100; an answer shared with anyone = 0; challenged answers go to a majority vote.
- **Notes:** server rejects wrong-letter answers on submit. Letter weights exclude Q, U, X, Z, V (or weight very low). A challenge vote lasts 10s; the answerer can't vote on theirs.
- **Bank:** 80 category lists `{ id, categories: [...] }` plus the letter weight table.

### 🧠 Pattern Memory (`pattern-memory`)

- **Players:** 2–12 · **Modes:** Classic (shared sequence, simultaneous replay, last one standing) / Relay (players append one tile each in turn; the next player must replay the full chain)
- **Flow:** `show` (the sequence flashes on a 3×3 grid, speed increases with length) → `input` (players replay) → `check` → next level or elimination.
- **Scoring:** points = level reached × 100; the last survivor gets +500.
- **Notes:** the server generates the sequence from a seeded RNG; the client gets only the sequence for the `show` phase. A wrong tile eliminates immediately. A time limit per input (2s per tile). Provide colour-blind-friendly tile patterns plus optional sound.
- **Bank:** none.

### ⚡ Reaction Duel (`reaction-duel`)

- **Players:** 2–12 · **Modes:** Classic (7 rounds) / Sudden (first to 3 wins)
- **Flow:** `wait` (a "get ready" screen, random delay 2–6s chosen by the server) → `go` (the screen flips) → `tap` → `result`.
- **Scoring:** fastest tap 300, then 200, 100; an early tap (before `go` is sent) costs 100 and locks that player out for the round.
- **Notes:** the server timestamps `go` and each tap's arrival; reaction time = arrival − send − the player's smoothed half-RTT (clamped to ≥ 100ms to block impossible values). Ties within 5ms split points. Never send the delay to clients.
- **Bank:** none.

### 📖 Story Chain (`story-chain`)

- **Players:** 3–12 · **Modes:** Classic (each chain visits everyone, 40s per turn) / Short (4 passes max)
- **Flow:** `start` (each player gets a starter prompt and writes the first sentence) → `pass` (each chain goes to the next player, who sees **only the last sentence** and adds one) → repeat → `reveal` (each story is read in order, with author tags) → `vote` (best story and best line).
- **Scoring:** best story +300 to every contributor, best line +200 to its author.
- **Notes:** reuse the chain helper. A timeout submits a blank that's shown as "…". Sentence cap 140 chars.
- **Bank:** 60 starters `{ id, text }`.

### 🔤 Password (`password`)

- **Players:** 4–12 (teams, ≥ 2 each) · **Modes:** Classic (5 words each, 60s, 3 clue tries) / Speed (45s)
- **Flow:** `turn` (one clue giver per team turn sees the secret word and sends one-word clues; teammates guess after each clue) → `result` → the other team takes a turn; the clue giver rotates each round.
- **Scoring:** a correct guess on try 1/2/3 = 300/200/100; after 3 clue tries the word is lost.
- **Notes:** server-validate clues: single token, not the target word or a stem or plural of it, not an earlier clue. Opponents may see the clue stream but not the word. The clue giver can't talk to the guessers in-game (voice allowed externally).
- **Bank:** 300 words with difficulty.

### 🔠 Boggle Rush (`boggle-rush`)

- **Players:** 2–12 · **Modes:** Classic (3 rounds, 90s, 4×4) / Big (5×5, 120s)
- **Flow:** `play` (shared grid; each player traces words by tapping adjacent tiles; no reuse of a tile) → `compare` (found words per player) → `scores`.
- **Scoring:** word score by length: 3–4 letters = 100, 5 = 200, 6 = 300, 7 = 500, 8+ = 1100; **a word found by two or more players scores 0 for all of them**.
- **Notes:** the server generates the grid from a seeded dice set and rejects grids with fewer than N solvable words (run a solver at generation). Validate words server-side against the shared dictionary. `publicFor` during play shows only counts of words found per player. Accepted tile paths are validated on submit.
- **Bank:** dice set and dictionary reuse.

### 🔔 Buzzer Trivia (`buzzer-trivia`)

- **Players:** 3–12 · **Modes:** Classic (10 questions, text revealed word by word) / Lightning (5s to buzz)
- **Flow:** `read` (the question streams in word by word) → `buzz` (the first valid buzz locks the question) → `answer` (the buzzer types or picks within 6s) → `result`. A wrong answer locks that player out for the question and costs 100; the question reopens to the others and keeps streaming.
- **Scoring:** correct = 300 plus a bonus for buzzing earlier in the read-out, up to +200.
- **Notes:** order by server arrival time minus a latency correction from 1.2 (only applied when two buzzes arrive within 80ms). Single buzz per player per question. Disable buzzing for 400ms at the start to prevent accidental taps.
- **Bank:** 300 questions `{ id, text, answer, aliases[], category, difficulty }`; may share the bank with Speed Trivia (no duplicates in one session).

### 🎲 Liar's Dice (`liars-dice`)

- **Players:** 3–8 · **Modes:** Classic (5 dice each, ones wild) / Fast (3 dice, no wilds)
- **Flow:** `roll` (each player sees only their own dice) → `bid` (turn order; each bid raises the quantity or face value of the previous one) → `call` (anyone whose turn it is can call "liar") → `reveal` (all dice revealed, count checked) → the loser of the challenge loses one die → next round, last player with dice wins.
- **Scoring:** placement-based (1st 1000, 2nd 700, …).
- **Notes:** `viewFor` shows own dice only; `publicFor` shows the dice counts. Bid validation server-side. A turn timer (25s) auto-places the minimum legal raise; if none is legal it auto-calls. On leave, the player's dice are discarded and play continues.
- **Bank:** none.

### 🖼️ Blur Guess (`blur-guess`)

- **Players:** 3–12 · **Modes:** Classic (8 images, 20s) / Hard (obscure subjects, faster)
- **Flow:** `reveal-stages` (the image progresses through 6 pre-blurred variants over the timer) → players guess in free text at any time → `result` shows the clean image and answer.
- **Scoring:** points = 100 × the number of stages remaining when guessed (earlier = more); a wrong guess costs 25.
- **Notes:** **never send the sharp image or all variants up front**, since client-side CSS blur can be defeated by inspecting the network or DOM. Send each pre-blurred variant only when its stage begins; send the sharp one only at the result. Guess matching with aliases.
- **Bank:** 150 images `{ id, answer, aliases[], category, file, license, source }`. Only CC0 / public-domain / self-made images; the license manifest is checked in a test, and a missing license fails the build.

### 🕵️ Codenames (`codenames`)

- **Players:** 4–12 (two teams, each with 1 spymaster; teams ≥ 2) · **Modes:** Classic / Speed (60s turns)
- **Flow:** `setup` (25 words; the key assigns 9/8 team words, 7 neutral, 1 assassin; the starting team has 9) → `clue` (the spymaster gives one word plus a number) → `guess` (operatives tap words, with a max of number + 1 guesses; a wrong tap ends the turn) → alternate until a team finds all its words or hits the assassin.
- **Scoring:** the winning team's players +500; the losing team +100 per word found.
- **Notes:** spymasters' `viewFor` includes the full key; operatives' `viewFor` shows only revealed colours. Clue validation: single word, not on the board, not a substring or stem of a board word. Team votes are not needed (any operative may tap; optionally require a teammate confirm). Spymaster role rotates between games.
- **Bank:** 400 words, which must be original or common words only; avoid copying a commercial word list verbatim.

### 🙈 Blind Sketch (`blind-sketch`)

- **Players:** 4–12 (two teams, min 2 per team) · **Modes:** Classic (3 turns per team, 60s) / Custom Word (the word team writes the word) / Hard (45s)
- **Flow:** `assign` → `word` (the word team picks 1 of 3 bank words, or writes one in Custom Word mode; 15s) → `pick-drawer` (the drawing team picks one member, rotating by default) → `draw` (the drawer sees the word and draws on a canvas that renders nothing for them; teammates see strokes live and type guesses; the word team watches live but can't guess) → `reveal` (stroke replay at 3x, then the true word) → swap roles.
- **Scoring:** drawing team: 500 × remaining-time share to the first correct guesser's team, +100 for each further correct teammate; word team: +300 if time runs out with no correct guess. Team score is the sum.
- **Notes:** reuses the canvas and stroke infra from the Draw games and the teams primitive. Role-based `viewFor`: the drawer gets the word and no canvas render, guessers get the canvas and no word, the word team gets both and no guess input. A custom word is length-validated and filtered.
- **Bank:** 300 drawable words with difficulty.

### 🥊 Duel Bracket (`duel-bracket`)

- **Players:** 4–8 (byes for odd counts) · **Modes:** Classic bracket / Round Robin (≤ 6 players)
- **Flow:** `seed` (random seeding) → for each match, a duel game is chosen at random from the pool (tic-tac-toe best-of-3, Connect 4, rock-paper-scissors best-of-5, dots-and-boxes small grid) → `duel` (the two players play; everyone else spectates live) → `advance` → final.
- **Scoring:** placement-based; each match win is +100.
- **Notes:** implement each duel as a tiny sub-engine behind a common interface `{ init, move, status, viewFor }` so more duels can be added. Spectators get `publicFor` boards. Disconnected duelist forfeits after 20s. Per-move timers (20s).
- **Bank:** none.

---

## 4. Agent prompt

```text
You are extending GroupLore, a real-time multiplayer party-game app
(Next.js client, Express + Socket.io server, Supabase). The first set of
28 games from MODES.md is already built, along with the shared helpers
and the new UI theme. Read README.md, MODES.md and MODES_2.md fully
before writing code. MODES_2.md is the spec for this round; if it
conflicts with the existing code's actual conventions, follow the code
and note the deviation.

STEP 0: Orient (no edits yet)
- Read server/games/index.js, the shared helpers (phases, scoring,
  normalize, dictionary, shuffle, chain, canvas/stroke code), and at
  least four existing games covering: write-and-vote, real-time input,
  canvas drawing and a hidden-role game.
- Read the lobby code, the room state shape, the client game-shell
  components and client/src/lib/gameMeta.ts.
- Append a short CONVENTIONS section to MODES_2.md listing the exact
  signatures and patterns you will follow. Do not guess; reuse what
  exists.

EXECUTION RULES
- Follow the build order table in MODES_2.md section 2. Do the shared
  work in section 1 first (teams, latency estimate, asset pipeline, chain
  helper) as separate commits with tests, then one game per commit.
- Each game meets this definition of done: engine module, registry entry,
  migration adding the id to the game_type CHECK, prompt bank at the
  stated size, client screen routed by room.gameId using the shared game
  shell and UI primitives, a gameMeta entry (emoji, category, hue), lobby
  card, tests (phase flow, scoring, early-end, leave/reconnect,
  hidden-info leaks, bank validity).
- Hidden information flows only through viewFor. Add leak tests for
  Codenames (key), Liar's Dice (dice), Blind Sketch (word and canvas
  roles), Buzzer Trivia (answers), Blur Guess (sharp image).
- Teams are a lobby-level primitive: do not implement team assignment
  inside individual games.
- Banks: write real, varied, high-quality content to the minimum sizes.
  No placeholders or duplicates, stable unique ids. Fill the Blank and
  Codenames content must be original. Image assets for Blur Guess must be
  CC0, public domain or self-made, with a license manifest; if you cannot
  source enough compliant images, ship the engine with the images you can
  verify and log the gap in DECISIONS instead of using unlicensed ones.
  Factual banks must be accurate; drop any item you are unsure about.
- Add each game to the README games table and the lobby catalogue
  categories (Write, Draw, Trivia, Social, Real-time, Strategy).
- Do not change auth, group or lobby behaviour beyond the teams
  primitive.

AUTONOMY
- Do not ask me questions. Decide, and record non-obvious decisions in a
  DECISIONS section at the bottom of MODES_2.md.
- After each game run the full test suite, lint and typecheck, fix
  failures, then commit "feat(games): add <name>".
- If a mechanic needs an engine extension, make it its own commit with
  tests first.
- If blocked on one game, log what you tried in DECISIONS and continue
  with the next independent game.

FINISH
Print a table: game, status, tests passing, known gaps, plus the list of
migrations to run in order.
```

---

## DECISIONS

### CONVENTIONS

- The repository is a single root-level Next.js app. The realtime server is the process-wide engine in `src/server/engine/engine.js`, reached over SSE plus authenticated `POST /api/rooms/:id/actions`; there is no Express/Socket.io server or separate `client/` tree. This document's older references to that layout are superseded by the code.
- Every game exports `{ id, name, description, minPlayers, maxPlayers, modes, init, onEvent, onPhaseEnd, onPlayerLeave, viewFor, publicFor }`. `init(room, mode)` sets `room.state`; hidden state is returned only by `viewFor`; the TV receives `publicFor`.
- Shared helpers live in `src/server/games/shared.js` and `src/server/engine/primitives/*`. New engines use `activePlayers`, `configFor`, `failure`, `roundScores`/`pointsList`, `normalize`, `dictionary`, `chain`, `canvas`, `teams`, and latency rather than reimplementing them.
- Games are registered in `src/server/games/index.js`; their ids are added to the `game_sessions.game_type` CHECK constraint. The lobby catalogue comes from the registry.
- Lobby-level teams are stored on `room.teams` and manipulated through engine actions (`teams:auto`, `teams:shuffle`, `teams:move`, `teams:lock`) and `TeamAssignment.tsx`. Games read `teamOf`/`teammates`; they never own assignment UI or team state.
- Realtime actions are `POST` bodies mirrored by `send(type, data)` on the client. Phase timers call `onPhaseEnd`; leaves call `onPlayerLeave`. Every engine returns `"results"` rather than leaving a room stuck when a player disappears.
- Client screens are selected by `room.gameId` in `src/app/game/[sessionId]/page.tsx`. The round-two games share `RoundTwoGame.tsx` and the existing `GameShell`/`PromptCard`/`AnswerInput`/UI primitives. `TeamAssignment` appears on the game-page lobby because the HTTP lobby page has no engine room yet.
- Prompt banks are generated by `scripts/generate-round2-banks.mjs`; blur assets and their license manifest by `scripts/build-blur-assets.mjs`. Bank tests assert stable unique ids and the actual shipped counts.

### DECISIONS

1. **One migration for all fifteen games.** `supabase/migrations/supabase-migration-round2-games.sql` widens the `game_type` CHECK once, instead of one migration per game. This keeps the ordered migration list short; it is the only schema change these games require.
2. **Teams are a room primitive.** `room.teams` is created by `autoBalance`, validated before the engine may enter `playing`, and kept in sync on join/leave. The host can auto-balance, shuffle, move and lock teams. Odd counts are allowed with sizes differing by one. If a team drops below `minPerTeam`, Password pauses for 20 seconds and resumes when the team is restored; if the pause expires, the game ends gracefully instead of deadlocking.
3. **Latency.** The server sends `latency:ping` with an opaque id and consumes the matching `latencyPong`; `latencyOf` uses a smoothed half-RTT capped at 125 ms. Client timestamps are never used for scoring.
4. **Blur assets.** The shipped set is 150 self-made SVG subjects with six pre-blurred stages each. Every file and stage is generated locally by `scripts/build-blur-assets.mjs` from `scripts/blur-extra-subjects.mjs` and recorded in `src/server/data/assets/blur/manifest.json` and `public/blur/LICENSE.md`. Sharp images and future stages are never included in a stage view; only the current stage URL and, at result time, the sharp URL are sent.
5. **Banks.** The generated banks are real, varied content with stable ids. Shipped counts: Fill the Blank 120 prompts/500 answers, Connections 100 puzzles, Survey Says 150 questions, Scattergories 80 category sets, Story Chain 60 starters, Password 300 words, Codenames 400 words, Blind Sketch 300 words, Buzzer Trivia 300 questions, Blur Guess 150 images, Boggle dictionary 610 words.
6. **Client composition.** All fifteen games use one routed screen component with per-game subviews. Blind Sketch uses a local SVG stroke surface and sends normalized strokes through the existing action stream; the drawer's view intentionally hides all strokes, including their own. At reveal, the client replays the recorded strokes progressively at 3× before showing the word.
7. **Bracket and challenge flows.** Duel Bracket's `Round Robin` mode builds an all-pairs schedule, plays every pairing once, and ranks the room by match wins. Scattergories runs a 10-second challenge phase: any player can challenge another player's answer, everyone except the answerer votes, and an accepted challenge invalidates the answer before shared/unique scoring. Password's dropout pause uses the engine's `onPlayerJoin` hook to resume immediately when the team is restored.

### NOTES

- No open content or mechanics gaps remain for the round-two set.
- The web client has no automated browser/E2E coverage for the new screens; server tests cover engine flow, privacy, scoring and bank validity. Guest HTTP tests remain skipped because anonymous sign-ins are disabled in the test Supabase project.
