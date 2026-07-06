# Implementation plan — The Muse's Odyssey (for Claude Code)

Companion to `PRD.md`. Phased, each phase has an objective, the files it touches,
acceptance criteria, and a **ready-to-paste Claude Code prompt**. Phases are ordered
so the app is always shippable; stop at any phase boundary and nothing is half-built.

> Run from the `the-muses-odyssey/` directory. `CLAUDE.md` (voice + how-it-works) and
> `schema.md` (data contract) are loaded as context every session.

---

## Architecture (recap)

```
the-muses-odyssey/
  CLAUDE.md              # voice + how it works (session context)
  schema.md              # per-book data contract
  docs/PRD.md, PLAN.md   # this plan
  app/index.html         # the renderer — fixed; never edited to add content
  data/
    manifest.js          # window.LOOM_BOOKS = [ ...ids in reading order ]
    iliad-02.js          # window.LOOM_DATA["iliad-02"] = { ...book }
  claude-code/deep-dive-odyssey.md  # copy to .claude/commands/deep-dive-odyssey.md
```

Key constraint: **must run on `file://`**. `fetch()` is blocked there, so data is
loaded via injected `<script>` tags, and data files are `.js` that self-register.
Never reintroduce `fetch`/`import` of local JSON.

State lives in `localStorage`: `loom.last` (last book), `loom.best.<id>` (best score).

---

## Phase 0 — Baseline ✅ (done 2026-06-28)

Engine, schema, authoring command, and Book 2 deep dive exist and parse clean.
Verification already run: `node` shim loads manifest + book, asserts 9 movements /
3 terms / 10 chars / 5 omens, valid `correct` indices.

---

## Phase 1 — Harden authoring + verify (do first)

**Objective:** make `/deep-dive-odyssey` reliable and add a one-shot validator so every book
is checked the same way before it ships.

**Tasks**
1. Add `tools/validate.js` — a Node script that loads `manifest.js` + every listed
   data file under a `window` shim and asserts the schema: required `meta` keys;
   `scene` non-empty; 3–10 `movements` (the major beats) each with `n/title/what/why`; 2–4 `terms`;
   `characters` grouped with ≥1 entry; `quiz` 4–6 items each with 4 `opts`, integer
   `correct` in range, non-empty `truth`. Exit non-zero on any failure with the
   offending id + field.
2. Update `claude-code/deep-dive-odyssey.md` to run `node tools/validate.js` as its final
   step and report pass/fail.
3. Add `tools/new-book.js` (optional) — scaffolds an empty `data/<id>.js` stub to the
   schema, to reduce blank-page friction.

**Files:** `tools/validate.js` (new), `tools/new-book.js` (new), `claude-code/deep-dive-odyssey.md` (edit).

**Acceptance**
- `node tools/validate.js` passes on `iliad-02`, fails loudly on a deliberately broken copy.
- Running the command end-to-end on a new book leaves validator green.

**Paste prompt**
> Read `schema.md` and `CLAUDE.md`. Create `tools/validate.js`: under a `global.window`
> shim, `require` `data/manifest.js` then each `data/<id>.js` in `window.LOOM_BOOKS`,
> and assert the full schema in `schema.md` (meta keys, scene non-empty, 3–10 movements
> with n/title/what/why, 2–4 terms, grouped characters with ≥1 each, quiz 4–6 with 4
> opts + in-range integer `correct` + non-empty truth). Print a clear pass line or the
> first failing `id.field`, and `process.exit(1)` on any failure. Then add the validator
> as the final step of `claude-code/deep-dive-odyssey.md`. Run it and show me the output.

---

## Phase 2 — Spaced review (PRD P1, open question #1)

**Objective:** remember *which* questions were missed and let the reader drill only those.

**Design**
- On quiz completion, write `loom.miss.<id>` = array of missed question indices
  (union with prior misses; remove an index once answered correctly on a later sit).
- New **Review** view: a button in the switcher row. It gathers every `(id, qIndex)`
  still in a miss set across all books and presents them as one combined examination,
  labeled with their book. Clearing one removes it from the set.
- A small badge on each book button showing outstanding misses (e.g. `· 2`).

**Files:** `app/index.html` (renderer + state only; no data changes).

**Acceptance**
- Miss a question, reload, open Review → that question appears; answer it right → it
  leaves the set and the badge decrements.
- All data files untouched; still `file://`-safe; no console errors.

**Paste prompt**
> In `app/index.html` only, add per-question miss tracking in `localStorage`
> (`loom.miss.<id>` = array of missed indices; union on miss, remove on later correct).
> Add a "Review" button to the `.switch` row that builds one combined examination from
> all outstanding misses across books, each question tagged with its book title;
> answering correctly clears it. Show an outstanding-miss count badge on each book
> button. Keep it `file://`-safe (no fetch/import) and dependency-free.

---

## Phase 3 — Reading progress & navigation (PRD P1) ✅ (done 2026-06-28)

**Shipped, no-build:** all-books home grid (48 cells; authored = clickable, unwritten =
greyed), prev/next walking the authored books in reading order, a per-book "mark read"
toggle (`loom.read.<id>`), and an authored/read progress bar. Verified headless (DOM
shim): 48 cells render, Book 2 authored with its Fagles epigraph, nav disabled when no
neighbor, read toggle persists. **Design note:** the manifest stays the *load-list* of
authored ids (loader fetches only files that exist — no console 404s); the fixed
48-book plan lives as a `PLAN` constant in the renderer. This supersedes the original
"expand the manifest to 48" idea below — the split is cleaner.

**Objective:** see the whole 48-book arc and where the gaps are; move book-to-book.

**Design**
- `data/manifest.js` becomes the source of truth for the *full* 48-book plan: list all
  ids (iliad-01…24, odyssey-01…24) even before authored. The renderer marks an id
  "authored" if `LOOM_DATA[id]` exists, else "unwritten" (greyed, not clickable).
- Progress strip under the switcher: `Iliad ▓▓▓░… 7/24 · Odyssey 0/24`, plus a
  `read` toggle per book (`loom.read.<id>`) distinct from "authored".
- Prev / next book buttons at the foot of a book view, in reading order.

**Files:** `data/manifest.js` (expand to full plan with an `authored` flag derived at
runtime), `app/index.html` (progress strip, read toggle, prev/next).

**Acceptance**
- Manifest lists 48 ids; unwritten ones render greyed and disabled; authored ones work.
- Progress strip reflects authored + read counts and updates on toggle.

**Paste prompt**
> Expand `data/manifest.js` to list all 48 book ids in reading order (iliad-01..24,
> odyssey-01..24). In `app/index.html`, render unwritten books (no `LOOM_DATA[id]`) as
> greyed, disabled switcher entries; add a progress strip showing authored and read
> counts per epic; add a per-book "mark read" toggle (`loom.read.<id>`) and prev/next
> navigation in reading order. Stay `file://`-safe and dependency-free.

---

## Phase 4 — Port existing assets (PRD P1, open question #2)

**Objective:** one home. Convert the standalone Book 1 walkthrough + the two
examinations into the data format.

**Tasks**
- Author `data/iliad-01.js` from `book1-the-wrath.html` + `book1-character-sheet.html`
  + the Book 1 examination, to schema (carry the corrected "opens on / *mēnis*" note).
- Confirm `data/iliad-02.js` already supersedes the standalone Book 2 files; archive the
  originals under `../_archive/` (don't delete) and note it in the PRD changelog.

**Files:** `data/iliad-01.js` (new), `data/manifest.js` (add `iliad-01` first).

**Acceptance:** Book 1 and Book 2 both render from the app; validator green; standalone
files moved to `_archive/`.

**Paste prompt**
> Using `book1-the-wrath.html`, `book1-character-sheet.html`, and the Book 1
> examination as sources, author `data/iliad-01.js` to the `schema.md` contract in the
> Loom voice (keep the corrected note: the title names Troy/Ilios, first word is
> *mēnis*). Add `iliad-01` to the front of `data/manifest.js`. Run `tools/validate.js`.

---

## Phase 5 — Polish & decision gate (PRD P2, post-deadline)

Only if the reading is on track and time remains.
- **Search** across characters/terms/movements (client-side index built at boot).
- **Export** a book to print/PDF (a print stylesheet + `window.print()`).
- **Decision gate (open question #3):** if search/threads strain vanilla JS, evaluate a
  Vite/React port — but only then, and as its own PRD. Default is to stay static.

---

## Testing strategy

- **Schema:** `node tools/validate.js` before every commit (Phase 1 deliverable).
- **Smoke:** open `app/index.html` on `file://`; switch books; complete a quiz; reload;
  confirm best score + (Phase 2) misses persisted; check console is clean.
- **No-regression rule:** any renderer change must keep `file://` loading intact — grep
  the diff for `fetch(`/`import ` of local paths and reject.

## Definition of done — per book

A book is "done" when: `data/<id>.js` validates; it renders scene → terms → the major
beats → (similes if any) → roster → 4–6 omens; the quiz scores and persists; and a
cold `file://` open shows no console errors.
