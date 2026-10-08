/** Fictional illustration only. Never imported by server repositories or APIs. */
import type { RankingPage } from "../ranking";
const players = Array.from({ length: 64 }, (_, i) => ({
  position: i + 1,
  playerId: `demo-pilot-${i + 1}`,
  playerName: `Piloto demo ${String(i + 1).padStart(2, "0")}`,
  netProfitMinor: String(20000 - i * 450),
  avatarKey: `avatar-${i % 8 + 1}`,
}));
export function readDemoRankingPage(
  limit = 25,
  cursor: string | null = null,
): RankingPage {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error("INVALID_DEMO_LIMIT");
  if (cursor !== null && !/^demo-offset-[0-9]{1,3}$/.test(cursor))
    throw new Error("INVALID_DEMO_CURSOR");
  const offset = cursor ? Number(cursor.slice("demo-offset-".length)) : 0;
  if (offset > players.length) throw new Error("INVALID_DEMO_CURSOR");
  const entries = players.slice(offset, offset + limit),
    next = offset + entries.length;
  return {
    source: "demo",
    metric: "net-profit",
    currency: "EUR",
    snapshotId: "fictional-demo",
    asOf: null,
    entries,
    nextCursor: next < players.length ? `demo-offset-${next}` : null,
  };
}
