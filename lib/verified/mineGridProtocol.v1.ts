export const MINE_MAX_CELLS = 90;
export const MINE_ACTIONS = Object.freeze(
  ["OPEN", "FLAG"].flatMap((kind) =>
    Array.from(
      { length: MINE_MAX_CELLS },
      (_, i) => `${kind}_${String(i).padStart(3, "0")}`,
    ),
  ),
);
export const mineAction = (kind: "OPEN" | "FLAG", index: number) =>
  `${kind}_${String(index).padStart(3, "0")}`;
export type MinePublicView = Readonly<{
  stage: number;
  levels: number;
  cols: number;
  rows: number;
  startIndex: number;
  started: boolean;
  cells: readonly (number | null)[];
  flagged: readonly boolean[];
  lives: number;
  mines: number;
  event: "NONE" | "OPEN" | "FLAG" | "BOMB" | "CLEAR";
}>;
