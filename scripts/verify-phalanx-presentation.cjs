const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { register, createRequire } = require("node:module"),
  { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, ".."),
  req = createRequire(path.join(root, "package.json"));
register(pathToFileURL(path.join(root, "scripts/determinism-loader.mjs")));
module.exports = (async () => {
  const { PHALANX_CORE: core } = await import(
      pathToFileURL(
        path.join(root, ".det-test/lib/verified/starPhalanxCore.v1.js"),
      )
    ),
    { choosePhalanxAction } = await import(
      pathToFileURL(
        path.join(root, ".det-test/scripts/phalanx-play-fixture.js"),
      )
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
      ),
      exports = {};
    new Function("require", "exports", compiled.code)(
      (id) => deps[id] || req(id),
      exports,
    );
    return exports;
  }
  const presentation = await load(
    path.join(root, "lib/phalanxPresentation.ts"),
  );
  const ui = await load(
    path.join(root, "components/games/StarPhalanxVerified.tsx"),
    {
      "@/lib/verified/starPhalanxCore.v2": await import(
        pathToFileURL(
          path.join(root, ".det-test/lib/verified/starPhalanxCore.v2.js"),
        )
      ),
      "@/lib/spaceBackdrop": { drawSpaceBackdrop() {} },
      "@/lib/phalanxPresentation": presentation,
      "./CoreCanvasGame": () => null,
    },
    "\nexport {render};",
  );
  const cores = [
    core,
    (
      await import(
        pathToFileURL(
          path.join(root, ".det-test/lib/verified/starPhalanxCore.v2.js"),
        )
      )
    ).PHALANX_CORE,
  ];
  let frames = 0;
  for (const core of cores)
    for (let seed = 0; seed < 8; seed++) {
      const state = core.create(`phalanx-art-${seed}`);
      while (state.status === "running" && state.tick < core.maxFinalTick) {
        const action = choosePhalanxAction(state);
        if (action && core.canApply(state, action)) core.apply(state, action);
        core.step(state);
        if (state.tick % 37 !== 0) continue;
        const before = JSON.stringify(state),
          bodies = [],
          stack = [];
        const ctx = {
          globalAlpha: 1,
          fillStyle: "",
          strokeStyle: "",
          save() {
            stack.push([this.fillStyle, this.strokeStyle, this.globalAlpha]);
          },
          restore() {
            [this.fillStyle, this.strokeStyle, this.globalAlpha] = stack.pop();
          },
          fillRect(x, y, w, h) {
            if (
              (this.fillStyle === "#ff788f" || this.fillStyle === "#bdf7ff") &&
              w === 4 &&
              h === 16
            )
              bodies.push({
                x: x + 2,
                y: y + 8,
                enemy: this.fillStyle === "#ff788f",
              });
          },
          beginPath() {},
          moveTo() {},
          lineTo() {},
          closePath() {},
          fill() {},
          stroke() {},
          arc() {},
          translate() {},
          setLineDash() {},
          fillText() {},
        };
        ui.render(ctx, state);
        assert.deepEqual(
          bodies,
          state.shots.map((b) => ({
            x: b.x / 1000,
            y: b.y / 1000,
            enemy: b.enemy,
          })),
        );
        assert.equal(
          JSON.stringify(state),
          before,
          "art cannot mutate replay state",
        );
        assert.equal(stack.length, 0);
        assert.equal(ctx.globalAlpha, 1);
        frames++;
      }
    }
  assert.ok(frames > 500);
  console.log(
    `Phalanx presentation: ${frames} actual renderer frames, projectile centers and identity exact, read-only simulation and canvas state balanced`,
  );
})();
