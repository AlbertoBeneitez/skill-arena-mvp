import { writeFileSync } from "node:fs";
import { register } from "node:module";

writeFileSync(new URL("../.det-test/package.json", import.meta.url), '{"type":"module"}\n');
register("./determinism-loader.mjs", import.meta.url);
await import("../.det-test/scripts/verify-competitive-games.js");
await import("../.det-test/scripts/verify-match-contracts.js");
await import("../.det-test/scripts/verify-scenarios.js");
