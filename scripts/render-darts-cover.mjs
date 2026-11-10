// Darts catalogue cover (v166): the game's tournament board under a stage light with three darts in the treble 20,
// drawn by scripts/darts-cover/entry.ts, then graded (bloom on the highlights, vignette).
// Usage: node scripts/render-darts-cover.mjs   (needs `npx esbuild`, Playwright and Python Pillow/numpy)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "darts-cover-"));
const bundle = path.join(tmp, "h.js");
execFileSync("npx", ["--yes", "esbuild@0.24.2", path.join(root, "scripts/darts-cover/entry.ts"), "--bundle", `--outfile=${bundle}`, "--format=iife",
  `--alias:@=${root}`, "--loader:.tsx=tsx", "--jsx=automatic", "--define:process.env.NODE_ENV=\"production\"", "--log-level=warning"], { stdio: "inherit" });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
await page.route("http://cover.local/**", async (route) => {
  const u = new URL(route.request().url());
  if (u.pathname === "/") return route.fulfill({ contentType: "text/html", body: `<script src="/h.js"></script>` });
  if (u.pathname === "/h.js") return route.fulfill({ contentType: "text/javascript", body: fs.readFileSync(bundle, "utf8") });
  return route.fulfill({ status: 404, body: "" });
});
await page.goto("http://cover.local/");
const url = await page.evaluate(() => window.renderCover());
await browser.close();
const raw = path.join(tmp, "raw.png");
fs.writeFileSync(raw, Buffer.from(url.split(",")[1], "base64"));
const out = process.argv[2] ?? path.join(root, "public/covers/darts.webp");
execFileSync("python3", ["-c", `
import sys, numpy as np
from PIL import Image, ImageFilter
a = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float32) / 255
br = np.clip(a - 0.7, 0, 1)
a = a + np.asarray(Image.fromarray((br * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(16)), dtype=np.float32) / 255 * 0.5
H, W = a.shape[:2]; yy, xx = np.mgrid[0:H, 0:W]
a = a * np.clip(1 - (((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H * 0.45) / (H * 0.75)) ** 2) ** 1.5 * 0.6, 0.3, 1)[..., None]
a = np.clip(a, 0, 1)
im = Image.fromarray((a * 255).astype(np.uint8))
im.save(sys.argv[2], "WEBP", quality=82, method=6) if sys.argv[2].endswith(".webp") else im.save(sys.argv[2])
`, raw, out], { stdio: "inherit" });
console.log("wrote", out);
