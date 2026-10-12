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
  const core = await load("lib/verified/shotGalleryCore.v2.js"),
    layout = await load("lib/galleryPresentation.js");
  const file = path.join(root, "components/games/ShotGallery.tsx"),
    swc = req("next/dist/build/swc");
  await swc.loadBindings();
  const compiled = await swc.transform(fs.readFileSync(file, "utf8"), {
    filename: file,
    jsc: {
      parser: { syntax: "typescript", tsx: true },
      target: "es2022",
      transform: { react: { runtime: "automatic" } },
    },
    module: { type: "commonjs" },
  });
  const deps = {
      react: {
        ...req("react"),
        useRef: (current) => ({ current }),
        useCallback: (f) => f,
      },
      "@/lib/verified/shotGalleryCore.v2": core,
      "@/lib/galleryPresentation": layout,
      "@/lib/spaceBackdrop": { drawSpaceBackdrop() {} },
      "@/lib/gameFeedback": { gameTone() {} },
      "./CoreCanvasGame": () => null,
    },
    exports = {};
  new Function("require", "exports", compiled.code)(
    (id) => deps[id] || req(id),
    exports,
  );
  const element = exports.default({
      active: false,
      stake: 0,
      seed: "preview",
      targetScore: 1e9,
      onFinish() {},
    }),
    render = element.props.children.props.render,
    pick = element.props.children.props.pointAction;
  let frames = 0;
  for (let seed = 0; seed < 16; seed++)
    for (const width of [390, 1100])
      for (let trial = 0; trial < 12; trial++)
        for (const phase of ["waiting", "ready", "feedback"]) {
          const s = core.SHOT_GALLERY_CORE_V2.create(`gallery2-render-${seed}`);
          s.trial = trial;
          s.phase = phase;
          if (phase === "feedback") {
            s.phaseTicks = 20;
            s.results = [
              {
                trial,
                kind: s.trials[trial].kind,
                type: "CORRECT",
                reactionTicks: 24,
                award: 840,
                pick: s.trials[trial].answer,
              },
            ];
          }
          const before = JSON.stringify(s),
            texts = [],
            surfaces = [],
            stack = [];
          const ctx = new Proxy(
            { fillStyle: "" },
            {
              get(o, k) {
                if (k in o) return o[k];
                return (...a) => {
                  if (k === "fillText") texts.push(String(a[0]));
                  if (k === "roundRect" && a[2] >= 200 && a[3] >= 140)
                    surfaces.push(a);
                  if (k === "save") stack.push(1);
                  if (k === "restore") assert.ok(stack.pop());
                };
              },
            },
          );
          render(ctx, s, { width, height: 520 });
          assert.equal(JSON.stringify(s), before);
          assert.equal(stack.length, 0);
          assert.equal(
            surfaces.length,
            1,
            "one shared gallery surface, no card panels",
          );
          assert.ok(
            !texts.some((t) =>
              /ESPERA|AHORA|PRUEBA|Cada prueba|OTRA OPCIÓN/.test(t),
            ),
          );
          const slots = layout.gallerySlots(width);
          assert.equal(slots.length, 6);
          for (let i = 0; i < 6; i++) {
            const p = slots[i];
            assert.equal(
              pick({ x: p.x + p.width / 2, y: p.y + p.height / 2 }, "down"),
              `PICK_${i}`,
            );
            assert.equal(pick({ x: p.x, y: p.y }, "move"), null);
          }
          frames++;
        }
  console.log(
    `Gallery actual renderer: ${frames} read-only frames, single surface, six direct targets, responsive picks, no filler/tutorial text`,
  );
})().catch((e) => {
  console.error(e);
  throw e;
});
