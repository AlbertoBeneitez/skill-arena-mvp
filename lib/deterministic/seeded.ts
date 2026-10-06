export function hashSeed(value: string) {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash || 1;
}

export function createRng(seed: number | string) {
  let state = typeof seed === "string" ? hashSeed(seed) : seed >>> 0;
  if (!state) state = 1;

  return {
    nextUint() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state;
    },
    nextFloat() {
      return this.nextUint() / 0x1_0000_0000;
    },
    nextInt(maxExclusive: number) {
      if (maxExclusive <= 0) return 0;
      return Math.floor(this.nextFloat() * maxExclusive);
    },
    state() {
      return state >>> 0;
    },
  };
}

export function seededShuffle<T>(items: readonly T[], seed: number | string) {
  const copy = [...items];
  const rng = createRng(seed);

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = rng.nextInt(index + 1);
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }

  return copy;
}

export function deterministicSequence(
  seed: number | string,
  count: number,
  maxExclusive: number
) {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => rng.nextInt(maxExclusive));
}
