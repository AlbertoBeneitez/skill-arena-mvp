import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const lock = JSON.parse(await fs.readFile(path.join(root, "vendor-lock.json"), "utf8"));

let failed = false;
const candidates = lock.upstreams.filter((upstream) => upstream.role === "candidate");

for (const upstream of candidates) {
  const marker = path.join(root, "vendor", upstream.id, ".skillarena2-ref");
  try {
    const actual = (await fs.readFile(marker, "utf8")).trim();
    if (actual !== upstream.commit) throw new Error(`expected ${upstream.commit}, got ${actual}`);
    console.log(`OK candidate vendor/${upstream.id} @ ${actual.slice(0, 8)}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL candidate vendor/${upstream.id}: ${error.message}`);
  }

  if (upstream.mode === "playable-static") {
    const index = path.join(root, "public", upstream.publicPath, "index.html");
    try {
      const html = await fs.readFile(index, "utf8");
      if (!html.includes("SKILL ARENA")) throw new Error("mobile/rebrand patch missing");
      if (!html.includes("__SKILLARENA2__")) throw new Error("deterministic/replay bridge missing");
      console.log(`OK public/${upstream.publicPath}/index.html mobile + seed + replay bridge`);
    } catch (error) {
      failed = true;
      console.error(`FAIL public/${upstream.publicPath}/index.html: ${error.message}`);
    }
  }
}

console.log("References are optional and do not block the mobile transfer lab.");
process.exit(failed ? 1 : 0);
