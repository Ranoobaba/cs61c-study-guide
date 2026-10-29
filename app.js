/* CS61C Midterm Part I study page: routing, question cards, progress, missed queue, gym, mock exam. */
(function () {
  "use strict";

  // ---------- small helpers ----------
  const app = () => document.getElementById("app");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  const newSeed = () => Math.floor(Math.random() * 1e9);
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const pct = (x) => Math.round(x * 100);

  // ---------- data sources (written by separate files; tolerate them missing) ----------
  const CONTENT = () => window.CONTENT || { modules: [], walkthroughs: [] };
  const SDS = () => window.SDS || null;
  const SDS_LESSONS = () => window.SDS_LESSONS || {};
  const findModule = (id) => CONTENT().modules.find((m) => m.id === id);
  function findQuestion(qid) {
    for (const m of CONTENT().modules) {
      const q = (m.questions || []).find((x) => x.id === qid);
      if (q) return { q, m };
    }
    return null;
  }

  const SDS_TOPICS = {
    bool: { title: "Boolean algebra", section: "Boolean algebra", minutes: 25, kinds: [["circuit", "Circuit to expression (exam format)"], ["simplify", "Simplify an expression"], ["truthtable", "Truth table to expression"]] },
    fsm: { title: "FSMs", section: "FSMs", minutes: 20, kinds: [["labels", "Fill in the labels (exam format)"], ["trace", "Trace an input"], ["pattern", "Which pattern?"]] },
    timing: { title: "Timing", section: "Timing", minutes: 25, kinds: [["tmin_hold", "Min period and max hold (exam format)"], ["fmax", "Plus max frequency"]] },
  };
  const SDS_TARGET = 6; // correct variants per topic that count as "done"

  const GYM = [
    { n: 1, dir: "q01_dup_ints", fn: "dup_ints", core: true, what: "Copy an int array (one allocation, NULL check)" },
    { n: 2, dir: "q02_dup_string", fn: "dup_string", core: true, what: "Copy a string, including the terminator" },
    { n: 3, dir: "q03_zip_points", fn: "zip_points", core: true, what: "Array of structs from parallel arrays" },
    { n: 4, dir: "q04_dup_strings", fn: "dup_strings", core: true, what: "Deep copy n strings, clean up on failure" },
    { n: 5, dir: "q05_list_from_array", fn: "list_from_array", core: true, what: "Linked list from an array, clean up on failure" },
    { n: 6, dir: "q06_filter_copy_list", fn: "filter_copy_list", core: false, what: "Copy only the nodes that pass a test" },
    { n: 7, dir: "q07_join_words", fn: "join_words", core: false, what: "Join strings into one exactly sized string" },
    { n: 8, dir: "q08_transpose", fn: "transpose", core: false, what: "New transposed int ** matrix, clean up on failure" },
    { n: 9, dir: "q09_tree_copy", fn: "tree_copy", core: false, what: "Recursive deep copy of a tree (hardest)" },
  ];

  const BLUEPRINT = [
    { q: 1, section: "CALL", pts: 2, route: "#/m/call", format: "4 dropdowns: compiler, assembler, linker or loader" },
    { q: 2, section: "Memory regions", pts: 2, route: "#/m/regions", format: "Dropdowns: Text, Data, Heap or Stack" },
    { q: 3, section: "C coding", pts: 10, route: "#/gym", format: "Write a function. 10 hidden test groups, half run memory checkers" },
    { q: 4, section: "FSMs", pts: 2, route: "#/sds/fsm", format: "Type input/output on every arrow of a diagram" },
    { q: 5, section: "Timing", pts: 2, route: "#/sds/timing", format: "Type T_min and max hold time in ps" },
    { q: 6, section: "Boolean algebra", pts: 2, route: "#/sds/bool", format: "Circuit to expression, graded on gate count" },
  ];

  // The 2-day plan. Each step links to where you do it.
  const PATH = [
    { key: "c1", day: 1, kind: "module", id: "c1-types" },
    { key: "c2", day: 1, kind: "module", id: "c2-pointers" },
    { key: "c3", day: 1, kind: "module", id: "c3-strings" },
    { key: "c4", day: 1, kind: "module", id: "c4-structs" },
    { key: "c5", day: 1, kind: "module", id: "c5-heap" },
    { key: "gym13", day: 1, kind: "gym", title: "C gym: problems 1 to 3", minutes: 60 },
    { key: "regions", day: 1, kind: "module", id: "regions" },
    { key: "bool", day: 1, kind: "sds", id: "bool" },
    { key: "fsm", day: 1, kind: "sds", id: "fsm" },
    { key: "gym45", day: 2, kind: "gym", title: "C gym: problems 4 and 5, then PM1.3 on PrairieLearn", minutes: 70 },
    { key: "call", day: 2, kind: "module", id: "call" },
    { key: "timing", day: 2, kind: "sds", id: "timing" },
    { key: "mock", day: 2, kind: "mock", title: "Timed 50-minute mock exam", minutes: 50 },
    { key: "missed", day: 2, kind: "missed", title: "Review your missed questions", minutes: 30 },
  ];

  // ---------- persistence (per-viewer convenience; the page works without it) ----------
  const STORE_KEY = "cs61c-mt1-v1";
  let state = { done: {}, results: {}, missed: {}, sdsWins: {}, gym: {}, mocks: [] };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) state = Object.assign(state, JSON.parse(raw));
  } catch (e) { /* storage blocked: keep in-memory state */ }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function recordResult(ctrl, score, opts) {
    const key = ctrl.key;
    const r = state.results[key] || { attempts: 0, best: 0, first: null };
    r.attempts += 1;
    if (r.first === null) r.first = opts && opts.peeked ? 0 : score;
    r.best = Math.max(r.best, score);
    state.results[key] = r;
    if (score < 1 || (opts && opts.peeked)) {
      state.missed[key] = ctrl.missedRef;
    } else if (opts && opts.fromMissed) {
      delete state.missed[key];
    }
    if (ctrl.sdsTopic && score >= 1 && !(opts && opts.peeked)) {
      const wins = state.sdsWins[ctrl.sdsTopic] || [];
      if (!wins.includes(key)) wins.push(key);
      state.sdsWins[ctrl.sdsTopic] = wins;
    }
    save();
    renderNav();
  }

  // ---------- progress ----------
  function moduleProgress(m) {
    const qs = m.questions || [];
    if (!qs.length) return 0;
    const solved = qs.filter((q) => (state.results["c:" + q.id] || {}).best >= 1).length;
    return solved / qs.length;
  }
  function sdsProgress(topic) {
    return Math.min(1, (state.sdsWins[topic] || []).length / SDS_TARGET);
  }
  function gymProgress(nums) {
    return nums.filter((n) => state.gym[n]).length / nums.length;
  }
  function pathProgress(p) {
    if (p.kind === "module") { const m = findModule(p.id); return m ? moduleProgress(m) : 0; }
    if (p.kind === "sds") return sdsProgress(p.id);
    if (p.kind === "gym") return gymProgress(p.key === "gym13" ? [1, 2, 3] : [4, 5]);
    if (p.kind === "mock") return state.mocks.length ? 1 : 0;
    if (p.kind === "missed") return Object.keys(state.missed).length === 0 && Object.keys(state.results).length > 20 ? 1 : 0;
    return 0;
  }
  function pathTitle(p) {
    if (p.kind === "module") { const m = findModule(p.id); return m ? m.title : p.id + " (still being written)"; }
    if (p.kind === "sds") return SDS_TOPICS[p.id].title;
    return p.title;
  }
  function pathMinutes(p) {
    if (p.kind === "module") { const m = findModule(p.id); return m ? m.minutes : null; }
    if (p.kind === "sds") return SDS_TOPICS[p.id].minutes;
    return p.minutes;
  }
  function pathRoute(p) {
    if (p.kind === "module") return "#/m/" + p.id;
    if (p.kind === "sds") return "#/sds/" + p.id;
    if (p.kind === "gym") return "#/gym";
    if (p.kind === "mock") return "#/mock";
    return "#/missed";
  }
  function sectionProgress(section) {
    if (section === "C coding") {
      const mods = CONTENT().modules.filter((m) => m.section === "C coding");
      const parts = mods.map(moduleProgress).concat([gymProgress([1, 2, 3, 4, 5])]);
      return parts.reduce((a, b) => a + b, 0) / parts.length;
    }
    if (section === "Memory regions") { const m = findModule("regions"); return m ? moduleProgress(m) : 0; }
    if (section === "CALL") { const m = findModule("call"); return m ? moduleProgress(m) : 0; }
    const topic = Object.keys(SDS_TOPICS).find((t) => SDS_TOPICS[t].section === section);
    return topic ? sdsProgress(topic) : 0;
  }

  // ---------- code rendering (@pierre/diffs when loaded, plain block otherwise) ----------
  function looksLikeAsm(code) {
    return /^\s*(\w+:\s*)?(addi|add|sub|lw|sw|lb|sb|jal|jalr|la|li|beq|bne|blt|bge|lui|auipc|ret|j|mv|ecall)\b/m.test(code) && !/[{};]\s*$/m.test(code);
  }
  function renderCode(host, code, name) {
    host.classList.add("code-host");
    const contents = String(code).replace(/\s+$/, "") + "\n";
    const fileName = name || (looksLikeAsm(contents) ? "program.s" : "example.c");
    if (window.PierreFile) {
      try {
        new window.PierreFile({ theme: { light: "github-light", dark: "github-dark" }, themeType: "light", overflow: "wrap" })
          .render({ containerWrapper: host, file: { name: fileName, contents } });
        return;
      } catch (e) { console.warn("code render failed", e); }
    }
    host.innerHTML = '<pre class="code-fallback"><code>' + esc(contents) + "</code></pre>";
  }
  function upgradeCodeBlocks(root) {
    root.querySelectorAll("pre > code").forEach((code) => {
      const pre = code.parentElement;
      if (pre.closest(".code-host")) return;
      const host = document.createElement("div");
      pre.replaceWith(host);
      renderCode(host, code.textContent);
    });
  }

  // ---------- question controllers ----------
  // Every question (hand-written or generated) is wrapped in the same interface:
  // { key, title, section, difficulty, points, render(container), grade() -> {score, correct, feedbackHtml}, solutionHtml(), missedRef }
  function contentController(q, m) {
    let drawn = null; // items drawn from a pool for this attempt
    let root = null;
    const items = () => drawn || q.items || [];
    return {
      key: "c:" + q.id,
      title: m ? m.title : "",
      section: m ? m.section : "",
      difficulty: q.difficulty,
      points: 2,
      missedRef: { type: "content", id: q.id },
      render(container) {
        root = container;
        container.innerHTML = "";
        container.appendChild(el('<div class="q-prompt">' + q.prompt + "</div>"));
        if (q.code) { const host = document.createElement("div"); container.appendChild(host); renderCode(host, q.code); }
        upgradeCodeBlocks(container.querySelector(".q-prompt"));
        const inputs = document.createElement("div");
        inputs.className = "q-inputs mt-2";
        container.appendChild(inputs);
        if (q.type === "mcq" || q.type === "multi") {
          const kind = q.type === "mcq" ? "radio" : "checkbox";
          const name = "q-" + q.id + "-" + newSeed();
          if (q.type === "multi") inputs.appendChild(el('<div class="small muted mb-1">Select all that apply.</div>'));
          q.options.forEach((opt, i) => {
            inputs.appendChild(el('<label class="opt-row" data-i="' + i + '"><input class="form-check-input" type="' + kind + '" name="' + name + '" value="' + i + '"><span>' + opt + "</span></label>"));
          });
        } else if (q.type === "dropdowns") {
          if (q.pool) drawn = shuffle(q.pool).slice(0, q.draw || 4);
          items().forEach((it, i) => {
            const opts = ['<option value="">Select an option</option>'].concat(q.choices.map((c) => '<option value="' + esc(c) + '">' + esc(c) + "</option>")).join("");
            inputs.appendChild(el('<div class="dd-row"><div>' + it.label + '</div><select class="form-select" data-i="' + i + '">' + opts + "</select></div>"));
          });
        } else if (q.type === "number" || q.type === "text") {
          const unit = q.unit ? '<span class="input-group-text">' + esc(q.unit) + "</span>" : "";
          const mode = q.type === "number" ? ' inputmode="numeric" placeholder="integer"' : ' placeholder="your answer"';
          inputs.appendChild(el('<div class="input-group" style="max-width: 420px"><span class="input-group-text">Answer</span><input class="form-control font-monospace"' + mode + ">" + unit + "</div>"));
        }
      },
      grade() {
        const box = root.querySelector(".q-inputs");
        if (q.type === "mcq") {
          const picked = box.querySelector("input:checked");
          const i = picked ? Number(picked.value) : -1;
          box.querySelectorAll(".opt-row").forEach((row) => row.classList.remove("good", "bad"));
          if (i >= 0) box.querySelector('.opt-row[data-i="' + i + '"]').classList.add(i === q.answer ? "good" : "bad");
          const ok = i === q.answer;
          let fb = ok ? "Correct." : i < 0 ? "Pick an option first." : "Not quite.";
          if (!ok && i >= 0 && q.whyWrong && q.whyWrong[i]) fb += " " + q.whyWrong[i];
          return { score: ok ? 1 : 0, correct: ok, feedbackHtml: fb };
        }
        if (q.type === "multi") {
          const picked = new Set([...box.querySelectorAll("input:checked")].map((x) => Number(x.value)));
          const want = new Set(q.answer);
          let ok = true;
          box.querySelectorAll(".opt-row").forEach((row) => {
            const i = Number(row.dataset.i);
            row.classList.remove("good", "bad");
            const right = picked.has(i) === want.has(i);
            if (!right) ok = false;
            if (picked.has(i) || !right) row.classList.add(right ? "good" : "bad");
          });
          return { score: ok ? 1 : 0, correct: ok, feedbackHtml: ok ? "Correct." : "Not quite. Red rows are wrong: either picked when they should not be, or missed." };
        }
        if (q.type === "dropdowns") {
          const sels = [...box.querySelectorAll("select")];
          let right = 0;
          sels.forEach((s) => {
            const it = items()[Number(s.dataset.i)];
            const ok = s.value === it.answer;
            if (ok) right++;
            s.classList.remove("mark-good", "mark-bad");
            s.classList.add(ok ? "mark-good" : "mark-bad");
          });
          const score = sels.length ? right / sels.length : 0;
          return { score, correct: score === 1, feedbackHtml: right + " of " + sels.length + " correct." };
        }
        if (q.type === "number" || q.type === "text") {
          const input = box.querySelector("input");
          const raw = input.value;
          let ok;
          if (q.type === "number") {
            ok = raw.trim() !== "" && Number(raw.trim()) === Number(q.answer);
          } else {
            const norm = (s) => {
              const mode = q.normalize || "trim";
              if (mode === "exact") return s.replace(/\r/g, "");
              if (mode === "nospace") return s.replace(/\s+/g, "");
              return s.trim().replace(/\s+/g, " ");
            };
            const answers = Array.isArray(q.answer) ? q.answer : [q.answer];
            ok = answers.some((a) => norm(raw) === norm(String(a)));
          }
          input.classList.remove("mark-good", "mark-bad");
          input.classList.add(ok ? "mark-good" : "mark-bad");
          return { score: ok ? 1 : 0, correct: ok, feedbackHtml: ok ? "Correct." : "Not quite." };
        }
        return { score: 0, correct: false, feedbackHtml: "Unknown question type." };
      },
      solutionHtml() {
        let html = "";
        if (q.type === "mcq") html += "<p><b>Answer:</b> " + q.options[q.answer] + "</p>";
        if (q.type === "multi") html += "<p><b>Answer:</b></p><ul>" + q.answer.map((i) => "<li>" + q.options[i] + "</li>").join("") + "</ul>";
        if (q.type === "number" || q.type === "text") {
          const a = Array.isArray(q.answer) ? q.answer[0] : q.answer;
          html += "<p><b>Answer:</b> <code>" + esc(a) + "</code>" + (q.unit ? " " + esc(q.unit) : "") + "</p>";
        }
        if (q.type === "dropdowns") {
          html += '<table class="table table-sm align-middle"><tbody>' + items().map((it) =>
            "<tr><td>" + it.label + '</td><td class="text-nowrap"><b>' + esc(it.answer) + "</b></td><td>" + (it.explain || "") + "</td></tr>").join("") + "</tbody></table>";
        }
        html += q.explain || "";
        if (q.type === "mcq" && q.whyWrong) {
          const wrongs = q.whyWrong.map((w, i) => (w && i !== q.answer ? "<li>" + q.options[i] + ": " + w + "</li>" : "")).join("");
          if (wrongs) html += "<p class='mt-2 mb-1'><b>Why the other options are wrong</b></p><ul>" + wrongs + "</ul>";
        }
        return html;
      },
    };
  }

  function sdsController(topic, opts) {
    const S = SDS();
    const q = S.makeQuestion(topic, opts);
    return wrapSds(q, topic, { type: "sds", topic, opts });
  }
  function wrapSds(q, topic, ref) {
    return {
      key: "s:" + (q.id || topic + "-" + JSON.stringify(ref.opts || {})),
      title: q.title,
      section: SDS_TOPICS[topic] ? SDS_TOPICS[topic].section : topic,
      difficulty: q.difficulty,
      points: q.points || 2,
      sdsTopic: ref.type === "sds" ? topic : null,
      missedRef: ref,
      render: (c) => q.render(c),
      grade: () => q.grade(),
      solutionHtml: () => q.solutionHtml(),
    };
  }
  function controllerFromRef(ref) {
    if (ref.type === "content") { const f = findQuestion(ref.id); return f ? contentController(f.q, f.m) : null; }
    if (ref.type === "sds" && SDS()) return sdsController(ref.topic, ref.opts);
    if (ref.type === "practice" && SDS()) return wrapSds(SDS().practiceQuestion(ref.n), ref.topic, ref);
    return null;
  }

  // ---------- the PrairieLearn-style card ----------
  function questionCard(ctrl, label, options) {
    const o = Object.assign({ showFooter: true, fromMissed: false, onNext: null }, options || {});
    const diff = ctrl.difficulty === "exam+" ? '<span class="badge text-bg-warning">exam+</span>' : ctrl.difficulty ? '<span class="badge text-bg-light">core</span>' : "";
    const card = el(
      '<div class="pl-card">' +
        '<div class="pl-header"><span>' + esc(label) + "</span>" + diff + "</div>" +
        '<div class="pl-body"><div class="q-host"></div><div class="feedback-box"></div><div class="steps-box d-none"></div></div>' +
        '<div class="pl-footer">' +
          '<button class="btn btn-pl act-grade">Save &amp; Grade</button>' +
          '<button class="btn btn-pl-light act-steps">Show steps</button>' +
          '<button class="btn btn-outline-secondary act-retry">' + (o.onNext ? "New variant" : "Try again") + "</button>" +
          '<span class="ms-auto small muted act-score"></span>' +
        "</div>" +
      "</div>"
    );
    const host = card.querySelector(".q-host");
    const fb = card.querySelector(".feedback-box");
    const steps = card.querySelector(".steps-box");
    let peeked = false;
    function draw() {
      try { ctrl.render(host); } catch (e) { host.innerHTML = '<div class="alert alert-danger">This question failed to render: ' + esc(e.message) + "</div>"; }
      fb.innerHTML = "";
      steps.classList.add("d-none");
      steps.innerHTML = "";
      peeked = false;
    }
    function showSteps() {
      steps.innerHTML = "<h6 class='mb-2'>Worked solution</h6>" + ctrl.solutionHtml();
      upgradeCodeBlocks(steps);
      steps.classList.remove("d-none");
    }
    card.querySelector(".act-grade").addEventListener("click", () => {
      let res;
      try { res = ctrl.grade(); } catch (e) { fb.innerHTML = '<div class="alert alert-warning mb-0">' + esc(e.message) + "</div>"; return; }
      const cls = res.correct ? "alert-success" : res.score > 0 ? "alert-warning" : "alert-danger";
      fb.innerHTML = '<div class="alert ' + cls + ' mb-0"><b>' + pct(res.score) + "%</b> " + (res.feedbackHtml || "") + "</div>";
      card.querySelector(".act-score").textContent = "Score " + pct(res.score) + "%";
      recordResult(ctrl, res.score, { peeked, fromMissed: o.fromMissed });
      if (!res.correct) showSteps();
    });
    card.querySelector(".act-steps").addEventListener("click", () => {
      if (steps.classList.contains("d-none")) { peeked = true; showSteps(); } else steps.classList.add("d-none");
    });
    card.querySelector(".act-retry").addEventListener("click", () => {
      if (o.onNext) { o.onNext(card); return; }
      draw();
      card.querySelector(".act-score").textContent = "";
    });
    if (!o.showFooter) card.querySelector(".pl-footer").classList.add("d-none");
    card.__draw = draw;
    card.__ctrl = ctrl;
    card.__showSteps = showSteps;
    // Render after insertion so absolutely positioned inputs (FSM labels) can measure their host.
    requestAnimationFrame(draw);
    return card;
  }

  // ---------- navigation ----------
  const NAV = [["#/home", "Plan"], ["#/learn", "Topics"], ["#/gym", "C gym"], ["#/walk", "Practice exam answers"], ["#/mock", "Mock exam"], ["#/missed", "Missed"]];
  function renderNav() {
    const nav = document.getElementById("nav");
    const here = location.hash || "#/home";
    const missed = Object.keys(state.missed).length;
    nav.innerHTML = NAV.map(([href, label]) => {
      const active = here === href || (href !== "#/home" && here.startsWith(href)) ? " active" : "";
      const badge = href === "#/missed" && missed ? ' <span class="badge text-bg-danger">' + missed + "</span>" : "";
      return '<a class="nav-link' + active + '" href="' + href + '">' + label + badge + "</a>";
    }).join("");
  }

  // ---------- pages ----------
  function pageHome() {
    const root = app();
    root.innerHTML = "";
    root.appendChild(el(
      '<div class="mb-4"><h1 class="h3 mb-1">Your 2-day plan</h1>' +
      '<p class="muted mb-0">Exam window Oct 28 to 30. 50 minutes, 20 points, closed book, no calculator. ' +
      "Drills are written at or a bit above real exam difficulty. Highlight anything confusing and send it to Claude from the Lavish bar, and an explanation gets added right here.</p></div>"
    ));
    const rows = BLUEPRINT.map((b) => {
      const p = sectionProgress(b.section);
      return '<tr><td class="text-nowrap">Q' + b.q + '</td><td><a href="' + b.route + '">' + esc(b.section) + "</a></td><td class='text-center'><b>" + b.pts + "</b></td><td class='small'>" + esc(b.format) +
        '</td><td style="min-width: 90px"><div class="progress" role="progressbar" aria-valuenow="' + pct(p) + '"><div class="progress-bar" style="width:' + pct(p) + '%"></div></div></td></tr>';
    }).join("");
    root.appendChild(el(
      '<div class="lesson-section"><h3>What is on the exam</h3><div class="table-responsive"><table class="table table-sm align-middle mb-0">' +
      "<thead><tr><th>Q</th><th>Section</th><th class='text-center'>Pts</th><th>Format</th><th>You</th></tr></thead><tbody>" + rows + "</tbody></table></div>" +
      '<p class="small muted mt-2 mb-0">C coding is half the exam, so it gets about half your time.</p></div>'
    ));
    [1, 2].forEach((day) => {
      const items = PATH.filter((p) => p.day === day);
      const total = items.reduce((a, p) => a + (pathMinutes(p) || 0), 0);
      const sec = el('<div class="lesson-section"><h3>Day ' + day + (day === 1 ? " (today)" : " (tomorrow)") + ' <span class="small muted fw-normal">about ' + Math.round(total / 6) / 10 + " h</span></h3></div>");
      items.forEach((p) => {
        const done = !!state.done[p.key];
        const prog = pathProgress(p);
        const mins = pathMinutes(p);
        const row = el(
          '<div class="path-item' + (done ? " done" : "") + '">' +
            '<input class="form-check-input mt-0" type="checkbox" ' + (done ? "checked" : "") + ' aria-label="Mark done">' +
            '<div class="flex-grow-1"><div class="path-title">' + esc(pathTitle(p)) + "</div>" +
            '<div class="progress mt-1" style="max-width: 260px"><div class="progress-bar bg-success" style="width:' + pct(prog) + '%"></div></div></div>' +
            '<span class="small muted text-nowrap">' + (mins ? mins + " min" : "") + "</span>" +
            '<a class="btn btn-sm btn-pl" href="' + pathRoute(p) + '">Open</a>' +
          "</div>"
        );
        row.querySelector("input").addEventListener("change", (e) => {
          if (e.target.checked) state.done[p.key] = true; else delete state.done[p.key];
          save();
          row.classList.toggle("done", e.target.checked);
        });
        sec.appendChild(row);
      });
      root.appendChild(sec);
    });
  }

  function pageLearn() {
    const root = app();
    root.innerHTML = '<h1 class="h3 mb-3">Topics</h1>';
    const groups = {};
    PATH.filter((p) => p.kind === "module" || p.kind === "sds").forEach((p) => {
      const section = p.kind === "sds" ? SDS_TOPICS[p.id].section : (findModule(p.id) || {}).section || "C coding";
      (groups[section] = groups[section] || []).push(p);
    });
    Object.keys(groups).forEach((section) => {
      const sec = el('<div class="lesson-section"><h3>' + esc(section) + "</h3></div>");
      groups[section].forEach((p) => {
        const prog = pathProgress(p);
        sec.appendChild(el(
          '<div class="path-item"><div class="flex-grow-1"><a href="' + pathRoute(p) + '">' + esc(pathTitle(p)) + "</a>" +
          '<div class="progress mt-1" style="max-width: 260px"><div class="progress-bar" style="width:' + pct(prog) + '%"></div></div></div>' +
          '<span class="small muted">' + (pathMinutes(p) || "") + " min</span></div>"
        ));
      });
      root.appendChild(sec);
    });
  }

  function tabs(root, names, active, onPick) {
    const bar = el('<ul class="nav nav-pills mb-3"></ul>');
    names.forEach(([id, label]) => {
      const li = el('<li class="nav-item"><button class="nav-link' + (id === active ? " active" : "") + '">' + esc(label) + "</button></li>");
      li.querySelector("button").addEventListener("click", () => onPick(id));
      bar.appendChild(li);
    });
    root.appendChild(bar);
  }

  function pageModule(id, tab) {
    const m = findModule(id);
    const root = app();
    root.innerHTML = "";
    if (!m) {
      root.appendChild(el('<div class="alert alert-info">This topic is still being written. Check back in a few minutes, or start with another topic on the <a href="#/home">plan</a>.</div>'));
      return;
    }
    root.appendChild(el('<div class="mb-3"><span class="badge text-bg-primary section-pill">' + esc(m.section) + '</span><h1 class="h3 mt-1 mb-0">' + esc(m.title) + '</h1><div class="small muted">' + (m.minutes || "") + " min, " + (m.questions || []).length + " questions</div></div>"));
    tab = tab || "lesson";
    tabs(root, [["lesson", "Lesson"], ["drill", "Drill (" + (m.questions || []).length + ")"]], tab, (t) => { location.hash = "#/m/" + id + "/" + t; });
    if (tab === "lesson") {
      if (m.quickCheck && m.quickCheck.length) {
        const qc = el('<div class="lesson-section"><h3>Already know this? Try 2 quick questions</h3><p class="small muted">Get both right on the first try and you can skip straight to the drill.</p><div class="qc-cards"></div><div class="qc-verdict"></div></div>');
        root.appendChild(qc);
        const ids = m.quickCheck.filter((x) => findQuestion(x));
        ids.forEach((qid, i) => {
          const f = findQuestion(qid);
          qc.querySelector(".qc-cards").appendChild(questionCard(contentController(f.q, f.m), "Quick check " + (i + 1)));
        });
        const verdict = () => {
          const firsts = ids.map((qid) => (state.results["c:" + qid] || {}).first);
          if (firsts.every((x) => x === 1)) {
            qc.querySelector(".qc-verdict").innerHTML = '<div class="alert alert-success mb-0">Both right first try. You can skip the reading. <a href="#/m/' + id + '/drill" class="alert-link">Go to the drill</a>.</div>';
          } else if (firsts.every((x) => x !== null && x !== undefined)) {
            qc.querySelector(".qc-verdict").innerHTML = '<div class="alert alert-info mb-0">Read the lesson below, then do the drill.</div>';
          }
        };
        qc.addEventListener("click", (e) => { if (e.target.closest(".act-grade")) setTimeout(verdict, 0); });
        verdict();
      }
      (m.lesson || []).forEach((s) => {
        const sec = el('<div class="lesson-section lesson-body"><h3>' + esc(s.title) + "</h3>" + s.html + "</div>");
        root.appendChild(sec);
        upgradeCodeBlocks(sec);
      });
      root.appendChild(el('<div class="text-end"><a class="btn btn-pl" href="#/m/' + id + '/drill">Start the drill</a></div>'));
    } else {
      const filterBar = el('<div class="d-flex gap-2 flex-wrap mb-3 align-items-center"><span class="small muted">Show:</span></div>');
      const filters = [["all", "All"], ["core", "Core"], ["exam+", "Exam+"], ["unsolved", "Not solved yet"]];
      let current = sessionFilter[id] || "all";
      filters.forEach(([f, label]) => {
        const b = el('<button class="btn btn-sm ' + (f === current ? "btn-pl" : "btn-outline-secondary") + '">' + label + "</button>");
        b.addEventListener("click", () => { sessionFilter[id] = f; pageModule(id, "drill"); });
        filterBar.appendChild(b);
      });
      root.appendChild(filterBar);
      let qs = m.questions || [];
      if (current === "core" || current === "exam+") qs = qs.filter((q) => q.difficulty === current);
      if (current === "unsolved") qs = qs.filter((q) => !((state.results["c:" + q.id] || {}).best >= 1));
      if (!qs.length) root.appendChild(el('<div class="alert alert-success">Nothing left in this filter. Nice.</div>'));
      qs.forEach((q, i) => root.appendChild(questionCard(contentController(q, m), "Q" + (i + 1) + ". " + m.title)));
    }
  }
  const sessionFilter = {};

  function pageSds(topic, tab) {
    const T = SDS_TOPICS[topic];
    const root = app();
    root.innerHTML = "";
    if (!T) { root.innerHTML = '<div class="alert alert-warning">Unknown topic.</div>'; return; }
    root.appendChild(el('<div class="mb-3"><span class="badge text-bg-primary section-pill">' + esc(T.section) + '</span><h1 class="h3 mt-1 mb-0">' + esc(T.title) + '</h1><div class="small muted">' + T.minutes + " min. Drill variants are generated, so you can practice without running out.</div></div>"));
    tab = tab || "lesson";
    tabs(root, [["lesson", "Lesson"], ["drill", "Drill"]], tab, (t) => { location.hash = "#/sds/" + topic + "/" + t; });
    if (!SDS()) {
      root.appendChild(el('<div class="alert alert-info">The ' + esc(T.title) + " drills are still being built. Check back in a few minutes.</div>"));
      return;
    }
    if (tab === "lesson") {
      const lessons = SDS_LESSONS()[topic] || [];
      if (!lessons.length) root.appendChild(el('<div class="alert alert-info">The lesson is still being written. The drill below works already.</div>'));
      lessons.forEach((s) => {
        const sec = el('<div class="lesson-section lesson-body"><h3>' + esc(s.title) + "</h3>" + s.html + '<div class="demo-host"></div></div>');
        root.appendChild(sec);
        upgradeCodeBlocks(sec);
        if (typeof s.demo === "function") {
          requestAnimationFrame(() => {
            try { s.demo(sec.querySelector(".demo-host")); } catch (e) { sec.querySelector(".demo-host").innerHTML = '<div class="alert alert-warning">Demo failed: ' + esc(e.message) + "</div>"; }
          });
        }
      });
      root.appendChild(el('<div class="text-end"><a class="btn btn-pl" href="#/sds/' + topic + '/drill">Start the drill</a></div>'));
      return;
    }
    const prefs = sdsPrefs[topic] || (sdsPrefs[topic] = { kind: T.kinds[0][0], difficulty: "core" });
    const wins = (state.sdsWins[topic] || []).length;
    const controls = el(
      '<div class="lesson-section"><div class="d-flex gap-3 flex-wrap align-items-end">' +
        '<div><label class="form-label small mb-1">Question type</label><select class="form-select form-select-sm kind-sel">' +
          T.kinds.map(([k, label]) => '<option value="' + k + '"' + (k === prefs.kind ? " selected" : "") + ">" + esc(label) + "</option>").join("") +
        "</select></div>" +
        '<div><label class="form-label small mb-1">Difficulty</label><div class="btn-group btn-group-sm d-flex">' +
          ["core", "exam+"].map((d) => '<button class="btn ' + (d === prefs.difficulty ? "btn-pl" : "btn-outline-secondary") + ' diff-btn" data-d="' + d + '">' + d + "</button>").join("") +
        "</div></div>" +
        '<div class="ms-auto text-end"><div class="stat-num">' + wins + " / " + SDS_TARGET + '</div><div class="small muted">variants solved</div></div>' +
      "</div></div>"
    );
    controls.querySelector(".kind-sel").addEventListener("change", (e) => { prefs.kind = e.target.value; pageSds(topic, "drill"); });
    controls.querySelectorAll(".diff-btn").forEach((b) => b.addEventListener("click", () => { prefs.difficulty = b.dataset.d; pageSds(topic, "drill"); }));
    root.appendChild(controls);
    const slot = document.createElement("div");
    root.appendChild(slot);
    let count = 0;
    const next = () => {
      count++;
      let ctrl;
      try { ctrl = sdsController(topic, { seed: newSeed(), difficulty: prefs.difficulty, kind: prefs.kind }); }
      catch (e) { slot.innerHTML = '<div class="alert alert-danger">Could not generate a question: ' + esc(e.message) + "</div>"; return; }
      slot.innerHTML = "";
      slot.appendChild(questionCard(ctrl, "Variant " + count + ". " + (ctrl.title || T.title), { onNext: next }));
    };
    next();
  }
  const sdsPrefs = {};

  function pageGym() {
    const root = app();
    root.innerHTML = "";
    root.appendChild(el(
      '<div class="mb-3"><span class="badge text-bg-primary section-pill">C coding, 10 points</span><h1 class="h3 mt-1 mb-1">C gym</h1>' +
      '<p class="muted mb-0">The exam\'s C question is graded by hidden tests in 10 groups. Groups 6 to 10 run memory checkers, so leaks and unchecked NULLs cost points even when the output is right. This gym grades you the same way on your own Mac.</p></div>'
    ));
    root.appendChild(el(
      '<div class="lesson-section"><h3>How to use it</h3><ol class="mb-2">' +
      "<li>Open a terminal and run <span class=\"kbd\">cd ~/cs61c-mt1/gym</span>.</li>" +
      "<li>Read <code>problems/q01_dup_ints/README.md</code>, then write your answer in <code>problems/q01_dup_ints/student.c</code>.</li>" +
      "<li>Run <span class=\"kbd\">./grade 1</span>. You get 10 groups marked PASS or FAIL, just like PrairieLearn.</li>" +
      "<li>Fix and re-run until you get 10/10. Then tick it below.</li></ol>" +
      '<div class="alert alert-warning mb-0"><b>Turn off AI autocomplete</b> (Cursor Tab, Copilot) while you practice. The exam editor has none, and closed book means you need to type <code>calloc61</code>, <code>memcpy</code> and the cleanup loop from memory. ' +
      "Open <code>solutions/</code> only after you pass or after 15 minutes stuck.</div></div>"
    ));
    const list = el('<div class="lesson-section"><h3>Problems</h3><p class="small muted">Problems 1 to 5 are the core set. 6 to 9 are harder, for extra practice or the mock exam.</p></div>');
    GYM.forEach((g) => {
      const row = el(
        '<div class="path-item' + (state.gym[g.n] ? " done" : "") + '">' +
          '<input class="form-check-input mt-0" type="checkbox" ' + (state.gym[g.n] ? "checked" : "") + ' aria-label="Passed 10 of 10">' +
          '<div class="flex-grow-1"><div class="path-title"><b>' + g.n + ".</b> <code>" + esc(g.fn) + "</code> " + (g.core ? '<span class="badge text-bg-light">core</span>' : '<span class="badge text-bg-warning">harder</span>') + "</div>" +
          '<div class="small muted">' + esc(g.what) + "</div></div>" +
          '<span class="kbd text-nowrap">./grade ' + g.n + "</span>" +
        "</div>"
      );
      row.querySelector("input").addEventListener("change", (e) => {
        if (e.target.checked) state.gym[g.n] = true; else delete state.gym[g.n];
        save();
        row.classList.toggle("done", e.target.checked);
      });
      list.appendChild(row);
    });
    root.appendChild(list);
    root.appendChild(el(
      '<div class="lesson-section lesson-body"><h3>The pattern behind every one of these</h3>' +
      "<ol><li>Allocate the outer thing with the exact size (<code>calloc61(n, sizeof(Record))</code>, never <code>sizeof(Record *)</code>).</li>" +
      "<li>Check it for <code>NULL</code> right away and return <code>NULL</code> if it failed.</li>" +
      "<li>In the loop, allocate each inner piece and check it too.</li>" +
      "<li>If an inner allocation fails, free every inner piece made so far, then the outer one, then return <code>NULL</code>.</li>" +
      "<li>Copy data with <code>memcpy(dst, src, count * sizeof(elem))</code>, and remember <code>strlen(s) + 1</code> bytes for a string.</li></ol>" +
      '<p class="mb-0">The full lesson is in <a href="#/m/c5-heap">C 5</a>. When you can do problems 4 and 5 cleanly, try the real <b>PM1.3 build_records</b> on PrairieLearn.</p></div>'
    ));
  }

  function pageWalk() {
    const root = app();
    root.innerHTML = '<h1 class="h3 mb-1">Practice exam answers</h1><p class="muted">Try each question on PrairieLearn first. Then open the walkthrough here. PrairieLearn gives you new variants every attempt, so seeing these answers does not spoil future practice.</p>';
    const walks = CONTENT().walkthroughs || [];
    const entries = [
      { id: "pm11", title: "PM1.1 CALL", from: "content" },
      { id: "pm12", title: "PM1.2 Memory regions", from: "content" },
      { id: "pm13", title: "PM1.3 C coding: build_records", from: "content" },
      { id: "pm14", title: "PM1.4 FSMs", from: "sds", n: 4, topic: "fsm" },
      { id: "pm15", title: "PM1.5 Timing", from: "sds", n: 5, topic: "timing" },
      { id: "pm16", title: "PM1.6 Boolean algebra", from: "sds", n: 6, topic: "bool" },
    ];
    entries.forEach((e) => {
      const sec = el('<div class="lesson-section"><div class="d-flex align-items-center gap-2 flex-wrap"><h3 class="mb-0 me-auto">' + esc(e.title) + '</h3><button class="btn btn-sm btn-pl reveal">I already tried it on PrairieLearn</button></div><div class="walk-body mt-3 d-none lesson-body"></div></div>');
      const body = sec.querySelector(".walk-body");
      sec.querySelector(".reveal").addEventListener("click", (ev) => {
        ev.target.remove();
        body.classList.remove("d-none");
        if (e.from === "content") {
          const w = walks.find((x) => x.id === e.id);
          body.innerHTML = w ? w.html : '<div class="alert alert-info mb-0">This walkthrough is still being written.</div>';
          upgradeCodeBlocks(body);
        } else if (!SDS() || !SDS().practiceQuestion) {
          body.innerHTML = '<div class="alert alert-info mb-0">This walkthrough is still being built.</div>';
        } else {
          let ctrl;
          try { ctrl = controllerFromRef({ type: "practice", n: e.n, topic: e.topic }); } catch (err) { body.innerHTML = '<div class="alert alert-danger mb-0">' + esc(err.message) + "</div>"; return; }
          const card = questionCard(ctrl, e.title + " (reproduction)");
          body.appendChild(card);
          requestAnimationFrame(() => requestAnimationFrame(() => card.__showSteps()));
        }
      });
      root.appendChild(sec);
    });
  }

  function pageMissed() {
    const root = app();
    root.innerHTML = '<h1 class="h3 mb-1">Missed questions</h1><p class="muted">Everything you got wrong, or peeked at before answering. Answer it fully right here and it leaves the list.</p>';
    const keys = Object.keys(state.missed);
    if (!keys.length) { root.appendChild(el('<div class="alert alert-success">Nothing missed yet.</div>')); return; }
    const clear = el('<div class="mb-3"><button class="btn btn-sm btn-outline-secondary">Clear the list</button></div>');
    clear.querySelector("button").addEventListener("click", () => { state.missed = {}; save(); renderNav(); pageMissed(); });
    root.appendChild(clear);
    keys.forEach((k, i) => {
      const ctrl = controllerFromRef(state.missed[k]);
      if (!ctrl) return;
      root.appendChild(questionCard(ctrl, "Missed " + (i + 1) + ". " + (ctrl.section || ""), { fromMissed: true }));
    });
  }

  // ---------- mock exam ----------
  let mockTimer = null;
  function pageMock() {
    const root = app();
    root.innerHTML = "";
    root.appendChild(el(
      '<div class="mb-3"><h1 class="h3 mb-1">Mock exam</h1><p class="muted mb-0">50 minutes, 20 points, exam+ difficulty. No notes, no calculator, no AI. ' +
      "Questions are graded only when you submit or the timer runs out.</p></div>"
    ));
    if (state.mocks.length) {
      root.appendChild(el('<div class="lesson-section"><h3>Past attempts</h3><ul class="mb-0">' + state.mocks.map((m) => "<li>" + esc(m.when) + ": <b>" + m.total + " / 20</b></li>").join("") + "</ul></div>"));
    }
    const notPassed = GYM.filter((g) => !g.core && !state.gym[g.n]);
    const cProblem = (notPassed.length ? shuffle(notPassed) : shuffle(GYM.filter((g) => !g.core)))[0];
    const start = el('<div class="lesson-section"><h3>Ready?</h3><p>Your C problem will be gym problem <b>' + cProblem.n + "</b> (<code>" + esc(cProblem.fn) + "</code>). Do it in your editor during the 50 minutes and enter its score at the end.</p>" +
      '<button class="btn btn-pl">Start the 50-minute mock</button></div>');
    root.appendChild(start);
    start.querySelector("button").addEventListener("click", () => runMock(cProblem));
  }

  function runMock(cProblem) {
    const root = app();
    root.innerHTML = "";
    const S = SDS();
    const parts = [];
    const call = findModule("call");
    const poolQ = call && (call.questions || []).find((q) => q.type === "dropdowns" && q.pool);
    if (poolQ) parts.push({ label: "Q1. CALL", ctrl: contentController(poolQ, call), pts: 2 });
    const regions = findModule("regions");
    const regQs = regions ? (regions.questions || []).filter((q) => q.type === "dropdowns" && q.difficulty === "exam+") : [];
    if (regQs.length) parts.push({ label: "Q2. Memory regions", ctrl: contentController(shuffle(regQs)[0], regions), pts: 2 });
    if (S) {
      [["fsm", "labels", "Q4. FSMs"], ["timing", "tmin_hold", "Q5. Timing"], ["bool", "circuit", "Q6. Boolean algebra"]].forEach(([topic, kind, label]) => {
        try { parts.push({ label, ctrl: sdsController(topic, { seed: newSeed(), difficulty: "exam+", kind }), pts: 2 }); } catch (e) { /* skip a broken generator */ }
      });
    }
    const timer = el('<div class="timer mb-3"><span>Time left <span class="clock">50:00</span></span><button class="btn btn-sm btn-pl">Submit exam</button></div>');
    root.appendChild(timer);
    const cards = parts.map((p) => {
      const card = questionCard(p.ctrl, p.label, { showFooter: false });
      root.appendChild(card);
      return card;
    });
    const cCard = el(
      '<div class="pl-card"><div class="pl-header">Q3. C coding (10 points)</div><div class="pl-body">' +
      "<p>In a terminal: <span class=\"kbd\">cd ~/cs61c-mt1/gym</span>, read <code>problems/" + esc(cProblem.dir) + "/README.md</code>, write <code>student.c</code>, and run <span class=\"kbd\">./grade " + cProblem.n + "</span> when you are done.</p>" +
      '<div class="input-group" style="max-width: 300px"><span class="input-group-text">Score</span><input class="form-control" inputmode="numeric" placeholder="0 to 10"><span class="input-group-text">/ 10</span></div></div></div>'
    );
    root.appendChild(cCard);
    let left = 50 * 60;
    clearInterval(mockTimer);
    const clock = timer.querySelector(".clock");
    const tick = () => {
      left--;
      const m = Math.max(0, Math.floor(left / 60)), s = Math.max(0, left % 60);
      clock.textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
      if (left <= 0) submit();
    };
    mockTimer = setInterval(tick, 1000);
    let submitted = false;
    function submit() {
      if (submitted) return;
      submitted = true;
      clearInterval(mockTimer);
      let total = 0;
      const rows = [];
      parts.forEach((p, i) => {
        const card = cards[i];
        let res;
        try { res = p.ctrl.grade(); } catch (e) { res = { score: 0, correct: false, feedbackHtml: esc(e.message) }; }
        recordResult(p.ctrl, res.score, {});
        total += res.score * p.pts;
        rows.push([p.label, res.score * p.pts, p.pts]);
        card.querySelector(".feedback-box").innerHTML = '<div class="alert ' + (res.correct ? "alert-success" : "alert-warning") + ' mb-0"><b>' + pct(res.score) + "%</b> " + (res.feedbackHtml || "") + "</div>";
        card.__showSteps();
      });
      const cScore = Math.max(0, Math.min(10, Number(cCard.querySelector("input").value) || 0));
      total += cScore;
      rows.splice(2, 0, ["Q3. C coding", cScore, 10]);
      total = Math.round(total * 10) / 10;
      state.mocks.push({ when: new Date().toLocaleString(), total });
      save();
      timer.innerHTML = '<span><b>Score: ' + total + " / 20</b></span>";
      const summary = el('<div class="lesson-section"><h3>Result: ' + total + ' / 20</h3><table class="table table-sm mb-2"><tbody>' +
        rows.map((r) => "<tr><td>" + esc(r[0]) + "</td><td class='text-end'>" + (Math.round(r[1] * 10) / 10) + " / " + r[2] + "</td></tr>").join("") +
        '</tbody></table><p class="small muted mb-0">Anything you lost points on is now in <a href="#/missed">Missed</a>. Worked solutions are open on each card below.</p></div>');
      root.insertBefore(summary, timer.nextSibling);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    timer.querySelector("button").addEventListener("click", () => { if (confirm("Submit the mock exam now?")) submit(); });
  }

  // ---------- router ----------
  function route() {
    if (!location.hash.startsWith("#/mock")) clearInterval(mockTimer);
    const parts = (location.hash || "#/home").slice(2).split("/");
    renderNav();
    window.scrollTo(0, 0);
    try {
      switch (parts[0]) {
        case "learn": return pageLearn();
        case "m": return pageModule(parts[1], parts[2]);
        case "sds": return pageSds(parts[1], parts[2]);
        case "gym": return pageGym();
        case "walk": return pageWalk();
        case "mock": return pageMock();
        case "missed": return pageMissed();
        default: return pageHome();
      }
    } catch (e) {
      console.error(e);
      app().innerHTML = '<div class="alert alert-danger">Something broke on this page: ' + esc(e.message) + "</div>";
    }
  }

  window.addEventListener("hashchange", route);
  Promise.all([new Promise((r) => (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", r) : r())), window.__codeReady]).then(route);
})();
