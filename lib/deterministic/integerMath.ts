export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/** Same tie rounding as historical fixed-point cores. Products must stay safe. */
export function roundDiv(numerator: number, denominator: number) {
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}

export function integerSqrt(value: number) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error("INVALID_INTEGER_SQRT");
  if (value < 2) return value;
  let x = value,
    next = Math.floor((x + Math.floor(value / x)) / 2);
  while (next < x) {
    x = next;
    next = Math.floor((x + Math.floor(value / x)) / 2);
  }
  return x;
}

/** Integer rational sine for new cores. Archived game math stays unchanged. */
export function sinPhaseMilli(phase: number) {
  if (!Number.isSafeInteger(phase)) throw new Error("INVALID_PHASE");
  const p = ((phase % 4096) + 4096) % 4096;
  const t = p % 2048,
    u = t * (2048 - t);
  const wave = roundDiv(16 * u * 1000, 5 * 2048 * 2048 - 4 * u);
  return p >= 2048 && wave ? -wave : wave;
}
