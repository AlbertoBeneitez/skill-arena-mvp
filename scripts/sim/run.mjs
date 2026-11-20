// Bot simulator launcher: node scripts/sim/run.mjs <entry> [args…] after `tsc -p tsconfig.sim.json`.
import { writeFileSync } from "node:fs";
import { register } from "node:module";
writeFileSync(new URL("../../.sim-build/package.json", import.meta.url), '{"type":"module"}\n');
register("./loader.mjs", import.meta.url);
const [entry, ...rest] = process.argv.slice(2);
process.argv = [process.argv[0], entry, ...rest];
await import(`../../.sim-build/scripts/sim/${entry}.js`);
