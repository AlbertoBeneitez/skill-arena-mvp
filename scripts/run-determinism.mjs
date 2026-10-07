import { writeFileSync } from "node:fs";
import { register } from "node:module";

writeFileSync(new URL("../.det-test/package.json", import.meta.url), '{"type":"module"}\n');
register("./determinism-loader.mjs", import.meta.url);
if (process.argv[2] === "repository") {
  await import("../.det-test/scripts/verify-match-repository.js");
} else {
  await import("../.det-test/scripts/verify-competitive-games.js");
  await import("../.det-test/scripts/verify-match-contracts.js");
  await import("../.det-test/scripts/verify-scenarios.js");
  await import("../.det-test/scripts/verify-submission-lifecycle.js");
}
