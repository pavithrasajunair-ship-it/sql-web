'use strict';
/* Code execution.
   Python: Pyodide (CPython compiled to WebAssembly) inside a Web Worker. The student's code runs in the student's own browser sandbox,
   with no DOM access and a hard timeout (the worker is terminated). It never runs on a server.
   SQL: the built-in in-memory SQL engine on a fresh practice database. */
const Runner = (() => {
  const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
  const WORKER = `
    let py = null;
    self.onmessage = async (e) => {
      const {id, code, init} = e.data;
      try {
        if (!py) { importScripts('${PYODIDE}pyodide.js'); py = await loadPyodide({indexURL: '${PYODIDE}'}); }
        if (init) { self.postMessage({id, ready: true}); return; }
        const g = py.globals.get('dict')();
        py.runPython('import sys, io\\n_buf = io.StringIO()\\nsys.stdout = _buf\\nsys.stderr = _buf', {globals: g});
        let err = null;
        try { await py.runPythonAsync(code, {globals: g}); } catch (ex) { err = String(ex.message || ex); }
        const out = py.runPython('_buf.getvalue()', {globals: g});
        g.destroy();
        self.postMessage({id, out, err});
      } catch (ex) { self.postMessage({id, fatal: String(ex.message || ex)}); }
    };`;
  let worker = null, seq = 0, pending = new Map(), status = 'idle'; // idle | loading | ready | unavailable

  function spawn() {
    const url = URL.createObjectURL(new Blob([WORKER], {type: 'text/javascript'}));
    worker = new Worker(url);
    worker.onmessage = e => { const p = pending.get(e.data.id); if (p) { pending.delete(e.data.id); p(e.data); } };
    worker.onerror = () => { pending.forEach(p => p({fatal: 'The Python runner could not start.'})); pending.clear(); };
  }
  function call(msg, timeout) {
    return new Promise(res => {
      if (typeof Worker === 'undefined') { status = 'unavailable'; return res({fatal: 'This browser cannot run the Python sandbox.'}); }
      if (!worker) spawn();
      const id = ++seq; let done = false;
      const timer = setTimeout(() => { if (done) return; done = true; pending.delete(id); try { worker.terminate(); } catch (e) {} worker = null; status = 'idle'; res({timeout: true}); }, timeout);
      pending.set(id, r => { if (done) return; done = true; clearTimeout(timer); res(r); });
      worker.postMessage(Object.assign({id}, msg));
    });
  }
  // first load downloads the interpreter (a few MB), so it gets a generous timeout
  async function warmup() {
    if (status === 'ready') return true;
    status = 'loading';
    const r = await call({init: true}, 40000);
    status = r.ready ? 'ready' : 'unavailable';
    return status === 'ready';
  }
  async function python(code) {
    if (status !== 'ready' && !(await warmup())) return {unavailable: true};
    const r = await call({code}, 5000);
    if (r.timeout) return {out: '', err: 'TimeoutError: your code ran for more than 5 seconds and was stopped. Check for a loop that never ends.'};
    if (r.fatal) return {unavailable: true};
    return {out: r.out || '', err: r.err};
  }
  return {python, warmup, get status() { return status; }};
})();

/* Explain Python errors in plain words (the last line of a traceback names the error type) */
function friendlyPyError(err) {
  if (!err) return '';
  const last = String(err).trim().split('\n').pop();
  const type = (last.match(/^(\w+Error|\w+Exception)/) || [])[1] || '';
  const map = {
    SyntaxError: 'Python could not read the code. Look for a missing colon, bracket, quote or wrong indentation near the line it points to.',
    IndentationError: 'The indentation (spaces at the start of the line) does not line up. Lines inside a block must be indented by the same amount.',
    NameError: 'A name is used before it exists. Check the spelling, or that the variable was created before this line.',
    TypeError: 'An operation was used on the wrong kind of value, for example adding text to a number, or using None as a number.',
    IndexError: 'The list position does not exist. Remember positions run from 0 to len(list) - 1.',
    ZeroDivisionError: 'The code divides by zero.',
    ValueError: 'The value has the right type but an unusable content, for example int("abc").',
    KeyError: 'That key is not in the dictionary.',
    AttributeError: 'That object has no such method or attribute. Check the name and the type of the value.',
    TimeoutError: 'The code ran too long and was stopped.',
  };
  return (type ? type + ': ' : '') + (map[type] || 'Read the last line of the error message: it names the problem and the line number.');
}

/* Grade a Python "fix the code" item. runner(code) -> {out, err} | {unavailable} */
async function gradePython(item, code, runner) {
  const results = [];
  for (const t of item.tests) {
    const r = await runner(code + '\n' + t.call);
    if (r.unavailable) return {unavailable: true};
    const got = (r.out || '').trim();
    results.push({call: t.call, expect: t.expect, got: r.err ? '' : got, err: r.err ? friendlyPyError(r.err) + '  [' + String(r.err).trim().split('\n').pop() + ']' : '', pass: !r.err && got === t.expect});
    if (r.err) break; // same crash would repeat for every test
  }
  return {results, pass: results.length === item.tests.length && results.every(r => r.pass)};
}

/* Grade a SQL "fix the query" item: same rows as the reference solution on a fresh practice database */
function gradeSql(item, sql, SQL, seed) {
  const mk = () => { const d = SQL.newDb(); SQL.run(d, seed); return d; };
  const mine = SQL.run(mk(), sql), ref = SQL.run(mk(), item.solution);
  if (mine.error) return {pass: false, error: mine.error.message || String(mine.error), cols: null, rows: null};
  const last = r => { const q = r.results.filter(x => x.kind === 'rows'); return q[q.length - 1]; };
  const a = last(mine), b = last(ref);
  if (!a) return {pass: false, error: 'Your query did not return a table. Start with SELECT.', cols: null, rows: null};
  const norm = r => r.rows.map(x => JSON.stringify(x)).sort().join('|');
  const sameCols = a.cols.length === b.cols.length;
  return {pass: sameCols && norm(a) === norm(b), cols: a.cols, rows: a.rows, wantRows: b.rows.length, error: null};
}
if (typeof module !== 'undefined' && module.exports) module.exports = {friendlyPyError, gradePython, gradeSql};
