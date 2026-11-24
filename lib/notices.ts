/**
 * v230 · In-app notices: the shared vocabulary of server and app (pure; no I/O).
 *
 * Owner, 20-nov-2026, on design/avisos/avisos-propuesta.jpg: only good news. A group accepts your challenge, it is your
 * turn to play, you win a matchday or a competition. Moving up a league or beating your record is an animation at the
 * moment it happens, not a notice. «Dónde»: App and Móvil (the phone needs Web Push, not active yet).
 */
export const NOTICE_KINDS = ["challenge-accepted", "your-turn", "matchday-won", "competition-won"] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

/** The three switches a person sees, and which kinds each one covers. */
export const NOTICE_TOPICS = { rival: ["challenge-accepted"], turn: ["your-turn"], win: ["matchday-won", "competition-won"] } as const;
export type NoticeTopic = keyof typeof NOTICE_TOPICS;
export const topicOf = (kind: NoticeKind): NoticeTopic =>
  (Object.keys(NOTICE_TOPICS) as NoticeTopic[]).find((t) => (NOTICE_TOPICS[t] as readonly string[]).includes(kind))!;

export type NoticeSettings = { topics: Record<NoticeTopic, boolean>; app: boolean; phone: boolean };
export const DEFAULT_NOTICE_SETTINGS: NoticeSettings = { topics: { rival: true, turn: true, win: true }, app: true, phone: false };

/** Settings as stored or sent: anything unknown or malformed falls back to the default, field by field. */
export function cleanNoticeSettings(raw: unknown): NoticeSettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const t = o.topics && typeof o.topics === "object" ? (o.topics as Record<string, unknown>) : {};
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  const d = DEFAULT_NOTICE_SETTINGS;
  return {
    topics: { rival: bool(t.rival, d.topics.rival), turn: bool(t.turn, d.topics.turn), win: bool(t.win, d.topics.win) },
    app: bool(o.app, d.app),
    phone: bool(o.phone, d.phone),
  };
}

/** What a notice carries (only what its text needs). */
export type NoticeData = { competitionId: string; mode: "group" | "versus-league" | "versus-tournament"; group?: string; round?: number; gameId?: string };
export type Notice = { id: string; kind: NoticeKind; data: NoticeData; createdAt: string; read: boolean };
export type NoticeInbox = { notices: Notice[]; unread: number; settings: NoticeSettings; phoneAvailable: boolean };
