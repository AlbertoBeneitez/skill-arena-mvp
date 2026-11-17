// v215 · The bowling sign (owner request): the GALACTIC GAMES insignia and wordmark, rendered with the brand fonts to a
// transparent PNG (scripts/art/bowling-sign.png) that scripts/render-bowling-art.py places on the pit's masking unit.
// Usage: node scripts/render-bowling-sign.cjs && python3 scripts/render-bowling-art.py   (needs Playwright)
const { chromium } = require("playwright");
const path = require("node:path"), fs = require("node:fs"), os = require("node:os");
const root = path.join(__dirname, "..");
const font = (f) => "file://" + path.join(root, "public/fonts", f);
const html = `<!doctype html><html><head><style>
@font-face { font-family: U; src: url(${font("chakra-petch-latin-700-normal.woff2")}); font-weight: 700; }
@font-face { font-family: C; src: url(${font("chakra-petch-latin-600-normal.woff2")}); font-weight: 600; }
html, body { margin: 0; background: transparent; }
.sign { width: 1100px; height: 420px; display: flex; align-items: center; justify-content: center; gap: 46px; }
svg { width: 300px; height: 300px; filter: drop-shadow(0 0 18px rgba(155,242,225,.55)); }
.words { display: grid; gap: 14px; }
.g { font: 700 128px/0.9 U; letter-spacing: .04em; background: linear-gradient(180deg, #ffffff, #bff6ee 55%, #7fd9cf); -webkit-background-clip: text; color: transparent;
     filter: drop-shadow(0 0 14px rgba(155,242,225,.6)); }
.m { display: flex; align-items: center; gap: 18px; font: 600 54px/1 C; letter-spacing: .5em; color: #f5d69d; filter: drop-shadow(0 0 10px rgba(245,214,157,.6)); }
.m::before, .m::after { content: ""; flex: 1; height: 3px; background: #f5d69d; opacity: .7; }
</style></head><body><div class="sign">
<svg viewBox="0 0 128 128"><defs>
<radialGradient id="s" cx="35%" cy="25%" r="80%"><stop stop-color="#294865"/><stop offset="1" stop-color="#071525"/></radialGradient>
<linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#edfffc"/><stop offset=".45" stop-color="#9bf2e1"/><stop offset="1" stop-color="#4e98b7"/></linearGradient>
<linearGradient id="o"><stop stop-color="#66739f"/><stop offset=".5" stop-color="#c7b7ef"/><stop offset="1" stop-color="#99e5e3"/></linearGradient></defs>
<circle cx="64" cy="64" r="49" fill="url(#s)" stroke="#48687d"/>
<circle cx="64" cy="64" r="44" fill="none" stroke="#6899a8" stroke-opacity=".3" stroke-dasharray="3 8"/>
<ellipse cx="64" cy="64" rx="59" ry="22" transform="rotate(-32 64 64)" fill="none" stroke="url(#o)" stroke-width="3"/>
<path d="M89 42a33 33 0 1 0 6 37V59H63v13h19a20 20 0 1 1-2-20z" fill="url(#m)"/>
<path d="M36 83a34 34 0 0 0 44 15" fill="none" stroke="#e0fffb" stroke-opacity=".5" stroke-width="1.5"/>
<path d="M14 91c19 2 58-11 94-42" fill="none" stroke="#b2d9ec" stroke-width="2.5"/>
<circle cx="110" cy="37" r="6" fill="#f5d69d" stroke="#fff1cf" stroke-width="1.5"/>
<path d="m26 24 2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#d9f8fa"/><circle cx="91" cy="109" r="2" fill="#b2c2e9"/></svg>
<div class="words"><div class="g">GALACTIC</div><div class="m">GAMES</div></div>
</div></body></html>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1100, height: 420 }, deviceScaleFactor: 1 });
  // A file page, so the file:// fonts load (about:blank cannot read them).
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "sign-")), "sign.html");
  fs.writeFileSync(file, html);
  await p.goto("file://" + file, { waitUntil: "load" });
  await p.evaluate(async () => { await document.fonts.ready; if (![...document.fonts].every((f) => f.status === "loaded")) throw new Error("fonts"); });
  await p.waitForTimeout(300);
  await p.locator(".sign").screenshot({ path: path.join(root, "scripts/art/bowling-sign.png"), omitBackground: true });
  await b.close();
  console.log("wrote scripts/art/bowling-sign.png");
})();
