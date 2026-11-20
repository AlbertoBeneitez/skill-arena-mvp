/**
 * Bot simulator · bots that use the real web app like people (Playwright, phones and a computer).
 * Each bot signs in with a «Bot …» name, then wanders: taps what a person would tap, types in fields, goes back.
 * It records page errors, console errors, server errors (5xx), screens wider than the phone and dead ends, with a
 * screenshot of each new problem. Never taps destructive actions (delete account, sign out, leave/close group).
 *   SIM_AUTH_SECRET=… node scripts/sim/ui-bots.cjs [bots=6] [steps=60]
 */
const { chromium } = require("playwright");
const crypto = require("crypto");
const fs = require("fs");

const BASE = process.env.SIM_BASE || "http://127.0.0.1:3200";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) throw new Error("SIM_BASE must be local");
const SECRET = process.env.SIM_AUTH_SECRET;
if (!SECRET || SECRET.length < 32) throw new Error("SIM_AUTH_SECRET required");
const BOTS = Number(process.argv[2] || 6), STEPS = Number(process.argv[3] || 60);
const run = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
const dir = `sim-reports/ui-${run}`;
fs.mkdirSync(dir, { recursive: true });

const mint = (sub, n) => { const now = Math.floor(Date.now() / 1000); const body = Buffer.from(JSON.stringify({ p: "google", sub, n, iat: now, exp: now + 3600 })).toString("base64url"); return `${body}.${crypto.createHmac("sha256", SECRET).update(body).digest("base64url")}`; };
const DANGER = /borrar|eliminar|cerrar sesi|usar otra cuenta|abandonar|salir del grupo|cerrar el grupo|delete|sign out|log ?out|reset/i;
const DEVICES = [
  { name: "móvil 375", viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
  { name: "móvil 360", viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true },
  { name: "ordenador", viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false },
];
const issues = new Map();

async function bot(i, browser) {
  const device = DEVICES[i % DEVICES.length];
  const name = `Bot UI ${i} ${device.name.split(" ")[0]}`.slice(0, 18);
  const ctx = await browser.newContext({ ...device, locale: "es-ES" });
  await ctx.addCookies([{ name: "ga_session", value: mint(`bot-ui-${run}-${i}`, name), url: BASE }]);
  const page = await ctx.newPage();
  let where = "inicio";
  const note = async (kind, text) => {
    const key = `${kind}:${String(text).slice(0, 140)}`;
    if (issues.has(key)) { issues.get(key).count++; return; }
    const shot = `${dir}/${issues.size + 1}.png`;
    await page.screenshot({ path: shot }).catch(() => {});
    issues.set(key, { kind, text: String(text).slice(0, 400), bot: name, device: device.name, where, shot, count: 1 });
  };
  page.on("pageerror", (e) => note("error de página", e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource: the server responded with a status of 4/.test(m.text())) note("error de consola", m.text()); });
  page.on("response", (r) => { if (r.status() >= 500) note("error de servidor", `${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });

  await page.goto(BASE + "/", { waitUntil: "load" }).catch((e) => note("no carga", e.message));
  await page.waitForTimeout(2500);
  // Computers see the app inside a phone-sized frame: act inside it.
  const frameEl = await page.$("iframe.deskFrame");
  let scope = frameEl ? await frameEl.contentFrame() : page;
  if (frameEl) await scope.waitForLoadState("load").catch(() => {});
  // First visit: name + avatar screen.
  const nameInput = scope.locator("#avatar-name");
  if (await nameInput.isVisible().catch(() => false)) {
    await nameInput.fill(name);
    await scope.getByRole("button", { name: /continuar/i }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
  }
  await scope.getByRole("button", { name: /^entrar$/i }).first().click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(1200);

  let stuck = 0, lastHtml = "";
  for (let step = 0; step < STEPS; step++) {
    // A person sometimes goes back or scrolls.
    const roll = Math.random();
    if (roll < 0.07) {
      await page.goBack().catch(() => {}); await page.waitForTimeout(600);
      // Going back past the app's first screen leaves the site: a person would just open it again.
      if (!page.url().startsWith(BASE)) { await page.goto(BASE + "/", { waitUntil: "load" }).catch(() => {}); await page.waitForTimeout(1500); }
      const again = await page.$("iframe.deskFrame"); scope = again ? await again.contentFrame() : page;
      continue;
    }
    if (roll < 0.15) { await page.mouse.wheel(0, 300 + Math.random() * 600).catch(() => {}); await page.waitForTimeout(300); }
    const targets = await scope.locator("button:visible, [role=tab]:visible, a[href]:visible, input:visible, select:visible").all();
    const pool = [];
    for (const t of targets) {
      const label = ((await t.getAttribute("aria-label").catch(() => "")) || (await t.innerText().catch(() => "")) || "").trim();
      if (DANGER.test(label)) continue;
      if (await t.isDisabled().catch(() => true)) continue;
      pool.push({ t, label });
    }
    if (!pool.length) { await note("sin salida", "pantalla sin nada que tocar"); break; }
    const { t, label } = pool[Math.floor(Math.random() * pool.length)];
    where = label.slice(0, 40) || where;
    const tag = await t.evaluate((el) => el.tagName.toLowerCase()).catch(() => "");
    if (tag === "input") {
      const type = await t.getAttribute("type").catch(() => "");
      if (type === "file" || type === "checkbox" || type === "radio") continue;
      await t.fill(type === "number" ? String(Math.floor(Math.random() * 50)) : ["bot", "Billar", "zz", "<b>x</b>", "🚀"][step % 5]).catch(() => {});
    } else if (tag === "select") {
      const options = await t.locator("option").all();
      if (options.length) await t.selectOption({ index: Math.floor(Math.random() * options.length) }).catch(() => {});
    } else {
      await t.click({ timeout: 2000, trial: false }).catch(() => {});
    }
    await page.waitForTimeout(400 + Math.random() * 700);
    // Wider than the phone? (everything must fit horizontally)
    const overflow = await scope.evaluate(() => document.documentElement.scrollWidth - window.innerWidth).catch(() => 0);
    if (overflow > 2) await note("pantalla más ancha que el móvil", `${overflow}px de más tras tocar «${label.slice(0, 40)}»`);
    const html = await scope.evaluate(() => document.body.innerText.length).catch(() => 0);
    stuck = html === lastHtml ? stuck + 1 : 0; lastHtml = html;
    if (stuck > 12) { await page.keyboard.press("Escape").catch(() => {}); stuck = 0; }
  }
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  await Promise.all(Array.from({ length: BOTS }, (_, i) => bot(i + 1, browser).catch((e) => issues.set(`fallo:${e.message}`, { kind: "fallo del bot", text: e.message, count: 1 }))));
  await browser.close();
  const list = [...issues.values()];
  fs.writeFileSync(`${dir}/report.json`, JSON.stringify(list, null, 2));
  fs.writeFileSync(`${dir}/report.md`, [`# Bots de interfaz ${run}`, "", `${BOTS} bots × ${STEPS} toques`, "", ...list.map((x) => `- **${x.kind}** (${x.count}×, ${x.device}, tras «${x.where}»): ${x.text} — ${x.shot}`)].join("\n"));
  console.log(`${list.length} problemas distintos · ${dir}/report.md`);
  for (const x of list) console.log(`- ${x.kind} (${x.count}×, ${x.device}): ${x.text.slice(0, 160)}`);
})();
