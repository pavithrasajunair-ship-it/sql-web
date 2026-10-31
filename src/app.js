'use strict';

/* ================= helpers ================= */
const $  = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function shuffle(arr) {                       // Fisher–Yates (unbiased)
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const TAG = {
  DDL:['#7f77dd','#1a1840'], DML:['#1d9e75','#00231a'], Clause:['#ef9f27','#2a1e00'],
  Aggregate:['#ef9f27','#2a1e00'], Constraint:['#d4537e','#2a0f1c'], Keyword:['#378add','#001830'],
  Function:['#378add','#001830'], Terms:['#5dcaa5','#00231a'], Python:['#afa9ec','#1a1840'],
  Datatype:['#5dcaa5','#00231a'],
};
const tagStyle = t => { const [c, b] = TAG[t] || ['#a8a8a8', '#1f1f1f']; return `background:${b};color:${c}`; };


/* ================= data ================= */
const ALL_CARDS = TOPICS.flatMap(t => t.cards.map(c => ({
  ...c, topicId: t.id, topicLabel: t.label, color: t.color, bg: t.bg, uid: `${t.id}:${c.k}`,
})));
const CARD_BY_UID = new Map(ALL_CARDS.map(c => [c.uid, c]));
const BANK = {mcq: MCQ, type: TYPE_Q};

/* ================= state + persistence ================= */
const KEY = 'sqlrev.v3', OLD_KEY = 'sqlrev.v1';
function load() {
  for (const k of [KEY, OLD_KEY]) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) { const p = JSON.parse(raw); if (p && typeof p === 'object') return p; }
    } catch (e) { /* storage blocked or corrupt: ignore */ }
  }
  return {};
}
const saved = load();

let currentMode  = ['practice', 'lab'].includes(saved.mode) ? saved.mode : 'learn';
const clampN = (v, max, d) => { v = parseInt(v, 10); return Number.isFinite(v) ? Math.min(Math.max(v, 1), max) : d; };
let cfg = {mcqN: clampN(saved.cfg?.mcqN, MCQ.length, 12), typeN: clampN(saved.cfg?.typeN, TYPE_Q.length, 10), timer: !!saved.cfg?.timer};
const dayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
let prefs = {theme: saved.prefs?.theme === 'light' ? 'light' : 'dark', big: !!saved.prefs?.big};
let streak = {count: Math.max(0, parseInt(saved.streak?.count, 10) || 0), best: Math.max(0, parseInt(saved.streak?.best, 10) || 0), last: /^\d{4}-\d\d-\d\d$/.test(saved.streak?.last) ? saved.streak.last : ''};
function liveStreak() { const y = new Date(); y.setDate(y.getDate() - 1); return streak.last === dayStr() || streak.last === dayStr(y) ? streak.count : 0; }
function touchStreak() {                              // call after any real practice (quiz finished, quest solved, deck finished)
  const t = dayStr(); if (streak.last === t) return;
  streak.count = liveStreak() ? streak.count + 1 : 1; streak.last = t; streak.best = Math.max(streak.best, streak.count); save();
}
function applyPrefs() { document.documentElement.dataset.theme = prefs.theme; document.documentElement.dataset.big = prefs.big ? '1' : ''; }
const dayNum = () => Math.floor(new Date().setHours(12, 0, 0, 0) / 864e5);
const SRS_DAYS = [0, 1, 2, 4, 8, 16];                 // Leitner boxes: days until a card is due again
let srs = {};                                         // uid -> {box 1..5, due: day number}
for (const [u, v] of Object.entries(saved.srs || {})) if (CARD_BY_UID.has(u) && v && [1, 2, 3, 4, 5].includes(v.box) && Number.isInteger(v.due)) srs[u] = {box: v.box, due: v.due};
const srsCounts = () => { const t = dayNum(); return {due: ALL_CARDS.filter(c => srs[c.uid] && srs[c.uid].due <= t).length, fresh: ALL_CARDS.filter(c => !srs[c.uid]).length}; };
const SEC_PER = {mcq: 45, type: 120};                 // timer: seconds allowed per question
let quizTimer = null, tickId = null, lastTick = 0;
const fmtTime = t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
let lab = (() => {                                    // SQL Lab progress (validated: saved data may be old or edited)
  const d = labDefaults(), L = saved.lab || {};
  if (Number.isFinite(L.xp) && L.xp >= 0) d.xp = L.xp;
  if (SEEDS[L.db]) d.db = L.db;
  if (L.tab === 'play') d.tab = 'play';
  if (/^\d{4}-\d\d-\d\d$/.test(L.dailyDone)) d.dailyDone = L.dailyDone;
  if (QUESTS.some(q => q.id === L.open)) d.open = L.open;
  for (const q of QUESTS) {
    if ([1, 2, 3].includes(L.solved?.[q.id])) d.solved[q.id] = L.solved[q.id];
    if ([1, 2, 3].includes(L.used?.[q.id])) d.used[q.id] = L.used[q.id];
  }
  for (const [k, v] of Object.entries(L.drafts || {}).slice(0, 40)) if (typeof v === 'string') d.drafts[k] = v.slice(0, 5000);
  return d;
})();
let currentTopic = TOPICS.some(t => t.id === saved.topic) ? saved.topic : TOPICS[0].id;
let easy = new Set((saved.easy || []).filter(u => CARD_BY_UID.has(u)));
let hard = new Set((saved.hard || []).filter(u => CARD_BY_UID.has(u)));
let stats = {mcqTotal:0, mcqScore:0, typeTotal:0, typeScore:0, ...(saved.stats || {})};
for (const k in stats) if (!Number.isFinite(stats[k])) stats[k] = 0;
let strictNames = saved.strictNames !== false;        // table/column names case-sensitive (default ON)
const history = {                                     // questions already asked this round (no repeats until the bank is used up)
  mcq:  (saved.history?.mcq  || []).filter(t => MCQ.some(q => q.q === t)),
  type: (saved.history?.type || []).filter(t => TYPE_Q.some(q => q.q === t)),
};

let searchQuery = '';
let quizMode = null, quizQ = [], quizIdx = 0, answers = [], quizDone = false;
let fc = {cards: [], i: 0, flipped: false, lock: false, hardOnly: false, finished: false};

const root = $('#content-area');

function getSession() {
  if (quizMode === 'mcq' || quizMode === 'type')
    return {kind: quizMode, qs: quizQ.map(q => ({q: q.q, order: q.order || null})), idx: quizIdx, answers, done: quizDone, timer: quizTimer};
  if (quizMode === 'flashcard')
    return {kind: 'fc', cards: fc.cards.map(c => c.uid), i: fc.i, hardOnly: fc.hardOnly, finished: fc.finished};
  return null;
}
let noSave = false;                                   // set while importing, so the page-close save cannot overwrite imported data
function save() {
  if (noSave) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({
      v: 3, mode: currentMode, topic: currentTopic, easy: [...easy], hard: [...hard],
      stats, strictNames, history, cfg, lab, prefs, streak, srs, exam, session: getSession(),
    }));
  } catch (e) { /* private mode / storage full: the app still works, progress just isn't kept */ }
}

/* ---- MCQ option shuffling ---- */
function buildMcq(base, order) {
  return {...base, opts: order.map(i => base.opts[i]), correct: order.indexOf(base.correct), order};
}
const isPerm = (o, n) => Array.isArray(o) && o.length === n && new Set(o).size === n && o.every(i => Number.isInteger(i) && i >= 0 && i < n);

function restoreSession(s) {
  if (!s || typeof s !== 'object') return false;
  if (s.kind === 'fc') {
    const cards = (Array.isArray(s.cards) ? s.cards : []).map(u => CARD_BY_UID.get(u)).filter(Boolean);
    if (!cards.length) return false;
    quizMode = 'flashcard';
    fc = {cards, i: Math.min(Math.max(+s.i || 0, 0), cards.length - 1), flipped: false, lock: false, hardOnly: !!s.hardOnly, finished: !!s.finished};
    return true;
  }
  if (s.kind !== 'mcq' && s.kind !== 'type') return false;
  const byText = new Map(BANK[s.kind].map(q => [q.q, q]));
  const list = Array.isArray(s.qs) ? s.qs : [];
  const qs = list.map(x => {
    const base = x && byText.get(x.q);
    if (!base) return null;
    if (s.kind === 'type') return base;
    return isPerm(x.order, base.opts.length) ? buildMcq(base, x.order) : null;
  });
  if (!qs.length || qs.some(q => !q) || !Array.isArray(s.answers) || s.answers.length !== qs.length) return false;
  quizMode = s.kind; quizQ = qs;
  answers = s.answers.map(a => (a && typeof a === 'object') ? a : null);
  quizIdx = Math.min(Math.max(+s.idx || 0, 0), qs.length);
  quizDone = !!s.done;
  quizTimer = s.timer && s.timer.limit > 0 && s.timer.used >= 0 ? {limit: +s.timer.limit, used: +s.timer.used} : null;
  return true;
}

/* ---- pick questions: unseen first, so a new quiz brings new questions ---- */
function pick(kind, n) {
  const bank = BANK[kind];
  const seen = new Set(history[kind]);
  const unseen = bank.filter(q => !seen.has(q.q));
  let chosen = shuffle(unseen).slice(0, n);
  if (chosen.length >= n) {
    history[kind] = history[kind].concat(chosen.map(q => q.q));
  } else {                                            // whole bank used: start a new round
    const extra = shuffle(bank.filter(q => !chosen.includes(q))).slice(0, n - chosen.length);
    chosen = chosen.concat(extra);
    history[kind] = extra.map(q => q.q);
  }
  return shuffle(chosen);
}

/* ================= modes ================= */
function setMode(m) {
  currentMode = m;
  document.body.dataset.mode = m;
  $$('.mode-tab').forEach(b => {
    const on = b.dataset.mode === m;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  save();
  stopTicking(); stopExamTick();
  if (m === 'learn') renderLearn();
  else if (m === 'lab') renderLab();
  else if (exam) renderExam();
  else if (quizMode === 'flashcard') renderFlash();                 // resume the quiz in progress
  else if (quizMode === 'mcq' || quizMode === 'type') (quizDone || quizIdx >= quizQ.length) ? showResult() : renderQuiz();
  else renderPracticeHome();
  root.scrollTop = 0;
}

/* ================= LEARN ================= */
function renderTopicList() {
  $('#topic-list').innerHTML = TOPICS.map(t => {
    const on = t.id === currentTopic && !searchQuery.trim();
    return `<button class="topic-item${on ? ' active' : ''}" data-action="topic" data-id="${esc(t.id)}"${on ? ' aria-current="true"' : ''}>
      <span class="topic-dot" style="background:${t.color}"></span>
      <span class="topic-label">${esc(t.label)}</span>
      <span class="topic-count">${t.cards.length}</span></button>`;
  }).join('');
}

function cardHTML(c, showTopic) {
  return `<article class="flash-card">
    <div class="card-header">
      <span class="keyword-badge" style="background:${c.bg};color:${c.color}">${esc(c.k)}</span>
      ${showTopic ? `<span class="card-topic">${esc(c.topicLabel)}</span>` : ''}
    </div>
    ${c.s ? `<div class="syntax-wrap"><pre class="syntax-box">${esc(c.s)}</pre>
      <button class="copy-btn" data-action="copy" data-uid="${esc(c.uid)}" aria-label="Copy syntax of ${esc(c.k)}">Copy</button></div>` : ''}
    <p class="card-desc">${esc(c.d)}</p>
  </article>`;
}

function renderLearn() {
  renderTopicList();
  root.innerHTML = `<div class="search-row">
    <input id="search" class="search" type="search" autocomplete="off"
      placeholder="Search all concepts (e.g. LIKE, JOIN, TRUNCATE)" aria-label="Search concepts" value="${esc(searchQuery)}">
  </div><div id="learn-list"></div>`;
  renderLearnList();
}

function renderLearnList() {
  const box = $('#learn-list'); if (!box) return;
  const q = searchQuery.trim().toLowerCase();
  if (q) {
    const hits = ALL_CARDS.filter(c => `${c.k} ${c.s} ${c.d} ${c.topicLabel}`.toLowerCase().includes(q));
    box.innerHTML = `<div class="topic-header"><div><div class="topic-title">Search results</div>
      <div class="topic-subtitle">${hits.length} match${hits.length === 1 ? '' : 'es'} for “${esc(searchQuery.trim())}”</div></div></div>` +
      (hits.length ? hits.map(c => cardHTML(c, true)).join('') : '<p class="empty">No concepts found. Try a shorter keyword.</p>');
    return;
  }
  const t = TOPICS.find(x => x.id === currentTopic);
  const cards = ALL_CARDS.filter(c => c.topicId === t.id);
  box.innerHTML = `<div class="topic-header">
      <div style="width:36px;height:36px;border-radius:8px;background:${t.bg};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0" aria-hidden="true">📖</div>
      <div><div class="topic-title">${esc(t.label)}</div><div class="topic-subtitle">${cards.length} concepts</div></div>
    </div>` + cards.map(c => cardHTML(c, false)).join('');
}

function selectTopic(id) {
  currentTopic = id; searchQuery = ''; save();
  renderLearn(); root.scrollTop = 0;
}

/* ================= PRACTICE HOME ================= */
function streakHtml() {
  const n = liveStreak(), done = streak.last === dayStr();
  return `<div class="streak">🔥 ${n} day streak${streak.best ? ` · best ${streak.best}` : ''}${n && !done ? ' · practise today to keep it!' : ''}${!n ? ' · finish a quiz, deck or quest to start one' : ''}</div>`;
}
function cfgChips(key, presets, max) {
  const chip = (n, label) => `<button class="chip ${cfg[key] === n ? 'on' : ''}" data-action="setn" data-k="${key}" data-n="${n}">${label || n}</button>`;
  return `<span class="chips">${presets.filter(n => n < max).map(n => chip(n)).join('')}${chip(max, 'All ' + max)}
    <input class="num" type="number" inputmode="numeric" min="1" max="${max}" value="${cfg[key]}" data-cfg="${key}" data-max="${max}" aria-label="Custom number (1 to ${max})"></span>`;
}
function renderPracticeHome() {
  const total = stats.mcqScore + stats.typeScore;
  const rate = (a, b) => b > 0 ? Math.round(a / b * 100) + '%' : '—';
  const hardCards = [...hard].map(u => CARD_BY_UID.get(u)).filter(Boolean);
  root.innerHTML = `
    <div class="practice-hero"><h2>Practice Mode</h2><p>Test yourself — choose how you want to be quizzed</p>${streakHtml()}</div>
    <div class="stats-row">
      <div class="stat-box"><div class="stat-num">${total}</div><div class="stat-lbl">Total correct</div></div>
      <div class="stat-box"><div class="stat-num">${rate(stats.mcqScore, stats.mcqTotal)}</div><div class="stat-lbl">MCQ accuracy</div></div>
      <div class="stat-box"><div class="stat-num">${rate(stats.typeScore, stats.typeTotal)}</div><div class="stat-lbl">Type accuracy</div></div>
      <div class="stat-box"><div class="stat-num">${easy.size}</div><div class="stat-lbl">Cards easy</div></div>
    </div>
    <div class="cfg">
      <div class="cfg-row"><span class="cfg-lbl">🧠 MCQs per quiz</span>${cfgChips('mcqN', [10, 20, 30, 50], MCQ.length)}</div>
      <div class="cfg-row"><span class="cfg-lbl">⌨️ Typed questions per quiz</span>${cfgChips('typeN', [5, 10, 20], TYPE_Q.length)}</div>
      <label class="setting" style="margin:6px 0 0"><input type="checkbox" data-action="timer" ${cfg.timer ? 'checked' : ''}>
        ⏱ Timer on (${SEC_PER.mcq} s per MCQ · ${SEC_PER.type / 60} min per typed question). Off = no time pressure.</label>
    </div>
    <div class="quiz-modes">
      <button class="quiz-mode-card" data-action="start" data-mode="mcq"><div class="icon">🧠</div><h3>MCQ Quiz</h3><p>${cfg.mcqN} questions from a bank of ${MCQ.length} · seen ${history.mcq.length}/${MCQ.length} this round</p></button>
      <button class="quiz-mode-card" data-action="start" data-mode="type"><div class="icon">⌨️</div><h3>Type the Answer</h3><p>${cfg.typeN} questions from a bank of ${TYPE_Q.length} · seen ${history.type.length}/${TYPE_Q.length} this round</p></button>
      <button class="quiz-mode-card" data-action="start" data-mode="smart"><div class="icon">🔁</div><h3>Smart Review</h3><p>${srsCounts().due} due today · ${Math.min(15, srsCounts().fresh)} new · cards return when you are about to forget</p></button>
      <button class="quiz-mode-card" data-action="examstart"><div class="icon">📝</div><h3>Mock Exam</h3><p>${EXAM.mcq} MCQ + ${EXAM.type} written + ${EXAM.sql} SQL practical · ${EXAM.total} marks · ${EXAM.secs / 60} min</p></button>
      <button class="quiz-mode-card" data-action="start" data-mode="flashcard"><div class="icon">🃏</div><h3>Flashcard Drill</h3><p>Flip ${ALL_CARDS.length} cards, mark what you know</p></button>
    </div>
    <label class="setting"><input type="checkbox" data-action="strict" ${strictNames ? 'checked' : ''}>
      Table and column names are case-sensitive in typed answers (keywords can be any case)</label>
    ${hardCards.length ? `<div>
      <div class="hard-head"><span>${hardCards.length} card${hardCards.length === 1 ? '' : 's'} marked hard</span>
        <button class="btn primary" data-action="start" data-mode="hard">Drill hard cards</button></div>
      ${hardCards.map(c => `<div class="hard-row">
        <span class="keyword-badge" style="background:${c.bg};color:${c.color}">${esc(c.k)}</span>
        <code>${esc((c.s || c.d).split('\n')[0])}</code>
        <button class="btn" data-action="unhard" data-uid="${esc(c.uid)}" aria-label="Unmark ${esc(c.k)}">✕</button></div>`).join('')}
    </div>` : ''}
    <div class="cfg" style="margin-top:22px"><div class="cfg-row"><span class="cfg-lbl">🎨 Look</span><span class="chips">
        <button class="chip ${prefs.theme === 'dark' ? 'on' : ''}" data-action="theme" data-t="dark">Dark</button>
        <button class="chip ${prefs.theme === 'light' ? 'on' : ''}" data-action="theme" data-t="light">Light</button>
        <button class="chip ${prefs.big ? 'on' : ''}" data-action="big">Bigger text</button></span></div>
      <div class="cfg-row"><span class="cfg-lbl">💾 Backup (move to a new phone, or keep safe)</span><span class="chips">
        <button class="btn" data-action="export">Save progress file</button>
        <label class="btn" for="imp" role="button" tabindex="0">Load progress file</label>
        <input id="imp" type="file" accept="application/json,.json" hidden></span></div></div>
    <div class="reset-row"><button class="btn danger" data-action="reset">Reset all progress</button></div>`;
}

/* ================= QUIZ (MCQ + TYPE) ================= */
function startQuiz(mode) {
  if (mode === 'flashcard' || mode === 'hard' || mode === 'smart') return startFlash(mode);
  quizMode = mode; quizIdx = 0; quizDone = false; stopTicking();
  if (mode === 'mcq') quizQ = pick('mcq', cfg.mcqN).map(b => buildMcq(b, shuffle(b.opts.map((_, i) => i))));
  else quizQ = pick('type', cfg.typeN);
  answers = new Array(quizQ.length).fill(null);
  quizTimer = cfg.timer ? {limit: quizQ.length * SEC_PER[mode], used: 0} : null;
  save(); renderQuiz(); root.scrollTop = 0;
}

function renderQuiz() { quizMode === 'mcq' ? renderMcq() : renderType(); startTicking(); }
function startTicking() { if (tickId || !quizTimer || quizDone || !(quizMode === 'mcq' || quizMode === 'type')) return; lastTick = Date.now(); tickId = setInterval(tick, 1000); }
function stopTicking() { clearInterval(tickId); tickId = null; }
function tick() {
  if (!quizTimer || quizDone || currentMode !== 'practice' || !(quizMode === 'mcq' || quizMode === 'type')) return stopTicking();
  const now = Date.now(); quizTimer.used += (now - lastTick) / 1000; lastTick = now;
  const left = Math.ceil(quizTimer.limit - quizTimer.used);
  if (left <= 0) { quizTimer.used = quizTimer.limit; stopTicking(); return showResult(); }   // time is up
  const el = $('#qtimer'); if (el) { el.textContent = '⏱ ' + fmtTime(left); el.classList.toggle('warn', left <= 30); }
  if (left % 10 === 0) save();
}

function quizTop() {
  const n = quizQ.length;
  const score = answers.filter(a => a && a.correct).length;
  return `<div class="quiz-topbar">
    <button class="btn" data-action="home">← Back</button>
    <div class="quiz-progress-wrap">
      <div class="quiz-progress-meta"><span>${quizIdx + 1} / ${n}</span>${quizTimer ? `<span id="qtimer" class="qtimer${quizTimer.limit - quizTimer.used <= 30 ? ' warn' : ''}">⏱ ${fmtTime(Math.max(0, Math.ceil(quizTimer.limit - quizTimer.used)))}</span>` : ''}<span>Score: ${score}</span></div>
      <div class="quiz-progress-bg" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${quizIdx + 1}">
        <div class="quiz-progress-fill" style="width:${Math.round((quizIdx + 1) / n * 100)}%"></div></div>
    </div>
    <button class="btn" data-action="prev" ${quizIdx === 0 ? 'disabled' : ''}>← Prev</button>
  </div>`;
}

const nextLabel = () => quizIdx === quizQ.length - 1 ? 'See result' : 'Next question';

function renderMcq() {
  if (quizIdx >= quizQ.length) return showResult();
  const q = quizQ[quizIdx], a = answers[quizIdx];
  root.innerHTML = `<div class="quiz-wrap">${quizTop()}
    <div class="quiz-card">
      <span class="quiz-tag" style="${tagStyle(q.topic)}">${esc(q.topic)}</span>
      <div class="quiz-q" id="qtext">${esc(q.q)}</div>
      <div role="group" aria-labelledby="qtext">${q.opts.map((o, i) => {
        let cls = '';
        if (a) cls = i === q.correct ? ' correct' : (i === a.chosen ? ' wrong' : '');
        return `<button class="opt-btn${cls}" data-action="pick" data-i="${i}" ${a ? 'disabled' : ''}>${'ABCD'[i]}. ${esc(o)}</button>`;
      }).join('')}</div>
      <div class="explanation" ${a ? '' : 'hidden'}>${esc(q.exp)}</div>
    </div>
    <div class="btn-row" ${a ? '' : 'hidden'}><button class="btn primary" data-action="next">${nextLabel()} →</button></div>
  </div>`;
  if (a) $('.btn.primary', root)?.focus();
}

function pickMcq(i) {
  if (quizMode !== 'mcq' || quizDone || answers[quizIdx]) return;
  const ok = i === quizQ[quizIdx].correct;
  answers[quizIdx] = {chosen: i, correct: ok};
  stats.mcqTotal++; if (ok) stats.mcqScore++;
  save(); renderMcq();
}

/* ---- typed answers ---- */
function feedbackHTML(q, a) {
  let head;
  if (a.skipped) head = 'Answer revealed.';
  else if (a.correct) head = '✓ Correct!';
  else if (a.nameIssue) head = `✗ Right query, but table/column names are case-sensitive.<br>You wrote <code>${esc(a.nameIssue.typed)}</code> — it should be <code>${esc(a.nameIssue.expected)}</code>. (Keywords can be any case.)`;
  else head = '✗ Not quite.<br>Check the spelling, the table/column names and the clause order.';
  return `${head}<br>Model answer: <code>${esc(q.answer)}</code>`;
}

function renderType() {
  if (quizIdx >= quizQ.length) return showResult();
  const q = quizQ[quizIdx], a = answers[quizIdx];
  root.innerHTML = `<div class="quiz-wrap">${quizTop()}
    <div class="quiz-card">
      <span class="quiz-tag" style="${tagStyle(q.topic)}">${esc(q.topic)}</span>
      <div class="quiz-q" id="qtext">${esc(q.q)}</div>
      <div class="given"><strong>Given:</strong> <code>${esc(q.given)}</code>
        ${strictNames ? '<span class="note">Table and column names must be typed exactly as shown. Keywords can be upper or lower case.</span>' : ''}</div>
      <textarea class="type-input" id="type-in" rows="4" spellcheck="false" autocapitalize="off" autocomplete="off"
        aria-labelledby="qtext" placeholder="Write your SQL here… (Ctrl+Enter to check)" ${a ? 'disabled' : ''}>${esc(a ? a.text : '')}</textarea>
      ${a ? '' : `<div class="btn-row"><button class="btn primary" data-action="check">Check answer</button><button class="btn" data-action="reveal">Show answer</button></div>`}
      <div class="type-feedback ${a ? (a.correct ? 'correct' : 'wrong') : ''}" role="status" ${a ? '' : 'hidden'}>${a ? feedbackHTML(q, a) : ''}</div>
    </div>
    ${a ? `<div class="btn-row"><button class="btn primary" data-action="next">${nextLabel()} →</button></div>` : ''}
  </div>`;
  if (a) $('.btn.primary', root)?.focus(); else $('#type-in').focus();
}

function checkType() {
  const box = $('#type-in');
  if (quizMode !== 'type' || quizDone || !box || box.disabled || answers[quizIdx]) return;
  const g = SQLGrader.grade(quizQ[quizIdx], box.value, strictNames);
  if (g.empty) { box.focus(); return; }
  answers[quizIdx] = {text: box.value, correct: g.correct, skipped: false, nameIssue: g.nameIssue || null};
  stats.typeTotal++; if (g.correct) stats.typeScore++;
  save(); renderType();
}
function revealType() {
  const box = $('#type-in');
  if (quizMode !== 'type' || quizDone || !box || answers[quizIdx]) return;
  answers[quizIdx] = {text: box.value, correct: false, skipped: true};
  stats.typeTotal++;
  save(); renderType();
}

/* ---- navigation + result ---- */
function step(d) {
  if (quizDone || (quizMode !== 'mcq' && quizMode !== 'type')) return;
  if (d > 0 && !answers[quizIdx]) return;               // can only move forward after answering
  quizIdx = Math.max(0, quizIdx + d);
  save(); renderQuiz(); root.scrollTop = 0;
}

function leaveQuiz() {
  const wasQuiz = quizMode === 'mcq' || quizMode === 'type';
  const inProgress = (quizMode === 'mcq' || quizMode === 'type') && !quizDone && answers.some(Boolean);
  if (inProgress && !confirm('Leave this quiz? Your answers for it will be lost.')) return;
  if (wasQuiz) { stopTicking(); quizTimer = null; }
  quizMode = null; save();
  renderPracticeHome();
}

function showResult() {
  quizDone = true; stopTicking(); touchStreak(); save();
  const timeUp = quizTimer && quizTimer.used >= quizTimer.limit;
  const n = quizQ.length;
  const score = answers.filter(a => a && a.correct).length;
  const pct = n ? Math.round(score / n * 100) : 0;
  const msg = pct >= 80 ? '🎉 Excellent! You really know your SQL.' : pct >= 60 ? 'Good work! Review the ones you missed.' : 'Keep practising — try Learn mode to revise.';
  const missed = quizQ.map((q, i) => ({q, a: answers[i]})).filter(x => !x.a || !x.a.correct);
  root.innerHTML = `<div class="quiz-wrap"><div class="quiz-result">
    <div class="result-pct">${pct}%</div>
    <div class="result-label">You got ${score} out of ${n} right</div>
    <div class="result-msg">${timeUp ? '⏰ Time is up! Unanswered questions count as missed.<br>' : ''}${msg}</div>
    ${quizTimer ? `<div class="res-meta" style="text-align:center">⏱ Time used: ${fmtTime(Math.round(quizTimer.used))} of ${fmtTime(quizTimer.limit)}</div>` : ''}
    <div class="btn-row" style="justify-content:center">
      <button class="btn primary" data-action="start" data-mode="${quizMode}">New quiz</button>
      <button class="btn" data-action="review">Review answers</button>
      <button class="btn" data-action="home">Back to practice</button>
    </div>
    ${missed.length ? `<div class="review-list"><h3>To revise (${missed.length})</h3>${missed.map(({q, a}) => `
      <div class="review-item"><strong>${esc(q.q)}</strong>
        ${quizMode === 'mcq'
          ? `Correct: ${esc(q.opts[q.correct])}`
          : `${a && a.text ? `You wrote: <code class="mine">${esc(a.text)}</code><br>` : ''}Model answer: <code>${esc(q.answer)}</code>`}</div>`).join('')}</div>` : ''}
  </div></div>`;
  root.scrollTop = 0;
}

/* ================= FLASHCARDS ================= */
function startFlash(mode) {
  const hardOnly = mode === true || mode === 'hard', t = dayNum();
  const src = mode === 'smart' ? ALL_CARDS.filter(c => srs[c.uid] && srs[c.uid].due <= t).concat(shuffle(ALL_CARDS.filter(c => !srs[c.uid])).slice(0, 15))
    : hardOnly ? ALL_CARDS.filter(c => hard.has(c.uid)) : ALL_CARDS;
  if (!src.length) { quizMode = null; save(); if (mode === 'smart') alert('🎉 All caught up! No cards are due today. Come back tomorrow.'); return renderPracticeHome(); }
  quizMode = 'flashcard';
  fc = {cards: shuffle(src), i: 0, flipped: false, lock: false, hardOnly: !!hardOnly, finished: false};
  save(); renderFlash();
}

const fcStatus = c => easy.has(c.uid) ? '✓ Marked easy' : hard.has(c.uid) ? '⚑ Marked hard' : '';

function renderFlashDone() {
  const n = fc.cards.length;
  const nEasy = fc.cards.filter(c => easy.has(c.uid)).length;
  const nHard = fc.cards.filter(c => hard.has(c.uid)).length;
  root.innerHTML = `<div class="fc-wrap"><div class="quiz-result">
    <div class="result-pct">✓</div>
    <div class="result-label">You went through all ${n} card${n === 1 ? '' : 's'}</div>
    <div class="result-msg">${nEasy} marked easy · ${nHard} marked hard</div>
    <div class="btn-row" style="justify-content:center">
      <button class="btn primary" data-action="start" data-mode="flashcard">Restart (shuffled)</button>
      ${hard.size ? '<button class="btn" data-action="start" data-mode="hard">Drill hard cards</button>' : ''}
      <button class="btn" data-action="home">Back to practice</button>
    </div></div></div>`;
  root.scrollTop = 0;
}

function renderFlash() {
  if (fc.finished) return renderFlashDone();
  const c = fc.cards[fc.i], n = fc.cards.length, remaining = n - fc.i - 1;
  root.innerHTML = `<div class="fc-wrap">
    <div class="fc-topbar"><button class="btn" data-action="home">← Back</button><span>${fc.i + 1} / ${n}</span><button class="btn" data-action="shuffle" ${remaining < 2 ? 'disabled' : ''} title="Shuffles only the cards you have not seen yet">Shuffle unseen</button></div>
    <div class="fc-progress"><div style="width:${Math.round((fc.i + 1) / n * 100)}%"></div></div>
    <div class="big-card${fc.flipped ? ' flipped' : ''}" id="big-card" role="button" tabindex="0" aria-pressed="${fc.flipped}"
         aria-label="Flashcard: ${esc(c.k)}. Press space to flip." data-action="flip">
      <div class="big-card-inner">
        <div class="fc-face fc-front">
          <div class="fc-hint">click or press space to reveal</div>
          <div class="fc-word">${esc(c.k)}</div>
          <div class="fc-tag" style="background:${c.bg};color:${c.color}">${esc(c.topicLabel)}</div>
        </div>
        <div class="fc-face fc-back">
          <div class="fc-word" style="color:var(--purple-light);font-size:16px;margin-bottom:8px">${esc(c.k)}</div>
          ${c.s ? `<pre class="fc-back-syntax">${esc(c.s)}</pre>` : ''}
          <div class="fc-back-desc">${esc(c.d)}</div>
        </div>
      </div>
    </div>
    <div class="fc-actions">
      <button class="btn" data-action="fcnav" data-d="-1" ${fc.i === 0 ? 'disabled' : ''}>← Prev</button>
      <button class="btn danger" data-action="mark" data-kind="hard">Hard ⚑</button>
      <button class="btn" style="color:var(--green-light);border-color:var(--green)" data-action="mark" data-kind="easy">Got it ✓</button>
      <button class="btn" data-action="fcnav" data-d="1">${remaining === 0 ? 'Finish ✓' : 'Next →'}</button>
    </div>
    <p class="fc-status" id="fc-status" aria-live="polite">${fcStatus(c)}</p>
    <p class="fc-keys">← → navigate · Space flip · H hard · E easy</p>
  </div>`;
}

function flipCard() {
  const el = $('#big-card'); if (!el) return;
  fc.flipped = !fc.flipped;
  el.classList.toggle('flipped', fc.flipped);      // class toggle, so the CSS animation actually plays
  el.setAttribute('aria-pressed', String(fc.flipped));
}
function fcNav(d) {
  if (quizMode !== 'flashcard' || fc.finished) return;
  const j = fc.i + d;
  if (j < 0) return;                                  // no wrap-around: the deck has a real start and end
  if (j >= fc.cards.length) { fc.finished = true; touchStreak(); }       // end of deck -> summary screen
  else { fc.i = j; fc.flipped = false; }
  save(); renderFlash();
}
function shuffleUnseen() {                            // cards up to and including the current one are 'seen': they stay put
  if (quizMode !== 'flashcard' || fc.finished) return;
  const rest = fc.cards.slice(fc.i + 1);
  if (rest.length < 2) return;
  fc.cards = fc.cards.slice(0, fc.i + 1).concat(shuffle(rest));
  save(); renderFlash();
}
function markCard(kind) {
  if (quizMode !== 'flashcard' || fc.finished || fc.lock) return;
  const c = fc.cards[fc.i], idx = fc.i;
  if (kind === 'easy') { easy.add(c.uid); hard.delete(c.uid); } else { hard.add(c.uid); easy.delete(c.uid); }
  const box = kind === 'easy' ? Math.min(5, (srs[c.uid]?.box || 0) + 1) : 1;   // easy: move up a box, hard: back to box 1
  srs[c.uid] = {box, due: dayNum() + (kind === 'easy' ? SRS_DAYS[box] : 0)};
  save();
  fc.lock = true;
  $('#fc-status').textContent = fcStatus(c);
  setTimeout(() => {                                // lock stops double-taps skipping cards
    fc.lock = false;
    if (quizMode === 'flashcard' && fc.i === idx) fcNav(1);
  }, 350);
}

/* ================= events ================= */
function flash(el, txt) { const old = el.textContent; el.textContent = txt; setTimeout(() => { el.textContent = old; }, 1200); }

function exportProgress() {
  save();
  const data = {format: 'sql-revision-backup', version: 1, saved: new Date().toISOString(), data: {}};
  for (const k of [KEY, PLAY_KEY]) { try { const v = localStorage.getItem(k); if (v) data.data[k] = JSON.parse(v); } catch (e) { /* skip unreadable key */ } }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], {type: 'application/json'}));
  a.download = `sql-revision-progress-${dayStr()}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function importProgress(file) {
  if (!file) return;
  if (file.size > 2e6) return alert('That file is too big to be a progress file.');
  file.text().then(t => {
    let d; try { d = JSON.parse(t); } catch (e) { return alert('This is not a valid progress file.'); }
    const main = d && d.format === 'sql-revision-backup' && d.data && d.data[KEY];
    if (!main || typeof main !== 'object' || main.v !== 3) return alert('This file is not a SQL Revision progress file (or is from an incompatible version).');
    if (!confirm('Replace the progress on this device with the one from the file?')) return;
    try {
      noSave = true;
      localStorage.setItem(KEY, JSON.stringify(main));
      if (d.data[PLAY_KEY] && typeof d.data[PLAY_KEY] === 'object') localStorage.setItem(PLAY_KEY, JSON.stringify(d.data[PLAY_KEY]));
      location.reload();
    } catch (e) { noSave = false; alert('Could not save: browser storage is full or blocked.'); }
  }).catch(() => alert('Could not read that file.'));
}
const actions = {
  ...LAB_ACTIONS, ...EXAM_ACTIONS,
  mode:   d => setMode(d.mode),
  gohome: () => showHome(),
  enter:  d => { document.body.dataset.view = 'app'; try { history.replaceState(null, '', '#app'); } catch (e) {} setMode(d.mode); $('#content-area').focus({preventScroll: true}); },
  topic:  d => selectTopic(d.id),
  start:  d => startQuiz(d.mode),
  home:   () => leaveQuiz(),
  pick:   d => pickMcq(+d.i),
  check:  () => checkType(),
  reveal: () => revealType(),
  next:   () => step(1),
  prev:   () => step(-1),
  review: () => { quizIdx = 0; quizDone = false; quizTimer = null; save(); renderQuiz(); },
  flip:   () => flipCard(),
  fcnav:  d => fcNav(+d.d),
  mark:   d => markCard(d.kind),
  shuffle:() => shuffleUnseen(),
  theme:  d => { prefs.theme = d.t; applyPrefs(); save(); renderPracticeHome(); },
  big:    () => { prefs.big = !prefs.big; applyPrefs(); save(); renderPracticeHome(); },
  export: () => exportProgress(),
  timer:  (d, el) => { cfg.timer = el.checked; save(); },
  setn:   d => { cfg[d.k] = +d.n; save(); renderPracticeHome(); },
  strict: (d, el) => { strictNames = el.checked; save(); },
  unhard: d => { hard.delete(d.uid); save(); renderPracticeHome(); },
  copy:   (d, el) => {
    const c = CARD_BY_UID.get(d.uid); if (!c) return;
    (navigator.clipboard ? navigator.clipboard.writeText(c.s) : Promise.reject())
      .then(() => flash(el, 'Copied')).catch(() => flash(el, 'Copy failed'));
  },
  reset:  () => {
    if (!confirm('Reset all progress (stats, easy/hard cards and seen questions)? This cannot be undone.')) return;
    easy = new Set(); hard = new Set(); srs = {}; quizMode = null;
    history.mcq = []; history.type = [];
    stats = {mcqTotal:0, mcqScore:0, typeTotal:0, typeScore:0};
    save(); renderPracticeHome();
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) fn(el.dataset, el);
});

document.addEventListener('change', e => {
  if (e.target.id === 'imp') { importProgress(e.target.files[0]); e.target.value = ''; return; }
  const k = e.target.dataset && e.target.dataset.cfg;
  if (k && cfg[k] !== undefined) { cfg[k] = clampN(e.target.value, +e.target.dataset.max, cfg[k]); save(); renderPracticeHome(); }
});
let labSaveT = 0;
document.addEventListener('input', e => {
  if (e.target.dataset && e.target.dataset.ex) examInput(e.target);
  if (e.target.id === 'lab-sql') { lab.drafts[labKey()] = e.target.value; clearTimeout(labSaveT); labSaveT = setTimeout(save, 500); }
  if (e.target.id === 'search') { searchQuery = e.target.value; renderTopicList(); renderLearnList(); }
});

document.addEventListener('keydown', e => {
  if (document.body.dataset.view === 'home') return;
  if (currentMode === 'lab' && e.target.id === 'lab-sql') {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); labRun(); }
    else if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); e.target.setRangeText('  ', e.target.selectionStart, e.target.selectionEnd, 'end'); e.target.dispatchEvent(new Event('input', {bubbles: true})); }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && quizMode === 'type' && currentMode === 'practice') { e.preventDefault(); checkType(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (currentMode !== 'practice') return;
  const tag = e.target.tagName;
  if (tag === 'TEXTAREA' || tag === 'INPUT') return;

  if (quizMode === 'flashcard' && !fc.finished) {
    if (e.key === 'ArrowRight') fcNav(1);
    else if (e.key === 'ArrowLeft') fcNav(-1);
    else if (e.key === ' ' && tag !== 'BUTTON') { e.preventDefault(); flipCard(); }
    else if (e.key === 'Enter' && e.target.id === 'big-card') { e.preventDefault(); flipCard(); }
    else if (e.key === 'h' || e.key === 'H') markCard('hard');
    else if (e.key === 'e' || e.key === 'E') markCard('easy');
  } else if (quizMode === 'mcq' && !quizDone) {
    if (/^[1-4]$/.test(e.key) && +e.key - 1 < quizQ[quizIdx]?.opts.length) pickMcq(+e.key - 1);
    else if (answers[quizIdx] && (e.key === 'ArrowRight' || (e.key === 'Enter' && tag !== 'BUTTON'))) step(1);
  } else if (quizMode === 'type' && !quizDone) {
    if (answers[quizIdx] && (e.key === 'ArrowRight' || (e.key === 'Enter' && tag !== 'BUTTON'))) step(1);
  }
});

/* ================= boot ================= */
function checkStyles() {
  if (getComputedStyle(document.body).display === 'flex') return;
  const bar = document.createElement('div');
  bar.setAttribute('role', 'alert');
  bar.style.cssText = 'position:sticky;top:0;z-index:99;background:#b00020;color:#fff;padding:10px 14px;font:14px/1.4 sans-serif';
  bar.textContent = 'styles.css did not load. Use the single-file index.html, or keep styles.css in the same folder (exact name) and hard-refresh (Ctrl+Shift+R).';
  document.body.prepend(bar);
}

/* ---- keep progress safe + work offline ---- */
addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
function fileNotice() {
  if (location.protocol !== 'file:' && location.protocol !== 'content:') return;
  const bar = document.createElement('div');
  bar.setAttribute('role', 'note');
  bar.style.cssText = 'background:#3a2a00;color:#ffd27a;padding:8px 14px;font:13px/1.4 sans-serif;display:flex;gap:12px;align-items:center;justify-content:space-between';
  bar.innerHTML = '<span>You opened this as a local file. Refreshing may fail and progress can be lost. Open it from its web link instead.</span><button style="background:none;border:1px solid currentColor;color:inherit;border-radius:6px;padding:2px 8px;cursor:pointer" aria-label="Dismiss">✕</button>';
  bar.querySelector('button').onclick = () => bar.remove();
  document.body.prepend(bar);
}

function showHome() {
  document.body.dataset.view = 'home';
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  const stat = {topics: TOPICS.length, cards: ALL_CARDS.length, questions: (typeof MCQ !== 'undefined' ? MCQ.length : 0) + (typeof TYPE_Q !== 'undefined' ? TYPE_Q.length : 0), quests: QUESTS.length};
  $$('[data-stat]').forEach(b => { b.dataset.final = stat[b.dataset.stat]; b.textContent = stat[b.dataset.stat]; });
  const resume = !!(exam || quizMode), c = $('#home-continue');
  c.hidden = !resume;
  if (resume) { c.textContent = 'Continue where you left off →'; c.dataset.mode = currentMode; }
  $('#home').scrollTop = 0;
  if (window.landingEnter) window.landingEnter();
}

exam = examRestore(saved.exam);
applyPrefs();
restoreSession(saved.session);      // resume an in-progress quiz / flashcard drill: same questions, same answers
setMode(currentMode);
if (location.hash === '#app') document.body.dataset.view = 'app'; else showHome();
checkStyles();
fileNotice();
