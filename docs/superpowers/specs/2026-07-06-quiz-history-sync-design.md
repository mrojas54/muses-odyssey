# Quiz History Sync — Design

> **Status: APPROVED (all §1–§8) — pending final read before the implementation plan.**
> Nothing will be implemented until you give the spec a last look. Render it in-terminal
> with `glow` (see bottom).

## 1. Goal

Let quiz results **persist as real history** and **sync across devices**, so the
books you've been examined on show up the same on your phone and your computer.

Two features, one primary and one nice-to-have:

- **Primary — cross-device quiz history.** Every completed sitting (per-book
  Ninth Hour *and* the Grand Examination) is recorded as a row in Supabase. Any
  device sees the full history: which books you've quizzed, when, and how you scored.
- **Nice-to-have — resume an in-progress Grand Examination.** Start the 36-omen
  exam for Books 1–6, leave, come back on the *same device*, and pick up where you
  left off instead of restarting.

## 2. Decisions already made (from brainstorming)

| Decision | Choice | Why |
|----------|--------|-----|
| Surface | GitHub Pages on **all** devices | Real origin + network everywhere → true sync possible |
| Store | **Supabase, proper relational tables** | Queryable history, not a single overwritten blob |
| Identity | **Single shared user, no auth** | Private hobby app; keeps code tiny (tradeoff noted below) |
| Data model | **Local-first**, cloud as a sync layer | Quizzes never block on network; offline bundle untouched |
| Resume-in-progress | **Local only** (localStorage), same device | Syncing a half-finished exam adds complexity for little gain |

### Accepted tradeoff — no login, plus a client-side gate

The site is public and there's no login, so **whatever key the page carries is
visible to anyone who reads the source.** A client-side secret therefore *cannot*
make the data truly private — it can only raise the bar. We accept that and add one
mitigation layer instead of leaving the endpoint wide open:

- **Enable Row-Level Security (RLS)** on all three tables and require a **scoped access
  token** on every call. Concretely: a long-lived JWT signed with the project's JWT
  secret, carrying a custom claim (e.g. `role: "muse_reader"`). RLS policies grant
  read/write only when that claim is present. PostgREST verifies the signature
  server-side, so the token **can't be forged or escalated** — a holder gets exactly
  the access the policies grant on the app's three tables and nothing more.
  *(Chosen over a shared-secret custom header, which is equally client-visible but
  less Supabase-native and can't carry an enforceable expiry.)*

**What this buys:** someone who merely learns the Supabase project URL (a network
log, a leak) gets **nothing** from the bare endpoint — the default anon path is shut
by RLS. **What it does not buy:** someone who opens this app's JavaScript can copy the
token and reach the same three tables. That residual risk is accepted for a solo reading
companion.

If real per-person privacy is ever wanted, the upgrade is full Supabase Auth (login) +
RLS keyed to `auth.uid()` — out of scope here.

### Token rotation policy — 90 days

Caps the blast radius of a leaked token to one quarter.

- The `muse_reader` JWT is minted with a **90-day `exp` claim**. PostgREST rejects it
  past expiry, so an old copied token dies on schedule.
- **Rotation is manual by necessity.** Signing needs the project's JWT secret, which
  must never reach the client, so a static page cannot safely auto-mint a new token.
  Procedure (calendar reminder ~day 85): regenerate the token → paste into the
  `token` field of the sync config (`window.LOOM_SYNC` / the inline `CFG` default in
  §5) → redeploy the page. Rotating the signing secret as well gives a hard
  cutoff that invalidates every prior token immediately.
- **Fail-soft must not hide an expired token.** A dead token would otherwise look
  like "offline" and silently stop syncing forever. So on a `401` / JWT-expired
  response specifically (as distinct from a network error), show a small non-blocking
  notice — *"Sync paused — token expired; time to rotate."* Local data is safe
  regardless; this is just the nudge to redeploy a fresh token.

## 3. Architecture & data flow

A thin **sync layer** bolts onto the existing localStorage model. localStorage
stays the on-device source of truth; Supabase is the shared store the devices meet in.

```
┌─────────────┐   render now    ┌──────────────┐
│ localStorage│ ───────────────▶│   the page   │
│ (loom.*)    │◀─── merge ──────│  (index.html)│
└─────────────┘                 └──────┬───────┘
       ▲                               │ async fetch (REST)
       │ write-through                 ▼
       │                        ┌──────────────┐
       └────────────────────────│   Supabase   │
                                │ book_progress│
                                │ attempts     │
                                └──────────────┘
```

**Three moments:**

1. **On load (`boot`)** — render immediately from localStorage (instant, as today),
   then async-pull from Supabase and **merge remote → local**:
   - `best_score = max(local, remote)`
   - `read = local OR remote`
   - `misses = whichever side wrote more recently` (`updated_at`) — **last-write-wins**
   Then re-render the home grid. If the fetch fails (offline / `file://` / Supabase
   down), keep the local view silently — the reader never sees an error.

   *Accepted tradeoff on misses:* LWW means if you mend different omens on two devices
   before either syncs, the earlier device's mends are overwritten, not merged. Low
   likelihood for a solo reader, and `best_score`/`read` are unaffected (both monotonic).
   Chosen for simplicity over an intersection merge.

2. **On quiz finish (`reveal` / `examReveal`)** — write localStorage exactly as
   today, *and* (append-only, so two devices never conflict):
   - `INSERT` one **`attempts_summary`** row → returns its `id`,
   - bulk-`INSERT` the sitting's **`attempts_raw`** rows referencing that `id`,
   - `UPSERT` the book's row in **`book_progress`** (best score, read flag, misses).

3. **On demand** — a new **History view** reads `attempts` to show past sittings.

**Offline bundle (`the-muses-odyssey.html`) needs zero changes:** the sync layer
feature-detects config + network and no-ops when absent, falling back to pure
localStorage.

## 4. Database schema

Three tables. `book_id` is the existing id string (`iliad-01` … `odyssey-24`), plus
the literal `exam` for the Grand Examination.

### `book_progress` — current synced state (one row per book)
| column | type | notes |
|--------|------|-------|
| `book_id` | `text` PK | e.g. `iliad-03`, or `exam` |
| `best_score` | `int` | merged as `max()` across devices |
| `total` | `int` | omen count at time of best |
| `read` | `bool` | merged as OR; not used for `exam` |
| `misses` | `jsonb` | array of question indices still outstanding |
| `updated_at` | `timestamptz` | last write; drives misses conflict resolution |

Mirrors today's `loom.best.*`, `loom.read.*`, `loom.miss.*` — this is the row the
home grid and Review loop read.

### `attempts_summary` — append-only, one row per completed sitting
| column | type | notes |
|--------|------|-------|
| `id` | `bigint` identity PK | referenced by `attempts_raw.attempt_id` |
| `book_id` | `text` | `iliad-03` or `exam` |
| `score` | `int` | |
| `total` | `int` | |
| `breakdown` | `jsonb` | by-kind: `{event:{c,t}, meaning:{c,t}, thread:{c,t}}` |
| `by_book` | `jsonb` null | per-book breakdown; **exam sittings only** |
| `taken_at` | `timestamptz` default `now()` | |

The at-a-glance history — powers the History view and any trend/last-N display
without touching the raw rows.

### `attempts_raw` — append-only, one row per omen answered
| column | type | notes |
|--------|------|-------|
| `id` | `bigint` identity PK | |
| `attempt_id` | `bigint` FK → `attempts_summary.id` | groups omens into their sitting |
| `book_id` | `text` | the omen's **source** book (= `srcId`; differs from the sitting's `book_id` for exams) |
| `qi` | `int` | question index within that book's `quiz` array |
| `kind` | `text` | `event` \| `meaning` \| `thread` |
| `chosen` | `int` | option index the reader picked |
| `is_correct` | `bool` | |

The full trail — every answer of every sitting. Enables future per-omen analytics
(which specific omens you miss most, answer-level review) that the summary can't give.

**Access policy:** RLS **enabled** on all three tables; read + write granted only to
callers presenting the scoped `muse_reader` token (see §2). No per-user rows.

## 5. App integration (`app/index.html`)

Today the state helpers are thin localStorage wrappers (`isRead`/`setRead`,
`bestScore`/`saveScore`, `priorMiss`/`saveMiss`/`clearMiss`). We keep them as the
**synchronous local layer** and add one small async module beside them.

### New: `sync` module (a handful of functions, config at top)
```
// Inline defaults, overridable via window.LOOM_SYNC. The smoke test sets it to a
// dummy host; the offline bundle sets it to null to hard-disable sync.
const CFG = (typeof window.LOOM_SYNC !== 'undefined') ? window.LOOM_SYNC : {
  url:   "https://<proj>.supabase.co",
  anon:  "<anon-key>",        // apikey header, required by PostgREST
  token: "<muse_reader-jwt>", // Bearer; RLS gates on its role claim
};
const syncEnabled = () => !!(CFG && CFG.url && CFG.token && navigator.onLine);
```
Each request sends `apikey: CFG.anon` **and** `Authorization: Bearer CFG.token`.
RLS policies pass only when the token's `muse_reader` claim is present, so the anon
key alone (the default public path) can't touch the tables. The `window.LOOM_SYNC`
seam is the single testability + bundle-disable hook — no other config lives elsewhere.
- `syncPull()` → `GET` `book_progress` (+ merge into localStorage), returns a promise.
- `pushProgress(bookId)` → `UPSERT` one `book_progress` row from current localStorage.
- `pushSitting(summary, rawRows)` → `INSERT` the `attempts_summary` row with
  `Prefer: return=representation` to get its `id`, then bulk-`INSERT` `rawRows` into
  `attempts_raw` stamped with that `attempt_id`. One logical call, two requests.
- `fetchSummaries()` → `GET` `attempts_summary` ordered by `taken_at desc` for the
  History view. (Raw rows fetched lazily only if per-omen detail is ever surfaced.)

All wrapped in `try/catch`; any failure is swallowed and logged to console only.

### Touch points (minimal, surgical)
- **`buildQuiz` / `buildExam` click handlers** — already know `qi`, `kind`, the chosen
  option, and correctness at answer time; append each to an in-closure `rawRows` array
  (`{book_id, qi, kind, chosen, is_correct}`). Cheap: it rides the existing handler,
  no new data extraction. (For exams `book_id` is the omen's `srcId`.)
- **`boot()`** — after the existing localStorage boot, call `syncPull().then(reRenderIfHome)`.
- **`reveal(...)`** (per-book) — after `saveScore`/`saveMiss`, call
  `pushSitting({book_id:current, score, total, breakdown}, rawRows)` and `pushProgress(current)`.
- **`examReveal(...)`** (exam) — same, with `book_id:'exam'`, `by_book` populated (it's
  already computed for the on-screen breakdown), and `rawRows` carrying each omen's `srcId`.
- **Home / topbars** — add a **History** button next to Threads / Review / Examination.

### New UI — the History view ("Chronos")
A new `showHistory()` view in the app's Fates/Loom voice, titled **Chronos** (Χρόνος,
the personification of Time) — the record of your reckonings over time. Reads
`attempts_summary`, groups newest-first, one section per book (canonical `ORDER`) plus
an Examination section:
- each row: date · `score / total` · a faint kind or verdict tint,
- an empty state in-voice ("Chronos has kept no reckonings yet…").

**Voice guardrail (per the honesty rule):** Chronos is used as a *thematic* name for
Time/record only. The app must **not** present him as a character in the *Iliad* or
*Odyssey* (he is not), and must not conflate him with **Kronos** the Titan (a
different figure). Keep the label evocative, never a false claim about the text.

### Nice-to-have — resume in-progress exam (local, Phase 2)
- On answering during `buildExam`, persist `loom.exam.inprogress = { order:[{srcId,qi}],
  answers:{idx:chosenOi}, ts }` to localStorage.
- On `showExam()`, if a non-empty, non-complete in-progress sitting exists, offer
  **"Resume the sitting (n of m answered)"** vs **"Begin anew"**.
- Clear it on completion. Local only — not written to Supabase.

## 6. Error handling, offline, security

- **Local-first, fail-soft:** every Supabase call is best-effort. Network/CSP/`file://`
  failures degrade to localStorage with a `console.warn`, never a visible error.
- **One exception — token expiry:** a `401`/JWT-expired response *is* surfaced (small
  non-blocking notice), so an expired `muse_reader` token doesn't masquerade as
  "offline" and silently kill sync (see §2 rotation policy). All other failures stay silent.
- **Client carries only the scoped `muse_reader` token** (see §2); RLS shuts the
  bare endpoint. The token is client-visible by nature — accepted, not hidden.
- **CSP:** GitHub Pages sets no restrictive CSP by default; confirm `fetch` to the
  Supabase host isn't blocked. The offline bundle's sandbox simply means no sync there.
- **Idempotency & no retry:** attempt inserts are fire-and-forget; the completion
  handler already fires once on `answered===total`, so no double-submit. **No retry
  queue** (accepted): if `pushSitting` writes the summary but the raw bulk-insert
  fails, that sitting keeps a correct `attempts_summary` row with no `attempts_raw`
  rows — a harmless orphan. The History view (summary-only) is unaffected; only
  per-omen detail for that one sitting is lost. Matches "local-first, cloud is a bonus."

## 7. Testing

### Automated smoke test (Playwright)

One small spec (`tests/smoke.spec.js`), added as a `@playwright/test` devDependency,
run with `npx playwright test`. Proves the wiring fires — not exhaustive coverage.

- **Setup:** serve `app/` via Playwright's `webServer`; before the app loads, inject
  `window.LOOM_SYNC = { url:'https://dummy.test', anon:'a', token:'t' }` (the §5 seam)
  and intercept `**/rest/v1/**` with `page.route` to **record** each request
  (method, path, body) and return canned JSON.
- **Cases:**
  1. **Pull on load** — assert a `GET …/book_progress` fires during boot.
  2. **Push on finish** — answer every omen of one book; assert the ordered trio
     `POST …/attempts_summary` → `POST …/attempts_raw` → upsert `…/book_progress`,
     each with a well-formed payload (raw carries `attempt_id`, `qi`, `chosen`, `is_correct`).
  3. **Fail-soft** — make the route `abort()`; assert the quiz still completes, the
     score persists in `localStorage`, and no uncaught error is thrown.

Deeper branches (merge policy, expiry notice, cross-device) stay in the manual list
below — the smoke test guards the wiring, the manual pass guards the semantics.

### Manual verification
1. **Local-only still works** — open the offline bundle, take a quiz, confirm best
   score + misses persist and no console errors (sync no-ops).
2. **Round-trip** — on Pages, finish a per-book quiz → confirm one `attempts_summary`
   row, its N `attempts_raw` rows (correct `attempt_id`, `chosen`, `is_correct`), and
   the updated `book_progress` row in Supabase.
3. **Cross-device** — finish a sitting on device A, load on device B, confirm the
   home grid best score and History view reflect it after `syncPull`.
4. **Merge policy** — set a higher best on A and a lower on B, confirm `max()` wins;
   toggle read on one, confirm OR.
5. **Exam** — finish the 36-omen exam, confirm `by_book` populated and per-book rows
   render in History.
6. **Resume (Phase 2)** — answer part of the exam, reload, confirm resume offer and
   restored answers.
7. **Token expiry** — point the client at an expired/invalid `muse_reader` token,
   confirm the "Sync paused — token expired" notice appears and local quizzing is
   unaffected.

## 8. Out of scope

- Auth / per-user privacy (Supabase Auth + RLS) — future migration if ever needed.
- Syncing an in-progress exam across devices.
- Trend charts / analytics beyond a plain history list.
- Any change to book-authoring, the schema of `data/*.js`, or the reading content.

---

### How to read this in c11
```
glow "docs/superpowers/specs/2026-07-06-quiz-history-sync-design.md"
```
Add `-p` for a scrollable pager (`TERM=xterm-256color glow -p …` if colors misbehave).
