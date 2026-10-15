// Native touch + real PostgreSQL HTTP flow; never contacts a deployed wallet.
const { chromium, request } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
);
const assert = require("node:assert/strict");
const base = process.env.QA_BASE_URL || "http://127.0.0.1:3098";
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(base).hostname),
  "isolated local QA only",
);
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const errors = [];
  const contexts = [];
  try {
    async function player(name, landscape = false) {
      const context = await browser.newContext({
        viewport: landscape
          ? { width: 844, height: 390 }
          : { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      contexts.push(context);
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(
        (name) =>
          localStorage.setItem(
            "skill-arena-v12",
            JSON.stringify({
              onboarded: true,
              playerName: name,
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
        name,
      );
      await page.goto(base);
      await page
        .getByRole("heading", { name: "Elige tu reto", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Entrenamiento gratis", exact: true })
        .tap();
      return { context, page, landscape };
    }
    async function start(p, gameName = "Dardos") {
      const issued = p.page.waitForResponse(
        (r) =>
          r.url().includes("/verified-match/start") &&
          r.request().method() === "POST",
      );
      await p.page
        .getByRole("button", { name: `Jugar a ${gameName}`, exact: true })
        .tap();
      const data = await (await issued).json();
      assert.equal(
        data.persistence?.durable,
        true,
        `start rejected: ${data.error ?? "unknown"}`,
      );
      assert.equal(data.manifest.manifest_version, 3);
      await p.page.locator(".countdownOverlay").waitFor({ state: "hidden" });
      await p.page.locator(".verificationOverlay").waitFor({ state: "hidden" });
      await p.page.waitForTimeout(150);
      return data;
    }
    async function play(p, miss) {
      const end = p.page.waitForResponse(
        (r) =>
          r.url().includes("/verified-match/verify") &&
          r.request().method() === "POST",
        { timeout: 60000 },
      );
      const cdp = await p.context.newCDPSession(p.page);
      for (let i = 0; i < 20; i++) {
        const box = await p.page.locator("canvas.gameCanvas").boundingBox(),
          scale = Math.min(box.width / 390, box.height / 620),
          ox = (box.width - 390 * scale) / 2,
          oy = (box.height - 620 * scale) / 2;
        const x = box.x + ox + (miss ? 45 : 195) * scale,
          from = box.y + oy + 560 * scale,
          to = box.y + oy + (miss ? 435 : 285) * scale;
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y: from }],
        });
        await p.page.waitForTimeout(40);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x, y: to }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await p.page.waitForTimeout(1360);
        if (i === 7)
          await p.page.setViewportSize(
            p.landscape
              ? { width: 390, height: 844 }
              : { width: 844, height: 390 },
          );
        if (i === 12)
          await p.page.setViewportSize(
            p.landscape
              ? { width: 844, height: 390 }
              : { width: 390, height: 844 },
          );
      }
      const response = await end,
        body = await response.json(),
        record = response.request().postDataJSON();
      assert.equal(body.verified, true);
      assert.equal(body.durable, true);
      assert.ok(!record.manifest && !record.ticket);
      assert.ok(record.inputs.length >= 20);
      await p.page.locator(".resultPanel").waitFor();
      const retry = await p.context.request.post(
        base + "/api/verified-match/verify",
        { data: record },
      );
      assert.equal((await retry.json()).verification_id, body.verification_id);
      return { body, record };
    }
    if (process.env.QA_STACK_ONLY) {
      for (const landscape of [false, true]) {
        const p = await player("QA-Stack", landscape);
        const issued = await start(p, "Stack");
        let done = false;
        const terminal = p.page.waitForResponse(
          (r) =>
            r.url().includes("/verified-match/verify") &&
            r.request().method() === "POST",
        );
        terminal.then(() => {
          done = true;
        });
        for (let i = 0; i < 40 && !done; i++) {
          await p.page.locator("canvas.gameCanvas").tap();
          await p.page.waitForTimeout(500);
        }
        const result = await (await terminal).json();
        assert.equal(result.verified, true);
        assert.equal(result.durable, true);
        assert.equal(result.match.matchId, issued.manifest.match_id);
        await p.page.locator(".resultPanel").waitFor();
        console.log(
          JSON.stringify({
            customStack: landscape ? "landscape" : "portrait",
            verified: true,
            height: result.height,
            errors,
          }),
        );
      }
      assert.deepEqual(errors, []);
      return;
    }
    const a = await player("QA-A");
    const ia = await start(a),
      ra = await play(a, false);
    assert.equal(ra.body.match.status, "waiting");
    const b = await player("QA-B", true);
    const availability = await (
      await b.context.request.get(
        base + "/api/verified-match/availability?stake_minor=0",
      )
    ).json();
    assert.equal(
      availability.games.find((g) => g.gameId === "darts")?.mode,
      "existing",
    );
    const ib = await start(b);
    assert.deepEqual(ib.manifest, ia.manifest);
    assert.equal(ib.ticket.slot, "B");
    const rb = await play(b, true);
    assert.equal(rb.body.match.winnerSlot, "A");
    await a.page
      .getByRole("heading", { name: "Reto superado", exact: true })
      .waitFor();
    const outsider = await request.newContext();
    await outsider.get(base + "/api/verified-match/session");
    assert.equal(
      (
        await outsider.get(
          base +
            "/api/verified-match/attempt?attempt_id=" +
            ia.ticket.attempt_id,
        )
      ).status(),
      404,
    );
    assert.equal(
      (
        await outsider.post(base + "/api/verified-match/start", {
          headers: { Origin: "https://attacker.invalid" },
          data: {},
        })
      ).status(),
      403,
    );
    assert.equal(
      (
        await outsider.post(base + "/api/verified-match/start", {
          data: "x".repeat(5000),
          headers: { "Content-Type": "application/json" },
        })
      ).status(),
      413,
    );
    assert.equal(
      (
        await a.context.request.post(base + "/api/verified-match/verify", {
          data: { ...ra.record, score: 999999 },
        })
      ).status(),
      400,
    );
    assert.equal(
      (
        await outsider.get(
          base +
            "/api/verified-match/attempt?attempt_id=" +
            ia.ticket.attempt_id,
          {
            headers: { Cookie: "arena_match_training=" + ia.ticket.player_id },
          },
        )
      ).status(),
      404,
      "public actor id is not the session capability",
    );
    const own = await (
      await a.context.request.get(base + "/api/verified-match/attempt")
    ).json();
    assert.ok(
      own.attempts.every((r) => r.attemptId !== ib.ticket.attempt_id),
      "own history excludes rival records",
    );
    assert.equal(
      (
        await outsider.post(base + "/api/verified-match/verify", {
          data: "x".repeat(600000),
          headers: { "Content-Type": "application/json" },
        })
      ).status(),
      413,
    );
    await outsider.dispose();
    const c = await player("QA-C");
    const ic = await start(c);
    await c.context.setOffline(true);
    await c.page
      .getByRole("heading", { name: "Partida perdida", exact: true })
      .waitFor();
    await c.page.waitForTimeout(21000);
    await c.context.setOffline(false);
    const loss = await (
      await c.context.request.get(
        base + "/api/verified-match/attempt?attempt_id=" + ic.ticket.attempt_id,
      )
    ).json();
    assert.equal(loss.forfeited, true);
    assert.equal(loss.verified, false);
    await c.page.getByRole("button", { name: "CAMBIAR", exact: true }).tap();
    const id = await start(c);
    assert.notEqual(id.manifest.seed, ic.manifest.seed);
    const exit = c.page.waitForResponse(
      (r) =>
        r.url().includes("/verified-match/verify") &&
        r.request().postDataJSON()?.record_kind === "abandoned",
    );
    await c.page.getByRole("button", { name: "Volver", exact: true }).tap();
    const abandoned = await (await exit).json();
    assert.equal(abandoned.forfeited, true);
    assert.equal(abandoned.durable, true);
    await c.page
      .getByRole("heading", { name: "Elige tu reto", exact: true })
      .waitFor();
    const restored = await start(c);
    const restoredReceipt = c.page.waitForResponse(
      (r) =>
        r.url().includes("/verified-match/verify") &&
        r.request().postDataJSON()?.attempt_id === restored.ticket.attempt_id &&
        r.request().postDataJSON()?.record_kind === "abandoned",
    );
    let restoredStarts = 0;
    c.page.on("request", (r) => {
      if (r.url().includes("/verified-match/start") && r.method() === "POST")
        restoredStarts++;
    });
    await c.page.evaluate(() => {
      dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
      dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    await c.page
      .getByRole("heading", { name: "Partida perdida", exact: true })
      .waitFor();
    assert.equal(
      restoredStarts,
      0,
      "BFCache restoration must not silently start a new attempt",
    );
    assert.equal((await (await restoredReceipt).json()).forfeited, true);
    const restoredStatus = await (
      await c.context.request.get(
        base +
          "/api/verified-match/attempt?attempt_id=" +
          restored.ticket.attempt_id,
      )
    ).json();
    assert.equal(restoredStatus.forfeited, true);
    await c.page.getByRole("button", { name: "CAMBIAR", exact: true }).tap();
    await c.page.getByRole("button", { name: "AVATAR", exact: true }).tap();
    await c.page
      .getByRole("region", { name: "Intentos guardados", exact: true })
      .waitFor();
    await c.page
      .getByRole("region", { name: "Intentos guardados" })
      .getByText("Perdida", { exact: true })
      .first()
      .waitFor();
    assert.ok(
      (await c.page
        .getByRole("region", { name: "Intentos guardados" })
        .getByText("Perdida", { exact: true })
        .count()) >= 2,
    );
    await c.page.reload();
    await c.page.getByRole("button", { name: "AVATAR", exact: true }).tap();
    await c.page
      .getByRole("region", { name: "Intentos guardados" })
      .getByText("Perdida", { exact: true })
      .first()
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        nativeTwentyThrowsBothOrientations: true,
        sharedScenario: true,
        authoritativeWinner: true,
        idempotentReplay: true,
        offlineLost: true,
        exitLost: true,
        restartVaried: true,
        outsiderAndCsrfAndOversizeRejected: true,
        errors,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
