// Native mobile game QA. Mirror uses the common core only to steer visible placements;
// final assertions replay the actual posted inputs, not the steering predictions.
const { chromium } = require(
    process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
  ),
  assert = require("node:assert/strict"),
  { register } = require("node:module"),
  { pathToFileURL } = require("node:url"),
  path = require("node:path");
register(pathToFileURL(path.join(__dirname, "determinism-loader.mjs")));
(async () => {
  const b = pathToFileURL(path.join(__dirname, "../.det-test/")).href,
    { STACK_SHIFT_CORE: core } = await import(
      b + "lib/verified/stackShiftCore.v1.js"
    ),
    { chooseStackPlacement } = await import(
      b + "scripts/stack-shift-play-fixture.js"
    ),
    { advanceCoreToTick, applyCoreInput, replayCore } = await import(
      b + "lib/verified/coreRuntime.v1.js"
    );
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const landscape = Boolean(process.env.QA_LANDSCAPE),
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
          playerName: "QA-StackShift",
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
      const raf = requestAnimationFrame;
      window.requestAnimationFrame = (cb) => {
        if (window.__issued && !window.__epoch)
          window.__epoch = performance.now();
        return raf(cb);
      };
      const f = fetch;
      window.fetch = (...a) =>
        f(...a).then((r) => {
          if (String(a[0]).includes("/verified-match/start"))
            window.__issued = true;
          return r;
        });
    });
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3035");
    await page.locator(".quickStakeBar button").first().click();
    const start = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Stack Shift", exact: true })
      .click();
    const issued = await (await start).json();
    assert.equal(issued.manifest.game_version, "1.0.0");
    const s = core.create(issued.manifest.seed),
      target = issued.manifest.competition.target_score;
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    assert.ok(
      (await page.locator(".coreHud").innerText()).includes("/18 FILAS"),
      "physical HUD keeps progression readable",
    );
    const canvas = await page.locator("canvas.gameCanvas").boundingBox(),
      controls = await page.locator(".coreControls").boundingBox();
    assert.ok(
      landscape
        ? controls.x >= canvas.x + canvas.width
        : controls.y >= canvas.y + canvas.height,
      "controls must not hide the board/floor",
    );
    const cdp = await context.newCDPSession(page),
      points = {};
    const names = {
      LEFT: "Mover izquierda",
      RIGHT: "Mover derecha",
      ROTATE: "Girar pieza",
      HARD_DROP: "Asentar pieza",
    };
    for (const [a, name] of Object.entries(names)) {
      const box = await page
        .getByRole("button", { name, exact: true })
        .boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44);
      points[a] = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }
    let done = false,
      submits = 0;
    page.on("request", (r) => {
      if (r.url().includes("/verified-match/verify")) submits++;
    });
    const verified = page.waitForResponse(
      (r) => r.url().includes("/verified-match/verify"),
      { timeout: 240000 },
    );
    verified
      .then(() => {
        done = true;
      })
      .catch(() => {});
    async function sync() {
      const tick = await page.evaluate(() =>
        Math.floor(((performance.now() - window.__epoch) * 120) / 1000),
      );
      advanceCoreToTick(core, s, tick, target);
    }
    async function tap(a, cancel = false) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [points[a]],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: cancel ? "touchCancel" : "touchEnd",
        touchPoints: [],
      });
    }
    let plan = null,
      plannedIndex = -1,
      doubleTested = false,
      screenshotTaken = false;
    for (let turns = 0; !done && turns < 1000; turns++) {
      await sync();
      if (s.status !== "running") break;
      if (!s.pieceActive) {
        await page.waitForTimeout(100);
        continue;
      }
      if (s.pieceIndex !== plannedIndex) {
        plan = process.env.QA_LOSS
          ? { rotation: s.rotation, x: s.x }
          : chooseStackPlacement(s);
        plannedIndex = s.pieceIndex;
      }
      const a =
        s.rotation !== plan.rotation
          ? "ROTATE"
          : s.x !== plan.x
            ? s.x > plan.x
              ? "LEFT"
              : "RIGHT"
            : "HARD_DROP";
      if (!core.canApply(s, a)) {
        await page.waitForTimeout(80);
        continue;
      }
      await tap(a, a === "LEFT" && !doubleTested);
      await sync();
      if (core.canApply(s, a)) applyCoreInput(core, s, a, target);
      if (a === "HARD_DROP" && !doubleTested) {
        await tap(a);
        doubleTested = true;
      }
      if (a === "HARD_DROP") {
        if (!screenshotTaken && process.env.QA_SCREENSHOT) {
          await page.screenshot({ path: process.env.QA_SCREENSHOT });
          screenshotTaken = true;
        }
        await page.waitForTimeout(300);
      } else await page.waitForTimeout(100);
    }
    const vr = await verified,
      body = vr.request().postDataJSON(),
      result = await vr.json(),
      replay = replayCore(
        core,
        body.inputs,
        body.final_tick,
        issued.manifest.seed,
        target,
      );
    assert.equal(result.verified, true);
    assert.equal(replay.valid, true, replay.error);
    assert.equal(result.score, replay.score);
    assert.equal(result.won, !process.env.QA_LOSS);
    assert.equal(submits, 1);
    assert.ok(doubleTested);
    if (process.env.QA_LOSS) assert.equal(replay.failure, "TOP_OUT");
    else assert.ok(replay.state.lines >= 18);
    const drops = body.inputs.filter((i) => i.action === "HARD_DROP");
    assert.equal(
      drops.length,
      replay.state.pieces,
      "double tap must not add a piece",
    );
    assert.ok(replay.state.board.every((row) => row.length === 8));
    await page.locator(".resultPanel").waitFor({ state: "visible" });
    assert.equal(
      await page.evaluate(() => document.body.scrollWidth > innerWidth),
      false,
    );
    await page.getByRole("button", { name: "CAMBIAR", exact: true }).click();
    const restart = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Stack Shift", exact: true })
      .click();
    const again = await (await restart).json();
    assert.notEqual(again.manifest.match_id, issued.manifest.match_id);
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    assert.equal(await page.locator(".resultPanel").isVisible(), false);
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        orientation: landscape ? "landscape" : "portrait",
        verified: true,
        won: result.won,
        score: result.score,
        finalTick: body.final_tick,
        lines: replay.state.lines,
        pieces: replay.state.pieces,
        inputs: body.inputs.length,
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
