// Native sling gestures; public Canvas/HUD observations only, no client state/clock overrides.
const { chromium } = require(
    process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
  ),
  assert = require("node:assert/strict"),
  { register } = require("node:module"),
  { pathToFileURL } = require("node:url"),
  path = require("node:path");
register(pathToFileURL(path.join(__dirname, "determinism-loader.mjs")));
(async () => {
  const { BIRDS_CORE: core } = await import(
      pathToFileURL(
        path.join(
          __dirname,
          "../.det-test/lib/verified/galacticBirdsCore.v1.js",
        ),
      )
    ),
    { chooseBirdsShot, birdsTrial } = await import(
      pathToFileURL(
        path.join(__dirname, "../.det-test/scripts/birds-play-fixture.js"),
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
            playerName: "QA-Birds",
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
        window.__birds = {
          map: [],
          bodies: [],
          enemies: [],
          helmet: null,
          base: null,
        };
        const clear = CanvasRenderingContext2D.prototype.clearRect;
        CanvasRenderingContext2D.prototype.clearRect = function (...args) {
          if (this.canvas.classList.contains("gameCanvas"))
            window.__birds = {
              map: [],
              bodies: [],
              enemies: [],
              helmet: null,
              base: null,
            };
          return clear.apply(this, args);
        };
        const transform = CanvasRenderingContext2D.prototype.setTransform;
        CanvasRenderingContext2D.prototype.setTransform = function (...args) {
          if (
            args.length === 6 &&
            this.canvas.classList.contains("gameCanvas") &&
            args[1] === 0 &&
            args[2] === 0
          )
            window.__birds.base = { a: args[0], e: args[4], f: args[5] };
          return transform.apply(this, args);
        };
        const arc = CanvasRenderingContext2D.prototype.arc;
        CanvasRenderingContext2D.prototype.arc = function (x, y, r, ...args) {
          this.__arc = { x, y, r };
          if (
            y === 50 &&
            (this.fillStyle === "#4f657c" || this.fillStyle === "#ddc297")
          )
            window.__birds.map.push(this.fillStyle === "#4f657c");
          return arc.call(this, x, y, r, ...args);
        };
        const rect = CanvasRenderingContext2D.prototype.roundRect;
        CanvasRenderingContext2D.prototype.roundRect = function (
          x,
          y,
          w,
          h,
          ...args
        ) {
          this.__rect = { x, y, w, h };
          return rect.call(this, x, y, w, h, ...args);
        };
        const fill = CanvasRenderingContext2D.prototype.fill;
        CanvasRenderingContext2D.prototype.fill = function (...args) {
          const f = window.__birds,
            m = this.getTransform();
          if (f.base && this.fillStyle === "#739aae" && this.__arc?.r === 13) {
            f.helmet = {
              x: m.e,
              y: m.f,
              scale: Math.hypot(m.a, m.b),
              logicalY: (m.f - f.base.f) / f.base.a,
            };
          }
          const p = this.__rect;
          if (p) {
            if (
              this.fillStyle === "#637aa1" ||
              this.fillStyle === "#364a60" ||
              this.fillStyle.includes("124, 225, 249")
            )
              f.bodies.push({
                ...p,
                material:
                  this.fillStyle === "#637aa1"
                    ? "ceramic"
                    : this.fillStyle === "#364a60"
                      ? "alloy"
                      : "glass",
              });
            if (this.fillStyle === "#374762") f.enemies.push({ ...p });
          }
          return fill.apply(this, args);
        };
      });
      await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3103");
      await page
        .getByRole("button", { name: "Entrenamiento gratis", exact: true })
        .tap();
      const start = page.waitForResponse((r) =>
        r.url().includes("/verified-match/start"),
      );
      await page
        .getByRole("button", { name: "Jugar a Galactic Birds", exact: true })
        .tap();
      const issued = await (await start).json();
      assert.equal(issued.manifest.game_id, "galactic-birds");
      await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
      await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
      await page.waitForTimeout(150);
      const cdp = await context.newCDPSession(page),
        canvas = page.locator("canvas.gameCanvas");
      let model = core.create(issued.manifest.seed),
        submits = 0,
        done = false,
        shotCount = 0;
      page.on("request", (r) => {
        if (r.url().includes("/verified-match/verify")) submits++;
      });
      const response = process.env.QA_SMALL
        ? Promise.resolve(null)
        : page
            .waitForResponse(
              (r) => r.url().includes("/verified-match/verify"),
              {
                timeout: 280000,
              },
            )
            .then((r) => {
              done = true;
              return r;
            });
      response.catch(() => {});
      async function nativeTap(locator) {
        const box = await locator.boundingBox();
        assert.ok(box);
        await cdp.send("Input.synthesizeTapGesture", {
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
          duration: 80,
          gestureSourceType: "touch",
        });
      }
      async function sling(aim, power, mode = "shoot") {
        const pose = await page.evaluate(() => window.__birds.helmet);
        assert.ok(pose, "bird visible before release");
        const b = await canvas.boundingBox(),
          dpr = await page.evaluate(() =>
            Math.min(2, Math.max(1, devicePixelRatio || 1)),
          ),
          k = pose.scale / dpr,
          x = b.x + pose.x / dpr,
          y = b.y + pose.y / dpr,
          distance = 16 + 7 * power,
          a = ((10 + aim) * Math.PI) / 180;
        assert.ok(128 * k >= 44, "sling touch diameter remains at least44px");
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [
            {
              x: x - distance * Math.cos(a) * k,
              y: y + distance * Math.sin(a) * k,
            },
          ],
        });
        await page.waitForTimeout(40);
        if (mode === "blur")
          await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await cdp.send("Input.dispatchTouchEvent", {
          type: mode === "cancel" ? "touchCancel" : "touchEnd",
          touchPoints: [],
        });
      }
      for (const mode of ["cancel", "blur"]) {
        await sling(30, 6, mode);
        await page.waitForTimeout(150);
        assert.match(await page.locator(".coreHud").innerText(), /30 TIROS/);
      }
      if (process.env.QA_SMALL) {
        await sling(0, 7);
        await page.waitForTimeout(1200);
        assert.match(await page.locator(".coreHud").innerText(), /29 TIROS/);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        const abandoning = page.waitForResponse((r) =>
          r.url().includes("/verified-match/verify"),
        );
        await nativeTap(
          page.getByRole("button", { name: "Volver", exact: true }),
        );
        const r = await abandoning,
          body = r.request().postDataJSON(),
          receipt = await r.json();
        assert.equal(receipt.received, true);
        assert.equal(receipt.verified, false);
        assert.deepEqual(
          body.inputs.map((i) => i.action),
          ["AIM_00", "POWER_07", "SHOOT"],
        );
        assert.deepEqual(errors, []);
        console.log(
          JSON.stringify({
            orientation: landscape ? "small landscape" : "320px portrait",
            exitInput: "native touch release",
            touch: true,
            cancelAndBlur: true,
            record: true,
          }),
        );
        await context.close();
        continue;
      }
      while (!done) {
        const frame = await page.evaluate(() => window.__birds),
          hud = await page.locator(".coreHud").innerText(),
          values = hud.match(/(\d+) DRONES · (\d+) TIROS/);
        if (!values) break;
        const ammo = Number(values[2]);
        if (ammo === 0) {
          await page.waitForTimeout(250);
          continue;
        }
        assert.equal(frame.map.length, 12);
        model.enemies.forEach((e, i) => {
          e.alive = frame.map[i];
        });
        model.kills = Number(values[1]);
        model.height = model.kills;
        model.ammo = ammo;
        model.phase = "aim";
        model.bird = null;
        model.status = "running";
        const next = model.enemies.find((e) => e.alive);
        assert.ok(next);
        model.launcherX = Math.max(
          70000,
          Math.min(1380000, next.x - next.approachGap),
        );
        const base = frame.base,
          logicalWidth =
            (await canvas.boundingBox()).width /
            (base.a /
              (await page.evaluate(() =>
                Math.min(2, Math.max(1, devicePixelRatio || 1)),
              ))),
          camera = Math.max(
            0,
            Math.min(1600000 - logicalWidth * 1000, model.launcherX - 110000),
          ),
          used = new Set();
        for (const rect of frame.bodies) {
          const x = Math.round((rect.x + rect.w / 2) * 1000 + camera),
            y = Math.round((rect.y + rect.h / 2) * 1000),
            matches = model.bodies
              .filter(
                (b) =>
                  !used.has(b.id) &&
                  b.material === rect.material &&
                  b.w === Math.round(rect.w * 1000) &&
                  b.h === Math.round(rect.h * 1000),
              )
              .sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x)),
            b = matches[0];
          if (b) {
            used.add(b.id);
            b.alive = true;
            b.x = x;
            b.y = y;
            b.vx = 0;
            b.vy = 0;
          }
        }
        for (const b of model.bodies)
          if (
            b.x - b.w / 2 >= camera &&
            b.x + b.w / 2 <= camera + logicalWidth * 1000 &&
            !used.has(b.id)
          ) {
            b.alive = false;
            b.hp = 0;
          }
        for (const r of frame.enemies) {
          const x = Math.round((r.x + r.w / 2) * 1000 + camera),
            y = Math.round((r.y + r.h / 2) * 1000),
            e = model.enemies
              .filter((e) => e.alive)
              .sort(
                (a, b) =>
                  Math.abs(a.x - x) +
                  Math.abs(a.y - y) -
                  Math.abs(b.x - x) -
                  Math.abs(b.y - y),
              )[0];
          if (e) {
            e.x = x;
            e.y = y;
            e.vy = 0;
          }
        }
        const planningAt = Date.now();
        const shot = process.env.QA_LOSS
          ? { aim: 60, power: 0 }
          : chooseBirdsShot(model);
        console.log(
          JSON.stringify({
            phase: "plan",
            landscape,
            shot: shotCount + 1,
            ms: Date.now() - planningAt,
          }),
        );
        await sling(shot.aim, shot.power);
        shotCount++;
        model = birdsTrial(model, shot.aim, shot.power);
        if (shotCount === 1) {
          await page.waitForTimeout(300);
          assert.equal(
            Number(
              (await page.locator(".coreHud").innerText()).match(
                /(\d+) TIROS/,
              )[1],
            ),
            29,
            await page.locator(".coreHud").innerText(),
          );
          await page.screenshot({
            path: `/workspace/.cloud-setup/birds-${landscape ? "landscape" : "portrait"}.png`,
          });
          await page
            .getByRole("button", { name: "Activar sonido", exact: true })
            .tap();
          await page.waitForTimeout(250);
          console.log(
            JSON.stringify({
              phase: "sound",
              landscape,
              screen: new URL(page.url()).hash,
              hud: await page.locator(".coreHud").innerText(),
              buttons: await page
                .locator(".gameSoundToggle")
                .getAttribute("aria-pressed"),
            }),
          );
          await page
            .getByRole("button", { name: "Desactivar sonido", exact: true })
            .tap();
        }
        const until = Date.now() + 10000;
        while (!done && Date.now() < until) {
          await page.waitForTimeout(120);
          const pose = await page.evaluate(() => window.__birds.helmet);
          if (pose && Math.abs(pose.logicalY - 520) < 0.001) {
            await page.waitForTimeout(120);
            const still = await page.evaluate(() => window.__birds.helmet);
            if (still && Math.abs(still.logicalY - 520) < 0.001) break;
          }
        }
        if (shotCount === 3 && !done) {
          await page.setViewportSize(
            landscape
              ? { width: 390, height: 844 }
              : { width: 844, height: 390 },
          );
          await page.waitForTimeout(120);
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
      assert.equal(result.won, !process.env.QA_LOSS);
      assert.equal(submits, 1);
      assert.equal(
        body.inputs.filter((i) => i.action === "SHOOT").length,
        replay.state.shots,
      );
      assert.equal(
        body.inputs.length,
        replay.state.shots * 3,
        "all direction/power/release inputs survive the common queue",
      );
      assert.equal(replay.state.shots, shotCount, "cancel/blur never fire");
      assert.ok(!("score" in body));
      if (process.env.QA_LOSS) {
        assert.equal(replay.state.shots, 30);
        assert.equal(replay.failure, "OUT_OF_SHOTS");
      } else assert.equal(replay.height, 12);
      await page.locator(".resultPanel").waitFor({ state: "visible" });
      await page.waitForTimeout(450);
      const restarting = page.waitForResponse((r) =>
        r.url().includes("/verified-match/start"),
      );
      await nativeTap(
        page.getByRole("button", { name: "OTRA VEZ", exact: true }),
      );
      const fresh = await (await restarting).json();
      assert.notEqual(fresh.ticket.attempt_id, issued.ticket.attempt_id);
      await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
      await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
      await page.waitForTimeout(300);
      const abandoning = page.waitForResponse((r) =>
        r.url().includes("/verified-match/verify"),
      );
      await nativeTap(
        page.getByRole("button", { name: "Volver", exact: true }),
      );
      const receipt = await (await abandoning).json();
      assert.equal(receipt.received, true);
      assert.equal(receipt.verified, false);
      assert.equal(submits, 2);
      assert.deepEqual(errors, []);
      console.log(
        JSON.stringify({
          orientation: landscape ? "landscape" : "portrait",
          won: result.won,
          kills: replay.height,
          shots: replay.state.shots,
          score: result.score,
          finalTick: body.final_tick,
          rotation: true,
          musicRerender: true,
          cancelAndBlur: true,
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
