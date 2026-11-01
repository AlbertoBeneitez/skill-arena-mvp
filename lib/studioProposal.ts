/**
 * Game proposals from external studios (v135) — pure validation shared by the form and the server. A proposal is the
 * first step of the platform process (docs: external games specification): who sends it, how to reach them, the game,
 * the catalogue row they choose (never "Populares" or "Nuevos", which are earned), a short summary, a link to the
 * package or a demo, and the acceptance of the conditions and of the privacy notice in force.
 */
export const PROPOSAL_CONSENT_VERSION = "studio-proposal-2026-11-01";
/** Rows a studio can choose (lib/games.ts CATALOG_SHELVES). */
export const PROPOSAL_SHELVES = ["casino", "bar", "mythic", "dynamic", "alternative"] as const;
export type ProposalShelf = (typeof PROPOSAL_SHELVES)[number];
export type GameProposal = { studio: string; contact: string; game: string; shelf: ProposalShelf; summary: string; link: string; consent: string };
export type ProposalField = keyof GameProposal | "terms";
export type ProposalCheck = { ok: true; value: GameProposal } | { ok: false; field: ProposalField };

const LIMITS = { studio: [2, 80], contact: [6, 120], game: [2, 60], summary: [10, 280], link: [12, 300] } as const;
/** Trimmed text without control characters and with single spaces. */
const clean = (v: unknown) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function checkProposal(raw: unknown): ProposalCheck {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const v = { studio: clean(r.studio), contact: clean(r.contact).toLowerCase(), game: clean(r.game), summary: clean(r.summary), link: clean(r.link) };
  for (const [field, [min, max]] of Object.entries(LIMITS) as [keyof typeof LIMITS, readonly [number, number]][])
    if (v[field].length < min || v[field].length > max) return { ok: false, field };
  if (!EMAIL.test(v.contact)) return { ok: false, field: "contact" };
  let url: URL | null = null;
  try { url = new URL(v.link); } catch { url = null; }
  if (!url || url.protocol !== "https:" || !url.hostname.includes(".")) return { ok: false, field: "link" };
  if (!PROPOSAL_SHELVES.includes(r.shelf as ProposalShelf)) return { ok: false, field: "shelf" };
  if (r.terms !== true) return { ok: false, field: "terms" };
  if (r.consent !== PROPOSAL_CONSENT_VERSION) return { ok: false, field: "consent" };
  return { ok: true, value: { ...v, link: url.href, shelf: r.shelf as ProposalShelf, consent: PROPOSAL_CONSENT_VERSION } };
}
