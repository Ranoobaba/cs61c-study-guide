/* Tests for sds.js. Run with: node tests/sds.test.js (no dependencies). */
'use strict';

const path = require('path');
const fs = require('fs');
const SDS = require(path.join(__dirname, '..', 'sds.js'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  const t0 = Date.now();
  try {
    fn();
    passed++;
    console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)');
  } catch (e) {
    failed++;
    console.log('FAIL ' + name + '\n     ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n     ') : e));
  }
}
function eq(a, b, msg) {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) throw new Error((msg ? msg + ': ' : '') + 'expected ' + jb + ', got ' + ja);
}
function ok(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const XYZ = ['x', 'y', 'z'];
const B = SDS.bool;

/* ---------------- Practice exam reproductions ---------------- */

test('PM1.4: machine reproduces both example outputs', () => {
  const q = SDS.practiceQuestion(4);
  const fsm = q.data.fsm;
  eq(SDS.fsm.run(fsm, '00010010'), '00100000');
  eq(SDS.fsm.run(fsm, '1000001010'), '0001000000');
  // exam answer: A self loop 1/0, A->B 0/0, B->A 1/0, B->C 0/0, C->A 0/1 and 1/0
  const got = q.data.arrows.map((a) => a.from + '>' + a.to + ' ' + a.label).sort();
  eq(got, ['A>A 1/0', 'A>B 0/0', 'B>A 1/0', 'B>C 0/0', 'C>A 0/1', 'C>A 1/0'].sort());
  eq(q.gradeAnswer(q.answerKey).score, 1);
});

test('PM1.4: parallel C->A arrows accepted in either order, whitespace ignored', () => {
  const q = SDS.practiceQuestion(4);
  const idx = q.data.arrows.map((a, i) => (a.from === 'C' ? i : -1)).filter((i) => i >= 0);
  const ans = q.answerKey.slice();
  const t = ans[idx[0]]; ans[idx[0]] = ans[idx[1]]; ans[idx[1]] = t;
  ans[0] = ' ' + ans[0].replace('/', ' / ') + ' ';
  eq(q.gradeAnswer(ans).score, 1);
  const wrong = q.answerKey.slice();
  wrong[idx[0]] = '0/0';
  eq(q.gradeAnswer(wrong).score, 5 / 6);
  eq(q.gradeAnswer([]).score, 0);
});

test('PM1.5: T_min = 56 ps and t_hold,max = 41 ps', () => {
  const q = SDS.practiceQuestion(5);
  const sol = SDS.timing.solve(q.data.instance);
  eq(sol.tmin, 56);
  eq(sol.holdMax, 41);
  eq(sol.shortestPath, ['Reg2', 'OR', 'Reg3']);
  eq(sol.allPaths.length, 4);
  eq(q.gradeAnswer({ tmin: '56', hold: '41 ps' }).score, 1);
  eq(q.gradeAnswer({ tmin: '56', hold: '46' }).score, 0.5);
  eq(q.gradeAnswer({ tmin: '66', hold: '46' }).score, 0);
});

test('Disc 7 5.2: T_min = 25 ns (40 MHz) and RegC hold max = 14 ns', () => {
  const inst = SDS.timing.presets.disc7();
  const sol = SDS.timing.solve(inst);
  eq(sol.tmin, 25);
  eq(sol.holdMax, 14);
  eq(SDS.timing.freqAnswer(sol.tmin, 'ns'), { value: 40, unit: 'MHz' });
});

test('PM1.6: circuit equals x*(!y+z), minGates = 3, grading follows the exam rule', () => {
  const q = SDS.practiceQuestion(6);
  ok(B.equivalent(q.data.circuit, 'x*(!y+z)'), 'circuit not equivalent');
  eq(B.gates(q.data.circuit), 5);
  eq(B.minGates(B.truthTable(q.data.circuit, XYZ), XYZ), 3);
  for (const a of ['x*(!y+z)', 'x(!y+z)', 'x*(z+!y)', 'x((!y)+z)', "x(y'+z)", '~y*x + x*z']) {
    // the last one is 4 gates (NOT, AND, AND, OR): one extra gate
    const want = a === '~y*x + x*z' ? 0.75 : 1;
    eq(q.gradeAnswer(a).score, want, a);
  }
  // x*(!y*!z+z) is 5 gates, 2 more than the minimum: 1 - 0.25*2 = 0.5
  eq(q.gradeAnswer('x*(!y*!z+z)').score, 0.5);
  eq(q.gradeAnswer('x*y').score, 0);
  eq(q.gradeAnswer('x*(!y+').score, 0);
  // floor at 0.25 for any correct expression
  eq(q.gradeAnswer('!!!!x*(!!(!y+z))*!!x*x').score, 0.25);
});

/* ---------------- Parser ---------------- */

test('parser: precedence, juxtaposition, postfix NOT, friendly errors', () => {
  eq(B.print(B.parse('x + y z')), 'x+y*z');
  eq(B.print(B.parse('!x y')), '!x*y');
  eq(B.print(B.parse('(x+y)\'z')), '!(x+y)*z');
  eq(B.print(B.parse('~(x*y)')), '!(x*y)');
  eq(B.gates('xyz'), 2);
  eq(B.gates('!x!y'), 3);
  eq(B.gates('x\'\''), 2);
  const err = (s) => { try { B.parse(s); return null; } catch (e) { return e.message; } };
  eq(err('x*(y+z))'), "Unexpected ')' at position 8.");
  eq(err('x+'), 'The expression ends too early. Something is missing at the end.');
  eq(err('(x+y'), "Missing ')' to close the '(' at position 1.");
  eq(err(''), 'Type an expression first.');
  ok(/position 2/.test(err('x#y')), 'bad char');
  ok(/position 1/.test(err('+x')), 'leading +');
  ok(/Empty parentheses/.test(err('x()')), 'empty parens');
});

test('parser and printer agree on random formulas', () => {
  const rng = SDS.makeRng(99);
  const rand = (g) => {
    if (g === 0) return { type: 'var', name: rng.pick(XYZ) };
    if (rng.chance(0.3)) return { type: 'not', a: rand(g - 1) };
    const l = rng.int(0, g - 1);
    return { type: rng.chance(0.5) ? 'and' : 'or', a: rand(l), b: rand(g - 1 - l) };
  };
  for (let i = 0; i < 3000; i++) {
    const a = rand(rng.int(0, 8));
    const s = B.print(a);
    const b = B.parse(s);
    eq(B.gates(b), B.gates(a), s);
    eq(B.truthTable(b, XYZ), B.truthTable(a, XYZ), s);
  }
});

/* ---------------- Minimum gate count ---------------- */

// Slow, independent brute force: list the truth table of EVERY formula tree
// with exactly s gates (no de-duplication), for s = 0..6.
function bruteForceMinCosts(maxS) {
  const best = new Array(256).fill(Infinity);
  const F = [];
  F[0] = new Uint8Array([0xF0, 0xCC, 0xAA]);
  for (let s = 1; s <= maxS; s++) {
    let size = F[s - 1].length;
    for (let a = 0; a <= s - 1; a++) size += 2 * F[a].length * F[s - 1 - a].length;
    const arr = new Uint8Array(size);
    let k = 0;
    const prev = F[s - 1];
    for (let i = 0; i < prev.length; i++) arr[k++] = ~prev[i] & 0xFF;
    for (let a = 0; a <= s - 1; a++) {
      const A = F[a], Bb = F[s - 1 - a];
      for (let i = 0; i < A.length; i++) {
        const f = A[i];
        for (let j = 0; j < Bb.length; j++) { arr[k++] = f & Bb[j]; arr[k++] = f | Bb[j]; }
      }
    }
    F[s] = arr;
  }
  for (let s = maxS; s >= 0; s--) for (const f of F[s]) best[f] = s;
  return best;
}

test('minGates: hand-known functions', () => {
  const mg = (e) => B.minGates(B.truthTable(e, XYZ), XYZ);
  eq(mg('x'), 0);
  eq(mg('!x'), 1);
  eq(mg('x*y'), 1);
  eq(mg('x*!y + !x*y'), 4); // XOR: (x+y)*!(x*y) is 4 gates; the sum of products needs 5
  eq(mg('!x*!y'), 2); // !(x+y)
  eq(mg('x*!y*!z'), 3); // x*!(y+z)
  eq(mg('x*(!y*!z+z)'), 3);
  eq(B.minimalExpr(B.truthTable('x*!y + !x*y', XYZ), XYZ), '(x+y)*!(x*y)');
  // 2-variable and don't-care tables
  eq(B.minGates([0, 1, 1, 1], ['A', 'B']), 1);
  eq(B.minGates([0, 0, 0, 'x', 1, 1, 'x', 'x'], ['A', 'B', 'C']), 0); // completes to A
});

test('minGates DP matches a slow brute-force enumeration of all formulas (size <= 6)', () => {
  const brute = bruteForceMinCosts(6);
  const dp = B._dp(3);
  let checked = 0;
  for (let f = 0; f < 256; f++) {
    if (brute[f] <= 6) { eq(dp.cost[f], brute[f], 'function ' + f); checked++; }
    else ok(dp.cost[f] > 6, 'function ' + f + ' should need more than 6 gates');
    // and the DP's reconstructed expression really has that size and function
    const tbl = [];
    for (let i = 0; i < 8; i++) tbl.push((f >> i) & 1);
    const e = B.minimalExpr(tbl, XYZ);
    eq(B.gates(e), dp.cost[f], 'size of ' + e);
    eq(B.truthTable(e, XYZ), tbl, 'function of ' + e);
  }
  ok(checked > 200, 'checked ' + checked);
});

/* ---------------- FSM ---------------- */

// Independent brute-force pattern scan.
function scan(pattern, overlap, bits) {
  const out = [];
  let blockedUntil = -1;
  for (let i = 0; i < bits.length; i++) {
    let hit = false;
    if (i + 1 >= pattern.length) {
      const st = i + 1 - pattern.length;
      let same = true;
      for (let j = 0; j < pattern.length; j++) if (bits[st + j] !== pattern[j]) { same = false; break; }
      if (same && (overlap || st > blockedUntil)) { hit = true; blockedUntil = i; }
    }
    out.push(hit ? '1' : '0');
  }
  return out.join('');
}

for (const kind of ['labels', 'trace', 'pattern']) {
  test('FSM ' + kind + ': 500 seeds, machine output matches a brute-force scan of random 30-bit inputs', () => {
    const rng = SDS.makeRng(4242);
    let overlaps = 0;
    for (let seed = 0; seed < 500; seed++) {
      const difficulty = seed % 2 ? 'exam+' : 'core';
      const q = SDS.makeQuestion('fsm', { kind, seed, difficulty });
      const { fsm } = q.data;
      ok(/^[01]{3,4}$/.test(fsm.pattern), 'pattern ' + fsm.pattern);
      ok(difficulty === 'exam+' || fsm.pattern.length === 3, 'core uses length 3');
      eq(fsm.states, 'ABCD'.slice(0, fsm.pattern.length).split(''));
      if (fsm.overlap) overlaps++;
      for (let t = 0; t < 4; t++) {
        let bits = '';
        for (let i = 0; i < 30; i++) bits += rng.chance(0.5) ? '1' : '0';
        eq(SDS.fsm.run(fsm, bits), scan(fsm.pattern, fsm.overlap, bits), q.id + ' on ' + bits);
      }
      // one arrow per (state, input)
      eq(SDS.fsm.arrows(fsm).length, fsm.states.length * 2);
      if (kind === 'labels') {
        eq(q.data.examples.length, 2);
        ok(q.data.examples.some((e) => e.output.includes('1')), 'an example must contain a match');
        for (const e of q.data.examples) eq(e.output, scan(fsm.pattern, fsm.overlap, e.input), 'example');
        eq(q.gradeAnswer(q.answerKey).score, 1);
      }
      if (kind === 'trace') {
        ok(q.data.input.length >= 10 && q.data.input.length <= 12, 'trace length');
        eq(q.answerKey, scan(fsm.pattern, fsm.overlap, q.data.input));
        eq(q.gradeAnswer(q.answerKey).score, 1);
      }
      if (kind === 'pattern') {
        eq(q.data.options.length, 4);
        const right = q.data.options[q.answerKey];
        eq([right.pattern, right.overlap], [fsm.pattern, fsm.overlap]);
        // every distractor behaves differently from the real machine
        q.data.options.forEach((o, i) => {
          if (i === q.answerKey) return;
          const other = SDS.fsm.build(o.pattern, o.overlap);
          let differs = false;
          for (let n = 1; n <= 9 && !differs; n++) {
            for (let v = 0; v < (1 << n); v++) {
              const s = v.toString(2).padStart(n, '0');
              if (SDS.fsm.run(other, s) !== SDS.fsm.run(fsm, s)) { differs = true; break; }
            }
          }
          ok(differs, 'distractor ' + o.pattern + ' ' + o.overlap + ' is equivalent to the answer');
        });
        eq(q.gradeAnswer(q.answerKey).score, 1);
        eq(q.gradeAnswer((q.answerKey + 1) % 4).score, 0);
      }
    }
    ok(overlaps > 150 && overlaps < 350, 'mix of overlap modes: ' + overlaps);
  });
}

test('FSM: Disc 7 "detects 11" example output', () => {
  const fsm = SDS.fsm.build('11', true);
  eq(SDS.fsm.run(fsm, '011001001110'), '001000000110');
});

test('FSM: diagram layout keeps label boxes apart', () => {
  for (let seed = 0; seed < 200; seed++) {
    const q = SDS.makeQuestion('fsm', { kind: 'labels', seed, difficulty: seed % 2 ? 'exam+' : 'core' });
    const L = SDS.fsm.layout(q.data.fsm, { bw: 58, bh: 30 });
    const r = L.arrows.map((a) => ({ x1: a.lx - L.bw / 2, x2: a.lx + L.bw / 2, y1: a.ly - L.bh / 2, y2: a.ly + L.bh / 2 }));
    for (let i = 0; i < r.length; i++) {
      for (let j = i + 1; j < r.length; j++) {
        const ox = Math.min(r[i].x2, r[j].x2) - Math.max(r[i].x1, r[j].x1);
        const oy = Math.min(r[i].y2, r[j].y2) - Math.max(r[i].y1, r[j].y1);
        ok(!(ox > 0.5 && oy > 0.5), q.id + ' boxes ' + i + ' and ' + j + ' overlap');
      }
    }
  }
});

/* ---------------- Timing ---------------- */

// Independent brute force: enumerate paths with an explicit stack of partial paths.
function brutePaths(inst) {
  const type = {};
  inst.nodes.forEach((n) => { type[n.id] = n.type; });
  const out = [];
  const stack = inst.nodes.filter((n) => n.type === 'reg').map((n) => ({ at: n.id, path: [n.id], d: 0 }));
  while (stack.length) {
    const cur = stack.pop();
    for (const e of inst.edges) {
      if (e.from !== cur.at) continue;
      const t = type[e.to];
      if (t === 'reg') out.push({ from: cur.path[0], to: e.to, d: cur.d });
      else if (t === 'and' || t === 'or' || t === 'not') stack.push({ at: e.to, path: cur.path.concat([e.to]), d: cur.d + inst.delays[t] });
    }
  }
  return out;
}

test('timing: solve() matches brute-force path enumeration on random instances', () => {
  let n = 0;
  for (const tpl of SDS.timing.templates) {
    for (let seed = 0; seed < 60; seed++) {
      for (const difficulty of ['core', 'exam+']) {
        const inst = SDS.timing.makeInstance(tpl, seed * 7 + 1, { difficulty });
        const sol = SDS.timing.solve(inst);
        const paths = brutePaths(inst);
        eq(sol.allPaths.length, paths.length, tpl + ' path count');
        let tmin = -Infinity, hold = Infinity;
        for (const p of paths) {
          tmin = Math.max(tmin, inst.regs[p.from].ctq + p.d + inst.regs[p.to].setup);
          if (!inst.askHoldFor || p.to === inst.askHoldFor) hold = Math.min(hold, inst.regs[p.from].ctq + p.d);
        }
        eq(sol.tmin, tmin, tpl + ' tmin');
        eq(sol.holdMax, hold, tpl + ' hold');
        if (difficulty === 'exam+') ok(inst.askHoldFor, 'exam+ names a receiving register');
        n++;
      }
    }
  }
  ok(n >= 6 * 120, 'instances: ' + n);
});

test('timing: template traps behave as intended', () => {
  const direct = SDS.timing.makeInstance('direct', 3, { difficulty: 'core' });
  eq(SDS.timing.solve(direct).holdMax, direct.regs.r1.ctq, 'direct wire: hold max = clk-to-q');
  const ext = SDS.timing.makeInstance('external', 3, { difficulty: 'core' });
  ok(SDS.timing.solve(ext).allPaths.every((p) => p.from !== 'in'), 'outside input ignored');
  const fb = SDS.timing.makeInstance('feedback', 3, { difficulty: 'core' });
  ok(SDS.timing.solve(fb).allPaths.some((p) => p.fromId === 'rA' && p.toId === 'rA'), 'feedback path counted');
  eq(SDS.timing.templates.length >= 6, true);
});

test('timing fmax: periods come from the calculator-free list and the frequency is an integer', () => {
  const allowed = [20, 25, 40, 50, 80, 100, 125, 200, 250, 500];
  for (let seed = 0; seed < 300; seed++) {
    const q = SDS.makeQuestion('timing', { kind: 'fmax', seed, difficulty: seed % 2 ? 'exam+' : 'core' });
    ok(allowed.includes(q.answerKey.tmin), 'tmin ' + q.answerKey.tmin);
    ok(Number.isInteger(q.answerKey.fmax), 'fmax ' + q.answerKey.fmax);
    const u = q.data.instance.unit;
    const T = q.answerKey.tmin * (u === 'ps' ? 1e-12 : 1e-9);
    const scale = { GHz: 1e9, MHz: 1e6, kHz: 1e3 }[q.answerKey.fmaxUnit];
    ok(Math.abs(1 / T / scale - q.answerKey.fmax) < 1e-6, 'frequency arithmetic');
    eq(q.gradeAnswer({ tmin: String(q.answerKey.tmin), hold: String(q.answerKey.hold), fmax: String(q.answerKey.fmax) }).score, 1);
    const prompt = q.promptHtml('uid-7');
    const units = (prompt.match(/input-group-text">([^<]*)<\/span><\/div>/g) || []).map((m) => m.replace(/.*">|<.*/g, ''));
    eq(units, [u, u, q.answerKey.fmaxUnit], 'unit labels next to the answer boxes');
    ok(Math.abs(q.gradeAnswer({ tmin: String(q.answerKey.tmin), hold: 'x', fmax: '' }).score - 1 / 3) < 1e-9, 'thirds');
  }
});

/* ---------------- Boolean generators ---------------- */

test('bool: every generated question has a minimal answer that grades 1.0 (and steps are valid)', () => {
  let count = 0;
  for (const kind of ['circuit', 'simplify', 'truthtable']) {
    for (const difficulty of ['core', 'exam+']) {
      for (let seed = 0; seed < 120; seed++) {
        const q = SDS.makeQuestion('bool', { kind, seed, difficulty });
        const { vars, table, minGates } = q.data;
        eq(q.gradeAnswer(q.answerKey).score, 1, q.id + ' answer key');
        eq(B.gates(q.answerKey), minGates, q.id + ' key is minimal');
        eq(q.gradeAnswer(B.minimalExpr(table, vars)).score, 1, q.id + ' DP expression');
        ok(minGates >= 2 && minGates <= 5, q.id + ' min gates ' + minGates);
        ok(!table.every((v) => v === 1) && !table.every((v) => v === 0), 'not constant');
        if (kind !== 'truthtable') {
          const g = B.gates(q.data.circuit);
          const [lo, hi] = difficulty === 'exam+' ? [5, 8] : [4, 7];
          ok(g >= lo && g <= hi, q.id + ' circuit gates ' + g);
          ok(g >= minGates + 2, q.id + ' circuit must be at least 2 above the minimum');
          ok(B.equivalent(q.data.circuit, q.answerKey, vars), q.id + ' circuit vs answer');
        }
        const html = q.solutionHtml();
        ok(html.length > 200, 'solution text');
        count++;
      }
    }
  }
  ok(count === 720, 'count ' + count);
});

test('bool: each simplification step in a solution keeps the same truth table', () => {
  for (let seed = 0; seed < 150; seed++) {
    for (const d of ['core', 'exam+']) {
      const gen = B._genExpanded(seed + 1, d, XYZ);
      const target = B.truthTable(gen.target, XYZ);
      const before = B.print(gen.circuit);
      const steps = B._replay(gen);
      eq(B.print(gen.circuit), before, 'replay must restore the circuit');
      for (const s of steps) eq(B.truthTable(s.expr, XYZ), target, 'step ' + s.rule.id);
      eq(B.gates(steps[steps.length - 1].expr), B.gates(gen.target));
    }
  }
});

test('bool: truth-table derivations are valid law by law', () => {
  for (let seed = 0; seed < 150; seed++) {
    const q = SDS.makeQuestion('bool', { kind: 'truthtable', seed, difficulty: seed % 2 ? 'exam+' : 'core' });
    const der = B._deriveTruthTable(q.data.table, q.data.vars);
    const N = B._nary;
    const want = [];
    for (let i = 0; i < 8; i++) want.push((der.mask >> i) & 1);
    eq(B.truthTable(N.nstr(der.sop.nary), q.data.vars), want, 'SOP');
    for (const s of der.steps) eq(B.truthTable(N.nstr(s.root), q.data.vars), want, 'step');
    q.data.table.forEach((v, i) => { if (v === 0 || v === 1) eq(want[i], v, 'care rows'); });
  }
});

test('bool: grading rules (extra gates, floor, not-equivalent, bad syntax, other letter case)', () => {
  const ctx = { vars: XYZ, table: B.truthTable('x*(!y+z)', XYZ), minG: 3 };
  eq(B.grade('x*(!y+z)', ctx).score, 1);
  eq(B.grade('x*!y + x*z', ctx).score, 0.75);
  eq(B.grade('x*(!y*!z+z)', ctx).score, 0.5);
  eq(B.grade('!!x*(!y*!z+z)', ctx).score, 0.25);
  eq(B.grade('!!!!x*(!y*!z+z)', ctx).score, 0.25);
  eq(B.grade('x', ctx).score, 0);
  eq(B.grade('x*(!q+z)', ctx).score, 0);
  eq(B.grade('', ctx).score, 0);
  eq(B.grade('X*(!Y+Z)', ctx).score, 1);
});

test('determinism: the same seed gives the same question', () => {
  for (const [topic, kinds] of Object.entries(SDS.KINDS)) {
    for (const kind of kinds) {
      for (const difficulty of ['core', 'exam+']) {
        const a = SDS.makeQuestion(topic, { kind, seed: 77, difficulty });
        const b = SDS.makeQuestion(topic, { kind, seed: 77, difficulty });
        eq(a.id, b.id);
        eq(JSON.stringify(a.answerKey), JSON.stringify(b.answerKey));
        eq(a.promptHtml('u'), b.promptHtml('u'));
        ok(a.points === 2 && typeof a.render === 'function' && typeof a.grade === 'function' && typeof a.solutionHtml === 'function', 'interface');
        ok(a.id.startsWith(topic + '-' + kind + '-77'), a.id);
      }
    }
  }
});

test('no em dash characters in the deliverables', () => {
  const root = path.join(__dirname, '..');
  for (const f of ['sds.js', 'sds-lessons.js', 'sds-demo.html', 'tests/sds.test.js']) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    const txt = fs.readFileSync(p, 'utf8');
    ok(!txt.includes(String.fromCharCode(0x2014)), f + ' contains an em dash');
  }
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
