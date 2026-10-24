import { writeFileSync } from "node:fs";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { playGalleryV6 } from "./gallery-v6-play-fixture";
const { s, inputs } = playGalleryV6("gallery6-golden", "correct", 36);
writeFileSync("scripts/fixtures/gallery-v6.json", JSON.stringify({ seed: "gallery6-golden", inputs, finalTick: s.tick, score: s.score, hash: sha256(canonicalJson(s)) }, null, 1));
console.log(s.status, s.score, s.tick, inputs.length);
