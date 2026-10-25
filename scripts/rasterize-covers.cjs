// Renders public/covers/<name>.svg (from scripts/generate-covers.py) to light WebP covers used by the catalogue.
// SVG blur filters are very expensive to paint on phones; the catalogue only ships the 800×550 WebP versions.
// Usage: python3 scripts/generate-covers.py && node scripts/rasterize-covers.cjs   (needs Playwright + Python Pillow)
const { chromium } = require("playwright");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), { execFileSync } = require("node:child_process");
const dir = path.join(__dirname, "..", "public", "covers");
const names = ["galactic-roulette", "galactic-slot", "darts", "billiards", "tower-drop", "solitaire-sprint", "mine-grid", "stack-shift",
  "orb-burst", "stack-3d", "shot-gallery", "pinball", "bowling", "corner-sudoku"];
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "covers-"));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 640, height: 440 }, deviceScaleFactor: 1.25 });
  for (const name of names) {
    const html = path.join(tmp, "c.html");
    fs.writeFileSync(html, `<body style="margin:0"><img src="file://${path.join(dir, name + ".svg")}" style="width:640px;height:440px;display:block">`);
    await page.goto("file://" + html);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(tmp, name + ".png") });
  }
  await browser.close();
  execFileSync("python3", ["-c", `
import sys, os
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
for n in sys.argv[3:]:
    Image.open(os.path.join(src, n + ".png")).convert("RGB").save(os.path.join(out, n + ".webp"), "WEBP", quality=80, method=6)
`, tmp, dir, ...names], { stdio: "inherit" });
  console.log(`wrote ${names.length} WebP covers`);
})();
