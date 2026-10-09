// Native touch follows visible drawing geometry. No core state or seed mutation.
// Final assertions replay only actual posted inputs against the issued manifest.
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
    { SKY_HOP_CORE: core } = await import(b + "lib/verified/skyHopCore.v1.js"),
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
          playerName: "QA-SkyHop",
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
      const proto = CanvasRenderingContext2D.prototype;
      const matches = (ctx) => ctx.canvas.classList?.contains("gameCanvas");
      const clear = proto.clearRect;
      proto.clearRect = function (...a) {
        if (matches(this))
          window.__scene = {
            t: performance.now(),
            platforms: [],
            ship: null,
            rising: false,
          };
        return clear.apply(this, a);
      };
      const rect = proto.fillRect;
      const colors = ["#7fcde5", "#a999fa", "#f4c272", "#ef94aa", "#87e8c4"];
      proto.fillRect = function (x, y, w, h, ...a) {
        if (
          matches(this) &&
          window.__scene &&
          h === 4 &&
          w >= 90 &&
          colors.includes(this.fillStyle)
        )
          window.__scene.platforms.push({ x, y, w, color: this.fillStyle });
        return rect.call(this, x, y, w, h, ...a);
      };
      const translate = proto.translate,
        rotate = proto.rotate,
        fill = proto.fill;
      proto.translate = function (x, y, ...a) {
        if (matches(this) && window.__scene)
          window.__scene.ship = { x, y, vx: 0 };
        return translate.call(this, x, y, ...a);
      };
      proto.rotate = function (angle, ...a) {
        if (matches(this) && window.__scene?.ship)
          window.__scene.ship.vx = angle * 10000;
        return rotate.call(this, angle, ...a);
      };
      proto.fill = function (...a) {
        if (
          matches(this) &&
          window.__scene &&
          typeof this.fillStyle === "string" &&
          this.fillStyle.includes("115, 201, 248")
        )
          window.__scene.rising = true;
        return fill.apply(this, a);
      };
    });
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3040");
    await page.locator(".quickStakeBar button").first().click();
    const start = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Sky Hop", exact: true })
      .click();
    const issued = await (await start).json();
    assert.equal(issued.manifest.game_version, "1.0.0");
    const s = core.create(issued.manifest.seed),
      target = issued.manifest.competition.target_score;
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    assert.ok(
      (await page.locator(".coreHud").innerText()).includes("/75"),
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
      LEFT_DOWN: "Dirigir izquierda",
      RIGHT_DOWN: "Dirigir derecha",
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

    let held = null;
    async function down(a) {
      if (held) await up();
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [points[a]],
      });
      held = a;
    }
    async function up(cancel = false) {
      if (!held) return;
      await cdp.send("Input.dispatchTouchEvent", {
        type: cancel ? "touchCancel" : "touchEnd",
        touchPoints: [],
      });
      held = null;
    }
    await down("LEFT_DOWN");
    await up(true);
    await down("RIGHT_DOWN");
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await up();
    if (process.env.QA_LOSS) await down("RIGHT_DOWN");
    let screenshotTaken = false,
      lastCamera = 0,
      lastSample = null,
      lastRising = true,
      lastLanded = 0;
    const palette = {
      normal: "#7fcde5",
      boost: "#a999fa",
      moving: "#f4c272",
      crumble: "#ef94aa",
      checkpoint: "#87e8c4",
    };
    for (let turns = 0; !done && turns < 6000; turns++) {
      const scene = await page.evaluate(() => window.__scene);
      if (!scene?.ship) {
        if (turns % 150 === 0) console.log("no scene", scene);
        await page.waitForTimeout(20);
        continue;
      }
      // Recover camera from visible static platform geometry. Drawing calls are
      // forwarded unchanged; no React refs, core state or seed override is used.
      let best = null;
      for (const visible of scene.platforms)
        for (const p of s.platforms) {
          if (
            p.drift ||
            Math.abs(p.x / 1000 - visible.x) > 0.01 ||
            p.width / 1000 !== visible.w ||
            palette[p.kind] !== visible.color
          )
            continue;
          const camera = p.y - visible.y * 1000;
          let matches = 0;
          for (const v of scene.platforms)
            if (
              s.platforms.some(
                (q) =>
                  Math.abs((q.y - camera) / 1000 - v.y) < 0.01 &&
                  q.width / 1000 === v.w &&
                  palette[q.kind] === v.color,
              )
            )
              matches++;
          if (
            !best ||
            matches > best.matches ||
            (matches === best.matches &&
              Math.abs(camera - lastCamera) <
                Math.abs(best.camera - lastCamera))
          )
            best = { camera, matches };
        }
      if (!best) {
        await page.waitForTimeout(20);
        continue;
      }
      lastCamera = best.camera;
      const x = scene.ship.x * 1000,
        y = scene.ship.y * 1000 + best.camera,
        vx = scene.ship.vx;
      const jump = lastSample && Math.abs(y - lastSample.y) > 50000;
      if ((scene.rising && !lastRising) || jump) {
        const support = scene.platforms
          .map((v) => ({ v, delta: v.y - scene.ship.y - 19 }))
          .filter((z) => z.delta >= -2 && z.delta < 25)
          .sort((a, b) => a.delta - b.delta)[0];
        if (support) {
          const py = support.v.y * 1000 + best.camera;
          const i = s.platforms.findIndex((p) => Math.abs(p.y - py) < 1);
          if (i >= 0) {
            lastLanded = i;
          }
        }
      }
      lastRising = scene.rising;
      lastSample = { t: scene.t, y };
      const p = s.platforms[Math.min(75, lastLanded + 1)];
      // Steering follows the actual visible moving support, not an independent replay clock.
      const visible = scene.platforms.find(
        (v) => Math.abs(v.y * 1000 + best.camera - p.y) < 1,
      );
      const tx = visible ? visible.x * 1000 + p.width / 2 : p.x + p.width / 2;
      const error = tx - (x + vx * 7),
        direction =
          error > 14000 ? "RIGHT_DOWN" : error < -14000 ? "LEFT_DOWN" : null;
      if (!process.env.QA_LOSS) {
        if (held && held !== direction) await up();
        if (direction && held !== direction) await down(direction);
      }
      if (turns % 300 === 0)
        console.log(
          "visible",
          lastLanded,
          await page.locator(".coreHud").innerText(),
        );
      if (!screenshotTaken && lastLanded > 14 && process.env.QA_SCREENSHOT) {
        await page.screenshot({ path: process.env.QA_SCREENSHOT });
        screenshotTaken = true;
      }
      await page.waitForTimeout(20);
    }
    await up();
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
    assert.ok(
      body.inputs.some((i) => i.action === "LEFT_UP"),
      "pointer cancel releases left",
    );
    assert.ok(
      body.inputs.some((i) => i.action === "RIGHT_UP"),
      "blur releases right",
    );
    if (process.env.QA_LOSS)
      assert.ok(["FALLEN", "TIME_LIMIT"].includes(replay.failure));
    else {
      assert.equal(replay.state.highest, 75);
      assert.ok(replay.state.collected.some(Boolean));
    }
    console.log("result", JSON.stringify(result));
    await page.screenshot({
      path:
        "/workspace/.cloud-setup/sky-hop-result-" +
        (process.env.QA_LOSS ? "loss" : "win") +
        ".png",
    });
    await page.locator(".resultPanel").waitFor({ state: "visible" });
    assert.equal(
      await page.evaluate(() => document.body.scrollWidth > innerWidth),
      false,
    );
    const other = page.getByRole("button", { name: "CAMBIAR", exact: true });
    if (process.env.QA_LOSS) {
      await other.focus();
      await page.keyboard.press("Enter");
    } else await other.click();
    const restart = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Sky Hop", exact: true })
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
        height: replay.state.highest,
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
