import { writeFileSync } from "node:fs";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { playGalleryV10 } from "./gallery-v10-play-fixture";
const { s, inputs } = playGalleryV10("gallery10-golden", "correct", 36);
writeFileSync("scripts/fixtures/gallery-v10.json", JSON.stringify({ seed: "gallery10-golden", inputs, finalTick: s.tick, score: s.score, hash: sha256(canonicalJson(s)) }, null, 1));
console.log(s.status, s.score, s.tick, inputs.length);
