import { writeFileSync } from "node:fs";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { playGalleryV11 } from "./gallery-v11-play-fixture";
const { s, inputs } = playGalleryV11("gallery11-golden", "correct", 36);
writeFileSync("scripts/fixtures/gallery-v11.json", JSON.stringify({ seed: "gallery11-golden", inputs, finalTick: s.tick, score: s.score, hash: sha256(canonicalJson(s)) }, null, 1));
console.log(s.status, s.score, s.tick, inputs.length);
