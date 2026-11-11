"use client";

import { useAuth } from "@/components/AuthProvider";
import FloatingBlobs from "@/components/FloatingBlobs";
import UserMenu from "@/components/UserMenu";
import { api } from "@/lib/api";
import { groupEntryPath } from "@/lib/play";
import { useUserStore } from "@/stores/userStore";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

// Mock game cards for the interactive Lore Card Arena Simulator
interface MockCard {
  id: string;
  question: string;
  promptType: string;
  answers: {
    player: string;
    text: string;
    votes: number;
    tag: string;
    avatarBg: string;
  }[];
}

const MOCK_CARDS: MockCard[] = [
  {
    id: "card-1",
    question: "Who has the absolute worst playlist but is never allowed near the AUX?",
    promptType: "AUX Privilege Review",
    answers: [
      { player: "Alex", text: "Queued active acoustic bluegrass at a rave once.", votes: 4, tag: "Aux Menace", avatarBg: "bg-red-500/10 text-red-400 border-red-500/20" },
      { player: "Sarah", text: "Her 'Chill Vibe' playlist is literally aggressive speed metal.", votes: 2, tag: "NPC Energy", avatarBg: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
      { player: "Jordan", text: "Only plays royalty-free elevator jazz to 'set the tone.'", votes: 1, tag: "Chaos Agent", avatarBg: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    ],
  },
  {
    id: "card-2",
    question: "What is the most unhinged side-quest [Name] has dragged the squad on?",
    promptType: "Side Quest Audit",
    answers: [
      { player: "Sarah", text: "Convinced us to hike 4 miles at midnight to find a 'haunted bench' that was just a bus stop.", votes: 5, tag: "Villain Arc", avatarBg: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
      { player: "Alex", text: "Made us wait 3 hours in a loading dock to buy a vintage taxidermy squirrel.", votes: 1, tag: "Side Character", avatarBg: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
      { player: "Taylor", text: "Forced the group to audit a community college lecture for free cookies.", votes: 2, tag: "Delulu Leader", avatarBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    ],
  },
  {
    id: "card-3",
    question: "Who is most likely to leave the group chat on read for three business days?",
    promptType: "Response Rate Check",
    answers: [
      { player: "Taylor", text: "Will post active Instagram stories but won't answer the crisis text.", votes: 6, tag: "Silent Operator", avatarBg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
      { player: "Jordan", text: "Has over 400 unread messages and proud of the digital hoard.", votes: 2, tag: "Offline Vibe", avatarBg: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
      { player: "Sarah", text: "Answers instantly but only with the passive-aggressive thumbs-up emoji.", votes: 1, tag: "Yapper Critic", avatarBg: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
    ],
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { isSignedIn, displayName } = useAuth();
  const { dbUserId } = useUserStore();
  
  const [mode, setMode] = useState<"home" | "create" | "join">("home");
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Simulator Interactive States
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [simulationVotes, setSimulationVotes] = useState<number[]>([]);
  const [isLobbyJoining, setIsLobbyJoining] = useState(false);
  const [simulatedPlayers, setSimulatedPlayers] = useState([
    { name: "Alex", status: "Active", tag: "Aux Menace", ping: true },
    { name: "Sarah", status: "Typing...", tag: "Villain Arc", ping: false },
    { name: "Jordan", status: "Active", tag: "Chaos Agent", ping: true },
  ]);

  const activeCard = MOCK_CARDS[activeCardIndex];

  // Initialize/reset card simulation votes
  useEffect(() => {
    if (activeCard) {
      setSimulationVotes(activeCard.answers.map(a => a.votes));
      setSelectedAnswerIndex(null);
    }
  }, [activeCardIndex]);

  // Simulating user voting
  const handleSimulatedVote = (index: number) => {
    if (selectedAnswerIndex !== null) return; // Allow only one vote in the interactive demo
    setSelectedAnswerIndex(index);
    setSimulationVotes(prev => {
      const copy = [...prev];
      copy[index] += 1;
      return copy;
    });

    // Animate mock player joining lobby as easter egg
    setIsLobbyJoining(true);
    setTimeout(() => {
      setSimulatedPlayers(prev => {
        if (prev.some(p => p.name === "You")) return prev;
        return [...prev, { name: "You", status: "Active", tag: "Lore Keeper", ping: true }];
      });
      setIsLobbyJoining(false);
    }, 1200);
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      setError("Give your group a name!");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const group = await api.createGroup({
        name: groupName.trim(),
      });
      router.push(`/group/${group.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the group");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim() || joinCode.trim().length !== 6) {
      setError("Enter a valid 6-character code!");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const group = await api.joinGroup({
        joinCode: joinCode.trim().toUpperCase(),
      });
      router.push(await groupEntryPath(group.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join the group");
    } finally {
      setLoading(false);
    }
  };

  // Randomized group name generator
  const triggerRandomName = () => {
    const names = [
      "The Chaos Crew",
      "Vibe Check HQ",
      "Main Characters",
      "The Plot Twist",
      "No Context Squad",
      "The Unhinged",
      "Certified Yappers",
      "The Lore Keepers",
      "NPC Energy",
      "Side Quest Society",
      "The Villain Arc",
      "Damage Control",
      "Emotional Support Group",
      "Trust Issues Inc",
      "The Glow Up Gang",
      "Caught in 4K",
      "The Delulu Club",
      "Zero Braincells",
      "The Flop Era",
      "Unfiltered & Unhinged",
      "The Backbenchers",
      "Loud & Wrong",
      "The Inner Circle",
      "Menace to Society",
    ];
    setGroupName(names[Math.floor(Math.random() * names.length)]);
    setError("");
  };

  return (
    <main className="min-h-screen cosmic-bg flex flex-col relative overflow-hidden bg-[#050505]">
      <FloatingBlobs />

      {/* Luxury Immersive Glass Header */}
      <header className="w-full sticky top-0 z-50 bg-[#050505]/40 backdrop-blur-md border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <LinkButton onClick={() => setMode("home")} className="flex items-center gap-2 cursor-pointer">
            <span className="text-2xl font-black tracking-tight text-white uppercase">
              GROUP
              <span className="font-accent normal-case text-violet-400 italic ml-1">
                Lore
              </span>
            </span>
          </LinkButton>
          
          <div className="flex items-center gap-4">
            {isSignedIn ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 hidden sm:inline-block font-medium">
                  {displayName}
                </span>
                <UserMenu />
              </div>
            ) : (
              <button
                onClick={() => router.push("/sign-in")}
                className="text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors duration-200"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Column Layout */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-12 md:py-20 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
        
        {/* Left Pane - Narrative Hero & Room Control Deck */}
        <motion.div
          className="lg:col-span-6 space-y-8"
          initial={{ opacity: 0, x: -35 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Main Title Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs font-semibold text-violet-400 tracking-wide uppercase">
            <span>✨ Personalized Party Game</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl sm:text-7xl font-black tracking-tighter text-white leading-none uppercase">
              YOUR CREW, <br />
              <span className="bg-gradient-to-r from-violet-400 via-purple-300 to-indigo-200 bg-clip-text text-transparent">
                YOUR LORE.
              </span>
            </h1>
            <p className="text-zinc-400 text-lg sm:text-xl font-light tracking-tight max-w-lg leading-relaxed">
              Inside jokes, embarrassing habits, and iconic callouts turned into dynamic, unhinged party multiplayer chaos. Dealt straight to your phones.
            </p>
          </div>

          {/* Form State Controller: SignedOut and SignedIn Deck */}
          <div className="relative max-w-md">
            
            {/* Not Signed In Deck */}
            {!isSignedIn && (
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  onClick={() => router.push("/sign-up")}
                  className="w-full sm:w-auto px-8 py-4 rounded-full bg-violet-600 hover:bg-violet-500 text-white font-bold uppercase tracking-wider text-xs border border-violet-500/40 shadow-[0_0_25px_rgba(139,92,246,0.25)] hover:shadow-[0_0_35px_rgba(139,92,246,0.4)] transition-all duration-300"
                >
                  Create Crew Account
                </button>
                <button
                  onClick={() => router.push("/sign-in")}
                  className="w-full sm:w-auto px-8 py-4 rounded-full bg-transparent text-zinc-300 hover:text-white font-bold uppercase tracking-wider text-xs border border-white/10 hover:border-white/30 hover:bg-white/5 transition-all duration-300"
                >
                  Sign In
                </button>
                <button
                  onClick={() => router.push("/guest")}
                  className="w-full px-8 py-4 rounded-full bg-transparent text-zinc-400 hover:text-white font-bold uppercase tracking-wider text-xs border border-dashed border-white/15 hover:border-white/30 hover:bg-white/5 transition-all duration-300 sm:w-auto"
                >
                  Continue as guest →
                </button>
              </div>
            )}

            {/* Signed In Deck */}
            {isSignedIn && (
              <AnimatePresence mode="wait">
                {mode === "home" && (
                  <motion.div
                    key="home-controls"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col sm:flex-row gap-3"
                  >
                    <button
                      onClick={() => setMode("create")}
                      className="px-8 py-4 rounded-full bg-violet-600 hover:bg-violet-500 text-white font-bold uppercase tracking-wider text-xs border border-violet-500/40 shadow-[0_0_20px_rgba(139,92,246,0.2)] hover:shadow-[0_0_30px_rgba(139,92,246,0.35)] transition-all duration-300 cursor-pointer"
                    >
                      Create Group
                    </button>
                    <button
                      onClick={() => setMode("join")}
                      className="px-8 py-4 rounded-full bg-transparent text-zinc-300 hover:text-white font-bold uppercase tracking-wider text-xs border border-white/10 hover:border-white/30 hover:bg-white/5 transition-all duration-300 cursor-pointer"
                    >
                      Join Group
                    </button>
                    {dbUserId && (
                      <button
                        onClick={() => router.push("/dashboard")}
                        className="px-8 py-4 rounded-full bg-transparent text-violet-400 hover:text-violet-300 font-bold uppercase tracking-wider text-xs border border-violet-500/10 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all duration-300 cursor-pointer"
                      >
                        My Groups
                      </button>
                    )}
                  </motion.div>
                )}

                {/* Create Group Form Pod */}
                {mode === "create" && (
                  <motion.div
                    key="create-controls"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="glass-card p-6 border border-white/5 bg-[#0f0f12]/80 backdrop-blur-md rounded-2xl space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-white tracking-tight">Create Your Crew</h3>
                      <button
                        onClick={() => setMode("home")}
                        className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    
                    <div className="relative">
                      <input
                        className="neon-input w-full pr-12 text-sm bg-black/40 border border-white/5 hover:border-white/10 focus:border-violet-500/50 rounded-xl"
                        placeholder="e.g. The Chaos Crew"
                        value={groupName}
                        onChange={(e) => {
                          setGroupName(e.target.value);
                          setError("");
                        }}
                        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={triggerRandomName}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition-all duration-200 cursor-pointer"
                        title="Random name"
                      >
                        {/* 3D Looking Vector Dice */}
                        <svg className="w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                          <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" />
                          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                        </svg>
                      </button>
                    </div>

                    {error && <p className="text-red-400 text-xs font-semibold">{error}</p>}
                    
                    <button
                      onClick={handleCreate}
                      className="w-full px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase tracking-wider border border-violet-500/30 transition-all duration-300 disabled:opacity-50 cursor-pointer"
                      disabled={loading}
                    >
                      {loading ? "Initializing..." : "Create Group →"}
                    </button>
                  </motion.div>
                )}

                {/* Join Group Form Pod */}
                {mode === "join" && (
                  <motion.div
                    key="join-controls"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="glass-card p-6 border border-white/5 bg-[#0f0f12]/80 backdrop-blur-md rounded-2xl space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-white tracking-tight">Join Existing Lobby</h3>
                      <button
                        onClick={() => setMode("home")}
                        className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    <input
                      className="neon-input text-center text-xl tracking-[0.3em] uppercase font-mono bg-black/40 border border-white/5 hover:border-white/10 focus:border-violet-500/50 rounded-xl"
                      placeholder="LOREX"
                      maxLength={6}
                      value={joinCode}
                      onChange={(e) => {
                        setJoinCode(e.target.value.toUpperCase());
                        setError("");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                      autoFocus
                    />

                    {error && <p className="text-red-400 text-xs font-semibold">{error}</p>}

                    <button
                      onClick={handleJoin}
                      className="w-full px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase tracking-wider border border-violet-500/30 transition-all duration-300 disabled:opacity-50 cursor-pointer"
                      disabled={loading}
                    >
                      {loading ? "Joining Room..." : "Join Game →"}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </motion.div>

        {/* Right Pane - The Interactive Lore Card Arena Simulator */}
        <motion.div
          className="lg:col-span-6 relative"
          initial={{ opacity: 0, x: 35 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Main Glass Console Wrapper */}
          <div className="relative border border-white/5 bg-[#0a0a0c]/90 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden">
            
            {/* Top Bar simulated dots */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/40" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
              </div>
              <div className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
                Console Arena // Active Sim
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-mono text-emerald-400">Ready</span>
              </div>
            </div>

            {/* Split Screen Simulator */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Simulator Left Column - Player Lobby Status */}
              <div className="md:col-span-4 space-y-4">
                <div className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">
                  Connected Crew
                </div>
                <div className="space-y-2">
                  {simulatedPlayers.map((p, i) => (
                    <div
                      key={p.name}
                      className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5 hover:border-violet-500/10 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${p.ping ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"}`} />
                        <span className="text-xs font-bold text-zinc-300">{p.name}</span>
                      </div>
                      <span className="text-[8px] font-mono font-semibold px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        {p.tag}
                      </span>
                    </div>
                  ))}
                  {isLobbyJoining && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-violet-500/5 border border-violet-500/20 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping" />
                      <span className="text-[10px] text-violet-300">You are entering...</span>
                    </div>
                  )}
                </div>

                {/* Deck Select tabs */}
                <div className="pt-4 border-t border-white/5 space-y-2">
                  <div className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">
                    Select Lore Card
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {MOCK_CARDS.map((card, idx) => (
                      <button
                        key={card.id}
                        onClick={() => setActiveCardIndex(idx)}
                        className={`text-left text-[11px] font-medium px-2.5 py-2 rounded-lg border transition-all duration-200 cursor-pointer ${
                          activeCardIndex === idx
                            ? "bg-violet-500/10 border-violet-500/30 text-white shadow-[0_0_10px_rgba(139,92,246,0.1)]"
                            : "bg-transparent border-transparent text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {card.promptType}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Simulator Right Column - Lore Card Felt Arena */}
              <div className="md:col-span-8 space-y-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeCard.id}
                    initial={{ opacity: 0, y: 15, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -15, scale: 0.97 }}
                    transition={{ duration: 0.4 }}
                    className="glass-card p-5 border border-violet-500/20 bg-gradient-to-br from-violet-950/20 to-zinc-950 rounded-2xl space-y-4 shadow-[0_10px_30px_rgba(139,92,246,0.05)]"
                  >
                    {/* Prompt Header */}
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono tracking-widest text-violet-400 uppercase font-semibold">
                        {activeCard.promptType}
                      </span>
                      <span className="text-[9px] font-mono text-zinc-500 font-bold">
                        Blind Ballot
                      </span>
                    </div>

                    {/* Question text */}
                    <h4 className="text-sm sm:text-base font-black text-white leading-snug tracking-tight">
                      {activeCard.question}
                    </h4>

                    {/* Answers / Options */}
                    <div className="space-y-2">
                      {activeCard.answers.map((answer, index) => {
                        const isSelected = selectedAnswerIndex === index;
                        const totalVotes = simulationVotes.reduce((sum, v) => sum + v, 0);
                        const percentage = totalVotes > 0 ? Math.round((simulationVotes[index] / totalVotes) * 100) : 0;

                        return (
                          <button
                            key={answer.player}
                            onClick={() => handleSimulatedVote(index)}
                            className={`w-full text-left p-3 rounded-xl border transition-all duration-300 relative overflow-hidden group cursor-pointer ${
                              isSelected
                                ? "bg-violet-600/10 border-violet-500/40 text-white"
                                : "bg-black/30 border-white/5 hover:border-white/10 text-zinc-300"
                            }`}
                          >
                            {/* Fill percentage background bar */}
                            {selectedAnswerIndex !== null && (
                              <motion.div
                                className="absolute left-0 top-0 bottom-0 bg-violet-500/10 z-0"
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 0.6 }}
                              />
                            )}

                            <div className="relative z-10 flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-white">{answer.player}</span>
                                  <span className={`text-[8px] font-mono px-1.5 rounded-full border ${answer.avatarBg}`}>
                                    {answer.tag}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-400 leading-normal">{answer.text}</p>
                              </div>
                              
                              {/* Display Votes/Percentage */}
                              {selectedAnswerIndex !== null ? (
                                <span className="text-xs font-mono font-bold text-violet-400 self-center">
                                  {percentage}%
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono text-zinc-500 group-hover:text-violet-400 self-center transition-colors">
                                  Vote
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Helper Prompt Info */}
                <div className="p-3 bg-zinc-900/40 rounded-xl border border-white/5">
                  <p className="text-[10px] text-zinc-500 text-center leading-relaxed">
                    💡 Click any crew response card above to vote. Cast a vote to see instant ballot metrics!
                  </p>
                </div>
              </div>

            </div>

          </div>
        </motion.div>

      </div>

      {/* Dynamic unhinged game features section */}
      <section className="w-full bg-[#08080a] border-t border-white/5 px-6 py-20 relative z-10">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
              HOW TO START <br className="sm:hidden" />
              <span className="bg-gradient-to-r from-violet-400 to-indigo-300 bg-clip-text text-transparent">THE CHAOS CYCLE</span>
            </h2>
            <p className="text-zinc-500 text-sm tracking-tight leading-relaxed">
              GroupLore dynamically translates your squad&apos;s memories into custom multiplayer party activities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Feature 1 */}
            <div className="glass-card p-6 border border-white/5 bg-[#0f0f12]/40 rounded-2xl space-y-4 group hover:border-violet-500/20 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 text-lg font-black font-mono">
                01
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">Anonymously Pool Content</h3>
              <p className="text-zinc-400 text-sm leading-relaxed tracking-tight font-light">
                Submit inside jokes, iconic quotes, or embarrassing habits using an anonymous, encrypted pool. No one knows who leaked the details.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="glass-card p-6 border border-white/5 bg-[#0f0f12]/40 rounded-2xl space-y-4 group hover:border-violet-500/20 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-lg font-black font-mono">
                02
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">Algorithmic Prompting</h3>
              <p className="text-zinc-400 text-sm leading-relaxed tracking-tight font-light">
                Our game engine synthesizes the inputs, generating unhinged prompt cards specifically targeted to reveal, roast, and call out your friends.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="glass-card p-6 border border-white/5 bg-[#0f0f12]/40 rounded-2xl space-y-4 group hover:border-violet-500/20 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center text-fuchsia-400 text-lg font-black font-mono">
                03
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">Multiplayer Ballot Revelations</h3>
              <p className="text-zinc-400 text-sm leading-relaxed tracking-tight font-light">
                Vote blindly on who matches the unhinged behavior card. Watch as votes reveal who is caught in 4K, building a hilarious, permanent lore book.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="w-full bg-[#050507] border-t border-white/5 px-6 py-8 relative z-10 text-center text-[10px] font-mono tracking-widest text-zinc-600 uppercase">
        © {new Date().getFullYear()} GroupLore Inc // Unhinged Squad Archives // Built on Next.js
      </footer>

      {/* Minimal bottom accent */}
      <div className="fixed bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent pointer-events-none" />
    </main>
  );
}

// Minimal inline button link helper to avoid next/link wrapper logic mismatch
function LinkButton({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button onClick={onClick} className={className} type="button">
      {children}
    </button>
  );
}
