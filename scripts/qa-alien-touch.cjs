// Two minutes of real native input, platform/duck/attacker progression and actual server replay.
const { chromium } = require(
    process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
  ),
  assert = require("node:assert/strict"),
  { register } = require("node:module"),
  { pathToFileURL } = require("node:url"),
  path = require("node:path");
register(pathToFileURL(path.join(__dirname, "determinism-loader.mjs")));
(async () => {
  const { ALIEN_DASH_CORE: core } = await import(
      pathToFileURL(
        path.join(__dirname, "../.det-test/lib/verified/alienDashCore.v2.js"),
      )
    ),
    { chooseAlienAction } = await import(
      pathToFileURL(
        path.join(__dirname, "../.det-test/scripts/alien-play-fixture.js"),
      )
    ),
    { applyCoreInput, stepCore, replayCore } = await import(
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
          playerName: "QA-Alien",
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
      const raf = requestAnimationFrame;
      window.requestAnimationFrame = (cb) => {
        if (window.__issued && !window.__epoch)
          window.__epoch = performance.now();
        return raf(cb);
      };
      const fetchOriginal = fetch;
      window.fetch = (...args) =>
        fetchOriginal(...args).then((r) => {
          if (String(args[0]).includes("/verified-match/start"))
            window.__issued = true;
          return r;
        });
      window.__oscillators = 0;
      const create = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function (...args) {
        window.__oscillators++;
        return create.apply(this, args);
      };
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
      .getByRole("button", { name: "Jugar a Alien Dash", exact: true })
      .click();
    const issued = await (await start).json();
    assert.equal(issued.manifest.game_version, "2.0.0");
    const planned = core.create(issued.manifest.seed),
      inputs = [];
    while (planned.status === "running") {
      const a = chooseAlienAction(planned);
      if (a && core.canApply(planned, a)) {
        inputs.push({ tick: planned.tick, action: a });
        applyCoreInput(core, planned, a, 1000000);
      }
      stepCore(core, planned, 1000000);
    }
    assert.equal(planned.status, "won");
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    const response = page.waitForResponse(
      (r) => r.url().includes("/verified-match/verify"),
      { timeout: 180000 },
    );
    response.catch(() => {});
    let submits = 0;
    page.on("request", (r) => {
      if (r.url().includes("/verified-match/verify")) submits++;
    });
    const cdp = await context.newCDPSession(page);
    let held = false,
      audioChecked = false,
      finished = false;
    response
      .then(() => {
        finished = true;
      })
      .catch(() => {});
    const centers = new Map();
    async function buttonCenter(name) {
      if (centers.has(name)) return centers.get(name);
      const b = page.getByRole("button", { name, exact: true });
      await b.scrollIntoViewIfNeeded();
      const box = await b.boundingBox();
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      centers.set(name, center);
      return center;
    }
    async function down(name) {
      const p = await buttonCenter(name);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [p],
      });
    }
    async function up(cancel = false) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: cancel ? "touchCancel" : "touchEnd",
        touchPoints: [],
      });
    }
    // A held crouch must release on pointer cancel before the first hazard.
    await down("Mantener agachado");
    await up(true);
    await page
      .getByRole("button", { name: "Activar sonido", exact: true })
      .tap();
    if (process.env.QA_SCREENSHOT)
      await page.screenshot({ path: process.env.QA_SCREENSHOT });
    if (!process.env.QA_LOSS)
      for (const input of inputs) {
        if (finished) break;
        await page.waitForFunction(
          (t) =>
            window.__epoch &&
            performance.now() - window.__epoch >= (t * 1000) / 120,
          input.tick,
          { timeout: 15000, polling: 8 },
        );
        if (input.action === "JUMP") {
          if (held) {
            await up();
            held = false;
          }
          await down("Saltar");
          await up();
          await down("Saltar");
          await up();
        } else if (input.action === "DUCK_DOWN") {
          await down("Mantener agachado");
          held = true;
        } else if (held) {
          await up();
          held = false;
        }
        if (!audioChecked && input.tick > 350) {
          const count = await page.evaluate(() => window.__oscillators);
          assert.ok(
            count < 100,
            `continuous distance must not create frame-rate reward sounds (${count})`,
          );
          await page
            .getByRole("button", { name: "Desactivar sonido", exact: true })
            .tap();
          audioChecked = true;
        }
      }
    if (held) await up();
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
    assert.equal(result.won, !process.env.QA_LOSS);
    assert.equal(submits, 1);
    if (!process.env.QA_LOSS) {
      assert.equal(body.final_tick, 14400);
      assert.ok(replay.state.actors.some((a) => a.fired));
      assert.ok(replay.state.collectibles.some((l) => l.collected));
      assert.ok(body.inputs.some((i) => i.action === "DUCK_DOWN"));
    }
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
      .getByRole("button", { name: "Jugar a Alien Dash", exact: true })
      .click();
    const again = await (await restart).json();
    assert.notEqual(again.manifest.match_id, issued.manifest.match_id);
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    assert.equal(await page.locator(".resultPanel").isVisible(), false);
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        orientation: process.env.QA_LANDSCAPE ? "landscape" : "portrait",
        verified: true,
        won: result.won,
        score: result.score,
        finalTick: body.final_tick,
        lives: replay.state.lives,
        inputs: body.inputs.length,
        attackers: replay.state.actors.filter((a) => a.fired).length,
        pickups: replay.state.collectibles.filter((l) => l.collected).length,
        audioChecked,
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
