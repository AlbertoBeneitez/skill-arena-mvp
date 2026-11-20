/**
 * Bot simulator · campaign. Usage (local server only, see docs/SIMULADOR_BOTS.md):
 *   node scripts/sim/run.mjs campaign [personas] [partidas] [competir] [trampas] [cuota]
 * Every bot has «Bot» in its name. Writes sim-reports/<run>/report.json and report.md.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { GAMES, lowerScoreWins, type GameMeta } from "@/lib/games";
import { Phone, mintSession, sleep, uuid } from "./http";
import { playMatch, type Style } from "./policies";
import { cores, newBot, pickGames, playableGames, playOnline, Report, type Bot } from "./world";

const secret = process.env.SIM_AUTH_SECRET ?? process.env.AUTH_SECRET ?? "";
if (secret.length < 32) throw new Error("SIM_AUTH_SECRET (the local server's AUTH_SECRET) is required");
const runId = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
const want = new Set(process.argv.slice(2));
const all = want.size === 0;
const report = new Report();
const STYLES: Style[] = ["novice", "medium", "expert"];
const MAX_MATCH_S = Number(process.env.SIM_MAX_MATCH_S ?? 150);
let nextIndex = 1;
const bot = (style: Style) => newBot(runId, nextIndex++, style, secret, report);

/** Games short enough to play in real time here (a long match is skipped after its local length is known). */
async function shortGames() {
  const list: GameMeta[] = [];
  for (const g of await playableGames()) {
    const core = (await cores()).get(`${g.id}@${g.version}`)!;
    const r = playMatch(core, `sim-length-${g.id}`, "medium", "len", lowerScoreWins(g), 1e9, 10_000);
    if (r.finalTick / core.tickRate <= MAX_MATCH_S) list.push(g);
    else report.count(`skip-long:${g.id}`);
  }
  return list;
}

// ───────────────────────────── 1 · Use the app like people ─────────────────────────────
async function personas() {
  console.log("\n▶ Bots que usan la app como personas");
  const bots = await Promise.all(STYLES.map((s) => bot(s)));
  for (const b of bots) {
    const p = b.phone;
    const checks: [string, () => Promise<{ status: number; body: any }>, (s: number, body: any) => boolean][] = [
      ["ver cartera", () => p.get("/api/wallet"), (s, x) => s === 200 && typeof x?.balanceMinor === "number"],
      ["cambiar euros por monedas", () => p.post("/api/wallet", { direction: "deposit", amount_minor: 1000, key: `dep${uuid().slice(0, 12)}` }), (s) => s === 200],
      ["retirar monedas", () => p.post("/api/wallet", { direction: "withdraw", amount_minor: 500, key: `wd${uuid().slice(0, 12)}` }), (s) => s === 200],
      ["cambiar avatar", () => p.patch("/api/account", { avatar: 7 }), (s) => s === 200],
      ["cambiar nombre", () => p.patch("/api/account", { name: `${b.name.slice(0, 15)} x` }), (s) => s === 200 || s === 409],
      ["contar partida", () => p.post("/api/account/plays", { add: "darts" }), (s) => s === 200],
      ["ver ranking global", () => p.get("/api/rankings/global?platform=mobile"), (s) => s === 200 || s === 503],
      ["ver grupos", () => p.get("/api/groups"), (s) => s === 200],
      ["ver disponibilidad", () => p.get("/api/verified-match/availability?stake_minor=0"), (s) => s === 200],
      ["ver historial", () => p.get("/api/verified-match/attempt"), (s) => s === 200],
      ["ver consentimiento", () => p.get("/api/consent"), (s) => s < 500],
      ["salud", () => p.get("/api/health"), (s, x) => s === 200 && x?.ok === true],
    ];
    for (const [label, call, ok] of checks) {
      const r = await call();
      if (!ok(r.status, r.body)) report.add({ id: `persona-${label}-${r.status}`, family: "personas", severity: r.status >= 500 ? "alto" : "medio", title: `«${label}» responde ${r.status}`, detail: JSON.stringify(r.body).slice(0, 300) });
    }
    report.watch(p);
  }
  report.count("bots:personas", bots.length);
}

// ───────────────────────────── 2 · Full matches ─────────────────────────────
async function partidas() {
  console.log("\n▶ Bots que juegan partidas completas");
  const games = await shortGames();
  const n = Number(process.env.SIM_PLAYERS ?? 12);
  const bots = await Promise.all(Array.from({ length: n }, (_, i) => bot(STYLES[i % 3])));
  await Promise.all(bots.map(async (b, i) => {
    for (const g of pickGames(games, Number(process.env.SIM_MATCHES ?? 2), i)) {
      await playOnline(b, g, report);
      report.count("matches");
    }
  }));
  // Pairing: same game and conditions put two bots on the same seed; the result must name a winner.
  const byStyle: Record<string, number[]> = {};
  for (const m of report.matches) if (m.verified && m.server !== null) (byStyle[`${m.game}:${m.style}`] ??= []).push(m.server);
  report.count("bots:partidas", n);
  return byStyle;
}

// ───────────────────────────── 3 · Compete with each other (groups) ─────────────────────────────
async function competir() {
  console.log("\n▶ Bots que compiten entre ellos en un grupo");
  const games = await shortGames();
  const members = await Promise.all(Array.from({ length: 4 }, (_, i) => bot(STYLES[i % 3])));
  const owner = members[0];
  const created = await owner.phone.post("/api/groups", { action: "create", name: `Bots ${runId.slice(-4)}` });
  const group = created.body?.group;
  if (!group) return report.add({ id: "group-create", family: "competir", severity: "alto", title: `Crear grupo falla (${created.status})`, detail: JSON.stringify(created.body) });
  for (const m of members.slice(1)) {
    const j = await m.phone.post("/api/groups", { action: "join", code: group.code });
    if (j.status !== 200) report.add({ id: `group-join-${j.status}`, family: "competir", severity: "alto", title: `Unirse con el código falla (${j.status})`, detail: JSON.stringify(j.body) });
  }
  const gameIds = pickGames(games, 2, 7).map((g) => g.id);
  const comp = await owner.phone.post("/api/groups", { action: "competition", mode: "group", groupIds: [group.id], config: { format: "all-vs-all", entryMinor: 0, gameIds, rounds: 2 } });
  const competitionId = comp.body?.competition?.id;
  if (!competitionId) return report.add({ id: "comp-create", family: "competir", severity: "alto", title: `Crear competición falla (${comp.status})`, detail: JSON.stringify(comp.body).slice(0, 300) });
  for (const m of members) await m.phone.post("/api/groups", { action: "enter", competitionId });
  const started = await owner.phone.post("/api/groups", { action: "start", competitionId });
  if (started.status !== 200) report.add({ id: `comp-start-${started.status}`, family: "competir", severity: "alto", title: `Empezar competición falla (${started.status})`, detail: JSON.stringify(started.body).slice(0, 300) });
  // Each bot plays its pending match of each matchday and reports the attempt; the server reads the score.
  for (let round = 1; round <= 3; round++) {
    const views = await Promise.all(members.map((m) => m.phone.get("/api/groups")));
    let pending = 0;
    await Promise.all(members.map(async (m, k) => {
      const c = (views[k].body?.competitions ?? []).find((x: any) => x.id === competitionId);
      const state = c?.state;
      if (!state || state.finished) return;
      const index = (state.matches as any[]).findIndex((x) => x.players.includes(m.accountId) && x.scores[m.accountId!] === undefined);
      if (index < 0) return;
      pending++;
      const game = GAMES.find((g) => g.id === state.matches[index].gameId)!;
      const played = await playOnline(m, game, report);
      if (!played.attemptId || !played.verified) return;
      const r = await m.phone.post("/api/groups", { action: "result", competitionId, matchIndex: index, attemptId: played.attemptId });
      if (r.status !== 200) report.add({ id: `comp-result-${r.status}-${r.body?.error}`, family: "competir", severity: "alto", title: `Anotar el resultado falla (${r.body?.error ?? r.status})`, detail: JSON.stringify(r.body).slice(0, 300) });
    }));
    if (!pending) break;
  }
  const final = (await owner.phone.get("/api/groups")).body?.competitions?.find((x: any) => x.id === competitionId);
  if (!final?.state?.finished) report.add({ id: "comp-not-finished", family: "competir", severity: "medio", title: "La competición entre bots no llega a terminar", detail: JSON.stringify(final?.state?.matches?.map((x: any) => x.scores) ?? null).slice(0, 400) });
  else report.count("competitions-finished");
  members.forEach((m) => report.watch(m.phone));
  report.count("bots:competir", members.length);
  return { competitionId, members, gameIds };
}

// ───────────────────────────── 4 · Cheaters ─────────────────────────────
async function trampas(group?: { competitionId: string; members: Bot[]; gameIds: string[] }) {
  console.log("\n▶ Bots tramposos");
  const games = await shortGames();
  const fast = games.slice().sort((a, b) => a.id.localeCompare(b.id))[0];
  const cheat = await bot("expert");
  const p = cheat.phone;
  const expect = (id: string, title: string, ok: boolean, sev: "crítico" | "alto" | "medio" | "bajo" | "info", detail: string) => {
    report.count(ok ? "probe-ok" : "probe-fail");
    if (!ok) report.add({ id, family: "trampas", severity: sev, title, detail });
  };

  // Identity
  const forged = new Phone("Bot falsificador"); forged.setCookie("ga_session", mintSession("bot-forged", "Bot Forged", "x".repeat(40)));
  expect("forged-cookie", "Una sesión firmada con otra clave entra", (await forged.get("/api/account")).status === 401, "crítico", "");
  const expired = new Phone("Bot caducado"); expired.setCookie("ga_session", mintSession(`bot-${runId}-exp`, "Bot Exp", secret, -10));
  expect("expired-cookie", "Una sesión caducada entra", (await expired.get("/api/account")).status === 401, "alto", "");
  const homoglyph = new Phone("Bot homoglifo"); homoglyph.setCookie("ga_session", mintSession(`bot-${runId}-hg`, "Bot HG", secret));
  const hg = await homoglyph.post("/api/account", { name: "Аdmin", avatar: 1, platform: "mobile" }); // Cyrillic А
  expect("homoglyph-name", "Se puede registrar «Аdmin» con una letra cirílica (suplantación)", hg.status !== 201, "bajo", `status ${hg.status}`);

  // CSRF and transport
  const xsite = new Phone("Bot otro sitio", { origin: "https://evil.example" }); xsite.cookies.set("ga_session", p.cookies.get("ga_session")!);
  expect("csrf-wallet", "La cartera acepta peticiones de otra web", (await xsite.post("/api/wallet", { direction: "deposit", amount_minor: 1000, key: "csrf12345678" })).status === 403, "alto", "");
  const big = await p.call("POST", "/api/verified-match/verify", JSON.stringify({ attempt_id: "x", inputs: "A".repeat(600_000), final_tick: 1 }));
  expect("oversized", "Un cuerpo de 600 KB no se rechaza", big.status >= 400 && big.status < 500, "medio", `status ${big.status}`);

  // Start contract
  const extra = await p.post("/api/verified-match/start", { game_id: fast.id, stake_minor: 0, start_key: uuid(), seed: "chosen" });
  expect("start-extra-seed", "El cliente puede elegir la semilla", extra.status === 400, "crítico", JSON.stringify(extra.body));

  // Tampered matches (each on its own attempt)
  const tamper = async (label: string, f: (inputs: any[], ft: number) => { inputs: any[]; finalTick: number }, sev: "crítico" | "alto") => {
    const r = await playOnline(cheat, fast, report, { tamper: f });
    if (!r.attemptId) return report.add({ id: `tamper-${label}-inconclusive`, family: "trampas", severity: "info", title: `Prueba «${label}» sin concluir: no se pudo empezar la partida`, detail: JSON.stringify(r.body).slice(0, 160) });
    expect(`tamper-${label}`, `Partida manipulada aceptada: ${label}`, !r.verified, sev, JSON.stringify(r.body).slice(0, 200));
    // A malformed record is refused without closing the attempt (the phone may still send the right one): close it.
    await p.post("/api/verified-match/attempt", { attempt_id: r.attemptId, action: "abandon" });
  };
  await tamper("acción inventada", (i, t) => ({ inputs: [...i.slice(0, 1).map((x) => ({ ...x, action: "WIN_NOW" })), ...i.slice(1)], finalTick: t }), "crítico");
  await tamper("entradas desordenadas", (i, t) => ({ inputs: i.length > 2 ? [i[1], i[0], ...i.slice(2)].map((x, k) => ({ ...x, seq: k })) : [{ seq: 0, tick: 5, action: i[0]?.action ?? "X" }, { seq: 1, tick: 2, action: i[0]?.action ?? "X" }], finalTick: t }), "crítico");
  await tamper("final adelantado", (i, t) => ({ inputs: i.filter((x) => x.tick < t / 2), finalTick: Math.floor(t / 2) }), "alto");

  // Faster than real time
  const s = await p.post("/api/verified-match/start", { game_id: fast.id, stake_minor: 0, start_key: uuid() });
  if (s.body?.ticket) {
    const core = (await cores()).get(`${s.body.manifest.game_id}@${s.body.manifest.game_version}`)!;
    const r = playMatch(core, s.body.manifest.seed, "expert", "fast", lowerScoreWins(fast), 1e9, 10_000);
    const v = await p.post("/api/verified-match/verify", { attempt_id: s.body.ticket.attempt_id, inputs: r.inputs, final_tick: r.finalTick });
    expect("faster-than-clock", "Se acepta una partida enviada antes de que dé tiempo a jugarla", v.body?.verified !== true, "crítico", JSON.stringify(v.body).slice(0, 200));
    // Another phone submitting my attempt
    const thief = await bot("novice");
    const t = await thief.phone.post("/api/verified-match/verify", { attempt_id: s.body.ticket.attempt_id, inputs: r.inputs, final_tick: r.finalTick });
    expect("foreign-attempt", "Otro jugador puede enviar mi partida", t.body?.verified !== true && t.status !== 200, "crítico", `status ${t.status}`);
    await p.post("/api/verified-match/attempt", { attempt_id: s.body.ticket.attempt_id, action: "abandon" });
  }

  // Quota per cookie: 20 starts a day per "actor"; a new cookie is a new actor.
  let quotaHit = 0;
  const statuses: string[] = [];
  for (let i = 0; i < 25; i++) {
    const st = await p.post("/api/verified-match/start", { game_id: fast.id, stake_minor: 0, start_key: uuid() });
    statuses.push(`${st.status}${st.body?.error ? ":" + st.body.error : ""}`);
    if (st.status === 429) { quotaHit = i + 1; break; }
    if (st.body?.ticket) await p.post("/api/verified-match/attempt", { attempt_id: st.body.ticket.attempt_id, action: "abandon" });
  }
  expect("quota-exists", "No hay límite diario de partidas por jugador", quotaHit > 0, "medio", statuses.join(" "));
  p.cookies.delete("arena_training_actor"); for (const k of [...p.cookies.keys()]) if (k !== "ga_session") p.cookies.delete(k);
  await p.get("/api/verified-match/session");
  const after = await p.post("/api/verified-match/start", { game_id: fast.id, stake_minor: 0, start_key: uuid() });
  if (quotaHit > 0) expect("quota-cookie-reset", "El límite diario se salta pidiendo otra cookie (misma cuenta)", after.status === 429, "alto", `Tras ${quotaHit - 1} partidas el servidor dice TRAINING_QUOTA; con una cookie nueva, la misma cuenta empieza otra (status ${after.status}). El límite cuenta cookies, no cuentas.`);
  if (after.body?.ticket) await p.post("/api/verified-match/attempt", { attempt_id: after.body.ticket.attempt_id, action: "abandon" });

  // Seed known in advance → perfect lookahead (accepted: it is a replay-legal match).
  const known = await bot("expert");
  const novice = await bot("novice");
  const g = games.find((x) => x.id === "pinball") ?? fast;
  const [e, n] = await Promise.all([playOnline(known, g, report), playOnline(novice, g, report)]);
  if (e.verified && n.verified)
    report.add({ id: "seed-lookahead", family: "trampas", severity: "crítico", title: "Un bot que conoce la semilla juega con ventaja y el servidor lo acepta", detail: `${g.name}: experto con anticipación ${e.serverScore} puntos frente a novato ${n.serverScore}. La semilla llega al móvil al empezar; cualquier programa puede probar jugadas en una copia del juego antes de hacerlas.` });

  // Groups: best of N — play several attempts of the round's game and report only the best one.
  if (group) {
    const m = group.members[1];
    const view = (await m.phone.get("/api/groups")).body?.competitions?.find((x: any) => x.id === group.competitionId);
    const gameId = view?.state?.matches?.[0]?.gameId as string | undefined;
    if (gameId) {
      const gm = GAMES.find((x) => x.id === gameId)!;
      const tries = await Promise.all([0, 1].map(() => playOnline(m, gm, report)));
      const ok = tries.filter((x) => x.verified);
      if (ok.length >= 2) report.add({ id: "group-best-of-n", family: "trampas", severity: "alto", title: "En grupos se puede jugar varias veces y anotar solo la mejor partida", detail: `El servidor acepta cualquier partida verificada del juego de la jornada empezada después de la competición; no exige que sea la primera ni una sola. Puntuaciones obtenidas: ${ok.map((x) => x.serverScore).join(", ")}.` });
    }
  }
  report.watch(p);
}

// ───────────────────────────── 5 · Platform-wide quota (run last: it blocks new matches) ─────────────────────────────
async function cuota() {
  console.log("\n▶ Bots que agotan el cupo global de partidas");
  const games = await shortGames();
  const g = games[0];
  let total = 0, blocked = false;
  for (let actor = 0; actor < 110 && !blocked; actor++) {
    const ph = new Phone(`Bot cupo ${actor}`);
    await ph.get("/api/verified-match/session");
    for (let i = 0; i < 20; i++) {
      const st = await ph.post("/api/verified-match/start", { game_id: g.id, stake_minor: 0, start_key: uuid() });
      if (st.status === 429 && i === 0) { blocked = true; break; }
      if (st.status !== 200) break;
      total++;
      await ph.post("/api/verified-match/attempt", { attempt_id: st.body.ticket.attempt_id, action: "abandon" });
    }
    report.watch(ph);
  }
  const honest = await bot("medium");
  const st = await honest.phone.post("/api/verified-match/start", { game_id: g.id, stake_minor: 0, start_key: uuid() });
  if (st.status === 429)
    report.add({ id: "global-cap-dos", family: "trampas", severity: "crítico", title: "Unos pocos bots sin cuenta bloquean las partidas de todo el mundo", detail: `Con ${total} partidas empezadas y abandonadas desde cookies nuevas, el servidor responde TRAINING_QUOTA a cualquier jugador nuevo: el tope de 2000 partidas es global y no caduca.` });
  report.count("quota-starts", total);
}

// ───────────────────────────── 4b · Groups: best of N (quick, on the shortest game) ─────────────────────────────
async function mejorDeN() {
  console.log("\n▶ Grupo: jugar varias veces y anotar la mejor");
  const g = GAMES.find((x) => x.id === "tower-drop")!;
  const [a, b] = await Promise.all([bot("medium"), bot("novice")]);
  const group = (await a.phone.post("/api/groups", { action: "create", name: `Mejor ${runId.slice(-4)}` })).body?.group;
  await b.phone.post("/api/groups", { action: "join", code: group?.code });
  const competitionId = (await a.phone.post("/api/groups", { action: "competition", mode: "group", groupIds: [group?.id], config: { format: "all-vs-all", entryMinor: 0, gameIds: [g.id], rounds: 1 } })).body?.competition?.id;
  for (const m of [a, b]) await m.phone.post("/api/groups", { action: "enter", competitionId });
  await a.phone.post("/api/groups", { action: "start", competitionId });
  const tries: { id: string; score: number }[] = [];
  for (let i = 0; i < 4; i++) { const r = await playOnline(a, g, report); if (r.verified && r.attemptId) tries.push({ id: r.attemptId, score: r.serverScore! }); }
  // The best one that is NOT the first: proves the server takes any attempt, not the one played for the matchday.
  const best = tries.slice(1).sort((x, y) => y.score - x.score)[0];
  const state = (await a.phone.get("/api/groups")).body?.competitions?.find((x: any) => x.id === competitionId)?.state;
  const index = (state?.matches ?? []).findIndex((m: any) => m.players.includes(a.accountId));
  const rec = best && index >= 0 ? await a.phone.post("/api/groups", { action: "result", competitionId, matchIndex: index, attemptId: best.id }) : null;
  if (rec?.status === 200 && tries.length >= 2)
    report.add({ id: "group-best-of-n", family: "trampas", severity: "alto", title: "En grupos se puede jugar varias veces y anotar solo la mejor partida", detail: `${g.name}: ${tries.length} partidas seguidas (${tries.map((t) => t.score).join(", ")}); el servidor acepta como resultado de la jornada la de ${best.score}, que no es la primera. Puede elegir la mejor de hasta 20 al día.` });
  else report.add({ id: "group-best-of-n-blocked", family: "trampas", severity: "info", title: "Anotar la mejor de varias partidas: rechazado", detail: `status ${rec?.status} ${JSON.stringify(rec?.body ?? null).slice(0, 120)}` });
  report.watch(a.phone);
}

// ───────────────────────────── run ─────────────────────────────
const t0 = Date.now();
if (all || want.has("personas")) await personas();
if (all || want.has("partidas")) await partidas();
const group = all || want.has("competir") ? await competir() : undefined;
if (all || want.has("trampas")) await trampas(group || undefined);
if (all || want.has("mejor")) await mejorDeN();
if (want.has("cuota")) await cuota();

for (const e of report.errors) report.add({ id: `5xx-${e.path}-${e.status}`, family: "errores", severity: "alto", title: `Error de servidor ${e.status} en ${e.path}`, detail: JSON.stringify(e.body).slice(0, 300) });
const dir = `sim-reports/${runId}`;
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/report.json`, JSON.stringify({ runId, seconds: Math.round((Date.now() - t0) / 1000), stats: report.stats, findings: report.findings, matches: report.matches, errors: report.errors }, null, 2));
const order = ["crítico", "alto", "medio", "bajo", "info"];
const md = [`# Simulación de bots ${runId}`, "", `Duración: ${Math.round((Date.now() - t0) / 1000)} s · ${JSON.stringify(report.stats)}`, "", "## Hallazgos", "",
  ...report.findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity)).map((f) => `- **[${f.severity}] ${f.title}** (${f.family}). ${f.detail}`), "", "## Partidas", "",
  "| Bot | Juego | Estilo | Local | Servidor | Verificada | s |", "|---|---|---|---|---|---|---|",
  ...report.matches.map((m) => `| ${m.bot} | ${m.game} | ${m.style} | ${m.local} | ${m.server ?? "—"} | ${m.verified ? "sí" : `no (${m.error})`} | ${m.seconds} |`)].join("\n");
writeFileSync(`${dir}/report.md`, md);
console.log(`\nInforme: ${dir}/report.md`);
await sleep(10);
