/** Selectable projectile archetypes plus the archived sling controls. */
import { BIRDS_ACTIONS } from "./galacticBirdsProtocol.v1";

export const BIRDS_SELECT_ACTIONS = [
  "SELECT_SCOUT",
  "SELECT_DART",
  "SELECT_METEOR",
] as const;

export const BIRDS_ACTIONS_V2 = [
  ...BIRDS_ACTIONS,
  ...BIRDS_SELECT_ACTIONS,
] as const;
