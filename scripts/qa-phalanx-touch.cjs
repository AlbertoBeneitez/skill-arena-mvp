// Real held touch/drag/cancel, all five waves and actual server replay. No seed override.
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
    { PHALANX_CORE: core } = await import(
      b + "lib/verified/starPhalanxCore.v1.js"
    ),
    { replayCore } = await import(b + "lib/verified/coreRuntime.v1.js");
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
          playerName: "QA-Phalanx",
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
      window.__oscillators = 0;
      const oscillator = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function (...a) {
        window.__oscillators++;
        return oscillator.apply(this, a);
      };
      const proto = CanvasRenderingContext2D.prototype,
        paths = new WeakMap();
      const matches = (ctx) => ctx.canvas.classList?.contains("gameCanvas");
      const clear = proto.clearRect;
      proto.clearRect = function (...a) {
        if (matches(this))
          window.__scene = {
            t: performance.now(),
            enemies: [],
            shots: [],
            shipX: 195,
          };
        return clear.apply(this, a);
      };
      const begin = proto.beginPath;
      proto.beginPath = function (...a) {
        paths.set(this, []);
        return begin.apply(this, a);
      };
      for (const method of ["moveTo", "lineTo"]) {
        const original = proto[method];
        proto[method] = function (x, y, ...a) {
          paths.get(this)?.push({ x, y });
          return original.call(this, x, y, ...a);
        };
      }
      const fill = proto.fill;
      proto.fill = function (...a) {
        const points = paths.get(this),
          scene = window.__scene;
        if (matches(this) && scene && points?.length === 3) {
          if (["#83e2df", "#c1a8ff", "#edaa76"].includes(this.fillStyle))
            scene.enemies.push({ x: points[0].x, y: points[0].y - 14 });
          else if (this.fillStyle === "#90eff1") {
            const m = this.getTransform();
            scene.shipX = (m.e - (this.canvas.width - 390 * m.a) / 2) / m.a;
          }
        }
        return fill.apply(this, a);
      };
      const rect = proto.fillRect;
      proto.fillRect = function (x, y, w, h, ...a) {
        if (
          matches(this) &&
          window.__scene &&
          this.fillStyle === "#ff788f" &&
          w === 4 &&
          h === 16
        )
          window.__scene.shots.push({ x: x + 2, y: y + 8 });
        return rect.call(this, x, y, w, h, ...a);
      };
    });
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3037");
    await page.locator(".quickStakeBar button").first().click();
    const start = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Star Phalanx", exact: true })
      .click();
    const issued = await (await start).json();
    assert.equal(issued.manifest.game_version, "1.0.0");
    const target = issued.manifest.competition.target_score;
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    assert.ok(
      (await page.locator(".coreHud").innerText()).includes("CAPA 1/2"),
    );
    if (process.env.QA_SOUND)
      await page
        .getByRole("button", { name: "Activar sonido", exact: true })
        .tap();
    const cdp = await context.newCDPSession(page),
      box = await page.locator("canvas.gameCanvas").boundingBox(),
      scale = Math.min(box.width / 390, box.height / 620),
      ox = (box.width - 390 * scale) / 2,
      oy = (box.height - 620 * scale) / 2;
    function point(x) {
      return { x: box.x + ox + x * scale, y: box.y + oy + 470 * scale };
    }
    let held = false,
      done = false,
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
    async function down(x) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [point(x)],
      });
      held = true;
    }
    async function up(cancel = false) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: cancel ? "touchCancel" : "touchEnd",
        touchPoints: [],
      });
      held = false;
    }
    // Observe drawing commands only: no access to React refs or authoritative state.
    // The steering player follows the visible formation instead of a predicted replay.
    await down(200);
    await page.waitForTimeout(180);
    await up(true);
    await page.waitForTimeout(160);
    // Losing focus must release the held action before the next gesture.
    await down(200);
    await page.waitForTimeout(100);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await up();
    await page.waitForTimeout(100);
    if (process.env.QA_SCREENSHOT)
      await page.screenshot({ path: process.env.QA_SCREENSHOT });
    let previous = null,
      lastPoint = null,
      tracked = null;
    if (!process.env.QA_LOSS)
      for (let turns = 0; !done && turns < 4000; turns++) {
        const scene = await page.evaluate(() => window.__scene);
        if (!scene?.shipX) {
          await page.waitForTimeout(60);
          continue;
        }
        let desired = scene.shipX;
        if (scene.enemies.length) {
          let enemy = tracked
            ? scene.enemies.find(
                (e) =>
                  Math.abs(e.x - tracked.x) < 15 &&
                  Math.abs(e.y - tracked.y) < 8,
              )
            : null;
          enemy ??= scene.enemies.reduce(
            (best, e) =>
              !best ||
              Math.abs(e.x - scene.shipX) < Math.abs(best.x - scene.shipX)
                ? e
                : best,
            null,
          );
          let speed = 0;
          if (previous?.enemies.length && scene.t > previous.t) {
            const before = previous.enemies.reduce(
              (best, e) =>
                !best || Math.abs(e.x - enemy.x) < Math.abs(best.x - enemy.x)
                  ? e
                  : best,
              null,
            );
            const delta = enemy.x - before.x;
            if (Math.abs(delta) < 12 && Math.abs(enemy.y - before.y) < 8)
              speed = Math.max(
                -60,
                Math.min(60, (delta * 1000) / (scene.t - previous.t)),
              );
          }
          desired = enemy.x + (speed * (532 - enemy.y)) / 480;
          tracked = enemy;
        } else tracked = null;
        for (const bolt of scene.shots.filter((b) => b.y > 400 && b.y < 575)) {
          const cross =
            (scene.shipX <= bolt.x && desired >= bolt.x) ||
            (scene.shipX >= bolt.x && desired <= bolt.x);
          if (
            cross ||
            Math.abs(desired - bolt.x) < 45 ||
            Math.abs(scene.shipX - bolt.x) < 35
          ) {
            const left = bolt.x - 55,
              right = bolt.x + 55;
            desired =
              scene.shipX < bolt.x && left >= 20
                ? Math.min(desired, left)
                : right <= 370
                  ? Math.max(desired, right)
                  : Math.min(desired, left);
          }
        }
        desired =
          20 + Math.max(0, Math.min(35, Math.round((desired - 20) / 10))) * 10;
        if (!held) {
          await down(desired);
          lastPoint = desired;
        } else if (desired !== lastPoint) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [point(desired)],
          });
          lastPoint = desired;
        }
        previous = scene;
        await page.waitForTimeout(60);
      }
    const vr = await verified;
    if (held) await up(true);
    const body = vr.request().postDataJSON(),
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
    if (process.env.QA_SOUND)
      assert.ok(
        (await page.evaluate(() => window.__oscillators)) > 0,
        "touch-enabled feedback must emit audio",
      );
    assert.ok(body.inputs.some((i) => i.action === "FIRE_DOWN"));
    assert.ok(
      body.inputs.filter((i) => i.action === "FIRE_UP").length >= 2,
      "pointer cancel and blur both release held fire",
    );
    if (process.env.QA_LOSS) {
      assert.equal(replay.state.firing, false);
      assert.ok(
        replay.state.kills <= 2,
        "cancel cannot leave autonomous fire running",
      );
    } else {
      assert.equal(replay.state.clearedLayers, 16);
      assert.equal(replay.state.kills, 100);
    }
    await page.locator(".resultPanel").waitFor({ state: "visible" });
    assert.equal(
      await page.evaluate(() => document.body.scrollWidth > innerWidth),
      false,
    );
    await page.getByRole("button", { name: "OTRO JUEGO", exact: true }).click();
    const restart = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Star Phalanx", exact: true })
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
        kills: replay.state.kills,
        layers: replay.state.clearedLayers,
        lives: replay.state.lives,
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
