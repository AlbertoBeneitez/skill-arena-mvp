import { checkProposal } from "@/lib/studioProposal";
import { deleteProposal, isStudioOwner, listProposals, proposalsOpen, saveProposal } from "@/lib/server/studioProposals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
/** Browsers send Origin on POST/DELETE; it must name this host (the Host header, which is what the browser reached). */
const sameOrigin = (req: Request) => {
  const o = req.headers.get("origin");
  if (!o) return true;
  try { return new URL(o).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host")); } catch { return false; }
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A studio sends a proposal. Validated with the same rules as the form; stored only when PostgreSQL is configured. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "ORIGIN_REJECTED" }, 403);
  const text = await req.text();
  if (text.length > 4096) return json({ error: "TOO_LARGE" }, 413);
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { return json({ error: "INVALID_JSON" }, 400); }
  const check = checkProposal(body);
  if (!check.ok) return json({ error: "INVALID_FIELD", field: check.field }, 400);
  if (!proposalsOpen()) return json({ error: "PROPOSALS_NOT_OPEN" }, 503);
  try { return json({ id: await saveProposal(check.value) }, 201); } catch { return json({ error: "STORAGE_FAILED" }, 503); }
}

/** The owner's inbox. Anyone else gets 404, so the inbox's existence is not revealed. */
export async function GET(req: Request) {
  if (!isStudioOwner(req)) return json({ error: "NOT_FOUND" }, 404);
  if (!proposalsOpen()) return json({ error: "PROPOSALS_NOT_OPEN" }, 503);
  try { return json({ proposals: await listProposals() }); } catch { return json({ error: "STORAGE_FAILED" }, 503); }
}

/** The owner deletes a proposal once it is answered (data minimisation). */
export async function DELETE(req: Request) {
  if (!sameOrigin(req) || !isStudioOwner(req)) return json({ error: "NOT_FOUND" }, 404);
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return json({ error: "INVALID_ID" }, 400);
  if (!proposalsOpen()) return json({ error: "PROPOSALS_NOT_OPEN" }, 503);
  try { await deleteProposal(id); return new Response(null, { status: 204, headers }); } catch { return json({ error: "STORAGE_FAILED" }, 503); }
}
