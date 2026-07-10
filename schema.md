# The Muse's Odyssey — per-book data contract

Each book is ONE file: `data/<id>.js` where `id` is `iliad-NN` or `odyssey-NN` (zero-padded).
The file does exactly one thing: registers a book object into the global registry.

```js
window.LOOM_DATA = window.LOOM_DATA || {};
window.LOOM_DATA["iliad-02"] = { /* book object below */ };
```

Then add the `id` to `data/manifest.js` (the `window.LOOM_BOOKS` array), in reading order.

## Book object

```
meta:        { id, epic, song, book, title, subtitle, tagline, epigraph:{text, src, verbatim?} }
recap:       [ "<p-html>", ... ]        // optional — "Previously, on <epic>": the story up to but NOT including this book
scene:       [ "<p-html>", ... ]        // dark scene-set card; 1–3 paragraphs
terms:       [ { gk, def }, ... ]        // optional — Greek/key words to carry (e.g. mēnis, timē)
movements:   [ { n, title, what, why }, ... ]   // `what` and `why` are HTML strings
panels:      [ { label, lines:[ "<i>...</i>", ... ] }, ... ]   // optional — similes / asides
characters:  { "Mortals":[ {name, epithet, role, tag, god?} ], "Gods & Powers":[ ... ] }
threads:     [ { dir, to, title, note }, ... ]   // optional — cross-book ties (see below)
quiz:        [ { n, kind, q, opts:[...], correct:<index>, truth } ]   // 4–6 omens
```

## Quiz `kind` — the comprehension layers

Each quiz item carries a `kind` so the examination tests recall *and* understanding,
and the verdict reports a per-layer breakdown:

- `"event"` — recall of what happened (a beat, who did what, the order of events).
- `"meaning"` — why it matters / theme (what Homer is *showing*, the force of a term).
- `"thread"` — a cross-book tie (how this book connects to one already read).

Aim for a mix: mostly `event`, at least one or two `meaning`, and a `thread` omen
when the book has a thread. If `kind` is omitted the renderer treats it as `event`.

## Threads — the cross-book weave

`threads` links a book to another book in reading order. Each entry:

- `dir`  — `"back"` (ties to an earlier book) or `"ahead"` (sets up a later one).
- `to`   — the target book id (e.g. `"iliad-01"`). May be unwritten; the link greys out.
- `title`— a short name for the connection.
- `note` — 1–3 sentences, HTML allowed, explaining the tie in the Loom voice.

Threads render in the book (a "Threads of the Loom" section) and collect into the
global **Woven Threads** view. Keep them spoiler-aware: a `"back"` thread is always
safe; an `"ahead"` thread should hint, not spoil, a book not yet read.

## Conventions
- HTML allowed in `what`, `why`, `role`, `scene`, `panel lines`, `truth`.
- Wrap a mortal name in `<span class="who">Name</span>`, a god in `<span class="god">Name</span>`.
- `correct` is the 0-based index of the right option.
- Voice: the Loom / Oracle register — see CLAUDE.md. Spoiler-aware: name what a book *sets up* for later books, since the reader has the prior ones.
- `recap` renders a "Previously, on <epic>" card between the epigraph and the scene-set. It is the story **up to but not including this book** (Book 1's is the pre-war backstory), so it is spoiler-safe by construction. The card is italic — use `<b>` (upright ink) for name/callout emphasis, not `<i>`. Paraphrase in the app's voice; do not wrap in quotation marks (that convention is reserved for verbatim Fagles).
- `meta.epigraph.verbatim` is optional and defaults to false. Set it to `true` only when `text` has been verified as a verbatim Fagles quotation. Derived line omens use this flag to decide whether they may say "Fagles wrote it thus"; paraphrases get Loom-voice recall copy instead.
- Data is trusted (authored locally); the renderer injects it as HTML. Do not paste untrusted content.

## Add a book by hand
1. Write `data/<id>.js` to the shape above.
2. Append `"<id>"` to `window.LOOM_BOOKS` in `data/manifest.js`.
3. Open `app/index.html` — the new book appears in the switcher. No build, no server.
