import { writeFileSync } from "node:fs";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { playGalleryV9 } from "./gallery-v9-play-fixture";
const { s, inputs } = playGalleryV9("gallery9-golden", "correct", 36);
writeFileSync("scripts/fixtures/gallery-v9.json", JSON.stringify({ seed: "gallery9-golden", inputs, finalTick: s.tick, score: s.score, hash: sha256(canonicalJson(s)) }, null, 1));
console.log(s.status, s.score, s.tick, inputs.length);
