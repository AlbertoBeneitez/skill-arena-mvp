/**
 * v196 · Catalogue of measured events (the only place that says what may be recorded). Matches themselves are not
 * events: they live in verified attempts (view arena_player_matches). Events are what a player did around the games.
 * Nothing here is authoritative for scores, results or money. Documented in docs/EVENTOS.md.
 */
export const ANALYTICS_PURPOSE = "analytics" as const;
export const ANALYTICS_CONSENT_VERSION = "analytics-v1";
/** Detailed events are kept this long, then only the daily summary remains (proposal, pending the owner's decision). */
export const EVENT_RETENTION_MONTHS = 12;
export const MAX_EVENTS_PER_REQUEST = 20;

type FieldRule = { type: "token"; max: number } | { type: "int"; min: number; max: number };
type EventSpec = { source: "client" | "server"; game: boolean; fields: Record<string, FieldRule> };
const token = (max = 24): FieldRule => ({ type: "token", max });
const int = (min: number, max: number): FieldRule => ({ type: "int", min, max });

export const EVENT_CATALOG = {
  screen_view: { source: "client", game: false, fields: { screen: token() } },
  game_opened: { source: "client", game: true, fields: {} },
  game_left: { source: "client", game: true, fields: { ms: int(0, 3_600_000) } },
  setting_changed: { source: "client", game: false, fields: { setting: token() } },
  group_created: { source: "server", game: false, fields: {} },
  group_joined: { source: "server", game: false, fields: {} },
  competition_created: { source: "server", game: false, fields: { mode: token(), games: int(1, 20) } },
  competition_entered: { source: "server", game: false, fields: { mode: token() } },
  competition_finished: { source: "server", game: false, fields: { mode: token(), players: int(1, 40), won: int(0, 1) } },
} as const satisfies Record<string, EventSpec>;
export type EventKind = keyof typeof EVENT_CATALOG;
export const isEventKind = (value: unknown): value is EventKind => typeof value === "string" && Object.hasOwn(EVENT_CATALOG, value);

export type EventInput = { kind: EventKind; gameId?: string; gameVersion?: string; data?: Record<string, unknown> };

/** The clean `data` object for an event, or null when it does not follow the catalogue (unknown or extra fields,
 * wrong types, out-of-range numbers, free text). No free text is ever stored. */
export function cleanEventData(kind: EventKind, raw: unknown): Record<string, string | number> | null {
  const spec: EventSpec = EVENT_CATALOG[kind];
  const data = raw === undefined ? {} : raw;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length !== Object.keys(spec.fields).length) return null;
  const out: Record<string, string | number> = {};
  for (const [key, value] of entries) {
    const rule = spec.fields[key];
    if (!rule) return null;
    if (rule.type === "int") {
      if (typeof value !== "number" || !Number.isInteger(value) || value < rule.min || value > rule.max) return null;
    } else if (typeof value !== "string" || value.length < 1 || value.length > rule.max || !/^[a-z0-9_.:-]+$/i.test(value)) return null;
    out[key] = value as string | number;
  }
  return out;
}
export const eventSource = (kind: EventKind) => EVENT_CATALOG[kind].source;
export const eventTakesGame = (kind: EventKind) => EVENT_CATALOG[kind].game;
