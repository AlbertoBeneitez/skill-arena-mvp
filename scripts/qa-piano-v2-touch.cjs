// Real native touch. Read the visible next tile, never mutate the core or its seed.
const { chromium } = require(
    process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
  ),
  assert = require("node:assert/strict"),
  { register } = require("node:module"),
  { pathToFileURL } = require("node:url"),
  path = require("node:path");
register(pathToFileURL(path.join(__dirname, "determinism-loader.mjs")));
(async () => {
  const base = pathToFileURL(path.join(__dirname, "../.det-test/")).href,
    { PIANO_V3_CORE: core } = await import(
      base + "lib/verified/pianoRushCore.v3.js"
    ),
    { replayCore } = await import(base + "lib/verified/coreRuntime.v1.js");
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const landscape = !!process.env.QA_LANDSCAPE,
      loss = !!process.env.QA_LOSS,
      context = await browser.newContext({
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
    await page.addInitScript(() => {
      localStorage.setItem(
        "skill-arena-v12",
        JSON.stringify({
          onboarded: true,
          playerName: "QA_Piano",
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
      window.__oscillators = 0;
      const tone = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function (...a) {
        window.__oscillators++;
        return tone.apply(this, a);
      };
      const p = CanvasRenderingContext2D.prototype,
        clear = p.clearRect,
        rect = p.fillRect;
      p.clearRect = function (...a) {
        if (this.canvas.classList.contains("gameCanvas"))
          window.__rhythmTile = null;
        return clear.apply(this, a);
      };
      p.fillRect = function (x, y, w, h, ...a) {
        if (
          this.canvas.classList.contains("gameCanvas") &&
          this.fillStyle === "#e9f7ff" &&
          h === 82 &&
          w === 79.5
        )
          window.__rhythmTile = { x, y, w, h };
        return rect.call(this, x, y, w, h, ...a);
      };
    });
    let starts = 0,
      submits = 0;
    page.on("request", (r) => {
      if (r.url().includes("/verified-match/start")) starts++;
      if (r.url().includes("/verified-match/verify")) submits++;
    });
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3052");
    const started = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Piano Rush", exact: true })
      .tap();
    const issued = await (await started).json();
    assert.equal(issued.manifest.game_version, "3.0.0");
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    assert.doesNotMatch(await page.locator(".coreHud").innerText(), /SECTOR|NIVEL/);
    const cdp = await context.newCDPSession(page),
      box = await page.locator("canvas.gameCanvas").boundingBox(),
      scale = Math.min(box.width / 390, box.height / 620),
      ox = (box.width - 390 * scale) / 2,
      oy = (box.height - 620 * scale) / 2;
    const point = (lane) => ({
      x: box.x + ox + (lane + 0.5) * 97.5 * scale,
      y: box.y + oy + 555 * scale,
    });
    for (const b of await page.locator(".coreControls button").all()) {
      const r = await b.boundingBox();
      assert.ok(r.width >= 44 && r.height >= 44);
    }
    async function press(lane) {
      let p = point(lane);
      if (landscape) {
        const b = await page
          .getByRole("button", {
            name: `Pulsar carril ${lane + 1}`,
            exact: true,
          })
          .boundingBox();
        p = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [p],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    }
    // A cancelled early touch is already a tap, but warmup protects shields.
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [point(0)],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page
      .getByRole("button", { name: "Activar sonido", exact: true })
      .tap();
    let done = false,
      armed = true,
      screenshot = false;
    const verified = page.waitForResponse(
      (r) => r.url().includes("/verified-match/verify"),
      { timeout: 120000 },
    );
    verified.then(() => (done = true)).catch(() => {});
    for (let turn = 0; !done && turn < 4500; turn++) {
      const tile = await page.evaluate(() => window.__rhythmTile);
      if (tile) {
        const bottom = tile.y + tile.h;
        if (bottom < 500) armed = true;
        if (!loss && armed && bottom >= 528) {
          if (done || (await page.locator(".resultPanel").isVisible())) break;
          await press(Math.floor(tile.x / 97.5));
          armed = false;
        }
      }
      if (turn % 500 === 0)
        console.log("progress", await page.locator(".coreHud").innerText());
      if (!screenshot && turn > 700 && process.env.QA_SCREENSHOT) {
        await page.screenshot({ path: process.env.QA_SCREENSHOT });
        screenshot = true;
      }
      await page.waitForTimeout(15);
    }
    const response = await verified,
      result = await response.json(),
      body = response.request().postDataJSON(),
      replay = replayCore(
        core,
        body.inputs,
        body.final_tick,
        issued.manifest.seed,
        issued.manifest.competition.target_score,
      );
    console.log(
      "result",
      JSON.stringify({
        result,
        correct: replay.state.correct,
        resolved: replay.state.nextNoteIndex,
        inputs: body.inputs.length,
      }),
    );
    assert.equal(result.verified, true);
    assert.equal(replay.valid, true, replay.error);
    assert.equal(result.score, replay.score);
    assert.equal(result.won, !loss);
    if (loss) {
      assert.equal(replay.failure, "MISSED_NOTES");
      assert.ok(body.final_tick > 960);
    } else {
      assert.equal(replay.state.correct, 48);
      assert.equal(replay.state.nextNoteIndex, 48);
    }
    assert.equal(starts, 1, "sound/blur do not reset");
    assert.equal(submits, 1);
    assert.ok(await page.evaluate(() => window.__oscillators > 0));
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.locator(".resultPanel").waitFor({ state: "visible" });
    const again = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page.getByRole("button", { name: "OTRA VEZ", exact: true }).tap();
    const next = await (await again).json();
    assert.notEqual(next.manifest.match_id, issued.manifest.match_id);
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    await page.setViewportSize(
      landscape ? { width: 320, height: 740 } : { width: 844, height: 390 },
    );
    for (const b of await page.locator(".coreControls button").all()) {
      const r = await b.boundingBox();
      assert.ok(r.width >= 44 && r.height >= 44);
    }
    assert.equal(starts, 2);
    assert.equal(await page.locator(".resultPanel").isVisible(), false);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        orientation: landscape ? "landscape" : "portrait",
        won: result.won,
        score: result.score,
        finalTick: body.final_tick,
        correct: replay.state.correct,
        lives: replay.state.lives,
        restart: true,
        orientationChange: true,
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
