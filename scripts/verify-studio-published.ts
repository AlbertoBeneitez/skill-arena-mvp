import assert from "node:assert/strict";
import { isNewPublished, parsePublished, publishedCoverUrl, publishedPackageUrl } from "../lib/studio/published";

const good = {
  id: "0f8fad5b-d9cb-469f-a165-70867728950e", game: "Pulse", shelf: "alternative", summary: "x", studio: "Demo", sha256: "a".repeat(64), size: 17000,
  publishedAt: "2026-11-05T10:00:00.000Z", manifest: { id: "pulse", name: "Pulse", version: "1.0.0", developer: "Demo", tickRate: 60, maxTicks: 3600, thirdParty: [] },
};
// The catalogue only takes well-formed entries and never breaks on bad data.
assert.deepEqual(parsePublished({ games: [good] }), [good]);
assert.deepEqual(parsePublished(null), []);
assert.deepEqual(parsePublished({ games: "x" }), []);
assert.deepEqual(parsePublished({ games: [{ ...good, id: "../../etc" }, { ...good, sha256: "zz" }, { ...good, manifest: null }, 7] }), []);
assert.equal(parsePublished({ games: Array.from({ length: 80 }, () => good) }).length, 60);
// Files come from the published API only; the id is the only variable part.
assert.equal(publishedCoverUrl(good), `/api/studio/games?id=${good.id}&file=cover`);
assert.equal(publishedPackageUrl(good), `/api/studio/games?id=${good.id}&file=package`);
// "Nuevos" for 30 days after publication.
const t0 = Date.parse(good.publishedAt);
assert.equal(isNewPublished(good, t0 + 29 * 864e5), true);
assert.equal(isNewPublished(good, t0 + 31 * 864e5), false);
console.log("Studio published games OK · list validation · file URLs · 30-day Nuevos");
