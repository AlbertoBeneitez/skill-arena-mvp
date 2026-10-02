export const STAKES = [0, 1, 5, 10, 50] as const;

export type Stake = (typeof STAKES)[number];
export type MatchMode = "create" | "existing" | "waiting";

export type GameMeta = {
  id:
    | "orbit-rush"
    | "vector-strike"
    | "pulse-forge"
    | "stack-forge"
    | "lane-surge"
    | "drift-line"
    | "sky-thread"
    | "tap-reactor";
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
    id: "orbit-rush",
    name: "Orbit Rush",
    cover: "/covers/orbit-rush.svg",
    enabled: true,
    waitingStakes: [1, 10],
    category: "REFLEJOS",
    tagline: "Una pulsación. Cero margen.",
    difficulty: "ALTA",
    skillLabel: "LECTURA + TIMING",
    rivalScore: 4200,
    rivalName: "ORBIT",
    rivalAvatar: "/avatars/avatar-3.svg",
    instruction: "Toca para alternar entre la órbita interior y exterior.",
    scoring: "Obstáculos superados + combo. Un impacto termina la partida.",
  },
  {
    id: "vector-strike",
    name: "Vector Strike",
    cover: "/covers/vector-strike.svg",
    enabled: true,
    waitingStakes: [0, 5],
    category: "PRECISIÓN",
    tagline: "Lee la trayectoria. Ejecuta el tiro.",
    difficulty: "ALTA",
    skillLabel: "PUNTERÍA + FÍSICA",
    rivalScore: 6400,
    rivalName: "KIRA",
    rivalAvatar: "/avatars/avatar-5.svg",
    instruction: "Arrastra para apuntar y suelta. Usa rebotes cuando haga falta.",
    scoring: "Cada diana suma. Fallar un tiro termina la partida.",
  },
  {
    id: "pulse-forge",
    name: "Pulse Forge",
    cover: "/covers/pulse-forge.svg",
    enabled: true,
    waitingStakes: [1],
    category: "TIMING",
    tagline: "Golpea el pulso. Aguanta la presión.",
    difficulty: "ALTA",
    skillLabel: "TIMING + PRECISIÓN",
    rivalScore: 7200,
    rivalName: "LYNX",
    rivalAvatar: "/avatars/avatar-2.svg",
    instruction: "Toca cuando el cursor atraviese la zona de impacto.",
    scoring: "Precisión + racha. Un toque fuera termina la partida.",
  },
  {
    id: "stack-forge",
    name: "Stack Forge",
    cover: "/covers/stack-forge.svg",
    enabled: true,
    waitingStakes: [5],
    category: "CONTROL",
    tagline: "Centra. Corta. Sube.",
    difficulty: "MEDIA",
    skillLabel: "PRECISIÓN + RITMO",
    rivalScore: 5600,
    rivalName: "ATLAS",
    rivalAvatar: "/avatars/avatar-7.svg",
    instruction: "Toca para soltar cada bloque sobre la torre.",
    scoring: "Altura + centrado + combo. Sin solape, fin.",
  },
  {
    id: "lane-surge",
    name: "Lane Surge",
    cover: "/covers/lane-surge.svg",
    enabled: true,
    waitingStakes: [10],
    category: "REACCIÓN",
    tagline: "Lee dos movimientos por delante.",
    difficulty: "ALTA",
    skillLabel: "LECTURA + REACCIÓN",
    rivalScore: 5200,
    rivalName: "VEX",
    rivalAvatar: "/avatars/avatar-4.svg",
    instruction: "Muévete entre tres carriles con los botones izquierda/derecha.",
    scoring: "Puertas superadas + velocidad. Una colisión termina la partida.",
  },
  {
    id: "drift-line",
    name: "Drift Line",
    cover: "/covers/drift-line.svg",
    enabled: true,
    waitingStakes: [0, 50],
    category: "CONTROL",
    tagline: "Suave es rápido.",
    difficulty: "ALTA",
    skillLabel: "TRAZADA + CONTROL",
    rivalScore: 7000,
    rivalName: "MIRA",
    rivalAvatar: "/avatars/avatar-1.svg",
    instruction: "Mantén izquierda o derecha para seguir el corredor.",
    scoring: "Distancia + trazada limpia. Tocar un borde termina la partida.",
  },
  {
    id: "sky-thread",
    name: "Sky Thread",
    cover: "/covers/sky-thread.svg",
    enabled: true,
    waitingStakes: [1, 5],
    category: "CONTROL",
    tagline: "Mantén el vuelo en la línea perfecta.",
    difficulty: "ALTA",
    skillLabel: "RITMO + CONTROL",
    rivalScore: 5000,
    rivalName: "AERO",
    rivalAvatar: "/avatars/avatar-6.svg",
    instruction: "Toca para impulsar la esfera y atravesar cada abertura.",
    scoring: "Puertas superadas + proximidad al centro. Un choque termina la partida.",
  },
  {
    id: "tap-reactor",
    name: "Tap Reactor",
    cover: "/covers/tap-reactor.svg",
    enabled: true,
    waitingStakes: [10, 50],
    category: "VELOCIDAD",
    tagline: "Ve. Toca. Repite.",
    difficulty: "MEDIA",
    skillLabel: "REACCIÓN + PUNTERÍA",
    rivalScore: 7600,
    rivalName: "ION",
    rivalAvatar: "/avatars/avatar-8.svg",
    instruction: "Toca el núcleo antes de que expire el anillo.",
    scoring: "Rapidez + precisión + racha. Fallar o llegar tarde termina la partida.",
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
