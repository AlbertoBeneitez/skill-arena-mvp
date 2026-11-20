/**
 * Bot simulator · Mine Grid through the server's hidden-information protocol (/api/hidden-game). The bot only sees what
 * a phone sees (the public projection: opened numbers, flags, lives), never the mines, and plays like a careful person:
 * it opens cells it can prove safe, flags cells it can prove are mines, and otherwise guesses the least risky cell.
 * It also probes the protocol: stale revisions, repeated commands, someone else's attempt, invented actions, leaks.
 * Needs the local server started with ALLOW_PERSISTED_HIDDEN_TRAINING=1 (scripts/sim/start-server.sh does it).
 */
import { Phone, uuid } from "./http";
import type { Report } from "./world";

type View = { cols: number; rows: number; startIndex: number; started: boolean; cells: (number | null)[]; flagged: boolean[]; lives: number; mines: number };
type Session = { attemptId: string; revision: number; status: "running" | "won" | "failed"; score: number; failure: string | null; view: View; verified: boolean };

const action = (kind: "OPEN" | "FLAG", i: number) => `${kind}_${String(i).padStart(3, "0")}`;
function neighbours(v: View, i: number) {
  const x = i % v.cols, y = Math.floor(i / v.cols), out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < v.cols && ny < v.rows) out.push(ny * v.cols + nx);
  }
  return out;
}

/** Next move from the public view only: proven safe → open; proven mine → flag; else the least risky hidden cell. */
export function nextMove(v: View, rnd: () => number): string | null {
  if (!v.started) return action("OPEN", v.startIndex);
  const hidden = (i: number) => v.cells[i] === null && !v.flagged[i];
  const risk = new Map<number, number>();
  for (let i = 0; i < v.cells.length; i++) {
    const n = v.cells[i];
    if (n === null || n < 0) continue;
    const around = neighbours(v, i), h = around.filter(hidden), f = around.filter((j) => v.flagged[j] || v.cells[j] === -1).length;
    if (!h.length) continue;
    if (n - f <= 0) return action("OPEN", h[0]);
    if (n - f === h.length) return action("FLAG", h[0]);
    for (const j of h) risk.set(j, Math.max(risk.get(j) ?? 0, (n - f) / h.length));
  }
  const all = v.cells.map((_, i) => i).filter(hidden);
  if (!all.length) return null;
  const known = all.filter((i) => risk.has(i)).sort((a, b) => risk.get(a)! - risk.get(b)!);
  const unknown = all.filter((i) => !risk.has(i));
  const hiddenCount = all.length, minesLeft = v.mines - v.flagged.filter(Boolean).length;
  const blind = hiddenCount ? minesLeft / hiddenCount : 1;
  if (known.length && (risk.get(known[0])! <= blind || !unknown.length)) return action("OPEN", known[0]);
  return action("OPEN", unknown[Math.floor(rnd() * unknown.length)] ?? known[0]);
}

async function command(p: Phone, s: Session, act: string, commandId = uuid()) {
  return p.post("/api/hidden-game/command", { attemptId: s.attemptId, commandId, expectedRevision: s.revision, action: act });
}

export async function mineBots(report: Report, n: number) {
  console.log("\n▶ Bots de Mine Grid (información oculta en el servidor)");
  const ready = await new Phone("Bot Mine probe").get("/api/hidden-game/start");
  if (!ready.body?.durable) {
    report.add({ id: "mine-not-durable", family: "mine", severity: "info", title: "Mine Grid: el servidor local no tiene la partida oculta activada", detail: "Arranca el servidor con ALLOW_PERSISTED_HIDDEN_TRAINING=1 (start-server.sh)." });
    return;
  }
  const results: { score: number; status: string; moves: number }[] = [];
  await Promise.all(Array.from({ length: n }, async (_, k) => {
    const p = new Phone(`Bot Mine ${k + 1}`);
    let seed = 1234 + k * 7919;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const start = await p.post("/api/hidden-game/start", { gameId: "mine-grid" });
    let s = start.body as Session;
    if (start.status !== 200 || !s?.attemptId) return report.add({ id: `mine-start-${start.status}`, family: "mine", severity: "alto", title: `Mine Grid: empezar falla (${start.status})`, detail: JSON.stringify(start.body).slice(0, 200) });
    // The public view must never carry the seed or where the mines are.
    const wire = JSON.stringify(start.body);
    if (/"(seed|mine_positions|mineCells|layout)"\s*:|"mines"\s*:\s*\[/i.test(wire)) report.add({ id: "mine-leak", family: "mine", severity: "crítico", title: "Mine Grid: la vista pública filtra la semilla o las minas", detail: wire.slice(0, 200) });
    let moves = 0;
    while (s.status === "running" && moves < 400) {
      const act = nextMove(s.view, rnd);
      if (!act) break;
      await new Promise((r) => setTimeout(r, 120 + rnd() * 380)); // a person's pace
      const r = await command(p, s, act);
      if (r.status !== 200) { report.add({ id: `mine-cmd-${r.status}-${r.body?.error}`, family: "mine", severity: "alto", title: `Mine Grid: una jugada válida se rechaza (${r.body?.error ?? r.status})`, detail: `${act} · ${JSON.stringify(r.body).slice(0, 160)}` }); break; }
      s = r.body as Session;
      moves++;
    }
    results.push({ score: s.score, status: s.status, moves });
    if (k === 0) {
      // Protocol probes with this bot's finished attempt and a fresh one.
      const fresh = (await p.post("/api/hidden-game/start", { gameId: "mine-grid" })).body as Session;
      const move = nextMove(fresh.view, rnd)!;
      const id = uuid();
      const first = await command(p, fresh, move, id);
      const again = await command(p, fresh, move, id);
      if (again.status !== 200 || again.body?.revision !== first.body?.revision) report.add({ id: "mine-idempotency", family: "mine", severity: "medio", title: "Mine Grid: repetir el mismo comando no devuelve lo mismo", detail: `${first.status}/${again.status}` });
      const stale = await command(p, fresh, nextMove(first.body.view, rnd) ?? move);
      if (stale.status !== 409) report.add({ id: "mine-stale", family: "mine", severity: "alto", title: "Mine Grid: se acepta una jugada con una revisión vieja", detail: `status ${stale.status}` });
      const bogus = await command(p, first.body, "OPEN_999");
      if (bogus.status !== 400) report.add({ id: "mine-bogus", family: "mine", severity: "alto", title: "Mine Grid: se acepta una casilla que no existe", detail: `status ${bogus.status}` });
      const thief = new Phone("Bot Mine ladrón");
      await thief.post("/api/hidden-game/start", { gameId: "mine-grid" });
      const stolen = await command(thief, first.body, nextMove(first.body.view, rnd) ?? move);
      if (stolen.status === 200) report.add({ id: "mine-foreign", family: "mine", severity: "crítico", title: "Mine Grid: otro jugador puede jugar mi partida", detail: "" });
      const xsite = new Phone("Bot Mine otra web", { origin: "https://evil.example" });
      for (const [k2, v2] of p.cookies) xsite.setCookie(k2, v2);
      const cross = await command(xsite, first.body, nextMove(first.body.view, rnd) ?? move);
      if (cross.status === 200) report.add({ id: "mine-csrf", family: "mine", severity: "alto", title: "Mine Grid: acepta jugadas desde otra web", detail: "" });
      report.count("probe-ok");
    }
    report.watch(p);
  }));
  report.count("mine-games", results.length);
  report.count("mine-won", results.filter((r) => r.status === "won").length);
  report.stats["mine-avg-score"] = Math.round(results.reduce((a, r) => a + r.score, 0) / Math.max(1, results.length));
  console.log(`  ${results.length} partidas: ${results.map((r) => `${r.status} ${r.score} (${r.moves})`).join(" · ")}`);
}
