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
      viewport: { width: 320, height: 740 },
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
      if (!localStorage.getItem("skill-arena-v12"))
        localStorage.setItem(
          "skill-arena-v12",
          JSON.stringify({
            onboarded: true,
            playerName: "QA-Nombre-largo-de-jugador",
            avatarId: 0,
            avatarSrc: "/avatars/avatar-1.svg",
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
    });
    await page.goto(process.env.QA_BASE_URL);
    await page.locator(".bottomNav button").last().tap();
    await page
      .getByRole("heading", { name: "Tu perfil", exact: true })
      .waitFor();
    assert.equal(
      await page.locator(".profitLine").getAttribute("points"),
      "0,50 100,50",
      "zero earnings align with zero axis",
    );
    assert.match(
      await page.locator(".accountWalletCard").innerText(),
      /SALDO DEMO/,
    );
    assert.match(
      await page.locator(".miniMovementList").innerText(),
      /Todavía no hay movimientos/,
    );
    await page
      .getByRole("button", { name: "Añadir 10 € demo", exact: true })
      .tap();
    assert.match(
      await page.locator(".accountWalletCard strong").innerText(),
      /35/,
    );
    await page
      .getByRole("button", { name: "Retirar 10 € demo", exact: true })
      .tap();
    assert.match(
      await page.locator(".accountWalletCard strong").innerText(),
      /25/,
    );
    assert.match(
      await page.locator(".chartHead strong").innerText(),
      /0/,
      "movements do not count as earned profits",
    );
    assert.match(
      await page.locator(".miniMovementList").innerText(),
      /Ingreso demo/,
    );
    await page.getByRole("button", { name: /Sonido/ }).tap();
    assert.equal(
      await page
        .getByRole("button", { name: /Sonido/ })
        .getAttribute("aria-pressed"),
      "true",
    );
    await page.reload();
    await page.locator(".bottomNav button").last().tap();
    assert.equal(
      await page
        .getByRole("button", { name: /Sonido/ })
        .getAttribute("aria-pressed"),
      "true",
    );
    for (const size of [
      { width: 320, height: 740 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(size);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      for (const b of await page
        .locator(".walletActions button,.settingsList button")
        .all()) {
        const r = await b.boundingBox();
        assert.ok(r.width >= 44 && r.height >= 44);
      }
    }
    await page.setViewportSize({ width: 320, height: 740 });
    await page.getByRole("button", { name: /Información de la demo/ }).tap();
    const texts = [];
    for (const name of ["Términos", "Privacidad", "Cookies", "Reglas"]) {
      const b = page
        .locator(".legalTabs")
        .getByRole("button", { name, exact: true });
      await b.tap();
      assert.equal(await b.getAttribute("aria-pressed"), "true");
      const r = await b.boundingBox();
      assert.ok(r.height >= 44 && r.width >= 44);
      texts.push(await page.locator(".legalCopy").innerText());
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    }
    assert.equal(new Set(texts).size, 4);
    assert.match(texts[0], /dinero real/i);
    assert.match(texts[1], /navegador/i);
    assert.match(texts[3], /servidor/i);
    await page.screenshot({
      path: "/workspace/.cloud-setup/account-legal-v48.png",
    });
    await page
      .getByRole("button", { name: "Volver al perfil", exact: true })
      .tap();
    await page
      .getByRole("heading", { name: "Tu perfil", exact: true })
      .waitFor();
    await page.getByRole("button", { name: /Nombre y avatar/ }).tap();
    await page.getByPlaceholder("Nombre de avatar").fill("QA_Perfil");
    await page.getByRole("button", { name: "Avatar 3", exact: true }).tap();
    await page
      .getByRole("button", { name: "ENTRAR EN LA GALAXIA", exact: true })
      .tap();
    await page.locator(".bottomNav button").last().tap();
    assert.equal(
      await page.locator(".profileStrip strong").innerText(),
      "QA_Perfil",
    );
    await page.screenshot({
      path: "/workspace/.cloud-setup/account-profile-v48.png",
    });
    await page.getByRole("button", { name: /Reiniciar perfil demo/ }).tap();
    assert.equal(
      await page.locator(".profileStrip strong").innerText(),
      "PLAYER_NEW",
    );
    assert.match(
      await page.locator(".accountWalletCard strong").innerText(),
      /25/,
    );
    assert.match(
      await page.locator(".miniMovementList").innerText(),
      /Ingreso demo/,
    );
    await page.getByRole("button", { name: /Cerrar sesión demo/ }).tap();
    await page
      .getByRole("button", { name: "EMPEZAR A JUGAR", exact: true })
      .waitFor();
    const local = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("skill-arena-v12") || "null"),
    );
    assert.ok(
      !local || (!local.onboarded && !local.playerName),
      "local demo identity cleared",
    );
    // Isolated local-demo display fixture, never production ranking data.
    await page.evaluate(() =>
      localStorage.setItem(
        "skill-arena-v12",
        JSON.stringify({
          onboarded: true,
          playerName: "QA_Chart",
          balance: 25,
          netEarnings: 20,
          nextTurn: "create",
          musicOn: false,
          earnings: [
            { label: "Inicio", value: 0 },
            { label: "Pérdida demo", value: -10 },
            { label: "Ganancia demo", value: 20 },
          ],
          movements: [],
          wins: 1,
          losses: 1,
          streak: 1,
          group: null,
        }),
      ),
    );
    await page.reload();
    await page.locator(".bottomNav button").last().tap();
    assert.equal(
      await page.locator(".profitLine").getAttribute("points"),
      "0.00,50.00 50.00,70.00 100.00,10.00",
      "negative and positive profits lie either side of zero",
    );
    assert.equal(errors.length, 0, JSON.stringify(errors));
    console.log(
      JSON.stringify({
        sizes: ["320×740", "844×390"],
        demoMovements: true,
        earnedProfitUnchanged: true,
        soundPersisted: true,
        legalSections: 4,
        editNavigation: true,
        resetPreservesDemoBalance: true,
        logout: true,
        honestChartAxis: true,
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
