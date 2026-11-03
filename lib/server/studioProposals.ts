/**
 * Game submissions inbox (v135, packages since v142). Studios send a package from the app; only the owner reads,
 * reviews and deletes them. The owner is the signed-in account listed in STUDIO_OWNER_ACCOUNTS
 * ("provider:accountId", comma separated, set in the deployment environment). Storage is PostgreSQL
 * (db/migrations/004 and 005); without DATABASE_URL submissions are checked but never stored.
 */
import { createHash, randomUUID } from "node:crypto";
import { getProductionPostgresPool } from "./postgresPool";
import { SESSION_COOKIE, authSecret, decodeSession, readCookie } from "./authSession";
import type { Submission } from "@/lib/studioProposal";
import type { Manifest, Report } from "@/lib/studio/package";

export type ReviewStatus = "received" | "approved" | "rejected";
export type StoredSubmission = {
  id: string; createdAt: string; studio: string; contact: string; game: string; shelf: string; summary: string;
  link: string | null; manifest: Manifest | null; report: Report | null; sha256: string | null; size: number; status: ReviewStatus;
};
export const proposalsOpen = () => !!process.env.DATABASE_URL;
export const REVIEW_STATUSES: ReviewStatus[] = ["received", "approved", "rejected"];

export function isStudioOwner(req: Request, env: Record<string, string | undefined> = process.env) {
  const secret = authSecret(env), s = secret ? decodeSession(readCookie(req, SESSION_COOKIE), secret) : null;
  const owners = (env.STUDIO_OWNER_ACCOUNTS ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return !!s && owners.includes(`${s.p}:${s.sub}`);
}

export async function saveSubmission(s: Submission, manifest: Manifest, report: Report, pkg: Uint8Array): Promise<string> {
  const id = randomUUID();
  const sha = createHash("sha256").update(pkg).digest("hex");
  await getProductionPostgresPool().query(
    `INSERT INTO studio_game_proposals(proposal_id,studio,contact,game,shelf,summary,link,consent_version,package,package_sha256,manifest,report,terms_version)
     VALUES($1,$2,$3,$4,$5,$6,NULL,$7,$8,$9,$10,$11,$12)`,
    [id, s.studio, s.contact, manifest.name, manifest.shelf, manifest.description, s.consent, Buffer.from(pkg), sha, JSON.stringify(manifest), JSON.stringify(report), s.terms],
  );
  return id;
}

export async function listSubmissions(): Promise<StoredSubmission[]> {
  const { rows } = await getProductionPostgresPool().query(
    `SELECT proposal_id,created_at,studio,contact,game,shelf,summary,link,manifest,report,package_sha256,
            COALESCE(octet_length(package),0) AS size,review_status
       FROM studio_game_proposals ORDER BY created_at DESC LIMIT 200`,
  );
  return rows.map((r) => ({
    id: r.proposal_id, createdAt: new Date(r.created_at).toISOString(), studio: r.studio, contact: r.contact, game: r.game, shelf: r.shelf,
    summary: r.summary, link: r.link, manifest: r.manifest, report: r.report, sha256: r.package_sha256, size: Number(r.size), status: r.review_status,
  }));
}

export async function readPackage(id: string): Promise<{ bytes: Buffer; name: string } | null> {
  const { rows } = await getProductionPostgresPool().query("SELECT package, manifest FROM studio_game_proposals WHERE proposal_id=$1 AND package IS NOT NULL", [id]);
  if (!rows.length) return null;
  const m = rows[0].manifest as Manifest | null;
  return { bytes: rows[0].package as Buffer, name: `${m?.id ?? "game"}-${m?.version ?? "0.0.0"}.zip` };
}

export async function setReviewStatus(id: string, status: ReviewStatus) {
  await getProductionPostgresPool().query("UPDATE studio_game_proposals SET review_status=$2, reviewed_at=now() WHERE proposal_id=$1", [id, status]);
}

export async function deleteProposal(id: string) {
  await getProductionPostgresPool().query("DELETE FROM studio_game_proposals WHERE proposal_id=$1", [id]);
}
