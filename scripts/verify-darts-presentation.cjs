// Actual renderer and read-only sprite/flight geometry; competitive cores stay frozen.
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
  const legacy = await load("lib/verified/dartsCore.v1.js"),
    v2 = await load("lib/verified/dartsCore.v2.js"),
    protocol = await load("lib/verified/dartsProtocol.v1.js"),
    gesture = await load("lib/verified/dartsGesture.v2.js");
  const visual = await load("lib/dartsPresentation.js"),
    runtime = await load("lib/verified/coreRuntime.v1.js");
  const file = path.join(root, "components/games/Darts.tsx"),
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
  const deps = {
    "@/lib/verified/dartsCore.v1": legacy,
    "@/lib/verified/dartsCore.v2": v2,
    "@/lib/verified/dartsGesture.v2": gesture,
    "@/lib/verified/dartsProtocol.v1": protocol,
    "@/lib/dartsPresentation": visual,
    "@/lib/spaceBackdrop": { drawSpaceBackdrop() {} },
    "./CoreCanvasGame": () => null,
  };
  const exports = {};
  new Function("require", "exports", compiled.code)(
    (id) => deps[id] || req(id),
    exports,
  );
  function recorder() {
    const stack = [],
      sprites = [],
      calls = [];
    let transform = { x: 0, y: 0, angle: 0, scale: 1 };
    const ctx = new Proxy(
      { fillStyle: "", globalAlpha: 1 },
      {
        get(obj, key) {
          if (key in obj) return obj[key];
          return (...args) => {
            calls.push([key, ...args]);
            if (key === "save")
              stack.push({
                transform: { ...transform },
                fillStyle: obj.fillStyle,
                globalAlpha: obj.globalAlpha,
              });
            if (key === "restore") {
              const old = stack.pop();
              assert.ok(old);
              transform = old.transform;
              obj.fillStyle = old.fillStyle;
              obj.globalAlpha = old.globalAlpha;
            }
            if (key === "translate") {
              transform.x += args[0];
              transform.y += args[1];
            }
            if (key === "rotate") transform.angle += args[0];
            if (key === "scale") transform.scale *= args[0];
            if (key === "fill" && obj.fillStyle === "#dff7ff")
              sprites.push({ ...transform });
          };
        },
      },
    );
    return { ctx, stack, sprites, calls };
  }
  let frames = 0;
  for (let seed = 0; seed < 100; seed++) {
    const state = v2.DARTS_CORE_V2.create(`darts-presentation-${seed}`),
      original = JSON.stringify(state);
    let r = recorder();
    exports.renderUnderTest(r.ctx, state);
    assert.equal(JSON.stringify(state), original);
    assert.equal(r.sprites.length, 1, "dart visible before any input");
    assert.deepEqual(
      [r.sprites[0].x, r.sprites[0].y, r.sprites[0].scale],
      [195, 550, 1.35],
    );
    assert.equal(r.stack.length, 0);
    const ready = visual.dartPresentationPose(state);
    assert.equal(ready.x, 195);
    assert.equal(ready.y, 550);
    runtime.applyCoreInput(v2.DARTS_CORE_V2, state, "THROW", 1e6);
    const last = state.impacts.at(-1);
    assert.ok(last && !last.timeout);
    const endpoint = { x: 195 + last.x / 1000, y: 285 + last.y / 1000 };
    let previous = visual.dartPresentationPose(state);
    for (let tick = 0; tick <= 24; tick++) {
      const before = JSON.stringify(state),
        pose = visual.dartPresentationPose(state);
      r = recorder();
      exports.renderUnderTest(r.ctx, state);
      assert.equal(
        JSON.stringify(state),
        before,
        "renderer never changes authority",
      );
      assert.equal(r.stack.length, 0);
      assert.equal(
        r.sprites.length,
        1,
        "one projectile/impact, never ghost plus duplicate",
      );
      assert.ok(
        Math.abs(r.sprites[0].x - pose.x) < 1e-9 &&
          Math.abs(r.sprites[0].y - pose.y) < 1e-9,
        "actual sprite tip follows public pose",
      );
      if (tick > 0) {
        assert.ok(pose.y < previous.y);
        assert.ok(pose.scale < previous.scale);
      }
      if (tick === 24) {
        assert.equal(pose.x, endpoint.x);
        assert.equal(pose.y, endpoint.y);
        assert.equal(state.score, last.award);
      }
      previous = pose;
      frames++;
      if (tick < 24) runtime.stepCore(v2.DARTS_CORE_V2, state, 1e6);
    }
  }
  const timeout = v2.DARTS_CORE_V2.create("dart-timeout");
  runtime.advanceCoreToTick(v2.DARTS_CORE_V2, timeout, 14 * 120, 1e6);
  assert.equal(timeout.impacts.at(-1).timeout, true);
  assert.equal(
    visual.dartPresentationPose(timeout),
    null,
    "timeout never fabricates a thrown dart",
  );
  assert.ok(!source.includes("+${last?.award"), "no distracting points toast");
  assert.ok(source.includes("hideHudScore"));
  assert.ok(
    !source.includes("ctx.lineTo(cx, 530)"),
    "prepared dart replaces procedural swipe arrow",
  );
  console.log(
    JSON.stringify({
      variant: "Darts V2 presentation",
      openingSprite: true,
      flightFrames: frames,
      actualImpactTick: 24,
      rendererPure: true,
      ghosts: 0,
      coreAndInputsUnchanged: true,
    }),
  );
})().catch((error) => {
  console.error(error);
  throw error;
});
