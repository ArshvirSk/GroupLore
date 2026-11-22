# GroupLore 🎲

> **Real-time multiplayer party games, personalized for your friend group.**

Inside jokes, embarrassing habits, iconic moments — turned into multiplayer chaos.

---

## Architecture

```
GroupLore/
├── src/app/               # Landing, dashboard, group, lobby, game, guest
├── src/app/api/           # REST + SSE realtime route handlers
├── src/components/        # Shared UI + game screens
├── src/stores/            # Zustand auth and room stores
├── src/lib/               # Supabase, API, realtime, lobby helpers
├── src/server/            # Engine, games, data, and server libraries
├── docs/                  # Design, deployment, and development docs
├── supabase/              # Schema + ordered migrations
├── deploy/                # systemd and nginx templates
└── render.yaml            # Render Blueprint for a single-process host
```

## Tech Stack

| Layer     | Technology                                          |
| --------- | --------------------------------------------------- |
| Frontend  | Next.js 16, Tailwind CSS v4, Framer Motion, Zustand |
| Backend   | Next.js route handlers + process-wide game engine |
| Database  | Supabase (PostgreSQL)                               |
| Auth      | Supabase Auth (email/password + anonymous guests)   |
| Real-time | Server-Sent Events + authenticated POST actions     |

## Games

All **61 games** below are playable through the server-authoritative engine. Player counts range from 2 to 12; see the table for each game's requirement. Games use their static prompt banks by default. When a group opts in and its owner approves a generated lore pack, lore-enabled deployments can use those approved prompts for **Most Likely To**, with the static bank as a fallback.

There is **no single-player or bot mode** yet. **Solo** below means individual scoring, not one human: every game currently needs at least two real players.

### Play structures

| Structure | What it means | Games |
| --- | --- | --- |
| **Solo FFA** | Everyone competes for themselves on one shared scoreboard. | Most games in the table below. |
| **Team vs team** | Two fixed teams, minimum two players each; the lobby auto-balances teams. | Password, Codenames, Blind Sketch |
| **Co-op** | Everyone shares one board and one failure state. | Connections (Co-op mode), Just One, The Mind |
| **Solo race** | Everyone plays the same timed round independently and scores themselves. | Type Race, Wordle Race, Boggle Rush, Category Rush, Scattergories |
| **Head-to-head** | Players are paired into 1v1 matches while the rest spectate. | Duel Bracket |
| **Social deduction** | Hidden roles, hidden answers, or an uninformed majority. | Guess the Impostor, Odd One Out, Two Truths One Lie, Liars Bar, Bluff, Chameleon, Spyfall, Werewolf, Resistance |
| **Elimination** | Players drop out as the game progresses. | Fact or Fiction (Sudden Death), Pattern Memory, Liar's Dice, Bomb Party, Word Chain, Hot Potato |
| **Rotating role** | One player leads a round, then the role passes on. | Fill the Blank (judge), Wavelength (clue giver), Auction Bluff (appraiser), Password (clue giver per team turn) |
| **Card table** | Hidden hands, face-down plays, and a shared pile. | Liars Bar, Cheat, Higher / Lower (Deck), Fill the Blank |

### Game and mode catalogue

| Game | Players | Structure | Modes |
| --- | --- | --- | --- |
| 👑 **Most Likely To** | 3–12 | Solo FFA | **Classic** — secret votes until the reveal; **Anonymous** — tally only, voter names hidden |
| 🕵️ **Guess the Impostor** | 3–12 | Social deduction | **Classic** — one impostor, 30 seconds of clues; **Double Agent** — two impostors with 4+ players; **Blind** — no discussion, straight to the vote |
| ⚡ **5 Second Challenge** | 3–12 | Solo FFA | **Classic** — five seconds, then the group judges; **Lightning** — three seconds; **Marathon** — ten seconds, six turns |
| ⚖️ **Overrated / Underrated** | 3–12 | Solo FFA | **Classic** — five items, twelve seconds to pick a side |
| 🍸 **Liars Bar** | 3–8 | Card table | **Classic** — 20-card table, five-card hands, three strikes; **Quick** — one strike eliminates |
| 🃏 **Cheat** | 3–8 | Card table | **Classic** — 52 cards, claim the rank, empty your hand; **Quick** — 30-card deck and faster turns |
| 💀 **Skull Duel** | 3–6 | Card table | **Classic** — first to two clean challenges; **Quick** — first to one |
| ♠️ **Blackjack Showdown** | 2–8 | Card table | **Classic** — eight chip rounds and a 200-chip stack; **Quick** — faster decisions, same eight rounds |
| 📈 **Higher / Lower** | 3–12 | Solo FFA | **Classic** — rate the room, then six calls; **Quick** — faster poll and four calls; **Deck** — 52 cards, streak multiplier, ties push |
| 🚫 **Avoid the Answer** | 3–12 | Solo FFA | **Classic** — forty-five seconds without the banned words; **Blitz** — three fast rounds |
| 🔀 **Would You Rather** | 3–12 | Solo FFA | **Classic** — majority takes the point; **Minority Rules** — the smaller side scores two |
| 📸 **Caption This** | 3–12 | Solo FFA | **Classic** — four scenarios, thirty seconds each; **Quick** — three faster rounds |
| 🌊 **Wavelength** | 3–12 | Rotating clue giver | **Classic** — one clue giver and a secret point on the spectrum; **Quick** — three faster rounds |
| 💡 **Category Rush** | 3–12 | Solo FFA | **Classic** — five categories, twenty seconds; **Speed** — ten seconds |
| 🐝 **Hive Mind** | 3–12 | Group consensus | **Classic** — five prompts, twenty seconds to agree; **Speed** — ten seconds |
| 🎭 **Odd One Out** | 4–12 | Social deduction | **Classic** — one related prompt to find through discussion and voting; **Blind** — straight to the vote |
| 🎩 **Bluff** | 3–12 | Social deduction | **Classic** — write a fake, then spot the real answer; **Quick** — three faster rounds |
| 🌶️ **Hot Takes** | 3–12 | Solo FFA | **Classic** — six takes, twelve seconds to pick a side; **Slow Burn** — twenty seconds |
| 🔥 **Roast Battle** | 3–12 | Solo FFA | **Classic** — three rounds of anonymous head-to-head answers; **Quick** — two faster rounds |
| 🔤 **Acronym Wars** | 3–12 | Solo FFA | **Classic** — five rounds, 40 seconds to expand the letters; **Speed** — 20 seconds |
| 🦈 **Pitch Perfect** | 3–12 | Solo FFA | **Classic** — four product pitches; **Quick** — three faster rounds; final-round votes count double |
| 📝 **Mad Libs Chaos** | 3–9 | Solo FFA | **Classic** — three stories, blind blanks, then rate everyone else's words |
| 🤥 **Two Truths, One Lie** | 3–12 | Social deduction | **Classic** — sixty seconds to write, twenty to vote; **Rapid** — fifteen-second votes |
| ✅ **Fact or Fiction** | 3–12 | Solo / elimination | **Classic** — ten statements with speed and streak bonuses; **Sudden Death** — a wrong answer eliminates you |
| 🃏 **Fill the Blank** | 3–12 | Rotating judge | **Classic** — a rotating judge and a target of 5 points; **Quick** — eight rounds |
| 🧩 **Connections** | 2–12 | Solo race / co-op | **Race** — every player solves a shuffled board of their own; **Co-op** — one shared board and four mistakes; **Daily** — the same puzzle for every group today |
| 📊 **Survey Says** | 3–12 | Solo FFA | **Classic** — eight editorial-ranked questions; **Fast Money** — three questions with multipliers |
| 🗂️ **Scattergories** | 3–12 | Solo FFA | **Classic** — five rounds, eight categories, then a 10-second challenge vote; **Blitz** — six categories and a shorter timer |
| 🧠 **Pattern Memory** | 2–12 | Elimination | **Classic** — simultaneous replay until one survivor; **Relay** — a growing shared chain |
| ⚡ **Reaction Duel** | 2–12 | Solo speed | **Classic** — seven server-timed rounds; **Sudden** — first to three wins |
| 📖 **Story Chain** | 3–12 | Solo / vote | **Classic** — every chain visits every player; **Short** — four passes then the vote |
| 🔤 **Password** | 4–12 | Team vs team | **Classic** — five words and three clue tries; **Speed** — a shorter turn; either mode pauses 20 seconds if a team drops below two |
| 🔠 **Boggle Rush** | 2–12 | Solo race | **Classic** — three 4×4 rounds; **Big** — a 5×5 grid |
| 🔔 **Buzzer Trivia** | 3–12 | Solo FFA | **Classic** — ten questions with an early-buzz bonus; **Lightning** — a shorter buzz window |
| 🎲 **Liar's Dice** | 3–8 | Elimination | **Classic** — five dice and wild ones; **Fast** — three dice and no wilds |
| 🖼️ **Blur Guess** | 3–12 | Solo FFA | **Classic** — eight images, six pre-blurred stages; **Hard** — fewer images and faster stages; **Daily** — five shared images seeded by UTC date |
| 🕵️ **Codenames** | 4–12 | Team vs team | **Classic** — two teams, one spymaster each; **Speed** — a shorter turn clock |
| 🙈 **Blind Sketch** | 4–12 | Team vs team | **Classic** — three turns per team with hidden strokes; **Custom Word** — the opposing team writes the word; **Hard** — a shorter timer |
| 🥊 **Duel Bracket** | 4–8 | Head-to-head | **Classic** — a single-elimination bracket of random mini-duels; **Round Robin** — every pairing plays once and standings rank the room |
| 🦎 **Chameleon** | 4–12 | Social deduction | **Classic** — Three rounds of clues and one hidden chameleon; **Quick** — Two fast rounds |
| 🕵️ **Spyfall** | 4–12 | Social deduction | **Classic** — Question, accuse, survive: three locations; **Blitz** — Shorter rounds and faster accusations |
| 🎯 **Closest Wins** | 2–12 | Solo FFA | **Classic** — Eight estimation questions, closest wins; **Bet** — Wager points on your own estimate |
| 🕰️ **Timeline** | 2–12 | Solo FFA | **Classic** — Six sets of five events; **Micro** — Three quick three-item sets |
| 📊 **Rank It** | 2–12 | Solo FFA | **Classic** — Six ranks, four items each; **Speed** — Fifteen seconds to rank each set |
| ⚡ **Speed Trivia** | 2–12 | Solo FFA | **Classic** — Twelve questions, ten seconds each; **Marathon** — Twenty-five questions on a six-second clock |
| 🏁 **Flag Rush** | 2–12 | Solo FFA | **Classic** — Fifteen flags with eight seconds each; **Sprint** — Twenty flags, five seconds each |
| 🧩 **Emoji Decode** | 2–12 | Solo FFA | **Classic** — Twelve emoji puzzles, twenty seconds each; **Speed** — Ten seconds, twelve puzzles |
| 1️⃣ **Just One** | 3–12 | Co-op | **Classic** — Thirteen words, one guesser each round; **Quick** — Eight words with faster clues |
| 🤝 **Split or Steal** | 3–12 | Solo FFA | **Classic** — Three rounds of secret split-or-steal choices; **Sudden Death** — One round. Choose carefully. |
| 🔨 **Auction Bluff** | 2–12 | Solo FFA | **Classic** — Eight lots, sealed bids, bluffs allowed; **Short** — Five lots with faster bidding |
| 💣 **Bomb Party** | 3–12 | Elimination | **Classic** — Three lives, fifteen seconds a turn; **Quick** — Two lives and eight seconds |
| 🔗 **Word Chain** | 2–12 | Elimination | **Classic** — Three trips around the table, twenty seconds each; **Sprint** — Two fast trips with ten-second turns |
| ⌨️ **Type Race** | 2–12 | Solo race | **Classic** — Three passages, two minutes each; **Quick** — Two shorter races |
| 🟩 **Wordle Race** | 2–12 | Solo race | **Classic** — Three words, six guesses, four minutes; **Blitz** — Two words and four minutes |
| 🥔 **Hot Potato** | 3–12 | Elimination | **Classic** — Three lives and a 15–35 second fuse; **Quick** — Two lives on a 10–20 second fuse |
| 🧠 **The Mind** | 2–8 | Co-op | **Classic** — Five levels, three shared lives; **Short** — Three levels with two lives |
| 🎨 **Draw & Guess** | 3–12 | Solo FFA | **Classic** — Three rounds with ninety seconds to draw; **Quick** — Two rounds and sixty seconds |
| 📞 **Draw Telephone** | 3–10 | Solo FFA | **Classic** — Three rounds of drawing and misinterpreting; **Quick** — Two rounds with less time |
| 🖍️ **Bad Artist** | 3–12 | Solo FFA | **Classic** — Three terrible masterpieces; **Quick** — Two quick disasters |
| 🐺 **Werewolf** | 5–12 | Social deduction | **Classic** — Night actions, a day of debate, and a vote; **Quick** — Faster nights and shorter debates |
| 🕶️ **Resistance** | 5–10 | Social deduction | **Classic** — Five missions, hidden spies, tense votes; **Quick** — Faster phases for a quicker coup |

### Card table structure

Card games share `src/server/games/cards.js` for seeded shuffles, deck construction, hands, drawing and face-down piles. The pure functions never mutate their inputs, and every module implements `publicFor` so other hands and hidden cards never reach the TV or another player. Shared UI lives in `src/components/cards/`: `Card`, `Hand`, `Pile`, `PlayedCards`, `OpponentSeat` and `CardTable`. Hands fan on desktop, scroll horizontally on mobile, and support tap or drag selection with a cap; all motion respects `prefers-reduced-motion`.

Liars Bar deals five cards per player from repeated 20-card table sets (6 Kings, 6 Queens, 6 Aces, 2 Jokers) because a single set cannot supply five cards to eight players. Cheat and Blackjack use a standard deck / three-deck shoe respectively. Fill the Blank uses the same `Card` and `Hand` components for answer cards. Higher/Lower's Deck mode draws from a real 52-card deck and hides the next card until the reveal.

### Content rules

Prompt banks live in `src/server/data/prompts/<bank>.json`, load on the server, and are never bundled into the client. Each item needs a stable unique id, text, and where applicable tags, `difficulty` 1–3 and `rating` (`all` by default, `spicy` for host-enabled packs). Content must be original: no copied commercial deck text, quiz text, lyrics or word lists. Factual banks only include stable, widely documented facts; avoid records or anything that changes over time. Survey Says rankings are editorial, not real survey data.

The shared selection engine (`src/server/games/selection.js`) prefers unseen items, respects difficulty/category filters, excludes `spicy` unless enabled, never repeats inside a pick, and falls back to least-recently-seen rows from `seen_items` (pruned after 180 days). `scripts/audit-banks.ts` reports bank sizes and gaps; `scripts/validate-banks.ts` checks structure, ids, text, duplicates, Connections puzzles and targets. Run `npm run test:server`, then the validator, after changing a bank.

### Future mode ideas

These are **not implemented**. They are candidates for future rounds, grouped by the kind of variety they add.

**Recently shipped from this list:** deterministic daily Blur Guess and Connections modes, seeded by the UTC date so every group gets the same challenge. Group pages now show daily completion and current/best streaks from finished daily rooms; replays remain open.

#### Cross-cutting formats

- **Solo practice with bots** — let one human test a game against simple server-side opponents, with separate practice stats.
- **Team variants for trivia and survey games** — Team Buzzer Trivia, Team Survey Says, Team Scattergories, and Team Fact or Fiction.
- **Tournament series** — link several sessions into a season with cumulative standings, seeding, and a playoff final.
- **Async or play-by-post mode** — take turns over hours instead of one live room, with notifications when it is your turn.
- **Rematch and persistent leaderboards** — keep the same room and teams, reset scores, and track all-time group records.
- **Custom content packs** — group-specific prompts, inside jokes, custom categories, and import/exportable packs with moderation.
- **Co-op campaigns** — multi-round shared objectives where the room wins or loses together instead of competing.
- **Spectator and streamer mode** — a TV-first view with hidden-information safety, delayed reveals, and a clean overlay.

#### Game-specific ideas

- **Guess the Impostor:** secret accomplice, multiple impostor teams, and custom clue packs.
- **5 Second Challenge:** team relay, category-only rounds, and a sudden-death tiebreak.
- **Codenames:** three-team boards, custom word packs, and a co-op puzzle variant.
- **Password:** co-op mode, sudden-death clues, and a one-clue expert round.
- **Blind Sketch:** team relay drawing, custom words, and an audience-guess mode.
- **Duel Bracket:** more mini-duels, best-of-three finals, and a losers' bracket.
- **Blur Guess:** category packs and user-supplied images with license checks.
- **Connections:** team race mode and user-created boards.
- **Survey Says:** room-created polls and a family-feud-style team board.
- **Buzzer Trivia:** team trivia, category drafting, and a final wager round.
- **Reaction Duel:** tournament ladders and a team relay version.
- **Story Chain:** illustrated chains, voice-note chains, and a judge-only reveal mode.
- **Liar's Dice:** team bidding, wild-face variants, and a sudden-death final table.

## Auth and Lobby Model

```
User     permanent   Supabase auth uid; account or anonymous guest
Group    permanent   owner/member roles, history
Lobby    ephemeral   room code, host, nullable group, players
Session  one run     game id, mode, results, belongs to a lobby
```

- Every player has a Supabase auth uid. Guests use `signInAnonymously` and are identified by `is_anonymous`; there is no custom guest token or separate guest player id.
- `profiles.id` is the auth uid. `groups.owner_id`, `group_members.user_id`, `lobbies.host_id`, `lobby_players.user_id`, `game_sessions.lobby_id` and realtime player ids all use the same uid.
- Guests may join an open lobby but cannot create groups, quick-play lobbies, or group lobbies. Joining by code creates a `lobby_players` row only; it never adds a `group_members` row.
- Any member may open or reopen a group lobby. Opening returns the existing open lobby if one exists. Quick play creates a lobby with `group_id NULL`.
- The creator is the lobby host. Only the host starts or kicks. A host who leaves or disconnects past 30 seconds transfers host to the longest-connected remaining player. An empty lobby closes and its code becomes reusable.
- A game session is created by `POST /api/lobbies/:id/start`; the realtime room then seats `lobby_players` and the host starts the engine automatically once everyone is connected.
- Supabase Auth owns guest policy in the dashboard. The app server enforces `ALLOW_GUESTS=false` by rejecting anonymous tokens on both HTTP and realtime SSE.

### Join flow

```
/join/CODE ─┬─ guest  -> Supabase anonymous session -> POST /lobbies/join -> /lobby/CODE -> /game/SESSION
            └─ account -> sign in/up -----------------> POST /lobbies/join -> /lobby/CODE -> /game/SESSION

/guest + code -> anonymous session -> POST /lobbies/join -> /lobby/CODE

/dashboard -> group -> POST /groups/:id/lobby (open-or-get) -> /lobby/CODE
/dashboard -> Quick play -> POST /lobbies -> /lobby/CODE
```

Guests can upgrade after a game with an email and password. Supabase `updateUser` keeps the same auth uid, so their lobby and session history stay attached.

## Start a Game

1. Sign in, then create a group from the dashboard or landing page. Opening its lobby creates a room code.
2. Press **Open Lobby** or **Play** on any group; any member can open or reopen the room.
3. Share the room code or invite link. Signed-in players can enter the code in **Join with a room code**; guests use `/guest` or the invite page.
4. Pick a game and mode. Each card shows the connected-player requirement.
5. Only the host can start. The lobby marks the room `in_game` and creates the session; connected clients move to the game screen.

**Guest entry:** a guest needs a display name and the room's 6-character code. Guests can join an open lobby but cannot create groups/lobbies or see group history. Set `ALLOW_GUESTS=false` to reject guest auth server-side.

## Setup

### 1. Database

- Create a Supabase project at [supabase.com](https://supabase.com)
- Run `supabase/schema.sql` in the SQL Editor
- Upgrading an existing project, run in order:
  1. `supabase/migrations/supabase-migration-phase3-games.sql`
  2. `supabase/migrations/supabase-migration-phase4-games.sql`
  3. `supabase/migrations/supabase-migration-tier1-games.sql`
  4. `supabase/migrations/supabase-migration-supabase-auth.sql`
  5. `supabase/migrations/supabase-migration-auth-rls.sql`
  6. `supabase/migrations/supabase-migration-auth-lobbies.sql`
  7. `supabase/migrations/supabase-migration-round2-games.sql`
  8. `supabase/migrations/supabase-migration-moderation-reports.sql`
  9. `supabase/migrations/supabase-migration-recap-progression-lore.sql`
- Enable the **Email** provider under Supabase → Authentication → Providers.
- Enable **Anonymous sign-ins** under Authentication → Providers when `ALLOW_GUESTS=true`. Disable it when `ALLOW_GUESTS=false`; app middleware rejects anonymous tokens either way, but the dashboard switch is the provider-level control.
- All app tables are server-only (RLS on, no anon policies). The browser anon key is used for Supabase Auth only; the Next route handlers use the service-role key.

### 2. Environment

```bash
cp .env.example .env.local
# Fill in your Supabase URL, anon key and service-role key
```

Optional content controls: `MAX_CONTENT_RATING` accepts `family`, `teen` or
`mature`; NSFW banks still require `ALLOW_NSFW_CONTENT=true`. `LORE_MODE=true`
allows an owner-approved group lore pack to reach lore-enabled games.

### 3. Run the app

```bash
npm install
npm run dev
```

This starts Next.js on http://localhost:3000. Realtime uses SSE plus POST
actions inside the same Next.js process. The app requires a persistent Node
process; it cannot run as a serverless function.

The player app is installable as a PWA. The lobby and TV screen show a QR code
that deep-links to `/join/CODE`; games request a screen wake lock while a round
is live and use short haptics on mobile actions.

Production:

```bash
npm run build
npm start
```

See `docs/DEPLOYMENT.md` for the systemd unit, nginx SSE proxy, health
checks, and rollback runbook. For the simplest managed host, `render.yaml`
deploys the app to Render as one always-on instance; see `docs/DEPLOY_RENDER.md`
for the setup steps and environment-variable checklist.

### 4. Tests

```bash
npm run test:server
npm run check:api
npm run test:api
```

`test:server` covers the engine, games, auth policy, and schema. `check:api`
checks a running server. `test:api` starts an isolated server, creates temporary
Supabase users, exercises the REST contract and auth rules, and runs a real
multi-client game over SSE. CI runs lint, `test:server`, and the production
build; `test:api` needs live Supabase credentials and is intended for local or
staging runs.

### 5. Seed Demo Data (Optional)

```bash
npm run seed
# Join code: CHASX2
```

## Design

Neon gaming UI with futuristic dark-mode and glassmorphism:

- Cosmic gradient backgrounds
- Glass-morphic cards with neon glows
- Framer Motion animations throughout
- Custom countdown ring, confetti, avatar bubbles
- Mobile-first responsive design

## Adding New Games

1. Add a module in `src/server/games/` that implements the engine contract: `id`, `name`, `minPlayers`, `maxPlayers`, `modes`, `init`, `onEvent`, `onPhaseEnd`, `onPlayerLeave`, `viewFor` and `publicFor`.
2. Register it in `src/server/games/index.js` and add its id to the `game_sessions.game_type` CHECK in a migration. The lobby catalogue is generated from the registry.
3. Add a screen in `src/components/game/` and route it by `room.gameId` in `src/app/game/[sessionId]/page.tsx`.
4. Put its prompt bank in `src/server/data/prompts/` and test both the mechanics and the bank size/id uniqueness.
