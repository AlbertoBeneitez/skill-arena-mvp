// Real rendered activation pixel, native mobile touches and actual server replay.
const { chromium } = require(
    process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
  ),
  assert = require("node:assert/strict"),
  { register } = require("node:module"),
  { pathToFileURL } = require("node:url"),
  path = require("node:path");
register(pathToFileURL(path.join(__dirname, "determinism-loader.mjs")));
(async () => {
  const { SHOT_GALLERY_CORE: core } = await import(
      pathToFileURL(
        path.join(__dirname, "../.det-test/lib/verified/shotGalleryCore.v1.js"),
      )
    ),
    { SHOT_GALLERY_SLOTS: slots } = await import(
      pathToFileURL(
        path.join(
          __dirname,
          "../.det-test/lib/verified/shotGalleryProtocol.v1.js",
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
          playerName: "QA-Shot",
          balance: 25,
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
      .getByRole("button", { name: "Jugar a Shot Gallery", exact: true })
      .click();
    const issued = await (await start).json();
    assert.equal(issued.manifest.game_id, "reaction-test");
    assert.equal(issued.manifest.game_version, "1.0.0");
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    await page.waitForTimeout(100);
    const state = core.create(issued.manifest.seed),
      cdp = await context.newCDPSession(page),
      canvas = page.locator("canvas.gameCanvas");
    let submits = 0;
    page.on("request", (r) => {
      if (r.url().includes("/verified-match/verify")) submits++;
    });
    const response = page.waitForResponse(
      (r) => r.url().includes("/verified-match/verify"),
      { timeout: 90000 },
    );
    response.catch(() => {});
    async function touchLogical(x, y, cancel = false) {
      const b = await canvas.boundingBox(),
        scale = Math.min(b.width / 390, b.height / 620),
        ox = (b.width - 390 * scale) / 2,
        oy = (b.height - 620 * scale) / 2;
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: b.x + ox + x * scale, y: b.y + oy + y * scale }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: cancel ? "touchCancel" : "touchEnd",
        touchPoints: [],
      });
    }
    await touchLogical(195, 145, true);
    for (let i = 0; i < 12; i++) {
      if (!process.env.QA_EARLY) {
        await page.waitForFunction(
          () => {
            const c = document.querySelector("canvas.gameCanvas"),
              ctx = c?.getContext("2d");
            if (!ctx) return false;
            const t = ctx.getTransform(),
              p = ctx.getImageData(
                Math.round(t.a * 195 + t.e),
                Math.round(t.d * 186 + t.f),
                1,
                1,
              ).data;
            return p[1] > 180 && p[1] > p[0] * 1.3;
          },
          {},
          { timeout: 15000, polling: 16 },
        );
        if (i === 0 && process.env.QA_SCREENSHOT)
          await page.screenshot({ path: process.env.QA_SCREENSHOT });
        await page.waitForTimeout(150);
      }
      const trial = state.trials[i],
        index = process.env.QA_EARLY
          ? 0
          : process.env.QA_WRONG
            ? (trial.answer + 1) % trial.cards.length
            : trial.answer,
        p = slots[index];
      await touchLogical(p.x + p.width / 2, p.y + p.height / 2);
      await touchLogical(p.x + p.width / 2, p.y + p.height / 2);
      if (i < 11) await page.waitForTimeout(process.env.QA_EARLY ? 950 : 900);
    }
    const vr = await response,
      body = vr.request().postDataJSON(),
      result = await vr.json(),
      replay = replayCore(
        core,
        body.inputs,
        body.final_tick,
        issued.manifest.seed,
        1000000,
      );
    assert.equal(result.verified, true);
    assert.equal(replay.valid, true, replay.error);
    assert.equal(result.score, replay.score);
    assert.equal(result.won, !process.env.QA_EARLY && !process.env.QA_WRONG);
    assert.equal(body.inputs.length, 12, "double touch never answers twice");
    assert.equal(replay.state.results.length, 12);
    assert.equal(submits, 1);
    if (process.env.QA_EARLY)
      assert.ok(replay.state.results.every((r) => r.type === "FALSE_START"));
    if (process.env.QA_WRONG)
      assert.ok(replay.state.results.every((r) => r.type === "WRONG"));
    await page.locator(".resultPanel").waitFor({ state: "visible" });
    assert.equal(
      await page.evaluate(() => document.body.scrollWidth > window.innerWidth),
      false,
    );
    await page.getByRole("button", { name: "OTRO JUEGO", exact: true }).click();
    const restart = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Shot Gallery", exact: true })
      .click();
    const again = await (await restart).json();
    assert.notEqual(again.manifest.match_id, issued.manifest.match_id);
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    assert.equal(await page.locator(".resultPanel").isVisible(), false);
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        orientation: process.env.QA_LANDSCAPE ? "landscape" : "portrait",
        mode: process.env.QA_EARLY
          ? "false-start"
          : process.env.QA_WRONG
            ? "wrong"
            : "correct",
        verified: true,
        won: result.won,
        score: result.score,
        correct: replay.state.correct,
        finalTick: body.final_tick,
        errors,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
