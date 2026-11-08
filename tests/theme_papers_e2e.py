"""E2E: dark/light toggle (system default, remembered, contrast on every screen) and board-style papers. Run: python3 tests/theme_papers_e2e.py"""
import json, os, sys, threading, http.server, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
H = {h['key']: h['value'] for h in json.load(open(ROOT + '/vercel.json'))['headers'][0]['headers']}
class S(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        for k, v in H.items(): self.send_header(k, v)
        super().end_headers()
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8773), functools.partial(S, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
U = 'http://127.0.0.1:8773/index.html#app'
fails = []
def check(n, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + n + (' ' + str(extra) if not ok else '')); 
    if not ok: fails.append(n)
CONTRAST = """() => {
  const lum = c => { const [r,g,b] = c.map(v => { v/=255; return v<=.03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); }); return .2126*r+.7152*g+.0722*b; };
  const parse = s => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map(x => parseFloat(x)); return {c: p.slice(0,3), a: p.length > 3 ? p[3] : 1}; };
  const bgOf = el => { let stack = [], e = el; while (e) { const p = parse(getComputedStyle(e).backgroundColor); if (p && p.a > 0) { stack.push(p); if (p.a >= .99) break; } e = e.parentElement; } let base = [255,255,255]; if (!stack.length || stack[stack.length-1].a < .99) base = getComputedStyle(document.documentElement).colorScheme.includes('dark') ? [13,13,13] : [246,246,250];
    for (let i = stack.length-1; i >= 0; i--) { const s = stack[i]; base = base.map((v, k) => s.a*s.c[k] + (1-s.a)*v); } return base; };
  const bad = [], seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
    const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).length; if (!own) continue; if (/^[^\\w]+$/.test(el.textContent.trim())) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const fg = parse(cs.color); if (!fg || fg.a === 0 || el.closest('.lp-stats')) continue; const bg = bgOf(el);
    const f = fg.c.map((v, k) => fg.a*v + (1-fg.a)*bg[k]), L1 = lum(f), L2 = lum(bg), r = (Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);
    const big = parseFloat(cs.fontSize) >= 18.6 || (parseFloat(cs.fontSize) >= 14 && +cs.fontWeight >= 700);
    if (r < (big ? 3 : 4.5)) { const k = el.className + '|' + r.toFixed(1); if (!seen.has(k)) { seen.add(k); bad.push(el.tagName + '.' + el.className + ' ' + r.toFixed(2) + ' ' + el.textContent.trim().slice(0, 30)); } }
  }
  return bad;
}"""
with sync_playwright() as p:
    b = p.chromium.launch()
    errs = []
    def newpage(scheme):
        ctx = b.new_context(color_scheme=scheme, viewport={'width': 1100, 'height': 900}); pg = ctx.new_page()
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None)
        pg.on('pageerror', lambda e: errs.append(str(e))); return ctx, pg
    th = lambda pg: pg.evaluate("document.documentElement.dataset.theme")
    # system default
    ctx, pg = newpage('light'); pg.goto(U); pg.wait_for_timeout(500)
    check('light system -> light theme', th(pg) == 'light')
    pg.click('#theme-btn'); check('toggle -> dark', th(pg) == 'dark')
    check('choice stored', pg.evaluate("localStorage.getItem('sqlrev.theme')") == 'dark')
    pg.reload(); pg.wait_for_timeout(300); check('choice remembered over system', th(pg) == 'dark')
    check('aria-label updated', 'light' in pg.get_attribute('#theme-btn', 'aria-label'))
    ctx.close()
    ctx, pg = newpage('dark'); pg.goto(U); pg.wait_for_timeout(500); check('dark system -> dark theme', th(pg) == 'dark'); ctx.close()
    # storage blocked: still works
    ctx, pg = newpage('light'); pg.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}})"); pg.goto(U); pg.wait_for_timeout(500)
    pg.click('#theme-btn'); check('works with storage blocked', th(pg) == 'dark'); ctx.close()
    # contrast over every screen in both themes
    for theme in ['dark', 'light']:
        ctx, pg = newpage(theme); pg.goto('http://127.0.0.1:8773/index.html'); pg.wait_for_timeout(800)
        pg.on('dialog', lambda d: d.accept())
        def back():
            pg.click('[data-mode="practice"].mode-tab'); pg.wait_for_timeout(150)
            if pg.locator('[data-action="home"]:visible').count(): pg.click('[data-action="home"]:visible >> nth=0'); pg.wait_for_timeout(200)
        def scan(name):
            bad = pg.evaluate(CONTRAST); check(f'{theme}: contrast OK on {name}', not bad, bad[:6])
        pg.evaluate("document.querySelectorAll('[data-reveal],[data-split]').forEach(e=>e.classList.add('in'))"); scan('home')
        pg.click('#home-start'); pg.wait_for_timeout(500); scan('learn')
        pg.click('[data-mode="practice"].mode-tab'); pg.wait_for_timeout(300); scan('practice home')
        pg.click('[data-action="start"][data-mode="mcq"]'); pg.wait_for_timeout(300); scan('mcq quiz')
        pg.click('.opt-btn >> nth=0'); pg.wait_for_timeout(200); scan('mcq answered')
        back()
        pg.click('[data-action="start"][data-mode="type"]'); pg.wait_for_timeout(300); pg.fill('textarea, input.type-in', 'select'); 
        if pg.locator('[data-action="check"]').count(): pg.click('[data-action="check"]')
        pg.wait_for_timeout(200); scan('typed answer wrong')
        back()
        pg.click('[data-action="start"][data-mode="flashcard"]'); pg.wait_for_timeout(300); scan('flashcard front'); pg.click('[data-action="flip"]'); pg.wait_for_timeout(500); scan('flashcard back')
        pg.click('[data-mode="lab"].mode-tab'); pg.wait_for_timeout(300); scan('lab quests')
        pg.click('[data-action="labopen"] >> nth=0'); pg.wait_for_timeout(300); pg.fill('#lab-sql', 'SELEC x'); pg.keyboard.press('Control+Enter'); pg.wait_for_timeout(300); scan('lab error')
        pg.fill('#lab-sql', 'SELECT * FROM student'); pg.keyboard.press('Control+Enter'); pg.wait_for_timeout(300); scan('lab result')
        pg.click('[data-action="labtab"][data-tab="play"]'); pg.wait_for_timeout(300); scan('playground')
        back()
        pg.click('[data-action="examstart"]'); pg.wait_for_timeout(300); scan('mock exam'); pg.click('[data-action="examsubmit"]'); pg.wait_for_timeout(300); scan('exam result')
        pg.click('[data-action="examexit"]') if pg.locator('[data-action="examexit"]').count() else None
        pg.wait_for_timeout(200)
        pg.click('[data-action="papersopen"]'); pg.wait_for_timeout(200); scan('papers list')
        pg.click('[data-action="paperstart"][data-id="bp1"]'); pg.wait_for_timeout(300); scan('paper')
        pg.click('[data-action="papersubmit"] >> nth=0'); pg.wait_for_timeout(300); scan('paper result')
        ctx.close()
    # papers flow
    ctx, pg = newpage('light'); pg.goto(U); pg.wait_for_timeout(500)
    pg.click('[data-mode="practice"].mode-tab'); pg.click('[data-action="papersopen"]')
    txt = pg.inner_text('#content-area'); check('labelled as practice papers, not real', 'not</b>' in pg.inner_html('#content-area') or 'not real past papers' in txt)
    check('no PYQ claims in UI', 'previous year' not in txt.lower() and 'pyq' not in txt.lower())
    pg.click('[data-action="paperstart"][data-id="bp1"]'); pg.wait_for_timeout(300)
    check('timer shown', pg.locator('#pptimer').count() == 1 and '40:00' in pg.inner_text('#pptimer') or '39:' in pg.inner_text('#pptimer'))
    for i, v in enumerate([2, 1, 2, 1, 3, 1]): pg.check(f'input[name="pm{i}"][value="{v}"]')
    for i, v in enumerate(['Chennai 1 Delhi 3 Mumbai 1 Pune 1', '95, 54, 82.8', 'AAR 5\nDIY 4\nKAB 5']): pg.fill(f'textarea[data-pp="o"][data-i="{i}"]', v)
    pg.fill('textarea[data-pp="w"][data-i="0"]', 'SELECT name, marks FROM student WHERE class = 12 AND marks BETWEEN 70 AND 90 ORDER BY marks DESC')
    pg.fill('textarea[data-pp="w"][data-i="1"]', 'SELECT name FROM student WHERE marks = NULL')
    pg.fill('textarea[data-pp="c"][data-i="0"]', 'SELECT class, COUNT(*), AVG(marks) FROM student GROUP BY class HAVING AVG(marks) > 75')
    pg.fill('textarea[data-pp="c"][data-i="1"]', 'SELECT <img src=x onerror=alert(1)>')
    pg.wait_for_timeout(600); pg.reload(); pg.wait_for_timeout(500)
    check('paper resumes after refresh with answers', pg.locator('textarea[data-pp="o"][data-i="1"]').input_value() == '95, 54, 82.8' and pg.locator('input[name="pm0"][value="2"]').is_checked())
    pg.once('dialog', lambda d: d.accept()); pg.click('[data-action="papersubmit"] >> nth=0'); pg.wait_for_timeout(400)
    res = pg.inner_text('#content-area')
    check('score 6+6+... : A 6/6', 'Section A 6/6' in res)
    check('B 9/10 (= NULL gets 1 of 2)', 'B 9/10' in res, res[:200])
    check('C 3/9 (only C1 correct)', 'C 3/9' in res, res[:200])
    check('hostile input escaped', pg.evaluate("!document.querySelector('#content-area img')"))
    pg.reload(); pg.wait_for_timeout(400); check('result survives refresh', 'Section A 6/6' in pg.inner_text('#content-area'))
    pg.click('[data-action="papersopen"]'); check('best score shown', 'best' in pg.inner_text('#content-area'))
    ctx.close(); b.close()
print('console/page errors:', errs or 'none')
sys.exit(1 if fails or errs else 0)
