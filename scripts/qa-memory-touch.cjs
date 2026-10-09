// Native touches; the planner remembers only the legally rendered initial preview.
// No seed chosen, manifest altered, app clock changed or React/core state inspected.
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
);
const assert = require("node:assert/strict");
const { register } = require("node:module");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const repo = process.env.QA_REPO_ROOT || path.resolve(__dirname, "..");
register(pathToFileURL(path.join(repo, "scripts/determinism-loader.mjs")));

(async () => {
  const { MEMORY_CORE: core } = await import(
      pathToFileURL(
        path.join(repo, ".det-test/lib/verified/memoryMatchCore.v1.js"),
      )
    ),
    { replayCore } = await import(
      pathToFileURL(path.join(repo, ".det-test/lib/verified/coreRuntime.v1.js"))
    ),
    landscape = !!process.env.QA_LANDSCAPE,
    mode = process.env.QA_TIMEOUT
      ? "timeout"
      : process.env.QA_LOSS
        ? "mismatch"
        : "win",
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
          playerName: "QA_Memory",
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
      window.__memoryOscillators = 0;
      const oscillator = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function (...args) {
        window.__memoryOscillators++;
        return oscillator.apply(this, args);
      };
      const prototype = CanvasRenderingContext2D.prototype,
        clear = prototype.clearRect,
        rounded = prototype.roundRect,
        text = prototype.fillText,
        observing = (ctx) => ctx.canvas.classList.contains("gameCanvas");
      prototype.clearRect = function (...args) {
        if (observing(this)) window.__memoryView = { cards: [], faces: [] };
        return clear.apply(this, args);
      };
      prototype.roundRect = function (x, y, width, height, ...args) {
        if (
          observing(this) &&
          window.__memoryView &&
          x < 0 &&
          y < 0 &&
          width > 40 &&
          height > 40
        ) {
          const t = this.getTransform();
          window.__memoryView.cards.push({
            x: t.e,
            y: t.f,
            width: Math.abs(t.a * width),
            height: Math.abs(t.d * height),
          });
        }
        return rounded.call(this, x, y, width, height, ...args);
      };
      prototype.fillText = function (value, x, y, ...args) {
        if (
          observing(this) &&
          window.__memoryView &&
          x === 0 &&
          y > 0 &&
          /^(0[1-9]|1[0-2])$/.test(String(value))
        ) {
          const t = this.getTransform();
          window.__memoryView.faces.push({
            id: Number(value) - 1,
            x: t.e,
            y: t.f,
          });
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
      .getByRole("button", { name: "Jugar a Memoria", exact: true })
      .tap();
    const issued = await (await starting).json();
    assert.equal(issued.ok, true);
    assert.equal(issued.manifest.game_id, "memory-match");
    assert.equal(issued.manifest.game_version, "1.0.0");
    assert.equal(issued.manifest.competition.target_score, 1000000000);
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    await page.waitForFunction(() => window.__memoryView?.faces.length === 24);

    async function view() {
      return page.evaluate(() => {
        const snapshot = window.__memoryView,
          canvas = document.querySelector("canvas.gameCanvas"),
          b = canvas.getBoundingClientRect(),
          scaleX = b.width / canvas.width,
          scaleY = b.height / canvas.height,
          byCenter = new Map();
        for (const card of snapshot.cards) {
          const key = `${Math.round(card.x)}:${Math.round(card.y)}`,
            prior = byCenter.get(key);
          if (!prior || card.width > prior.width) byCenter.set(key, card);
        }
        const cards = [...byCenter.values()].sort((a, b) =>
          Math.abs(a.y - b.y) > 2 ? a.y - b.y : a.x - b.x,
        );
        return {
          cards: cards.map((card) => ({
            x: b.x + card.x * scaleX,
            y: b.y + card.y * scaleY,
            width: card.width * scaleX,
            height: card.height * scaleY,
          })),
          faces: snapshot.faces.map((face) => ({
            id: face.id,
            index: cards.findIndex(
              (card) =>
                Math.abs(card.x - face.x) < 2 && Math.abs(card.y - face.y) < 2,
            ),
          })),
        };
      });
    }
    const legalPreview = await view(),
      remembered = new Array(24);
    assert.equal(legalPreview.cards.length, 24);
    for (const face of legalPreview.faces) {
      assert.ok(face.index >= 0);
      remembered[face.index] = face.id;
    }
    assert.equal(
      remembered.filter((value) => Number.isInteger(value)).length,
      24,
    );
    for (const id of new Set(remembered))
      assert.equal(remembered.filter((value) => value === id).length, 2);
    assert.equal(remembered[0], remembered[1]);
    assert.equal(remembered[6], remembered[7]);

    async function checkLayout(label) {
      await page.waitForTimeout(250);
      const state = await view();
      assert.equal(state.cards.length, 24);
      for (const card of state.cards) {
        assert.ok(
          card.width >= 44 && card.height >= 44,
          `${label}: card target ${card.width.toFixed(2)} × ${card.height.toFixed(2)}`,
        );
        assert.ok(
          card.x >= card.width / 2 &&
            card.x + card.width / 2 <= (await page.viewportSize()).width + 0.1,
        );
      }
      assert.equal(
        await page.evaluate(() => document.body.scrollWidth > innerWidth),
        false,
      );
      return state;
    }
    await checkLayout("initial");
    if (!landscape) {
      await page.setViewportSize({ width: 320, height: 720 });
      await checkLayout("320 portrait");
      await page.setViewportSize(originalViewport);
    }
    if (process.env.QA_SCREENSHOT)
      await page.screenshot({ path: process.env.QA_SCREENSHOT });
    assert.equal(await page.locator(".coreHint, .tutorialOverlay").count(), 0);
    const openingHud = await page.locator(".memoryOrbitVerified").innerText();
    assert.match(openingHud, /0\/12 PAREJAS/);
    assert.match(openingHud, /VIDAS 8/);
    const cdp = await context.newCDPSession(page);
    async function touch(index, cancel = false, endIndex = index) {
      const geometry = await view(),
        from = geometry.cards[index],
        to = geometry.cards[endIndex];
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: from.x, y: from.y }],
      });
      if (endIndex !== index)
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: to.x, y: to.y }],
        });
      await cdp.send("Input.dispatchTouchEvent", {
        type: cancel ? "touchCancel" : "touchEnd",
        touchPoints: [],
      });
    }
    // Inputs during the legal preview are ignored, without skipping the preview.
    await touch(0);
    await page.waitForFunction(
      () => window.__memoryView?.faces.length === 0,
      {},
      { timeout: 11000 },
    );
    await touch(0, true);
    await touch(0, false, 1);
    await page.waitForTimeout(100);
    assert.equal(
      (await view()).faces.length,
      0,
      "cancel and drag never reveal a card",
    );
    await page
      .getByRole("button", { name: "Activar sonido", exact: true })
      .tap();
    const terminal = page.waitForResponse(
      (response) => response.url().includes("/verified-match/verify"),
      { timeout: 150000 },
    );
    terminal.catch(() => {});

    const pairs = [...new Set(remembered)].map((id) =>
        remembered
          .map((value, index) => (value === id ? index : -1))
          .filter((index) => index >= 0),
      ),
      completed = new Set();
    async function pair([first, second]) {
      await touch(first);
      await page.waitForTimeout(120);
      await touch(first); // An accidental duplicate on the same face is invalid.
      await page.waitForTimeout(70);
      await touch(second);
      await page.waitForTimeout(180);
      completed.add(first);
      completed.add(second);
    }
    if (mode === "win") {
      for (let i = 0; i < pairs.length; i++) {
        await pair(pairs[i]);
        if (i === 5) {
          await page.setViewportSize(
            landscape
              ? { width: 390, height: 844 }
              : { width: 844, height: 390 },
          );
          const rotated = await checkLayout("mid-run rotation");
          for (const face of rotated.faces)
            assert.equal(
              face.id,
              remembered[face.index],
              "rotation preserves board order",
            );
          await page.setViewportSize(originalViewport);
          await checkLayout("rotation restored");
        }
      }
    } else if (mode === "mismatch") {
      await pair(pairs[0]);
      await pair(pairs[1]);
      const first = remembered.findIndex((_, index) => !completed.has(index)),
        second = remembered.findIndex(
          (id, index) => !completed.has(index) && id !== remembered[first],
        );
      for (let mistake = 0; mistake < 10; mistake++) {
        await touch(first);
        await page.waitForTimeout(100);
        await touch(second);
        if (mistake < 9) {
          await page.waitForFunction(
            () => window.__memoryView?.faces.length === 4,
            {},
            { timeout: 3000 },
          );
          if (mistake < 2)
            assert.match(await page.locator(".coreHud").innerText(), /VIDAS 8/);
        }
      }
    } else {
      await pair(pairs[0]); // Real 120 s timeout; no mocked clocks/ticks.
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
    assert.equal(response.status(), 200);
    assert.equal(result.verified, true);
    assert.equal(payload.record_kind ?? "terminal", "terminal");
    assert.equal(payload.ticket.attempt_id, issued.ticket.attempt_id);
    assert.deepEqual(payload.manifest, issued.manifest);
    assert.equal(replay.valid, true, replay.error);
    assert.equal(result.score, replay.score);
    assert.equal(result.height, replay.height);
    assert.equal(result.time_ms, replay.timeMs);
    assert.equal(result.won, mode === "win");
    assert.equal(
      replay.height,
      mode === "win" ? 12 : mode === "mismatch" ? 2 : 1,
    );
    assert.equal(
      payload.inputs.length,
      mode === "timeout" ? 2 : 24,
      "no cancel/drag/duplicate inputs recorded",
    );
    assert.equal(
      replay.failure,
      mode === "win"
        ? null
        : mode === "mismatch"
          ? "MEMORY_MISMATCH"
          : "TIME_LIMIT",
    );
    assert.equal(records.length, 1, "terminal record submitted once");
    assert.ok(await page.evaluate(() => window.__memoryOscillators > 0));
    await page.locator(".resultPanel").waitFor({ state: "visible" });
    assert.match(await page.locator(".resultPanel").innerText(), /Avance/);
    assert.doesNotMatch(
      await page.locator(".resultPanel").innerText(),
      /Puntos|Nivel/i,
    );
    const restarted = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page.getByRole("button", { name: "OTRA VEZ", exact: true }).tap();
    const again = await (await restarted).json();
    assert.notEqual(again.manifest.match_id, issued.manifest.match_id);
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    await page.waitForFunction(() => window.__memoryView?.faces.length === 24);
    assert.equal(await page.locator(".resultPanel").isVisible(), false);
    assert.match(await page.locator(".coreHud").innerText(), /0\/12 PAREJAS/);
    const abandoning = page.waitForResponse((r) =>
      r.url().includes("/verified-match/verify"),
    );
    await page.getByRole("button", { name: "Volver", exact: true }).tap();
    const abandonedResponse = await abandoning,
      abandonedPayload = abandonedResponse.request().postDataJSON(),
      receipt = await abandonedResponse.json();
    assert.equal(abandonedPayload.record_kind, "abandoned");
    assert.equal(abandonedPayload.inputs.length, 0);
    assert.equal(abandonedPayload.ticket.attempt_id, again.ticket.attempt_id);
    assert.equal(receipt.received, true);
    assert.equal(receipt.verified, false);
    assert.equal(receipt.final_tick, abandonedPayload.final_tick);
    assert.equal(records.length, 2);
    await page.getByRole("region", { name: "Catálogo de juegos" }).waitFor();
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        ok: true,
        orientation: landscape ? "landscape" : "portrait",
        mode,
        score: replay.score,
        height: replay.height,
        mistakes: replay.state.mistakes,
        finalTick: replay.state.tick,
        timeMs: replay.timeMs,
        inputs: payload.inputs.length,
        cancelledAndDraggedIgnored: true,
        rotationPreservesOrder: mode === "win",
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
