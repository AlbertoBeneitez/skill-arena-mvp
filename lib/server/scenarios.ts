import { randomInt } from "node:crypto";
import { canonicalJson } from "../verified/canonical";
import type { ScenarioDescriptor } from "../verified/contracts";
import { sha256 } from "./matchIntegrity";

/** Freeze this revision. Future generator revisions must preserve this mapping. */
export const SCENARIO_CATALOG_V1 = Object.freeze({
  generatorVersion: "1.0.0",
  prefix: "seed-catalog-v1",
  count: 65_536,
});

// Identity validation is independent of the live catalogue: retired games and
// historical versions must still resolve. Competitive eligibility is enforced
// by the existing server verifier registry, not by the seed mapping function.
export type ScenarioIdentity = {
  game_id: string;
  game_version: string;
};

export type GeneratedScenario = Readonly<ScenarioIdentity & {
  scenario: Readonly<ScenarioDescriptor>;
  seed: string;
}>;

function validateIdentity(identity: ScenarioIdentity) {
  if (
    !identity ||
    typeof identity !== "object" ||
    Array.isArray(identity) ||
    typeof identity.game_id !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(identity.game_id) ||
    identity.game_id.length > 96 ||
    identity.game_id !== identity.game_id.trim() ||
    typeof identity.game_version !== "string" ||
    identity.game_version.length > 32 ||
    identity.game_version !== identity.game_version.trim() ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(identity.game_version)
  ) {
    throw new Error("INVALID_SCENARIO_IDENTITY");
  }
}

/** Pure, bounded, reproducible mapping; does not issue tickets or create matches. */
export function generateScenario(
  identity: ScenarioIdentity,
  index: number,
  generatorVersion: string = SCENARIO_CATALOG_V1.generatorVersion
): GeneratedScenario {
  validateIdentity(identity);
  if (generatorVersion !== SCENARIO_CATALOG_V1.generatorVersion) {
    throw new Error("UNSUPPORTED_SCENARIO_GENERATOR");
  }
  if (!Number.isSafeInteger(index) || index < 0 || index >= SCENARIO_CATALOG_V1.count) {
    throw new Error("INVALID_SCENARIO_INDEX");
  }

  const scenario = Object.freeze({
    scenario_id: `${SCENARIO_CATALOG_V1.prefix}:${String(index).padStart(6, "0")}`,
    generator_version: generatorVersion,
  });
  const seed = sha256(canonicalJson({
    domain: "skill-arena/scenarios",
    game_id: identity.game_id,
    game_version: identity.game_version,
    ...scenario,
  })).slice("sha256:".length);

  return Object.freeze({
    game_id: identity.game_id,
    game_version: identity.game_version,
    scenario,
    seed,
  });
}

/** Recover a stored scenario exactly; reject aliases and unknown revisions. */
export function resolveScenario(
  identity: ScenarioIdentity,
  descriptor: unknown
): GeneratedScenario {
  if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) {
    throw new Error("INVALID_SCENARIO_DESCRIPTOR");
  }
  const record = descriptor as Record<string, unknown>;
  if (
    Object.keys(record).length !== 2 ||
    !Object.hasOwn(record, "scenario_id") ||
    !Object.hasOwn(record, "generator_version") ||
    typeof record.scenario_id !== "string" ||
    typeof record.generator_version !== "string"
  ) {
    throw new Error("INVALID_SCENARIO_DESCRIPTOR");
  }
  if (record.generator_version !== SCENARIO_CATALOG_V1.generatorVersion) {
    throw new Error("UNSUPPORTED_SCENARIO_GENERATOR");
  }
  const match = /^seed-catalog-v1:(\d{6})$/.exec(record.scenario_id);
  if (!match || match[0] !== record.scenario_id) throw new Error("INVALID_SCENARIO_DESCRIPTOR");
  return generateScenario(identity, Number(match[1]), record.generator_version);
}

/** Server selection for a NEW match; joining a match must recover its manifest. */
export function selectScenario(identity: ScenarioIdentity): GeneratedScenario {
  return generateScenario(identity, randomInt(SCENARIO_CATALOG_V1.count));
}

/** Hidden games retain entropy/seed exclusively server-side. Public V1 mappings are unchanged. */
export function generatePrivateScenario(identity:ScenarioIdentity,entropy:string,scenarioId:string):GeneratedScenario {
 validateIdentity(identity);
 if(!/^[0-9a-f]{64}$/.test(entropy)||!/^private-seed-v1:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(scenarioId))throw new Error('INVALID_PRIVATE_SCENARIO');
 const scenario=Object.freeze({scenario_id:scenarioId,generator_version:'private-1.0.0'});
 return Object.freeze({...identity,scenario,seed:sha256(canonicalJson({domain:'skill-arena/private-scenarios/v1',...identity,...scenario,entropy})).slice(7)});
}
export function isPrivateScenario(descriptor:unknown):descriptor is ScenarioDescriptor {
 if(!descriptor||typeof descriptor!=='object'||Array.isArray(descriptor))return false;
 const record=descriptor as Record<string,unknown>;
 return Object.keys(record).sort().join(',')==='generator_version,scenario_id'&&record.generator_version==='private-1.0.0'&&typeof record.scenario_id==='string'&&/^private-seed-v1:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(record.scenario_id);
}
