export const STAKES = [0, 1, 5, 10, 50] as const;

export type Stake = (typeof STAKES)[number];
export type MatchMode = "create" | "existing" | "waiting";

export type GameMeta = {
  id: "neon-dash" | "pulse-tap" | "grid-recall" | "line-shift";
  name: string;
  cover: string;
  enabled: boolean;
  waitingStakes: Stake[];
};

export const GAMES: GameMeta[] = [
  {
    id: "neon-dash",
    name: "Neon Dash",
    cover: "/covers/neon-dash.svg",
    enabled: true,
    waitingStakes: [5],
  },
  {
    id: "pulse-tap",
    name: "Pulse Tap",
    cover: "/covers/pulse-tap.svg",
    enabled: true,
    waitingStakes: [1, 10],
  },
  {
    id: "grid-recall",
    name: "Grid Recall",
    cover: "/covers/grid-recall.svg",
    enabled: true,
    waitingStakes: [0],
  },
  {
    id: "line-shift",
    name: "Line Shift",
    cover: "/covers/line-shift.svg",
    enabled: true,
    waitingStakes: [50],
  },
];

export function modeForStake(
  game: GameMeta,
  stake: Stake,
  nextTurn: "create" | "existing"
): MatchMode {
  if (game.waitingStakes.includes(stake)) return "waiting";
  return nextTurn;
}

export function prizeForStake(stake: Stake) {
  if (stake === 0) return 0;
  return Number((stake * 1.8).toFixed(2));
}
