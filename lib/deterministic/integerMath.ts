export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/** Same tie rounding as historical fixed-point cores. Products must stay safe. */
export function roundDiv(numerator: number, denominator: number) {
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}
