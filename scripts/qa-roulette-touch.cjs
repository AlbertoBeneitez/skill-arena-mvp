// Observe public Canvas numbers/ball frames, flick with native touch, verify server record.
const { chromium } = require(
    process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
  ),
  assert = require("node:assert/strict"),
  { register } = require("node:module"),
  { pathToFileURL } = require("node:url"),
  path = require("node:path");
register(pathToFileURL(path.join(__dirname, "determinism-loader.mjs")));
(async () => {
  const { ROULETTE_CORE: core, ROULETTE_WHEEL } = await import(
      pathToFileURL(
        path.join(
          __dirname,
          "../.det-test/lib/verified/galacticRouletteCore.v1.js",
        ),
      )
    ),
    { applyCoreInput, stepCore, replayCore } = await import(
      pathToFileURL(
        path.join(__dirname, "../.det-test/lib/verified/coreRuntime.v1.js"),
      )
    ),
    { roundDiv } = await import(
      pathToFileURL(
        path.join(__dirname, "../.det-test/lib/deterministic/integerMath.js"),
      )
    );
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    for (const landscape of [false, true]) {
      const context = await browser.newContext({
          viewport: landscape
            ? process.env.QA_SMALL
              ? { width: 568, height: 320 }
              : { width: 844, height: 390 }
            : process.env.QA_SMALL
              ? { width: 320, height: 568 }
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
      await page.addInitScript(() => {
        localStorage.setItem(
          "skill-arena-v12",
          JSON.stringify({
            onboarded: true,
            playerName: "QA-Roulette",
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
        );
        window.__rouletteNumber = null;
        window.__rouletteBalls = [];
        const text = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (t, ...args) {
          if (this.font === "900 28px system-ui" && String(t) !== "")
            window.__rouletteNumber = Number(t);
          return text.call(this, t, ...args);
        };
        const arc = CanvasRenderingContext2D.prototype.arc;
        CanvasRenderingContext2D.prototype.arc = function (x, y, r, ...args) {
          this.__publicArc = { x, y, r };
          return arc.call(this, x, y, r, ...args);
        };
        const fill = CanvasRenderingContext2D.prototype.fill;
        CanvasRenderingContext2D.prototype.fill = function (...args) {
          if (this.fillStyle === "#f0f7ff" && this.__publicArc?.r === 6) {
            window.__rouletteBalls.push({ ...this.__publicArc });
            if (window.__rouletteBalls.length > 180)
              window.__rouletteBalls.shift();
          }
          return fill.apply(this, args);
        };
      });
      await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3102");
      await page
        .getByRole("button", { name: "Entrenamiento gratis", exact: true })
        .tap();
      const start = page.waitForResponse((r) =>
        r.url().includes("/verified-match/start"),
      );
      await page
        .getByRole("button", {
          name: "Jugar a Galactic Roulette",
          exact: true,
        })
        .tap();
      const issued = await (await start).json();
      assert.equal(issued.manifest.game_id, "galactic-roulette");
      await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
      await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
      await page.waitForTimeout(150);
      const select = page.getByRole("combobox", {
        name: "Apuesta de ruleta",
        exact: true,
      });
      const box = await select.boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44);
      assert.equal(await select.locator("option").count(), 46);
      assert.equal(await page.getByRole("slider").count(), 0);
      await select.selectOption("BET_EVEN");
      await page.waitForTimeout(80);
      assert.equal(await select.inputValue(), "BET_EVEN");
      const cdp = await context.newCDPSession(page),
        canvas = page.locator("canvas.gameCanvas");
      let submits = 0,
        done = false,
        spins = 0;
      page.on("request", (r) => {
        if (r.url().includes("/verified-match/verify")) submits++;
      });
      const response = page
        .waitForResponse((r) => r.url().includes("/verified-match/verify"), {
          timeout: 200000,
        })
        .then((r) => {
          done = true;
          return r;
        });
      response.catch(() => {});
      async function flick(cancel = false) {
        await canvas.scrollIntoViewIfNeeded();
        const b = await canvas.boundingBox(),
          k = Math.min(b.width / 390, b.height / 400),
          ox = (b.width - 390 * k) / 2,
          oy = (b.height - 400 * k) / 2;
        const x = b.x + ox + 323 * k,
          y = b.y + oy + 330 * k;
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: b.x + ox + 285 * k, y: b.y + oy + 299 * k }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: cancel ? "touchCancel" : "touchEnd",
          touchPoints: [],
        });
      }
      await flick(true);
      await page.waitForTimeout(200);
      assert.equal(await page.evaluate(() => window.__rouletteNumber), null);
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      if (process.env.QA_LAYOUT_ONLY) {
        await flick();
        await page.waitForTimeout(650);
        assert.ok(
          (await page.locator(".coreHud").innerText()).startsWith("95.00"),
          "native wheel release launches once",
        );
        await page.getByRole("button", { name: "Volver", exact: true }).tap();
        const vr = await response,
          body = vr.request().postDataJSON(),
          receipt = await vr.json();
        assert.equal(receipt.received, true);
        assert.equal(receipt.verified, false);
        assert.equal(
          body.inputs.filter((i) => i.action.startsWith("LAUNCH_")).length,
          1,
        );
        assert.deepEqual(errors, []);
        console.log(
          JSON.stringify({
            viewport: page.viewportSize(),
            all46Options: true,
            minTarget44: true,
            dragPowerAndDirection: true,
            singleLaunch: true,
            prefixReceipt: true,
          }),
        );
        await context.close();
        continue;
      }
      while (!done) {
        const n = await page.evaluate(() => window.__rouletteNumber);
        if (n !== null) {
          const predicted = core.create(issued.manifest.seed);
          predicted.wheelPhase = 0;
          predicted.ballPhase = roundDiv(ROULETTE_WHEEL.indexOf(n) * 65536, 37);
          predicted.lastNumber = n;
          assert.ok(applyCoreInput(core, predicted, "LAUNCH_CW_06", 1e9));
          for (let i = 0; i < 624; i++) stepCore(core, predicted, 1e9);
          const target = process.env.QA_LOSS
            ? (predicted.lastNumber + 1) % 37
            : predicted.lastNumber;
          await select.selectOption(
            `BET_NUMBER_${String(target).padStart(2, "0")}`,
          );
          await page.waitForTimeout(60);
        }
        if (done) break;
        await flick();
        spins++;
        if (spins === 1) {
          await page.waitForTimeout(600);
          const frames = await page.evaluate(() => window.__rouletteBalls);
          assert.ok(
            new Set(frames.map((p) => `${p.x.toFixed(2)}:${p.y.toFixed(2)}`))
              .size > 5,
            `visible flying ball: ${JSON.stringify({ hud: await page.locator(".coreHud").innerText(), frames: frames.slice(-3), canvas: await canvas.boundingBox() })}`,
          );
          await page.screenshot({
            path: `/workspace/.cloud-setup/roulette-${landscape ? "landscape" : "portrait"}.png`,
          });
          await page.waitForTimeout(4750);
        } else await page.waitForTimeout(5350);
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
      assert.equal(result.verified, true);
      assert.equal(replay.valid, true, replay.error);
      assert.equal(result.score, replay.score);
      assert.equal(result.height, replay.state.balanceMinor);
      assert.equal(submits, 1);
      assert.ok(!("score" in body) && !("balanceMinor" in body));
      assert.equal(
        body.inputs.filter((i) => i.action.startsWith("LAUNCH_")).length,
        replay.state.spins,
      );
      assert.ok(
        body.inputs
          .filter((i) => i.action.startsWith("LAUNCH_"))
          .every((i) => i.action === "LAUNCH_CW_06"),
      );
      if (process.env.QA_LOSS) {
        assert.equal(result.won, false);
        assert.equal(result.score, 0);
      } else {
        assert.equal(body.final_tick, 21600);
        assert.equal(result.won, true);
        assert.ok(result.score > 10000);
      }
      await page.getByText("Saldo ficticio final", { exact: true }).waitFor();
      await page.waitForTimeout(450);
      const restarting = page.waitForResponse((r) =>
        r.url().includes("/verified-match/start"),
      );
      await page.getByRole("button", { name: "OTRA VEZ", exact: true }).tap();
      const fresh = await (await restarting).json();
      assert.notEqual(fresh.ticket.attempt_id, issued.ticket.attempt_id);
      await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
      await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
      await page.waitForTimeout(300);
      const abandoning = page.waitForResponse((r) =>
        r.url().includes("/verified-match/verify"),
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
          spins: replay.state.spins,
          score: result.score,
          finalTick: body.final_tick,
          flight: true,
          rotation: true,
          restart: true,
          abandonedReceipt: true,
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
