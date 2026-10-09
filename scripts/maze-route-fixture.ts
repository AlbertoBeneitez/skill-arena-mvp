import {
  mazeDistances,
  mazeNeighbor,
  type MazeBoard,
} from "../lib/verified/mazeRushCore.v1";
import { MAZE_ACTIONS } from "../lib/verified/mazeRushProtocol.v1";
export type MazePlanningView = {
  board: MazeBoard;
  player: number;
  tick: number;
  poweredUntil: number;
  awake: boolean;
  activeEnemyCells: readonly number[];
};
/** Test-only planner based solely on public geometry and visible active pursuers. */
export function chooseMazeRoute(s: MazePlanningView) {
  const d = mazeDistances(s.board, s.player);
  let candidates = s.board.nodes
    .map((node, i) => (node ? i : -1))
    .filter((i) => i >= 0);
  if (
    s.awake &&
    s.poweredUntil - s.tick < 240 &&
    candidates.some((i) => s.board.pulses[i])
  )
    candidates = candidates.filter((i) => s.board.pulses[i]);
  const enemies = s.activeEnemyCells.map((cell) => ({ cell }));
  const distance = (a: number, b: number) =>
    Math.abs((a % s.board.width) - (b % s.board.width)) +
    Math.abs(Math.floor(a / s.board.width) - Math.floor(b / s.board.width));
  if (
    s.awake &&
    s.poweredUntil <= s.tick &&
    enemies.some((e) => distance(e.cell, s.player) < 4)
  ) {
    // Public geometric danger costs guide the test player around pursuers.
    // These costs do not enter game rules or authoritative scoring.
    const cost = Array(s.board.walls.length).fill(Infinity),
      first = Array<string | null>(s.board.walls.length).fill(null),
      used = new Set<number>();
    cost[s.player] = 0;
    for (let turn = 0; turn < cost.length; turn++) {
      let cell = -1;
      for (let i = 0; i < cost.length; i++)
        if (!used.has(i) && (cell < 0 || cost[i] < cost[cell])) cell = i;
      if (cell < 0 || !Number.isFinite(cost[cell])) break;
      used.add(cell);
      for (const a of MAZE_ACTIONS.slice(0, 4)) {
        const n = mazeNeighbor(s.board, cell, a);
        if (n === cell) continue;
        const proximity = Math.min(...enemies.map((e) => distance(e.cell, n)));
        const risk =
          proximity === 0
            ? 100
            : proximity === 1
              ? 24
              : proximity === 2
                ? 6
                : 0;
        const next = cost[cell] + 1 + risk;
        if (next < cost[n]) {
          cost[n] = next;
          first[n] = cell === s.player ? a : first[cell];
        }
      }
    }
    const target = candidates.sort((a, b) => cost[a] - cost[b])[0];
    if (target !== undefined) return first[target] ?? "STOP";
  }
  const target = candidates.sort((a, b) => d[a] - d[b])[0];
  if (target === undefined) return "STOP";
  const back = mazeDistances(s.board, target);
  const a = MAZE_ACTIONS.slice(0, 4).find((a) => {
    const n = mazeNeighbor(s.board, s.player, a);
    return n !== s.player && back[n] === back[s.player] - 1;
  });
  return a ?? "STOP";
}
