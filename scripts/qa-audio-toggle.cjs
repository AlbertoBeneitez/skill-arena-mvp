// Real catalogue/game sound buttons, preference and native Web Audio output.
// Only native audio resume is delayed to reproduce mobile interruption races.
// No simulation clocks, manifests, inputs or server results are altered.
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
      viewport: process.env.QA_LANDSCAPE
        ? { width: 844, height: 390 }
        : { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem(
        "skill-arena-v12",
        JSON.stringify({
          onboarded: true,
          playerName: "QA-Audio",
          balance: 25,
          netEarnings: 0,
          nextTurn: "create",
          musicOn: true,
          earnings: [],
          movements: [],
          wins: 0,
          losses: 0,
          streak: 0,
          group: null,
        }),
      );
      const NativeContext = window.AudioContext,
        connect = AudioNode.prototype.connect,
        resume = NativeContext.prototype.resume;
      window.__qaAudio = {
        contexts: [],
        analysers: [],
        resumeDelay: 0,
        starts: 0,
      };
      window.AudioContext = class extends NativeContext {
        constructor(...a) {
          super(...a);
          window.__qaAudio.contexts.push(this);
        }
      };
      AudioNode.prototype.connect = function (target, ...rest) {
        const result = connect.call(this, target, ...rest);
        if (target instanceof AudioDestinationNode) {
          const analyser = this.context.createAnalyser();
          analyser.fftSize = 256;
          connect.call(this, analyser);
          window.__qaAudio.analysers.push(analyser);
        }
        return result;
      };
      NativeContext.prototype.resume = function () {
        const delay = window.__qaAudio.resumeDelay;
        if (!delay) return resume.call(this);
        return new Promise((resolve) =>
          setTimeout(() => resolve(resume.call(this)), delay),
        );
      };
      const start = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function (...a) {
        window.__qaAudio.starts++;
        return start.apply(this, a);
      };
      window.__qaAudio.rms = () =>
        Math.max(
          0,
          ...window.__qaAudio.analysers.map((a) => {
            if (a.context.state !== "running") return 0;
            const d = new Float32Array(a.fftSize);
            a.getFloatTimeDomainData(d);
            return Math.sqrt(d.reduce((s, v) => s + v * v, 0) / d.length);
          }),
        );
    });
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3075");
    await page.locator(".quickStakeBar button").first().tap();
    await page
      .getByRole("button", { name: "Jugar a River Dash", exact: true })
      .tap();
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Arriba", exact: true }).tap();
    await page.waitForTimeout(120);
    const before = await page.evaluate(() => ({
      states: window.__qaAudio.contexts.map((c) => c.state),
      rms: window.__qaAudio.rms(),
      starts: window.__qaAudio.starts,
    }));
    assert.ok(before.starts > 0, "Sound was actually started");
    await page.evaluate(async () => {
      window.__qaAudio.resumeDelay = 800;
      await Promise.all(window.__qaAudio.contexts.map((c) => c.suspend()));
    });
    await page.waitForTimeout(350);
    await page
      .getByRole("button", { name: "Desactivar sonido", exact: true })
      .tap();
    const samples = [];
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(70);
      samples.push(
        await page.evaluate(() => ({
          rms: window.__qaAudio.rms(),
          states: window.__qaAudio.contexts.map((c) => c.state),
          starts: window.__qaAudio.starts,
        })),
      );
    }
    const max = Math.max(...samples.map((s) => s.rms));
    console.log(JSON.stringify({ before, mutedMaxRms: max, samples, errors }));
    assert.equal(
      await page
        .getByRole("button", { name: "Activar sonido", exact: true })
        .getAttribute("aria-pressed"),
      "false",
    );
    assert.ok(
      max < 0.000001,
      "Mute must remain silent when a delayed resume completes",
    );
    await page.evaluate(() => {
      window.__qaAudio.resumeDelay = 0;
    });
    await page
      .getByRole("button", { name: "Activar sonido", exact: true })
      .tap();
    await page.waitForTimeout(180);
    const reenabled = await page.evaluate(() => ({
      rms: window.__qaAudio.rms(),
      starts: window.__qaAudio.starts,
    }));
    assert.ok(reenabled.rms > 0.0001, "Reactivation must produce fresh music");
    assert.ok(
      reenabled.starts > samples.at(-1).starts,
      "Reactivation starts new voices",
    );
    await page
      .getByRole("button", { name: "Desactivar sonido", exact: true })
      .tap();
    await page.waitForTimeout(180);
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("skill-arena-v12")).musicOn,
      ),
      false,
      "The preference is persisted",
    );
    await page.reload();
    await page
      .getByRole("button", { name: "Activar sonido", exact: true })
      .waitFor();
    await page.waitForTimeout(250);
    assert.equal(
      await page.evaluate(() => window.__qaAudio.starts),
      0,
      "Reloading with sound disabled creates no voices",
    );
    console.log(JSON.stringify({ reenabled, persisted: false, errors }));
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
