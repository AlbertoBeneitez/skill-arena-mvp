import { hashSeed } from "@/lib/deterministic/seeded";

export type ScenarioDifficulty = "EASY" | "MEDIUM" | "HARD";

export type ScenarioDefinition = {
  gameId: string;
  gameVersion: string;
  scenarioId: string;
  scenarioVersion: string;
  label: string;
  difficulty: ScenarioDifficulty;
  selectionWeight: number;
  seedNamespace: string;
  generation: "SERVER_SEED_GENERATED" | "CURATED_POOL" | "FIXED_CONTENT";
  descriptor: unknown;
};

export type ManifestScenario = {
  id: string;
  version: string;
  difficulty: ScenarioDifficulty;
  seed_namespace: string;
  generation: ScenarioDefinition["generation"];
};

function key(gameId: string, gameVersion: string) {
  return `${gameId}@${gameVersion}`;
}

const SCENARIOS = {
  [key("tower-drop", "2.1.0")]: [
    {
      gameId: "tower-drop",
      gameVersion: "2.1.0",
      scenarioId: "tower-drop-v2-standard-001",
      scenarioVersion: "1",
      label: "Standard pendulum tower",
      difficulty: "MEDIUM",
      selectionWeight: 1,
      seedNamespace: "tower-drop:v2:standard",
      generation: "FIXED_CONTENT",
      descriptor: {
        family: "pendulum-stack",
        spawnPolicy: "fixed-physics",
        targetPolicy: "server-target-score",
      },
    },
    {
      gameId: "tower-drop",
      gameVersion: "2.1.0",
      scenarioId: "tower-drop-v2-pressure-001",
      scenarioVersion: "1",
      label: "Pressure tower",
      difficulty: "HARD",
      selectionWeight: 1,
      seedNamespace: "tower-drop:v2:pressure",
      generation: "FIXED_CONTENT",
      descriptor: {
        family: "pendulum-stack",
        spawnPolicy: "fixed-physics",
        targetPolicy: "server-target-score",
        operatorNote:
          "Same frozen physics as standard; scenario id separates competitive pools for future tuning.",
      },
    },
  ],
  [key("precision-stack", "1.0.0")]: [
    {
      gameId: "precision-stack",
      gameVersion: "1.0.0",
      scenarioId: "precision-stack-v1-standard-001",
      scenarioVersion: "1",
      label: "Legacy moving-module stack",
      difficulty: "MEDIUM",
      selectionWeight: 1,
      seedNamespace: "precision-stack:v1:standard",
      generation: "SERVER_SEED_GENERATED",
      descriptor: {
        family: "moving-module-stack",
        directionPolicy: "seeded-per-level",
        speedPolicy: "legacy-progressive",
      },
    },
  ],
  [key("precision-stack", "2.0.0")]: [
    {
      gameId: "precision-stack",
      gameVersion: "2.0.0",
      scenarioId: "precision-stack-v2-standard-001",
      scenarioVersion: "1",
      label: "Standard orbital stack",
      difficulty: "MEDIUM",
      selectionWeight: 2,
      seedNamespace: "precision-stack:v2:standard",
      generation: "SERVER_SEED_GENERATED",
      descriptor: {
        family: "moving-module-stack",
        directionPolicy: "seeded-per-level",
        perfectWindow: "adaptive",
        stableOverlap: true,
      },
    },
    {
      gameId: "precision-stack",
      gameVersion: "2.0.0",
      scenarioId: "precision-stack-v2-pressure-001",
      scenarioVersion: "1",
      label: "Narrow-margin orbital stack",
      difficulty: "HARD",
      selectionWeight: 1,
      seedNamespace: "precision-stack:v2:pressure",
      generation: "SERVER_SEED_GENERATED",
      descriptor: {
        family: "moving-module-stack",
        directionPolicy: "seeded-per-level",
        perfectWindow: "adaptive",
        stableOverlap: true,
        operatorNote:
          "Current core derives actual variation from the manifest seed; this scenario id reserves a hard pool boundary.",
      },
    },
  ],
  [key("piano-rush", "1.0.0")]: [
    {
      gameId: "piano-rush",
      gameVersion: "1.0.0",
      scenarioId: "piano-rush-v1-rhythm-001",
      scenarioVersion: "1",
      label: "Four-lane rhythm chart",
      difficulty: "HARD",
      selectionWeight: 1,
      seedNamespace: "piano-rush:v1:rhythm",
      generation: "SERVER_SEED_GENERATED",
      descriptor: {
        family: "four-lane-rhythm",
        laneCount: 4,
        schedulePolicy: "seeded-nonrepeating-lanes",
      },
    },
  ],
  [key("jet-stream", "1.0.0")]: [
    {
      gameId: "jet-stream",
      gameVersion: "1.0.0",
      scenarioId: "jet-stream-v1-gate-run-001",
      scenarioVersion: "1",
      label: "Seeded gate run",
      difficulty: "HARD",
      selectionWeight: 1,
      seedNamespace: "jet-stream:v1:gate-run",
      generation: "SERVER_SEED_GENERATED",
      descriptor: {
        family: "vertical-gate-runner",
        gatePolicy: "seeded-center-and-spacing",
        speedPolicy: "progressive",
      },
    },
  ],
  [key("dino-dash", "1.0.0")]: [
    {
      gameId: "dino-dash",
      gameVersion: "1.0.0",
      scenarioId: "dino-dash-v1-cactus-run-001",
      scenarioVersion: "1",
      label: "Ground obstacle run",
      difficulty: "MEDIUM",
      selectionWeight: 2,
      seedNamespace: "dino-dash:v1:cactus-run",
      generation: "SERVER_SEED_GENERATED",
      descriptor: {
        family: "runner-obstacle-course",
        obstaclePolicy: "seeded-cactus-first",
        supportsDucking: true,
      },
    },
    {
      gameId: "dino-dash",
      gameVersion: "1.0.0",
      scenarioId: "dino-dash-v1-mixed-run-001",
      scenarioVersion: "1",
      label: "Mixed obstacle run",
      difficulty: "HARD",
      selectionWeight: 1,
      seedNamespace: "dino-dash:v1:mixed-run",
      generation: "SERVER_SEED_GENERATED",
      descriptor: {
        family: "runner-obstacle-course",
        obstaclePolicy: "seeded-cactus-double-flyer",
        supportsDucking: true,
      },
    },
  ],
  [key("pulse-runner", "1.0.0")]: [
    {
      gameId: "pulse-runner",
      gameVersion: "1.0.0",
      scenarioId: "pulse-runner-v1-standard-001",
      scenarioVersion: "1",
      label: "Standard pulse course",
      difficulty: "MEDIUM",
      selectionWeight: 2,
      seedNamespace: "pulse-runner:v1:standard",
      generation: "SERVER_SEED_GENERATED",
      descriptor: {
        family: "one-button-runner",
        patternPolicy: "seeded-progressive-patterns",
        supportsJumpBuffer: true,
        supportsCoyoteTime: true,
      },
    },
    {
      gameId: "pulse-runner",
      gameVersion: "1.0.0",
      scenarioId: "pulse-runner-v1-pressure-001",
      scenarioVersion: "1",
      label: "Pressure pulse course",
      difficulty: "HARD",
      selectionWeight: 1,
      seedNamespace: "pulse-runner:v1:pressure",
      generation: "SERVER_SEED_GENERATED",
      descriptor: {
        family: "one-button-runner",
        patternPolicy: "seeded-progressive-patterns",
        supportsJumpBuffer: true,
        supportsCoyoteTime: true,
        operatorNote:
          "Current core derives concrete pattern ordering from the manifest seed; this scenario id reserves a higher-pressure pool.",
      },
    },
  ],
  [key("galactic-slot", "0.1.0")]: [
    {
      gameId: "galactic-slot",
      gameVersion: "0.1.0",
      scenarioId: "galactic-slot-v0-fixed-strip-001",
      scenarioVersion: "1",
      label: "Fixed three-reel strip",
      difficulty: "MEDIUM",
      selectionWeight: 1,
      seedNamespace: "galactic-slot:v0:fixed-strip",
      generation: "FIXED_CONTENT",
      descriptor: {
        family: "deterministic-slot-stepper",
        reelCount: 3,
        stripLength: 8,
        startingBalance: 100,
        spinCost: 5,
        roundSeconds: 180,
        payoutPolicy: "fixed-table",
      },
    },
  ],
  [key("galactic-birds", "0.1.0")]: [
    {
      gameId: "galactic-birds",
      gameVersion: "0.1.0",
      scenarioId: "galactic-birds-v0-dual-tower-001",
      scenarioVersion: "1",
      label: "Dual core tower",
      difficulty: "HARD",
      selectionWeight: 1,
      seedNamespace: "galactic-birds:v0:dual-tower",
      generation: "SERVER_SEED_GENERATED",
      descriptor: {
        family: "slingshot-physics-structure",
        projectileCount: 6,
        targetPolicy: "destroy-all-cores",
        physicsPolicy: "deterministic-client-draft",
      },
    },
  ],
  [key("galactic-roulette", "0.1.0")]: [
    {
      gameId: "galactic-roulette",
      gameVersion: "0.1.0",
      scenarioId: "galactic-roulette-v0-european-wheel-001",
      scenarioVersion: "1",
      label: "Deterministic European wheel",
      difficulty: "MEDIUM",
      selectionWeight: 1,
      seedNamespace: "galactic-roulette:v0:european-wheel",
      generation: "FIXED_CONTENT",
      descriptor: {
        family: "deterministic-roulette-timing",
        pockets: 37,
        startingBalance: 100,
        spinCost: 5,
        roundSeconds: 180,
        resultPolicy: "launch-phase-and-deceleration",
      },
    },
  ],
} as const satisfies Record<string, readonly ScenarioDefinition[]>;

export function listGameScenarios(
  gameId: string,
  gameVersion: string
): readonly ScenarioDefinition[] {
  return SCENARIOS[key(gameId, gameVersion)] ?? [];
}

export function getGameScenario(
  gameId: string,
  gameVersion: string,
  scenarioId: string
): ScenarioDefinition | undefined {
  return listGameScenarios(gameId, gameVersion).find(
    (scenario) => scenario.scenarioId === scenarioId
  );
}

export function selectGameScenario(
  gameId: string,
  gameVersion: string,
  seed: string,
  requestedScenarioId?: string
): ScenarioDefinition | undefined {
  if (requestedScenarioId) {
    return getGameScenario(gameId, gameVersion, requestedScenarioId);
  }

  const scenarios = listGameScenarios(gameId, gameVersion);
  if (scenarios.length === 0) return undefined;

  const totalWeight = scenarios.reduce(
    (total, scenario) => total + scenario.selectionWeight,
    0
  );
  let cursor = hashSeed(`${seed}:scenario`) % totalWeight;

  for (const scenario of scenarios) {
    if (cursor < scenario.selectionWeight) return scenario;
    cursor -= scenario.selectionWeight;
  }

  return scenarios[0];
}

export function manifestScenarioFor(
  scenario: ScenarioDefinition
): ManifestScenario {
  return {
    id: scenario.scenarioId,
    version: scenario.scenarioVersion,
    difficulty: scenario.difficulty,
    seed_namespace: scenario.seedNamespace,
    generation: scenario.generation,
  };
}
