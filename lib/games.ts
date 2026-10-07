import type { ComponentType } from "react";
import type { GameResult } from "./types";

export const STAKES = [0, 1, 5, 10, 50] as const;

export type Stake = (typeof STAKES)[number];
export type MatchMode = "create" | "existing" | "waiting";
export type GameMaturity =
  | "DEMO"
  | "INTEGRATED"
  | "VERIFIED"
  | "PRODUCTION-GRADE";

export type GameRuntimeProps = {
  active: boolean;
  stake: number;
  ghostEnabled: boolean;
  targetScore: number;
  seed: string;
  onFinish: (result: GameResult) => void;
};

type GameComponentModule = {
  default: ComponentType<GameRuntimeProps>;
};

export type GameComponentLoader = () => Promise<GameComponentModule>;

export type GameCompetitionDefinition =
  | {
      verification: "client-result";
    }
  | {
      verification: "server-replay";
      engineVersion: string;
      inputProtocolVersion: number;
      allowedActions: readonly string[];
    };

export type GameDefinition<TId extends string = string> = {
  id: TId;
  version: string;
  status: GameMaturity;
  loadComponent: GameComponentLoader;
  competition: GameCompetitionDefinition;
  name: string;
  cover: string;
  enabled: boolean;
  waitingStakes: readonly Stake[];
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

/**
 * Legacy components intentionally keep their narrow prop types while the
 * platform migrates them one by one. This is the only compatibility cast.
 * New games should accept GameRuntimeProps directly.
 */
function adaptGameComponent<TProps extends object>(
  loader: () => Promise<{ default: ComponentType<TProps> }>
): GameComponentLoader {
  return loader as unknown as GameComponentLoader;
}

const GAME_DEFINITIONS = [
  {
    id: "tower-drop",
    version: "2.1.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/TowerDrop")),
    competition: {
      verification: "server-replay",
      engineVersion: "skill-core-2",
      inputProtocolVersion: 2,
      allowedActions: ["DROP"],
    },
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
    version: "0.1.0",
    status: "INTEGRATED",
    loadComponent: adaptGameComponent(() => import("@/components/games/JetStream")),
    competition: { verification: "client-result" },
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
    instruction: "Toca para dar un impulso hacia arriba y atraviesa las puertas.",
    scoring: "Atraviesa puertas hasta chocar.",
  },
  {
    id: "pulse-runner",
    version: "0.1.0",
    status: "INTEGRATED",
    loadComponent: adaptGameComponent(() => import("@/components/games/PulseRunner")),
    competition: { verification: "client-result" },
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
    instruction: "Toca para saltar. Un toque produce siempre el mismo salto.",
    scoring: "Sigue hasta colisionar.",
  },
  {
    id: "metro-shift",
    version: "0.1.0",
    status: "INTEGRATED",
    loadComponent: adaptGameComponent(() => import("@/components/games/MetroShift")),
    competition: { verification: "client-result" },
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
    version: "0.1.0",
    status: "INTEGRATED",
    loadComponent: adaptGameComponent(() => import("@/components/games/OrbitShift")),
    competition: { verification: "client-result" },
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
    version: "0.1.0",
    status: "INTEGRATED",
    loadComponent: adaptGameComponent(() => import("@/components/games/SolitaireSprint")),
    competition: { verification: "client-result" },
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
    version: "0.1.0",
    status: "INTEGRATED",
    loadComponent: adaptGameComponent(() => import("@/components/games/MineGrid")),
    competition: { verification: "client-result" },
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
    version: "0.1.0",
    status: "INTEGRATED",
    loadComponent: adaptGameComponent(() => import("@/components/games/GridSerpent")),
    competition: { verification: "client-result" },
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
    version: "0.1.0",
    status: "INTEGRATED",
    loadComponent: adaptGameComponent(() => import("@/components/games/BrickRelay")),
    competition: { verification: "client-result" },
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
    version: "0.1.0",
    status: "INTEGRATED",
    loadComponent: adaptGameComponent(() => import("@/components/games/StackShift")),
    competition: { verification: "client-result" },
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
  {
    id: "maze-rush",
    version: "0.1.0",
    status: "INTEGRATED",
    loadComponent: adaptGameComponent(() => import("@/components/games/MazeRush")),
    competition: { verification: "client-result" },
    name: "Maze Rush",
    cover: "/covers/maze-rush.svg",
    enabled: true,
    waitingStakes: [1, 5],
    category: "LABERINTO",
    tagline: "Mismo laberinto. Mejor ruta y mejores reflejos.",
    difficulty: "ALTA",
    skillLabel: "RUTA + REACCIÓN",
    rivalScore: 7800,
    rivalName: "ECHO",
    rivalAvatar: "/avatars/avatar-6.svg",
    instruction: "Desliza o usa la cruceta. Recoge nodos y evita a los perseguidores.",
    scoring: "Todos reciben el mismo mapa y el mismo patrón de perseguidores.",
    deterministicSeed: "maze-rush-arena-001",
  },
  {
    id: "star-phalanx",
    version: "0.1.0",
    status: "INTEGRATED",
    loadComponent: adaptGameComponent(() => import("@/components/games/StarPhalanx")),
    competition: { verification: "client-result" },
    name: "Star Phalanx",
    cover: "/covers/star-phalanx.svg",
    enabled: true,
    waitingStakes: [5, 10],
    category: "SHOOTER",
    tagline: "Misma formación. Sobrevive y elimina más.",
    difficulty: "ALTA",
    skillLabel: "PUNTERÍA + CONTROL",
    rivalScore: 8200,
    rivalName: "ION",
    rivalAvatar: "/avatars/avatar-8.svg",
    instruction: "Arrastra para moverte y pulsa FIRE para disparar.",
    scoring: "Las oleadas y disparos enemigos parten del mismo seed competitivo.",
    deterministicSeed: "star-phalanx-arena-001",
  },
  {
    id: "river-dash",
    version: "0.1.0",
    status: "INTEGRATED",
    loadComponent: adaptGameComponent(() => import("@/components/games/RiverDash")),
    competition: { verification: "client-result" },
    name: "River Dash",
    cover: "/covers/river-dash.svg",
    enabled: true,
    waitingStakes: [1, 10],
    category: "CRUCE",
    tagline: "Mismos carriles. El timing decide.",
    difficulty: "ALTA",
    skillLabel: "TIMING + LECTURA",
    rivalScore: 6600,
    rivalName: "FORD",
    rivalAvatar: "/avatars/avatar-2.svg",
    instruction: "Desliza o usa la cruceta para cruzar carretera y río.",
    scoring: "Ambos jugadores reciben idénticas velocidades, fases y carriles.",
    deterministicSeed: "river-dash-arena-001",
  },
  {
    id: "orb-burst",
    version: "0.1.0",
    status: "INTEGRATED",
    loadComponent: adaptGameComponent(() => import("@/components/games/OrbBurst")),
    competition: { verification: "client-result" },
    name: "Orb Burst",
    cover: "/covers/orb-burst.svg",
    enabled: true,
    waitingStakes: [5, 50],
    category: "PUZZLE",
    tagline: "Mismo tablero y misma cola de orbes.",
    difficulty: "MEDIA",
    skillLabel: "ÁNGULO + PLANIFICACIÓN",
    rivalScore: 7600,
    rivalName: "ORB",
    rivalAvatar: "/avatars/avatar-5.svg",
    instruction: "Apunta arrastrando y suelta para lanzar. Junta tres o más.",
    scoring: "El tablero inicial, la cola de colores y la presión son idénticos.",
    deterministicSeed: "orb-burst-arena-001",
  },
  {
    id: "precision-stack",
    version: "1.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/PrecisionStack")),
    competition: {
      verification: "server-replay",
      engineVersion: "skill-core-1",
      inputProtocolVersion: 1,
      allowedActions: ["DROP"],
    },
    name: "Stack",
    cover: "/covers/precision-stack.svg",
    enabled: true,
    waitingStakes: [1, 10],
    category: "PRECISIÓN",
    tagline: "Corta menos. Apila más.",
    difficulty: "MEDIA",
    skillLabel: "TIMING + PRECISIÓN",
    rivalScore: 7600,
    rivalName: "EDGE",
    rivalAvatar: "/avatars/avatar-2.svg",
    instruction: "Toca para soltar el bloque móvil sobre el anterior.",
    scoring: "El solape conservado determina la dificultad de los siguientes bloques.",
    deterministicSeed: "precision-stack-arena-001",
  },
  {
    id: "merge-2048",
    version: "0.1.0",
    status: "INTEGRATED",
    loadComponent: adaptGameComponent(() => import("@/components/games/Merge2048")),
    competition: { verification: "client-result" },
    name: "2048",
    cover: "/covers/merge-2048.svg",
    enabled: true,
    waitingStakes: [1, 5],
    category: "PUZZLE",
    tagline: "Misma secuencia. Mejores decisiones.",
    difficulty: "ALTA",
    skillLabel: "PLANIFICACIÓN + EFICIENCIA",
    rivalScore: 6200,
    rivalName: "MERGE",
    rivalAvatar: "/avatars/avatar-4.svg",
    instruction: "Desliza o usa las flechas para fusionar valores iguales.",
    scoring: "La secuencia de valores y selectores de aparición es idéntica para ambos.",
    deterministicSeed: "merge-2048-arena-001",
  },
  {
    id: "piano-rush",
    version: "1.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/PianoRush")),
    competition: {
      verification: "server-replay",
      engineVersion: "skill-core-1",
      inputProtocolVersion: 1,
      allowedActions: ["LANE_0", "LANE_1", "LANE_2", "LANE_3"],
    },
    name: "Piano Rush",
    cover: "/covers/piano-rush.svg",
    enabled: true,
    waitingStakes: [5, 10],
    category: "RITMO",
    tagline: "Cuatro carriles. Una señal. Cero margen.",
    difficulty: "ALTA",
    skillLabel: "RITMO + REACCIÓN",
    rivalScore: 8800,
    rivalName: "KEY",
    rivalAvatar: "/avatars/avatar-7.svg",
    instruction: "Toca el carril correcto cuando el pulso alcance la zona inferior.",
    scoring: "La secuencia y el calendario de pulsos proceden del mismo seed competitivo.",
  },
  {
    id: "dino-dash",
    version: "0.1.0",
    status: "INTEGRATED",
    loadComponent: adaptGameComponent(() => import("@/components/games/DinoDash")),
    competition: { verification: "client-result" },
    name: "Dino Dash",
    cover: "/covers/dino-dash.svg",
    enabled: true,
    waitingStakes: [1, 5],
    category: "RUNNER",
    tagline: "Corre. Salta. Agáchate. Sigue.",
    difficulty: "MEDIA",
    skillLabel: "TIMING + LECTURA",
    rivalScore: 7200,
    rivalName: "REX",
    rivalAvatar: "/avatars/avatar-8.svg",
    instruction: "Toca para saltar y usa ↓ para agacharte bajo obstáculos altos.",
    scoring: "Ambos reciben la misma secuencia exacta de obstáculos.",
    deterministicSeed: "dino-dash-arena-001",
  },
  {
    id: "reaction-test",
    version: "0.1.0",
    status: "INTEGRATED",
    loadComponent: adaptGameComponent(() => import("@/components/games/ReactionTest")),
    competition: { verification: "client-result" },
    name: "Reaction Test",
    cover: "/covers/reaction-test.svg",
    enabled: true,
    waitingStakes: [1, 50],
    category: "REACCIÓN",
    tagline: "No adivines. Reacciona.",
    difficulty: "ALTA",
    skillLabel: "REACCIÓN PURA",
    rivalScore: 4300,
    rivalName: "FLASH",
    rivalAvatar: "/avatars/avatar-1.svg",
    instruction: "Espera a que cambie la señal y toca lo más rápido posible.",
    scoring: "Cinco rondas con esperas deterministas; anticiparse penaliza.",
    deterministicSeed: "reaction-test-arena-001",
  },
  {
    id: "sky-hop",
    version: "0.1.0",
    status: "INTEGRATED",
    loadComponent: adaptGameComponent(() => import("@/components/games/SkyHop")),
    competition: { verification: "client-result" },
    name: "Sky Hop",
    cover: "/covers/sky-hop.svg",
    enabled: true,
    waitingStakes: [5, 10],
    category: "PLATAFORMAS",
    tagline: "Rebota y sigue subiendo.",
    difficulty: "ALTA",
    skillLabel: "CONTROL + ANTICIPACIÓN",
    rivalScore: 7600,
    rivalName: "HOP",
    rivalAvatar: "/avatars/avatar-3.svg",
    instruction: "Mantén izquierda o derecha para dirigir el salto automático.",
    scoring: "Mismas plataformas, movimientos y distancias para ambos.",
    deterministicSeed: "sky-hop-arena-001",
  },

] as const satisfies readonly GameDefinition[];

export type GameId = (typeof GAME_DEFINITIONS)[number]["id"];
export type GameMeta = GameDefinition<GameId>;

export const GAME_REGISTRY = Object.fromEntries(
  GAME_DEFINITIONS.map((game) => [game.id, game])
) as unknown as Record<GameId, GameMeta>;

const CATALOG_ORDER: GameId[] = [
  "precision-stack",
  "tower-drop",
  "merge-2048",
  "jet-stream",
  "piano-rush",
  "dino-dash",
  "orb-burst",
  "reaction-test",
  "river-dash",
  "sky-hop",
  "pulse-runner",
  "metro-shift",
  "orbit-shift",
  "solitaire-sprint",
  "mine-grid",
  "grid-serpent",
  "brick-relay",
  "stack-shift",
  "maze-rush",
  "star-phalanx",
];

export const GAMES: GameMeta[] = CATALOG_ORDER.map(
  (id) => GAME_REGISTRY[id]
);

export function isGameId(value: string): value is GameId {
  return Object.prototype.hasOwnProperty.call(
    GAME_REGISTRY,
    value
  );
}

export function getGameDefinition(
  gameId: string
): GameMeta | undefined {
  return isGameId(gameId)
    ? GAME_REGISTRY[gameId]
    : undefined;
}

export function modeForStake(
  game: GameMeta,
  stake: Stake,
  nextTurn: "create" | "existing"
): MatchMode {
  if (stake === 0) return "create";

  // A green/create attempt always grants exactly one blue reply.
  // That earned reply takes priority over the ambient purple queue.
  if (nextTurn === "existing") return "existing";

  if (game.waitingStakes.includes(stake)) return "waiting";
  return "create";
}

export function prizeForStake(stake: number) {
  if (stake === 0) return 0;
  return Number((stake * 2).toFixed(2));
}
