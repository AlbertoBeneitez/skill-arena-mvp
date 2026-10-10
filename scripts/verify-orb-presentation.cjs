// Actual renderer/input-camera regressions. Native complete-course QA remains separate.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { createRequire, register } = require("node:module"),
  { pathToFileURL } = require("node:url");
const root = process.env.ORB_UI_REPO || path.resolve(__dirname, ".."),
  uiSource =
    process.env.ORB_UI_SOURCE ||
    path.join(root, "components/games/OrbBurstVerified.tsx"),
  cameraDir = process.env.ORB_CAMERA_DIR || path.join(root, "lib"),
  coreSource =
    process.env.ORB_V2_SOURCE ||
    path.join(root, "lib/verified/orbBurstCore.v2.ts");
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
async function load(file, deps = {}, append = "") {
  const exports = {};
  new Function("require", "exports", await compile(file, append))(
    (id) => deps[id] || req(id),
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
function recorder(width = 390, height = 620, scale = 1) {
  let matrix = [scale, 0, 0, scale, 0, 0];
  const stack = [],
    calls = [];
  const ctx = {
    canvas: { width, height },
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: "butt",
    dash: [],
    paths: [],
    calls,
    stack,
    transformReads: 0,
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
      assert.ok(stack.length, "restore without save");
      const s = stack.pop();
      matrix = s.matrix;
      delete s.matrix;
      Object.assign(this, s);
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
    closePath() {
      this.paths.push({ op: "closePath", args: [] });
    },
    setLineDash(d) {
      this.dash = [...d];
    },
    createRadialGradient(...args) {
      return {
        radial: args,
        stops: [],
        addColorStop(offset, color) {
          this.stops.push({ offset, color });
        },
      };
    },
    createLinearGradient() {
      return { addColorStop() {} };
    },
  };
  const record = (op, args) =>
    calls.push({
      op,
      args,
      paths: structuredClone(ctx.paths),
      fillStyle: ctx.fillStyle,
      strokeStyle: ctx.strokeStyle,
      alpha: ctx.globalAlpha,
      dash: [...ctx.dash],
      matrix: [...matrix],
    });
  for (const op of ["moveTo", "lineTo", "arc", "ellipse", "rect", "roundRect"])
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
const mainOrbs = (ctx) =>
  ctx.calls.filter(
    (c) =>
      c.op === "fill" &&
      c.fillStyle?.radial?.[5] === 17 &&
      c.paths.some((p) => p.op === "arc" && p.args[2] === 17),
  );
const guide = (ctx) =>
  ctx.calls.filter(
    (c) => c.op === "stroke" && c.strokeStyle === "rgba(205,244,255,.7)",
  );
function historicalProject(camera, point) {
  const x = point.x - 195,
    y = point.y - 299.5;
  return camera.rotated
    ? {
        x: camera.centerX + y * camera.scale,
        y: camera.centerY - x * camera.scale,
      }
    : {
        x: camera.centerX + x * camera.scale,
        y: camera.centerY + y * camera.scale,
      };
}
function historicalUnproject(camera, point) {
  const x = (point.x - camera.centerX) / camera.scale,
    y = (point.y - camera.centerY) / camera.scale;
  return camera.rotated
    ? { x: 195 - y, y: 299.5 + x }
    : { x: 195 + x, y: 299.5 + y };
}
module.exports = (async () => {
  await swc.loadBindings();
  const v1 = await import(
      pathToFileURL(
        path.join(root, ".det-test/lib/verified/orbBurstCore.v1.js"),
      )
    ),
    protocol = await import(
      pathToFileURL(
        path.join(root, ".det-test/lib/verified/orbBurstProtocol.v1.js"),
      )
    ),
    rng = await import(
      pathToFileURL(path.join(root, ".det-test/lib/deterministic/seeded.js"))
    ),
    integer = await import(
      pathToFileURL(
        path.join(root, ".det-test/lib/deterministic/integerMath.js"),
      )
    );
  const shared = await load(path.join(cameraDir, "canvasCamera.ts")),
    camera = await load(path.join(cameraDir, "orbPresentation.ts"), {
      "./canvasCamera": shared,
    }),
    billiards = await load(path.join(cameraDir, "billiardsPresentation.ts"), {
      "./canvasCamera": shared,
    });
  const v2 = await load(coreSource, {
    "../deterministic/seeded": rng,
    "../deterministic/integerMath": integer,
    "./orbBurstCore.v1": v1,
    "./orbBurstProtocol.v1": protocol,
  });
  const ui = await load(
    uiSource,
    {
      react: { useMemo: (factory) => factory() },
      "@/lib/spaceBackdrop": { drawSpaceBackdrop() {} },
      "@/lib/verified/orbBurstCore.v1": v1,
      "@/lib/verified/orbBurstCore.v2": v2,
      "@/lib/verified/orbBurstProtocol.v1": protocol,
      "@/lib/orbPresentation": camera,
      "./CoreCanvasGame": { default() {} },
    },
    "\nexports.createPresentation=createPresentation;exports.drawAimGuide=drawAimGuide;exports.pointAction=pointAction;exports.hudLabel=hudLabel;exports.feedbackScore=feedbackScore;",
  );
  const state = v2.ORB_BURST_CORE_V2.create("public-presentation-regression");
  assert.equal(state.height, 0);
  assert.equal(state.bubbles.length, 36);
  assert.equal(v2.ORB_V2_RULES.sourceGoal, 108);
  for (const rotated of [false, true])
    for (const scale of [0.1, 1, 1.235])
      for (const point of [
        { x: 0, y: 0 },
        { x: 390, y: 620 },
        { x: 195, y: 299.5 },
        { x: 10.124, y: 599.323 },
      ]) {
        const c = { centerX: 196.234, centerY: 310.524, scale, rotated };
        assert.deepEqual(
          billiards.projectBilliardsPoint(c, point),
          historicalProject(c, point),
        );
        assert.deepEqual(
          billiards.unprojectBilliardsPoint(c, point),
          historicalUnproject(c, point),
        );
        const calls = [],
          ctx = {
            translate: (...p) => calls.push(["translate", ...p]),
            rotate: (...p) => calls.push(["rotate", ...p]),
            scale: (...p) => calls.push(["scale", ...p]),
          };
        billiards.applyBilliardsCamera(ctx, c);
        assert.deepEqual(calls, [
          ["translate", c.centerX, c.centerY],
          ...(rotated ? [["rotate", -Math.PI / 2]] : []),
          ["scale", c.scale, c.scale],
          ["translate", -195, -299.5],
        ]);
      }
  const dimensions = [
    [390, 680],
    [320, 636],
    [844, 324],
    [520, 220],
    [640, 300],
    [390, 220],
  ];
  let inputCases = 0;
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    for (const [cssWidth, cssHeight] of dimensions) {
      const viewport = {
          width: Math.max(390, (cssWidth / cssHeight) * 620),
          height: 620,
        },
        cssScale = Math.min(cssWidth / viewport.width, cssHeight / 620),
        view = camera.getOrbCamera(viewport, cssScale);
      const corners = [
        { x: 0, y: 0 },
        { x: 390, y: 0 },
        { x: 0, y: 620 },
        { x: 390, y: 620 },
      ].map((p) => camera.projectOrbPoint(view, p));
      assert.ok(
        corners.every(
          (p) =>
            p.x >= -1e-9 &&
            p.x <= viewport.width + 1e-9 &&
            p.y >= -1e-9 &&
            p.y <= 620 + 1e-9,
        ),
        "camera cuts competitive FOV",
      );
      if (view.rotation !== 0) {
        assert.ok(
          Math.max(...corners.map((p) => p.x)) * cssScale <= cssWidth,
          "field leaves the viewport",
        );
        assert.ok(
          Math.min(...corners.map((p) => p.y)) * cssScale >= 44 - 1e-9,
          "field enters HUD",
        );
      }
      for (const dpr of [1, 2, 3]) {
        const effectiveDpr = Math.min(2, dpr);
        Object.defineProperty(globalThis, "window", {
          configurable: true,
          value: { devicePixelRatio: dpr },
        });
        const presentation = ui.createPresentation(),
          ctx = recorder(
            cssWidth * effectiveDpr,
            cssHeight * effectiveDpr,
            cssScale * effectiveDpr,
          ),
          before = JSON.stringify(state);
        presentation.render(ctx, state, viewport);
        assert.equal(JSON.stringify(state), before);
        assert.equal(ctx.stack.length, 0);
        assert.equal(mainOrbs(ctx).length, 37);
        assert.equal(
          ctx.calls.filter((c) => c.op === "fillText").length,
          0,
          "canvas renders tutorial/sector labels",
        );
        assert.equal(guide(ctx).length, 1);
        const segment = guide(ctx)[0].paths.filter((p) =>
          ["moveTo", "lineTo"].includes(p.op),
        );
        assert.ok(
          Math.abs(
            Math.hypot(
              segment[1].args[0] - segment[0].args[0],
              segment[1].args[1] - segment[0].args[1],
            ) - 60,
          ) < 1e-9,
        );
        assert.deepEqual(guide(ctx)[0].dash, [3, 7]);
        const reads = ctx.transformReads;
        presentation.render(ctx, state, viewport);
        assert.equal(
          ctx.transformReads,
          reads,
          "unchanged viewport reads transform per frame",
        );
        for (let aim = 0; aim < 89; aim++) {
          const direction = v1.orbDirection(aim),
            dy = Math.max(
              40,
              Math.min(150, 170 * Math.abs(direction.y / direction.x || 1)),
            ),
            world = { x: 195 - (direction.x / direction.y) * dy, y: 574 - dy },
            projected = camera.projectOrbPoint(view, world),
            inverse = camera.unprojectOrbPoint(view, projected);
          assert.ok(
            Math.abs(inverse.x - world.x) < 1e-9 &&
              Math.abs(inverse.y - world.y) < 1e-9,
          );
          for (const phase of ["down", "move"])
            assert.equal(
              presentation.pointAction(projected, phase, state),
              protocol.orbAimAction(aim),
            );
          assert.equal(
            presentation.pointAction(projected, "up", state),
            "SHOOT",
          );
          assert.equal(
            presentation.pointAction(projected, "down", {
              ...state,
              settleRemaining: 1,
            }),
            null,
          );
          assert.equal(
            presentation.pointAction(projected, "up", {
              ...state,
              settleRemaining: 1,
            }),
            "SHOOT",
          );
          inputCases++;
        }
        assert.equal(
          presentation.pointAction({ x: -1000, y: 2000 }, "up", state),
          "SHOOT",
          "capture release outside field no longer launches",
        );
        const shot = {
          xMilli: 195000,
          yMilli: 420000,
          vxMilli: 0,
          vyMilli: -440000,
          xRemainder: 0,
          yRemainder: 0,
          color: state.currentColor,
        };
        const moving = recorder(
          cssWidth * effectiveDpr,
          cssHeight * effectiveDpr,
          cssScale * effectiveDpr,
        );
        presentation.render(moving, { ...state, shot }, viewport);
        assert.equal(guide(moving).length, 0);
        assert.ok(
          !mainOrbs(moving).some((c) =>
            c.paths.some(
              (p) => p.op === "arc" && p.args[0] === 195 && p.args[1] === 574,
            ),
          ),
          "launcher duplicates airborne projectile",
        );
      }
    }
    // One adapter survives orientation changes: inverse follows the last drawn camera.
    const adapter = ui.createPresentation();
    for (const [w, h] of [
      [390, 680],
      [844, 324],
      [320, 636],
    ]) {
      const viewport = { width: Math.max(390, (w / h) * 620), height: 620 },
        scale = Math.min(w / viewport.width, h / 620),
        ctx = recorder(w, h, scale),
        view = camera.getOrbCamera(viewport, scale);
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: { devicePixelRatio: 1 },
      });
      adapter.render(ctx, state, viewport);
      const p = camera.projectOrbPoint(view, { x: 195, y: 474 });
      assert.equal(adapter.pointAction(p, "down", state), "AIM_044");
    }
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else delete globalThis.window;
  }
  const adapter = ui.createPresentation(),
    single = state.bubbles[0],
    inserted = {
      ...state,
      bubbles: [{ ...single, row: single.row + 1 }],
      gridParity: 1,
      tick: 100,
      lastInsertionTick: 100,
      settleRemaining: 18,
    },
    oldPoint = v2.orbCenterV2(state, single.row, single.col),
    actualPoint = v2.orbCenterV2(inserted, single.row + 1, single.col);
  assert.equal(oldPoint.xMilli, actualPoint.xMilli);
  for (const age of [0, 6, 12, 18]) {
    const s = {
        ...inserted,
        tick: 100 + age,
        settleRemaining: Math.max(0, 18 - age),
      },
      ctx = recorder();
    adapter.render(ctx, s, { width: 390, height: 620 });
    const b = mainOrbs(ctx).find((c) =>
      c.paths.some(
        (p) => p.op === "arc" && p.args[0] === oldPoint.xMilli / 1000,
      ),
    );
    const center = b.paths.find((p) => p.op === "arc").args;
    assert.equal(center[0], oldPoint.xMilli / 1000);
    assert.equal(
      center[1],
      actualPoint.yMilli / 1000 - (age < 12 ? 31 * (1 - age / 12) : 0),
    );
  }
  const captured = { ...single, xMilli: 80000, yMilli: 130000 },
    burstState = {
      ...state,
      bubbles: [],
      gridParity: 1,
      tick: 10,
      burst: { tick: 0, bubbles: [captured] },
    };
  const burstCtx = recorder();
  adapter.render(burstCtx, burstState, { width: 390, height: 620 });
  assert.ok(
    burstCtx.calls.some(
      (c) =>
        c.op === "arc" &&
        c.args[0] === 80 &&
        c.args[1] === 130 &&
        c.args[2] > 18,
    ),
    "burst relocated after parity change",
  );
  const overflow = {
    ...state,
    status: "failed",
    failure: "BOARD_OVERFLOW",
    tick: 200,
  };
  const insertedOverflow = {
    ...overflow,
    gridParity: 0,
    lastInsertionTick: 200,
    settleRemaining: 18,
    bubbles: [{ ...single, row: 15, col: 0 }],
  };
  const terminalCtx = recorder(),
    terminalSnapshot = JSON.stringify(insertedOverflow);
  adapter.render(terminalCtx, insertedOverflow, { width: 390, height: 620 });
  assert.equal(JSON.stringify(insertedOverflow), terminalSnapshot);
  assert.ok(
    mainOrbs(terminalCtx).some((c) =>
      c.paths.some(
        (p) => p.op === "arc" && p.args[0] === 44 && p.args[1] === 507,
      ),
    ),
    "fatal insertion hid the real overflow collider above the danger line",
  );
  assert.ok(
    !mainOrbs(terminalCtx).some((c) =>
      c.paths.some((p) => p.op === "arc" && p.args[1] === 476),
    ),
    "terminal freeze kept an uncompleted row animation",
  );
  for (const elapsed of [0, 150, 300]) {
    const before = JSON.stringify(overflow),
      ctx = recorder();
    adapter.failureFinale.render(ctx, overflow, elapsed);
    assert.equal(JSON.stringify(overflow), before);
    assert.equal(ctx.stack.length, 0);
  }
  assert.equal(adapter.failureFinale.durationMs, 300);
  assert.equal(ui.hudLabel({ ...state, height: 27 }), "AVANCE 27/108");
  assert.equal(ui.feedbackScore(state), 0);
  assert.ok(ui.feedbackScore({ ...state, height: 3 }) > 0);
  assert.ok(ui.feedbackScore({ ...state, pressureRows: 1 }) < 0);
  const surface = ui.default({
    active: true,
    stake: 0,
    targetScore: 108,
    onFinish() {},
  }).props.children.props;
  assert.equal(surface.core, v2.ORB_BURST_CORE_V2);
  assert.equal(surface.hideHudScore, true);
  assert.equal(surface.instruction, "");
  assert.equal(surface.expandHorizontalViewport, true);
  assert.equal(
    surface.controls,
    undefined,
    "release launches without a separate button",
  );
  assert.equal(surface.inputTones.SHOOT, "tap");
  const source = fs.readFileSync(uiSource, "utf8");
  assert.ok(
    !/forecastOrb|state\.stage|lastStageTick|SECTOR|FALLOS ANTES/.test(source),
  );
  console.log(
    JSON.stringify({
      variant: "Orb V2 continuous presentation",
      inputCases,
      viewports: dimensions.length,
      dprCases: 3,
      guideLength: 60,
      forecastCalls: 0,
      fullFov: true,
      historicalBilliardsExact: true,
      rendererPure: true,
    }),
  );
  return { ui, v1, v2, shared, camera, compile, initial: state };
})();
