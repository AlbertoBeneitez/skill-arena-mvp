// Shot Gallery V8 renderer: pure, finite, and its tap mapping agrees with the core.
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
  const core = await load("lib/verified/shotGalleryCore.v8.js");
  const file = path.join(root, "components/games/ShotGallery.tsx"),
    swc = req("next/dist/build/swc");
  await swc.loadBindings();
  const compiled = await swc.transform(fs.readFileSync(file, "utf8"), {
    filename: file,
    jsc: { parser: { syntax: "typescript", tsx: true }, target: "es2022", transform: { react: { runtime: "automatic" } } },
    module: { type: "commonjs" },
  });
  const deps = {
      react: { ...req("react"), useCallback: (f) => f },
      "@/lib/verified/shotGalleryCore.v8": core,
      "@/lib/spaceBackdrop": { drawSpaceBackdrop() {} },
      "@/lib/i18n": require("./i18n-test-stub.cjs"),
      "@/lib/gameFeedback": { gameTone() {} },
      "./CoreCanvasGame": () => null,
    },
    exports = {};
  new Function("require", "exports", compiled.code)((id) => deps[id] || req(id), exports);
  global.localStorage = { getItem: () => null, setItem() {} };
  const element = exports.default({ active: false, stake: 0, seed: "preview", targetScore: 1e9, onFinish() {} }),
    { render, pointAction: pick } = element.props.children.props;
  let frames = 0;
  for (let seed = 0; seed < 12; seed++)
    for (let trial = 0; trial < 12; trial++)
      for (const phase of ["waiting", "ready", "feedback"]) {
        const s = core.SHOT_GALLERY_CORE_V8.create(`gallery8-render-${seed}`);
        s.trial = trial;
        s.phase = phase;
        s.readyTick = 0;
        s.tick = 30;
        if (phase !== "waiting") {
          s.hits = [s.trials[trial].answers[0]];
          s.tapTicks = [40];
        }
        if (phase === "feedback")
          s.results = [{ trial, type: ["CORRECT", "FALSE_START", "TIMEOUT"][trial % 3], taps: [40], wrongs: 0, award: 0 }];
        const before = JSON.stringify(s),
          stack = [];
        let finite = true;
        const ctx = new Proxy(
          { fillStyle: "" },
          {
            get(o, k) {
              if (k in o) return o[k];
              if (k === "createRadialGradient" || k === "createLinearGradient") return () => ({ addColorStop() {} });
              return (...a) => {
                if (k === "save") stack.push(1);
                if (k === "restore") stack.pop();
                if (a.some((v) => typeof v === "number" && !Number.isFinite(v))) finite = false;
              };
            },
            set(o, k, v) {
              o[k] = v;
              return true;
            },
          },
        );
        render(ctx, s, { width: 390, height: 620 });
        assert.equal(JSON.stringify(s), before, "renderer must not mutate state");
        assert.equal(stack.length, 0);
        assert.ok(finite, "finite coordinates");
        frames++;
      }
  // Taps: before green any tap is a false start; afterwards the nearest unhit target wins.
  const s = core.SHOT_GALLERY_CORE_V8.create("gallery8-pick");
  assert.equal(pick({ x: 5, y: 5 }, "down", s), "PICK_0");
  s.phase = "ready";
  s.readyTick = s.tick;
  const t = core.galleryTargetPosV8(s.trials[0].targets[3], 0);
  assert.equal(pick({ x: t.x + 4, y: t.y - 3 }, "down", s), "PICK_3");
  assert.equal(pick({ x: 2, y: 2 }, "down", s), null);
  assert.equal(pick({ x: t.x, y: t.y }, "move", s), null);
  s.hits = [3];
  assert.notEqual(pick({ x: t.x, y: t.y }, "down", s), "PICK_3");
  console.log(JSON.stringify({ variant: "Shot Gallery V8", frames, rendererPure: true }));
})().catch((e) => {
  console.error(e);
  throw e;
});
