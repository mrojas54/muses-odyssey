# RESUME — Quiz History Sync execution

**Read this first on session resume.** It is the recovery map; trust it + `git log` + the ledger over any recollection.

## What we're building
Cross-device quiz history for **The Muse's Odyssey**. Every completed sitting (per-book Ninth Hour quiz + the Grand Examination) is recorded to Supabase so a single shared reader sees the same history/best-scores on every device. localStorage stays the instant on-device source of truth; Supabase is a best-effort sync layer.

## Where everything is
- **Working repo (execute here):** `/Users/michellerojas/Claude/Projects/The Odyssey - Antimetal/muses-odyssey`
  - Branch: **`feat/quiz-history-sync`** (base `2e1fb2f`). Source imported at commit **`f0130c7`**.
  - This is the clone of GitHub **`mrojas54/muses-odyssey`** (public; `gh` authed as mrojas54, ssh).
- **Spec (approved):** `docs/superpowers/specs/2026-07-06-quiz-history-sync-design.md`
- **Plan (approved, revised):** `docs/superpowers/plans/2026-07-06-quiz-history-sync.md` — 10 tasks, exact diffs, no placeholders except deploy creds.
- **Progress ledger:** `.superpowers/sdd/progress.md` (git-ignored — recover from `git log` if lost).
- The old scratch folder `…/the-muses-odyssey/` is superseded; the source now lives in the repo. Do NOT edit the scratch folder.

## Execution method
**superpowers:subagent-driven-development** — fresh implementer subagent per task, task reviewer (spec + quality) after each, broad final review at the end. Ledger tracks completion. Dispatch cheap models for transcription-style tasks (the plan contains full code), mid-tier for reviewers.

## Locked decisions (do not relitigate)
- **Single shared user, no auth.** Client carries a scoped `muse_reader` JWT (client-visible by design; RLS shuts the bare endpoint).
- **RLS + `muse_reader` role claim**, hard **90-day** token `exp`, **manual** rotation.
- **Three tables:** `book_progress` (current state), `attempts_summary` (per sitting), `attempts_raw` (per omen, FK → summary). Full DDL is in plan **Task 1 Step 1**.
- **Merge:** `best_score=max`, `read=OR`, `misses=last-write-wins` by `updated_at` (local stamps `loom.updated.<id>` via `touch()`).
- **Fire-and-forget, no retry.** Orphan summary-without-raw is acceptable (History reads summary-only).
- **History view = "Chronos"** (Χρόνος, personified Time) — thematic only; NOT a character in the poems, NOT Kronos the Titan.
- **Deploy model = runtime protocol gate** (user decision). One single-file bundle is the deployed artifact (repo-root `index.html`, served by Pages) *and* the offline `file://` artifact. `syncConfigured()` requires `/^https?:$/.test(location.protocol)` → sync LIVE on Pages (https), SILENT offline (file://). `build-single-file.js` is UNCHANGED.

## Execution-time discoveries (already reconciled — don't rediscover)
1. The GitHub repo tracked ONLY the built `index.html` (deploy output). The source tree was untracked-local → **imported into the repo** (commit f0130c7). "One repo" now holds source + built output.
2. Pages serves the *bundle*, not a multi-file app → resolved via the runtime protocol gate above. Plan Task 9 changed from "inject `window.LOOM_SYNC=null`" to "rebuild + verify gate" (no bundler edit). Plan Global Constraints, Task 2 `syncConfigured`, Task 9, Task 10 Step 3, File Structure table, and the deviation note were all updated to match.

## Build/deploy pipeline (for Tasks 9–10)
`build-single-file.js` reads `app/index.html` (source of truth), inlines manifest + `data/*.js` + an iOS localStorage shim, neutralizes the async loader, writes `the-muses-odyssey.html`. Deploy = `node build-single-file.js` → `cp the-muses-odyssey.html index.html` → commit → push. Pages serves root `index.html`. The sync-module insertion point (between `const label=…` and `function boot(){`) does not touch any bundler anchor.

## STATUS: blocked on Supabase provisioning (user action)
The user chose "create a new Supabase project now." **Waiting on the user to provide three things:**
1. **Project URL** (`https://xxxx.supabase.co`) — public, paste OK
2. **anon/public key** (`eyJ…`) — public, paste OK
3. **Minted `muse_reader` token** (`eyJ…`) — client-visible, paste OK. User mints it locally (JWT secret NEVER shared):
   ```bash
   JWT_SECRET='...' npx --yes jsonwebtoken-cli sign '{"role":"muse_reader"}' "$JWT_SECRET" --expiresIn 90d
   ```

## NEXT ACTIONS (in order) once creds arrive
1. Create `supabase/schema.sql` from plan Task 1 Step 1; have user run it in the Supabase SQL editor; commit it.
2. curl-verify the RLS gate (plan Task 1 Step 4): `muse_reader` token → 200; anon-only write → 401/403.
3. Mark Task 1 complete in the ledger. Note token mint date + day-85 rotation reminder.
4. Dispatch subagents for **Tasks 2→8** (code + hermetic Playwright smoke tests — these need NO live Supabase; they stub via `window.LOOM_SYNC`). One implementer + one reviewer per task; fix loop on Critical/Important.
   - Task 2: test scaffold (`package.json`, `playwright.config.js`, `tests/smoke.spec.js`) + full sync module + `boot()` pull wiring. **Remember the `syncConfigured` protocol-gate line** (`/^https?:$/.test(location.protocol)`) — plan already has it.
   - Task 3: `buildQuiz` rawRows + `reveal` push. Task 4: `buildExam` + `examReveal`. Task 5: fail-soft. Task 6: merge verify. Task 7: Chronos view + buttons + CSS. Task 8: expiry notice.
5. Task 9: `node build-single-file.js`, verify gate (file:// silent, http live), commit rebuilt bundle.
6. Task 10: inline real creds into `app/index.html` CFG, rebuild bundle → `index.html`, push branch, PR to `main`, run manual cross-device verification. Set day-85 rotation reminder.
7. Final whole-branch code review (most capable model) → superpowers:finishing-a-development-branch.

## Guardrails
- Do NOT start on `main` — stay on `feat/quiz-history-sync`.
- Do NOT re-dispatch any task the ledger marks complete.
- Playwright: first run needs `npx playwright install --with-deps chromium`.
- Bash tool blocks `ls/find/grep/wc/cat/sed/echo/head/tail` — use Read/Glob/serena instead.
