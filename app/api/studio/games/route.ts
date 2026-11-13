import { listPublished, proposalsOpen, readPublishedCover, readPublishedPackage } from "@/lib/server/studioProposals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * v147 · Games published by studios (approved in the owner's inbox), for everyone, in training only.
 * GET → the list; GET ?id=&file=package → the package (.zip); GET ?id=&file=cover → its cover image.
 * Packages are immutable once stored (the SHA-256 in the list lets the player check what it runs), so the files can be
 * cached; the list changes when the owner approves or rejects, so it is cached only briefly.
 */
export async function GET(req: Request) {
  const url = new URL(req.url), id = url.searchParams.get("id"), file = url.searchParams.get("file");
  if (!proposalsOpen()) return Response.json({ games: [] }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
  try {
    if (!id) return Response.json({ games: await listPublished() }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=120" } });
    if (!UUID.test(id) || (file !== "package" && file !== "cover")) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    const immutable = { "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" };
    if (file === "cover") {
      const cover = await readPublishedCover(id);
      return cover ? new Response(new Uint8Array(cover.bytes), { headers: { ...immutable, "Content-Type": cover.type } }) : Response.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    const pkg = await readPublishedPackage(id);
    return pkg ? new Response(new Uint8Array(pkg), { headers: { ...immutable, "Content-Type": "application/zip" } }) : Response.json({ error: "NOT_FOUND" }, { status: 404 });
  } catch {
    return Response.json({ error: "STORAGE_FAILED" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
