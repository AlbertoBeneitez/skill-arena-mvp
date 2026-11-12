// npm run zip — packs what Galactic Games needs into pulse.zip (rename it to your game's id): galactic.json,
// the cover, src/ and kit/. node_modules, preview and tools stay out.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { zipSync } from "fflate";

const files = {};
const add = (p) => { if (statSync(p).isDirectory()) for (const n of readdirSync(p)) add(join(p, n)); else files[p.replaceAll("\\", "/")] = readFileSync(p); };
for (const p of ["galactic.json", "src", "kit"]) add(p);
for (const c of ["cover.webp", "cover.png", "cover.jpg"]) try { files[c] = readFileSync(c); break; } catch { /* next */ }
const id = JSON.parse(readFileSync("galactic.json", "utf8")).id;
writeFileSync(`${id}.zip`, zipSync(files, { level: 9 }));
console.log(`wrote ${id}.zip`);
