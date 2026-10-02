export const STAKES = [0, 1, 5, 10, 50] as const;

export type Stake = (typeof STAKES)[number];
export type MatchMode = "create" | "existing" | "waiting";

export type GameMeta = {
  id: "shadow-sprint" | "gravity-shift" | "arrow-escape" | "brick-breaker";
  name: string;
  cover: string;
  enabled: boolean;
  waitingStakes: Stake[];
  category: string;
  tagline: string;
  difficulty: "MEDIA" | "ALTA";
  skillLabel: string;
  rivalScore: number;
  rivalName: string;
  rivalAvatar: string;
};

export const GAMES: GameMeta[] = [
  {
    id: "shadow-sprint",
    name: "Shadow Sprint",
    cover: "/covers/shadow-sprint.svg",
    enabled: true,
    waitingStakes: [5],
    category: "MOVIMIENTO",
    tagline: "Corre limpio. Cada décima cuenta.",
    difficulty: "ALTA",
    skillLabel: "TIMING + CONTROL",
    rivalScore: 11800,
    rivalName: "NOVA",
    rivalAvatar: "/avatars/avatar-6.svg",
  },
  {
    id: "gravity-shift",
    name: "Gravity Shift",
    cover: "/covers/gravity-shift.svg",
    enabled: true,
    waitingStakes: [1, 10],
    category: "PUZZLE",
    tagline: "Lee el tablero antes de mover.",
    difficulty: "ALTA",
    skillLabel: "PLANIFICACIÓN",
    rivalScore: 3100,
    rivalName: "ORBIT",
    rivalAvatar: "/avatars/avatar-3.svg",
  },
  {
    id: "arrow-escape",
    name: "Arrow Escape",
    cover: "/covers/arrow-escape.svg",
    enabled: true,
    waitingStakes: [0],
    category: "VELOCIDAD",
    tagline: "Ve la salida antes que tu rival.",
    difficulty: "MEDIA",
    skillLabel: "LECTURA + VELOCIDAD",
    rivalScore: 8600,
    rivalName: "KIRA",
    rivalAvatar: "/avatars/avatar-5.svg",
  },
  {
    id: "brick-breaker",
    name: "Brick Breaker",
    cover: "/covers/brick-breaker.svg",
    enabled: true,
    waitingStakes: [50],
    category: "PRECISIÓN",
    tagline: "Controla el ángulo. Mantén el combo.",
    difficulty: "ALTA",
    skillLabel: "PRECISIÓN + CONTROL",
    rivalScore: 5600,
    rivalName: "VOLT",
    rivalAvatar: "/avatars/avatar-8.svg",
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
