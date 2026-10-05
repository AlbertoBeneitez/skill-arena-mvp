export const STAKES = [0, 1, 5, 10, 50] as const;

export type Stake = (typeof STAKES)[number];
export type MatchMode = "create" | "existing" | "waiting";

export type GameMeta = {
  id:
    | "tower-drop"
    | "helix-dive"
    | "jet-stream"
    | "pulse-runner"
    | "metro-shift"
    | "orbit-shift";
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
    instruction: "Toca cuando el bloque móvil esté encima de la torre.",
    scoring: "Sigue apilando hasta fallar.",
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
    instruction: "Mantén pulsada la mitad izquierda o derecha para girar en esa dirección.",
    scoring: "Atraviesa pisos; tocar rojo termina la partida.",
  },
  {
    id: "jet-stream",
    name: "Jet Stream",
    cover: "/covers/jet-stream.svg",
    enabled: true,
    waitingStakes: [5, 10],
    category: "CONTROL",
    tagline: "Cruza cada puerta sin tocar los bordes.",
    difficulty: "ALTA",
    skillLabel: "RITMO + CONTROL",
    rivalScore: 6900,
    rivalName: "AERO",
    rivalAvatar: "/avatars/avatar-2.svg",
    instruction: "Pulsa la pantalla para subir y suelta para caer.",
    scoring: "Atraviesa puertas hasta chocar.",
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
    instruction: "Toca para saltar; mantén un instante para alargar el salto.",
    scoring: "Sigue hasta colisionar.",
  },
  {
    id: "metro-shift",
    name: "Metro Shift",
    cover: "/covers/metro-shift.svg",
    enabled: true,
    waitingStakes: [10, 50],
    category: "REACCIÓN",
    tagline: "Tres carriles. Decide rápido.",
    difficulty: "ALTA",
    skillLabel: "LECTURA + REACCIÓN",
    rivalScore: 6100,
    rivalName: "MIRA",
    rivalAvatar: "/avatars/avatar-1.svg",
    instruction: "Toca izquierda/derecha para cambiar de carril y el centro para saltar.",
    scoring: "Esquiva obstáculos hasta la primera colisión.",
  },
  {
    id: "orbit-shift",
    name: "Orbit Shift",
    cover: "/covers/orbit-rush.svg",
    enabled: true,
    waitingStakes: [1, 10],
    category: "CONTROL",
    tagline: "Sube o baja de órbita antes del impacto.",
    difficulty: "ALTA",
    skillLabel: "LECTURA + TIMING",
    rivalScore: 6400,
    rivalName: "ORBIT",
    rivalAvatar: "/avatars/avatar-3.svg",
    instruction: "Toca arriba para subir de órbita y abajo para bajar.",
    scoring: "Supera obstáculos hasta el primer impacto.",
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
    scoring: "Fallar o llegar tarde termina la partida.",
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
  return Number((stake * 2).toFixed(2));
}
