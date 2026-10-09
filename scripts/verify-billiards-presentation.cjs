// Actual UI/camera regression; native product/lifecycle QA remains separate.
const root = require("node:path").resolve(__dirname, "..");
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { createRequire, register } = require("node:module"),
  { pathToFileURL } = require("node:url");
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
async function load(file, dependencies = {}, append = "") {
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
function recorder(width = 390, height = 620, cssScale = 1) {
  let matrix = [cssScale, 0, 0, cssScale, 0, 0];
  const texts = [],
    strokes = [],
    glyphs = [],
    stack = [],
    ctx = {
      texts,
      strokes,
      glyphs,
      transformReads: 0,
      canvas: { width, height },
      fillStyle: "",
      strokeStyle: "",
      dash: [],
      paths: [],
      lineWidth: 1,
      save() {
        stack.push({
          dash: [...this.dash],
          paths: this.paths,
          lineWidth: this.lineWidth,
          matrix: [...matrix],
        });
      },
      restore() {
        const state = stack.pop();
        matrix = state.matrix;
        delete state.matrix;
        Object.assign(this, state);
      },
      translate(x, y) {
        matrix = multiply(matrix, [1, 0, 0, 1, x, y]);
      },
      scale(x, y) {
        matrix = multiply(matrix, [x, 0, 0, y, 0, 0]);
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
      getTransform() {
        this.transformReads++;
        return {
          a: matrix[0],
          b: matrix[1],
          c: matrix[2],
          d: matrix[3],
          e: matrix[4],
          f: matrix[5],
        };
      },
      beginPath() {
        this.paths = [];
      },
      moveTo(x, y) {
        this.paths.push({ x, y });
      },
      lineTo(x, y) {
        this.paths.push({ x, y });
      },
      stroke() {
        strokes.push({
          path: this.paths.map((p) => ({ ...p })),
          dash: [...this.dash],
        });
      },
      setLineDash(dash) {
        this.dash = dash;
      },
      fillText(text) {
        texts.push(text);
        glyphs.push({ text, matrix: [...matrix] });
      },
      createLinearGradient() {
        return { addColorStop() {} };
      },
      createRadialGradient() {
        return { addColorStop() {} };
      },
    };
  for (const name of [
    "fillRect",
    "roundRect",
    "fill",
    "strokeRect",
    "arc",
    "ellipse",
    "rect",
    "clip",
  ])
    ctx[name] = () => {};
  return ctx;
}
module.exports = (async () => {
  await swc.loadBindings();
  const v1 = await import(
      pathToFileURL(
        path.join(root, ".det-test/lib/verified/billiardsCore.v1.js"),
      )
    ),
    rng = await import(
      pathToFileURL(path.join(root, ".det-test/lib/deterministic/seeded.js"))
    ),
    protocol = await import(
      pathToFileURL(
        path.join(root, ".det-test/lib/verified/billiardsProtocol.v1.js"),
      )
    );
  const v2 = await import(
    pathToFileURL(path.join(root, ".det-test/lib/verified/billiardsCore.v2.js"))
  );
  const camera = await import(
    pathToFileURL(path.join(root, ".det-test/lib/billiardsPresentation.js"))
  );
  const uiSource = path.join(root, "components/games/Billiards.tsx");
  const ui = await load(
    uiSource,
    {
      react: { useMemo: (factory) => factory() },
      "@/lib/spaceBackdrop": { drawSpaceBackdrop() {} },
      "@/lib/billiardsPresentation": camera,
      "@/lib/verified/billiardsCore.v1": v1,
      "@/lib/verified/billiardsCore.v2": v2,
      "@/lib/verified/billiardsProtocol.v1": protocol,
      "./CoreCanvasGame": { default() {} },
    },
    "\nexports.createPresentation=createPresentation;exports.drawAimGuide=drawAimGuide;exports.aim=aim;exports.hudLabel=hudLabel;",
  );
  const state = v2.BILLIARDS_CORE_V2.create("ui-public-test");
  assert.equal(state.balls.length, 11);
  assert.equal(state.shotsLeft, 18);
  assert.equal(state.height, 0);
  const snapshot = JSON.stringify(state),
    presentation = ui.createPresentation();
  for (let power = 0; power < 3; power++)
    for (let aim = 0; aim < 180; aim++) {
      const s = { ...state, power, aim },
        before = JSON.stringify(s),
        ctx = recorder();
      presentation.render(ctx, s, { width: 390, height: 620 });
      assert.equal(JSON.stringify(s), before);
      for (let id = 1; id <= 10; id++)
        assert.equal(ctx.texts.filter((t) => t === String(id)).length, 1);
      assert.ok(
        !ctx.texts.some((t) => /MESA \d|−250|TIRO EN CURSO|DESPEJADA/.test(t)),
      );
      const guide = ctx.strokes.find((stroke) => stroke.dash.length);
      if (guide) {
        const [a, b] = guide.path;
        assert.ok(
          Math.hypot(a.x - b.x, a.y - b.y) <= 96,
          "guide predicts long flight",
        );
      }
    }
  assert.equal(JSON.stringify(state), snapshot);
  const contactState = {
    ...state,
    aim: 0,
    balls: [
      { ...state.balls[0], x: 100000, y: 300000 },
      { ...state.balls[1], x: 150000, y: 300000 },
    ],
    bumpers: [],
  };
  const contactCtx = recorder();
  ui.drawAimGuide(contactCtx, contactState);
  const contactLine = contactCtx.strokes.find(
    (stroke) => stroke.dash.length,
  ).path;
  assert.ok(Math.abs(contactLine.at(-1).x - 130) < 1e-8);
  assert.equal(contactLine.at(-1).y, 300);
  for (const phase of ["moving", "aim"])
    assert.ok(
      ui
        .hudLabel({ ...state, phase, scratch: true })
        .includes("BLANCA EMBOCADA"),
    );
  assert.ok(
    !ui.hudLabel({ ...state, scratch: false }).includes("BLANCA EMBOCADA"),
  );
  assert.equal(
    ui.hudLabel({ ...state, height: 10, shotsLeft: 5 }),
    "AVANCE 10 / 10 · 5 TIROS",
  );
  const dimensions = [
    [390, 780],
    [320, 760],
    [520, 326],
    [520, 220],
    [390, 240],
    [320, 220],
  ];
  let roundTrips = 0;
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    for (const [cssWidth, cssHeight] of dimensions) {
      const viewport = {
          width: Math.max(390, (cssWidth / cssHeight) * 620),
          height: 620,
        },
        cssScale = Math.min(cssWidth / viewport.width, cssHeight / 620),
        view = camera.getBilliardsCamera(viewport, cssScale);
      if (view.rotated) {
        const bounds = camera.BILLIARDS_TABLE_VIEW_BOUNDS;
        const corners = [
          { x: bounds.left, y: bounds.top },
          { x: bounds.right, y: bounds.top },
          { x: bounds.left, y: bounds.bottom },
          { x: bounds.right, y: bounds.bottom },
        ].map((point) => camera.projectBilliardsPoint(view, point));
        const right = Math.max(...corners.map((p) => p.x)) * cssScale;
        assert.ok(
          right <= cssWidth - 110 - 1e-7,
          "table enters the 90px control + 20px inset pane",
        );
        for (const point of corners)
          assert.ok(
            point.x >= 0 && point.y >= 72 - 1e-7 && point.y <= 570 + 1e-7,
            "table frame clipped",
          );
        for (const pocket of v1.BILLIARDS_POCKETS) {
          const p = camera.projectBilliardsPoint(view, {
              x: pocket.x / 1000,
              y: pocket.y / 1000,
            }),
            r = 21 * view.scale;
          assert.ok(
            p.x - r >= 0 &&
              p.y - r >= 0 &&
              p.y + r <= 620 &&
              p.x + r <= viewport.width,
          );
        }
      }
      for (const dpr of [0.8, 1, 2, 3]) {
        const effectiveDpr = Math.min(2, Math.max(1, dpr));
        Object.defineProperty(globalThis, "window", {
          configurable: true,
          value: { devicePixelRatio: dpr },
        });
        const adapter = ui.createPresentation(),
          ctx = recorder(
            Math.round(cssWidth * effectiveDpr),
            Math.round(cssHeight * effectiveDpr),
            cssScale * effectiveDpr,
          );
        adapter.render(ctx, state, viewport);
        for (const glyph of ctx.glyphs)
          assert.ok(
            Math.abs(glyph.matrix[1]) < 1e-9 &&
              Math.abs(glyph.matrix[2]) < 1e-9 &&
              glyph.matrix[0] > 0 &&
              glyph.matrix[3] > 0,
            "ball numbers rotated with the table",
          );
        const reads = ctx.transformReads;
        adapter.render(ctx, state, viewport);
        assert.equal(
          ctx.transformReads,
          reads,
          "unchanged viewport repeats camera transform measurement",
        );
        for (let aim = 0; aim < 180; aim++) {
          const dir = v1.billiardsDirection(aim),
            world = {
              x: state.balls[0].x / 1000 + (dir.x / dir.length) * 55,
              y: state.balls[0].y / 1000 + (dir.y / dir.length) * 55,
            },
            projected = camera.projectBilliardsPoint(view, world),
            back = camera.unprojectBilliardsPoint(view, projected);
          assert.ok(
            Math.abs(back.x - world.x) < 1e-9 &&
              Math.abs(back.y - world.y) < 1e-9,
          );
          assert.equal(
            adapter.pointAction(projected, "down", state),
            `AIM_${String(aim).padStart(3, "0")}`,
          );
          assert.equal(adapter.pointAction(projected, "up", state), null);
          assert.equal(
            adapter.pointAction(projected, "down", {
              ...state,
              phase: "moving",
            }),
            null,
          );
          roundTrips++;
        }
        const matrixCtx = recorder();
        camera.applyBilliardsCamera(matrixCtx, view);
        const matrix = matrixCtx.getTransform(),
          world = { x: 100, y: 200 },
          expected = camera.projectBilliardsPoint(view, world);
        assert.ok(
          Math.abs(
            matrix.a * world.x + matrix.c * world.y + matrix.e - expected.x,
          ) < 1e-9 &&
            Math.abs(
              matrix.b * world.x + matrix.d * world.y + matrix.f - expected.y,
            ) < 1e-9,
        );
      }
    }
  } finally {
    if (previousWindow)
      Object.defineProperty(globalThis, "window", previousWindow);
    else delete globalThis.window;
  }
  const surface = ui.default({
    active: true,
    stake: 0,
    targetScore: 1e9,
    onFinish() {},
  }).props.children.props;
  assert.equal(surface.core, v2.BILLIARDS_CORE_V2);
  assert.equal(surface.hideHudScore, true);
  assert.equal(surface.hideHudLabel, undefined);
  assert.equal(surface.expandHorizontalViewport, true);
  assert.equal(surface.hudLabel(state), "AVANCE 0 / 10 · 18 TIROS");
  assert.equal(surface.controls.length, 4);
  const source = fs.readFileSync(uiSource, "utf8");
  assert.ok(!source.includes("forecastBilliards"));
  assert.ok(!source.includes("s.stage"));
  console.log(
    JSON.stringify({
      variant: "Billar V2 continuous presentation",
      targetCount: 10,
      shots: 18,
      aimPowerCombinations: 540,
      roundTrips,
      cssViewports: dimensions.length,
      dprCases: 4,
      forecastCalls: 0,
      inputsUnchanged: true,
      rendererStateUnchanged: true,
      coreVersion: surface.core.gameVersion,
    }),
  );
})();
