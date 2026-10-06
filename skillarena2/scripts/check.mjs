import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const lock = JSON.parse(await fs.readFile(path.join(root, "vendor-lock.json"), "utf8"));

let failed = false;
for (const upstream of lock.upstreams) {
  const marker = path.join(root, "vendor", upstream.id, ".skillarena2-ref");
  try {
    const actual = (await fs.readFile(marker, "utf8")).trim();
    if (actual !== upstream.commit) throw new Error(`expected ${upstream.commit}, got ${actual}`);
    console.log(`OK vendor/${upstream.id} @ ${actual.slice(0, 8)}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL vendor/${upstream.id}: ${error.message}`);
  }

  if (upstream.mode === "playable-static") {
    const index = path.join(root, "public", upstream.publicPath, "index.html");
    try {
      await fs.access(index);
      console.log(`OK public/${upstream.publicPath}/index.html`);
    } catch {
      failed = true;
      console.error(`FAIL public/${upstream.publicPath}/index.html missing`);
    }
  }
}

process.exit(failed ? 1 : 0);
