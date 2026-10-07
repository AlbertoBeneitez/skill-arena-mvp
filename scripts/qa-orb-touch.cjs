// Browser regression: real Chromium touch events against a production build.
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
);
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem(
      "skill-arena-v12",
      JSON.stringify({
        onboarded: true,
        playerName: "QA-Arena",
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
  });
  await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3000");
  await page.locator(".quickStakeBar button").first().click();
  await page
    .getByRole("button", { name: "Jugar a Orb Burst", exact: true })
    .click();
  await page.locator('canvas[aria-label="Orb Burst"]').waitFor();
  await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
  await page.waitForTimeout(100);
  const c = page.locator('canvas[aria-label="Orb Burst"]');
  const rect = await c.boundingBox();
  const cdp = await context.newCDPSession(page);
  const x = rect.x + rect.width * 0.66,
    y = rect.y + rect.height * 0.58;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await page.waitForTimeout(40);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(220);
  const result = await c.evaluate((c) => {
    const ctx = c.getContext("2d");
    let shotPixels = 0;
    for (let y = 440; y < 560; y++)
      for (let x = 180; x < 250; x++) {
        const p = ctx.getImageData(x, y, 1, 1).data;
        if (Math.max(p[0], p[1], p[2]) > 170 && Math.min(p[0], p[1], p[2]) > 50)
          shotPixels++;
      }
    return { shotPixels };
  });
  require("node:assert/strict").ok(
    result.shotPixels > 400,
    `Touch release must launch a visible ball, got ${result.shotPixels} pixels`,
  );
  require("node:assert/strict").deepEqual(errors, []);
  console.log(JSON.stringify({ result, errors }));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
