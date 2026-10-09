// Native touch five-table play, actual server-issued seed and final replay comparison.
const { chromium } = require(
    process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
  ),
  assert = require("node:assert/strict"),
  { register } = require("node:module"),
  { pathToFileURL } = require("node:url"),
  path = require("node:path");
register(pathToFileURL(path.join(__dirname, "determinism-loader.mjs")));
(async () => {
  const {
      BILLIARDS_CORE: core,
      billiardsDirection,
      forecastBilliards,
    } = await import(
      pathToFileURL(
        path.join(__dirname, "../.det-test/lib/verified/billiardsCore.v1.js"),
      )
    ),
    { chooseBilliardsShot } = await import(
      pathToFileURL(
        path.join(__dirname, "../.det-test/scripts/billiards-play-fixture.js"),
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
    const context = await browser.newContext({
        viewport: process.env.QA_LANDSCAPE
          ? { width: 844, height: 390 }
          : { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem(
        "skill-arena-v12",
        JSON.stringify({
          onboarded: true,
          playerName: "QA-Billar",
          balance: 25,
          netEarnings: 0,
          nextTurn: "create",
          musicOn: false,
          earnings: [{ label: "Inicio", value: 0 }],
          movements: [],
          wins: 0,
          losses: 0,
          streak: 0,
          group: null,
        }),
      );
      localStorage.setItem("skill-arena-color-tutorial-v12", "1");
    });
    await page.route("**/api/verified-match/start", (r) =>
      r.continue({
        postData: JSON.stringify({
          ...r.request().postDataJSON(),
          target_score: 1000000,
        }),
      }),
    );
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3000");
    await page.locator(".quickStakeBar button").first().click();
    const start = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Billar", exact: true })
      .click();
    const issued = await (await start).json();
    assert.equal(issued.manifest.game_version, "1.0.0");
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    await page.waitForTimeout(150);
    const cdp = await context.newCDPSession(page),
      canvas = page.locator("canvas.gameCanvas");
    async function touch(x, y, cancel = false) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: cancel ? "touchCancel" : "touchEnd",
        touchPoints: [],
      });
    }
    async function button(name) {
      const b = page.getByRole("button", { name, exact: true });
      await b.scrollIntoViewIfNeeded();
      const box = await b.boundingBox();
      await touch(box.x + box.width / 2, box.y + box.height / 2);
    }
    let state = core.create(issued.manifest.seed),
      shots = 0,
      submits = 0;
    page.on("request", (r) => {
      if (r.url().includes("/verified-match/verify")) submits++;
    });
    const response = page.waitForResponse(
      (r) => r.url().includes("/verified-match/verify"),
      { timeout: 180000 },
    );
    response.catch(() => {});
    const initialBox = await canvas.boundingBox();
    await touch(
      initialBox.x + initialBox.width / 2,
      initialBox.y + initialBox.height * 0.5,
      true,
    );
    await page.waitForTimeout(100);
    while (state.status === "running") {
      const chosen = process.env.QA_LOSS
          ? { aim: 0, power: 0 }
          : chooseBilliardsShot(state),
        cue = state.balls[0],
        d = billiardsDirection(chosen.aim);
      await canvas.scrollIntoViewIfNeeded();
      const box = await canvas.boundingBox(),
        scale = Math.min(box.width / 390, box.height / 620),
        ox = (box.width - 390 * scale) / 2,
        oy = (box.height - 620 * scale) / 2;
      await touch(
        box.x + ox + (cue.x / 1000 + (d.x / d.length) * 55) * scale,
        box.y + oy + (cue.y / 1000 + (d.y / d.length) * 55) * scale,
      );
      await page.waitForTimeout(40);
      await button(
        ["Potencia suave", "Potencia media", "Potencia fuerte"][chosen.power],
      );
      await page.waitForTimeout(40);
      await button("Tirar bola");
      await button("Tirar bola");
      shots++;
      const next = forecastBilliards(state, chosen.aim, chosen.power).state;
      // Wait the exact motion/settle duration plus a UI margin; decisions don't change stationary physics.
      const ticks = next.tick - state.tick + (next.phase === "settle" ? 72 : 0);
      if (
        next.status === "failed" ||
        (next.phase === "settle" && next.stage === 4)
      ) {
        const verifiedResponse = await response,
          body = verifiedResponse.request().postDataJSON(),
          result = await verifiedResponse.json();
        assert.equal(result.verified, true);
        assert.equal(result.won, !process.env.QA_LOSS);
        const replay = replayCore(
          core,
          body.inputs,
          body.final_tick,
          issued.manifest.seed,
          1000000,
        );
        assert.equal(replay.valid, true, replay.error);
        assert.equal(replay.score, result.score);
        assert.equal(
          replay.state.totalShots,
          shots,
          "double tap and cancel never add shots",
        );
        await page.locator(".resultPanel").waitFor({ state: "visible" });
        assert.equal(submits, 1);
        assert.equal(
          await page.evaluate(
            () => document.body.scrollWidth > window.innerWidth,
          ),
          false,
        );
        await page
          .getByRole("button", { name: "CAMBIAR", exact: true })
          .click();
        const restart = page.waitForResponse((r) =>
          r.url().includes("/verified-match/start"),
        );
        await page
          .getByRole("button", { name: "Jugar a Billar", exact: true })
          .click();
        const again = await (await restart).json();
        assert.notEqual(again.manifest.match_id, issued.manifest.match_id);
        await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
        assert.equal(await page.locator(".resultPanel").isVisible(), false);
        if (process.env.QA_SCREENSHOT)
          await page.screenshot({ path: process.env.QA_SCREENSHOT });
        console.log(
          JSON.stringify({
            orientation: process.env.QA_LANDSCAPE ? "landscape" : "portrait",
            verified: true,
            won: result.won,
            score: result.score,
            shots,
            finalTick: body.final_tick,
            failure: result.failure,
            errors,
          }),
        );
        assert.deepEqual(errors, []);
        break;
      }
      await page.waitForTimeout((ticks / 120) * 1000 + 220);
      state = next;
      if (state.phase === "settle") {
        for (let i = 0; i < 72; i++) core.step(state);
      }
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
