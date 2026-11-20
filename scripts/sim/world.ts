/**
 * Bot simulator · shared pieces: bot identities («Bot …» names), the finding log and the match routine every bot uses.
 */
import { GAMES, lowerScoreWins, type GameMeta } from "@/lib/games";
import { loadCores, type AnyCore } from "./cores";
import { Phone, mintSession, sleep, uuid } from "./http";
import type { Style } from "./policies";
import { playInWorker } from "./pool";

export type Severity = "crítico" | "alto" | "medio" | "bajo" | "info";
export type Finding = { id: string; family: string; severity: Severity; title: string; detail: string; evidence?: unknown };

export class Report {
  readonly findings: Finding[] = [];
  readonly stats: Record<string, number> = {};
  readonly matches: { bot: string; game: string; style: Style; local: number; server: number | null; verified: boolean; error?: string; seconds: number }[] = [];
  readonly errors: { bot: string; path: string; status: number; body: unknown }[] = [];
  add(f: Finding) { if (!this.findings.some((x) => x.id === f.id)) this.findings.push(f); console.log(`  [${f.severity}] ${f.title}${f.detail ? " — " + f.detail.slice(0, 220) : ""}`); }
  count(key: string, n = 1) { this.stats[key] = (this.stats[key] ?? 0) + n; }
  /** Server errors (5xx) and dropped connections are always bugs, whoever caused them. */
  watch(phone: Phone) {
    for (const r of phone.log.splice(0)) {
      this.count("requests");
      if (r.status >= 500 || r.status === 0) this.errors.push({ bot: phone.label, path: `${r.method} ${r.path}`, status: r.status, body: r.body });
    }
  }
}

const NAMES = ["Nova", "Orion", "Vega", "Lyra", "Atlas", "Rigel", "Sirio", "Kepler", "Halley", "Draco", "Cygnus", "Altair", "Deneb", "Mira", "Polaris", "Antares"];
/** «Bot» + a star + the run and bot number, unique across runs (names are unique on the server), ≤ 18 characters. */
export const botName = (i: number, run = "") => `Bot ${NAMES[i % NAMES.length].slice(0, 5)} ${run.slice(-4)}${i}`.slice(0, 18);

export type Bot = { phone: Phone; name: string; style: Style; accountId: string | null; index: number };

export async function newBot(runId: string, index: number, style: Style, secret: string, report: Report): Promise<Bot> {
  const name = botName(index, runId);
  const phone = new Phone(name);
  phone.setCookie("ga_session", mintSession(`bot-${runId}-${index}`, name, secret));
  const created = await phone.post("/api/account", { name, avatar: 1 + (index % 16), platform: "mobile" });
  if (created.status !== 201 && created.status !== 409) report.add({ id: `account-create-${created.status}`, family: "personas", severity: "alto", title: `Crear cuenta devuelve ${created.status}`, detail: JSON.stringify(created.body) });
  const me = await phone.get("/api/account");
  await phone.get("/api/verified-match/session");
  report.watch(phone);
  return { phone, name, style, accountId: me.body?.account?.id ?? null, index };
}

let coresCache: Map<string, AnyCore> | null = null;
export async function cores() { return (coresCache ??= await loadCores()); }
export const playableGames = async () => {
  const c = await cores();
  return GAMES.filter((g) => g.enabled && g.competition.verification === "server-replay" && c.has(`${g.id}@${g.version}`));
};

export type Played = { attemptId: string | null; verified: boolean; serverScore: number | null; localScore: number; error?: string; body?: any };

/** One full match through the real HTTP flow: start, play on the core, heartbeats in real time, submit, read result. */
export async function playOnline(bot: Bot, game: GameMeta, report: Report, opts: { stake?: number; maxSeconds?: number; tamper?: (inputs: any[], finalTick: number) => { inputs: any[]; finalTick: number } } = {}): Promise<Played> {
  const t0 = Date.now();
  const start = await bot.phone.post("/api/verified-match/start", { game_id: game.id, stake_minor: opts.stake ?? 0, start_key: uuid() });
  if (start.status !== 200 || !start.body?.manifest) {
    report.watch(bot.phone);
    return { attemptId: null, verified: false, serverScore: null, localScore: 0, error: `start ${start.status} ${start.body?.error ?? ""}`, body: start.body };
  }
  const { manifest, ticket } = start.body;
  const core = (await cores()).get(`${manifest.game_id}@${manifest.game_version}`)!;
  // Keep the attempt alive while the bot thinks (a phone sends heartbeats while the player plays).
  let thinking = true;
  const keepAlive = (async () => { while (thinking) { await sleep(4000); if (thinking) await bot.phone.post("/api/verified-match/attempt", { attempt_id: ticket.attempt_id, action: "heartbeat" }); } })();
  const played = await playInWorker({ key: `${manifest.game_id}@${manifest.game_version}`, seed: manifest.seed, style: bot.style, botSeed: `${bot.name}:${ticket.attempt_id}`, lowerWins: lowerScoreWins(game), target: manifest.competition.target_score, budgetMs: 30_000 });
  thinking = false;
  await keepAlive;
  let { inputs, finalTick } = played;
  if (opts.tamper) ({ inputs, finalTick } = opts.tamper(inputs, finalTick));
  // Real time: the server refuses a match faster than the clock. Keep the attempt alive like the app does (lease).
  const seconds = Math.min(finalTick / core.tickRate, opts.maxSeconds ?? Infinity);
  const until = t0 + seconds * 1000 + 300;
  while (Date.now() < until) {
    await sleep(Math.min(4000, Math.max(0, until - Date.now())));
    if (Date.now() < until) await bot.phone.post("/api/verified-match/attempt", { attempt_id: ticket.attempt_id, action: "heartbeat" });
  }
  let res = await bot.phone.post("/api/verified-match/verify", { attempt_id: ticket.attempt_id, inputs, final_tick: finalTick });
  for (let i = 0; i < 10 && res.status === 202; i++) { await sleep(800); res = await bot.phone.post("/api/verified-match/verify", { attempt_id: ticket.attempt_id, inputs, final_tick: finalTick }); }
  report.watch(bot.phone);
  const verified = res.body?.verified === true;
  const serverScore = typeof res.body?.score === "number" ? res.body.score : null;
  report.matches.push({ bot: bot.name, game: game.id, style: bot.style, local: played.score, server: serverScore, verified, error: verified ? undefined : `${res.status} ${res.body?.error ?? ""}`, seconds: Math.round((Date.now() - t0) / 1000) });
  if (verified && !opts.tamper && serverScore !== played.score)
    report.add({ id: `score-mismatch-${game.id}`, family: "partidas", severity: "alto", title: `${game.name}: el servidor puntúa distinto que el núcleo`, detail: `local ${played.score} · servidor ${serverScore}` });
  if (!verified && !opts.tamper)
    report.add({ id: `honest-rejected-${game.id}-${res.body?.error}`, family: "partidas", severity: "alto", title: `${game.name}: una partida honesta es rechazada (${res.body?.error ?? res.status})`, detail: JSON.stringify(res.body).slice(0, 400) });
  return { attemptId: ticket.attempt_id, verified, serverScore, localScore: played.score, error: verified ? undefined : res.body?.error, body: res.body };
}

export const pickGames = (all: GameMeta[], n: number, seed: number) => all.map((g, i) => ({ g, k: (i * 2654435761 + seed * 40503) % 1000 })).sort((a, b) => a.k - b.k).slice(0, n).map((x) => x.g);
