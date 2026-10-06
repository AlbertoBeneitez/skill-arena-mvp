import { spawnSync, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const agar = path.join(root, "vendor", "agar");

try {
  await fs.access(path.join(agar, "package.json"));
} catch {
  console.error("Agar source is not bootstrapped. Run: npm run bootstrap");
  process.exit(1);
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const install = spawnSync(npm, ["install"], { cwd: agar, stdio: "inherit" });
if (install.status !== 0) process.exit(install.status || 1);

const child = spawn(npm, ["start"], {
  cwd: agar,
  stdio: "inherit",
  env: { ...process.env, PORT: process.env.AGAR_PORT || "3000" }
});
child.on("exit", (code) => process.exit(code ?? 0));
