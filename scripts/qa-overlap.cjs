/**
 * Layout rule check (v132): nothing in the interface may sit on top of something else. Against a running production
 * server, at 390 × 844, it opens the main tabs and every game, waits for the countdown to finish, and reports
 *   - a control (button, link, input, select) that covers the game canvas, and
 *   - two visible controls or labelled panels whose boxes intersect.
 * Allowed: cards fanned in one Solitaire pile, and content scrolling under the opaque fixed header or tab bar.
 * Dialogs opened on purpose are not part of the check. Exit code 1 when anything overlaps.
 *   BASE_URL=http://127.0.0.1:3100 node scripts/qa-overlap.cjs
 */
const { chromium } = require("playwright");
const BASE = process.env.BASE_URL || "http://127.0.0.1:3111";
const GAMES = [
  "Slot", "Dardos", "Billar", "Stack", "Tower Drop", "Orb Burst",
  "Shot Gallery", "Solitaire Sprint", "Mine Grid", "Stack Shift", "Pinball", "Galoku", "Bowling",
];

/** Runs in the page: boxes of visible controls and the canvas, and every intersecting pair (> 2 px each way). */
function findOverlaps() {
  const visible = (el) => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05
      && r.bottom > 0 && r.top < innerHeight && !el.closest("[role=dialog], [aria-hidden=true], .visuallyHidden");
  };
  const name = (el) => (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40)
    + ` <${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""}>`;
  const controls = [...document.querySelectorAll("button, a[href], input:not([type=hidden]), select, [role=button], [role=status]:not(:empty)")]
    .filter(visible).filter((el) => !el.parentElement.closest("button, a[href], [role=button]"));
  // Horizontal scrollers clip their children: only the part inside the scroller's box counts.
  const box = (el) => {
    let r = el.getBoundingClientRect(), x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll|hidden|clip)/.test(s.overflowX + s.overflowY)) {
        const q = p.getBoundingClientRect();
        x0 = Math.max(x0, q.left); y0 = Math.max(y0, q.top); x1 = Math.min(x1, q.right); y1 = Math.min(y1, q.bottom);
      }
    }
    return { x0, y0, x1, y1 };
  };
  const fixedChrome = (el) => { for (let p = el; p; p = p.parentElement) if (getComputedStyle(p).position === "fixed") return p; return null; };
  const hit = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 2 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 2;
  const out = [];
  const canvas = [...document.querySelectorAll("canvas")].filter(visible);
  for (const c of canvas) for (const el of controls) if (hit(box(c), box(el))) out.push(`covers the game: ${name(el)}`);
  for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
    const a = controls[i], b = controls[j];
    if (a.contains(b) || b.contains(a)) continue;
    // Cards fanned in one pile overlap by design; scrolling content passes under the opaque fixed header/tab bar.
    if (a.classList.contains("solitaireCard") && b.classList.contains("solitaireCard") && a.parentElement === b.parentElement) continue;
    if (!!fixedChrome(a) !== !!fixedChrome(b)) continue;
    if (hit(box(a), box(b))) out.push(`${name(a)} ✕ ${name(b)}`);
  }
  return [...new Set(out)];
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: "es-ES" });
  const page = await ctx.newPage();
  const report = {};
  const check = async (label) => { const o = await page.evaluate(findOverlaps); if (o.length) report[label] = o; };
  await page.goto(BASE + "/?reset=1", { waitUntil: "networkidle" });
  await check("Bienvenida");
  await page.getByText("INICIAR SESIÓN").first().click();
  await page.waitForTimeout(400);
  await check("Avatar");
  await page.locator("#avatar-name").fill("Overlap");
  await page.getByText("CONTINUAR").click();
  await page.waitForTimeout(900);
  await check("Juegos");
  for (const tab of await page.locator("nav button, nav a").all()) {
    const label = ((await tab.getAttribute("aria-label")) || (await tab.innerText())).trim();
    await tab.click().catch(() => {});
    await page.waitForTimeout(600);
    await check(`Pestaña ${label}`);
  }
  for (const name of GAMES) {
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await page.getByText(name, { exact: true }).first().click({ timeout: 15000 });
    await page.waitForTimeout(5200); // countdown
    await check(name);
  }
  await browser.close();
  for (const [k, v] of Object.entries(report)) console.log(`✕ ${k}\n   ${v.join("\n   ")}`);
  console.log(Object.keys(report).length ? `${Object.keys(report).length} screens with overlaps` : "No overlaps on any screen");
  process.exit(Object.keys(report).length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
