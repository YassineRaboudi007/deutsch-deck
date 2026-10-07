# Deutsch Deck → telc Deutsch B1 Prep — Reference Plan

> Research-grounded plan for evolving this flashcard app into a telc B1 exam-prep tool.
> Target learner: currently ~A2, aiming to pass **telc Deutsch B1** in a **3–4 month** intensive window.
> Weakest sections (priority): **Speaking · Writing (Brief) · Sprachbausteine**.
> Created 2026-10-07.

## 1. The exam (telc Deutsch B1)

| Block | Section | Time | Points |
|---|---|---|---|
| **Written — 225 pts** | Leseverstehen (reading) | 90 min shared across reading + Sprachbausteine | 75 |
| | **Sprachbausteine** (grammar/vocab gaps) | (shared) | **30** |
| | Hörverstehen (listening) | 30 min | 75 |
| | **Schriftlicher Ausdruck** (the Brief) | 30 min | **45** |
| **Oral — 75 pts** | **Mündliche Prüfung** (paired, 3 parts) | 20 min prep + ~15 min | **75** |

**Pass rule (critical):** need **≥60% in written (135/225) AND ≥60% in oral (45/75), separately.**
**No compensation** between the two — a strong written score cannot rescue a weak oral, and vice versa.

### Section task formats
- **Sprachbausteine** — 2 Teile, 20 gaps, 30 pts, ~20 min. *Teil 1* = 10 grammar gaps (3 options each): article/adjective declension, prepositions by case, verb+preposition, connectors, modal verbs / Konjunktiv II / Passiv. *Teil 2* = 10 vocab/connector gaps chosen from a word bank (fixed expressions e.g. *bitten um, sich freuen auf*).
- **Brief** — one semi-formal/informal letter, ~80 words, 30 min, **4 Leitpunkte** that must ALL be addressed. Graded on 3 criteria — *Berücksichtigung der Leitpunkte · Kommunikative Gestaltung · Formale Richtigkeit* — each A/B/C/D = 5/3/1/0, ×3 → max 45, +2 bonus. Missing a Leitpunkt is the #1 point-killer.
- **Speaking** — paired, 3 parts: *Teil 1 Kontaktaufnahme* (15 pts) · *Teil 2 über ein Thema sprechen* (30) · *Teil 3 gemeinsam etwas planen* (30). Criteria: Aufgabenbewältigung, Ausdrucksfähigkeit, Formale Richtigkeit, Aussprache.

## 2. Guiding research insight

For productive skills (speaking/writing) at B1, evidence favors **formulaic chunks / Redemittel over rule-by-rule sentence building**: memorized multi-word sequences are processed faster, reduce hesitation, and implicitly carry correct grammar. Pair with **spaced repetition** to move chunks from "known about" → "usable at speed."

**Design consequence:** the existing ~120 tagged sentence patterns are the right substrate. Add (a) a real SRS engine under them, and (b) Redemittel + exam-task card types on the same model.

## 3. Feature roadmap (mapped to existing app)

| Priority | Feature | Hits | Reuses |
|---|---|---|---|
| **1** | **Redemittel bank** — chunk cards tagged by function (opinion, agree/disagree, suggest, letter opening/closing) | Speaking + Writing | flashcard engine |
| **2** | **Sprachbausteine drill** — gap + 3 options, tagged by grammar topic; auto-seed from verb+prep patterns | Sprachbausteine | `prep`/`group` tags |
| **3** | **Brief trainer** — scenario + 4 Leitpunkte + template skeleton + model answer + self-check (all 4 covered? greeting/closing? ~80 words?) | Writing | new deck |
| **4** | **Speaking solo mode** — Teil 2/3 prompt cards, 20-min prep timer, in-browser record (MediaRecorder), Redemittel scaffolds, scripted "partner" lines | Speaking | patterns + Redemittel |
| **engine** | **Real SRS (Leitner boxes)** replacing "mark learned" | everything | `pknown`/`known` state |
| later | Konnektoren pattern set; timed Modelltest mode; exam-readiness dashboard | all | — |

**Build order:** #1 + #2 first (hit all three weak areas, ride on current data model + flashcard engine) → #3 → #4, with SRS introduced as the shared engine.

## 4. 12–16 week schedule (3–4 month window)

- **Wk 1–4 — close the A2→B1 gap:** daily vocab SRS + patterns by grammar group; add Konnektoren set (*weil/deshalb/obwohl/trotzdem/damit/um…zu* + word order); begin Sprachbausteine Teil 1 drills; 15 min graded input daily.
- **Wk 5–9 — build productive skills:** Redemittel banks live; 2 Briefe/week with template → self-check; daily Teil 2 monologue, recorded; Sprachbausteine Teil 2 collocations.
- **Wk 10–13 — exam technique:** weekly timed Modelltest; Brief under 30-min pressure; Teil 3 planning dialogues; SRS auto-targets missed items.
- **Wk 14–16 — simulate & taper:** 2 full mock exams, Redemittel memorized cold, speaking rehearsals, light review.

## 5. Sources
- Scoring & pass rule: sprachflow.app/blog/telc-b1-grading-system; languageprep.de/en/blog/telc-b1-passing-score-explained
- Speaking: zertifly.com/en/blog/telc-b1-sprechen; deutsch-exam.com/en/blog/telc-b1-mundlich-method
- Writing: levelkraft.de/en/blog/telc-b1-schreiben-brief-template; sprachflow.app/blog/telc-b1-schreiben-grading-criteria
- Sprachbausteine: deutsch-exam.com/en/blog/telc-b1-sprachbausteine-guide; viobean.com/exams/telc-b1/sprachbausteine
- Method: files.eric.ed.gov/fulltext/EJ1457275.pdf (chunking); pmc.ncbi.nlm.nih.gov/articles/PMC9379275 (formulaic sequences & fluency)
