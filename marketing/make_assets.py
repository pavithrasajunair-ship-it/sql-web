"""Generates the marketing assets from the real app data.
   python3 marketing/make_assets.py
Outputs: src/og.png (link preview), marketing/cheatsheet-*.png + .pdf, marketing/daily/day-XX.jpg + schedule.md
Daily questions link to  <site>/#q=N  where N is the question's index in the MCQ bank (the bank is append-only, so links never break)."""
import json, subprocess, pathlib, html, re
from playwright.sync_api import sync_playwright
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent; ROOT = HERE.parent
SITE = "https://pavithrasajunair-ship-it.github.io/sql-web/"
data = json.loads(subprocess.check_output(["node", "-e", "const d=require('%s/src/data.js');console.log(JSON.stringify({MCQ:d.MCQ}))" % ROOT]))
MCQ = data["MCQ"]
esc = html.escape
import base64
ICON = "data:image/png;base64," + base64.b64encode((ROOT / "src/icon-192.png").read_bytes()).decode()   # embedded: file:// images do not load on generated pages

BASE = """<style>
:root{--bg:#0d0d0d;--surface:#161616;--surface2:#1f1f1f;--border:#2e2e2e;--border2:#3a3a3a;--text:#f0f0f0;--text2:#a8a8a8;--text3:#8a8a8a;
 --purple:#7f77dd;--pl:#afa9ec;--pbg:#1a1840;--green:#1d9e75;--gl:#5dcaa5;--gbg:#00231a}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter','Inter Display',-apple-system,'Segoe UI',sans-serif;color:var(--text);background:var(--bg);-webkit-font-smoothing:antialiased;position:relative;overflow:hidden}
.glow{position:absolute;border-radius:50%;filter:blur(110px)}
.g1{background:var(--purple);opacity:.32}.g2{background:var(--green);opacity:.22}
.grad{background:linear-gradient(90deg,var(--pl),var(--gl));-webkit-background-clip:text;background-clip:text;color:transparent}
.mono{font-family:'JetBrains Mono','DejaVu Sans Mono',ui-monospace,Menlo,monospace}
</style>"""

def page(w, h, body, css=""):
    return f"<!doctype html><meta charset=utf-8>{BASE}<style>body{{width:{w}px;height:{h}px}}{css}</style><body>{body}</body>"

# ---------------- link preview ----------------
OG = page(1200, 630, f"""
<div class=glow style="width:700px;height:700px;left:-200px;top:-260px" ></div>
<div class="glow g1" style="width:700px;height:700px;left:-200px;top:-260px"></div><div class="glow g2" style="width:600px;height:600px;right:-180px;bottom:-280px"></div>
<div style="position:absolute;left:80px;top:96px;width:700px">
 <div style="display:inline-block;font-size:20px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--pl);background:var(--pbg);padding:10px 22px;border-radius:99px">Class 12 SQL · Free · Works offline</div>
 <div style="font-size:104px;font-weight:800;letter-spacing:-.045em;line-height:1;margin-top:34px">SQL, finally<br><span class=grad>clicks.</span></div>
 <div style="font-size:30px;color:var(--text2);margin-top:30px;line-height:1.4">Every topic, instant-feedback quizzes and a live SQL lab. No sign-up.</div>
</div>
<img src="{ICON}" style="position:absolute;right:60px;top:120px;width:310px;height:310px;border-radius:72px;box-shadow:0 40px 120px rgba(127,119,221,.55)">
<div style="position:absolute;right:80px;top:510px;width:420px;display:flex;gap:12px;justify-content:center">
 {''.join(f'<div style="padding:12px 24px;border-radius:99px;border:1px solid var(--border2);background:var(--surface);font-weight:600;font-size:22px">{t}</div>' for t in ("Learn","Practice","Lab"))}
</div>
<div style="position:absolute;left:80px;bottom:48px;font-size:24px;color:var(--text3)">pavithrasajunair-ship-it.github.io/sql-web</div>
""")

# ---------------- cheat sheet ----------------
P1 = [
 ("Basics", "#378add", [("SHOW DATABASES;", "list databases"), ("SHOW TABLES;", "list tables"), ("USE db_name;", "open a database"), ("DESC table_name;", "table structure")]),
 ("DDL · define structure", "#7f77dd", [("CREATE DATABASE db;", ""), ("CREATE TABLE t(f1 type1, f2 type2);", ""), ("DROP TABLE t;", "delete table"), ("TRUNCATE TABLE t;", "delete all rows"),
   ("ALTER TABLE t ADD col type;", "add column"), ("ALTER TABLE t MODIFY col type;", "change type"), ("ALTER TABLE t DROP col;", "remove column"), ("ALTER TABLE t CHANGE old new type;", "rename column"), ("ALTER TABLE t RENAME TO t2;", "rename table")]),
 ("DML · work with data", "#1d9e75", [("INSERT INTO t(c1, c2) VALUES(v1, v2);", ""), ("UPDATE t SET f = value WHERE cond;", ""), ("DELETE FROM t WHERE cond;", ""), ("SELECT f1, f2 FROM t;", "SELECT * = all columns")]),
 ("Clause order", "#ef9f27", [("SELECT … FROM … WHERE … GROUP BY …", ""), ("HAVING … ORDER BY … LIMIT …;", "always in this order")]),
 ("Filters", "#d4537e", [("WHERE f BETWEEN a AND b", ""), ("WHERE f LIKE 'A%'", "starts with A"), ("WHERE f IN (v1, v2)", ""), ("WHERE f IS NULL / IS NOT NULL", ""), ("SELECT DISTINCT f FROM t;", "no duplicates"), ("ORDER BY f DESC, g ASC", "sorting")]),
]
P2 = [
 ("Aggregate functions", "#ef9f27", [("SUM(f)  AVG(f)  MIN(f)  MAX(f)", ""), ("COUNT(*)  ·  COUNT(f)", "COUNT(f) skips NULLs"), ("SELECT f, COUNT(*) FROM t GROUP BY f HAVING cond;", "")]),
 ("Joins", "#7f77dd", [("SELECT * FROM t1, t2;", "Cartesian product"), ("… FROM t1, t2 WHERE t1.c = t2.c;", "equi-join"), ("… FROM t1 JOIN t2 ON t1.c = t2.c;", ""), ("… FROM t1 NATURAL JOIN t2;", "same-named columns")]),
 ("Constraints", "#d4537e", [("PRIMARY KEY", "unique, never NULL"), ("UNIQUE  ·  NOT NULL  ·  DEFAULT 'x'", ""), ("CHECK(age >= 18)  ·  AUTO_INCREMENT", ""), ("FOREIGN KEY (c) REFERENCES t2(id)", "links tables")]),
 ("Functions", "#378add", [("UPPER() LOWER() LENGTH()", ""), ("LEFT(s,n) RIGHT(s,n) MID(s,pos,n)", ""), ("INSTR(s,sub)  TRIM(s)", ""), ("POWER(a,b)  ROUND(x,d)  MOD(a,b)", ""), ("NOW() CURDATE() DAY() MONTH() YEAR()", ""), ("DAYNAME()  MONTHNAME()", "")]),
 ("Relational model", "#5dcaa5", [("Degree = columns  ·  Cardinality = rows", ""), ("Tuple = row  ·  Attribute = column", ""), ("Candidate key → Primary key (chosen) + Alternate keys", ""), ("Foreign key refers to another table's primary key", "")]),
 ("Python + MySQL", "#afa9ec", [("import mysql.connector as sql", ""), ("con = sql.connect(host=…, user=…, passwd=…, database=…)", ""), ("cur = con.cursor();  cur.execute(query)", ""), ("fetchone()  fetchall()  fetchmany(n)", "rowcount"), ("con.commit();  con.close()", "")]),
]
def sheet(title, sub, sections, n):
    blocks = ""
    for name, col, lines in sections:
        rows = "".join(f'<div class=row><code class=mono>{esc(c)}</code>{f"<span>{esc(n_)}</span>" if n_ else ""}</div>' for c, n_ in lines)
        blocks += f'<section><h3 style="color:{col}"><i style="background:{col}"></i>{esc(name)}</h3>{rows}</section>'
    css = """.wrap{position:absolute;inset:0;padding:54px 54px 0}
    header{display:flex;align-items:center;gap:22px;margin-bottom:26px}header img{width:78px;height:78px;border-radius:18px}
    header h1{font-size:46px;font-weight:800;letter-spacing:-.03em;line-height:1.05}header p{font-size:21px;color:var(--text2);margin-top:4px}
    section{background:rgba(22,22,22,.88);border:1px solid var(--border2);border-radius:20px;padding:18px 22px 14px;margin-bottom:14px}
    h3{font-size:19px;letter-spacing:.06em;text-transform:uppercase;display:flex;align-items:center;gap:10px;margin-bottom:8px}h3 i{width:10px;height:10px;border-radius:50%}
    .row{display:flex;justify-content:space-between;align-items:baseline;gap:14px;padding:5px 0;border-top:1px solid #232323}.row:first-of-type{border-top:none}
    code{font-size:19.5px;color:#e8e6ff}.row span{font-size:16.5px;color:var(--text3);white-space:nowrap}
    footer{position:absolute;left:54px;right:54px;bottom:30px;display:flex;justify-content:space-between;font-size:19px;color:var(--text3)}footer b{color:var(--pl)}"""
    return page(1080, 1350, f"""<div class="glow g1" style="width:700px;height:700px;left:-250px;top:-300px"></div><div class="glow g2" style="width:600px;height:600px;right:-250px;bottom:-300px"></div>
    <div class=wrap><header><img src="{ICON}"><div><h1>{title}</h1><p>{sub}</p></div></header>{blocks}</div>
    <footer><span>Free quizzes + live SQL lab</span><b>pavithrasajunair-ship-it.github.io/sql-web</b></footer>""", css)

# ---------------- daily question images ----------------
def pick_daily(n=30):
    ok = [i for i, q in enumerate(MCQ) if len(q["q"]) <= 120 and all(len(o) <= 52 for o in q["opts"]) and "\n" not in q["q"]]
    byt = {}
    for i in ok: byt.setdefault(MCQ[i]["topic"], []).append(i)
    order, topics = [], sorted(byt, key=lambda t: -len(byt[t]))
    while len(order) < n and any(byt.values()):
        for t in topics:
            if byt[t] and len(order) < n: order.append(byt[t].pop(0) if len(order) % 2 == 0 else byt[t].pop())
    return order
def daily_img(day, idx):
    q = MCQ[idx]
    opts = "".join(f'<div class=opt><b>{"ABCD"[i]}</b><span>{esc(o)}</span></div>' for i, o in enumerate(q["opts"]))
    css = """.wrap{position:absolute;left:70px;right:70px;top:150px}
    .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:56px}
    .tag{font-size:26px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--pl);background:var(--pbg);padding:12px 26px;border-radius:99px}
    .day{font-size:28px;color:var(--text2);font-weight:600}
    .q{font-size:62px;font-weight:750;letter-spacing:-.025em;line-height:1.16;margin-bottom:56px}
    .opt{display:flex;gap:26px;align-items:center;background:var(--surface);border:1.5px solid var(--border2);border-radius:26px;padding:30px 34px;margin-bottom:22px}
    .opt b{width:64px;height:64px;border-radius:50%;background:var(--pbg);color:var(--pl);display:flex;align-items:center;justify-content:center;font-size:30px;flex:none}
    .opt span{font-size:38px;font-weight:550;line-height:1.25}
    .cta{position:absolute;left:70px;right:70px;bottom:190px;text-align:center}
    .cta .btn{display:inline-block;background:var(--purple);color:#fff;font-weight:750;font-size:42px;padding:30px 64px;border-radius:26px;box-shadow:0 24px 80px rgba(127,119,221,.5)}
    .cta p{margin-top:26px;font-size:28px;color:var(--text2)}
    .brand{position:absolute;top:56px;left:70px;display:flex;align-items:center;gap:16px;font-size:30px;font-weight:700}.brand img{width:56px;height:56px;border-radius:14px}"""
    return page(1080, 1920, f"""<div class="glow g1" style="width:900px;height:900px;left:-350px;top:-300px"></div><div class="glow g2" style="width:800px;height:800px;right:-350px;bottom:-300px"></div>
    <div class=brand><img src="{ICON}">SQL Revision</div>
    <div class=wrap><div class=top><span class=tag>{esc(q['topic'])}</span><span class=day>Question of the day · #{day}</span></div>
    <div class=q>{esc(q['q'])}</div>{opts}</div>
    <div class=cta><div class=btn>Check your answer →</div><p>Link in bio · free · no sign-up</p></div>""", css)

if __name__ == "__main__":
    (HERE / "daily").mkdir(exist_ok=True)
    order = pick_daily(30)
    with sync_playwright() as p:
        b = p.chromium.launch()
        FIT = "(() => { const w = document.querySelector('.wrap'); if (!w || !w.querySelector('section')) return; const s = w.querySelectorAll('section'); const bottom = s[s.length - 1].getBoundingClientRect().bottom; if (bottom > 1285) w.style.zoom = 1285 / bottom; })()"
        def shot(htm, out, w, h, **kw):
            pg = b.new_page(viewport={"width": w, "height": h}); pg.set_content(htm); pg.wait_for_timeout(250)
            if "cheatsheet" in str(out): pg.evaluate(FIT)       # long pages shrink to fit above the footer
            pg.screenshot(path=str(out), **kw); pg.close()
        shot(OG, ROOT / "src/og.png", 1200, 630); (HERE / "og.png").write_bytes((ROOT / "src/og.png").read_bytes())
        shot(sheet("Class 12 SQL cheat sheet", "Page 1 · Define, change and query data", P1, 1), HERE / "cheatsheet-1.png", 1080, 1350)
        shot(sheet("Class 12 SQL cheat sheet", "Page 2 · Aggregates, joins, functions, Python + MySQL", P2, 2), HERE / "cheatsheet-2.png", 1080, 1350)
        for d, idx in enumerate(order, 1):
            shot(daily_img(d, idx), HERE / "daily" / f"day-{d:02d}.jpg", 1080, 1920, type="jpeg", quality=88)
        b.close()
    ims = [Image.open(HERE / f"cheatsheet-{i}.png").convert("RGB") for i in (1, 2)]
    ims[0].save(HERE / "Class12-SQL-cheatsheet.pdf", save_all=True, append_images=ims[1:], resolution=130)
    lines = ["# 30-day question-of-the-day schedule", "", f"Each image links to the answer in the app. Post the image, put the link in your bio or a link sticker.", ""]
    for d, idx in enumerate(order, 1):
        q = MCQ[idx]
        lines += [f"## Day {d} · {q['topic']}", f"- Image: `daily/day-{d:02d}.jpg`", f"- Link: {SITE}#q={idx}", f"- Answer (keep private until the next day): **{'ABCD'[q['correct']]}. {q['opts'][q['correct']]}**", f"- Why: {q['exp']}",
                  f"- Caption: Can you get this one right? 👇 Tap the link in bio to check your answer, then try more. #SQL #Class12 #ComputerScience #BoardExams", ""]
    (HERE / "daily" / "schedule.md").write_text("\n".join(lines))
    import shutil; shutil.copy(HERE / "Class12-SQL-cheatsheet.pdf", ROOT / "src" / "Class12-SQL-cheatsheet.pdf")   # served from the site
    print("done", order)
