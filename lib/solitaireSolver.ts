/**
 * Exact Klondike solver for the Skill Arena rules (used offline and in tests, never in the client bundle):
 * draw-one stock with UNLIMITED redeals, waste/tableau -> foundation, tableau runs, kings only on empty
 * columns, no foundation -> tableau. Because redeals are unlimited every stock card is reachable at any
 * time, so the stock+waste is modelled as an unordered set; `replaySolution` re-checks every solution
 * against the literal draw/redeal mechanics of the client so the abstraction cannot hide an error.
 *
 * Deck encoding (same as the client): index = suitIndex * 13 + rank - 1 with suits [♠, ♥, ♦, ♣];
 * the first 28 cards deal the tableau (column c gets c + 1 cards, the last one face up), the other 24 are the stock
 * (drawn from the END of the stock array).
 */
export type SolverMove =
  | { kind: "foundation"; from: "talon" | number; card: number }
  | { kind: "tableau"; from: "talon" | number; card: number; to: number; count: number };

const suitOf = (card: number) => Math.floor(card / 13);
const rankOf = (card: number) => (card % 13) + 1;
const isRedCard = (card: number) => suitOf(card) === 1 || suitOf(card) === 2;
const fits = (card: number, target: number | undefined) =>
  target === undefined ? rankOf(card) === 13 : rankOf(target) === rankOf(card) + 1 && isRedCard(target) !== isRedCard(card);

type State = { cols: number[][]; up: number[]; found: number[]; talon: number[] };

function initial(deck: readonly number[]): State {
  const cols: number[][] = [];
  let cursor = 0;
  for (let c = 0; c < 7; c++) {
    cols.push(deck.slice(cursor, cursor + c + 1));
    cursor += c + 1;
  }
  return { cols, up: [1, 1, 1, 1, 1, 1, 1], found: [0, 0, 0, 0], talon: deck.slice(cursor) };
}

const keyOf = (s: State) =>
  s.cols.map((c, i) => `${c.join(",")}/${s.up[i]}`).join("|") + "#" + s.found.join("") + "#" + [...s.talon].sort((a, b) => a - b).join(",");

function clone(s: State): State {
  return { cols: s.cols.map((c) => c.slice()), up: s.up.slice(), found: s.found.slice(), talon: s.talon.slice() };
}

function takeFrom(s: State, from: "talon" | number, card: number, count: number) {
  if (from === "talon") {
    s.talon.splice(s.talon.indexOf(card), 1);
  } else {
    s.cols[from].splice(s.cols[from].length - count, count);
    s.up[from] -= count;
    if (s.cols[from].length && s.up[from] === 0) s.up[from] = 1;
  }
}

function isSafe(s: State, card: number) {
  const r = rankOf(card);
  if (r <= 2) return true;
  const sx = suitOf(card);
  const opp = isRedCard(card) ? [0, 3] : [1, 2];
  return s.found[opp[0]] >= r - 1 && s.found[opp[1]] >= r - 1 && s.found[sx] === r - 1;
}

function moves(s: State): SolverMove[] {
  const out: SolverMove[] = [];
  for (let c = 0; c < 7; c++) {
    const col = s.cols[c];
    if (!col.length) continue;
    const card = col[col.length - 1];
    if (rankOf(card) === s.found[suitOf(card)] + 1) out.push({ kind: "foundation", from: c, card });
  }
  for (const card of s.talon) if (rankOf(card) === s.found[suitOf(card)] + 1) out.push({ kind: "foundation", from: "talon", card });
  // Moves that flip a hidden card first, then the others.
  const tableau: SolverMove[] = [];
  for (let c = 0; c < 7; c++) {
    const col = s.cols[c];
    for (let i = col.length - s.up[c]; i < col.length; i++) {
      if (i < 0) continue;
      const card = col[i];
      for (let d = 0; d < 7; d++) {
        if (d === c) continue;
        const dest = s.cols[d];
        if (!fits(card, dest[dest.length - 1])) continue;
        if (!dest.length && i === 0) continue;
        const flips = i > 0 && s.up[c] === col.length - i;
        const move: SolverMove = { kind: "tableau", from: c, card, to: d, count: col.length - i };
        flips ? tableau.unshift(move) : tableau.push(move);
      }
    }
  }
  for (const card of s.talon)
    for (let d = 0; d < 7; d++) {
      const dest = s.cols[d];
      if (fits(card, dest[dest.length - 1])) tableau.push({ kind: "tableau", from: "talon", card, to: d, count: 1 });
    }
  return out.concat(tableau);
}

function apply(s: State, m: SolverMove): State {
  const n = clone(s);
  if (m.kind === "foundation") {
    takeFrom(n, m.from, m.card, 1);
    n.found[suitOf(m.card)]++;
  } else {
    const moving = m.from === "talon" ? [m.card] : n.cols[m.from].slice(n.cols[m.from].length - m.count);
    takeFrom(n, m.from, m.card, m.count);
    n.cols[m.to].push(...moving);
    n.up[m.to] += moving.length;
  }
  return n;
}

export type SolveResult = { solved: boolean; moves: SolverMove[]; nodes: number; exhausted: boolean };

/** DFS with safe-foundation forcing and a visited set. `exhausted` = search space fully explored (unsolvable). */
export function solveKlondike(deck: readonly number[], nodeLimit = 400_000): SolveResult {
  const seen = new Set<string>();
  let nodes = 0;
  let aborted = false;
  const path: SolverMove[] = [];
  const won = (s: State) => s.found.every((f) => f === 13);
  function dfs(s: State): boolean {
    if (won(s)) return true;
    if (++nodes > nodeLimit) {
      aborted = true;
      return false;
    }
    const k = keyOf(s);
    if (seen.has(k)) return false;
    seen.add(k);
    const list = moves(s);
    // Forced safe foundation move.
    const safe = list.find((m) => m.kind === "foundation" && isSafe(s, m.card));
    const order = safe ? [safe] : list;
    for (const m of order) {
      path.push(m);
      if (dfs(apply(s, m))) return true;
      path.pop();
      if (aborted) return false;
    }
    return false;
  }
  const solved = dfs(initial(deck));
  return { solved, moves: solved ? path.slice() : [], nodes, exhausted: !solved && !aborted };
}

/**
 * Replays a solution with the literal client mechanics (draw from the END of the stock into the waste, redeal when the
 * stock is empty by reversing the waste) and independent rule checks. Returns the number of stock draws used.
 */
export function replaySolution(deck: readonly number[], solution: readonly SolverMove[]): { won: boolean; draws: number } {
  const s = initial(deck);
  let stock = s.talon.slice();
  let waste: number[] = [];
  let draws = 0;
  const found = [0, 0, 0, 0];
  const cols = s.cols.map((c) => c.slice());
  const up = [1, 1, 1, 1, 1, 1, 1];
  const bring = (card: number) => {
    let guard = 0;
    while (waste[waste.length - 1] !== card) {
      if (++guard > 200) throw new Error("card unreachable in stock: " + card);
      if (stock.length) waste.push(stock.pop()!);
      else {
        stock = waste.slice().reverse();
        waste = [];
      }
      draws++;
    }
  };
  for (const m of solution) {
    let moving: number[];
    if (m.from === "talon") {
      bring(m.card);
      moving = [waste.pop()!];
    } else {
      const col = cols[m.from];
      moving = m.kind === "foundation" ? [col[col.length - 1]] : col.slice(col.length - m.count);
      if (moving.length > up[m.from]) throw new Error("moving hidden cards");
      for (let i = 1; i < moving.length; i++) if (!fits(moving[i], moving[i - 1])) throw new Error("illegal run");
      col.splice(col.length - moving.length);
      up[m.from] -= moving.length;
      if (col.length && up[m.from] === 0) up[m.from] = 1;
    }
    if (moving[0] !== m.card) throw new Error("card mismatch");
    if (m.kind === "foundation") {
      if (rankOf(m.card) !== found[suitOf(m.card)] + 1) throw new Error("illegal foundation move");
      found[suitOf(m.card)]++;
    } else {
      const dest = cols[m.to];
      if (!fits(m.card, dest[dest.length - 1])) throw new Error("illegal tableau move");
      dest.push(...moving);
      up[m.to] += moving.length;
    }
  }
  return { won: found.every((f) => f === 13), draws };
}
