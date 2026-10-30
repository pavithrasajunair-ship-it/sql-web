"""E2E: backup/restore, streak, daily challenge, theme. Run: python3 tests/batch1_e2e.py"""
import pathlib, subprocess, time, sys, json
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent / "dist"
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8767", "-d", str(ROOT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); ok = True; errors = []; msgs = []
def on_dialog(d):
    msgs.append(d.message); d.accept()
def check(n, c):
    global ok; print(("PASS " if c else "FAIL ") + n); ok &= bool(c)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(accept_downloads=True); pg = ctx.new_page()
        pg.on("pageerror", lambda e: errors.append(str(e))); pg.on("dialog", on_dialog)
        pg.goto("http://localhost:8767/index.html"); pg.click('.mode-tab[data-mode="practice"]')
        check("no streak at start", "finish a quiz" in pg.inner_text('.streak'))
        pg.click('[data-action="setn"][data-k="mcqN"][data-n="10"]'); pg.click('[data-action="start"][data-mode="mcq"]')
        pg.evaluate("quizIdx = quizQ.length; showResult()"); pg.click('[data-action="home"]')
        check("streak starts after finishing a quiz", "1 day streak" in pg.inner_text('.streak'))
        pg.click('[data-action="theme"][data-t="light"]'); pg.click('[data-action="big"]')
        pg.reload(); check("theme + big text survive refresh", pg.evaluate("document.documentElement.dataset.theme") == "light" and pg.evaluate("document.documentElement.dataset.big") == "1")
        # lab: daily challenge
        pg.click('.mode-tab[data-mode="lab"]'); check("daily banner shown", "Daily challenge" in pg.inner_text('.daily'))
        pg.click('.daily'); qid = pg.evaluate("lab.open"); sol = pg.evaluate("QUESTS.find(q=>q.id===lab.open).sol")
        pg.fill('#lab-sql', sol); pg.click('[data-action="labrun"]')
        check("daily bonus awarded", "daily bonus" in pg.inner_text('#lab-out'))
        xp = pg.evaluate("lab.xp")
        # export -> wipe -> import
        pg.click('.mode-tab[data-mode="practice"]')
        with pg.expect_download() as dl: pg.click('[data-action="export"]')
        path = dl.value.path(); data = json.load(open(path))
        check("export file has progress", data["format"] == "sql-revision-backup" and "sqlrev.v3" in data["data"])
        pg.close(); ctx = b.new_context(accept_downloads=True); pg = ctx.new_page(); pg.on("pageerror", lambda e: errors.append(str(e))); pg.on("dialog", on_dialog); pg.goto("http://localhost:8767/index.html")  # a brand-new phone
        pg.click('.mode-tab[data-mode="practice"]'); check("cleared = fresh", "finish a quiz" in pg.inner_text('.streak'))
        pg.set_input_files('#imp', path); pg.wait_for_load_state(); pg.wait_for_timeout(800)
        pg.click('.mode-tab[data-mode="lab"]')
        check("import restores XP and streak", pg.evaluate("lab.xp") == xp and pg.evaluate("liveStreak()") >= 1)
        bad = pathlib.Path("/tmp/bad.json"); bad.write_text('{"hello":1}')
        
        pg.click('.mode-tab[data-mode="practice"]'); pg.set_input_files('#imp', str(bad)); pg.wait_for_timeout(500)
        check("bad file rejected with message", any("not a SQL Revision" in m for m in msgs))
        check("no JS errors", not errors); b.close()
finally:
    srv.terminate()
print(errors); sys.exit(0 if ok else 1)
