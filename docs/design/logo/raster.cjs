const { chromium } = require("playwright");
const out = "/home/claude/skill-arena-mvp/public/";
const jobs = [
  ["icon.svg", 192, "icon-192.png", 1, "transparent"],
  ["icon.svg", 512, "icon-512.png", 1, "transparent"],
  ["square.svg", 180, "apple-touch-icon.png", 1, "#06060f"],
  ["maskable.svg", 512, "icon-maskable-512.png", 1, "#06060f"],
  ["icon.svg", 48, "favicon-48.png", 1, "transparent"],
  ["mono.svg", 96, "notify-badge-96.png", 1, "transparent"],
];
(async () => {
  const b = await chromium.launch();
  for (const [src, size, name, scale, bg] of jobs) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    const inner = Math.round(size * scale), pad = Math.round((size - inner) / 2);
    require("fs").writeFileSync("/tmp/logo/_r.html", `<html><body style="margin:0;background:${bg}"><img src="file:///tmp/logo/${src}" style="display:block;position:absolute;left:${pad}px;top:${pad}px;width:${inner}px;height:${inner}px"></body></html>`);
    await p.goto("file:///tmp/logo/_r.html");
    await p.waitForTimeout(150);
    await p.screenshot({ path: out + name, omitBackground: bg === "transparent" });
    await p.close();
  }
  // Share image (1200×630): icon + wordmark, as on the welcome screen.
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  require("fs").writeFileSync("/tmp/logo/_og.html", `<html><head><style>
  @font-face{font-family:U;src:url(file:///home/claude/skill-arena-mvp/public/fonts/unbounded-latin-wght.woff2) format("woff2");font-weight:200 900}
  @font-face{font-family:C;src:url(file:///home/claude/skill-arena-mvp/public/fonts/chakra-petch-latin-600-normal.woff2) format("woff2");font-weight:600}
  body{margin:0;width:1200px;height:630px;background:radial-gradient(90% 90% at 50% 40%,#1d1650,#0d0b2a 55%,#06060f);display:flex;align-items:center;justify-content:center;gap:48px}
  b{display:block;font:800 104px/1 U;background:linear-gradient(#fff,#b9f1f4);-webkit-background-clip:text;color:transparent}
  i{display:block;font:600 34px C;font-style:normal;letter-spacing:.62em;color:#e8c46b;margin-top:16px}
  </style></head><body><img src="file:///tmp/logo/icon.svg" width="250"><div><b>GALACTIC</b><i>GAMES</i></div></body></html>`);
  await p.goto("file:///tmp/logo/_og.html");
  await p.waitForTimeout(500);
  await p.screenshot({ path: out + "og-image.png" });
  await b.close();
})();
