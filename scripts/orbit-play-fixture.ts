import {
  ORBIT_RADII,
  type OrbitState,
} from "../lib/verified/orbitShiftCore.v1";
/** Test-only steering over the public upcoming rings. */
export function chooseOrbitAction(s: OrbitState) {
  const gate = s.gates[s.passed];
  if (!gate) return null;
  let safe = ORBIT_RADII.map((_, i) => i).filter(
    (i) => !gate.lanes.includes(i),
  );
  if (gate.pickup !== null && Math.abs(gate.pickup - s.lane) <= 1)
    safe = [gate.pickup];
  const target = safe.sort(
    (a, b) => Math.abs(a - s.lane) - Math.abs(b - s.lane),
  )[0];
  return target < s.lane ? "IN" : target > s.lane ? "OUT" : null;
}
