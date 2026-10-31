/* Landing page behaviour: scroll-linked film frame, reveal-on-scroll, word reveals, tilt, marquee, counters.
   Everything degrades to a plain static page if JS or motion is unavailable. */
(() => {
  const home = document.getElementById('home');
  if (!home) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (s, el = home) => el.querySelector(s), $$ = (s, el = home) => [...el.querySelectorAll(s)];
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, k) => a + (b - a) * k;
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  /* split headings into words ("*word" = gradient) */
  $$('[data-split]').forEach(el => {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', words.join(' ').replace(/\*/g, ''));
    el.innerHTML = words.map((w, i) => `<span class="sw${w[0] === '*' ? ' g' : ''}" style="--i:${i}" aria-hidden="true">${w.replace(/\*/g, '')}</span>`).join(' ');
    // everything after a "*" word shares the gradient
    let g = false; $$('.sw', el).forEach((s, i) => { if (words[i][0] === '*') g = true; if (g) s.classList.add('g'); });
  });

  /* marquee content */
  const terms = ['SELECT', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'JOIN', 'DISTINCT', 'LIKE', 'BETWEEN', 'COUNT()', 'UPDATE', 'DELETE', 'ALTER TABLE', 'PRIMARY KEY', 'FOREIGN KEY', 'INSERT INTO', 'CREATE TABLE', 'AVG()', 'MAX()', 'Python + MySQL'];
  const track = $('.lp-mtrack'); track.innerHTML = [...terms, ...terms].map(t => `<span>${t}</span>`).join('');

  /* reveal on scroll */
  const targets = $$('[data-reveal],[data-split]');
  let io = null;
  function counters(el) {
    $$('[data-stat]', el).forEach(b => {
      if (b._done) return; b._done = true; const n = +b.dataset.final || +b.textContent || 0, t0 = performance.now();
      if (reduced.matches) { b.textContent = n + (b.dataset.suffix || ''); return; }
      (function tick(now) { const k = clamp((now - t0) / 1300); b.textContent = Math.round(n * easeOut(k)) + (b.dataset.suffix || ''); if (k < 1) requestAnimationFrame(tick); })(t0);
    });
  }
  function setup() {
    document.documentElement.classList.add('lp-js');
    if (io) io.disconnect();
    if (reduced.matches || !('IntersectionObserver' in window)) { targets.forEach(t => t.classList.add('in')); $$('[data-stat]').forEach(b => b.textContent = (b.dataset.final || b.textContent) + (b.dataset.suffix || '')); return; }
    targets.forEach(t => t.classList.remove('in')); $$('[data-stat]').forEach(b => { b._done = false; });
    io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; e.target.classList.add('in'); io.unobserve(e.target);
      if (e.target.closest('.lp-stats')) counters(e.target);
    }), {root: home, threshold: 0.18, rootMargin: '0px 0px -6% 0px'});
    targets.forEach(t => io.observe(t));
  }

  /* film: autoplay muted, pause off-screen, controls */
  const vid = $('#lp-video'), playBtn = $('#lp-play'), muteBtn = $('#lp-mute');
  /* phones get the vertical 9:16 cut */
  const phone = matchMedia('(max-width: 700px)');
  const applyCut = () => {
    const want = phone.matches ? 'launch-vertical' : 'launch';
    if (vid.dataset.cut === want) return; vid.dataset.cut = want;
    const resume = !vid.paused; vid.poster = want + '-poster.jpg'; vid.src = want + '.mp4'; vid.load(); if (resume) vid.play().catch(() => {});
  };
  applyCut(); phone.addEventListener('change', applyCut);
  const syncPlay = () => { const m = vid.paused ? 'play' : 'pause'; playBtn.dataset.mode = m; playBtn.setAttribute('aria-label', m === 'play' ? 'Play film' : 'Pause film'); };
  const syncMute = () => { muteBtn.setAttribute('aria-pressed', String(vid.muted)); muteBtn.setAttribute('aria-label', vid.muted ? 'Unmute film' : 'Mute film'); };
  let userPaused = false, inView = false;
  const tryPlay = () => { if (reduced.matches || userPaused || !inView || document.body.dataset.view !== 'home') return; const p = vid.play(); if (p && p.catch) p.catch(syncPlay); };
  playBtn.addEventListener('click', () => { if (vid.paused) { userPaused = false; vid.play().catch(syncPlay); } else { userPaused = true; vid.pause(); } });
  muteBtn.addEventListener('click', () => { vid.muted = !vid.muted; syncMute(); if (!vid.muted) { userPaused = false; vid.play().catch(syncPlay); } });
  vid.addEventListener('play', syncPlay); vid.addEventListener('pause', syncPlay);
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { inView = es[0].isIntersecting; inView ? tryPlay() : vid.pause(); }, {root: home, threshold: 0.25}).observe($('#lp-vframe'));
  else inView = true;
  syncPlay(); syncMute();

  /* scroll-linked motion */
  const bar = $('#lp-progress'), vtrack = $('#lp-vtrack'), vframe = $('#lp-vframe'), orbs = $$('.lp-orb'), shots = $$('[data-tilt]');
  let ticking = false;
  function frame() {
    ticking = false;
    if (document.body.dataset.view !== 'home') return;
    const st = home.scrollTop, vh = home.clientHeight, max = home.scrollHeight - vh;
    bar.style.transform = `scaleX(${max > 0 ? st / max : 0})`;
    if (reduced.matches) return;
    // film frame grows from a card to full width, radius tightens
    const r = vtrack.getBoundingClientRect(), hr = home.getBoundingClientRect();
    const p = clamp((hr.top - r.top + vh * 0.15) / (r.height - vh * 0.6));
    const k = easeOut(clamp(p * 1.7));
    vframe.style.transform = `scale(${lerp(0.78, 1, k)})`; vframe.style.borderRadius = `${lerp(28, 14, k)}px`;
    // ambient orbs drift with scroll
    orbs.forEach((o, i) => { o.style.transform = `translate3d(0,${st * (i % 2 ? -0.12 : 0.1)}px,0)`; });
    // screenshots rise and un-tilt as they arrive
    shots.forEach(s => {
      const b = s.getBoundingClientRect(), t = clamp(1 - (b.top - hr.top - vh * 0.12) / (vh * 0.72));
      const e = easeOut(t); s.style.transform = `perspective(1800px) translateY(${(1 - e) * 70}px) rotateX(${(1 - e) * 11}deg) scale(${lerp(0.93, 1, e)})`;
    });
  }
  home.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, {passive: true});
  addEventListener('resize', () => requestAnimationFrame(frame));

  /* called by app.js whenever the homepage is (re)shown */
  window.landingEnter = () => { home.scrollTop = 0; setup(); frame(); tryPlay(); };
  new MutationObserver(() => { if (document.body.dataset.view !== 'home') vid.pause(); else tryPlay(); }).observe(document.body, {attributes: true, attributeFilter: ['data-view']});
  reduced.addEventListener('change', () => { setup(); frame(); });
  if (document.body.dataset.view === 'home') window.landingEnter();     // first load
})();
