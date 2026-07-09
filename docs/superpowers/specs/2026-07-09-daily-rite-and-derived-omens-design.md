# The Daily Rite & Derived Omens — design

**Date:** 2026-07-09
**Status:** approved, ready for implementation planning
**Scope:** two features — richer comprehension checks ("fun omens") and a daily reading goal.

---

## 1. Why

The app tests comprehension with 60 authored omens (38 `event`, 12 `meaning`, 10 `thread`),
all four-option multiple choice. They are good, but they are one shape, and they exhaust.

Separately, `CLAUDE.md` frames the reading with the three Fates — Clotho sets the measure,
Lachesis allots the pages, Atropos waits at the theater door. Grepping `app/index.html` for
`Atropos|Lachesis|Clotho|July|deadline` returns nothing. The mythology is doctrine, not code.
The daily goal is the feature that gives Lachesis and Atropos something to do.

## 2. What the data already supports

Measured against `data/iliad-01..10.js`:

| Source | Count | Cost |
| --- | --- | --- |
| `movements` — ordered beats, self-contained titles | 88 | free; order is authoritative |
| name+epithet pairs with no kinship giveaway | 48 of 75 | free; usable as prompts |
| name+epithet pairs naming a relative (`son of Peleus`) | 27 of 75 | unusable — self-answering |
| `epigraph` — the only verbatim Fagles in the corpus | 10 (one per book) | near-free, capped |
| authored `quiz` omens | 60 | already written |

Read-gated to the reader's current progress (Books 1–4), the live pool is still ample:
13 mortal characters, 9 gods, 37 movements, 4 epigraphs. No format starves.

**Chosen approach: hybrid.** Derived formats power the playful layer and the Daily Rite;
the 60 authored omens remain the per-book Ninth Hour examination, untouched. New question
types cost nothing per book and appear automatically as Books 11–24 are authored.

## 3. Architecture

Three units, each with one purpose and a testable boundary.

### 3.1 `clock`

`todayKey() -> "YYYY-MM-DD"`, built from **local** date parts.

Not `toISOString()`: that is UTC and would roll the day over at 20:00 EDT, silently breaking
a streak the reader believes they kept.

### 3.2 `dayLog` — an append-on-human-action journal

Keys:

- `loom.day.<YYYY-MM-DD>` → `{ read: [bookId], sat: [bookId] }`
- `loom.streak` → `{ count, lastDay }`
- `loom.goal` → `{ books: 1 }`

**Seeded progress is undated past.** `seedProgress()` (`app/index.html:242`) backfills Books 1–4
as read with perfect scores and no timestamp. Those reads must never satisfy a day, or the
streak begins on a lie.

This is enforced *structurally, not defensively*: the day log is written **only** from
`toggleRead()` and from the **per-book** `reveal()`, both of which fire only on a human action.
`seedProgress()` writes `loom.read.*` and `loom.best.*` and never calls `dayLog`. No
`loom.seeded.*` flag is needed. The rule falls out of where the writes live.

The Daily Rite (§5.3) and the Grand Examination end in their own reveal and **must not** call
`dayLog.record()`. Only a per-book sitting can advance a day.

The log stores *events*, not completion. Completion is **derived** by re-checking §5.2's two
conditions against the log — which is what makes "the day its second condition lands" work when
a reader passes Book 5's omens on Monday and marks it read on Tuesday. Tuesday completes.

**Durability probe.** `dayLog.durable()` writes and re-reads a canary key. See §6.

### 3.3 `omens` — pure generators over `LOOM_DATA`

Pure functions: no storage, no DOM. Each returns an omen or `null` when its pool is too thin.

**Spoiler gate.** Generators draw **only** from books where `isRead(id)` — the same gate the
roster received in commits `0be9084`, `f0ab20a`, `ccc4c4c`. An epithet question that reveals
Helenus exists leaks exactly as a roster card would.

### 3.4 Data flow

```
LOOM_DATA ──► omens.derive(readBookIds) ──► [omen]
                                              │
                    authored d.quiz ──────────┤
                                              ▼
                                  renderSitting(omens)
                                              │
                            answer ──► thread frays ──► reveal()
                                                          │
                                            dayLog.record(today) ──► streak
```

## 4. The omen formats

| Format | Source | Prompt |
| --- | --- | --- |
| `sequence` | 4 movements from one read book | "The Loom shows four beats. Set them in their true order." |
| `epithet` | clean name+epithet pairs, same band | "Whose name does the Loom hide? *grey-eyed goddess of war-craft*" |
| `line` | the book's epigraph, one word blanked | "Fagles wrote it thus. Which word is missing?" |

Three rules, each derived from the actual data rather than assumed:

1. **Distractors share a band.** An epithet question about a god draws its three wrong answers
   from other entries in `Gods & Powers`, never `Mortals`. Otherwise the word *goddess*
   eliminates three options unaided.
2. **No character appears twice in one question.** Athena carries two epithet variants
   (`grey-eyed goddess of war-craft`, `...of wisdom and war-craft`). Distractors are selected
   **by character**, not by pair, or Athena becomes her own distractor.
3. **`sequence` draws 4 non-contiguous movements.** Adjacent beats are near-impossible to
   separate; spread beats test whether the reader holds the book's arc.

`line` stays honest: epigraphs are the corpus's only verbatim Fagles. Blanking a word preserves
that, and the omen cites `book.line` as `CLAUDE.md` requires. Capped at one per read book — a
garnish, not a staple.

### 4.1 Interface

Derived omens carry the authored shape — `{ kind, q, opts, correct, truth }` — plus a `format`
discriminator. `format: 'choice'` is the default and renders through today's exact code path;
`sequence` gets a tap-to-order renderer.

Authored omens are untouched: they carry no `format`, and `FORMAT[f] || FORMAT.choice` mirrors
the `KIND[k] || KIND.event` fallback already at `app/index.html:691`. No migration, no data rewrite.

## 5. The fraying thread, and the daily goal

### 5.1 Stakes without a clock

A taut thread with six pips sits atop the sitting. Each miss frays a segment; Atropos' shears
inch closer. Wine and gold, per the existing palette.

**There is no fail state.** Nothing locks, nothing resets, nothing is taken away. The app's own
verdict copy forbids it — *"Linger here once more."* / *"No frown — sit longer."* A timer would
have the app telling the reader to hurry while the Fates tell them to sit. The thread is a
**barometer**, not a life bar: the stakes are in watching it fray.

### 5.2 What completes a day

A book counts on the day its **second** condition lands:

- `isRead(id)` is set, **and**
- `bestScore(id) >= 0.7 * omenCount(id)`

The 0.7 is not new. It is the existing verdict tier where *"the thread holds bright"*
(`app/index.html:735`). Reusing it means the goal and the Fates agree on what passing means.

Default goal: **1 book/day**, edited inline. Ten books are authored, four are read, six remain —
and July 15 is six days from July 9. The default is the number the loom is already holding.

### 5.3 The Daily Rite

A shuffled mixed draw of ~5 omens across read books and all formats. It is **separate practice**:
unlimited, optional, pressure-free, and it does **not** spin the thread. Only reading a book and
passing its omens completes a day. This keeps the streak tied to actually reading Homer.

### 5.4 Atropos, softly

The deadline renders as context on the home hub — *"Atropos waits six days hence"* — never as a
bar being failed.

**Pace is computed over `authored ∧ unread`, not over 48.** A line reading "44 books remain,
6 days" is a lie dressed as motivation: 38 of those books are unwritten. The denominator is
stated plainly in the copy, and self-corrects the moment Book 11 is authored.

### 5.5 Streak

`{ count, lastDay }`. Completing a day whose `lastDay` was yesterday increments. Completing a day
whose `lastDay` is older resets the count to 1, with the line *"the thread was not spun yesterday."*
Honest, no hidden grace, no mercy days.

## 6. Failure modes

| Hazard | Handling |
| --- | --- |
| `localStorage` throws on `file://` (iOS null origin) | Bundler shim exists (`build-single-file.js:31-58`), swapping an in-memory store. |
| In-memory store makes a streak silently reset each load | `dayLog.durable()` canary probe. If storage is volatile, **suppress the streak block entirely** rather than render a lying zero. The day's goal is still shown — it is computable in-session. |
| `toISOString()` shifts the day at 20:00 EDT | `todayKey()` uses local date parts. |
| Pool too thin (reader one book in) | Generators return `null`; the draw fills from what is available and renders fewer omens. |
| A character becomes their own distractor | Distractors drawn by character, not by epithet pair. |
| Band leak (mortal distractor for a god) | Distractors constrained to the prompt's band. |
| July 15 passes | Deadline line hides. Never renders a negative countdown. |
| Seeded books satisfying a day | Structural — `seedProgress()` never calls `dayLog`. |
| Day rolls over mid-sitting | `todayKey()` sampled once, at `reveal()`. |

**Device clock is trusted.** A reader who changes their system date can inflate a streak. Not
defended against: this is a single-reader, local-first study app, and the streak is for the
reader's own benefit.

## 7. Code structure

`app/index.html` is one 862-line inline script. The generators are pure and deserve tests, so:

- **`app/omens.js`** — new. Pure generators, script-tag loaded exactly as `data/*.js` are
  (the project loads `.js` via `<script>` rather than `fetch`, because `file://` blocks `fetch`).
- **`test/omens.test.js`** — new. Runs under `node --test`, Node's built-in runner. No
  framework, no `package.json` needed.
- **`build-single-file.js`** — extended. The bundler currently inlines only the manifest tag and
  throws if it is missing:

  ```js
  const manifestTag = '<script src="../data/manifest.js"></script>';
  if (!html.includes(manifestTag)) throw new Error('manifest <script> tag not found — index.html shape changed');
  ```

  A plain `<script src="omens.js">` would therefore work when `app/index.html` is double-clicked
  and **silently produce a broken deploy bundle**. The bundler must learn to inline `omens.js`,
  with the same throw-if-missing guard.

Tests worth writing are the ones encoding rules derived from real data: a distractor set never
repeats a character; a god's question never draws a mortal distractor; a `sequence` answer key
matches movement order; `todayKey()` does not shift at 23:00 UTC−4.

DOM-facing work (fraying thread, tap-to-order) is verified in the c11 browser against the built
bundle, as this project has always verified rendering.

## 8. Out of scope (YAGNI)

No timer. No grace or mercy days. No Supabase sync of streak state (that spec exists; this rides
localStorage only). No settings page — the goal defaults to 1 and is edited inline. No
notifications. No fail state. No rewrite of the 27 kinship epithets: they are good roster glosses
and bad quiz prompts, so they are filtered at generation time, not corrected at the source.

## 9. Deploy

Per `CLAUDE.md`: rebuild → copy to `index.html` → commit → push `main`.

```
node build-single-file.js
cp the-muses-odyssey.html index.html
```
