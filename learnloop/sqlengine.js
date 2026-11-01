'use strict';
/* Small MySQL-flavoured SQL engine (runs fully in the browser, no server). Covers the Class 12 syllabus:
   SELECT (DISTINCT, WHERE, JOIN, GROUP BY, HAVING, ORDER BY, LIMIT), INSERT, UPDATE, DELETE, CREATE/DROP/ALTER TABLE,
   TRUNCATE, SHOW TABLES, DESCRIBE. Not supported: subqueries, UNION, views, transactions. */
const SQLEngine = (() => {
  class SQLError extends Error { constructor(code, msg, info = {}) { super(msg); this.code = code; this.info = info; } }
  const err = (c, m, i) => new SQLError(c, m, i);
  const AGG = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']);

  /* ---------- tokenizer ---------- */
  function tokenize(sql) {
    const out = [], re = /\s+|--[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|('(?:[^'\\]|\\.|'')*')|("(?:[^"\\]|\\.|"")*")|(`[^`]*`)|(\d+\.?\d*|\.\d+)|([A-Za-z_][A-Za-z0-9_$]*)|(<=>|<=|>=|<>|!=|==|[(),;.*+\-\/%=<>])/y;
    let p = 0, m;
    while (p < sql.length) {
      re.lastIndex = p; m = re.exec(sql);
      if (!m) {
        if (/['"`]/.test(sql[p])) throw err(1064, `Unterminated quote ${sql[p]} — a text value or name is not closed`, {near: sql.slice(p, p + 20), kind: 'quote'});
        throw err(1064, `Unexpected character '${sql[p]}'`, {near: sql.slice(p, p + 20), kind: 'char'});
      }
      if (m[1] || m[2]) out.push({t: 'str', v: m[0].slice(1, -1).replace(/\\(.)|''|""/g, (x, c) => c ? ({n: '\n', t: '\t'}[c] || c) : x[0]), pos: p});
      else if (m[3]) out.push({t: 'id', v: m[0].slice(1, -1), pos: p, q: true});
      else if (m[4]) out.push({t: 'num', v: parseFloat(m[0]), pos: p});
      else if (m[5]) out.push({t: 'id', v: m[0], pos: p});
      else if (m[6]) out.push({t: 'op', v: m[0], pos: p});
      p = re.lastIndex;
    }
    out.push({t: 'eof', v: '', pos: sql.length});
    return out;
  }

  /* ---------- parser ---------- */
  const RESERVED = new Set('SELECT FROM WHERE GROUP BY HAVING ORDER LIMIT JOIN INNER LEFT RIGHT CROSS NATURAL ON AS AND OR NOT SET VALUES INTO'.split(' '));
  class Parser {
    constructor(sql) { this.sql = sql; this.tk = tokenize(sql); this.i = 0; }
    get cur() { return this.tk[this.i]; }
    isKw(...ws) { const c = this.cur; return c.t === 'id' && !c.q && ws.includes(c.v.toUpperCase()); }
    isOp(o) { return this.cur.t === 'op' && this.cur.v === o; }
    acceptKw(...ws) { if (this.isKw(...ws)) { return this.tk[this.i++].v.toUpperCase(); } return null; }
    acceptOp(o) { if (this.isOp(o)) { this.i++; return true; } return false; }
    syntax(expected) {
      const c = this.cur, near = this.sql.slice(c.pos, c.pos + 25) || '(end of query)';
      return err(1064, `You have an error in your SQL syntax near '${near}'`, {near, pos: c.pos, expected, kind: 'syntax', prev: this.tk[this.i - 1]});
    }
    expectKw(w) { if (!this.acceptKw(w)) throw this.syntax(w); }
    expectOp(o) { if (!this.acceptOp(o)) throw this.syntax(o); }
    ident() { const c = this.cur; if (c.t !== 'id' || (!c.q && RESERVED.has(c.v.toUpperCase()))) throw this.syntax('a name'); this.i++; return c.v; }

    script() {
      const stmts = [];
      while (this.cur.t !== 'eof') { if (this.acceptOp(';')) continue; stmts.push(this.statement()); if (this.cur.t !== 'eof') this.expectOp(';'); }
      return stmts;
    }
    statement() {
      const w = this.cur.t === 'id' ? this.cur.v.toUpperCase() : '';
      switch (w) {
        case 'SELECT': return this.select();
        case 'INSERT': return this.insert();
        case 'UPDATE': return this.update();
        case 'DELETE': return this.del();
        case 'CREATE': return this.create();
        case 'DROP': { this.i++; this.expectKw('TABLE'); const ie = !!(this.acceptKw('IF') && (this.expectKw('EXISTS'), 1)); return {k: 'drop', name: this.ident(), ie}; }
        case 'TRUNCATE': { this.i++; this.acceptKw('TABLE'); return {k: 'truncate', name: this.ident()}; }
        case 'ALTER': return this.alter();
        case 'SHOW': { this.i++; this.expectKw('TABLES'); return {k: 'show'}; }
        case 'DESCRIBE': case 'DESC': case 'EXPLAIN': { this.i++; return {k: 'describe', name: this.ident()}; }
        default: throw this.syntax('a statement such as SELECT, INSERT, UPDATE, DELETE or CREATE');
      }
    }
    select() {
      this.expectKw('SELECT');
      const s = {k: 'select', distinct: false, items: [], from: [], where: null, group: [], having: null, order: [], limit: null, offset: 0};
      if (this.acceptKw('DISTINCT')) s.distinct = true; else this.acceptKw('ALL');
      do {
        if (this.isOp('*')) { this.i++; s.items.push({star: true}); continue; }
        if (this.cur.t === 'id' && this.tk[this.i + 1].v === '.' && this.tk[this.i + 2].v === '*') { s.items.push({star: true, tbl: this.cur.v}); this.i += 3; continue; }
        const start = this.cur.pos, e = this.expr();
        let alias = null;
        if (this.acceptKw('AS')) alias = this.cur.t === 'str' ? this.tk[this.i++].v : this.ident();
        else if (this.cur.t === 'id' && !RESERVED.has(this.cur.v.toUpperCase())) alias = this.ident();
        else if (this.cur.t === 'str') alias = this.tk[this.i++].v;
        s.items.push({e, alias, text: this.sql.slice(start, this.tk[this.i - 1].pos + String(this.tk[this.i - 1].v).length + (this.tk[this.i - 1].t === 'str' ? 2 : 0)).trim()});
      } while (this.acceptOp(','));
      if (this.acceptKw('FROM')) {
        s.from.push(this.tref());
        for (;;) {
          if (this.acceptOp(',')) { s.from.push({...this.tref(), join: 'cross'}); continue; }
          let jt = null;
          if (this.acceptKw('NATURAL')) { this.acceptKw('INNER'); jt = 'natural'; }
          else if (this.acceptKw('CROSS')) jt = 'cross';
          else if (this.acceptKw('LEFT')) { this.acceptKw('OUTER'); jt = 'left'; }
          else if (this.acceptKw('RIGHT')) { this.acceptKw('OUTER'); jt = 'right'; }
          else if (this.acceptKw('INNER')) jt = 'inner';
          if (jt || this.isKw('JOIN')) {
            this.expectKw('JOIN'); const t = {...this.tref(), join: jt || 'inner'};
            if (this.acceptKw('ON')) t.on = this.expr();
            else if (this.acceptKw('USING')) { this.expectOp('('); t.using = [this.ident()]; while (this.acceptOp(',')) t.using.push(this.ident()); this.expectOp(')'); }
            else if (t.join === 'inner' || t.join === 'left' || t.join === 'right') t.join = jt && jt !== 'inner' ? t.join : 'cross';
            s.from.push(t); continue;
          }
          break;
        }
      }
      if (this.acceptKw('WHERE')) s.where = this.expr();
      if (this.acceptKw('GROUP')) { this.expectKw('BY'); do s.group.push(this.expr()); while (this.acceptOp(',')); }
      if (this.acceptKw('HAVING')) s.having = this.expr();
      if (this.acceptKw('ORDER')) { this.expectKw('BY'); do { const e = this.expr(); const d = this.acceptKw('DESC'); if (!d) this.acceptKw('ASC'); s.order.push({e, desc: !!d}); } while (this.acceptOp(',')); }
      if (this.acceptKw('LIMIT')) {
        const n = this.cur; if (n.t !== 'num') throw this.syntax('a number'); this.i++; s.limit = n.v;
        if (this.acceptOp(',')) { s.offset = s.limit; const m = this.cur; if (m.t !== 'num') throw this.syntax('a number'); this.i++; s.limit = m.v; }
        else if (this.acceptKw('OFFSET')) { const m = this.cur; if (m.t !== 'num') throw this.syntax('a number'); this.i++; s.offset = m.v; }
      }
      return s;
    }
    tref() {
      const name = this.ident(); let alias = null;
      if (this.acceptKw('AS')) alias = this.ident();
      else if (this.cur.t === 'id' && !RESERVED.has(this.cur.v.toUpperCase()) && !this.isKw('USING')) alias = this.ident();
      return {name, alias: alias || name};
    }
    insert() {
      this.expectKw('INSERT'); this.acceptKw('INTO'); const name = this.ident(); let cols = null;
      if (this.isOp('(')) { this.i++; cols = [this.ident()]; while (this.acceptOp(',')) cols.push(this.ident()); this.expectOp(')'); }
      if (!this.acceptKw('VALUES') && !this.acceptKw('VALUE')) throw this.syntax('VALUES');
      const rows = [];
      do { this.expectOp('('); const r = [this.expr()]; while (this.acceptOp(',')) r.push(this.expr()); this.expectOp(')'); rows.push(r); } while (this.acceptOp(','));
      return {k: 'insert', name, cols, rows};
    }
    update() {
      this.expectKw('UPDATE'); const name = this.ident(); this.expectKw('SET'); const sets = [];
      do { const c = this.ident(); this.expectOp('='); sets.push({c, e: this.expr()}); } while (this.acceptOp(','));
      return {k: 'update', name, sets, where: this.acceptKw('WHERE') ? this.expr() : null};
    }
    del() { this.expectKw('DELETE'); this.expectKw('FROM'); const name = this.ident(); return {k: 'delete', name, where: this.acceptKw('WHERE') ? this.expr() : null}; }
    colDef() {
      const name = this.ident(), tn = this.ident().toUpperCase(); let len = null;
      if (this.acceptOp('(')) { len = this.cur.v; this.i++; while (this.acceptOp(',')) this.i++; this.expectOp(')'); }
      const c = {name, type: tn, len, pk: false, nn: false, uq: false, def: undefined, ai: false};
      if (!/^(INT|INTEGER|SMALLINT|TINYINT|BIGINT|FLOAT|DOUBLE|DECIMAL|NUMERIC|CHAR|VARCHAR|TEXT|DATE|DATETIME)$/.test(tn)) throw err(1064, `Unknown data type '${tn}'`, {kind: 'type', bad: tn});
      for (;;) {
        if (this.acceptKw('PRIMARY')) { this.expectKw('KEY'); c.pk = c.nn = true; }
        else if (this.acceptKw('NOT')) { this.expectKw('NULL'); c.nn = true; }
        else if (this.acceptKw('NULL')) { /* default */ }
        else if (this.acceptKw('UNIQUE')) c.uq = true;
        else if (this.acceptKw('AUTO_INCREMENT')) c.ai = true;
        else if (this.acceptKw('DEFAULT')) c.def = this.expr();
        else break;
      }
      return c;
    }
    create() {
      this.expectKw('CREATE'); this.expectKw('TABLE'); const ine = !!(this.acceptKw('IF') && (this.expectKw('NOT'), this.expectKw('EXISTS'), 1));
      const name = this.ident(); this.expectOp('('); const cols = []; let pk = [];
      do {
        if (this.acceptKw('PRIMARY')) { this.expectKw('KEY'); this.expectOp('('); pk.push(this.ident()); while (this.acceptOp(',')) pk.push(this.ident()); this.expectOp(')'); }
        else cols.push(this.colDef());
      } while (this.acceptOp(','));
      this.expectOp(')');
      return {k: 'create', name, cols, pk, ine};
    }
    alter() {
      this.expectKw('ALTER'); this.expectKw('TABLE'); const name = this.ident();
      if (this.acceptKw('ADD')) { this.acceptKw('COLUMN'); return {k: 'alter', name, op: 'add', col: this.colDef()}; }
      if (this.acceptKw('DROP')) { this.acceptKw('COLUMN'); return {k: 'alter', name, op: 'drop', col: this.ident()}; }
      throw this.syntax('ADD or DROP');
    }

    /* expressions: OR < AND < NOT < comparison < + - < * / % < unary < primary */
    expr() { return this.orE(); }
    orE() { let l = this.andE(); while (this.acceptKw('OR')) l = {k: 'bin', op: 'OR', l, r: this.andE()}; return l; }
    andE() { let l = this.notE(); while (this.acceptKw('AND')) l = {k: 'bin', op: 'AND', l, r: this.notE()}; return l; }
    notE() { return this.acceptKw('NOT') ? {k: 'not', e: this.notE()} : this.cmp(); }
    cmp() {
      let l = this.add();
      for (;;) {
        const c = this.cur;
        if (c.t === 'op' && ['=', '==', '<>', '!=', '<', '>', '<=', '>='].includes(c.v)) { this.i++; l = {k: 'bin', op: c.v === '==' ? '=' : c.v === '!=' ? '<>' : c.v, l, r: this.add()}; continue; }
        if (this.acceptKw('IS')) { const neg = !!this.acceptKw('NOT'); this.expectKw('NULL'); l = {k: 'isnull', e: l, neg}; continue; }
        const save = this.i, neg = !!this.acceptKw('NOT');
        if (this.acceptKw('LIKE')) { l = {k: 'like', e: l, p: this.add(), neg}; continue; }
        if (this.acceptKw('BETWEEN')) { const lo = this.add(); this.expectKw('AND'); l = {k: 'btw', e: l, lo, hi: this.add(), neg}; continue; }
        if (this.acceptKw('IN')) { this.expectOp('('); const list = [this.expr()]; while (this.acceptOp(',')) list.push(this.expr()); this.expectOp(')'); l = {k: 'in', e: l, list, neg}; continue; }
        this.i = save; return l;
      }
    }
    add() { let l = this.mul(); while (this.isOp('+') || this.isOp('-')) { const op = this.tk[this.i++].v; l = {k: 'bin', op, l, r: this.mul()}; } return l; }
    mul() {
      let l = this.unary();
      while (this.isOp('*') || this.isOp('/') || this.isOp('%') || this.isKw('DIV', 'MOD')) { const op = this.tk[this.i++].v.toUpperCase(); l = {k: 'bin', op: op === 'MOD' ? '%' : op, l, r: this.unary()}; }
      return l;
    }
    unary() { if (this.acceptOp('-')) return {k: 'neg', e: this.unary()}; if (this.acceptOp('+')) return this.unary(); return this.primary(); }
    primary() {
      const c = this.cur;
      if (c.t === 'num') { this.i++; return {k: 'lit', v: c.v}; }
      if (c.t === 'str') { this.i++; return {k: 'lit', v: c.v}; }
      if (this.acceptOp('(')) { const e = this.expr(); this.expectOp(')'); return e; }
      if (c.t === 'id' && !c.q) {
        const u = c.v.toUpperCase();
        if (u === 'NULL') { this.i++; return {k: 'lit', v: null}; }
        if (u === 'TRUE' || u === 'FALSE') { this.i++; return {k: 'lit', v: u === 'TRUE' ? 1 : 0}; }
        if (u === 'CASE') return this.caseE();
        if (this.tk[this.i + 1].v === '(' && this.tk[this.i + 1].t === 'op') {
          this.i += 2; const f = {k: 'fn', name: u, args: [], distinct: false, star: false};
          if (this.acceptOp('*')) f.star = true;
          else if (!this.isOp(')')) { if (this.acceptKw('DISTINCT')) f.distinct = true; f.args.push(this.expr()); while (this.acceptOp(',')) f.args.push(this.expr()); }
          this.expectOp(')'); return f;
        }
      }
      if (c.t === 'id' && (c.q || !RESERVED.has(c.v.toUpperCase()))) {
        this.i++;
        if (this.isOp('.') && this.tk[this.i + 1].t === 'id') { this.i++; const n = this.tk[this.i++].v; return {k: 'col', tbl: c.v, name: n}; }
        return {k: 'col', tbl: null, name: c.v, pos: c.pos};
      }
      throw this.syntax('a value, column name or expression');
    }
    caseE() {
      this.i++; const whens = []; let els = null;
      while (this.acceptKw('WHEN')) { const w = this.expr(); this.expectKw('THEN'); whens.push([w, this.expr()]); }
      if (this.acceptKw('ELSE')) els = this.expr();
      this.expectKw('END'); return {k: 'case', whens, els};
    }
  }

  /* ---------- value helpers (MySQL-like: text compares ignore case, NULL propagates) ---------- */
  const isNum = v => typeof v === 'number';
  const num = v => v === null ? null : isNum(v) ? v : (parseFloat(v) || 0);
  const truthy = v => v === null ? null : (isNum(v) ? v !== 0 : (parseFloat(v) || 0) !== 0) ? 1 : 0;
  function cmpv(a, b) {
    if (a === null || b === null) return null;
    if (isNum(a) || isNum(b)) { const x = num(a), y = num(b); return x < y ? -1 : x > y ? 1 : 0; }
    const x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0;
  }
  const sortCmp = (a, b) => a === null ? (b === null ? 0 : -1) : b === null ? 1 : cmpv(a, b);
  const likeRe = p => new RegExp('^' + String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'is');
  const rnd = (x, d = 0) => { const f = Math.pow(10, d); return Math.sign(x) * Math.round(Math.abs(x) * f + 1e-9) / f; };
  const D = v => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v === null ? '' : String(v)); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
  const pad = n => String(n).padStart(2, '0'), today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const FN = {
    UPPER: s => s === null ? null : String(s).toUpperCase(), UCASE: s => FN.UPPER(s),
    LOWER: s => s === null ? null : String(s).toLowerCase(), LCASE: s => FN.LOWER(s),
    LENGTH: s => s === null ? null : String(s).length, CHAR_LENGTH: s => FN.LENGTH(s),
    TRIM: s => s === null ? null : String(s).trim(), LTRIM: s => s === null ? null : String(s).trimStart(), RTRIM: s => s === null ? null : String(s).trimEnd(),
    LEFT: (s, n) => s === null ? null : String(s).slice(0, Math.max(0, num(n))),
    RIGHT: (s, n) => s === null ? null : (n = Math.max(0, num(n))) ? String(s).slice(-n) : '',
    SUBSTR: (s, p, n) => { if (s === null || p === null) return null; s = String(s); p = num(p); const st = p < 0 ? s.length + p : p - 1; return n === undefined ? s.slice(Math.max(st, 0)) : s.substr(Math.max(st, 0), Math.max(0, num(n))); },
    INSTR: (s, t) => s === null || t === null ? null : String(s).toLowerCase().indexOf(String(t).toLowerCase()) + 1,
    CONCAT: (...a) => a.includes(null) ? null : a.join(''),
    ROUND: (x, d) => x === null ? null : rnd(num(x), d === undefined ? 0 : num(d)),
    ABS: x => x === null ? null : Math.abs(num(x)), SQRT: x => x === null || num(x) < 0 ? null : Math.sqrt(num(x)),
    POW: (a, b) => a === null || b === null ? null : Math.pow(num(a), num(b)), MOD: (a, b) => a === null || b === null || !num(b) ? null : num(a) % num(b),
    CEIL: x => x === null ? null : Math.ceil(num(x)), FLOOR: x => x === null ? null : Math.floor(num(x)),
    YEAR: d => D(d) ? D(d).getUTCFullYear() : null, MONTH: d => D(d) ? D(d).getUTCMonth() + 1 : null, DAY: d => D(d) ? D(d).getUTCDate() : null,
    DAYNAME: d => D(d) ? DAYS[D(d).getUTCDay()] : null, MONTHNAME: d => D(d) ? MONTHS[D(d).getUTCMonth()] : null,
    DATEDIFF: (a, b) => D(a) && D(b) ? Math.round((D(a) - D(b)) / 864e5) : null,
    CURDATE: () => today(), NOW: () => today() + ' 00:00:00',
    IFNULL: (a, b) => a === null ? b : a, COALESCE: (...a) => { const v = a.find(x => x !== null); return v === undefined ? null : v; },
  };
  Object.assign(FN, {SUBSTRING: FN.SUBSTR, MID: FN.SUBSTR, POWER: FN.POW, CEILING: FN.CEIL, CURRENT_DATE: FN.CURDATE});

  /* ---------- evaluation ---------- */
  // ctx = {rows: [row, ...]}: a plain row is [row]; a group is all its rows. Aggregates fold over ctx.rows.
  function ev(n, ctx) {
    switch (n.k) {
      case 'lit': return n.v;
      case 'col': { const r = ctx.rows[0]; return r ? r[n.i] : null; }
      case 'neg': { const v = ev(n.e, ctx); return v === null ? null : -num(v); }
      case 'not': { const v = truthy(ev(n.e, ctx)); return v === null ? null : 1 - v; }
      case 'isnull': { const v = ev(n.e, ctx) === null; return (n.neg ? !v : v) ? 1 : 0; }
      case 'like': { const v = ev(n.e, ctx), p = ev(n.p, ctx); if (v === null || p === null) return null; const m = likeRe(p).test(String(v)); return (n.neg ? !m : m) ? 1 : 0; }
      case 'btw': { const v = ev(n.e, ctx), a = cmpv(v, ev(n.lo, ctx)), b = cmpv(v, ev(n.hi, ctx)); if (a === null || b === null) return null; const m = a >= 0 && b <= 0; return (n.neg ? !m : m) ? 1 : 0; }
      case 'in': {
        const v = ev(n.e, ctx); if (v === null) return null; let nul = false;
        for (const x of n.list) { const c = cmpv(v, ev(x, ctx)); if (c === 0) return n.neg ? 0 : 1; if (c === null) nul = true; }
        return nul ? null : n.neg ? 1 : 0;
      }
      case 'case': { for (const [w, t] of n.whens) if (truthy(ev(w, ctx)) === 1) return ev(t, ctx); return n.els ? ev(n.els, ctx) : null; }
      case 'bin': {
        if (n.op === 'AND') { const a = truthy(ev(n.l, ctx)); if (a === 0) return 0; const b = truthy(ev(n.r, ctx)); return b === 0 ? 0 : a === null || b === null ? null : 1; }
        if (n.op === 'OR') { const a = truthy(ev(n.l, ctx)); if (a === 1) return 1; const b = truthy(ev(n.r, ctx)); return b === 1 ? 1 : a === null || b === null ? null : 0; }
        const a = ev(n.l, ctx), b = ev(n.r, ctx);
        if (['=', '<>', '<', '>', '<=', '>='].includes(n.op)) {
          const c = cmpv(a, b); if (c === null) return null;
          return ({'=': c === 0, '<>': c !== 0, '<': c < 0, '>': c > 0, '<=': c <= 0, '>=': c >= 0})[n.op] ? 1 : 0;
        }
        if (a === null || b === null) return null;
        const x = num(a), y = num(b);
        switch (n.op) {
          case '+': return x + y; case '-': return x - y; case '*': return x * y;
          case '/': return y === 0 ? null : x / y; case 'DIV': return y === 0 ? null : Math.trunc(x / y); case '%': return y === 0 ? null : x % y;
        }
      }
      case 'fn': {
        if (AGG.has(n.name)) return agg(n, ctx);
        const f = FN[n.name]; if (!f) throw err(1305, `FUNCTION ${n.name} does not exist`, {kind: 'fn', bad: n.name});
        return f(...n.args.map(a => ev(a, ctx)));
      }
    }
  }
  function agg(n, ctx) {
    if (n.name === 'COUNT' && n.star) return ctx.rows.length;
    if (!n.args.length) throw err(1064, `${n.name}() needs a column or expression inside the brackets`, {kind: 'argc'});
    let vals = ctx.rows.map(r => ev(n.args[0], {rows: [r]})).filter(v => v !== null);
    if (n.distinct) { const seen = new Set(); vals = vals.filter(v => { const k = typeof v === 'string' ? v.toLowerCase() : v; return seen.has(k) ? false : seen.add(k); }); }
    if (n.name === 'COUNT') return vals.length;
    if (!vals.length) return null;
    if (n.name === 'SUM') return vals.reduce((a, v) => a + num(v), 0);
    if (n.name === 'AVG') return vals.reduce((a, v) => a + num(v), 0) / vals.length;
    return vals.reduce((a, v) => (n.name === 'MIN' ? sortCmp(v, a) < 0 : sortCmp(v, a) > 0) ? v : a);
  }
  const hasAgg = n => !!n && typeof n === 'object' && (n.k === 'fn' && AGG.has(n.name) || Object.values(n).some(v => Array.isArray(v) ? v.some(x => hasAgg(Array.isArray(x) ? {k: 'x', x} : x)) : hasAgg(v)));
  const kids = n => Object.values(n).flatMap(v => Array.isArray(v) ? v.flat() : [v]).filter(x => x && typeof x === 'object' && x.k);

  /* bind: resolve each column reference to an index in the row (throws MySQL-style errors) */
  function bind(n, scope, aliases, where) {
    if (n.k === 'col') {
      if (aliases && !n.tbl && aliases.pre && aliases.map.has(n.name.toLowerCase())) { Object.assign(n, {...aliases.map.get(n.name.toLowerCase()), k: aliases.map.get(n.name.toLowerCase()).k}); return n; }
      const hits = scope.filter(c => c.col.toLowerCase() === n.name.toLowerCase() && (!n.tbl || c.tbl.toLowerCase() === n.tbl.toLowerCase()));
      if (hits.length > 1) throw err(1052, `Column '${n.name}' is ambiguous — it exists in more than one table`, {kind: 'ambiguous', bad: n.name});
      if (!hits.length) {
        if (aliases && !n.tbl && aliases.map.has(n.name.toLowerCase())) { Object.assign(n, JSON.parse(JSON.stringify(aliases.map.get(n.name.toLowerCase())))); return n; }
        throw err(1054, `Unknown column '${n.tbl ? n.tbl + '.' : ''}${n.name}' in '${where}'`, {kind: 'column', bad: n.name, tbl: n.tbl});
      }
      n.i = scope.indexOf(hits[0]); return n;
    }
    kids(n).forEach(c => bind(c, scope, aliases, where)); return n;
  }
  const sig = n => JSON.stringify(n, (k, v) => k === 'pos' || k === 'name' && n.k === 'col' && false ? undefined : v);
  function checkFull(n, keys, idx) {
    if (keys.has(sig(n))) return;
    if (n.k === 'fn' && AGG.has(n.name)) return;
    if (n.k === 'col') throw err(1055, `Expression #${idx} ('${n.name}') is not in GROUP BY and is not inside an aggregate function (COUNT, SUM, ...)`, {kind: 'fullgroup', bad: n.name});
    kids(n).forEach(c => checkFull(c, keys, idx));
  }

  /* ---------- database ---------- */
  const lc = s => s.toLowerCase();
  const getTable = (db, name) => { const t = db.tables[lc(name)]; if (!t) throw err(1146, `Table '${name}' doesn't exist`, {kind: 'table', bad: name}); return t; };
  const colIdx = (t, name) => { const i = t.cols.findIndex(c => lc(c.name) === lc(name)); if (i < 0) throw err(1054, `Unknown column '${name}' in table '${t.name}'`, {kind: 'column', bad: name, tbl: t.name}); return i; };

  function coerce(c, v, rowNo) {
    if (v === null) return null;
    const ty = c.type;
    if (/INT|SMALLINT|TINYINT|BIGINT/.test(ty)) { const x = typeof v === 'number' ? v : (/^\s*-?\d+(\.\d*)?\s*$/.test(v) ? parseFloat(v) : NaN); if (Number.isNaN(x)) throw err(1366, `Incorrect integer value: '${v}' for column '${c.name}' at row ${rowNo}`, {kind: 'type', bad: v}); return Math.round(x); }
    if (/FLOAT|DOUBLE|DECIMAL|NUMERIC/.test(ty)) { const x = typeof v === 'number' ? v : (/^\s*-?\d*\.?\d+\s*$/.test(v) ? parseFloat(v) : NaN); if (Number.isNaN(x)) throw err(1366, `Incorrect decimal value: '${v}' for column '${c.name}' at row ${rowNo}`, {kind: 'type', bad: v}); return x; }
    if (ty === 'DATE' || ty === 'DATETIME') { if (!D(v)) throw err(1292, `Incorrect date value: '${v}' for column '${c.name}' at row ${rowNo}`, {kind: 'date', bad: v}); return String(v).slice(0, 10); }
    const s = String(v);
    if ((ty === 'CHAR' || ty === 'VARCHAR') && c.len && s.length > +c.len) throw err(1406, `Data too long for column '${c.name}' at row ${rowNo} (max ${c.len} characters)`, {kind: 'toolong', bad: c.name, max: +c.len});
    return s;
  }
  function checkKeys(t, rows) {
    const keyCols = t.cols.map((c, i) => c.pk || t.pk.some(p => lc(p) === lc(c.name)) ? i : -1).filter(i => i >= 0);
    const groups = [keyCols, ...t.cols.map((c, i) => c.uq ? [i] : null).filter(Boolean)].filter(g => g.length);
    groups.forEach((g, gi) => {
      const seen = new Set();
      for (const r of rows) {
        const k = JSON.stringify(g.map(i => typeof r[i] === 'string' ? r[i].toLowerCase() : r[i]));
        if (g.some(i => r[i] === null)) continue;
        if (seen.has(k)) throw err(1062, `Duplicate entry ${g.map(i => `'${r[i]}'`).join('-')} for key '${gi === 0 && keyCols.length ? 'PRIMARY' : t.cols[g[0]].name}'`, {kind: 'dup', bad: g.map(i => r[i]).join('-')});
        seen.add(k);
      }
    });
  }

  function runSelect(db, s) {
    // 1. FROM: build the row source (joins are nested loops)
    let scope = [], rows = [[]];
    s.from.forEach((ref, n) => {
      const t = getTable(db, ref.name), sc = t.cols.map(c => ({tbl: ref.alias, col: c.name}));
      const right = t.rows; let out = [];
      const newScope = scope.concat(sc);
      let onTest = () => true;
      if (ref.using || ref.join === 'natural') {
        const names = ref.using || sc.map(c => c.col).filter(c => scope.some(x => lc(x.col) === lc(c)));
        onTest = (l, r) => names.every(nm => cmpv(l[scope.findIndex(x => lc(x.col) === lc(nm))], r[colIdx(t, nm)]) === 0);
      } else if (ref.on) { bind(ref.on, newScope, null, 'on clause'); onTest = (l, r) => truthy(ev(ref.on, {rows: [l.concat(r)]})) === 1; }
      for (const l of rows) {
        let hit = false;
        for (const r of right) if (n === 0 || ref.join === 'cross' || onTest(l, r)) { out.push(l.concat(r)); hit = true; }
        if (!hit && ref.join === 'left') out.push(l.concat(right[0] ? right[0].map(() => null) : t.cols.map(() => null)));
      }
      if (ref.join === 'right') {            // keep unmatched right rows too
        for (const r of right) if (!rows.some(l => onTest(l, r))) out.push(scope.map(() => null).concat(r));
      }
      scope = newScope; rows = out;
    });
    // 2. SELECT list (expand *), aliases
    const items = [];
    for (const it of s.items) {
      if (it.star) {
        const cols = scope.map((c, i) => ({c, i})).filter(x => !it.tbl || lc(x.c.tbl) === lc(it.tbl));
        if (!cols.length) throw err(1146, `Unknown table '${it.tbl}'`, {kind: 'table', bad: it.tbl});
        cols.forEach(x => items.push({e: {k: 'col', i: x.i, name: x.c.col}, label: x.c.col}));
      } else items.push({e: bind(it.e, scope, null, 'field list'), label: it.alias || it.text});
    }
    const amap = new Map(); s.items.forEach((it, i) => { if (it.alias) amap.set(lc(it.alias), items.find(x => x.label === it.alias).e); });
    if (!s.from.length && items.some(x => x.e.k === 'col')) throw err(1054, `Unknown column in field list (there is no FROM clause)`, {kind: 'column', bad: items.find(x => x.e.k === 'col').e.name});
    // 3. WHERE
    if (s.where) {
      if (hasAgg(s.where)) throw err(1111, 'Invalid use of group function: aggregate functions (COUNT, SUM, ...) cannot be used in WHERE', {kind: 'aggwhere'});
      bind(s.where, scope, {map: amap, pre: false}, 'where clause');
      rows = rows.filter(r => truthy(ev(s.where, {rows: [r]})) === 1);
    }
    // 4. grouping
    const group = s.group.map(g => g.k === 'lit' && isNum(g.v) ? items[g.v - 1]?.e || g : bind(g, scope, {map: amap, pre: false}, 'group statement'));
    if (s.having) bind(s.having, scope, {map: amap, pre: false}, 'having clause');
    const order = s.order.map(o => ({...o, e: o.e.k === 'lit' && isNum(o.e.v) ? (items[o.e.v - 1] ? items[o.e.v - 1].e : (() => { throw err(1054, `Unknown column '${o.e.v}' in 'order clause'`, {kind: 'column', bad: String(o.e.v)}); })()) : bind(o.e, scope, {map: amap, pre: true}, 'order clause')}));
    const aggregated = group.length > 0 || items.some(x => hasAgg(x.e)) || (s.having && hasAgg(s.having)) || order.some(o => hasAgg(o.e));
    let units;                                       // each unit = one output row's source rows
    if (aggregated) {
      const keys = new Set(group.map(sig));
      items.forEach((x, i) => checkFull(x.e, keys, i + 1));
      if (s.having) checkFull(s.having, keys, 'HAVING'); order.forEach(o => checkFull(o.e, keys, 'ORDER BY'));
      if (group.length) { const m = new Map(); for (const r of rows) { const k = JSON.stringify(group.map(g => { const v = ev(g, {rows: [r]}); return typeof v === 'string' ? v.toLowerCase() : v; })); (m.get(k) || m.set(k, []).get(k)).push(r); } units = [...m.values()]; }
      else units = [rows];
    } else units = rows.map(r => [r]);
    if (s.having) units = units.filter(u => truthy(ev(s.having, {rows: u})) === 1);
    // 5. project, DISTINCT, ORDER BY, LIMIT
    let out = units.map(u => ({vals: items.map(x => ev(x.e, {rows: u})), key: order.map(o => ev(o.e, {rows: u}))}));
    if (s.distinct) { const seen = new Set(); out = out.filter(o => { const k = JSON.stringify(o.vals.map(v => typeof v === 'string' ? v.toLowerCase() : v)); return seen.has(k) ? false : seen.add(k); }); }
    if (order.length) out = out.map((o, i) => ({o, i})).sort((a, b) => { for (let k = 0; k < order.length; k++) { const c = sortCmp(a.o.key[k], b.o.key[k]); if (c) return order[k].desc ? -c : c; } return a.i - b.i; }).map(x => x.o);
    if (s.limit !== null) out = out.slice(s.offset, s.offset + s.limit);
    return {kind: 'rows', cols: items.map(x => x.label), rows: out.map(o => o.vals)};
  }

  function runStmt(db, s) {
    switch (s.k) {
      case 'select': return runSelect(db, s);
      case 'show': return {kind: 'rows', cols: ['Tables'], rows: Object.values(db.tables).map(t => [t.name])};
      case 'describe': { const t = getTable(db, s.name); return {kind: 'rows', cols: ['Field', 'Type', 'Null', 'Key', 'Default'], rows: t.cols.map(c => [c.name, c.type.toLowerCase() + (c.len ? `(${c.len})` : ''), c.nn ? 'NO' : 'YES', c.pk || t.pk.some(p => lc(p) === lc(c.name)) ? 'PRI' : c.uq ? 'UNI' : '', c.def ? ev(c.def, {rows: []}) : null])}; }
      case 'create': {
        if (db.tables[lc(s.name)]) { if (s.ine) return {kind: 'ok', msg: 'Table already exists (skipped)'}; throw err(1050, `Table '${s.name}' already exists`, {kind: 'exists', bad: s.name}); }
        const seen = new Set(); s.cols.forEach(c => { if (seen.has(lc(c.name))) throw err(1060, `Duplicate column name '${c.name}'`, {kind: 'dupcol'}); seen.add(lc(c.name)); });
        s.pk.forEach(p => { if (!seen.has(lc(p))) throw err(1072, `Key column '${p}' doesn't exist in table`, {kind: 'column', bad: p}); });
        db.tables[lc(s.name)] = {name: s.name, cols: s.cols.map(c => ({...c, def: c.def ? ev(c.def, {rows: []}) : undefined})), pk: s.pk, rows: []};
        return {kind: 'ok', msg: `Table '${s.name}' created`};
      }
      case 'drop': { if (!db.tables[lc(s.name)]) { if (s.ie) return {kind: 'ok', msg: 'Nothing to drop'}; throw err(1051, `Unknown table '${s.name}'`, {kind: 'table', bad: s.name}); } delete db.tables[lc(s.name)]; return {kind: 'ok', msg: `Table '${s.name}' dropped`}; }
      case 'truncate': { const t = getTable(db, s.name); const n = t.rows.length; t.rows = []; return {kind: 'ok', msg: `Table emptied (${n} rows removed)`}; }
      case 'alter': {
        const t = getTable(db, s.name);
        if (s.op === 'add') { if (t.cols.some(c => lc(c.name) === lc(s.col.name))) throw err(1060, `Duplicate column name '${s.col.name}'`, {kind: 'dupcol'}); const d = s.col.def ? ev(s.col.def, {rows: []}) : null; t.cols.push({...s.col, def: s.col.def ? d : undefined}); t.rows.forEach(r => r.push(d)); }
        else { const i = colIdx(t, s.col); if (t.cols.length === 1) throw err(1090, "You can't delete all columns with ALTER TABLE; use DROP TABLE instead", {kind: 'lastcol'}); t.cols.splice(i, 1); t.rows.forEach(r => r.splice(i, 1)); }
        return {kind: 'ok', msg: `Table '${t.name}' altered`};
      }
      case 'insert': {
        const t = getTable(db, s.name), idx = s.cols ? s.cols.map(c => colIdx(t, c)) : t.cols.map((_, i) => i), made = [];
        s.rows.forEach((vals, n) => {
          if (vals.length !== idx.length) throw err(1136, `Column count doesn't match value count at row ${n + 1}: ${idx.length} column(s) but ${vals.length} value(s)`, {kind: 'count', cols: idx.length, vals: vals.length});
          const row = t.cols.map(c => c.def !== undefined ? c.def : null);
          vals.forEach((e, k) => { if (e.k === 'col') throw err(1054, `Unknown column '${e.name}' in 'field list'`, {kind: 'column', bad: e.name, asValue: true}); row[idx[k]] = ev(e, {rows: []}); });
          t.cols.forEach((c, i) => {
            if (c.ai && (row[i] === null) && !idx.includes(i)) row[i] = Math.max(0, ...t.rows.concat(made).map(r => r[i] || 0)) + 1;
            if (row[i] === null && c.nn) { if (idx.includes(i)) throw err(1048, `Column '${c.name}' cannot be null`, {kind: 'notnull', bad: c.name}); throw err(1364, `Field '${c.name}' doesn't have a default value (it is NOT NULL, so give it a value)`, {kind: 'notnull', bad: c.name}); }
            row[i] = coerce(c, row[i], n + 1);
          });
          made.push(row);
        });
        checkKeys(t, t.rows.concat(made)); t.rows.push(...made);
        return {kind: 'ok', msg: `${made.length} row${made.length === 1 ? '' : 's'} inserted`};
      }
      case 'update': case 'delete': {
        const t = getTable(db, s.name), scope = t.cols.map(c => ({tbl: t.name, col: c.name}));
        if (s.where) { if (hasAgg(s.where)) throw err(1111, 'Invalid use of group function', {kind: 'aggwhere'}); bind(s.where, scope, null, 'where clause'); }
        const hit = r => !s.where || truthy(ev(s.where, {rows: [r]})) === 1;
        if (s.k === 'delete') { const before = t.rows.length; t.rows = t.rows.filter(r => !hit(r)); return {kind: 'ok', msg: `${before - t.rows.length} row(s) deleted`}; }
        const sets = s.sets.map(x => ({i: colIdx(t, x.c), e: bind(x.e, scope, null, 'field list')}));
        let n = 0; const next = t.rows.map(r => { if (!hit(r)) return r; n++; const c = r.slice(); sets.forEach(x => { const v = ev(x.e, {rows: [r]}); if (v === null && t.cols[x.i].nn) throw err(1048, `Column '${t.cols[x.i].name}' cannot be null`, {kind: 'notnull', bad: t.cols[x.i].name}); c[x.i] = coerce(t.cols[x.i], v, 1); }); return c; });
        checkKeys(t, next); t.rows = next; return {kind: 'ok', msg: `${n} row(s) updated`};
      }
    }
  }

  /* run a whole script; stops at the first error. Returns {results, error, failedAt} */
  function run(db, sql) {
    const results = [];
    let stmts;
    try { stmts = new Parser(sql).script(); } catch (e) { if (e instanceof SQLError) return {results, error: e}; throw e; }
    if (!stmts.length) return {results, error: err(1065, 'Query was empty', {kind: 'empty'})};
    for (const s of stmts) { try { results.push(runStmt(db, s)); } catch (e) { if (e instanceof SQLError) return {results, error: e}; throw e; } }
    return {results, error: null};
  }
  const clone = db => JSON.parse(JSON.stringify(db));
  const newDb = () => ({tables: {}});
  return {run, clone, newDb, SQLError, tokenize};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SQLEngine;
