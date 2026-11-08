// Verifies the board-style practice papers by running every answer in the site's own SQL engine. Run: node tests/papers.test.js
const assert = require('assert');
global.SQLEngine = require('../src/sqlengine.js'); global.esc = s => String(s);
const L = require('../src/lab.js'); global.freshDb = L.freshDb; global.gradeQuest = L.gradeQuest;
const P = require('../src/papers.js');
let passed = 0, failed = 0;
function t(name, fn) { try { fn(); passed++; } catch (e) { failed++; console.log('FAIL:', name, '\n   ', e.message); } }
const run = (db, sql) => { const d = L.freshDb(db), r = SQLEngine.run(d, sql); assert(!r.error, sql + ' -> ' + (r.error && r.error.message)); return {d, r}; };
const norm = v => v === null ? 'NULL' : typeof v === 'number' ? String(+v.toFixed(4)) : String(v);
const same = (a, b) => assert.deepStrictEqual(a.map(r => r.map(norm)), b.map(r => r.map(norm)));

t('four papers, 25 marks each', () => { assert.strictEqual(P.PAPERS.length, 4); P.PAPERS.forEach(p => assert.strictEqual(P.paperTotal(p), 25, p.id)); });
t('papers never claim to be real past papers', () => { const s = JSON.stringify(P.PAPERS.map(p => [p.title, p.blurb])); assert(!/PYQ|previous.year|past.paper|actual/i.test(s)); });
for (const p of P.PAPERS) {
  t(p.id + ': MCQ shape, spread answers, explanations', () => {
    assert.strictEqual(p.mcq.length, 6);
    p.mcq.forEach(q => { assert.strictEqual(q.opts.length, 4); assert.strictEqual(new Set(q.opts).size, 4, q.q); assert(q.correct >= 0 && q.correct < 4 && q.exp, q.q); });
    assert(new Set(p.mcq.map(q => q.correct)).size >= 3, 'answers all in few slots');
  });
  p.mcq.filter(q => q.v).forEach(q => t(p.id + ' MCQ answer verified in engine: ' + q.q, () => {
    const row = run(p.db, q.v.sql).r.results[0].rows[0], want = [].concat(q.v.val);
    assert.deepStrictEqual(row.map(norm), want.map(norm));
    assert.strictEqual(norm(q.v.val instanceof Array ? q.v.val[0] : q.v.val), norm(row[0]));
    if (!(q.v.val instanceof Array)) assert.strictEqual(norm(q.opts[q.correct]), norm(q.v.val), 'marked option is not the engine value');
  }));
  p.out.forEach((q, i) => t(p.id + ' B' + (i + 1) + ' written output equals engine output', () => {
    same(run(p.db, q.sql).r.results[0].rows, q.out);
    assert.strictEqual(P.paperGradeOut(q, q.out.map(r => r.join(' ')).join('\n')).got, 2);
    assert.strictEqual(P.paperGradeOut(q, '').got, 0);
    assert.strictEqual(P.paperGradeOut(q, 'banana 99').got, 0);
  }));
  [...p.wr.map(q => [q, 2]), ...p.c.map(q => [q, 3])].forEach(([q, m], i) => {
    t(p.id + ' model answer earns full marks: ' + q.task.slice(0, 50), () => { const r = P.paperGradeSql({...q, db: p.db}, q.sol, m); assert.strictEqual(r.got, m, r.msg); assert(r.steps.every(Boolean)); });
    t(p.id + ' scheme steps add up to marks and match the model answer: ' + q.task.slice(0, 40), () => {
      assert.strictEqual(q.scheme.reduce((a, s) => a + s.m, 0), m);
      q.scheme.forEach(s => assert(s.re.test(q.sol), 'step regex misses the model answer: ' + s.d));
    });
    t(p.id + ' empty / wrong answer does not earn full marks: ' + q.task.slice(0, 40), () => {
      assert.strictEqual(P.paperGradeSql({...q, db: p.db}, '', m).got, 0);
      assert(P.paperGradeSql({...q, db: p.db}, 'SELECT * FROM ' + Object.keys(L.freshDb(p.db).tables)[0], m).got < m);
    });
  });
  p.c.forEach(q => t(p.id + ' C query returns a non-empty table: ' + q.task.slice(0, 40), () => assert(run(p.db, q.sol).r.results[0].rows.length > 0)));
}
t('ordered C answers: wrong order is not full marks', () => {
  const q = {...P.PAPERS[1].c[2], db: 'company'};
  assert(P.paperGradeSql(q, q.sol.replace('DESC', 'ASC'), 3).got < 3);
});
t('UPDATE / DELETE questions: statement that changes the wrong rows loses marks', () => {
  const u = {...P.PAPERS[1].wr[1], db: 'company'}; assert(P.paperGradeSql(u, 'UPDATE emp SET salary = salary * 1.1', 2).got < 2);
  assert.strictEqual(P.paperGradeSql(u, 'UPDATE emp SET salary = salary + salary * 10 / 100 WHERE dept = "Sales"', 2).got, 2);
  const d = {...P.PAPERS[3].wr[1], db: 'library'}; assert(P.paperGradeSql(d, 'DELETE FROM issue', 2).got < 2);
});
t('restore rejects tampered data', () => {
  assert.strictEqual(P.paperRestore({id: 'nope'}), null); assert.strictEqual(P.paperRestore(null), null);
  const ok = P.paperRestore({id: 'bp1', m: [0, 9, null, 1, 2, 3], o: ['', '', ''], w: ['', ''], c: ['', '', ''], used: -5, limit: 'x', done: 1});
  assert.strictEqual(ok.m[1], null); assert.strictEqual(ok.used, 0); assert.strictEqual(ok.limit, 2400);
});
console.log(`papers: ${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
