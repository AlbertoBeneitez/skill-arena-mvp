// Native touch record lifecycle. Real server responses; never change seed,
// target, core state or simulation time. BFCache coverage below exercises its
// event handlers explicitly, rather than claiming a browser cache restoration.
const { chromium } = require(
    process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
  ),
  assert = require("node:assert/strict"),
  { register } = require("node:module"),
  { pathToFileURL } = require("node:url"),
  path = require("node:path");
register(pathToFileURL(path.join(__dirname, "determinism-loader.mjs")));

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
async function bounded(promise, label, timeout = 12000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}: timeout`)), timeout);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  const base = pathToFileURL(path.join(__dirname, "../.det-test/")).href,
    { MAZE_CORE_V2: core } = await import(base + "lib/verified/mazeRushCore.v2.js"),
    { replayCore } = await import(base + "lib/verified/coreRuntime.v1.js"),
    landscape = !!process.env.QA_LANDSCAPE,
    viewport = landscape ? { width: 844, height: 390 } : { width: 390, height: 844 },
    browser = await chromium.launch({
      executablePath: "/usr/bin/chromium",
      headless: true,
      args: ["--no-sandbox"],
    });
  try {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true }),
      page = await context.newPage(),
      errors = [],
      records = [],
      delayByAttempt = new Map(),
      transportErrors = [],
      lostConsumerAttempts = new Set(),
      transportOptions = [];
    page.setDefaultTimeout(12000);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await context.exposeBinding("__qaObserveAttemptTransport", (_, value) => {
      transportOptions.push(value);
    });
    await page.addInitScript(() => {
      localStorage.setItem("skill-arena-v12", JSON.stringify({
        onboarded: true, playerName: "QA_Records", balance: 25,
        netEarnings: 0, nextTurn: "create", musicOn: false,
        earnings: [{ label: "Inicio", value: 0 }], movements: [],
        wins: 0, losses: 0, streak: 0, group: null,
      }));
      // Observe and forward the browser's original fetch unchanged. No delay,
      // response/clock/core modification or fabricated server data.
      const originalFetch = window.fetch;
      window.fetch = function (...args) {
        if (args[0] === "/api/verified-match/verify") {
          const payload = JSON.parse(args[1].body);
          void window.__qaObserveAttemptTransport({
            attemptId: payload.ticket.attempt_id,
            keepalive: args[1].keepalive,
          });
        }
        return originalFetch.apply(this, args);
      };
    });

    // route.fetch forwards the actual signed request and captures the actual
    // receipt even when reload destroys the browser's response consumer.
    await context.route("**/api/verified-match/verify", async (route) => {
      const entry = {
        payload: route.request().postDataJSON(),
        processed: deferred(),
        delivered: deferred(),
      };
      records.push(entry);
      try {
        const response = await route.fetch();
        entry.status = response.status();
        entry.receipt = await response.json();
        entry.processed.resolve(entry);
        const delay = delayByAttempt.get(entry.payload.ticket.attempt_id);
        if (delay) await new Promise((done) => setTimeout(done, delay));
        entry.deliveryStartedAt = Date.now();
        await route.fulfill({ response });
      } catch (error) {
        // A real reload may discard the old response route. The server receipt
        // still has to exist and pass all assertions; other failures are fatal.
        if (!entry.receipt || !lostConsumerAttempts.has(entry.payload.ticket.attempt_id))
          transportErrors.push(error.message);
      } finally {
        entry.processed.resolve(entry);
        entry.delivered.resolve(entry);
      }
    });
    const catalog = page.getByRole("region", { name: "Catálogo de juegos" }),
      startUrl = (response) => response.url().includes("/verified-match/start");
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3069");
    await catalog.waitFor();

    async function settleCanvas() {
      await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
      await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
      await page.locator("canvas.gameCanvas").waitFor();
      await page.evaluate(() => new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done))));
    }
    async function start() {
      const response = page.waitForResponse(startUrl);
      await page.getByRole("button", { name: "Jugar a Maze Rush", exact: true }).tap();
      const issued = await (await response).json();
      assert.equal(issued.ok, true);
      assert.equal(issued.manifest.game_version, "2.0.0");
      await settleCanvas();
      assert.equal(await page.locator(".resultPanel").count(), 0);
      return issued;
    }
    async function exit() {
      await page.getByRole("button", { name: "Volver", exact: true }).tap();
      await catalog.waitFor();
    }
    async function receiptFor(issued) {
      const attempt = issued.ticket.attempt_id;
      for (let turn = 0; turn < 400; turn++) {
        const entry = records.find((record) => record.payload.ticket.attempt_id === attempt);
        if (entry) return bounded(entry.processed.promise, `server receipt ${attempt}`);
        await page.waitForTimeout(25);
      }
      throw new Error(`No record for ${attempt}`);
    }
    function validate(entry, issued, actions = []) {
      const { payload, receipt } = entry;
      assert.equal(entry.status, 200);
      assert.equal(payload.record_kind, "abandoned");
      assert.deepEqual(payload.manifest, issued.manifest);
      assert.deepEqual(payload.ticket, issued.ticket);
      assert.deepEqual(payload.inputs.map((input) => input.action), actions);
      assert.deepEqual(Object.keys(receipt).sort(),
        ["attempt_id", "durable", "final_tick", "ok", "received", "verified"]);
      assert.deepEqual(receipt, {
        ok: true, received: true, verified: false, durable: false,
        attempt_id: issued.ticket.attempt_id, final_tick: payload.final_tick,
      });
      assert.equal("score" in payload || "won" in payload, false);
      assert.ok(Buffer.byteLength(JSON.stringify(payload)) <= 60000,
        "these records fit the browser keepalive quota");
      const replay = replayCore(core, payload.inputs, payload.final_tick,
        issued.manifest.seed, issued.manifest.competition.target_score);
      assert.equal(replay.valid, false);
      assert.equal(replay.error, "CLIENT_ENDED_BEFORE_RESOLUTION");
      assert.equal(replay.state.status, "running");
      assert.equal(replay.state.tick, payload.final_tick);
      assert.equal(records.filter((record) =>
        record.payload.ticket.attempt_id === issued.ticket.attempt_id).length, 1,
      "exactly one record per attempt");
      return replay;
    }
    async function twoInputs() {
      await page.getByRole("button", { name: "Girar arriba", exact: true }).tap();
      await page.waitForTimeout(100); // Greater than the six-tick input cooldown.
      await page.getByRole("button", { name: "Detener movimiento", exact: true }).tap();
    }

    const noInput = await start();
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.setViewportSize(landscape
      ? { width: 390, height: 844 } : { width: 844, height: 390 });
    await page.waitForTimeout(150);
    assert.equal(records.length, 0, "blur and rotation never abandon a live attempt");
    await page.setViewportSize(viewport);
    await exit();
    validate(await receiptFor(noInput), noInput);

    const delayed = await start();
    await twoInputs();
    delayByAttempt.set(delayed.ticket.attempt_id, 4500);
    await exit();
    const delayedEntry = await receiptFor(delayed);
    validate(delayedEntry, delayed, ["UP", "STOP"]);
    const replacement = await start();
    assert.notEqual(replacement.ticket.attempt_id, delayed.ticket.attempt_id);
    assert.equal(delayedEntry.deliveryStartedAt, undefined,
      "a fresh attempt starts before the old response is delivered");
    await bounded(delayedEntry.delivered.promise, "delayed response");
    assert.equal(await page.locator(".resultPanel").count(), 0,
      "an old receipt cannot produce a stale result in the replacement");
    assert.ok((await page.locator(".coreHud").innerText()).includes("NODOS"));
    await exit();
    validate(await receiptFor(replacement), replacement);

    const historyAttempt = await start(),
      beforeHistory = records.length;
    await page.evaluate(() => {
      window.__qaHistoryObserved = false;
      window.addEventListener("popstate", () => { window.__qaHistoryObserved = true; }, { once: true });
      history.back();
    });
    await page.waitForFunction(() => window.__qaHistoryObserved);
    await page.waitForTimeout(150);
    assert.equal(await page.locator(".gameScreen").isVisible(), true);
    assert.equal(await page.evaluate(() => location.hash), "#game");
    assert.equal(records.length, beforeHistory,
      "the existing active-game history guard does not abandon");
    await exit();
    validate(await receiptFor(historyAttempt), historyAttempt);

    const reloadAttempt = await start();
    await twoInputs();
    // Flag only this navigation's old consumer; no server rejection is ignored.
    lostConsumerAttempts.add(reloadAttempt.ticket.attempt_id);
    await page.reload();
    await catalog.waitFor();
    const reloadedEntry = await receiptFor(reloadAttempt);
    validate(reloadedEntry, reloadAttempt, ["UP", "STOP"]);
    await bounded(reloadedEntry.delivered.promise, "reload receipt route");
    assert.equal(await page.locator(".resultPanel").count(), 0);

    let cachedAttempt = await start();
    for (let cycle = 0; cycle < 2; cycle++) {
      const previous = cachedAttempt,
        response = page.waitForResponse(startUrl);
      await page.evaluate(() => {
        window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
        window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
      });
      cachedAttempt = await (await response).json();
      assert.equal(cachedAttempt.ok, true);
      assert.notEqual(cachedAttempt.ticket.attempt_id, previous.ticket.attempt_id);
      assert.equal(cachedAttempt.manifest.game_version, "2.0.0");
      await settleCanvas();
      validate(await receiptFor(previous), previous);
      assert.equal(await page.locator(".resultPanel").count(), 0);
    }
    await exit();
    validate(await receiptFor(cachedAttempt), cachedAttempt);

    const pendingRelease = deferred(), pendingFetched = deferred(),
      beforePending = records.length;
    await context.route("**/api/verified-match/start", async (route) => {
      try {
        const response = await route.fetch();
        pendingFetched.resolve(await response.json());
        await pendingRelease.promise;
        await route.fulfill({ response });
      } catch {
        // The consumer intentionally cancels this still-pending start.
        pendingFetched.resolve(null);
      }
    });
    await page.getByRole("button", { name: "Jugar a Maze Rush", exact: true }).tap();
    await page.locator(".verificationOverlay").waitFor({ state: "visible" });
    assert.equal(await page.locator(".verificationOverlay").innerText(), "PREPARANDO PARTIDA");
    const unreceived = await bounded(pendingFetched.promise, "pending start server response");
    assert.ok(unreceived?.ok, "a genuine response is withheld rather than fabricated");
    await exit();
    pendingRelease.resolve();
    await page.waitForTimeout(200);
    assert.equal(records.length, beforePending,
      "a pending start without an issued browser session emits no fake replay");
    assert.equal(records.some((record) =>
      record.payload.ticket.attempt_id === unreceived.ticket.attempt_id), false);
    assert.equal(await page.locator(".resultPanel").count(), 0);
    await context.unroute("**/api/verified-match/start");

    for (const entry of records)
      assert.equal(records.filter((other) =>
        other.payload.ticket.attempt_id === entry.payload.ticket.attempt_id).length, 1);
    assert.equal(records.length, 8, "only the eight actually played attempts are recorded");
    for (const entry of records) {
      const observed = transportOptions.filter((value) =>
        value.attemptId === entry.payload.ticket.attempt_id);
      assert.equal(observed.length, 1, "the browser initiates one original fetch per attempt");
      assert.equal(observed[0].keepalive, true);
    }
    assert.deepEqual(transportErrors, []);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({
      orientation: landscape ? "landscape" : "portrait",
      records: records.length, inputPrefix: ["UP", "STOP"],
      realServerReceipts: true, authoritativeResultsInvented: false,
      blurRotationContinue: true, delayedResponseIsolation: true,
      historyGuardThenExit: true, reloadKeepaliveReceipt: true,
      syntheticBFCacheHandlerCycles: 2, actualBFCacheRestorationClaimed: false,
      pendingStartNoRecord: true, errors,
    }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
