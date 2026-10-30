"""Regression test: shuffling flashcards must never bring back cards already seen. Run: python3 tests/flash_shuffle.py"""
import pathlib, subprocess, time, sys
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent / "dist"
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8765", "-d", str(ROOT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
ok = True
def check(n, c):
    global ok
    print(("PASS " if c else "FAIL ") + n); ok &= bool(c)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(); pg = ctx.new_page()
        pg.on("dialog", lambda d: d.accept())
        pg.goto("http://localhost:8765/index.html#app")
        pg.click('[data-mode="practice"].mode-tab'); pg.click('[data-action="start"][data-mode="flashcard"]')
        word = lambda: pg.inner_text('.fc-front .fc-word')
        seen = []
        for _ in range(5):
            seen.append(word()); pg.click('[data-action="fcnav"][data-d="1"]')
        cur = word()
        pg.click('[data-action="shuffle"]')
        check("current card kept after shuffle", word() == cur)
        check("position kept after shuffle", pg.inner_text('.fc-topbar span') .startswith("6 /"))
        total = int(pg.inner_text('.fc-topbar span').split('/')[1]); after = []
        for _ in range(total - 6):
            pg.click('[data-action="fcnav"][data-d="1"]'); after.append(word())
        check("no already-seen card reappears", not (set(after) & set(seen)))
        pg.click('[data-action="fcnav"][data-d="1"]')
        check("finish screen at end of deck", "went through all" in pg.inner_text('.fc-wrap'))
        pg.reload(); pg.click('[data-mode="practice"].mode-tab')
        check("finished state survives refresh", "went through all" in pg.inner_text('#content-area'))
        pg.wait_for_timeout(1500)
        check("service worker registered over http", pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>!!r)"))
        ctx.set_offline(True); pg.reload()
        check("loads offline", pg.inner_text('.logo-text') == "SQL Revision")
        b.close()
finally:
    srv.terminate()
sys.exit(0 if ok else 1)
