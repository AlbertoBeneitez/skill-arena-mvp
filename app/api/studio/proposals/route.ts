import { checkSubmission } from "@/lib/studioProposal";
import { PACKAGE_LIMITS } from "@/lib/studio/package";
import { checkPackage } from "@/lib/server/studioPackageCheck";
import { REVIEW_STATUSES, deleteProposal, isStudioOwner, inboxReachable, listSubmissions, proposalsOpen, readPackage, saveSubmission, setReviewStatus, StudioQuotaError, type ReviewStatus } from "@/lib/server/studioProposals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;
const headers = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
/** Browsers send Origin on POST/PATCH/DELETE; it must name this host (the Host header, which is what the browser reached). */
const sameOrigin = (req: Request) => {
  const o = req.headers.get("origin");
  if (!o) return true;
  try { return new URL(o).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host")); } catch { return false; }
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const idOf = (req: Request) => { const id = new URL(req.url).searchParams.get("id") ?? ""; return UUID.test(id) ? id : null; };

/**
 * A studio sends its game: who they are, the conditions and privacy versions accepted, and the package file.
 * The package passes the automatic check first and the studio always gets the report back; it is stored only when
 * every check passes and PostgreSQL is configured.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "ORIGIN_REJECTED" }, 403);
  // v186: closed inboxes answer before reading or unpacking anything, so a closed form costs no CPU.
  if (!proposalsOpen()) return json({ error: "PROPOSALS_NOT_OPEN" }, 503);
  if (Number(req.headers.get("content-length") ?? 0) > PACKAGE_LIMITS.zipBytes + 64 * 1024) return json({ error: "TOO_LARGE", field: "file" }, 413);
  let form: FormData;
  try { form = await req.formData(); } catch { return json({ error: "INVALID_FORM" }, 400); }
  const check = checkSubmission({ studio: form.get("studio"), contact: form.get("contact"), terms: form.get("terms"), consent: form.get("consent") });
  if (!check.ok) return json({ error: "INVALID_FIELD", field: check.field }, 400);
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) return json({ error: "INVALID_FIELD", field: "file" }, 400);
  if (file.size > PACKAGE_LIMITS.zipBytes) return json({ error: "TOO_LARGE", field: "file" }, 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  // v178: new games come in the app's own format (2), so they can be integrated as a version.
  const { report, unpacked } = await checkPackage(bytes, [2]);
  if (!report.ok || !unpacked.manifest) return json({ error: "CHECKS_FAILED", report }, 422);
  try { return json({ id: await saveSubmission(check.value, unpacked.manifest, report, bytes), report }, 201); }
  catch (error) {
    if (error instanceof StudioQuotaError)
      return json({ error: error.reason === "DUPLICATE" ? "DUPLICATE_PACKAGE" : "STUDIO_BUSY", report }, error.reason === "DUPLICATE" ? 409 : 429);
    return json({ error: "STORAGE_FAILED", report }, 503);
  }
}

/** The owner's inbox, or (?id=) one package to download. Anyone else gets 404, so the inbox's existence is not revealed. */
export async function GET(req: Request) {
  if (!isStudioOwner(req)) return json({ error: "NOT_FOUND" }, 404);
  if (!inboxReachable()) return json({ error: "PROPOSALS_NOT_OPEN" }, 503);
  const wants = new URL(req.url).searchParams.has("id");
  try {
    if (!wants) return json({ proposals: await listSubmissions() });
    const id = idOf(req);
    const pkg = id ? await readPackage(id) : null;
    if (!pkg) return json({ error: "NOT_FOUND" }, 404);
    return new Response(new Uint8Array(pkg.bytes), {
      headers: { ...headers, "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${pkg.name}"`, "X-Content-Type-Options": "nosniff" },
    });
  } catch { return json({ error: "STORAGE_FAILED" }, 503); }
}

/** The owner records the review: received, approved or rejected. */
export async function PATCH(req: Request) {
  if (!sameOrigin(req) || !isStudioOwner(req)) return json({ error: "NOT_FOUND" }, 404);
  const id = idOf(req);
  const status = new URL(req.url).searchParams.get("status") as ReviewStatus;
  if (!id || !REVIEW_STATUSES.includes(status)) return json({ error: "INVALID_ID" }, 400);
  if (!inboxReachable()) return json({ error: "PROPOSALS_NOT_OPEN" }, 503);
  try { await setReviewStatus(id, status); return new Response(null, { status: 204, headers }); } catch { return json({ error: "STORAGE_FAILED" }, 503); }
}

/** The owner deletes a submission once it is answered (data minimisation). */
export async function DELETE(req: Request) {
  if (!sameOrigin(req) || !isStudioOwner(req)) return json({ error: "NOT_FOUND" }, 404);
  const id = idOf(req);
  if (!id) return json({ error: "INVALID_ID" }, 400);
  if (!inboxReachable()) return json({ error: "PROPOSALS_NOT_OPEN" }, 503);
  try { await deleteProposal(id); return new Response(null, { status: 204, headers }); } catch { return json({ error: "STORAGE_FAILED" }, 503); }
}
