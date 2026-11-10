"use client";

import AnimatedResultBar from "@/components/AnimatedResultBar";
import AvatarBubble from "@/components/AvatarBubble";
import ConfettiExplosion from "@/components/ConfettiExplosion";
import CountdownRing from "@/components/CountdownRing";
import FloatingBlobs from "@/components/FloatingBlobs";
import LoadingMessages from "@/components/LoadingMessages";
import PromptCard from "@/components/PromptCard";
import VoteButton from "@/components/VoteButton";
import { getSocket } from "@/lib/socket";
import { useGameStore } from "@/stores/gameStore";
import { AnimatePresence, motion } from "framer-motion";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// ─── OVERRATED / UNDERRATED ───
function OverratedUnderratedGame() {
  const { prompt, currentRound, totalRounds, votes, totalPlayers, results } =
    useGameStore();
  const [myVote, setMyVote] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    socket.on("new-round", (data: any) => {
      useGameStore.getState().setRound(data.round, data.totalRounds);
      useGameStore.getState().setPrompt(data.prompt);
      useGameStore.getState().setResults(null);
    });
    socket.on("vote-count", (data: any) =>
      useGameStore.getState().setVoteCount(data.totalVotes, data.totalPlayers),
    );
    socket.on("vote-results", (data: any) =>
      useGameStore.getState().setResults(data),
    );
    return () => {
      socket.off("new-round");
      socket.off("vote-count");
      socket.off("vote-results");
    };
  }, []);

  useEffect(() => {
    setMyVote(null);
    setShowResults(false);
  }, [currentRound]);
  useEffect(() => {
    if (results) {
      setShowResults(true);
      setConfetti(true);
      setTimeout(() => setConfetti(false), 100);
    }
  }, [results]);

  const handleVote = (vote: string) => {
    if (myVote) return;
    setMyVote(vote);
    getSocket().emit("submit-vote", { vote });
  };
  const handleNext = () => {
    getSocket().emit("next-round");
    useGameStore.getState().setResults(null);
  };

  if (!prompt && !showResults) return <LoadingMessages />;

  return (
    <>
      <ConfettiExplosion trigger={confetti} />
      <div className="flex items-center justify-center gap-2 mb-6">
        <span className="px-3 py-1 text-xs rounded-full bg-bg-card border border-border text-text-secondary font-mono">
          {currentRound} / {totalRounds}
        </span>
      </div>
      {!showResults ? (
        <>
          <PromptCard
            text={prompt?.text || "Loading..."}
            source={prompt?.source}
            type={prompt?.type}
            emoji="📊"
          />
          <motion.div
            className="flex flex-col sm:flex-row gap-3 justify-center mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <VoteButton
              label="Overrated"
              variant="coral"
              selected={myVote === "overrated"}
              disabled={!!myVote}
              onClick={() => handleVote("overrated")}
            />
            <VoteButton
              label="Underrated"
              variant="blue"
              selected={myVote === "underrated"}
              disabled={!!myVote}
              onClick={() => handleVote("underrated")}
            />
          </motion.div>
          {myVote && (
            <p className="text-center mt-4 text-text-muted text-sm font-mono">
              {votes}/{totalPlayers} votes
            </p>
          )}
        </>
      ) : (
        <motion.div
          className="glass-card p-8 max-w-lg mx-auto"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <h2 className="text-xl font-bold text-center mb-6 tracking-tight uppercase">
            Results
          </h2>
          <div className="space-y-4">
            <AnimatedResultBar
              label="Overrated"
              value={results?.results?.overrated || 0}
              maxValue={totalPlayers}
              color="#ef4444"
            />
            <AnimatedResultBar
              label="Underrated"
              value={results?.results?.underrated || 0}
              maxValue={totalPlayers}
              color="#2563eb"
              delay={0.2}
            />
          </div>
          {results?.majority && (
            <p className="text-center text-xs text-text-muted mt-3">
              {results.majority === myVote
                ? "✓ You voted with the majority! +1"
                : "You voted against the majority"}
            </p>
          )}
          {results?.scores && Object.keys(results.scores).length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-text-muted uppercase tracking-wider mb-2 text-center">
                Scores
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {Object.entries(results.scores)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([name, score]) => (
                    <span
                      key={name}
                      className="text-xs font-mono bg-bg-card px-2 py-1 rounded-lg border border-border"
                    >
                      {name}:{" "}
                      <span className="text-accent">{score as number}</span>
                    </span>
                  ))}
              </div>
            </div>
          )}
          <button
            onClick={handleNext}
            className="neon-btn neon-btn-purple w-full mt-6 text-xs"
          >
            {currentRound >= totalRounds ? "See Final Results" : "Next Round →"}
          </button>
        </motion.div>
      )}
    </>
  );
}

// ─── IMPOSTOR ───
function ImpostorGame() {
  const { currentRound, totalRounds, phase } = useGameStore();
  const [myRole, setMyRole] = useState<{
    isImpostor: boolean;
    prompt: string | null;
  } | null>(null);
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState<any[]>([]);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [reveal, setReveal] = useState<any>(null);
  const [confetti, setConfetti] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const socket = getSocket();

  useEffect(() => {
    socket.on("impostor-round", (data: any) => {
      setMyRole({ isImpostor: data.isImpostor, prompt: data.prompt });
      useGameStore.getState().setRound(data.round, data.totalRounds);
      useGameStore.getState().setPhase("answer");
      setAnswer("");
      setAnswers([]);
      setMyVote(null);
      setReveal(null);
      setSubmitted(false);
    });
    socket.on("impostor-discussion", (data: any) => {
      setAnswers(data.answers);
      useGameStore.getState().setPhase("discussion");
    });
    socket.on("impostor-vote-phase", () =>
      useGameStore.getState().setPhase("vote"),
    );
    socket.on("vote-count", (data: any) =>
      useGameStore.getState().setVoteCount(data.totalVotes, data.totalPlayers),
    );
    socket.on("impostor-reveal", (data: any) => {
      setReveal(data);
      useGameStore.getState().setPhase("reveal");
      setConfetti(true);
      setTimeout(() => setConfetti(false), 100);
    });
    return () => {
      socket.off("impostor-round");
      socket.off("impostor-discussion");
      socket.off("impostor-vote-phase");
      socket.off("vote-count");
      socket.off("impostor-reveal");
    };
  }, []);

  if (!myRole) return <LoadingMessages />;

  return (
    <>
      <ConfettiExplosion trigger={confetti} />
      <div className="flex items-center justify-center gap-2 mb-6">
        <span className="px-3 py-1 text-xs rounded-full bg-bg-card border border-border text-text-secondary font-mono">
          {currentRound} / {totalRounds}
        </span>
        <span
          className={`px-3 py-1 text-xs rounded-full border ${myRole.isImpostor ? "bg-danger/10 border-danger/20 text-danger" : "bg-success/10 border-success/20 text-success"}`}
        >
          {myRole.isImpostor ? "Impostor" : "Crew"}
        </span>
      </div>
      <AnimatePresence mode="wait">
        {phase === "answer" && (
          <motion.div
            key="answer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {myRole.isImpostor ? (
              <PromptCard text="You're the Impostor. Blend in." emoji="🔍" />
            ) : (
              <PromptCard text={myRole.prompt || ""} emoji="💬" />
            )}
            {!submitted ? (
              <div className="max-w-md mx-auto mt-6">
                <input
                  className="neon-input mb-3"
                  placeholder="Your answer..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    answer.trim() &&
                    (socket.emit("submit-answer", { answer: answer.trim() }),
                    setSubmitted(true))
                  }
                />
                <button
                  onClick={() => {
                    if (!answer.trim()) return;
                    socket.emit("submit-answer", { answer: answer.trim() });
                    setSubmitted(true);
                  }}
                  className="neon-btn neon-btn-purple w-full text-xs"
                >
                  Submit
                </button>
              </div>
            ) : (
              <p className="text-center mt-4 text-text-muted text-sm">
                Waiting for others...
              </p>
            )}
          </motion.div>
        )}
        {(phase === "discussion" || phase === "vote") && (
          <motion.div
            key="discuss"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <h2 className="text-lg font-bold text-center mb-4 tracking-tight uppercase">
              {phase === "discussion" ? "Discussion" : "Vote"}
            </h2>
            <div className="grid gap-2 max-w-md mx-auto">
              {answers.map((a: any, i: number) => (
                <motion.div
                  key={i}
                  className={`glass-card p-4 ${phase === "vote" ? "cursor-pointer" : ""} ${myVote === a.socketId ? "ring-1 ring-accent" : ""}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => {
                    if (phase === "vote" && !myVote) {
                      setMyVote(a.socketId);
                      socket.emit("submit-vote", {
                        targetSocketId: a.socketId,
                      });
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <AvatarBubble name={a.displayName} size="sm" />
                    <div>
                      <p className="font-semibold text-sm">{a.displayName}</p>
                      <p className="text-text-secondary text-sm">
                        &quot;{a.answer}&quot;
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
        {phase === "reveal" && reveal && (
          <motion.div
            key="reveal"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="glass-card p-8 max-w-md mx-auto text-center">
              <h2 className="text-2xl font-bold mb-3 tracking-tight uppercase">
                {reveal.impostorCaught ? "Caught!" : "Escaped!"}
              </h2>
              {reveal.impostorNames && reveal.impostorNames.length > 1 ? (
                <p className="text-base mb-1">
                  Impostors:{" "}
                  <strong className="text-danger">
                    {reveal.impostorNames.join(" & ")}
                  </strong>
                </p>
              ) : (
                <p className="text-base mb-1">
                  Impostor:{" "}
                  <strong className="text-danger">{reveal.impostorName}</strong>
                </p>
              )}
              <p className="text-text-muted text-sm mb-4">
                Accused: <strong>{reveal.accusedName}</strong>
              </p>
              <button
                onClick={() => socket.emit("next-round")}
                className="neon-btn neon-btn-purple w-full text-xs"
              >
                {currentRound >= totalRounds ? "Final Scores" : "Next Round →"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── FIVE SECOND ───
function FiveSecondGame() {
  const { currentRound, totalRounds, votes, totalPlayers } = useGameStore();
  const [roundData, setRoundData] = useState<any>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [confetti, setConfetti] = useState(false);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [groupVoteData, setGroupVoteData] = useState<any>(null);
  const [myGroupVote, setMyGroupVote] = useState<string | null>(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const socket = getSocket();

  useEffect(() => {
    socket.on("five-second-round", (data: any) => {
      setRoundData(data);
      setTimerRunning(true);
      setResult(null);
      setGroupVoteData(null);
      setMyGroupVote(null);
      setAnswerSubmitted(false);
      useGameStore.getState().setRound(data.round, data.totalRounds);
      setIsMyTurn(data.currentPlayer.socketId === socket.id);
    });
    socket.on("five-second-timeout", () => {
      setTimerRunning(false);
      // On timeout, auto-submit empty answer
      if (!answerSubmitted) {
        socket.emit("submit-answer", { answer: "" });
        setAnswerSubmitted(true);
      }
    });
    socket.on("five-second-group-vote", (data: any) => {
      setTimerRunning(false);
      setGroupVoteData(data);
      setMyGroupVote(null);
    });
    socket.on("vote-count", (data: any) =>
      useGameStore.getState().setVoteCount(data.totalVotes, data.totalPlayers),
    );
    socket.on("five-second-result", (data: any) => {
      setResult(data);
      setGroupVoteData(null);
      setTimerRunning(false);
      if (data.success) {
        setConfetti(true);
        setTimeout(() => setConfetti(false), 100);
      }
    });
    return () => {
      socket.off("five-second-round");
      socket.off("five-second-timeout");
      socket.off("five-second-group-vote");
      socket.off("vote-count");
      socket.off("five-second-result");
    };
  }, []);

  const handleGroupVote = (vote: string) => {
    if (myGroupVote) return;
    setMyGroupVote(vote);
    socket.emit("submit-vote", { vote });
  };

  if (!roundData && !result && !groupVoteData) return <LoadingMessages />;

  return (
    <>
      <ConfettiExplosion trigger={confetti} />
      <div className="flex items-center justify-center gap-2 mb-6">
        <span className="px-3 py-1 text-xs rounded-full bg-bg-card border border-border text-text-secondary font-mono">
          {currentRound} / {totalRounds}
        </span>
      </div>

      {/* Group Vote Phase */}
      {groupVoteData && !result && (
        <motion.div
          className="glass-card p-8 max-w-md mx-auto text-center"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <h2 className="text-lg font-bold mb-2 tracking-tight uppercase">
            Did {groupVoteData.player} nail it?
          </h2>
          <p className="text-text-secondary text-sm mb-1">
            {groupVoteData.prompt}
          </p>
          {groupVoteData.answer && (
            <p className="text-text-muted text-xs mb-4 italic">
              &quot;{groupVoteData.answer}&quot;
            </p>
          )}
          {isMyTurn ? (
            <p className="text-text-muted text-sm mt-4">
              Waiting for the group to decide...
            </p>
          ) : !myGroupVote ? (
            <div className="flex gap-3 justify-center mt-4">
              <VoteButton
                label="Nailed It ✓"
                variant="blue"
                selected={false}
                disabled={false}
                onClick={() => handleGroupVote("nailed")}
              />
              <VoteButton
                label="Failed ✗"
                variant="coral"
                selected={false}
                disabled={false}
                onClick={() => handleGroupVote("failed")}
              />
            </div>
          ) : (
            <p className="text-center mt-4 text-text-muted text-sm font-mono">
              {votes}/{totalPlayers} voted
            </p>
          )}
        </motion.div>
      )}

      {/* Active Round */}
      {!result && !groupVoteData && (
        <div className="text-center">
          <p className="text-lg mb-4 tracking-tight">
            {isMyTurn ? (
              <strong className="text-accent uppercase">Your Turn</strong>
            ) : (
              <span className="text-text-secondary">
                {roundData?.currentPlayer?.displayName}&apos;s turn
              </span>
            )}
          </p>
          <div className="flex justify-center mb-6">
            <CountdownRing
              seconds={roundData?.timerSeconds || 5}
              running={timerRunning}
              size={120}
            />
          </div>
          <PromptCard text={roundData?.prompt || "Loading..."} emoji="⏱" />
          {isMyTurn && timerRunning && (
            <div className="max-w-md mx-auto mt-6">
              <button
                onClick={() => {
                  socket.emit("submit-answer", { answer: "answered" });
                  setAnswerSubmitted(true);
                }}
                disabled={answerSubmitted}
                className="neon-btn neon-btn-purple w-full text-xs"
              >
                {answerSubmitted ? "Submitted!" : "Done! ✓"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <motion.div
          className="glass-card p-8 max-w-md mx-auto text-center"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <h2 className="text-2xl font-bold mb-2 tracking-tight uppercase">
            {result.success ? "Nailed It! 🎉" : "Missed! 😬"}
          </h2>
          <p className="text-text-muted text-xs mb-4">
            {result.nailedVotes} voted Nailed It · {result.failedVotes} voted
            Failed
          </p>
          <button
            onClick={() => socket.emit("next-round")}
            className="neon-btn neon-btn-purple w-full mt-4 text-xs"
          >
            {currentRound >= totalRounds ? "Final Scores" : "Next →"}
          </button>
        </motion.div>
      )}
    </>
  );
}

// ─── BEST FRIEND TEST ───
function BestFriendTestGame() {
  const { prompt, currentRound, totalRounds, votes, totalPlayers, results } =
    useGameStore();
  const [myAnswer, setMyAnswer] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.on("new-round", (data: any) => {
      useGameStore.getState().setRound(data.round, data.totalRounds);
      useGameStore.getState().setPrompt(data.prompt);
      useGameStore.getState().setResults(null);
      setTimerSeconds(data.timerSeconds || null);
      setTimeLeft(data.timerSeconds || null);
    });
    socket.on("vote-count", (data: any) =>
      useGameStore.getState().setVoteCount(data.totalVotes, data.totalPlayers),
    );
    socket.on("vote-results", (data: any) =>
      useGameStore.getState().setResults(data),
    );
    return () => {
      socket.off("new-round");
      socket.off("vote-count");
      socket.off("vote-results");
    };
  }, []);

  // Timer countdown for timed mode
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || myAnswer || showResults) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          // Auto-submit random answer on timeout
          if (!myAnswer && prompt?.options?.length) {
            const randomOpt =
              prompt.options[Math.floor(Math.random() * prompt.options.length)];
            setMyAnswer(randomOpt);
            getSocket().emit("submit-answer", { answer: randomOpt });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft, myAnswer, showResults]);

  useEffect(() => {
    setMyAnswer(null);
    setShowResults(false);
  }, [currentRound]);
  useEffect(() => {
    if (results) {
      setShowResults(true);
      setConfetti(true);
      setTimeout(() => setConfetti(false), 100);
    }
  }, [results]);

  const handleAnswer = (answer: string) => {
    if (myAnswer) return;
    setMyAnswer(answer);
    getSocket().emit("submit-answer", { answer });
  };

  if (!prompt && !showResults) return <LoadingMessages />;

  return (
    <>
      <ConfettiExplosion trigger={confetti} />
      <div className="flex items-center justify-center gap-2 mb-6">
        <span className="px-3 py-1 text-xs rounded-full bg-bg-card border border-border text-text-secondary font-mono">
          {currentRound} / {totalRounds}
        </span>
      </div>
      {!showResults ? (
        <>
          <PromptCard text={prompt?.question || "Loading..."} emoji="🧠" />
          <p className="text-center text-text-muted text-xs mt-2 mb-2">
            About:{" "}
            <strong className="text-accent">{prompt?.aboutMember}</strong>
          </p>
          {timerSeconds && timeLeft !== null && timeLeft > 0 && !myAnswer && (
            <p
              className={`text-center font-mono text-sm mb-2 ${timeLeft <= 3 ? "text-danger animate-pulse" : "text-text-muted"}`}
            >
              ⏰ {timeLeft}s
            </p>
          )}
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {prompt?.options?.map((opt: string, i: number) => (
              <motion.button
                key={i}
                onClick={() => handleAnswer(opt)}
                className={`glass-card p-4 text-sm text-center transition-all ${myAnswer === opt ? "ring-2 ring-accent bg-accent-muted" : myAnswer ? "opacity-50" : "hover:border-accent/40 cursor-pointer"}`}
                disabled={!!myAnswer}
                whileTap={!myAnswer ? { scale: 0.97 } : {}}
              >
                {opt}
              </motion.button>
            ))}
          </motion.div>
          {myAnswer && (
            <p className="text-center mt-4 text-text-muted text-sm font-mono">
              {votes}/{totalPlayers} answered
            </p>
          )}
        </>
      ) : (
        <motion.div
          className="glass-card p-8 max-w-lg mx-auto"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <h2 className="text-xl font-bold text-center mb-4 tracking-tight uppercase">
            Results
          </h2>
          <p className="text-center text-sm mb-4">
            Correct answer:{" "}
            <strong className="text-accent">{results?.correctAnswer}</strong>
          </p>
          <div className="grid gap-2 mb-6">
            {results?.playerResults?.map((r: any, i: number) => (
              <div
                key={i}
                className={`flex items-center justify-between p-3 rounded-xl ${r.isCorrect ? "bg-success/10 border border-success/20" : "bg-bg-card border border-border"}`}
              >
                <div className="flex items-center gap-2">
                  <AvatarBubble name={r.displayName} size="sm" />
                  <span className="text-sm font-semibold">{r.displayName}</span>
                </div>
                <span
                  className={`text-xs font-mono ${r.isCorrect ? "text-success" : "text-text-muted"}`}
                >
                  {r.isCorrect ? "✓ Correct" : "✗ Wrong"}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              getSocket().emit("next-round");
              useGameStore.getState().setResults(null);
            }}
            className="neon-btn neon-btn-purple w-full text-xs"
          >
            {currentRound >= totalRounds ? "See Final Results" : "Next Round →"}
          </button>
        </motion.div>
      )}
    </>
  );
}

// ─── MOST LIKELY TO ───
function MostLikelyToGame() {
  const { prompt, currentRound, totalRounds, votes, totalPlayers, results } =
    useGameStore();
  const [myVote, setMyVote] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    socket.on("new-round", (data: any) => {
      useGameStore.getState().setRound(data.round, data.totalRounds);
      useGameStore.getState().setPrompt(data.prompt);
      useGameStore.getState().setResults(null);
    });
    socket.on("vote-count", (data: any) =>
      useGameStore.getState().setVoteCount(data.totalVotes, data.totalPlayers),
    );
    socket.on("vote-results", (data: any) =>
      useGameStore.getState().setResults(data),
    );
    return () => {
      socket.off("new-round");
      socket.off("vote-count");
      socket.off("vote-results");
    };
  }, []);

  useEffect(() => {
    setMyVote(null);
    setShowResults(false);
  }, [currentRound]);
  useEffect(() => {
    if (results) {
      setShowResults(true);
      setConfetti(true);
      setTimeout(() => setConfetti(false), 100);
    }
  }, [results]);

  const handleVote = (name: string) => {
    if (myVote) return;
    setMyVote(name);
    getSocket().emit("submit-vote", { vote: name });
  };

  if (!prompt && !showResults) return <LoadingMessages />;

  return (
    <>
      <ConfettiExplosion trigger={confetti} />
      <div className="flex items-center justify-center gap-2 mb-6">
        <span className="px-3 py-1 text-xs rounded-full bg-bg-card border border-border text-text-secondary font-mono">
          {currentRound} / {totalRounds}
        </span>
      </div>
      {!showResults ? (
        <>
          <PromptCard text={prompt?.text || "Loading..."} emoji="👑" />
          <motion.div
            className="grid grid-cols-2 gap-3 max-w-lg mx-auto mt-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {prompt?.options?.map((name: string, i: number) => (
              <motion.button
                key={i}
                onClick={() => handleVote(name)}
                className={`glass-card p-4 text-center transition-all ${myVote === name ? "ring-2 ring-accent bg-accent-muted" : myVote ? "opacity-50" : "hover:border-accent/40 cursor-pointer"}`}
                disabled={!!myVote}
                whileTap={!myVote ? { scale: 0.97 } : {}}
              >
                <AvatarBubble name={name} size="sm" />
                <p className="text-sm font-semibold mt-2">{name}</p>
              </motion.button>
            ))}
          </motion.div>
          {myVote && (
            <p className="text-center mt-4 text-text-muted text-sm font-mono">
              {votes}/{totalPlayers} voted
            </p>
          )}
        </>
      ) : (
        <motion.div
          className="glass-card p-8 max-w-lg mx-auto"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <h2 className="text-xl font-bold text-center mb-2 tracking-tight uppercase">
            Most Likely To
          </h2>
          <p className="text-center text-text-secondary text-sm mb-6">
            {results?.prompt}
          </p>
          <div className="space-y-3 mb-6">
            {results?.tally &&
              Object.entries(results.tally)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([name, count], i) => (
                  <AnimatedResultBar
                    key={name}
                    label={name}
                    value={count as number}
                    maxValue={totalPlayers}
                    color={i === 0 ? "#2563eb" : "#3b82f6"}
                    delay={i * 0.1}
                  />
                ))}
          </div>
          <p className="text-center text-lg font-bold text-accent mb-4">
            🏆 {results?.winner}
          </p>
          {results?.scores && Object.keys(results.scores).length > 0 && (
            <div className="mb-4 pt-3 border-t border-border">
              <p className="text-xs text-text-muted uppercase tracking-wider mb-2 text-center">
                Scores
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {Object.entries(results.scores)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([name, score]) => (
                    <span
                      key={name}
                      className="text-xs font-mono bg-bg-card px-2 py-1 rounded-lg border border-border"
                    >
                      {name}:{" "}
                      <span className="text-accent">{score as number}</span>
                    </span>
                  ))}
              </div>
            </div>
          )}
          <button
            onClick={() => {
              getSocket().emit("next-round");
              useGameStore.getState().setResults(null);
            }}
            className="neon-btn neon-btn-purple w-full text-xs"
          >
            {currentRound >= totalRounds ? "See Final Results" : "Next Round →"}
          </button>
        </motion.div>
      )}
    </>
  );
}

// ─── LIARS BAR ───
function LiarsBarGame() {
  const { currentRound, totalRounds, votes, totalPlayers, results } =
    useGameStore();
  const [phase, setPhase] = useState<
    "waiting" | "choosing" | "voting" | "waitingVotes" | "results"
  >("waiting");
  const [turnData, setTurnData] = useState<any>(null);
  const [statement, setStatement] = useState<string | null>(null);
  const [liarName, setLiarName] = useState("");
  const [myVote, setMyVote] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const socket = getSocket();

  useEffect(() => {
    socket.on("liars-your-turn", (data: any) => {
      setTurnData(data);
      setPhase("choosing");
      setMyVote(null);
      setShowResults(false);
      useGameStore.getState().setRound(data.round, data.totalRounds);
    });
    socket.on("liars-waiting", (data: any) => {
      setLiarName(data.liarName);
      setPhase("waiting");
      setMyVote(null);
      setShowResults(false);
      useGameStore.getState().setRound(data.round, data.totalRounds);
    });
    socket.on("liars-vote", (data: any) => {
      setStatement(data.statement);
      setLiarName(data.liarName);
      setPhase("voting");
    });
    socket.on("liars-wait-for-votes", (data: any) => {
      setStatement(data.statement);
      setPhase("waitingVotes");
    });
    socket.on("vote-count", (data: any) =>
      useGameStore.getState().setVoteCount(data.totalVotes, data.totalPlayers),
    );
    socket.on("vote-results", (data: any) => {
      useGameStore.getState().setResults(data);
      setShowResults(true);
      setPhase("results");
      setConfetti(true);
      setTimeout(() => setConfetti(false), 100);
    });
    return () => {
      socket.off("liars-your-turn");
      socket.off("liars-waiting");
      socket.off("liars-vote");
      socket.off("liars-wait-for-votes");
      socket.off("vote-count");
      socket.off("vote-results");
    };
  }, []);

  const submitChoice = (chosenStatement: string, isLie: boolean) => {
    socket.emit("submit-answer", { statement: chosenStatement, isLie });
  };

  const submitVote = (vote: string) => {
    if (myVote) return;
    setMyVote(vote);
    socket.emit("submit-vote", { vote });
  };

  return (
    <>
      <ConfettiExplosion trigger={confetti} />
      <div className="flex items-center justify-center gap-2 mb-6">
        <span className="px-3 py-1 text-xs rounded-full bg-bg-card border border-border text-text-secondary font-mono">
          {currentRound} / {totalRounds}
        </span>
      </div>
      <AnimatePresence mode="wait">
        {phase === "waiting" && (
          <motion.div
            key="wait"
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <PromptCard
              text={`${liarName} is preparing their statement...`}
              emoji="🎭"
            />
            <p className="text-text-muted text-sm mt-4">
              Wait for them to choose.
            </p>
          </motion.div>
        )}
        {phase === "choosing" && turnData && (
          <motion.div
            key="choose"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <PromptCard
              text="You're the Liar. Choose a statement to present:"
              emoji="🎭"
            />
            <div className="grid gap-3 max-w-md mx-auto mt-6">
              <motion.button
                onClick={() => submitChoice(turnData.realFact, false)}
                className="glass-card p-4 text-left hover:border-accent/40 transition-all"
                whileTap={{ scale: 0.97 }}
              >
                <p className="text-xs text-success uppercase tracking-wider mb-1">
                  Truth
                </p>
                <p className="text-sm">{turnData.realFact}</p>
              </motion.button>
              <motion.button
                onClick={() => submitChoice(turnData.fakeFact, true)}
                className="glass-card p-4 text-left hover:border-accent/40 transition-all"
                whileTap={{ scale: 0.97 }}
              >
                <p className="text-xs text-danger uppercase tracking-wider mb-1">
                  Lie
                </p>
                <p className="text-sm">{turnData.fakeFact}</p>
              </motion.button>
            </div>
          </motion.div>
        )}
        {phase === "voting" && (
          <motion.div
            key="vote"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <PromptCard text={`${liarName} says:`} emoji="🎭" />
            <div className="glass-card p-6 max-w-md mx-auto mt-4 text-center">
              <p className="text-lg font-semibold italic">
                &quot;{statement}&quot;
              </p>
            </div>
            <motion.div
              className="flex gap-3 justify-center mt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <VoteButton
                label="Truth ✓"
                variant="blue"
                selected={myVote === "truth"}
                disabled={!!myVote}
                onClick={() => submitVote("truth")}
              />
              <VoteButton
                label="Lie ✗"
                variant="coral"
                selected={myVote === "lie"}
                disabled={!!myVote}
                onClick={() => submitVote("lie")}
              />
            </motion.div>
            {myVote && (
              <p className="text-center mt-4 text-text-muted text-sm font-mono">
                {votes}/{totalPlayers} voted
              </p>
            )}
          </motion.div>
        )}
        {phase === "waitingVotes" && (
          <motion.div
            key="waitVotes"
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <PromptCard
              text="You presented your statement. Waiting for votes..."
              emoji="🎭"
            />
            <div className="glass-card p-6 max-w-md mx-auto mt-4">
              <p className="text-sm italic text-text-secondary">
                &quot;{statement}&quot;
              </p>
            </div>
          </motion.div>
        )}
        {phase === "results" && results && (
          <motion.div
            key="results"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="glass-card p-8 max-w-md mx-auto text-center">
              <h2 className="text-2xl font-bold mb-3 tracking-tight uppercase">
                {results.groupCorrect ? "Caught!" : "Fooled!"}
              </h2>
              <p className="text-sm mb-1">
                It was a{" "}
                <strong
                  className={results.wasLie ? "text-danger" : "text-success"}
                >
                  {results.wasLie ? "LIE" : "TRUTH"}
                </strong>
              </p>
              <p className="text-text-muted text-sm mb-4">
                {results.liarName}{" "}
                {results.groupCorrect ? "got caught!" : "fooled everyone!"}
              </p>
              <div className="flex justify-center gap-4 mb-4 text-xs">
                <span className="text-success">
                  Truth: {results.truthVotes}
                </span>
                <span className="text-danger">Lie: {results.lieVotes}</span>
              </div>
              <button
                onClick={() => {
                  getSocket().emit("next-round");
                  useGameStore.getState().setResults(null);
                }}
                className="neon-btn neon-btn-purple w-full text-xs"
              >
                {currentRound >= totalRounds
                  ? "See Final Results"
                  : "Next Round →"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── HIGHER OR LOWER ───
function HigherOrLowerGame() {
  const { prompt, currentRound, totalRounds, votes, totalPlayers, results } =
    useGameStore();
  const [phase, setPhase] = useState<"poll" | "play">("poll");
  const [pollData, setPollData] = useState<any>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [pollSubmitted, setPollSubmitted] = useState(false);
  const [myAnswer, setMyAnswer] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const socket = getSocket();

  useEffect(() => {
    socket.on("higher-lower-poll", (data: any) => {
      setPollData(data);
      setPhase("poll");
      setPollSubmitted(false);
      const init: Record<string, number> = {};
      data.members.forEach((m: string) => (init[m] = 5));
      setRatings(init);
    });
    socket.on("vote-count", (data: any) =>
      useGameStore.getState().setVoteCount(data.totalVotes, data.totalPlayers),
    );
    socket.on("new-round", (data: any) => {
      setPhase("play");
      setMyAnswer(null);
      setShowResults(false);
      useGameStore.getState().setRound(data.round, data.totalRounds);
      useGameStore.getState().setPrompt(data.prompt);
    });
    socket.on("vote-results", (data: any) => {
      useGameStore.getState().setResults(data);
      setShowResults(true);
      setConfetti(true);
      setTimeout(() => setConfetti(false), 100);
    });
    return () => {
      socket.off("higher-lower-poll");
      socket.off("vote-count");
      socket.off("new-round");
      socket.off("vote-results");
    };
  }, []);

  const submitPoll = () => {
    setPollSubmitted(true);
    socket.emit("submit-answer", { ratings });
  };

  const submitAnswer = (answer: string) => {
    if (myAnswer) return;
    setMyAnswer(answer);
    socket.emit("submit-answer", { answer });
  };

  if (phase === "poll") {
    if (!pollData) return <LoadingMessages />;
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <PromptCard
          text={`Rate everyone for: "${pollData.category}"`}
          emoji="📈"
        />
        <div className="max-w-md mx-auto mt-6 space-y-3">
          {pollData.members.map((name: string) => (
            <div key={name} className="glass-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">{name}</span>
                <span className="font-mono text-accent text-sm">
                  {ratings[name]}/10
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={ratings[name]}
                onChange={(e) =>
                  setRatings({ ...ratings, [name]: parseInt(e.target.value) })
                }
                className="w-full accent-[#2563eb]"
                disabled={pollSubmitted}
              />
            </div>
          ))}
          {!pollSubmitted ? (
            <button
              onClick={submitPoll}
              className="neon-btn neon-btn-purple w-full text-xs"
            >
              Submit Ratings
            </button>
          ) : (
            <p className="text-center text-text-muted text-sm font-mono">
              {votes}/{totalPlayers} submitted
            </p>
          )}
        </div>
      </motion.div>
    );
  }

  if (!prompt && !showResults) return <LoadingMessages />;

  return (
    <>
      <ConfettiExplosion trigger={confetti} />
      <div className="flex items-center justify-center gap-2 mb-6">
        <span className="px-3 py-1 text-xs rounded-full bg-bg-card border border-border text-text-secondary font-mono">
          {currentRound} / {totalRounds}
        </span>
      </div>
      {!showResults ? (
        <>
          <PromptCard text={prompt?.question || "Loading..."} emoji="📈" />
          <div className="glass-card p-4 max-w-sm mx-auto mt-4 text-center">
            <p className="text-xs text-text-muted uppercase mb-1">Current</p>
            <p className="text-lg font-bold">{prompt?.currentMember}</p>
            <p className="text-2xl font-mono text-accent font-bold">
              {prompt?.currentScore}
            </p>
          </div>
          <p className="text-center text-text-secondary text-sm mt-4 mb-2">
            Does <strong className="text-accent">{prompt?.nextMember}</strong>{" "}
            score...
          </p>
          <motion.div
            className="flex gap-3 justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <VoteButton
              label="⬆ Higher"
              variant="blue"
              selected={myAnswer === "higher"}
              disabled={!!myAnswer}
              onClick={() => submitAnswer("higher")}
            />
            <VoteButton
              label="⬇ Lower"
              variant="coral"
              selected={myAnswer === "lower"}
              disabled={!!myAnswer}
              onClick={() => submitAnswer("lower")}
            />
          </motion.div>
          {myAnswer && (
            <p className="text-center mt-4 text-text-muted text-sm font-mono">
              {votes}/{totalPlayers} answered
            </p>
          )}
        </>
      ) : (
        <motion.div
          className="glass-card p-8 max-w-lg mx-auto text-center"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <h2 className="text-xl font-bold mb-2 tracking-tight uppercase">
            {results?.nextMember}
          </h2>
          <p className="text-3xl font-mono text-accent font-bold mb-2">
            {results?.nextScore}
          </p>
          <p className="text-sm text-text-secondary mb-4">
            Answer was{" "}
            <strong className="text-accent uppercase">
              {results?.correctAnswer}
            </strong>
          </p>
          <button
            onClick={() => {
              getSocket().emit("next-round");
              useGameStore.getState().setResults(null);
            }}
            className="neon-btn neon-btn-purple w-full text-xs"
          >
            {currentRound >= totalRounds ? "See Final Results" : "Next →"}
          </button>
        </motion.div>
      )}
    </>
  );
}

// ─── AVOID THE ANSWER ───
function AvoidTheAnswerGame() {
  const { currentRound, totalRounds } = useGameStore();
  const [phase, setPhase] = useState<
    "waiting" | "describing" | "guessing" | "reveal"
  >("waiting");
  const [describeData, setDescribeData] = useState<any>(null);
  const [guessData, setGuessData] = useState<any>(null);
  const [clues, setClues] = useState<
    { clue: string; from: string; violation: boolean }[]
  >([]);
  const [clueInput, setClueInput] = useState("");
  const [myGuess, setMyGuess] = useState<string | null>(null);
  const [reveal, setReveal] = useState<any>(null);
  const [wrongGuesses, setWrongGuesses] = useState<
    { guesserName: string; guess: string }[]
  >([]);
  const [confetti, setConfetti] = useState(false);
  const socket = getSocket();

  useEffect(() => {
    socket.on("avoid-describe", (data: any) => {
      setDescribeData(data);
      setPhase("describing");
      setClues([]);
      setClueInput("");
      setReveal(null);
      setMyGuess(null);
      setWrongGuesses([]);
      useGameStore.getState().setRound(data.round, data.totalRounds);
    });
    socket.on("avoid-guess", (data: any) => {
      setGuessData(data);
      setPhase("guessing");
      setClues([]);
      setMyGuess(null);
      setReveal(null);
      setWrongGuesses([]);
      useGameStore.getState().setRound(data.round, data.totalRounds);
    });
    socket.on("avoid-clue", (data: any) => {
      setClues((prev) => [...prev, data]);
    });
    socket.on("avoid-wrong-guess", (data: any) => {
      setWrongGuesses((prev) => [...prev, data]);
    });
    socket.on("avoid-reveal", (data: any) => {
      setReveal(data);
      setPhase("reveal");
      setConfetti(true);
      setTimeout(() => setConfetti(false), 100);
    });
    return () => {
      socket.off("avoid-describe");
      socket.off("avoid-guess");
      socket.off("avoid-clue");
      socket.off("avoid-wrong-guess");
      socket.off("avoid-reveal");
    };
  }, []);

  const sendClue = () => {
    if (!clueInput.trim()) return;
    socket.emit("submit-answer", { clue: clueInput.trim() });
    setClueInput("");
  };

  const submitGuess = (name: string) => {
    if (myGuess) return;
    setMyGuess(name);
    socket.emit("submit-answer", { guess: name });
  };

  return (
    <>
      <ConfettiExplosion trigger={confetti} />
      <div className="flex items-center justify-center gap-2 mb-6">
        <span className="px-3 py-1 text-xs rounded-full bg-bg-card border border-border text-text-secondary font-mono">
          {currentRound} / {totalRounds}
        </span>
      </div>
      <AnimatePresence mode="wait">
        {phase === "waiting" && (
          <motion.div
            key="wait"
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <LoadingMessages />
          </motion.div>
        )}
        {phase === "describing" && describeData && (
          <motion.div
            key="describe"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <PromptCard
              text={`Describe "${describeData.targetMember}" without saying the banned words!`}
              emoji="🚫"
            />
            <div className="glass-card p-4 max-w-md mx-auto mt-4">
              <p className="text-xs text-text-muted uppercase tracking-wider mb-2">
                Banned Words
              </p>
              <div className="flex flex-wrap gap-1.5">
                {describeData.bannedWords.map((w: string, i: number) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-xs rounded-full bg-danger/10 border border-danger/20 text-danger"
                  >
                    {w}
                  </span>
                ))}
              </div>
            </div>
            <div className="max-w-md mx-auto mt-4 flex gap-2">
              <input
                className="neon-input flex-1"
                placeholder="Type a clue..."
                value={clueInput}
                onChange={(e) => setClueInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendClue()}
              />
              <button
                onClick={sendClue}
                className="neon-btn neon-btn-purple text-xs px-4"
              >
                Send
              </button>
            </div>
            {clues.length > 0 && (
              <div className="max-w-md mx-auto mt-4 space-y-1">
                {clues.map((c, i) => (
                  <div
                    key={i}
                    className={`text-sm p-2 rounded-lg ${c.violation ? "bg-danger/10 text-danger line-through" : "bg-bg-card"}`}
                  >
                    <span className="text-text-muted text-xs">{c.from}:</span>{" "}
                    {c.clue}
                    {c.violation && (
                      <span className="text-xs ml-2">⚠ Banned word!</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
        {phase === "guessing" && guessData && (
          <motion.div
            key="guess"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <PromptCard
              text={`${guessData.describerName} is describing someone. Guess who!`}
              emoji="🚫"
            />
            {clues.length > 0 && (
              <div className="max-w-md mx-auto mt-4 space-y-1 mb-4">
                {clues.map((c, i) => (
                  <div
                    key={i}
                    className={`text-sm p-2 rounded-lg ${c.violation ? "bg-danger/10 text-danger line-through" : "bg-bg-card"}`}
                  >
                    <span className="text-text-muted text-xs">{c.from}:</span>{" "}
                    {c.clue}
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 max-w-md mx-auto mt-4">
              {guessData.memberOptions.map((name: string) => (
                <motion.button
                  key={name}
                  onClick={() => submitGuess(name)}
                  className={`glass-card p-3 text-sm text-center transition-all ${myGuess === name ? "ring-2 ring-accent bg-accent-muted" : myGuess ? "opacity-50" : "hover:border-accent/40 cursor-pointer"}`}
                  disabled={!!myGuess}
                  whileTap={!myGuess ? { scale: 0.97 } : {}}
                >
                  {name}
                </motion.button>
              ))}
            </div>
            {wrongGuesses.length > 0 && (
              <div className="max-w-md mx-auto mt-3 space-y-1">
                {wrongGuesses.map((wg, i) => (
                  <p key={i} className="text-xs text-danger text-center">
                    {wg.guesserName} guessed {wg.guess} — Wrong!
                  </p>
                ))}
              </div>
            )}
          </motion.div>
        )}
        {phase === "reveal" && reveal && (
          <motion.div
            key="reveal"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="glass-card p-8 max-w-md mx-auto text-center">
              <h2 className="text-2xl font-bold mb-3 tracking-tight uppercase">
                It was {reveal.targetMember}!
              </h2>
              <p className="text-text-secondary text-sm mb-4">
                {reveal.message}
              </p>
              <button
                onClick={() => getSocket().emit("next-round")}
                className="neon-btn neon-btn-purple w-full text-xs"
              >
                {currentRound >= totalRounds
                  ? "See Final Results"
                  : "Next Round →"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── MAIN GAME PAGE ───
export default function GamePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const gameType = searchParams.get("gameType") || "";
  const groupId = searchParams.get("groupId") || "";
  const gameMode = searchParams.get("gameMode") || "classic";
  const router = useRouter();
  const [gameOver, setGameOver] = useState(false);
  const [gameOverData, setGameOverData] = useState<any>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    if (groupId) socket.emit("set-group-id", { groupId });

    socket.on("game-over", (data: any) => {
      setGameOver(true);
      setGameOverData(data);
    });
    socket.on("game-ended", () => router.push(`/group/${groupId}`));
    socket.on("back-to-lobby", () =>
      router.push(`/lobby/${sessionId}?groupId=${groupId}`),
    );

    if (!started) {
      setTimeout(() => {
        socket.emit("next-round");
        setStarted(true);
      }, 1500);
    }

    // Cleanup on tab close / navigation
    const handleBeforeUnload = () => {
      socket.emit("leave-lobby");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      socket.emit("leave-lobby");
      socket.off("game-over");
      socket.off("game-ended");
      socket.off("back-to-lobby");
    };
  }, [started, groupId, sessionId]);

  const GAME_TITLES: Record<string, string> = {
    "overrated-underrated": "Overrated / Underrated",
    "guess-impostor": "Guess the Impostor",
    "five-second": "5 Second Challenge",
    "best-friend-test": "Best Friend Test",
    "most-likely-to": "Most Likely To",
    "liars-bar": "Liars Bar",
    "higher-or-lower": "Higher or Lower",
    "avoid-the-answer": "Avoid the Answer",
  };

  if (gameOver) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative">
        <FloatingBlobs />
        <div className="relative z-10 text-center max-w-md">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <h1 className="text-4xl font-black tracking-tighter uppercase mb-6">
              Game
              <span className="font-accent normal-case text-text-secondary italic">
                {" "}
                Over
              </span>
            </h1>
          </motion.div>
          {gameOverData?.scores &&
            Object.keys(gameOverData.scores).length > 0 && (
              <motion.div
                className="glass-card p-6 mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-4">
                  Scores
                </h2>
                {Object.entries(gameOverData.scores)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([name, score], i) => (
                    <div
                      key={name}
                      className="flex justify-between items-center py-2 border-b border-border last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-muted w-6">
                          {i === 0
                            ? "🥇"
                            : i === 1
                              ? "🥈"
                              : i === 2
                                ? "🥉"
                                : `${i + 1}.`}
                        </span>
                        <span className="text-sm font-semibold">{name}</span>
                      </div>
                      <span className="font-mono text-accent text-sm font-bold">
                        {score as number} pts
                      </span>
                    </div>
                  ))}
              </motion.div>
            )}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => getSocket().emit("play-again")}
              className="neon-btn neon-btn-purple w-full text-xs"
            >
              Play Again
            </button>
            <button
              onClick={() => router.push(`/group/${groupId}`)}
              className="neon-btn neon-btn-outline w-full text-xs"
            >
              Back to Group
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-12 relative">
      <FloatingBlobs />
      <div className="max-w-xl mx-auto relative z-10">
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-bg-card border border-border text-xs text-text-secondary uppercase tracking-wider">
            {GAME_TITLES[gameType] || "Game"}
            {gameMode && gameMode !== "classic" && (
              <span className="px-1.5 py-0.5 rounded-full bg-accent/20 text-accent text-[10px] font-semibold">
                {gameMode.replace(/-/g, " ")}
              </span>
            )}
          </div>
        </motion.div>
        <AnimatePresence mode="wait">
          {gameType === "overrated-underrated" && <OverratedUnderratedGame />}
          {gameType === "guess-impostor" && <ImpostorGame />}
          {gameType === "five-second" && <FiveSecondGame />}
          {gameType === "best-friend-test" && <BestFriendTestGame />}
          {gameType === "most-likely-to" && <MostLikelyToGame />}
          {gameType === "liars-bar" && <LiarsBarGame />}
          {gameType === "higher-or-lower" && <HigherOrLowerGame />}
          {gameType === "avoid-the-answer" && <AvoidTheAnswerGame />}
        </AnimatePresence>
      </div>
    </main>
  );
}
