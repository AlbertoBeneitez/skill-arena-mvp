// Renderer regressions only. Native touch/full-course QA is a separate harness.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { createRequire, register } = require("node:module"),
  { pathToFileURL } = require("node:url");
const root = process.env.SKY_UI_REPO || path.resolve(__dirname, "..");
const uiFile =
  process.env.SKY_UI_SOURCE || path.join(root, "components/games/SkyHopVerified.tsx");
const coreFile =
  process.env.SKY_V3_SOURCE ||
  path.join(root, "lib/verified/skyHopCore.v3.ts");
const req = createRequire(path.join(root, "package.json")),
  swc = req("next/dist/build/swc");
register(pathToFileURL(path.join(root, "scripts/determinism-loader.mjs")));
async function compile(file, append = "") {
  return (
    await swc.transform(fs.readFileSync(file, "utf8") + append, {
      filename: file,
      jsc: {
        parser: { syntax: "typescript", tsx: true },
        target: "es2022",
        transform: { react: { runtime: "automatic" } },
      },
      module: { type: "commonjs" },
    })
  ).code;
}
async function load(file, dependencies, append = "") {
  const exports = {};
  new Function("require", "exports", await compile(file, append))(
    (name) => dependencies[name] || req(name),
    exports,
  );
  return exports;
}
function multiply(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
function recorder(scale = 1) {
  let matrix = [scale, 0, 0, scale, 0, 0];
  const stack = [],
    calls = [];
  const ctx = {
    canvas: { width: 390, height: 620 },
    fillStyle: "initial-fill",
    strokeStyle: "initial-stroke",
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: "butt",
    dash: [],
    paths: [],
    save() {
      stack.push({
        matrix: [...matrix],
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        globalAlpha: this.globalAlpha,
        lineWidth: this.lineWidth,
        lineCap: this.lineCap,
        dash: [...this.dash],
      });
    },
    restore() {
      assert.ok(stack.length, "unbalanced restore");
      const saved = stack.pop();
      matrix = saved.matrix;
      delete saved.matrix;
      Object.assign(this, saved);
    },
    translate(x, y) {
      matrix = multiply(matrix, [1, 0, 0, 1, x, y]);
    },
    rotate(a) {
      matrix = multiply(matrix, [
        Math.cos(a),
        Math.sin(a),
        -Math.sin(a),
        Math.cos(a),
        0,
        0,
      ]);
    },
    scale(x, y) {
      matrix = multiply(matrix, [x, 0, 0, y, 0, 0]);
    },
    beginPath() {
      this.paths = [];
    },
    setLineDash(dash) {
      this.dash = [...dash];
    },
    getTransform() {
      return {
        a: matrix[0],
        b: matrix[1],
        c: matrix[2],
        d: matrix[3],
        e: matrix[4],
        f: matrix[5],
      };
    },
    closePath() {
      this.paths.push({ op: "closePath", args: [] });
    },
    createLinearGradient() {
      return { addColorStop() {} };
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
    calls,
    stack,
    initialMatrix: [...matrix],
  };
  function record(op, args) {
    calls.push({
      op,
      args: [...args],
      fillStyle: ctx.fillStyle,
      strokeStyle: ctx.strokeStyle,
      alpha: ctx.globalAlpha,
      dash: [...ctx.dash],
      matrix: [...matrix],
      paths: structuredClone(ctx.paths),
    });
  }
  for (const op of ["moveTo", "lineTo", "roundRect", "arc", "ellipse", "rect"])
    ctx[op] = function (...args) {
      this.paths.push({ op, args });
      record(op, args);
    };
  for (const op of [
    "fill",
    "stroke",
    "fillRect",
    "strokeRect",
    "fillText",
    "clip",
  ])
    ctx[op] = function (...args) {
      record(op, args);
    };
  return ctx;
}
const body = (ctx) =>
  ctx.calls.filter(
    (c) =>
      c.op === "fill" &&
      c.fillStyle === "#f3b5c5" &&
      c.paths.some((p) => p.op === "roundRect"),
  );
const outline = (ctx) =>
  ctx.calls.filter(
    (c) =>
      c.op === "strokeRect" && ["#ff719b", "#ffd186"].includes(c.strokeStyle),
  );
const halo = (ctx) =>
  ctx.calls.filter(
    (c) => c.op === "arc" && c.args[2] === 18 && c.strokeStyle === "#ffd186",
  );
const burst = (ctx, hit = false) =>
  ctx.calls.filter(
    (c) => c.op === "stroke" && c.strokeStyle === (hit ? "#ffb099" : "#b7ffe0"),
  );
function assertBalanced(ctx) {
  assert.equal(ctx.stack.length, 0);
  assert.deepEqual(Object.values(ctx.getTransform()), ctx.initialMatrix);
}
module.exports = (async () => {
  await swc.loadBindings();
  const v1 = await import(
      pathToFileURL(path.join(root, ".det-test/lib/verified/skyHopCore.v1.js"))
    ),
    v2 = await import(
      pathToFileURL(path.join(root, ".det-test/lib/verified/skyHopCore.v2.js"))
    ),
    rng = await import(
      pathToFileURL(path.join(root, ".det-test/lib/deterministic/seeded.js"))
    ),
    integer = await import(
      pathToFileURL(
        path.join(root, ".det-test/lib/deterministic/integerMath.js"),
      )
    );
  const v3 = await load(coreFile, {
    "../deterministic/seeded": rng,
    "../deterministic/integerMath": integer,
    "./skyHopCore.v1": v1,
    "./skyHopCore.v2": v2,
  });
  const ui = await load(
    uiFile,
    {
      "@/lib/verified/skyHopCore.v1": v1,
      "@/lib/verified/skyHopCore.v3": v3,
      "@/lib/spaceBackdrop": { drawSpaceBackdrop() {} },
      "./CoreCanvasGame": { default() {} },
    },
    "\nexports.render=render;exports.drawSkyEnemies=drawSkyEnemies;exports.hudLabel=hudLabel;exports.feedbackScore=feedbackScore;exports.failureFinale=failureFinale;",
  );
  const initial = v3.SKY_HOP_CORE_V3.create("public-presentation-regression"),
    enemy = initial.enemies[0];
  assert.ok(enemy, "public fixture must contain a sentry");
  assert.equal(enemy.y, initial.platforms[enemy.platform].y + 24000);
  const base = {
    ...initial,
    enemies: [enemy],
    enemyArmedAt: [220],
    enemyDefeatedAt: [-1],
    tick: 100,
    camera: enemy.y - 300000,
  };
  const draw = (s, scale = 1, renderer = ui.drawSkyEnemies) => {
    const before = JSON.stringify(s),
      ctx = recorder(scale);
    renderer(ctx, s);
    assert.equal(
      JSON.stringify(s),
      before,
      "presentation changed authoritative state",
    );
    assertBalanced(ctx);
    return ctx;
  };
  const dormant = draw({ ...base, enemyArmedAt: [-1] });
  assert.equal(body(dormant).length, 1);
  assert.equal(body(dormant)[0].alpha, 0.3);
  assert.equal(halo(dormant).length, 0);
  assert.deepEqual(outline(dormant)[0].dash, [3, 4]);
  const first = draw(base),
    last = draw({ ...base, tick: 219 }),
    active = draw({ ...base, tick: 220 });
  assert.equal(halo(first).length, 1);
  assert.equal(halo(first)[0].args[3], halo(first)[0].args[4]);
  const arc = halo(last)[0];
  assert.ok(
    Math.abs((arc.args[4] - arc.args[3]) / (2 * Math.PI) - 119 / 120) < 1e-12,
  );
  assert.equal(halo(active).length, 0);
  assert.equal(outline(active)[0].strokeStyle, "#ff719b");
  assert.deepEqual(outline(active)[0].dash, []);
  assert.equal(body(active)[0].alpha, 1);
  assert.deepEqual(outline(active)[0].args, [-11, -13, 22, 26]);
  assert.deepEqual(
    body(active)[0].paths.find((p) => p.op === "roundRect").args,
    [-11, -13, 22, 26, 4],
  );
  const trace = active.calls.find(
    (c) => c.op === "stroke" && c.strokeStyle === "rgba(243,181,197,.25)",
  );
  assert.ok(trace);
  assert.deepEqual(
    trace.paths
      .filter((p) => ["moveTo", "lineTo"].includes(p.op))
      .map((p) => p.args),
    [
      [v3.hopEnemyX({ ...base, tick: 220 }, enemy, 202) / 1000, 300],
      [v3.hopEnemyX({ ...base, tick: 220 }, enemy, 220) / 1000, 300],
    ],
  );
  for (const y of [39999, 40000, 580000, 580001]) {
    const s = { ...base, tick: 220, camera: enemy.y - y },
      ctx = draw(s);
    assert.equal(
      outline(ctx)[0].strokeStyle,
      v3.hopEnemyActive(s, 0) ? "#ff719b" : "#ffd186",
    );
  }
  const recovery = draw({ ...base, tick: 220, respawnUntil: 230 });
  assert.equal(body(recovery)[0].alpha, 0.3);
  assert.equal(halo(recovery).length, 0);
  for (const y of [-49000, 669000])
    assert.equal(body(draw({ ...base, camera: enemy.y - y })).length, 0);
  const dead = { ...base, tick: 220, enemyDefeatedAt: [220] };
  assert.equal(body(draw(dead)).length, 0);
  assert.equal(burst(draw(dead)).length, 1);
  assert.equal(burst(draw({ ...dead, tick: 267 })).length, 1);
  assert.equal(burst(draw({ ...dead, tick: 268 })).length, 0);
  assert.equal(
    body(draw({ ...dead, tick: 300, respawnUntil: 390, enemyArmedAt: [-1] }))
      .length,
    0,
    "defeated sentry resurrected during recovery",
  );
  const contact = {
    ...base,
    tick: 240,
    x: 123000,
    y: initial.y,
    lastEnemyHitTick: 220,
    lastEnemyHitIndex: 0,
  };
  const hit = burst(draw(contact), true)[0];
  assert.ok(hit);
  const hitArc = hit.paths.find((p) => p.op === "arc");
  assert.equal(hitArc.args[0], v3.hopEnemyX(contact, enemy, 220) / 1000);
  assert.equal(hitArc.args[1], 300);
  assert.notEqual(hitArc.args[0], 123);
  assert.equal(
    burst(draw({ ...contact, camera: enemy.y - 800000 }), true).length,
    0,
    "old contact painted onto respawn camera",
  );
  const goal = { ...initial, camera: initial.platforms.at(-1).y - 300000 };
  const goalCtx = draw(goal, 1, ui.render);
  assert.equal(
    goalCtx.calls.filter((c) => c.op === "fillText" && c.args[0] === "META")
      .length,
    1,
  );
  assert.ok(
    !goalCtx.calls.some(
      (c) =>
        c.op === "fillText" && /nivel|puntos|mantén|dirigir/i.test(c.args[0]),
    ),
  );
  for (const scale of [1, 0.45, 2]) {
    const ctx = draw({ ...base, tick: 220, vx: 1100 }, scale, ui.render),
      ship = ctx.calls.find(
        (c) => c.op === "fill" && c.fillStyle === "#edf4fd",
      );
    assert.ok(ship, "ship vanished after enemy drawing");
    const expected = multiply(
      [scale, 0, 0, scale, 0, 0],
      [
        Math.cos(0.11),
        Math.sin(0.11),
        -Math.sin(0.11),
        Math.cos(0.11),
        base.x / 1000,
        (base.y - base.camera) / 1000,
      ],
    );
    for (let i = 0; i < 6; i++)
      assert.ok(
        Math.abs(ship.matrix[i] - expected[i]) < 1e-10,
        "enemy transform leaked into ship",
      );
  }
  assert.equal(ui.hudLabel({ ...initial, highest: 27 }), "ALTURA 27/75");
  assert.equal(ui.feedbackScore(initial), 0);
  assert.ok(ui.feedbackScore({ ...initial, stomps: 1 }) > 0);
  assert.ok(
    ui.feedbackScore({ ...initial, highest: 75, stomps: 1, lives: 2 }) < 0,
    "life loss emitted reward",
  );
  const terminal = { ...contact, status: "failed", failure: "ALIEN_CONTACT" };
  assert.equal(
    burst(draw(terminal), true).length,
    0,
    "terminal impact duplicated a frozen burst under the shared finale",
  );
  for (const elapsed of [0, 150, 300, 1000]) {
    const before = JSON.stringify(terminal),
      ctx = recorder();
    ui.failureFinale.render(ctx, terminal, elapsed);
    assertBalanced(ctx);
    assert.equal(JSON.stringify(terminal), before);
    assert.equal(burst(ctx, true).length, elapsed < 300 ? 1 : 0);
  }
  assert.equal(ui.failureFinale.durationMs, 300);
  console.log(
    "Sky Hop V3 presentation: warning120/armed/grace/FOV/culling/AABB/trail/defeat/contact/terminal/goal75/transform/pure-feedback passed",
  );
  return { v3, ui, initial, recorder, compile };
})();
