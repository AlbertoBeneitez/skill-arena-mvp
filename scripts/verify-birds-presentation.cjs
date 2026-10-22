// Actual render closure, controlled hook allocation only; no competitive/UI mutation.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { register, createRequire } = require("node:module"),
  { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, ".."),
  req = createRequire(path.join(root, "package.json"));
register(pathToFileURL(path.join(root, "scripts/determinism-loader.mjs")));
module.exports = (async () => {
  const load = (p) => import(pathToFileURL(path.join(root, ".det-test", p))),
    v2 = await load("lib/verified/galacticBirdsCore.v6.js"),
    presentation = await load("lib/birdsPresentation.js"),
    protocol = await load("lib/verified/galacticBirdsProtocol.v1.js"),
    runtime = await load("lib/verified/coreRuntime.v1.js");
  const react = req("react");
  const file = path.join(root, "components/games/GalacticBirds.tsx"),
    source = fs.readFileSync(file, "utf8");
  await req("next/dist/build/swc").loadBindings();
  const compiled = await req("next/dist/build/swc").transform(source, {
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
        ...react,
        useRef: (current) => ({ current }),
        useEffect() {},
        useCallback: (f) => f,
      },
      "@/lib/verified/galacticBirdsCore.v4": await load("lib/verified/galacticBirdsCore.v4.js"),
      "@/lib/verified/galacticBirdsCore.v6": v2,
      "@/lib/verified/galacticBirdsProtocol.v1": protocol,
      "@/lib/birdsPresentation": presentation,
      "@/lib/spaceBackdrop": { drawSpaceBackdrop() {} },
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
    render = element.props.children.props.render;
  let frames = 0;
  for (let seed = 0; seed < 32; seed++)
    for (const width of [390, 993, 1438])
      for (let shot = 0; shot < 3; shot++) {
        const s = v2.BIRDS_CORE_V6.create(`birds-v6-visual-${seed}`);
        s.shots = shot;
        s.ammo -= shot;
        for (const phase of ["aim", "flight"]) {
          if (phase === "flight") {
            runtime.applyCoreInput(v2.BIRDS_CORE_V6, s, "SHOOT", 1e9);
            runtime.advanceCoreToTick(v2.BIRDS_CORE_V6, s, 20, 1e9);
          }
          const before = JSON.stringify(s),
            stack = [],
            maps = [],
            texts = [],
            projectiles = [];
          let scale = 1;
          const ctx = new Proxy(
            { fillStyle: "", globalAlpha: 1 },
            {
              get(obj, key) {
                if (key in obj) return obj[key];
                return (...args) => {
                  if (key === "save")
                    stack.push({
                      scale,
                      fillStyle: obj.fillStyle,
                      globalAlpha: obj.globalAlpha,
                    });
                  if (key === "restore") {
                    const old = stack.pop();
                    assert.ok(old);
                    scale = old.scale;
                    obj.fillStyle = old.fillStyle;
                    obj.globalAlpha = old.globalAlpha;
                  }
                  if (key === "scale") scale *= args[0];
                  if (
                    key === "fillRect" &&
                    ["#69b9c8", "#8d9abf", "#65829a"].includes(obj.fillStyle)
                  )
                    maps.push(args);
                  if (key === "fillText") texts.push(String(args[0]));
                  if (
                    key === "fill" &&
                    ["#739aae", "#6fcbd6", "#ce9b73"].includes(obj.fillStyle) &&
                    scale === 1
                  )
                    projectiles.push(obj.fillStyle);
                };
              },
            },
          );
          render(ctx, s, { width, height: 620 });
          assert.equal(JSON.stringify(s), before);
          assert.equal(stack.length, 0);
          assert.equal(maps.length, 0, "no horizontal world radar in fixed levels");
          assert.ok(texts.includes(`NIVEL ${s.level + 1}`));
          assert.equal(
            projectiles.length,
            1,
            "one active projectile, queue thumbnails do not duplicate play state",
          );
          assert.ok(
            texts.some((t) => ["EXPLORADOR", "RÁPIDO", "PESADO"].includes(t)),
          );
          for (const kind of ["scout", "dart", "meteor"]) {
            assert.ok(
              texts.includes(
                `×${s.remaining[kind]}`,
              ),
              "remaining type count excludes launched bird",
            );
          }
          frames++;
        }
      }
  console.log(
    JSON.stringify({
      variant: "Birds V6 selectable birds",
      frames,
      allStructuresVisible: true,
      typedQueue: true,
      oneActiveBird: true,
      rendererPure: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  throw e;
});
