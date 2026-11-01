import assert from "node:assert/strict";
import { PROPOSAL_CONSENT_VERSION, PROPOSAL_SHELVES, checkProposal } from "../lib/studioProposal";

const ok = { studio: "  Nebula   Works ", contact: "Hola@Studio.ES", game: "Comet Run", shelf: "dynamic", summary: "Esquiva cometas en una órbita que se cierra.", link: "https://studio.es/comet", terms: true, consent: PROPOSAL_CONSENT_VERSION };
const good = checkProposal(ok);
assert.ok(good.ok);
if (good.ok) assert.deepEqual([good.value.studio, good.value.contact, good.value.link], ["Nebula Works", "hola@studio.es", "https://studio.es/comet"], "trimmed, lower-case e-mail, normalised link");
const bad = (over: Record<string, unknown>) => { const c = checkProposal({ ...ok, ...over }); return c.ok ? null : c.field; };
assert.equal(bad({ studio: "x" }), "studio");
assert.equal(bad({ contact: "not-an-email" }), "contact");
assert.equal(bad({ game: "" }), "game");
assert.equal(bad({ summary: "short" }), "summary");
assert.equal(bad({ link: "http://studio.es/comet" }), "link", "https only");
assert.equal(bad({ link: "javascript:alert(1)" }), "link");
assert.equal(bad({ shelf: "popular" }), "shelf", "Populares is earned, not chosen");
assert.equal(bad({ shelf: "new" }), "shelf", "Nuevos is earned, not chosen");
assert.equal(bad({ terms: "yes" }), "terms");
assert.equal(bad({ consent: "old-version" }), "consent", "only the consent version in force");
assert.equal(bad({ studio: "Ok\u0000\u0007 Studio" }), null, "control characters are stripped");
assert.equal(checkProposal(null).ok, false);
// The same rows as CATALOG_SHELVES in lib/games.ts (which the determinism build cannot import: it loads components).
assert.deepEqual([...PROPOSAL_SHELVES], ["casino", "bar", "mythic", "dynamic", "alternative"]);
console.log("Studio proposals OK · fields, https link, e-mail, earned rows refused, terms and consent version");
