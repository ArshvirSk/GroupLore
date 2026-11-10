import { supabase } from "../../lib/supabase.js";
import { pickRandom } from "../../utils/helpers.js";

/**
 * LIARS BAR
 * One player per round gets a real fact and a fake fact.
 * They choose which to present. Group votes: Truth or Lie?
 * Liar scores if majority is fooled, group scores if they catch it.
 */

const TOTAL_ROUNDS = 5;

const FAKE_TEMPLATES = [
  "once won a hot dog eating contest",
  "has a secret talent for yodeling",
  "accidentally called their teacher 'mom'",
  "got chased by a goose at the park",
  "once ate cereal with orange juice",
  "sleep-walked into a neighbor's house",
  "cried during a car insurance commercial",
  "got lost in IKEA for 2 hours",
  "has a hidden collection of rubber ducks",
  "once wore two different shoes all day",
  "accidentally liked a 3-year-old post while stalking",
  "has been banned from a trampoline park",
];

export const handleLiarsBar = {
  async nextRound(io, sessionId, room) {
    const state = room.gameState || {
      round: 0,
      liarId: null,
      presentedFact: null,
      isLie: false,
      votes: new Map(),
      scores: {},
      usedPlayers: [],
    };

    state.round++;
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

    // Pick the liar (rotate through players)
    const playerIds = Array.from(room.players.keys());
    const availablePlayers = playerIds.filter(
      (id) => !state.usedPlayers.includes(id),
    );
    const liarId =
      availablePlayers.length > 0
        ? pickRandom(availablePlayers)
        : pickRandom(playerIds);
    state.usedPlayers.push(liarId);
    state.liarId = liarId;

    const liarPlayer = room.players.get(liarId);

    // Fetch a real fact about the liar
    const { data: profiles } = await supabase
      .from("member_profiles")
      .select("*")
      .eq("group_id", room.groupId);

    // Find this player's profile by name match
    const liarProfile = profiles?.find(
      (p) =>
        p.display_name.toLowerCase() === liarPlayer.displayName.toLowerCase(),
    );

    let realFacts = [];
    if (liarProfile) {
      for (const t of liarProfile.traits || []) realFacts.push(t);
      for (const h of liarProfile.habits || []) realFacts.push(h);
      for (const m of liarProfile.iconic_moments || []) realFacts.push(m);
    }

    const realFact =
      realFacts.length > 0
        ? pickRandom(realFacts)
        : "enjoys hanging out with friends";
    const fakeFact = pickRandom(FAKE_TEMPLATES);

    room.gameState = state;

    // Send to the liar — they choose which to present
    io.to(liarId).emit("liars-your-turn", {
      round: state.round,
      totalRounds: TOTAL_ROUNDS,
      realFact,
      fakeFact,
      instruction:
        "Choose one to present to the group. They'll vote Truth or Lie!",
    });

    // Tell everyone else to wait
    for (const [sid] of room.players) {
      if (sid !== liarId) {
        io.to(sid).emit("liars-waiting", {
          round: state.round,
          totalRounds: TOTAL_ROUNDS,
          liarName: liarPlayer.displayName,
          message: `${liarPlayer.displayName} is preparing their statement...`,
        });
      }
    }
  },

  // Liar submits their chosen statement
  submitAnswer(io, socket, sessionId, room, { statement, isLie }) {
    const state = room.gameState;
    if (!state || socket.id !== state.liarId) return;

    state.presentedFact = statement;
    state.isLie = isLie;

    const liarPlayer = room.players.get(state.liarId);

    // Show statement to everyone for voting
    for (const [sid] of room.players) {
      if (sid !== state.liarId) {
        io.to(sid).emit("liars-vote", {
          round: state.round,
          totalRounds: TOTAL_ROUNDS,
          liarName: liarPlayer.displayName,
          statement: state.presentedFact,
        });
      }
    }

    // Liar waits
    io.to(state.liarId).emit("liars-wait-for-votes", {
      statement: state.presentedFact,
      message: "Waiting for the group to vote...",
    });
  },

  submitVote(io, socket, sessionId, room, { vote }) {
    const state = room.gameState;
    if (!state || socket.id === state.liarId) return;
    if (state.votes.has(socket.id)) return;

    state.votes.set(socket.id, vote); // 'truth' or 'lie'

    const voterCount = room.players.size - 1; // exclude liar

    io.to(sessionId).emit("vote-count", {
      totalVotes: state.votes.size,
      totalPlayers: voterCount,
    });

    // All voted
    if (state.votes.size >= voterCount) {
      let truthVotes = 0;
      let lieVotes = 0;
      for (const v of state.votes.values()) {
        if (v === "truth") truthVotes++;
        else lieVotes++;
      }

      const groupCorrect = state.isLie
        ? lieVotes > truthVotes
        : truthVotes > lieVotes;

      const liarPlayer = room.players.get(state.liarId);

      // Score (keyed by displayName)
      if (groupCorrect) {
        // Group caught it — everyone except liar gets 1 point
        for (const [sid, player] of room.players) {
          if (sid !== state.liarId) {
            const name = player.displayName || sid;
            state.scores[name] = (state.scores[name] || 0) + 1;
          }
        }
      } else {
        // Liar fooled them — liar gets 2 points
        const liarName = liarPlayer?.displayName || state.liarId;
        state.scores[liarName] = (state.scores[liarName] || 0) + 2;
      }

      io.to(sessionId).emit("vote-results", {
        statement: state.presentedFact,
        wasLie: state.isLie,
        groupCorrect,
        truthVotes,
        lieVotes,
        liarName: liarPlayer?.displayName || "Unknown",
        scores: state.scores,
        round: state.round,
        totalRounds: TOTAL_ROUNDS,
      });
    }
  },
};
