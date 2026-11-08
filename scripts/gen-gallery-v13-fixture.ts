import { writeFileSync } from "node:fs";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { playGalleryV13 } from "./gallery-v13-play-fixture";
const { s, inputs } = playGalleryV13("gallery13-golden", "double", 36);
writeFileSync("scripts/fixtures/gallery-v13.json", JSON.stringify({ seed: "gallery13-golden", inputs, finalTick: s.tick, score: s.score, hash: sha256(canonicalJson(s)) }, null, 1));
console.log(s.status, s.score, s.tick, inputs.length);
