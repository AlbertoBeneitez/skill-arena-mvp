// Product discovery/navigation QA, real touch, narrow screen and orientation change.
const { chromium } = require(
    process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
  ),
  assert = require("node:assert/strict");
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
          playerName: "QA-Catálogo",
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
      ),
    );
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3042");
    const catalog = page.getByRole("region", { name: "Catálogo de juegos" }),
      search = page.getByLabel("Encuentra tu próximo reto", { exact: true });
    await catalog.waitFor();
    assert.equal(await catalog.locator("article").count(), 20);
    assert.equal(
      await catalog.getByRole("heading").count(),
      0,
      "cover titles are not repeated below artwork",
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Entrenamiento gratis", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(
      await page.locator('.bottomNav button[aria-current="page"]').innerText(),
      "▶\nJUGAR",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    for (const b of await page
      .locator(".bottomNav button,.quickStakeBar button")
      .all()) {
      const r = await b.boundingBox();
      assert.ok(r.height >= 44 && r.width >= 44);
    }
    assert.equal(
      await page
        .locator(".appHeader")
        .evaluate((e) => getComputedStyle(e).backgroundColor),
      "rgb(11, 21, 38)",
    );
    assert.equal(
      await page
        .locator('.bottomNav button[aria-current="page"]')
        .evaluate((e) => getComputedStyle(e).backgroundColor),
      "rgb(24, 44, 65)",
    );
    await search.tap();
    await page.keyboard.insertText("BILLAR");
    assert.equal(await catalog.locator("article").count(), 1);
    assert.equal(await catalog.locator("article").getAttribute("aria-label"), "Billar");
    await page
      .getByRole("button", { name: "Limpiar búsqueda", exact: true })
      .tap();
    assert.equal(await catalog.locator("article").count(), 20);
    await search.fill("punteria");
    assert.ok(
      (await catalog.locator("article").count()) > 1,
      "accent-insensitive skill discovery",
    );
    await search.fill("un-juego-inexistente");
    assert.equal(await catalog.locator("article").count(), 0);
    await page.getByText("No encontramos ese reto", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Ver todos los juegos", exact: true })
      .tap();
    assert.equal(await catalog.locator("article").count(), 20);
    await page.evaluate(() => window.scrollTo({top:0,behavior:"instant"}));
    const firstPlay = await page
      .getByRole("button", { name: "Jugar a Dardos", exact: true })
      .boundingBox();
    const navBox = await page.locator(".bottomNav").boundingBox();
    assert.ok(
      firstPlay.y + firstPlay.height <= navBox.y,
      "first game action fits above navigation at 320 px",
    );
    await page.screenshot({
      path: "/workspace/.cloud-setup/v45-catalog-320.png",
      fullPage: false,
    });
    await page
      .getByRole("button", {
        name: "Ranking global · Beneficio neto",
        exact: true,
      })
      .tap();
    await page
      .getByRole("heading", {
        name: "El ranking real aún no está disponible",
        exact: true,
      })
      .waitFor();
    assert.equal(
      await page.locator('.bottomNav button[aria-current="page"]').innerText(),
      "≡\nRANKING",
    );
    await page.locator(".bottomNav button").first().tap();
    await catalog.waitFor();
    await page.setViewportSize({ width: 844, height: 390 });
    assert.equal(await catalog.locator("article").count(), 20);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: "/workspace/.cloud-setup/v45-catalog-landscape.png",
    });
    await search.fill("Sky Hop");
    let starts = 0;
    page.on("request", (r) => {
      if (r.url().includes("/verified-match/start")) starts++;
    });
    let releaseStart;
    const startGate = new Promise((resolve) => {
      releaseStart = resolve;
    });
    await page.route("**/api/verified-match/start", async (route) => {
      await startGate;
      await route.continue();
    });
    const issued = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Sky Hop", exact: true })
      .tap();
    await page.locator(".verificationOverlay").waitFor({ state: "visible" });
    assert.equal(
      await page.locator(".verificationOverlay").innerText(),
      "PREPARANDO PARTIDA",
    );
    releaseStart();
    assert.equal((await (await issued).json()).manifest.game_version, "2.0.0");
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    assert.equal(starts, 1);
    assert.ok((await page.locator(".coreHud").innerText()).includes("/75"));
    await page.getByRole("button", { name: "Volver", exact: true }).tap();
    await catalog.waitFor();
    assert.equal(
      await catalog.locator("article").count(),
      20,
      "catalog resets discovery on remount",
    );
    await page.unroute("**/api/verified-match/start");
    await page.route("**/api/verified-match/start",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:false,error:"QA_UNAVAILABLE"})}));
    await page.evaluate(() => {
      window.__resultTransition = null;
      const observer = new MutationObserver(() => {
        const actions = document.querySelector("fieldset.resultActions");
        if (!actions) return;
        window.__resultTransition = { disabled: actions.disabled };
        actions.querySelector("button.mainAction:last-child").click();
        observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
    await search.fill("Dardos");
    await page.getByRole("button",{name:"Jugar a Dardos",exact:true}).tap();
    await page.locator(".resultPanel").waitFor({state:"visible"});
    assert.ok((await page.locator(".resultPanel").innerText()).includes("RESULTADO NO VERIFICADO"));
    assert.equal(await page.locator(".gameResultSummary").count(),0,"a start failure must not invent an authoritative result");
    const change = page.getByRole("button", { name: "CAMBIAR", exact: true });
    assert.equal(await page.evaluate(() => window.__resultTransition.disabled), true, "result actions start disabled");
    assert.equal(await page.locator(".resultPanel").isVisible(), true, "an immediate action cannot skip the result");
    await change.tap();
    await catalog.waitFor();
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        catalog: 20,
        narrow: 320,
        landscape: true,
        search: true,
        empty: true,
        navigation: true,
        startVersion: "2.0.0",
        loading: true,
        startFailure: true,
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
