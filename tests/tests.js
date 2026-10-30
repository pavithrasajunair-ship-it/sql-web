// Unit tests for the question data and the grader. Run: node tests/tests.js
const assert = require('assert');
const {TOPICS, MCQ, TYPE_Q} = require('../src/data.js');
const G = require('../src/grader.js');

let passed = 0, failed = 0;
function t(name, fn) { try { fn(); passed++; } catch (e) { failed++; console.log('FAIL:', name, '\n   ', e.message); } }

/* ---------- data integrity ---------- */
t('topics: unique card ids, non-empty text', () => {
  const ids = new Set();
  for (const tp of TOPICS) for (const c of tp.cards) {
    const id = tp.id + ':' + c.k;
    assert(!ids.has(id), 'duplicate card ' + id); ids.add(id);
    assert(c.k && c.d, 'empty field in ' + id);
  }
});
t('mcq: 4 distinct options, valid answer index, explanation, unique question', () => {
  const seen = new Set();
  for (const q of MCQ) {
    assert(!seen.has(q.q), 'duplicate question: ' + q.q); seen.add(q.q);
    assert.strictEqual(q.opts.length, 4, q.q);
    assert.strictEqual(new Set(q.opts).size, 4, 'duplicate options: ' + q.q);
    assert(Number.isInteger(q.correct) && q.correct >= 0 && q.correct < 4, 'bad index: ' + q.q);
    assert(q.exp && q.topic, 'missing exp/topic: ' + q.q);
  }
});
t('mcq: correct answers are spread across positions (not all the same slot)', () => {
  const c = [0, 0, 0, 0]; MCQ.forEach(q => c[q.correct]++);
  assert(c.every(n => n > 0), 'positions ' + c);
});
t('type: every question has given/answer/accept/names', () => {
  const seen = new Set();
  for (const q of TYPE_Q) {
    assert(!seen.has(q.q), 'duplicate: ' + q.q); seen.add(q.q);
    assert(q.q && q.given && q.answer && q.topic, 'missing field: ' + q.q);
    assert(Array.isArray(q.accept) && q.accept.length, 'no accept: ' + q.q);
    assert(Array.isArray(q.names), 'no names: ' + q.q);
  }
});
t('type: every accept pattern compiles and does not start with an optional part', () => {
  for (const q of TYPE_Q) for (const p of q.accept) G.matcher(p);
});

/* ---------- grading ---------- */
const words = s => G.tokenize(s).filter(x => x.type === 'word');

for (const q of TYPE_Q) {
  const label = q.answer;
  t('model answer passes: ' + label, () => assert(G.grade(q, q.answer, true).correct));
  t('no trailing ; / extra spaces / line breaks: ' + label, () => {
    const messy = '  ' + q.answer.replace(/;$/, '').replace(/ /g, '\n  ') + '  ;; ';
    assert(G.grade(q, messy, true).correct, messy);
  });
  t('keywords in lower case pass: ' + label, () => {
    // lower-case everything except the case-sensitive names (names in the model answers are already lower-case)
    assert(G.grade(q, q.answer.toLowerCase(), true).correct);
  });
  t('keywords in UPPER case pass when names keep their case: ' + label, () => {
    const names = new Set(q.names);
    const out = q.answer.replace(/'[^']*'|"[^"]*"|[A-Za-z_][A-Za-z0-9_]*/g, m => /^['"]/.test(m) ? m : (names.has(m) ? m : m.toUpperCase()));
    assert(G.grade(q, out, true).correct, out);
  });
  t('keywords in mixed case pass: ' + label, () => {
    const names = new Set(q.names);
    let i = 0;
    const out = q.answer.replace(/'[^']*'|"[^"]*"|[A-Za-z_][A-Za-z0-9_]*/g, m => /^['"]/.test(m) ? m : (names.has(m) ? m : (i++ % 2 ? m.toUpperCase() : m.toLowerCase())));
    assert(G.grade(q, out, true).correct, out);
  });
  for (const n of q.names) {
    t(`wrong-case name "${n}" fails when strict, passes when lenient: ` + label, () => {
      const bad = q.answer.replace(new RegExp('\\b' + n + '\\b'), n.toUpperCase());
      assert.notStrictEqual(bad, q.answer, 'name not found in model answer');
      const g = G.grade(q, bad, true);
      assert(!g.correct && g.nameIssue && g.nameIssue.expected === n, JSON.stringify(g));
      assert(G.grade(q, bad, false).correct, 'lenient mode should accept');
    });
  }
  t('removing the last word fails: ' + label, () => {
    if (q.accept.some(p => p.trim().endsWith(']'))) return;     // last word is optional (e.g. ASC)
    const toks = q.answer.replace(/;$/, '').trim().split(/\s+/);
    toks.pop();
    assert(!G.grade(q, toks.join(' '), true).correct);
  });
  t('empty answer is flagged empty: ' + label, () => assert(G.grade(q, '   ;  ', true).empty));
}

t('string values are not case-sensitive (Rahul / rahul / RAHUL)', () => {
  const q = TYPE_Q.find(x => x.answer.startsWith('INSERT INTO students(rollno, name)'));
  for (const v of ['Rahul', 'rahul', 'RAHUL'])
    assert(G.grade(q, `insert into students(rollno,name) values(1,"${v}")`, true).correct, v);
});
t('single and double quotes are interchangeable', () => {
  const q = TYPE_Q.find(x => x.answer.includes("LIKE 'A%'"));
  assert(G.grade(q, 'select * from students where name like "A%"', true).correct);
});
t('wrong string value fails', () => {
  const q = TYPE_Q.find(x => x.answer.includes("LIKE 'A%'"));
  assert(!G.grade(q, "select * from students where name like 'B%'", true).correct);
});
t('wrong number fails (marks > 80 vs > 8)', () => {
  const q = TYPE_Q.find(x => x.answer.includes('marks > 80'));
  assert(!G.grade(q, 'select * from students where marks > 8 order by marks desc', true).correct);
});
t('wrong operator / sort order fails', () => {
  const q = TYPE_Q.find(x => x.answer.includes('marks > 80'));
  assert(!G.grade(q, 'select * from students where marks < 80 order by marks desc', true).correct);
  assert(!G.grade(q, 'select * from students where marks > 80 order by marks asc', true).correct);
});
t('extra statement after the answer fails', () => {
  const q = TYPE_Q.find(x => x.answer === 'DROP TABLE students;');
  assert(!G.grade(q, 'drop table students; drop table result;', true).correct);
});
t('a different valid query for another question does not pass', () => {
  const q = TYPE_Q.find(x => x.answer === 'DROP TABLE students;');
  assert(!G.grade(q, 'truncate table students', true).correct);
});
t('smart quotes and backticks are tolerated', () => {
  const q = TYPE_Q.find(x => x.answer.includes("LIKE 'A%'"));
  assert(G.grade(q, 'select * from `students` where name like ‘A%’', true).correct);
});
t('alias after AVG(marks) is accepted but a different function is not', () => {
  const q = TYPE_Q.find(x => x.answer === 'SELECT AVG(marks) FROM students;');
  assert(G.grade(q, 'select avg(marks) as average from students', true).correct);
  assert(!G.grade(q, 'select sum(marks) from students', true).correct);
});
t('CREATE TABLE accepts several valid forms', () => {
  const q = TYPE_Q.find(x => x.answer.startsWith('CREATE TABLE students(id INT PRIMARY KEY'));
  for (const s of [
    'create table students(id int primary key, name varchar(30) not null);',
    'CREATE TABLE students (id INT, name VARCHAR(50) NOT NULL, PRIMARY KEY (id));',
    'create table students(name char(20) not null, id int primary key)'])
    assert(G.grade(q, s, true).correct, s);
  assert(!G.grade(q, 'create table students(id int primary key, name varchar(30));', true).correct, 'missing NOT NULL');
});
t('JOIN accepts ON-form and WHERE-form', () => {
  const q = TYPE_Q.find(x => x.answer.includes('JOIN result ON'));
  for (const s of [
    'select * from students join result on students.rollno = result.rollno',
    'select * from students inner join result on result.rollno=students.rollno',
    'select * from students, result where students.rollno=result.rollno'])
    assert(G.grade(q, s, true).correct, s);
});
t('alternation tokens work (RENAME TO / AS, DESC / DESCRIBE, VALUE / VALUES)', () => {
  assert(G.grade(TYPE_Q.find(x => x.answer.startsWith('ALTER TABLE students RENAME')), 'alter table students rename as learners', true).correct);
  assert(G.grade(TYPE_Q.find(x => x.answer === 'DESC students;'), 'describe students', true).correct);
  assert(G.grade(TYPE_Q.find(x => x.answer.startsWith('INSERT INTO students(rollno, name)')), "insert into students(rollno,name) value(1,'Rahul')", true).correct);
});
t('<> and != are treated the same by the tokenizer', () => {
  assert.strictEqual(G.tokenize('a <> b').map(x => x.norm).join(' '), G.tokenize('a != b').map(x => x.norm).join(' '));
});

/* ---------- ambiguity: a model answer must not be accepted by a *different* question ---------- */
t('no model answer is accepted by another question', () => {
  for (const a of TYPE_Q) for (const b of TYPE_Q) {
    if (a === b) continue;
    assert(!G.grade(b, a.answer, false).correct, `"${a.answer}" is also accepted for "${b.q}"`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
