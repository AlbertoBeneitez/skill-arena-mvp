// Native touches, actual server seed/target, observed timestamps and canvas calls.
// The external player's mirror never changes browser state, clock or responses.
const root = require("node:path").resolve(__dirname, "..");
const { createRequire, register } = require("node:module"),
  path = require("node:path"),
  { pathToFileURL } = require("node:url"),
  assert = require("node:assert/strict");
const requireProject = createRequire(path.join(root, "package.json"));
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
);
register(pathToFileURL(path.join(root, "scripts/determinism-loader.mjs")));
(async () => {
  const { TOWER_DROP_CORE_V3: core, forecastTowerLanding } = await import(
    pathToFileURL(path.join(root, ".det-test/lib/verified/towerDropCore.v3.js"))
  );
  const { advanceCoreToTick, applyCoreInput, replayCore } = await import(
    pathToFileURL(path.join(root, ".det-test/lib/verified/coreRuntime.v1.js"))
  );
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const landscape = !!process.env.QA_LANDSCAPE,
      loss = !!process.env.QA_LOSS;
    const context = await browser.newContext({
      viewport: landscape
        ? { width: 844, height: 390 }
        : { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage(),
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
          playerName: "QA-Tower",
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
      window.__towerEvents = [];
      window.__towerFrame = { ground: null, layers: [] };
      document.addEventListener(
        "pointerdown",
        (event) => {
          if (event.target.matches?.("canvas.gameCanvas"))
            window.__towerEvents.push({ when: performance.now() });
        },
        true,
      );
      const raf = requestAnimationFrame;
      window.requestAnimationFrame = (cb) => {
        if (window.__towerIssued && !window.__towerEpoch)
          window.__towerEpoch = performance.now();
        return raf(cb);
      };
      const fetchOriginal = fetch;
      window.fetch = (...args) =>
        fetchOriginal(...args).then((r) => {
          if (String(args[0]).includes("/verified-match/start"))
            window.__towerIssued = true;
          return r;
        });
      const clear = CanvasRenderingContext2D.prototype.clearRect;
      CanvasRenderingContext2D.prototype.clearRect = function (...args) {
        if (this.canvas.classList.contains("gameCanvas"))
          window.__towerFrame = { ground: null, layers: [] };
        return clear.apply(this, args);
      };
      const fill = CanvasRenderingContext2D.prototype.fillRect;
      CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
        if (this.canvas.classList.contains("gameCanvas")) {
          if (this.fillStyle === "#173949") {
            const t = this.getTransform();
            window.__towerFrame.ground = {
              x: t.a * x + t.c * y + t.e,
              y: t.b * x + t.d * y + t.f,
              bottom: t.b * (x + w) + t.d * (y + h) + t.f,
              canvasHeight: this.canvas.height,
            };
          }
          // Canvas normalises hsl() to rgb(), so settled layers are identified by geometry.
          if (y >= 540 && w > 20 && w < 200 && h > 0 && h <= 30)
            window.__towerFrame.layers.push({ x, y, w, h });
        }
        return fill.call(this, x, y, w, h);
      };
    });
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3076");
    await page
      .locator(".quickStakeBar button")
      .nth(loss ? 0 : 1)
      .tap();
    const issuedResponse = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Tower Drop", exact: true })
      .tap();
    const { manifest } = await (await issuedResponse).json();
    assert.equal(manifest.game_version, "3.0.0");
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    const target = manifest.competition.target_score,
      s = core.create(manifest.seed),
      cdp = await context.newCDPSession(page);
    let finished = false,
      submits = 0,
      index = 0,
      first = true,
      progressScreenshot = false;
    page.on("request", (r) => {
      if (r.url().includes("/verified-match/verify")) submits++;
    });
    const verification = page.waitForResponse(
      (r) => r.url().includes("/verified-match/verify"),
      { timeout: 180000 },
    );
    verification
      .then(() => {
        finished = true;
      })
      .catch(() => {});
    async function synchronise() {
      const clock = await page.evaluate(() => ({
        epoch: window.__towerEpoch,
        now: performance.now(),
        events: window.__towerEvents,
        frame: window.__towerFrame,
      }));
      assert.ok(clock.epoch);
      for (; index < clock.events.length; index++) {
        const tick = Math.max(
          s.tick,
          Math.floor(((clock.events[index].when - clock.epoch) * 120) / 1000),
        );
        advanceCoreToTick(core, s, tick, target);
        applyCoreInput(core, s, "DROP", target);
      }
      advanceCoreToTick(
        core,
        s,
        Math.floor(((clock.now - clock.epoch) * 120) / 1000),
        target,
      );
      if (clock.frame.ground) {
        assert.ok(
          clock.frame.ground.y >= 0 &&
            clock.frame.ground.bottom <= clock.frame.ground.canvasHeight + 1,
          "Tower foundation left visible canvas",
        );
      }
      if (s.height >= 3) {
        assert.ok(
          clock.frame.ground,
          "Tower foundation disappeared after three placements",
        );
      }
      return clock;
    }
    while (!finished) {
      await synchronise();
      if (s.status !== "running") break;
      if (s.phase === "swing") {
        const top = s.blocks.at(-1),
          f = forecastTowerLanding(s),
          intendLoss = loss && s.height >= 14;
        if (
          intendLoss
            ? !f.stable
            : f.stable &&
              Math.abs(
                f.xMilli + s.movingWMilli / 2 - top.xMilli - top.wMilli / 2,
              ) < 3500
        ) {
          const box = await page.locator("canvas.gameCanvas").boundingBox();
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [
              { x: box.x + box.width * 0.5, y: box.y + box.height * 0.75 },
            ],
          });
          await cdp.send("Input.dispatchTouchEvent", {
            type: first ? "touchCancel" : "touchEnd",
            touchPoints: [],
          });
          if (first) {
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchStart",
              touchPoints: [
                { x: box.x + box.width * 0.5, y: box.y + box.height * 0.75 },
              ],
            });
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchEnd",
              touchPoints: [],
            });
            first = false;
          }
        }
      }
      if (!progressScreenshot && s.height >= 3) {
        await page.screenshot({
          path:
            process.env.QA_GAMEPLAY_SCREENSHOT ||
            `/workspace/.cloud-setup/v65-tower-${landscape ? "landscape" : "portrait"}.png`,
        });
        progressScreenshot = true;
      }
      await page.waitForTimeout(20);
    }
    const response = await verification,
      result = await response.json(),
      body = response.request().postDataJSON(),
      replay = replayCore(
        core,
        body.inputs,
        body.final_tick,
        manifest.seed,
        target,
      );
    console.log(
      JSON.stringify({
        phase: "terminal-record",
        landscape,
        loss,
        manifestId: manifest.match_id,
        target,
        result,
        postedInputs: body.inputs,
        mirror: {
          tick: s.tick,
          height: s.height,
          score: s.score,
          failure: s.failure,
        },
      }),
    );
    assert.equal(result.verified, true);
    assert.equal(replay.valid, true, replay.error);
    assert.equal(result.score, replay.score);
    assert.equal(result.height, replay.state.height);
    assert.equal(result.won, !loss);
    assert.equal(submits, 1);
    assert.equal(
      await page.evaluate(() => window.__towerEvents.length),
      body.inputs.length + 1,
      "the intentional double tap must contribute exactly one DROP",
    );
    assert.ok(result.height >= 3);
    if (loss) assert.ok(result.height >= 14, "deep tower loss ended too early");
    await page.locator(".resultPanel").waitFor();
    const restart = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page.getByRole("button", { name: "OTRA VEZ", exact: true }).tap();
    const next = (await (await restart).json()).manifest;
    assert.notEqual(next.match_id, manifest.match_id);
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.setViewportSize(
      landscape ? { width: 390, height: 844 } : { width: 844, height: 390 },
    );
    await page.waitForTimeout(200);
    assert.ok(await page.locator("canvas.gameCanvas").isVisible());
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        landscape,
        loss,
        manifestId: manifest.match_id,
        result,
        inputCount: body.inputs.length,
        submits,
        restartMatch: next.match_id,
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
