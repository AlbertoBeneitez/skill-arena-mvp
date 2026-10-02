export const STAKES = [0, 1, 5, 10, 50] as const;

export type Stake = (typeof STAKES)[number];
export type MatchMode = "create" | "existing" | "waiting";

export type GameMeta = {
  id: "shadow-sprint" | "orbit-rush" | "vector-strike" | "brick-breaker";
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
  instruction: string;
  scoring: string;
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
    rivalScore: 12200,
    rivalName: "NOVA",
    rivalAvatar: "/avatars/avatar-6.svg",
    instruction: "Muévete, salta y encadena checkpoints sin tocar pinchos.",
    scoring: "Tiempo + cristales − penalizaciones.",
  },
  {
    id: "orbit-rush",
    name: "Orbit Rush",
    cover: "/covers/orbit-rush.svg",
    enabled: true,
    waitingStakes: [1, 10],
    category: "REFLEJOS",
    tagline: "Una pulsación. Cero margen.",
    difficulty: "ALTA",
    skillLabel: "LECTURA + TIMING",
    rivalScore: 12500,
    rivalName: "ORBIT",
    rivalAvatar: "/avatars/avatar-3.svg",
    instruction: "Toca para alternar entre la órbita interior y exterior.",
    scoring: "Ritmo limpio + combo − impactos.",
  },
  {
    id: "vector-strike",
    name: "Vector Strike",
    cover: "/covers/vector-strike.svg",
    enabled: true,
    waitingStakes: [0],
    category: "PRECISIÓN",
    tagline: "Lee la trayectoria. Ejecuta el tiro.",
    difficulty: "ALTA",
    skillLabel: "PUNTERÍA + FÍSICA",
    rivalScore: 10300,
    rivalName: "KIRA",
    rivalAvatar: "/avatars/avatar-5.svg",
    instruction: "Arrastra para apuntar y suelta. Usa rebotes cuando haga falta.",
    scoring: "Precisión + pocos intentos + velocidad.",
  },
  {
    id: "brick-breaker",
    name: "Prism Break",
    cover: "/covers/brick-breaker.svg",
    enabled: true,
    waitingStakes: [50],
    category: "CONTROL",
    tagline: "Domina el rebote. No rompas el combo.",
    difficulty: "MEDIA",
    skillLabel: "PRECISIÓN + CONTROL",
    rivalScore: 11800,
    rivalName: "VOLT",
    rivalAvatar: "/avatars/avatar-8.svg",
    instruction: "Arrastra la pala y decide el ángulo de cada rebote.",
    scoring: "Bloques + combo + velocidad − fallos.",
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
