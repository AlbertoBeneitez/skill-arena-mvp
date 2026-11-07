/**
 * Game submissions from external studios — pure validation shared by the form and the server.
 * v135 took a proposal with a link; v142 takes the game itself as one package file (lib/studio/package.ts), so the
 * form only asks who sends it, how to reach them, and the acceptance of the studio conditions and of the privacy
 * notice in force. Name, category and description come from the package's galactic.json.
 */
export const STUDIO_TERMS_VERSION = "studio-terms-2026-11-03";
export const PROPOSAL_CONSENT_VERSION = "studio-proposal-2026-11-03";
/** Rows a studio can choose in galactic.json (lib/games.ts CATALOG_SHELVES); "Populares" and "Nuevos" are earned. */
export const PROPOSAL_SHELVES = ["bar", "mythic", "dynamic", "alternative"] as const;
export type ProposalShelf = (typeof PROPOSAL_SHELVES)[number];
export type Submission = { studio: string; contact: string; terms: string; consent: string };
export type SubmissionField = keyof Submission | "file";
export type SubmissionCheck = { ok: true; value: Submission } | { ok: false; field: SubmissionField };

/** Trimmed text without control characters and with single spaces. */
const clean = (v: unknown) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function checkSubmission(raw: unknown): SubmissionCheck {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const studio = clean(r.studio), contact = clean(r.contact).toLowerCase();
  if (studio.length < 2 || studio.length > 80) return { ok: false, field: "studio" };
  if (contact.length < 6 || contact.length > 120 || !EMAIL.test(contact)) return { ok: false, field: "contact" };
  if (r.terms !== STUDIO_TERMS_VERSION) return { ok: false, field: "terms" };
  if (r.consent !== PROPOSAL_CONSENT_VERSION) return { ok: false, field: "consent" };
  return { ok: true, value: { studio, contact, terms: STUDIO_TERMS_VERSION, consent: PROPOSAL_CONSENT_VERSION } };
}
