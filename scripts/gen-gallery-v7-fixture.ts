import { writeFileSync } from "node:fs";
import { sha256 } from "../lib/server/matchIntegrity";
import { canonicalJson } from "../lib/verified/canonical";
import { playGalleryV7 } from "./gallery-v7-play-fixture";
const { s, inputs } = playGalleryV7("gallery7-golden", "correct", 36);
writeFileSync("scripts/fixtures/gallery-v7.json", JSON.stringify({ seed: "gallery7-golden", inputs, finalTick: s.tick, score: s.score, hash: sha256(canonicalJson(s)) }, null, 1));
console.log(s.status, s.score, s.tick, inputs.length);
