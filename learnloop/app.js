'use strict';
/* LearnLoop Phase 1 - browser app. Everything the student does feeds one history (store.js). */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const byId = id => CONCEPTS.find(c => c.id === id);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const LEVEL = {untested: ['Not assessed yet', 'lv-none'], weak: ['Needs work', 'lv-weak'], developing: ['Developing', 'lv-dev'], solid: ['Solid so far', 'lv-solid']};
const pill = id => { const l = LEVEL[LL.stats(id).level]; return `<span class="pill ${l[1]}">${l[0]}</span>`; };
const ago = t => { const d = Math.floor((Date.now() - t) / 864e5); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago'; };
const main = () => $('#main');
const pyRun = code => (window.__llPython || Runner.python)(code);

/* ---------- syntax highlighting (editor + code blocks) ---------- */
const PYKW = new Set('def return if elif else for while in range import from as class pass break continue and or not is None True False try except finally with lambda print len int str float input'.split(' '));
const PYB = new Set(['print', 'len', 'int', 'str', 'float', 'input', 'range']);
const SQLKW = new Set('select from where group by having order insert into values create table update set delete and or not as join on distinct count sum avg min max like in between is null primary key int varchar limit asc desc inner left outer'.split(' '));
function hl(src, lang) {
  const sql = lang === 'sql';
  const re = sql ? /(--[^\n]*)|('(?:[^'\\]|\\.)*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|([\s\S])/g
    : /(#[^\n]*)|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|([\s\S])/g;
  let out = '', m, prev = '';
  while ((m = re.exec(src))) {
    const t = m[0];
    if (m[1]) out += `<span class="c">${esc(t)}</span>`;
    else if (m[2]) out += `<span class="s">${esc(t)}</span>`;
    else if (m[3]) out += `<span class="n">${esc(t)}</span>`;
    else if (m[4]) {
      const low = t.toLowerCase();
      if (!sql && prev === 'def') out += `<span class="f">${esc(t)}</span>`;
      else if (sql ? SQLKW.has(low) : PYKW.has(t)) out += `<span class="${!sql && PYB.has(t) ? 'b' : 'k'}">${esc(t)}</span>`;
      else out += esc(t);
      prev = t;
    } else { out += esc(t); if (/\S/.test(t)) prev = ''; }
  }
  return out;
}
const codeBlock = (c, lang) => `<pre class="code"><code>${hl(c, lang)}</code></pre>`;

/* ---------- question builders ---------- */
function sqlDb() { const d = SQLEngine.newDb(); SQLEngine.run(d, SQL_SEED); return d; }
function sqlCount(q) { const r = SQLEngine.run(sqlDb(), q); const t = (r.results || []).filter(x => x.kind === 'rows').pop(); return t ? t.rows.length : 0; }
function itemFor(c, kind) {
  if (kind === 'check' || kind === 'bug') { const q = c[kind]; return {prompt: q.q, code: q.code, lang: c.subject, opts: shuffle(q.opts), kind}; }
  const p = c.predict; let opts;
  if (p.kind === 'rowcount') {
    const n = sqlCount(p.code), alt = Array.from(new Set([n + 1, Math.max(0, n - 1), n * 2, 6].filter(x => x !== n))).slice(0, 3);
    opts = [{t: String(n), ok: true, why: p.explain}].concat(alt.map(x => ({t: String(x), ok: false, why: `The query really returns ${n} rows. ${p.explain}`, m: p.m})));
  } else {
    opts = [{t: p.answer, ok: true, why: p.explain}].concat(p.wrong.map(w => ({t: w.ans, ok: false, why: w.why, m: w.m || null})));
    opts.push({t: 'It raises an error', ok: false, why: 'The code is valid, so it runs without an error. ' + p.explain, m: null});
  }
  return {prompt: p.q, code: p.code, lang: c.subject, opts: shuffle(opts), kind: 'predict'};
}
/* Multiple choice with an explanation for EVERY wrong answer: the student learns why, not just what. */
function renderMCQ(host, item, meta, done) {
  host.innerHTML = `<div class="q"><p class="q-p"><b>${esc(item.prompt)}</b></p>${item.code ? codeBlock(item.code, item.lang) : ''}<div class="opts" role="group" aria-label="Answer options">${item.opts.map((o, i) => `<button class="opt" data-i="${i}">${esc(o.t)}</button>`).join('')}</div><div class="fb" aria-live="polite"></div></div>`;
  $$('.opt', host).forEach(b => b.addEventListener('click', () => {
    const o = item.opts[+b.dataset.i], good = item.opts.find(x => x.ok);
    LL.record({concept: meta.concept, kind: item.kind, ok: o.ok, m: o.m, src: meta.src});
    $$('.opt', host).forEach((x, i) => { x.disabled = true; if (item.opts[i].ok) x.classList.add('right'); });
    if (!o.ok) b.classList.add('wrong');
    const fb = $('.fb', host);
    fb.innerHTML = o.ok
      ? `<div class="fb-ok"><b>Correct.</b> ${esc(o.why)}</div>`
      : `<div class="fb-bad"><p><b>Not quite.</b> Why that answer does not work: ${esc(o.why)}</p>${o.m ? `<p class="mis">Common misconception: ${esc(MIS[o.m])}</p>` : ''}<p>The right answer is <b>${esc(good.t)}</b> because: ${esc(good.why)}</p></div>`;
    done && done(o.ok, fb);
  }));
}
const nextBtn = (fb, label, fn) => { const b = document.createElement('button'); b.className = 'btn pri'; b.style.marginTop = '.8rem'; b.textContent = label; b.addEventListener('click', fn); fb.appendChild(b); b.focus(); return b; };

/* ---------- navigation ---------- */
const I = {
  dash: '<path d="M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>', tutor: '<path d="M4 5h16v11H9l-5 4z"/>', notes: '<path d="M6 3h9l4 4v14H6zM14 3v5h5"/>',
  det: '<circle cx="11" cy="11" r="6"/><path d="M16 16l5 5"/>', exam: '<path d="M5 4h14v16H5zM9 9h6M9 13h6"/>', quick: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
  map: '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="10" cy="18" r="2"/><path d="M8 7l8 1M7 8l3 8M17 10l-6 7"/>', prog: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', set: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
};
const NAV = [['dashboard', 'Dashboard', 'dash'], ['tutor', 'AI Tutor', 'tutor'], ['notes', 'Notes Studio', 'notes', 1], ['detective', 'Code Detective', 'det'], ['examiner', 'AI Examiner', 'exam', 1], ['quick', 'QuickLearn', 'quick'], ['skillmap', 'My SkillMap', 'map', 1], ['progress', 'My Progress', 'prog'], ['settings', 'Settings', 'set']];
function drawNav(cur) {
  $('#side').innerHTML = `<div class="brand"><i class="logo"></i>LearnLoop</div><div class="nav">${NAV.map(([id, label, ic, soon]) => `<a href="#/${id}" ${cur === id ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[ic]}</svg>${label}${soon ? '<span class="soon">Soon</span>' : ''}</a>`).join('')}</div><p class="tag">Don't just learn. Understand. Practice. Master.</p>`;
}
const VIEWS = {};
function route() {
  const id = (location.hash.match(/^#\/(\w+)/) || [])[1] || 'dashboard';
  const name = VIEWS[id] ? id : 'dashboard';
  document.body.classList.remove('nav-open'); $('#menu').setAttribute('aria-expanded', 'false');
  drawNav(name);
  if (!LL.state.profile && name !== 'settings') return VIEWS.onboard();
  VIEWS[name](); window.scrollTo(0, 0);
  document.title = (NAV.find(n => n[0] === name) || NAV[0])[1] + ' – LearnLoop';
}
const go = id => { if (location.hash === '#/' + id) route(); else location.hash = '#/' + id; };
const conceptList = subject => CONCEPTS.filter(c => !subject || subject === 'all' || c.subject === subject);

/* ---------- onboarding + diagnostic ---------- */
VIEWS.onboard = () => {
  main().innerHTML = `<section class="card hero" style="max-width:620px;margin:2rem auto"><h1>Welcome to LearnLoop</h1>
  <p class="mute">Don't just learn. Understand. Practice. Master. LearnLoop shows you <b>why</b> an answer is wrong, remembers your misunderstandings and brings them back until they are fixed.</p>
  <form id="ob" novalidate><label for="nm">What should we call you?</label><input type="text" id="nm" maxlength="30" autocomplete="given-name" aria-describedby="nmerr">
  <div class="err" id="nmerr" role="alert"></div>
  <label for="gl">What are you preparing for? <span class="mute">(optional)</span></label>
  <select id="gl"><option value="">Just learning</option><option>College exams</option><option>Lab / viva</option><option>Placements</option><option>Projects</option></select>
  <p class="small mute" style="margin-top:1rem">Your progress is saved in this browser on this device. Accounts and sync need a backend and are not part of this first version.</p>
  <p><button class="btn pri" type="submit">Continue</button></p></form></section>`;
  $('#ob').addEventListener('submit', e => {
    e.preventDefault();
    if (!LL.setProfile($('#nm').value, $('#gl').value)) { $('#nmerr').textContent = 'Please enter your name so we know what to call you.'; $('#nm').focus(); return; }
    VIEWS.diagnostic();
  });
};
VIEWS.diagnostic = () => {
  const qs = shuffle(CONCEPTS); let i = 0, right = 0;
  const step = () => {
    if (i >= qs.length) { LL.state.diagnosticDone = true; LL.save(); return summary(); }
    const c = qs[i];
    main().innerHTML = `<section class="card" style="max-width:720px;margin:1rem auto"><p class="mute small">Starting check · question ${i + 1} of ${qs.length} · ${esc(c.title)}</p><div class="steps">${qs.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'cur' : ''}"></i>`).join('')}</div><div id="qh"></div><p><button class="btn sm" id="skip">Skip the rest for now</button></p></section>`;
    renderMCQ($('#qh'), itemFor(c, 'check'), {concept: c.id, src: 'diagnostic'}, (ok, fb) => { if (ok) right++; nextBtn(fb, i === qs.length - 1 ? 'See my starting point' : 'Next question', () => { i++; step(); }); });
    $('#skip').addEventListener('click', () => { LL.state.diagnosticDone = i >= 1; LL.save(); go('dashboard'); });
  };
  const summary = () => {
    main().innerHTML = `<section class="card" style="max-width:720px;margin:1rem auto"><h1>Your starting point, ${esc(LL.state.profile.name)}</h1>
    <p>You answered <b>${right} of ${qs.length}</b> correctly. One question per topic is a very small sample, so treat this as a first signal, not a grade. Every answer you give from here on sharpens it.</p>
    <div class="notice info">Topics you missed are marked <b>Needs work</b> and will be recommended first.</div>
    <p><button class="btn pri" id="goDash">Open my dashboard</button></p></section>`;
    $('#goDash').addEventListener('click', () => go('dashboard'));
  };
  step();
};

/* ---------- dashboard ---------- */
function recommended() {
  const rank = c => { const l = LL.stats(c.id).level; return l === 'weak' ? 0 : l === 'untested' ? 1 : l === 'developing' ? 2 : 3; };
  return CONCEPTS.slice().sort((a, b) => rank(a) - rank(b)).filter(c => LL.stats(c.id).level !== 'solid').slice(0, 3);
}
VIEWS.dashboard = () => {
  const S = LL.state, p = S.profile, goal = S.prefs.goal, today = LL.todayCount(), st = LL.streak();
  const stats = CONCEPTS.map(c => ({c, s: LL.stats(c.id)}));
  const assessed = stats.filter(x => x.s.n).length, solid = stats.filter(x => x.s.level === 'solid').length;
  const weak = stats.filter(x => x.s.level === 'weak' || LL.openMisconceptions(x.c.id).length);
  const recent = LL.studiedRecently().slice(0, 4);
  const due = stats.filter(x => x.s.n && (Date.now() - x.s.last) / 864e5 >= (x.s.level === 'solid' ? 3 : 1));
  const q = S.quick;
  const first = !assessed && !S.views.length;
  main().innerHTML = `<section class="hero"><h1>Welcome back, ${esc(p.name)}</h1><p class="mute">${first ? 'Start with a lesson or a quick session. Nothing below is filled in until you actually practise.' : 'Here is where you stand, based only on questions you have answered.'}</p></section>
  ${!S.diagnosticDone && !assessed ? `<div class="card" style="margin:1rem 0"><h2>Take the starting check</h2><p class="mute">Eight short questions, one per topic, so LearnLoop knows where to begin.</p><button class="btn pri" id="diag">Start the check</button></div>` : ''}
  <div class="grid g3" style="margin:1rem 0">
   <div class="card"><h3>Daily goal</h3><p class="stat">${Math.min(today, goal)}<span class="mute" style="font-size:1rem"> / ${goal} questions</span></p><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${Math.min(today, goal)}"><i style="width:${Math.min(100, today / goal * 100)}%"></i></div><p class="small mute">${today >= goal ? 'Goal reached. Anything more is a bonus.' : `${goal - today} more to reach today's goal.`}</p></div>
   <div class="card"><h3>Learning streak</h3><p class="stat">${st}<span class="mute" style="font-size:1rem"> day${st === 1 ? '' : 's'}</span></p><p class="small mute">${st ? 'Days in a row with at least one answered question.' : 'Answer one question today to start a streak.'}</p></div>
   <div class="card"><h3>Overall progress</h3><p class="stat">${assessed}<span class="mute" style="font-size:1rem"> / ${CONCEPTS.length} topics assessed</span></p><div class="bar"><i style="width:${assessed / CONCEPTS.length * 100}%"></i></div><p class="small mute">${solid} solid so far. Reading lessons does not count; answers do.</p></div>
  </div>
  <div class="grid g2">
   <div class="card"><h2>Continue learning</h2>${q ? `<p>Unfinished <b>${q.minutes}-minute</b> session (${q.idx} of ${q.steps.length} steps done).</p><button class="btn pri" id="resume">Resume session</button>`
      : recent.length ? `<p>You last worked on <b>${esc(byId(recent[0].concept).title)}</b> ${ago(recent[0].t)}.</p><div class="row"><a class="btn pri" href="#/tutor/${recent[0].concept}">Open lesson</a><a class="btn" href="#/detective">Practise it</a></div>`
      : `<div class="empty">No lessons yet.<br><a class="btn pri" style="margin-top:.6rem" href="#/tutor/${CONCEPTS[0].id}">Start with ${esc(CONCEPTS[0].title)}</a></div>`}</div>
   <div class="card"><h2>Weak concepts</h2>${weak.length ? `<ul class="list">${weak.map(x => `<li><span><b>${esc(x.c.title)}</b><br><span class="small mute">${LL.openMisconceptions(x.c.id).map(m => esc(MIS[m.m])).join('; ') || 'Recent answers were mostly wrong'}</span></span><a class="btn sm" href="#/tutor/${x.c.id}">Review</a></li>`).join('')}</ul>` : `<div class="empty">${assessed ? 'No weak spots right now. Nice.' : 'Nothing to show yet. Weak spots appear after you answer questions.'}</div>`}</div>
   <div class="card"><h2>Recommended lessons</h2><ul class="list">${recommended().map(c => `<li><span><b>${esc(c.title)}</b><br><span class="small mute">${esc(c.blurb)}</span></span><span class="row">${pill(c.id)}<a class="btn sm" href="#/tutor/${c.id}">Learn</a></span></li>`).join('') || '<li class="mute">Every topic is solid so far. Try Challenge Mode.</li>'}</ul></div>
   <div class="card"><h2>Revision suggestions</h2>${due.length ? `<ul class="list">${due.map(x => `<li><span><b>${esc(x.c.title)}</b><br><span class="small mute">Last practised ${ago(x.s.last)}</span></span><a class="btn sm" href="#/quick">Revise</a></li>`).join('')}</ul>` : `<div class="empty">${assessed ? 'Nothing is due. Topics come back here a day or more after you practise them.' : 'Revision suggestions appear after your first practice.'}</div>`}</div>
   <div class="card" style="grid-column:1/-1"><h2>Recently studied</h2>${recent.length ? `<ul class="list">${recent.map(r => `<li><span><b>${esc(byId(r.concept).title)}</b> <span class="small mute">· ${ago(r.t)}</span></span>${pill(r.concept)}</li>`).join('')}</ul>` : '<div class="empty">Topics you study will be listed here.</div>'}</div>
  </div>`;
  const d = $('#diag'); if (d) d.addEventListener('click', VIEWS.diagnostic);
  const r = $('#resume'); if (r) r.addEventListener('click', () => go('quick'));
};

/* ---------- AI Tutor ---------- */
const SYN = {'py-vars': 'variable variables type types data string int float input str', 'py-cond': 'if elif else condition conditions conditional decision branch', 'py-loops': 'loop loops for while range iteration repeat', 'py-lists': 'list lists array index indexing slice slicing append', 'py-funcs': 'function functions def return parameter argument', 'sql-where': 'select where filter query sql', 'sql-agg': 'group aggregate count avg sum having groupby', 'sql-join': 'join joins cartesian tables multiple'};
function matchTopic(text) {
  const w = text.toLowerCase().split(/[^a-z]+/).filter(x => x.length > 1); if (!w.length) return null;
  let best = null, bs = 0;
  CONCEPTS.forEach(c => { const hay = (c.title + ' ' + SYN[c.id]).toLowerCase().split(/[^a-z]+/); const s = w.filter(x => hay.includes(x)).length; if (s > bs) { bs = s; best = c; } });
  return best;
}
const STYLES = [['beginner', 'Explain like I\'m a beginner'], ['real', 'Real-life example'], ['code', 'Code-based'], ['exam', 'Exam-oriented']];
VIEWS.tutor = () => {
  const arg = (location.hash.match(/^#\/tutor\/([\w-]+)/) || [])[1];
  if (arg && byId(arg)) return lesson(byId(arg));
  main().innerHTML = `<h1>AI Tutor</h1><p class="mute">Pick a topic, choose how you want it explained, then answer a question to prove it stuck.</p>
  <form class="card" id="tf" style="margin:1rem 0" novalidate><label for="tq">What do you want to learn?</label><div class="row"><input type="text" id="tq" list="tl" placeholder="e.g. loops, joins, return" style="flex:1;min-width:200px" maxlength="80"><button class="btn pri" type="submit">Teach me</button></div><datalist id="tl">${CONCEPTS.map(c => `<option value="${esc(c.title)}">`).join('')}</datalist><div class="err" id="terr" role="alert"></div></form>
  ${['python', 'sql'].map(s => `<h2>${SUBJECTS[s].icon} ${SUBJECTS[s].label}</h2><div class="grid g2" style="margin-bottom:1rem">${conceptList(s).map(c => `<a class="card" style="text-decoration:none;color:inherit" href="#/tutor/${c.id}"><div class="row sp"><h3>${esc(c.title)}</h3>${pill(c.id)}</div><p class="small mute">${esc(c.blurb)}</p></a>`).join('')}</div>`).join('')}
  <div class="card disabled-box"><span class="label-setup">AI setup needed</span><p class="small">Open-ended topics, story and visual explanations, and free follow-up questions need an AI provider connected through a backend. Until that is set up, the tutor teaches the built-in topics above with lessons that were written and checked in advance.</p></div>`;
  $('#tf').addEventListener('submit', e => {
    e.preventDefault(); const t = $('#tq').value.trim();
    if (!t) { $('#terr').textContent = 'Type a topic first, or pick one below.'; return; }
    const c = matchTopic(t);
    if (!c) { $('#terr').innerHTML = `There is no built-in lesson for “${esc(t)}”. Open-ended topics need the AI tutor, which is not set up yet. Pick one of the topics below.`; return; }
    go('tutor/' + c.id);
  });
};
function lesson(c) {
  const rec = LL.recommendStyle(c.id, STYLES.map(s => s[0]));
  let style = rec.style;
  const draw = () => {
    LL.view(c.id, style);
    const mis = LL.openMisconceptions(c.id);
    main().innerHTML = `<p><a href="#/tutor">← All topics</a></p><div class="row sp"><h1>${esc(c.title)}</h1>${pill(c.id)}</div>
    ${rec.changed && style === rec.style ? `<div class="notice info" style="margin:.5rem 0"><b>Trying a different explanation.</b> You have been getting this one wrong, so here is a style you have not seen yet.</div>` : ''}
    ${mis.length ? `<div class="gap"><b>Watch out for:</b> ${mis.map(m => esc(MIS[m.m])).join('; ')}</div>` : ''}
    <div class="tabs" role="group" aria-label="Explanation style">${STYLES.map(([k, l]) => `<button class="tab" data-s="${k}" aria-pressed="${k === style}">${l}</button>`).join('')}<button class="tab" disabled title="Needs the AI tutor to be set up">Story-based · AI setup</button><button class="tab" disabled title="Needs the AI tutor to be set up">Visual · AI setup</button></div>
    <section class="card"><p class="lesson">${esc(c.lesson[style === 'code' ? 'beginner' : style])}</p>${style === 'code' || style === 'beginner' || style === 'real' ? codeBlock(c.lesson.code, c.subject) : ''}</section>
    <section class="card" style="margin-top:1rem"><h2>Check your understanding</h2><p class="small mute">Reading is not mastery. This answer is what counts.</p><div id="qh"></div></section>
    <section class="card disabled-box" style="margin-top:1rem"><span class="label-setup">AI setup needed</span><p class="small">Ask a follow-up question in your own words. This needs the AI tutor to be connected; nothing here pretends to answer.</p><textarea class="fld" disabled rows="2" aria-label="Follow-up question (needs AI setup)" placeholder="Follow-up questions are not available yet"></textarea></section>`;
    $$('.tab[data-s]').forEach(b => b.addEventListener('click', () => { style = b.dataset.s; draw(); }));
    renderMCQ($('#qh'), itemFor(c, 'check'), {concept: c.id, src: 'tutor'}, (ok, fb) => {
      const row = document.createElement('div'); row.className = 'row'; row.style.marginTop = '.8rem';
      if (!ok) { const nxt = STYLES.map(s => s[0]).find(s => !LL.viewedStyles(c.id).includes(s)); if (nxt) { const b = document.createElement('button'); b.className = 'btn pri'; b.textContent = 'Explain it another way'; b.addEventListener('click', () => { style = nxt; draw(); }); row.appendChild(b); } }
      const a = document.createElement('a'); a.className = 'btn' + (ok ? ' pri' : ''); a.href = '#/detective'; a.textContent = 'Practise in Code Detective'; row.appendChild(a);
      const a2 = document.createElement('button'); a2.className = 'btn'; a2.textContent = 'Another question'; a2.addEventListener('click', () => { renderMCQ($('#qh'), itemFor(c, ['check', 'bug', 'predict'][Math.floor(Math.random() * 3)]), {concept: c.id, src: 'tutor'}, (ok2, fb2) => fb2.appendChild(row.cloneNode(false))); }); row.appendChild(a2);
      fb.appendChild(row);
    });
  };
  draw();
}

/* ---------- editor + fix the code ---------- */
function editor(host, value, lang) {
  host.innerHTML = `<div class="ed"><pre class="ed-hl" aria-hidden="true"></pre><textarea class="ed-in" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Code editor" rows="8"></textarea></div>`;
  const ta = $('.ed-in', host), pre = $('.ed-hl', host);
  const sync = () => { pre.innerHTML = hl(ta.value, lang) + '\n'; pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; };
  ta.value = value; sync();
  ta.addEventListener('input', sync); ta.addEventListener('scroll', sync);
  ta.addEventListener('keydown', e => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('    ', s, ta.selectionEnd, 'end'); sync(); } });
  const h = () => { const lines = ta.value.split('\n').length; ta.style.height = Math.max(150, lines * 22.4 + 30) + 'px'; pre.style.height = ta.style.height; };
  ta.addEventListener('input', h); h();
  return {get: () => ta.value, set: v => { ta.value = v; sync(); h(); }, el: ta};
}
const tableHtml = (cols, rows) => `<table class="t"><thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, 12).map(r => `<tr>${r.map(v => `<td>${esc(v === null ? 'NULL' : v)}</td>`).join('')}</tr>`).join('')}</tbody></table>${rows.length > 12 ? `<p class="small mute">…and ${rows.length - 12} more rows</p>` : ''}`;
let pyDown = false;
function renderFix(host, c, done) {
  const f = c.fix, sql = c.subject === 'sql'; let attempts = 0, hints = 0, revealed = false, solved = false;
  const wantRows = sql ? (SQLEngine.run(sqlDb(), f.solution).results.filter(x => x.kind === 'rows').pop() || {rows: []}).rows.length : 0;
  host.innerHTML = `<p><b>${esc(f.q)}</b></p>
   ${sql ? `<p class="small mute">Practice tables: <code>student(roll, name, marks, city)</code> and <code>club(roll, club)</code>. Your query should return <b>${wantRows}</b> row${wantRows === 1 ? '' : 's'}.</p>` : `<details open><summary class="small"><b>Test cases</b></summary><ul class="tests list">${f.tests.map(t => `<li>${esc(t.call)} <span class="mute">→ should print</span> ${esc(t.expect)}</li>`).join('')}</ul></details>`}
   <div id="ed"></div>
   <div class="row" style="margin-top:.6rem"><button class="btn" id="run">▶ Run</button><button class="btn pri" id="sub">Submit</button><button class="btn" id="rst">Reset</button><button class="btn" id="hint">Hint (0/3)</button><button class="btn" id="sol" disabled title="Available after 3 submissions">Show solution</button></div>
   <div id="hints" aria-live="polite"></div><div class="out" id="out" aria-live="polite">Output appears here.</div><div id="fbx" aria-live="polite"></div>`;
  const ed = editor($('#ed', host), f.starter, c.subject);
  const out = $('#out', host), fbx = $('#fbx', host);
  const down = () => { pyDown = true; out.innerHTML = ''; fbx.innerHTML = `<div class="notice"><b>The Python sandbox could not load.</b> It is downloaded from the internet the first time you use it, so check your connection and reload. The other practice modes still work. Nothing was graded.</div>`; };
  $('#run', host).addEventListener('click', async () => {
    if (sql) { const r = SQLEngine.run(sqlDb(), ed.get()); out.innerHTML = r.error ? `<span class="fail">${esc(r.error.message || r.error)}</span>` : (r.results.map(x => x.kind === 'rows' ? tableHtml(x.cols, x.rows) : esc(x.msg)).join('') || 'Ran with no output.'); return; }
    out.textContent = Runner.status === 'ready' || window.__llPython ? 'Running…' : 'Loading the Python sandbox (first time only)…';
    const r = await pyRun(ed.get()); if (r.unavailable) return down();
    out.innerHTML = r.err ? `<span class="fail">${esc(friendlyPyError(r.err))}</span>\n${esc(String(r.err).trim().split('\n').pop())}` : esc(r.out.trim() || '(Your code ran but printed nothing. Submit runs the test cases.)');
  });
  $('#rst', host).addEventListener('click', () => { ed.set(f.starter); out.textContent = 'Output appears here.'; fbx.innerHTML = ''; });
  $('#hint', host).addEventListener('click', e => { if (hints >= 3) return; hints++; $('#hints', host).innerHTML += `<div class="gap"><b>Hint ${hints}:</b> ${esc(f.hints[hints - 1])}</div>`; e.target.textContent = `Hint (${hints}/3)`; if (hints >= 3) e.target.disabled = true; });
  $('#sol', host).addEventListener('click', () => { revealed = true; ed.set(f.solution); fbx.innerHTML += `<div class="fb-ok" style="border-radius:14px;padding:.9rem 1rem;margin-top:.5rem"><b>Solution loaded into the editor.</b> ${esc(f.explainErr.text)} Revealed solutions do not count toward your progress.</div>`; });
  $('#sub', host).addEventListener('click', async () => {
    if (solved) return;
    let pass, detail = '';
    if (sql) {
      const g = gradeSql(f, ed.get(), SQLEngine, SQL_SEED); pass = g.pass;
      out.innerHTML = g.error ? `<span class="fail">${esc(g.error)}</span>` : tableHtml(g.cols, g.rows);
      detail = g.error ? `Your query could not run: ${esc(g.error)}` : pass ? '' : `Your query returned ${g.rows.length} row${g.rows.length === 1 ? '' : 's'}; the expected result has ${g.wantRows}${g.rows.length === g.wantRows ? ' but the values differ' : ''}.`;
    } else {
      out.textContent = 'Running the tests…';
      const g = await gradePython(f, ed.get(), pyRun); if (g.unavailable) return down();
      pass = g.pass;
      out.innerHTML = `<ul class="tests list">${g.results.map(r => `<li><span>${r.pass ? '<span class="pass">✓ pass</span>' : '<span class="fail">✗ fail</span>'} ${esc(r.call)}</span><span class="small">${r.pass ? '' : r.err ? esc(r.err) : `expected ${esc(r.expect)}, got ${esc(r.got || '(nothing)')}`}</span></li>`).join('')}</ul>`;
    }
    if (pass) {
      solved = true; if (!revealed) LL.record({concept: c.id, kind: 'fix', ok: true, src: 'detective'});
      fbx.innerHTML = `<div class="fb-ok" style="border-radius:14px;padding:.9rem 1rem;margin-top:.5rem"><b>${revealed ? 'Matches the solution.' : 'All tests pass.'}</b> What was going wrong: ${esc(f.explainErr.text)}</div>`;
      done && done(true, fbx);
    } else {
      attempts++; if (attempts === 1) LL.record({concept: c.id, kind: 'fix', ok: false, m: f.explainErr.m, src: 'detective'});
      if (attempts >= 3) $('#sol', host).disabled = false;
      fbx.innerHTML = `<div class="fb-bad" style="border-radius:14px;padding:.9rem 1rem;margin-top:.5rem"><p><b>Not there yet.</b> ${detail}</p>${attempts >= 2 ? `<p class="mis">Why this fails: ${esc(f.explainErr.text)}</p><p class="mis">Common misconception: ${esc(MIS[f.explainErr.m])}</p>` : '<p class="small">Use a hint, or change the code and submit again. A fuller explanation unlocks after your second try.</p>'}${attempts >= 3 ? '<p class="small">You can now load the solution.</p>' : ''}</div>`;
    }
  });
}

/* ---------- Code Detective ---------- */
VIEWS.detective = () => {
  let mode = 'bug', subj = 'all', cid = 'auto', level = 1, last = null, run = 0;
  const pick = () => {
    const pool = conceptList(subj).filter(c => cid === 'auto' || c.id === cid);
    const w = c => { const l = LL.stats(c.id).level; return l === 'weak' ? 4 : l === 'untested' ? 2 : l === 'developing' ? 2 : 1; };
    const bag = []; pool.forEach(c => { if (c.id !== last || pool.length === 1) for (let i = 0; i < w(c); i++) bag.push(c); });
    return bag[Math.floor(Math.random() * bag.length)] || pool[0];
  };
  const kindFor = c => {
    if (mode !== 'challenge') return mode;
    const ks = ['bug', 'predict', 'fix'].filter(k => !(k === 'fix' && c.subject === 'python' && pyDown));
    const near = ks.filter(k => c[k === 'predict' ? 'predict' : k].lvl <= level), pool = near.length ? near : ks;
    const exact = pool.filter(k => c[k].lvl === level); return (exact.length ? exact : pool)[Math.floor(Math.random() * (exact.length ? exact.length : pool.length))];
  };
  const MODES = [['bug', 'Find the Bug'], ['predict', 'Predict the Output'], ['fix', 'Fix the Code'], ['challenge', 'Challenge Mode']];
  const shell = () => {
    main().innerHTML = `<h1>Code Detective</h1><p class="mute">Find, predict and fix. When you are wrong, you get the reason, not only the answer.</p>
    <div class="tabs" role="group" aria-label="Mode">${MODES.map(([k, l]) => `<button class="tab" data-m="${k}" aria-pressed="${k === mode}">${l}</button>`).join('')}</div>
    <div class="row" style="margin-bottom:1rem"><label for="sj" style="margin:0">Subject</label><select id="sj" style="width:auto"><option value="all">Python + SQL</option><option value="python">Python</option><option value="sql">SQL</option></select><label for="cc" style="margin:0">Topic</label><select id="cc" style="width:auto;max-width:100%"></select></div>
    ${mode === 'challenge' ? `<div class="notice info" id="lvl" style="margin-bottom:1rem"></div>` : ''}
    <section class="card" id="stage"></section>
    <p class="small mute">Python runs in a sandbox inside your own browser (no server) and is stopped after 5 seconds. SQL runs on a private practice database. Wrong answers always come with the reason.</p>`;
    $('#sj').value = subj;
    const fill = () => { $('#cc').innerHTML = '<option value="auto">Choose for me (weak topics first)</option>' + conceptList(subj).map(c => `<option value="${c.id}">${esc(c.title)}</option>`).join(''); if (!conceptList(subj).some(c => c.id === cid)) cid = 'auto'; $('#cc').value = cid; };
    fill();
    $$('.tab[data-m]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.m; level = 1; shell(); next(); }));
    $('#sj').addEventListener('change', e => { subj = e.target.value; cid = 'auto'; fill(); next(); });
    $('#cc').addEventListener('change', e => { cid = e.target.value; next(); });
  };
  const next = () => {
    const c = pick(), k = kindFor(c), stage = $('#stage'); last = c.id; const my = ++run;
    const lv = $('#lvl'); if (lv) lv.innerHTML = `<b>Challenge level ${level} of 3.</b> Right answers raise the level, wrong answers lower it.`;
    stage.innerHTML = `<div class="row sp"><span class="pill">${esc(SUBJECTS[c.subject].label)} · ${esc(c.title)}</span>${pill(c.id)}</div><div id="qh" style="margin-top:.6rem"></div>`;
    const fin = (ok, fb) => {
      if (my !== run) return;
      if (mode === 'challenge') { const old = level; level = Math.max(1, Math.min(3, level + (ok ? 1 : -1))); fb.insertAdjacentHTML('beforeend', `<p class="small">${level > old ? 'Level up: harder next.' : level < old ? 'Back a level to rebuild your footing.' : ok ? 'Top level held.' : 'Staying at the easiest level.'}</p>`); const l = $('#lvl'); if (l) l.innerHTML = `<b>Challenge level ${level} of 3.</b> Right answers raise the level, wrong answers lower it.`; }
      nextBtn(fb, 'Next challenge', next);
    };
    if (k === 'fix') renderFix($('#qh'), c, fin); else renderMCQ($('#qh'), itemFor(c, k), {concept: c.id, src: 'detective'}, fin);
  };
  shell(); next();
};

/* ---------- QuickLearn ---------- */
const QL = {5: 1, 10: 2, 15: 3, 30: 4};
function buildSession(minutes, subject, goal) {
  const rank = c => { const l = LL.stats(c.id).level; return goal === 'revise' ? ({weak: 0, developing: 1, solid: 2, untested: 3})[l] : ({untested: 0, weak: 1, developing: 2, solid: 3})[l]; };
  const cs = shuffle(conceptList(subject)).sort((a, b) => rank(a) - rank(b)).slice(0, QL[minutes]);
  const steps = [];
  cs.forEach(c => { steps.push({t: 'read', c: c.id}, {t: 'q', c: c.id, k: 'check'}); if (minutes >= 10) steps.push({t: 'q', c: c.id, k: 'predict'}); if (minutes >= 15) steps.push({t: 'q', c: c.id, k: 'bug'}); });
  return {id: Date.now(), minutes, subject, goal, steps, idx: 0, results: []};
}
VIEWS.quick = () => {
  const q = LL.state.quick;
  if (q) return runQuick();
  let minutes = 10, subject = 'all', goal = 'learn';
  main().innerHTML = `<h1>QuickLearn</h1><p class="mute">A short session with a lesson, worked example, challenges and a knowledge check. Close the page any time and resume later.</p>
  <form class="card" id="qf" style="margin-top:1rem"><h3>How long do you have?</h3><div class="tabs" id="mins" role="group" aria-label="Minutes">${[5, 10, 15, 30].map(m => `<button type="button" class="tab" data-v="${m}" aria-pressed="${m === minutes}">${m} min</button>`).join('')}</div>
  <label for="qs">Subject</label><select id="qs"><option value="all">Python + SQL</option><option value="python">Python</option><option value="sql">SQL</option></select>
  <label for="qg">Goal</label><select id="qg"><option value="learn">Learn something new</option><option value="revise">Revise my weak spots</option></select>
  <p class="small mute">Sessions use the built-in topics. ${QL[minutes] ? '' : ''}Longer sessions cover more topics and add more questions.</p>
  <p><button class="btn pri" type="submit">Start session</button></p></form>`;
  $$('#mins .tab').forEach(b => b.addEventListener('click', () => { minutes = +b.dataset.v; $$('#mins .tab').forEach(x => x.setAttribute('aria-pressed', x === b)); }));
  $('#qf').addEventListener('submit', e => { e.preventDefault(); subject = $('#qs').value; goal = $('#qg').value; LL.state.quick = buildSession(minutes, subject, goal); LL.save(); runQuick(); });
};
function runQuick() {
  const q = LL.state.quick;
  if (q.idx >= q.steps.length) return finishQuick();
  const s = q.steps[q.idx], c = byId(s.c);
  const bar = `<div class="steps" role="progressbar" aria-valuemin="0" aria-valuemax="${q.steps.length}" aria-valuenow="${q.idx}">${q.steps.map((_, k) => `<i class="${k < q.idx ? 'done' : k === q.idx ? 'cur' : ''}"></i>`).join('')}</div>`;
  const adv = () => { q.idx++; LL.save(); runQuick(); };
  main().innerHTML = `<div class="row sp"><h1>QuickLearn · ${q.minutes} min</h1><button class="btn sm" id="pause">Save and exit</button></div>${bar}<section class="card"><p class="mute small">Step ${q.idx + 1} of ${q.steps.length} · ${esc(c.title)}</p><div id="qh"></div></section>`;
  $('#pause').addEventListener('click', () => go('dashboard'));
  const qh = $('#qh');
  if (s.t === 'read') {
    const rs = LL.recommendStyle(c.id, STYLES.map(x => x[0])).style, st = rs === 'code' ? 'beginner' : rs;
    LL.view(c.id, rs);
    qh.innerHTML = `<h2>${esc(c.title)}</h2><p class="lesson">${esc(c.lesson[st])}</p><h3>Worked example</h3>${codeBlock(c.lesson.code, c.subject)}<p class="small mute">Reading this does not count as learning yet. The next question does.</p><button class="btn pri" id="go">Continue</button>`;
    $('#go').addEventListener('click', adv);
  } else renderMCQ(qh, itemFor(c, s.k), {concept: c.id, src: 'quick'}, (ok, fb) => { q.results.push({c: c.id, k: s.k, ok}); LL.save(); nextBtn(fb, q.idx === q.steps.length - 1 ? 'Finish' : 'Next', adv); });
}
function finishQuick() {
  const q = LL.state.quick, res = q.results, right = res.filter(r => r.ok).length;
  const per = {}; res.forEach(r => { (per[r.c] = per[r.c] || {n: 0, ok: 0}).n++; if (r.ok) per[r.c].ok++; });
  const order = Object.keys(per).sort((a, b) => per[a].ok / per[a].n - per[b].ok / per[b].n), revise = order[0];
  LL.addSession({minutes: q.minutes, right, total: res.length, concepts: Object.keys(per)}); LL.state.quick = null; LL.save();
  const mis = Array.from(new Set(Object.keys(per).flatMap(id => LL.openMisconceptions(id).map(m => m.m))));
  main().innerHTML = `<h1>Session summary</h1><div class="card"><p class="stat">${right}<span class="mute" style="font-size:1rem"> / ${res.length} correct</span></p>
  <ul class="list">${Object.keys(per).map(id => `<li><b>${esc(byId(id).title)}</b><span>${per[id].ok} of ${per[id].n} correct · ${pill(id)}</span></li>`).join('')}</ul>
  ${mis.length ? `<div class="gap"><b>To watch:</b> ${mis.map(m => esc(MIS[m])).join('; ')}</div>` : ''}
  ${revise && per[revise].ok < per[revise].n ? `<p><b>Suggested revision:</b> ${esc(byId(revise).title)}.</p><a class="btn pri" href="#/tutor/${revise}">Review it now</a>` : '<p><b>Suggested revision:</b> nothing urgent. Try Challenge Mode in Code Detective.</p>'}
  <a class="btn" href="#/quick">New session</a> <a class="btn" href="#/dashboard">Dashboard</a></div>`;
}

/* ---------- My Progress ---------- */
VIEWS.progress = () => {
  const S = LL.state, hist = LL.history(40);
  const gaps = CONCEPTS.flatMap(c => LL.openMisconceptions(c.id).map(m => ({c, m})));
  const label = e => e.type === 'attempt' ? `${e.ok ? '✓' : '✗'} ${esc(byId(e.concept).title)} · ${e.kind}${e.m ? ' · ' + esc(MIS[e.m]) : ''}` : e.type === 'lesson' ? `Read “${esc(byId(e.concept).title)}” (${esc(e.style)} style)` : `QuickLearn ${e.minutes} min: ${e.right}/${e.total} correct`;
  main().innerHTML = `<h1>My Progress</h1><p class="mute">Levels come from answers you gave. “Not assessed yet” means LearnLoop has no evidence either way.</p>
  ${['python', 'sql'].map(s => `<section class="card" style="margin:1rem 0"><h2>${SUBJECTS[s].icon} ${SUBJECTS[s].label}</h2>${conceptList(s).map(c => { const st = LL.stats(c.id); return `<div class="mapbar"><span><b>${esc(c.title)}</b></span>${pill(c.id)}<div class="bar" aria-hidden="true"><i style="width:${st.n ? Math.round(st.c / st.n * 100) : 0}%"></i></div><span class="small mute" style="grid-column:1/-1">${st.n ? `${st.c} of ${st.n} answers correct` : 'No answers yet'}</span></div>`; }).join('')}</section>`).join('')}
  <section class="card"><h2>Gaps being tracked</h2>${gaps.length ? gaps.map(g => `<div class="gap"><b>${esc(g.c.title)}:</b> ${esc(MIS[g.m.m])} <span class="small mute">(${g.m.count}×; cleared after two correct answers)</span></div>`).join('') : '<div class="empty">No open misconceptions.</div>'}</section>
  <section class="card" style="margin-top:1rem"><h2>Learning history</h2>${hist.length ? `<ul class="list">${hist.map(e => `<li><span>${label(e)}</span><span class="small mute">${ago(e.t)}</span></li>`).join('')}</ul>` : '<div class="empty">Your history will appear here.</div>'}</section>`;
};

/* ---------- coming soon + settings ---------- */
const SOON = {
  notes: ['Notes Studio', 'Upload PDF notes and get topic lists, explanations and practice questions grounded in your own pages, with page references.', 'Needs file processing and an AI provider on a backend. Phase 2.'],
  examiner: ['AI Examiner', 'Viva and mock exam simulator that asks one question at a time, follows up on weak answers and produces a performance report.', 'Needs an AI provider to judge typed answers on reasoning, not keywords. Phase 2.'],
  skillmap: ['My SkillMap', 'A skill map with assessed levels, gaps, mini-projects and next milestones for Python, SQL, DSA and more.', 'A reliable map needs more assessed topics than exist yet. Phase 3. Until then, My Progress shows exactly what has been assessed.'],
};
Object.keys(SOON).forEach(k => VIEWS[k] = () => {
  const [t, d, why] = SOON[k];
  main().innerHTML = `<h1>${t} <span class="label-setup">Coming soon</span></h1><div class="card" style="margin-top:1rem"><p class="lesson">${d}</p><div class="notice info">${why}</div><p style="margin-top:1rem">Available now: <a href="#/tutor">AI Tutor</a>, <a href="#/detective">Code Detective</a>, <a href="#/quick">QuickLearn</a> and <a href="#/progress">My Progress</a>.</p></div>`;
});
function applyTheme() { const t = LL.state.prefs.theme; if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
VIEWS.settings = () => {
  const S = LL.state, p = S.profile || {name: '', goal: ''};
  main().innerHTML = `<h1>Settings</h1>
  <form class="card" id="sf" style="margin:1rem 0" novalidate><h2>Profile and preferences</h2>
   <label for="sn">Name</label><input type="text" id="sn" maxlength="30" value="${esc(p.name)}"><div class="err" id="snerr" role="alert"></div>
   <label for="sg">Daily goal (questions)</label><select id="sgl">${[3, 5, 10, 15, 20].map(n => `<option ${n === S.prefs.goal ? 'selected' : ''}>${n}</option>`).join('')}</select>
   <label for="st">Theme</label><select id="st"><option value="auto">Match my device</option><option value="light">Light</option><option value="dark">Dark</option></select>
   <p><button class="btn pri" type="submit">Save</button> <span id="saved" class="pass" role="status"></span></p></form>
  <section class="card" style="margin:1rem 0"><h2>AI features <span class="label-setup">Setup needed</span></h2><p>The AI tutor's free-form answers, Notes Studio and AI Examiner are <b>not connected</b>. They need a small backend that holds an AI provider key (never placed in browser code). Everything marked as working in this app works without AI.</p></section>
  <section class="card" style="margin:1rem 0"><h2>Plans</h2><div class="grid g2"><div><h3>Free <span class="pill">Current</span></h3><ul><li>Lessons, check questions and QuickLearn</li><li>Code Detective for Python and SQL</li><li>Progress saved in this browser</li></ul></div><div><h3>Premium <span class="label-setup">Planned</span></h3><ul><li>Higher AI limits</li><li>PDF notes and AI viva</li><li>Detailed performance reports</li></ul></div></div><p class="small mute">Premium is not on sale yet and no payment is collected anywhere in this app.</p></section>
  <section class="card"><h2>Your data</h2><p class="small mute">Stored only in this browser (no account, nothing sent to a server). Clearing site data deletes it.</p><div class="row"><button class="btn" id="exp">Download my data</button><button class="btn" id="del">Delete all my data</button></div></section>`;
  $('#st').value = S.prefs.theme;
  $('#sf').addEventListener('submit', e => {
    e.preventDefault(); const nm = $('#sn').value.trim();
    if (!nm) { $('#snerr').textContent = 'Name cannot be empty.'; return; } $('#snerr').textContent = '';
    if (S.profile) S.profile.name = nm.replace(/\s+/g, ' ').slice(0, 30); else LL.setProfile(nm, '');
    S.prefs.goal = +$('#sgl').value; S.prefs.theme = $('#st').value; LL.save(); applyTheme(); $('#saved').textContent = 'Saved.';
  });
  $('#exp').addEventListener('click', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(LL.state, null, 2)], {type: 'application/json'})); a.download = 'learnloop-data.json'; a.click(); });
  $('#del').addEventListener('click', () => { if (confirm('Delete all LearnLoop progress from this browser? This cannot be undone.')) { LL.reset(); applyTheme(); location.hash = '#/dashboard'; route(); } });
};

/* ---------- boot ---------- */
LL.load(); applyTheme();
$('#menu').addEventListener('click', () => { const o = document.body.classList.toggle('nav-open'); $('#menu').setAttribute('aria-expanded', o); });
$('#scrim').addEventListener('click', () => document.body.classList.remove('nav-open'));
window.addEventListener('hashchange', route);
route();
