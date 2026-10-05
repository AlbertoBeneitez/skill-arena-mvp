export const STAKES = [0, 1, 5, 10, 50] as const;

export type Stake = (typeof STAKES)[number];
export type MatchMode = "create" | "existing" | "waiting";

export type GameMeta = {
  id:
    | "tower-drop"
    | "helix-dive"
    | "slice-rush"
    | "jet-stream"
    | "pulse-runner"
    | "shatter-shot"
    | "metro-shift"
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
    id: "tower-drop",
    name: "Tower Drop",
    cover: "/covers/tower-drop.svg",
    enabled: true,
    waitingStakes: [1, 5],
    category: "TIMING",
    tagline: "Centra cada bloque. La torre no perdona.",
    difficulty: "MEDIA",
    skillLabel: "TIMING + PRECISIÓN",
    rivalScore: 6200,
    rivalName: "ATLAS",
    rivalAvatar: "/avatars/avatar-7.svg",
    instruction: "Toca para soltar el bloque móvil sobre la torre.",
    scoring: "Altura + precisión + combo. Sin solape, fin.",
  },
  {
    id: "helix-dive",
    name: "Helix Dive",
    cover: "/covers/helix-dive.svg",
    enabled: true,
    waitingStakes: [0, 10],
    category: "CONTROL",
    tagline: "Abre el hueco. Cae sin tocar rojo.",
    difficulty: "ALTA",
    skillLabel: "LECTURA + CONTROL",
    rivalScore: 5800,
    rivalName: "NOVA",
    rivalAvatar: "/avatars/avatar-6.svg",
    instruction: "Arrastra izquierda/derecha para girar el anillo y alinear el hueco.",
    scoring: "Pisos atravesados + caídas limpias. Tocar zona roja, fin.",
  },
  {
    id: "slice-rush",
    name: "Slice Rush",
    cover: "/covers/slice-rush.svg",
    enabled: true,
    waitingStakes: [1],
    category: "REFLEJOS",
    tagline: "Traza rápido. No cortes lo prohibido.",
    difficulty: "ALTA",
    skillLabel: "REACCIÓN + PUNTERÍA",
    rivalScore: 7600,
    rivalName: "KIRA",
    rivalAvatar: "/avatars/avatar-5.svg",
    instruction: "Desliza el dedo atravesando los objetivos azules. Evita los rojos.",
    scoring: "Aciertos + combo + precisión. Fallar objetivo o tocar rojo, fin.",
  },
  {
    id: "jet-stream",
    name: "Jet Stream",
    cover: "/covers/jet-stream.svg",
    enabled: true,
    waitingStakes: [5, 10],
    category: "CONTROL",
    tagline: "Mantén altura. Lee la próxima puerta.",
    difficulty: "ALTA",
    skillLabel: "RITMO + CONTROL",
    rivalScore: 6900,
    rivalName: "AERO",
    rivalAvatar: "/avatars/avatar-2.svg",
    instruction: "Mantén pulsado para subir; suelta para caer.",
    scoring: "Puertas superadas + centrado. Chocar, fin.",
  },
  {
    id: "pulse-runner",
    name: "Pulse Runner",
    cover: "/covers/pulse-runner.svg",
    enabled: true,
    waitingStakes: [0, 5],
    category: "MOVIMIENTO",
    tagline: "Salta tarde. Aterriza limpio. Sigue.",
    difficulty: "ALTA",
    skillLabel: "TIMING + LECTURA",
    rivalScore: 7200,
    rivalName: "VOLT",
    rivalAvatar: "/avatars/avatar-8.svg",
    instruction: "Toca para saltar obstáculos. Mantén para alargar ligeramente el salto.",
    scoring: "Obstáculos + combo + distancia. Colisión, fin.",
  },
  {
    id: "shatter-shot",
    name: "Shatter Shot",
    cover: "/covers/shatter-shot.svg",
    enabled: true,
    waitingStakes: [1, 50],
    category: "PRECISIÓN",
    tagline: "Rompe el objetivo antes de que te alcance.",
    difficulty: "ALTA",
    skillLabel: "PUNTERÍA + PRIORIDAD",
    rivalScore: 6500,
    rivalName: "ION",
    rivalAvatar: "/avatars/avatar-4.svg",
    instruction: "Toca los paneles azules antes de que crucen la línea de impacto.",
    scoring: "Paneles destruidos + rapidez + combo. Dejar pasar uno, fin.",
  },
  {
    id: "metro-shift",
    name: "Metro Shift",
    cover: "/covers/metro-shift.svg",
    enabled: true,
    waitingStakes: [10, 50],
    category: "REACCIÓN",
    tagline: "Tres carriles. Dos movimientos por delante.",
    difficulty: "ALTA",
    skillLabel: "LECTURA + REACCIÓN",
    rivalScore: 6100,
    rivalName: "MIRA",
    rivalAvatar: "/avatars/avatar-1.svg",
    instruction: "Desliza izquierda/derecha para cambiar de carril y arriba para saltar.",
    scoring: "Puertas + velocidad + acciones limpias. Colisión, fin.",
  },
  {
    id: "tap-reactor",
    name: "Tap Reactor",
    cover: "/covers/tap-reactor.svg",
    enabled: true,
    waitingStakes: [5],
    category: "VELOCIDAD",
    tagline: "Ve. Toca. Repite.",
    difficulty: "MEDIA",
    skillLabel: "REACCIÓN + PUNTERÍA",
    rivalScore: 7600,
    rivalName: "LYNX",
    rivalAvatar: "/avatars/avatar-3.svg",
    instruction: "Toca el núcleo antes de que expire el anillo.",
    scoring: "Rapidez + precisión + racha. Fallar o llegar tarde, fin.",
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
