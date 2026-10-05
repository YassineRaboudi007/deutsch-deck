/* Deutsch Deck — offline German flashcard app (A2–B1)
   Data is provided by data/words.js (window.VOCAB) and data/patterns.js (window.PATTERNS). */
(function () {
  "use strict";

  var VOCAB = window.VOCAB || { batches: [] };
  var PATTERNS = window.PATTERNS || [];
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

    var list = el('<div class="plist"></div>');
    wrap.appendChild(list);

    function drawList(q) {
      q = (q || "").toLowerCase().trim();
      list.innerHTML = "";
      var lastCat = null, shown = 0;
      PATTERNS.forEach(function (p) {
        var hay = (p.formula + " " + p.note + " " + p.de + " " + p.en).toLowerCase();
        if (q && hay.indexOf(q) < 0) return;
        shown++;
        if (p.category && p.category !== lastCat) { list.appendChild(el('<div class="pcat">' + esc(p.category) + '</div>')); lastCat = p.category; }
        list.appendChild(el(
          '<div class="pcard">' +
            '<div class="pf"><span class="pnum">#' + p.num + '</span> ' + esc(p.formula) + '</div>' +
            (p.note ? '<div class="pn">' + esc(p.note) + '</div>' : '') +
            '<div class="pde">' + esc(p.de) + '</div>' +
            '<div class="pen">' + esc(p.en) + '</div>' +
          '</div>'
        ));
      });
      if (!shown) list.appendChild(el('<div class="empty">No patterns match “' + esc(q) + '”.</div>'));
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
            '<div class="pos-tag">' + esc(p.category || "Pattern") + '</div>' +
            '<div class="word-de" style="font-size:26px">' + esc(p.formula) + '</div>' +
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

  /* ---------- helpers ---------- */
  function renderMissing(what) {
    swap(el('<div class="empty"><div class="spinner"></div>The ' + esc(what) + ' data isn\'t loaded yet.<br>If this persists, the data file may still be generating.</div>'));
  }
  function swap(node) { app.innerHTML = ""; app.appendChild(node); window.scrollTo(0, 0); }

  route();
})();
