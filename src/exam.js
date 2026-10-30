'use strict';
/* ===== Mock exam: one paper (MCQ + typed answers + real SQL practical), timed, marked only at the end ===== */
const EXAM = {mcq: 15, type: 5, sql: 3, secs: 2700, w: {m: 1, t: 2, s: 3}};
EXAM.total = EXAM.mcq * EXAM.w.m + EXAM.type * EXAM.w.t + EXAM.sql * EXAM.w.s;
let exam = null, examTickId = null, examLast = 0, examSaveT = 0;

function examNew() {
  const sql = shuffle(QUESTS).slice(0, EXAM.sql).sort((a, b) => a.lvl - b.lvl).map(q => q.id);
  return {
    mcq: shuffle(MCQ).slice(0, EXAM.mcq).map(b => ({q: b.q, order: shuffle(b.opts.map((_, i) => i))})),
    type: shuffle(TYPE_Q).slice(0, EXAM.type).map(q => q.q), sql,
    m: Array(EXAM.mcq).fill(null), t: Array(EXAM.type).fill(''), s: Array(EXAM.sql).fill(''),
    used: 0, limit: EXAM.secs, done: false,
  };
}
function examRestore(r) {                       // saved data may be old or tampered with: rebuild only if every part is valid
  try {
    if (!r || typeof r !== 'object') return null;
    const mq = new Map(MCQ.map(q => [q.q, q])), tq = new Map(TYPE_Q.map(q => [q.q, q]));
    if (![r.mcq, r.type, r.sql, r.m, r.t, r.s].every(Array.isArray)) return null;
    if (r.mcq.length !== r.m.length || r.type.length !== r.t.length || r.sql.length !== r.s.length || !r.mcq.length) return null;
    if (!r.mcq.every(x => x && mq.has(x.q) && isPerm(x.order, mq.get(x.q).opts.length))) return null;
    if (!r.type.every(q => tq.has(q)) || !r.sql.every(id => QUESTS.some(q => q.id === id))) return null;
    return {
      mcq: r.mcq.map(x => ({q: x.q, order: x.order})), type: r.type.slice(), sql: r.sql.slice(),
      m: r.m.map((v, i) => Number.isInteger(v) && v >= 0 && v < r.mcq[i].order.length ? v : null),
      t: r.t.map(v => typeof v === 'string' ? v.slice(0, 2000) : ''), s: r.s.map(v => typeof v === 'string' ? v.slice(0, 2000) : ''),
      used: Number.isFinite(r.used) && r.used >= 0 ? r.used : 0, limit: Number.isFinite(r.limit) && r.limit > 0 ? r.limit : EXAM.secs, done: !!r.done,
    };
  } catch (e) { return null; }
}
const examQs = () => ({
  mcq: exam.mcq.map(x => buildMcq(MCQ.find(b => b.q === x.q), x.order)),
  type: exam.type.map(q => TYPE_Q.find(b => b.q === q)),
  sql: exam.sql.map(id => QUESTS.find(q => q.id === id)),
});
function examGrade() {
  const Q = examQs();
  const m = Q.mcq.map((q, i) => exam.m[i] === q.correct);
  const t = Q.type.map((q, i) => { if (!exam.t[i].trim()) return false; const g = SQLGrader.grade(q, exam.t[i], strictNames); return !!g.correct; });
  const s = Q.sql.map((q, i) => exam.s[i].trim() ? gradeSql(q.id, exam.s[i]) : {ok: false, msg: 'Not attempted'});
  const marks = {m: m.filter(Boolean).length * EXAM.w.m, t: t.filter(Boolean).length * EXAM.w.t, s: s.filter(x => x.ok).length * EXAM.w.s};
  return {Q, m, t, s, marks, total: marks.m + marks.t + marks.s};
}

function stopExamTick() { clearInterval(examTickId); examTickId = null; }
function startExamTick() { stopExamTick(); if (!exam || exam.done) return; examLast = Date.now(); examTickId = setInterval(examTick, 1000); }
function examTick() {
  if (!exam || exam.done || currentMode !== 'practice') return stopExamTick();
  const now = Date.now(); exam.used += (now - examLast) / 1000; examLast = now;
  const left = Math.ceil(exam.limit - exam.used);
  if (left <= 0) { exam.used = exam.limit; return examSubmit(true); }
  const el = $('#extimer'); if (el) { el.textContent = '⏱ ' + fmtTime(left); el.classList.toggle('warn', left <= 300); }
  if (left % 15 === 0) save();
}
function examInput(el) {
  if (!exam || exam.done) return;
  const k = el.dataset.ex, i = +el.dataset.i;
  if (k === 'm') exam.m[i] = +el.value; else if (k === 't' || k === 's') exam[k][i] = el.value.slice(0, 2000); else return;
  clearTimeout(examSaveT); examSaveT = setTimeout(save, 400);
}

function renderExam() {
  if (!exam) return;
  if (exam.done) return renderExamResult();
  const Q = examQs(), left = Math.max(0, Math.ceil(exam.limit - exam.used));
  root.innerHTML = `<div class="exam">
    <div class="exam-bar"><button class="btn" data-action="examexit">✕ Exit</button>
      <span id="extimer" class="qtimer${left <= 300 ? ' warn' : ''}">⏱ ${fmtTime(left)}</span>
      <button class="btn primary" data-action="examsubmit">Submit paper</button></div>
    <p class="res-meta">Total ${EXAM.total} marks · answers and marks appear only after you submit · your answers are saved automatically</p>
    <h3 class="ex-sec">Section A · Multiple choice <span>${EXAM.w.m} mark each</span></h3>
    ${Q.mcq.map((q, i) => `<div class="ex-q"><div class="ex-qt"><b>${i + 1}.</b> ${esc(q.q)} <span class="quiz-tag" style="${tagStyle(q.topic)}">${esc(q.topic)}</span></div>
      ${q.opts.map((o, j) => `<label class="ex-opt"><input type="radio" name="m${i}" data-ex="m" data-i="${i}" value="${j}" ${exam.m[i] === j ? 'checked' : ''}> <span>${esc(o)}</span></label>`).join('')}</div>`).join('')}
    <h3 class="ex-sec">Section B · Write the answer <span>${EXAM.w.t} marks each</span></h3>
    ${Q.type.map((q, i) => `<div class="ex-q"><div class="ex-qt"><b>${i + 1}.</b> ${esc(q.q)}</div>
      <textarea class="sql" rows="2" spellcheck="false" data-ex="t" data-i="${i}" placeholder="Type your SQL answer…">${esc(exam.t[i])}</textarea></div>`).join('')}
    <h3 class="ex-sec">Section C · SQL practical <span>${EXAM.w.s} marks each · runs on a real database</span></h3>
    ${Q.sql.map((q, i) => `<div class="ex-q"><div class="ex-qt"><b>${i + 1}.</b> ${esc(q.task)}</div>
      <details class="lab-schema"><summary>${SEEDS[q.db].label} database</summary>${schemaHtml(q.db)}</details>
      <textarea class="sql" rows="4" spellcheck="false" data-ex="s" data-i="${i}" placeholder="Write your query…">${esc(exam.s[i])}</textarea></div>`).join('')}
    <div class="btn-row"><button class="btn primary" data-action="examsubmit">Submit paper</button></div></div>`;
  startExamTick();
}

function examSubmit(auto) {
  if (!exam || exam.done) return;
  const blank = exam.m.filter(v => v === null).length + exam.t.filter(v => !v.trim()).length + exam.s.filter(v => !v.trim()).length;
  if (auto !== true && blank && !confirm(`${blank} question${blank === 1 ? ' is' : 's are'} unanswered. Submit anyway?`)) return;
  exam.done = true; stopExamTick(); touchStreak(); save(); renderExamResult();
}

function renderExamResult() {
  const g = examGrade(), pct = Math.round(g.total / EXAM.total * 100), up = exam.used >= exam.limit;
  const weak = {};                                // topics where marks were lost
  g.Q.mcq.forEach((q, i) => { if (!g.m[i]) weak[q.topic] = (weak[q.topic] || 0) + 1; });
  g.Q.type.forEach((q, i) => { if (!g.t[i]) weak[q.topic] = (weak[q.topic] || 0) + 1; });
  g.Q.sql.forEach((q, i) => { if (!g.s[i].ok) weak['SQL practical'] = (weak['SQL practical'] || 0) + 1; });
  const weakList = Object.entries(weak).sort((a, b) => b[1] - a[1]);
  const msg = pct >= 80 ? '🎉 Excellent paper!' : pct >= 60 ? 'Good work. Fix the topics below.' : pct >= 40 ? 'Getting there. Revise the weak topics and try again.' : 'Keep going: revise in Learn mode, then retry.';
  const wrong = [];
  g.Q.mcq.forEach((q, i) => { if (!g.m[i]) wrong.push(`<div class="review-item"><strong>A${i + 1}. ${esc(q.q)}</strong>${exam.m[i] === null ? 'Not answered' : `You chose: ${esc(q.opts[exam.m[i]])}`}<br>Correct: ${esc(q.opts[q.correct])}<br><span class="res-meta">${esc(q.exp || '')}</span></div>`); });
  g.Q.type.forEach((q, i) => { if (!g.t[i]) wrong.push(`<div class="review-item"><strong>B${i + 1}. ${esc(q.q)}</strong>${exam.t[i].trim() ? `You wrote: <code class="mine">${esc(exam.t[i])}</code><br>` : 'Not answered<br>'}Model answer: <code>${esc(q.answer)}</code></div>`); });
  g.Q.sql.forEach((q, i) => { if (!g.s[i].ok) wrong.push(`<div class="review-item"><strong>C${i + 1}. ${esc(q.task)}</strong>${exam.s[i].trim() ? `You wrote: <code class="mine">${esc(exam.s[i])}</code><br>${esc(g.s[i].msg)}<br>` : 'Not attempted<br>'}Solution: <code>${esc(q.sol)}</code></div>`); });
  root.innerHTML = `<div class="quiz-wrap"><div class="quiz-result">
    <div class="result-pct">${g.total}/${EXAM.total}</div><div class="result-label">${pct}% · Section A ${g.marks.m}/${EXAM.mcq * EXAM.w.m} · B ${g.marks.t}/${EXAM.type * EXAM.w.t} · C ${g.marks.s}/${EXAM.sql * EXAM.w.s}</div>
    <div class="result-msg">${up ? '⏰ Time was up. ' : ''}${msg}</div>
    <div class="res-meta" style="text-align:center">⏱ Time used: ${fmtTime(Math.round(exam.used))} of ${fmtTime(exam.limit)}</div>
    ${weakList.length ? `<div class="review-list"><h3>Where you lost marks</h3><p>${weakList.map(([t, n]) => `<span class="keyword-badge">${esc(t)} ×${n}</span>`).join(' ')}</p></div>` : ''}
    <div class="btn-row" style="justify-content:center"><button class="btn primary" data-action="examstart">New paper</button><button class="btn" data-action="examexit">Back to practice</button></div>
    ${wrong.length ? `<div class="review-list"><h3>To revise (${wrong.length})</h3>${wrong.join('')}</div>` : ''}</div></div>`;
  root.scrollTop = 0;
}
const EXAM_ACTIONS = {
  examstart: () => {
    if (exam && !exam.done && !confirm('Start a new paper? Your current paper will be lost.')) return;
    quizMode = null; quizTimer = null; stopTicking();
    exam = examNew(); save(); renderExam(); root.scrollTop = 0;
  },
  examsubmit: () => examSubmit(),
  examexit: () => {
    if (exam && !exam.done && !confirm('Leave the exam? Your paper will be lost.')) return;
    stopExamTick(); exam = null; save(); renderPracticeHome();
  },
};
