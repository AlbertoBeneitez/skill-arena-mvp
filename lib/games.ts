import { ROULETTE_ACTIONS_V8 as ROULETTE_ACTIONS_V3 } from "./verified/galacticRouletteProtocol.v8";
import { ROULETTE_ACTIONS } from "./verified/galacticRouletteProtocol.v1";
import { SLOT_ACTIONS } from "./verified/galacticSlotProtocol.v1";
import { MEMORY_ACTIONS } from "./verified/memoryMatchProtocol.v1";
import { STACK_SHIFT_ACTIONS } from "./verified/stackShiftProtocol.v1";
import { SHOT_GALLERY_ACTIONS_V3 as SHOT_GALLERY_ACTIONS } from "./verified/shotGalleryProtocol.v3";
import { DARTS_ACTIONS } from "./verified/dartsProtocol.v1";
import { BILLIARDS_ACTIONS_V3 } from "./verified/billiardsCore.v3";
import { ORB_ACTIONS_V5 as ORB_ACTIONS } from "./verified/orbBurstProtocol.v5";
import { PINBALL_ACTIONS_V3 } from "./verified/pinballProtocol.v3";
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
  /** Legacy/demo seed. Verified games must use the server-issued manifest seed. */
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
  resultMetric?: "fictitious-balance";
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
  { id: "galactic-roulette", version: "8.0.0", status: "VERIFIED", loadComponent: adaptGameComponent(() => import("@/components/games/GalacticRoulette")), competition: {verification:"server-replay",engineVersion:"skill-core-3",inputProtocolVersion:4,allowedActions:ROULETTE_ACTIONS_V3}, resultMetric:"fictitious-balance", name:"Galactic Roulette",cover:"/covers/galactic-roulette.svg",enabled:true,waitingStakes:[1,5],category:"PRECISIÓN",tagline:"Una rueda orbital y un lanzamiento preciso.",difficulty:"MEDIA",skillLabel:"TIMING + LANZAMIENTO",rivalScore:1000000000,rivalName:"NOVA",rivalAvatar:"/avatars/avatar-3.svg",instruction:"",scoring:"Ruleta europea de cero único con 100 fichas ficticias: coloca fichas de 1, 5 o 25 en el tapete (el tapete se vacía al acabar cada tirada; la bola no puede salir de la rueda) y lanza la bola desde el lanzador exterior. La partida acaba cuando decides parar (TERMINAR) o te quedas sin fichas. Lanzamiento cuantizado, fricción y posición autoritativa; saldo terminal por replay." },
  {
    id: "galactic-slot", version: "3.0.0", status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/GalacticSlot")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 3, allowedActions: SLOT_ACTIONS },
    resultMetric: "fictitious-balance", name: "Galactic Slot", cover: "/covers/galactic-slot.svg", enabled: true,
    waitingStakes: [1,5], category: "PRECISIÓN", tagline: "Tres franjas, una combinación orbital.", difficulty: "MEDIA", skillLabel: "OBSERVACIÓN + PLANIFICACIÓN", rivalScore: 1000000000,
    rivalName: "VEGA", rivalAvatar: "/avatars/avatar-4.svg", instruction: "", scoring: "Saldo ficticio final: 100€ iniciales, 5€ por tirada, máximo tres minutos. Orden fijo y avances de −4 a +4 posiciones, sin jugada 000. Servidor reproduce inputs y saldo; sin dinero real.",
  },

  {
    id: "memory-match", version: "2.0.0", status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/MemoryOrbit")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 1, allowedActions: MEMORY_ACTIONS },
    name: "Memoria", cover: "/covers/memory-match.svg", enabled: false,
    waitingStakes: [1, 5], category: "MEMORIA", tagline: "Doce parejas orbitales en una sola partida.",
    difficulty: "MEDIA", skillLabel: "MEMORIA + PRECISIÓN", rivalScore: 12000,
    rivalName: "LYRA", rivalAvatar: "/avatars/avatar-7.svg", instruction: "",
    scoring: "Avance por parejas únicas; tablero continuo sin preview; exploración sin pérdida de vidas. Replay de servidor.",
  },
  {
    id: "darts", version: "3.0.0", status: "VERIFIED", loadComponent: adaptGameComponent(() => import("@/components/games/Darts")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 1, allowedActions: DARTS_ACTIONS },
    name: "Dardos", cover: "/covers/darts.svg", enabled: true, waitingStakes: [1,5], category: "PRECISIÓN", tagline: "Veinte lanzamientos, una diana orbital.", difficulty: "MEDIA", skillLabel: "PUNTERÍA + TIMING", rivalScore: 800, rivalName: "NOVA", rivalAvatar: "/avatars/avatar-3.svg", instruction: "Desliza desde abajo hacia la diana y suelta para lanzar.", scoring: "Suma cruda de20tiradas en una diana continua. Sin bonus por objetivos/combo. Swipe ascendente, vuelo1s y progresión suave de estabilidad/presión. Replay autoritativo.",
  },
  {
    id: "billiards", version: "4.0.0", status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/Billiards")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 2, allowedActions: BILLIARDS_ACTIONS_V3 },
    name: "Billar", cover: "/covers/billiards.svg", enabled: true, waitingStakes: [1, 5], category: "PRECISIÓN", tagline: "Apunta, elige potencia y despeja la mesa orbital.", difficulty: "MEDIA", skillLabel: "ÁNGULO + POTENCIA", rivalScore: 8000, rivalName: "VEGA", rivalAvatar: "/avatars/avatar-4.svg", instruction: "Tira del taco hacia atrás para ajustar dirección y potencia; suelta para golpear.", scoring: "Diez objetivos, dieciocho tiros y una mesa continua sin obstáculos; la disposición inicial cambia en cada partida. Avance por embocadas únicas, posiciones conservadas entre tiros.",
  },
  {
    id: "tower-drop",
    version: "4.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/TowerDropV3")),
    competition: {
      verification: "server-replay",
      engineVersion: "skill-core-3",
      inputProtocolVersion: 3,
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
    instruction: "Toca para soltar. Alinea el apoyo sobre la torre.",
    scoring: "Sigue apilando: tienes tres vidas y pierdes una cada vez que un bloque falla o se vuelca.",
  },
  {
    id: "solitaire-sprint",
    version: "0.2.0",
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
    version: "0.2.0",
    status: "INTEGRATED",
    loadComponent: adaptGameComponent(() => import("@/components/games/MineGridEntry")),
    competition: { verification: "client-result" },
    name: "Mine Grid",
    cover: "/covers/mine-grid.svg",
    enabled: true,
    waitingStakes: [1, 10],
    category: "LÓGICA",
    tagline: "Mismo campo. Cada decisión cuenta.",
    difficulty: "MEDIA",
    skillLabel: "DEDUCCIÓN + VELOCIDAD",
    rivalScore: 6000,
    rivalName: "NODE",
    rivalAvatar: "/avatars/avatar-4.svg",
    instruction: "Toca para destapar y mantén pulsada una casilla para marcarla. Ambos jugadores reciben el mismo campo.",
    scoring: "Si no lo resuelves, puntúan las casillas bien asignadas. Si lo resuelves, puntúa el tiempo: cuanto más rápido, más puntos.",
    deterministicSeed: "mine-grid-arena-001",
  },


  {
    id: "stack-shift",
    version: "3.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/StackShiftVerified")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 1, allowedActions: STACK_SHIFT_ACTIONS },
    name: "Stack Shift",
    cover: "/covers/stack-shift.svg",
    enabled: true,
    waitingStakes: [10, 50],
    category: "PUZZLE",
    tagline: "Misma secuencia. Construye mejor bajo presión.",
    difficulty: "MEDIA",
    skillLabel: "ESPACIO + VELOCIDAD",
    rivalScore: 16000,
    rivalName: "STACK",
    rivalAvatar: "/avatars/avatar-3.svg",
    instruction: "Mueve, gira y baja piezas. Ambos reciben la misma secuencia exacta.",
    scoring: "Completa filas y evita alcanzar la parte superior.",

  },
  {
    id: "orb-burst",
    version: "5.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/OrbBurstVerified")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 5, allowedActions: ORB_ACTIONS },
    name: "Orb Burst",
    cover: "/covers/orb-burst.svg",
    enabled: true,
    waitingStakes: [5, 50],
    category: "PUZZLE",
    tagline: "Un campo continuo, decisiones encadenadas.",
    difficulty: "MEDIA",
    skillLabel: "ÁNGULO + PLANIFICACIÓN",
    rivalScore: 108,
    rivalName: "ORB",
    rivalAvatar: "/avatars/avatar-5.svg",
    instruction: "Apunta, suelta y junta tres o más. Gana poderes con los combos y elige cuándo usarlos.",
    scoring: "Avance por los 108 orbes originales retirados. Fases que aprietan, hielo de dos golpes, asteroides, y poderes (bomba, rayo, arcoíris) que ganas con combos y eliges tú. Replay de servidor.",

  },
  {
    id: "precision-stack",
    version: "4.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/Stack3D")),
    competition: {
      verification: "server-replay",
      engineVersion: "skill-core-3",
      inputProtocolVersion: 3,
      allowedActions: ["DROP"],
    },
    name: "Stack",
    cover: "/covers/stack-3d.svg",
    enabled: true,
    waitingStakes: [1, 10],
    category: "PRECISIÓN",
    tagline: "Acopla módulos. Eleva la estación.",
    difficulty: "MEDIA",
    skillLabel: "TIMING + PRECISIÓN",
    rivalScore: 1000000,
    rivalName: "EDGE",
    rivalAvatar: "/avatars/avatar-2.svg",
    instruction: "Toca al alinear las caras. La siguiente pieza cruza por el otro eje.",
    scoring: "Se conserva la intersección real en X/Z. Gana la torre más alta; la superficie total apilada solo desempata a igual altura. Si fallas, ves caer el último bloque.",
    deterministicSeed: "precision-stack-arena-001",
  },
  {
    id: "reaction-test",
    version: "6.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/ShotGallery")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 3, allowedActions: SHOT_GALLERY_ACTIONS },
    name: "Shot Gallery",
    cover: "/covers/shot-gallery.svg",
    enabled: true,
    waitingStakes: [1, 50],
    category: "REACCIÓN",
    tagline: "Reconoce el objetivo. Reacciona con precisión.",
    difficulty: "ALTA",
    skillLabel: "REACCIÓN + RECONOCIMIENTO",
    rivalScore: 6000,
    rivalName: "FLASH",
    rivalAvatar: "/avatars/avatar-1.svg",
    instruction: "Espera al punto verde y toca lo que pide la orden: manchas de color, figuras grises o la figura de color que cumple ambas características.",
    scoring: "Doce órdenes (color, figura gris, o la figura de color que cumple ambas características) sobre objetivos repartidos al azar; algunas piden tocar varios. Cada acierto puntúa más cuanto más rápido; anticiparse (punto rojo) o fallar penaliza. Se guardan tus tiempos de reacción.",
  },

  {
    id: "pinball",
    version: "3.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/PinballVerified")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 1, allowedActions: PINBALL_ACTIONS_V3 },
    name: "Pinball",
    cover: "/covers/pinball.svg",
    enabled: true,
    waitingStakes: [5, 10],
    category: "CONTROL",
    tagline: "Una bola, un minuto: carga el muelle, encadena tiros y sube el multiplicador.",
    difficulty: "MEDIA",
    skillLabel: "REFLEJOS + TIMING",
    rivalScore: 20000,
    rivalName: "FLIP",
    rivalAvatar: "/avatars/avatar-2.svg",
    instruction: "",
    scoring: "Una sola bola y 60 s. La potencia del muelle fija el lanzamiento; los laterales están cerrados y solo hay un hueco entre las palas: si la bola cae por ahí vuelve al muelle (el multiplicador y el combo se reinician) y el reloj sigue corriendo. Skill shot, carriles A-B-C, bumpers, spinner, bloque de dianas abatibles, dianas laterales, rampa, órbita, plato con jackpot, combos y bonus final con multiplicador hasta x5. Replay de servidor.",
  },

] as const satisfies readonly GameDefinition[];

export type GameId = (typeof GAME_DEFINITIONS)[number]["id"];
export type GameMeta = GameDefinition<GameId>;

export const GAME_REGISTRY = Object.fromEntries(
  GAME_DEFINITIONS.map((game) => [game.id, game])
) as unknown as Record<GameId, GameMeta>;

// SATURN: the 12 archived games were removed from the code (full history in branch archive/pre-saturn).
const CATALOG_ORDER: GameId[] = [
  "galactic-roulette",
  "galactic-slot",
  "darts",
  "billiards",
  "precision-stack",
  "tower-drop",
  "orb-burst",
  "reaction-test",
  "solitaire-sprint",
  "mine-grid",
  "stack-shift",
  "pinball",
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
