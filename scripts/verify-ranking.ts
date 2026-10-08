import assert from "node:assert/strict";
import {
  formatNetProfit,
  isRankingPage,
  validMinorAmount,
} from "../lib/ranking";
import { readDemoRankingPage } from "../lib/demo/globalRanking";
import {
  parseRankingQuery,
  RankingRepositoryError,
} from "../lib/server/rankingRepository";
import { getProductionRankingRepository } from "../lib/server/postgresRankingRepository";
assert.equal(formatNetProfit("12045"), "120,45 €");
assert.equal(formatNetProfit("-5"), "-0,05 €");
assert.equal(formatNetProfit("9007199254740993"), "90.071.992.547.409,93 €");
for (const amount of [
  "1.2",
  "01",
  "NaN",
  "9223372036854775808",
  "-9223372036854775809",
  1,
  null,
])
  assert.equal(validMinorAmount(amount), false);
assert.deepEqual(parseRankingQuery(new URLSearchParams()), {
  limit: 25,
  cursor: null,
});
for (const query of [
  "limit=0",
  "limit=101",
  "limit=-1",
  "limit=1.5",
  "limit=abc",
  "cursor=",
  "cursor=%27",
  "cursor=" + "a".repeat(513),
])
  assert.throws(
    () => parseRankingQuery(new URLSearchParams(query)),
    RankingRepositoryError,
  );
let cursor: string | null = null;
const positions: number[] = [];
do {
  const page = readDemoRankingPage(25, cursor);
  assert.equal(isRankingPage(page, "demo"), true);
  assert.equal(isRankingPage(page, "server"), false);
  positions.push(...page.entries.map((r) => r.position));
  cursor = page.nextCursor;
} while (cursor);
assert.deepEqual(
  positions,
  Array.from({ length: 64 }, (_, i) => i + 1),
);
const page = readDemoRankingPage();
assert.equal(isRankingPage({ ...page, entries: [null] }, "demo"), false);
assert.equal(
  isRankingPage(
    { ...page, entries: [page.entries[1], page.entries[0]] },
    "demo",
  ),
  false,
);
assert.equal(isRankingPage({ ...page, source: "server" }, "server"), false);
const ready = process.env.RANKING_READ_MODEL_READY;
try {
  delete process.env.RANKING_READ_MODEL_READY;
  assert.throws(
    () => getProductionRankingRepository(),
    (e) =>
      e instanceof RankingRepositoryError &&
      e.code === "RANKING_NOT_CONFIGURED",
  );
} finally {
  if (ready === undefined) delete process.env.RANKING_READ_MODEL_READY;
  else process.env.RANKING_READ_MODEL_READY = ready;
}
console.log(
  "Ranking contract: exact cents, limits, pagination, source isolation and unavailable production passed",
);

const avatarPage = readDemoRankingPage(1);
assert.equal(isRankingPage(avatarPage, "demo"), true);
for (const avatarKey of [
  "avatar-0",
  "avatar-9",
  "https://tracker.invalid/a",
  "../avatar-1",
  null,
  7,
]) {
  assert.equal(
    isRankingPage(
      { ...avatarPage, entries: [{ ...avatarPage.entries[0], avatarKey }] },
      "demo",
    ),
    false,
  );
}
