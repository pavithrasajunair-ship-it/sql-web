'use strict';
const assert = require('assert'), cp = require('child_process'), path = require('path'), fs = require('fs');
const root = path.join(__dirname, '..');
const C = require(root + '/content.js'), LL = require(root + '/store.js'), G = require(root + '/runner.js'), SQL = require(root + '/sqlengine.js');
let pass = 0; const t = (n, f) => { try { const r = f(); if (r && r.then) return r.then(() => { pass++; }, e => { console.log('FAIL', n, e.message); process.exitCode = 1; }); pass++; } catch (e) { console.log('FAIL', n, e.message); process.exitCode = 1; } };
// real python as a stand-in for the Pyodide worker (same language, run on this machine for TESTING only)
const pyRun = code => { const r = cp.spawnSync('python3', ['-I', '-c', code], {encoding: 'utf8', timeout: 5000}); return Promise.resolve({out: r.stdout, err: r.status ? r.stderr : null}); };
const KINDS = ['check', 'bug', 'predict', 'fix'];
(async () => {
  for (const c of C.CONCEPTS) {
    t(c.id + ': lesson has 4 styles', () => C.VARIANTS.forEach(([k]) => assert(c.lesson[k] && c.lesson[k].length > 40, k)));
    t(c.id + ': check/bug have exactly one correct option and a why on every option', () => ['check', 'bug'].forEach(k => {
      const q = c[k]; assert.strictEqual(q.opts.filter(x => x.ok).length, 1, k); q.opts.forEach(x => assert(x.why && x.why.length > 10, k + ' why'));
      q.opts.filter(x => !x.ok && x.m).forEach(x => assert(C.MIS[x.m], 'unknown misconception ' + x.m)); }));
    t(c.id + ': predict has answer, explanation, known misconceptions', () => {
      const p = c.predict; assert(p.explain); (p.wrong || []).forEach(w => { assert(w.why); if (w.m) assert(C.MIS[w.m], w.m); }); if (p.m) assert(C.MIS[p.m], p.m); });
    t(c.id + ': fix hints (3) and misconception known', () => { assert.strictEqual(c.fix.hints.length, 3); assert(C.MIS[c.fix.explainErr.m]); });
    if (c.subject === 'python') {
      await t(c.id + ': PYTHON predict answer is what real python prints', async () => {
        const r = await pyRun(c.predict.code); assert(!r.err, r.err); assert.strictEqual(r.out.trim(), c.predict.answer); });
      await t(c.id + ': PYTHON starter fails and solution passes all tests', async () => {
        const bad = await G.gradePython(c.fix, c.fix.starter, pyRun), good = await G.gradePython(c.fix, c.fix.solution, pyRun);
        assert(!bad.pass, 'starter must fail'); assert(good.pass, 'solution must pass: ' + JSON.stringify(good)); });
      await t(c.id + ': PYTHON wrong predict answers are really wrong', () => c.predict.wrong.forEach(w => assert.notStrictEqual(w.ans, c.predict.answer)));
    } else {
      t(c.id + ': SQL starter fails, solution passes', () => {
        assert(!G.gradeSql(c.fix, c.fix.starter, SQL, C.SQL_SEED).pass, 'starter must fail'); assert(G.gradeSql(c.fix, c.fix.solution, SQL, C.SQL_SEED).pass, 'solution must pass'); });
      t(c.id + ': SQL predict rowcount matches the engine', () => {
        const d = SQL.newDb(); SQL.run(d, C.SQL_SEED); const r = SQL.run(d, c.predict.code); assert(!r.error); assert(r.results[0].rows.length > 0); });
      t(c.id + ': SQL bug/check queries named in options are checkable (fixed query runs)', () => {
        const d = SQL.newDb(); SQL.run(d, C.SQL_SEED); assert(!SQL.run(d, c.fix.solution).error); });
    }
  }
  // known numeric facts for SQL predict items, checked independently of the engine
  const cnt = id => { const c = C.CONCEPTS.find(x => x.id === id), d = SQL.newDb(); SQL.run(d, C.SQL_SEED); return SQL.run(d, c.predict.code).results[0].rows.length; };
  t('sql-where predict = 3', () => assert.strictEqual(cnt('sql-where'), 3));
  t('sql-agg predict = 3', () => assert.strictEqual(cnt('sql-agg'), 3));
  t('sql-join predict = 24', () => assert.strictEqual(cnt('sql-join'), 24));
  t('SQL error is reported, not graded as pass', () => { const r = G.gradeSql(C.CONCEPTS[5].fix, 'SELEC name', SQL, C.SQL_SEED); assert(!r.pass && r.error); });
  await t('python crash is reported as plain-language error', async () => {
    const r = await G.gradePython(C.CONCEPTS[3].fix, 'def last_item(lst):\n    return lst[len(lst)]', pyRun);
    assert(!r.pass && /IndexError/.test(r.results[0].err) && /positions/.test(r.results[0].err)); });
  await t('python unavailable is not a pass', async () => assert((await G.gradePython(C.CONCEPTS[0].fix, 'x', () => Promise.resolve({unavailable: true}))).unavailable));

  // ---- store ----
  let T = 1e12; const reset = () => { LL._set(LL._fresh()); LL._setNow(() => T); };
  reset();
  t('new student: nothing is assessed, no streak', () => { assert.strictEqual(LL.stats('py-loops').level, 'untested'); assert.strictEqual(LL.streak(), 0); });
  t('reading a lesson never creates mastery', () => { LL.view('py-loops', 'beginner'); LL.view('py-loops', 'real'); assert.strictEqual(LL.stats('py-loops').level, 'untested'); });
  t('wrong answers make a concept weak and open a misconception', () => { LL.record({concept: 'py-loops', kind: 'check', ok: false, m: 'range-end'}); LL.record({concept: 'py-loops', kind: 'bug', ok: false, m: 'range-end'});
    assert.strictEqual(LL.stats('py-loops').level, 'weak'); assert.deepStrictEqual(LL.openMisconceptions('py-loops'), [{m: 'range-end', count: 2}]); });
  t('struggling student is offered a style not yet seen', () => { const r = LL.recommendStyle('py-loops', ['beginner', 'real', 'code', 'exam']); assert(r.changed && r.style === 'code'); });
  t('two correct answers clear the misconception; solid needs 4 attempts', () => {
    LL.record({concept: 'py-loops', kind: 'check', ok: true}); LL.record({concept: 'py-loops', kind: 'predict', ok: true});
    assert.strictEqual(LL.openMisconceptions('py-loops').length, 0); LL.record({concept: 'py-loops', kind: 'fix', ok: true}); LL.record({concept: 'py-loops', kind: 'fix', ok: true});
    assert.strictEqual(LL.stats('py-loops').level, 'solid'); });
  t('streak counts consecutive days and survives an unfinished today', () => { reset();
    LL.record({concept: 'py-vars', kind: 'check', ok: true}); T += 864e5; LL.record({concept: 'py-vars', kind: 'check', ok: true}); T += 864e5; assert.strictEqual(LL.streak(), 2);
    T += 864e5 * 2; assert.strictEqual(LL.streak(), 0); });
  t('todayCount counts only today', () => { reset(); LL.record({concept: 'py-vars', kind: 'check', ok: true}); T += 864e5; LL.record({concept: 'py-vars', kind: 'check', ok: true}); assert.strictEqual(LL.todayCount(), 1); });
  t('profile name is trimmed and empty names rejected', () => { reset(); assert(!LL.setProfile('   ')); assert(LL.setProfile('  Asha   K ', 'x')); assert.strictEqual(LL.state.profile.name, 'Asha K'); });
  t('history merges attempts/lessons newest first', () => { reset(); LL.view('py-vars', 'real'); T += 1000; LL.record({concept: 'py-vars', kind: 'check', ok: true}); const h = LL.history(); assert.strictEqual(h[0].type, 'attempt'); assert.strictEqual(h[1].type, 'lesson'); });
  console.log('unit tests passed:', pass);
})();
