"""End-to-end test in a real (headless) Chromium. Run:  python3 tests/e2e.py
Needs: pip install playwright && playwright install chromium"""
import pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / "index.html").as_uri()
SHOTS = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
fails, passes = [], 0

def check(name, cond, extra=""):
    global passes
    if cond: passes += 1
    else:
        fails.append(name); print("FAIL:", name, extra)

def open_page(browser, width=1100, height=800, storage=None):
    ctx = browser.new_context(viewport={"width": width, "height": height})
    if storage is not None:
        ctx.add_init_script("try{ if(!localStorage.getItem('sqlrev.v3')) localStorage.setItem('sqlrev.v3', %r) }catch(e){}" % storage)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("dialog", lambda d: d.accept())
    page.goto(URL)
    return ctx, page, errors

with sync_playwright() as p:
    browser = p.chromium.launch()

    # ---------------- desktop ----------------
    ctx, page, errors = open_page(browser)
    check("styles applied (body is flex)", page.evaluate("getComputedStyle(document.body).display") == "flex")
    check("no red 'styles did not load' banner", page.locator("[role=alert]").count() == 0)
    check("topic list has 10 topics", page.locator(".topic-item").count() == 10)

    page.fill("#search", "truncate")
    check("search finds TRUNCATE", page.locator(".flash-card").count() >= 1)
    page.fill("#search", "zzzzqq")
    check("search shows empty message", "No concepts found" in page.inner_text("#learn-list"))
    page.fill("#search", "")

    # ---- type quiz: answer all 10 in lower-case keywords, watch the counter advance ----
    page.click("[data-mode=practice]")
    check("sidebar hidden in practice", not page.locator("#sidebar").is_visible())
    page.click("[data-action=start][data-mode=type]")
    bank = {q["q"]: q for q in page.evaluate("TYPE_Q")}
    seen_counters = []
    first_round = []
    for i in range(10):
        q_text = page.inner_text("#qtext")
        first_round.append(q_text)
        counter = page.inner_text(".quiz-progress-meta span:first-child")
        seen_counters.append(counter)
        check(f"q{i+1}: counter shows {i+1} / 10", counter == f"{i+1} / 10", counter)
        check(f"q{i+1}: 'Given' box shown", "Given:" in page.inner_text(".given"))
        q = bank[q_text]
        page.fill("#type-in", q["answer"].lower().replace(";", ""))
        page.click("[data-action=check]")
        fb = page.inner_text(".type-feedback")
        check(f"q{i+1}: lower-case answer marked correct", "Correct" in fb, fb)
        page.click("[data-action=next]")
    check("quiz reached the result screen", "out of 10" in page.inner_text("#content-area"))
    check("10/10 score", "10 out of 10" in page.inner_text("#content-area"))

    # ---- strict names: wrong-case table name fails, keyword case is fine ----
    page.click("[data-action=start][data-mode=type]")
    second_round = []
    for i in range(10):
        second_round.append(page.inner_text("#qtext"))
        if i == 0:
            q = bank[second_round[0]]
            bad = q["answer"].replace(q["names"][0], q["names"][0].upper()) if q["names"] else None
            if bad:
                page.fill("#type-in", bad)
                page.click("[data-action=check]")
                fb = page.inner_text(".type-feedback")
                check("wrong-case name is flagged as case-sensitive", "case-sensitive" in fb, fb)
        else:
            page.click("[data-action=reveal]")
        page.click("[data-action=next]")
    check("second quiz has NO repeated questions from the first", not (set(first_round) & set(second_round)),
          str(set(first_round) & set(second_round)))

    # ---- resume after refresh (mid-quiz) ----
    page.click("[data-action=start][data-mode=type]")
    qs = [page.inner_text("#qtext")]
    q = bank[qs[0]]
    page.fill("#type-in", q["answer"])
    page.click("[data-action=check]")
    page.click("[data-action=next]")
    q2 = page.inner_text("#qtext")
    page.reload()
    page.click("[data-mode=practice]")
    check("after refresh: same question 2 / 10", page.inner_text("#qtext") == q2 and page.inner_text(".quiz-progress-meta span:first-child") == "2 / 10")
    page.click("[data-action=prev]")
    check("after refresh: answer 1 is kept and locked", page.locator("#type-in").is_disabled() and "Correct" in page.inner_text(".type-feedback"))
    page.click("[data-action=next]")
    check("moved forward to question 2 again", page.inner_text(".quiz-progress-meta span:first-child") == "2 / 10")
    page.click("[data-action=home]")          # confirm dialog auto-accepted
    check("back to practice home", "Practice Mode" in page.inner_text("#content-area"))

    # ---- keyword case: UPPER, lower, Mixed all pass ----
    page.click("[data-action=start][data-mode=type]")
    q = bank[page.inner_text("#qtext")]
    mixed = "".join(c.upper() if i % 2 else c.lower() for i, c in enumerate("select")) + " "
    page.click("[data-action=reveal]"); page.click("[data-action=next]")
    page.click("[data-action=home]")

    # ---- MCQ ----
    mcq = {q["q"]: q for q in page.evaluate("MCQ")}
    page.click("[data-action=start][data-mode=mcq]")
    mcq_round1, orders = [], []
    for i in range(12):
        t = page.inner_text("#qtext"); mcq_round1.append(t)
        base = mcq[t]
        right = base["opts"][base["correct"]]
        opts = [o.split(". ", 1)[1] for o in page.locator(".opt-btn").all_inner_texts()]
        orders.append(tuple(opts))
        check(f"mcq {i+1}: correct answer present once", opts.count(right) == 1)
        page.locator(".opt-btn").nth(opts.index(right)).click()
        check(f"mcq {i+1}: marked correct", page.locator(".opt-btn.correct").count() == 1 and page.locator(".opt-btn.wrong").count() == 0)
        page.click("[data-action=next]")
    check("mcq 12/12 correct", "12 out of 12" in page.inner_text("#content-area"))
    page.click("[data-action=start][data-mode=mcq]")
    mcq_round2 = []
    for i in range(12):
        mcq_round2.append(page.inner_text("#qtext"))
        page.locator(".opt-btn").first.click()
        page.click("[data-action=next]")
    check("second MCQ quiz has no repeats from the first", not (set(mcq_round1) & set(mcq_round2)))
    check("MCQ option order is shuffled (not always the bank order)",
          any(list(o) != mcq[t]["opts"] for o, t in zip(orders, mcq_round1)))
    page.click("[data-action=home]")

    # ---- flashcards ----
    page.click("[data-action=start][data-mode=flashcard]")
    check("flashcard starts at 1 / N", page.inner_text(".fc-topbar span").startswith("1 / "))
    page.click("#big-card")
    check("click flips card (class toggled)", "flipped" in page.get_attribute("#big-card", "class"))
    page.keyboard.press("ArrowRight")
    check("ArrowRight goes to card 2", page.inner_text(".fc-topbar span").startswith("2 / "))
    page.keyboard.press("h")
    page.wait_for_timeout(500)
    check("H marks hard and advances", page.inner_text(".fc-topbar span").startswith("3 / "))
    page.reload(); page.click("[data-mode=practice]")
    check("flashcard position survives refresh", page.inner_text(".fc-topbar span").startswith("3 / "))
    page.click("[data-action=home]")
    check("hard card listed on practice home", "1 card marked hard" in page.inner_text("#content-area"))

    # ---- toggle off strict names ----
    page.uncheck("[data-action=strict]")
    page.click("[data-action=start][data-mode=type]")
    q = bank[page.inner_text("#qtext")]
    if q["names"]:
        page.fill("#type-in", q["answer"].upper())
        page.click("[data-action=check]")
        check("strict OFF: ALL-CAPS answer accepted", "Correct" in page.inner_text(".type-feedback"), page.inner_text(".type-feedback"))
    if SHOTS:
        page.screenshot(path=str(SHOTS / "desktop_type.png"))
    check("no console / page errors (desktop)", not errors, str(errors))
    ctx.close()

    # ---------------- mobile ----------------
    ctx, page, errors = open_page(browser, 400, 780)
    check("mobile: no horizontal page overflow", page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"))
    check("mobile: topics are a horizontal strip", page.evaluate("getComputedStyle(document.querySelector('#topic-list')).display") == "flex")
    if SHOTS: page.screenshot(path=str(SHOTS / "mobile_learn.png"))
    page.click("[data-mode=practice]")
    page.click("[data-action=start][data-mode=type]")
    check("mobile: quiz has no horizontal overflow", page.evaluate("document.querySelector('#content-area').scrollWidth <= window.innerWidth"))
    if SHOTS: page.screenshot(path=str(SHOTS / "mobile_type.png"))
    check("no console / page errors (mobile)", not errors, str(errors))
    ctx.close()

    # ---------------- corrupt / old storage must not crash ----------------
    ctx, page, errors = open_page(browser, storage='{"v":3,"session":{"kind":"mcq","qs":[{"q":"nope","order":[0,1,2,3]}],"answers":[null]},"mode":"practice","history":{"mcq":["x"]}}')
    check("bad saved session is ignored (shows practice home)", "Practice Mode" in page.inner_text("#content-area"))
    check("no errors with bad storage", not errors, str(errors))
    ctx.close()
    browser.close()

print(f"\n{passes} passed, {len(fails)} failed")
sys.exit(1 if fails else 0)
