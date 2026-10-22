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
  const coreModule = await load("lib/verified/galacticRouletteCore.v4.js"),
    protocol = await load("lib/verified/galacticRouletteProtocol.v2.js"),
    gesture = await load("lib/rouletteTossGesture.js"),
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
      "@/lib/verified/galacticRouletteCore.v4": coreModule,
      "@/lib/verified/galacticRouletteProtocol.v2": protocol,
      "@/lib/rouletteTossGesture": gesture,
      "@/lib/spaceBackdrop": { drawSpaceBackdrop() {} },
      "./CoreCanvasGame": () => null,
    };
  new Function("require", "exports", compiled.code)(
    (id) => deps[id] || req(id),
    exports,
  );
  let frames = 0;
  for (let seed = 0; seed < 16; seed++)
    for (const impulse of [0, 7, 15]) {
      const s = coreModule.ROULETTE_CORE_V4.create("roulette4-render-" + seed);
      runtime.applyCoreInput(
        coreModule.ROULETTE_CORE_V4,
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
          const surface = s.inBowl && r <= 151 ? r < 90 ? (90-r)*.35 : Math.max(0,(r-115)*.35) : 0;
          assert.equal(balls[0][2], 6 + Math.min(130,Math.max(0,s.ballZ/1000-surface-6))*.07);
          frames++;
        }
        runtime.stepCore(coreModule.ROULETTE_CORE_V4, s, 1e9);
      }
    }
  // A landed ball remains in the awarded rotating pocket, never back at dock.
  const s = coreModule.ROULETTE_CORE_V4.create("settled-zenithal");
  s.lastNumber = 32;
  s.lastLandingTick = 240;
  s.tick = 240;
  for (let age = 0; age < 120; age++) {
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
    assert.equal(balls.length,1);
    assert.ok(Math.abs(balls[0][0] - (195 + Math.cos(angle) * 104)) < 1e-8);
    assert.ok(Math.abs(balls[0][1] - (195 + Math.sin(angle) * 104)) < 1e-8);
    runtime.stepCore(coreModule.ROULETTE_CORE_V4,s,1e9);
  }
  console.log(
    JSON.stringify({
      variant: "RouletteV4 rim rebound and natural settling",
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
