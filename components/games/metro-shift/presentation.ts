/** Visual projection only; distance/collisions remain in the immutable core. */
export function metroObstacleDepth(distanceAhead: number): number {
  // A minimum visible scale froze new hazards at the horizon until they reached
  // that scale. Start at zero instead so every approaching hazard keeps moving.
  return Math.max(0, Math.min(1.15, 1 - distanceAhead / 1100));
}
