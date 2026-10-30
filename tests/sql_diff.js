// Differential test: our engine vs real SQLite (python) on the same data + queries. Run: node tests/sql_diff.js
const {execFileSync} = require('child_process');
global.SQLEngine = require('../src/sqlengine.js'); global.esc = s => s; global.lab = {};
const L = require('../src/lab.js');
const Q = [
 "SELECT * FROM student", "SELECT name, marks*2 FROM student WHERE marks>=70 ORDER BY marks DESC, name",
 "SELECT DISTINCT city FROM student ORDER BY city", "SELECT class, COUNT(*), AVG(marks), MAX(marks), MIN(marks), SUM(marks) FROM student GROUP BY class ORDER BY class",
 "SELECT city, COUNT(*) FROM student GROUP BY city HAVING COUNT(*) > 1 ORDER BY city", "SELECT name FROM student WHERE marks IS NULL",
 "SELECT name FROM student WHERE name LIKE 'A%' OR name LIKE '%a' ORDER BY name", "SELECT name FROM student WHERE marks BETWEEN 60 AND 90 ORDER BY name",
 "SELECT name FROM student WHERE city IN ('Delhi','Pune') AND class=12 ORDER BY name", "SELECT name FROM student WHERE NOT (city='Delhi') ORDER BY name",
 "SELECT name, club FROM student JOIN club ON student.roll=club.roll ORDER BY name, club", "SELECT s.name, c.club FROM student s LEFT JOIN club c ON s.roll=c.roll ORDER BY s.name, c.club",
 "SELECT COUNT(DISTINCT city) FROM student", "SELECT COUNT(marks), COUNT(*) FROM student", "SELECT name FROM student ORDER BY marks DESC LIMIT 3",
 "SELECT name FROM student ORDER BY marks LIMIT 2, 3", "SELECT UPPER(name), LENGTH(name), SUBSTR(name,1,2) FROM student ORDER BY roll",
 "SELECT ROUND(AVG(marks),2) FROM student", "SELECT name, CASE WHEN marks>=80 THEN 'A' WHEN marks>=60 THEN 'B' ELSE 'C' END FROM student ORDER BY roll",
 "SELECT class, section, COUNT(*) FROM student GROUP BY class, section ORDER BY class, section", "SELECT name FROM student WHERE marks > (1+2)*20 ORDER BY name",
 "SELECT COUNT(*) FROM student, club", "SELECT dept, SUM(salary), COUNT(*) FROM emp GROUP BY dept ORDER BY dept", "SELECT name FROM emp WHERE salary > 60000 ORDER BY name",
 "SELECT name, head FROM emp JOIN dept ON emp.dept=dept.dept ORDER BY name", "SELECT dept.dept, COUNT(emp.empid) FROM dept LEFT JOIN emp ON dept.dept=emp.dept GROUP BY dept.dept ORDER BY dept.dept",
 "SELECT name FROM emp WHERE CAST(strftime('%Y', joined) AS INT) > 2020 ORDER BY name|SELECT name FROM emp WHERE YEAR(joined) > 2020 ORDER BY name",
 "SELECT MAX(salary), MIN(salary) FROM emp WHERE dept='IT'",
 "SELECT pname FROM product LEFT JOIN orders ON product.pid = orders.pid WHERE orders.oid IS NULL ORDER BY pname", "SELECT customer, pname, price*qty FROM orders JOIN product ON orders.pid=product.pid ORDER BY oid",
 "SELECT category, COUNT(*), SUM(price*stock) FROM product GROUP BY category ORDER BY category", "SELECT team, SUM(runs) FROM player GROUP BY team HAVING SUM(runs) > 7000 ORDER BY team",
 "SELECT name, city FROM player JOIN team ON player.team = team.team WHERE titles >= 5 ORDER BY name", "SELECT name FROM player ORDER BY wickets DESC LIMIT 1",
 "SELECT title, member FROM book JOIN issue ON book.bookid = issue.bookid WHERE returned IS NULL ORDER BY title, member", "SELECT genre, SUM(price) FROM book GROUP BY genre ORDER BY genre",
 "SELECT title FROM book WHERE year BETWEEN 1900 AND 1950 ORDER BY title", "SELECT name FROM emp WHERE salary IS NOT NULL ORDER BY salary DESC LIMIT 1",
 "SELECT dept, AVG(salary) a FROM emp GROUP BY dept HAVING a > 50000 ORDER BY dept|SELECT dept, AVG(salary) a FROM emp GROUP BY dept HAVING AVG(salary) > 50000 ORDER BY dept",
];
const cases = Q.map(q => q.includes('|') ? q.split('|') : [q, q]);
const py = `
import sqlite3, json, sys
seeds = json.loads(sys.argv[1]); cases = json.loads(sys.argv[2]); out = []
c = sqlite3.connect(':memory:')
for s in seeds: c.executescript(s)
for q in cases:
    try: out.append(c.execute(q).fetchall())
    except Exception as e: out.append('ERR ' + str(e))
print(json.dumps(out))`;
const seeds = Object.values(L.SEEDS).map(s => s.sql);
const ref = JSON.parse(execFileSync('python3', ['-c', py, JSON.stringify(seeds), JSON.stringify(cases.map(c => c[0]))]).toString());
const db = SQLEngine.newDb(); seeds.forEach(s => { const r = SQLEngine.run(db, s); if (r.error) throw r.error; });
const norm = v => v === null ? null : typeof v === 'number' ? +v.toFixed(6) : v;
let fail = 0;
cases.forEach((c, i) => {
  const r = SQLEngine.run(SQLEngine.clone(db), c[1]);
  const mine = r.error ? 'ERR ' + r.error.message : JSON.stringify(r.results.at(-1).rows.map(x => x.map(norm)));
  const theirs = typeof ref[i] === 'string' ? ref[i] : JSON.stringify(ref[i].map(x => x.map(norm)));
  if (mine !== theirs) { fail++; console.log('DIFF', c[1], '\n  mine  ', mine, '\n  sqlite', theirs); }
});
console.log(`${cases.length - fail}/${cases.length} identical to SQLite`); process.exit(fail ? 1 : 0);
