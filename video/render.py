"""Renders composition.html to frames with Chromium. Usage:
   python3 video/render.py still 4.5 out.png      # one frame
   python3 video/render.py frames outdir           # all frames as JPEG sequence
   add the word 'vertical' as a last argument for the 9:16 cut"""
import sys, pathlib
from playwright.sync_api import sync_playwright
HERE = pathlib.Path(__file__).resolve().parent
VERT = "vertical" in sys.argv
URL = (HERE / "composition.html").as_uri() + ("?fmt=vertical" if VERT else "")
def open_page(b):
    pg = b.new_page(viewport={"width": 1080, "height": 1920} if VERT else {"width": 1920, "height": 1080}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.goto(URL); pg.evaluate("window.ready"); return pg, errs
with sync_playwright() as p:
    b = p.chromium.launch()
    pg, errs = open_page(b)
    if sys.argv[1] == "still":
        for t in sys.argv[2].split(","):
            pg.evaluate(f"seek({t})"); pg.screenshot(path=sys.argv[3].replace("%t", t))
    else:
        out = pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
        n = round(pg.evaluate("DUR") * pg.evaluate("FPS"))
        for i in range(n):
            pg.evaluate(f"seek({i}/30)"); pg.screenshot(path=str(out / f"f{i:04d}.jpg"), type="jpeg", quality=94)
        print("frames", n)
    print("errors:", errs); b.close()
