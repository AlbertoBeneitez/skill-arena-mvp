// Native touch against the production build, complete clock/insolvency sessions.
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
);
const assert = require("node:assert/strict"),
  { register } = require("node:module"),
  { pathToFileURL } = require("node:url"),
  path = require("node:path");
register(pathToFileURL(path.join(__dirname, "determinism-loader.mjs")));
(async () => {
  const { SLOT_CORE: core } = await import(
      pathToFileURL(
        path.join(
          __dirname,
          "../.det-test/lib/verified/galacticSlotCore.v1.js",
        ),
      )
    ),
    { replayCore } = await import(
      pathToFileURL(
        path.join(__dirname, "../.det-test/lib/verified/coreRuntime.v1.js"),
      )
    );
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    await Promise.all(
      [false, true].map(async (landscape) => {
        const context = await browser.newContext({
            viewport: landscape
              ? { width: 844, height: 390 }
              : { width: 390, height: 844 },
            isMobile: true,
            hasTouch: true,
          }),
          page = await context.newPage(),
          errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("console", (m) => {
          if (m.type() === "error") errors.push(m.text());
        });
        await page.addInitScript(() =>
          localStorage.setItem(
            "skill-arena-v12",
            JSON.stringify({
              onboarded: true,
              playerName: "QA-Slot",
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
        await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3101");
        await page
          .getByRole("button", { name: "Entrenamiento gratis", exact: true })
          .tap();
        const start = page.waitForResponse((r) =>
          r.url().includes("/verified-match/start"),
        );
        await page
          .getByRole("button", { name: "Jugar a Galactic Slot", exact: true })
          .tap();
        const issued = await (await start).json();
        assert.equal(issued.manifest.game_id, "galactic-slot");
        await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
        await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
        await page.waitForTimeout(160);
        const cdp = await context.newCDPSession(page),
          canvas = page.locator("canvas.gameCanvas");
        let submits = 0;
        page.on("request", (r) => {
          if (r.url().includes("/verified-match/verify")) submits++;
        });
        let done = false;
        const response = page
          .waitForResponse((r) => r.url().includes("/verified-match/verify"), {
            timeout: 200000,
          })
          .then((r) => {
            done = true;
            return r;
          });
        async function tap(x, y, cancel = false) {
          const label =
            y === 586
              ? "Girar ruletas por 5 euros ficticios"
              : `Aumentar avance de ruleta ${Math.round((x - 110) / 110) + 1}`;
          const button = page.getByRole("button", { name: label, exact: true });
          await button.scrollIntoViewIfNeeded();
          const b = await button.boundingBox();
          assert.ok(
            b.width >= 44 && b.height >= 44,
            "usable physical touch target",
          );
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }],
          });
          await cdp.send("Input.dispatchTouchEvent", {
            type: cancel ? "touchCancel" : "touchEnd",
            touchPoints: [],
          });
          await page.waitForTimeout(50);
        }
        const model = core.create(issued.manifest.seed);
        let spins = 0;
        while (!done) {
          const targets = process.env.QA_LOSS ? [0, 1, 2] : [7, 7, 7];
          for (let i = 0; i < 3 && !done; i++) {
            const n =
              (model.strips[i].indexOf(targets[i]) - model.positions[i] + 8) %
                8 || 8;
            while (model.steps[i] !== n && !done) {
              await tap(110 + i * 110, 498);
              model.steps[i] = (model.steps[i] % 8) + 1;
            }
          }
          if (done) break;
          await tap(195, 586, spins === 0);
          if (spins === 0) {
            await tap(195, 586);
            await page.evaluate(() => window.dispatchEvent(new Event("blur")));
            await page.screenshot({
              path: `/workspace/.cloud-setup/slot-${landscape ? "landscape" : "portrait"}.png`,
            });
          }
          model.positions = model.positions.map(
            (p, i) => (p + model.steps[i]) % 8,
          );
          spins++;
          await page.waitForTimeout(3120);
          if (spins === 3) {
            await page.setViewportSize(
              landscape
                ? { width: 390, height: 844 }
                : { width: 844, height: 390 },
            );
            await page.waitForTimeout(100);
            assert.ok(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            );
          }
        }
        const vr = await response,
          body = vr.request().postDataJSON(),
          result = await vr.json(),
          replay = replayCore(
            core,
            body.inputs,
            body.final_tick,
            issued.manifest.seed,
            issued.manifest.competition.target_score,
          );
        assert.equal(replay.valid, true, replay.error);
        assert.equal(result.verified, true);
        assert.equal(result.score, replay.score);
        assert.equal(result.height, replay.state.balanceMinor);
        assert.equal(result.won, !process.env.QA_LOSS);
        assert.equal(submits, 1);
        assert.equal(
          body.inputs.filter((i) => i.action === "SPIN").length,
          replay.state.spins,
        );
        assert.ok(!("score" in body) && !("balanceMinor" in body));
        assert.equal(replay.state.strips.length, 3);
        if (process.env.QA_LOSS) {
          assert.equal(replay.state.spins, 20);
          assert.equal(result.score, 0);
        } else {
          assert.equal(body.final_tick, 21600);
          assert.ok(result.score > 10000);
        }
        await page.getByText("Saldo ficticio final", { exact: true }).waitFor();
        await page
          .getByRole("button", { name: "OTRA VEZ", exact: true })
          .waitFor({ state: "visible" });
        await page.waitForTimeout(450);
        const restarting = page.waitForResponse(
          (r) => r.url().includes("/verified-match/start"),
          { timeout: 60000 },
        );
        await page.getByRole("button", { name: "OTRA VEZ", exact: true }).tap();
        const fresh = await (await restarting).json();
        assert.notEqual(fresh.ticket.attempt_id, issued.ticket.attempt_id);
        assert.notEqual(fresh.manifest.seed, issued.manifest.seed);
        await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
        await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
        await page.waitForTimeout(150);
        await page.waitForTimeout(300);
        const abandoning = page.waitForResponse(
          (r) => r.url().includes("/verified-match/verify"),
          { timeout: 60000 },
        );
        await page.getByRole("button", { name: "Volver", exact: true }).tap();
        const receipt = await (await abandoning).json();
        assert.equal(receipt.received, true);
        assert.equal(receipt.verified, false);
        assert.equal(submits, 2);
        assert.deepEqual(errors, []);
        console.log(
          JSON.stringify({
            orientation: landscape ? "landscape" : "portrait",
            won: result.won,
            score: result.score,
            spins: replay.state.spins,
            finalTick: body.final_tick,
            verified: true,
            rotation: true,
            cancelAndDoubleTap: true,
            restart: true,
            abandonedReceipt: true,
          }),
        );
        await context.close();
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
