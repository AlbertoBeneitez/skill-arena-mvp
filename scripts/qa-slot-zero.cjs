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
    for (const landscape of [false, true]) {
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
            playerName: "QA_Zero",
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
        const clear = CanvasRenderingContext2D.prototype.clearRect,
          fill = CanvasRenderingContext2D.prototype.fillText;
        window.__slotFrame = [];
        CanvasRenderingContext2D.prototype.clearRect = function (...a) {
          window.__slotFrame = [];
          return clear.apply(this, a);
        };
        CanvasRenderingContext2D.prototype.fillText = function (...a) {
          window.__slotFrame.push(a);
          return fill.apply(this, a);
        };
      });
      await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3120");
      const start = page.waitForResponse((r) =>
        r.url().includes("/verified-match/start"),
      );
      await page
        .getByRole("button", { name: "Jugar a Galactic Slot", exact: true })
        .tap();
      const issued = await (await start).json();
      assert.equal(issued.manifest.game_version, "1.0.0");
      await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
      await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
      await page.waitForFunction(() =>
        window.__slotFrame.some((a) => a[0] === "8" && a[2] === 230),
      );
      const cdp = await context.newCDPSession(page);
      async function touch(name, cancel = false) {
        const b = await page
          .getByRole("button", { name, exact: true })
          .boundingBox();
        assert.ok(b.width >= 44 && b.height >= 44);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }],
        });
        await page.waitForTimeout(80);
        await cdp.send("Input.dispatchTouchEvent", {
          type: cancel ? "touchCancel" : "touchEnd",
          touchPoints: [],
        });
      }
      await touch("Reducir avance de ruleta 1");
      await page.waitForFunction(() =>
        window.__slotFrame.some(
          (a) => a[0] === "0" && a[1] === 85 && a[2] === 490,
        ),
      );
      await touch("Girar ruletas por 5 euros ficticios");
      await page.waitForTimeout(3100);
      await page.waitForFunction(
        () => window.__slotFrame.every((a) => !(a[0] === "8" && a[2] === 230)),
        { timeout: 15000 },
      );
      assert.ok(
        (await page.locator(".coreHud").innerText()).includes("FICTICIOS"),
      );
      const before = await page.locator(".coreHud").innerText();
      await page.setViewportSize(
        landscape ? { width: 390, height: 844 } : { width: 844, height: 390 },
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      const receipt = page.waitForResponse((r) =>
        r.url().includes("/verified-match/verify"),
      );
      await touch("Volver");
      const r = await receipt,
        body = r.request().postDataJSON(),
        result = await r.json();
      assert.equal(result.received, true);
      assert.equal(result.verified, false);
      assert.equal(
        body.inputs.filter((i) => i.action === "REEL_0_LESS").length,
        1,
      );
      assert.equal(body.inputs.filter((i) => i.action === "SPIN").length, 1);
      assert.deepEqual(errors, []);
      console.log(
        JSON.stringify({
          landscape,
          zero: true,
          hiddenAtTenSeconds: true,
          rotation: true,
          prefix: true,
          errors,
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
