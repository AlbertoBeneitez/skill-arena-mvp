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
    for (const viewport of [
      { width: 320, height: 740 },
      { width: 844, height: 390 },
    ]) {
      const context = await browser.newContext({
        viewport,
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage(),
        errors = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      page.on("request", (r) => {
        if (r.url().includes("/api/")) requests.push(r.url());
      });
      await page.addInitScript(() => {
        localStorage.setItem(
          "skill-arena-v12",
          JSON.stringify({
            onboarded: true,
            playerName: "QA-GROUP",
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
        window.__copied = [];
        window.__copyBlocked = false;
        Object.defineProperty(navigator, "clipboard", {
          value: {
            writeText: async (text) => {
              if (window.__copyBlocked) throw new Error("denied");
              window.__copied.push(text);
            },
          },
        });
      });
      await page.goto(process.env.QA_BASE_URL);
      await page.locator(".bottomNav button").nth(1).tap();
      await page
        .getByRole("heading", { name: "Compite con tu gente" })
        .waitFor();
      assert.match(await page.locator(".groupHero").innerText(), /RIVALES SIMULADOS/);
      await page.getByRole("tab", { name: "UNIRSE", exact: true }).tap();
      assert.equal(
        await page
          .getByRole("button", { name: "ABRIR GRUPO" })
          .isDisabled(),
        true,
      );
      await page.locator(".groupJoinCard input").fill("a b-c_12");
      assert.equal(
        await page.locator(".groupJoinCard input").inputValue(),
        "ABC12",
      );
      await page.getByRole("button", { name: "ABRIR GRUPO" }).tap();
      await page.locator(".groupCodeBadge").waitFor();
      assert.equal(await page.locator(".groupCodeBadge").innerText(), "ABC12");
      assert.equal(
        await page
          .locator(".groupMembers b")
          .filter({ hasText: "SIMULADO" })
          .count(),
        3,
      );
      assert.match(
        await page.locator(".groupDemoNotice").innerText(),
        /Grupo local · rivales simulados · saldo ficticio/,
      );
      await page
        .getByRole("button", { name: "COPIAR CÓDIGO", exact: true })
        .tap();
      await page.waitForFunction(() => window.__copied.length === 1);
      assert.equal(await page.evaluate(() => window.__copied[0]), "ABC12");
      await page
        .getByRole("button", { name: "COPIAR ENLACE", exact: true })
        .tap();
      await page.waitForFunction(() => window.__copied.length === 2);
      const copied = await page.evaluate(() => window.__copied[1]);
      assert.equal(new URL(copied).searchParams.get("join"), "ABC12");
      assert.equal(new URL(copied).hash, "#group");
      await page.evaluate(() => {
        window.__copyBlocked = true;
      });
      await page
        .getByRole("button", { name: /CÓDIGO COPIADO|COPIAR CÓDIGO/ })
        .tap();
      const fallback = page.getByRole("textbox", {
        name: "Texto para copiar manualmente",
      });
      await fallback.waitFor();
      assert.equal(await fallback.inputValue(), "ABC12");
      assert.match(
        await page.locator(".groupShareFeedback").innerText(),
        /No se pudo copiar/,
      );
      const price = page.getByRole("spinbutton", {
        name: "ENTRADA FICTICIA POR JUGADOR",
      });
      const ready = page.getByRole("button", {
        name: "ESTOY LISTO",
        exact: true,
      });
      for (const value of ["", "-1", "26"]) {
        await price.fill(value);
        assert.equal(await ready.isDisabled(), true);
        assert.match(
          await page.locator(".groupConfigurationHint").innerText(),
          /Introduce/,
        );
      }
      await price.fill("0");
      assert.equal(await ready.isEnabled(), true);
      await page.getByRole("button", { name: "LIGA Varias jornadas" }).tap();
      const rounds = page.getByRole("spinbutton", {
        name: "NÚMERO DE JORNADAS",
      });
      await rounds.fill("2");
      assert.equal(await ready.isDisabled(), true);
      await page
        .locator(".leaguePickGrid button")
        .filter({ hasText: "Maze Rush" })
        .tap();
      assert.match(
        await page.locator(".groupConfigurationHint").innerText(),
        /Faltan 1/,
      );
      await page
        .locator(".leaguePickGrid button")
        .filter({ hasText: "Orbit Shift" })
        .tap();
      assert.equal(await ready.isEnabled(), true);
      await page
        .getByRole("button", { name: "BORRAR ÚLTIMO", exact: true })
        .tap();
      assert.equal(await ready.isDisabled(), true);
      await page.getByRole("button", { name: "ALEATORIO", exact: true }).tap();
      assert.equal(await ready.isEnabled(), true);
      await rounds.fill("51");
      assert.equal(await ready.isDisabled(), true);
      await rounds.fill("2");
      await page.getByRole("button", { name: "TORNEO Eliminatorias" }).tap();
      const eliminated = page.getByRole("spinbutton", {
        name: "ELIMINADOS POR RONDA",
      });
      await eliminated.fill("3");
      assert.equal(await ready.isDisabled(), true);
      await eliminated.fill("1");
      await page.getByRole("button", { name: "ALEATORIO", exact: true }).tap();
      assert.equal(await ready.isEnabled(), true);
      await page
        .getByRole("button", { name: "PARTIDA RÁPIDA Una partida" })
        .tap();
      await page
        .locator(".groupGameGrid button")
        .filter({ hasText: "Maze Rush" })
        .tap();
      await ready.tap();
      assert.equal(
        await page
          .getByRole("button", { name: "EMPEZAR PARTIDA", exact: true })
          .isEnabled(),
        true,
      );
      await page.setViewportSize(
        viewport.width < 500
          ? { width: 844, height: 390 }
          : { width: 320, height: 740 },
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      const gridHeight = await page.locator('.groupGameGrid').evaluate(e=>e.getBoundingClientRect().height);
      assert.ok(gridHeight <= (viewport.width<500 ? 550 : 850), 'compact selector avoids oversized cover gallery');
      const small = await page
        .locator(".groupScreen button")
        .evaluateAll((elements) =>
          elements
            .filter((e) => {
              const r = e.getBoundingClientRect();
              return r.height > 0 && r.height < 44;
            })
            .map((e) => e.textContent.trim()),
        );
      assert.deepEqual(small, [], "all rendered buttons >=44px");
      await page
        .getByRole("button", { name: "EMPEZAR PARTIDA", exact: true })
        .tap();
      await page.locator(".mazeRushVerified").waitFor({ timeout: 15000 });
      await page.waitForFunction(() =>
        document.querySelector(".mazeRushVerified canvas"),
      );
      await page.waitForResponse(
        (r) =>
          r.url().includes("/api/verified-match/start") && r.status() === 200,
      );
      assert.equal(
        requests.filter((url) => url.includes("/api/verified-match/start"))
          .length,
        1,
      );
      await page.getByRole("button", { name: "Volver", exact: true }).tap();
      await page.locator(".groupHeaderCard").waitFor();
      assert.equal(await page.locator(".groupCodeBadge").innerText(), "ABC12");
      await page.reload();
      await page.locator(".bottomNav button").nth(1).tap();
      await page.getByRole("tab", { name: "CREAR", exact: true }).tap();
      await page
        .getByRole("textbox", { name: "NOMBRE DEL GRUPO" })
        .fill("Órbita QA");
      await page
        .getByRole("button", { name: "CREAR GRUPO", exact: true })
        .tap();
      assert.equal(
        await page.locator(".groupHeaderCard h1").innerText(),
        "Órbita QA",
      );
      assert.equal(
        await page
          .locator(".groupMembers b")
          .filter({ hasText: "SIMULADO" })
          .count(),
        3,
      );
      await page.screenshot({
        path: `/workspace/.cloud-setup/groups-${viewport.width}.png`,
        fullPage: true,
      });
      assert.deepEqual(errors, []);
    assert.doesNotMatch(await page.locator("body").innerText(), /\bdemo\b|\bdemostración\b/iu, "frontend copy must identify local/sample scope without demo wording");
      console.log(
        JSON.stringify({
          viewport,
          join: true,
          clipboard: true,
          clipboardDenied: true,
          validation: true,
          league: true,
          tournament: true,
          rotation: true,
          startAndExit: true,
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
