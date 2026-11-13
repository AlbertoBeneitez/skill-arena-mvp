import { inflateRawSync } from "node:zlib";
import type { InflateRaw } from "@/lib/studio/package";

/** v186 · zlib stops with an error as soon as the output passes the claimed size, so a zip bomb costs no CPU. */
export const boundedInflateRaw: InflateRaw = (data, maxOut) => new Uint8Array(inflateRawSync(data, { maxOutputLength: maxOut }));
