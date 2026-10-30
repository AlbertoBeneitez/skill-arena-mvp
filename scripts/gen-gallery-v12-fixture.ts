import { writeFileSync } from "node:fs";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { playGalleryV12 } from "./gallery-v12-play-fixture";
const { s, inputs } = playGalleryV12("gallery12-golden", "double", 36);
writeFileSync("scripts/fixtures/gallery-v12.json", JSON.stringify({ seed: "gallery12-golden", inputs, finalTick: s.tick, score: s.score, hash: sha256(canonicalJson(s)) }, null, 1));
console.log(s.status, s.score, s.tick, inputs.length);
