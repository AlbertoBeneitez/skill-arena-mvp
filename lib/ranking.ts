/** Public read model: cents are strings to retain PostgreSQL bigint precision. */
export type RankingEntry = Readonly<{
  position: number;
  playerId: string;
  playerName: string;
  netProfitMinor: string;
}>;
export type RankingPage = Readonly<{
  source: "server" | "demo";
  metric: "net-profit";
  currency: "EUR";
  snapshotId: string | null;
  asOf: string | null;
  entries: readonly RankingEntry[];
  nextCursor: string | null;
}>;
export const RANKING_PAGE_LIMIT = 25;
export const RANKING_MAX_LIMIT = 100;
export function validMinorAmount(value: unknown): value is string {
  if (typeof value !== "string" || !/^-?(0|[1-9][0-9]{0,18})$/.test(value))
    return false;
  const amount = BigInt(value);
  return (
    amount >= BigInt("-9223372036854775808") &&
    amount <= BigInt("9223372036854775807")
  );
}
export function formatNetProfit(value: string) {
  if (!validMinorAmount(value)) throw new Error("INVALID_AMOUNT");
  const amount = BigInt(value),
    absolute = amount < BigInt(0) ? -amount : amount;
  return `${amount < BigInt(0) ? "-" : ""}${(absolute / BigInt(100)).toLocaleString("es-ES")},${(absolute % BigInt(100)).toString().padStart(2, "0")} €`;
}
export function isRankingPage(
  value: unknown,
  source: RankingPage["source"],
): value is RankingPage {
  if (!value || typeof value !== "object") return false;
  const p = value as RankingPage;
  if (
    p.source !== source ||
    p.metric !== "net-profit" ||
    p.currency !== "EUR" ||
    !Array.isArray(p.entries) ||
    p.entries.length > RANKING_MAX_LIMIT
  )
    return false;
  if (
    p.snapshotId !== null &&
    (typeof p.snapshotId !== "string" || p.snapshotId.length > 100)
  )
    return false;
  if (
    p.asOf !== null &&
    (typeof p.asOf !== "string" || !Number.isFinite(Date.parse(p.asOf)))
  )
    return false;
  if (
    p.nextCursor !== null &&
    (typeof p.nextCursor !== "string" || p.nextCursor.length > 512)
  )
    return false;
  if (
    p.source === "server" &&
    p.entries.length > 0 &&
    (!p.snapshotId || !p.asOf)
  )
    return false;
  let position = 0;
  const players = new Set<string>();
  let previous: bigint | null = null;
  for (const row of p.entries) {
    if (!row || typeof row !== "object") return false;
    if (
      !Number.isSafeInteger(row.position) ||
      row.position <= position ||
      typeof row.playerId !== "string" ||
      !row.playerId ||
      row.playerId.length > 100 ||
      players.has(row.playerId) ||
      typeof row.playerName !== "string" ||
      !row.playerName.trim() ||
      row.playerName.length > 80 ||
      !validMinorAmount(row.netProfitMinor)
    )
      return false;
    const amount = BigInt(row.netProfitMinor);
    if (previous !== null && amount > previous) return false;
    players.add(row.playerId);
    previous = amount;
    position = row.position;
  }
  return true;
}
