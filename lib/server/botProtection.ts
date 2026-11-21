/**
 * v228 · Vercel BotID, Basic mode (free; owner approved on 21-nov-2026). The browser runs an invisible check before the
 * requests listed in lib/botRoutes.ts; these routes refuse a request that fails it.
 * Scripts without a real browser (the cheapest bot) are stopped at the door. Deep Analysis is a paid option and is NOT
 * used. Off Vercel (local server, simulator, CI) there is nothing to check against, so it never blocks there. If the
 * check itself fails, the request goes through: an outage of the checker must not lock real players out.
 */
import { checkBotId } from "botid/server";

export { BOT_PROTECTED_ROUTES } from "@/lib/botRoutes";

/** A 403 response when BotID says the request comes from a bot, otherwise null. */
export async function refuseBot(): Promise<Response | null> {
  if (process.env.VERCEL !== "1") return null;
  try {
    const verdict = await checkBotId();
    if (!verdict.isBot) return null;
  } catch {
    return null;
  }
  return Response.json({ ok: false, error: "BOT_DETECTED" }, { status: 403, headers: { "Cache-Control": "no-store" } });
}
