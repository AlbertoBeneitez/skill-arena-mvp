/**
 * Game proposals inbox (v135). Studios send proposals from the app; only the owner reads and deletes them.
 * The owner is the signed-in account listed in STUDIO_OWNER_ACCOUNTS ("provider:accountId", comma separated, set in
 * the deployment environment). Storage is PostgreSQL (db/migrations/004-studio-proposals.sql); without DATABASE_URL
 * proposals are not accepted at all (nothing is logged or kept elsewhere).
 */
import { randomUUID } from "node:crypto";
import { getProductionPostgresPool } from "./postgresPool";
import { SESSION_COOKIE, authSecret, decodeSession, readCookie } from "./authSession";
import type { GameProposal } from "@/lib/studioProposal";

export type StoredProposal = GameProposal & { id: string; createdAt: string };
export const proposalsOpen = () => !!process.env.DATABASE_URL;

export function isStudioOwner(req: Request, env: Record<string, string | undefined> = process.env) {
  const secret = authSecret(env), s = secret ? decodeSession(readCookie(req, SESSION_COOKIE), secret) : null;
  const owners = (env.STUDIO_OWNER_ACCOUNTS ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return !!s && owners.includes(`${s.p}:${s.sub}`);
}

export async function saveProposal(p: GameProposal): Promise<string> {
  const id = randomUUID();
  await getProductionPostgresPool().query(
    "INSERT INTO studio_game_proposals(proposal_id,studio,contact,game,shelf,summary,link,consent_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [id, p.studio, p.contact, p.game, p.shelf, p.summary, p.link, p.consent],
  );
  return id;
}

export async function listProposals(): Promise<StoredProposal[]> {
  const { rows } = await getProductionPostgresPool().query(
    "SELECT proposal_id,created_at,studio,contact,game,shelf,summary,link,consent_version FROM studio_game_proposals ORDER BY created_at DESC LIMIT 200",
  );
  return rows.map((r) => ({ id: r.proposal_id, createdAt: new Date(r.created_at).toISOString(), studio: r.studio, contact: r.contact, game: r.game, shelf: r.shelf, summary: r.summary, link: r.link, consent: r.consent_version }));
}

export async function deleteProposal(id: string) {
  await getProductionPostgresPool().query("DELETE FROM studio_game_proposals WHERE proposal_id=$1", [id]);
}
