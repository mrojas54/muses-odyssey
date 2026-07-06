# PRD — The Muse's Odyssey: a reading-comprehension companion for the Iliad & Odyssey

| | |
|---|---|
| **Owner** | Michelle |
| **Status** | Draft v1.4 — engine built out: typed comprehension testing, cross-book threads, and cross-book Review all shipped; Book 1 ported; coverage ongoing |
| **Last updated** | 2026-06-28 |
| **Name** | **The Muse's Odyssey** (locked) — the Muse for the love of the reading and the seat earned; *Odyssey* for the journey, the epic, and the prescreening it preps for |
| **One-liner** | A no-build, data-driven web app that turns each book of Homer into a guided deep dive of *events and characters* + a self-testing examination that probes recall **and** understanding, so comprehension compounds as the reading does. |

---

## 1. Problem & context

The reading plan (the Loom) runs both epics — 48 books — against a hard date: the *Antimetal Presents: The Odyssey* prescreening, **Wed July 15, 7:30 PM**. Pages can be turned on schedule and still not *land* — the failure mode is comprehension, not count (the Oracle's own verdict on a 0-score night: "the thread frays at the meaning, not the count"). Loose per-book HTML files were proving the concept but don't scale to 48 books or accumulate any memory of what was understood.

**The job to be done:** after reading a book, quickly (a) re-anchor the major beats (the *events*) and why they matter, (b) meet the cast (the *characters*), and (c) test comprehension — not just *what happened* but *why it matters* and *how it ties to what came before* — with the app remembering performance so weak spots resurface.

**What changed in v1.3 (the brief that prompted it):** the work had drifted toward a *static* artifact — a PRD describing an app that, in practice, held one book. The instruction was plain: *less static, more built-out app.* So v1.3 stops treating the engine as a demo and ships the two things that make comprehension testable rather than decorative — **typed examinations** (events vs. meaning) and **cross-book threads** — and ports Book 1 in so the threads have two real ends to tie.

## 2. Goals / non-goals

**Goals**
- One reusable engine; adding a book is a data edit, not a code edit.
- Each book = scene-set → key terms → the major beats (events: what + why) → similes → roster (characters) → cross-book threads → examination.
- The examination tests comprehension in **layers**, not just recall: every omen is tagged `event` (what happened), `meaning` (why it matters / theme), or `thread` (how it ties to an earlier book). The verdict reports a **per-layer breakdown** so a high score on facts can't hide a weak grasp of meaning.
- **Cross-book threads** are first-class: a book names how it ties back to (or sets up) another, the link is walkable in the app, and all threads collect into one woven view.
- Quiz performance persists per book; **missed omens are remembered** and flagged on the next sit so weak spots resurface.
- Runs by double-clicking a file. No server, no toolchain, works offline.
- Authoring a book is a single Claude Code command.

**Non-goals (v1)**
- Multi-user, accounts, sync, or hosting.
- A backend or database.
- A build step or framework (React/Vite) — now *permitted* (constraint lifted 2026-06-28) but **deferred by choice**: stays no-build until a P2 feature (search, spaced-repetition UI) actually needs it, so authoring/viewing keeps zero friction during the reading window.
- Original translation or full text reproduction; the app teaches *around* the reader's translation — **Robert Fagles** (Penguin; Knox intros). Quoted lines are verbatim Fagles with a book.line cite; anything unconfirmed is paraphrased, never quoted.

## 3. User & primary use case

Single user (the reader). Primary loop, nightly during the reading window:

> Finish a book → run `/deep-dive-odyssey <epic> <n>` in Claude Code → refresh the app → read the deep dive → sit the Ninth Hour examination → note the verdict.

Secondary loop, later: → open the app → review books with low or stale scores before the prescreening.

## 4. Product principles

1. **Content scales by data, not code.** The renderer is fixed; books are JSON-shaped `.js` files.
2. **Honest over ornamental.** The house voice (the "Loom" register — the Fates at their weaving) is mythic but never fabricates fact; uncertain claims say so (e.g. *Iliad* names Troy, it does not mean "wound").
3. **Teach in the answer.** Every quiz "truth" explains, it doesn't just confirm.
4. **The deadline sets priority.** Coverage of all 48 books before July 15 outranks feature richness. Features earn their place only if they don't slow authoring.
5. **No surprises at open.** Works on `file://`; nothing depends on network or install.

## 5. The comprehension model (what "test reading comprehension" means here)

The examination — *the Ninth Hour* — is built to catch the real failure mode: pages turned without meaning landing. Each book's omens are tagged by layer:

| Layer | `kind` | What it checks | Example (Book 1) |
|-------|--------|----------------|------------------|
| **Events** | `event` | Recall of the beats: who did what, in what order | *What roused Apollo's plague?* → the spurned priest Chryses |
| **Why it matters** | `meaning` | The point beneath the beat — theme, the force of a term | *Why is losing Briseis a catastrophe?* → she is his geras, the public token of his honor (timē), not a love |
| **Cross-book thread** | `thread` | How this book ties to one already read | *How does Zeus's nod to Thetis return in Book 2?* → as the lying Dream |

After a sit, the verdict shows the **breakdown** (e.g. *Events 3/3 · Why it matters 1/2 · Cross-book thread 1/1*). A reader who aces the facts but stumbles on meaning sees exactly that — which is the whole point. Missed omens are stored and **flagged "↺ missed last time"** on the next sit, so the weak strand is the one you re-walk.

**Cross-book threads** carry their own weight: each book declares ties (`back` to an earlier book, `ahead` to a later one) with a short note in the Loom voice. Threads render in the book *and* collect into a global **Woven Threads** view, and each is a live link you can follow in either direction (greyed when the far end isn't written yet). This is what turns 48 isolated quizzes into one accumulating understanding of the whole age.

## 6. Scope

### P0 — must exist before the doors open (July 15)
- **Engine** (done, built out): data-driven renderer, manifest, `file://`-safe `<script>` data loading; on-screen masthead.
- **Typed examinations** (done, v1.3): `event` / `meaning` / `thread` omens with a per-layer verdict breakdown and missed-omen memory.
- **Cross-book threads** (done, v1.3): per-book thread cards + a global Woven Threads view; walkable links between books.
- **Authoring command** (done, harden): `/deep-dive-odyssey` — the app-specific command — produces a schema-valid book file (now incl. `kind` + `threads`) and registers it.
- **Coverage:** a deep dive for every book read. The headline deliverable; Book 1 + Book 2 done.

### P1 — high value, fits the window if time allows
- **Spaced review across books** (done, v1.4): a **Review** mode that resurfaces *only* the stored missed omens, pulled from every book at once; answering an omen correctly mends it (it leaves the page and clears from that book's miss list), a wrong answer keeps it frayed. Reachable from the home grid and every book's top bar, with a live outstanding-misses count.
- **Reading progress** (done): all-books home grid (48 cells, unwritten greyed), prev/next in reading order, per-book "mark read" toggle, authored/read progress bar.
- **Port existing assets** (done, v1.3): Book 1 walkthrough + roster + examination folded into `data/iliad-01.js`; the standalone HTML files are now redundant.

### P2 — nice, post-deadline
- **Search** across characters, terms, and movements (e.g. "every appearance of Athena").
- **Export / print** a book's deep dive to PDF for offline review.
- **Thread map:** a small visual of the weave (which books tie to which) rather than the current list.

## 7. Success metrics

- **Coverage:** % of read books with a deep dive (target 100% by July 14).
- **Comprehension, not just recall:** average best quiz score across books ≥ 4/5; **and** no book left with a `meaning`-layer breakdown below half by the prescreening (the breakdown makes this measurable, not vibes).
- **Threads land:** every authored book past Book 1 carries at least one `back` thread, and the `thread` omen is answered correctly on a best sit — evidence the books are connecting, not sitting in isolation.
- **Authoring cost:** a new book deep-dive authored + verified in ≤ 1 command + 1 refresh, < 5 min of human time.
- **Durability:** app opens and renders with zero console errors on `file://`.

## 8. Open questions / decisions

| # | Question | Default if unanswered |
|---|----------|----------------------|
| 1 | Cross-book **spaced review** (resurface stored misses across *all* books in one mode) — build it next? | **Resolved (2026-06-28, v1.4):** shipped. Mending an omen clears it from the book's miss list; frayed ones persist. |
| 2 | Port Book 1 + the two examinations into the app? | **Resolved (2026-06-28, v1.3):** ported to `data/iliad-01.js`; standalone HTML now redundant. |
| 3 | Ever migrate to React/Vite SPA? | **Resolved (2026-06-28):** a build is allowed, but stay no-build until a P2 feature needs it. When it does, port, don't rewrite. |
| 4 | Author Odyssey books ahead of reading them (spoiler risk) or strictly after? | Strictly after each book is read; voice stays spoiler-aware only for books already behind. `ahead` threads hint, never spoil. |

## 9. Milestones

- **M0 — Engine + Book 2 + name (done, 2026-06-28).** Scaffold, schema, authoring command, first deep dive; named *The Muse's Odyssey*, masthead wired through.
- **M1 — Built-out engine (done, 2026-06-28, v1.3).** Typed examinations (`event`/`meaning`/`thread`) with verdict breakdown + missed-omen memory; cross-book threads + Woven Threads view; Book 1 ported so threads have two ends.
- **M2 — Iliad coverage.** Deep dives keep pace with reading through Iliad Book 24 (~July 5 thread).
- **M3 — Cross-book review (done, 2026-06-28, v1.4).** A single Review mode that resurfaces stored misses across all books; mended omens clear, frayed ones persist.
- **M4 — Odyssey coverage.** Deep dives through Odyssey Book 24 by July 14.
- **M5 — Pre-screening polish (P2, optional).** Search / export / thread-map if time remains.

## 10. Changelog

- **v1.5 (2026-06-29)** — **Authoring command made app-specific.** Renamed the generic `/deep-dive` command to `/deep-dive-odyssey` so it reads as part of The Muse's Odyssey rather than a general-purpose tool; file `claude-code/deep-dive.md` → `claude-code/deep-dive-odyssey.md` (installs to `.claude/commands/deep-dive-odyssey.md`), with its description noting it authors into *this* app's `LOOM_DATA` format. The project and app folder stay **`the-muses-odyssey`** (an interim folder rename was reverted). Operational references updated across `CLAUDE.md`, `PRD.md`, `PLAN.md`; the display name remains **The Muse's Odyssey**.
- **v1.4 (2026-06-28)** — **Cross-book Review mode shipped.** One screen gathers every missed omen from every book into a single re-walking; answering correctly *mends* the strand (clears it from that book's miss list and dims the card), a wrong answer keeps it frayed. Entry points on the home grid (with a live outstanding count) and every book's top bar; an empty state when nothing frays. Verified headlessly: misses gather across both books, mended strands persist out of storage while frayed ones remain, empty + zero-count states behave — no runtime errors.
- **v1.3 (2026-06-28)** — **Built out from static to functional.** Examination is now *typed*: every omen is `event` (recall), `meaning` (why-it-matters / theme), or `thread` (cross-book), and the verdict reports a per-layer breakdown; missed omens are stored and flagged "↺ missed last time" on re-sit. **Cross-book threads** shipped: per-book thread cards + a global **Woven Threads** view with walkable links (greyed when the far end is unwritten). **Book 1 ported** to `data/iliad-01.js` (6 typed omens, 1 thread to Book 2); Book 2 tagged + given two `back` threads and a `thread` omen. Schema + `/deep-dive` updated for `kind` and `threads`. Hardened the boot path (moved data-load kickoff after all declarations) so an empty manifest can't crash. Verified headlessly: 48-cell grid, 3 woven threads, typed breakdown, miss-memory, empty-manifest boot — no app-level runtime errors.
- **v1.2 (2026-06-28)** — Phase-3 navigation shipped (no-build): all-books home grid for 48, prev/next in reading order, "mark read" toggle, authored/read progress bar; loader fetches only authored data files (no console 404s) while the grid shows the full plan. Recorded source text as **Robert Fagles** with a verbatim-quote rule; Book 2 epigraph confirmed against Fagles (Iliad 2.1–2). Build constraint lifted but deferred by choice.
- **v1.1 (2026-06-28)** — Named **The Muse's Odyssey** (chosen over *The Loom*, *Calliope*, *Muse Mood*, et al.); masthead + titles + doc headers rebranded; app folder renamed `odyssey-app/` → `the-muses-odyssey/`. Internal data API (`LOOM_*`) and the reading *plan's* name ("the Loom" in the tracker) intentionally kept. Movement count relaxed from a fixed 7–9 to "the major beats" (validator range 3–10).
- **v1 (2026-06-28)** — Initial PRD: problem, goals, scope, metrics, milestones. Engine + Book 2 deep dive built; `/deep-dive` authoring command scaffolded.
