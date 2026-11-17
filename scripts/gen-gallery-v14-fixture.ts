import { writeFileSync } from "node:fs";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { playGalleryV14 } from "./gallery-v14-play-fixture";
const { s, inputs } = playGalleryV14("gallery14-golden", "wrong", 36);
writeFileSync("scripts/fixtures/gallery-v14.json", JSON.stringify({ seed: "gallery14-golden", inputs, finalTick: s.tick, score: s.score, hash: sha256(canonicalJson(s)) }, null, 1));
console.log(s.status, s.score, s.tick, inputs.length);
