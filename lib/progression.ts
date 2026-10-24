/**
 * Player-experience layer: XP, levels, stars, streak, risk picker, daily missions and reward chest.
 * Presentation + local persistence ONLY. Nothing here touches verified cores, scoring or the attempt flow.
 * Every function is pure; randomness comes from a seed passed in by the caller.
 */
import { createRng } from "./deterministic/seeded";

export type RiskId = "calm" | "bold" | "legend";
export const RISKS: readonly { id: RiskId; name: string; multiplier: number; need: string }[] = [
  { id: "calm", name: "Tranquilo", multiplier: 1, need: "Solo juega" },
  { id: "bold", name: "Atrevido", multiplier: 2, need: "Alcanza el objetivo" },
  { id: "legend", name: "Leyenda", multiplier: 3, need: "Objetivo + récord personal" },
];

export const LEVEL_NAMES = ["Cadete", "Piloto", "Navegante", "Capitán", "Comandante", "Almirante", "Leyenda estelar"] as const;
export const COSMETICS = {
  frames: [
    { id: "frame-cyan", name: "Marco cian", color: "#58e0e8" },
    { id: "frame-gold", name: "Marco oro", color: "#ffd04a" },
    { id: "frame-magenta", name: "Marco magenta", color: "#ff5fc4" },
    { id: "frame-lime", name: "Marco lima", color: "#9bf05b" },
  ],
  themes: [
    { id: "theme-nebula", name: "Nebulosa", accent: "#b88cff" },
    { id: "theme-solar", name: "Solar", accent: "#ffb14a" },
    { id: "theme-aurora", name: "Aurora", accent: "#4af0b0" },
  ],
} as const;
const ALL_COSMETICS = [...COSMETICS.frames.map((c) => c.id), ...COSMETICS.themes.map((c) => c.id)] as readonly string[];

export type MissionId = "variety3" | "wins2" | "legend1";
export type MissionState = { id: MissionId; progress: number; goal: number; claimed: boolean; reward: number };

export type ProgressState = {
  v: 1;
  xp: number;
  stars: number;
  streak: number;
  lastDay: string;
  bests: Record<string, number>;
  unlocked: string[];
  frame: string;
  theme: string;
  day: string;
  playedToday: string[];
  missions: MissionState[];
  runs: number;
};

const MISSION_DEFS: Record<MissionId, { goal: number; reward: number; label: string }> = {
  variety3: { goal: 3, reward: 40, label: "Juega 3 juegos distintos" },
  wins2: { goal: 2, reward: 60, label: "Alcanza el objetivo 2 veces" },
  legend1: { goal: 1, reward: 80, label: "Juega con riesgo Leyenda" },
};
export const missionLabel = (id: MissionId) => MISSION_DEFS[id].label;

export const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function freshMissions(): MissionState[] {
  return (Object.keys(MISSION_DEFS) as MissionId[]).map((id) => ({ id, progress: 0, goal: MISSION_DEFS[id].goal, claimed: false, reward: MISSION_DEFS[id].reward }));
}

export function initialProgress(today: string): ProgressState {
  return { v: 1, xp: 0, stars: 0, streak: 0, lastDay: "", bests: {}, unlocked: [], frame: "", theme: "", day: today, playedToday: [], missions: freshMissions(), runs: 0 };
}

const dayNumber = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
};

/** Rolls the day: resets missions, keeps/breaks the streak. Pure. */
export function rollDay(state: ProgressState, today: string): ProgressState {
  if (state.day === today) return state;
  const gap = state.lastDay ? dayNumber(today) - dayNumber(state.lastDay) : 0;
  return { ...state, day: today, playedToday: [], missions: freshMissions(), streak: gap > 1 ? 0 : state.streak };
}

/** XP needed to go from level n to n+1 (n >= 1). */
export const xpToNext = (level: number) => 80 + (level - 1) * 45;
export function levelOf(xp: number) {
  let level = 1;
  let rest = Math.max(0, Math.floor(xp));
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  return { level, into: rest, need: xpToNext(level), name: LEVEL_NAMES[Math.min(LEVEL_NAMES.length - 1, Math.floor((level - 1) / 3))] };
}

export type RunInput = { gameId: string; score: number; won: boolean; risk: RiskId; ranked?: boolean };
export type RunOutcome = {
  risk: RiskId;
  multiplier: number;
  met: boolean;
  newBest: boolean;
  baseXp: number;
  xpGain: number;
  starsGain: number;
  previousBest: number;
  streakBonus: number;
};

/** Risk rules: calm always pays x1; bold/legend pay x2/x3 only when their condition holds, otherwise a reduced reward. */
export function evaluateRun(state: ProgressState, run: RunInput): RunOutcome {
  const previousBest = state.bests[run.gameId] ?? 0;
  const newBest = run.score > previousBest;
  const baseXp = 12 + (run.won ? 18 : 0) + (newBest && previousBest > 0 ? 10 : 0);
  const risk = RISKS.find((r) => r.id === run.risk) ?? RISKS[0];
  const met = risk.id === "calm" ? true : risk.id === "bold" ? run.won : run.won && newBest && previousBest > 0;
  const multiplier = met ? risk.multiplier : 0.5;
  const streakBonus = Math.min(10, state.streak) * 2;
  const xpGain = Math.round(baseXp * multiplier) + (met ? streakBonus : 0);
  const starsGain = Math.round((3 + (run.won ? 4 : 0)) * (met ? risk.multiplier : 0.5));
  return { risk: risk.id, multiplier, met, newBest, baseXp, xpGain, starsGain, previousBest, streakBonus };
}

export type RunApplied = { state: ProgressState; outcome: RunOutcome; levelBefore: number; levelAfter: number; leveledUp: boolean; missionsDone: MissionId[] };

export function applyRun(state: ProgressState, run: RunInput, today: string): RunApplied {
  const rolled = rollDay(state, today);
  const outcome = evaluateRun(rolled, run);
  const levelBefore = levelOf(rolled.xp).level;
  const playedToday = rolled.playedToday.includes(run.gameId) ? rolled.playedToday : [...rolled.playedToday, run.gameId];
  const firstToday = rolled.lastDay !== today;
  const streak = firstToday ? (rolled.lastDay && dayNumber(today) - dayNumber(rolled.lastDay) === 1 ? rolled.streak + 1 : 1) : rolled.streak;
  const missions = rolled.missions.map((m) => {
    let progress = m.progress;
    if (m.id === "variety3") progress = Math.min(m.goal, playedToday.length);
    if (m.id === "wins2" && run.won) progress = Math.min(m.goal, m.progress + 1);
    if (m.id === "legend1" && run.risk === "legend") progress = Math.min(m.goal, m.progress + 1);
    return { ...m, progress };
  });
  const missionsDone = missions.filter((m, i) => m.progress >= m.goal && rolled.missions[i].progress < m.goal).map((m) => m.id);
  const next: ProgressState = {
    ...rolled,
    xp: rolled.xp + outcome.xpGain,
    stars: rolled.stars + outcome.starsGain,
    streak,
    lastDay: today,
    bests: outcome.newBest ? { ...rolled.bests, [run.gameId]: run.score } : rolled.bests,
    playedToday,
    missions,
    runs: rolled.runs + 1,
  };
  const levelAfter = levelOf(next.xp).level;
  return { state: next, outcome, levelBefore, levelAfter, leveledUp: levelAfter > levelBefore, missionsDone };
}

export function claimMission(state: ProgressState, id: MissionId): ProgressState {
  const m = state.missions.find((x) => x.id === id);
  if (!m || m.claimed || m.progress < m.goal) return state;
  return { ...state, stars: state.stars + m.reward, xp: state.xp + Math.round(m.reward / 2), missions: state.missions.map((x) => (x.id === id ? { ...x, claimed: true } : x)) };
}

export type ChestCard = { kind: "stars" | "xp" | "cosmetic" | "dust"; amount: number; cosmeticId?: string; label: string; icon: string };

/** Three face-down cards. Odds depend on whether the risk condition was met; deterministic for a given seed. */
export function rollChest(seed: string, unlocked: readonly string[], met: boolean): ChestCard[] {
  const rng = createRng(`chest|${seed}`);
  const locked = ALL_COSMETICS.filter((id) => !unlocked.includes(id));
  const cards: ChestCard[] = [];
  for (let i = 0; i < 3; i++) {
    const r = rng.nextFloat();
    const dustAt = met ? 0.15 : 0.45;
    const starsAt = dustAt + (met ? 0.4 : 0.3);
    const xpAt = starsAt + 0.25;
    if (r < dustAt) cards.push({ kind: "dust", amount: 2, label: "Polvo estelar", icon: "✨" });
    else if (r < starsAt) {
      const amount = [15, 25, 40][rng.nextInt(3)];
      cards.push({ kind: "stars", amount, label: `${amount} estrellas`, icon: "⭐" });
    } else if (r < xpAt) {
      const amount = [20, 35][rng.nextInt(2)];
      cards.push({ kind: "xp", amount, label: `+${amount} XP`, icon: "⚡" });
    } else if (locked.length) {
      const id = locked[rng.nextInt(locked.length)];
      const name = [...COSMETICS.frames, ...COSMETICS.themes].find((c) => c.id === id)?.name ?? id;
      if (cards.some((c) => c.cosmeticId === id)) cards.push({ kind: "stars", amount: 25, label: "25 estrellas", icon: "⭐" });
      else cards.push({ kind: "cosmetic", amount: 0, cosmeticId: id, label: name, icon: id.startsWith("frame") ? "🖼" : "🎨" });
    } else cards.push({ kind: "stars", amount: 30, label: "30 estrellas", icon: "⭐" });
  }
  return cards;
}

export function applyChest(state: ProgressState, card: ChestCard): ProgressState {
  if (card.kind === "stars" || card.kind === "dust") return { ...state, stars: state.stars + card.amount };
  if (card.kind === "xp") return { ...state, xp: state.xp + card.amount };
  if (card.cosmeticId && !state.unlocked.includes(card.cosmeticId)) {
    const isFrame = card.cosmeticId.startsWith("frame");
    return { ...state, unlocked: [...state.unlocked, card.cosmeticId], frame: isFrame ? card.cosmeticId : state.frame, theme: isFrame ? state.theme : card.cosmeticId };
  }
  return state;
}

export function equip(state: ProgressState, id: string): ProgressState {
  if (!state.unlocked.includes(id)) return state;
  return id.startsWith("frame") ? { ...state, frame: state.frame === id ? "" : id } : { ...state, theme: state.theme === id ? "" : id };
}

export const frameColor = (id: string) => COSMETICS.frames.find((f) => f.id === id)?.color ?? "";
export const themeAccent = (id: string) => COSMETICS.themes.find((t) => t.id === id)?.accent ?? "";

export const PROGRESS_KEY = "ga-progress-v1";
export function parseProgress(raw: string | null, today: string): ProgressState {
  if (!raw) return initialProgress(today);
  try {
    const data = JSON.parse(raw) as Partial<ProgressState>;
    if (data.v !== 1) return initialProgress(today);
    const base = initialProgress(today);
    return rollDay({ ...base, ...data, bests: { ...(data.bests ?? {}) }, unlocked: [...(data.unlocked ?? [])], playedToday: [...(data.playedToday ?? [])], missions: data.missions?.length === 3 ? data.missions : base.missions } as ProgressState, today);
  } catch {
    return initialProgress(today);
  }
}
