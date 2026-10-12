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
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.addInitScript(() =>
      localStorage.setItem(
        "skill-arena-v12",
        JSON.stringify({
          onboarded: true,
          playerName: "QA_Gesture",
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
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3121");
    const start = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Galactic Roulette", exact: true })
      .tap();
    await start;
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    const select = page.getByRole("combobox", {
      name: "Apuesta de ruleta",
      exact: true,
    });
    await select.focus();
    await select.press("Home");
    await page.waitForTimeout(80);
    await select.press("ArrowDown");
    await page.waitForTimeout(80);
    assert.equal(await select.inputValue(), "BET_BLACK");
    const cdp = await context.newCDPSession(page);
    async function drag(to, cancel = false, from = { x: 323, y: 330 }) {
      const b = await page.locator("canvas.gameCanvas").boundingBox(),
        k = Math.min(b.width / 390, b.height / 400),
        ox = b.x + (b.width - 390 * k) / 2,
        oy = b.y + (b.height - 400 * k) / 2;
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: ox + from.x * k, y: oy + from.y * k }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: ox + to.x * k, y: oy + to.y * k }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: cancel ? "touchCancel" : "touchEnd",
        touchPoints: [],
      });
    }
    await drag({ x: 315, y: 180 }, true);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await drag({ x: 280, y: 185 }, false, { x: 195, y: 195 });
    assert.ok(
      (await page.locator(".coreHud").innerText()).startsWith("100.00"),
    );
    await drag({ x: 315, y: 180 });
    await page.waitForTimeout(100);
    assert.equal(await select.isDisabled(), true);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(6500);
    assert.equal(await select.isDisabled(), false);
    await drag({ x: 285, y: 299 });
    await drag({ x: 285, y: 299 });
    await page.waitForTimeout(100);
    assert.equal(await select.isDisabled(), true);
    const response = page.waitForResponse((r) =>
      r.url().includes("/verified-match/verify"),
    );
    const b = await page
      .getByRole("button", { name: "Volver", exact: true })
      .boundingBox();
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }],
    });
    await page.waitForTimeout(80);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    const r = await response,
      body = r.request().postDataJSON(),
      receipt = await r.json();
    const launches = body.inputs
      .filter((i) => i.action.startsWith("LAUNCH_"))
      .map((i) => i.action);
    assert.deepEqual(launches, ["LAUNCH_CCW_35", "LAUNCH_CW_06"]);
    assert.ok(body.inputs.some((i) => i.action === "BET_BLACK"));
    assert.equal(receipt.received, true);
    assert.equal(receipt.verified, false);
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        nativeKeyboardChoice: true,
        cancel: true,
        wrongStartRejected: true,
        bothDirections: launches,
        rotation: true,
        doubleLaunchRejected: true,
        prefix: true,
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
