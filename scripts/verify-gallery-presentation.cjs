// Shot Gallery V14 renderer: pure, finite, and its tap mapping agrees with the core.
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
  const core = await load("lib/verified/shotGalleryCore.v14.js");
  const core13 = await load("lib/verified/shotGalleryCore.v13.js");
  const file = path.join(root, "components/games/ShotGallery.tsx"),
    swc = req("next/dist/build/swc");
  await swc.loadBindings();
  const compiled = await swc.transform(fs.readFileSync(file, "utf8"), {
    filename: file,
    jsc: { parser: { syntax: "typescript", tsx: true }, target: "es2022", transform: { react: { runtime: "automatic" } } },
    module: { type: "commonjs" },
  });
  // The jungle/being art module, compiled the same way (it only needs the core).
  const artFile = path.join(root, "components/games/galleryJungleArt.ts");
  const artCode = (await swc.transform(fs.readFileSync(artFile, "utf8"), { filename: artFile, jsc: { parser: { syntax: "typescript" }, target: "es2022" }, module: { type: "commonjs" } })).code;
  const art = {};
  new Function("require", "exports", artCode)((id) => (id === "@/lib/verified/shotGalleryCore.v13" ? core13 : req(id)), art);
  const deps = {
      react: { ...req("react"), useCallback: (f) => f },
      "@/lib/verified/shotGalleryCore.v14": core,
      "./galleryJungleArt": art,
      "react-dom": { preload() {} },
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
        const s = core.SHOT_GALLERY_CORE_V14.create(`gallery14-render-${seed}`);
        s.live = s.trials[trial].targets.map((b, i) => ({ ...b, target: s.trials[trial].answers.includes(i), born: -1, gone: -1 }));
        s.trial = trial;
        s.phase = phase;
        s.readyTick = 0;
        s.tick = 30;
        if (phase !== "waiting") {
          s.hits = [s.trials[trial].answers[0]];
          s.tapTicks = [40];
        }
        if (phase === "feedback")
          s.results = [{ trial, type: ["CORRECT", "TIMEOUT"][trial % 2], taps: [40], wrongs: 0, falseStarts: 0, spawned: 0, addedMs: 333 }];
        if (phase === "ready" && trial % 2) {
          // a wrong shot: the decoy sinks back and a new target comes out elsewhere
          const k = s.live.findIndex((b) => !b.target);
          s.lastPick = k; s.lastTapTick = 28; s.lastAddedMs = 400; s.live[k].gone = 28;
          const free = core.GALLERY_V14.spots.findIndex((_, n) => !s.live.some((b) => b.spot === n));
          s.live.push({ ...core.GALLERY_V14.spots[free], spot: free, aura: 0, form: 0, lookalike: false, target: true, born: 28, gone: -1 });
        }
        const before = JSON.stringify(s),
          stack = [];
        let finite = true;
        const ctx = new Proxy(
          { fillStyle: "" },
          {
            get(o, k) {
              if (k in o) return o[k];
              if (k === "createRadialGradient" || k === "createLinearGradient") return () => ({ addColorStop() {} });
              if (k === "measureText") return () => ({ width: 80 });
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
  // Taps: before they pop out any tap is a false start; afterwards the creature under the finger wins.
  const s = core.SHOT_GALLERY_CORE_V14.create("gallery14-pick");
  assert.equal(pick({ x: 195, y: 400 }, "down", s), "PICK_0");
  assert.equal(pick({ x: 195, y: 60 }, "down", s), null, "the briefing panel is not a target");
  s.phase = "ready";
  s.readyTick = s.tick;
  s.tick += 20;
  let checked = 0;
  s.live.forEach((t) => {
    const sc = t.scaleMilli / 1000;
    assert.equal(pick({ x: t.x + 3, y: t.y - 30 * sc }, "down", s), `PICK_${t.spot}`, `being at hiding place ${t.spot} under the finger`);
    checked++;
  });
  assert.equal(pick({ x: 195, y: 160 }, "move", s), null);
  const t3 = s.live[3];
  s.hits = [3];
  assert.notEqual(pick({ x: t3.x, y: t3.y - 30 }, "down", s), `PICK_${t3.spot}`, "a being already down is not hit twice");
  const t1 = s.live[1];
  s.live[1] = { ...t1, gone: 0 };
  assert.notEqual(pick({ x: t1.x, y: t1.y - 30 }, "down", s), `PICK_${t1.spot}`, "a being sent back into hiding cannot be shot");
  // Hidden creatures (still waiting below cover) are never hit.
  const w = core.SHOT_GALLERY_CORE_V14.create("gallery14-pick-hidden");
  w.phase = "ready"; w.readyTick = w.tick; // rise 0 at age 0
  const t0 = w.live[0];
  assert.equal(pick({ x: t0.x, y: t0.y - 14 }, "down", w), null);
  console.log(JSON.stringify({ variant: "Shot Gallery V14 jungle", frames, pickedCreatures: checked, multiTouch: element.props.children.props.multiTouch === true, rendererPure: true }));
})().catch((e) => {
  console.error(e);
  throw e;
});
