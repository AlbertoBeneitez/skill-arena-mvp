export const STAKES = [0, 1, 5, 10, 50] as const;

export type Stake = (typeof STAKES)[number];
export type MatchMode = "create" | "existing" | "waiting";

export type GameMeta = {
  id: "shadow-sprint" | "gravity-shift" | "arrow-escape" | "brick-breaker";
  name: string;
  cover: string;
  enabled: boolean;
  waitingStakes: Stake[];
};

export const GAMES: GameMeta[] = [
  {
    id: "shadow-sprint",
    name: "Shadow Sprint",
    cover: "/covers/shadow-sprint.svg",
    enabled: true,
    waitingStakes: [5],
  },
  {
    id: "gravity-shift",
    name: "Gravity Shift",
    cover: "/covers/gravity-shift.svg",
    enabled: true,
    waitingStakes: [1, 10],
  },
  {
    id: "arrow-escape",
    name: "Arrow Escape",
    cover: "/covers/arrow-escape.svg",
    enabled: true,
    waitingStakes: [0],
  },
  {
    id: "brick-breaker",
    name: "Brick Breaker",
    cover: "/covers/brick-breaker.svg",
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
