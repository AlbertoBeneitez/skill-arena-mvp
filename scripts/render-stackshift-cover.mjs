// Stack Shift catalogue cover (v178): a realistic 3D render of the game's well (scripts/stackshift-cover/entry.ts,
// three.js in headless Chromium), then graded like the darts cover (bloom on the highlights, vignette).
// Usage: NODE_PATH=<dir with three@0.170> node scripts/render-stackshift-cover.mjs [out]
//   (needs `npx esbuild`, Playwright, three and Python Pillow/numpy; three is only a render-time tool, not an app dependency)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stackshift-cover-"));
const bundle = path.join(tmp, "h.js");
execFileSync("npx", ["--yes", "esbuild@0.24.2", path.join(root, "scripts/stackshift-cover/entry.ts"), "--bundle", `--outfile=${bundle}`, "--format=iife",
  "--log-level=warning"], { stdio: "inherit", env: process.env });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
page.on("console", (m) => { if (m.type() === "error") console.error(m.text()); });
await page.route("http://cover.local/**", async (route) => {
  const u = new URL(route.request().url());
  if (u.pathname === "/") return route.fulfill({ contentType: "text/html", body: `<body style="margin:0"><script src="/h.js"></script></body>` });
  if (u.pathname === "/h.js") return route.fulfill({ contentType: "text/javascript", body: fs.readFileSync(bundle, "utf8") });
  return route.fulfill({ status: 404, body: "" });
});
await page.goto("http://cover.local/");
const url = await page.evaluate(() => window.renderCover());
await browser.close();
const raw = path.join(tmp, "raw.png");
fs.writeFileSync(raw, Buffer.from(url.split(",")[1], "base64"));
const out = process.argv[2] ?? path.join(root, "public/covers/stack-shift.webp");
execFileSync("python3", ["-c", `
import sys, numpy as np
from PIL import Image, ImageFilter
a = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float32) / 255
br = np.clip(a - 0.72, 0, 1)
a = a + np.asarray(Image.fromarray((br * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(18)), dtype=np.float32) / 255 * 0.7
H, W = a.shape[:2]; yy, xx = np.mgrid[0:H, 0:W]
a = a * np.clip(1 - (((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H * 0.45) / (H * 0.75)) ** 2) ** 1.5 * 0.6, 0.3, 1)[..., None]
a = np.clip(a, 0, 1)
im = Image.fromarray((a * 255).astype(np.uint8))
im.save(sys.argv[2], "WEBP", quality=84, method=6) if sys.argv[2].endswith(".webp") else im.save(sys.argv[2])
`, raw, out], { stdio: "inherit" });
console.log("wrote", out);
