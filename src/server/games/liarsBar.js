import { createRequire } from "node:module";
import { allVoted } from "../engine/primitives/vote.js";

const require = createRequire(import.meta.url);
const PROMPTS = require("../data/prompts/liarsBar.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Five statements, twenty seconds to choose and vote",
    rounds: 5,
    chooseMs: 20_000,
    voteMs: 20_000,
    revealMs: 9_000,
  },
  quick: {
    label: "Quick",
    description: "Three faster rounds",
    rounds: 3,
    chooseMs: 15_000,
    voteMs: 15_000,
    revealMs: 7_000,
  },
};

function failure(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function configFor(mode) {
  return MODES[mode] || MODES.classic;
}

function activePlayers(room) {
  return [...room.players.values()].filter((player) => player.connected);
}

function voters(room, state) {
  return activePlayers(room).filter((player) => player.id !== state.liarId);
}

function choosePrompt(state) {
  if (state.usedPromptIds.length >= PROMPTS.length) state.usedPromptIds = [];
  let index = Math.floor(Math.random() * PROMPTS.length);
  let guard = 0;
  while (state.usedPromptIds.includes(PROMPTS[index].id) && guard < 500) {
    index = Math.floor(Math.random() * PROMPTS.length);
    guard += 1;
  }
  state.usedPromptIds.push(PROMPTS[index].id);
  return PROMPTS[index];
}

function beginRound(room, state) {
  const config = configFor(room.mode);
  const active = activePlayers(room).sort((a, b) => a.joinedAt - b.joinedAt);
  if (active.length < 2) {
    state.done = true;
    return;
  }

  state.round += 1;
  state.phase = "choose";
  state.liarId = active[(state.round - 1) % active.length].id;
  state.prompt = choosePrompt(state);
  state.choice = null;
  state.votes = {};
  state.reveal = null;
  state.endsAt = Date.now() + config.chooseMs;
}

function startVote(room, state, choice) {
  state.choice = choice === "lie" ? "lie" : "truth";
  state.phase = "vote";
  state.endsAt = Date.now() + configFor(room.mode).voteMs;
}

function resolveVote(room, state) {
  const eligible = voters(room, state);
  const validVotes = Object.fromEntries(
    Object.entries(state.votes).filter(
      ([voterId, value]) =>
        room.players.has(voterId) &&
        voterId !== state.liarId &&
        (value === "truth" || value === "lie"),
    ),
  );
  let truthVotes = 0;
  let lieVotes = 0;
  for (const value of Object.values(validVotes)) {
    if (value === "truth") truthVotes += 1;
    else lieVotes += 1;
  }

  const wasLie = state.choice === "lie";
  const groupCorrect = wasLie ? lieVotes > truthVotes : truthVotes > lieVotes;
  const roundPoints = [];

  if (groupCorrect) {
    for (const player of eligible) {
      room.scores[player.id] = Number(room.scores[player.id] || 0) + 1;
      roundPoints.push({ playerId: player.id, name: player.name, points: 1 });
    }
  } else if (state.liarId && room.players.has(state.liarId)) {
    room.scores[state.liarId] = Number(room.scores[state.liarId] || 0) + 2;
    roundPoints.push({
      playerId: state.liarId,
      name: room.players.get(state.liarId)?.name || "Player",
      points: 2,
    });
  }

  state.reveal = {
    truth: state.prompt.truth,
    lie: state.prompt.lie,
    statement: state.choice === "lie" ? state.prompt.lie : state.prompt.truth,
    wasLie,
    groupCorrect,
    truthVotes,
    lieVotes,
    liarId: state.liarId,
    liarName: room.players.get(state.liarId)?.name || "Player",
    voters: Object.entries(validVotes).map(([voterId, value]) => ({
      playerId: voterId,
      name: room.players.get(voterId)?.name || "Player",
      value,
    })),
    roundPoints,
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(room.mode).revealMs;
}

const liarsBar = {
  id: "liars-bar",
  name: "Liars Bar",
  description: "One player picks a statement, then the group decides: truth or lie?",
  emoji: "🍸",
  accent: "dark",
  minPlayers: 3,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const state = {
      phase: "choose",
      round: 0,
      rounds: configFor(room.mode).rounds,
      liarId: null,
      prompt: null,
      choice: null,
      votes: {},
      reveal: null,
      usedPromptIds: [],
      done: false,
      endsAt: null,
    };
    room.state = state;
    beginRound(room, state);
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";

    if (state.phase === "choose" && event.type === "choose") {
      if (playerId !== state.liarId) {
        throw failure("not_storyteller", "Only the storyteller chooses a statement");
      }
      if (state.choice) {
        throw failure("already_chosen", "You already chose a statement");
      }
      const choice = String(event.value || "");
      if (choice !== "truth" && choice !== "lie") {
        throw failure("invalid_choice", "Choose truth or lie");
      }
      startVote(room, state, choice);
      return;
    }

    if (state.phase === "vote" && event.type === "vote") {
      if (playerId === state.liarId) {
        throw failure("storyteller_cannot_vote", "The storyteller waits for the group");
      }
      if (state.votes[playerId] !== undefined) {
        throw failure("already_voted", "You already voted");
      }
      const value = String(event.value || "");
      if (value !== "truth" && value !== "lie") {
        throw failure("invalid_vote", "Choose truth or lie");
      }
      state.votes[playerId] = value;
      if (allVoted(voters(room, state), state.votes)) {
        resolveVote(room, state);
      }
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";

    if (state.phase === "choose") {
      startVote(room, state, "truth");
      return;
    }
    if (state.phase === "vote") {
      resolveVote(room, state);
      return;
    }
    if (state.phase === "reveal") {
      if (state.round >= state.rounds) {
        state.done = true;
        return "results";
      }
      beginRound(room, state);
    }
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.votes[playerId];

    if (playerId === state.liarId || activePlayers(room).length < 3) {
      state.done = true;
      return "results";
    }
    if (state.phase === "vote" && allVoted(voters(room, state), state.votes)) {
      resolveVote(room, state);
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const isLiar = state.liarId === viewerId;
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      mode: room.mode,
      isStoryteller: isLiar,
    };

    if (state.phase === "choose") {
      return isLiar
        ? { ...base, prompt: { truth: state.prompt.truth, lie: state.prompt.lie } }
        : { ...base, waiting: true };
    }

    if (state.phase === "vote") {
      return {
        ...base,
        statement:
          state.choice === "lie" ? state.prompt.lie : state.prompt.truth,
        submitted: Object.keys(state.votes).length,
        total: voters(room, state).length,
        myVote: state.votes[viewerId] || null,
      };
    }

    return {
      ...base,
      statement: state.reveal?.statement || "",
      reveal: state.reveal,
    };
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      mode: room.mode,
    };
    if (state.phase === "choose") return base;
    if (state.phase === "vote") {
      return {
        ...base,
        statement:
          state.choice === "lie" ? state.prompt.lie : state.prompt.truth,
        submitted: Object.keys(state.votes).length,
        total: voters(room, state).length,
      };
    }
    return { ...base, statement: state.reveal?.statement || "", reveal: state.reveal };
  },
};

export default liarsBar;
