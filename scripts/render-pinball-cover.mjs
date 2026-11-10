// Pinball catalogue cover (v160): the V12 table drawn by the game's own renderer, then graded.
// Usage: node scripts/render-pinball-cover.mjs   (needs network for `npx esbuild`, Playwright and Python Pillow/numpy)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pinball-cover-"));
const bundle = path.join(tmp, "h.js");
execFileSync("npx", ["--yes", "esbuild@0.24.2", path.join(root, "scripts/pinball-cover/entry.ts"), "--bundle", `--outfile=${bundle}`, "--format=iife",
  `--alias:@=${root}`, "--loader:.tsx=tsx", "--jsx=automatic", "--define:process.env.NODE_ENV=\"production\"", "--log-level=warning"], { stdio: "inherit" });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
await page.route("http://cover.local/**", async (route) => {
  const u = new URL(route.request().url());
  if (u.pathname === "/") return route.fulfill({ contentType: "text/html", body: `<style>@font-face{font-family:"Unbounded";font-weight:200 900;src:url("/fonts/unbounded-latin-wght.woff2")}</style><script src="/h.js"></script>` });
  if (u.pathname === "/h.js") return route.fulfill({ contentType: "text/javascript", body: fs.readFileSync(bundle, "utf8") });
  const file = path.join(root, "public", u.pathname);
  return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file) }) : route.fulfill({ status: 404, body: "" });
});
await page.goto("http://cover.local/");
await page.evaluate(() => document.fonts.load("800 16px Unbounded"));
const url = await page.evaluate(() => window.renderCover({ cropX: 22, cropY: 126, cropW: 346, bumper: 2, age: 3 }));
await browser.close();
const raw = path.join(tmp, "raw.png");
fs.writeFileSync(raw, Buffer.from(url.split(",")[1], "base64"));
execFileSync("python3", ["-c", `
import sys, numpy as np
from PIL import Image, ImageFilter
a = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float32) / 255
br = np.clip(a - 0.68, 0, 1)
a = a + np.asarray(Image.fromarray((br * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(20)), dtype=np.float32) / 255 * 0.45
H, W = a.shape[:2]; yy, xx = np.mgrid[0:H, 0:W]
a = a * np.clip(1 - (((xx - W / 2) / (W * 0.6)) ** 2 + ((yy - H * 0.5) / (H * 0.72)) ** 2) ** 1.5 * 0.55, 0.35, 1)[..., None]
a = np.clip(a, 0, 1) ** 1.04
Image.fromarray((a * 255).astype(np.uint8)).save(sys.argv[2], "WEBP", quality=82, method=6)
`, raw, path.join(root, "public/covers/pinball.webp")], { stdio: "inherit" });
console.log("wrote public/covers/pinball.webp");
