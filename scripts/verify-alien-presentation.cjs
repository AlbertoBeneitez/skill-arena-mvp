const assert = require("node:assert/strict");
const path = require("node:path");
const { register } = require("node:module");
const { pathToFileURL } = require("node:url");
const project = process.env.ALIEN_QA_PROJECT || path.resolve(__dirname, "..");
const { alienCamera, alienCanvasViewport, alienCssScale } = require(
  process.env.ALIEN_CAMERA_MODULE ||
    path.join(project, ".det-test/components/games/alien-dash/presentation.js"),
);
register(pathToFileURL(path.join(project, "scripts/determinism-loader.mjs")));
module.exports = (async () => {
  const { ALIEN_DASH_CORE_V3: core } = await import(
    pathToFileURL(
      path.join(project, ".det-test/lib/verified/alienDashCore.v3.js"),
    )
  );
  const { applyCoreInput, stepCore } = await import(
    pathToFileURL(
      path.join(project, ".det-test/lib/verified/coreRuntime.v1.js"),
    )
  );
  // Exercise an actual inherited jump from V3's highest traversable roof. The
  // visual helmet extends 54px above the feet; clip must contain that maximum.
  const state = core.create("presentation-height-proof");
  const roof = Math.max(
    ...state.actors.filter((a) => a.kind === "platform").map((a) => a.height),
  );
  assert.equal(roof, 44000);
  state.actors = [
    {
      id: 0,
      kind: "platform",
      x: 0,
      width: 2000000,
      height: roof,
      bottom: 508000,
      passed: false,
      collided: false,
      chargeTick: null,
      fired: false,
    },
  ];
  state.collectibles = [];
  state.feet = 508000 - roof;
  state.grounded = true;
  state.supportId = 0;
  let minimumFeet = state.feet;
  assert.equal(applyCoreInput(core, state, "JUMP", 1e9), true);
  for (let tick = 0; tick < 150; tick++) {
    stepCore(core, state, 1e9);
    minimumFeet = Math.min(minimumFeet, state.feet);
    if (state.grounded) break;
  }
  const visualTop = minimumFeet / 1000 - 54;
  assert.ok(visualTop >= 300);
  const critical = [
    [0, visualTop],
    [390, 508], // Entire X field and player/ground envelope.
    [0, 322],
    [390, 360], // Enemy warning bar/body.
    [0, 352],
    [390, 530], // Live bolt envelope before it is spent.
  ];
  const reports = [];
  for (const [cssWidth, cssHeight] of [
    [390, 776],
    [500, 680],
    [520, 324],
    [520, 222],
    [400, 240],
    [1024, 400],
  ]) {
    const logicalWidth = Math.max(390, (cssWidth / cssHeight) * 620);
    const cssScale = Math.min(cssWidth / logicalWidth, cssHeight / 620);
    const viewport = { width: logicalWidth, height: 620 };
    const frame = alienCamera(viewport, cssScale);
    const bounds = {
      left: frame.left * cssScale,
      right: (frame.left + 390 * frame.scale) * cssScale,
      top: frame.top * cssScale,
      bottom: (frame.top + (frame.maxY - frame.minY) * frame.scale) * cssScale,
    };
    if (frame.horizontal) {
      assert.ok(bounds.left >= 12 - 1e-8);
      assert.ok(
        bounds.right <= cssWidth - 120 + 1e-8,
        "Hazards must remain clear of the right touch controls",
      );
      assert.ok(bounds.top >= 40 - 1e-8, "Keep helmet/warnings below the HUD");
      assert.ok(bounds.bottom <= cssHeight - 8 + 1e-8);
      const previousScale = Math.min(cssWidth / 390, cssHeight / 620);
      assert.ok(
        frame.scale * cssScale > previousScale * 1.5,
        "Improve practical sprite readability, not just fill a wider background",
      );
      for (const [x, y] of critical) {
        const px = (frame.left + x * frame.scale) * cssScale;
        const py = (frame.top + (y - frame.minY) * frame.scale) * cssScale;
        assert.ok(px >= bounds.left - 1e-8 && px <= bounds.right + 1e-8);
        assert.ok(py >= bounds.top - 1e-8 && py <= bounds.bottom + 1e-8);
      }
    } else {
      assert.deepEqual(frame, {
        scale: 1,
        left: (viewport.width - 390) / 2,
        top: 0,
        minY: 0,
        maxY: 620,
        horizontal: false,
      });
    }
    // Render and finale recover the same common frame, including containment
    // offsets on portrait and the shared DPR cap.
    const baseScale = Math.min(cssWidth / logicalWidth, cssHeight / 620);
    const recovered = alienCanvasViewport({
      canvas: { width: cssWidth * 2, height: cssHeight * 2 },
      getTransform: () => ({
        a: baseScale * 2,
        d: baseScale * 2,
        e: cssWidth - logicalWidth * baseScale,
        f: cssHeight - 620 * baseScale,
      }),
    });
    assert.ok(Math.abs(recovered.width - viewport.width) < 1e-8);
    assert.ok(Math.abs(recovered.height - viewport.height) < 1e-8);
    reports.push({
      cssWidth,
      cssHeight,
      worldWidth: bounds.right - bounds.left,
      playerHeight: 46 * frame.scale * cssScale,
      frame,
    });
  }
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    for (const dpr of [0.8, 1, 2, 3]) {
      Object.defineProperty(globalThis, "window", { configurable: true, value: { devicePixelRatio: dpr } });
      const capped = Math.min(2, Math.max(1, dpr));
      assert.equal(alienCssScale({ getTransform: () => ({ a: capped * 0.5 }) }), 0.5,
        "Camera margins must use the same DPR bounds as the common canvas driver");
    }
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else delete globalThis.window;
  }
  console.log(JSON.stringify({ maximumJumpVisualTop: visualTop, reports }));
})();
