import {
  SERPENT_ACTIONS,
  serpentNextPoint,
  type SerpentDirection,
  type SerpentState,
} from "../lib/verified/serpentCore.v1";
/** Test/QA pilot: shortest free route, independent of presentation and wall time. */
export function chooseSerpentTurn(state: SerpentState): SerpentDirection {
  const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;
  const occupied = new Set(state.snake.slice(0, -1).map(key));
  const start = state.snake[0],
    goal = key(state.food!);
  const queue: { p: typeof start; first: SerpentDirection | null }[] = [
      { p: start, first: null },
    ],
    visited = new Set([key(start)]);
  for (let index = 0; index < queue.length; index++) {
    const { p, first } = queue[index];
    for (const action of SERPENT_ACTIONS) {
      const next = serpentNextPoint(p, action),
        id = key(next);
      if (visited.has(id) || occupied.has(id)) continue;
      const turn = first ?? action;
      if (id === goal) return turn;
      visited.add(id);
      queue.push({ p: next, first: turn });
    }
  }
  return state.direction;
}
