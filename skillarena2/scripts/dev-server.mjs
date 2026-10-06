import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.resolve(here, "..", "public");
const port = Number(process.env.PORT || 4173);

const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".mp3", "audio/mpeg"],
  [".ogg", "audio/ogg"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".ttf", "font/ttf"],
  [".eot", "application/vnd.ms-fontobject"],
  [".json", "application/json; charset=utf-8"]
]);

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const candidate = path.resolve(publicRoot, "." + decoded);
  if (!candidate.startsWith(publicRoot)) return null;
  return candidate;
}

const server = http.createServer(async (req, res) => {
  try {
    let filePath = safePath(req.url || "/");
    if (!filePath) {
      res.writeHead(400);
      return res.end("Bad path");
    }

    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch {
      res.writeHead(404);
      return res.end("Not found");
    }

    if (stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mime.get(path.extname(filePath).toLowerCase()) || "application/octet-stream",
      "Cache-Control": "no-store",
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups"
    });
    res.end(data);
  } catch (error) {
    res.writeHead(500);
    res.end(String(error?.stack || error));
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`SkillArena2 lab running on http://localhost:${port}`);
});
