/* sds-lessons.js
 * Beginner lessons for the digital logic part of CS61C MT1:
 * finite state machines, register timing, and Boolean algebra.
 *
 * Sets window.SDS_LESSONS = { fsm: [...], timing: [...], bool: [...] }.
 * Each section is { title, html, demo? }. demo(container) draws an example
 * with the renderers in sds.js, so load sds.js before this file.
 */
(function (global) {
  'use strict';

  // Overline for NOT, inline so it works without any page CSS.
  const ov = (s) => '<span style="display:inline-block;border-top:1.6px solid currentColor;padding-top:1px;line-height:1.15;margin:0 .07em">' + s + '</span>';
  const box = (html) => '<div style="border:2px solid currentColor;border-radius:8px;padding:.55rem .85rem;display:inline-block;margin:.35rem 0">' + html + '</div>';
  const tip = (html) => '<div class="alert alert-info py-2 small mb-2">' + html + '</div>';
  const warn = (html) => '<div class="alert alert-warning py-2 small mb-2">' + html + '</div>';
  const S = () => global.SDS;

  /* ====================================================================
   * Finite state machines
   * ================================================================== */

  const fsm = [
    {
      title: 'What a state machine is',
      html:
        '<p>A <strong>finite state machine</strong> (FSM) is a small circuit with a memory. On every clock cycle it reads <strong>one input bit</strong> and writes <strong>one output bit</strong>.</p>' +
        '<p>Its memory is called the <strong>state</strong>. The best way to think about a state is: <em>"what I remember so far"</em> about the bits I have already seen.</p>' +
        '<p>Example: say you want to output 1 whenever you have just seen three 0s in a row. You do not need to remember every bit. You only need to know how many 0s in a row you have right now: none, one, or two. So three states are enough:</p>' +
        '<ul><li><strong>A</strong>: no 0s in a row yet</li><li><strong>B</strong>: the last bit was <code>0</code></li><li><strong>C</strong>: the last two bits were <code>00</code></li></ul>' +
        '<p>The machine begins in the state with the <strong>start</strong> arrow (always A in this course). In hardware, the state lives in a register, and gates compute the next state and the output.</p>',
    },
    {
      title: 'Reading the labels: input/output',
      html:
        '<p>Each arrow is labeled <code>input/output</code>. For example, <code>0/1</code> on an arrow from C to A means:</p>' +
        box('If I am in <strong>C</strong> and the input bit is <strong>0</strong>, then output <strong>1</strong> this cycle and move to <strong>A</strong>.') +
        '<ul class="mt-2"><li>Every state has exactly <strong>one arrow for input 0</strong> and <strong>one arrow for input 1</strong>. So every state has exactly 2 arrows leaving it.</li>' +
        '<li>An arrow can loop back to the same state (a <strong>self loop</strong>), and both arrows can go to the same state (two separate arrows, like C to A below).</li>' +
        '<li>The output belongs to the <strong>arrow</strong> you take, not to the state.</li></ul>' +
        '<p>Here is the machine from Practice Midterm 1, Question 4, which outputs 1 after the non-overlapping sequence <code>000</code>:</p>',
      demo: (c) => {
        S().fsm.renderDiagram(S().fsm.build('000', false), c, { labels: 'shown' });
        c.insertAdjacentHTML('beforeend', '<p class="small mt-2 mb-0">Read it: in A, a <code>1</code> keeps you in A (self loop <code>1/0</code>), a <code>0</code> moves you to B (<code>0/0</code>). In C, a <code>0</code> finishes <code>000</code>, so that arrow says <code>0/1</code>.</p>');
      },
    },
    {
      title: 'Tracing step by step',
      html:
        '<p>To find the output for an input string, use a table. Start in A. For each input bit:</p>' +
        '<ol><li>Look at the 2 arrows leaving the current state. Pick the one whose label starts with the input bit.</li>' +
        '<li>Write that arrow\'s output bit.</li><li>Move to where the arrow points.</li></ol>' +
        '<p>Here is the trace of <code>00010010</code> through the <code>000</code> machine above. The output column reads <code>00100000</code>, exactly the example from the exam.</p>',
      demo: (c) => {
        const m = S().fsm.build('000', false);
        c.innerHTML = S().fsm.traceTableHtml(m, '00010010') +
          '<p class="small mb-2">Discussion 7 asked: what does this machine detect, and what does it output for <code>011001001110</code>?</p>';
        const d = document.createElement('div');
        c.appendChild(d);
        const m2 = S().fsm.build('11', true);
        S().fsm.renderDiagram(m2, d, { labels: 'shown' });
        c.insertAdjacentHTML('beforeend', '<p class="small mt-2 mb-0">It outputs 1 whenever the last two bits were <code>11</code>. Tracing gives <code>' + S().fsm.run(m2, '011001001110') + '</code>. Notice <code>111</code> gives two 1s in a row: the middle 1 is used by both matches (overlapping).</p>');
      },
    },
    {
      title: 'Building a pattern detector',
      html:
        '<p>A detector for a pattern of length L uses L states. Each state means "how much of the pattern I have matched so far": A = nothing, B = the first bit, C = the first two bits, D = the first three bits.</p>' +
        '<p><strong>Forward arrows.</strong> From the state that has matched k bits, the next pattern bit moves you one state forward with output 0. From the last state, the final pattern bit completes the match: that arrow has output <strong>1</strong>.</p>' +
        '<p><strong>Wrong-bit arrows.</strong> When the bit does not continue the pattern, ask: <em>of the bits I have just seen, what is the longest ending that is still a beginning of the pattern?</em> Go to the state for that many bits, with output 0. Often that is A, but not always.</p>' +
        '<p>Worked example: pattern <code>010</code>, overlapping allowed.</p>' +
        '<ul>' +
        '<li><strong>A</strong> (nothing): <code>0</code> starts the pattern, go to B (<code>0/0</code>). <code>1</code> cannot start <code>010</code>, stay in A (<code>1/0</code>).</li>' +
        '<li><strong>B</strong> (seen <code>0</code>): <code>1</code> continues, go to C (<code>1/0</code>). <code>0</code> gives <code>00</code>; its ending <code>0</code> is a fresh start, so stay in B (<code>0/0</code>).</li>' +
        '<li><strong>C</strong> (seen <code>01</code>): <code>0</code> completes <code>010</code>: output 1. The last <code>0</code> can start the next match, so go to B (<code>0/1</code>). <code>1</code> gives <code>011</code>, and no ending of it starts with 0, so go to A (<code>1/0</code>).</li>' +
        '</ul>',
      demo: (c) => S().fsm.renderDiagram(S().fsm.build('010', true), c, { labels: 'shown' }),
    },
    {
      title: 'Overlapping vs non-overlapping',
      html:
        '<p><strong>Overlapping</strong> means the bits of one match can be reused by the next match. <strong>Non-overlapping</strong> means each bit belongs to at most one match. The exam says it like this: <em>"the exact non-overlapping sequence 000 (resetting back to state A after each match)"</em>.</p>' +
        '<div class="table-responsive"><table class="table table-sm table-bordered w-auto font-monospace text-center"><thead><tr><th>input</th><th>overlapping 000</th><th>non-overlapping 000</th></tr></thead>' +
        '<tbody><tr><td>0000</td><td>0011</td><td>0010</td></tr><tr><td>000000</td><td>001111</td><td>001001</td></tr></tbody></table></div>' +
        '<p>Only <strong>one arrow</strong> changes between the two versions: the arrow that completes the match.</p>' +
        '<ul><li>Non-overlapping: it always goes back to <strong>A</strong>.</li>' +
        '<li>Overlapping: it goes to the state for the longest ending of the pattern that is also a beginning of it. For <code>000</code> that ending is <code>00</code>, so it goes to C. For <code>011</code> no ending works, so it goes to A and both versions are the same machine.</li></ul>' +
        '<p>The overlapping <code>000</code> machine (compare with the non-overlapping one above: only C on 0 changed):</p>',
      demo: (c) => S().fsm.renderDiagram(S().fsm.build('000', true), c, { labels: 'shown' }),
    },
    {
      title: 'Checklist for the fill-in-the-labels question',
      html:
        '<ol>' +
        '<li>Read the pattern and whether matches may overlap.</li>' +
        '<li>Name the states: A = nothing, B = first bit, C = first two bits, and so on.</li>' +
        '<li>Label the forward arrows (A to B, B to C, ...) with the pattern bit and output 0, like <code>0/0</code>.</li>' +
        '<li>The arrow out of the last state on the last pattern bit is the <strong>only</strong> arrow with output 1. Non-overlapping: it goes to A.</li>' +
        '<li>Every other arrow has output 0. Since each state has one 0-arrow and one 1-arrow, once you know one arrow of a state, the other one uses the opposite bit.</li>' +
        '<li>Two arrows between the same two states (like C to A twice): one starts with 0, the other with 1. Either box order is accepted.</li>' +
        '<li>Check: run the given example inputs through your labels and compare with the given outputs.</li>' +
        '</ol>' +
        tip('Count to be sure: there are 2 &times; (number of states) arrows, and a pattern detector has exactly one <code>?/1</code> arrow.'),
    },
    {
      title: 'Common mistakes',
      html:
        '<ul>' +
        '<li>Writing <code>output/input</code>. The label is <code>input/output</code>.</li>' +
        '<li>Putting the 1 on the wrong arrow or one bit late. The 1 is output on the same cycle as the last pattern bit is read.</li>' +
        '<li>Forgetting that a wrong bit does not always send you to A. For <code>010</code>, B on <code>0</code> stays in B, because that new 0 is a fresh start.</li>' +
        '<li>Mixing up the overlap rule. Non-overlapping goes to A after a match even if the end of the match could start a new one.</li>' +
        '<li>In a trace, using the next state to pick the output. The output comes from the arrow you take out of the <em>current</em> state.</li>' +
        '</ul>',
    },
  ];

  /* ====================================================================
   * Register timing
   * ================================================================== */

  const timingDiagram =
    '<svg viewBox="0 0 600 236" role="img" aria-label="timing diagram showing setup, hold and clk-to-q" style="width:100%;max-width:640px;height:auto;display:block;font-family:system-ui,sans-serif" xmlns="http://www.w3.org/2000/svg">' +
    '<defs><marker id="sdsl-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>' +
    // labels
    '<text x="12" y="45" font-size="15" font-weight="700" fill="currentColor">clk</text>' +
    '<text x="12" y="116" font-size="15" font-weight="700" fill="currentColor">D</text>' +
    '<text x="12" y="191" font-size="15" font-weight="700" fill="currentColor">Q</text>' +
    // window shading
    '<rect x="290" y="88" width="110" height="44" fill="#ffc107" fill-opacity="0.28"/>' +
    // clock
    '<path d="M60,58 H120 V26 H240 V58 H360 V26 H480 V58 H580" fill="none" stroke="currentColor" stroke-width="2.2"/>' +
    '<text x="356" y="18" font-size="12" text-anchor="end" fill="currentColor">rising edge</text>' +
    '<line x1="360" y1="20" x2="360" y2="226" stroke="currentColor" stroke-width="1.2" stroke-dasharray="4 4"/>' +
    // D bus
    '<g stroke="currentColor" stroke-width="2" fill="none">' +
    '<path d="M60,96 H195 L205,124 H435 L445,96 H580"/><path d="M60,124 H195 L205,96 H435 L445,124 H580"/></g>' +
    '<text x="128" y="115" font-size="13" text-anchor="middle" fill="currentColor">old</text>' +
    '<text x="245" y="115" font-size="13" text-anchor="middle" fill="currentColor">new</text>' +
    '<text x="512" y="115" font-size="13" text-anchor="middle" fill="currentColor">next</text>' +
    // setup and hold arrows
    '<line x1="292" y1="80" x2="358" y2="80" stroke="currentColor" stroke-width="1.4" marker-start="url(#sdsl-arr)" marker-end="url(#sdsl-arr)"/>' +
    '<text x="325" y="74" font-size="12" text-anchor="middle" fill="currentColor">setup</text>' +
    '<line x1="362" y1="80" x2="398" y2="80" stroke="currentColor" stroke-width="1.4" marker-start="url(#sdsl-arr)" marker-end="url(#sdsl-arr)"/>' +
    '<text x="380" y="74" font-size="12" text-anchor="middle" fill="currentColor">hold</text>' +
    '<text x="354" y="148" font-size="12" text-anchor="end" fill="currentColor">D must not change here</text>' +
    // Q bus
    '<g stroke="currentColor" stroke-width="2" fill="none">' +
    '<path d="M60,172 H405 L415,200 H580"/><path d="M60,200 H405 L415,172 H580"/></g>' +
    '<text x="230" y="191" font-size="13" text-anchor="middle" fill="currentColor">old</text>' +
    '<text x="497" y="191" font-size="13" text-anchor="middle" fill="currentColor">new</text>' +
    '<line x1="362" y1="216" x2="408" y2="216" stroke="currentColor" stroke-width="1.4" marker-start="url(#sdsl-arr)" marker-end="url(#sdsl-arr)"/>' +
    '<text x="415" y="221" font-size="12" fill="currentColor">clk-to-q</text>' +
    '</svg>';

  const timing = [
    {
      title: 'Registers and the clock',
      html:
        '<p>A <strong>register</strong> stores a value. It has an input <strong>D</strong>, an output <strong>Q</strong>, and a clock input (the little triangle).</p>' +
        '<p>A register only changes at the <strong>rising edge</strong> of the clock, the moment the clock goes from 0 to 1. At that moment it copies D into Q. Between rising edges, Q stays the same no matter what D does.</p>' +
        '<p>Between registers sits <strong>combinational logic</strong> (gates). When a register\'s Q changes, the new value ripples through the gates and reaches the next register\'s D a little later. Every timing question asks two things:</p>' +
        '<ul><li>Does the new value arrive <strong>early enough</strong> before the next rising edge? (setup)</li><li>Does it arrive <strong>late enough</strong> that it does not spoil the value being captured right now? (hold)</li></ul>' +
        '<p><strong>Register chains.</strong> If you fill in a timing diagram for <code>in &rarr; R1 &rarr; R2</code>, each rising edge shifts values one step: R1 shows what <code>in</code> was just before the edge, and R2 shows what R1 showed one cycle earlier. Each Q changes clk-to-q after the edge, never in between edges.</p>',
    },
    {
      title: 'The three register numbers',
      html:
        '<ul>' +
        '<li><strong>clk-to-q</strong>: after the rising edge, how long until Q shows the new value.</li>' +
        '<li><strong>setup time</strong>: D must already be stable this long <em>before</em> the rising edge.</li>' +
        '<li><strong>hold time</strong>: D must stay stable this long <em>after</em> the rising edge.</li>' +
        '</ul><p>So around each rising edge there is a window (setup before, hold after) where D must not change:</p>' + timingDiagram,
    },
    {
      title: 'The two formulas',
      html:
        '<p><strong>Setup</strong> limits how fast the clock can tick. The slowest signal must get through the gates and be stable setup time before the next edge:</p>' +
        box('T<sub>min</sub> = max over register-to-register paths of (clk-to-q + combinational delay + setup)') +
        '<p class="mt-2"><strong>Hold</strong> limits how fast a signal is allowed to be. The fastest new value must not reach the next register before its hold time is over:</p>' +
        box('hold time &le; clk-to-q + shortest combinational delay, so t<sub>hold,max</sub> = min over paths of (clk-to-q + combinational delay)') +
        '<p class="mt-2">And the clock frequency is <strong>f<sub>max</sub> = 1 / T<sub>min</sub></strong>.</p>' +
        warn('Hold has no setup in it and no clock period in it. A slower clock never fixes a hold problem.'),
    },
    {
      title: 'Method: list every register-to-register path',
      html:
        '<ol><li>Start at each register\'s Q output.</li>' +
        '<li>Follow every wire. At a junction dot the wire splits, and so does the path.</li>' +
        '<li>Add up gate delays until you reach a register\'s D input. Stop there.</li>' +
        '<li>For each path write two sums: <em>clk-to-q + gates + setup</em> and <em>clk-to-q + gates</em>.</li>' +
        '<li>T<sub>min</sub> = the biggest first sum. t<sub>hold,max</sub> = the smallest second sum.</li></ol>' +
        '<p>Practice Midterm 1, Question 5 (AND 5, OR 1, NOT 6, clk-to-q 40, setup 10, all in ps):</p>' +
        '<div class="table-responsive"><table class="table table-sm table-bordered w-auto"><thead><tr><th>Path</th><th>for setup</th><th>for hold</th></tr></thead><tbody>' +
        '<tr><td>Reg1 &rarr; AND &rarr; OR &rarr; Reg3</td><td>40 + 5 + 1 + 10 = <strong>56</strong></td><td>40 + 5 + 1 = 46</td></tr>' +
        '<tr><td>Reg2 &rarr; AND &rarr; OR &rarr; Reg3</td><td>40 + 5 + 1 + 10 = <strong>56</strong></td><td>40 + 5 + 1 = 46</td></tr>' +
        '<tr><td>Reg2 &rarr; OR &rarr; Reg3</td><td>40 + 1 + 10 = 51</td><td>40 + 1 = <strong>41</strong></td></tr>' +
        '<tr><td>Reg3 &rarr; NOT &rarr; Reg4</td><td>40 + 6 + 10 = <strong>56</strong></td><td>40 + 6 = 46</td></tr>' +
        '</tbody></table></div>' +
        '<p>So T<sub>min</sub> = 56 ps (three paths tie, that is fine) and t<sub>hold,max</sub> = 41 ps.</p>',
      demo: (c) => S().timing.renderCircuit(S().timing.presets.pm15(), c, { labels: true, table: false }),
    },
    {
      title: 'Why setup uses the longest path and hold uses the shortest',
      html:
        '<p><strong>Setup:</strong> the slowest path is the last to arrive. The period must be long enough for that slowest signal to get there and settle (setup) before the next edge. Faster paths arrive earlier, so they are fine.</p>' +
        '<p><strong>Hold:</strong> at a rising edge, the receiving register captures its D. At the very same edge, the sending register launches a new value. That new value races through the gates. If even the <em>fastest</em> path delivers it before the hold time is over, it spoils the value being captured. So only the shortest path matters, and the clock period does not appear at all.</p>',
    },
    {
      title: 'Units and frequency without a calculator',
      html:
        '<p>1 ns = 10<sup>-9</sup> s and 1 ps = 10<sup>-12</sup> s. 1 GHz = 10<sup>9</sup> Hz and 1 MHz = 10<sup>6</sup> Hz.</p>' +
        box('1 / (T ns) = 1000 / T MHz &nbsp;&nbsp;&nbsp; 1 / (T ps) = 1000 / T GHz') +
        '<p class="mt-2">Memorize these pairs (period &harr; frequency):</p>' +
        '<div class="table-responsive"><table class="table table-sm table-bordered w-auto text-center"><tbody>' +
        '<tr><th>T</th><td>20</td><td>25</td><td>40</td><td>50</td><td>80</td><td>100</td><td>125</td><td>200</td><td>250</td><td>500</td></tr>' +
        '<tr><th>1000 / T</th><td>50</td><td>40</td><td>25</td><td>20</td><td>12.5</td><td>10</td><td>8</td><td>5</td><td>4</td><td>2</td></tr>' +
        '</tbody></table></div>' +
        '<p>Examples: 1 / (50 ps) = 1000/50 GHz = <strong>20 GHz</strong>. 1 / (25 ns) = 1000/25 MHz = <strong>40 MHz</strong>. 1 / (80 ps) = 12.5 GHz = <strong>12500 MHz</strong>. Going backwards: 4 GHz means T = 1/4 ns = 0.25 ns = 250 ps.</p>',
    },
    {
      title: 'The traps',
      html:
        '<ul>' +
        '<li><strong>Outside inputs.</strong> A wire that comes from an input pin (not a register) does not start a register-to-register path. Ignore it, even if it is the longest or shortest wire.</li>' +
        '<li><strong>Direct wires.</strong> A Q wired straight into another D is a path with 0 gate delay. Then t<sub>hold,max</sub> is just clk-to-q.</li>' +
        '<li><strong>Feedback loops.</strong> If a register\'s Q goes through gates back into its own D, that is a path from the register to itself. Count it.</li>' +
        '<li><strong>Fanout.</strong> One Q feeding two gates (a junction dot) makes two separate paths.</li>' +
        '<li><strong>Per-register numbers.</strong> Use the clk-to-q of the register where the path <em>starts</em> and the setup of the register where it <em>ends</em>. If the question asks for one register\'s hold time, only paths that end at that register count.</li>' +
        '<li><strong>Mixing formulas.</strong> Do not add setup to the hold sum, and never use the hold time inside T<sub>min</sub>.</li>' +
        '</ul>',
    },
    {
      title: 'Worked example: Discussion 7',
      html:
        '<p>RegA and RegB: setup, hold and clk-to-q are 4 ns. Every gate is 5 ns. RegC: setup 6 ns, clk-to-q 4 ns.</p>' +
        '<ul><li>The longest path into RegC goes through 3 gates: T<sub>min</sub> = 4 + (5 + 5 + 5) + 6 = <strong>25 ns</strong>, so f<sub>max</sub> = 1000/25 MHz = <strong>40 MHz</strong>.</li>' +
        '<li>The shortest path into RegC goes through 2 gates: t<sub>hold,max</sub> for RegC = 4 + (5 + 5) = <strong>14 ns</strong>.</li></ul>',
      demo: (c) => S().timing.renderCircuit(S().timing.presets.disc7(), c, { labels: true }),
    },
  ];

  /* ====================================================================
   * Boolean algebra
   * ================================================================== */

  const lawRows = [
    ['x*!x = 0', 'x+!x = 1', 'complement', 'A thing AND its opposite is 0. A thing OR its opposite is 1.'],
    ['x*0 = 0', 'x+1 = 1', 'annihilator', '0 kills an AND, 1 kills an OR.'],
    ['x*1 = x', 'x+0 = x', 'identity', 'Cleans up after a complement step.'],
    ['x*x = x', 'x+x = x', 'idempotent', 'Duplicates collapse.'],
    ['x*y = y*x', 'x+y = y+x', 'commutative', 'Order does not matter, so you may reorder freely.'],
    ['(x*y)*z = x*(y*z)', '(x+y)+z = x+(y+z)', 'associative', 'Grouping does not matter.'],
    ['x*(y+z) = x*y+x*z', 'x+y*z = (x+y)*(x+z)', 'distributive', 'Read right to left to <strong>factor out</strong> a shared term and save gates. The OR version has no match in normal algebra.'],
    ['!(x*y) = !x+!y', '!(x+y) = !x*!y', "De Morgan", 'Push a NOT inside: flip AND and OR, and NOT each part.'],
    ['x*y+x = x', '(x+y)*x = x', 'absorption', 'A term ORed with a bigger product that contains it adds nothing.'],
  ];

  const bool = [
    {
      title: 'Gates and truth tables',
      html:
        '<p>A gate takes bits in and gives one bit out. A <strong>truth table</strong> lists the output for every input combination.</p>' +
        '<div class="d-flex flex-wrap gap-3">' +
        ['AND: 1 only if both are 1|0|0|0|1', 'OR: 1 if at least one is 1|0|1|1|1'].map((r) => {
          const [t, a, b, c, d] = r.split('|');
          return '<div><div class="small fw-semibold mb-1">' + t + '</div><table class="table table-sm table-bordered w-auto text-center font-monospace mb-0"><thead><tr><th>x</th><th>y</th><th>out</th></tr></thead><tbody>' +
            '<tr><td>0</td><td>0</td><td>' + a + '</td></tr><tr><td>0</td><td>1</td><td>' + b + '</td></tr><tr><td>1</td><td>0</td><td>' + c + '</td></tr><tr><td>1</td><td>1</td><td>' + d + '</td></tr></tbody></table></div>';
        }).join('') +
        '<div><div class="small fw-semibold mb-1">NOT: flips the bit</div><table class="table table-sm table-bordered w-auto text-center font-monospace mb-0"><thead><tr><th>x</th><th>out</th></tr></thead><tbody><tr><td>0</td><td>1</td></tr><tr><td>1</td><td>0</td></tr></tbody></table></div></div>' +
        '<p class="mt-3">Notation: AND is <code>xy</code> or <code>x*y</code>, OR is <code>x + y</code>, NOT is ' + ov('x') + ' or <code>!x</code>. Like &times; before + in arithmetic, <strong>NOT comes first, then AND, then OR</strong>. So <code>x + y*z</code> means <code>x + (y*z)</code>.</p>' +
        '<p>The shapes: AND has a flat back and a round front. OR has a curved back and a pointed front. NOT is a triangle with a small circle (the bubble).</p>',
      demo: (c) => {
        c.innerHTML = '<div class="d-flex flex-wrap gap-4 align-items-center"></div>';
        const row = c.firstChild;
        ['x*y', 'x+y', '!x'].forEach((e) => {
          const d = document.createElement('div');
          d.style.width = '190px';
          row.appendChild(d);
          S().bool.renderCircuit(e, d, { vars: e === '!x' ? ['x'] : ['x', 'y'] });
        });
      },
    },
    {
      title: 'Reading a circuit into an expression',
      html:
        '<p>Label every wire, moving left to right:</p>' +
        '<ol><li>The inputs x, y, z run along the top as horizontal rails. A <strong>dot</strong> means a wire is connected to the rail there. Wires that cross <em>without</em> a dot are not connected.</li>' +
        '<li>Number the gates. For each gate whose inputs you know, write its output: NOT of <code>y</code> is <code>!y</code>; AND of <code>a</code> and <code>b</code> is <code>a*b</code>; OR is <code>a + b</code>.</li>' +
        '<li>When you feed an OR into an AND, put parentheses around the OR: <code>x*(z + !y*!z)</code>.</li>' +
        '<li>Keep going until you reach <code>out</code>.</li></ol>' +
        '<p>The Practice Midterm 1, Question 6 circuit, read gate by gate:</p>',
      demo: (c) => {
        c.innerHTML = S().bool.circuitSvg('x*(!y*!z + z)', { numbers: true }) + '<div class="mt-2">' + S().bool.circuitReading('x*(!y*!z + z)') + '</div>';
      },
    },
    {
      title: 'The laws in plain English',
      html: function () {
        const law = (s) => (global.SDS ? global.SDS.bool.lawHtml(s) : '<code>' + s + '</code>');
        return '<p>These are the laws printed on the exam. The first two columns are the AND form and the OR form of the same idea.</p>' +
          '<div class="table-responsive"><table class="table table-sm table-bordered align-middle"><thead><tr><th>AND form</th><th>OR form</th><th>Name</th><th>When it helps</th></tr></thead><tbody>' +
          lawRows.map((r) => '<tr><td class="text-nowrap">' + law(r[0]) + '</td><td class="text-nowrap">' + law(r[1]) + '</td><td>' + r[2] + '</td><td class="small">' + r[3] + '</td></tr>').join('') +
          '</tbody></table></div>' +
          '<p>Two more that you will use all the time:</p>' +
          '<ul><li><strong>Double negation:</strong> NOT(NOT x) = x. Two NOTs in a row cancel.</li>' +
          '<li><strong>Drop the opposite:</strong> ' + law('x+!x*y = x+y') + ' and ' + law('x*(!x+y) = x*y') + '. Why: ' + law('x+!x*y = (x+!x)*(x+y)') + ' by the OR distributive law, and ' + law('x+!x = 1') + ', so it is just ' + law('x+y') + '.</li></ul>';
      },
    },
    {
      title: 'A simplification strategy',
      html:
        '<ol>' +
        '<li>Write the raw expression straight from the circuit.</li>' +
        '<li>Cancel double NOTs. Push NOTs down to single variables with De Morgan, so you can see what is going on.</li>' +
        '<li>Look for these patterns:<ul>' +
        '<li>a term and its opposite: <code>x + !x*y = x + y</code></li>' +
        '<li>absorption: <code>x + x*y = x</code></li>' +
        '<li>combining: <code>x*y + x*!y = x</code></li>' +
        '<li>a shared factor: <code>x*y + x*z = x*(y + z)</code></li></ul></li>' +
        '<li>Final polish for gate count: an AND of two NOTs, <code>!x*!y</code> (3 gates), becomes <code>!(x + y)</code> (2 gates). An OR of two NOTs, <code>!x + !y</code>, becomes <code>!(x*y)</code>.</li>' +
        '<li>Check 2 or 3 rows of the truth table, or all 8 if unsure.</li>' +
        '</ol>' +
        tip('If you are stuck, make the truth table (8 rows) and write a sum of products: one AND term for each row where the output is 1, then merge rows that differ in just one variable.'),
    },
    {
      title: 'Counting gates exactly like the exam',
      html:
        '<ul><li>Each NOT, each 2-input AND and each 2-input OR counts as <strong>1 gate</strong>. Variables and parentheses are free.</li>' +
        '<li>k terms joined by AND (or by OR) cost k &minus; 1 gates. <code>x*y*z</code> is 2 gates.</li>' +
        '<li>Nothing is shared: <code>!x</code> written twice is 2 NOT gates.</li></ul>' +
        '<div class="table-responsive"><table class="table table-sm table-bordered w-auto font-monospace"><thead><tr><th>expression</th><th>gates</th></tr></thead><tbody>' +
        '<tr><td>x*(!y+z)</td><td>3 (NOT, OR, AND)</td></tr>' +
        '<tr><td>!x*!y</td><td>3</td></tr><tr><td>!(x+y)</td><td>2 (same function, cheaper)</td></tr>' +
        '<tr><td>x*y + x*z</td><td>3</td></tr><tr><td>x*(y+z)</td><td>2</td></tr>' +
        '<tr><td>(x+y)*!(x*y)</td><td>4 (this is XOR)</td></tr>' +
        '</tbody></table></div>' +
        '<p>Scoring on the exam: the full 2 points needs the minimum gate count. Each extra gate costs 0.5 points, but any correct expression gets at least 0.5.</p>',
    },
    {
      title: 'Worked example 1: (A + B)(A + B̄)C',
      html: function () {
        return '<p>From Discussion 7: simplify (A + B)(A + ' + ov('B') + ')C.</p><ol>' +
          '<li>(A + B)(A + ' + ov('B') + ') = A + B' + ov('B') + ' &nbsp; (distributive law for OR, read right to left)</li>' +
          '<li>B' + ov('B') + ' = 0 &nbsp; (complement), so A + 0 = A &nbsp; (identity)</li>' +
          '<li>So the whole thing is <strong>AC</strong>, which is <code>A*C</code>: 1 gate instead of 5.</li></ol>';
      },
    },
    {
      title: 'Worked example 2: Practice Midterm 1, Question 6',
      html:
        '<ol><li>Read the circuit: <code>out = x*(!y*!z + z)</code>. That is 2 NOT + 2 AND + 1 OR = 5 gates.</li>' +
        '<li>Look inside the parentheses: <code>z + !z*!y</code>. This is the "drop the opposite" rule <code>x + !x*y = x + y</code> with <code>z</code> as x and <code>!y</code> as y.</li>' +
        '<li>So <code>z + !z*!y = z + !y</code>, and the answer is <code>x*(!y + z)</code>: 1 NOT + 1 OR + 1 AND = <strong>3 gates</strong>.</li></ol>',
      demo: (c) => S().bool.renderCircuit('x*(!y*!z + z)', c),
    },
    {
      title: 'Worked example 3: truth table with a don\'t-care',
      html:
        '<p>Find a minimal expression for f(A, B, C) below. X means "don\'t care": you may treat it as 0 or 1, whichever makes the answer smaller.</p>' +
        '<ol><li>Rows with f = 1: <code>001</code>, <code>011</code>, <code>101</code>, <code>110</code>. The X is row <code>111</code>.</li>' +
        '<li>Sum of products (one term per 1-row): <code>!A*!B*C + !A*B*C + A*!B*C + A*B*!C</code>. Correct, but huge.</li>' +
        '<li>Choose X = 1. Now rows <code>001, 011, 101, 111</code> all have C = 1 while A and B take every value, so together they are just <code>C</code>.</li>' +
        '<li>Rows <code>110, 111</code> have A = 1 and B = 1 while C changes, so together they are <code>A*B</code>.</li>' +
        '<li>Answer: <code>f = C + A*B</code>, only 2 gates.</li></ol>',
      demo: (c) => {
        const t = [0, 1, 0, 1, 0, 1, 1, 'x'];
        const vars = ['A', 'B', 'C'];
        c.innerHTML = S().bool.truthTableHtml(vars, [{ label: 'f', values: t }]) +
          '<p class="small mb-0">Computer check: the minimum is ' + S().bool.minGates(t, vars) + ' gates, for example <code>' + S().bool.minimalExpr(t, vars) + '</code>.</p>';
      },
    },
  ];

  // Resolve sections whose html is a function (they use SDS helpers when available).
  function resolve(list) {
    return list.map((s) => Object.assign({}, s, { html: typeof s.html === 'function' ? s.html() : s.html }));
  }

  const LESSONS = { fsm: resolve(fsm), timing: resolve(timing), bool: resolve(bool) };
  global.SDS_LESSONS = LESSONS;
  if (typeof module !== 'undefined' && module.exports) module.exports = LESSONS;
})(typeof window !== 'undefined' ? window : globalThis);
