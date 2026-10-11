// Touch onboarding, active catalogue retirement and disabled HTTP starts.
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
);
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
      { width: 320, height: 568 },
    ]) {
      const context = await browser.newContext({
        viewport,
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        (process.env.QA_BASE_URL || "http://127.0.0.1:3111") + "/?fresh=1",
      );
      await page
        .getByRole("button", { name: "Iniciar sesión local", exact: true })
        .tap();
      const title = page.getByRole("heading", {
        name: "Elige tu identidad",
        exact: true,
      });
      await title.waitFor();
      assert.equal(
        await title.evaluate((e) => getComputedStyle(e).color),
        "rgb(255, 255, 255)",
      );
      assert.equal(
        await page.locator(".galacticAvatarChoices button").count(),
        8,
      );
      await page
        .getByLabel("Nombre de avatar", { exact: true })
        .fill("QA_Identidad");
      await page.getByRole("button", { name: "CONTINUAR", exact: true }).tap();
      await page.getByRole("region", { name: "Catálogo de juegos" }).waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Jugar a Memoria", exact: true })
          .count(),
        0,
      );
      const retired = await page.request.post(
        (process.env.QA_BASE_URL || "http://127.0.0.1:3111") +
          "/api/verified-match/start",
        {
          data: { game_id: "memory-match", stake_minor: 0, target_score: 1e9 },
        },
      );
      assert.equal(retired.status(), 400);
      assert.equal((await retired.json()).error, "UNSUPPORTED_GAME_VERSION");
      assert.deepEqual(errors, []);
      console.log(
        JSON.stringify({
          viewport,
          titleWhite: true,
          memoryRetired: true,
          retiredStartRejected: true,
          errors: 0,
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
