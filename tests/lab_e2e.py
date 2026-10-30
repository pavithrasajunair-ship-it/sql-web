"""E2E for quiz length, timer and SQL Lab. Run: python3 tests/lab_e2e.py"""
import pathlib, subprocess, time, sys
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent / "dist"
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8766", "-d", str(ROOT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); ok = True; errors = []
def check(n, c):
    global ok; print(("PASS " if c else "FAIL ") + n); ok &= bool(c)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(); pg = ctx.new_page()
        pg.on("pageerror", lambda e: errors.append(str(e))); pg.on("dialog", lambda d: d.accept())
        pg.goto("http://localhost:8766/index.html"); pg.click('.mode-tab[data-mode="practice"]')
        # --- quiz length + timer
        pg.click('[data-action="setn"][data-k="mcqN"][data-n="50"]'); pg.check('[data-action="timer"]')
        pg.click('[data-action="start"][data-mode="mcq"]')
        check("50 MCQs chosen", pg.inner_text('.quiz-progress-meta').startswith("1 / 50"))
        check("timer shown (50 x 45s = 37:30)", "37:30" in pg.inner_text('#qtimer') or "37:29" in pg.inner_text('#qtimer'))
        pg.wait_for_timeout(2200); pg.reload()
        t = pg.inner_text('#qtimer'); check("timer survives refresh and keeps counting down", t.startswith("⏱ 37:") and "37:30" not in t)
        pg.evaluate("quizTimer.used = quizTimer.limit - 1"); pg.wait_for_timeout(2200)
        check("time-up ends quiz", "Time is up" in pg.inner_text('#content-area'))
        pg.click('[data-action="home"]')
        pg.fill('[data-cfg="typeN"]', '999'); pg.dispatch_event('[data-cfg="typeN"]', 'change')
        check("custom number clamped to bank size", pg.input_value('[data-cfg="typeN"]') == "46")
        pg.uncheck('[data-action="timer"]'); pg.click('[data-action="start"][data-mode="mcq"]')
        check("timer off = no timer", pg.query_selector('#qtimer') is None)
        pg.click('[data-action="home"]')
        # --- Lab
        pg.click('.mode-tab[data-mode="lab"]'); pg.click('[data-id="s2"]')
        pg.fill('#lab-sql', "SELECT nmae FROM student WHERE city=Delhi"); pg.keyboard.press("Control+Enter")
        out = pg.inner_text('#lab-out'); check("typo shows error + did-you-mean", "Unknown column" in out and 'name' in out)
        pg.fill('#lab-sql', "SELECT name FROM student WHERE city=Delhi"); pg.keyboard.press("Control+Enter")
        check("unquoted text hint", "quotes" in pg.inner_text('#lab-out'))
        pg.fill('#lab-sql', "SELECT name FROM student WHERE city='Mumbai'"); pg.click('[data-action="labrun"]')
        check("wrong answer gets nudge, not win", "Not quite" in pg.inner_text('#lab-out'))
        pg.click('[data-action="labhint"]'); check("hint reveals", "WHERE" in pg.inner_text('.lab-hints'))
        pg.fill('#lab-sql', "select name from student where city = 'Delhi'"); pg.click('[data-action="labrun"]')
        check("correct answer wins XP", "Nailed it" in pg.inner_text('#lab-out') and "XP" in pg.inner_text('.lab-head'))
        pg.reload(); check("XP + quest progress survive refresh", "1/15 quests" in pg.inner_text('.lab-head') or "1/" in pg.inner_text('.lab-head'))
        pg.click('[data-action="labtab"][data-tab="play"]')
        pg.fill('#lab-sql', "INSERT INTO student VALUES (11,'Zed',12,'A',60,'Goa','2007-01-01'); SELECT COUNT(*) FROM student"); pg.keyboard.press("Control+Enter")
        check("playground runs multi-statements", "11" in pg.inner_text('#lab-out'))
        pg.reload(); pg.fill('#lab-sql', "SELECT COUNT(*) FROM student"); pg.keyboard.press("Control+Enter")
        check("playground data persists after refresh", "11" in pg.inner_text('#lab-out'))
        pg.click('[data-action="labreset"]'); pg.fill('#lab-sql', "SELECT COUNT(*) FROM student"); pg.keyboard.press("Control+Enter")
        check("reset restores original data", "10" in pg.inner_text('#lab-out'))
        pg.fill('#lab-sql', "<img src=x onerror=alert(1)>"); pg.keyboard.press("Control+Enter")
        check("hostile input is escaped", pg.query_selector('#lab-out img') is None)
        check("no JS errors", not errors); b.close()
finally:
    srv.terminate()
print(errors); sys.exit(0 if ok else 1)
