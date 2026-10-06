import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const vendorRoot = path.join(root, "vendor");
const publicRoot = path.join(root, "public");
const lock = JSON.parse(await fs.readFile(path.join(root, "vendor-lock.json"), "utf8"));

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

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
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
    filter: (source) => path.basename(source) !== ".git" && path.basename(source) !== ".skillarena2-ref"
  });
}

async function patchTower(dest) {
  const indexPath = path.join(dest, "index.html");
  let html = await fs.readFile(indexPath, "utf8");

  // Keep gameplay intact, but do not send telemetry to the upstream author's GA property.
  html = html.replace(
    /<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=[^"]+"><\/script><script>[\s\S]*?gtag\("config",[\s\S]*?<\/script>/,
    ""
  );

  const bridge = `
<script>
(function () {
  window.setInterval(function () {
    try {
      window.parent.postMessage({
        type: "skillarena2:telemetry",
        game: "tower",
        score: typeof score === "number" ? score : null,
        successCount: typeof successCount === "number" ? successCount : null
      }, "*");
    } catch (_) {}
  }, 500);
})();
</script>`;

  html = html.replace("</body>", bridge + "</body>");
  await fs.writeFile(indexPath, html);
}

await fs.mkdir(vendorRoot, { recursive: true });
await fs.mkdir(path.join(publicRoot, "games"), { recursive: true });

for (const upstream of lock.upstreams) {
  const src = await checkout(upstream);

  if (upstream.mode === "playable-static") {
    const dest = path.join(publicRoot, upstream.publicPath);
    await copyWithoutGit(src, dest);
    if (upstream.id === "tower") await patchTower(dest);
    console.log(`[public] ${upstream.id} -> ${path.relative(root, dest)}`);
  }
}

console.log("\nSkillArena2 bootstrap complete.");
console.log("Run: npm run dev:fast");
