// Native touch play using ONLY public revealed clues, never the private seed/layout.
const { chromium } = require(
    process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
  ),
  assert = require("node:assert/strict"),
  { register } = require("node:module"),
  { pathToFileURL } = require("node:url"),
  path = require("node:path");
register(pathToFileURL(path.join(__dirname, "determinism-loader.mjs")));
(async () => {
  const { mineDeductions } = await import(
    pathToFileURL(
      path.join(__dirname, "../.det-test/lib/verified/mineGridCore.v1.js"),
    ).href
  );
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
        viewport: process.env.QA_LANDSCAPE
          ? { width: 844, height: 390 }
          : { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const initial = page.waitForResponse((r) =>
      r.url().includes("/hidden-game/start"),
    );
    await page.goto(
      new URL(
        "/qa/mine-grid",
        process.env.QA_BASE_URL || "http://127.0.0.1:3000",
      ).href,
    );
    let session = await (await initial).json();
    function check(s) {
      assert.equal("seed" in s, false);
      assert.equal("manifest" in s, false);
      assert.equal("values" in s.view, false);
      assert.equal("mineIndexes" in s.view, false);
      assert.ok(s.view.cells.every((v) => v === null || Number.isInteger(v)));
    }
    function next(s, lose = false) {
      const v = s.view;
      if (!v.started) return { kind: "OPEN", index: v.startIndex };
      const d = mineDeductions(
        {
          cols: v.cols,
          rows: v.rows,
          mines: v.mines,
          startIndex: v.startIndex,
          values: v.cells.map((n) => (n === null ? -2 : n)),
        },
        v.cells.map((n) => n !== null),
        v.flagged,
      );
      if (lose && d.mines.length) return { kind: "OPEN", index: d.mines[0] };
      if (d.safe.length) return { kind: "OPEN", index: d.safe[0] };
      if (d.mines.length) return { kind: "FLAG", index: d.mines[0] };
      throw new Error("Public clues must support a deduction");
    }
    async function action(choice) {
      const before = session.revision;
      if (choice.kind === "FLAG")
        await page.getByRole("button", { name: "MARCAR", exact: true }).tap();
      else await page.getByRole("button", { name: "ABRIR", exact: true }).tap();
      const response = page.waitForResponse((r) =>
        r.url().includes("/hidden-game/command"),
      );
      await page
        .locator(`.mineAuthorityCell[data-index="${choice.index}"]`)
        .tap();
      session = await (await response).json();
      check(session);
      assert.equal(session.revision, before + 1);
      if (session.status === "running")
        await page.waitForFunction(
          () =>
            document
              .querySelector(".mineAuthorityBoard")
              ?.getAttribute("aria-busy") === "false",
        );
    }
    check(session);
    assert.ok(session.view.cells.every((n) => n === null));
    const opening = page.locator(".mineAuthorityCell.opening");
    await opening.waitFor();
    const rect = await opening.boundingBox(),
      cdp = await context.newCDPSession(page);
    let cancelledCommands = 0;
    const countCancelled = (r) => {
      if (r.url().includes("/hidden-game/command")) cancelledCommands++;
    };
    page.on("request", countCancelled);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await page.waitForTimeout(100);
    page.off("request", countCancelled);
    assert.equal(cancelledCommands, 0, "Cancelled touch cannot reveal a cell");
    for (let count = 0; session.status === "running" && count < 350; count++)
      await action(next(session));
    assert.equal(session.status, "won");
    assert.equal(session.verified, true);
    assert.equal(session.view.stage, 4);
    await page
      .getByRole("heading", { name: "CAMPO RESUELTO", exact: true })
      .waitFor();
    const won = { score: session.score, revision: session.revision };
    if (process.env.QA_ARTIFACT_DIR)
      await page.screenshot({
        path: path.join(
          process.env.QA_ARTIFACT_DIR,
          `mine-win-${process.env.QA_LANDSCAPE ? "landscape" : "portrait"}.png`,
        ),
        fullPage: true,
      });
    const restart = page.waitForResponse((r) =>
      r.url().includes("/hidden-game/start"),
    );
    await page.getByRole("button", { name: "OTRO CAMPO", exact: true }).tap();
    const before = session;
    session = await (await restart).json();
    assert.notEqual(session.attemptId, before.attemptId);
    assert.equal(session.revision, 0);
    for (let count = 0; session.status === "running" && count < 350; count++)
      await action(next(session, true));
    assert.equal(session.status, "failed");
    assert.equal(session.verified, true);
    assert.equal(session.view.lives, 0);
    await page
      .getByRole("heading", { name: "ESCUDOS AGOTADOS", exact: true })
      .waitFor();
    assert.equal(
      await page.locator("body").evaluate((e) => e.scrollWidth > innerWidth),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        won,
        lost: { score: session.score, revision: session.revision },
        publicProjectionOnly: true,
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
