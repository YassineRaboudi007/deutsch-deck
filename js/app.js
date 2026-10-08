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

  /* ---------- spaced repetition (lightweight Leitner) ----------
     srs[key] = { b: box 1..5, d: dueDay }. Higher box = longer interval.
     New (unseen) cards have no entry and are always "due". */
  var SET_SIZE = 10;
  var BOX_DAYS = [0, 1, 2, 4, 8, 16];   // interval in days, indexed by box (1..5)
  function today() { return Math.floor(Date.now() / 86400000); }
  function srs() { state.srs = state.srs || {}; return state.srs; }
  function srsOf(key) { return srs()[key] || null; }
  function isDue(key) { var s = srsOf(key); return !s || today() >= s.d; }
  function srsBox(key) { var s = srsOf(key); return s ? s.b : 0; }
  // grade a card: good=true bumps the box, good=false drops it back to box 1
  function grade(key, good) {
    var s = srsOf(key) || { b: 0, d: 0 };
    s.b = good ? Math.min(5, s.b + 1) : 1;
    s.d = today() + BOX_DAYS[s.b];
    srs()[key] = s;
  }
  // order a list of {batchId,i} working items: new & due first, then by box, stable-ish random
  function srsOrder(items) {
    return shuffle(items).sort(function (a, b) {
      var pa = prio(a), pb = prio(b);
      return pa - pb;
    });
    function prio(it) {
      var k = wordKey(it.batchId, it.i), s = srsOf(k);
      if (!s) return 0;                       // brand-new → first
      if (today() >= s.d) return 1 + s.b * 0.01; // due → next, lower boxes before higher
      return 10 + s.b;                        // not yet due → last
    }
  }

  /* ---------- word-family index (related forms share a stem) ---------- */
  var FAMILY = null;
  function stemOf(de) {
    var s = String(de || "").toLowerCase().replace(/^(der|die|das)\s+/, "").trim();
    s = s.split(/[\s,(/]/)[0];                // first token only
    s = s.replace(/[^a-zäöüß]/g, "");
    // strip very common inflectional endings so Abfahrt↔abfahren, Arbeit↔arbeiten group
    s = s.replace(/(ungen|ung|keit|heit|tion|en|er|es|em|et|st|te|n|e|t)$/,'');
    return s;
  }
  function buildFamily() {
    FAMILY = {};
    var byStem = {};
    VOCAB.batches.forEach(function (b) {
      b.words.forEach(function (w, i) {
        var st = stemOf(w.de);
        if (st.length < 4) return;            // too short to be meaningful
        (byStem[st] = byStem[st] || []).push({ batchId: b.id, i: i, w: w });
      });
    });
    for (var st in byStem) {
      var grp = byStem[st];
      if (grp.length < 2) continue;
      grp.forEach(function (item) {
        FAMILY[wordKey(item.batchId, item.i)] = grp;
      });
    }
  }
  // related forms for a given word (excludes itself), capped
  function relatedOf(batchId, i, w) {
    if (!FAMILY) buildFamily();
    var grp = FAMILY[wordKey(batchId, i)];
    if (!grp) return [];
    var self = w.de;
    var out = [];
    grp.forEach(function (it) {
      if (it.w.de === self) return;
      if (out.length >= 4) return;
      out.push(it.w);
    });
    return out;
  }

  // words that have been studied and are due again today (for Smart review)
  function collectDue(batches) {
    var out = [];
    batches.forEach(function (b) {
      b.words.forEach(function (_, i) {
        var k = wordKey(b.id, i), s = srsOf(k);
        if (s && s.b < 5 && today() >= s.d) out.push({ batchId: b.id, i: i });
      });
    });
    return out;
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
    if (parts[0] === "review" && parts[1] === "due") { setActiveTab("vocab"); return renderDueReview(); }
    if (parts[0] === "study" && parts[1]) {
      setActiveTab("vocab");
      var mode = parts[2];
      if (!mode) return renderBatchOverview(parts[1]);                 // set picker
      if (mode === "all") return renderStudy(parts[1], { mode: "all" });
      if (mode === "review") return renderStudy(parts[1], { mode: "review" });
      if (/^s\d+$/.test(mode)) return renderStudy(parts[1], { mode: "set", set: parseInt(mode.slice(1), 10) });
      return renderBatchOverview(parts[1]);
    }
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

    // Smart review: words already seen that are due again (spaced repetition), across shown batches
    var dueItems = collectDue(shownBatches);
    if (dueItems.length) {
      var rv = el(
        '<button class="bigbtn accent" style="margin-top:16px">' +
          '<span class="bb-ic">🧠</span>' +
          '<span><span class="bb-t">Smart review</span>' +
          '<span class="bb-s">Words due for review today, newest-forgotten first</span></span>' +
          '<span class="bb-badge">' + dueItems.length + ' due</span>' +
        '</button>'
      );
      rv.onclick = function () { location.hash = "review/due"; };
      wrap.appendChild(rv);
    }

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

  /* ---------- BATCH OVERVIEW (set picker — bundles 50 words into sets of ~10) ---------- */
  function renderBatchOverview(batchId) {
    var b = VOCAB.batches.filter(function (x) { return x.id === batchId; })[0];
    if (!b) return renderHome();
    var total = b.words.length, kc = batchKnownCount(b), pc = total ? Math.round(kc / total * 100) : 0;
    var notKnown = total - kc;
    var nSets = Math.ceil(total / SET_SIZE);
    var lvl = levelOf(b);

    var view = el('<div class="study"></div>');
    var top = el(
      '<div class="study-top">' +
        '<button class="back">‹ All batches</button>' +
        '<div class="study-title">' + esc(b.title) + '</div>' +
      '</div>'
    );
    top.querySelector(".back").onclick = function () { location.hash = "vocab"; };
    view.appendChild(top);

    view.appendChild(el(
      '<div class="ov-head"><span class="lvl lvl-' + (lvl === "B1" ? "b1" : "a") + '">' + esc(lvl) + '</span>' +
      '<span class="ov-sub">' + total + ' words · ' + kc + ' known</span></div>'
    ));
    view.appendChild(el('<div class="progress-line" style="margin:2px 0 18px"><span style="width:' + pc + '%"></span></div>'));

    // whole-batch sessions
    var big = el('<div class="bigbtns"></div>');
    var bAll = el('<button class="bigbtn"><span class="bb-ic">📚</span><span><span class="bb-t">Study all ' + total + '</span><span class="bb-s">Full batch, spaced order</span></span></button>');
    bAll.onclick = function () { location.hash = "study/" + b.id + "/all"; };
    big.appendChild(bAll);
    if (notKnown > 0) {
      var bRev = el('<button class="bigbtn"><span class="bb-ic">🔁</span><span><span class="bb-t">Review not-known</span><span class="bb-s">Focus the ' + notKnown + ' still to learn</span></span></button>');
      bRev.onclick = function () { location.hash = "study/" + b.id + "/review"; };
      big.appendChild(bRev);
    }
    view.appendChild(big);

    // study-in-sets grid
    view.appendChild(el('<h2 class="section" style="margin-top:6px">Study in sets of ' + SET_SIZE + '</h2>'));
    var sg = el('<div class="setgrid"></div>');
    for (var s = 0; s < nSets; s++) {
      var from = s * SET_SIZE, to = Math.min(total, from + SET_SIZE);
      var skc = 0;
      for (var j = from; j < to; j++) if (isKnown(b.id, j)) skc++;
      var cnt = to - from, allKnown = skc === cnt;
      var sc = el(
        '<div class="setcard' + (allKnown ? ' done' : '') + '">' +
          (allKnown ? '<span class="sc-check">✓</span>' : '') +
          '<div class="sc-n">Set ' + (s + 1) + '</div>' +
          '<div class="sc-t">' + esc(b.words[from].de.replace(/^(der|die|das)\s+/, '')) + ' …</div>' +
          '<div class="meta" style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--muted)"><span>' + cnt + ' words</span><span class="badge">' + skc + '/' + cnt + '</span></div>' +
          '<div class="bar"><span style="width:' + (cnt ? Math.round(skc / cnt * 100) : 0) + '%"></span></div>' +
        '</div>'
      );
      (function (setNo) { sc.onclick = function () { location.hash = "study/" + b.id + "/s" + setNo; }; })(s + 1);
      sg.appendChild(sc);
    }
    view.appendChild(sg);
    swap(view);
  }

  /* ---------- STUDY (vocab session engine) ---------- */
  function renderStudy(batchId, opts) {
    var b = VOCAB.batches.filter(function (x) { return x.id === batchId; })[0];
    if (!b) return renderHome();
    opts = opts || { mode: "all" };

    var idxs = b.words.map(function (_, i) { return i; });
    var setLabel = "";
    if (opts.mode === "review") {
      idxs = idxs.filter(function (i) { return !isKnown(b.id, i); });
    } else if (opts.mode === "set") {
      var s = Math.max(0, (opts.set || 1) - 1);
      idxs = idxs.slice(s * SET_SIZE, s * SET_SIZE + SET_SIZE);
      setLabel = "Set " + (s + 1);
    }
    if (!idxs.length) idxs = b.words.map(function (_, i) { return i; });   // review-empty fallback

    var items = idxs.map(function (i) {
      return { batchId: b.id, b: b, i: i, w: b.words[i], key: wordKey(b.id, i) };
    });

    // mode toolbar (All / Review not-known)
    var toolbar = el('<div class="toolbar"></div>');
    var chipAll = el('<button class="chip' + (opts.mode === "all" ? " active" : "") + '">All words</button>');
    var chipRev = el('<button class="chip' + (opts.mode === "review" ? " active" : "") + '">Review not-known</button>');
    chipAll.onclick = function () { location.hash = "study/" + b.id + "/all"; };
    chipRev.onclick = function () { location.hash = "study/" + b.id + "/review"; };
    toolbar.appendChild(chipAll); toolbar.appendChild(chipRev);

    runSession({
      items: items,
      title: b.title + (setLabel ? " · " + setLabel : ""),
      backLabel: "‹ Sets", backHash: "study/" + b.id,
      toolbar: toolbar, statBatch: b, allowReshuffle: true
    });
  }

  /* ---------- SMART REVIEW (spaced, across the current level) ---------- */
  function renderDueReview() {
    var filter = state.levelFilter || "all";
    var batches = VOCAB.batches.filter(function (b) { return filter === "all" || levelOf(b) === filter; });
    var due = collectDue(batches);
    if (!due.length) {
      var v = el('<div class="study"></div>');
      v.appendChild(el('<div class="study-top"><button class="back">‹ All batches</button><div class="study-title">Smart review</div></div>'));
      v.querySelector(".back").onclick = function () { location.hash = "vocab"; };
      v.appendChild(el('<div class="done-card"><div class="big">🎉</div><h2>Nothing due right now</h2><p style="color:var(--muted)">You\'re caught up. Study a batch to add more words to your review queue.</p></div>'));
      swap(v);
      return;
    }
    var items = due.slice(0, 40).map(function (d) {
      var bb = VOCAB.batches.filter(function (x) { return x.id === d.batchId; })[0];
      return { batchId: d.batchId, b: bb, i: d.i, w: bb.words[d.i], key: wordKey(d.batchId, d.i) };
    });
    runSession({
      items: items, title: "Smart review", backLabel: "‹ All batches", backHash: "vocab",
      dueMode: true, allowReshuffle: true
    });
  }

  /* ---------- shared card engine ---------- */
  function runSession(cfg) {
    var order = srsOrder(cfg.items.slice());
    var pos = 0, flipped = false;

    var view = el('<div class="study"></div>');
    var top = el(
      '<div class="study-top">' +
        '<button class="back">' + esc(cfg.backLabel || "‹ Back") + '</button>' +
        '<div class="study-title">' + esc(cfg.title) + '</div>' +
      '</div>'
    );
    top.querySelector(".back").onclick = function () { location.hash = cfg.backHash || "vocab"; };
    view.appendChild(top);
    if (cfg.toolbar) view.appendChild(cfg.toolbar);

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

    // keyboard: space/enter flip · ←/→ nav · 1 still-learning · 2 known
    setKeys(function (e) {
      var tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (pos >= order.length) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleFlip(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); if (pos > 0) { pos--; draw(); } }
      else if (e.key === "1") { e.preventDefault(); gradeCurrent(false); }
      else if (e.key === "2") { e.preventDefault(); gradeCurrent(true); }
    });

    var curFlip = null;
    function toggleFlip() { if (!curFlip) return; flipped = !flipped; curFlip.classList.toggle("flipped", flipped); }
    function gradeCurrent(good) {
      var it = order[pos]; if (!it) return;
      known()[it.key] = good; grade(it.key, good); save(); next();
    }
    function next() { pos++; draw(); }

    draw();

    function draw() {
      if (pos >= order.length) return drawDone();
      var it = order[pos], w = it.w, i = it.i, b = it.b;
      flipped = false;
      var kn = isKnown(b.id, i);
      var box = srsBox(it.key);
      var plural = w.plural ? '<div class="word-plural">pl. ' + esc(w.plural) + '</div>' : '';
      var posTag = w.pos ? '<div class="pos-tag">' + esc(w.pos) + '</div>' : '';
      var knownFlag = kn ? '<div class="known-flag">✓ known</div>' : '';
      // Leitner box dots (progress through the spaced-repetition ladder)
      var dots = '<div class="srs-dot">';
      for (var d = 1; d <= 5; d++) dots += '<i class="' + (d <= box ? "on" : "") + '"></i>';
      dots += '</div>';

      var meaningsHtml = "";
      if (w.meanings && w.meanings.length) {
        meaningsHtml = '<ol class="meanings">' + w.meanings.map(function (m) {
          return '<li><span class="m-en">' + esc(m.en || "") + '</span>' +
                 (m.de ? '<span class="m-de">' + esc(m.de) + '</span>' : '') + '</li>';
        }).join("") + '</ol>';
      }
      var ruleHtml = w.rule ? '<div class="rule"><span class="rule-i">ℹ</span> ' + esc(w.rule) + '</div>' : '';

      // related forms (word family) — learn connected words as a bundle
      var rel = relatedOf(b.id, i, w);
      var relHtml = "";
      if (rel.length) {
        relHtml = '<div class="rel"><div class="rel-h">Word family</div>' + rel.map(function (r) {
          return '<div class="rel-item"><span class="rel-de">' + esc(r.de) + '</span>' +
                 (r.pos ? '<span class="rel-pos">' + esc(r.pos.slice(0, 4)) + '</span>' : '') +
                 '<span class="rel-en">' + esc(r.en) + '</span></div>';
        }).join("") + '</div>';
      }

      var srcTag = cfg.dueMode ? ' <span class="due-tag">' + esc(b.title) + '</span>' : '';

      cardHost.innerHTML = "";
      var flip = el(
        '<div class="flip">' +
          '<div class="flip-inner">' +
            '<div class="face front">' + dots + knownFlag + posTag +
              '<div class="word-de">' + esc(w.de) + '</div>' + plural +
              '<div class="front-audio"></div>' +
              '<div class="tap-hint">tap to reveal</div>' +
            '</div>' +
            '<div class="face back">' +
              '<div class="back-scroll">' +
                '<div class="word-en">' + esc(w.en) + srcTag + '</div>' +
                meaningsHtml + ruleHtml +
                (w.example ? '<div class="ex">' +
                  '<div class="ex-row"><div class="de">' + esc(w.example) + '</div><span class="ex-audio" data-say="1"></span></div>' +
                  '<div class="en">' + esc(w.exampleEn || "") + '</div>' +
                  (w.example2 ? '<div class="ex-row ex2"><div class="de">' + esc(w.example2) + '</div><span class="ex-audio" data-say="2"></span></div>' +
                    '<div class="en">' + esc(w.example2En || "") + '</div>' : '') +
                '</div>' : '') +
                relHtml +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
      curFlip = flip;
      flip.querySelector(".flip-inner").onclick = function () { toggleFlip(); };
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
      actions.querySelector(".again").onclick = function () { gradeCurrent(false); };
      actions.querySelector(".known").onclick = function () { gradeCurrent(true); };
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

      if (cfg.allowReshuffle) {
        var tools = el(
          '<div class="session-tools">' +
            '<button class="reshuffle">🔀 Reshuffle</button>' +
            '<button class="restart">↺ Restart</button>' +
          '</div>'
        );
        tools.querySelector(".reshuffle").onclick = function () { order = shuffle(order); pos = 0; draw(); };
        tools.querySelector(".restart").onclick = function () { pos = 0; draw(); };
        cardHost.appendChild(tools);
      }

      cardHost.appendChild(el(
        '<div class="kbd-hint"><span><kbd>Space</kbd> flip</span><span><kbd>1</kbd> still learning</span>' +
        '<span><kbd>2</kbd> known</span><span><kbd>←</kbd> <kbd>→</kbd> navigate</span></div>'
      ));

      updateProgress();
    }

    function updateProgress() {
      var pct = order.length ? Math.round(pos / order.length * 100) : 0;
      prog.querySelector(".progress-line span").style.width = pct + "%";
      prog.querySelector(".pm-left").textContent = "Card " + Math.min(pos + 1, order.length) + " of " + order.length;
      if (cfg.statBatch) {
        prog.querySelector(".pm-right").textContent = batchKnownCount(cfg.statBatch) + "/" + cfg.statBatch.words.length + " known";
      } else {
        var sk = 0; order.forEach(function (it) { if (isKnown(it.b.id, it.i)) sk++; });
        prog.querySelector(".pm-right").textContent = sk + "/" + order.length + " known";
      }
    }

    function drawDone() {
      prog.querySelector(".progress-line span").style.width = "100%";
      cardHost.innerHTML = "";
      var sk = 0; order.forEach(function (it) { if (isKnown(it.b.id, it.i)) sk++; });
      var done = el(
        '<div class="done-card">' +
          '<div class="big">🎉</div>' +
          '<h2>Session complete!</h2>' +
          '<p style="color:var(--muted)">You marked <b style="color:var(--good)">' + sk + '</b> of ' + order.length + ' as known.</p>' +
          '<div class="actions" style="max-width:420px;margin:18px auto 0">' +
            '<button class="btn again again2">Review again</button>' +
            '<button class="btn known back3">Done</button>' +
          '</div>' +
        '</div>'
      );
      done.querySelector(".again2").onclick = function () { order = srsOrder(cfg.items.slice()); pos = 0; draw(); };
      done.querySelector(".back3").onclick = function () { location.hash = cfg.backHash || "vocab"; };
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
      "Ort & Richtung", "Konnektoren", "Nebensätze & Infinitiv", "Relativsätze", "Passiv",
      "Konjunktiv II & Höflichkeit", "Redemittel & Fragen"];
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
              (p.de2 ? '<div class="pde pde2">' + esc(p.de2) + '</div><div class="pen pen2">' + esc(p.en2 || "") + '</div>' : '') +
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
          '<div class="face back"><div class="back-scroll">' +
            '<div class="ex" style="border:none;margin-top:0"><div class="ex-row"><div class="de" style="font-size:20px">' + esc(p.de) + '</div><span class="ex-audio" data-say="1"></span></div><div class="en" style="font-size:15px;margin-top:6px">' + esc(p.en) + '</div>' +
            (p.de2 ? '<div class="ex-row ex2" style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--line)"><div class="de" style="font-size:19px">' + esc(p.de2) + '</div><span class="ex-audio" data-say="2"></span></div><div class="en" style="font-size:15px;margin-top:6px">' + esc(p.en2 || "") + '</div>' : '') +
            '</div>' +
            (p.note ? '<div class="pnote-back"><span class="pnb-i">ℹ</span>' + esc(p.note) + '</div>' : '') +
          '</div></div>' +
        '</div></div>'
      );
      flip.querySelector(".flip-inner").onclick = function () { flipped = !flipped; flip.classList.toggle("flipped", flipped); };
      var pExA = flip.querySelectorAll(".ex-audio");
      if (pExA[0]) pExA[0].appendChild(speakBtn(p.de, "Listen"));
      if (pExA[1] && p.de2) pExA[1].appendChild(speakBtn(p.de2, "Listen"));
      host.appendChild(flip);
      var nav = el('<div class="nav"><button class="btn prev">‹ Previous</button><button class="btn skip">Next ›</button></div>');
      nav.querySelector(".prev").onclick = function () { if (pos > 0) { pos--; draw(); } };
      nav.querySelector(".skip").onclick = function () { pos++; draw(); };
      host.appendChild(nav);
      host.appendChild(el('<div class="kbd-hint"><span><kbd>Space</kbd> flip</span><span><kbd>←</kbd> <kbd>→</kbd> navigate</span></div>'));
      setKeys(function (e) {
        var tag = (e.target && e.target.tagName) || ""; if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (pos >= order.length) return;
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip.querySelector(".flip-inner").click(); }
        else if (e.key === "ArrowRight") { e.preventDefault(); pos++; draw(); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); if (pos > 0) { pos--; draw(); } }
      });
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
  function swap(node) { setKeys(null); app.innerHTML = ""; app.appendChild(node); window.scrollTo(0, 0); }

  /* a single active keyboard handler, auto-cleared on every view swap */
  var _keys = null;
  function setKeys(fn) {
    if (_keys) document.removeEventListener("keydown", _keys);
    _keys = fn;
    if (fn) document.addEventListener("keydown", fn);
  }

  route();
})();
