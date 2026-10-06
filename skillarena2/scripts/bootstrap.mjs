import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const vendorRoot = path.join(root, "vendor");
const publicRoot = path.join(root, "public");
const lock = JSON.parse(await fs.readFile(path.join(root, "vendor-lock.json"), "utf8"));
const includeReferences = process.argv.includes("--include-references");

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed in ${cwd}`);
  }
}

async function readMarker(dest) {
  try {
    return (await fs.readFile(path.join(dest, ".skillarena2-ref"), "utf8")).trim();
  } catch {
    return null;
  }
}

async function checkout(upstream) {
  const dest = path.join(vendorRoot, upstream.id);
  if ((await readMarker(dest)) === upstream.commit) {
    console.log(`[reuse] ${upstream.id} @ ${upstream.commit.slice(0, 8)}`);
    return dest;
  }

  await fs.rm(dest, { recursive: true, force: true });
  await fs.mkdir(dest, { recursive: true });

  console.log(`[fetch] ${upstream.name} @ ${upstream.commit.slice(0, 8)}`);
  run("git", ["init"], dest);
  run("git", ["remote", "add", "origin", upstream.repo], dest);

  if (upstream.sparsePaths?.length) {
    run("git", ["sparse-checkout", "init", "--no-cone"], dest);
    await fs.writeFile(
      path.join(dest, ".git", "info", "sparse-checkout"),
      upstream.sparsePaths.map((p) => `/${p}\n/${p}/\n`).join("")
    );
    run("git", ["-c", "protocol.version=2", "fetch", "--depth=1", "--filter=blob:none", "origin", upstream.commit], dest);
  } else {
    run("git", ["fetch", "--depth=1", "origin", upstream.commit], dest);
  }

  run("git", ["checkout", "--detach", "FETCH_HEAD"], dest);
  await fs.writeFile(path.join(dest, ".skillarena2-ref"), upstream.commit + "\n");
  return dest;
}

async function copyWithoutGit(src, dest) {
  await fs.rm(dest, { recursive: true, force: true });
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.cp(src, dest, {
    recursive: true,
    filter: (source) =>
      path.basename(source) !== ".git" &&
      path.basename(source) !== ".skillarena2-ref"
  });
}

async function patchTower(dest) {
  const indexPath = path.join(dest, "index.html");
  let html = await fs.readFile(indexPath, "utf8");

  html = html
    .replace("<title>Tower Building</title>", "<title>Skill Arena — Tower Lab</title>")
    .replace(
      /<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=[^"]+"><\/script><script>[\s\S]*?gtag\("config",[\s\S]*?<\/script>/,
      ""
    )
    .replace(
      '<div class="action-1"><img src="./assets/main-index-title.png" class="title swing"></div>',
      '<div class="action-1 sa2-title"><strong>SKILL ARENA</strong><span>TOWER LAB</span></div>'
    )
    .replace(
      '<div class="action-2"><img id="start" src="./assets/main-index-start.png" class="start"></div>',
      '<div class="action-2"><button id="start" class="sa2-start" type="button">JUGAR</button></div>'
    )
    .replace(
      '<img src="./assets/main-modal-over.png" class="over-img">',
      '<div class="sa2-over">FIN DE PARTIDA</div>'
    )
    .replace(
      '<img src="./assets/main-modal-again-b.png" class="over-button-b js-reload">',
      '<button class="sa2-retry js-reload" type="button">REPETIR</button>'
    )
    .replace(
      '<img src="./assets/main-modal-invite-b.png" class="over-button-b js-invite">',
      ""
    );

  const deterministicPrelude = `
<script>
(function () {
  var params = new URLSearchParams(window.location.search);
  var seedText = params.get("seed") || "skillarena2-demo";

  function hashString(value) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    return function () {
      var t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  var numericSeed = hashString(seedText);
  Math.random = mulberry32(numericSeed);

  window.__SKILLARENA2__ = {
    version: 1,
    seed: seedText,
    numericSeed: numericSeed,
    inputs: [],
    firstGameplayInputAt: null
  };

  function recordInput(kind, x, y) {
    if (!window.gameStart) return;
    var state = window.__SKILLARENA2__;
    var now = performance.now();
    if (state.firstGameplayInputAt === null) state.firstGameplayInputAt = now;
    state.inputs.push({
      kind: kind,
      t: Math.round((now - state.firstGameplayInputAt) * 1000) / 1000,
      x: Math.round((x || 0) * 1000) / 1000,
      y: Math.round((y || 0) * 1000) / 1000
    });
  }

  document.addEventListener("touchstart", function (event) {
    var touch = event.changedTouches && event.changedTouches[0];
    recordInput("touch", touch ? touch.clientX : 0, touch ? touch.clientY : 0);
  }, { passive: true, capture: true });

  document.addEventListener("mousedown", function (event) {
    recordInput("mouse", event.clientX, event.clientY);
  }, true);

  window.SkillArena2ExportReplay = function () {
    var state = window.__SKILLARENA2__;
    return {
      version: state.version,
      seed: state.seed,
      numericSeed: state.numericSeed,
      inputs: state.inputs.slice(),
      score: typeof window.score === "number" ? window.score : null,
      successCount: typeof window.successCount === "number" ? window.successCount : null
    };
  };
})();
</script>`;

  const mobileBrandCss = `
<style id="skillarena2-mobile-brand">
  html,body{overscroll-behavior:none;touch-action:manipulation}
  body:after{
    content:"SKILL ARENA · LAB";
    position:fixed;z-index:30;top:max(8px,env(safe-area-inset-top));left:50%;
    transform:translateX(-50%);pointer-events:none;
    padding:5px 9px;border-radius:999px;
    background:rgba(8,12,22,.74);color:#fff;
    font:700 10px/1 Arial,sans-serif;letter-spacing:.12em
  }
  .sa2-title{padding-top:18vh;color:#fff;text-shadow:0 3px 18px rgba(0,0,0,.25)}
  .sa2-title strong{display:block;font:900 .42rem/1 Arial,sans-serif;letter-spacing:-.04em}
  .sa2-title span{display:block;margin-top:.07rem;font:800 .17rem/1 Arial,sans-serif;letter-spacing:.16em}
  .sa2-start,.sa2-retry{
    appearance:none;border:0;border-radius:999px;background:#fff;color:#101522;
    font:900 .20rem/1 Arial,sans-serif;padding:.16rem .34rem;
    box-shadow:0 12px 30px rgba(0,0,0,.24);cursor:pointer
  }
  .sa2-start{width:64%;min-height:.52rem}
  .sa2-over{margin:.8rem auto 0;color:#ff735c;font:900 .28rem/1 Arial,sans-serif}
  .sa2-retry{display:block;margin:.18rem auto 0;font-size:.16rem}
</style>`;

  html = html.replace("</head>", mobileBrandCss + "</head>");
  html = html.replace('<script src="./dist/main.js"></script>', deterministicPrelude + '<script src="./dist/main.js"></script>');

  const bridge = `
<script>
(function () {
  window.setInterval(function () {
    try {
      var state = window.__SKILLARENA2__ || {};
      window.parent.postMessage({
        type: "skillarena2:telemetry",
        game: "tower",
        seed: state.seed || null,
        score: typeof score === "number" ? score : null,
        successCount: typeof successCount === "number" ? successCount : null,
        inputCount: Array.isArray(state.inputs) ? state.inputs.length : 0,
        replayCapture: "client-v1"
      }, "*");
    } catch (_) {}
  }, 400);
})();
</script>`;

  html = html.replace("</body>", bridge + "</body>");
  await fs.writeFile(indexPath, html);
}

await fs.mkdir(vendorRoot, { recursive: true });
await fs.mkdir(path.join(publicRoot, "games"), { recursive: true });

const selected = lock.upstreams.filter(
  (upstream) => upstream.role === "candidate" || includeReferences
);

for (const upstream of selected) {
  const src = await checkout(upstream);

  if (upstream.mode === "playable-static" && upstream.role === "candidate") {
    const dest = path.join(publicRoot, upstream.publicPath);
    await copyWithoutGit(src, dest);
    if (upstream.id === "tower") await patchTower(dest);
    console.log(`[candidate] ${upstream.id} -> ${path.relative(root, dest)}`);
  } else {
    console.log(`[reference] ${upstream.id} downloaded to vendor/${upstream.id}`);
  }
}

console.log("\nSkillArena2 bootstrap complete.");
console.log(includeReferences
  ? "Candidate + technical references ready."
  : "Mobile transfer candidates ready. Use npm run bootstrap:refs only when you need the technical references."
);
console.log("Run: npm run dev:fast");
