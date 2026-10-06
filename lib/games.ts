export const STAKES = [0, 1, 5, 10, 50] as const;

export type Stake = (typeof STAKES)[number];
export type MatchMode = "create" | "existing" | "waiting";

export type GameMeta = {
  id:
    | "tower-drop"
    | "jet-stream"
    | "pulse-runner"
    | "metro-shift"
    | "orbit-shift"
    | "solitaire-sprint"
    | "mine-grid"
    | "grid-serpent"
    | "brick-relay"
    | "stack-shift";
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
  deterministicSeed?: string;
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
    tagline: "Siete carriles. Decide antes de que llegue la ola.",
    difficulty: "ALTA",
    skillLabel: "LECTURA + REACCIÓN",
    rivalScore: 6100,
    rivalName: "MIRA",
    rivalAvatar: "/avatars/avatar-1.svg",
    instruction: "Desliza a izquierda o derecha entre siete carriles y hacia arriba para saltar.",
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
    instruction: "Usa los controles inferiores para subir o bajar de órbita.",
    scoring: "Supera obstáculos hasta el primer impacto.",
  },
  {
    id: "solitaire-sprint",
    name: "Solitaire Sprint",
    cover: "/covers/solitaire-sprint.svg",
    enabled: true,
    waitingStakes: [1, 5],
    category: "CARTAS",
    tagline: "Misma baraja. Gana quien avance más y más rápido.",
    difficulty: "MEDIA",
    skillLabel: "PLANIFICACIÓN + VELOCIDAD",
    rivalScore: 22500,
    rivalName: "ACE",
    rivalAvatar: "/avatars/avatar-5.svg",
    instruction: "Toca cartas para moverlas. Ambos jugadores reciben exactamente la misma baraja.",
    scoring: "Sube cartas a las bases y optimiza cada movimiento.",
    deterministicSeed: "solitaire-arena-001",
  },
  {
    id: "mine-grid",
    name: "Mine Grid",
    cover: "/covers/mine-grid.svg",
    enabled: true,
    waitingStakes: [1, 10],
    category: "LÓGICA",
    tagline: "Mismo campo. Cada decisión cuenta.",
    difficulty: "MEDIA",
    skillLabel: "DEDUCCIÓN + VELOCIDAD",
    rivalScore: 8600,
    rivalName: "NODE",
    rivalAvatar: "/avatars/avatar-4.svg",
    instruction: "Destapa casillas. Ambos jugadores reciben exactamente el mismo campo de minas.",
    scoring: "Suma casillas seguras sin tocar una mina.",
    deterministicSeed: "mine-grid-arena-001",
  },
  {
    id: "grid-serpent",
    name: "Grid Serpent",
    cover: "/covers/grid-serpent.svg",
    enabled: true,
    waitingStakes: [5, 10],
    category: "CONTROL",
    tagline: "Misma ruta de comida. Sobrevive mejor.",
    difficulty: "ALTA",
    skillLabel: "CONTROL + ANTICIPACIÓN",
    rivalScore: 7000,
    rivalName: "VIPER",
    rivalAvatar: "/avatars/avatar-6.svg",
    instruction: "Desliza para cambiar de dirección. La secuencia de comida es idéntica para ambos.",
    scoring: "Come, crece y evita paredes y tu propio cuerpo.",
    deterministicSeed: "grid-serpent-arena-001",
  },


  {
    id: "brick-relay",
    name: "Brick Relay",
    cover: "/covers/brick-relay.svg",
    enabled: true,
    waitingStakes: [5, 50],
    category: "PRECISIÓN",
    tagline: "Mismo muro y misma física. Devuelve cada bola.",
    difficulty: "ALTA",
    skillLabel: "PRECISIÓN + CONTROL",
    rivalScore: 6800,
    rivalName: "RICO",
    rivalAvatar: "/avatars/avatar-1.svg",
    instruction: "Arrastra para mover la pala. El mapa y el lanzamiento inicial son idénticos.",
    scoring: "Rompe bloques sin dejar caer la bola.",
    deterministicSeed: "brick-relay-arena-001",
  },
  {
    id: "stack-shift",
    name: "Stack Shift",
    cover: "/covers/stack-shift.svg",
    enabled: true,
    waitingStakes: [10, 50],
    category: "PUZZLE",
    tagline: "Misma secuencia. Construye mejor bajo presión.",
    difficulty: "ALTA",
    skillLabel: "ESPACIO + VELOCIDAD",
    rivalScore: 7400,
    rivalName: "STACK",
    rivalAvatar: "/avatars/avatar-3.svg",
    instruction: "Mueve, gira y baja piezas. Ambos reciben la misma secuencia exacta.",
    scoring: "Completa filas y evita alcanzar la parte superior.",
    deterministicSeed: "stack-shift-arena-001",
  },

];

export function modeForStake(
  game: GameMeta,
  stake: Stake,
  nextTurn: "create" | "existing"
): MatchMode {
  if (stake === 0) return "create";
  if (game.waitingStakes.includes(stake)) return "waiting";
  return nextTurn;
}

export function prizeForStake(stake: Stake) {
  if (stake === 0) return 0;
  return Number((stake * 2).toFixed(2));
}
