---
description: Author a book into The Muse's Odyssey reading app (data/<id>.js + manifest) — specific to this app
argument-hint: <epic> <book-number>   e.g. "iliad 3" or "odyssey 1"
---

You are authoring a reading-comprehension deep dive for **$ARGUMENTS** into The Muse's Odyssey app.

Follow this exactly:

1. Read `schema.md` and `CLAUDE.md` in this directory for the data contract and the
   Loom/Oracle voice. Hold the voice: parchment-mythic, honest, spoiler-aware for
   books already read but not for books ahead.

2. Compute the id: `iliad-NN` or `odyssey-NN`, zero-padded (e.g. book 3 → `iliad-03`).

3. Write `data/<id>.js` registering one book object into `window.LOOM_DATA["<id>"]`.
   Required substance:
   - `meta` with title, subtitle, tagline, and an `epigraph` (an apt opening line + a
     one-line gloss of why it opens there).
   - `scene`: 1–3 paragraphs setting place, time, and what just changed.
   - `terms`: 2–4 Greek/key words that pay off in this book (gk + plain def).
   - `movements`: the book's major beats (up to ~10, no forced minimum), each with
     `n`, `title`, `what` (HTML, narrate the beat), and
     `why` (what it sets up / why it matters). Wrap mortals in
     `<span class="who">…</span>`, gods in `<span class="god">…</span>`.
   - `panels`: optional — pull out famous similes or an aside if the book has them.
   - `characters`: grouped "Mortals" and "Gods & Powers"; name, epithet, role, tag.
   - `threads`: when the book ties to one already read, add `{ dir, to, title, note }`
     entries (`dir`: "back"/"ahead", `to`: book id). Spoiler-aware: "back" is always
     safe; "ahead" hints, never spoils.
   - `quiz`: 4–6 omens. Each: `n`, `kind`, `q`, `opts` (4), `correct` (0-based index),
     and a `truth` that teaches, not just confirms. Set `kind` to `"event"` (recall),
     `"meaning"` (why-it-matters / theme), or `"thread"` (cross-book tie). Mix them:
     mostly events, one or two meaning omens, and a thread omen when a thread exists.

4. Append `"<id>"` to `window.LOOM_BOOKS` in `data/manifest.js`, keeping reading order
   (all Iliad books before Odyssey, ascending).

5. Tell the user to open (or refresh) `app/index.html` — the new book appears in the
   switcher. No build step, no server.

Accuracy over flourish: if a claim or translation is uncertain, say so in the `truth`
or `why`. Do not invent details not in the text.
