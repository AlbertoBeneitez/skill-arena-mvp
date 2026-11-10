/**
 * v165 · Everything a game draws is loaded before it appears (owner: "better a longer load than a game showing up
 * without all its pictures"). Before the countdown the app waits for the game's code and for its images — the shared
 * space backdrop, the game's own art and the rival's portrait — fully decoded. A slow network never blocks forever:
 * after `timeoutMs` the game starts with what has arrived.
 */
import type { GameMeta } from "./games";

const COMMON = ["/art/galactic-background.webp"];
/** Images each game paints (besides the common backdrop). */
const GAME_IMAGES: Partial<Record<string, readonly string[]>> = {
  bowling: ["/art/bowling-lane.webp?v=125", "/art/bowling-pit.webp?v=125"],
};

const decoded = new Map<string, Promise<void>>();
function loadImage(src: string): Promise<void> {
  const hit = decoded.get(src);
  if (hit) return hit;
  const job = new Promise<void>((resolve) => {
    if (typeof Image === "undefined") return resolve();
    const img = new Image();
    img.decoding = "async";
    img.onload = () => { (img.decode?.() ?? Promise.resolve()).catch(() => undefined).then(() => resolve()); };
    img.onerror = () => { decoded.delete(src); resolve(); };
    img.src = src;
  });
  decoded.set(src, job);
  return job;
}

export function loadGameAssets(game: GameMeta, extra: readonly (string | undefined)[] = [], timeoutMs = 12000): Promise<void> {
  const images = [...COMMON, ...(GAME_IMAGES[game.id] ?? []), ...extra.filter((s): s is string => !!s)];
  const all = Promise.all([game.loadComponent().then(() => undefined, () => undefined), ...images.map(loadImage)]).then(() => undefined);
  return Promise.race([all, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
}
