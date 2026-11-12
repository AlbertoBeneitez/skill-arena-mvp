"""Builds public/studio/galactic-games-kit.zip from studio-kit/ (v142; format 2 since v178): the downloadable kit is
the example game «Pulse» in the app's own TypeScript format — itself a valid package — plus the tools a studio uses
to check, preview and zip its game. Fixed timestamps, so the file only changes when its content does.
(The format-1 kit, WebAssembly + HTML, is kept as a test fixture in scripts/fixtures/studio/.)
Usage: python3 scripts/build-studio-kit.py"""
import os, zipfile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "studio-kit")
OUT = os.path.join(ROOT, "public", "studio", "galactic-games-kit.zip")
FILES = ["README.md", "galactic.json", "cover.webp", "package.json", "tsconfig.json",
         "src/core.ts", "src/game.ts", "kit/core.ts", "kit/seeded.ts", "kit/view.ts",
         "tools/check.ts", "tools/preview.ts", "tools/zip.mjs", "preview/index.html"]
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for name in FILES:
        info = zipfile.ZipInfo(name, date_time=(2026, 11, 12, 0, 0, 0)); info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, open(os.path.join(SRC, name), "rb").read())
print("wrote", OUT, os.path.getsize(OUT), "bytes")
