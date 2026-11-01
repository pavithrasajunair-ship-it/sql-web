'use strict';
/* LearnLoop store: one student profile + one learning history shared by every module.
   Mastery is derived ONLY from assessed answers (questions answered, code that was run) - never from reading a lesson. */
const LL = (() => {
  const KEY = 'learnloop.v1';
  const DAY = 86400000;
  const FREE_DAILY = 15; // free plan: answered questions per day (soft limit: enforced in the browser only)
  const fresh = () => ({v: 1, plan: 'free', profile: null, diagnosticDone: false, attempts: [], views: [], sessions: [], quick: null, prefs: {goal: 5, theme: 'auto'}});
  let state = fresh();
  let now = () => Date.now();
  let mem = null; // fallback when localStorage is unavailable

  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); if (s && s.v === 1) state = Object.assign(fresh(), s, {prefs: Object.assign(fresh().prefs, s.prefs || {})}); } }
    catch (e) { if (mem) state = mem; }
    return state;
  }
  function save() {
    mem = state;
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
  }
  const reset = () => { state = fresh(); try { localStorage.removeItem(KEY); } catch (e) {} };
  const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };

  function setProfile(name, goal) {
    name = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    if (!name) return false;
    state.profile = {name, goal: String(goal || '').slice(0, 40), created: now()};
    save(); return true;
  }
  // kind: check | predict | bug | fix | diagnostic ; src: tutor | detective | quick | diagnostic
  function record(a) {
    state.attempts.push({t: now(), concept: a.concept, kind: a.kind, ok: !!a.ok, m: a.m || null, src: a.src || 'detective'});
    if (state.attempts.length > 3000) state.attempts.splice(0, state.attempts.length - 3000);
    save();
  }
  function view(concept, style) { state.views.push({t: now(), concept, style}); if (state.views.length > 500) state.views.shift(); save(); }

  function stats(id) {
    const a = state.attempts.filter(x => x.concept === id);
    const n = a.length, c = a.filter(x => x.ok).length;
    const recent = a.slice(-5), rc = recent.filter(x => x.ok).length;
    let level = 'untested';
    if (n) {
      const acc = rc / recent.length;
      if (n >= 4 && acc >= 0.8) level = 'solid';
      else if (acc < 0.5) level = 'weak';
      else level = 'developing';
    }
    return {n, c, level, last: n ? a[n - 1].t : 0, acc: n ? rc / recent.length : null};
  }
  // misconceptions seen on a concept that have not yet been followed by two correct answers on that concept
  function openMisconceptions(id) {
    const a = state.attempts.filter(x => x.concept === id), out = {};
    a.forEach((x, i) => {
      if (!x.ok && x.m) {
        const after = a.slice(i + 1).filter(y => y.ok).length;
        if (after < 2) out[x.m] = (out[x.m] || 0) + 1; else delete out[x.m];
      }
    });
    return Object.keys(out).map(m => ({m, count: out[m]}));
  }
  const viewedStyles = id => Array.from(new Set(state.views.filter(v => v.concept === id).map(v => v.style)));
  // if the student is struggling with a concept, suggest a style they have not yet been shown
  function recommendStyle(id, order) {
    const st = stats(id), struggling = st.level === 'weak' || openMisconceptions(id).length > 0;
    const seen = viewedStyles(id);
    if (!struggling || !seen.length) return {style: seen.length ? seen[seen.length - 1] : order[0], changed: false};
    const next = order.find(s => !seen.includes(s));
    return next ? {style: next, changed: true} : {style: order[(order.indexOf(seen[seen.length - 1]) + 1) % order.length], changed: true};
  }
  function todayCount() { const k = dayKey(now()); return state.attempts.filter(a => dayKey(a.t) === k).length; }
  const limit = () => state.plan === 'premium' ? Infinity : FREE_DAILY;
  const remaining = () => Math.max(0, limit() - todayCount());
  const atLimit = () => remaining() === 0;
  function streak() {
    const days = new Set(state.attempts.map(a => dayKey(a.t)));
    let t = now(), n = 0;
    if (!days.has(dayKey(t))) t -= DAY; // today not done yet does not break yesterday's streak
    while (days.has(dayKey(t))) { n++; t -= DAY; }
    return n;
  }
  const studiedRecently = () => {
    const seen = new Map();
    for (let i = state.attempts.length - 1; i >= 0; i--) { const a = state.attempts[i]; if (!seen.has(a.concept)) seen.set(a.concept, a.t); }
    for (let i = state.views.length - 1; i >= 0; i--) { const v = state.views[i]; if (!seen.has(v.concept)) seen.set(v.concept, v.t); }
    return Array.from(seen, ([concept, t]) => ({concept, t})).sort((x, y) => y.t - x.t);
  };
  function history(limit) {
    const ev = state.attempts.map(a => Object.assign({type: 'attempt'}, a))
      .concat(state.views.map(v => Object.assign({type: 'lesson'}, v)))
      .concat(state.sessions.map(s => Object.assign({type: 'session'}, s)));
    return ev.sort((a, b) => b.t - a.t).slice(0, limit || 50);
  }
  function addSession(s) { state.sessions.push(Object.assign({t: now()}, s)); save(); }
  return {
    get state() { return state; }, load, save, reset, setProfile, record, view, stats, openMisconceptions, viewedStyles,
    recommendStyle, todayCount, limit, remaining, atLimit, FREE_DAILY, streak, studiedRecently, history, addSession, dayKey,
    _setNow(f) { now = f; }, _fresh: fresh, _set(s) { state = s; },
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = LL;
