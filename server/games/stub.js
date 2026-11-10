/**
 * Minimal two-round game used by the engine integration test and local
 * verification. It is always hidden from the lobby catalogue.
 */
const stub = {
  id: "engine-stub",
  name: "Engine Stub",
  description: "Internal engine verification game",
  hidden: true,
  minPlayers: 2,
  maxPlayers: 8,
  modes: {
    classic: {
      label: "Classic",
      description: "Two short rounds",
      rounds: 2,
      answerMs: 1500,
      revealMs: 250,
    },
    quick: {
      label: "Quick",
      description: "One short round",
      rounds: 1,
      answerMs: 1500,
      revealMs: 250,
    },
    timer: {
      label: "Timer",
      description: "One fast round for timer verification",
      rounds: 1,
      answerMs: 150,
      revealMs: 80,
    },
  },

  init(room, mode) {
    const config = this.modes[mode] || this.modes.classic;
    room.state = {
      phase: "answer",
      round: 1,
      rounds: config.rounds,
      answers: {},
      reveal: null,
      done: false,
      endsAt: Date.now() + config.answerMs,
    };
    return room.state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (state.phase !== "answer" || event.type !== "answer") return;
    if (state.answers[playerId] !== undefined) return;
    state.answers[playerId] = String(event.value ?? "").slice(0, 120);

    const active = [...room.players.values()].filter((player) => player.connected);
    if (active.every((player) => state.answers[player.id] !== undefined)) {
      state.endsAt = Date.now();
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (state.phase === "answer") {
      for (const playerId of Object.keys(state.answers)) {
        room.scores[playerId] = (room.scores[playerId] || 0) + 1;
      }
      state.reveal = {
        answers: Object.entries(state.answers).map(([playerId, value]) => ({
          playerId,
          name: room.players.get(playerId)?.name || "Player",
          value,
        })),
      };
      state.phase = "reveal";
      state.endsAt = Date.now() + (this.modes[room.mode] || this.modes.classic).revealMs;
      return;
    }

    if (state.round >= state.rounds) {
      state.done = true;
      return "results";
    }
    state.round += 1;
    state.phase = "answer";
    state.answers = {};
    state.reveal = null;
    state.endsAt =
      Date.now() + (this.modes[room.mode] || this.modes.classic).answerMs;
  },

  onPlayerLeave(room) {
    const state = room.state;
    if (!state) return;
    const active = [...room.players.values()].filter((player) => player.connected);
    if (
      state.phase === "answer" &&
      active.length > 0 &&
      active.every((player) => state.answers[player.id] !== undefined)
    ) {
      state.endsAt = Date.now();
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    return {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      answered: Object.keys(state.answers).length,
      total: room.players.size,
      answeredByMe: state.answers[viewerId] !== undefined,
      reveal: state.reveal,
    };
  },
};

export default stub;
