/** v185 · Studio upload limits against local PostgreSQL: daily cap, stored-bytes cap, duplicates, parallel uploads. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { STUDIO_LIMITS, StudioQuotaError, saveSubmission } from "../lib/server/studioProposals";
import type { Manifest, Report } from "../lib/studio/package";

const connectionString = process.env.TEST_DATABASE_URL;
assert.ok(connectionString);
const url = new URL(connectionString);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
assert.equal(url.pathname, "/skill_arena_test");
const schema = `qa_studio_${randomBytes(8).toString("hex")}`,
  admin = new Pool({ connectionString, max: 1 }),
  pool = new Pool({ connectionString, max: 8, options: `-c search_path=${schema}` });
const sub = { studio: "Studio QA", contact: "qa@example.com", terms: "t1", consent: "c1" };
const manifest = { name: "QA game", shelf: "dynamic", description: "A game used only by the quota test." } as unknown as Manifest;
const report = { ok: true, checks: [] } as unknown as Report;
const pkg = (n: number, size = 64) => { const b = randomBytes(size); b[0] = n & 255; b[1] = n >> 8; return new Uint8Array(b); };
const reason = async (p: Promise<unknown>) => { try { await p; return "ok"; } catch (e) { if (e instanceof StudioQuotaError) return e.reason; throw e; } };
let created = false;
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  created = true;
  for (const f of ["004-studio-proposals.sql", "005-studio-packages.sql"]) await pool.query(await readFile(`db/migrations/${f}`, "utf8"));
  const first = pkg(0);
  assert.equal(await reason(saveSubmission(sub, manifest, report, first, pool)), "ok");
  assert.equal(await reason(saveSubmission(sub, manifest, report, first, pool)), "DUPLICATE");
  // Parallel uploads cannot pass the daily cap together.
  const results = await Promise.all(Array.from({ length: STUDIO_LIMITS.perDay + 5 }, (_, i) => reason(saveSubmission(sub, manifest, report, pkg(i + 1), pool))));
  assert.equal(results.filter((r) => r === "ok").length, STUDIO_LIMITS.perDay - 1);
  assert.equal(results.filter((r) => r === "DAILY").length, 6);
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM studio_game_proposals");
  assert.equal(rows[0].n, STUDIO_LIMITS.perDay);
  // Stored-bytes cap (small limits here; the column itself refuses packages over 4 MB): yesterday's uploads no
  // longer count per day, but their bytes still count.
  await pool.query("UPDATE studio_game_proposals SET created_at = now() - interval '2 days'");
  const { rows: used } = await pool.query("SELECT sum(octet_length(package))::int AS b FROM studio_game_proposals");
  const small = { perDay: STUDIO_LIMITS.perDay, storedBytes: used[0].b + 100 };
  assert.equal(await reason(saveSubmission(sub, manifest, report, pkg(900, 4096), pool, small)), "STORAGE");
  assert.equal(await reason(saveSubmission(sub, manifest, report, pkg(901, 16), pool, small)), "ok");
  assert.equal(await reason(saveSubmission(sub, manifest, report, pkg(902, 128), pool, small)), "STORAGE");
  console.log("Studio quotas: duplicate package, daily cap under parallel uploads, stored-bytes cap, no sender data stored");
} finally {
  await pool.end();
  if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
