// Native Web Audio regression for the shared presentation-only audio module.
// The resume delay emulates an interrupted mobile context. Game clocks, seeds,
// authoritative simulation and browser API responses are never changed.
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
);
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { stripTypeScriptTypes } = require("node:module");
(async () => {
  const source = fs.readFileSync(
    process.env.QA_AUDIO_SOURCE ||
      path.resolve(process.cwd(), "lib/gameFeedback.ts"),
    "utf8",
  );
  const code =
    stripTypeScriptTypes(source).replace(/^export /gm, "") +
    "\nObject.assign(exports, {setGameSoundEnabled, startGameMusic, stopGameMusic, gameTone});";
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const Context = window.AudioContext,
        nativeResume = Context.prototype.resume,
        connect = AudioNode.prototype.connect,
        disconnect = AudioNode.prototype.disconnect;
      const qa = (window.__qaAudio = {
        contexts: [],
        analysers: [],
        voices: [],
        connected: new Set(),
        resumeDelay: 0,
      });
      window.AudioContext = class extends Context {
        constructor(...args) {
          super(...args);
          qa.contexts.push(this);
        }
      };
      Context.prototype.resume = function () {
        return qa.resumeDelay
          ? new Promise((resolve) =>
              setTimeout(
                () => resolve(nativeResume.call(this)),
                qa.resumeDelay,
              ),
            )
          : nativeResume.call(this);
      };
      AudioNode.prototype.connect = function (target, ...args) {
        const result = connect.call(this, target, ...args);
        qa.connected.add(this);
        if (target instanceof AudioDestinationNode) {
          const analyser = this.context.createAnalyser();
          analyser.fftSize = 256;
          connect.call(this, analyser);
          qa.analysers.push(analyser);
        }
        return result;
      };
      AudioNode.prototype.disconnect = function (...args) {
        qa.connected.delete(this);
        return disconnect.apply(this, args);
      };
      for (const Type of [OscillatorNode, AudioBufferSourceNode]) {
        const start = Type.prototype.start;
        Type.prototype.start = function (...args) {
          qa.voices.push(this);
          return start.apply(this, args);
        };
      }
      qa.sample = () => ({
        states: qa.contexts.map((c) => c.state),
        voices: qa.voices.length,
        connectedVoices: qa.voices.filter((s) => qa.connected.has(s)).length,
        rms: Math.max(
          0,
          ...qa.analysers
            .filter((a) => a.context.state === "running")
            .map((a) => {
              const values = new Float32Array(a.fftSize);
              a.getFloatTimeDomainData(values);
              return Math.sqrt(
                values.reduce((sum, v) => sum + v * v, 0) / values.length,
              );
            }),
        ),
      });
    });
    await page.goto("about:blank");
    await page.setContent(
      '<button id="on">On</button><button id="off">Off</button><button id="win">Win</button><button id="stop">Stop</button>',
    );
    await page.evaluate((code) => {
      window.__feedback = {};
      new Function("exports", code)(window.__feedback);
      const f = window.__feedback;
      document.querySelector("#on").onclick = () => {
        f.setGameSoundEnabled(true, true);
        f.startGameMusic("river-dash");
      };
      document.querySelector("#off").onclick = () =>
        f.setGameSoundEnabled(false, true);
      document.querySelector("#win").onclick = () => f.gameTone("win");
      document.querySelector("#stop").onclick = () => f.stopGameMusic();
    }, code);
    await page.locator("#on").tap();
    await page.waitForTimeout(180);
    const before = await page.evaluate(() => window.__qaAudio.sample());
    assert.ok(
      before.rms > 0.0001,
      "The native graph produces music before mute",
    );
    await page.evaluate(async () => {
      window.__qaAudio.resumeDelay = 800;
      await Promise.all(window.__qaAudio.contexts.map((c) => c.suspend()));
    });
    await page.waitForTimeout(350);
    await page.locator("#win").tap();
    await page.locator("#off").tap();
    const immediately = await page.evaluate(() => window.__qaAudio.sample());
    assert.equal(
      immediately.connectedVoices,
      0,
      "Mute disconnects queued music and SFX immediately",
    );
    const muted = [];
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(70);
      muted.push(await page.evaluate(() => window.__qaAudio.sample()));
    }
    assert.ok(
      muted.some((s) => s.states.includes("running")),
      "A delayed native resume really completed",
    );
    assert.equal(
      Math.max(...muted.map((s) => s.rms)),
      0,
      "Delayed resume must not bypass mute",
    );
    assert.ok(
      muted.every((s) => s.voices === immediately.voices),
      "Mute stops music scheduling",
    );
    await page.evaluate(() => {
      window.__qaAudio.resumeDelay = 0;
    });
    await page.locator("#on").tap();
    await page.waitForTimeout(180);
    const enabled = await page.evaluate(() => window.__qaAudio.sample());
    assert.ok(
      enabled.rms > 0.0001,
      "A new trusted gesture reactivates fresh music",
    );
    assert.ok(
      enabled.voices > immediately.voices,
      "Reactivation creates fresh voices",
    );
    await page.locator("#stop").tap();
    assert.equal(
      (await page.evaluate(() => window.__qaAudio.sample())).connectedVoices,
      0,
      "Unmount/stop cancels music tails",
    );
    await page.locator("#win").tap();
    await page.waitForTimeout(600);
    const afterEffects = await page.evaluate(() => window.__qaAudio.sample());
    assert.equal(
      afterEffects.connectedVoices,
      0,
      "Completed effects release source and gain nodes",
    );
    await page.locator("#off").tap();
    const silentCount = (await page.evaluate(() => window.__qaAudio.sample()))
      .voices;
    await page.locator("#win").tap();
    assert.equal(
      (await page.evaluate(() => window.__qaAudio.sample())).voices,
      silentCount,
      "Muted SFX create no sources",
    );
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        before,
        immediately,
        mutedPeakRms: Math.max(...muted.map((s) => s.rms)),
        enabled,
        afterEffects,
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
