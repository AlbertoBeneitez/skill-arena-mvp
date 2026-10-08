import {
  stackCells,
  stackCanPlace,
  stackLandingY,
  stackPiece,
  type StackShiftState,
  type Cell,
} from "../lib/verified/stackShiftCore.v1";
/** Test player: exact core support helpers plus one-step lookahead using the visible next piece. */
function costOfPlacement(
  s: StackShiftState,
  cells: readonly Cell[],
  x: number,
) {
  const y = stackLandingY(s, cells, x),
    board = s.board.map((row) => row.slice());
  for (const [cx, cy] of cells) board[y + cy][x + cx] = s.pieceKind + 1;
  const full = board.filter((row) => row.every(Boolean)).length;
  const left = board.filter((row) => !row.every(Boolean));
  while (left.length < 16) left.unshift(Array(8).fill(0));
  const heights: number[] = [];
  let holes = 0;
  for (let col = 0; col < 8; col++) {
    const top = left.findIndex((row) => row[col]);
    heights.push(top < 0 ? 0 : 16 - top);
    if (top >= 0)
      for (let row = top + 1; row < 16; row++) if (!left[row][col]) holes++;
  }
  const bump = heights
      .slice(1)
      .reduce((sum, h, i) => sum + Math.abs(h - heights[i]), 0),
    cost =
      holes * 95 +
      heights.reduce((a, b) => a + b, 0) * 5 +
      bump * 3 +
      Math.max(...heights) * 4 -
      full * 70;
  return { board: left, cost };
}
export function chooseStackPlacement(s: StackShiftState) {
  let best = { rotation: 0, x: s.x, cost: Infinity };
  for (let rotation = 0; rotation < 4; rotation++)
    for (let x = 0; x < 8; x++) {
      const cells = stackCells(s.pieceKind, rotation);
      if (!stackCanPlace(s, cells, x, s.y)) continue;
      const current = costOfPlacement(s, cells, x),
        next = {
          ...s,
          board: current.board,
          pieceKind: stackPiece(s.seed, s.pieceIndex + 1),
          y: 0,
        };
      let future = Infinity;
      for (let r = 0; r < 4; r++)
        for (let nx = 0; nx < 8; nx++) {
          const nc = stackCells(next.pieceKind, r);
          if (stackCanPlace(next, nc, nx, 0))
            future = Math.min(future, costOfPlacement(next, nc, nx).cost);
        }
      const cost = current.cost + future * 0.7;
      if (cost < best.cost) best = { rotation, x, cost };
    }
  return best;
}
