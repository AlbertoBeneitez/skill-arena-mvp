import { ROULETTE_ACTIONS_V2 } from "./verified/galacticRouletteProtocol.v2";
import { BIRDS_ACTIONS } from "./verified/galacticBirdsProtocol.v1";
import { ROULETTE_ACTIONS } from "./verified/galacticRouletteProtocol.v1";
import { SLOT_ACTIONS } from "./verified/galacticSlotProtocol.v1";
import { PIANO_V2_ACTIONS } from "./verified/pianoRushProtocol.v2";
import { ORBIT_ACTIONS } from "./verified/orbitShiftProtocol.v1";
import { MEMORY_ACTIONS } from "./verified/memoryMatchProtocol.v1";
import { MAZE_ACTIONS } from "./verified/mazeRushProtocol.v1";
import { BRICK_V2_ACTIONS } from "./verified/brickRelayProtocol.v2";
import { METRO_ACTIONS } from "./verified/metroShiftProtocol.v1";
import { SKY_HOP_ACTIONS } from "./verified/skyHopProtocol.v1";
import { PHALANX_ACTIONS } from "./verified/starPhalanxProtocol.v1";
import { STACK_SHIFT_ACTIONS } from "./verified/stackShiftProtocol.v1";
import { ALIEN_ACTIONS } from "./verified/alienDashProtocol.v2";
import { SHOT_GALLERY_ACTIONS_V2 as SHOT_GALLERY_ACTIONS } from "./verified/shotGalleryProtocol.v2";
import { DARTS_ACTIONS } from "./verified/dartsProtocol.v1";
import { BILLIARDS_ACTIONS_V3 } from "./verified/billiardsCore.v3";
import { ORB_ACTIONS } from "./verified/orbBurstProtocol.v1";
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
  {id:"galactic-birds",version:"4.0.0",status:"VERIFIED",loadComponent:adaptGameComponent(()=>import("@/components/games/GalacticBirds")),competition:{verification:"server-replay",engineVersion:"skill-core-3",inputProtocolVersion:1,allowedActions:BIRDS_ACTIONS},name:"Galactic Birds",cover:"/covers/galactic-birds.svg",enabled:true,waitingStakes:[1,5],category:"PRECISIÓN",tagline:"Una catapulta orbital contra estructuras y drones.",difficulty:"MEDIA",skillLabel:"PUNTERÍA + FÍSICA",rivalScore:1000000000,rivalName:"ORION",rivalAvatar:"/avatars/avatar-5.svg",instruction:"",scoring:"Campo continuo con12drones, estructuras de vidrio/cerámica/aleación y30tiros. Cola de exploradores, rápidos y pesados; masa/radio/velocidad deterministas. Avance por objetivos únicos, replay autoritativo; máximo cuatro minutos."},
  { id: "galactic-roulette", version: "2.0.0", status: "VERIFIED", loadComponent: adaptGameComponent(() => import("@/components/games/GalacticRoulette")), competition: {verification:"server-replay",engineVersion:"skill-core-3",inputProtocolVersion:2,allowedActions:ROULETTE_ACTIONS_V2}, resultMetric:"fictitious-balance", name:"Galactic Roulette",cover:"/covers/galactic-roulette.svg",enabled:true,waitingStakes:[1,5],category:"PRECISIÓN",tagline:"Una rueda orbital y un lanzamiento preciso.",difficulty:"MEDIA",skillLabel:"TIMING + LANZAMIENTO",rivalScore:1000000000,rivalName:"NOVA",rivalAvatar:"/avatars/avatar-3.svg",instruction:"",scoring:"Ruleta europea de cero único: apuestas de5€ ficticios,100€ iniciales, tres minutos o insolvencia. Lanzamiento cuantizado, fricción y posición autoritativa; saldo terminal por replay." },
  {
    id: "galactic-slot", version: "1.0.0", status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/GalacticSlot")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 1, allowedActions: SLOT_ACTIONS },
    resultMetric: "fictitious-balance", name: "Galactic Slot", cover: "/covers/galactic-slot.svg", enabled: true,
    waitingStakes: [1,5], category: "PRECISIÓN", tagline: "Tres franjas, una combinación orbital.", difficulty: "MEDIA", skillLabel: "OBSERVACIÓN + PLANIFICACIÓN", rivalScore: 1000000000,
    rivalName: "VEGA", rivalAvatar: "/avatars/avatar-4.svg", instruction: "", scoring: "Saldo ficticio final: 100€ iniciales, 5€ por tirada, máximo tres minutos. Orden fijo y avances de un octavo de vuelta. Servidor reproduce inputs y saldo; sin dinero real.",
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
    id: "billiards", version: "3.0.0", status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/Billiards")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 2, allowedActions: BILLIARDS_ACTIONS_V3 },
    name: "Billar", cover: "/covers/billiards.svg", enabled: true, waitingStakes: [1, 5], category: "PRECISIÓN", tagline: "Apunta, elige potencia y despeja la mesa orbital.", difficulty: "MEDIA", skillLabel: "ÁNGULO + POTENCIA", rivalScore: 8000, rivalName: "VEGA", rivalAvatar: "/avatars/avatar-4.svg", instruction: "Tira del taco hacia atrás para ajustar dirección y potencia; suelta para golpear.", scoring: "Diez objetivos, dieciocho tiros y una mesa continua. Avance por embocadas únicas, posiciones conservadas entre tiros.",
  },
  {
    id: "tower-drop",
    version: "3.0.0",
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
    scoring: "Sigue apilando hasta fallar.",
  },
  {
    id: "jet-stream",
    version: "4.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/JetStreamV3")),
    competition: {
      verification: "server-replay",
      engineVersion: "skill-core-3",
      inputProtocolVersion: 3,
      allowedActions: ["FLAP"],
    },
    name: "Jet Stream",
    cover: "/covers/jet-stream.svg",
    enabled: true,
    waitingStakes: [5, 10],
    category: "CONTROL",
    tagline: "Pilota el corredor orbital. Cada impulso cuenta.",
    difficulty: "MEDIA",
    skillLabel: "RITMO + CONTROL",
    rivalScore: 45000,
    rivalName: "AERO",
    rivalAvatar: "/avatars/avatar-2.svg",
    instruction: "Toca para subir, elige un paso y recoge recargas de vida.",
    scoring: "La ruta, los huecos y la dificultad proceden del mismo seed competitivo.",
  },
  {
    id: "metro-shift",
    version: "1.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/MetroShiftVerified")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 1, allowedActions: METRO_ACTIONS },
    name: "Metro Shift",
    cover: "/covers/metro-shift.svg",
    enabled: true,
    waitingStakes: [10, 50],
    category: "REACCIÓN",
    tagline: "Siete carriles. Decide antes de que llegue la ola.",
    difficulty: "ALTA",
    skillLabel: "LECTURA + REACCIÓN",
    rivalScore: 42000,
    rivalName: "MIRA",
    rivalAvatar: "/avatars/avatar-1.svg",
    instruction: "Desliza a izquierda o derecha entre siete carriles y hacia arriba para saltar.",
    scoring: "60 formaciones en un recorrido reproducible, saltos, recargas y tres escudos; score por replay de servidor.",
  },
  {
    id: "orbit-shift",
    version: "1.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/OrbitShiftVerified")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 1, allowedActions: ORBIT_ACTIONS },
    name: "Orbit Shift",
    cover: "/covers/orbit-rush.svg",
    enabled: true,
    waitingStakes: [1, 10],
    category: "CONTROL",
    tagline: "Sube o baja de órbita antes del impacto.",
    difficulty: "ALTA",
    skillLabel: "LECTURA + TIMING",
    rivalScore: 33000,
    rivalName: "ORBIT",
    rivalAvatar: "/avatars/avatar-3.svg",
    instruction: "Interior acerca al centro; exterior aleja. Evita arcos rosas y recoge recargas verdes.",
    scoring: "60 pasos en un recorrido continuo, arcos combinados, recargas y tres escudos; replay de servidor.",
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
    version: "0.1.0",
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
    rivalScore: 8600,
    rivalName: "NODE",
    rivalAvatar: "/avatars/avatar-4.svg",
    instruction: "Destapa casillas. Ambos jugadores reciben exactamente el mismo campo de minas.",
    scoring: "Suma casillas seguras sin tocar una mina.",
    deterministicSeed: "mine-grid-arena-001",
  },
  {
    id: "grid-serpent",
    version: "2.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/Serpent")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 1, allowedActions: ["UP","DOWN","LEFT","RIGHT"] },
    name: "Serpent",
    cover: "/covers/serpent.svg",
    enabled: true,
    waitingStakes: [5, 10],
    category: "CONTROL",
    tagline: "Núcleos y portales. Controla la órbita.",
    difficulty: "ALTA",
    skillLabel: "CONTROL + ANTICIPACIÓN",
    rivalScore: 7000,
    rivalName: "VIPER",
    rivalAvatar: "/avatars/avatar-6.svg",
    instruction: "Desliza para girar. Atraviesa los portales y evita tu propio cuerpo.",
    scoring: "Cada núcleo suma 1000. Los bordes conectan; evita tu propio cuerpo.",
  },


  {
    id: "brick-relay",
    version: "2.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/BrickRelayVerified")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 2, allowedActions: BRICK_V2_ACTIONS },
    name: "Brick Relay",
    cover: "/covers/brick-relay.svg",
    enabled: true,
    waitingStakes: [5, 50],
    category: "PRECISIÓN",
    tagline: "Mismo muro y misma física. Devuelve cada bola.",
    difficulty: "ALTA",
    skillLabel: "PRECISIÓN + CONTROL",
    rivalScore: 30000,
    rivalName: "RICO",
    rivalAvatar: "/avatars/avatar-1.svg",
    instruction: "Arrastra para mover la pala. El mapa y el lanzamiento inicial son idénticos.",
    scoring: "Un muro continuo con blindaje, explosivos y aceleración registrada; tres vidas y replay de servidor.",
  },
  {
    id: "stack-shift",
    version: "1.0.0",
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
    id: "maze-rush",
    version: "3.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/MazeRushVerified")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 1, allowedActions: MAZE_ACTIONS },
    name: "Maze Rush",
    cover: "/covers/maze-rush.svg",
    enabled: true,
    waitingStakes: [1, 5],
    category: "LABERINTO",
    tagline: "Mismo laberinto. Mejor ruta y mejores reflejos.",
    difficulty: "MEDIA",
    skillLabel: "RUTA + REACCIÓN",
    rivalScore: 6500,
    rivalName: "ECHO",
    rivalAvatar: "/avatars/avatar-6.svg",
    instruction: "Desliza o usa la cruceta. Recoge nodos y evita a los perseguidores.",
    scoring: "Un laberinto continuo, nodos únicos, pulsos y tres escudos; replay de servidor.",
  },
  {
    id: "star-phalanx",
    version: "3.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/StarPhalanxVerified")),
    competition: {verification:"server-replay",engineVersion:"skill-core-3",inputProtocolVersion:1,allowedActions:PHALANX_ACTIONS},
    name: "Star Phalanx",
    cover: "/covers/star-phalanx.svg",
    enabled: true,
    waitingStakes: [5, 10],
    category: "SHOOTER",
    tagline: "Misma formación. Sobrevive y elimina más.",
    difficulty: "ALTA",
    skillLabel: "PUNTERÍA + CONTROL",
    rivalScore: 42000,
    rivalName: "ION",
    rivalAvatar: "/avatars/avatar-8.svg",
    instruction: "Mantén y arrastra para moverte y disparar; las capas llegan progresivamente.",
    scoring: "Cinco oleadas por capas, disparos anunciados, blindaje y tres escudos; replay de servidor.",
  },
  {
    id: "river-dash",
    version: "4.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/RiverDashVerified")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 4, allowedActions: ["UP","DOWN","LEFT","RIGHT"] },
    name: "River Dash",
    cover: "/covers/river-dash-orbital.svg",
    enabled: true,
    waitingStakes: [1, 10],
    category: "CRUCE",
    tagline: "Mismos carriles. El timing decide.",
    difficulty: "MEDIA",
    skillLabel: "TIMING + LECTURA",
    rivalScore: 90,
    rivalName: "FORD",
    rivalAvatar: "/avatars/avatar-2.svg",
    instruction: "Desliza o usa la cruceta para cruzar carretera y río.",
    scoring: "Ambos jugadores reciben idénticas velocidades, fases y carriles.",
  },
  {
    id: "orb-burst",
    version: "2.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/OrbBurstVerified")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 1, allowedActions: ORB_ACTIONS },
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
    instruction: "Apunta arrastrando y suelta para lanzar. Junta tres o más.",
    scoring: "Avance por los 108 orbes originales retirados de un campo continuo; disparos y presión no dan avance. Replay de servidor.",

  },
  {
    id: "precision-stack",
    version: "3.0.0",
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
    rivalScore: 7600,
    rivalName: "EDGE",
    rivalAvatar: "/avatars/avatar-2.svg",
    instruction: "Toca al alinear las caras. La siguiente pieza cruza por el otro eje.",
    scoring: "Se conserva la intersección real en X/Z; precisión de superficie y combos perfectos.",
    deterministicSeed: "precision-stack-arena-001",
  },
  {
    id: "piano-rush",
    version: "3.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/PianoRushVerified")),
    competition: {
      verification: "server-replay",
      engineVersion: "skill-core-3",
      inputProtocolVersion: 1,
      allowedActions: PIANO_V2_ACTIONS,
    },
    name: "Piano Rush",
    cover: "/covers/piano-rush.svg",
    enabled: true,
    waitingStakes: [5, 10],
    category: "RITMO",
    tagline: "Aprende el pulso. Encadena precisión y domina el ritmo.",
    difficulty: "ALTA",
    skillLabel: "RITMO + REACCIÓN",
    rivalScore: 39000,
    rivalName: "KEY",
    rivalAvatar: "/avatars/avatar-7.svg",
    instruction: "Toca el carril correcto cuando el pulso alcance la zona inferior.",
    scoring: "48 notas continuas, calentamiento/escudos, precisión y combos; replay de servidor.",
  },
  {
    id: "dino-dash",
    version: "3.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/AlienDash")),
    competition: {
      verification: "server-replay",
      engineVersion: "skill-core-3",
      inputProtocolVersion: 2,
      allowedActions: ALIEN_ACTIONS,
    },
    name: "Alien Dash",
    cover: "/covers/alien-dash.svg",
    enabled: true,
    waitingStakes: [1, 5],
    category: "RUNNER",
    tagline: "Cruza la colonia orbital. Salta. Esquiva. Sobrevive.",
    difficulty: "MEDIA",
    skillLabel: "TIMING + LECTURA",
    rivalScore: 22000,
    rivalName: "REX",
    rivalAvatar: "/avatars/avatar-8.svg",
    instruction: "Salta rocas y plataformas. Mantén AGACHAR bajo drones; salta los rayos rojos.",
    scoring: "Tres escudos, plataformas, recogibles y centinelas. Sobrevive dos minutos o supera el objetivo.",
  },
  {
    id: "reaction-test",
    version: "2.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/ShotGallery")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 2, allowedActions: SHOT_GALLERY_ACTIONS },
    name: "Shot Gallery",
    cover: "/covers/shot-gallery.svg",
    enabled: true,
    waitingStakes: [1, 50],
    category: "REACCIÓN",
    tagline: "Reconoce el objetivo. Reacciona con precisión.",
    difficulty: "ALTA",
    skillLabel: "REACCIÓN + RECONOCIMIENTO",
    rivalScore: 7500,
    rivalName: "FLASH",
    rivalAvatar: "/avatars/avatar-1.svg",
    instruction: "Lee la regla. Espera a la activación y toca el objetivo correcto.",
    scoring: "Suma de doce pruebas: colores, formas, números y combinaciones. Anticiparse y fallar penaliza.",
  },
  {
    id: "sky-hop",
    version: "3.0.0",
    status: "VERIFIED",
    loadComponent: adaptGameComponent(() => import("@/components/games/SkyHopVerified")),
    competition: { verification: "server-replay", engineVersion: "skill-core-3", inputProtocolVersion: 1, allowedActions: SKY_HOP_ACTIONS },
    name: "Sky Hop",
    cover: "/covers/sky-hop.svg",
    enabled: true,
    waitingStakes: [5, 10],
    category: "PLATAFORMAS",
    tagline: "Rebota y sigue subiendo.",
    difficulty: "ALTA",
    skillLabel: "CONTROL + ANTICIPACIÓN",
    rivalScore: 43000,
    rivalName: "HOP",
    rivalAvatar: "/avatars/avatar-3.svg",
    instruction: "Mantén izquierda o derecha para dirigir el salto automático.",
    scoring: "75 apoyos continuos, balizas, recogibles y marcianos anticipados bajo los bordes. Avance por altura nueva; replay de servidor.",
  },

] as const satisfies readonly GameDefinition[];

export type GameId = (typeof GAME_DEFINITIONS)[number]["id"];
export type GameMeta = GameDefinition<GameId>;

export const GAME_REGISTRY = Object.fromEntries(
  GAME_DEFINITIONS.map((game) => [game.id, game])
) as unknown as Record<GameId, GameMeta>;

const CATALOG_ORDER: GameId[] = [
  "galactic-birds",
  "galactic-roulette",
  "galactic-slot",
  "darts",
  "billiards",
  "precision-stack",
  "tower-drop",
  "jet-stream",
  "piano-rush",
  "dino-dash",
  "orb-burst",
  "reaction-test",
  "river-dash",
  "sky-hop",
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
