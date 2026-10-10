// Actual V4 gate renderer across full physical canvas, including letterboxing.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { register, createRequire } = require("node:module"),
  { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, ".."),
  req = createRequire(path.join(root, "package.json"));
register(pathToFileURL(path.join(root, "scripts/determinism-loader.mjs")));
module.exports = (async () => {
  const coreModule = await import(
    pathToFileURL(path.join(root, ".det-test/lib/verified/jetStreamCore.v4.js"))
  );
  const swc = req("next/dist/build/swc");
  await swc.loadBindings();
  async function load(file, deps = {}, append = "") {
    const compiled = await swc.transform(
      fs.readFileSync(file, "utf8") + append,
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
    const exports = {};
    new Function("require", "exports", compiled.code)(
      (id) => deps[id] || req(id),
      exports,
    );
    return exports;
  }
  const canvas = await load(path.join(root, "lib/gameCanvas.ts"), {
    "./spaceBackdrop": { prepareSpaceCanvasBackdrop() {} },
  });
  const ui = await load(
    path.join(root, "components/games/JetStreamV3.tsx"),
    {
      "@/lib/verified/jetStreamCore.v4": coreModule,
      "./jet-stream/presentation": { drawJetBackground() {}, drawJetShip() {} },
      "./CoreCanvasGame": () => null,
    },
    "\nexport {render as renderUnderTest};",
  );
  const runtime = await import(
    pathToFileURL(path.join(root, ".det-test/lib/verified/coreRuntime.v1.js"))
  );
  const player = await import(
    pathToFileURL(path.join(root, ".det-test/scripts/jet-v4-play-fixture.js"))
  );
  const natural = coreModule.JET_STREAM_CORE_V4.create("jet-visible-gates");
  const opening = structuredClone(natural.gates[0]);
  while (
    !natural.gates.some((g) => g.windows.length === 2) &&
    natural.status === "running"
  ) {
    if (player.shouldFlapJetV4(natural))
      runtime.applyCoreInput(
        coreModule.JET_STREAM_CORE_V4,
        natural,
        "FLAP",
        1e6,
      );
    runtime.stepCore(coreModule.JET_STREAM_CORE_V4, natural, 1e6);
  }
  const dual = structuredClone(
    natural.gates.find((g) => g.windows.length === 2),
  );
  assert.ok(dual, "naturally generated double window");
  const viewports = [
    { width: 390, height: 783 },
    { width: 320, height: 659 },
    { width: 430, height: 871 },
    { width: 520, height: 325 },
    { width: 844, height: 390 },
    { width: 390, height: 620 },
  ];
  let cases = 0,
    doubleCases = 0;
  for (const viewport of viewports)
    for (const dpr of [1, 1.5, 2]) {
      global.window = {
        devicePixelRatio: dpr,
        innerWidth: viewport.width,
        innerHeight: viewport.height,
      };
      const actualCanvas = {
        width: 0,
        height: 0,
        getBoundingClientRect: () => ({ ...viewport, left: 0, top: 0 }),
      };
      const metrics = canvas.configureLogicalCanvas(actualCanvas, 390, 620);
      const state = coreModule.JET_STREAM_CORE_V4.create("jet-visible-gates");
      state.gates = [structuredClone(opening), structuredClone(dual)];
      for (const gate of state.gates) {
        assert.ok(gate);
        state.scrollMilli = gate.worldXMilli - 350000;
        const before = JSON.stringify(state),
          bodies = [],
          stack = [];
        let matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
        const ctx = new Proxy(
          { canvas: actualCanvas, fillStyle: "" },
          {
            get(obj, key) {
              if (key in obj) return obj[key];
              if (key === "getTransform") return () => ({ ...matrix });
              if (key === "createLinearGradient")
                return () => ({ gateGradient: true, addColorStop() {} });
              return (...args) => {
                if (key === "setTransform") {
                  const [a, b, c, d, e, f] = args;
                  matrix = { a, b, c, d, e, f };
                }
                if (key === "save") stack.push({ ...matrix });
                if (key === "restore") matrix = stack.pop();
                if (
                  key === "fillRect" &&
                  obj.fillStyle?.gateGradient &&
                  args[2] === 30 &&
                  args[3] > 3
                )
                  bodies.push({
                    x: args[0],
                    top: args[1],
                    bottom: args[1] + args[3],
                    screenTop: matrix.f + matrix.d * args[1],
                    screenBottom: matrix.f + matrix.d * (args[1] + args[3]),
                  });
              };
            },
          },
        );
        canvas.beginLogicalCanvasFrame(ctx, actualCanvas, metrics);
        ui.renderUnderTest(ctx, state);
        assert.equal(
          JSON.stringify(state),
          before,
          "presentation never changes windows/damage/physics",
        );
        assert.equal(stack.length, 0);
        const chosen = bodies
          .filter((b) => b.x === 350)
          .sort((a, b) => a.top - b.top);
        assert.equal(chosen.length, gate.windows.length + 1);
        assert.ok(
          Math.abs(chosen[0].screenTop) < 1e-6,
          "gate meets canvas top",
        );
        assert.ok(
          Math.abs(chosen.at(-1).screenBottom - actualCanvas.height) < 1e-6,
          "gate meets canvas bottom",
        );
        for (let index = 0; index < gate.windows.length; index++) {
          const w = gate.windows[index];
          assert.ok(
            Math.abs(
              chosen[index].bottom - (w.centerYMilli - w.gapMilli / 2) / 1000,
            ) < 1e-9,
          );
          assert.equal(
            chosen[index + 1].top,
            (w.centerYMilli + w.gapMilli / 2) / 1000,
          );
        }
        for (const body of chosen) assert.ok(body.bottom > body.top);
        if (gate.windows.length === 2) doubleCases++;
        cases++;
      }
    }
  delete global.window;
  console.log(
    JSON.stringify({
      variant: "Jet V4 edge presentation",
      cases,
      doubleCases,
      viewports: 6,
      dprCases: 3,
      fullCanvas: true,
      windowsUnchanged: true,
      rendererPure: true,
    }),
  );
})().catch((error) => {
  console.error(error);
  throw error;
});
