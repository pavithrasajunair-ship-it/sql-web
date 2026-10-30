"""E2E: spaced repetition, mock exam, new databases/quests. Run: python3 tests/batch2_e2e.py"""
import pathlib, subprocess, time, sys
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent / "dist"
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8768", "-d", str(ROOT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); ok = True; errors = []
def check(n, c):
    global ok; print(("PASS " if c else "FAIL ") + n); ok &= bool(c)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_context().new_page()
        pg.on("pageerror", lambda e: errors.append(str(e))); pg.on("dialog", lambda d: d.accept())
        pg.goto("http://localhost:8768/index.html"); pg.click('.mode-tab[data-mode="practice"]')
        txt = pg.inner_text('[data-mode="smart"]'); check("smart review offers new cards first", "0 due" in txt and "15 new" in txt)
        pg.click('[data-mode="smart"]'); check("smart session has 15 cards", pg.inner_text('.fc-topbar span').endswith("/ 15"))
        pg.click('[data-action="flip"]'); pg.click('[data-action="mark"][data-kind="hard"]'); pg.wait_for_timeout(500)
        pg.click('[data-action="mark"][data-kind="easy"]') if False else None
        pg.click('[data-action="home"]')
        check("a card marked hard is due again today", "1 due today" in pg.inner_text('[data-mode="smart"]'))
        pg.evaluate("srs[Object.keys(srs)[0]].due = dayNum() + 3; save()"); pg.reload(); pg.click('.mode-tab[data-mode="practice"]')
        check("a card scheduled for later is not due", "0 due" in pg.inner_text('[data-mode="smart"]'))
        # ---- exam
        pg.click('[data-action="examstart"]')
        check("paper has 15 + 5 + 3 questions", pg.locator('input[data-ex="m"]').count() >= 15 * 2 and pg.locator('textarea[data-ex="t"]').count() == 5 and pg.locator('textarea[data-ex="s"]').count() == 3)
        pg.locator('input[data-ex="m"]').first.check(); pg.fill('textarea[data-ex="t"] >> nth=0', "SELECT * FROM x")
        sols = pg.evaluate("examQs().sql.map(q => q.sol)")
        for i, s in enumerate(sols): pg.fill(f'textarea[data-ex="s"] >> nth={i}', s)
        pg.wait_for_timeout(600); pg.reload()
        check("exam resumes after refresh with answers", pg.locator('input[data-ex="m"]:checked').count() == 1 and sols[0] in pg.input_value('textarea[data-ex="s"] >> nth=0'))
        check("exam timer running", "⏱ 44:" in pg.inner_text('#extimer') or "⏱ 45:00" in pg.inner_text('#extimer'))
        pg.click('.exam-bar [data-action="examsubmit"]'); out = pg.inner_text('#content-area')
        check("result shows marks out of 34", "/34" in out and "C 9/9" in out)
        check("result lists topics to revise", "Where you lost marks" in out or "To revise" in out)
        pg.reload(); check("finished exam result survives refresh", "C 9/9" in pg.inner_text('#content-area'))
        pg.click('[data-action="examstart"]'); pg.evaluate("exam.used = exam.limit - 1"); pg.wait_for_timeout(2300)
        check("time-up auto-submits", "Time was up" in pg.inner_text('#content-area'))
        pg.click('[data-action="examexit"]')
        # ---- lab content
        pg.click('.mode-tab[data-mode="lab"]')
        check("5 databases with quest groups", pg.locator('.grp').count() == 5 and pg.locator('.lab-card').count() >= 40)
        pg.click('[data-action="labtab"][data-tab="play"]')
        pg.click('[data-action="labdb"][data-db="cricket"]'); pg.fill('#lab-sql', "SELECT name FROM player JOIN team ON player.team = team.team WHERE titles >= 5"); pg.keyboard.press("Control+Enter")
        check("cricket playground works", "Rohit" in pg.inner_text('#lab-out'))
        check("no JS errors", not errors); b.close()
finally:
    srv.terminate()
print(errors); sys.exit(0 if ok else 1)
