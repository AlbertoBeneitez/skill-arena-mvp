// Real touchscreen betting/toss/full result/restart; public Canvas observation only.
const { chromium } = require(
    process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
  ),
  assert = require("node:assert/strict"),
  { register } = require("node:module"),
  { pathToFileURL } = require("node:url"),
  path = require("node:path");
register(pathToFileURL(path.join(__dirname, "determinism-loader.mjs")));
(async () => {
  const b = pathToFileURL(path.join(__dirname, "../.det-test/")).href;
  const { ROULETTE_CORE_V3: core } = await import(
      b + "lib/verified/galacticRouletteCore.v3.js"
    ),
    { replayCore } = await import(b + "lib/verified/coreRuntime.v1.js");
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
            playerName: "QA-Roulette2",
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
        window.__tapTrace = [];
        for (const name of ["pointerdown", "pointerup", "click"])
          document.addEventListener(
            name,
            (e) => {
              window.__tapTrace.push({
                type: name,
                tag: e.target.tagName,
                className: e.target.className,
                text: e.target.textContent?.slice(0, 40),
              });
            },
            true,
          );
        window.__rouletteFrames = [];
        window.__roulettePhase = 0;
        const text = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (t, ...a) {
          if (
            this.canvas.classList.contains("gameCanvas") &&
            this.font === "bold 11px system-ui" &&
            String(t) === "0"
          ) {
            const m = this.getTransform();
            window.__roulettePhase =
              Math.round(
                (((Math.atan2(m.b, m.a) + Math.PI * 2) % (Math.PI * 2)) *
                  65536) /
                  (Math.PI * 2),
              ) % 65536;
          }
          return text.call(this, t, ...a);
        };
        const arc = CanvasRenderingContext2D.prototype.arc;
        CanvasRenderingContext2D.prototype.arc = function (x, y, r, ...a) {
          this.__arc = { x, y, r };
          return arc.call(this, x, y, r, ...a);
        };
        const fill = CanvasRenderingContext2D.prototype.fill;
        CanvasRenderingContext2D.prototype.fill = function (...a) {
          if (
            this.canvas.classList.contains("gameCanvas") &&
            this.fillStyle === "#f0f7ff"
          ) {
            window.__rouletteFrames.push({ ...this.__arc });
            if (window.__rouletteFrames.length > 300)
              window.__rouletteFrames.shift();
          }
          return fill.apply(this, a);
        };
      });
      await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3129");
      const starting = page.waitForResponse((r) =>
        r.url().includes("/verified-match/start"),
      );
      await page
        .getByRole("button", { name: "Jugar a Galactic Roulette", exact: true })
        .tap();
      const issued = await (await starting).json();
      assert.equal(issued.manifest.game_version, "3.0.0");
      await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
      await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
      const cdp = await context.newCDPSession(page),
        canvas = page.locator("canvas.gameCanvas"),
        summary = page.locator(".coreChoiceTrigger"),
        panel = page.locator(".coreChoicePanel");
      async function tap(locator) {
        await locator.scrollIntoViewIfNeeded();
        const r = await locator.boundingBox();
        await cdp.send("Input.synthesizeTapGesture", {
          x: r.x + r.width / 2,
          y: r.y + r.height / 2,
          duration: 80,
        });
      }
      async function bet(action) {
        if (
          !(await panel.evaluate(
            (e) => !e.querySelector(".coreChoiceGrid").hidden,
          ))
        )
          await tap(summary);
        await tap(page.locator(`button[data-choice="${action}"]`));
        await page.waitForTimeout(35);
        assert.equal(
          await panel.evaluate(
            (e) => !e.querySelector(".coreChoiceGrid").hidden,
          ),
          false,
        );
      }
      await page.waitForFunction(
        () =>
          document.querySelector('button[data-choice="BET_EVEN"]')?.disabled ===
          false,
      );
      // Compatibility clicks must not land on a newly exposed betting cell.
      const originalBet = await summary.innerText();
      const closedBounds = await summary.boundingBox();
      await summary.tap();
      await page.waitForTimeout(80);
      assert.equal(await summary.innerText(), originalBet);
      assert.equal(await summary.getAttribute("aria-expanded"), "true");
      const openBounds = await summary.boundingBox();
      assert.ok(Math.abs(openBounds.y - closedBounds.y) < 1, "trigger must stay anchored");
      await summary.tap();
      assert.equal(await summary.getAttribute("aria-expanded"), "false");
      await tap(summary);
      if (
        !(await panel.evaluate(
          (e) => !e.querySelector(".coreChoiceGrid").hidden,
        ))
      ) {
        await page.screenshot({
          path: "/workspace/.cloud-setup/roulette-menu-failure.png",
        });
        console.log(
          JSON.stringify({
            trace: await page.evaluate(() => window.__tapTrace),
            summary: await summary.boundingBox(),
            panel: await panel.boundingBox(),
            viewport: page.viewportSize(),
          }),
        );
      }
      assert.equal(
        await panel.evaluate((e) => !e.querySelector(".coreChoiceGrid").hidden),
        true,
      );
      assert.equal(await panel.locator("button[data-choice]").count(), 49);
      for (const button of await panel.locator("button[data-choice]").all()) {
        const r = await button.boundingBox();
        assert.ok(
          r.width >= 44 && r.height >= 44,
          JSON.stringify({
            action: await button.getAttribute("data-choice"),
            rect: r,
          }),
        );
      }
      assert.equal(await page.getByRole("slider").count(), 0);
      assert.equal(await page.getByRole("combobox").count(), 0);
      const zero = page.locator('button[data-choice="BET_NUMBER_00"]');
      assert.equal(
        await zero.evaluate((e) => getComputedStyle(e).backgroundColor),
        "rgb(233, 238, 237)",
      );
      if (process.env.QA_TABLE_SCREENSHOT)
        await page.screenshot({
          path: `/workspace/.cloud-setup/tapete-${landscape ? "landscape" : "portrait"}.png`,
        });
      if (process.env.QA_LAYOUT_ONLY) {
        const original = page.viewportSize();
        await page.setViewportSize(
          landscape ? { width: 320, height: 568 } : { width: 568, height: 320 },
        );
        await page.waitForTimeout(120);
        assert.equal(
          await panel.evaluate(
            (e) => !e.querySelector(".coreChoiceGrid").hidden,
          ),
          true,
        );
        const r = await panel.boundingBox();
        assert.ok(
          r.y >= 0 && r.y + r.height <= page.viewportSize().height,
          "open table fits after rotation",
        );
        await page.setViewportSize(original);
        await page.waitForTimeout(120);
      }
      await bet("BET_EVEN");
      let submits = 0,
        done = false;
      page.on("request", (r) => {
        if (r.url().includes("/verified-match/verify")) submits++;
      });
      const response = page
        .waitForResponse((r) => r.url().includes("/verified-match/verify"), {
          timeout: 210000,
        })
        .then((r) => {
          done = true;
          return r;
        });
      response.catch(() => {});
      async function toss(cancel = false, blur = false) {
        await canvas.scrollIntoViewIfNeeded();
        const r = await canvas.boundingBox(),
          k = Math.min(r.width / 390, r.height / 400),
          ox = (r.width - 390 * k) / 2,
          oy = (r.height - 400 * k) / 2;
        const dest = process.env.QA_LOSS
          ? { x: 365, y: 330 }
          : { x: 250, y: 250 };
        const point = (p) => ({ x: r.x + ox + p.x * k, y: r.y + oy + p.y * k });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [point({ x: 323, y: 330 })],
        });
        await page.waitForTimeout(40);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [point(dest)],
        });
        if (blur)
          await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await cdp.send("Input.dispatchTouchEvent", {
          type: cancel ? "touchCancel" : "touchEnd",
          touchPoints: [],
        });
      }
      await toss(true);
      await toss(false, true);
      await page.waitForTimeout(100);
      assert.ok(
        (await page.locator(".coreHud").innerText()).startsWith("100.00"),
      );
      if (process.env.QA_LAYOUT_ONLY) {
        await toss();
        await page.waitForTimeout(150);
        assert.equal(await summary.isDisabled(),true,"betting locked during flight");
        await tap(page.getByRole("button", { name: "Volver", exact: true }));
        const vr = await response,
          record = vr.request().postDataJSON(),
          receipt = await vr.json();
        assert.deepEqual(
          record.inputs
            .filter((i) => i.action.startsWith("RELEASE_"))
            .map((i) => i.action),
          ["RELEASE_X_25", "RELEASE_Y_25"],
        );
        assert.equal(receipt.received, true);
        assert.equal(
          record.inputs.filter((i) => i.action.startsWith("TOSS_")).length,
          1,
        );
        assert.deepEqual(errors, []);
        console.log(
          JSON.stringify({
            landscape,
            small: true,
            all49bets: true,
            touch44: true,
            oneToss: true,
            prefix: true,
          }),
        );
        await context.close();
        continue;
      }
      let spins = 0;
      while (!done) {
        if (done) break;
        await toss();
        spins++;
        await page.waitForTimeout(700);
        if (spins === 1) {
          const frames = await page.evaluate(() => window.__rouletteFrames);
          assert.ok(new Set(frames.map((p) => `${p.x}:${p.y}`)).size > 8);
          assert.ok(
            frames.some((p) => p.r > 7),
            "ball visibly rises above table",
          );
          await page.screenshot({
            path: `/workspace/.cloud-setup/roulette2-${landscape ? "landscape" : "portrait"}.png`,
          });
        }
        while (
          !done &&
          (await page.locator('button[data-choice="BET_EVEN"]').isDisabled())
        )
          await page.waitForTimeout(90);
        if (spins === 3 && !done) {
          await page.setViewportSize(
            landscape
              ? { width: 390, height: 844 }
              : { width: 844, height: 390 },
          );
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          );
        }
      }
      const vr = await response,
        record = vr.request().postDataJSON(),
        result = await vr.json(),
        replay = replayCore(
          core,
          record.inputs,
          record.final_tick,
          issued.manifest.seed,
          issued.manifest.competition.target_score,
        );
      assert.equal(result.verified, true);
      assert.equal(replay.valid, true, replay.error);
      assert.equal(result.score, replay.score);
      assert.equal(submits, 1);
      assert.ok(!("score" in record) && !("balanceMinor" in record));
      assert.equal(
        record.inputs.filter((i) => i.action.startsWith("TOSS_")).length,
        replay.state.spins,
      );
      assert.equal(result.won, !process.env.QA_LOSS);
      if (!process.env.QA_LOSS) assert.equal(record.final_tick, 21600);
      else {
        assert.equal(result.score, 0);
        assert.equal(replay.state.spins, 20);
      }
      await page.locator(".resultPanel").waitFor({ state: "visible" });
      await page.waitForFunction(
        () => !document.querySelector("fieldset.resultActions")?.disabled,
      );
      const restarting = page.waitForResponse((r) =>
        r.url().includes("/verified-match/start"),
      );
      await tap(page.getByRole("button", { name: "OTRA VEZ", exact: true }));
      const fresh = await (await restarting).json();
      assert.notEqual(fresh.ticket.attempt_id, issued.ticket.attempt_id);
      await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
      const abandoned = page.waitForResponse((r) =>
        r.url().includes("/verified-match/verify"),
      );
      await page.waitForTimeout(150);
      await tap(page.getByRole("button", { name: "Volver", exact: true }));
      const receipt = await (await abandoned).json();
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
          finalTick: record.final_tick,
          flight: true,
          all49bets: true,
          rotation: true,
          restart: true,
          prefix: true,
          errors,
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
