// Regression: a parent sound-preference render must not recreate a live core.
const { chromium } = require(
    process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
  ),
  assert = require("node:assert/strict"),
  { register } = require("node:module"),
  { pathToFileURL } = require("node:url"),
  path = require("node:path");
register(pathToFileURL(path.join(__dirname, "determinism-loader.mjs")));
(async () => {
  const { SLOT_CORE } = await import(
      pathToFileURL(
        path.join(
          __dirname,
          "../.det-test/lib/verified/galacticSlotCore.v1.js",
        ),
      )
    ),
    browser = await chromium.launch({
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
  try {
    // Run native touch contexts sequentially: Chromium touch emulation is shared.
    for (const name of ["Slot", "Roulette"]) {
      const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          hasTouch: true,
          isMobile: true,
        }),
        page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => {
        errors.push(e.message);
        console.log(JSON.stringify({ game: name, pageError: e.message }));
      });
      await page.addInitScript(() =>
        localStorage.setItem(
          "skill-arena-v12",
          JSON.stringify({
            onboarded: true,
            playerName: "QA-Render",
            balance: 25,
            netEarnings: 0,
            nextTurn: "create",
            musicOn: false,
            earnings: [],
            movements: [],
            wins: 0,
            losses: 0,
            streak: 0,
            group: null,
          }),
        ),
      );
      await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3103");
      await page
        .getByRole("button", { name: "Entrenamiento gratis", exact: true })
        .tap();
      const start = page.waitForResponse((r) =>
        r.url().includes("/verified-match/start"),
      );
      await page
        .getByRole("button", {
          name: `Jugar a Galactic ${name}`,
          exact: true,
        })
        .tap();
      const issued = await (await start).json();
      await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
      await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
      if (name === "Slot") {
        const s = SLOT_CORE.create(issued.manifest.seed);
        for (let i = 0; i < 3; i++) {
          const n = (s.strips[i].indexOf(7) - s.positions[i] + 8) % 8 || 8;
          for (let k = 1; k < n; k++) {
            await page
              .getByRole("button", {
                name: `Aumentar avance de ruleta ${i + 1}`,
                exact: true,
              })
              .tap();
            await page.waitForTimeout(50);
          }
        }
        await page
          .getByRole("button", {
            name: "Girar ruletas por 5 euros ficticios",
            exact: true,
          })
          .tap();
        await page.waitForTimeout(3300);
      } else {
        const canvas = page.locator("canvas.gameCanvas"),
          b = await canvas.boundingBox(),
          scale = Math.min(b.width / 390, b.height / 400),
          x = b.x + b.width / 2,
          y = b.y + b.height / 2,
          cdp = await context.newCDPSession(page);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x + 30 * scale, y }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await page.waitForTimeout(500);
      }
      const before = await page.locator(".coreHud").innerText();
      assert.equal(before.split(" €")[0], name === "Slot" ? "295.00" : "95.00");
      await page.evaluate(() => {
        window.qaEvents = [];
        for (const type of ["pointerdown", "pointerup", "click"])
          document.addEventListener(
            type,
            (e) => window.qaEvents.push({ type, target: e.target.className }),
            true,
          );
      });
      await page
        .getByRole("button", { name: "Activar sonido", exact: true })
        .tap();
      await page.waitForTimeout(250);
      const after = await page.locator(".coreHud").innerText();
      console.log(
        JSON.stringify({
          game: name,
          events: await page.evaluate(() => window.qaEvents),
          pressed: await page
            .locator(".gameSoundToggle")
            .getAttribute("aria-pressed"),
          errors,
        }),
      );
      assert.equal(
        await page.locator(".gameSoundToggle").getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(after.split(" €")[0], before.split(" €")[0]);
      const time = (t) => Number(t.match(/([\d.]+)s$/)[1]);
      assert.ok(
        time(after) <= time(before),
        "clock cannot restart on preference render",
      );
      await page
        .getByRole("button", { name: "Desactivar sonido", exact: true })
        .tap();
      if (name === "Roulette") await page.waitForTimeout(5400);
      const final = await page.locator(".coreHud").innerText();
      assert.ok(final.split(" €")[0] !== "100.00");
      const exiting = page.waitForResponse((r) =>
        r.url().includes("/verified-match/verify"),
      );
      await page.getByRole("button", { name: "Volver", exact: true }).tap();
      const r = await exiting,
        body = r.request().postDataJSON(),
        receipt = await r.json();
      assert.equal(receipt.received, true);
      assert.equal(receipt.verified, false);
      assert.equal(
        body.inputs.filter(
          (i) => i.action === "SPIN" || i.action.startsWith("LAUNCH_"),
        ).length,
        1,
      );
      assert.deepEqual(errors, []);
      console.log(
        JSON.stringify({
          game: name,
          before,
          after,
          preserved: true,
          record: true,
        }),
      );
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
