'use strict';
/*
  SQL answer grader.
  - SQL keywords / functions / string values: NOT case-sensitive.
  - Table and column names (listed in `names` of each question): case-sensitive (optional, toggle in the UI).
  - Spacing, line breaks, a trailing ; and ' vs " quotes do not matter.
  - Each question lists the accepted forms in `accept`, written as a tiny pattern language:
        word|word     either word          [as <word>]   optional part
        <int>         any whole number     <word>        any name (e.g. an alias)
*/
const SQLGrader = (() => {
  const TOKEN_RE = /'(?:[^']|'')*'|"(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|<=|>=|<>|!=|\S/g;
  const PAT_RE = /\[[^\]]*\]|<int>|<word>|'(?:[^']|'')*'|[A-Za-z_][A-Za-z0-9_|]*|\d+(?:\.\d+)?|<=|>=|<>|!=|\S/g;
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const clean = text => String(text).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/`/g, '');

  function tokenize(text) {
    const out = [];
    for (const raw of clean(text).match(TOKEN_RE) || []) {
      let norm, type;
      if (raw[0] === "'" || raw[0] === '"') { type = 'str'; norm = "'" + raw.slice(1, -1).toLowerCase() + "'"; }
      else if (/^[A-Za-z_]/.test(raw)) { type = 'word'; norm = raw.toLowerCase(); }
      else if (/^\d/.test(raw)) { type = 'num'; norm = raw; }
      else { type = 'sym'; norm = raw === '<>' ? '!=' : raw; }
      out.push({raw, norm, type});
    }
    while (out.length && out[out.length - 1].norm === ';') out.pop();      // trailing ; is optional
    return out;
  }

  function piece(t) {
    if (t.length > 1 && t[0] === '[' && t[t.length - 1] === ']')
      return {opt: true, re: (t.slice(1, -1).match(PAT_RE) || []).map(piece).map(p => p.re).join(' ')};
    if (t === '<int>') return {re: '\\d+'};
    if (t === '<word>') return {re: '[a-z_][a-z0-9_]*'};
    if (t[0] === "'") return {re: reEsc("'" + t.slice(1, -1).toLowerCase() + "'")};
    if (/^[A-Za-z_]/.test(t)) return {re: t.includes('|') ? '(?:' + t.toLowerCase().split('|').map(reEsc).join('|') + ')' : reEsc(t.toLowerCase())};
    return {re: reEsc(t === '<>' ? '!=' : t)};
  }

  const cache = new Map();
  function matcher(pattern) {
    if (!cache.has(pattern)) {
      const pieces = (pattern.match(PAT_RE) || []).map(piece);
      if (!pieces.length || pieces[0].opt) throw new Error('Bad pattern (empty or starts with an optional part): ' + pattern);
      const re = '^' + pieces.map((p, i) => p.opt ? '(?: ' + p.re + ')?' : (i ? ' ' : '') + p.re).join('') + '$';
      cache.set(pattern, new RegExp(re));
    }
    return cache.get(pattern);
  }

  function nameIssue(tokens, names) {
    const canon = new Map((names || []).map(n => [n.toLowerCase(), n]));
    for (const t of tokens) {
      if (t.type !== 'word') continue;
      const c = canon.get(t.norm);
      if (c && c !== t.raw) return {typed: t.raw, expected: c};
    }
    return null;
  }

  /** @returns {{correct:boolean, empty?:boolean, nameIssue?:{typed:string,expected:string}}} */
  function grade(q, text, strictNames) {
    const tokens = tokenize(text);
    if (!tokens.length) return {correct: false, empty: true};
    const joined = tokens.map(t => t.norm).join(' ');
    if (!q.accept.some(p => matcher(p).test(joined))) return {correct: false};
    if (strictNames) {
      const issue = nameIssue(tokens, q.names);
      if (issue) return {correct: false, nameIssue: issue};
    }
    return {correct: true};
  }

  return {tokenize, matcher, nameIssue, grade};
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SQLGrader;
