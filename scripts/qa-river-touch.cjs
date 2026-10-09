// Browser regression: novice first crossing via real touch, scored by server replay.
// Only the demo target is lowered to one crossing; the server-issued seed is unchanged.
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
    viewport: process.env.QA_LANDSCAPE ? { width: 844, height: 390 } : { width: 390, height: 844 },
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
        playerName: "QA-River",
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
  await page.route("**/api/verified-match/start", (route) => {
    const body = route.request().postDataJSON();
    return route.continue({
      postData: JSON.stringify({ ...body, target_score: 1400 }),
    });
  });
  await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3000");
  await page.locator(".quickStakeBar button").first().click();
  const start = page.waitForResponse((r) =>
    r.url().includes("/verified-match/start"),
  );
  await page
    .getByRole("button", { name: "Jugar a River Dash", exact: true })
    .click();
  const manifest = await (await start).json();
  assert.equal(manifest.manifest.game_version, "2.0.0");
  await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
  await page.waitForTimeout(1200);
  const verification = page.waitForResponse((r) =>
    r.url().includes("/verified-match/verify"),
  );
  const loss = Boolean(process.env.QA_EXPECT_LOSS);
  for (let i = 0; i < (loss ? 1 : 10); i++) {
    await page.getByRole("button", { name: "Arriba", exact: true }).tap();
    await page.waitForTimeout(500);
  }
  if (loss) {
    for (const action of ['Izquierda','Izquierda','Izquierda','Izquierda','Arriba','Arriba','Arriba','Arriba','Arriba']) {
      if (await page.locator('.resultPanel').isVisible()) break;
      await page.getByRole('button',{name:action,exact:true}).tap({timeout:1000}).catch(async error => {
        if (!await page.locator('.resultPanel').isVisible()) throw error;
      });
      await page.waitForTimeout(200);
    }
  }
  const response = await verification;
  const result = await response.json();
  assert.equal(result.verified, true);
  assert.equal(result.won, !loss);
  assert.equal(result.score, loss ? 0 : 1400);
  assert.equal(result.authoritative_source, "SERVER_REPLAY");
  const inputs = response.request().postDataJSON().inputs;
  if (!loss) { assert.equal(inputs.length, 10); assert.ok(inputs.every((x) => x.action === "UP")); }
  else assert.ok(result.failure);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result, inputs, errors }));
  await page.getByRole('button',{name:'CAMBIAR',exact:true}).click();
  const restarted = page.waitForResponse(r=>r.url().includes('/verified-match/start'));
  await page.getByRole('button',{name:'Jugar a River Dash',exact:true}).click();
  const next = await (await restarted).json();
  assert.notEqual(next.manifest.match_id,manifest.manifest.match_id);
  await page.locator('.countdownOverlay').waitFor({state:'hidden'});
  assert.equal(await page.locator('.resultPanel').isVisible(),false);
  assert.deepEqual(errors,[]);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
