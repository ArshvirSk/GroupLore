import { shuffle } from "../utils/helpers.js";

const TTT_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function tttWinner(board) {
  for (const line of TTT_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

const ticTacToe = {
  type: "tic-tac-toe",
  label: "Tic-tac-toe",
  init(a, b) {
    return { type: "tic-tac-toe", a, b, board: Array(9).fill(null), turn: a, wins: { [a]: 0, [b]: 0 }, done: false, winnerId: null };
  },
  move(state, playerId, move) {
    if (state.done) return;
    if (state.turn !== playerId) throw new Error("Not your turn");
    const index = Number(move?.index);
    if (!Number.isInteger(index) || index < 0 || index > 8 || state.board[index]) {
      throw new Error("Pick an empty square");
    }
    state.board[index] = playerId;
    const winner = tttWinner(state.board);
    if (winner) {
      state.wins[winner] += 1;
      if (state.wins[winner] >= 2) {
        state.done = true;
        state.winnerId = winner;
      } else {
        state.board = Array(9).fill(null);
        state.turn = state.turn === state.a ? state.b : state.a;
      }
      return;
    }
    if (state.board.every(Boolean)) {
      state.board = Array(9).fill(null);
    }
    state.turn = state.turn === state.a ? state.b : state.a;
  },
  status(state) {
    return { done: state.done, winnerId: state.winnerId };
  },
  score(state, playerId) {
    return state.wins[playerId] || 0;
  },
  viewFor(state, viewerId) {
    return { type: state.type, board: state.board, turn: state.turn, youAre: viewerId, wins: state.wins };
  },
};

const connect4 = {
  type: "connect-four",
  label: "Connect Four",
  init(a, b) {
    return { type: "connect-four", a, b, board: Array.from({ length: 6 }, () => Array(7).fill(null)), turn: a, done: false, winnerId: null };
  },
  move(state, playerId, move) {
    if (state.done) return;
    if (state.turn !== playerId) throw new Error("Not your turn");
    const column = Number(move?.column);
    if (!Number.isInteger(column) || column < 0 || column > 6) throw new Error("Pick a column");
    const row = [...state.board].map((line) => line[column]).lastIndexOf(null);
    if (row < 0) throw new Error("That column is full");
    state.board[row][column] = playerId;
    const check = (r, c) => {
      if (state.board[r]?.[c] !== playerId) return false;
      for (const [dr, dc] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
        let count = 1;
        for (const direction of [1, -1]) {
          for (let step = 1; step < 4; step += 1) {
            if (state.board[r + dr * step * direction]?.[c + dc * step * direction] === playerId) count += 1;
            else break;
          }
        }
        if (count >= 4) return true;
      }
      return false;
    };
    if (check(row, column)) {
      state.done = true;
      state.winnerId = playerId;
    } else if (state.board.every((line) => line.every(Boolean))) {
      state.done = true;
    } else {
      state.turn = state.turn === state.a ? state.b : state.a;
    }
  },
  status(state) {
    return { done: state.done, winnerId: state.winnerId };
  },
  score(state, playerId) {
    return state.winnerId === playerId ? 1 : 0;
  },
  viewFor(state, viewerId) {
    return { type: state.type, board: state.board, turn: state.turn, youAre: viewerId };
  },
};

const rps = {
  type: "rock-paper-scissors",
  label: "Rock Paper Scissors",
  init(a, b) {
    return { type: "rock-paper-scissors", a, b, choices: {}, wins: { [a]: 0, [b]: 0 }, done: false, winnerId: null, reveal: null };
  },
  move(state, playerId, move) {
    if (state.done) return;
    const choice = String(move?.choice || "");
    if (!["rock", "paper", "scissors"].includes(choice)) throw new Error("Choose rock, paper or scissors");
    state.choices[playerId] = choice;
    if (state.choices[state.a] && state.choices[state.b]) {
      const a = state.choices[state.a];
      const b = state.choices[state.b];
      let winner = null;
      if (a !== b) {
        winner = (a === "rock" && b === "scissors") || (a === "paper" && b === "rock") || (a === "scissors" && b === "paper") ? state.a : state.b;
      }
      if (winner) state.wins[winner] += 1;
      state.reveal = { choices: { ...state.choices }, winner };
      state.choices = {};
      if (state.wins[state.a] >= 3 || state.wins[state.b] >= 3) {
        state.done = true;
        state.winnerId = state.wins[state.a] >= 3 ? state.a : state.b;
      }
    }
  },
  status(state) {
    return { done: state.done, winnerId: state.winnerId };
  },
  score(state, playerId) {
    return state.wins[playerId] || 0;
  },
  viewFor(state, viewerId) {
    return {
      type: state.type,
      wins: state.wins,
      myChoice: state.choices?.[viewerId] || null,
      reveal: state.reveal,
      youAre: viewerId,
    };
  },
};

function dotKey(type, row, column) {
  return `${type}:${row}:${column}`;
}

const dots = {
  type: "dots-and-boxes",
  label: "Dots and Boxes",
  init(a, b) {
    const edges = [];
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 2; column += 1) edges.push(dotKey("h", row, column));
    }
    for (let row = 0; row < 2; row += 1) {
      for (let column = 0; column < 3; column += 1) edges.push(dotKey("v", row, column));
    }
    return { type: "dots-and-boxes", a, b, edges: shuffle(edges), taken: {}, boxes: {}, turn: a, done: false, winnerId: null };
  },
  move(state, playerId, move) {
    if (state.done) return;
    if (state.turn !== playerId) throw new Error("Not your turn");
    const edge = String(move?.edge || "");
    if (!state.edges.includes(edge) || state.taken[edge]) throw new Error("Pick an open line");
    state.taken[edge] = playerId;
    const boxes = [[0, 0], [0, 1], [1, 0], [1, 1]];
    let scored = false;
    for (const [row, column] of boxes) {
      const key = `${row}:${column}`;
      if (state.boxes[key]) continue;
      const sides = [
        dotKey("h", row, column),
        dotKey("h", row + 1, column),
        dotKey("v", row, column),
        dotKey("v", row, column + 1),
      ];
      if (sides.every((side) => state.taken[side])) {
        state.boxes[key] = playerId;
        scored = true;
      }
    }
    if (!scored) state.turn = state.turn === state.a ? state.b : state.a;
    if (Object.keys(state.boxes).length === 4) {
      state.done = true;
      const scores = { [state.a]: 0, [state.b]: 0 };
      for (const owner of Object.values(state.boxes)) scores[owner] += 1;
      if (scores[state.a] !== scores[state.b]) {
        state.winnerId = scores[state.a] > scores[state.b] ? state.a : state.b;
      }
    }
  },
  status(state) {
    return { done: state.done, winnerId: state.winnerId };
  },
  score(state, playerId) {
    return Object.values(state.boxes).filter((owner) => owner === playerId).length;
  },
  viewFor(state, viewerId) {
    return { type: state.type, edges: state.edges, taken: state.taken, boxes: state.boxes, turn: state.turn, youAre: viewerId };
  },
};

export const DUELS = [ticTacToe, connect4, rps, dots];
export function getDuel(type) {
  return DUELS.find((duel) => duel.type === type) || null;
}
