# The Muse's Odyssey — reading companion for the Iliad & Odyssey

A data-driven static app. (Internal codename in the source: `LOOM_*` — the data
registry and localStorage keys keep that prefix; the *product* name is The Muse's
Odyssey.) One renderer (`app/index.html`), one data file per book
(`data/<id>.js`), one manifest (`data/manifest.js`). No build step, no server —
double-click `app/index.html` to read.

## How it works
- Data files are **`.js`, not `.json`**, on purpose: browsers block `fetch()` on
  `file://`, but `<script>` tags load fine. Each data file registers itself into
  `window.LOOM_DATA`. The manifest lists which ids to load.
- The renderer reads a book object and draws: scene-set → words-to-carry →
  movements (what happened / why it matters) → similes & panels → character roster →
  the Ninth Hour examination. Quiz scores persist in `localStorage` per book.

## The data contract
See `schema.md`. To add a book: write `data/<id>.js`, append the id to
`window.LOOM_BOOKS` in `data/manifest.js`. Nothing else.

## Voice — the Loom / the Oracle
- Parchment register, lightly mythic, never purple. Georgia serif, wine + gold.
- The three Fates frame the reading: Clotho sets the measure, Lachesis allots the
  pages, Atropos waits at the theater door (the July 15 prescreening deadline).
- The nightly quiz is "the Ninth Hour" / "the Oracle's Examination"; results are
  "the Fates' verdict." Keep that diction.
- **Spoiler-aware, not spoiler-blind:** the reader has already read the earlier
  books, so it's good to name what a book *sets up* (e.g. Book 1's nod → Book 2's
  Dream). Do not foreshadow books not yet read unless flagged.
- Honesty over flourish: if a Greek term or claim is uncertain, say so plainly.
  (E.g. *Iliad* names Troy/Ilios; it does not mean "wound.")

## Source text & quotation
- The reader's translation is **Robert Fagles** (Penguin Classics; Bernard Knox
  introductions). Match Fagles' name spellings and phrasing; when a movement leans on
  a memorable line, prefer Fagles' wording.
- **Epigraphs and any quotation marks must be verbatim Fagles** — cite book.line
  (e.g. *Fagles, Iliad 1.1–2*). If a line cannot be confirmed verbatim, do NOT wrap it
  in quotation marks: paraphrase in the app's own voice, or label it "after Fagles".
  Never present a paraphrase as a quote.
- Resonance worth keeping: Fagles' *Odyssey* opens "Sing to me of the man, Muse…" —
  the source of the app's name.

## Authoring a deep dive
Use the `/deep-dive-odyssey` command (`.claude/commands/deep-dive-odyssey.md`) — the
app-specific authoring command: give it an epic and book number; it produces the
`data/<id>.js` file to schema and registers it.
Movements should follow the book's major beats — as many as it has, up to ~10, no
forced floor; quiz 4–6 omens; always include `why it matters` and at
least a couple of `terms`.


<claude-mem-context>

</claude-mem-context>