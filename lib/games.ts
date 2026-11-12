import { ROULETTE_ACTIONS_V8 as ROULETTE_ACTIONS_V3 } from "./verified/galacticRouletteProtocol.v8";
import { SLOT_ACTIONS } from "./verified/galacticSlotProtocol.v1";
import { MEMORY_ACTIONS } from "./verified/memoryMatchProtocol.v1";
import { STACK_SHIFT_ACTIONS } from "./verified/stackShiftProtocol.v1";
import { SHOT_GALLERY_ACTIONS_V3 as SHOT_GALLERY_ACTIONS } from "./verified/shotGalleryProtocol.v3";
import { DARTS_ACTIONS } from "./verified/dartsProtocol.v1";
import { BILLIARDS_ACTIONS_V3 } from "./verified/billiardsCore.v3";
import { ORB_ACTIONS_V6 as ORB_ACTIONS } from "./verified/orbBurstProtocol.v6";
import { PINBALL_ACTIONS_V3 } from "./verified/pinballProtocol.v3";
import { CORNER_SUDOKU_ACTIONS_V3 } from "./verified/cornerSudokuProtocol.v3";
import { BOWLING_ACTIONS_V2 } from "./verified/bowlingProtocol.v2";
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
  /** v164: who made the game, shown before each match. Games sent through «Enviar juego» will carry their author;
   * the house games are by the studio (GAME_CREATOR_DEFAULT). */
  creator?: string;
  /**
   * How the score reads. Default: points (higher wins). "fictitious-balance": closing chips.
   * "reaction-time-ms": accumulated milliseconds, LOWER wins (the core also publishes reach = base − ms).
   * "orbs-eliminated": orbs popped or dropped (higher wins).
   */
  resultMetric?: ResultMetric;
};
export type ResultMetric = "fictitious-balance" | "reaction-time-ms" | "orbs-eliminated";
/** Local best-score slot: a game whose score unit changed keeps its new bests apart from the old ones. */
export const bestScoreKey = (game: Pick<GameMeta, "id" | "resultMetric">) => (game.resultMetric === "orbs-eliminated" ? `${game.id}@orbs` : game.id);

/** True when a smaller score is the better one. */
export const lowerScoreWins = (game: Pick<GameMeta, "resultMetric">) => game.resultMetric === "reaction-time-ms";
/** Does `score` beat (or tie) the `target`? */
export const scoreBeats = (game: Pick<GameMeta, "resultMetric">, score: number, target: number) =>
  lowerScoreWins(game) ? score <= target : score >= target;
/** Is `score` better than `previous` (an absent previous is always beaten)? */
export const isBetterScore = (game: Pick<GameMeta, "resultMetric">, score: number, previous: number | undefined) =>
  previous === undefined || (lowerScoreWins(game) ? score < previous : score > previous);
/** Sort comparator that puts the best score first. */
export const compareScores = (game: Pick<GameMeta, "resultMetric">) => (a: number, b: number) =>
  lowerScoreWins(game) ? a - b : b - a;

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
  { id: "galactic-roulette", version: "21.0.0", status: "VERIFIED", loadComponent: adaptGameComponent(() => import("@/components/games/GalacticRoulette")), competition: {verification:"server-replay",engineVersion:"skill-core-3",inputProtocolVersion:4,allowedActions:ROULETTE_ACTIONS_V3}, resultMetric:"fictitious-balance", name:"Roulette",cover:"/covers/galactic-roulette.webp?v=140",enabled:false,waitingStakes:[1,5],category:"PRECISIÓN",tagline:"Una rueda orbital y un lanzamiento preciso.",difficulty:"MEDIA",skillLabel:"TIMING + LANZAMIENTO",rivalScore:1000000000,rivalName:"NOVA",rivalAvatar:"/avatars/avatar-3.svg",instruction:"",scoring:"Ruleta europea de cero único con 100 fichas ficticias: coloca fichas de 1, 5 o 25 en el tapete (el tapete se vacía al acabar cada tirada; la bola no puede salir de la rueda) y lanza la bola desde el lanzador exterior (solo con fichas en el tapete); los ocho rombos de la pista la desvían y la hacen saltar. La partida acaba cuando decides parar (TERMINAR) o te quedas sin fichas. Lanzamiento cuantizado, fricción y posición autoritativa; saldo terminal por replay. La bola se lanza en parábola desde la cuna (dirección y fuerza deciden dónde cae), rebota a cámara lenta en el cuenco según la inclinación de cada superficie (unos 8 botes) y, cuando deja de botar, rueda hasta una casilla." },
  {
    id: "galactic-slot", version: "4.0.0", status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/GalacticSlot")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 4, allowedActions: SLOT_ACTIONS },
    resultMetric: "fictitious-balance", name: "Slot", cover: "/covers/galactic-slot.webp?v=156", enabled: true,
    waitingStakes: [1,5], category: "PRECISIÓN", tagline: "Tres franjas, una combinación orbital.", difficulty: "MEDIA", skillLabel: "OBSERVACIÓN + PLANIFICACIÓN", rivalScore: 1000000000,
    rivalName: "VEGA", rivalAvatar: "/avatars/avatar-4.svg", instruction: "", scoring: "Saldo ficticio final: 100 fichas iniciales, 5 por tirada, máximo tres minutos. Siete símbolos en orden fijo y avances de −3 a +3 posiciones, sin jugada 000. Trío: 20 a 120 fichas según el símbolo (tres sietes, 200); pareja: 5 a 30 (dos sietes, 40); sin pareja no hay premio. Servidor reproduce inputs y saldo; sin dinero real.",
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
    name: "Dardos", cover: "/covers/darts.webp?v=173", enabled: true, waitingStakes: [1,5], category: "PRECISIÓN", tagline: "Veinte lanzamientos, una diana orbital.", difficulty: "MEDIA", skillLabel: "PUNTERÍA + TIMING", rivalScore: 800, rivalName: "NOVA", rivalAvatar: "/avatars/avatar-3.svg", instruction: "Desliza desde abajo hacia la diana y suelta para lanzar.", scoring: "Suma cruda de20tiradas en una diana continua. Sin bonus por objetivos/combo. Swipe ascendente, vuelo1s y progresión suave de estabilidad/presión. Replay autoritativo.",
  },
  {
    id: "billiards", version: "7.0.0", status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/Billiards")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 2, allowedActions: BILLIARDS_ACTIONS_V3 },
    name: "Billar", cover: "/covers/billiards.webp?v=178", enabled: true, waitingStakes: [1, 5], category: "PRECISIÓN", tagline: "Gymkana de cinco mesas: mete las bolas lisas y la 8 al final.", difficulty: "MEDIA", skillLabel: "ÁNGULO + POTENCIA", rivalScore: 9000, rivalName: "VEGA", rivalAvatar: "/avatars/avatar-4.svg", instruction: "Tira hacia atrás desde cualquier punto de la pantalla para apuntar y dar potencia; suelta para golpear.", scoring: "Gymkana de 5 niveles con una mesa nueva en cada partida (la misma para todos en esa partida): 1) dos bolas junto a dos huecos, 4 tiros; 2) tres bolas pegadas a tres bandas, 5 tiros; 3) dos bolas en línea hacia un hueco y una más, 5 tiros; 4) tres bolas detrás de un muro de tres rayadas, 6 tiros; 5) cuatro bolas, dos rayadas y la 8, que va la última, 7 tiros. Cada lisa suma 1000; cada rayada resta 400; la blanca en un hueco resta 250 y vuelve a la mesa; la 8 al final suma 2000 y antes de tiempo resta 500 y vuelve. Limpiar un nivel suma 500 y 150 por tiro que sobre; si se acaban los tiros se pasa al siguiente nivel sin bonus. Replay de servidor.",
  },
  {
    id: "tower-drop",
    version: "5.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/TowerDropV3")),
    competition: {
      verification: "server-replay",
      engineVersion: "skill-core-3",
      inputProtocolVersion: 3,
      allowedActions: ["DROP"],
    },
    name: "Tower Drop",
    cover: "/covers/tower-drop.webp?v=166",
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
    cover: "/covers/solitaire-sprint.webp?v=164",
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
    cover: "/covers/mine-grid.webp?v=175",
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
    version: "4.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/StackShiftVerified")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 1, allowedActions: STACK_SHIFT_ACTIONS },
    name: "Stack Shift",
    cover: "/covers/stack-shift.webp?v=178",
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
    version: "8.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/OrbBurstVerified")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 6, allowedActions: ORB_ACTIONS },
    resultMetric: "orbs-eliminated",
    name: "Orb Burst",
    cover: "/covers/orb-burst.webp?v=178",
    enabled: true,
    waitingStakes: [5, 50],
    category: "PUZZLE",
    tagline: "Un campo continuo, decisiones encadenadas.",
    difficulty: "MEDIA",
    skillLabel: "ÁNGULO + PLANIFICACIÓN",
    rivalScore: 110,
    rivalName: "ORB",
    rivalAvatar: "/avatars/avatar-5.svg",
    instruction: "",
    scoring: "Bubble shooter clásico: seis colores y ocho filas. Grupos de 3 o más del mismo color explotan y los que quedan colgando caen con ellos. La puntuación es el número de burbujas eliminadas (explotadas más caídas). Tras 4 fallos (luego 3, 2 y 1) baja una fila nueva, y el techo también baja con el reloj. Si un orbe cruza la línea, fin. Limpiar el tablero lo rellena. Replay de servidor.",

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
    cover: "/covers/stack-3d.webp?v=166",
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
    version: "13.0.0",
    resultMetric: "reaction-time-ms",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/ShotGallery")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 3, allowedActions: SHOT_GALLERY_ACTIONS },
    name: "Shot Gallery",
    cover: "/covers/shot-gallery.webp?v=155",
    enabled: true,
    waitingStakes: [1, 50],
    category: "REACCIÓN",
    tagline: "Reconoce el objetivo. Reacciona con precisión.",
    difficulty: "ALTA",
    skillLabel: "REACCIÓN + RECONOCIMIENTO",
    rivalScore: 15000,
    rivalName: "FLASH",
    rivalAvatar: "/avatars/avatar-1.svg",
    instruction: "Cuando asoman los seres de la jungla, abate a los que marca la orden: por su aura o por su forma. Puedes disparar con dos dedos a la vez.",
    scoring: "Doce órdenes en una jungla nocturna de una luna alienígena. Hay tres formas de ser (cazadores, cornudos y sierpes) y cada uno irradia un aura interna verde, azul, roja o morada. Cada orden pide abatir a todos los de un aura o a todos los de una forma; seis órdenes son por aura y seis por forma. Asoman de 4 a 7 seres desde diez escondites a tres profundidades, tras troncos y maleza (nunca en filas); 2 o 3 son blancos y el resto señuelos. Desde la cuarta orden, algunos señuelos comparten el otro rasgo del blanco (la misma forma en una orden por aura, la misma aura en una orden por forma). La puntuación es tu tiempo de reacción acumulado (menos es mejor): cada blanco abatido suma el tiempo desde que asoman o desde el anterior; un señuelo suma 400 ms, disparar antes de tiempo 600 ms y cada blanco que quede en pie 1500 ms; tres señuelos cierran la orden.",
  },

  {
    id: "pinball",
    version: "14.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/PinballVerified")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 1, allowedActions: PINBALL_ACTIONS_V3 },
    name: "Pinball",
    cover: "/covers/pinball.webp?v=164",
    enabled: true,
    waitingStakes: [5, 10],
    category: "CONTROL",
    tagline: "Una bola, cien segundos: carga el muelle, encadena tiros y sube el multiplicador.",
    difficulty: "MEDIA",
    skillLabel: "REFLEJOS + TIMING",
    rivalScore: 100000,
    rivalName: "FLIP",
    rivalAvatar: "/avatars/avatar-2.svg",
    instruction: "",
    scoring: "Mesa fija de 100 segundos (hasta 130 con tiempo extra). Recorridos con curvas suaves: dos rampas con la boca en el centro de la mesa (la izquierda vuelve por su raíl al pasillo izquierdo y la derecha al derecho); cada rampa vale 500 más que la anterior (de 1500 a 6000; vuelve a 1500 al perder la bola). Dos divisores de goma en el centro (40 y 60) separan el carril central de los de las rampas, y por el carril central hay tres estrellas (100 cada una; las tres, 2000). Dos órbitas por las paredes dan la vuelta por arriba y sueltan la bola entre los bumpers del otro lado (1500). El agujero de gusano del centro está bajo un tejadillo y tras un bloque de tres dianas abatibles: tumba una y apunta al hueco (3000). Cinco bumpers (100 a 500), siete postes (10 a 70) y dos tirachinas (35 y 55) puntúan cada uno lo suyo. Carriles A-B-C, dianas, bloque, plato con bloqueo y multibola de tres bolas, jackpots, súper jackpot, modos de 20 s, hurry-up, combos entre tiros distintos, multiplicador hasta ×5 y bonus final. Mismo muelle, misma bola: mismo resultado; el servidor repite la partida.",
  },
  {
    id: "bowling",
    version: "3.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/Bowling")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 2, allowedActions: BOWLING_ACTIONS_V2 },
    name: "Bowling",
    cover: "/covers/bowling.webp?v=178",
    enabled: true,
    waitingStakes: [1, 5],
    category: "PRECISIÓN",
    tagline: "Diez marcos en una pista orbital. Busca el pleno.",
    difficulty: "MEDIA",
    skillLabel: "PUNTERÍA + EFECTO",
    rivalScore: 180,
    rivalName: "PINS",
    rivalAvatar: "/avatars/avatar-4.svg",
    instruction: "",
    scoring: "Bolos de diez: diez marcos con plenos y semiplenos según el reglamento (bolas extra en el décimo). Arrastra la bola de lado para colocarla y traza el lanzamiento hacia arriba: la recta entre el principio y el final del trazo marca la dirección, la curvatura de la línea el efecto y la velocidad final la potencia. Pista de 32 m y tirada sensible: 49 pasos de dirección y 17 de efecto, así que un trazo poco preciso se nota. Física determinista de bola y bolos. Replay de servidor.",
  },
  {
    id: "corner-sudoku",
    version: "4.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/CornerSudoku")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 3, allowedActions: CORNER_SUDOKU_ACTIONS_V3 },
    name: "Galoku",
    cover: "/covers/corner-sudoku.webp?v=166",
    enabled: true,
    waitingStakes: [1, 5],
    category: "LÓGICA",
    tagline: "Dos lados de un sudoku: cinco cuadrados, dos retos.",
    difficulty: "MEDIA",
    skillLabel: "LÓGICA + RAPIDEZ",
    rivalScore: 4500,
    rivalName: "SAGE",
    rivalAvatar: "/avatars/avatar-5.svg",
    instruction: "",
    scoring: "Dos retos por partida con dos lados de un sudoku: la fila de cuadrados de arriba y la columna de la izquierda, que comparten la esquina (cinco cuadrados). Cada cuadrado, cada una de las tres filas de arriba y cada una de las tres columnas de la izquierda llevan del 1 al 9. Escribe, cambia o borra números libremente; el reto se resuelve cuando todo el tablero es correcto: 600 más bonus por rapidez. Si se acaba el tiempo, cada casilla bien rellenada del reto en curso suma 15. Cinco minutos. Replay de servidor.",
  },

] as const satisfies readonly GameDefinition[];

export type GameId = (typeof GAME_DEFINITIONS)[number]["id"];
export type GameMeta = GameDefinition<GameId>;
export const GAME_CREATOR_DEFAULT = "GALACTIC GAMES";

export const GAME_REGISTRY = Object.fromEntries(
  GAME_DEFINITIONS.map((game) => [game.id, game])
) as unknown as Record<GameId, GameMeta>;

// SATURN: the 12 archived games were removed from the code (full history in branch archive/pre-saturn).
/**
 * v130 · Popularity: matches played, most first. It orders the catalogue (the "Populares" row and every row,
 * left to right). Fixed and editable here until the server reports real play counts; GAMES keeps this order.
 */
/**
 * v152 · Roulette is hidden from players (owner request, 7 Nov 2026): it is out of this list and `enabled: false`, so
 * it is in no row, ranking or group, and the server starts no new match of it. Its registry entry, cores (V1–V21),
 * renderer, verifier adapters, fixtures and covers all stay, so its archived matches still verify. To bring it back:
 * set `enabled: true` on its entry and put "galactic-roulette" back at the head of this list (and a shelf below).
 */
const CATALOG_ORDER: GameId[] = [
  "galactic-slot",
  "billiards",
  "darts",
  "bowling",
  "precision-stack",
  "tower-drop",
  "pinball",
  "solitaire-sprint",
  "mine-grid",
  "orb-burst",
  "corner-sudoku",
  "reaction-test",
  "stack-shift",
];

/** v130 · Catalogue rows. A developer picks one of these for a new game; "Populares" is never picked, it is earned. */
// v152: no "casino" row any more (Roulette hidden, Slot moved to "alternative").
export type CatalogShelf = "bar" | "mythic" | "dynamic" | "alternative";
export const CATALOG_SHELVES: readonly CatalogShelf[] = ["bar", "mythic", "dynamic", "alternative"];
export const POPULAR_COUNT = 8;
const GAME_SHELF: Partial<Record<GameId, CatalogShelf>> = {
  darts: "bar", billiards: "bar", bowling: "bar",
  "orb-burst": "mythic", "solitaire-sprint": "mythic", "mine-grid": "mythic", "stack-shift": "mythic", pinball: "mythic",
  "precision-stack": "dynamic", "tower-drop": "dynamic",
  "corner-sudoku": "alternative", "reaction-test": "alternative", "galactic-slot": "alternative",
};
export const gameShelf = (game: Pick<GameMeta, "id">): CatalogShelf => GAME_SHELF[game.id as GameId] ?? "alternative";
/** Day each game joined the catalogue; games without a date predate the 29 September 2026 launch. "Nuevos" lists the
 * games added in the last NEW_GAME_DAYS days (external games will bring their own date). */
const GAME_ADDED: Partial<Record<GameId, string>> = { pinball: "2026-10-23", bowling: "2026-10-25", "corner-sudoku": "2026-10-25" };
export const NEW_GAME_DAYS = 30;
export const isNewGame = (game: Pick<GameMeta, "id">, now: number) => {
  const added = GAME_ADDED[game.id as GameId];
  return !!added && now - Date.parse(added) < NEW_GAME_DAYS * 86_400_000;
};

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
