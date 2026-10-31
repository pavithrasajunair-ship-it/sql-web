"""Captures the real app screens used in the launch film. Run: python3 video/capture.py"""
import pathlib, json
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(__file__).resolve().parent / "screens"
bb = {}
def box(pg, sel):
    r = pg.locator(sel).first.bounding_box(); return {k: round(r[k], 1) for k in ("x", "y", "width", "height")}
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1.5).new_page()
    pg.on("dialog", lambda d: d.accept())
    pg.goto((ROOT / "index.html").as_uri() + "#app"); pg.evaluate("document.querySelector('[role=note]')?.remove()")
    pg.click('.mode-tab[data-mode="learn"]'); pg.wait_for_timeout(300); pg.screenshot(path=str(OUT / "learn.png"))
    pg.click('.mode-tab[data-mode="practice"]'); pg.click('[data-action="start"][data-mode="mcq"]'); pg.wait_for_timeout(300)
    pg.screenshot(path=str(OUT / "practice-q.png"))
    c = pg.evaluate("quizQ[0].correct")
    bb["opt"] = box(pg, f'[data-action="pick"][data-i="{c}"]')
    pg.click(f'[data-action="pick"][data-i="{c}"]'); pg.wait_for_timeout(400); pg.screenshot(path=str(OUT / "practice.png"))
    pg.click('[data-action="home"]'); pg.click('.mode-tab[data-mode="lab"]')
    # earn XP on quest 1 first so the header looks the same before and after quest 2
    pg.click('[data-id="s1"]'); pg.fill('#lab-sql', "SELECT * FROM student"); pg.click('[data-action="labrun"]'); pg.wait_for_timeout(300)
    pg.click('text=All quests'); pg.click('[data-id="s2"]'); pg.wait_for_timeout(300)
    pg.screenshot(path=str(OUT / "lab-empty.png"))
    pg.fill('#lab-sql', "SELECT name FROM student WHERE city = 'Delhi'"); pg.click('[data-action="labrun"]'); pg.wait_for_timeout(500)
    pg.evaluate("document.getElementById('content-area').scrollTop = 0"); pg.wait_for_timeout(200)
    bb["editor"] = box(pg, '#lab-sql'); bb["run"] = box(pg, '[data-action="labrun"]'); bb["out"] = box(pg, '#lab-out')
    pg.screenshot(path=str(OUT / "lab.png"))
    b.close()
(OUT / "bboxes.js").write_text("const BB=" + json.dumps(bb) + ";"); print(bb)
