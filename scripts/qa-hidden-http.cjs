const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
);
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext(),
      page = await context.newPage();
    const base = process.env.QA_BASE_URL || "http://127.0.0.1:3116";
    await page.goto(base);
    const ready = await context.request.get(base + "/api/hidden-game/start");
    assert.equal(ready.headers()["cache-control"], "no-store");
    if (process.env.QA_UNCONFIGURED) {
      assert.deepEqual(await ready.json(), {
        available: false,
        scope: "training",
        durable: false,
      });
      const unavailable = await context.request.post(
        base + "/api/hidden-game/start",
        { headers: { origin: base }, data: { gameId: "mine-grid" } },
      );
      assert.equal((await unavailable.json()).status, "not-configured");
      assert.equal(unavailable.headers()["set-cookie"], undefined);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.addInitScript(() =>
        localStorage.setItem(
          "skill-arena-v12",
          JSON.stringify({
            onboarded: true,
            playerName: "QA_Unconfigured",
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
        ),
      );
      await page.reload();
      await page
        .getByRole("button", { name: "Jugar a Mine Grid", exact: true })
        .click();
      await page.locator(".mineGridBoard").waitFor();
      assert.equal(await page.locator(".mineAuthorityBoard").count(), 0);
      assert.deepEqual(errors, []);
      console.log(
        "Unconfigured HTTP: no private activation/cookie/memory fallback; legacy training preserved without console errors",
      );
      return;
    }
    assert.deepEqual(await ready.json(), {
      available: true,
      scope: "training",
      durable: true,
    });
    const start = await context.request.post(base + "/api/hidden-game/start", {
      headers: { origin: base },
      data: { gameId: "mine-grid" },
    });
    const session = await start.json();
    assert.equal(session.gameVersion, "2.0.0");
    const cookie = start.headers()["set-cookie"];
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=strict/i);
    assert.ok(!("seed" in session) && !("manifest" in session));
    const before = await context.request.get(
      base + "/api/hidden-game/session?attemptId=" + session.attemptId,
    );
    assert.deepEqual(await before.json(), session);
    const alien = await browser.newContext();
    assert.equal(
      (
        await alien.request.get(
          base + "/api/hidden-game/session?attemptId=" + session.attemptId,
        )
      ).status(),
      404,
    );
    const action = "OPEN_" + String(session.view.startIndex).padStart(3, "0"),
      payload = {
        attemptId: session.attemptId,
        commandId: crypto.randomUUID(),
        expectedRevision: 0,
        action,
      };
    assert.equal(
      (
        await context.request.post(base + "/api/hidden-game/command", {
          headers: { origin: "https://cross-origin.invalid" },
          data: payload,
        })
      ).status(),
      400,
    );
    assert.equal(
      (
        await context.request.post(base + "/api/hidden-game/command", {
          headers: { origin: "not-an-origin" },
          data: payload,
        })
      ).status(),
      400,
    );
    assert.equal(
      (
        await context.request.post(base + "/api/hidden-game/command", {
          headers: { origin: base },
          data: { ...payload, seed: "client-choice" },
        })
      ).status(),
      400,
    );
    assert.equal(
      (
        await context.request.post(base + "/api/hidden-game/command", {
          headers: { origin: base, "content-type": "application/json" },
          data: "{",
        })
      ).status(),
      400,
    );
    assert.equal(
      (
        await context.request.post(base + "/api/hidden-game/command", {
          headers: { origin: base, "content-type": "application/json" },
          data: JSON.stringify({ ...payload, extra: "x".repeat(5000) }),
        })
      ).status(),
      400,
    );
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, () =>
        context.request.post(base + "/api/hidden-game/command", {
          headers: { origin: base },
          data: payload,
        }),
      ),
    );
    const values = await Promise.all(outcomes.map((r) => r.json()));
    assert.ok(outcomes.every((r) => r.status() === 200));
    assert.ok(values.every((s) => s.revision === 1));
    assert.ok(
      values.every((s) => JSON.stringify(s) === JSON.stringify(values[0])),
    );
    const stale = await context.request.post(
      base + "/api/hidden-game/command",
      {
        headers: { origin: base },
        data: { ...payload, commandId: crypto.randomUUID() },
      },
    );
    assert.equal(stale.status(), 409);
    const after = await context.request.get(
      base + "/api/hidden-game/session?attemptId=" + session.attemptId,
    );
    assert.equal((await after.json()).revision, 1);
    // A committed UI command survives immediate navigation. It is one durable
    // prefix, not a terminal result or an abandoned winner.
    await page.addInitScript(() =>
      localStorage.setItem(
        "skill-arena-v12",
        JSON.stringify({
          onboarded: true,
          playerName: "QA_ExitMine",
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
      ),
    );
    await page.reload();
    const issued = page.waitForResponse(
      (r) =>
        r.url().includes("/hidden-game/start") &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Jugar a Mine Grid", exact: true })
      .click();
    const active = await (await issued).json();
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    const response = page.waitForResponse((r) =>
      r.url().includes("/hidden-game/command"),
    );
    const received = page.waitForRequest((r) =>
      r.url().includes("/hidden-game/command"),
    );
    await page.locator(".mineAuthorityCell.opening").click();
    await received;
    await page.getByRole("button", { name: "Volver", exact: true }).click();
    await response;
    const prefix = await context.request.get(
      base + "/api/hidden-game/session?attemptId=" + active.attemptId,
    );
    const saved = await prefix.json();
    assert.equal(saved.revision, 1);
    assert.equal(saved.status, "running");
    assert.equal(saved.verified, false);
    assert.equal(await page.locator(".resultPanel").count(), 0);
    console.log(
      "Hidden HTTP: private projections, cookie isolation, origin/body/seed/stale rejection, concurrent retry once, committed exit-prefix persists without a winner",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
