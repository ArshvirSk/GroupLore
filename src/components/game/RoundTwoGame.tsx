"use client";

import AnswerInput from "@/components/game/AnswerInput";
import PromptCard from "@/components/game/PromptCard";
import { Badge, Button, Card, Chip, Input } from "@/components/ui";
import type { RoomView } from "@/stores/roomStore";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useState } from "react";

type Obj = Record<string, unknown>;
type Sender = (type: string, data?: Record<string, unknown>) => void;

const asObj = (value: unknown): Obj =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : {};
const asList = (value: unknown): Obj[] =>
  Array.isArray(value) ? value.map(asObj) : [];
const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String) : [];
const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const num = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <Card className={`p-5 ${className}`}>{children}</Card>;
}

function Status({ view }: { view: Obj }) {
  const submitted = num(view.submitted);
  const total = num(view.total);
  const round = num(view.round);
  const rounds = num(view.rounds);
  if (!total && !rounds) return null;
  return (
    <div className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
      <span>{rounds ? `Round ${round} of ${rounds}` : round ? `Round ${round}` : "In play"}</span>
      {total ? <span>{submitted}/{total} ready</span> : null}
    </div>
  );
}

function RevealPoints({ view }: { view: Obj }) {
  const reveal = asObj(view.reveal);
  const points = asList(reveal.roundPoints);
  if (!points.length) return null;
  return (
    <Panel>
      <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Points this round</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {points.map((entry) => (
          <span key={text(entry.playerId)} className="rounded-full bg-mint/60 px-3 py-1 text-sm font-bold text-[#0F7F6C]">
            {text(entry.name)} +{num(entry.points)}
          </span>
        ))}
      </div>
    </Panel>
  );
}

function FillTheBlank({ view, send }: { view: Obj; send: Sender }) {
  const [selected, setSelected] = useState<string[]>([]);
  const phase = text(view.phase);
  const hand = asList(view.hand);
  const options = asList(view.options);
  const reveal = asObj(view.reveal);
  const toggle = (id: string) => {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= num(view.blanks, 1)) return [current[1], id].filter(Boolean);
      return [...current, id];
    });
  };
  return (
    <div className="space-y-4">
      <PromptCard kicker={view.isJudge ? "You are judging" : "Fill the blank"} icon="puzzle">
        {text(view.prompt)}
      </PromptCard>
      <Status view={view} />
      {phase === "play" ? (
        view.isJudge ? (
          <Panel><p className="text-sm font-semibold text-muted">Wait for the other players to play their cards.</p></Panel>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {hand.map((card) => {
                const active = selected.includes(text(card.id));
                return (
                  <button key={text(card.id)} type="button" disabled={Boolean(view.youPlayed)} onClick={() => toggle(text(card.id))}
                    className={`rounded-2xl border-2 px-4 py-3 text-left text-sm font-semibold shadow-soft transition ${active ? "border-grape bg-lavender/40" : "border-transparent bg-white enabled:hover:border-lavender"}`}>
                    {text(card.text)}
                  </button>
                );
              })}
            </div>
            <Button disabled={selected.length !== num(view.blanks, 1) || Boolean(view.youPlayed)} onClick={() => { send("play", { cardIds: selected }); setSelected([]); }}>
              {view.youPlayed ? "Cards submitted" : `Play ${num(view.blanks, 1)} card${num(view.blanks, 1) === 1 ? "" : "s"}`}
            </Button>
          </>
        )
      ) : null}
      {phase === "judge" ? (
        view.isJudge ? (
          <div className="grid gap-2">
            {options.map((option) => (
              <button key={text(option.id)} type="button" onClick={() => send("pick", { entryId: text(option.id) })}
                className="rounded-2xl border-2 border-transparent bg-white px-4 py-3 text-left shadow-soft transition hover:border-grape">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-muted">Anonymous entry</span>
                <span className="mt-1 block font-display text-lg font-semibold text-ink">{asStrings(option.cards).join(" / ")}</span>
              </button>
            ))}
          </div>
        ) : <Panel><p className="text-sm font-semibold text-muted">The judge is choosing the best card.</p></Panel>
      ) : null}
      {phase === "reveal" ? (
        <Panel>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Winning card</p>
          <p className="mt-1 font-display text-lg font-semibold text-ink">{asStrings(asObj(reveal.winner).cards).join(" / ") || "No card"}</p>
          <p className="mt-1 text-sm font-semibold text-muted">{text(asObj(reveal.winner).name)} wins the round.</p>
        </Panel>
      ) : null}
      <RevealPoints view={view} />
    </div>
  );
}

function Connections({ view, send }: { view: Obj; send: Sender }) {
  const [picked, setPicked] = useState<string[]>([]);
  const board = asStrings(view.board);
  const solved = asList(view.solvedGroups);
  const reveal = asObj(view.reveal);
  const toggle = (word: string) => setPicked((current) => current.includes(word) ? current.filter((item) => item !== word) : current.length >= 4 ? current : [...current, word]);
  return (
    <div className="space-y-4">
      <PromptCard kicker="Find four groups of four" icon="grid" compact>
        Pick four words that belong together. {text(view.mode) === "co-op" ? "The whole room shares this board." : "Your board is yours alone."}
      </PromptCard>
      <Status view={{ submitted: num(view.solved), total: 4 }} />
      <div className="grid grid-cols-4 gap-2">
        {board.map((word) => {
          const selected = picked.includes(word);
          const solvedGroup = solved.find((group) => asStrings(group.words).includes(word));
          return (
            <button key={word} type="button" disabled={Boolean(solvedGroup) || text(view.phase) !== "solve"}
              onClick={() => toggle(word)}
              className={`min-h-14 rounded-xl border-2 px-2 text-xs font-bold transition ${solvedGroup ? "border-mint bg-mint/40 text-ink" : selected ? "border-grape bg-lavender/50 text-ink" : "border-transparent bg-white text-ink hover:border-lavender"}`}>
              {word}
            </button>
          );
        })}
      </div>
      {text(view.phase) === "solve" ? (
        <>
          <div className="flex items-center justify-between px-1 text-xs font-bold text-muted">
            <span>{num(view.mistakes)} mistake{num(view.mistakes) === 1 ? "" : "s"}{view.maxMistakes ? ` / ${num(view.maxMistakes)}` : ""}</span>
            {asObj(view.last).oneAway ? <span className="text-[#B83232]">One away…</span> : null}
          </div>
          <Button disabled={picked.length !== 4} onClick={() => { send("submitGroup", { words: picked }); setPicked([]); }}>Submit group</Button>
        </>
      ) : null}
      {solved.length ? <div className="flex flex-wrap gap-2">{solved.map((group) => <Badge key={text(group.category)} tone="success">{text(group.category)}</Badge>)}</div> : null}
      {text(view.phase) === "reveal" ? (
        <div className="space-y-2">
          {asList(reveal.groups).map((group) => (
            <Panel key={text(group.category)}>
              <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">{text(group.category)}</p>
              <p className="mt-1 text-sm font-semibold text-ink">{asStrings(group.words).join(", ")}</p>
            </Panel>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SurveySays({ view, send }: { view: Obj; send: Sender }) {
  const [guesses, setGuesses] = useState(["", "", ""]);
  const reveal = asObj(view.reveal);
  if (text(view.phase) === "reveal") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Survey says" icon="chart" compact>{text(asObj(reveal.question).text) || text(view.question)}</PromptCard>
        <div className="space-y-2">
          {asList(reveal.answers).map((answer) => (
            <Panel key={text(answer.text)}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-lg font-semibold text-ink">{text(answer.text)}</span>
                <span className="rounded-full bg-honey/60 px-3 py-1 text-sm font-bold">{num(answer.points)}</span>
              </div>
              <p className="mt-1 text-xs font-semibold text-muted">{asStrings(answer.matchedBy).length ? "Matched by the room" : "Nobody found it"}</p>
            </Panel>
          ))}
        </div>
        <RevealPoints view={view} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <PromptCard kicker="Name the answers" icon="chart">{text(view.question)}</PromptCard>
      <Status view={view} />
      <Panel>
        <div className="space-y-2">
          {guesses.map((value, index) => (
            <Input key={index} label={`Guess ${index + 1}`} value={value} maxLength={40} onChange={(event) => setGuesses((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder="Type an answer" />
          ))}
        </div>
        <Button className="mt-3" onClick={() => send("guess", { values: guesses.filter(Boolean) })}>Lock guesses</Button>
      </Panel>
    </div>
  );
}

function Scattergories({ view, send }: { view: Obj; send: Sender }) {
  const categories = asStrings(view.categories);
  const [values, setValues] = useState<Record<string, string>>({});
  const reveal = asObj(view.reveal);
  if (text(view.phase) !== "answer") {
    return (
      <div className="space-y-4">
        <PromptCard kicker={`Letter ${text(view.letter)}`} icon="folder" compact>Unique valid answers score 100. Answers shared with another player score zero.</PromptCard>
        <div className="space-y-3">
          {asList(reveal.rows).map((row) => (
            <Panel key={text(row.category)}>
              <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">{text(row.category)}</p>
              <div className="mt-2 space-y-1">
                {asList(row.answers).map((answer) => (
                  <div key={text(answer.playerId)} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold text-ink">{text(answer.text) || "—"}</span>
                    <span className={`font-bold ${num(answer.points) ? "text-success" : "text-muted"}`}>{num(answer.points) ? `+${num(answer.points)}` : text(answer.shared) === "true" ? "shared" : "0"}</span>
                  </div>
                ))}
              </div>
            </Panel>
          ))}
        </div>
        <RevealPoints view={view} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <PromptCard kicker={`Start with ${text(view.letter)}`} icon="folder" compact>Fill as many as you can before the timer.</PromptCard>
      <Status view={view} />
      <div className="grid gap-3 sm:grid-cols-2">
        {categories.map((category) => (
          <Input key={category} label={category} value={values[category] || ""} maxLength={60} onChange={(event) => setValues((current) => ({ ...current, [category]: event.target.value }))} placeholder={`${text(view.letter)}…`} />
        ))}
      </div>
      <Button onClick={() => send("answer", { values: Object.fromEntries(categories.map((category, index) => [index, values[category] || ""])) })}>Submit answers</Button>
    </div>
  );
}

function PatternMemory({ view, send }: { view: Obj; send: Sender }) {
  const show = text(view.phase) === "show";
  const sequence = asStrings(view.showSequence).map(Number);
  const [step, setStep] = useState(0);
  const tap = (tile: number) => {
    send("tap", { tile });
    setStep((current) => current + 1);
  };
  return (
    <div className="space-y-4">
      <PromptCard kicker={show ? "Watch closely" : "Replay the pattern"} icon="brain" compact>
        {show ? sequence.map((tile) => tile + 1).join(" → ") : `${num(view.sequenceLength)} tiles · ${num(view.alive)} alive`}
      </PromptCard>
      <div className="mx-auto grid max-w-sm grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, tile) => (
          <button key={tile} type="button" disabled={show || !view.isAlive || text(view.phase) !== "input"} onClick={() => tap(tile)}
            className={`aspect-square rounded-2xl border-2 text-xl font-bold transition ${show && sequence.includes(tile) ? "border-honey bg-honey/60" : "border-transparent bg-white text-ink shadow-soft enabled:hover:border-grape"}`}>
            {tile + 1}
          </button>
        ))}
      </div>
      <p className="text-center text-xs font-bold text-muted">Your replay: {step} / {num(view.sequenceLength)}</p>
    </div>
  );
}

function ReactionDuel({ view, send }: { view: Obj; send: Sender }) {
  const phase = text(view.phase);
  const reveal = asObj(view.reveal);
  return (
    <div className="space-y-4">
      <PromptCard kicker={phase === "wait" ? "Wait for green" : phase === "go" ? "GO!" : "Round result"} icon="zap">
        {phase === "wait" ? "Do not tap yet. The server controls the start." : phase === "go" ? "Tap now!" : `Round ${num(view.round)}`}
      </PromptCard>
      {phase === "wait" || phase === "go" ? (
        <Button className="w-full" disabled={Boolean(view.tapped) || Boolean(view.isLocked)} onClick={() => send("tap")}>
          {view.isLocked ? "Locked out" : view.tapped ? "Tapped" : "Tap"}
        </Button>
      ) : null}
      {phase === "result" ? (
        <div className="space-y-2">
          {asList(reveal.entries).map((entry) => (
            <Panel key={text(entry.playerId)}>
              <div className="flex items-center justify-between"><span className="font-semibold">{text(entry.name)}</span><span className="font-bold">{num(entry.reactionMs)}ms · +{num(entry.points)}</span></div>
            </Panel>
          ))}
          {asList(reveal.locked).length ? <p className="text-center text-sm font-bold text-[#B83232]">Early taps: {asList(reveal.locked).map((entry) => text(entry.name)).join(", ")}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function StoryChain({ view, send }: { view: Obj; send: Sender }) {
  const [value, setValue] = useState("");
  const phase = text(view.phase);
  const stories = asList(view.stories);
  if (phase === "vote") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Vote for the best story and line" icon="book" compact>Choose a story, then a line. You cannot vote for your own line.</PromptCard>
        {stories.map((story) => (
          <Panel key={text(story.id)}>
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-lg font-semibold text-ink">{text(story.starter)}</p>
              <Button size="sm" variant="secondary" onClick={() => send("vote", { chainId: text(story.id) })}>Best story</Button>
            </div>
            <div className="mt-2 space-y-1">
              {asList(story.lines).map((line) => (
                <div key={text(line.id)} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2/50 px-3 py-2 text-sm">
                  <span className="font-semibold text-ink">{text(line.text)} <span className="text-xs text-muted">— {text(line.author)}</span></span>
                  <button type="button" disabled={Boolean(line.isMine)} onClick={() => send("vote", { chainId: text(story.id), lineId: text(line.id) })} className="min-h-8 rounded-full px-2 text-[10px] font-bold uppercase text-muted hover:text-ink disabled:opacity-40">Best line</button>
                </div>
              ))}
            </div>
          </Panel>
        ))}
        {view.myVote ? <p className="text-center text-sm font-bold text-muted">Vote locked.</p> : null}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <PromptCard kicker={phase === "start" ? "Start the story" : "Add one sentence"} icon="book">
        {phase === "start" ? text(view.starter) : text(view.lastSentence) || "The story starts here."}
      </PromptCard>
      <Status view={view} />
      <Panel>
        <textarea value={value} maxLength={140} onChange={(event) => setValue(event.target.value)} placeholder="One sentence…" className="min-h-28 w-full rounded-2xl border-2 border-transparent bg-white px-4 py-3 text-base font-semibold text-ink shadow-soft outline-none focus:border-grape" />
        <Button className="mt-3" disabled={!value.trim() || Boolean(view.mySubmitted)} onClick={() => { send(phase === "start" ? "start" : "sentence", { value }); setValue(""); }}>
          {phase === "start" ? "Start chain" : "Send sentence"}
        </Button>
      </Panel>
    </div>
  );
}

function Password({ view, send }: { view: Obj; send: Sender }) {
  const result = asObj(view.result);
  return (
    <div className="space-y-4">
      <PromptCard kicker={`${text(view.currentTeamName)} clue`} icon="key">
        {view.isClueGiver ? text(view.word) : "One-word clues only. Guess it if you can."}
      </PromptCard>
      <Status view={view} />
      {asStrings(view.clues).length ? <div className="flex flex-wrap gap-2">{asStrings(view.clues).map((item, index) => <Chip key={`${item}-${index}`} active>{item}</Chip>)}</div> : null}
      {text(view.phase) === "turn" && view.isCurrentTeam ? (
        view.isClueGiver ? (
          <Panel>
            <AnswerInput key="clue" maxLength={24} placeholder="One-word clue…" submitLabel="Give clue" onSubmit={(value) => send("clue", { value })} />
          </Panel>
        ) : (
          <Panel>
            <AnswerInput key="guess" maxLength={40} placeholder="Your guess…" submitLabel="Guess" disabled={Boolean(view.myGuess)} onSubmit={(value) => send("guess", { value })} />
          </Panel>
        )
      ) : null}
      {text(view.phase) === "result" ? (
        <Panel>
          <p className="font-display text-lg font-semibold text-ink">{result.correct ? "Correct!" : "Word lost"} — {text(result.word)}</p>
          {asList(result.roundPoints).length ? <p className="mt-1 text-sm font-semibold text-muted">{asList(result.roundPoints).map((entry) => `${text(entry.name)} +${num(entry.points)}`).join(" · ")}</p> : null}
        </Panel>
      ) : null}
    </div>
  );
}

function BoggleRush({ view, send }: { view: Obj; send: Sender }) {
  const grid = asObj(view.grid);
  const letters = asStrings(grid.letters);
  const size = num(grid.size, 4);
  const [path, setPath] = useState<number[]>([]);
  const [word, setWord] = useState("");
  const add = (index: number) => {
    if (path.includes(index)) return;
    setPath((current) => [...current, index]);
    setWord((current) => current + letters[index].toLowerCase());
  };
  const clear = () => { setPath([]); setWord(""); };
  const reveal = asObj(view.reveal);
  if (text(view.phase) === "compare") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Round results" icon="grid" compact>Shared words score zero. Unique words score by length.</PromptCard>
        {asList(reveal.rows).map((row) => (
          <Panel key={text(row.playerId)}>
            <div className="flex items-center justify-between"><p className="font-display font-semibold">{text(row.name)}</p><Badge tone="accent">+{num(row.points)}</Badge></div>
            <p className="mt-2 text-sm font-semibold text-ink">{asList(row.words).map((entry) => `${text(entry.word)}${entry.shared ? " (shared)" : ""}`).join(", ") || "No words"}</p>
          </Panel>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <PromptCard kicker={`Find words · ${Math.round(num(view.playMs) / 1000)}s`} icon="grid" compact>Tap adjacent tiles. No tile twice in one word.</PromptCard>
      <div className="mx-auto grid gap-2" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, maxWidth: size * 64 }}>
        {letters.map((letter, index) => (
          <button key={index} type="button" onClick={() => add(index)} disabled={path.includes(index)}
            className={`aspect-square rounded-xl border-2 text-lg font-bold ${path.includes(index) ? "border-grape bg-lavender/50" : "border-transparent bg-white text-ink shadow-soft"}`}>{letter}</button>
        ))}
      </div>
      <Panel>
        <p className="font-display text-xl font-semibold uppercase tracking-wide text-ink">{word || "…"}</p>
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="secondary" onClick={clear}>Clear</Button>
          <Button size="sm" disabled={word.length < 3} onClick={() => { send("word", { word, path }); clear(); }}>Submit word</Button>
        </div>
        <p className="mt-3 text-xs font-semibold text-muted">Your words: {asList(view.myWords).map((entry) => text(entry.word)).join(", ") || "none yet"}</p>
      </Panel>
    </div>
  );
}

function BuzzerTrivia({ view, send }: { view: Obj; send: Sender }) {
  const reveal = asObj(view.reveal);
  const phase = text(view.phase);
  return (
    <div className="space-y-4">
      <PromptCard kicker={text(view.category) || "Buzzer trivia"} icon="bell">{text(view.question)}</PromptCard>
      {phase === "answer" ? <p className="text-center text-sm font-bold text-muted">{text(view.buzzerName)} buzzed. Answer now.</p> : null}
      {phase === "read" ? <Button className="w-full" disabled={Boolean(view.lockedOut)} onClick={() => send("buzz")}>{view.lockedOut ? "Locked out" : "Buzz"}</Button> : null}
      {phase === "answer" && view.isBuzzer ? (
        <Panel>
          <AnswerInput maxLength={80} placeholder="Your answer…" submitLabel="Answer" onSubmit={(value) => send("answer", { value })} />
        </Panel>
      ) : null}
      {phase === "result" ? (
        <Panel>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Answer</p>
          <p className="mt-1 font-display text-xl font-semibold text-ink">{text(reveal.answer)}</p>
          <p className="mt-1 text-sm font-semibold text-muted">{text(reveal.reason)}</p>
        </Panel>
      ) : null}
    </div>
  );
}

function LiarsDice({ view, send }: { view: Obj; send: Sender }) {
  const [quantity, setQuantity] = useState("1");
  const [face, setFace] = useState("2");
  const reveal = asObj(view.reveal);
  return (
    <div className="space-y-4">
      <PromptCard kicker="Your dice" icon="dice" compact>{asStrings(view.myDice).map((die) => `⚀⚁⚂⚃⚄⚅`[Number(die) - 1] || die).join(" ")}</PromptCard>
      <div className="flex flex-wrap gap-2">
        {Object.entries(asObj(view.diceCounts)).map(([playerId, count]) => <Chip key={playerId}>{roomName(playerId, view)}: {String(count)} dice</Chip>)}
      </div>
      {view.currentBid ? <Panel><p className="text-xs font-bold uppercase tracking-wide text-muted">Current bid</p><p className="font-display text-2xl font-semibold text-ink">{num(asObj(view.currentBid).quantity)} × {num(asObj(view.currentBid).face)}s</p></Panel> : null}
      {text(view.phase) === "bid" ? (
        <Panel>
          <p className="text-sm font-semibold text-muted">{view.canAct ? "Your turn: raise the bid or call." : `Waiting for ${text(view.currentPlayerName)}.`}</p>
          {view.canAct ? (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Input label="Quantity" type="number" min={1} max={30} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                <Input label="Face" type="number" min={1} max={6} value={face} onChange={(event) => setFace(event.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => send("bid", { quantity: Number(quantity), face: Number(face) })}>Raise bid</Button>
                <Button variant="danger" onClick={() => send("call")}>Call liar</Button>
              </div>
            </div>
          ) : null}
        </Panel>
      ) : null}
      {text(view.phase) === "reveal" ? (
        <Panel>
          <p className="font-display text-xl font-semibold text-ink">{text(reveal.bidMade) === "true" ? "Bid was true" : "Bid was a lie"}</p>
          <p className="mt-1 text-sm font-semibold text-muted">{text(reveal.loserName)} loses a die. {num(reveal.matches)} matching dice.</p>
          <div className="mt-2 flex flex-wrap gap-1">{asList(reveal.dice).map((entry) => <Badge key={text(entry.playerId)}>{text(entry.name)}: {asStrings(entry.dice).join(" ")}</Badge>)}</div>
        </Panel>
      ) : null}
    </div>
  );
}

function roomName(playerId: string, view: Obj) {
  const entry = asList(view.teams).find((team) => asStrings(team.playerIds).includes(playerId));
  return entry ? text(entry.name) : playerId.slice(0, 6);
}

function BlurGuess({ view, send }: { view: Obj; send: Sender }) {
  const result = asObj(view.result);
  return (
    <div className="space-y-4">
      <PromptCard kicker={`Blur stage ${num(view.stage)} / ${num(view.stageTotal)}`} icon="image" compact>
        <Image src={text(result.sharp) || text(view.stageImage)} alt="Blurred mystery subject" width={400} height={300} unoptimized className="mx-auto max-h-64 w-auto rounded-xl" />
      </PromptCard>
      {text(view.phase) === "stage" ? (
        <Panel>
          <AnswerInput maxLength={60} placeholder="What is it?" submitLabel="Guess" disabled={Boolean(view.guessed)} onSubmit={(value) => send("guess", { value })} />
          <p className="mt-2 text-xs font-semibold text-muted">Earlier guesses score more. A wrong guess costs 25.</p>
        </Panel>
      ) : (
        <Panel><p className="text-xs font-bold uppercase tracking-wide text-muted">The answer</p><p className="font-display text-2xl font-semibold text-ink">{text(result.answer)}</p></Panel>
      )}
    </div>
  );
}

function Codenames({ view, send }: { view: Obj; send: Sender }) {
  const [clue, setClue] = useState("");
  const [number, setNumber] = useState("1");
  const board = asList(view.board);
  const reveal = asObj(view.reveal);
  return (
    <div className="space-y-4">
      <PromptCard kicker={view.isSpymaster ? "Spymaster view" : "Operative view"} icon="search" compact>
        {text(asObj(view.clue).word) ? `Clue: ${text(asObj(view.clue).word)} × ${num(asObj(view.clue).number)}` : "Waiting for a clue."}
      </PromptCard>
      <div className="flex flex-wrap gap-2 text-xs font-bold text-muted">
        <Badge>Your team: {text(view.yourTeamId) || "—"}</Badge>
        <Badge>Turn: {text(view.turnTeamId)}</Badge>
        <Badge>Guesses left: {num(view.guessesLeft)}</Badge>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {board.map((card) => {
          const key = text(card.key || card.color);
          return (
            <button key={text(card.index)} type="button" disabled={!view.canGuess || Boolean(card.revealed)} onClick={() => send("guess", { index: num(card.index) })}
              className={`min-h-14 rounded-lg border px-1 text-[10px] font-bold uppercase leading-tight ${key === "assassin" ? "border-ink bg-ink text-white" : key ? "border-ink/20 bg-lavender/60 text-ink" : "border-border bg-white text-ink"}`}>
              {text(card.word)}
              {card.key ? <span className="mt-1 block text-[8px] opacity-70">{key}</span> : null}
            </button>
          );
        })}
      </div>
      {view.canClue ? (
        <Panel>
          <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
            <Input label="One-word clue" value={clue} maxLength={30} onChange={(event) => setClue(event.target.value)} />
            <Input label="Number" type="number" min={1} max={9} value={number} onChange={(event) => setNumber(event.target.value)} />
          </div>
          <Button className="mt-3" onClick={() => send("clue", { word: clue, number: Number(number) })}>Give clue</Button>
        </Panel>
      ) : null}
      {text(view.phase) === "result" ? (
        <Panel><p className="font-display text-xl font-semibold">{text(reveal.winnerTeamId)} wins — {text(reveal.reason)}</p></Panel>
      ) : null}
    </div>
  );
}

function BlindSketch({ view, send }: { view: Obj; send: Sender }) {
  const strokes = asList(view.strokes);
  const [current, setCurrent] = useState<Obj | null>(null);
  const [custom, setCustom] = useState("");
  const reveal = asObj(view.reveal);
  const isDrawer = Boolean(view.isDrawer);
  const visible = isDrawer ? [] : [...strokes, ...(current ? [current] : [])];
  const point = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };
  if (text(view.phase) === "word") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Word team" icon="eye">{view.isWordTeam ? "Pick a word for the other team to draw blind." : "The other team is picking a word."}</PromptCard>
        {view.isWordTeam ? (
          <div className="grid gap-2">
            {asList(view.choices).map((choice) => <Button key={text(choice.id)} variant="secondary" onClick={() => send("chooseWord", { wordId: text(choice.id) })}>{text(choice.text)}</Button>)}
            {text(view.mode) === "custom" ? <Input label="Or write a custom word" value={custom} onChange={(event) => setCustom(event.target.value)} /> : null}
            {text(view.mode) === "custom" ? <Button onClick={() => send("chooseWord", { value: custom })}>Use custom word</Button> : null}
          </div>
        ) : <Panel><p className="text-sm font-semibold text-muted">Get ready to guess the strokes.</p></Panel>}
      </div>
    );
  }
  if (text(view.phase) === "pick-drawer") {
    return (
      <Panel>
        <p className="font-display text-lg font-semibold text-ink">Who is drawing?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {asStrings(view.drawerCandidates).map((playerId) => <Button key={playerId} size="sm" onClick={() => send("pickDrawer", { playerId })}>{playerId}</Button>)}
        </div>
      </Panel>
    );
  }
  return (
    <div className="space-y-4">
      <PromptCard kicker={isDrawer ? "You can see the word. Nobody else can." : "Guess the blind sketch"} icon="image" compact>
        {isDrawer ? text(view.word) : "Watch the strokes and guess the word."}
      </PromptCard>
      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        <svg viewBox="0 0 100 75" className="h-64 w-full touch-none" onPointerDown={(event) => {
          if (!isDrawer) return;
          const p = point(event);
          event.currentTarget.setPointerCapture(event.pointerId);
          setCurrent({ color: "#23182f", width: 2, points: [p] });
        }} onPointerMove={(event) => {
          if (!isDrawer || !current) return;
          const p = point(event);
          setCurrent({ ...current, points: [...asList(current.points).map(asObj), p] });
        }} onPointerUp={() => {
          if (!isDrawer || !current) return;
          send("stroke", { stroke: { ...current, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` } });
          setCurrent(null);
        }}>
          {visible.map((stroke, index) => <polyline key={index} points={asList(stroke.points).map(asObj).map((p) => `${num(p.x) * 100},${num(p.y) * 75}`).join(" ")} fill="none" stroke={text(stroke.color) || "#23182f"} strokeWidth={num(stroke.width, 2)} strokeLinecap="round" strokeLinejoin="round" />)}
        </svg>
      </div>
      {isDrawer ? <p className="text-center text-sm font-bold text-muted">Your strokes are hidden from your own screen.</p> : (
        <Panel>
          <AnswerInput maxLength={60} placeholder="Your guess…" submitLabel="Guess" disabled={!view.isDrawingTeam || asStrings(view.correctNames).length >= 2} onSubmit={(value) => send("guess", { value })} />
        </Panel>
      )}
      {text(view.phase) === "reveal" ? <Panel><p className="font-display text-xl font-semibold">Answer: {text(reveal.word)}</p><p className="mt-1 text-sm font-semibold text-muted">{asList(reveal.roundPoints).map((entry) => `${text(entry.name)} +${num(entry.points)}`).join(" · ")}</p></Panel> : null}
    </div>
  );
}

function DuelBracket({ view, send }: { view: Obj; send: Sender }) {
  const match = asObj(view.match);
  const duel = asObj(view.duel);
  const type = text(duel.type);
  return (
    <div className="space-y-4">
      <PromptCard kicker={text(match.duelLabel) || "Duel"} icon="sword" compact>
        {text(match.aName)} vs {text(match.bName)}
      </PromptCard>
      {type === "tic-tac-toe" ? (
        <div className="mx-auto grid max-w-xs grid-cols-3 gap-1.5">
          {asStrings(duel.board).map((cell, index) => <button key={index} type="button" disabled={!view.isPlayer || Boolean(cell)} onClick={() => send("move", { move: { index } })} className="aspect-square rounded-xl border border-border bg-white text-xl font-bold">{cell === "a" ? "X" : cell === "b" ? "O" : cell}</button>)}
        </div>
      ) : null}
      {type === "connect-four" ? (
        <div className="grid gap-1 overflow-auto">{asList(duel.board).map((row, rowIndex) => <div key={rowIndex} className="grid grid-cols-7 gap-1">{asStrings(row).map((cell, column) => <button key={column} type="button" disabled={!view.isPlayer} onClick={() => send("move", { move: { column } })} className={`aspect-square rounded-full border ${cell === "a" ? "bg-coral" : cell === "b" ? "bg-honey" : "bg-white"}`} />)}</div>)}</div>
      ) : null}
      {type === "rock-paper-scissors" ? (
        <Panel>
          <p className="text-sm font-semibold text-muted">Best of five. Your choice: {text(duel.myChoice) || "—"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["rock", "paper", "scissors"].map((item) => <Button key={item} size="sm" variant={duel.myChoice === item ? "primary" : "secondary"} disabled={!view.isPlayer} onClick={() => send("move", { move: { choice: item } })}>{item}</Button>)}
          </div>
          {duel.reveal ? <p className="mt-3 text-sm font-bold">Last round: {text(asObj(duel.reveal).winner) || "draw"}</p> : null}
        </Panel>
      ) : null}
      {type === "dots-and-boxes" ? (
        <Panel><p className="text-sm font-semibold text-muted">Dots and Boxes is played by tapping the listed lines. Complete a box to score and keep your turn.</p><div className="mt-3 flex flex-wrap gap-1.5">{asStrings(duel.edges).map((edge) => <Button key={edge} size="sm" variant="secondary" disabled={!view.isPlayer || Boolean(asObj(duel.taken)[edge])} onClick={() => send("move", { move: { edge } })}>{edge}</Button>)}</div><p className="mt-2 text-xs font-bold text-muted">Boxes: {Object.values(asObj(duel.boxes)).length}</p></Panel>
      ) : null}
      {view.lastMatch ? <Panel><p className="text-sm font-semibold text-muted">{text(asObj(view.lastMatch).winnerName)} won {text(asObj(view.lastMatch).duelLabel)} ({text(asObj(view.lastMatch).reason)}).</p></Panel> : null}
      {text(view.phase) === "results" ? <p className="text-center font-display text-xl font-semibold">Champion: {text(view.championId)}</p> : null}
    </div>
  );
}

const RENDERERS: Record<string, React.ComponentType<{ view: Obj; send: Sender }>> = {
  "fill-the-blank": FillTheBlank,
  connections: Connections,
  "survey-says": SurveySays,
  scattergories: Scattergories,
  "pattern-memory": PatternMemory,
  "reaction-duel": ReactionDuel,
  "story-chain": StoryChain,
  password: Password,
  "boggle-rush": BoggleRush,
  "buzzer-trivia": BuzzerTrivia,
  "liars-dice": LiarsDice,
  "blur-guess": BlurGuess,
  codenames: Codenames,
  "blind-sketch": BlindSketch,
  "duel-bracket": DuelBracket,
};

export default function RoundTwoGame({ room, view, send }: { room: RoomView; view: Obj; send: Sender }) {
  const Renderer = room.gameId ? RENDERERS[room.gameId] : null;
  const reduced = useReducedMotion();
  if (!Renderer) return null;
  return (
    <motion.div initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Renderer view={view} send={send} />
    </motion.div>
  );
}
