import { writeFileSync } from "node:fs";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { playGalleryV5 } from "./gallery-v5-play-fixture";
const { s, inputs } = playGalleryV5("gallery5-golden", "correct", 36);
writeFileSync("scripts/fixtures/gallery-v5.json", JSON.stringify({ seed: "gallery5-golden", inputs, finalTick: s.tick, score: s.score, hash: sha256(canonicalJson(s)) }, null, 1));
console.log(s.status, s.score, s.tick, inputs.length);
