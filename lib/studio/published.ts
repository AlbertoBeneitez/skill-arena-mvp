/** v147 · A studio game published in the catalogue (from /api/studio/games), training only. Pure types and helpers. */
export type PublishedGame = {
  id: string; game: string; shelf: string; summary: string; studio: string; sha256: string; size: number; publishedAt: string;
  manifest: { id: string; name: string; version: string; developer: string; tickRate: number; maxTicks: number; thirdParty: { name: string; license: string }[] };
};
export const PUBLISHED_API = "/api/studio/games";
export const publishedCoverUrl = (g: Pick<PublishedGame, "id">) => `${PUBLISHED_API}?id=${g.id}&file=cover`;
export const publishedPackageUrl = (g: Pick<PublishedGame, "id">) => `${PUBLISHED_API}?id=${g.id}&file=package`;
/** Published in the last 30 days: also shown in the "Nuevos" row. */
export const isNewPublished = (g: Pick<PublishedGame, "publishedAt">, now: number) => now - Date.parse(g.publishedAt) < 30 * 24 * 3600 * 1000;
/** Accepts only well-formed entries from the list (the API is ours, but the catalogue must never break on bad data). */
export function parsePublished(body: unknown): PublishedGame[] {
  const list = (body as { games?: unknown })?.games;
  if (!Array.isArray(list)) return [];
  return list.filter((g): g is PublishedGame => !!g && typeof g === "object"
    && /^[0-9a-f-]{36}$/.test(String((g as PublishedGame).id)) && typeof (g as PublishedGame).game === "string"
    && typeof (g as PublishedGame).shelf === "string" && /^[0-9a-f]{64}$/.test(String((g as PublishedGame).sha256))
    && !!(g as PublishedGame).manifest && Number.isInteger((g as PublishedGame).manifest.maxTicks)).slice(0, 60);
}
