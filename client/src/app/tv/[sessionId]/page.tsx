"use client";

import TimerRing from "@/components/game/TimerRing";
import { useTvRoom } from "@/hooks/useTvRoom";
import { useParams } from "next/navigation";

type TvReveal = {
  topPlayerNames?: string[];
  tally?: { playerId: string; name: string; count: number }[];
  caught?: boolean;
  noConsensus?: boolean;
  impostorNames?: string[];
  accusedName?: string | null;
  prompt?: { text?: string } | string;
  clues?: { name: string; answer: string }[];
  success?: boolean;
  name?: string;
  answer?: string | null;
  nailed?: number;
  missed?: number;
  overPct?: number;
  underPct?: number;
  majority?: string | null;
  tie?: boolean;
  noVotes?: boolean;
  agreePct?: number;
  disagreePct?: number;
  roundWinners?: { name: string }[];
  realAnswer?: string;
  oddName?: string;
  oddPrompt?: string;
};

type TvGame = {
  phase?: string;
  round?: number;
  rounds?: number;
  prompt?: string;
  submitted?: number;
  total?: number;
  clues?: { id: string; answer: string }[];
  votesSubmitted?: number;
  totalVoters?: number;
  currentPlayerName?: string;
  answer?: string | null;
  question?: string;
  groups?: { id: string; answer: string; names: string[]; points: number }[];
  reveal?: TvReveal | null;
};

function promptText(game: TvGame | null, reveal: TvReveal | null) {
  if (game?.prompt) return game.prompt;
  if (typeof reveal?.prompt === "string") return reveal.prompt;
  if (reveal?.prompt?.text) return reveal.prompt.text;
  return "The prompt is a secret for now";
}

function PhaseLabel({ game }: { game: TvGame | null }) {
  const labels: Record<string, string> = {
    answer: "Answers are coming in",
    discussion: "Discuss the clues",
    vote: "Vote for the impostor",
    judge: "The group is judging",
    reveal: "Reveal",
  };
  return (
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">
      {labels[game?.phase || ""] || "In progress"}
    </p>
  );
}

export default function TvPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { room, status, error, closed } = useTvRoom(sessionId);

  if (!room) {
    return (
      <main className="party-surface flex min-h-screen items-center justify-center bg-cream px-6">
        <div className="party-card max-w-md p-10 text-center">
          <p className="text-5xl">{closed ? "🌙" : "📺"}</p>
          <p className="mt-4 font-display text-2xl font-semibold text-ink">
            {closed ? "This room has ended" : "Connecting the TV"}
          </p>
          <p className="mt-2 text-sm font-semibold text-ink-soft">
            {error?.message ||
              (status === "reconnecting"
                ? "Reconnecting…"
                : "Ask the host to keep the room open.")}
          </p>
        </div>
      </main>
    );
  }

  const gameMeta = room.catalog.find((game) => game.id === room.gameId);
  const game = room.game as TvGame | null;
  const reveal = game?.reveal || null;
  const results = room.phase === "results";
  const maxScore = Math.max(1, ...room.players.map((player) => player.score));

  return (
    <main className="party-surface min-h-screen bg-cream">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 sm:px-10 sm:py-10">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-ink-soft">
              GroupLore TV
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold text-ink sm:text-5xl">
              {gameMeta?.emoji} {gameMeta?.name || "Game room"}
            </h1>
            <p className="mt-1 text-sm font-bold text-ink-soft">
              {room.phase === "lobby"
                ? "Waiting in the lobby"
                : results
                  ? "Final scores"
                  : game?.round
                    ? `Round ${game.round} of ${game.rounds || "?"}`
                    : "In progress"}
            </p>
          </div>
          {room.phase === "playing" && room.endsAt ? (
            <TimerRing
              key={room.endsAt}
              endsAt={room.endsAt}
              serverNow={room.serverNow}
              size={76}
            />
          ) : null}
        </header>

        <div className="mt-8 grid flex-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className="space-y-5">
            {room.phase === "lobby" && (
              <div className="party-card bg-lavender/30 p-10 text-center">
                <p className="text-6xl">🎉</p>
                <p className="mt-4 font-display text-3xl font-semibold text-ink">
                  The room is filling up
                </p>
                <p className="mt-2 text-lg font-semibold text-ink-soft">
                  {room.players.length} player
                  {room.players.length === 1 ? "" : "s"} in the lobby
                </p>
              </div>
            )}

            {room.phase === "playing" && room.gameId === "most-likely-to" && (
              <>
                <div className="party-card p-8 text-center">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">
                    Most likely to…
                  </p>
                  <p className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">
                    {promptText(game, reveal)}
                  </p>
                  <p className="mt-3 text-sm font-bold text-ink-soft">
                    {reveal
                      ? `${reveal.tally?.[0]?.name || "Nobody"} is leading`
                      : `${game?.submitted || 0}/${game?.total || 0} votes in`}
                  </p>
                </div>
                {reveal?.tally && (
                  <div className="party-card space-y-3 p-6">
                    {reveal.tally.map((row) => (
                      <div key={row.playerId}>
                        <div className="mb-1 flex justify-between text-sm font-bold text-ink">
                          <span>{row.name}</span>
                          <span>{row.count}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-ink/5">
                          <div
                            className="h-full rounded-full bg-grape"
                            style={{
                              width: `${Math.round(
                                (row.count /
                                  Math.max(1, reveal.tally?.[0]?.count || 1)) *
                                  100,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {room.phase === "playing" && room.gameId === "guess-impostor" && (
              <>
                <div className="party-card p-8 text-center">
                  <PhaseLabel game={game} />
                  <p className="mt-3 font-display text-2xl font-semibold text-ink sm:text-3xl">
                    {game?.phase === "reveal"
                      ? reveal?.caught
                        ? "The impostor was caught"
                        : "The impostor got away"
                      : "Watch the clues. Find the fake."}
                  </p>
                  {game?.phase === "reveal" ? (
                    <p className="mt-3 text-lg font-bold text-ink-soft">
                      {reveal?.impostorNames?.join(" & ") || "Unknown"}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm font-bold text-ink-soft">
                      {game?.phase === "vote"
                        ? `${game.votesSubmitted || 0}/${game.totalVoters || 0} votes in`
                        : `${game?.submitted || 0}/${game?.total || 0} clues in`}
                    </p>
                  )}
                </div>

                {game?.clues && game.clues.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {game.clues.map((clue, index) => (
                      <div
                        key={clue.id}
                        className="rounded-3xl bg-white p-5 shadow-soft"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-soft">
                          Clue {index + 1}
                        </p>
                        <p className="mt-1 font-display text-xl font-semibold text-ink">
                          {clue.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {game?.phase === "reveal" && reveal?.clues && (
                  <div className="party-card p-6">
                    <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                      The secret prompt
                    </p>
                    <p className="mt-1 font-display text-xl font-semibold text-ink">
                      {promptText(game, reveal)}
                    </p>
                  </div>
                )}
              </>
            )}

            {room.phase === "playing" && room.gameId === "five-second" && (
              <div className="party-card p-8 text-center">
                <PhaseLabel game={game} />
                <p className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">
                  {game?.prompt || "Quick!"}
                </p>
                <p className="mt-3 text-lg font-bold text-coral">
                  {game?.currentPlayerName || "A player"} is on the clock
                </p>
                {(game?.phase === "judge" || game?.phase === "reveal") && (
                  <p className="mt-4 rounded-2xl bg-lavender/25 px-5 py-4 font-display text-2xl font-semibold text-ink">
                    {game?.answer || reveal?.answer || "No answer"}
                  </p>
                )}
                {game?.phase === "reveal" && reveal && (
                  <p className="mt-3 text-sm font-bold text-ink-soft">
                    {reveal.success ? "Nailed it — +1" : "Not this time"} ·{" "}
                    {reveal.nailed || 0} nailed / {reveal.missed || 0} missed
                  </p>
                )}
              </div>
            )}

            {room.phase === "playing" &&
              room.gameId === "overrated-underrated" && (
                <>
                  <div className="party-card p-8 text-center">
                    <PhaseLabel game={game} />
                    <p className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">
                      {promptText(game, reveal)}
                    </p>
                    <p className="mt-3 text-sm font-bold text-ink-soft">
                      {reveal
                        ? reveal.tie
                          ? "Split decision"
                          : `${reveal.majority} wins`
                        : `${game?.submitted || 0}/${game?.total || 0} votes in`}
                    </p>
                  </div>
                  {reveal?.overPct !== undefined && (
                    <div className="party-card p-6">
                      <div className="flex justify-between text-sm font-bold text-ink">
                        <span>Overrated {reveal.overPct}%</span>
                        <span>Underrated {reveal.underPct}%</span>
                      </div>
                      <div className="mt-2 flex h-4 overflow-hidden rounded-full bg-ink/5">
                        <div
                          className="h-full bg-coral"
                          style={{ width: `${reveal.overPct}%` }}
                        />
                        <div className="h-full flex-1 bg-sky" />
                      </div>
                      {reveal.roundWinners && reveal.roundWinners.length > 0 && (
                        <p className="mt-3 text-sm font-bold text-ink-soft">
                          Points: {reveal.roundWinners.map((row) => row.name).join(", ")}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

            {room.phase === "playing" &&
              ["hive-mind", "odd-one-out", "bluff", "hot-takes"].includes(
                room.gameId || "",
              ) && (
                <div className="party-card p-8 text-center">
                  <PhaseLabel game={game} />
                  <p className="mt-3 font-display text-2xl font-semibold text-ink sm:text-3xl">
                    {game?.prompt ||
                      game?.question ||
                      "The game is in progress"}
                  </p>
                  <p className="mt-3 text-sm font-bold text-ink-soft">
                    {reveal?.realAnswer
                      ? `Real answer: ${reveal.realAnswer}`
                      : reveal?.oddName
                        ? `The odd one was ${reveal.oddName}`
                        : `${game?.submitted || 0}/${game?.total || 0} in`}
                  </p>
                  {game?.groups && game.groups.length > 0 && (
                    <div className="mx-auto mt-4 grid max-w-xl gap-2 text-left">
                      {game.groups.slice(0, 4).map((group) => (
                        <div
                          key={group.id}
                          className="flex items-center justify-between rounded-2xl bg-cream px-4 py-2"
                        >
                          <span className="font-display text-base font-semibold text-ink">
                            {group.answer}
                          </span>
                          <span className="text-xs font-bold text-ink-soft">
                            {group.points > 0 ? `+${group.points}` : "alone"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {reveal?.agreePct !== undefined && (
                    <div className="mx-auto mt-4 max-w-md">
                      <div className="flex justify-between text-sm font-bold text-ink">
                        <span>Agree {reveal.agreePct}%</span>
                        <span>Disagree {reveal.disagreePct}%</span>
                      </div>
                      <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-ink/5">
                        <div
                          className="h-full bg-mint"
                          style={{ width: `${reveal.agreePct}%` }}
                        />
                        <div className="h-full flex-1 bg-coral" />
                      </div>
                    </div>
                  )}
                </div>
              )}

            {results && room.result && (
              <div className="party-card bg-honey/30 p-10 text-center">
                <p className="text-6xl">🏆</p>
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">
                  Winner
                </p>
                <p className="mt-1 font-display text-4xl font-semibold text-ink">
                  {room.result.ranking
                    .filter((entry) => entry.isWinner)
                    .map((entry) => entry.name)
                    .join(" & ") || "Nobody scored"}
                </p>
              </div>
            )}
          </section>

          <aside className="space-y-3">
            <div className="party-card p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                Players
              </p>
              <div className="mt-3 space-y-2">
                {room.players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-cream px-3 py-2"
                  >
                    <span className="truncate font-display text-base font-semibold text-ink">
                      {player.name}
                      {player.isHost ? " 👑" : ""}
                    </span>
                    <span className="font-display text-lg font-semibold text-grape">
                      {player.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {room.result && (
              <div className="party-card p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                  Scoreboard
                </p>
                <div className="mt-3 space-y-3">
                  {room.result.ranking.map((entry) => (
                    <div key={entry.playerId}>
                      <div className="flex justify-between text-sm font-bold text-ink">
                        <span>{entry.name}</span>
                        <span>{entry.score}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/5">
                        <div
                          className="h-full rounded-full bg-mint"
                          style={{
                            width: `${Math.round((entry.score / maxScore) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

        <footer className="mt-8 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-ink-soft">
          <span>Read-only room display</span>
          <span>{room.players.length} in the room</span>
        </footer>
      </div>
    </main>
  );
}
