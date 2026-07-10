# SPEC: Daily Rite, Derived Omens, and Countdown

**Status:** Draft contract for lattice-style implementation  
**Date:** 2026-07-10  
**Deadline date:** 2026-07-28  
**Primary design:** `docs/superpowers/specs/2026-07-09-daily-rite-and-derived-omens-design.md`  
**Working board:** `docs/superpowers/plans/2026-07-10-countdown-lattice-board.md`

## Objective

Add a daily reading-countdown layer and richer practice omens to The Muse's
Odyssey while preserving the app's static, file-safe architecture.

The feature should make the July 28 book-club deadline visible through the existing Loom /
Fates voice: Lachesis allots the day's measure, Atropos waits at the door, and
the reader can practice through a Daily Rite. It must not turn the app into a
timer, a fail-state system, or a general task manager.

## Product Scope

This work has three user-facing outcomes:

1. A home-hub countdown that shows the daily goal, current streak when storage is
   durable, authored-unread pace, and Atropos deadline context.
2. A Daily Rite practice view that mixes authored and derived omens from already
   read books.
3. A fraying-thread sitting experience that gives immediate feedback without
   locking, punishing, or resetting the reader.

It also has two implementation outcomes:

1. Pure, unit-tested date and omen-generation helpers.
2. A deploy bundle that inlines every first-party app script needed by the new
   feature.

## Acceptance Criteria

### Architecture

- **SPEC-ODY-001:** The app remains a static, script-tag-loaded application. The
  implementation must not introduce `fetch`, dynamic `import`, framework
  bootstrapping, `package.json`, or module-type changes.
- **SPEC-ODY-002:** `app/index.html` remains directly readable from `file://`.
  Opening the source app must not require a local development server or build.
- **SPEC-ODY-003:** Any new reusable date or omen-generation logic must live in
  first-party app scripts that expose browser globals and CommonJS exports for
  tests.
- **SPEC-ODY-004:** `build-single-file.js` must inline every new first-party app
  script required by the feature. The generated `the-muses-odyssey.html` must
  not retain script tags that would 404 from the repo root.

### Date, Deadline, and Countdown

- **SPEC-ODY-010:** Day keys must use local date parts in `YYYY-MM-DD` format.
  They must not use UTC-derived `toISOString()` behavior.
- **SPEC-ODY-011:** Date math must handle ordinary day transitions, month/year
  boundaries, and DST transitions without off-by-one countdown or streak errors.
- **SPEC-ODY-012:** The deadline constant is `2026-07-28`.
- **SPEC-ODY-013:** Before or on the deadline, the home hub may render Atropos
  deadline context using non-negative days remaining.
- **SPEC-ODY-014:** After `2026-07-28`, the Atropos deadline line must be hidden.
  It must never render a negative countdown.
- **SPEC-ODY-015:** Pace calculations must use authored-and-unread books as the
  remaining denominator, not the full 48-book plan.
- **SPEC-ODY-016:** As of `2026-07-10`, with the current July 28 book-club
  deadline, the countdown must read as 18 days remaining.

### Day Log and Streak

- **SPEC-ODY-020:** Daily progress must be recorded in localStorage as a
  human-action journal keyed by local day.
- **SPEC-ODY-021:** A book completes the day only when both conditions are true:
  the book is marked read, and its per-book sitting has a best score of at least
  70 percent of that book's omen count.
- **SPEC-ODY-022:** A day completes on the day the second required condition
  lands. If the sitting and read toggle happen on different days, the latter day
  is the completion day.
- **SPEC-ODY-023:** `seedProgress()` must not write daily progress, complete a
  day, or advance a streak.
- **SPEC-ODY-024:** The Grand Examination must not write daily progress, complete
  a day, or advance a streak.
- **SPEC-ODY-025:** The Daily Rite must not write daily progress, complete a day,
  or advance a streak.
- **SPEC-ODY-026:** Completing a day increments the streak only when the previous
  streak day was yesterday, remains idempotent for repeated completion on the
  same day, and resets to 1 after a missed day.
- **SPEC-ODY-027:** If storage is volatile or in-memory, the app must suppress
  persistent streak claims rather than render a misleading zero or reset.

### Derived Omens

- **SPEC-ODY-030:** The 60 authored quiz omens in `data/*.js` must remain
  untouched by this feature.
- **SPEC-ODY-031:** Derived omen generators must be pure functions over plain
  book data. They must not read or write DOM or storage.
- **SPEC-ODY-032:** Derived omen generation must be spoiler-gated to books where
  `isRead(id)` is true.
- **SPEC-ODY-033:** Epithet omens must exclude self-answering kinship epithets,
  including forms such as `son of Peleus`, `grandson of Bellerophon`, and
  possessive kinship forms such as `Achilles' foster-father`.
- **SPEC-ODY-034:** Epithet distractors must come from the same band as the
  correct character, so god prompts draw god distractors and mortal prompts draw
  mortal distractors.
- **SPEC-ODY-035:** No character may appear twice in a single epithet omen,
  including cases where that character has multiple epithet variants.
- **SPEC-ODY-036:** Sequence omens must draw four movements from one read book
  and preserve an answer key based on the source movement order.
- **SPEC-ODY-037:** Sequence omens should prefer non-contiguous movements when
  the source book has enough movements to support that spread.
- **SPEC-ODY-038:** Line omens must draw only from existing book epigraphs. They
  must preserve Fagles honesty by blanking a word from text already present in
  the data rather than inventing or quoting unverified lines.
- **SPEC-ODY-039:** Any derived generator with too thin a pool must return `null`
  rather than throwing, and callers must omit `null` results.

### Daily Rite

- **SPEC-ODY-040:** The Daily Rite must produce a shuffled mixed practice draw
  across read books.
- **SPEC-ODY-041:** The Daily Rite should draw about 5 omens when enough material
  exists and fewer when the read-book pool is thin.
- **SPEC-ODY-042:** Daily Rite omens must include a format discriminator so the
  renderer can choose ordinary choice rendering or sequence rendering.
- **SPEC-ODY-043:** Daily Rite practice must be repeatable and pressure-free:
  there is no timer, no lockout, no fail state, and no streak mutation.
- **SPEC-ODY-044:** The Daily Rite must be reachable from the home experience
  without replacing the existing per-book Ninth Hour examination.

### Fraying Thread and Sitting Renderer

- **SPEC-ODY-050:** Per-book sittings must render a fraying-thread barometer
  above the questions.
- **SPEC-ODY-051:** Each miss in a sitting must visibly fray the thread.
- **SPEC-ODY-052:** A later correct retake must be able to mend previously missed
  omens according to the existing missed-omens behavior.
- **SPEC-ODY-053:** The fraying thread must not lock the user out, reset progress,
  or create a fail state.
- **SPEC-ODY-054:** Existing authored omens with no `format` field must continue
  to render through the existing multiple-choice path.
- **SPEC-ODY-055:** Sequence omens must have an interactive ordering renderer
  that does not break the existing choice renderer.

### Voice and Copy

- **SPEC-ODY-060:** User-facing copy must stay in the established Loom / Oracle
  register: parchment, wine and gold, lightly mythic, never purple.
- **SPEC-ODY-061:** The Fates framing must remain soft: Clotho sets the measure,
  Lachesis allots the pages, and Atropos waits at the theater door.
- **SPEC-ODY-062:** The feature must not present the countdown as a punitive
  timer or failure bar.
- **SPEC-ODY-063:** Quotation marks remain reserved for verbatim Fagles. Any
  unverified wording must be paraphrased or labeled without quotation marks.

### Verification and Deployment

- **SPEC-ODY-070:** Unit tests must cover date behavior, streak transitions, DST,
  kinship filtering, band separation, same-character distractor exclusion,
  sequence answer order, line-omen generation, and Daily Rite thin-pool behavior.
- **SPEC-ODY-071:** The source app must pass a direct-open smoke pass from
  `app/index.html`.
- **SPEC-ODY-072:** The generated single-file bundle must pass the bundler sanity
  checks with no leftover data refs and no un-inlined first-party app scripts.
- **SPEC-ODY-073:** The deploy copy must be byte-identical to the generated
  bundle: `cmp the-muses-odyssey.html index.html` must pass after refresh.
- **SPEC-ODY-074:** A human smoke pass must verify the home hub, deadline hiding,
  day completion, Daily Rite non-recording behavior, and fraying-thread behavior.

## Non-Goals

- No timer.
- No fail state, lockout, or penalty state.
- No mercy days or grace-day policy.
- No notifications.
- No Supabase sync for streak or day-log state in this feature.
- No settings page.
- No rewrite of authored book data solely to support derived omens.
- No change to the 48-book plan model.

## Traceability

| Board ticket | Spec criteria |
| --- | --- |
| CD-01 | SPEC-ODY-010 through SPEC-ODY-011, SPEC-ODY-026, SPEC-ODY-070 |
| CD-02 | SPEC-ODY-004, SPEC-ODY-027, SPEC-ODY-072 |
| CD-03 | SPEC-ODY-031, SPEC-ODY-033 through SPEC-ODY-035, SPEC-ODY-070 |
| CD-04 | SPEC-ODY-030 through SPEC-ODY-039, SPEC-ODY-070 |
| CD-05 | SPEC-ODY-001 through SPEC-ODY-004, SPEC-ODY-072 |
| CD-06 | SPEC-ODY-020 through SPEC-ODY-027 |
| CD-07 | SPEC-ODY-012 through SPEC-ODY-016, SPEC-ODY-060 through SPEC-ODY-063 |
| CD-08 | SPEC-ODY-050 through SPEC-ODY-055 |
| CD-09 | SPEC-ODY-040 through SPEC-ODY-044 |
| CD-10 | SPEC-ODY-070 through SPEC-ODY-074 |
