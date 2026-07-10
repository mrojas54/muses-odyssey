# Countdown Lattice Board

**Date:** 2026-07-10  
**Deadline:** 2026-07-28  
**Source contract:** `docs/superpowers/specs/2026-07-09-daily-rite-and-derived-omens-design.md`  
**Execution plan:** `docs/superpowers/plans/2026-07-09-daily-rite-and-derived-omens.md`

This is a lightweight lattice-style board for the countdown work. It is not a full
Lattice orchestration run: this repo does not yet have a complete `SPEC.md` /
`EVALUATION.md` / `BUILDPLAN.md` contract for the lattice-orchestrator. Use this
as the working board for the July 28 book-club countdown feature.

## Countdown Reality

- As of 2026-07-10, Atropos waits 18 days hence.
- The 2026-07-09 plan examples should say 19 days; older drafts with a shorter
  countdown were anchored to the superseded prescreening date.
- The denominator is authored-and-unread books, not all 48 planned books.
- The deadline line must hide after 2026-07-28; it must never show a negative countdown.

## Board

| Lane | Ticket | Work | Depends on | Acceptance |
| --- | --- | --- | --- | --- |
| Done | CD-01 | Clock foundation: local `todayKey`, `prevKey`, streak transition, `daysUntil`. | none | `test/clock.test.js` covers local date parts, DST, streaks, and negative post-deadline count. |
| Done | CD-02 | Bundle safety for countdown clock: inline `clock.js`; flag volatile storage. | CD-01 | Bundle sanity reports no un-inlined `clock.js`; `__loomVolatile` is present in the generated file. |
| Done | CD-03 | Initial derived omen foundation: kinship filter, band routing, epithet pool, deterministic shuffle. | none | `test/omens.test.js` covers kinship forms, band separation, dedupe, and no mutation. |
| Ready | CD-04 | Finish derived omen generators: `epithetOmen`, `sequenceOmen`, `lineOmen`, then `dailyRite`. | CD-03 | Unit tests prove same-band distractors, no repeated character, non-contiguous movement order, honest Fagles-line blanks, and graceful thin-pool behavior. |
| Ready | CD-05 | Wire `omens.js` into source and bundle. | CD-04 | Source opens with `app/index.html`; generated bundle has no surviving `src="omens.js"` tag. |
| Ready | CD-06 | Add `dayLog`: read events, per-book sitting events, streak update, durability check. | CD-01 | `seedProgress()` cannot complete a day; Grand Examination and Daily Rite do not record day progress. |
| Ready | CD-07 | Home hub: daily goal, streak, authored-unread pace line, and Atropos deadline line. | CD-06 | On 2026-07-10 the line reads 18 days; after 2026-07-28 it is absent. Volatile storage suppresses streak copy. |
| Ready | CD-08 | Fraying thread and shared sitting renderer, including sequence answer UI. | CD-04 | Misses fray the thread; retakes mend it; ordinary authored omens still render through the choice path. |
| Ready | CD-09 | Daily Rite view and home entry point. | CD-04, CD-08 | Draws about 5 mixed omens from read books only; practice never advances the day log. |
| Verify | CD-10 | Full verification and deploy bundle refresh. | CD-05, CD-06, CD-07, CD-08, CD-09 | Tests pass; source smoke passes; bundle rebuild passes; `the-muses-odyssey.html` and root `index.html` match. |

## Critical Path

1. CD-04: finish the pure omen generators first, because UI work depends on stable omen shapes.
2. CD-05: immediately teach the source and bundle about `omens.js`, so deploy drift is caught early.
3. CD-06 and CD-07: land the actual countdown behavior before visual polish.
4. CD-08 and CD-09: add richer practice once the day-completion rules are already protected.
5. CD-10: rebuild, compare, and deploy only after source and bundle both pass.

## Guardrails

- Do not touch the 60 authored quiz omens.
- Do not use `fetch`, `import`, or package tooling; keep script-tag loading.
- Do not quote Fagles unless the source line is already verbatim in the data.
- Do not make a timer, fail state, or negative deadline bar.
- Do not count seeded progress as daily work.
- Do not let Daily Rite or Grand Examination advance the streak.

## Verification Commands

```bash
node --test test/clock.test.js
node --test test/omens.test.js
node build-single-file.js
cp the-muses-odyssey.html index.html
cmp the-muses-odyssey.html index.html
```

## Human Smoke Pass

- Open `app/index.html` directly and confirm the home hub renders.
- With the app date behavior set to 2026-07-10, confirm the Atropos line says 18 days.
- Mark a book read and pass its per-book sitting; confirm the day completes.
- Try Daily Rite; confirm it does not complete the day.
- Miss and retake omens; confirm the thread frays and mends.
- Confirm the deadline line disappears for 2026-07-29.
