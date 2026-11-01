"""Challenge-a-friend end-to-end test. Run: python3 tests/challenge_e2e.py"""
import pathlib, sys, json, base64
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / "index.html").as_uri()
fails, passes = [], 0
def check(name, cond, extra=""):
    global passes
    if cond: passes += 1
    else: fails.append(name); print("FAIL:", name, extra)
def b64(o): return base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip("=")

def answer_all(pg, right_count):
    n = pg.evaluate("quizQ.length")
    for i in range(n):
        c = pg.evaluate("quizQ[quizIdx].correct")
        pick = c if i < right_count else (c + 1) % 4
        pg.click(f'[data-action="pick"][data-i="{pick}"]'); pg.click('[data-action="next"]')

with sync_playwright() as p:
    b = p.chromium.launch()
    # ---- sender
    ctxA = b.new_context(accept_downloads=True); A = ctxA.new_page(); errs = []
    A.on("pageerror", lambda e: errs.append(str(e))); A.on("dialog", lambda d: d.accept("Aarav"))
    A.goto(URL + "#app"); A.click('.mode-tab[data-mode="practice"]')
    A.click('[data-action="setn"][data-k="mcqN"][data-n="10"]'); A.click('[data-action="start"][data-mode="mcq"]')
    answer_all(A, 7)
    check("sender sees result 7/10", "7 out of 10" in A.inner_text("#content-area"))
    check("button says Challenge a friend", "Challenge a friend" in A.inner_text("#content-area"))
    with A.expect_download(timeout=8000) as d: A.click('[data-action="challenge"]')
    check("challenge card image offered", d.value.suggested_filename == "sql-challenge.png")
    link = A.evaluate("challengeLink('Aarav')")
    check("link has #c= code", "#c=" in link and len(link) < 700, link[-40:])
    # ---- friend
    ctxB = b.new_context(); B = ctxB.new_page(); B.on("pageerror", lambda e: errs.append(str(e)))
    B.goto(URL + link[link.index("#c="):])
    t = B.inner_text("#content-area")
    check("invitation names the sender and score", "Aarav challenged you" in t and "7/10" in t, t[:120])
    check("opens in the app, not the homepage", B.evaluate("document.body.dataset.view") == "app")
    B.click('[data-action="chstart"]')
    check("same 10 questions, no timer", B.evaluate("quizQ.length") == 10 and B.query_selector("#qtimer") is None)
    qa = A.evaluate("quizQ.map(q=>q.q)"); qb = B.evaluate("quizQ.map(q=>q.q)")
    check("friend gets exactly the same questions", sorted(qa) == sorted(qb))
    B.click('[data-action="pick"][data-i="0"]'); B.reload()
    check("refresh keeps the challenge going", B.evaluate("challenge && challenge.name") == "Aarav" and B.evaluate("quizIdx") == 0 and B.evaluate("answers[0] !== null"))
    # finish: friend gets 9 right (first answer already given)
    done = B.evaluate("answers.filter(Boolean).length")
    for i in range(10):
        if B.evaluate("answers[quizIdx]") is None:
            c = B.evaluate("quizQ[quizIdx].correct"); B.click(f'[data-action="pick"][data-i="{c}"]')
        B.click('[data-action="next"]')
    r = B.inner_text("#content-area")
    check("result compares both scores", "Aarav 7/10" in r and "You " in r, r[:200])
    check("verdict shown", any(x in r for x in ("You beat Aarav", "A tie with Aarav", "wins this round")))
    check("rematch button offered", "Send a rematch" in r)
    B.click('[data-action="home"]'); B.click('[data-action="start"][data-mode="mcq"]')
    check("a normal quiz is not a challenge", B.evaluate("challenge") is None)
    # ---- bad / hostile links
    for label, h in [("garbage", "#c=!!!"), ("not base64 json", "#c=aGVsbG8"), ("index out of range", "#c=" + b64({"k": "m", "s": 1, "n": "x", "q": [99999]})),
                     ("score above total", "#c=" + b64({"k": "m", "s": 9, "n": "x", "q": [1, 2]})), ("duplicate questions", "#c=" + b64({"k": "m", "s": 1, "n": "x", "q": [1, 1]})),
                     ("too many questions", "#c=" + b64({"k": "m", "s": 1, "n": "x", "q": list(range(61))}))]:
        pg = b.new_context().new_page(); pg.on("pageerror", lambda e: errs.append(str(e))); pg.goto(URL + h)
        check(f"bad link ({label}) falls back to the homepage", pg.evaluate("document.body.dataset.view") == "home")
        pg.close()
    pg = b.new_context().new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    xss = '<img src=x onerror="window.__x=1">'
    pg.goto(URL + "#c=" + b64({"k": "m", "s": 2, "n": xss, "q": [1, 2, 3]}))
    check("hostile name is neutralised", pg.evaluate("window.__x") is None and pg.query_selector("#content-area img") is None)
    # typed-answer challenges work too
    pg2 = b.new_context().new_page(); pg2.on("pageerror", lambda e: errs.append(str(e)))
    pg2.goto(URL + "#c=" + b64({"k": "t", "s": 1, "n": "Sana", "q": [0, 1, 2]}))
    pg2.click('[data-action="chstart"]'); check("typed challenge starts with 3 typed questions", pg2.evaluate("quizMode") == "type" and pg2.evaluate("quizQ.length") == 3)
    check("no JS errors", not errs, str(errs)); b.close()
print(f"{passes} passed, {len(fails)} failed"); sys.exit(1 if fails else 0)
