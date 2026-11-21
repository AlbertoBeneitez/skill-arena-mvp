// v228 · Vercel BotID (Basic, free): an invisible browser check attached to the requests that start matches, create
// accounts and act in groups (lib/botRoutes.ts). The server side is lib/server/botProtection.ts. On a local server
// (simulator, development) there is no BotID service behind the proxy and the server does not check, so it is skipped.
import { initBotId } from "botid/client/core";
import { BOT_PROTECTED_ROUTES } from "@/lib/botRoutes";

if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)) initBotId({ protect: BOT_PROTECTED_ROUTES });
