// Render the actual V3 component: no predicted landing marker, no scoring/UI mutation.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { register, createRequire } = require("node:module"),
  { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, ".."),
  req = createRequire(path.join(root, "package.json"));
register(pathToFileURL(path.join(root, "scripts/determinism-loader.mjs")));
module.exports = (async () => {
  const load = (p) => import(pathToFileURL(path.join(root, ".det-test", p))),
    v3 = await load("lib/verified/dartsCore.v3.js"),
    legacy = await load("lib/verified/dartsCore.v1.js"),
    visual = await load("lib/dartsFlightPerspective.js"),
    sprite = await load("lib/dartsPresentation.js"),
    protocol = await load("lib/verified/dartsProtocol.v1.js"),
    gesture = await load("lib/verified/dartsGesture.v2.js"),
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
      "@/lib/verified/dartsCore.v3": v3,
      "@/lib/verified/dartsCore.v1": legacy,
      "@/lib/dartsFlightPerspective": visual,
      "@/lib/dartsPresentation": sprite,
      "@/lib/verified/dartsProtocol.v1": protocol,
      "@/lib/verified/dartsGesture.v2": gesture,
      "@/lib/spaceBackdrop": { drawSpaceBackdrop() {} },
      "./CoreCanvasGame": () => null,
    },
    exports = {};
  const BOARD_SCALE = 1.08;
  new Function("require", "exports", compiled.code)(
    (id) => deps[id] || req(id),
    exports,
  );
  function recorder() {
    const stack = [],
      sprites = [],
      arcs = [],
      texts = [];
    let transform = { x: 0, y: 0, scale: 1, angle: 0 };
    const ctx = new Proxy(
      { fillStyle: "", globalAlpha: 1 },
      {
        get(obj, key) {
          if (key in obj) return obj[key];
          return (...args) => {
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
            if (key === "scale") transform.scale *= args[0];
            if (key === "rotate") transform.angle += args[0];
            if (key === "arc") arcs.push(args);
            if (key === "fillText") texts.push(String(args[0]));
            if (key === "fill" && obj.fillStyle === "#dff7ff")
              sprites.push({ ...transform });
          };
        },
      },
    );
    return { ctx, stack, sprites, arcs, texts };
  }
  let frames = 0;
  for (let i = 0; i < 32; i++) {
    const s = v3.DARTS_CORE_V3.create(`dart3-visual-${i}`);
    function check() {
      const before = JSON.stringify(s),
        r = recorder();
      exports.renderUnderTest(r.ctx, s);
      assert.equal(JSON.stringify(s), before);
      assert.equal(r.stack.length, 0);
      assert.ok(!r.arcs.some((a) => a[2] === 7), "no landing reticle");
      assert.ok(!r.texts.some((t) => t.includes("OBJETIVO")));
      const flight = s.phase === "flight" && s.phaseTicks < 120;
      const landed = s.impacts.filter((hit, i) => !hit.timeout && !(i === s.impacts.length - 1 && flight));
      const p = s.phase === "flight" && s.phaseTicks >= 120 ? null : visual.dartPerspectivePose(s, BOARD_SCALE);
      assert.equal(r.sprites.length, landed.length + (p ? 1 : 0));
      landed.forEach((hit, i) => {
        assert.equal(r.sprites[i].x, 195 + (hit.x / 1000) * BOARD_SCALE);
        assert.equal(r.sprites[i].y, 285 + (hit.y / 1000) * BOARD_SCALE);
      });
      if (p) {
        assert.ok(Math.abs(p.x - r.sprites.at(-1).x) < 1e-9);
        assert.ok(Math.abs(p.y - r.sprites.at(-1).y) < 1e-9);
      }
      frames++;
    }
    check();
    assert.equal(visual.dartPerspectivePose(s).y, 550);
    runtime.applyCoreInput(v3.DARTS_CORE_V3, s, "THROW", 1e9);
    const hit = s.impacts[0];
    let lastScale = Infinity;
    const angles = new Set();
    for (let age = 0; age < 144; age++) {
      check();
      const p = visual.dartPerspectivePose(s, BOARD_SCALE);
      if (age <= 120) {
        assert.ok(p.scale <= lastScale);
        lastScale = p.scale;
        angles.add(p.angle.toFixed(3));
        if (age === 120) {
          assert.equal(p.x, 195 + (hit.x / 1000) * BOARD_SCALE);
          assert.equal(p.y, 285 + (hit.y / 1000) * BOARD_SCALE);
          assert.equal(s.total, hit.points);
        }
      }
      runtime.stepCore(v3.DARTS_CORE_V3, s, 1e9);
    }
    assert.ok(angles.size > 10, "tangent changes through arc");
    check();
    assert.equal(s.impacts.length, 1);
    for (let throwIndex = 1; throwIndex < 5; throwIndex++) {
      runtime.applyCoreInput(v3.DARTS_CORE_V3, s, "THROW", 1e9);
      for (let age = 0; age < 144; age++) {
        if (age % 12 === 0) check();
        runtime.stepCore(v3.DARTS_CORE_V3, s, 1e9);
      }
      check();
      assert.equal(s.impacts.length, throwIndex + 1);
    }
  }
  const idle = v3.DARTS_CORE_V3.create("visual-timeout");
  runtime.advanceCoreToTick(v3.DARTS_CORE_V3, idle, 14 * 120, 1e9);
  assert.equal(
    visual.dartPerspectivePose(idle),
    null,
    "timeout never fabricates a thrown dart",
  );
  assert.ok(source.includes("i < s.impacts.length"), "landed darts remain on board");
  console.log(
    JSON.stringify({
      variant: "Darts V3 enlarged board presentation",
      frames,
      openingSprite: true,
      impactTick: 120,
      curvedFlight: true,
      noForecast: true,
      persistentImpacts: true,
      rendererPure: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  throw e;
});
