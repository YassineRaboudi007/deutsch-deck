/* Deutsch Deck — offline German flashcard app (A2–B1)
   Data is provided by data/words.js (window.VOCAB) and data/patterns.js (window.PATTERNS). */
(function () {
  "use strict";

  var VOCAB = window.VOCAB || { batches: [] };
  var PATTERNS = window.PATTERNS || [];
  var REDEMITTEL = window.REDEMITTEL || [];
  var SPRACHBAUSTEINE = window.SPRACHBAUSTEINE || [];
  var app = document.getElementById("app");

  /* ---------- persistence ---------- */
  var STORE_KEY = "deutschdeck.v1";
  var state = load();
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} }
  function known() { state.known = state.known || {}; return state.known; }        // key -> true
  function pKnown() { state.pknown = state.pknown || {}; return state.pknown; }     // pattern num -> true
  function wordKey(batchId, i) { return batchId + "#" + i; }
  function isKnown(batchId, i) { return !!known()[wordKey(batchId, i)]; }
  function batchKnownCount(b) {
    var k = known(), n = 0;
    for (var i = 0; i < b.words.length; i++) if (k[wordKey(b.id, i)]) n++;
    return n;
  }

  /* ---------- theme ---------- */
  var themeBtn = document.getElementById("themeBtn");
  function applyTheme() {
    var t = state.theme || "dark";
    document.documentElement.setAttribute("data-theme", t);
    themeBtn.textContent = t === "dark" ? "🌙" : "☀️";
  }
  themeBtn.onclick = function () { state.theme = (state.theme === "light") ? "dark" : "light"; save(); applyTheme(); };
  applyTheme();

  /* ---------- tabs ---------- */
  var tabs = document.querySelectorAll(".tabs button");
  tabs.forEach(function (t) {
    t.onclick = function () { location.hash = t.dataset.tab; };
  });
  function setActiveTab(name) {
    tabs.forEach(function (t) { t.classList.toggle("active", t.dataset.tab === name); });
  }

  /* ---------- util ---------- */
  function el(html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function totalWords() { var n = 0; VOCAB.batches.forEach(function (b) { n += b.words.length; }); return n; }
  function totalKnown() { var k = known(), n = 0; for (var key in k) if (k[key]) n++; return n; }

  /* ---------- router ---------- */
  window.addEventListener("hashchange", route);
  function route() {
    var h = location.hash.replace(/^#/, "");
    var parts = h.split("/");
    if (parts[0] === "study" && parts[1]) return renderStudy(parts[1], parts[2] === "review");
    if (parts[0] === "patterns") { setActiveTab("patterns"); return renderPatterns(); }
    if (parts[0] === "redemittel") { setActiveTab("redemittel"); return renderRedemittel(); }
    if (parts[0] === "bausteine") { setActiveTab("bausteine"); return renderBausteine(); }
    setActiveTab("vocab");
    return renderHome();
  }

  /* ---------- speech (voice reader) ---------- */
  var synth = window.speechSynthesis || null;
  var deVoice = null;
  function pickVoice() {
    if (!synth) return;
    var vs = synth.getVoices() || [];
    // prefer a real German (de-DE) voice; fall back to any de-*
    deVoice = vs.filter(function (v) { return /^de[-_]DE/i.test(v.lang); })[0]
           || vs.filter(function (v) { return /^de/i.test(v.lang); })[0] || null;
  }
  if (synth) { pickVoice(); if (typeof synth.onvoiceschanged !== "undefined") synth.onvoiceschanged = pickVoice; }
  function speak(text) {
    if (!synth || !text) return;
    try {
      synth.cancel();
      var u = new SpeechSynthesisUtterance(String(text));
      u.lang = "de-DE";
      if (deVoice) u.voice = deVoice;
      u.rate = 0.92;
      synth.speak(u);
    } catch (e) {}
  }
  // a small speaker button that reads the given German text; stops click-through to the flip
  function speakBtn(text, title) {
    var b = el('<button class="speak" title="' + esc(title || "Listen") + '" aria-label="' + esc(title || "Listen") + '">🔊</button>');
    b.onclick = function (ev) { ev.stopPropagation(); speak(text); };
    return b;
  }

  /* ---------- HOME (vocab batches) ---------- */
  function levelOf(b) { return /b1/i.test(b.level || "") ? "B1" : "A2"; }

  function renderHome() {
    if (!VOCAB.batches.length) return renderMissing("vocabulary");
    var filter = state.levelFilter || "all";                    // all | A2 | B1
    if (["all", "A2", "B1"].indexOf(filter) < 0) { filter = "all"; state.levelFilter = "all"; save(); }  // heal stale/legacy values
    var shownBatches = VOCAB.batches.filter(function (b) {
      return filter === "all" || levelOf(b) === filter;
    });

    // stats reflect the current filter
    var tw = 0, tk = 0;
    shownBatches.forEach(function (b) { tw += b.words.length; tk += batchKnownCount(b); });
    var pct = tw ? Math.round(tk / tw * 100) : 0;
    var wrap = el('<div></div>');

    wrap.appendChild(el(
      '<div class="hero">' +
        '<div class="stat"><div class="n accent">' + tw + '</div><div class="l">Words shown</div></div>' +
        '<div class="stat"><div class="n good">' + tk + '</div><div class="l">Words known</div></div>' +
        '<div class="stat"><div class="n">' + shownBatches.length + '</div><div class="l">Batches</div></div>' +
        '<div class="stat"><div class="n">' + pct + '%</div><div class="l">Progress</div></div>' +
      '</div>'
    ));

    // level filter chips
    var nAll = VOCAB.batches.length;
    var nA = VOCAB.batches.filter(function (b) { return levelOf(b) === "A2"; }).length;
    var nB = VOCAB.batches.filter(function (b) { return levelOf(b) === "B1"; }).length;
    var filterBar = el('<div class="toolbar" style="margin-top:18px"></div>');
    [["all", "All levels", nAll], ["A2", "A2", nA], ["B1", "B1", nB]].forEach(function (o) {
      if (o[0] === "B1" && nB === 0) return;                     // hide B1 chip until B1 data exists
      var c = el('<button class="chip' + (filter === o[0] ? ' active' : '') + '">' + o[1] + ' <span class="badge">' + o[2] + '</span></button>');
      c.onclick = function () { state.levelFilter = o[0]; save(); renderHome(); };
      filterBar.appendChild(c);
    });
    wrap.appendChild(filterBar);

    wrap.appendChild(el('<h2 class="section">Choose a batch</h2>'));
    var grid = el('<div class="grid"></div>');
    shownBatches.forEach(function (b, idx) {
      var kc = batchKnownCount(b), total = b.words.length;
      var pc = total ? Math.round(kc / total * 100) : 0;
      var lvl = levelOf(b);
      var card = el(
        '<div class="card">' +
          '<div class="cat"><span class="lvl lvl-' + (lvl === "B1" ? "b1" : "a") + '">' + esc(lvl) + '</span></div>' +
          '<div class="title">' + esc(b.title) + '</div>' +
          '<div class="meta"><span>' + total + ' words</span><span class="badge">' + kc + '/' + total + '</span></div>' +
          '<div class="bar"><span style="width:' + pc + '%"></span></div>' +
        '</div>'
      );
      card.onclick = function () { location.hash = "study/" + b.id; };
      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    swap(wrap);
  }

  /* ---------- STUDY ---------- */
  function renderStudy(batchId, reviewOnly) {
    var b = VOCAB.batches.filter(function (x) { return x.id === batchId; })[0];
    if (!b) return renderHome();

    // build the working set of card indices
    var indices = b.words.map(function (_, i) { return i; });
    if (reviewOnly) indices = indices.filter(function (i) { return !isKnown(b.id, i); });
    var order = shuffle(indices);
    if (!order.length) order = shuffle(b.words.map(function (_, i) { return i; }));
    var pos = 0, flipped = false;

    var view = el('<div class="study"></div>');

    var top = el(
      '<div class="study-top">' +
        '<button class="back">‹ All batches</button>' +
        '<div class="study-title">' + esc(b.title) + '</div>' +
      '</div>'
    );
    top.querySelector(".back").onclick = function () { location.hash = "vocab"; };
    view.appendChild(top);

    var toolbar = el('<div class="toolbar"></div>');
    var chipAll = el('<button class="chip' + (reviewOnly ? '' : ' active') + '">All words</button>');
    var chipRev = el('<button class="chip' + (reviewOnly ? ' active' : '') + '">Review not-known</button>');
    chipAll.onclick = function () { location.hash = "study/" + b.id; };
    chipRev.onclick = function () { location.hash = "study/" + b.id + "/review"; };
    toolbar.appendChild(chipAll); toolbar.appendChild(chipRev);
    view.appendChild(toolbar);

    var prog = el(
      '<div class="progress-wrap">' +
        '<div class="progress-line"><span></span></div>' +
        '<div class="progress-meta"><span class="pm-left"></span><span class="pm-right"></span></div>' +
      '</div>'
    );
    view.appendChild(prog);

    var cardHost = el('<div></div>');
    view.appendChild(cardHost);

    swap(view);
    draw();

    function draw() {
      if (pos >= order.length) return drawDone();
      var i = order[pos];
      var w = b.words[i];
      flipped = false;
      var kn = isKnown(b.id, i);
      var plural = w.plural ? '<div class="word-plural">pl. ' + esc(w.plural) + '</div>' : '';
      var posTag = w.pos ? '<div class="pos-tag">' + esc(w.pos) + '</div>' : '';
      var knownFlag = kn ? '<div class="known-flag">✓ known</div>' : '';

      // multiple meanings (senses)
      var meaningsHtml = "";
      if (w.meanings && w.meanings.length) {
        meaningsHtml = '<ol class="meanings">' + w.meanings.map(function (m) {
          return '<li><span class="m-en">' + esc(m.en || "") + '</span>' +
                 (m.de ? '<span class="m-de">' + esc(m.de) + '</span>' : '') + '</li>';
        }).join("") + '</ol>';
      }
      var ruleHtml = w.rule ? '<div class="rule"><span class="rule-i">ℹ</span> ' + esc(w.rule) + '</div>' : '';

      cardHost.innerHTML = "";
      var flip = el(
        '<div class="flip">' +
          '<div class="flip-inner">' +
            '<div class="face front">' + knownFlag + posTag +
              '<div class="word-de">' + esc(w.de) + '</div>' + plural +
              '<div class="front-audio"></div>' +
              '<div class="tap-hint">tap to reveal</div>' +
            '</div>' +
            '<div class="face back">' +
              '<div class="back-scroll">' +
                '<div class="word-en">' + esc(w.en) + '</div>' +
                meaningsHtml + ruleHtml +
                (w.example ? '<div class="ex">' +
                  '<div class="ex-row"><div class="de">' + esc(w.example) + '</div><span class="ex-audio" data-say="1"></span></div>' +
                  '<div class="en">' + esc(w.exampleEn || "") + '</div>' +
                  (w.example2 ? '<div class="ex-row ex2"><div class="de">' + esc(w.example2) + '</div><span class="ex-audio" data-say="2"></span></div>' +
                    '<div class="en">' + esc(w.example2En || "") + '</div>' : '') +
                '</div>' : '') +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
      flip.querySelector(".flip-inner").onclick = function () { flipped = !flipped; flip.classList.toggle("flipped", flipped); };
      // voice buttons
      flip.querySelector(".front-audio").appendChild(speakBtn(w.de, "Listen to the word"));
      var exAudio = flip.querySelectorAll(".ex-audio");
      if (exAudio[0]) exAudio[0].appendChild(speakBtn(w.example, "Listen"));
      if (exAudio[1]) exAudio[1].appendChild(speakBtn(w.example2, "Listen"));
      cardHost.appendChild(flip);

      var actions = el(
        '<div class="actions">' +
          '<button class="btn again">Still learning</button>' +
          '<button class="btn known">' + (kn ? "Known ✓" : "I know this") + '</button>' +
        '</div>'
      );
      actions.querySelector(".again").onclick = function () { known()[wordKey(b.id, i)] = false; save(); next(); };
      actions.querySelector(".known").onclick = function () { known()[wordKey(b.id, i)] = true; save(); next(); };
      cardHost.appendChild(actions);

      var nav = el(
        '<div class="nav">' +
          '<button class="btn prev">‹ Previous</button>' +
          '<button class="btn skip">Skip ›</button>' +
        '</div>'
      );
      nav.querySelector(".prev").onclick = function () { if (pos > 0) { pos--; draw(); } };
      nav.querySelector(".skip").onclick = function () { next(); };
      cardHost.appendChild(nav);

      var tools = el(
        '<div class="session-tools">' +
          '<button class="reshuffle">🔀 Reshuffle</button>' +
          '<button class="restart">↺ Restart batch</button>' +
        '</div>'
      );
      tools.querySelector(".reshuffle").onclick = function () { order = shuffle(order); pos = 0; draw(); };
      tools.querySelector(".restart").onclick = function () { pos = 0; draw(); };
      cardHost.appendChild(tools);

      updateProgress();
    }

    function next() { pos++; draw(); }

    function updateProgress() {
      var pct = order.length ? Math.round(pos / order.length * 100) : 0;
      prog.querySelector(".progress-line span").style.width = pct + "%";
      prog.querySelector(".pm-left").textContent = "Card " + Math.min(pos + 1, order.length) + " of " + order.length;
      prog.querySelector(".pm-right").textContent = batchKnownCount(b) + "/" + b.words.length + " known";
    }

    function drawDone() {
      prog.querySelector(".progress-line span").style.width = "100%";
      cardHost.innerHTML = "";
      var kc = batchKnownCount(b);
      var done = el(
        '<div class="done-card">' +
          '<div class="big">🎉</div>' +
          '<h2>Batch complete!</h2>' +
          '<p style="color:var(--muted)">You now know <b style="color:var(--good)">' + kc + '</b> of ' + b.words.length + ' words in “' + esc(b.title) + '”.</p>' +
          '<div class="actions" style="max-width:420px;margin:18px auto 0">' +
            '<button class="btn again again2">Review again</button>' +
            '<button class="btn known back3">Back to batches</button>' +
          '</div>' +
        '</div>'
      );
      done.querySelector(".again2").onclick = function () { order = shuffle(b.words.map(function (_, i) { return i; })); pos = 0; draw(); };
      done.querySelector(".back3").onclick = function () { location.hash = "vocab"; };
      cardHost.appendChild(done);
    }
  }

  /* ---------- PATTERNS ---------- */
  function renderPatterns() {
    if (!PATTERNS.length) return renderMissing("patterns");
    var wrap = el('<div></div>');
    var learned = 0; for (var i = 0; i < PATTERNS.length; i++) if (pKnown()[PATTERNS[i].num]) learned++;

    wrap.appendChild(el(
      '<div class="hero">' +
        '<div class="stat"><div class="n accent">' + PATTERNS.length + '</div><div class="l">Spoken patterns</div></div>' +
        '<div class="stat"><div class="n good">' + learned + '</div><div class="l">Marked learned</div></div>' +
        '<div class="stat"><div class="n">A1–B1</div><div class="l">Level</div></div>' +
      '</div>'
    ));

    var toolbar = el('<div class="toolbar"></div>');
    var input = el('<input class="search" placeholder="Search patterns (German or English)…">');
    var flipChip = el('<button class="chip">🔁 Flashcard mode</button>');
    toolbar.appendChild(input); toolbar.appendChild(flipChip);
    wrap.appendChild(toolbar);

    flipChip.onclick = function () { renderPatternCards(); };

    // ---- Group-by switch: Theme / Level / Grammar / Preposition ----
    var MODES = [
      { key: "category", label: "Theme" },
      { key: "level",    label: "Level" },
      { key: "group",    label: "Grammar" },
      { key: "prep",     label: "Preposition" }
    ];
    var mode = state.pgroup || "category";
    var gbwrap = el('<div class="gbwrap"><span class="gbl">Group by</span></div>');
    var chips = {};
    MODES.forEach(function (m) {
      var c = el('<button class="chip">' + m.label + '</button>');
      if (m.key === mode) c.classList.add("active");
      c.onclick = function () {
        mode = m.key; state.pgroup = mode; save();
        for (var k in chips) chips[k].classList.toggle("active", k === mode);
        drawList(input.value);
      };
      chips[m.key] = c; gbwrap.appendChild(c);
    });
    wrap.appendChild(gbwrap);

    var list = el('<div class="plist"></div>');
    wrap.appendChild(list);

    // bare preposition ("auf + Akk" -> "auf") used for the Preposition grouping
    function prepBase(p) { return p.prep ? p.prep.split(" ")[0] : null; }
    var NOPREP = "Ohne feste Präposition";
    var GRAMMAR_ORDER = ["Grundgerüst", "Modalverben", "Verb + Präposition", "Dativ-Verben",
      "Ort & Richtung", "Nebensätze & Infinitiv", "Konjunktiv II & Höflichkeit", "Redemittel & Fragen"];
    var LEVEL_ORDER = ["A1", "A2", "B1"];

    function groupKey(p) {
      if (mode === "level") return p.level || "–";
      if (mode === "group") return p.group || "–";
      if (mode === "prep") return prepBase(p) || NOPREP;
      return p.category || "–";
    }
    // order the section headings for the current mode
    function orderKeys(keys) {
      var ref = mode === "level" ? LEVEL_ORDER : mode === "group" ? GRAMMAR_ORDER : null;
      if (ref) {
        return keys.slice().sort(function (a, b) {
          var ia = ref.indexOf(a), ib = ref.indexOf(b);
          if (ia < 0) ia = 99; if (ib < 0) ib = 99;
          return ia - ib || a.localeCompare(b);
        });
      }
      // prep: alphabetical, but keep the "no preposition" bucket last
      if (mode === "prep") {
        return keys.slice().sort(function (a, b) {
          if (a === NOPREP) return 1; if (b === NOPREP) return -1;
          return a.localeCompare(b, "de");
        });
      }
      return keys; // category: preserve first-appearance order
    }

    function levelClass(lv) { return lv === "B1" ? "lvl-b1" : lv === "A2" ? "lvl-a2" : "lvl-a1"; }

    function drawList(q) {
      q = (q || "").toLowerCase().trim();
      list.innerHTML = "";
      var buckets = {}, seenOrder = [], shown = 0;
      PATTERNS.forEach(function (p) {
        var hay = (p.formula + " " + p.note + " " + p.de + " " + p.en + " " +
          (p.prep || "") + " " + (p.level || "") + " " + (p.group || "")).toLowerCase();
        if (q && hay.indexOf(q) < 0) return;
        shown++;
        var k = groupKey(p);
        if (!buckets[k]) { buckets[k] = []; seenOrder.push(k); }
        buckets[k].push(p);
      });
      if (!shown) { list.appendChild(el('<div class="empty">No patterns match “' + esc(q) + '”.</div>')); return; }

      var keys = mode === "category" ? seenOrder : orderKeys(seenOrder);
      keys.forEach(function (k) {
        var items = buckets[k];
        list.appendChild(el('<div class="pcat">' + esc(k) +
          '<span class="pcat-n">' + items.length + '</span></div>'));
        items.forEach(function (p) {
          var badges = '';
          if (p.level) badges += '<span class="lvl ' + levelClass(p.level) + '">' + esc(p.level) + '</span>';
          if (p.prep && mode !== "prep") badges += '<span class="prep">' + esc(p.prep) + '</span>';
          list.appendChild(el(
            '<div class="pcard">' +
              '<div class="pf"><span class="ff"><span class="pnum">#' + p.num + '</span> ' + esc(p.formula) + '</span>' + badges + '</div>' +
              (p.note ? '<div class="pn">' + esc(p.note) + '</div>' : '') +
              '<div class="pde">' + esc(p.de) + '</div>' +
              '<div class="pen">' + esc(p.en) + '</div>' +
            '</div>'
          ));
        });
      });
    }
    input.oninput = function () { drawList(input.value); };
    drawList("");
    swap(wrap);
  }

  function renderPatternCards() {
    var order = shuffle(PATTERNS.map(function (_, i) { return i; }));
    var pos = 0, flipped = false;
    var view = el('<div class="study"></div>');
    var top = el('<div class="study-top"><button class="back">‹ Pattern list</button><div class="study-title">Pattern practice</div></div>');
    top.querySelector(".back").onclick = function () { renderPatterns(); };
    view.appendChild(top);
    var prog = el('<div class="progress-wrap"><div class="progress-line"><span></span></div><div class="progress-meta"><span class="pm-left"></span><span class="pm-right"></span></div></div>');
    view.appendChild(prog);
    var host = el('<div></div>'); view.appendChild(host);
    swap(view); draw();

    function draw() {
      if (pos >= order.length) { host.innerHTML = '<div class="done-card"><div class="big">🎉</div><h2>All patterns reviewed!</h2><div class="actions" style="max-width:420px;margin:18px auto 0"><button class="btn known b">Back to list</button></div></div>'; host.querySelector(".b").onclick = function () { renderPatterns(); }; prog.querySelector(".progress-line span").style.width = "100%"; return; }
      var p = PATTERNS[order[pos]];
      flipped = false;
      host.innerHTML = "";
      var flip = el(
        '<div class="flip"><div class="flip-inner">' +
          '<div class="face front">' +
            '<div class="pos-tag">' + esc(p.group || p.category || "Pattern") +
              (p.level ? ' · <span class="lvl ' + (p.level === "B1" ? "lvl-b1" : p.level === "A2" ? "lvl-a2" : "lvl-a1") + '">' + esc(p.level) + '</span>' : '') +
            '</div>' +
            '<div class="word-de" style="font-size:26px">' + esc(p.formula) + '</div>' +
            (p.prep ? '<div style="margin-top:8px"><span class="prep">' + esc(p.prep) + '</span></div>' : '') +
            (p.note ? '<div class="word-plural">' + esc(p.note) + '</div>' : '') +
            '<div class="tap-hint">tap for example</div>' +
          '</div>' +
          '<div class="face back">' +
            '<div class="ex" style="border:none"><div class="de" style="font-size:20px">' + esc(p.de) + '</div><div class="en" style="font-size:15px;margin-top:8px">' + esc(p.en) + '</div></div>' +
          '</div>' +
        '</div></div>'
      );
      flip.querySelector(".flip-inner").onclick = function () { flipped = !flipped; flip.classList.toggle("flipped", flipped); };
      host.appendChild(flip);
      var nav = el('<div class="nav"><button class="btn prev">‹ Previous</button><button class="btn skip">Next ›</button></div>');
      nav.querySelector(".prev").onclick = function () { if (pos > 0) { pos--; draw(); } };
      nav.querySelector(".skip").onclick = function () { pos++; draw(); };
      host.appendChild(nav);
      var pct = Math.round(pos / order.length * 100);
      prog.querySelector(".progress-line span").style.width = pct + "%";
      prog.querySelector(".pm-left").textContent = "Pattern " + (pos + 1) + " of " + order.length;
      prog.querySelector(".pm-right").textContent = "#" + p.num;
    }
  }

  /* ---------- REDEMITTEL (chunk bank for speaking + writing) ---------- */
  function renderRedemittel() {
    if (!REDEMITTEL.length) return renderMissing("Redemittel");
    var wrap = el('<div></div>');
    var funcs = {}; REDEMITTEL.forEach(function (r) { funcs[r.func] = 1; });
    wrap.appendChild(el(
      '<div class="hero">' +
        '<div class="stat"><div class="n accent">' + REDEMITTEL.length + '</div><div class="l">Redemittel (chunks)</div></div>' +
        '<div class="stat"><div class="n good">' + Object.keys(funcs).length + '</div><div class="l">Situations</div></div>' +
        '<div class="stat"><div class="n">Sprechen · Brief</div><div class="l">For speaking & writing</div></div>' +
      '</div>'
    ));
    var toolbar = el('<div class="toolbar"></div>');
    var input = el('<input class="search" placeholder="Search Redemittel (German or English)…">');
    var flipChip = el('<button class="chip">🔁 Flashcard mode</button>');
    toolbar.appendChild(input); toolbar.appendChild(flipChip);
    wrap.appendChild(toolbar);
    flipChip.onclick = function () { renderRedemittelCards(); };

    var list = el('<div class="plist"></div>');
    wrap.appendChild(list);

    function drawList(q) {
      q = (q || "").toLowerCase().trim();
      list.innerHTML = "";
      var buckets = {}, order = [], shown = 0;
      REDEMITTEL.forEach(function (r) {
        var hay = (r.de + " " + r.en + " " + r.func + " " + (r.use || "")).toLowerCase();
        if (q && hay.indexOf(q) < 0) return;
        shown++;
        if (!buckets[r.func]) { buckets[r.func] = []; order.push(r.func); }
        buckets[r.func].push(r);
      });
      if (!shown) { list.appendChild(el('<div class="empty">No Redemittel match “' + esc(q) + '”.</div>')); return; }
      order.forEach(function (f) {
        var items = buckets[f];
        list.appendChild(el('<div class="pcat">' + esc(f) + '<span class="pcat-n">' + items.length + '</span></div>'));
        items.forEach(function (r) {
          list.appendChild(el(
            '<div class="pcard">' +
              '<div class="pf"><span class="ff">' + esc(r.de) + '</span>' +
                (r.use ? '<span class="use">' + esc(r.use) + '</span>' : '') + '</div>' +
              '<div class="pen">' + esc(r.en) + '</div>' +
            '</div>'
          ));
        });
      });
    }
    input.oninput = function () { drawList(input.value); };
    drawList("");
    swap(wrap);
  }

  function renderRedemittelCards() {
    var order = shuffle(REDEMITTEL.map(function (_, i) { return i; }));
    var pos = 0, flipped = false;
    var view = el('<div class="study"></div>');
    var top = el('<div class="study-top"><button class="back">‹ Redemittel list</button><div class="study-title">Redemittel practice</div></div>');
    top.querySelector(".back").onclick = function () { renderRedemittel(); };
    view.appendChild(top);
    var prog = el('<div class="progress-wrap"><div class="progress-line"><span></span></div><div class="progress-meta"><span class="pm-left"></span><span class="pm-right"></span></div></div>');
    view.appendChild(prog);
    var host = el('<div></div>'); view.appendChild(host);
    swap(view); draw();

    function draw() {
      if (pos >= order.length) {
        host.innerHTML = '<div class="done-card"><div class="big">🎉</div><h2>All Redemittel reviewed!</h2><div class="actions" style="max-width:420px;margin:18px auto 0"><button class="btn known b">Back to list</button></div></div>';
        host.querySelector(".b").onclick = function () { renderRedemittel(); };
        prog.querySelector(".progress-line span").style.width = "100%"; return;
      }
      var r = REDEMITTEL[order[pos]];
      flipped = false;
      host.innerHTML = "";
      var flip = el(
        '<div class="flip"><div class="flip-inner">' +
          '<div class="face front">' +
            '<div class="pos-tag">' + esc(r.func) + '</div>' +
            '<div class="word-en" style="font-size:22px">' + esc(r.en) + '</div>' +
            (r.use ? '<div style="margin-top:10px"><span class="use">' + esc(r.use) + '</span></div>' : '') +
            '<div class="tap-hint">tap for German</div>' +
          '</div>' +
          '<div class="face back">' +
            '<div class="word-de" style="font-size:24px">' + esc(r.de) + '</div>' +
          '</div>' +
        '</div></div>'
      );
      flip.querySelector(".flip-inner").onclick = function () { flipped = !flipped; flip.classList.toggle("flipped", flipped); };
      host.appendChild(flip);
      var nav = el('<div class="nav"><button class="btn prev">‹ Previous</button><button class="btn skip">Next ›</button></div>');
      nav.querySelector(".prev").onclick = function () { if (pos > 0) { pos--; draw(); } };
      nav.querySelector(".skip").onclick = function () { pos++; draw(); };
      host.appendChild(nav);
      prog.querySelector(".progress-line span").style.width = Math.round(pos / order.length * 100) + "%";
      prog.querySelector(".pm-left").textContent = "Card " + (pos + 1) + " of " + order.length;
      prog.querySelector(".pm-right").textContent = "#" + r.num;
    }
  }

  /* ---------- SPRACHBAUSTEINE (grammar/vocab gap-fill drill) ---------- */
  function renderBausteine() {
    if (!SPRACHBAUSTEINE.length) return renderMissing("Sprachbausteine");
    var best = state.bausteineBest || {};
    var wrap = el('<div></div>');
    wrap.appendChild(el(
      '<div class="hero">' +
        '<div class="stat"><div class="n accent">' + SPRACHBAUSTEINE.length + '</div><div class="l">Drill questions</div></div>' +
        '<div class="stat"><div class="n good">' + (best.all != null ? best.all + "%" : "–") + '</div><div class="l">Best score</div></div>' +
        '<div class="stat"><div class="n">Teil 1 · 2</div><div class="l">telc B1 Sprachbausteine</div></div>' +
      '</div>'
    ));
    wrap.appendChild(el('<h2 class="section">Choose a set</h2>'));
    var SETS = [
      { key: "all", label: "All questions", filter: function () { return true; } },
      { key: "t1", label: "Teil 1 · Grammar", filter: function (x) { return x.teil === 1; } },
      { key: "t2", label: "Teil 2 · Vocab & connectors", filter: function (x) { return x.teil === 2; } }
    ];
    var box = el('<div class="toolbar"></div>');
    SETS.forEach(function (s) {
      var n = SPRACHBAUSTEINE.filter(s.filter).length;
      var chip = el('<button class="chip">' + esc(s.label) + '<span class="badge">' + n + '</span></button>');
      chip.onclick = function () { startDrill(s); };
      box.appendChild(chip);
    });
    wrap.appendChild(box);
    wrap.appendChild(el('<div class="empty" style="padding:30px 20px">Pick a set above to start. You get instant feedback and a short explanation after each answer.</div>'));
    swap(wrap);
  }

  function startDrill(set) {
    var pool = shuffle(SPRACHBAUSTEINE.filter(set.filter));
    var pos = 0, correct = 0, answered = false;
    var view = el('<div class="quiz"></div>');
    var top = el('<div class="study-top"><button class="back">‹ Sets</button><div class="study-title">' + esc(set.label) + '</div></div>');
    top.querySelector(".back").onclick = function () { renderBausteine(); };
    view.appendChild(top);
    var prog = el('<div class="progress-wrap"><div class="progress-line"><span></span></div><div class="progress-meta"><span class="pm-left"></span><span class="pm-right"></span></div></div>');
    view.appendChild(prog);
    var host = el('<div></div>'); view.appendChild(host);
    swap(view); draw();

    function finish() {
      var pct = Math.round(correct / pool.length * 100);
      var best = state.bausteineBest || {};
      var prev = best[set.key];
      if (prev == null || pct > prev) { best[set.key] = pct; state.bausteineBest = best; save(); }
      host.innerHTML = '<div class="done-card"><div class="big">' + (pct >= 60 ? "🎉" : "💪") + '</div>' +
        '<h2>' + correct + ' / ' + pool.length + ' correct (' + pct + '%)</h2>' +
        '<div style="color:var(--muted);margin-top:6px">' + (pct >= 60 ? "That's above the 60% telc pass line." : "Below the 60% pass line — keep drilling.") + '</div>' +
        '<div class="actions" style="max-width:420px;margin:18px auto 0">' +
          '<button class="btn again a">Retry set</button><button class="btn known b">Back to sets</button></div></div>';
      host.querySelector(".a").onclick = function () { startDrill(set); };
      host.querySelector(".b").onclick = function () { renderBausteine(); };
      prog.querySelector(".progress-line span").style.width = "100%";
      prog.querySelector(".pm-left").textContent = "Done";
      prog.querySelector(".pm-right").textContent = pct + "%";
    }

    function draw() {
      if (pos >= pool.length) return finish();
      answered = false;
      var it = pool[pos];
      host.innerHTML = "";
      var parts = String(it.text).split("___");
      var sentence = esc(parts[0]) + '<span class="gap">?</span>' + esc(parts[1] || "");
      var card = el(
        '<div class="q-card">' +
          '<div class="q-topic"><span>' + esc(it.topic) + '</span>' +
            '<span class="lvl ' + (it.level === "B1" ? "lvl-b1" : it.level === "A2" ? "lvl-a2" : "lvl-a1") + '">' + esc(it.level) + '</span>' +
            '<span class="use">Teil ' + it.teil + '</span></div>' +
          '<div class="q-sentence">' + sentence + '</div>' +
          '<div class="q-opts"></div>' +
        '</div>'
      );
      var opts = card.querySelector(".q-opts");
      var gap = card.querySelector(".gap");
      it.options.forEach(function (opt, i) {
        var b = el('<button class="q-opt">' + esc(opt) + '</button>');
        b.onclick = function () {
          if (answered) return;
          answered = true;
          var btns = opts.querySelectorAll(".q-opt");
          btns.forEach(function (x) { x.disabled = true; });
          btns[it.answer].classList.add("correct");
          if (i === it.answer) { correct++; } else { b.classList.add("wrong"); }
          gap.textContent = it.options[it.answer];
          var ex = el('<div class="q-explain"><b>' + (i === it.answer ? "Richtig!" : "Nicht ganz.") + '</b> ' + esc(it.explain) + '</div>');
          card.appendChild(ex);
          var nextBtn = el('<button class="btn known q-next">' + (pos + 1 >= pool.length ? "See results ›" : "Next question ›") + '</button>');
          nextBtn.onclick = function () { pos++; draw(); };
          card.appendChild(nextBtn);
          prog.querySelector(".pm-right").textContent = correct + " correct";
        };
        opts.appendChild(b);
      });
      host.appendChild(card);
      prog.querySelector(".progress-line span").style.width = Math.round(pos / pool.length * 100) + "%";
      prog.querySelector(".pm-left").textContent = "Question " + (pos + 1) + " of " + pool.length;
      prog.querySelector(".pm-right").textContent = correct + " correct";
    }
  }

  /* ---------- helpers ---------- */
  function renderMissing(what) {
    swap(el('<div class="empty"><div class="spinner"></div>The ' + esc(what) + ' data isn\'t loaded yet.<br>If this persists, the data file may still be generating.</div>'));
  }
  function swap(node) { app.innerHTML = ""; app.appendChild(node); window.scrollTo(0, 0); }

  route();
})();
