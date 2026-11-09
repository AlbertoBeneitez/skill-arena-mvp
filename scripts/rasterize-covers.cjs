// Renders public/covers/<name>.svg (from scripts/generate-covers.py) to sharp WebP covers used by the catalogue.
// SVG blur filters are very expensive to paint on phones; the catalogue only ships the 1600×1100 WebP versions.
// Usage: python3 scripts/generate-covers.py && node scripts/rasterize-covers.cjs [names…]   (needs Playwright + Python Pillow)
const { chromium } = require("playwright");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), { execFileSync } = require("node:child_process");
const dir = path.join(__dirname, "..", "public", "covers");
// Optional names on the command line render only those covers (v143), e.g. `node scripts/rasterize-covers.cjs stack-3d`.
// v160: Shot Gallery (v155), Slot (v156) and Pinball (v160) covers come from their game renderers
// (scripts/render-gallery-cover.mjs, render-slot-cover.mjs, render-pinball-cover.mjs), so they are not in this list.
const all = ["galactic-roulette", "darts", "billiards", "tower-drop", "solitaire-sprint", "mine-grid", "stack-shift",
  "orb-burst", "stack-3d", "corner-sudoku", "bowling"];
const names = process.argv.length > 2 ? all.filter((n) => process.argv.slice(2).includes(n)) : all;
// v140: Shot Gallery and Bowling are posters again (they were renderer captures in v124/v125), and every cover is
// rendered at 1600×1100 so it stays sharp on 3× phone screens.
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "covers-"));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 640, height: 440 }, deviceScaleFactor: 2.5 });
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
    Image.open(os.path.join(src, n + ".png")).convert("RGB").save(os.path.join(out, n + ".webp"), "WEBP", quality=78, method=6)
`, tmp, dir, ...names], { stdio: "inherit" });
  console.log(`wrote ${names.length} WebP covers`);
})();
