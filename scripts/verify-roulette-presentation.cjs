// Actual renderer: Cartesian flight follows only authoritative state; no circular tween.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { register, createRequire } = require("node:module"),
  { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, ".."),
  req = createRequire(path.join(root, "package.json"));
register(pathToFileURL(path.join(root, "scripts/determinism-loader.mjs")));
module.exports = (async () => {
  const load = (p) => import(pathToFileURL(path.join(root, ".det-test", p)));
  const coreModule = await load("lib/verified/galacticRouletteCore.v11.js"),
    protocol = await load("lib/verified/galacticRouletteProtocol.v3.js"),
    protocol8 = await load("lib/verified/galacticRouletteProtocol.v8.js"),
    gesture = await load("lib/rouletteLaunchGesture.js"),
    runtime = await load("lib/verified/coreRuntime.v1.js");
  const file = path.join(root, "components/games/GalacticRoulette.tsx"),
    source = fs.readFileSync(file, "utf8");
  await req("next/dist/build/swc").loadBindings();
  const compiled = await req("next/dist/build/swc").transform(
    source + "\nexport {render as renderUnderTest};",
    {
      filename: file,
      jsc: {
        parser: { syntax: "typescript", tsx: true },
        target: "es2022",
        transform: { react: { runtime: "automatic" } },
      },
      module: { type: "commonjs" },
    },
  );
  const exports = {},
    deps = {
      "@/lib/verified/galacticRouletteCore.v11": coreModule,
      "@/lib/verified/galacticRouletteProtocol.v3": protocol,
      "@/lib/verified/galacticRouletteProtocol.v8": protocol8,
      "@/lib/rouletteLaunchGesture": gesture,
      "@/lib/spaceBackdrop": { drawSpaceBackdrop() {} },
      "@/lib/i18n": require("./i18n-test-stub.cjs"),
      "./CoreCanvasGame": () => null,
    };
  new Function("require", "exports", compiled.code)(
    (id) => deps[id] || req(id),
    exports,
  );
  let frames = 0;
  for (let seed = 0; seed < 16; seed++)
    for (const impulse of [0, 7, 15]) {
      const s = coreModule.ROULETTE_CORE_V11.create("roulette2-render-" + seed);
      runtime.applyCoreInput(coreModule.ROULETTE_CORE_V11, s, "BET_RED", 1e9);
      runtime.applyCoreInput(
        coreModule.ROULETTE_CORE_V11,
        s,
        protocol.rouletteTossAction(20, impulse),
        1e9,
      );
      for (let t = 0; t < 960 && s.landingTick !== -1; t++) {
        if (t % 5 === 0) {
          const before = JSON.stringify(s),
            stack = [],
            balls = [];
          let arc = null;
          const ctx = new Proxy(
            { fillStyle: "" },
            {
              get(o, k) {
                if (k in o) return o[k];
                if (k === "createRadialGradient") return () => ({addColorStop() {}});
                return (...a) => {
                  if (k === "save") stack.push(o.fillStyle);
                  if (k === "restore") {
                    assert.ok(stack.length);
                    o.fillStyle = stack.pop();
                  }
                  if (k === "arc") arc = a;
                  if (k === "fill" && o.fillStyle === "#f0f7ff")
                    balls.push(arc);
                };
              },
            },
          );
          exports.renderUnderTest(ctx, s);
          assert.equal(JSON.stringify(s), before);
          assert.equal(stack.length, 0);
          assert.equal(balls.length, 1);
          assert.equal(Math.round(balls[0][0] * 1000), s.ballX);
          assert.equal(Math.round(balls[0][1] * 1000), s.ballY);
          const r = Math.hypot(s.ballX / 1000 - 195,s.ballY / 1000 - 195);
          const surface = s.inBowl && r <= 151 ? coreModule.rouletteSurfaceV11(r * 1000).z / 1000 : 0;
          const BR = coreModule.ROULETTE_RULES_V11.ballRadius / 1000;
          assert.ok(Math.abs(balls[0][2] - (BR + Math.min(130,Math.max(0,s.ballZ/1000-surface-BR))*.07)) < 1e-9);
          frames++;
        }
        runtime.stepCore(coreModule.ROULETTE_CORE_V11, s, 1e9);
      }
    }
  // A landed ball remains in the awarded rotating pocket, never back at dock.
  const s = coreModule.ROULETTE_CORE_V11.create("settled-zenithal");
  s.lastNumber = 32;
  s.ballX = 250000;
  s.ballY = 195000;
  s.lastLandingTick = 240;
  s.tick = 240;
  for (let age = 0; age < 200; age++) {
    const balls = [], stack = [];
    let arc;
    const ctx = new Proxy({fillStyle:""}, {get(o,k) {
      if (k in o) return o[k];
      if (k === "createRadialGradient") return () => ({addColorStop(){}});
      return (...args) => {
        if(k === "save") stack.push(o.fillStyle);
        if(k === "restore") o.fillStyle = stack.pop();
        if(k === "arc") arc = args;
        if(k === "fill" && o.fillStyle === "#f0f7ff") balls.push(arc);
      };
    }});
    const before = JSON.stringify(s);
    exports.renderUnderTest(ctx,s);
    assert.equal(JSON.stringify(s),before);
    const angle = s.wheelPhase / 65536 * Math.PI * 2 - Math.PI / 2 + coreModule.ROULETTE_WHEEL.indexOf(32) * Math.PI * 2 / 37;
    assert.equal(balls.length,2); // pocketed ball stays + next ball waits on the launcher
    // The last moment is slow and soft (150 ticks of easing); afterwards the ball rests exactly in the pocket.
    // v106: each number has its own square pocket inside the numbered band; its centre is at radius 93.5.
    const POCKET_REST = 93.5;
    const miss = Math.hypot(balls[0][0] - (195 + Math.cos(angle) * POCKET_REST), balls[0][1] - (195 + Math.sin(angle) * POCKET_REST));
    if (age >= 150) assert.ok(miss < 1e-8);
    else assert.ok(miss <= 200, "ball drifts toward the pocket");
    runtime.stepCore(coreModule.ROULETTE_CORE_V11,s,1e9);
  }
  console.log(
    JSON.stringify({
      variant: "RouletteV3 inclined 3D bounces",
      frames,
      cartesianFlight: true,
      zenithalBounce: true, persistentAwardedPocket: true,
      rendererPure: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  throw e;
});
