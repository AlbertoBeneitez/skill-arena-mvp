/**
 * Solitaire Sprint V1 · private core. Server only: the state holds the hidden cards. Never bundle this module.
 *
 * Played through the hidden command authority (like Mine Grid V2): the phone sends one move per command and receives
 * `projectSolitaireV1`, which never contains a face-down card, the stock order or the seed. The deal comes from the
 * shared private manifest, so both participants of a match get the same deal.
 *
 * Time is not part of this core (one tick per command). The owner's rule (22-nov-2026) is "the fastest solve wins,
 * 5 minutes maximum": the server measures the elapsed time between its own timestamps and sends `TIME_UP` when the
 * limit passes. Solvability is guaranteed by the issuer (`lib/server/solitaireDeals.ts`), not re-checked on replay.
 */
import { generatePrivateSolitaireSetup } from "./solitaireSetup.v1.server";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import {
  SOLITAIRE_ACTIONS_V1,
  SOLITAIRE_V1_TIME_LIMIT_MS,
  solitaireFitsTableau,
  solitaireRankOf,
  solitaireSuitOf,
  type SolitairePublicViewV1,
} from "./solitaireProtocol.v1";

export type SolitaireStateV1 = CoreState & {
  /** Each column bottom to top; the last `up[c]` cards are face up. */
  columns: number[][];
  up: number[];
  /** Drawn from the END. */
  stock: number[];
  /** Top is the END. */
  waste: number[];
  foundations: number[];
  moves: number;
  height: number;
};

type Parsed =
  | { kind: "DRAW" }
  | { kind: "TIME_UP" }
  | { kind: "W>F" }
  | { kind: "W>T"; to: number }
  | { kind: "T>F"; from: number }
  | { kind: "T>T"; from: number; to: number };

function parse(action: string): Parsed | null {
  if (action === "DRAW" || action === "TIME_UP" || action === "W>F") return { kind: action };
  let m = /^W>T([0-6])$/.exec(action);
  if (m) return { kind: "W>T", to: Number(m[1]) };
  m = /^T([0-6])>F$/.exec(action);
  if (m) return { kind: "T>F", from: Number(m[1]) };
  m = /^T([0-6])>T([0-6])$/.exec(action);
  if (m && m[1] !== m[2]) return { kind: "T>T", from: Number(m[1]), to: Number(m[2]) };
  return null;
}

const fitsFoundation = (s: SolitaireStateV1, card: number) =>
  s.foundations[solitaireSuitOf(card)] === solitaireRankOf(card) - 1;

/** Index in `from` where the moving run starts, or -1. Unique by Klondike rules (see the protocol). */
function runStart(s: SolitaireStateV1, from: number, to: number) {
  const source = s.columns[from], target = s.columns[to];
  const top = target.length ? target[target.length - 1] : undefined;
  for (let i = source.length - s.up[from]; i < source.length; i++) {
    if (solitaireFitsTableau(source[i], top)) return i;
  }
  return -1;
}

function revealAfterTake(s: SolitaireStateV1, column: number) {
  if (s.columns[column].length && s.up[column] === 0) s.up[column] = 1;
}

function settle(s: SolitaireStateV1) {
  s.moves++;
  s.height = s.foundations.reduce((a, b) => a + b, 0);
  // Every tableau card face up: the deal is won (the lowest card left is always playable, and with unlimited
  // redeals every stock card is reachable), so the remaining moves are mechanical and cost no time.
  if (s.columns.every((c, i) => s.up[i] === c.length)) {
    s.status = "won";
    s.failure = null;
    s.score = 52;
    return;
  }
  s.score = s.height;
}

export function createSolitaireV1(seed: string): SolitaireStateV1 {
  const setup = generatePrivateSolitaireSetup(seed);
  return {
    tick: 0,
    status: "running",
    failure: null,
    score: 0,
    height: 0,
    columns: setup.tableau.map((column) => column.map((card) => card.cardId)),
    up: setup.tableau.map((column) => column.filter((card) => card.faceUp).length),
    stock: [...setup.stock],
    waste: [],
    foundations: [0, 0, 0, 0],
    moves: 0,
  };
}

/** Player moves stop one short of the input limit, so the server can always append TIME_UP. */
export const SOLITAIRE_V1_MOVE_LIMIT = 999;

export function canApplySolitaireV1(s: SolitaireStateV1, action: string) {
  const p = parse(action);
  if (!p || s.status !== "running") return false;
  if (p.kind !== "TIME_UP" && s.tick >= SOLITAIRE_V1_MOVE_LIMIT) return false;
  const wasteTop = s.waste.length ? s.waste[s.waste.length - 1] : undefined;
  switch (p.kind) {
    case "TIME_UP":
      return true;
    case "DRAW":
      return s.stock.length > 0 || s.waste.length > 0;
    case "W>F":
      return wasteTop !== undefined && fitsFoundation(s, wasteTop);
    case "W>T": {
      const target = s.columns[p.to];
      return wasteTop !== undefined && solitaireFitsTableau(wasteTop, target[target.length - 1]);
    }
    case "T>F": {
      const column = s.columns[p.from];
      return column.length > 0 && fitsFoundation(s, column[column.length - 1]);
    }
    case "T>T": {
      const start = runStart(s, p.from, p.to);
      // Moving a king run that already sits alone on its column to another empty column changes nothing.
      return start >= 0 && !(start === 0 && s.columns[p.to].length === 0);
    }
  }
}

export function applySolitaireV1(s: SolitaireStateV1, action: string) {
  const p = parse(action)!;
  switch (p.kind) {
    case "TIME_UP":
      s.status = "failed";
      s.failure = "TIME_UP";
      return;
    case "DRAW":
      if (s.stock.length) s.waste.push(s.stock.pop()!);
      else {
        s.stock = s.waste.reverse();
        s.waste = [];
      }
      break;
    case "W>F": {
      const card = s.waste.pop()!;
      s.foundations[solitaireSuitOf(card)]++;
      break;
    }
    case "W>T":
      s.columns[p.to].push(s.waste.pop()!);
      s.up[p.to]++;
      break;
    case "T>F": {
      const card = s.columns[p.from].pop()!;
      s.up[p.from]--;
      s.foundations[solitaireSuitOf(card)]++;
      revealAfterTake(s, p.from);
      break;
    }
    case "T>T": {
      const start = runStart(s, p.from, p.to);
      const run = s.columns[p.from].splice(start);
      s.up[p.from] -= run.length;
      s.columns[p.to].push(...run);
      s.up[p.to] += run.length;
      revealAfterTake(s, p.from);
      break;
    }
  }
  settle(s);
}

/** What the phone may see: face-up ids only. No seed, stock order or face-down id ever leaves the server. */
export function projectSolitaireV1(s: SolitaireStateV1): SolitairePublicViewV1 {
  return {
    tableau: s.columns.map((column, i) => column.map((card, j) => (j >= column.length - s.up[i] ? card : null))),
    stockCount: s.stock.length,
    wasteCount: s.waste.length,
    wasteTop: s.waste.length ? s.waste[s.waste.length - 1] : null,
    foundations: [...s.foundations],
    moves: s.moves,
    reach: s.height,
  };
}

export const SOLITAIRE_CORE_V1: GameCore<SolitaireStateV1> = {
  gameId: "solitaire-sprint",
  gameVersion: "1.0.0",
  width: 390,
  height: 844,
  tickRate: 120,
  // One tick per command (the command table allows 1000); the real limit is the 5-minute clock on the server.
  maxFinalTick: 1000,
  maxInputs: 1000,
  inputVersion: 1,
  actions: SOLITAIRE_ACTIONS_V1,
  content: {
    rules: {
      variant: "klondike-draw-one-unlimited-redeals-no-foundation-to-tableau",
      cards: 52,
      columns: 7,
      stock: 24,
      autoWin: "all-tableau-face-up",
      commandLimit: SOLITAIRE_V1_MOVE_LIMIT,
      timeLimitMs: SOLITAIRE_V1_TIME_LIMIT_MS,
    },
    generator: "private-hmac-fisher-yates-v1 (solitaireSetup.v1.server)",
    solvability: "issuer-accepts-only-solver-verified-deals",
    clock: "COMMAND_ORDINAL_NOT_REACTION_TIME; elapsed time measured by server timestamps",
    ranking: "solved: lower elapsed time wins; unsolved or TIME_UP: loss",
    scoringAuthority: "SERVER_REPLAY_ONLY",
  },
  create: createSolitaireV1,
  step(state) {
    state.tick++;
  },
  canApply: canApplySolitaireV1,
  apply: applySolitaireV1,
};
