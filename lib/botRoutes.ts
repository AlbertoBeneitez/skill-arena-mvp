/** v228 · Requests guarded by Vercel BotID (Basic). Shared by the browser (instrumentation-client.ts) and the server
 * (lib/server/botProtection.ts), so both always agree. Match records and heartbeats are not listed on purpose: a
 * failed check in the middle of a match must never cost a real player the match. */
export const BOT_PROTECTED_ROUTES: { path: string; method: "POST" }[] = [
  { path: "/api/verified-match/start", method: "POST" },
  { path: "/api/hidden-game/start", method: "POST" },
  { path: "/api/account", method: "POST" },
  { path: "/api/groups", method: "POST" },
];
