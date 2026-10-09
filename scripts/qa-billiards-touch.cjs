// Native touches in the real app, server-issued training manifest, actual replay.
// Test-only shot planning uses the published public arena and the same core.
// No seed, target, clock, HTTP body or React/core state is changed or intercepted.
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
);
const assert = require("node:assert/strict");
const { register } = require("node:module");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const { writeFileSync } = require("node:fs");
const repo = process.env.QA_REPO_ROOT || path.resolve(__dirname, "..");
register(pathToFileURL(path.join(repo, "scripts/determinism-loader.mjs")));

(async () => {
  const { BILLIARDS_CORE_V2: core, forecastBilliardsV2 } = await import(
      pathToFileURL(
        path.join(repo, ".det-test/lib/verified/billiardsCore.v2.js"),
      )
    ),
    { billiardsDirection, BILLIARDS_POCKETS } = await import(
      pathToFileURL(
        path.join(repo, ".det-test/lib/verified/billiardsCore.v1.js"),
      )
    ),
    { chooseBilliardsShotV2 } = await import(
      pathToFileURL(
        path.join(repo, ".det-test/scripts/billiards-v2-play-fixture.js"),
      )
    ),
    { replayCore } = await import(
      pathToFileURL(path.join(repo, ".det-test/lib/verified/coreRuntime.v1.js"))
    ),
    { getBilliardsCamera, projectBilliardsPoint, BILLIARDS_TABLE_VIEW_BOUNDS } =
      await import(
        pathToFileURL(path.join(repo, ".det-test/lib/billiardsPresentation.js"))
      ),
    landscape = !!process.env.QA_LANDSCAPE,
    loss = !!process.env.QA_LOSS,
    originalViewport = landscape
      ? { width: 844, height: 390 }
      : { width: 390, height: 844 },
    browser = await chromium.launch({
      executablePath: "/usr/bin/chromium",
      headless: true,
      args: ["--no-sandbox"],
    });
  try {
    const context = await browser.newContext({
        viewport: originalViewport,
        isMobile: true,
        hasTouch: true,
      }),
      page = await context.newPage(),
      errors = [],
      records = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.addInitScript(() => {
      localStorage.setItem(
        "skill-arena-v12",
        JSON.stringify({
          onboarded: true,
          playerName: "QA_BilliardsV2",
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
      window.__billiardsOscillators = 0;
      const oscillator = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function (...args) {
        window.__billiardsOscillators++;
        return oscillator.apply(this, args);
      };
      const prototype = CanvasRenderingContext2D.prototype,
        clear = prototype.clearRect,
        arc = prototype.arc,
        move = prototype.moveTo,
        text = prototype.fillText,
        observing = (ctx) => ctx.canvas.classList.contains("gameCanvas");
      prototype.clearRect = function (...args) {
        if (observing(this))
          window.__billiardsView = {
            balls: [],
            aim: false,
          };
        return clear.apply(this, args);
      };
      prototype.arc = function (x, y, radius, ...args) {
        if (
          observing(this) &&
          window.__billiardsView &&
          radius === 10 &&
          this.fillStyle instanceof CanvasGradient
        )
          window.__billiardsView.balls.push({
            id: 0,
            x: Math.round(x * 1000),
            y: Math.round(y * 1000),
          });
        return arc.call(this, x, y, radius, ...args);
      };
      prototype.moveTo = function (x, y, ...args) {
        if (
          observing(this) &&
          window.__billiardsView &&
          String(this.strokeStyle).replace(/\s/g, "") ===
            "rgba(233,228,198,0.85)"
        )
          window.__billiardsView.aim = true;
        return move.call(this, x, y, ...args);
      };
      prototype.fillText = function (value, x, y, ...args) {
        if (observing(this) && window.__billiardsView) {
          const view = window.__billiardsView,
            label = String(value);
          if (/^([1-9]|10)$/.test(label) && x === 0 && y === 2.8) {
            // Upright glyphs follow their actual sphere's arc, irrespective of
            // the shared visual rotation. No private game state is inspected.
            const ball = view.balls.at(-1);
            if (ball) ball.id = Number(label);
          }
        }
        return text.call(this, value, x, y, ...args);
      };
    });
    page.on("request", (request) => {
      if (request.url().includes("/verified-match/verify"))
        records.push(request.postDataJSON());
    });
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3000");
    await page
      .getByRole("button", { name: "Entrenamiento gratis", exact: true })
      .tap();
    const starting = page.waitForResponse((response) =>
      response.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Billar", exact: true })
      .tap();
    const issued = await (await starting).json();
    assert.equal(issued.ok, true);
    assert.equal(issued.manifest.game_id, "billiards");
    assert.equal(issued.manifest.game_version, "2.0.0");
    assert.equal(issued.manifest.competition.target_score, 1000000000);
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    await page.waitForFunction(
      () =>
        window.__billiardsView?.aim &&
        window.__billiardsView?.balls.length === 11,
    );
    const cdp = await context.newCDPSession(page),
      canvas = page.locator("canvas.gameCanvas"),
      powers = ["Potencia suave", "Potencia media", "Potencia fuerte"];
    let model = core.create(issued.manifest.seed),
      shots = 0,
      scratchProof = null,
      progressCaptured = false;
    const initialBumpers = structuredClone(model.bumpers),
      initialBallIds = model.balls.map((ball) => ball.id);

    async function checkLayout() {
      for (const button of await page
        .locator(".billiardsVerified .coreControls button")
        .all()) {
        const bounds = await button.boundingBox();
        assert.ok(
          bounds.width >= 44 && bounds.height >= 44,
          `touch target ${bounds.width} × ${bounds.height}`,
        );
      }
      assert.equal(
        await page.evaluate(() => document.body.scrollWidth > innerWidth),
        false,
      );
    }
    async function confirmPublicArena(state, sameRun = true) {
      const rendered = await page.evaluate(() => window.__billiardsView),
        expected = state.balls
          .filter((ball) => !ball.potted)
          .map(({ id, x, y }) => ({ id, x, y }))
          .sort((a, b) => a.id - b.id);
      assert.deepEqual(
        rendered.balls.sort((a, b) => a.id - b.id),
        expected,
        "actual visible positions equal the stationary planning arena",
      );
      await page.waitForFunction(
        ({ height, shots }) => {
          const hud =
            document.querySelector(".billiardsVerified .coreHud")
              ?.textContent ?? "";
          return (
            hud.match(/\bAVANCE (\d+) \/ 10\b/)?.[1] === String(height) &&
            hud.match(/\b(\d+) TIROS\b/)?.[1] === String(shots)
          );
        },
        { height: state.height, shots: state.shotsLeft },
      );
      if (sameRun)
        assert.deepEqual(
          state.bumpers,
          initialBumpers,
          "fixed arena bumpers throughout the run",
        );
      assert.deepEqual(
        state.balls.map((ball) => ball.id),
        initialBallIds,
        "no ball replacement or arena rebuild",
      );
      assert.doesNotMatch(
        await page.locator(".billiardsVerified").innerText(),
        /MESA \d|Puntos|Nivel/i,
      );
    }
    async function point(x, y) {
      const bounds = await canvas.boundingBox(),
        viewport = {
          width: Math.max(390, (bounds.width / bounds.height) * 620),
          height: 620,
        },
        scale = Math.min(
          bounds.width / viewport.width,
          bounds.height / viewport.height,
        ),
        ox = (bounds.width - viewport.width * scale) / 2,
        oy = (bounds.height - viewport.height * scale) / 2,
        viewPoint = projectBilliardsPoint(getBilliardsCamera(viewport, scale), {
          x,
          y,
        });
      return {
        x: bounds.x + ox + viewPoint.x * scale,
        y: bounds.y + oy + viewPoint.y * scale,
      };
    }
    async function touchScreen(p, cancel = false) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [p],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: cancel ? "touchCancel" : "touchEnd",
        touchPoints: [],
      });
    }
    async function control(name, cancel = false) {
      const bounds = await page
        .getByRole("button", { name, exact: true })
        .boundingBox();
      await touchScreen(
        { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
        cancel,
      );
    }
    async function aimingPoint(state, angle) {
      const cue = state.balls[0],
        direction = billiardsDirection(angle),
        dx = direction.x / direction.length,
        dy = direction.y / direction.length,
        x = cue.x / 1000,
        y = cue.y / 1000;
      let distance = 55;
      // Stay inside the framed table, whose rotated projection is guaranteed
      // to avoid the controls. A point beyond the old canvas bounds can hit a
      // control after rotation even though the desired world angle is legal.
      if (dx > 0)
        distance = Math.min(
          distance,
          (BILLIARDS_TABLE_VIEW_BOUNDS.right - 1 - x) / dx,
        );
      else if (dx < 0)
        distance = Math.min(
          distance,
          (BILLIARDS_TABLE_VIEW_BOUNDS.left + 1 - x) / dx,
        );
      if (dy > 0)
        distance = Math.min(
          distance,
          (BILLIARDS_TABLE_VIEW_BOUNDS.bottom - 1 - y) / dy,
        );
      else if (dy < 0)
        distance = Math.min(
          distance,
          (BILLIARDS_TABLE_VIEW_BOUNDS.top + 1 - y) / dy,
        );
      assert.ok(distance > 10);
      return point(x + dx * distance, y + dy * distance);
    }
    function zeroAdvanceShot(state, requireScratch = false) {
      const candidates = new Set();
      if (requireScratch)
        for (const pocket of BILLIARDS_POCKETS) {
          const cue = state.balls[0],
            a = Math.atan2(pocket.y - cue.y, pocket.x - cue.x),
            center = Math.round(
              (((a + Math.PI * 2) % (Math.PI * 2)) * 180) / (Math.PI * 2),
            );
          for (let offset = -6; offset <= 6; offset++)
            candidates.add((center + offset + 180) % 180);
        }
      for (let angle = 0; angle < 180; angle++) candidates.add(angle);
      for (const angle of candidates)
        for (let power = 0; power < 3; power++) {
          const forecast = forecastBilliardsV2(state, angle, power).state;
          if (
            forecast.height === state.height &&
            forecast.scratch === requireScratch
          )
            return { aim: angle, power };
        }
      throw new Error(
        requireScratch
          ? "NO_LEGAL_NONSCORING_SCRATCH_FOUND"
          : "NO_LEGAL_ZERO_ADVANCE_SHOT_FOUND",
      );
    }
    await checkLayout();
    await confirmPublicArena(model);
    if (process.env.QA_SCREENSHOT)
      await page.screenshot({ path: process.env.QA_SCREENSHOT });
    assert.equal(await page.locator(".coreHint, .tutorialOverlay").count(), 0);
    await page
      .getByRole("button", { name: "Activar sonido", exact: true })
      .tap();
    const terminal = page.waitForResponse(
      (response) => response.url().includes("/verified-match/verify"),
      { timeout: 240000 },
    );
    terminal.catch(() => {});

    while (model.status === "running") {
      assert.equal(model.phase, "aim");
      assert.ok(shots < 18, "one arena, finite original shot budget");
      let chosen;
      if (loss && model.height > 0 && !scratchProof)
        chosen = zeroAdvanceShot(model, true);
      else if (loss && scratchProof) chosen = zeroAdvanceShot(model);
      else chosen = chooseBilliardsShotV2(model);
      const predicted = forecastBilliardsV2(
          model,
          chosen.aim,
          chosen.power,
        ).state,
        willScratch = !!predicted.scratch,
        previousHeight = model.height;
      // Point cancellation/resize may change aim through historical down/move
      // semantics; it must never fire or queue a later shot.
      if (shots === 0) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [await aimingPoint(model, (chosen.aim + 20) % 180)],
        });
        await page.setViewportSize(
          landscape ? { width: 390, height: 844 } : { width: 844, height: 390 },
        );
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchCancel",
          touchPoints: [],
        });
        await page.waitForTimeout(100);
        await checkLayout();
        await confirmPublicArena(model);
        await page.setViewportSize(originalViewport);
        await page.waitForTimeout(100);
        for (const powerName of powers) {
          await control(powerName);
          await page.waitForTimeout(70);
        }
      }
      const target = await aimingPoint(model, chosen.aim),
        cue = model.balls[0],
        from = await point(cue.x / 1000, cue.y / 1000);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [from],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [target],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await page.waitForTimeout(70);
      await control(powers[chosen.power]);
      await page.waitForTimeout(70);
      await control("Tirar bola", shots === 0); // Cancel after immediate down: one valid shot.
      await control("Tirar bola"); // Double tap during movement must be rejected.
      shots++;
      if (shots === 1) {
        await page.setViewportSize(
          landscape ? { width: 390, height: 844 } : { width: 844, height: 390 },
        );
        await control(powers[(chosen.power + 1) % 3]);
        await touchScreen(await point(120, 200), true); // Aim ignored while moving.
        await page.waitForTimeout(100);
        await checkLayout();
        await page.setViewportSize(originalViewport);
      }
      if (willScratch && loss && !scratchProof) {
        scratchProof = {
          shot: shots,
          beforeHeight: previousHeight,
          afterHeight: predicted.height,
          afterScore: predicted.score,
        };
        assert.ok(previousHeight > 0);
        assert.equal(predicted.height, previousHeight);
        assert.equal(predicted.score, previousHeight * 1000);
      }
      model = predicted;
      if (model.phase === "settle") {
        while (model.status === "running" && model.phase === "settle")
          core.step(model);
      }
      if (model.status !== "running") break;
      await page.waitForFunction(
        () => window.__billiardsView?.aim,
        {},
        { timeout: 14000 },
      );
      await confirmPublicArena(model);
      if (scratchProof?.shot === shots)
        await page.waitForFunction(() =>
          document
            .querySelector(".billiardsVerified .coreHud")
            ?.textContent.includes("BLANCA EMBOCADA"),
        );
      if (
        process.env.QA_PROGRESS_SCREENSHOT &&
        model.height >= 5 &&
        !progressCaptured
      ) {
        await page.screenshot({ path: process.env.QA_PROGRESS_SCREENSHOT });
        progressCaptured = true;
      }
    }

    const response = await terminal,
      payload = response.request().postDataJSON(),
      result = await response.json(),
      replay = replayCore(
        core,
        payload.inputs,
        payload.final_tick,
        issued.manifest.seed,
        issued.manifest.competition.target_score,
      );
    const replayPath =
        process.env.QA_REPLAY_PATH ||
        process.env.QA_SCREENSHOT?.replace(/\.[^.]+$/, "-records.json"),
      replayArtifact = {
        orientation: landscape ? "landscape" : "portrait",
        loss,
        manifest: issued.manifest,
        terminal: { payload, result },
        reconstructed: {
          score: replay.score,
          height: replay.height,
          finalTick: replay.state.tick,
          status: replay.state.status,
          failure: replay.failure,
          timeMs: replay.timeMs,
        },
      };
    if (replayPath)
      writeFileSync(replayPath, JSON.stringify(replayArtifact, null, 2));
    assert.equal(response.status(), 200);
    assert.equal(result.verified, true);
    assert.equal(payload.record_kind ?? "terminal", "terminal");
    assert.deepEqual(payload.manifest, issued.manifest);
    assert.equal(payload.ticket.attempt_id, issued.ticket.attempt_id);
    assert.equal(replay.valid, true, replay.error);
    assert.equal(result.score, replay.score);
    assert.equal(result.height, replay.height);
    assert.equal(result.time_ms, replay.timeMs);
    assert.equal(result.won, !loss);
    assert.equal(replay.height, model.height);
    assert.equal(replay.score, model.height * 1000);
    assert.equal(replay.state.totalShots, shots);
    assert.equal(
      payload.inputs.filter((input) => input.action === "SHOOT").length,
      shots,
      "cancel/double/moving never add extra shots",
    );
    assert.deepEqual(replay.state.balls, model.balls);
    assert.deepEqual(replay.state.bumpers, initialBumpers);
    assert.equal(replay.failure, loss ? "SHOTS_EXHAUSTED" : null);
    assert.equal(replay.state.shotsLeft, 18 - shots, "no shot budget refill");
    assert.equal(records.length, 1, "terminal submitted once");
    if (loss) {
      assert.equal(shots, 18);
      assert.ok(scratchProof);
      assert.ok(replay.height > 0 && replay.height < 10);
      const shotIndices = payload.inputs
          .map((input, index) => (input.action === "SHOOT" ? index : -1))
          .filter((index) => index >= 0),
        nextShotIndex = shotIndices[scratchProof.shot],
        beforeNextShot = replayCore(
          core,
          payload.inputs.slice(0, nextShotIndex),
          payload.inputs[nextShotIndex].tick,
          issued.manifest.seed,
          issued.manifest.competition.target_score,
        );
      assert.equal(beforeNextShot.error, "CLIENT_ENDED_BEFORE_RESOLUTION");
      assert.equal(beforeNextShot.state.phase, "aim");
      assert.equal(
        beforeNextShot.state.scratch,
        true,
        "posted inputs reproduce the non-scoring scratch",
      );
      assert.equal(beforeNextShot.height, scratchProof.beforeHeight);
      assert.equal(beforeNextShot.score, scratchProof.beforeHeight * 1000);
    } else {
      assert.equal(replay.height, 10);
      assert.ok(shots <= 18);
    }
    assert.ok(await page.evaluate(() => window.__billiardsOscillators > 0));
    await page.locator(".resultPanel").waitFor({ state: "visible" });
    assert.match(
      await page.locator(".resultPanel").innerText(),
      /Avance alcanzado/,
    );
    assert.doesNotMatch(
      await page.locator(".resultPanel").innerText(),
      /Puntos|Nivel/i,
    );
    const restarting = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page.getByRole("button", { name: "OTRA VEZ", exact: true }).tap();
    const again = await (await restarting).json();
    assert.notEqual(again.manifest.match_id, issued.manifest.match_id);
    assert.notEqual(again.manifest.seed, issued.manifest.seed);
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    await page.waitForFunction(
      () =>
        window.__billiardsView?.aim &&
        window.__billiardsView?.balls.length === 11,
    );
    assert.equal(await page.locator(".resultPanel").isVisible(), false);
    const restartModel = core.create(again.manifest.seed);
    assert.notDeepEqual(
      {
        balls: restartModel.balls.map(({ id, x, y }) => ({ id, x, y })),
        bumpers: restartModel.bumpers,
      },
      {
        balls: core
          .create(issued.manifest.seed)
          .balls.map(({ id, x, y }) => ({ id, x, y })),
        bumpers: initialBumpers,
      },
      "this independently issued restart has a distinct full arena",
    );
    await confirmPublicArena(restartModel, false);
    assert.match(await page.locator(".coreHud").innerText(), /AVANCE 0 \/ 10/);
    const abandoning = page.waitForResponse((r) =>
      r.url().includes("/verified-match/verify"),
    );
    await page.getByRole("button", { name: "Volver", exact: true }).tap();
    const abandonedResponse = await abandoning,
      abandonedPayload = abandonedResponse.request().postDataJSON(),
      receipt = await abandonedResponse.json();
    assert.equal(abandonedPayload.record_kind, "abandoned");
    assert.equal(abandonedPayload.ticket.attempt_id, again.ticket.attempt_id);
    assert.equal(abandonedPayload.inputs.length, 0);
    assert.equal(receipt.received, true);
    assert.equal(receipt.verified, false);
    assert.equal(receipt.final_tick, abandonedPayload.final_tick);
    if (replayPath)
      writeFileSync(
        replayPath,
        JSON.stringify(
          {
            ...replayArtifact,
            abandoned: { payload: abandonedPayload, receipt },
          },
          null,
          2,
        ),
      );
    assert.equal(records.length, 2);
    await page.getByRole("region", { name: "Catálogo de juegos" }).waitFor();
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        ok: true,
        orientation: landscape ? "landscape" : "portrait",
        loss,
        verified: true,
        won: result.won,
        score: replay.score,
        height: replay.height,
        shots,
        finalTick: replay.state.tick,
        timeMs: replay.timeMs,
        failure: replay.failure,
        scratchProof,
        sameArena: true,
        rotateAimAndMoving: true,
        restart: true,
        abandonedReceipt: true,
        errors,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
