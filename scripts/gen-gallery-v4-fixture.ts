import { writeFileSync } from "node:fs";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { playGalleryV4 } from "./gallery-v4-play-fixture";
const { s, inputs } = playGalleryV4("gallery4-golden", "correct", 36);
writeFileSync("scripts/fixtures/gallery-v4.json", JSON.stringify({ seed: "gallery4-golden", inputs, finalTick: s.tick, score: s.score, hash: sha256(canonicalJson(s)) }, null, 1));
console.log(s.status, s.score, s.tick, inputs.length);
