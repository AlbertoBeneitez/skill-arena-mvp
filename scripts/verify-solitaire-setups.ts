import assert from "node:assert/strict";
import {
  generatePrivateSolitaireSetup as generate,
  projectSolitaireSetup as project,
} from "../lib/verified/solitaireSetup.v1.server";
import { canonicalJson } from "../lib/verified/canonical";
import { sha256 } from "../lib/server/matchIntegrity";
const layouts = new Set<string>(),
  visible = new Set<string>();
for (let n = 0; n < 1000; n++) {
  const setup = generate(`solitaire-private-sample-${n}`),
    before = canonicalJson(setup),
    view = project(setup);
  assert.deepEqual(generate(`solitaire-private-sample-${n}`), setup);
  const cards = [...setup.tableau.flat().map((c) => c.cardId), ...setup.stock];
  assert.deepEqual(
    [...cards].sort((a, b) => a - b),
    Array.from({ length: 52 }, (_, i) => i),
  );
  assert.deepEqual(
    setup.tableau.map((c) => c.length),
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.equal(setup.stock.length, 24);
  assert.equal("stock" in view, false);
  assert.equal("seed" in view, false);
  for (const [i, column] of setup.tableau.entries()) {
    assert.equal(column.filter((c) => c.faceUp).length, 1);
    assert.ok(view.tableau[i].slice(0, -1).every((c) => c === null));
    assert.equal(view.tableau[i].at(-1), column.at(-1)!.cardId);
  }
  assert.equal(
    canonicalJson(setup),
    before,
    "projection does not mutate secret state",
  );
  layouts.add(before);
  visible.add(canonicalJson(view.tableau));
}
assert.equal(layouts.size, 1000);
assert.equal(visible.size, 1000, "initial visible setup differs too");
assert.notDeepEqual(
  generate("a".repeat(64) + "one"),
  generate("a".repeat(64) + "two"),
  "seed suffix contributes entropy",
);
const random = Math.random,
  now = Date.now;
try {
  Math.random = () => {
    throw Error("uncontrolled RNG");
  };
  Date.now = () => {
    throw Error("wall clock");
  };
  assert.deepEqual(
    generate("fixed-private-setup"),
    generate("fixed-private-setup"),
  );
} finally {
  Math.random = random;
  Date.now = now;
}
console.log(
  "Solitaire setup candidate: 1000 distinct initial deals, all52 cards once, deterministic private RNG, hidden stock/faces, no mutation; solvability/core/public integration remain pending",
);
assert.equal(
  sha256(canonicalJson(generate("solitaire-setup-v1-golden"))),
  "sha256:350fb434ddd9422966a56e88888d01919de868fc85147df30bd2330ce0f57f49",
  "freeze setup generator mapping",
);
