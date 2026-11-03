"""Builds public/studio/galactic-games-kit.zip from studio-kit/ (v142): the studio kit is itself a valid package.
core.wasm is committed (compiled from studio-kit/core/index.ts with AssemblyScript, see the README); this script embeds
it in game.html and zips the folder with fixed timestamps so the file only changes when its content does.
Usage: python3 scripts/build-studio-kit.py"""
import base64, os, zipfile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "studio-kit")
OUT = os.path.join(ROOT, "public", "studio", "galactic-games-kit.zip")
core = open(os.path.join(SRC, "core.wasm"), "rb").read()
html = open(os.path.join(SRC, "game.html"), encoding="utf8").read().replace("__CORE_WASM_BASE64__", base64.b64encode(core).decode())
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    def put(name, data):
        info = zipfile.ZipInfo(name, date_time=(2026, 11, 3, 0, 0, 0)); info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, data)
    for name in ["README.md", "galactic.json", "core/index.ts"]:
        put(name, open(os.path.join(SRC, name), "rb").read())
    put("game.html", html.encode())
    put("core.wasm", core)
    put("cover.webp", open(os.path.join(SRC, "cover.webp"), "rb").read())
print("wrote", OUT, os.path.getsize(OUT), "bytes")
