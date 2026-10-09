// Browser regression: honest server-unavailable state, isolated demo pages and source switching.
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
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (r.url().includes("/api/rankings/global")) requests.push(r.url());
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      "skill-arena-v12",
      JSON.stringify({
        onboarded: true,
        playerName: "QA-Rank",
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
  assert.ok((await page.locator(".balanceChip").innerText()).startsWith("FICTICIO"));
  await page
    .getByRole("button", {
      name: "Ranking global · Beneficio neto",
      exact: true,
    })
    .tap();
  await page
    .getByRole("heading", { name: "El ranking real aún no está disponible" })
    .waitFor();
  assert.equal(await page.locator(".rankingTable").count(), 0);
  const productionRequests = requests.length;
  await page.getByRole("button", { name: "Ver ejemplo", exact: true }).tap();
  await page
    .getByText("DATOS DE EJEMPLO · IMPORTES FICTICIOS", { exact: true })
    .waitFor();
  await page.locator(".rankingTable tbody tr").first().waitFor();
  assert.equal(await page.locator(".rankingTable tbody tr").count(), 25);
  assert.equal(
    await page
      .locator(".rankingTable tbody tr:first-child td:first-child")
      .innerText(),
    "#1",
  );
  assert.equal(
    await page.locator(".rankingTable .rankingAvatar img").count(),
    25,
  );
  assert.equal(await page.locator(".rankingLeaders article").count(), 3);
  assert.ok(
    (await page.locator(".rankingOwnPosition").innerText()).includes(
      "Sesión local · sin posición real",
    ),
  );
  if (process.env.QA_SCREENSHOT)
    await page.screenshot({ path: process.env.QA_SCREENSHOT });
  await page.getByRole("button", { name: "Siguiente", exact: true }).tap();
  await page.getByText("#26", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Siguiente", exact: true }).tap();
  await page.getByText("#51", { exact: true }).waitFor();
  assert.equal(await page.locator(".rankingTable tbody tr").count(), 14);
  assert.equal(
    await page
      .getByRole("button", { name: "Siguiente", exact: true })
      .isDisabled(),
    true,
  );
  assert.ok((await page.locator(".rankingNegative").count()) > 0);
  await page.getByRole("button", { name: "Anterior", exact: true }).tap();
  await page.getByText("#26", { exact: true }).waitFor();
  assert.equal(requests.length, productionRequests);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  const notice = await page.locator(".rankingDemoNotice").boundingBox();
  assert.ok(notice.y >= 59 && notice.y + notice.height <= 844);
  assert.equal(
    await page.evaluate(() => {
      const notice = document.querySelector(".rankingDemoNotice"),
        r = notice.getBoundingClientRect();
      return Boolean(
        document
          .elementFromPoint(r.left + 12, r.top + 12)
          ?.closest(".rankingDemoNotice"),
      );
    }),
    true,
  );
  await page.getByRole("button", { name: "Ranking real", exact: true }).tap();
  assert.equal(await page.locator(".rankingDemoNotice").count(), 0);
  await page
    .getByRole("heading", { name: "El ranking real aún no está disponible" })
    .waitFor();
  assert.equal(await page.locator(".rankingTable").count(), 0);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole("button", { name: "Ver ejemplo", exact: true }).tap();
  await page
    .locator(".rankingTable")
    .getByText("#1", { exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
    assert.doesNotMatch(await page.locator("body").innerText(), /\bdemo\b|\bdemostración\b/iu, "frontend copy must identify local/sample scope without demo wording");
  const bad = await page.request.get(
    (process.env.QA_BASE_URL || "http://127.0.0.1:3000") +
      "/api/rankings/global?limit=101",
  );
  assert.equal(bad.status(), 400);
  console.log(
    JSON.stringify({
      pages: 3,
      productionRequests,
      sourceIsolation: true,
      mobile: true,
      errors,
    }),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
