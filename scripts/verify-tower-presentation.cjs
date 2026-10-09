// Renderer regression: no simulation or competitive code is replaced.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { createRequire, register } = require("node:module");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "..");
const projectRequire = createRequire(path.join(root, "package.json"));
const swc = projectRequire("next/dist/build/swc");
register(pathToFileURL(path.join(root, "scripts/determinism-loader.mjs")));
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
function recorder() {
  let matrix = [1, 0, 0, 1, 0, 0];
  const stack = [],
    rectangles = [],
    texts = [];
  const ctx = {
    rectangles,
    texts,
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    save() {
      stack.push({
        matrix: [...matrix],
        fill: this.fillStyle,
        stroke: this.strokeStyle,
        alpha: this.globalAlpha,
      });
    },
    restore() {
      const state = stack.pop();
      matrix = state.matrix;
      this.fillStyle = state.fill;
      this.strokeStyle = state.stroke;
      this.globalAlpha = state.alpha;
    },
    translate(x, y) {
      matrix = multiply(matrix, [1, 0, 0, 1, x, y]);
    },
    scale(x, y) {
      matrix = multiply(matrix, [x, 0, 0, y, 0, 0]);
    },
    rotate(r) {
      matrix = multiply(matrix, [
        Math.cos(r),
        Math.sin(r),
        -Math.sin(r),
        Math.cos(r),
        0,
        0,
      ]);
    },
    fillRect(x, y, w, h) {
      const corners = [
        [x, y],
        [x + w, y],
        [x, y + h],
        [x + w, y + h],
      ].map(([a, b]) => [
        matrix[0] * a + matrix[2] * b + matrix[4],
        matrix[1] * a + matrix[3] * b + matrix[5],
      ]);
      rectangles.push({
        style: this.fillStyle,
        x: Math.min(...corners.map((c) => c[0])),
        y: Math.min(...corners.map((c) => c[1])),
        right: Math.max(...corners.map((c) => c[0])),
        bottom: Math.max(...corners.map((c) => c[1])),
      });
    },
    fillText(text) {
      texts.push(text);
    },
  };
  for (const method of [
    "strokeRect",
    "beginPath",
    "moveTo",
    "lineTo",
    "stroke",
    "arc",
    "fill",
    "ellipse",
    "closePath",
    "rect",
    "clip",
  ])
    ctx[method] = () => {};
  return ctx;
}
async function loadRenderer(file, importedCore) {
  const source =
    fs.readFileSync(file, "utf8") + "\nexports.presentationRender = render;\n";
  const compiled = (
    await swc.transform(source, {
      filename: file,
      jsc: {
        parser: { syntax: "typescript", tsx: true },
        target: "es2022",
        transform: { react: { runtime: "automatic" } },
      },
      module: { type: "commonjs" },
    })
  ).code;
  const exports = {};
  const dependency = (name) => {
    if (name === "@/lib/spaceBackdrop") return { drawSpaceBackdrop() {} };
    if (name.startsWith("@/lib/verified/")) return importedCore;
    if (name === "./CoreCanvasGame") return { default() {} };
    return projectRequire(name);
  };
  new Function("require", "exports", compiled)(dependency, exports);
  return exports.presentationRender;
}
module.exports = (async () => {
  await swc.loadBindings();
  const tower = await import(
    pathToFileURL(path.join(root, ".det-test/lib/verified/towerDropCore.v3.js"))
  );
  const stack = await import(
    pathToFileURL(
      path.join(root, ".det-test/lib/verified/precisionStackCore.v3.js"),
    )
  );
  const runtime = await import(
    pathToFileURL(path.join(root, ".det-test/lib/verified/coreRuntime.v1.js"))
  );
  const sourceDir = process.env.QA_PRESENTATION_SOURCE || root;
  const renderTower = await loadRenderer(
    path.join(sourceDir, "components/games/TowerDropV3.tsx"),
    tower,
  );
  const renderStack = await loadRenderer(
    path.join(sourceDir, "components/games/Stack3D.tsx"),
    stack,
  );
  const state = tower.createTowerDropV3(
    "9cfe3ebfbb7a58e46db026a8cf3840d88b06df9f171ec6f025b124b29f0046bf",
  );
  const inputs = [],
    realHeights = new Set([state.blocks.length]);
  while (
    state.status === "running" &&
    state.blocks.length < 15 &&
    state.tick < 43200
  ) {
    if (state.phase === "swing") {
      const top = state.blocks.at(-1),
        forecast = tower.forecastTowerLanding(state);
      if (
        forecast.stable &&
        Math.abs(
          forecast.xMilli +
            state.movingWMilli / 2 -
            top.xMilli -
            top.wMilli / 2,
        ) < 2000
      ) {
        inputs.push({ seq: inputs.length, tick: state.tick, action: "DROP" });
        runtime.applyCoreInput(tower.TOWER_DROP_CORE_V3, state, "DROP", 1e9);
      }
    }
    if (state.status === "running")
      runtime.stepCore(tower.TOWER_DROP_CORE_V3, state, 1e9);
    realHeights.add(state.blocks.length);
  }
  assert.ok(
    realHeights.has(4),
    "regression requires a real tower beyond three blocks",
  );
  const before = JSON.stringify(state);
  if (process.env.QA_EXPECT_EXISTING_BUG) {
    const broken = { ...state, blocks: state.blocks.slice(0, 4) };
    const ctx = recorder();
    renderTower(ctx, broken);
    assert.equal(
      ctx.rectangles.find((r) => r.style === "#173949"),
      undefined,
    );
    console.log(
      "Existing Tower presentation regression reproduced: foundation is not drawn at four settled blocks.",
    );
    return;
  }
  for (const count of [1, 2, 3, 4, 8, 12, 13, 16, 32, 64, 128, 256, 501]) {
    const testState = {
      ...state,
      phase: "swing",
      height: count - 1,
      blocks: Array.from({ length: count }, (_, i) => ({
        ...state.blocks[Math.min(i, state.blocks.length - 1)],
      })),
    };
    const unchanged = JSON.stringify(testState),
      ctx = recorder();
    renderTower(ctx, testState);
    assert.equal(
      JSON.stringify(testState),
      unchanged,
      "renderer mutated deterministic state",
    );
    const ground = ctx.rectangles.filter((r) => r.style === "#173949");
    assert.equal(ground.length, 1, `missing ground at ${count}`);
    assert.ok(Math.abs(ground[0].y - 580) < 1e-6, `ground moves at ${count}`);
    assert.ok(ground[0].bottom < 620);
    const crane = ctx.rectangles.find((r) => r.style === "#c4eff8");
    assert.ok(
      crane.y >= 80 - 1e-6 && crane.bottom < ground[0].y,
      `crane clipping at ${count}`,
    );
    const blocks = ctx.rectangles.filter((r) => /^hsl\(/.test(r.style));
    assert.equal(blocks.length, count + 1, "settled layers culled");
    for (const rectangle of blocks.slice(0, count))
      assert.ok(
        rectangle.y >= 80 && rectangle.bottom <= 580 + 1e-6,
        `foundation layer clipped at ${count}`,
      );
    const top = blocks[count - 1];
    assert.ok(top.bottom - top.y >= 15, "landing block loses readable height");
  }
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(
    runtime.replayCore(
      tower.TOWER_DROP_CORE_V3,
      inputs,
      state.tick,
      state.seed,
      1e9,
    ).state,
    state,
    "renderer tests changed replay state",
  );
  for (const axis of ["x", "z"]) {
    const ctx = recorder();
    renderStack(ctx, { ...stack.STACK_3D_CORE.create("presentation"), axis });
    assert.ok(
      ctx.texts.every(
        (text) => !["LONGITUDINAL", "TRANSVERSAL"].includes(text),
      ),
    );
  }
  console.log(
    JSON.stringify({
      renderer: "Tower foundation + all settled layers remain visible",
      realBlocks: state.blocks.length,
      realTick: state.tick,
      stressBlocks: 501,
      replayIdentical: true,
      stackAxisTextAbsent: true,
    }),
  );
})();
