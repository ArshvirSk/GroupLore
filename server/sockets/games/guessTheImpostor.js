import { supabase } from "../../lib/supabase.js";
import { pickRandom, shuffle } from "../../utils/helpers.js";

/**
 * GUESS THE IMPOSTOR
 * All players get a prompt except the impostor. Everyone submits answers,
 * then votes on who they think the impostor is.
 *
 * Modes:
 *  - classic: 1 impostor, 30s discussion
 *  - double-agent: 2 impostors (need 4+ players)
 *  - blind: skip discussion, go straight to vote
 */

const TOTAL_ROUNDS = 3;

export const handleImpostor = {
  async nextRound(io, sessionId, room) {
    const state = room.gameState || {
      round: 0,
      phase: null, // 'answer' | 'discussion' | 'vote' | 'reveal'
      impostorId: null,
      prompt: null,
      answers: new Map(),
      votes: new Map(),
      scores: {},
    };

    state.round++;
    state.phase = "answer";
    state.answers = new Map();
    state.votes = new Map();

    if (state.round > TOTAL_ROUNDS) {
      // Mark session as finished in DB
      supabase
        .from("game_sessions")
        .update({ status: "finished" })
        .eq("id", sessionId)
        .then();
      io.to(sessionId).emit("game-over", {
        message: "All rounds complete!",
        scores: state.scores,
      });
      return;
    }

    // Pick impostor(s)
    const mode = room.gameMode || "classic";
    const playerIds = Array.from(room.players.keys());
    const impostorCount = (mode === "double-agent" && playerIds.length >= 4) ? 2 : 1;
    const impostorIds = [];
    const available = [...playerIds];
    for (let i = 0; i < impostorCount; i++) {
      const idx = Math.floor(Math.random() * available.length);
      impostorIds.push(available.splice(idx, 1)[0]);
    }
    state.impostorId = impostorIds[0]; // primary impostor for vote resolution
    state.impostorIds = impostorIds;   // all impostors

    // Pick a prompt
    const { data: profiles } = await supabase
      .from("member_profiles")
      .select("*")
      .eq("group_id", room.groupId);

    let prompt = "Something everyone in the group would know";
    if (profiles && profiles.length > 0) {
      const allItems = [];
      for (const p of profiles) {
        for (const t of p.traits || [])
          allItems.push(`${p.display_name}'s trait: ${t}`);
        for (const h of p.habits || [])
          allItems.push(`${p.display_name}'s habit: ${h}`);
        for (const m of p.iconic_moments || [])
          allItems.push(`Iconic moment: ${m}`);
      }
      if (allItems.length > 0) prompt = pickRandom(allItems);
    }

    state.prompt = prompt;
    room.gameState = state;

    // Send prompt to everyone except impostor(s)
    for (const [socketId, player] of room.players) {
      const isImpostor = state.impostorIds.includes(socketId);
      io.to(socketId).emit("impostor-round", {
        round: state.round,
        totalRounds: TOTAL_ROUNDS,
        isImpostor,
        prompt: isImpostor ? null : prompt,
        phase: "answer",
        mode,
      });
    }
  },

  submitAnswer(io, socket, sessionId, room, { answer }) {
    const state = room.gameState;
    if (!state || state.phase !== "answer") return;

    state.answers.set(socket.id, answer);

    if (state.answers.size >= room.players.size) {
      // All answers in — move to discussion
      state.phase = "discussion";

      const answersArr = [];
      for (const [sid, ans] of state.answers) {
        const player = room.players.get(sid);
        answersArr.push({
          socketId: sid,
          displayName: player?.displayName || "Unknown",
          answer: ans,
        });
      }

      io.to(sessionId).emit("impostor-discussion", {
        answers: shuffle(answersArr),
        phase: "discussion",
      });

      // Blind mode: skip discussion, go straight to vote
      const mode = room.gameMode || "classic";
      if (mode === "blind") {
        state.phase = "vote";
        io.to(sessionId).emit("impostor-vote-phase", { phase: "vote" });
      } else {
        // Auto-move to vote after 30 seconds
        setTimeout(() => {
          if (state.phase === "discussion") {
            state.phase = "vote";
            io.to(sessionId).emit("impostor-vote-phase", { phase: "vote" });
          }
        }, 30000);
      }
    }
  },

  submitVote(io, socket, sessionId, room, { targetSocketId }) {
    const state = room.gameState;
    if (!state || (state.phase !== "vote" && state.phase !== "discussion"))
      return;

    // Can't vote for yourself
    if (targetSocketId === socket.id) {
      socket.emit("error-message", { message: "You can't vote for yourself!" });
      return;
    }

    state.votes.set(socket.id, targetSocketId);

    io.to(sessionId).emit("vote-count", {
      totalVotes: state.votes.size,
      totalPlayers: room.players.size,
    });

    if (state.votes.size >= room.players.size) {
      // Tally votes
      state.phase = "reveal";
      const voteCounts = {};
      for (const target of state.votes.values()) {
        voteCounts[target] = (voteCounts[target] || 0) + 1;
      }

      // Find most voted
      let maxVotes = 0;
      let accused = null;
      for (const [sid, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) {
          maxVotes = count;
          accused = sid;
        }
      }

      const impostorCaught = state.impostorIds.includes(accused);
      const impostorPlayer = room.players.get(state.impostorId);
      const accusedPlayer = room.players.get(accused);

      // Update scores (keyed by displayName)
      if (impostorCaught) {
        // Everyone except impostors gets a point
        for (const [sid, player] of room.players) {
          if (!state.impostorIds.includes(sid)) {
            const name = player.displayName || sid;
            state.scores[name] = (state.scores[name] || 0) + 1;
          }
        }
      } else {
        // Impostor(s) get 2 points each
        for (const iid of state.impostorIds) {
          const ip = room.players.get(iid);
          const impostorName = ip?.displayName || iid;
          state.scores[impostorName] = (state.scores[impostorName] || 0) + 2;
        }
      }

      const impostorNames = state.impostorIds.map(
        (id) => room.players.get(id)?.displayName || "Unknown"
      );

      io.to(sessionId).emit("impostor-reveal", {
        impostorId: state.impostorId,
        impostorIds: state.impostorIds,
        impostorName: impostorPlayer?.displayName || "Unknown",
        impostorNames,
        accusedId: accused,
        accusedName: accusedPlayer?.displayName || "Unknown",
        impostorCaught,
        voteCounts,
        prompt: state.prompt,
        scores: state.scores,
        round: state.round,
        totalRounds: TOTAL_ROUNDS,
      });
    }
  },
};
