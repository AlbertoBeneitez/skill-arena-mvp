export type RulesInputDefinition = {
  action: string;
  label: string;
  description: string;
};

export type GameRulesDefinition = {
  gameId: string;
  gameVersion: string;
  rulesVersion: string;
  title: string;
  playerFacing: {
    quickStart: string;
    objective: string;
    scoringSummary: string;
    inputs: readonly RulesInputDefinition[];
  };
  competitive: {
    players: 2;
    attemptsPerPlayer: 1;
    tieRule: "EXACT_TIE_REFUND";
    resultAuthority: "SERVER_REPLAY_ONLY" | "CLIENT_RESULT_DRAFT";
    inputClock: "SIMULATION_TICKS" | "CLIENT_SESSION_CLOCK";
    endCondition: string;
  };
  lifecycle: {
    start: "SERVER_ISSUED_MANIFEST_AND_TICKET" | "CLIENT_SESSION_SEED";
    inputCapture: "ORDERED_TICK_INPUT_STREAM" | "LOCAL_INPUT_LOG";
    verification: "SERVER_REPLAY" | "CLIENT_RESULT_UNVERIFIED";
    duplicateSubmissionPolicy: "FIRST_TERMINAL_SUBMISSION_WINS" | "CLIENT_SESSION_RESTARTS_NEW_ATTEMPT";
    disconnectPolicy: "ATTEMPT_ABANDONED_IF_NOT_VERIFIED" | "CLIENT_SESSION_LOST";
  };
  legal: {
    skillBasis: string;
    fairness: readonly string[];
    termsSummary: readonly string[];
  };
};

function key(gameId: string, gameVersion: string) {
  return `${gameId}@${gameVersion}`;
}

const COMMON_LIFECYCLE = {
  start: "SERVER_ISSUED_MANIFEST_AND_TICKET",
  inputCapture: "ORDERED_TICK_INPUT_STREAM",
  verification: "SERVER_REPLAY",
  duplicateSubmissionPolicy: "FIRST_TERMINAL_SUBMISSION_WINS",
  disconnectPolicy: "ATTEMPT_ABANDONED_IF_NOT_VERIFIED",
} as const;

const COMMON_FAIRNESS = [
  "Both players receive the same game version, rules version, scenario id, server seed and target score.",
  "The browser is not authoritative for score, time or outcome.",
  "The server verifies the ordered input stream by replaying the frozen competitive core.",
] as const;

const INTEGRATED_DRAFT_LIFECYCLE = {
  start: "CLIENT_SESSION_SEED",
  inputCapture: "LOCAL_INPUT_LOG",
  verification: "CLIENT_RESULT_UNVERIFIED",
  duplicateSubmissionPolicy: "CLIENT_SESSION_RESTARTS_NEW_ATTEMPT",
  disconnectPolicy: "CLIENT_SESSION_LOST",
} as const;

const INTEGRATED_DRAFT_FAIRNESS = [
  "Both players receive the same game version, deterministic seed, round timer and target score.",
  "The client build is deterministic from its seed and player inputs, but it is not yet server authoritative.",
  "This ruleset is a draft integration contract and must be migrated to server replay before production cash stakes.",
] as const;

const GAME_RULES = {
  [key("tower-drop", "2.1.0")]: {
    gameId: "tower-drop",
    gameVersion: "2.1.0",
    rulesVersion: "tower-drop-rules-v2.1",
    title: "Tower Drop official competitive rules",
    playerFacing: {
      quickStart: "Toca cuando el bloque móvil esté encima de la torre.",
      objective: "Build the tallest stable tower before the first failed placement or target score.",
      scoringSummary: "Sigue apilando hasta fallar.",
      inputs: [
        {
          action: "DROP",
          label: "Drop",
          description: "Release the current block at the recorded simulation tick.",
        },
      ],
    },
    competitive: {
      players: 2,
      attemptsPerPlayer: 1,
      tieRule: "EXACT_TIE_REFUND",
      resultAuthority: "SERVER_REPLAY_ONLY",
      inputClock: "SIMULATION_TICKS",
      endCondition: "FIRST_FAILURE_OR_TARGET",
    },
    lifecycle: COMMON_LIFECYCLE,
    legal: {
      skillBasis:
        "The result depends on timing, precision and repeated placement decisions under identical physics.",
      fairness: COMMON_FAIRNESS,
      termsSummary: [
        "A run ends on the first unsupported, unstable or timed-out block.",
        "Only server-replayed DROP inputs can produce a competitive score.",
      ],
    },
  },
  [key("precision-stack", "1.0.0")]: {
    gameId: "precision-stack",
    gameVersion: "1.0.0",
    rulesVersion: "precision-stack-rules-v1",
    title: "Precision Stack legacy competitive rules",
    playerFacing: {
      quickStart: "Toca para acoplar el módulo móvil sobre la estructura.",
      objective: "Place moving modules with maximum overlap before the first failed placement or target score.",
      scoringSummary: "Cada acoplamiento conserva el solape; los perfectos mantienen todo el módulo.",
      inputs: [
        {
          action: "DROP",
          label: "Drop",
          description: "Place the moving module at the recorded simulation tick.",
        },
      ],
    },
    competitive: {
      players: 2,
      attemptsPerPlayer: 1,
      tieRule: "EXACT_TIE_REFUND",
      resultAuthority: "SERVER_REPLAY_ONLY",
      inputClock: "SIMULATION_TICKS",
      endCondition: "FIRST_FAILURE_OR_TARGET",
    },
    lifecycle: COMMON_LIFECYCLE,
    legal: {
      skillBasis:
        "The result depends on hand timing and precision against the same deterministic moving-module schedule.",
      fairness: COMMON_FAIRNESS,
      termsSummary: [
        "A run ends on the first missed module, unstable overlap or idle timeout.",
        "Legacy manifests keep this rules version for historical replay compatibility.",
      ],
    },
  },
  [key("precision-stack", "2.0.0")]: {
    gameId: "precision-stack",
    gameVersion: "2.0.0",
    rulesVersion: "precision-stack-rules-v2",
    title: "Precision Stack official competitive rules",
    playerFacing: {
      quickStart: "Toca para acoplar el módulo móvil sobre la estructura.",
      objective: "Place moving modules with maximum overlap before the first failed placement or target score.",
      scoringSummary: "Cada acoplamiento conserva el solape; los perfectos mantienen todo el módulo.",
      inputs: [
        {
          action: "DROP",
          label: "Drop",
          description: "Place the moving module at the recorded simulation tick.",
        },
      ],
    },
    competitive: {
      players: 2,
      attemptsPerPlayer: 1,
      tieRule: "EXACT_TIE_REFUND",
      resultAuthority: "SERVER_REPLAY_ONLY",
      inputClock: "SIMULATION_TICKS",
      endCondition: "FIRST_FAILURE_OR_TARGET",
    },
    lifecycle: COMMON_LIFECYCLE,
    legal: {
      skillBasis:
        "The result depends on timing precision, overlap management and consistency under increasing speed.",
      fairness: COMMON_FAIRNESS,
      termsSummary: [
        "A run ends on the first missed module, unstable overlap or idle timeout.",
        "The current competitive version adds adaptive perfect windows and stable-overlap checks.",
      ],
    },
  },
  [key("piano-rush", "1.0.0")]: {
    gameId: "piano-rush",
    gameVersion: "1.0.0",
    rulesVersion: "piano-rush-rules-v1",
    title: "Piano Rush official competitive rules",
    playerFacing: {
      quickStart: "Toca el carril correcto cuando el pulso alcance la zona inferior.",
      objective: "Hit the correct lane in time for each scheduled pulse before the first mistake or target score.",
      scoringSummary: "La secuencia y el calendario de pulsos proceden del mismo seed competitivo.",
      inputs: [
        { action: "LANE_0", label: "Lane 1", description: "Tap the leftmost lane." },
        { action: "LANE_1", label: "Lane 2", description: "Tap the second lane." },
        { action: "LANE_2", label: "Lane 3", description: "Tap the third lane." },
        { action: "LANE_3", label: "Lane 4", description: "Tap the rightmost lane." },
      ],
    },
    competitive: {
      players: 2,
      attemptsPerPlayer: 1,
      tieRule: "EXACT_TIE_REFUND",
      resultAuthority: "SERVER_REPLAY_ONLY",
      inputClock: "SIMULATION_TICKS",
      endCondition: "FIRST_MISTAKE_OR_TARGET",
    },
    lifecycle: COMMON_LIFECYCLE,
    legal: {
      skillBasis:
        "The result depends on reaction, rhythm and lane accuracy against the same deterministic note chart.",
      fairness: COMMON_FAIRNESS,
      termsSummary: [
        "A run ends on the first wrong lane, early tap, late tap, missed note or schedule exhaustion.",
        "Inputs outside the four official lane actions are invalid.",
      ],
    },
  },
  [key("jet-stream", "1.0.0")]: {
    gameId: "jet-stream",
    gameVersion: "1.0.0",
    rulesVersion: "jet-stream-rules-v1",
    title: "Jet Stream official competitive rules",
    playerFacing: {
      quickStart: "Toca para impulsar la nave y atraviesa el centro de cada compuerta.",
      objective: "Fly through as many gates as possible before collision, bounds failure or target score.",
      scoringSummary: "La ruta, los huecos y la dificultad proceden del mismo seed competitivo.",
      inputs: [
        {
          action: "FLAP",
          label: "Impulse",
          description: "Apply one upward impulse at the recorded simulation tick.",
        },
      ],
    },
    competitive: {
      players: 2,
      attemptsPerPlayer: 1,
      tieRule: "EXACT_TIE_REFUND",
      resultAuthority: "SERVER_REPLAY_ONLY",
      inputClock: "SIMULATION_TICKS",
      endCondition: "FIRST_FAILURE_OR_TARGET",
    },
    lifecycle: COMMON_LIFECYCLE,
    legal: {
      skillBasis:
        "The result depends on touch rhythm and vertical control through the same deterministic gate course.",
      fairness: COMMON_FAIRNESS,
      termsSummary: [
        "A run ends on gate collision or leaving the allowed vertical bounds.",
        "The server replays every FLAP input against the official fixed-timestep core.",
      ],
    },
  },
  [key("dino-dash", "1.0.0")]: {
    gameId: "dino-dash",
    gameVersion: "1.0.0",
    rulesVersion: "dino-dash-rules-v1",
    title: "Dino Dash official competitive rules",
    playerFacing: {
      quickStart: "Toca para saltar y usa ↓ para agacharte bajo obstáculos altos.",
      objective: "Survive the deterministic obstacle course for as long as possible before collision or target score.",
      scoringSummary: "Ambos reciben la misma secuencia exacta de obstáculos.",
      inputs: [
        { action: "JUMP", label: "Jump", description: "Start a jump if the runner is grounded." },
        { action: "DUCK_DOWN", label: "Duck", description: "Enter ducking stance at the recorded tick." },
        { action: "DUCK_UP", label: "Stand", description: "Leave ducking stance at the recorded tick." },
      ],
    },
    competitive: {
      players: 2,
      attemptsPerPlayer: 1,
      tieRule: "EXACT_TIE_REFUND",
      resultAuthority: "SERVER_REPLAY_ONLY",
      inputClock: "SIMULATION_TICKS",
      endCondition: "FIRST_FAILURE_OR_TARGET",
    },
    lifecycle: COMMON_LIFECYCLE,
    legal: {
      skillBasis:
        "The result depends on timing, obstacle reading and jump/duck execution on the same deterministic course.",
      fairness: COMMON_FAIRNESS,
      termsSummary: [
        "A run ends on obstacle collision or timeout.",
        "Jump and duck actions are recorded by simulation tick and replayed by the server.",
      ],
    },
  },
  [key("pulse-runner", "1.0.0")]: {
    gameId: "pulse-runner",
    gameVersion: "1.0.0",
    rulesVersion: "pulse-runner-rules-v1",
    title: "Pulse Runner official competitive rules",
    playerFacing: {
      quickStart: "Toca para saltar. Un toque produce siempre el mismo salto.",
      objective: "Survive the deterministic obstacle course before collision or target score.",
      scoringSummary: "Sigue hasta colisionar.",
      inputs: [
        {
          action: "JUMP",
          label: "Jump",
          description: "Queue one fixed jump at the recorded simulation tick.",
        },
      ],
    },
    competitive: {
      players: 2,
      attemptsPerPlayer: 1,
      tieRule: "EXACT_TIE_REFUND",
      resultAuthority: "SERVER_REPLAY_ONLY",
      inputClock: "SIMULATION_TICKS",
      endCondition: "FIRST_FAILURE_OR_TARGET",
    },
    lifecycle: COMMON_LIFECYCLE,
    legal: {
      skillBasis:
        "The result depends on jump timing, obstacle reading and consistency on the same deterministic course.",
      fairness: COMMON_FAIRNESS,
      termsSummary: [
        "A run ends on obstacle collision or timeout.",
        "Only JUMP inputs recorded by simulation tick are accepted.",
      ],
    },
  },
  [key("galactic-slot", "0.1.0")]: {
    gameId: "galactic-slot",
    gameVersion: "0.1.0",
    rulesVersion: "galactic-slot-rules-v0.1",
    title: "Galactic Slot integrated draft rules",
    playerFacing: {
      quickStart: "Ajusta los pasos de cada ruleta y lanza.",
      objective: "Increase the fictitious balance before the three-minute timer or zero-balance end condition.",
      scoringSummary: "Each spin costs 5 EUR fictitious; fixed symbol combinations pay according to the table.",
      inputs: [
        { action: "STEP_REEL_1", label: "Reel 1 steps", description: "Cycle the number of positions advanced by reel 1." },
        { action: "STEP_REEL_2", label: "Reel 2 steps", description: "Cycle the number of positions advanced by reel 2." },
        { action: "STEP_REEL_3", label: "Reel 3 steps", description: "Cycle the number of positions advanced by reel 3." },
        { action: "SPIN", label: "Spin", description: "Spend 5 EUR fictitious and advance all reels by the selected fixed steps." },
      ],
    },
    competitive: {
      players: 2,
      attemptsPerPlayer: 1,
      tieRule: "EXACT_TIE_REFUND",
      resultAuthority: "CLIENT_RESULT_DRAFT",
      inputClock: "CLIENT_SESSION_CLOCK",
      endCondition: "THREE_MINUTES_OR_BALANCE_BELOW_SPIN_COST_OR_TARGET",
    },
    lifecycle: INTEGRATED_DRAFT_LIFECYCLE,
    legal: {
      skillBasis:
        "The visible reels use a fixed ordered strip; results depend on pattern reading, step selection and bankroll management, not hidden random draws.",
      fairness: INTEGRATED_DRAFT_FAIRNESS,
      termsSummary: [
        "The balance is fictional and starts at 100 EUR for every player.",
        "This integrated draft must not be used for production cash wagering until server replay verifies all inputs.",
      ],
    },
  },
  [key("galactic-birds", "0.1.0")]: {
    gameId: "galactic-birds",
    gameVersion: "0.1.0",
    rulesVersion: "galactic-birds-rules-v0.1",
    title: "Galactic Birds integrated draft rules",
    playerFacing: {
      quickStart: "Arrastra desde la honda y suelta para lanzar.",
      objective: "Destroy all structure cores with the limited projectile set before the timer ends.",
      scoringSummary: "Core destruction, structure damage, remaining shots and time drive the score.",
      inputs: [
        { action: "AIM_START", label: "Aim start", description: "Begin dragging from the launcher." },
        { action: "AIM_MOVE", label: "Aim move", description: "Set the launch vector while dragging." },
        { action: "RELEASE", label: "Release", description: "Launch one projectile using the selected vector." },
      ],
    },
    competitive: {
      players: 2,
      attemptsPerPlayer: 1,
      tieRule: "EXACT_TIE_REFUND",
      resultAuthority: "CLIENT_RESULT_DRAFT",
      inputClock: "CLIENT_SESSION_CLOCK",
      endCondition: "ALL_CORES_DESTROYED_OR_PROJECTILES_EXHAUSTED_OR_TIMER",
    },
    lifecycle: INTEGRATED_DRAFT_LIFECYCLE,
    legal: {
      skillBasis:
        "The result depends on aiming angle, launch strength and physics reading against the same deterministic structure.",
      fairness: INTEGRATED_DRAFT_FAIRNESS,
      termsSummary: [
        "The game uses original sci-fi structure assets and does not import third-party branded content.",
        "The current build records client outcomes only and must be server-replayed before production cash stakes.",
      ],
    },
  },
  [key("galactic-roulette", "0.1.0")]: {
    gameId: "galactic-roulette",
    gameVersion: "0.1.0",
    rulesVersion: "galactic-roulette-rules-v0.1",
    title: "Galactic Roulette integrated draft rules",
    playerFacing: {
      quickStart: "Elige apuesta y lanza la bola.",
      objective: "Increase the fictitious balance before the three-minute timer or zero-balance end condition.",
      scoringSummary: "Each launch costs 5 EUR fictitious; payout depends on the deterministic pocket reached by the launched ball.",
      inputs: [
        { action: "SELECT_BET", label: "Select bet", description: "Choose color, parity, range or exact number." },
        { action: "CYCLE_NUMBER", label: "Number", description: "Advance the exact-number bet." },
        { action: "LAUNCH", label: "Launch", description: "Launch the ball at the current wheel phase." },
      ],
    },
    competitive: {
      players: 2,
      attemptsPerPlayer: 1,
      tieRule: "EXACT_TIE_REFUND",
      resultAuthority: "CLIENT_RESULT_DRAFT",
      inputClock: "CLIENT_SESSION_CLOCK",
      endCondition: "THREE_MINUTES_OR_BALANCE_BELOW_SPIN_COST_OR_TARGET",
    },
    lifecycle: INTEGRATED_DRAFT_LIFECYCLE,
    legal: {
      skillBasis:
        "The wheel and ball motion are deterministic; the launch timing and chosen bet determine the outcome.",
      fairness: INTEGRATED_DRAFT_FAIRNESS,
      termsSummary: [
        "The balance is fictional and starts at 100 EUR for every player.",
        "This roulette-like draft is a timing game and must receive legal review plus server replay before production cash stakes.",
      ],
    },
  },
} as const satisfies Record<string, GameRulesDefinition>;

export function getGameRules(
  gameId: string,
  gameVersion: string
): GameRulesDefinition | undefined {
  return GAME_RULES[key(gameId, gameVersion)];
}

export function requireGameRules(
  gameId: string,
  gameVersion: string
): GameRulesDefinition {
  const rules = getGameRules(gameId, gameVersion);
  if (!rules) {
    throw new Error(`Missing game rules: ${gameId}@${gameVersion}`);
  }
  return rules;
}

export function listGameRules() {
  return Object.values(GAME_RULES);
}
