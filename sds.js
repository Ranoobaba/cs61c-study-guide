/* sds.js
 * Digital logic ("SDS") drill engine for the CS61C MT1 study page.
 * Topics: FSM label filling and tracing, register timing, Boolean simplification.
 *
 * Plain browser script. It sets window.SDS (and module.exports in Node).
 * All generation, solving, parsing and grading is DOM-free and testable in Node.
 * Only the render functions and Question.render / Question.grade touch the DOM.
 */
(function (global) {
  'use strict';

  const SDS = {};

  /* ======================================================================
   * Small helpers
   * ==================================================================== */

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  SDS.mulberry32 = mulberry32;

  function makeRng(seed) {
    const r = mulberry32(seed);
    return {
      next: r,
      int: (lo, hi) => lo + Math.floor(r() * (hi - lo + 1)),
      pick: (arr) => arr[Math.floor(r() * arr.length)],
      chance: (p) => r() < p,
      shuffle: (arr) => {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(r() * (i + 1));
          const t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
      },
      // weighted random order (Efraimidis-Spirakis keys)
      weighted: (items, wfn) => items
        .map((it) => ({ it, k: -Math.log(1 - r()) / Math.max(1e-9, wfn(it)) }))
        .sort((p, q) => p.k - q.k)
        .map((p) => p.it),
    };
  }
  SDS.makeRng = makeRng;

  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  let uidCounter = 0;
  function uid(prefix) { uidCounter += 1; return (prefix || 'sds') + '-' + uidCounter; }

  const fx = (v) => String(Math.round(v * 10) / 10);
  const BG = 'var(--bs-body-bg, #fff)';
  const OK_COLOR = '#198754';
  const BAD_COLOR = '#dc3545';

  // Overline used for NOT in math notation. Inline styles so it works anywhere.
  function ovl(inner) {
    return '<span class="sds-ovl" style="display:inline-block;border-top:1.6px solid currentColor;padding-top:1px;line-height:1.15;margin:0 0.07em;">' + inner + '</span>';
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  function pointsText(score, points) {
    const p = Math.round(score * points * 100) / 100;
    return p + ' / ' + points + ' exam points';
  }

  function verdictHtml(score, correct, body) {
    const cls = correct ? 'success' : (score > 0 ? 'warning' : 'danger');
    const head = correct ? 'Correct.' : (score > 0 ? 'Partly right.' : 'Not right yet.');
    return '<div class="alert alert-' + cls + ' py-2 mb-0"><strong>' + head + '</strong> ' + body + '</div>';
  }

  /* ======================================================================
   * Boolean algebra: AST, parser, printers
   * ==================================================================== */

  const V = (name) => ({ type: 'var', name });
  const NOT = (a) => ({ type: 'not', a });
  const AND = (a, b) => ({ type: 'and', a, b });
  const OR = (a, b) => ({ type: 'or', a, b });

  function clone(n) {
    switch (n.type) {
      case 'var': return V(n.name);
      case 'const': return { type: 'const', value: n.value };
      case 'not': return NOT(clone(n.a));
      default: return { type: n.type, a: clone(n.a), b: clone(n.b) };
    }
  }
  const isLeaf = (n) => n.type === 'var' || n.type === 'const';
  const isLit = (n) => n.type === 'var' || (n.type === 'not' && n.a.type === 'var');
  function neg(n) { return n.type === 'not' ? clone(n.a) : NOT(clone(n)); }

  function gates(n) {
    if (typeof n === 'string') n = parse(n);
    switch (n.type) {
      case 'var': case 'const': return 0;
      case 'not': return 1 + gates(n.a);
      default: return 1 + gates(n.a) + gates(n.b);
    }
  }
  function gateDepth(n) {
    switch (n.type) {
      case 'var': case 'const': return 0;
      case 'not': return 1 + gateDepth(n.a);
      default: return 1 + Math.max(gateDepth(n.a), gateDepth(n.b));
    }
  }
  function astKey(n) {
    switch (n.type) {
      case 'var': return n.name;
      case 'const': return '#' + n.value;
      case 'not': return '!' + astKey(n.a);
      default: return n.type + '(' + astKey(n.a) + ',' + astKey(n.b) + ')';
    }
  }
  function varsOf(n, set) {
    set = set || new Set();
    if (n.type === 'var') set.add(n.name);
    else if (n.type === 'not') varsOf(n.a, set);
    else if (n.type === 'and' || n.type === 'or') { varsOf(n.a, set); varsOf(n.b, set); }
    return set;
  }
  function countByType(n, acc) {
    acc = acc || { not: 0, and: 0, or: 0 };
    if (n.type === 'not') { acc.not++; countByType(n.a, acc); }
    else if (n.type === 'and' || n.type === 'or') { acc[n.type]++; countByType(n.a, acc); countByType(n.b, acc); }
    return acc;
  }
  function gateBreakdown(n) {
    const c = countByType(n);
    const parts = [];
    if (c.not) parts.push(c.not + ' NOT');
    if (c.and) parts.push(c.and + ' AND');
    if (c.or) parts.push(c.or + ' OR');
    const total = c.not + c.and + c.or;
    return (parts.length ? parts.join(' + ') + ' = ' : '') + plural(total, 'gate');
  }

  function tokenize(str) {
    const toks = [];
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      const pos = i + 1;
      if (/\s/.test(ch)) continue;
      if (/[A-Za-z]/.test(ch)) toks.push({ k: 'var', v: ch, pos, ch });
      else if (ch === '0' || ch === '1') toks.push({ k: 'const', v: Number(ch), pos, ch });
      else if (ch === '!' || ch === '~' || ch === '¬') toks.push({ k: 'not', pos, ch });
      else if (ch === "'" || ch === '’' || ch === '′') toks.push({ k: 'post', pos, ch });
      else if (ch === '*' || ch === '&' || ch === '·' || ch === '.' || ch === '∧') {
        if (ch === '&' && str[i + 1] === '&') i++;
        toks.push({ k: 'and', pos, ch });
      } else if (ch === '+' || ch === '|' || ch === '∨') {
        if (ch === '|' && str[i + 1] === '|') i++;
        toks.push({ k: 'or', pos, ch });
      } else if (ch === '(' || ch === '[') toks.push({ k: '(', pos, ch });
      else if (ch === ')' || ch === ']') toks.push({ k: ')', pos, ch });
      else throw new Error("I can't read the character '" + ch + "' at position " + pos + '. Use letters, ! for NOT, * for AND, + for OR, and parentheses.');
    }
    return toks;
  }

  // Grammar: expr := term ('+' term)* ; term := factor (('*')? factor)* ;
  // factor := ('!'|'~') factor | primary ("'")* ; primary := VAR | 0 | 1 | '(' expr ')'
  function parse(str) {
    if (typeof str !== 'string') throw new Error('Expected the expression as text.');
    const toks = tokenize(str);
    if (!toks.length) throw new Error('Type an expression first.');
    let i = 0;
    const peek = () => toks[i];
    const unexpected = (t) => {
      if (!t) return new Error('The expression ends too early. Something is missing at the end.');
      return new Error("Unexpected '" + t.ch + "' at position " + t.pos + '.');
    };
    const startsFactor = (t) => t && (t.k === 'var' || t.k === 'const' || t.k === 'not' || t.k === '(');
    function parseExpr() {
      let left = parseTerm();
      while (peek() && peek().k === 'or') { i++; left = OR(left, parseTerm()); }
      return left;
    }
    function parseTerm() {
      let left = parseFactor();
      for (;;) {
        const t = peek();
        if (t && t.k === 'and') { i++; left = AND(left, parseFactor()); }
        else if (startsFactor(t)) left = AND(left, parseFactor());
        else break;
      }
      return left;
    }
    function parseFactor() {
      const t = peek();
      if (t && t.k === 'not') { i++; return NOT(parseFactor()); }
      let p = parsePrimary();
      while (peek() && peek().k === 'post') { i++; p = NOT(p); }
      return p;
    }
    function parsePrimary() {
      const t = peek();
      if (!t) throw unexpected(t);
      if (t.k === 'var') { i++; return V(t.v); }
      if (t.k === 'const') { i++; return { type: 'const', value: t.v }; }
      if (t.k === '(') {
        i++;
        if (peek() && peek().k === ')') throw new Error("Empty parentheses at position " + t.pos + '.');
        const e = parseExpr();
        const c = peek();
        if (!c) throw new Error("Missing ')' to close the '(' at position " + t.pos + '.');
        if (c.k !== ')') throw unexpected(c);
        i++;
        if (!isLeaf(e)) e.paren = true;
        return e;
      }
      throw unexpected(t);
    }
    const ast = parseExpr();
    if (i < toks.length) throw unexpected(toks[i]);
    return ast;
  }

  // Flatten a chain of the same operator, stopping at a highlighted node.
  function flat(n, type, hl) {
    if (n.type === type && n !== hl) return flat(n.a, type, hl).concat(flat(n.b, type, hl));
    return [n];
  }
  function flatTop(n, type, hl) { return flat(n.a, type, hl).concat(flat(n.b, type, hl)); }

  // Exam syntax printer. hl = node to wrap in <mark> (the output is HTML-safe).
  function toExam(n, hl, spaced) {
    const sep = spaced ? ' + ' : '+';
    let s;
    switch (n.type) {
      case 'var': s = n.name; break;
      case 'const': s = String(n.value); break;
      case 'not': {
        const inner = toExam(n.a, hl, spaced);
        s = (isLeaf(n.a) || n.a.type === 'not') ? '!' + inner : '!(' + inner + ')';
        break;
      }
      case 'and':
        s = flatTop(n, 'and', hl).map((c) => (c.type === 'or' ? '(' + toExam(c, hl, spaced) + ')' : toExam(c, hl, spaced))).join('*');
        break;
      case 'or':
        s = flatTop(n, 'or', hl).map((c) => toExam(c, hl, spaced)).join(sep);
        break;
      default: throw new Error('bad node');
    }
    return n === hl ? '<mark>' + s + '</mark>' : s;
  }
  function exprStr(n) { return toExam(n, null, false); }

  // Math notation (HTML) with overlines for NOT and juxtaposition for AND.
  function toMath(n) {
    switch (n.type) {
      case 'var': return n.name;
      case 'const': return String(n.value);
      case 'not': return ovl(toMath(n.a));
      case 'and': {
        const parts = flatTop(n, 'and');
        let s = '';
        parts.forEach((c, i) => {
          const piece = c.type === 'or' ? '(' + toMath(c) + ')' : toMath(c);
          if (i > 0) {
            const prev = parts[i - 1];
            s += (prev.type === 'const' || c.type === 'const') ? '·' : ' ';
          }
          s += piece;
        });
        return s;
      }
      case 'or': return flatTop(n, 'or').map(toMath).join(' + ');
      default: throw new Error('bad node');
    }
  }
  // Literal math printer for laws: keeps the grouping exactly as written.
  function toMathLit(n, top) {
    let s;
    switch (n.type) {
      case 'var': return n.name;
      case 'const': return String(n.value);
      case 'not': return ovl(toMathLit(n.a, true));
      case 'and': {
        const l = toMathLit(n.a), r = toMathLit(n.b);
        const joiner = (n.a.type === 'const' || n.b.type === 'const') ? '\u00B7' : '\u200A';
        s = l + joiner + r;
        break;
      }
      default: s = toMathLit(n.a) + ' + ' + toMathLit(n.b);
    }
    return n.paren && !top ? '(' + s + ')' : s;
  }
  // "x + !x*y = x + y" -> math HTML for both sides
  function lawHtml(str) {
    return str.split('=').map((side) => toMathLit(parse(side.trim()), true)).join(' = ');
  }

  function evalAst(n, env) {
    switch (n.type) {
      case 'var': return env[n.name];
      case 'const': return n.value;
      case 'not': return 1 - evalAst(n.a, env);
      case 'and': return evalAst(n.a, env) & evalAst(n.b, env);
      case 'or': return evalAst(n.a, env) | evalAst(n.b, env);
      default: throw new Error('bad node');
    }
  }

  function truthTable(ast, vars) {
    if (typeof ast === 'string') ast = parse(ast);
    vars = vars || ['x', 'y', 'z'];
    for (const v of varsOf(ast)) {
      if (!vars.includes(v)) throw new Error('The variable ' + v + ' is not one of ' + vars.join(', ') + '.');
    }
    const n = vars.length;
    const rows = [];
    for (let i = 0; i < (1 << n); i++) {
      const env = {};
      vars.forEach((v, j) => { env[v] = (i >> (n - 1 - j)) & 1; });
      rows.push(evalAst(ast, env));
    }
    return rows;
  }
  function maskOf(ast, vars) {
    const t = truthTable(ast, vars);
    let m = 0;
    t.forEach((b, i) => { if (b) m |= 1 << i; });
    return m;
  }
  function depCount(mask, n) {
    let c = 0;
    for (let j = 0; j < n; j++) {
      const bit = n - 1 - j;
      let dep = false;
      for (let i = 0; i < (1 << n); i++) {
        if (!((i >> bit) & 1)) {
          const k = i | (1 << bit);
          if (((mask >> i) & 1) !== ((mask >> k) & 1)) { dep = true; break; }
        }
      }
      if (dep) c++;
    }
    return c;
  }

  /* ======================================================================
   * Minimum gate count: dynamic program over all functions of n <= 3 inputs.
   * Formulas are trees (no sharing): var = 0, NOT f = f + 1, f op g = f + g + 1.
   * ==================================================================== */

  const DP_CACHE = {};
  function getDP(n) {
    if (DP_CACHE[n]) return DP_CACHE[n];
    if (n < 1 || n > 3) throw new Error('Only 1 to 3 variables are supported.');
    const R = 1 << n;
    const FULL = (1 << R) - 1;
    const size = 1 << R;
    const varMask = [];
    for (let j = 0; j < n; j++) {
      let m = 0;
      for (let i = 0; i < R; i++) if ((i >> (n - 1 - j)) & 1) m |= 1 << i;
      varMask.push(m);
    }
    const cost = new Array(size).fill(Infinity);
    const how = new Array(size).fill(null);
    const levels = [[]];
    varMask.forEach((m, j) => {
      if (cost[m] === Infinity) { cost[m] = 0; how[m] = { op: 'var', j }; levels[0].push(m); }
    });
    let found = levels[0].length;
    let c = 0;
    while (found < size && c < 64) {
      c++;
      const L = [];
      const add = (f, rec) => {
        if (cost[f] === Infinity) { cost[f] = c; how[f] = rec; L.push(f); found++; }
      };
      for (const f of levels[c - 1]) add(~f & FULL, { op: 'not', a: f });
      for (let a = 0; a <= c - 1 - a; a++) {
        const b = c - 1 - a;
        for (const f of levels[a]) {
          for (const g of levels[b]) {
            add(f & g, { op: 'and', a: f, b: g });
            add(f | g, { op: 'or', a: f, b: g });
          }
        }
      }
      levels.push(L);
    }
    DP_CACHE[n] = { n, R, FULL, cost, how, varMask };
    return DP_CACHE[n];
  }
  // Precompute once at load (cheap).
  getDP(3);

  function dpBuild(dp, m, vars) {
    const h = dp.how[m];
    switch (h.op) {
      case 'var': return V(vars[h.j]);
      case 'not': return NOT(dpBuild(dp, h.a, vars));
      case 'and': return AND(dpBuild(dp, h.a, vars), dpBuild(dp, h.b, vars));
      default: return OR(dpBuild(dp, h.a, vars), dpBuild(dp, h.b, vars));
    }
  }

  const isOne = (v) => v === 1 || v === true || v === '1';
  const isZero = (v) => v === 0 || v === false || v === '0';
  // All completions of a table that may contain don't-cares (anything not 0/1).
  function completions(table) {
    let base = 0;
    const dc = [];
    table.forEach((v, i) => {
      if (isOne(v)) base |= 1 << i;
      else if (!isZero(v)) dc.push(i);
    });
    const out = [];
    for (let s = 0; s < (1 << dc.length); s++) {
      let m = base;
      dc.forEach((row, k) => { if ((s >> k) & 1) m |= 1 << row; });
      out.push(m);
    }
    return out;
  }
  function bestCompletion(table, vars) {
    const dp = getDP(vars.length);
    if (table.length !== dp.R) throw new Error('The table needs ' + dp.R + ' rows for ' + vars.length + ' variables.');
    let all = completions(table);
    const nonConst = all.filter((m) => m !== 0 && m !== dp.FULL);
    if (nonConst.length) all = nonConst;
    let best = all[0];
    for (const m of all) if (dp.cost[m] < dp.cost[best]) best = m;
    return { mask: best, cost: dp.cost[best], dp };
  }
  function minGates(table, vars) {
    vars = vars || ['x', 'y', 'z'];
    return bestCompletion(table, vars).cost;
  }
  function minimalAst(table, vars) {
    vars = vars || ['x', 'y', 'z'];
    const b = bestCompletion(table, vars);
    return dpBuild(b.dp, b.mask, vars);
  }
  function minimalExpr(table, vars) { return exprStr(prettyOrder(minimalAst(table, vars))); }

  /* ======================================================================
   * N-ary rewriting (used to explain truth-table answers step by step)
   * nodes: {t:'v',n} | {t:'n',a} | {t:'a',c:[]} | {t:'o',c:[]}
   * ==================================================================== */

  function nk(x) {
    if (x.k) return x.k;
    x.k = x.t === 'v' ? x.n : x.t === 'n' ? '!' + nk(x.a) : (x.t === 'a' ? 'a(' : 'o(') + x.c.map(nk).join(',') + ')';
    return x.k;
  }
  function nrank(x) { return (x.t === 'v' || (x.t === 'n' && x.a.t === 'v')) ? 0 : 2; }
  function nlead(x) { return x.t === 'v' ? x.n : x.t === 'n' ? nlead(x.a) : nlead(x.c[0]); }
  function ncmp(p, q) {
    return nrank(p) - nrank(q) || (nlead(p) < nlead(q) ? -1 : nlead(p) > nlead(q) ? 1 : 0) || (nk(p) < nk(q) ? -1 : nk(p) > nk(q) ? 1 : 0);
  }
  function ncanon(x) {
    if (x.t === 'v') return { t: 'v', n: x.n };
    if (x.t === 'n') return { t: 'n', a: ncanon(x.a) };
    let kids = [];
    for (const ch of x.c) {
      const c = ncanon(ch);
      if (c.t === x.t) kids.push(...c.c); else kids.push(c);
    }
    const seen = new Map();
    for (const c of kids) if (!seen.has(nk(c))) seen.set(nk(c), c);
    kids = Array.from(seen.values()).sort(ncmp);
    if (kids.length === 1) return kids[0];
    return { t: x.t, c: kids };
  }
  function ngates(x) {
    if (x.t === 'v') return 0;
    if (x.t === 'n') return 1 + ngates(x.a);
    return x.c.length - 1 + x.c.reduce((s, c) => s + ngates(c), 0);
  }
  function binToNary(n) {
    const go = (m) => {
      if (m.type === 'var') return { t: 'v', n: m.name };
      if (m.type === 'not') return { t: 'n', a: go(m.a) };
      if (m.type === 'const') throw new Error('constants are not supported here');
      return { t: m.type === 'and' ? 'a' : 'o', c: [go(m.a), go(m.b)] };
    };
    return ncanon(go(n));
  }
  function naryToBin(x) {
    if (x.t === 'v') return V(x.n);
    if (x.t === 'n') return NOT(naryToBin(x.a));
    const kids = x.c.map(naryToBin);
    let acc = kids[0];
    for (let i = 1; i < kids.length; i++) acc = x.t === 'a' ? AND(acc, kids[i]) : OR(acc, kids[i]);
    return acc;
  }
  function nstr(x) { return exprStr(naryToBin(x)); }
  function nneg(x) { return x.t === 'n' ? x.a : { t: 'n', a: x }; }
  function mk(t, kids) { return kids.length === 1 ? kids[0] : { t, c: kids }; }
  function subsets2(idx) {
    const out = [];
    for (let s = 1; s < (1 << idx.length); s++) {
      const sub = idx.filter((_, k) => (s >> k) & 1);
      if (sub.length >= 2) out.push(sub);
    }
    return out;
  }

  const NLAW = {
    dn: { name: 'double negation', law: '!!x = x' },
    dmA: { name: "De Morgan's law", law: '!x*!y = !(x+y)' },
    dmO: { name: "De Morgan's law", law: '!x+!y = !(x*y)' },
    absO: { name: 'absorption', law: 'x+x*y = x' },
    absA: { name: 'absorption', law: 'x*(x+y) = x' },
    xbyO: { name: 'drop the opposite', law: 'x+!x*y = x+y' },
    xbyA: { name: 'drop the opposite', law: 'x*(!x+y) = x*y' },
    facO: { name: 'distributive law, used backwards to factor', law: 'x*y+x*z = x*(y+z)' },
    facA: { name: 'distributive law for OR, used backwards', law: '(x+y)*(x+z) = x+y*z' },
    adjO: { name: 'combining', law: 'x*y+x*!y = x' },
    adjA: { name: 'combining', law: '(x+y)*(x+!y) = x' },
  };

  function nLocalRewrites(x) {
    const out = [];
    if (x.t === 'n' && x.a.t === 'n') out.push({ node: x.a.a, rule: 'dn' });
    if (x.t !== 'a' && x.t !== 'o') return out;
    const T = x.t;
    const D = T === 'a' ? 'o' : 'a';
    const c = x.c;
    const keys = c.map(nk);
    // De Morgan collapse: two or more NOT children -> NOT of the dual
    const negIdx = [];
    c.forEach((ch, i) => { if (ch.t === 'n') negIdx.push(i); });
    if (negIdx.length >= 2) {
      for (const sub of subsets2(negIdx)) {
        const inner = mk(D, sub.map((i) => c[i].a));
        const rest = c.filter((_, i) => !sub.includes(i));
        out.push({ node: mk(T, rest.concat([{ t: 'n', a: inner }])), rule: T === 'a' ? 'dmA' : 'dmO' });
      }
    }
    for (let i = 0; i < c.length; i++) {
      for (let j = 0; j < c.length; j++) {
        if (i === j || c[j].t !== D) continue;
        const inner = c[j].c.map(nk);
        // absorption: f and (f op ...)
        if (inner.includes(keys[i])) {
          out.push({ node: mk(T, c.filter((_, k) => k !== j)), rule: T === 'o' ? 'absO' : 'absA' });
        }
        // x + x'y = x + y  (and its dual)
        const nf = nk(nneg(c[i]));
        if (inner.includes(nf)) {
          const reduced = mk(D, c[j].c.filter((z) => nk(z) !== nf));
          out.push({ node: mk(T, c.map((z, k) => (k === j ? reduced : z))), rule: T === 'o' ? 'xbyO' : 'xbyA' });
        }
      }
    }
    for (let i = 0; i < c.length; i++) {
      for (let j = i + 1; j < c.length; j++) {
        if (c[i].t !== D || c[j].t !== D) continue;
        const ki = c[i].c.map(nk);
        const kj = c[j].c.map(nk);
        // factoring a common child
        for (let a = 0; a < ki.length; a++) {
          if (!kj.includes(ki[a])) continue;
          const f = c[i].c[a];
          const restI = mk(D, c[i].c.filter((_, z) => z !== a));
          const restJ = mk(D, c[j].c.filter((z) => nk(z) !== ki[a]));
          const merged = mk(D, [f, mk(T, [restI, restJ])]);
          const others = c.filter((_, z) => z !== i && z !== j);
          out.push({ node: mk(T, others.concat([merged])), rule: T === 'o' ? 'facO' : 'facA' });
        }
        // adjacency: same children except one literal and its negation
        if (ki.length === kj.length) {
          const onlyI = ki.filter((k) => !kj.includes(k));
          const onlyJ = kj.filter((k) => !ki.includes(k));
          if (onlyI.length === 1 && onlyJ.length === 1) {
            const li = c[i].c[ki.indexOf(onlyI[0])];
            if (nk(nneg(li)) === onlyJ[0]) {
              const common = c[i].c.filter((z) => nk(z) !== onlyI[0]);
              const others = c.filter((_, z) => z !== i && z !== j);
              out.push({ node: mk(T, others.concat([mk(D, common)])), rule: T === 'o' ? 'adjO' : 'adjA' });
            }
          }
        }
      }
    }
    return out;
  }

  function nSuccessors(root) {
    const out = [];
    function visit(node, rebuild) {
      for (const r of nLocalRewrites(node)) {
        out.push({ root: ncanon(rebuild(r.node)), rule: r.rule, from: node, to: ncanon(r.node) });
      }
      if (node.t === 'n') visit(node.a, (y) => rebuild({ t: 'n', a: y }));
      if (node.t === 'a' || node.t === 'o') {
        node.c.forEach((ch, i) => visit(ch, (y) => rebuild({ t: node.t, c: node.c.map((d, j) => (j === i ? y : d)) })));
      }
    }
    visit(root, (y) => y);
    return out;
  }

  // Breadth-first search for the shortest chain of simplifying laws that
  // reaches goalGates. Returns an array of steps or null.
  function nSimplifySearch(start, goalGates, maxDepth, maxNodes) {
    maxDepth = maxDepth || 8;
    maxNodes = maxNodes || 40000;
    start = ncanon(start);
    if (ngates(start) <= goalGates) return [];
    const queue = [{ x: start, path: [] }];
    const seen = new Set([nk(start)]);
    let head = 0;
    while (head < queue.length) {
      const { x, path } = queue[head++];
      if (path.length >= maxDepth) continue;
      for (const s of nSuccessors(x)) {
        const k = nk(s.root);
        if (seen.has(k)) continue;
        seen.add(k);
        const np = path.concat([s]);
        if (ngates(s.root) <= goalGates) return np;
        queue.push({ x: s.root, path: np });
        if (seen.size > maxNodes) return null;
      }
    }
    return null;
  }

  // Minimal sum of products (exact function, no don't-cares), by brute force.
  function minSOP(mask, vars) {
    const n = vars.length;
    const R = 1 << n;
    const cubes = [];
    for (let code = 0; code < Math.pow(3, n); code++) {
      const lits = [];
      let cc = code;
      for (let j = 0; j < n; j++) { lits.push(cc % 3); cc = Math.floor(cc / 3); }
      let rows = 0;
      for (let i = 0; i < R; i++) {
        let ok = true;
        for (let j = 0; j < n; j++) {
          const bit = (i >> (n - 1 - j)) & 1;
          if (lits[j] !== 2 && lits[j] !== bit) { ok = false; break; }
        }
        if (ok) rows |= 1 << i;
      }
      if ((rows & ~mask) === 0 && lits.some((l) => l !== 2)) cubes.push({ lits, rows });
    }
    const primes = cubes.filter((a) => !cubes.some((b) => b !== a && (a.rows & b.rows) === a.rows && b.rows !== a.rows));
    const termCost = (t) => {
      const used = t.lits.filter((l) => l !== 2).length;
      const negs = t.lits.filter((l) => l === 0).length;
      return used - 1 + negs;
    };
    let best = null;
    for (let s = 1; s < (1 << primes.length); s++) {
      let cov = 0;
      const chosen = [];
      primes.forEach((p, k) => { if ((s >> k) & 1) { cov |= p.rows; chosen.push(p); } });
      if (cov !== mask) continue;
      const cost = chosen.reduce((acc, t) => acc + termCost(t), 0) + chosen.length - 1;
      if (!best || cost < best.cost || (cost === best.cost && chosen.length < best.terms.length)) best = { cost, terms: chosen };
    }
    if (!best) return null;
    const termNode = (t) => mk('a', t.lits.map((l, j) => (l === 2 ? null : l === 1 ? { t: 'v', n: vars[j] } : { t: 'n', a: { t: 'v', n: vars[j] } })).filter(Boolean));
    best.nary = ncanon(mk('o', best.terms.map(termNode)));
    best.termNodes = best.terms.map((t) => ncanon(termNode(t)));
    return best;
  }

  /* ======================================================================
   * Boolean question generation: start from a minimal target expression and
   * apply "expansion" rules (laws used backwards). The solution replays the
   * steps forwards, so every step names the law it uses.
   * ==================================================================== */

  // Put plain variable inputs first (top pin) so rail drops do not cross wires.
  function normalizeDraw(n) {
    if (n.type === 'not') normalizeDraw(n.a);
    else if (n.type === 'and' || n.type === 'or') {
      normalizeDraw(n.a);
      normalizeDraw(n.b);
      if (isLeaf(n.b) && !isLeaf(n.a)) { const t = n.a; n.a = n.b; n.b = t; }
      else if (isLeaf(n.a) && isLeaf(n.b) && n.a.name > n.b.name) { const t = n.a; n.a = n.b; n.b = t; }
    }
    return n;
  }
  // Display order for final answers: literals first, sorted by variable name.
  // Same-operator chains are flattened, sorted and rebuilt left to right.
  function prettyOrder(n) {
    const lead = (k) => (k.type === 'var' ? k.name : k.type === 'const' ? '~' : k.type === 'not' ? lead(k.a) : lead(k.a));
    const rank = (k) => (isLit(k) ? 0 : 1);
    function go(m) {
      if (isLeaf(m)) return clone(m);
      if (m.type === 'not') return NOT(go(m.a));
      const kids = flatTop(m, m.type, null).map(go);
      kids.sort((p, q) => rank(p) - rank(q) || (lead(p) < lead(q) ? -1 : lead(p) > lead(q) ? 1 : 0));
      let acc = kids[0];
      for (let i = 1; i < kids.length; i++) acc = { type: m.type, a: acc, b: kids[i] };
      return acc;
    }
    return go(n);
  }
  function allNodes(n, acc) {
    acc = acc || [];
    acc.push(n);
    if (n.type === 'not') allNodes(n.a, acc);
    else if (n.type === 'and' || n.type === 'or') { allNodes(n.a, acc); allNodes(n.b, acc); }
    return acc;
  }
  function replaceNode(root, target, repl) {
    if (root === target) return repl;
    const stack = [root];
    while (stack.length) {
      const n = stack.pop();
      for (const f of ['a', 'b']) {
        if (n[f] === target) { n[f] = repl; return root; }
        if (n[f] && typeof n[f] === 'object') stack.push(n[f]);
      }
    }
    throw new Error('replaceNode: target not found');
  }
  function hasDupChildren(n) {
    if (n.type === 'not') return hasDupChildren(n.a) || (n.a.type === 'not' && n.a.a.type === 'not');
    if (n.type === 'and' || n.type === 'or') {
      if (astKey(n.a) === astKey(n.b)) return true;
      return hasDupChildren(n.a) || hasDupChildren(n.b);
    }
    return false;
  }
  function randomAst(rng, g, vars) {
    if (g === 0) return V(rng.pick(vars));
    if (rng.chance(g === 1 ? 0.3 : 0.22)) return NOT(randomAst(rng, g - 1, vars));
    const left = rng.int(0, g - 1);
    const op = rng.chance(0.5) ? 'and' : 'or';
    return { type: op, a: randomAst(rng, left, vars), b: randomAst(rng, g - 1 - left, vars) };
  }
  // Pick the target size first (weighted), then search for a minimal
  // expression of exactly that size, so harder sizes are not starved.
  function genTarget(rng, minG, maxG, vars, weights) {
    const dp = getDP(vars.length);
    const sizes = [];
    for (let g = minG; g <= maxG; g++) sizes.push(g);
    for (let round = 0; round < 20; round++) {
      const g = rng.weighted(sizes, (k) => (weights && weights[k] != null ? weights[k] : 1))[0];
      for (let tries = 0; tries < 6000; tries++) {
        const t = randomAst(rng, g, vars);
        const m = maskOf(t, vars);
        if (m === 0 || m === dp.FULL) continue;
        if (dp.cost[m] !== g) continue;
        if (depCount(m, vars.length) < 2) continue;
        return t;
      }
    }
    throw new Error('Could not generate a target expression');
  }
  function pickOtherVar(rng, vars, avoid) {
    const free = vars.filter((v) => !avoid.has(v));
    return rng.pick(free.length ? free : vars);
  }
  const ord2 = (rng, a, b, mkf) => (rng.chance(0.5) ? mkf(a, b) : mkf(b, a));
  function splitLit(S, rng) {
    // S is AND/OR with at least one literal child; returns [literal, other]
    if (isLit(S.a) && isLit(S.b)) return rng.chance(0.5) ? [S.a, S.b] : [S.b, S.a];
    return isLit(S.a) ? [S.a, S.b] : [S.b, S.a];
  }

  const P = (s) => '<code>' + s + '</code>';
  const RULES = [
    {
      id: 'xbary_or', weight: 3, law: 'x+!x*y = x+y', name: 'drop the opposite',
      match: (S) => S.type === 'or' && (isLit(S.a) || isLit(S.b)),
      build: (S, rng) => {
        const [p, q] = splitLit(S, rng);
        const np = neg(p);
        return { node: ord2(rng, p, ord2(rng, np, q, AND), OR), info: { p, np, q } };
      },
      explain: (i) => 'The term ' + P(exprStr(i.p)) + ' is ORed with a product that contains its opposite ' + P(exprStr(i.np)) + '. If ' + P(exprStr(i.p)) + ' is 1 the OR is 1 anyway. If it is 0, then ' + P(exprStr(i.np)) + ' is 1 and adds nothing to the product. So drop ' + P(exprStr(i.np)) + '.',
    },
    {
      id: 'xbary_and', weight: 2, law: 'x*(!x+y) = x*y', name: 'drop the opposite',
      match: (S) => S.type === 'and' && (isLit(S.a) || isLit(S.b)),
      build: (S, rng) => {
        const [p, q] = splitLit(S, rng);
        const np = neg(p);
        return { node: ord2(rng, p, ord2(rng, np, q, OR), AND), info: { p, np, q } };
      },
      explain: (i) => 'Multiply out: ' + P(exprStr(i.p)) + ' times ' + P(exprStr(i.np)) + ' is 0 (a thing AND its opposite), so only ' + P(exprStr(i.p)) + ' times the rest survives. In short, inside a product with ' + P(exprStr(i.p)) + ', the opposite ' + P(exprStr(i.np)) + ' in a sum can be dropped.',
    },
    {
      id: 'distribute_and', weight: 2, law: 'x*y+x*z = x*(y+z)', name: 'distributive law, used backwards to factor',
      match: (S) => S.type === 'and' && ((isLit(S.a) && S.b.type === 'or') || (isLit(S.b) && S.a.type === 'or')),
      build: (S, rng) => {
        const p = isLit(S.a) && S.b.type === 'or' ? S.a : S.b;
        const o = p === S.a ? S.b : S.a;
        const p2 = clone(p);
        return { node: ord2(rng, ord2(rng, p, o.a, AND), ord2(rng, p2, o.b, AND), OR), info: { p } };
      },
      explain: (i) => 'Both products contain ' + P(exprStr(i.p)) + '. Factor it out (the distributive law used backwards). This removes one AND and one copy of ' + P(exprStr(i.p)) + '.',
    },
    {
      id: 'distribute_or', weight: 1.4, law: '(x+y)*(x+z) = x+y*z', name: 'distributive law for OR, used backwards',
      match: (S) => S.type === 'or' && ((isLit(S.a) && S.b.type === 'and') || (isLit(S.b) && S.a.type === 'and')),
      build: (S, rng) => {
        const p = isLit(S.a) && S.b.type === 'and' ? S.a : S.b;
        const o = p === S.a ? S.b : S.a;
        const p2 = clone(p);
        return { node: ord2(rng, ord2(rng, p, o.a, OR), ord2(rng, p2, o.b, OR), AND), info: { p } };
      },
      explain: (i) => 'Both sums contain ' + P(exprStr(i.p)) + '. The law x + yz = (x + y)(x + z), read from right to left, pulls it out.',
    },
    {
      id: 'absorb_or', weight: 1, trap: true, law: 'x+x*y = x', name: 'absorption',
      match: (S) => isLit(S),
      build: (S, rng, vars) => {
        const t = V(pickOtherVar(rng, vars, varsOf(S)));
        const T = rng.chance(0.7) ? t : NOT(t);
        const S2 = clone(S);
        return { node: ord2(rng, S, ord2(rng, S2, T, AND), OR), info: { s: S, t: T } };
      },
      explain: (i) => 'Whenever ' + P(exprStr(i.s) + '*' + exprStr(i.t)) + ' is 1, ' + P(exprStr(i.s)) + ' is already 1. So the extra product adds nothing (absorption).',
    },
    {
      id: 'absorb_and', weight: 1, trap: true, law: 'x*(x+y) = x', name: 'absorption',
      match: (S) => isLit(S),
      build: (S, rng, vars) => {
        const t = V(pickOtherVar(rng, vars, varsOf(S)));
        const T = rng.chance(0.7) ? t : NOT(t);
        const S2 = clone(S);
        return { node: ord2(rng, S, ord2(rng, S2, T, OR), AND), info: { s: S, t: T } };
      },
      explain: (i) => 'If ' + P(exprStr(i.s)) + ' is 1, then ' + P('(' + exprStr(i.s) + ' + ' + exprStr(i.t) + ')') + ' is 1 too, so the AND just equals ' + P(exprStr(i.s)) + ' (absorption).',
    },
    {
      id: 'adjacent_or', weight: 1, law: 'x*y+x*!y = x', name: 'combining',
      match: (S) => isLit(S),
      build: (S, rng, vars) => {
        const tv = pickOtherVar(rng, vars, varsOf(S));
        const S2 = clone(S);
        return { node: ord2(rng, ord2(rng, S, V(tv), AND), ord2(rng, S2, NOT(V(tv)), AND), OR), info: { s: S, t: tv } };
      },
      explain: (i) => 'Factor out ' + P(exprStr(i.s)) + ': it becomes ' + P(exprStr(i.s) + '*(' + i.t + ' + !' + i.t + ')') + '. Since ' + P(i.t + ' + !' + i.t + ' = 1') + ', we are left with ' + P(exprStr(i.s)) + '.',
    },
    {
      id: 'adjacent_and', weight: 1, law: '(x+y)*(x+!y) = x', name: 'combining',
      match: (S) => isLit(S),
      build: (S, rng, vars) => {
        const tv = pickOtherVar(rng, vars, varsOf(S));
        const S2 = clone(S);
        return { node: ord2(rng, ord2(rng, S, V(tv), OR), ord2(rng, S2, NOT(V(tv)), OR), AND), info: { s: S, t: tv } };
      },
      explain: (i) => 'Use x + yz = (x + y)(x + z) backwards: this is ' + P(exprStr(i.s) + ' + ' + i.t + '*!' + i.t) + '. Since ' + P(i.t + '*!' + i.t + ' = 0') + ', it is just ' + P(exprStr(i.s)) + '.',
    },
    {
      id: 'complement_and', weight: 0.3, law: 'x*(y+!y) = x', name: 'complement, then identity',
      match: (S) => isLit(S),
      build: (S, rng, vars) => {
        const tv = pickOtherVar(rng, vars, varsOf(S));
        return { node: ord2(rng, S, ord2(rng, V(tv), NOT(V(tv)), OR), AND), info: { s: S, t: tv } };
      },
      explain: (i) => P(i.t + ' + !' + i.t) + ' is always 1, and anything AND 1 is itself.',
    },
    {
      id: 'complement_or', weight: 0.3, law: 'x+y*!y = x', name: 'complement, then identity',
      match: (S) => isLit(S),
      build: (S, rng, vars) => {
        const tv = pickOtherVar(rng, vars, varsOf(S));
        return { node: ord2(rng, S, ord2(rng, V(tv), NOT(V(tv)), AND), OR), info: { s: S, t: tv } };
      },
      explain: (i) => P(i.t + '*!' + i.t) + ' is always 0, and anything OR 0 is itself.',
    },
    {
      id: 'demorgan_and', weight: 2, trap: true, law: '!x*!y = !(x+y)', name: "De Morgan's law",
      match: (S) => S.type === 'not' && S.a.type === 'or' && S.a.a.type !== 'not' && S.a.b.type !== 'not',
      build: (S, rng) => ({ node: ord2(rng, NOT(S.a.a), NOT(S.a.b), AND), info: { p: S.a.a, q: S.a.b } }),
      explain: (i) => 'An AND of two NOTs costs 3 gates. De Morgan says ' + P('!' + wrapP(i.p) + '*!' + wrapP(i.q) + ' = !(' + exprStr(i.p) + ' + ' + exprStr(i.q) + ')') + ', which costs only 2 (one OR, one NOT).',
    },
    {
      id: 'demorgan_or', weight: 2, trap: true, law: '!x+!y = !(x*y)', name: "De Morgan's law",
      match: (S) => S.type === 'not' && S.a.type === 'and' && S.a.a.type !== 'not' && S.a.b.type !== 'not',
      build: (S, rng) => ({ node: ord2(rng, NOT(S.a.a), NOT(S.a.b), OR), info: { p: S.a.a, q: S.a.b } }),
      explain: (i) => 'An OR of two NOTs costs 3 gates. De Morgan says ' + P('!' + wrapP(i.p) + ' + !' + wrapP(i.q) + ' = !(' + wrapP(i.p) + '*' + wrapP(i.q) + ')') + ', which costs only 2 (one AND, one NOT).',
    },
    {
      id: 'trap_and', weight: 2.5, exam: true, trap: true, law: '!(!x+y) = x*!y', name: "De Morgan's law, then double negation",
      match: (S) => S.type === 'and' && ((S.a.type === 'not' && S.b.type !== 'not') || (S.b.type === 'not' && S.a.type !== 'not')),
      build: (S, rng) => {
        const nq = S.a.type === 'not' ? S.a : S.b;
        const p = nq === S.a ? S.b : S.a;
        return { node: NOT(ord2(rng, NOT(p), nq.a, OR)), info: { p, q: nq.a } };
      },
      explain: (i) => 'A NOT over an OR: push the NOT inside with De Morgan. ' + P('!(!' + wrapP(i.p) + ' + ' + exprStr(i.q) + ')') + ' becomes ' + P('!!' + wrapP(i.p) + '*!' + wrapP(i.q)) + ', and the two NOTs on ' + P(exprStr(i.p)) + ' cancel.',
    },
    {
      id: 'trap_or', weight: 2.5, exam: true, trap: true, law: '!(!x*y) = x+!y', name: "De Morgan's law, then double negation",
      match: (S) => S.type === 'or' && ((S.a.type === 'not' && S.b.type !== 'not') || (S.b.type === 'not' && S.a.type !== 'not')),
      build: (S, rng) => {
        const nq = S.a.type === 'not' ? S.a : S.b;
        const p = nq === S.a ? S.b : S.a;
        return { node: NOT(ord2(rng, NOT(p), nq.a, AND)), info: { p, q: nq.a } };
      },
      explain: (i) => 'A NOT over an AND: push the NOT inside with De Morgan. ' + P('!(!' + wrapP(i.p) + '*' + wrapP(i.q) + ')') + ' becomes ' + P('!!' + wrapP(i.p) + ' + !' + wrapP(i.q)) + ', and the two NOTs on ' + P(exprStr(i.p)) + ' cancel.',
    },
    {
      id: 'double_neg', weight: 1.4, exam: true, trap: true, law: '!!x = x', name: 'double negation',
      match: (S) => S.type !== 'not' && S.type !== 'const',
      build: (S) => ({ node: NOT(NOT(S)), info: { s: S } }),
      explain: () => 'Two NOT gates in a row cancel. Delete both (that saves 2 gates).',
    },
  ];
  function wrapP(n) { return isLeaf(n) || n.type === 'not' ? exprStr(n) : '(' + exprStr(n) + ')'; }

  function genExpanded(rng, difficulty, vars) {
    const ex = difficulty === 'exam+';
    const lo = ex ? 5 : 4;
    const hi = ex ? 8 : 7;
    for (let attempt = 0; attempt < 600; attempt++) {
      const target = normalizeDraw(genTarget(rng, 2, ex ? 5 : 4, vars, ex ? { 2: 1, 3: 4, 4: 3.5, 5: 1.5 } : { 2: 3, 3: 4.5, 4: 2.5 }));
      const tg = gates(target);
      if (hi < tg + 2) continue;
      const goal = rng.int(Math.max(lo, tg + 2), hi);
      let E = clone(target);
      const steps = [];
      let ok = true;
      let guard = 0;
      while (gates(E) < goal && guard++ < 10) {
        const cands = [];
        for (const S of allNodes(E)) {
          for (const R of RULES) if ((!R.exam || ex) && R.match(S)) cands.push({ S, R });
        }
        let applied = false;
        for (const c of rng.weighted(cands, (cc) => cc.R.weight)) {
          const before = gates(c.S);
          const res = c.R.build(c.S, rng, vars);
          const delta = gates(res.node) - before;
          if (delta <= 0 || gates(E) + delta > hi) continue;
          E = replaceNode(E, c.S, res.node);
          normalizeDraw(E);
          steps.push({ rule: c.R, S: c.S, S2: res.node, info: res.info });
          applied = true;
          break;
        }
        if (!applied) { ok = false; break; }
      }
      if (!ok) continue;
      const g = gates(E);
      if (g < lo || g > hi || g < tg + 2) continue;
      if (gateDepth(E) > 5) continue;
      if (hasDupChildren(E)) continue;
      if (ex && !steps.some((s) => s.rule.trap)) continue;
      if (!ex && steps.length > 3) continue;
      if (maskOf(E, vars) !== maskOf(target, vars)) throw new Error('internal: expansion changed the function');
      return { target, circuit: E, steps, vars };
    }
    throw new Error('Could not generate a circuit');
  }

  // Replay the expansion steps backwards (that is, simplify) on a copy.
  // Returns [{rule, before, after, why}] with HTML strings (highlighted parts).
  function replaySimplification(gen) {
    // Work on the live objects (identity-based), then restore.
    let cur = gen.circuit;
    const out = [];
    for (let i = gen.steps.length - 1; i >= 0; i--) {
      const st = gen.steps[i];
      const before = toExam(cur, st.S2);
      const why = st.rule.explain(st.info);
      cur = replaceNode(cur, st.S2, st.S);
      normalizeDraw(cur);
      const after = toExam(cur, st.S);
      out.push({ rule: st.rule, before, after, why, expr: exprStr(cur) });
    }
    // Rebuild the circuit in place (forward again) so gen.circuit stays valid.
    for (let i = 0; i < gen.steps.length; i++) {
      const st = gen.steps[i];
      cur = replaceNode(cur, st.S, st.S2);
      normalizeDraw(cur);
    }
    gen.circuit = cur;
    return out;
  }

  /* ======================================================================
   * Gate shapes and the Boolean circuit renderer (SVG strings)
   * ==================================================================== */

  const GATE = { and: { w: 46, h: 40 }, or: { w: 46, h: 40 }, not: { w: 34, h: 26 } };
  const PIN_DY = 10;
  const STROKE = 'stroke="currentColor" stroke-width="2"';

  function gateShape(type, cx, cy) {
    if (type === 'and') {
      const w = 46, h = 40, x0 = cx - w / 2, y0 = cy - h / 2, r = h / 2;
      return {
        svg: '<path d="M' + fx(x0) + ',' + fx(y0) + ' H' + fx(x0 + w - r) + ' A' + r + ',' + r + ' 0 0 1 ' + fx(x0 + w - r) + ',' + fx(y0 + h) + ' H' + fx(x0) + ' Z" ' + STROKE + ' style="fill:' + BG + '"/>',
        pins: [{ x: x0, y: cy - PIN_DY }, { x: x0, y: cy + PIN_DY }],
        out: { x: x0 + w, y: cy }, x0, y0, w, h, cx, cy,
      };
    }
    if (type === 'or') {
      const w = 46, h = 40, x0 = cx - w / 2, y0 = cy - h / 2, k = 7;
      const inset = (py) => { const t = (py - y0) / h; return 2 * t * (1 - t) * (2 * k); };
      return {
        svg: '<path d="M' + fx(x0) + ',' + fx(y0) + ' Q' + fx(x0 + w * 0.62) + ',' + fx(y0) + ' ' + fx(x0 + w) + ',' + fx(cy) +
          ' Q' + fx(x0 + w * 0.62) + ',' + fx(y0 + h) + ' ' + fx(x0) + ',' + fx(y0 + h) +
          ' Q' + fx(x0 + 2 * k) + ',' + fx(cy) + ' ' + fx(x0) + ',' + fx(y0) + ' Z" ' + STROKE + ' style="fill:' + BG + '"/>',
        pins: [{ x: x0 + inset(cy - PIN_DY), y: cy - PIN_DY }, { x: x0 + inset(cy + PIN_DY), y: cy + PIN_DY }],
        out: { x: x0 + w, y: cy }, x0, y0, w, h, cx, cy,
      };
    }
    // NOT: triangle plus bubble
    const tw = 24, th = 24, r = 4.5, x0 = cx - 17;
    return {
      svg: '<path d="M' + fx(x0) + ',' + fx(cy - th / 2) + ' L' + fx(x0 + tw) + ',' + fx(cy) + ' L' + fx(x0) + ',' + fx(cy + th / 2) + ' Z" ' + STROKE + ' style="fill:' + BG + '"/>' +
        '<circle cx="' + fx(x0 + tw + r) + '" cy="' + fx(cy) + '" r="' + r + '" ' + STROKE + ' style="fill:' + BG + '"/>',
      pins: [{ x: x0, y: cy }],
      out: { x: x0 + tw + 2 * r, y: cy }, x0, y0: cy - th / 2, w: tw + 2 * r, h: th, cx, cy,
    };
  }

  function polyline(pts, extra) {
    return '<polyline points="' + pts.map((p) => fx(p.x) + ',' + fx(p.y)).join(' ') + '" fill="none" ' + STROKE + ' stroke-linejoin="round"' + (extra || '') + '/>';
  }
  function dot(p) { return '<circle cx="' + fx(p.x) + '" cy="' + fx(p.y) + '" r="3.6" fill="currentColor"/>'; }

  function permutations(arr) {
    if (arr.length <= 1) return [arr.slice()];
    const out = [];
    arr.forEach((x, i) => {
      for (const rest of permutations(arr.slice(0, i).concat(arr.slice(i + 1)))) out.push([x].concat(rest));
    });
    return out;
  }

  // Lay out a Boolean expression as a circuit. Returns geometry (no DOM).
  function circuitLayout(ast, vars) {
    if (isLeaf(ast)) throw new Error('Nothing to draw: the expression has no gates.');
    vars = (vars || ['x', 'y', 'z']).slice();
    for (const v of varsOf(ast)) if (!vars.includes(v)) vars.push(v);
    const PAD = 6, GAP = 6;
    // depth from the output
    const depth = new Map();
    let maxD = 0;
    (function walk(n, d) {
      if (isLeaf(n)) return;
      depth.set(n, d);
      maxD = Math.max(maxD, d);
      if (n.type === 'not') walk(n.a, d + 1); else { walk(n.a, d + 1); walk(n.b, d + 1); }
    })(ast, 0);
    // vertical layout (relative bands)
    const shiftItems = (items, s) => items.map(([n, y]) => [n, y + s]);
    function lay(node) {
      const g = GATE[node.type];
      if (node.type === 'not') {
        if (isLeaf(node.a)) { const h = g.h + 2 * PAD; return { h, y: h / 2, items: [[node, h / 2]] }; }
        const L = lay(node.a);
        const shift = Math.max(0, g.h / 2 + PAD - L.y);
        const y = L.y + shift;
        const h = Math.max(L.h + shift, y + g.h / 2 + PAD);
        return { h, y, items: shiftItems(L.items, shift).concat([[node, y]]) };
      }
      const av = isLeaf(node.a), bv = isLeaf(node.b);
      if (av && bv) { const h = g.h + 2 * PAD; return { h, y: h / 2, items: [[node, h / 2]] }; }
      if (av || bv) {
        const L = lay(av ? node.b : node.a);
        let y = av ? L.y - PIN_DY : L.y + PIN_DY;
        const shift = Math.max(0, g.h / 2 + PAD - y);
        y += shift;
        const h = Math.max(L.h + shift, y + g.h / 2 + PAD);
        return { h, y, items: shiftItems(L.items, shift).concat([[node, y]]) };
      }
      const La = lay(node.a), Lb = lay(node.b);
      const off = La.h + GAP;
      const y = (La.y + off + Lb.y) / 2;
      const h = Math.max(off + Lb.h, y + g.h / 2 + PAD);
      return { h, y, items: La.items.concat(shiftItems(Lb.items, off)).concat([[node, y]]) };
    }
    const L = lay(ast);
    const railY = vars.map((_, j) => 18 + 20 * j);
    const top = railY[railY.length - 1] + 24;
    const info = new Map();
    for (const [n, y] of L.items) info.set(n, { node: n, type: n.type, col: maxD - depth.get(n), cy: top + y });
    const nCols = maxD + 1;
    // input requests per channel (channel c sits just left of column c)
    const channels = Array.from({ length: nCols }, () => []);
    const straights = [];
    for (const gi of info.values()) {
      const kids = gi.type === 'not' ? [gi.node.a] : [gi.node.a, gi.node.b];
      kids.forEach((k, idx) => {
        const pinY = gi.type === 'not' ? gi.cy : gi.cy + (idx === 0 ? -PIN_DY : PIN_DY);
        if (isLeaf(k)) channels[gi.col].push({ kind: 'drop', v: k.name, pinY, gi, idx });
        else {
          const ci = info.get(k);
          if (Math.abs(ci.cy - pinY) < 0.5) straights.push({ ci, gi, idx });
          else channels[gi.col].push({ kind: 'jog', fromY: ci.cy, pinY, ci, gi, idx });
        }
      });
    }
    // x positions
    const TRACK = 12, CW = 46;
    const colX = [];
    const trackX = new Map();
    let cursor = 30;
    for (let c = 0; c < nCols; c++) {
      const reqs = channels[c];
      const chW = Math.max(26, TRACK * (reqs.length + 1));
      const left = cursor;
      // choose the track order with the fewest wire crossings
      const segsFor = (order) => {
        const vs = [], hs = [];
        order.forEach((r, k) => {
          const x = left + TRACK * (k + 1);
          if (r.kind === 'drop') {
            vs.push({ x, y1: railY[vars.indexOf(r.v)], y2: r.pinY });
            hs.push({ y: r.pinY, x1: x, x2: left + chW });
          } else {
            vs.push({ x, y1: Math.min(r.fromY, r.pinY), y2: Math.max(r.fromY, r.pinY) });
            hs.push({ y: r.fromY, x1: left, x2: x });
            hs.push({ y: r.pinY, x1: x, x2: left + chW });
          }
        });
        for (const s of straights) if (s.gi.col === c) hs.push({ y: s.ci.cy, x1: left, x2: left + chW });
        let cross = 0;
        for (const v of vs) for (const h of hs) {
          if (h.x1 < v.x - 0.1 && v.x + 0.1 < h.x2 && v.y1 + 0.1 < h.y && h.y < v.y2 - 0.1) cross++;
        }
        return cross;
      };
      let order = reqs.slice().sort((p, q) => q.pinY - p.pinY);
      if (reqs.length > 1 && reqs.length <= 6) {
        let best = segsFor(order);
        for (const perm of permutations(reqs)) {
          const sc = segsFor(perm);
          if (sc < best) { best = sc; order = perm; }
        }
      }
      order.forEach((r, k) => trackX.set(r, left + TRACK * (k + 1)));
      cursor += chW;
      colX.push(cursor);
      cursor += CW;
    }
    // gate geometry
    const gatesOut = [];
    for (const gi of info.values()) {
      const g = GATE[gi.type];
      const cx = colX[gi.col] + CW / 2 + (gi.type === 'not' ? (g.w - CW) / 2 + 6 : 0);
      gi.shape = gateShape(gi.type, cx, gi.cy);
      gatesOut.push(gi);
    }
    gatesOut.sort((p, q) => p.col - q.col || p.cy - q.cy);
    gatesOut.forEach((g, i) => { g.num = i + 1; });
    // wires
    const wires = [];
    const dots = [];
    let maxDropX = 60;
    for (let c = 0; c < nCols; c++) {
      for (const r of channels[c]) {
        const x = trackX.get(r);
        const pin = r.gi.shape.pins[r.idx];
        if (r.kind === 'drop') {
          const ry = railY[vars.indexOf(r.v)];
          wires.push([{ x, y: ry }, { x, y: pin.y }, { x: pin.x, y: pin.y }]);
          dots.push({ x, y: ry });
          maxDropX = Math.max(maxDropX, x);
        } else {
          const o = r.ci.shape.out;
          wires.push([o, { x, y: o.y }, { x, y: pin.y }, { x: pin.x, y: pin.y }]);
        }
      }
    }
    for (const s of straights) wires.push([s.ci.shape.out, s.gi.shape.pins[s.idx]]);
    const root = info.get(ast);
    const outP = root.shape.out;
    const outEnd = { x: outP.x + 22, y: outP.y };
    wires.push([outP, outEnd]);
    const width = outEnd.x + 36;
    const height = top + L.h + 6;
    return { width, height, vars, railY, railEnd: maxDropX + 8, gates: gatesOut, wires, dots, outEnd, root };
  }

  function circuitSvg(astOrString, opts) {
    opts = opts || {};
    const ast = typeof astOrString === 'string' ? normalizeDraw(parse(astOrString)) : astOrString;
    const L = circuitLayout(ast, opts.vars);
    const parts = [];
    L.vars.forEach((v, j) => {
      const y = L.railY[j];
      parts.push('<text x="6" y="' + fx(y + 5) + '" font-size="16" font-style="italic" fill="currentColor">' + esc(v) + '</text>');
      parts.push('<line x1="20" y1="' + y + '" x2="' + fx(L.railEnd) + '" y2="' + y + '" ' + STROKE + '/>');
    });
    for (const w of L.wires) parts.push(polyline(w));
    for (const d of L.dots) parts.push(dot(d));
    for (const g of L.gates) {
      parts.push(g.shape.svg);
      if (opts.numbers) {
        if (g.type === 'not') parts.push('<text x="' + fx(g.shape.x0 + 12) + '" y="' + fx(g.cy - 16) + '" font-size="12" font-weight="700" text-anchor="middle" fill="currentColor">' + g.num + '</text>');
        else parts.push('<text x="' + fx(g.shape.cx - (g.type === 'and' ? 3 : 1)) + '" y="' + fx(g.cy + 4.5) + '" font-size="12" font-weight="700" text-anchor="middle" fill="currentColor">' + g.num + '</text>');
      }
    }
    parts.push('<text x="' + fx(L.outEnd.x + 5) + '" y="' + fx(L.outEnd.y + 5) + '" font-size="16" font-style="italic" fill="currentColor">out</text>');
    const maxW = Math.round(L.width * 1.25);
    return '<svg class="sds-circuit" viewBox="0 0 ' + fx(L.width) + ' ' + fx(L.height) + '" role="img" aria-label="logic circuit" style="width:100%;max-width:' + maxW + 'px;height:auto;display:block;color:inherit;font-family:system-ui,sans-serif" xmlns="http://www.w3.org/2000/svg">' + parts.join('') + '</svg>';
  }

  // Gate-by-gate reading of a drawn circuit (same numbering as circuitSvg numbers).
  function circuitReading(ast, vars) {
    const L = circuitLayout(ast, vars);
    const name = new Map();
    for (const g of L.gates) name.set(g.node, g.num);
    const src = (k) => (isLeaf(k) ? '<code>' + esc(exprStr(k)) + '</code>' : 'gate ' + name.get(k));
    const rows = L.gates.map((g) => {
      const kids = g.type === 'not' ? [g.node.a] : [g.node.a, g.node.b];
      return '<tr><td>' + g.num + '</td><td>' + g.type.toUpperCase() + '</td><td>' + kids.map(src).join(', ') + '</td><td><code>' + esc(exprStr(g.node)) + '</code></td></tr>';
    });
    return '<table class="table table-sm table-bordered w-auto mb-2"><thead><tr><th>Gate</th><th>Type</th><th>Inputs</th><th>Output</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>';
  }

  function truthTableHtml(vars, cols, opts) {
    opts = opts || {};
    const n = vars.length;
    const head = vars.map((v) => '<th>' + esc(v) + '</th>').join('') + cols.map((c) => '<th>' + c.label + '</th>').join('');
    let body = '';
    for (let i = 0; i < (1 << n); i++) {
      const bits = vars.map((_, j) => (i >> (n - 1 - j)) & 1);
      const cells = cols.map((c) => {
        const v = c.values[i];
        const shown = isOne(v) ? '1' : isZero(v) ? '0' : 'X';
        const bad = c.compare && !isOne(c.compare[i]) !== !isOne(v) && (isOne(c.compare[i]) || isZero(c.compare[i]));
        return '<td' + (bad ? ' class="table-danger"' : '') + '>' + shown + '</td>';
      }).join('');
      body += '<tr>' + bits.map((b) => '<td>' + b + '</td>').join('') + cells + '</tr>';
    }
    return '<table class="table table-sm table-bordered w-auto text-center font-monospace mb-2"' + (opts.style ? ' style="' + opts.style + '"' : '') + '><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';
  }

  /* ======================================================================
   * Boolean grading
   * ==================================================================== */

  function gradeBoolAnswer(answer, ctx) {
    // ctx: { vars, table (may contain 'x' don't-cares), minG }
    const raw = String(answer == null ? '' : answer).trim();
    if (!raw) return { score: 0, correct: false, feedbackHtml: verdictHtml(0, false, 'The answer box is empty.'), mark: 'bad' };
    let ast;
    try {
      // Accept the other letter case if the question uses the other case.
      let fixed = raw;
      const lower = ctx.vars.every((v) => v === v.toLowerCase());
      fixed = raw.replace(/[A-Za-z]/g, (ch) => {
        if (ctx.vars.includes(ch)) return ch;
        const other = lower ? ch.toLowerCase() : ch.toUpperCase();
        return ctx.vars.includes(other) ? other : ch;
      });
      ast = parse(fixed);
    } catch (e) {
      return { score: 0, correct: false, feedbackHtml: verdictHtml(0, false, "I couldn't read that: " + esc(e.message)), mark: 'bad' };
    }
    let tt;
    try { tt = truthTable(ast, ctx.vars); } catch (e) {
      return { score: 0, correct: false, feedbackHtml: verdictHtml(0, false, esc(e.message)), mark: 'bad' };
    }
    for (let i = 0; i < ctx.table.length; i++) {
      const want = ctx.table[i];
      if (!isOne(want) && !isZero(want)) continue;
      if (tt[i] !== (isOne(want) ? 1 : 0)) {
        const n = ctx.vars.length;
        const assign = ctx.vars.map((v, j) => v + ' = ' + ((i >> (n - 1 - j)) & 1)).join(', ');
        return {
          score: 0, correct: false, mark: 'bad',
          feedbackHtml: verdictHtml(0, false, 'Your expression is not equivalent. For <code>' + assign + '</code> it gives ' + tt[i] + ', but the answer should be ' + (isOne(want) ? 1 : 0) + '. (0 / 2 exam points)'),
        };
      }
    }
    const g = gates(ast);
    const extra = Math.max(0, g - ctx.minG);
    const score = Math.max(0.25, 1 - 0.25 * extra);
    if (extra === 0) {
      return { score: 1, correct: true, mark: 'ok', feedbackHtml: verdictHtml(1, true, 'Equivalent and minimal: ' + gateBreakdown(ast) + '. (' + pointsText(1, 2) + ')') };
    }
    return {
      score, correct: false, mark: 'warn',
      feedbackHtml: verdictHtml(score, false, 'Equivalent, but it uses ' + gateBreakdown(ast) + '. The minimum is ' + plural(ctx.minG, 'gate') + ', so ' + plural(extra, 'extra gate') + (extra === 1 ? ' costs ' : ' cost ') + plural(0.5 * extra, 'point') + '. (' + pointsText(score, 2) + ')'),
    };
  }

  /* ======================================================================
   * FSM: pattern detectors, simulation, layout and drawing
   * ==================================================================== */

  const STATE_NAMES = 'ABCDEFGH'.split('');

  function borderLen(p) {
    for (let len = p.length - 1; len > 0; len--) if (p.endsWith(p.slice(0, len))) return len;
    return 0;
  }
  function suffixPrefix(s, p) {
    for (let len = Math.min(s.length, p.length - 1); len > 0; len--) if (s.endsWith(p.slice(0, len))) return len;
    return 0;
  }
  function buildDetector(pattern, overlap) {
    const L = pattern.length;
    const states = STATE_NAMES.slice(0, L);
    const trans = {};
    for (let k = 0; k < L; k++) {
      trans[states[k]] = [0, 1].map((b) => {
        const s = pattern.slice(0, k) + b;
        if (s === pattern) return { to: states[overlap ? borderLen(pattern) : 0], out: 1 };
        return { to: states[suffixPrefix(s, pattern)], out: 0 };
      });
    }
    return { states, start: 'A', trans, pattern, overlap: !!overlap };
  }
  function toBits(input) {
    if (typeof input === 'string') return input.replace(/\s+/g, '').split('').map(Number);
    return input.map(Number);
  }
  function fsmRun(fsm, input) {
    let s = fsm.start;
    const out = [];
    for (const b of toBits(input)) {
      const t = fsm.trans[s][b];
      out.push(t.out);
      s = t.to;
    }
    return typeof input === 'string' ? out.join('') : out;
  }
  function fsmTrace(fsm, input) {
    let s = fsm.start;
    return toBits(input).map((b, i) => {
      const t = fsm.trans[s][b];
      const row = { step: i + 1, state: s, bit: b, out: t.out, next: t.to };
      s = t.to;
      return row;
    });
  }
  // Brute-force reference: direct string scan (used by tests and as a check).
  function patternScan(pattern, overlap, input) {
    const bits = toBits(input).join('');
    const L = pattern.length;
    let lastEnd = -1;
    let out = '';
    for (let i = 0; i < bits.length; i++) {
      const start = i - L + 1;
      const hit = start >= 0 && bits.slice(start, i + 1) === pattern && (overlap || start > lastEnd);
      if (hit) lastEnd = i;
      out += hit ? '1' : '0';
    }
    return out;
  }
  function fsmArrows(fsm) {
    const out = [];
    fsm.states.forEach((s) => [0, 1].forEach((b) => {
      const t = fsm.trans[s][b];
      out.push({ from: s, to: t.to, input: b, output: t.out, label: b + '/' + t.out });
    }));
    return out;
  }
  function stateMeaning(fsm, s) {
    const k = fsm.states.indexOf(s);
    if (!fsm.pattern) return '';
    if (k === 0) return 'nothing useful yet';
    return 'the last ' + (k === 1 ? 'bit was' : k + ' bits were') + ' <code>' + fsm.pattern.slice(0, k) + '</code>';
  }
  function transitionReason(fsm, s, b) {
    const p = fsm.pattern;
    const L = p.length;
    const k = fsm.states.indexOf(s);
    const seen = p.slice(0, k);
    const s2 = seen + b;
    const t = fsm.trans[s][b];
    if (s2 === p) {
      if (!fsm.overlap) return 'Reading ' + b + ' completes <code>' + p + '</code>, so output 1. Non-overlapping: reset to A.';
      const bl = borderLen(p);
      if (bl === 0) return 'Reading ' + b + ' completes <code>' + p + '</code>, so output 1. No ending of <code>' + p + '</code> starts a new match, so go to A.';
      return 'Reading ' + b + ' completes <code>' + p + '</code>, so output 1. Matches may overlap, and the ending <code>' + p.slice(L - bl) + '</code> is already the start of a new match, so go to ' + t.to + '.';
    }
    if (s2.length < L && p.startsWith(s2)) return b + ' is the next bit of the pattern. Output 0 and move forward to ' + t.to + '.';
    const nk2 = fsm.states.indexOf(t.to);
    return 'Wrong bit: we have now seen <code>...' + s2 + '</code>. ' + (nk2 === 0 ? 'No ending of it starts the pattern, so output 0 and go back to A.' : 'Its longest ending that starts the pattern is <code>' + p.slice(0, nk2) + '</code>, so output 0 and go to ' + t.to + '.');
  }

  function fsmLayout(fsm, opt) {
    opt = opt || {};
    const bw = opt.bw || 58, bh = opt.bh || 30;
    const names = fsm.states;
    const n = names.length;
    const R = 27;
    let pos, loopDeg;
    if (n <= 2) { pos = { A: [120, 140], B: [330, 140] }; loopDeg = { A: -90, B: 0 }; }
    else if (n === 3) { pos = { A: [240, 120], B: [112, 322], C: [368, 322] }; loopDeg = { A: -90, B: 125, C: 55 }; }
    else { pos = { A: [140, 130], B: [370, 130], C: [370, 350], D: [140, 350] }; loopDeg = { A: -90, B: -45, C: 45, D: 135 }; }
    const arrows = fsmArrows(fsm);
    const groups = {};
    arrows.forEach((a, i) => { a.index = i; const k = a.from + '>' + a.to; (groups[k] = groups[k] || []).push(a); });
    const loopsAt = {};
    const heads = [];
    const centroid = [0, 0];
    names.forEach((s) => { centroid[0] += pos[s][0] / n; centroid[1] += pos[s][1] / n; });
    const unit = (x, y) => { const L = Math.hypot(x, y) || 1; return [x / L, y / L]; };
    for (const a of arrows) {
      const [cx, cy] = pos[a.from];
      if (a.from === a.to) {
        const idx = (loopsAt[a.from] = (loopsAt[a.from] || 0) + 1) - 1;
        const th = (loopDeg[a.from] + idx * 70) * Math.PI / 180;
        const dirv = (ang) => [Math.cos(ang), Math.sin(ang)];
        const p1 = dirv(th - 0.5), p2 = dirv(th + 0.5), c1 = dirv(th - 0.72), c2 = dirv(th + 0.72);
        const Lc = R * 3.5;
        const S = [cx + R * p1[0], cy + R * p1[1]], E = [cx + R * p2[0], cy + R * p2[1]];
        const C1 = [cx + Lc * c1[0], cy + Lc * c1[1]], C2 = [cx + Lc * c2[0], cy + Lc * c2[1]];
        const d = unit(E[0] - C2[0], E[1] - C2[1]);
        const Ee = [E[0] - d[0] * 7, E[1] - d[1] * 7];
        a.path = 'M' + fx(S[0]) + ',' + fx(S[1]) + ' C' + fx(C1[0]) + ',' + fx(C1[1]) + ' ' + fx(C2[0]) + ',' + fx(C2[1]) + ' ' + fx(Ee[0]) + ',' + fx(Ee[1]);
        a.head = { tip: E, dir: d };
        const apex = [0.125 * S[0] + 0.375 * C1[0] + 0.375 * C2[0] + 0.125 * E[0], 0.125 * S[1] + 0.375 * C1[1] + 0.375 * C2[1] + 0.125 * E[1]];
        const ext = Math.abs(Math.cos(th)) * bw / 2 + Math.abs(Math.sin(th)) * bh / 2;
        a.candidates = [0, 0.35, -0.35].map((dt) => {
          const u = [Math.cos(th + dt), Math.sin(th + dt)];
          const e2 = Math.abs(u[0]) * bw / 2 + Math.abs(u[1]) * bh / 2;
          return [apex[0] + u[0] * ((dt ? e2 : ext) + 3), apex[1] + u[1] * ((dt ? e2 : ext) + 3)];
        });
        a.loop = true;
      } else {
        const g = groups[a.from + '>' + a.to];
        const rev = groups[a.to + '>' + a.from];
        const idx = g.indexOf(a);
        let bend;
        const [qx, qy] = pos[a.to];
        const [ux, uy] = unit(qx - cx, qy - cy);
        const nx = uy, ny = -ux;
        if (g.length === 1) bend = rev ? 64 : 0;
        else if (rev) bend = [64, 150][idx];
        else {
          // two arrows between the same pair in the same direction:
          // both bulge to the outside of the drawing, with different bends
          const mx = (cx + qx) / 2 - centroid[0], my = (cy + qy) / 2 - centroid[1];
          const side = nx * mx + ny * my >= 0 ? 1 : -1;
          bend = side * [36, 150][idx];
        }
        const K = [(cx + qx) / 2 + nx * bend, (cy + qy) / 2 + ny * bend];
        const ds = unit(K[0] - cx, K[1] - cy), de = unit(K[0] - qx, K[1] - qy);
        const S = [cx + R * ds[0], cy + R * ds[1]];
        const E = [qx + R * de[0], qy + R * de[1]];
        const d = unit(E[0] - K[0], E[1] - K[1]);
        const Ee = [E[0] - d[0] * 7, E[1] - d[1] * 7];
        a.path = 'M' + fx(S[0]) + ',' + fx(S[1]) + ' Q' + fx(K[0]) + ',' + fx(K[1]) + ' ' + fx(Ee[0]) + ',' + fx(Ee[1]);
        a.head = { tip: E, dir: d };
        const q = (t) => [(1 - t) * (1 - t) * S[0] + 2 * (1 - t) * t * K[0] + t * t * E[0], (1 - t) * (1 - t) * S[1] + 2 * (1 - t) * t * K[1] + t * t * E[1]];
        a.candidates = [0.5, 0.42, 0.58, 0.35, 0.65, 0.28, 0.72].map(q);
      }
      heads.push(a.head);
    }
    // start arrow
    const [ax, ay] = pos.A;
    const start = { x1: ax - R - 56, y: ay, x2: ax - R };
    // obstacles
    const circles = names.map((s) => ({ x: pos[s][0], y: pos[s][1], r: R + 3 }));
    heads.forEach((h) => circles.push({ x: h.tip[0] - h.dir[0] * 6, y: h.tip[1] - h.dir[1] * 6, r: 6 }));
    const fixedRects = [{ x1: start.x1 - 2, y1: ay - 24, x2: start.x2, y2: ay + 4 }];
    const rectOverlap = (p, q) => Math.max(0, Math.min(p.x2, q.x2) - Math.max(p.x1, q.x1)) * Math.max(0, Math.min(p.y2, q.y2) - Math.max(p.y1, q.y1));
    const circOverlap = (r, c) => {
      const px = Math.max(r.x1, Math.min(c.x, r.x2)), py = Math.max(r.y1, Math.min(c.y, r.y2));
      const d = Math.hypot(px - c.x, py - c.y);
      return d < c.r ? (c.r - d + 1) * 40 : 0;
    };
    const placed = [];
    const order = arrows.filter((a) => a.loop).concat(arrows.filter((a) => !a.loop));
    for (const a of order) {
      let best = null;
      a.candidates.forEach((c, ci) => {
        const r = { x1: c[0] - bw / 2, y1: c[1] - bh / 2, x2: c[0] + bw / 2, y2: c[1] + bh / 2 };
        let ov = 0;
        for (const p of placed) ov += rectOverlap(r, p) * 4;
        for (const f of fixedRects) ov += rectOverlap(r, f);
        for (const cc of circles) ov += circOverlap(r, cc);
        const score = ov * 1000 + ci;
        if (!best || score < best.score) best = { score, c, r };
      });
      a.lx = best.c[0];
      a.ly = best.c[1];
      placed.push(best.r);
    }
    // bounds
    let minX = start.x1 - 4, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const grow = (x1, y1, x2, y2) => { minX = Math.min(minX, x1); minY = Math.min(minY, y1); maxX = Math.max(maxX, x2); maxY = Math.max(maxY, y2); };
    names.forEach((s) => grow(pos[s][0] - R, pos[s][1] - R, pos[s][0] + R, pos[s][1] + R));
    placed.forEach((r) => grow(r.x1, r.y1, r.x2, r.y2));
    grow(start.x1, ay - 24, start.x2, ay + 4);
    arrows.forEach((a) => {
      // sample the path control points roughly through candidates
      a.candidates.forEach((c) => grow(c[0] - 2, c[1] - 2, c[0] + 2, c[1] + 2));
    });
    const M = 8;
    const vb = { x: minX - M, y: minY - M, w: maxX - minX + 2 * M, h: maxY - minY + 2 * M };
    return { vb, pos, R, arrows, start, bw, bh };
  }

  function arrowHead(h, size) {
    size = size || 13;
    const [tx, ty] = h.tip, [dx, dy] = h.dir;
    const bx = tx - dx * size, by = ty - dy * size;
    const px = -dy * size * 0.45, py = dx * size * 0.45;
    return '<polygon points="' + fx(tx) + ',' + fx(ty) + ' ' + fx(bx + px) + ',' + fx(by + py) + ' ' + fx(bx - px) + ',' + fx(by - py) + '" fill="currentColor"/>';
  }

  // Returns { html, arrows } for the diagram. labels: 'shown' | 'inputs' | 'hidden'
  function fsmDiagramHtml(fsm, opts) {
    opts = opts || {};
    const mode = opts.labels || 'shown';
    const L = mode === 'inputs' ? fsmLayout(fsm, { bw: 58, bh: 30 }) : fsmLayout(fsm, { bw: 46, bh: 26 });
    const { vb } = L;
    const parts = [];
    for (const a of L.arrows) {
      parts.push('<path d="' + a.path + '" fill="none" stroke="currentColor" stroke-width="2"/>');
      parts.push(arrowHead(a.head));
    }
    // start arrow
    parts.push('<line x1="' + fx(L.start.x1) + '" y1="' + fx(L.start.y) + '" x2="' + fx(L.start.x2 - 9) + '" y2="' + fx(L.start.y) + '" stroke="currentColor" stroke-width="2"/>');
    parts.push(arrowHead({ tip: [L.start.x2, L.start.y], dir: [1, 0] }));
    parts.push('<text x="' + fx(L.start.x1) + '" y="' + fx(L.start.y - 8) + '" font-size="15" fill="currentColor">start</text>');
    for (const s of fsm.states) {
      const [x, y] = L.pos[s];
      parts.push('<circle cx="' + x + '" cy="' + y + '" r="' + L.R + '" stroke="currentColor" stroke-width="2.2" style="fill:' + BG + '"/>');
      parts.push('<text x="' + x + '" y="' + (y + 7) + '" font-size="20" font-weight="700" text-anchor="middle" fill="currentColor">' + s + '</text>');
    }
    if (mode === 'shown') {
      for (const a of L.arrows) {
        const hl = opts.highlight && opts.highlight(a);
        parts.push('<rect x="' + fx(a.lx - L.bw / 2) + '" y="' + fx(a.ly - L.bh / 2) + '" width="' + L.bw + '" height="' + L.bh + '" rx="5" style="fill:' + (hl ? '#fff3cd' : BG) + '" stroke="' + (hl ? '#b58105' : 'currentColor') + '" stroke-opacity="' + (hl ? 1 : 0.35) + '" stroke-width="1.2"/>');
        parts.push('<text x="' + fx(a.lx) + '" y="' + fx(a.ly + 5.5) + '" font-size="16" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-weight="600" text-anchor="middle" fill="currentColor">' + a.label + '</text>');
      }
    }
    const svg = '<svg viewBox="' + fx(vb.x) + ' ' + fx(vb.y) + ' ' + fx(vb.w) + ' ' + fx(vb.h) + '" role="img" aria-label="state diagram" style="width:100%;height:auto;display:block;font-family:system-ui,sans-serif" xmlns="http://www.w3.org/2000/svg">' + parts.join('') + '</svg>';
    let boxes = '';
    if (mode === 'inputs') {
      const wPct = L.bw / vb.w * 100, hPct = L.bh / vb.w * 100, fPct = hPct * 0.52;
      const wPx = Math.round(L.bw * 1.0), hPx = Math.round(L.bh * 1.0);
      for (const a of L.arrows) {
        const left = (a.lx - vb.x) / vb.w * 100, top = (a.ly - vb.y) / vb.h * 100;
        boxes += '<input type="text" class="form-control form-control-sm sds-fsm-box" name="arrow-' + a.index + '" data-sds-arrow="' + a.index + '" placeholder="i/o" autocomplete="off" spellcheck="false" aria-label="label for arrow from ' + a.from + ' to ' + a.to + '" maxlength="5" style="position:absolute;left:' + left.toFixed(2) + '%;top:' + top.toFixed(2) + '%;transform:translate(-50%,-50%);' +
          'width:' + wPx + 'px;width:' + wPct.toFixed(2) + 'cqw;height:' + hPx + 'px;height:' + hPct.toFixed(2) + 'cqw;min-height:0;font-size:14px;font-size:clamp(10px,' + fPct.toFixed(2) + 'cqw,17px);padding:0 2px;text-align:center;font-family:var(--bs-font-monospace,monospace);">';
      }
    }
    const maxW = Math.round(vb.w * 1.12);
    const html = '<div class="sds-fsm-wrap" style="position:relative;width:100%;max-width:' + maxW + 'px;margin:0 auto;container-type:inline-size;">' + svg + boxes + '</div>';
    return { html, layout: L };
  }

  /* ======================================================================
   * Timing: templates, solver, renderer
   * ==================================================================== */

  const REG_W = 54, REG_H = 64;
  function regGeom(cx, cy) {
    const x0 = cx - REG_W / 2, y0 = cy - REG_H / 2;
    return { x0, y0, cx, cy, d: { x: x0 - 10, y: cy - 12 }, q: { x: x0 + REG_W + 10, y: cy - 12 } };
  }

  // Hand-drawn templates. Registers: D/Q pins sit 12 above the register center.
  const TEMPLATES = [
    {
      id: 'pm15', title: 'Practice exam layout',
      nodes: [
        { id: 'r1', type: 'reg', name: 'Reg1', x: 60, y: 72 },
        { id: 'r2', type: 'reg', name: 'Reg2', x: 60, y: 192 },
        { id: 'g1', type: 'and', x: 200, y: 100 },
        { id: 'g2', type: 'or', x: 310, y: 150 },
        { id: 'r3', type: 'reg', name: 'Reg3', x: 420, y: 162 },
        { id: 'g3', type: 'not', x: 505, y: 150 },
        { id: 'r4', type: 'reg', name: 'Reg4', x: 595, y: 162 },
      ],
      edges: [
        { from: 'r1', to: 'g1', pin: 0, x: 140 },
        { from: 'r2', to: 'g1', pin: 1, x: 150 },
        { from: 'r2', to: 'g2', pin: 1, x: 262 },
        { from: 'g1', to: 'g2', pin: 0, x: 250 },
        { from: 'g2', to: 'r3', pin: 0 },
        { from: 'r3', to: 'g3', pin: 0 },
        { from: 'g3', to: 'r4', pin: 0 },
      ],
    },
    {
      id: 'disc7', title: 'Two sources into one register',
      nodes: [
        { id: 'rA', type: 'reg', name: 'RegA', x: 60, y: 72 },
        { id: 'rB', type: 'reg', name: 'RegB', x: 60, y: 212 },
        { id: 'g1', type: 'and', x: 200, y: 100 },
        { id: 'g2', type: 'or', x: 310, y: 180 },
        { id: 'g3', type: 'and', x: 420, y: 130 },
        { id: 'rC', type: 'reg', name: 'RegC', x: 530, y: 142 },
      ],
      edges: [
        { from: 'rA', to: 'g1', pin: 0, x: 140 },
        { from: 'rB', to: 'g1', pin: 1, x: 150 },
        { from: 'rB', to: 'g2', pin: 1, x: 266 },
        { from: 'g1', to: 'g2', pin: 0, x: 250 },
        { from: 'g1', to: 'g3', pin: 0, x: 362 },
        { from: 'g2', to: 'g3', pin: 1, x: 374 },
        { from: 'g3', to: 'rC', pin: 0 },
      ],
    },
    {
      id: 'feedback', title: 'Feedback loop',
      nodes: [
        { id: 'rA', type: 'reg', name: 'RegA', x: 80, y: 92 },
        { id: 'rB', type: 'reg', name: 'RegB', x: 80, y: 222 },
        { id: 'g1', type: 'and', x: 225, y: 130 },
        { id: 'g2', type: 'not', x: 322, y: 130 },
        { id: 'g3', type: 'or', x: 430, y: 120 },
      ],
      edges: [
        { from: 'rA', to: 'g1', pin: 0, x: 160 },
        { from: 'rB', to: 'g1', pin: 1, x: 170 },
        { from: 'g1', to: 'g2', pin: 0 },
        { from: 'rA', to: 'g3', pin: 0, x: 384 },
        { from: 'g2', to: 'g3', pin: 1 },
        { from: 'g3', to: 'rA', pin: 0, via: [[478, 120], [478, 282], [16, 282], [16, 80]] },
      ],
    },
    {
      id: 'direct', title: 'Direct register-to-register wire',
      nodes: [
        { id: 'r1', type: 'reg', name: 'Reg1', x: 60, y: 92 },
        { id: 'r2', type: 'reg', name: 'Reg2', x: 210, y: 92 },
        { id: 'g2', type: 'not', x: 335, y: 80 },
        { id: 'g1', type: 'and', x: 355, y: 190 },
        { id: 'g3', type: 'or', x: 460, y: 130 },
        { id: 'r3', type: 'reg', name: 'Reg3', x: 570, y: 142 },
      ],
      edges: [
        { from: 'r1', to: 'r2', pin: 0 },
        { from: 'r1', to: 'g1', pin: 1, x: 128 },
        { from: 'r2', to: 'g2', pin: 0 },
        { from: 'r2', to: 'g1', pin: 0, x: 280 },
        { from: 'g2', to: 'g3', pin: 0, x: 410 },
        { from: 'g1', to: 'g3', pin: 1, x: 420 },
        { from: 'g3', to: 'r3', pin: 0 },
      ],
    },
    {
      id: 'external', title: 'Outside input (not a register path)',
      nodes: [
        { id: 'in', type: 'in', name: 'in', x: 40, y: 50 },
        { id: 'r1', type: 'reg', name: 'Reg1', x: 70, y: 172 },
        { id: 'g1', type: 'not', x: 190, y: 160 },
        { id: 'g2', type: 'and', x: 290, y: 110 },
        { id: 'g3', type: 'and', x: 390, y: 170 },
        { id: 'g4', type: 'not', x: 475, y: 170 },
        { id: 'r2', type: 'reg', name: 'Reg2', x: 565, y: 182 },
      ],
      edges: [
        { from: 'in', to: 'g2', pin: 0, x: 236 },
        { from: 'r1', to: 'g1', pin: 0 },
        { from: 'g1', to: 'g2', pin: 1, x: 248 },
        { from: 'g2', to: 'g3', pin: 0, x: 340 },
        { from: 'r1', to: 'g3', pin: 1, via: [[136, 160], [136, 232], [352, 232], [352, 180]] },
        { from: 'g3', to: 'g4', pin: 0 },
        { from: 'g4', to: 'r2', pin: 0 },
      ],
      outLabel: 'r2',
    },
    {
      id: 'tworecv', title: 'Two receiving registers',
      nodes: [
        { id: 'r1', type: 'reg', name: 'Reg1', x: 60, y: 72 },
        { id: 'r2', type: 'reg', name: 'Reg2', x: 60, y: 202 },
        { id: 'g1', type: 'and', x: 200, y: 100 },
        { id: 'r3', type: 'reg', name: 'Reg3', x: 335, y: 112 },
        { id: 'g2', type: 'not', x: 196, y: 190 },
        { id: 'g3', type: 'or', x: 305, y: 210 },
        { id: 'g4', type: 'not', x: 400, y: 210 },
        { id: 'r4', type: 'reg', name: 'Reg4', x: 495, y: 222 },
      ],
      edges: [
        { from: 'r1', to: 'g1', pin: 0, x: 140 },
        { from: 'r2', to: 'g1', pin: 1, x: 150 },
        { from: 'g1', to: 'r3', pin: 0 },
        { from: 'r2', to: 'g2', pin: 0 },
        { from: 'g1', to: 'g3', pin: 0, x: 252 },
        { from: 'g2', to: 'g3', pin: 1, x: 236 },
        { from: 'g3', to: 'g4', pin: 0 },
        { from: 'g4', to: 'r4', pin: 0 },
      ],
    },
  ];

  function nodeGeom(node) {
    if (node.type === 'reg') {
      const g = regGeom(node.x, node.y);
      return { inPins: [g.d], out: g.q, g };
    }
    if (node.type === 'in') return { inPins: [], out: { x: node.x, y: node.y } };
    const s = gateShape(node.type, node.x, node.y);
    return { inPins: s.pins, out: s.out, shape: s };
  }

  function gateDisplayNames(tpl) {
    const counts = {};
    tpl.nodes.forEach((n) => { if (GATE[n.type]) counts[n.type] = (counts[n.type] || 0) + 1; });
    const seen = {};
    const names = {};
    tpl.nodes.forEach((n) => {
      if (n.type === 'reg' || n.type === 'in') { names[n.id] = n.name; return; }
      seen[n.type] = (seen[n.type] || 0) + 1;
      names[n.id] = n.type.toUpperCase() + (counts[n.type] > 1 ? seen[n.type] : '');
    });
    return names;
  }

  function solveTiming(inst) {
    const nodes = {};
    inst.nodes.forEach((n) => { nodes[n.id] = n; });
    const from = {};
    inst.edges.forEach((e) => { (from[e.from] = from[e.from] || []).push(e); });
    const names = inst.names || gateDisplayNames(inst);
    const paths = [];
    function dfs(id, trail, delay) {
      for (const e of from[id] || []) {
        const t = nodes[e.to];
        if (t.type === 'reg') paths.push({ fromId: trail[0], toId: t.id, gateIds: trail.slice(1), delay });
        else if (GATE[t.type]) dfs(t.id, trail.concat([t.id]), delay + inst.delays[t.type]);
      }
    }
    inst.nodes.filter((n) => n.type === 'reg').forEach((r) => dfs(r.id, [r.id], 0));
    const allPaths = paths.map((p) => {
      const src = inst.regs[p.fromId], dst = inst.regs[p.toId];
      return {
        from: names[p.fromId], to: names[p.toId], fromId: p.fromId, toId: p.toId,
        gates: p.gateIds.map((g) => names[g]), gateTypes: p.gateIds.map((g) => nodes[g].type),
        delay: p.delay, clkToQ: src.ctq, setup: dst.setup,
        setupTotal: src.ctq + p.delay + dst.setup, holdTotal: src.ctq + p.delay,
      };
    });
    let crit = null, short = null;
    for (const p of allPaths) {
      if (!crit || p.setupTotal > crit.setupTotal) crit = p;
      if (inst.askHoldFor && p.toId !== inst.askHoldFor) continue;
      if (!short || p.holdTotal < short.holdTotal) short = p;
    }
    const holdMaxByReg = {};
    for (const p of allPaths) holdMaxByReg[p.to] = Math.min(holdMaxByReg[p.to] == null ? Infinity : holdMaxByReg[p.to], p.holdTotal);
    return {
      tmin: crit.setupTotal,
      holdMax: short.holdTotal,
      criticalPath: [crit.from].concat(crit.gates, [crit.to]),
      shortestPath: [short.from].concat(short.gates, [short.to]),
      allPaths,
      holdMaxByReg,
    };
  }

  function timingSvg(inst, opts) {
    opts = opts || {};
    const names = inst.names || gateDisplayNames(inst);
    const geo = {};
    inst.nodes.forEach((n) => { geo[n.id] = nodeGeom(n); });
    const routes = inst.edges.map((e) => {
      const S = geo[e.from].out;
      const T = geo[e.to].inPins[e.pin || 0];
      let pts;
      if (e.via) pts = [S].concat(e.via.map(([x, y]) => ({ x, y })), [T]);
      else if (Math.abs(S.y - T.y) < 0.5) pts = [S, T];
      else { const mx = e.x != null ? e.x : (S.x + T.x) / 2; pts = [S, { x: mx, y: S.y }, { x: mx, y: T.y }, T]; }
      return { e, pts };
    });
    // junction dots where wires from the same source split
    const onSeg = (p, a, b) => {
      const minx = Math.min(a.x, b.x) - 0.5, maxx = Math.max(a.x, b.x) + 0.5, miny = Math.min(a.y, b.y) - 0.5, maxy = Math.max(a.y, b.y) + 0.5;
      if (p.x < minx || p.x > maxx || p.y < miny || p.y > maxy) return false;
      const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
      return Math.abs(cross) < 0.6 * Math.hypot(b.x - a.x, b.y - a.y) + 0.01;
    };
    const onPoly = (p, pts) => { for (let i = 0; i + 1 < pts.length; i++) if (onSeg(p, pts[i], pts[i + 1])) return true; return false; };
    const dots = [];
    const bySrc = {};
    routes.forEach((r) => { (bySrc[r.e.from] = bySrc[r.e.from] || []).push(r); });
    Object.values(bySrc).forEach((list) => {
      for (let i = 0; i < list.length; i++) {
        for (let j = 0; j < list.length; j++) {
          if (i === j) continue;
          const A = list[i].pts, Bp = list[j].pts;
          let last = A[0];
          let diverged = false;
          for (let s = 0; s + 1 < A.length && !diverged; s++) {
            const a = A[s], b = A[s + 1];
            const len = Math.hypot(b.x - a.x, b.y - a.y);
            for (let t = 0; t <= len; t += 1) {
              const p = { x: a.x + (b.x - a.x) * t / len, y: a.y + (b.y - a.y) * t / len };
              if (!onPoly(p, Bp)) { diverged = true; break; }
              last = p;
            }
          }
          if (diverged && Math.hypot(last.x - A[0].x, last.y - A[0].y) > 2) {
            // snap to a nearby vertex
            let snap = last;
            for (const v of A.concat(Bp)) if (Math.hypot(v.x - last.x, v.y - last.y) < 2.5) snap = v;
            if (!dots.some((d) => Math.hypot(d.x - snap.x, d.y - snap.y) < 2)) dots.push(snap);
          }
        }
      }
    });
    const parts = [];
    routes.forEach((r) => parts.push(polyline(r.pts)));
    dots.forEach((d) => parts.push(dot(d)));
    const TXT = 'fill="currentColor" font-family="system-ui,sans-serif"';
    inst.nodes.forEach((n) => {
      const g = geo[n.id];
      if (n.type === 'reg') {
        const r = g.g;
        const connectedIn = inst.edges.some((e) => e.to === n.id);
        const connectedOut = inst.edges.some((e) => e.from === n.id);
        parts.push('<rect x="' + fx(r.x0) + '" y="' + fx(r.y0) + '" width="' + REG_W + '" height="' + REG_H + '" ' + STROKE + ' style="fill:' + BG + '"/>');
        parts.push('<line x1="' + fx(r.d.x) + '" y1="' + fx(r.d.y) + '" x2="' + fx(r.x0) + '" y2="' + fx(r.d.y) + '" ' + STROKE + (connectedIn ? '' : ' stroke-opacity="0.45"') + '/>');
        parts.push('<line x1="' + fx(r.x0 + REG_W) + '" y1="' + fx(r.q.y) + '" x2="' + fx(r.q.x) + '" y2="' + fx(r.q.y) + '" ' + STROKE + (connectedOut ? '' : ' stroke-opacity="0.45"') + '/>');
        parts.push('<text x="' + fx(r.x0 + 5) + '" y="' + fx(r.d.y + 5) + '" font-size="14" ' + TXT + '>D</text>');
        parts.push('<text x="' + fx(r.x0 + REG_W - 5) + '" y="' + fx(r.q.y + 5) + '" font-size="14" text-anchor="end" ' + TXT + '>Q</text>');
        parts.push('<polyline points="' + fx(r.cx - 8) + ',' + fx(r.y0 + REG_H) + ' ' + fx(r.cx) + ',' + fx(r.y0 + REG_H - 11) + ' ' + fx(r.cx + 8) + ',' + fx(r.y0 + REG_H) + '" fill="none" ' + STROKE + '/>');
        parts.push('<line x1="' + fx(r.cx) + '" y1="' + fx(r.y0 + REG_H) + '" x2="' + fx(r.cx) + '" y2="' + fx(r.y0 + REG_H + 8) + '" ' + STROKE + '/>');
        parts.push('<text x="' + fx(r.cx) + '" y="' + fx(r.y0 + REG_H + 21) + '" font-size="11" text-anchor="middle" ' + TXT + ' fill-opacity="0.75">clk</text>');
        parts.push('<text x="' + fx(r.cx) + '" y="' + fx(r.y0 - 7) + '" font-size="16" font-weight="700" text-anchor="middle" ' + TXT + '>' + esc(n.name) + '</text>');
        if (inst.outLabel === n.id) parts.push('<text x="' + fx(r.q.x + 4) + '" y="' + fx(r.q.y + 5) + '" font-size="14" font-style="italic" ' + TXT + '>out</text>');
      } else if (n.type === 'in') {
        parts.push('<text x="' + fx(n.x - 6) + '" y="' + fx(n.y + 5) + '" font-size="15" font-style="italic" text-anchor="end" ' + TXT + '>' + esc(n.name) + '</text>');
        parts.push('<circle cx="' + fx(n.x) + '" cy="' + fx(n.y) + '" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/>');
      } else {
        parts.push(g.shape.svg);
        if (opts.labels) {
          const s = g.shape;
          parts.push('<text x="' + fx(s.cx) + '" y="' + fx(s.y0 - 5) + '" font-size="11.5" font-weight="700" text-anchor="middle" ' + TXT + '>' + names[n.id] + '</text>');
        }
      }
    });
    // view box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const grow = (x, y) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
    inst.nodes.forEach((n) => {
      if (n.type === 'reg') { const r = geo[n.id].g; grow(r.d.x, r.y0 - 24); grow(r.q.x + (inst.outLabel === n.id ? 30 : 0), r.y0 + REG_H + 24); }
      else if (n.type === 'in') { grow(n.x - 30, n.y - 12); grow(n.x, n.y + 12); }
      else { const s = geo[n.id].shape; grow(s.x0, s.y0 - (opts.labels ? 18 : 0)); grow(s.x0 + s.w, s.y0 + s.h); }
    });
    routes.forEach((r) => r.pts.forEach((p) => grow(p.x, p.y)));
    const M = 8;
    const vb = [minX - M, minY - M, maxX - minX + 2 * M, maxY - minY + 2 * M];
    const minW = Math.min(480, Math.round(vb[2] * 0.75));
    return '<div class="sds-swipe-hint small text-body-secondary">Swipe sideways to see the whole circuit.</div><div class="sds-timing-fig" style="overflow-x:auto;max-width:100%;"><svg viewBox="' + vb.map(fx).join(' ') + '" role="img" aria-label="register timing circuit" style="width:100%;min-width:' + minW + 'px;max-width:' + Math.round(vb[2] * 1.15) + 'px;height:auto;display:block;font-family:system-ui,sans-serif" xmlns="http://www.w3.org/2000/svg">' + parts.join('') + '</svg></div>';
  }

  function delayTableHtml(inst) {
    const u = inst.unit;
    const types = ['and', 'or', 'not'].filter((t) => inst.nodes.some((n) => n.type === t));
    const gateRows = types.map((t) => '<tr><td>' + t.toUpperCase() + ' gate delay</td><td class="text-end">' + inst.delays[t] + ' ' + u + '</td></tr>').join('');
    const regIds = inst.nodes.filter((n) => n.type === 'reg').map((n) => n.id);
    if (inst.uniform) {
      const r = inst.regs[regIds[0]];
      return '<table class="table table-sm table-bordered w-auto mb-2"><tbody>' + gateRows +
        '<tr><td>Register clk-to-q delay</td><td class="text-end">' + r.ctq + ' ' + u + '</td></tr>' +
        '<tr><td>Register setup time</td><td class="text-end">' + r.setup + ' ' + u + '</td></tr>' +
        '<tr><td>Register hold time</td><td class="text-end">' + r.hold + ' ' + u + '</td></tr></tbody></table>';
    }
    const head = '<tr><th>Register</th>' + regIds.map((id) => '<th class="text-end">' + esc(inst.regs[id].name) + '</th>').join('') + '</tr>';
    const row = (label, f) => '<tr><td>' + label + '</td>' + regIds.map((id) => '<td class="text-end">' + inst.regs[id][f] + ' ' + u + '</td>').join('') + '</tr>';
    return '<div class="d-flex flex-wrap gap-3 align-items-start">' +
      '<table class="table table-sm table-bordered w-auto mb-2"><tbody>' + gateRows + '</tbody></table>' +
      '<table class="table table-sm table-bordered w-auto mb-2"><thead>' + head + '</thead><tbody>' + row('clk-to-q', 'ctq') + row('setup', 'setup') + row('hold', 'hold') + '</tbody></table></div>';
  }

  const FMAX_PERIODS = [20, 25, 40, 50, 80, 100, 125, 200, 250, 500];
  function freqAnswer(T, unit) {
    // returns { value, unit } as an exact integer
    if (unit === 'ps') {
      if (1000 % T === 0) return { value: 1000 / T, unit: 'GHz' };
      return { value: 1e6 / T, unit: 'MHz' };
    }
    if (1000 % T === 0) return { value: 1000 / T, unit: 'MHz' };
    return { value: 1e6 / T, unit: 'kHz' };
  }

  function makeTimingInstance(tplId, rng, opts) {
    opts = opts || {};
    const tpl = TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) throw new Error('Unknown timing template ' + tplId);
    const ex = opts.difficulty === 'exam+';
    const unit = opts.unit || (rng.chance(0.7) ? 'ps' : 'ns');
    const small = unit === 'ns';
    const inst = {
      template: tpl.id, title: tpl.title, unit,
      nodes: tpl.nodes.map((n) => Object.assign({}, n)),
      edges: tpl.edges.map((e) => Object.assign({}, e)),
      outLabel: tpl.outLabel || null,
      delays: {}, regs: {}, uniform: !ex, askHoldFor: null,
    };
    inst.names = gateDisplayNames(inst);
    const rnd = (a, b) => rng.int(a, b);
    inst.delays = small ? { and: rnd(2, 9), or: rnd(2, 9), not: rnd(1, 6) } : { and: rnd(3, 25), or: rnd(3, 25), not: rnd(2, 15) };
    const base = small ? { ctq: rnd(2, 8), setup: rnd(2, 8), hold: rnd(1, 4) } : { ctq: rnd(8, 45), setup: rnd(5, 25), hold: rnd(2, 12) };
    inst.nodes.filter((n) => n.type === 'reg').forEach((n) => {
      inst.regs[n.id] = ex
        ? { name: n.name, ctq: Math.max(1, base.ctq + rnd(-2, 3) * (small ? 1 : 4)), setup: Math.max(1, base.setup + rnd(-2, 3) * (small ? 1 : 3)), hold: Math.max(1, base.hold + rnd(-1, 2)) }
        : { name: n.name, ctq: base.ctq, setup: base.setup, hold: base.hold };
    });
    if (opts.fmax) {
      const sol0 = solveTiming(inst);
      const okT = FMAX_PERIODS.filter((p) => p >= sol0.tmin && p - sol0.tmin <= Math.max(12, Math.round(sol0.tmin * 0.7)));
      if (!okT.length) return null;
      const T = rng.pick(okT.slice(0, 3));
      const delta = T - sol0.tmin;
      const dq = Math.floor(delta / 2);
      Object.values(inst.regs).forEach((r) => { r.ctq += dq; r.setup += delta - dq; });
    }
    const receivers = Array.from(new Set(solveTiming(inst).allPaths.map((p) => p.toId)));
    if (ex) inst.askHoldFor = rng.pick(receivers);
    inst.receivers = receivers;
    return inst;
  }

  const PRESETS = {
    pm15() {
      const tpl = TEMPLATES[0];
      const inst = {
        template: 'pm15', title: tpl.title, unit: 'ps',
        nodes: tpl.nodes.map((n) => Object.assign({}, n)), edges: tpl.edges.map((e) => Object.assign({}, e)),
        delays: { and: 5, or: 1, not: 6 }, regs: {}, uniform: true, askHoldFor: null,
      };
      inst.nodes.filter((n) => n.type === 'reg').forEach((n) => { inst.regs[n.id] = { name: n.name, ctq: 40, setup: 10, hold: 5 }; });
      inst.names = gateDisplayNames(inst);
      inst.receivers = ['r3', 'r4'];
      return inst;
    },
    disc7() {
      const tpl = TEMPLATES[1];
      const inst = {
        template: 'disc7', title: tpl.title, unit: 'ns',
        nodes: tpl.nodes.map((n) => Object.assign({}, n)), edges: tpl.edges.map((e) => Object.assign({}, e)),
        delays: { and: 5, or: 5, not: 5 }, uniform: false, askHoldFor: 'rC',
        regs: { rA: { name: 'RegA', ctq: 4, setup: 4, hold: 4 }, rB: { name: 'RegB', ctq: 4, setup: 4, hold: 4 }, rC: { name: 'RegC', ctq: 4, setup: 6, hold: 4 } },
      };
      inst.names = gateDisplayNames(inst);
      inst.receivers = ['rC'];
      return inst;
    },
  };

  /* ======================================================================
   * Styles (injected once by render functions)
   * ==================================================================== */

  function ensureStyles() {
    if (typeof document === 'undefined' || document.getElementById('sds-styles')) return;
    const st = document.createElement('style');
    st.id = 'sds-styles';
    st.textContent = [
      '.sds-ok{border-color:' + OK_COLOR + ' !important;background-color:#d1e7dd !important;color:#0a3622 !important;}',
      '.sds-bad{border-color:' + BAD_COLOR + ' !important;background-color:#f8d7da !important;color:#58151c !important;}',
      '.sds-warn{border-color:#e0a800 !important;background-color:#fff3cd !important;color:#664d03 !important;}',
      '.sds-fsm-box{box-shadow:0 0 0 2px var(--bs-body-bg,#fff);}',
      '.sds-fsm-box::placeholder{opacity:.55;}',
      '.sds-q .sds-io td,.sds-q .sds-io th{font-family:var(--bs-font-monospace,monospace);padding:.15rem .6rem;}',
      '.sds-q mark,.sds-sol mark{padding:0 .1em;border-radius:3px;}',
      '.sds-sol table{font-size:.92em;}',
      '.sds-sol .sds-box{border:2px solid currentColor;border-radius:8px;padding:.5rem .75rem;display:inline-block;margin:.25rem 0;}',
      '.sds-scroll{overflow-x:auto;max-width:100%;}',
      '.sds-q .form-check-label code{font-size:1em;}',
      '.sds-swipe-hint{display:none;}',
      '@media (max-width: 535.98px){.sds-swipe-hint{display:block;}}',
    ].join('\n');
    document.head.appendChild(st);
  }

  function setMark(el, kind) {
    if (!el) return;
    el.classList.remove('sds-ok', 'sds-bad', 'sds-warn');
    if (kind) el.classList.add(kind === 'ok' ? 'sds-ok' : kind === 'warn' ? 'sds-warn' : 'sds-bad');
  }

  /* ======================================================================
   * Question factory
   * ==================================================================== */

  function finishQuestion(q) {
    q.points = 2;
    let host = null;
    q.render = function (container) {
      ensureStyles();
      host = container;
      container.innerHTML = '<div class="sds-q">' + q.promptHtml(q._uid || (q._uid = uid('q'))) + '</div>';
    };
    q.grade = function () {
      if (!host) return { score: 0, correct: false, feedbackHtml: verdictHtml(0, false, 'Render the question first.') };
      const ans = q.readAnswer(host);
      const res = q.gradeAnswer(ans);
      q.applyMarks(host, res);
      return { score: res.score, correct: res.correct, feedbackHtml: res.feedbackHtml };
    };
    return q;
  }

  const LAWS_TABLE = [
    ['x*!x = 0', 'x+!x = 1', '(x*y)*z = x*(y*z)'],
    ['x*0 = 0', 'x+1 = 1', '(x+y)+z = x+(y+z)'],
    ['x*1 = x', 'x+0 = x', 'x*(y+z) = x*y+x*z'],
    ['x*x = x', 'x+x = x', 'x+y*z = (x+y)*(x+z)'],
    ['x*y = y*x', 'x+y = y+x', '!(x*y) = !x+!y'],
    ['x*y+x = x', '(x+y)*x = x', '!(x+y) = !x*!y'],
  ];
  function lawsTableHtml() {
    return '<table class="table table-sm table-bordered w-auto mb-2" style="font-size:.95em"><tbody>' +
      LAWS_TABLE.map((row) => '<tr>' + row.map((c) => '<td class="px-2">' + lawHtml(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  }

  const BOOL_RULES_TEXT = 'Use <code>+</code> for OR, <code>*</code> for AND, and <code>!</code> for NOT. Use parentheses as needed. Simplify as much as possible: full credit needs the minimum number of gates, where each 2-input AND, each 2-input OR, and each NOT counts as one gate. Each extra gate costs 0.5 points, but any correct expression earns at least 0.5 points. The order of terms and variables does not matter.';

  function boolInputHtml(id, label, placeholder) {
    return '<div class="input-group mb-2" style="max-width:520px"><span class="input-group-text font-monospace">' + label + '</span>' +
      '<input type="text" class="form-control font-monospace" id="' + id + '" data-sds-bool placeholder="' + esc(placeholder) + '" autocomplete="off" autocapitalize="off" spellcheck="false"></div>';
  }

  function boolFinalCheck(vars, circuitAst, answerAst, labelCircuit, dcTable) {
    const tc = dcTable || truthTable(circuitAst, vars);
    const ta = truthTable(answerAst, vars);
    return truthTableHtml(vars, [{ label: labelCircuit, values: tc }, { label: '<code>' + esc(exprStr(answerAst)) + '</code>', values: ta, compare: tc }]);
  }

  function makeBoolExpansionQuestion(kind, gen, meta) {
    const vars = gen.vars;
    const table = truthTable(gen.circuit, vars);
    const minG = minGates(table, vars);
    const fname = 'f(' + vars.join(', ') + ')';
    const q = {
      id: meta.id, topic: 'bool', kind, difficulty: meta.difficulty,
      title: kind === 'circuit' ? 'Boolean: circuit to minimal expression' : 'Boolean: simplify the expression',
      data: { vars, circuit: exprStr(gen.circuit), answer: exprStr(prettyOrder(gen.target)), minGates: minG, table },
      answerKey: exprStr(prettyOrder(gen.target)),
    };
    const ctx = { vars, table, minG };
    q.promptHtml = (u) => {
      let h = '';
      if (kind === 'circuit') {
        h += '<p class="mb-2">Here are some Boolean algebra laws:</p>' + lawsTableHtml();
        h += '<p class="mb-2">Write a Boolean expression for the circuit below.</p>';
        h += '<div class="mb-3">' + circuitSvg(gen.circuit, { vars }) + '</div>';
        h += '<p class="small mb-2">' + BOOL_RULES_TEXT + ' Please use the given variables in the image (' + vars.join(', ') + ').</p>';
      } else {
        h += '<p class="mb-2">Simplify this expression to the fewest gates possible:</p>';
        h += '<p class="fs-5 mb-3 ms-2">' + toMath(gen.circuit) + '</p>';
        h += '<p class="small mb-2">(A bar over something means NOT of it.) ' + BOOL_RULES_TEXT + '</p>';
      }
      h += boolInputHtml(u + '-ans', fname + ' =', kind === 'circuit' ? 'e.g. x((!y)+z)' : 'e.g. ' + vars[0] + '*(!' + vars[1] + '+' + vars[2] + ')');
      return h;
    };
    q.readAnswer = (host) => { const el = host.querySelector('[data-sds-bool]'); return el ? el.value : ''; };
    q.gradeAnswer = (ans) => gradeBoolAnswer(ans, ctx);
    q.applyMarks = (host, res) => setMark(host.querySelector('[data-sds-bool]'), res.mark);
    q.solutionHtml = () => {
      const steps = replaySimplification(gen);
      let h = '<div class="sds-sol">';
      if (meta.intro) h += meta.intro;
      if (kind === 'circuit') {
        h += '<h6 class="mt-2">Step 1. Read the circuit gate by gate</h6>';
        h += '<p class="mb-2">Number the gates from left to right and write the output of each one. Each input rail (' + vars.join(', ') + ') is tapped wherever you see a dot.</p>';
        h += '<div class="mb-2">' + circuitSvg(gen.circuit, { vars, numbers: true }) + '</div>';
        h += circuitReading(gen.circuit, vars);
        h += '<p>So <code>out = ' + exprStr(gen.circuit) + '</code>. That is ' + gateBreakdown(gen.circuit) + ', exactly what is drawn.</p>';
      } else {
        h += '<h6 class="mt-2">Step 1. Write it in typed form</h6>';
        h += '<p><code>' + exprStr(gen.circuit) + '</code>, which costs ' + gateBreakdown(gen.circuit) + '.</p>';
      }
      h += '<h6 class="mt-3">Step 2. Simplify, one law at a time</h6><ol class="ps-3">';
      for (const s of steps) {
        h += '<li class="mb-2"><strong>Use ' + lawHtml(s.rule.law) + '</strong> <span class="text-body-secondary">(' + s.rule.name + ')</span><br>' + s.why +
          '<div class="font-monospace mt-1 sds-scroll">' + s.before + '<br>= ' + s.after + '</div></li>';
      }
      h += '</ol>';
      h += '<h6 class="mt-3">Step 3. Count gates</h6>';
      const nice = prettyOrder(gen.target);
      if (exprStr(nice) !== exprStr(gen.target)) h += '<p class="mb-1">Reorder the terms (order does not matter) and you have:</p>';
      h += '<p><span class="sds-box"><code>' + fname + ' = ' + exprStr(nice) + '</code></span><br>This uses ' + gateBreakdown(nice) + '. ';
      h += 'A computer search over every possible expression confirms that no equivalent expression uses fewer than ' + plural(minG, 'gate') + ', so this earns full credit. Any expression with the same truth table and ' + plural(minG, 'gate') + ' is also fully correct.</p>';
      h += '<h6 class="mt-3">Check with a truth table</h6>';
      h += boolFinalCheck(vars, gen.circuit, nice, kind === 'circuit' ? 'circuit' : 'original');
      h += '</div>';
      return h;
    };
    return finishQuestion(q);
  }

  function deriveTruthTable(table, vars) {
    const dp = getDP(vars.length);
    const comps = completions(table).filter((m) => m !== 0 && m !== dp.FULL);
    if (!comps.length) return null;
    const minG = Math.min(...comps.map((m) => dp.cost[m]));
    let best = null;
    for (const m of comps) {
      if (dp.cost[m] !== minG) continue;
      const sop = minSOP(m, vars);
      if (!sop) continue;
      const steps = nSimplifySearch(sop.nary, minG, 8, 30000);
      if (!steps) continue;
      if (!best || steps.length < best.steps.length) best = { mask: m, sop, steps, minG };
    }
    return best;
  }

  function makeTruthTableQuestion(table, vars, meta) {
    const der = deriveTruthTable(table, vars);
    if (!der) throw new Error('no derivation');
    const minG = der.minG;
    const finalNary = der.steps.length ? der.steps[der.steps.length - 1].root : der.sop.nary;
    const finalAst = naryToBin(finalNary);
    const n = vars.length;
    const fname = 'f(' + vars.join(', ') + ')';
    const hasDC = table.some((v) => !isOne(v) && !isZero(v));
    const q = {
      id: meta.id, topic: 'bool', kind: 'truthtable', difficulty: meta.difficulty,
      title: 'Boolean: truth table to minimal expression',
      data: { vars, table, minGates: minG, answer: exprStr(finalAst) },
      answerKey: exprStr(finalAst),
    };
    const ctx = { vars, table, minG };
    q.promptHtml = (u) => {
      let h = '<p class="mb-2">Here is the truth table of ' + fname + '.' + (hasDC ? ' Rows marked X are <em>don\'t-cares</em>: f may be 0 or 1 there, whichever helps you.' : '') + ' Write an expression for f with the fewest gates.</p>';
      h += truthTableHtml(vars, [{ label: 'f', values: table }]);
      h += '<p class="small mb-2">' + BOOL_RULES_TEXT + '</p>';
      h += boolInputHtml(u + '-ans', fname + ' =', 'e.g. ' + vars[0] + '*!' + vars[1] + ' + ' + vars[2]);
      return h;
    };
    q.readAnswer = (host) => { const el = host.querySelector('[data-sds-bool]'); return el ? el.value : ''; };
    q.gradeAnswer = (ans) => gradeBoolAnswer(ans, ctx);
    q.applyMarks = (host, res) => setMark(host.querySelector('[data-sds-bool]'), res.mark);
    q.solutionHtml = () => {
      const m = der.mask;
      const rowName = (i) => vars.map((v, j) => v + '=' + ((i >> (n - 1 - j)) & 1)).join(', ');
      let h = '<div class="sds-sol">';
      let step = 1;
      if (hasDC) {
        const dcRows = [];
        table.forEach((v, i) => { if (!isOne(v) && !isZero(v)) dcRows.push(i); });
        h += '<h6 class="mt-2">Step ' + (step++) + '. Decide the don\'t-cares</h6><p>Pick each X as 0 or 1 to make the answer smallest. Here: ' +
          dcRows.map((i) => 'row <code>' + rowName(i) + '</code> as <strong>' + ((m >> i) & 1) + '</strong>').join(', ') + '.</p>';
      }
      const ones = [];
      for (let i = 0; i < (1 << n); i++) if ((m >> i) & 1) ones.push(i);
      const minterm = (i) => vars.map((v, j) => (((i >> (n - 1 - j)) & 1) ? v : '!' + v)).join('*');
      h += '<h6 class="mt-2">Step ' + (step++) + '. Sum of products</h6><p>Write one AND term for every row where f = 1 (use the variable if it is 1 in that row, its NOT if it is 0), then OR them together:</p>';
      h += '<div class="font-monospace sds-scroll mb-2">f = ' + ones.map(minterm).join(' + ') + '</div>';
      h += '<p class="small">That is correct but far from minimal.</p>';
      h += '<h6 class="mt-2">Step ' + (step++) + '. Merge rows that differ in one variable</h6>';
      h += '<p>If two rows with f = 1 differ in just one variable, that variable does not matter for them (because <code>a + !a = 1</code>), so their terms merge. Bigger groups of 4 rows drop two variables. The fewest groups that cover every 1:</p><ul>';
      der.sop.terms.forEach((t, k) => {
        const rows = [];
        for (let i = 0; i < (1 << n); i++) if ((t.rows >> i) & 1) rows.push(i);
        const free = vars.filter((_, j) => t.lits[j] === 2);
        const fixed = vars.map((v, j) => (t.lits[j] === 2 ? null : v + '=' + t.lits[j])).filter(Boolean);
        h += '<li>Rows ' + rows.map((i) => '<code>' + vars.map((_, j) => (i >> (n - 1 - j)) & 1).join('') + '</code>').join(', ') +
          ': ' + (fixed.length ? 'always ' + fixed.join(', ') : '') + (free.length ? ' while ' + free.join(' and ') + ' change' : '') +
          ', so the term is <code>' + nstr(der.sop.termNodes[k]) + '</code>.</li>';
      });
      h += '</ul><p>Minimal sum of products: <code>f = ' + nstr(der.sop.nary) + '</code> (' + plural(ngates(der.sop.nary), 'gate') + ').</p>';
      if (der.steps.length) {
        h += '<h6 class="mt-2">Step ' + (step++) + '. Factor and use De Morgan to save gates</h6><ol class="ps-3">';
        for (const s of der.steps) {
          const L = NLAW[s.rule];
          h += '<li class="mb-1"><strong>Use ' + lawHtml(L.law) + '</strong> <span class="text-body-secondary">(' + L.name + ')</span>. Rewrite <code>' + nstr(s.from) + '</code> as <code>' + nstr(s.to) + '</code>.<div class="font-monospace sds-scroll">f = ' + nstr(s.root) + '</div></li>';
        }
        h += '</ol>';
      }
      h += '<h6 class="mt-2">Answer</h6><p><span class="sds-box"><code>' + fname + ' = ' + exprStr(finalAst) + '</code></span><br>' + gateBreakdown(finalAst) + '. A computer search over every possible expression confirms ' + plural(minG, 'gate') + ' is the minimum.</p>';
      h += boolFinalCheck(vars, finalAst, finalAst, 'f (given)', table).replace('table-danger', '');
      h += '</div>';
      return h;
    };
    return finishQuestion(q);
  }

  function genTruthTableQuestion(rng, difficulty, meta) {
    const vars = ['A', 'B', 'C'];
    const ex = difficulty === 'exam+';
    for (let tries = 0; tries < 300; tries++) {
      const t = genTarget(rng, ex ? 3 : 2, ex ? 5 : 4, vars, ex ? { 3: 4, 4: 4, 5: 2 } : { 2: 3, 3: 4.5, 4: 2.5 });
      const table = truthTable(t, vars);
      if (ex) {
        const k = rng.int(1, 2);
        const rows = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, k);
        rows.forEach((r) => { table[r] = 'x'; });
      }
      const minG = minGates(table, vars);
      if (minG < 2) continue;
      const ones = table.filter(isOne).length;
      if (ones < 2 || ones > 6) continue;
      try {
        return makeTruthTableQuestion(table, vars, meta);
      } catch (e) { if (e.message !== 'no derivation') throw e; }
    }
    throw new Error('Could not generate a truth table question');
  }

  /* ---------------- FSM questions ---------------- */

  function randBits(rng, n) { let s = ''; for (let i = 0; i < n; i++) s += rng.chance(0.5) ? '1' : '0'; return s; }

  function fsmPromptText(fsm) {
    let h = '<p class="mb-2">This state machine processes a serial bit stream, reading one bit per clock cycle and producing one output bit per cycle. ';
    if (fsm.overlap) h += 'This state machine outputs a 1 whenever it detects the sequence <code>' + fsm.pattern + '</code>, and matches may overlap (the last bits of one match can be the first bits of the next match). Otherwise, it outputs 0.</p>';
    else h += 'This state machine outputs a 1 whenever it detects the exact non-overlapping sequence <code>' + fsm.pattern + '</code> (resetting back to state A after each match). Otherwise, it outputs 0.</p>';
    return h;
  }
  function examplesHtml(examples) {
    return '<p class="mb-1">Here are two example test cases:</p><table class="table table-sm table-bordered w-auto sds-io mb-3"><tbody>' +
      examples.map((ex) => '<tr><th>INPUT</th><td>' + ex.input + '</td></tr><tr><th>OUTPUT</th><td>' + ex.output + '</td></tr>').join('<tr><td colspan="2" class="p-0 border-0" style="height:6px"></td></tr>') + '</tbody></table>';
  }
  function makeExamples(rng, fsm) {
    const out = [];
    const L = fsm.pattern.length;
    const bl = borderLen(fsm.pattern);
    for (let k = 0; k < 2; k++) {
      const len = k === 0 ? 8 : 10;
      let pick = null;
      for (let t = 0; t < 400; t++) {
        const s = randBits(rng, len);
        const o = fsmRun(fsm, s);
        const matches = o.split('').filter((c) => c === '1').length;
        if (matches < 1) continue;
        if (matches * L > len + 2) continue;
        if (k === 1 && fsm.overlap && bl > 0 && t < 300) {
          // prefer an example that shows an overlapping match
          const hits = [];
          o.split('').forEach((c, i) => { if (c === '1') hits.push(i); });
          if (!hits.some((h, i) => i > 0 && h - hits[i - 1] < L)) continue;
        }
        if (out.some((e) => e.input === s)) continue;
        pick = { input: s, output: o };
        break;
      }
      if (!pick) { const s = fsm.pattern + randBits(rng, len - L); pick = { input: s, output: fsmRun(fsm, s) }; }
      out.push(pick);
    }
    return out;
  }
  function traceTableHtml(fsm, input, hlStep) {
    const rows = fsmTrace(fsm, input);
    return '<div class="sds-scroll"><table class="table table-sm table-bordered w-auto text-center mb-2"><thead><tr><th>Step</th><th>State</th><th>Input</th><th>Output</th><th>Next state</th></tr></thead><tbody>' +
      rows.map((r) => '<tr' + (r.out ? ' class="table-success"' : '') + '><td>' + r.step + '</td><td>' + r.state + '</td><td>' + r.bit + '</td><td><strong>' + r.out + '</strong></td><td>' + r.next + '</td></tr>').join('') + '</tbody></table></div>';
  }
  function fsmMeaningList(fsm) {
    return '<ul class="mb-2">' + fsm.states.map((s) => '<li><strong>' + s + '</strong>: ' + stateMeaning(fsm, s) + '</li>').join('') + '</ul>';
  }
  function fsmArrowTable(fsm) {
    return '<div class="sds-scroll"><table class="table table-sm table-bordered mb-2"><thead><tr><th>Arrow</th><th>Label</th><th>Why</th></tr></thead><tbody>' +
      fsmArrows(fsm).map((a) => '<tr><td class="text-nowrap">' + a.from + ' &rarr; ' + a.to + '</td><td class="font-monospace text-nowrap"><strong>' + a.label + '</strong></td><td>' + transitionReason(fsm, a.from, a.input) + '</td></tr>').join('') + '</tbody></table></div>';
  }

  function normLabel(s) { return String(s == null ? '' : s).replace(/\s+/g, ''); }

  function makeFsmLabelsQuestion(fsm, examples, meta) {
    const arrows = fsmArrows(fsm);
    const q = {
      id: meta.id, topic: 'fsm', kind: 'labels', difficulty: meta.difficulty,
      title: 'FSM: fill in the transition labels',
      data: { pattern: fsm.pattern, overlap: fsm.overlap, fsm, examples, arrows },
      answerKey: arrows.map((a) => a.label),
    };
    q.promptHtml = () => {
      let h = fsmPromptText(fsm) + examplesHtml(examples);
      h += '<p class="mb-2">The diagram shows every transition of the machine, but the labels are missing. In each box, type that transition\'s label as input/output (for example <code>0/0</code> or <code>1/0</code>).</p>';
      h += fsmDiagramHtml(fsm, { labels: 'inputs' }).html;
      return h;
    };
    q.readAnswer = (host) => arrows.map((_, i) => { const el = host.querySelector('[data-sds-arrow="' + i + '"]'); return el ? el.value : ''; });
    q.gradeAnswer = (ans) => {
      ans = ans || [];
      const marks = arrows.map(() => 'bad');
      const groups = {};
      arrows.forEach((a, i) => { const k = a.from + '>' + a.to; (groups[k] = groups[k] || []).push(i); });
      let right = 0;
      for (const idxs of Object.values(groups)) {
        const pool = idxs.map((i) => arrows[i].label);
        for (const i of idxs) {
          const typed = normLabel(ans[i]);
          const at = pool.indexOf(typed);
          if (at >= 0) { pool.splice(at, 1); marks[i] = 'ok'; right++; }
        }
      }
      const score = right / arrows.length;
      const correct = right === arrows.length;
      const body = right + ' of ' + arrows.length + ' labels are right. (' + pointsText(score, 2) + ')' + (correct ? '' : ' Red boxes are wrong. Remember: the label is <code>input/output</code>, and only the arrow that completes the pattern outputs 1.');
      return { score, correct, marks, feedbackHtml: verdictHtml(score, correct, body) };
    };
    q.applyMarks = (host, res) => arrows.forEach((_, i) => setMark(host.querySelector('[data-sds-arrow="' + i + '"]'), res.marks[i]));
    q.solutionHtml = () => {
      let h = '<div class="sds-sol">';
      if (meta.intro) h += meta.intro;
      h += '<h6 class="mt-2">Step 1. What each state remembers</h6>';
      h += '<p>A pattern detector for <code>' + fsm.pattern + '</code> uses one state per "how much of the pattern I have matched so far":</p>' + fsmMeaningList(fsm);
      h += '<h6 class="mt-2">Step 2. Label every arrow</h6>';
      h += '<p>Each state has exactly one arrow for input 0 and one for input 1. Find which arrow is which by asking "if I read this bit here, where do I end up?"</p>';
      h += fsmArrowTable(fsm);
      h += '<div class="my-2">' + fsmDiagramHtml(fsm, { labels: 'shown' }).html + '</div>';
      h += '<h6 class="mt-2">Step 3. Check with an example</h6><p>Trace the first example input <code>' + examples[0].input + '</code> from A:</p>';
      h += traceTableHtml(fsm, examples[0].input);
      h += '<p>The outputs read <code>' + fsmRun(fsm, examples[0].input) + '</code>, which matches the given OUTPUT <code>' + examples[0].output + '</code>.</p>';
      h += '</div>';
      return h;
    };
    return finishQuestion(q);
  }

  function makeFsmTraceQuestion(fsm, input, meta) {
    const expected = fsmRun(fsm, input);
    const q = {
      id: meta.id, topic: 'fsm', kind: 'trace', difficulty: meta.difficulty,
      title: 'FSM: trace the output',
      data: { pattern: fsm.pattern, overlap: fsm.overlap, fsm, input, expected },
      answerKey: expected,
    };
    q.promptHtml = (u) => {
      let h = '<p class="mb-2">This state machine reads one bit per clock cycle and writes one output bit per cycle. Each arrow is labeled <code>input/output</code>. It starts in state A.</p>';
      h += fsmDiagramHtml(fsm, { labels: 'shown' }).html;
      h += '<p class="mt-3 mb-2">What does it output for the input <code class="fs-6">' + input + '</code>? Type one output bit per input bit.</p>';
      h += '<div class="input-group mb-2" style="max-width:420px"><span class="input-group-text">OUTPUT</span><input type="text" class="form-control font-monospace" data-sds-trace id="' + u + '-trace" placeholder="' + input.length + ' bits" autocomplete="off" spellcheck="false" inputmode="numeric"></div>';
      return h;
    };
    q.readAnswer = (host) => { const el = host.querySelector('[data-sds-trace]'); return el ? el.value : ''; };
    q.gradeAnswer = (ans) => {
      const a = String(ans || '').replace(/\s+/g, '');
      let same = 0;
      for (let i = 0; i < expected.length; i++) if (a[i] === expected[i]) same++;
      const correct = a === expected;
      const score = correct ? 1 : (a.length === expected.length ? same / expected.length : 0);
      let body;
      if (correct) body = 'Every bit matches. (' + pointsText(1, 2) + ')';
      else if (!a.length) body = 'The answer box is empty.';
      else if (a.length !== expected.length) body = 'You typed ' + a.length + ' bits, but the input has ' + expected.length + '. Write exactly one output bit per input bit.';
      else {
        const first = Array.from(expected).findIndex((c, i) => a[i] !== c);
        body = same + ' of ' + expected.length + ' bits match. The first mismatch is at step ' + (first + 1) + '. (' + pointsText(score, 2) + ')';
      }
      return { score, correct, mark: correct ? 'ok' : 'bad', feedbackHtml: verdictHtml(score, correct, body) };
    };
    q.applyMarks = (host, res) => setMark(host.querySelector('[data-sds-trace]'), res.mark);
    q.solutionHtml = () => {
      let h = '<div class="sds-sol"><p>Start in A. For each input bit, find the arrow leaving the current state whose label starts with that bit. Write its output bit, then move along it.</p>';
      h += traceTableHtml(fsm, input);
      h += '<p>Answer: <span class="sds-box font-monospace">' + expected + '</span></p>';
      h += '<p class="small">Big picture: this machine detects ' + (fsm.overlap ? 'the sequence <code>' + fsm.pattern + '</code> with overlapping matches allowed' : 'the non-overlapping sequence <code>' + fsm.pattern + '</code>') + '. The rows in green are where the pattern was just completed.</p></div>';
      return h;
    };
    return finishQuestion(q);
  }

  function behaviorKey(fsm, maxLen) {
    // concatenated outputs on all inputs up to maxLen (enough to tell machines apart)
    let key = '';
    for (let len = 1; len <= maxLen; len++) {
      for (let i = 0; i < (1 << len); i++) {
        const s = i.toString(2).padStart(len, '0');
        key += fsmRun(fsm, s).slice(-1);
      }
    }
    return key;
  }
  function patternOptionText(p, overlap) {
    return 'Outputs 1 each time it sees <code>' + p + '</code> ' + (overlap ? '(matches may overlap)' : '(non-overlapping: back to A after each match)');
  }

  function makeFsmPatternQuestion(fsm, rng, meta) {
    const p = fsm.pattern;
    const L = p.length;
    const trueKey = behaviorKey(fsm, L + 4);
    const cands = [];
    const flip = (s, i) => s.slice(0, i) + (s[i] === '0' ? '1' : '0') + s.slice(i + 1);
    cands.push({ p, o: !fsm.overlap });
    cands.push({ p: p.split('').reverse().join(''), o: fsm.overlap });
    cands.push({ p: p.split('').map((c) => (c === '0' ? '1' : '0')).join(''), o: fsm.overlap });
    for (let i = 0; i < L; i++) cands.push({ p: flip(p, i), o: fsm.overlap }, { p: flip(p, i), o: !fsm.overlap });
    cands.push({ p: p.slice(1) + p[0], o: fsm.overlap });
    const seenKeys = new Set([trueKey]);
    const distract = [];
    for (const c of rng.shuffle(cands)) {
      const k = behaviorKey(buildDetector(c.p, c.o), L + 4);
      if (seenKeys.has(k)) continue;
      seenKeys.add(k);
      distract.push(c);
      if (distract.length === 3) break;
    }
    const options = rng.shuffle([{ p, o: fsm.overlap, right: true }].concat(distract));
    const answer = options.findIndex((o) => o.right);
    const q = {
      id: meta.id, topic: 'fsm', kind: 'pattern', difficulty: meta.difficulty,
      title: 'FSM: which pattern does it detect?',
      data: { pattern: p, overlap: fsm.overlap, fsm, options: options.map((o) => ({ pattern: o.p, overlap: o.o })) },
      answerKey: answer,
    };
    q.promptHtml = (u) => {
      let h = '<p class="mb-2">This state machine reads one bit per clock cycle and writes one output bit per cycle (labels are <code>input/output</code>, start in A). What does it detect?</p>';
      h += fsmDiagramHtml(fsm, { labels: 'shown' }).html;
      h += '<div class="mt-3">' + options.map((o, i) => '<div class="form-check mb-1"><input class="form-check-input" type="radio" name="' + u + '-mcq" id="' + u + '-o' + i + '" value="' + i + '" data-sds-mcq="' + i + '"><label class="form-check-label" for="' + u + '-o' + i + '">' + patternOptionText(o.p, o.o) + '</label></div>').join('') + '</div>';
      return h;
    };
    q.readAnswer = (host) => { const el = host.querySelector('[data-sds-mcq]:checked'); return el ? Number(el.value) : null; };
    q.gradeAnswer = (ans) => {
      const correct = ans === answer;
      const body = ans == null ? 'Pick one option.' : correct ? '(' + pointsText(1, 2) + ')' : 'Look for the arrow that outputs 1 and the chain of arrows from A that leads to it.';
      return { score: correct ? 1 : 0, correct, choice: ans, feedbackHtml: verdictHtml(correct ? 1 : 0, correct, body) };
    };
    q.applyMarks = (host, res) => {
      host.querySelectorAll('[data-sds-mcq]').forEach((el) => {
        const lab = el.nextElementSibling;
        if (!lab) return;
        lab.style.color = '';
        lab.style.fontWeight = '';
        const i = Number(el.value);
        if (i === answer && res.choice != null) { lab.style.color = OK_COLOR; lab.style.fontWeight = '600'; }
        else if (i === res.choice) lab.style.color = BAD_COLOR;
      });
    };
    q.solutionHtml = () => {
      const bl = borderLen(p);
      let h = '<div class="sds-sol">';
      h += '<p><strong>Find the arrow that outputs 1.</strong> Then walk from A along the arrows that move "forward" (A to B to C ...). The input bits on that walk, plus the bit on the output-1 arrow, spell the pattern: <code>' + p + '</code>.</p>';
      h += fsmMeaningList(fsm);
      h += '<p><strong>Overlapping or not?</strong> Look at where the output-1 arrow goes. ';
      if (bl === 0) h += 'It goes back to A. For <code>' + p + '</code> that is the same either way, because no ending of <code>' + p + '</code> is also a start of it, so overlapping and non-overlapping detection behave the same.';
      else if (fsm.overlap) h += 'It goes to ' + fsm.trans[fsm.states[L - 1]][Number(p[L - 1])].to + ', not A, so the machine keeps the ending <code>' + p.slice(L - bl) + '</code> of the match as the start of the next one. Matches may overlap.';
      else h += 'It goes back to A even though the ending <code>' + p.slice(L - bl) + '</code> could start a new match. So it resets after each match: non-overlapping.';
      h += '</p><p>Answer: <span class="sds-box">' + patternOptionText(p, fsm.overlap) + '</span></p>';
      h += fsmArrowTable(fsm) + '</div>';
      return h;
    };
    return finishQuestion(q);
  }

  /* ---------------- Timing questions ---------------- */

  function parseNumberAnswer(s) {
    const m = String(s == null ? '' : s).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : null;
  }

  function pathTableHtml(inst, sol) {
    const u = inst.unit;
    const rows = sol.allPaths.map((p) => {
      const nm = [p.from].concat(p.gates, [p.to]).join(' &rarr; ');
      const gd = p.gates.length ? p.gateTypes.map((t) => inst.delays[t]).join(' + ') : '0';
      const setupExpr = p.clkToQ + ' + ' + gd + ' + ' + p.setup + ' = <strong>' + p.setupTotal + '</strong>';
      const holdOk = !inst.askHoldFor || p.toId === inst.askHoldFor;
      const holdExpr = holdOk ? p.clkToQ + ' + ' + gd + ' = <strong>' + p.holdTotal + '</strong>' : '<span class="text-body-secondary">(not into ' + esc(inst.regs[inst.askHoldFor].name) + ')</span>';
      const tags = (p.setupTotal === sol.tmin ? ' <span class="badge text-bg-danger">longest</span>' : '') + (holdOk && p.holdTotal === sol.holdMax ? ' <span class="badge text-bg-primary">shortest</span>' : '');
      return '<tr><td class="text-nowrap">' + nm + tags + '</td><td class="text-nowrap">' + setupExpr + '</td><td class="text-nowrap">' + holdExpr + '</td></tr>';
    });
    return '<div class="sds-scroll"><table class="table table-sm table-bordered mb-2"><thead><tr><th>Register-to-register path</th><th>clk-to-q + gates + setup (' + u + ')</th><th>clk-to-q + gates (' + u + ')</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }

  function makeTimingQuestion(inst, withF, meta) {
    const sol = solveTiming(inst);
    const u = inst.unit;
    const freq = withF ? freqAnswer(sol.tmin, u) : null;
    const nParts = withF ? 3 : 2;
    const holdReg = inst.askHoldFor ? inst.regs[inst.askHoldFor].name : null;
    const q = {
      id: meta.id, topic: 'timing', kind: withF ? 'fmax' : 'tmin_hold', difficulty: meta.difficulty,
      title: withF ? 'Timing: period, hold time and max frequency' : 'Timing: minimum period and max hold time',
      data: { instance: inst, solution: sol, freq },
      answerKey: { tmin: sol.tmin, hold: sol.holdMax, fmax: freq ? freq.value : null, fmaxUnit: freq ? freq.unit : null },
    };
    let uidNow = 'q';
    const inputRow = (key, label, unit) => '<div class="input-group input-group-sm mb-2" style="max-width:300px"><span class="input-group-text">' + label + '</span><input type="text" class="form-control font-monospace" name="' + uidNow + '-' + key + '" data-sds-num="' + key + '" inputmode="numeric" autocomplete="off" placeholder="integer"><span class="input-group-text">' + unit + '</span></div>';
    q.promptHtml = (uidArg) => {
      uidNow = uidArg || 'q';
      let h = '<p class="mb-2">Consider the circuit below and the component delays in the table. Assume zero clock skew and that each listed delay is both the minimum and maximum delay of that component. Analyze all structural register-to-register paths in the circuit as drawn.</p>';
      h += '<div class="mb-2">' + timingSvg(inst) + '</div>';
      h += delayTableHtml(inst);
      h += '<p class="mb-1 mt-2"><strong>Part 1.</strong> What is the minimum clock period that satisfies the setup-time requirement for every register-to-register path?</p>';
      h += inputRow('tmin', 'T<sub>min</sub> =', u);
      h += '<p class="mb-1 mt-2"><strong>Part 2.</strong> Suppose the receiving register\'s hold-time requirement can be changed while all other timing values remain unchanged. What is the largest allowable hold time' + (holdReg ? ' for <strong>' + esc(holdReg) + '</strong>' : (inst.receivers && inst.receivers.length > 1 ? ' (one hold time shared by every register)' : '')) + '?</p>';
      h += inputRow('hold', 't<sub>hold,max</sub> =', u);
      if (withF) {
        h += '<p class="mb-1 mt-2"><strong>Part 3.</strong> What is the maximum clock frequency of this circuit? Answer in ' + freq.unit + ' (no calculator needed).</p>';
        h += inputRow('fmax', 'f<sub>max</sub> =', freq.unit);
      }
      return h;
    };
    q.readAnswer = (host) => {
      const get = (k) => { const el = host.querySelector('[data-sds-num="' + k + '"]'); return el ? el.value : ''; };
      return { tmin: get('tmin'), hold: get('hold'), fmax: get('fmax') };
    };
    q.gradeAnswer = (ans) => {
      ans = ans || {};
      const t = parseNumberAnswer(ans.tmin), hd = parseNumberAnswer(ans.hold), f = parseNumberAnswer(ans.fmax);
      const marks = { tmin: t === sol.tmin ? 'ok' : 'bad', hold: hd === sol.holdMax ? 'ok' : 'bad' };
      if (withF) marks.fmax = f === freq.value ? 'ok' : 'bad';
      const right = Object.values(marks).filter((m) => m === 'ok').length;
      const score = right / nParts;
      const correct = right === nParts;
      const bits = [];
      bits.push('Part 1 ' + (marks.tmin === 'ok' ? 'right' : 'wrong'));
      bits.push('Part 2 ' + (marks.hold === 'ok' ? 'right' : 'wrong'));
      if (withF) bits.push('Part 3 ' + (marks.fmax === 'ok' ? 'right' : 'wrong'));
      let tip = '';
      if (marks.tmin !== 'ok') tip += ' For T<sub>min</sub>, use the longest path: clk-to-q + gates + setup.';
      if (marks.hold !== 'ok') tip += ' For hold, use the shortest path and do not add setup: clk-to-q + gates.';
      return { score, correct, marks, feedbackHtml: verdictHtml(score, correct, bits.join(', ') + '. (' + pointsText(score, 2) + ')' + tip) };
    };
    q.applyMarks = (host, res) => Object.keys(res.marks).forEach((k) => setMark(host.querySelector('[data-sds-num="' + k + '"]'), res.marks[k]));
    q.solutionHtml = () => {
      let h = '<div class="sds-sol">';
      if (meta.intro) h += meta.intro;
      h += '<h6 class="mt-2">Step 1. List every register-to-register path</h6>';
      h += '<p>Start at each register\'s Q output and follow wires through gates until you reach a register\'s D input. Stop at registers. ';
      if (inst.nodes.some((n) => n.type === 'in')) h += 'The outside input <em>in</em> is not a register, so paths that start there do not count. ';
      if (sol.allPaths.some((p) => p.fromId === p.toId)) h += 'A path from a register back into itself (a feedback loop) counts like any other path. ';
      if (sol.allPaths.some((p) => p.gates.length === 0)) h += 'A plain wire from one register to another is a path with 0 gate delay. ';
      h += 'Gate names below match the labels in this picture:</p>';
      h += '<div class="mb-2">' + timingSvg(inst, { labels: true }) + '</div>';
      h += pathTableHtml(inst, sol);
      h += '<h6 class="mt-2">Step 2. Minimum period (setup)</h6>';
      h += '<p><span class="sds-box">T<sub>min</sub> = max over paths of (clk-to-q + combinational delay + setup)</span></p>';
      h += '<p>The longest path is ' + sol.criticalPath.join(' &rarr; ') + ', so <strong>T<sub>min</sub> = ' + sol.tmin + ' ' + u + '</strong>.' + (inst.uniform ? '' : ' Use the clk-to-q of the register where the path starts and the setup of the register where it ends.') + '</p>';
      h += '<h6 class="mt-2">Step 3. Largest hold time</h6>';
      h += '<p><span class="sds-box">t<sub>hold</sub> &le; clk-to-q + shortest combinational delay</span></p>';
      h += '<p>The new value must not change at the receiving register before its hold window ends, so the <em>fastest</em> path matters' + (holdReg ? ', and only paths that end at ' + esc(holdReg) + ' count' : '') + '. The shortest is ' + sol.shortestPath.join(' &rarr; ') + ', so <strong>t<sub>hold,max</sub> = ' + sol.holdMax + ' ' + u + '</strong>. Setup time plays no part here.</p>';
      if (withF) {
        h += '<h6 class="mt-2">Step 4. Maximum frequency</h6>';
        const sec = u === 'ps' ? '10<sup>-12</sup>' : '10<sup>-9</sup>';
        h += '<p>f<sub>max</sub> = 1 / T<sub>min</sub> = 1 / (' + sol.tmin + ' ' + u + ') = 1 / (' + sol.tmin + ' &times; ' + sec + ' s). ';
        if (u === 'ps') h += 'Trick: 1 / (1 ps) = 1000 GHz, so 1 / (' + sol.tmin + ' ps) = 1000/' + sol.tmin + ' GHz';
        else h += 'Trick: 1 / (1 ns) = 1000 MHz, so 1 / (' + sol.tmin + ' ns) = 1000/' + sol.tmin + ' MHz';
        if (freq.unit === 'GHz' || freq.unit === 'MHz' && u === 'ns') h += ' = <strong>' + freq.value + ' ' + freq.unit + '</strong>.</p>';
        else h += ' = ' + (1000 / sol.tmin) + ' ' + (u === 'ps' ? 'GHz' : 'MHz') + ' = <strong>' + freq.value + ' ' + freq.unit + '</strong>.</p>';
      }
      h += '</div>';
      return h;
    };
    return finishQuestion(q);
  }

  /* ---------------- makeQuestion / practiceQuestion ---------------- */

  const KINDS = { fsm: ['labels', 'trace', 'pattern'], timing: ['tmin_hold', 'fmax'], bool: ['circuit', 'simplify', 'truthtable'] };

  function makeQuestion(topic, opts) {
    opts = opts || {};
    if (!KINDS[topic]) throw new Error('Unknown topic ' + topic);
    const difficulty = opts.difficulty === 'exam+' ? 'exam+' : 'core';
    const kind = opts.kind || KINDS[topic][0];
    if (!KINDS[topic].includes(kind)) throw new Error('Unknown kind ' + kind + ' for ' + topic);
    const seed = opts.seed != null ? (Number(opts.seed) >>> 0) : Math.floor(Math.random() * 1e9);
    const rng = makeRng(hashStr(topic + '|' + kind + '|' + difficulty + '|' + seed));
    const meta = { id: topic + '-' + kind + '-' + seed + (difficulty === 'exam+' ? '-x' : ''), difficulty };
    const ex = difficulty === 'exam+';
    if (topic === 'fsm') {
      const L = ex ? rng.int(3, 4) : 3;
      let pattern = randBits(rng, L);
      if (ex && L === 4 && /^(0000|1111)$/.test(pattern)) pattern = randBits(rng, L);
      const fsm = buildDetector(pattern, rng.chance(0.5));
      if (kind === 'labels') return makeFsmLabelsQuestion(fsm, makeExamples(rng, fsm), meta);
      if (kind === 'trace') {
        let input = '';
        for (let t = 0; t < 200; t++) {
          input = randBits(rng, rng.int(10, 12));
          const out = fsmRun(fsm, input);
          const ones = out.split('').filter((c) => c === '1').length;
          if (ones >= 1 && ones <= 3) break;
        }
        return makeFsmTraceQuestion(fsm, input, meta);
      }
      return makeFsmPatternQuestion(fsm, rng, meta);
    }
    if (topic === 'timing') {
      const withF = kind === 'fmax';
      for (let t = 0; t < 200; t++) {
        const tpl = rng.pick(TEMPLATES).id;
        const inst = makeTimingInstance(tpl, rng, { difficulty, fmax: withF, unit: tpl === 'disc7' && rng.chance(0.6) ? 'ns' : undefined });
        if (!inst) continue;
        return makeTimingQuestion(inst, withF, meta);
      }
      throw new Error('Could not generate a timing question');
    }
    // bool
    if (kind === 'truthtable') return genTruthTableQuestion(rng, difficulty, meta);
    const vars = kind === 'simplify' && rng.chance(0.5) ? ['A', 'B', 'C'] : ['x', 'y', 'z'];
    const gen = genExpanded(rng, difficulty, vars);
    return makeBoolExpansionQuestion(kind, gen, meta);
  }

  function practiceQuestion(n) {
    n = Number(n);
    if (n === 4) {
      const fsm = buildDetector('000', false);
      const examples = [{ input: '00010010', output: '00100000' }, { input: '1000001010', output: '0001000000' }];
      const intro = '<p><strong>Practice Midterm 1, Question 4 (2 pts).</strong> The machine detects <code>000</code>, non-overlapping. Read the example: in <code>00010010</code> the first three 0s match, so the third output bit is 1, then the machine resets.</p>' +
        '<p>Fast method for this question: the arrows from A, B and C that move "forward" (A to B, B to C) are the pattern bits, so they are <code>0/0</code>. Every arrow back to A on a 1 is <code>1/0</code> (a 1 breaks a run of 0s). From C, a 0 finishes <code>000</code>: that arrow is <code>0/1</code>. A has a self loop for the 1s you skip: <code>1/0</code>. The two arrows from C to A are <code>0/1</code> and <code>1/0</code> (either order is accepted).</p>';
      return makeFsmLabelsQuestion(fsm, examples, { id: 'pm1-4', difficulty: 'core', intro });
    }
    if (n === 5) {
      const inst = PRESETS.pm15();
      const intro = '<p><strong>Practice Midterm 1, Question 5 (2 pts).</strong> Delays: AND 5, OR 1, NOT 6, clk-to-q 40, setup 10, hold 5 (all ps). Every register has the same numbers.</p>' +
        '<p>There are four register-to-register paths. Three of them tie for longest at 56 ps: Reg1 or Reg2 through AND and OR into Reg3 (40 + 5 + 1 + 10), and Reg3 through NOT into Reg4 (40 + 6 + 10). The shortest is Reg2 straight into the OR and then Reg3: 40 + 1 = 41 ps. Answers: 56 and 41.</p>';
      const q = makeTimingQuestion(inst, false, { id: 'pm1-5', difficulty: 'core', intro });
      return q;
    }
    if (n === 6) {
      const target = OR(NOT(V('y')), V('z'));
      const tgt = AND(V('x'), target);
      const S2 = OR(AND(NOT(V('y')), NOT(V('z'))), V('z'));
      const circuit = AND(V('x'), S2);
      normalizeDraw(circuit);
      normalizeDraw(tgt);
      const gen = {
        vars: ['x', 'y', 'z'], target: tgt, circuit,
        steps: [{ rule: RULES[0], S: target, S2, info: { p: S2.a, np: S2.b.b, q: S2.b.a } }],
      };
      const intro = '<p><strong>Practice Midterm 1, Question 6 (2 pts).</strong> The circuit computes <code>x*(!y*!z + z)</code>, which is 5 gates. The trick is the rule <code>x + !x*y = x + y</code> applied with <code>z</code> in the role of x: <code>z + !z*!y = z + !y</code>. The answer <code>x*(!y + z)</code> needs only 3 gates (NOT, OR, AND).</p>';
      return makeBoolExpansionQuestion('circuit', gen, { id: 'pm1-6', difficulty: 'core', intro });
    }
    throw new Error('practiceQuestion: n must be 4, 5 or 6');
  }

  /* ======================================================================
   * Public API
   * ==================================================================== */

  SDS.makeQuestion = makeQuestion;
  SDS.practiceQuestion = practiceQuestion;
  SDS.KINDS = KINDS;
  SDS.ensureStyles = ensureStyles;
  SDS.util = { esc, hashStr, makeRng, ovl };

  SDS.bool = {
    parse,
    gates: (ast) => gates(typeof ast === 'string' ? parse(ast) : ast),
    truthTable,
    minGates,
    minimalExpr,
    minimalAst,
    print: (ast) => exprStr(typeof ast === 'string' ? parse(ast) : ast),
    toMath: (ast) => toMath(typeof ast === 'string' ? parse(ast) : ast),
    lawHtml,
    lawsTableHtml,
    gateBreakdown: (ast) => gateBreakdown(typeof ast === 'string' ? parse(ast) : ast),
    equivalent: (a, b, vars) => {
      vars = vars || ['x', 'y', 'z'];
      const ta = truthTable(a, vars), tb = truthTable(b, vars);
      return ta.every((v, i) => v === tb[i]);
    },
    // Public renderers draw a tidied copy (plain variables on the top pin); the caller's AST is not changed.
    circuitSvg: (astOrString, opts) => circuitSvg(typeof astOrString === 'string' ? astOrString : normalizeDraw(clone(astOrString)), opts || {}),
    renderCircuit: (astOrString, container, opts) => {
      ensureStyles();
      container.innerHTML = circuitSvg(typeof astOrString === 'string' ? astOrString : normalizeDraw(clone(astOrString)), opts || {});
    },
    circuitReading: (astOrString, vars) => circuitReading(typeof astOrString === 'string' ? normalizeDraw(parse(astOrString)) : astOrString, vars),
    truthTableHtml,
    grade: (answer, ctx) => gradeBoolAnswer(answer, ctx),
    // internals exposed for tests and lessons
    _dp: getDP,
    _minSOP: minSOP,
    _deriveTruthTable: deriveTruthTable,
    _genExpanded: (seed, difficulty, vars) => genExpanded(makeRng(seed), difficulty, vars || ['x', 'y', 'z']),
    _replay: replaySimplification,
    _nary: { binToNary, naryToBin, nstr, ngates, ncanon },
  };

  SDS.fsm = {
    build: buildDetector,
    run: fsmRun,
    trace: fsmTrace,
    scan: patternScan,
    arrows: fsmArrows,
    layout: fsmLayout,
    diagramHtml: (fsm, opts) => fsmDiagramHtml(fsm, opts).html,
    traceTableHtml,
    renderDiagram: (fsm, container, opts) => {
      ensureStyles();
      container.innerHTML = fsmDiagramHtml(fsm, opts || {}).html;
    },
  };

  SDS.timing = {
    templates: TEMPLATES.map((t) => t.id),
    makeInstance: (tplId, seed, opts) => makeTimingInstance(tplId, makeRng(seed >>> 0), opts),
    presets: PRESETS,
    solve: solveTiming,
    circuitSvg: timingSvg,
    delayTableHtml,
    renderCircuit: (inst, container, opts) => {
      ensureStyles();
      opts = opts || {};
      container.innerHTML = '<div class="mb-2">' + timingSvg(inst, opts) + '</div>' + (opts.table === false ? '' : delayTableHtml(inst));
    },
    freqAnswer,
  };

  global.SDS = SDS;
  if (typeof module !== 'undefined' && module.exports) module.exports = SDS;
})(typeof window !== 'undefined' ? window : globalThis);
