# 🇩🇪 Deutsch Deck — German Flashcards (A2 & B1)

A simple, offline flashcard app to learn German vocabulary **for CEFR levels A2
and B1**, built on the official **telc "Einfach gut"** A2 and B1 word lists.
No installation, no internet, no accounts — just open it in your browser.

Every card is made for **learning by context**: the German word (with its
article and plural), a **voice reader** 🔊, the **different meanings** it can have,
a short **grammar rule**, and **two example sentences** with English translations.

## How to open

**Easiest:** double-click `index.html`.

If the word data doesn't appear (some browsers block local data files opened via
`file://`), run the tiny included server instead:

```bash
cd flashcards
./serve.sh        # then open http://localhost:8777 in your browser
```

(or `python3 -m http.server 8777` and open http://localhost:8777)

## What's inside

- **Vocabulary** — the telc A2 and B1 words, grouped alphabetically into small
  batches, filterable by level (**All / A2 / B1**). Each card shows:
  - **Front:** the German word (article + plural for nouns) and a 🔊 button to
    hear it pronounced.
  - **Back:** the English meaning, a numbered list of the word's **different
    meanings**, a **grammar/usage rule** (article logic, separable verbs,
    irregular forms, the case a verb governs, etc.), and **two example
    sentences** — each with its English translation and its own 🔊 button.
- **Patterns** — the 100 "Spoken German Patterns" (A1–B1): formula, grammar
  note, and an anchor example. Browse/search them, or switch to flashcard mode.

## Voice reader

Tap 🔊 to hear the German word or example sentence. This uses your browser's
built-in German (`de-DE`) speech synthesis — it works offline. For the best
voice, use Chrome or Edge; if you hear an English accent, install a German
voice in your operating system's speech settings.

## How to study

1. Pick a batch. Tap a card to flip it.
2. Mark **"I know this"** (turns green ✓) or **"Still learning"**.
3. Use **"Review not-known"** to drill only the words you haven't marked known.
4. Progress is saved automatically in your browser (localStorage) and shown per batch.
5. Toggle 🌙 / ☀️ for dark/light theme.

## Files

```
index.html        the app
js/app.js         all the logic (incl. the voice reader)
data/words.js     the vocabulary (generated)
data/patterns.js  the 100 patterns (generated)
data/raw/         source JSON per batch (a2_*.json, b1_*.json, patterns.json)
build.js          rebuilds data/words.js + data/patterns.js from data/raw/
serve.sh          starts a local web server
```

## Editing / adding words

Each entry in `data/raw/*.json` has this shape:

```json
{
  "de": "die Rechnung",
  "en": "bill; calculation",
  "pos": "noun",
  "plural": "die Rechnungen",
  "meanings": [
    { "en": "bill, invoice", "de": "Aufstellung der Kosten" },
    { "en": "calculation", "de": "das Rechnen mit Zahlen" }
  ],
  "rule": "Feminine noun. 'die Rechnung begleichen' = to settle a bill.",
  "example": "Die Rechnung, bitte!",
  "exampleEn": "The bill, please!",
  "example2": "Die Rechnung geht nicht auf.",
  "example2En": "The calculation doesn't add up."
}
```

Edit any file in `data/raw/` (or add one with the same shape), then run:

```bash
node build.js
```

to regenerate `data/words.js`. Duplicate headwords across batches/levels are
removed automatically (the lower level wins).
