import assert from "node:assert/strict";
import { PROPOSAL_CONSENT_VERSION, PROPOSAL_SHELVES, STUDIO_TERMS_VERSION, checkSubmission } from "../lib/studioProposal";

const ok = { studio: "  Nebula   Works ", contact: "Hola@Studio.ES", terms: STUDIO_TERMS_VERSION, consent: PROPOSAL_CONSENT_VERSION };
const good = checkSubmission(ok);
assert.ok(good.ok);
if (good.ok) assert.deepEqual([good.value.studio, good.value.contact], ["Nebula Works", "hola@studio.es"], "trimmed, lower-case e-mail");
const bad = (over: Record<string, unknown>) => { const c = checkSubmission({ ...ok, ...over }); return c.ok ? null : c.field; };
assert.equal(bad({ studio: "x" }), "studio");
assert.equal(bad({ contact: "not-an-email" }), "contact");
assert.equal(bad({ terms: true }), "terms", "the conditions version in force, not a bare yes");
assert.equal(bad({ terms: "studio-terms-2020-01-01" }), "terms");
assert.equal(bad({ consent: "studio-proposal-2026-11-01" }), "consent", "only the consent version in force");
assert.equal(bad({ studio: "Ok\u0000\u0007 Studio" }), null, "control characters are stripped");
assert.equal(checkSubmission(null).ok, false);
// The same rows as CATALOG_SHELVES in lib/games.ts (which the determinism build cannot import: it loads components).
assert.deepEqual([...PROPOSAL_SHELVES], ["bar", "mythic", "dynamic", "alternative"]);
console.log("Studio submissions OK · studio, e-mail, conditions and consent versions");
