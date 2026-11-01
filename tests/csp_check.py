import json, os, sys, threading, http.server, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
H = {h['key']: h['value'] for h in json.load(open(ROOT + '/vercel.json'))['headers'][0]['headers']}
class S(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        for k, v in H.items(): self.send_header(k, v)
        super().end_headers()
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8771), functools.partial(S, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
bad = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.on('console', lambda m: bad.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None)
    pg.on('pageerror', lambda e: bad.append(str(e)))
    pg.goto('http://127.0.0.1:8771/index.html'); pg.wait_for_timeout(1500)
    for sel in ['text=Start revising', '#home-btn']:
        pass
    pg.goto('http://127.0.0.1:8771/index.html#app'); pg.wait_for_timeout(1500)
    for t in ['Practice', 'Lab', 'Learn']:
        el = pg.locator(f'nav >> text={t}, button:has-text("{t}")').first
        if el.count():
            try: el.click(timeout=2000); pg.wait_for_timeout(500)
            except Exception: pass
    pg.evaluate("document.body.style.background")
    xss = pg.evaluate("(()=>{try{eval('1');return 'eval-allowed'}catch(e){return 'ok'}})()")
    b.close()
print('CSP violations/errors:', bad or 'none')
sys.exit(1 if bad else 0)
