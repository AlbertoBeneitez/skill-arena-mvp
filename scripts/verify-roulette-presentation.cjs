// Actual renderer (V15): the ball is drawn exactly at the core's polar position; no tween, no own physics.
// v144: its height (the core's ballZ in the wheel, the drawn arc on the flight) changes only its size and shadow.
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
  const coreModule = await load("lib/verified/galacticRouletteCore.v16.js"),
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
      "@/lib/verified/galacticRouletteCore.v16": coreModule,
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
      const s = coreModule.ROULETTE_CORE_V16.create("roulette2-render-" + seed);
      runtime.applyCoreInput(coreModule.ROULETTE_CORE_V16, s, "BET_RED", 1e9);
      runtime.applyCoreInput(
        coreModule.ROULETTE_CORE_V16,
        s,
        protocol.rouletteTossAction(16 + (seed % 9), impulse),
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
          // Launcher flight: the core's straight path; in the wheel: the polar position (θ clockwise from 12 o'clock).
          const a = s.ballTheta / 1e7 - Math.PI / 2, r = s.ballR / 1e6;
          const ex = s.ballPhase === 0 ? s.ballX / 1000 : 195 + Math.cos(a) * r, ey = s.ballPhase === 0 ? s.ballY / 1000 : 195 + Math.sin(a) * r;
          assert.ok(Math.abs(balls[0][0] - ex) < 1e-9 && Math.abs(balls[0][1] - ey) < 1e-9, "ball drawn where the core has it");
          const BR = coreModule.ROULETTE_RULES_V16.ballRadius / 1000;
          // v144: the ball grows with its height (towards the camera); in the wheel that height is the core's ballZ.
          assert.ok(Math.abs(balls[0][2] - BR * (1 + exports.ballLift(s) * exports.BALL_GROW)) < 1e-9, "size follows the height");
          if (s.ballPhase === 1) assert.ok(Math.abs(exports.ballLift(s) - (s.ballZ / 1e6) * 2.5 - exports.landingBounce(s)) < 1e-9, "height is the core's ballZ (plus the drawn landing bounces)");
          frames++;
        }
        runtime.stepCore(coreModule.ROULETTE_CORE_V16, s, 1e9);
      }
    }
  // A landed ball remains in the awarded rotating pocket, never back at dock.
  const s = coreModule.ROULETTE_CORE_V16.create("settled-zenithal");
  s.lastNumber = 32;
  s.lastLandingTick = 240;
  s.tick = 240;
  // V15: physics leaves the ball resting in pocket 32 at radius 93.5 mm; from then on it only turns with the rotor.
  s.restOffset = Math.round(coreModule.ROULETTE_WHEEL.indexOf(32) * 62831853 / 37);
  s.ballR = 93_500_000;
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
    const angle = s.wheelPhase / 65536 * Math.PI * 2 - Math.PI / 2 + s.restOffset / 1e7;
    assert.equal(balls.length,2); // pocketed ball stays + next ball waits on the launcher
    // No scripted glide — at every frame the ball is where physics left it, turned with the wheel.
    const POCKET_REST = 93.5;
    const miss = Math.hypot(balls[0][0] - (195 + Math.cos(angle) * POCKET_REST), balls[0][1] - (195 + Math.sin(angle) * POCKET_REST));
    assert.ok(miss < 0.01, `resting ball rides with its pocket (age ${age}, off by ${miss})`);
    runtime.stepCore(coreModule.ROULETTE_CORE_V16,s,1e9);
  }
  console.log(
    JSON.stringify({
      variant: "RouletteV16 thrown ball",
      frames,
      polarBall: true,
      zenithalBounce: true, persistentAwardedPocket: true,
      rendererPure: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  throw e;
});
