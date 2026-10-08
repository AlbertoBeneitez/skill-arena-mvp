import { createHmac } from "node:crypto";
/** Versioned server-only deterministic stream for hidden scenarios. No 32-bit seed reduction.
 * Public historical RNGs stay untouched. HMAC-SHA256 is specified, not device randomness. */
export function createPrivateHashRng(seed: string, domain: string) {
  let counter = 0,
    offset = 32,
    block = Buffer.alloc(0);
  function nextUint32() {
    if (offset >= 32) {
      block = createHmac("sha256", seed)
        .update(`galactic/private-stream/v1\0${domain}\0${counter++}`)
        .digest();
      offset = 0;
    }
    const value = block.readUInt32BE(offset);
    offset += 4;
    return value;
  }
  return {
    nextInt(maxExclusive: number) {
      if (
        !Number.isSafeInteger(maxExclusive) ||
        maxExclusive < 1 ||
        maxExclusive > 0x100000000
      )
        throw new Error("INVALID_PRIVATE_RNG_BOUND");
      const limit = 0x100000000 - (0x100000000 % maxExclusive);
      let value: number;
      do {
        value = nextUint32();
      } while (value >= limit);
      return value % maxExclusive;
    },
  };
}
