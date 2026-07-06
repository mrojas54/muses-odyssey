# Quiz History Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record every completed quiz sitting to Supabase so a single shared reader sees the same quiz history and best-scores on every device, while localStorage stays the instant on-device source of truth.

**Architecture:** A thin best-effort "sync layer" bolts onto the existing localStorage state model in `app/index.html`. On load it pulls `book_progress` and merges remote→local; on every quiz/exam finish it appends one `attempts_summary` row + its `attempts_raw` omen rows and upserts `book_progress`. A new "Chronos" view reads the summaries. All network failures degrade silently to localStorage; the sole loud failure is an expired token.

**Tech Stack:** Vanilla JS single-file app (no build step), Supabase (PostgREST + Row-Level Security + a scoped `muse_reader` JWT), Playwright for one smoke test.

## Global Constraints

- **No build step for the app.** `app/index.html` is edited directly; it loads `../data/*.js` via `<script>`. Keep it a single self-contained file.
- **Local-first, fail-soft.** Every Supabase call is best-effort. Network / CSP / `file://` failures degrade to localStorage with `console.warn` only — never a visible error. **Exception:** a `401`/JWT-expired response shows a small non-blocking notice.
- **Single shared user, no auth.** The client carries only the scoped `muse_reader` JWT (client-visible by nature — accepted). RLS shuts the bare endpoint.
- **Fire-and-forget, no retry.** The completion handler fires once (`answered===total`). A summary-written-but-raw-failed sitting is a harmless orphan (History reads summary-only).
- **Merge policy:** `best_score = max()`, `read = OR` (both monotonic), `misses = last-write-wins` by `updated_at`.
- **Voice:** Fates/Loom/Oracle register. The History view is **Chronos** (Χρόνος, personified Time) — used *thematically only*; the app must NOT present him as a character in the *Iliad*/*Odyssey*, and must NOT conflate him with **Kronos** the Titan.
- **`book_id` values:** the existing id strings (`iliad-01` … `odyssey-24`) plus the literal `exam` for the Grand Examination.
- **Config seam:** all sync config flows through `window.LOOM_SYNC` → the `CFG` object (the single testability hook).
- **Runtime surface gate (deploy decision):** the deployed artifact is the single-file bundle at the repo root `index.html`, served by GitHub Pages *and* used offline via `file://`. Sync must self-gate on origin: `syncConfigured()` requires `location.protocol` to be `http`/`https`. On Pages (`https:`) sync is live; opened as a `file://` bundle it is silent. The bundler is therefore **unchanged** — no build-time disable.
- **Token rotation:** the `muse_reader` JWT carries a hard 90-day `exp`; rotation is manual (paste a fresh token into `CFG.token`, redeploy).

**Working tree:** Execute this plan inside a clone of the live repo **`mrojas54/muses-odyssey`** (one repo — the current design folder was scratch). All `git` steps below target that clone.

---

## File Structure

| File | Create/Modify | Responsibility |
|------|---------------|----------------|
| `app/index.html` | Modify | Add the sync module + wire boot/reveal/examReveal/buildQuiz/buildExam; add the Chronos view, its buttons, and CSS. |
| `supabase/schema.sql` | Create | DDL for the three tables, the `muse_reader` role, RLS policies, and grants. Run once in the Supabase SQL editor (reference artifact, not loaded by the app). |
| `package.json` | Create | Declares the `@playwright/test` devDependency and a `test` script. |
| `playwright.config.js` | Create | Serves the repo root and points tests at `/app/index.html`. |
| `tests/smoke.spec.js` | Create | The three smoke cases (pull-on-load, push-on-finish, fail-soft). |
| `build-single-file.js` | Unchanged (runs) | Bundles the sync-aware `app/index.html` → `the-muses-odyssey.html`. No edit needed — the runtime protocol gate handles offline. |
| `the-muses-odyssey.html` / root `index.html` | Regenerate | Built bundle; the root `index.html` copy is what GitHub Pages serves. Rebuilt in Tasks 9–10. |

---

## Task 1: Supabase backend (schema, role, RLS, token)

Stand up the three tables and the scoped access path. This is infra done in the Supabase dashboard; the deliverable is verified with `curl`.

**Files:**
- Create: `supabase/schema.sql`

**Interfaces:**
- Produces: three REST resources under `<project>.supabase.co/rest/v1/` — `book_progress`, `attempts_summary`, `attempts_raw` — reachable **only** with a `muse_reader` JWT; and a minted 90-day `muse_reader` token string used as `CFG.token`.

- [ ] **Step 1: Write the schema file**

Create `supabase/schema.sql`:

```sql
-- ── Quiz History Sync schema ───────────────────────────────────────────────
-- Run once in the Supabase SQL editor. Single shared reader; no per-user rows.

-- current synced state, one row per book (or 'exam')
create table if not exists public.book_progress (
  book_id    text primary key,
  best_score int,
  total      int,
  read       boolean default false,
  misses     jsonb   default '[]'::jsonb,
  updated_at timestamptz default now()
);

-- append-only: one row per completed sitting
create table if not exists public.attempts_summary (
  id        bigint generated always as identity primary key,
  book_id   text not null,
  score     int  not null,
  total     int  not null,
  breakdown jsonb,          -- by-kind: {"event":{"c":n,"t":n}, ...}
  by_book   jsonb,          -- per-book breakdown; exam sittings only
  taken_at  timestamptz default now()
);

-- append-only: one row per omen answered
create table if not exists public.attempts_raw (
  id         bigint generated always as identity primary key,
  attempt_id bigint not null references public.attempts_summary(id) on delete cascade,
  book_id    text not null,   -- the omen's SOURCE book (= srcId)
  qi         int  not null,
  kind       text,
  chosen     int,
  is_correct boolean
);
create index if not exists attempts_raw_attempt_idx on public.attempts_raw(attempt_id);

-- ── scoped role: the JWT's `role` claim switches PostgREST to this DB role ──
do $$ begin
  if not exists (select from pg_roles where rolname = 'muse_reader') then
    create role muse_reader nologin;
  end if;
end $$;
grant muse_reader to authenticator;
grant usage on schema public to muse_reader;
grant select, insert, update on public.book_progress   to muse_reader;
grant select, insert          on public.attempts_summary to muse_reader;
grant select, insert          on public.attempts_raw     to muse_reader;
grant usage, select on all sequences in schema public to muse_reader;

-- ── RLS: only a caller presenting the muse_reader token may touch the tables ─
alter table public.book_progress   enable row level security;
alter table public.attempts_summary enable row level security;
alter table public.attempts_raw     enable row level security;

create policy muse_rw on public.book_progress    for all to muse_reader using (true) with check (true);
create policy muse_rw on public.attempts_summary for all to muse_reader using (true) with check (true);
create policy muse_rw on public.attempts_raw     for all to muse_reader using (true) with check (true);
```

- [ ] **Step 2: Run it in Supabase**

Paste the file into the Supabase **SQL editor** and run. Confirm no errors and that the three tables appear under **Table editor** with RLS enabled (a shield icon on each).

- [ ] **Step 3: Mint the 90-day `muse_reader` token**

In a scratch shell with the project's **JWT secret** (Settings → API → JWT Secret) available as `$JWT_SECRET`:

```bash
npx --yes jsonwebtoken-cli sign '{"role":"muse_reader"}' "$JWT_SECRET" --expiresIn 90d
```
(or, if `jsonwebtoken` is installed: `node -e "console.log(require('jsonwebtoken').sign({role:'muse_reader'}, process.env.JWT_SECRET, {expiresIn:'90d'}))"`)

Save the printed JWT — it becomes `CFG.token`. Note the mint date + expiry for the day-85 rotation reminder.

- [ ] **Step 4: Verify the access gate with curl**

Let `URL` = `https://<project>.supabase.co`, `ANON` = the project anon key, `TOKEN` = the minted JWT.

```bash
# With the muse_reader token → 200 and a JSON array (empty is fine):
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  "$URL/rest/v1/book_progress?select=*"
# Expected: 200

# With ONLY the anon key (the public default path) → RLS blocks it:
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  "$URL/rest/v1/book_progress?select=*"
# Expected: 200 with body [] BUT no rows ever readable/writable — confirm a write is refused:
curl -s -w "\n%{http_code}\n" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" -H "Prefer: return=minimal" \
  -d '{"book_id":"iliad-01","best_score":1,"total":1}' \
  "$URL/rest/v1/book_progress"
# Expected: 401/403 (RLS denies the anon role)
```

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(sync): Supabase schema, muse_reader role, and RLS policies"
```

---

## Task 2: Test scaffold + sync module + pull-on-load

Add the Playwright harness, drop in the full sync layer, and wire the on-load pull. The pull smoke test drives it.

**Files:**
- Create: `package.json`, `playwright.config.js`, `tests/smoke.spec.js`
- Modify: `app/index.html` (add `touch`/`localUpdated` to the state helpers ~211-215; insert the sync module after line 226; wire `boot()` ~228-231)

**Interfaces:**
- Produces (available to all later tasks):
  - `CFG` — config object from `window.LOOM_SYNC` or inline defaults.
  - `syncConfigured() → bool`, `syncEnabled() → bool`
  - `localUpdated(id) → string|null`, `touch(id) → void`
  - `syncErr(e) → void`, `noteExpired() → void`
  - `sreq(method, path, body?, headers?) → Promise<any>`
  - `syncPull() → Promise<void>`
  - `pushProgress(bookId, total) → Promise<void>`
  - `pushSitting(summary, rawRows) → Promise<void>` where `summary = {book_id, score, total, breakdown, by_book?}` and each `rawRows[i] = {book_id, qi, kind, chosen, is_correct}`
  - `fetchSummaries() → Promise<Array>` (rows of `attempts_summary`, `taken_at desc`)

- [ ] **Step 1: Write the failing smoke test (pull-on-load)**

Create `package.json`:

```json
{
  "name": "muses-odyssey",
  "private": true,
  "scripts": { "test": "playwright test" },
  "devDependencies": { "@playwright/test": "^1.44.0" }
}
```

Create `playwright.config.js`:

```js
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'python3 -m http.server 3000',
    url: 'http://localhost:3000/app/index.html',
    reuseExistingServer: true,
  },
});
```

Create `tests/smoke.spec.js`:

```js
const { test, expect } = require('@playwright/test');

// Inject the config seam and record every REST call, returning canned JSON.
async function stubSync(page, reqs, { abort = false } = {}) {
  await page.addInitScript(() => {
    window.LOOM_SYNC = { url: 'https://dummy.test', anon: 'a', token: 't' };
  });
  await page.route('**/rest/v1/**', (route) => {
    const r = route.request();
    reqs.push({ method: r.method(), url: r.url(), body: r.postData() });
    if (abort) return route.abort();
    const path = new URL(r.url()).pathname;
    if (path.endsWith('/attempts_summary') && r.method() === 'POST') {
      return route.fulfill({ status: 201, contentType: 'application/json', body: '[{"id":1}]' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

test('pull on load', async ({ page }) => {
  const reqs = [];
  await stubSync(page, reqs);
  await page.goto('/app/index.html');
  await expect
    .poll(() => reqs.some((x) => x.method === 'GET' && x.url.includes('/book_progress')))
    .toBeTruthy();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright install --with-deps chromium && npx playwright test tests/smoke.spec.js -g "pull on load"`
Expected: FAIL — no `GET …/book_progress` is ever issued (sync module doesn't exist yet).

- [ ] **Step 3: Add `touch` + `localUpdated` to the state helpers**

In `app/index.html`, replace the helper block (currently lines 211–215) so local progress writes stamp a local timestamp used for last-write-wins:

```js
const setRead = (id,v) => { localStorage.setItem('loom.read.'+id, v?'1':'0'); touch(id); };
const bestScore = id => { const v=localStorage.getItem('loom.best.'+id); return v==null?null:+v; };
const saveScore = (id,s) => { const b=bestScore(id); if(b==null||s>b){ localStorage.setItem('loom.best.'+id, s); touch(id); } };
const priorMiss = id => { try{ return JSON.parse(localStorage.getItem('loom.miss.'+id)||'[]'); }catch(e){ return []; } };
const saveMiss = (id,arr) => { localStorage.setItem('loom.miss.'+id, JSON.stringify(arr)); touch(id); };
const touch = id => { try{ localStorage.setItem('loom.updated.'+id, new Date().toISOString()); }catch(e){} };
const localUpdated = id => localStorage.getItem('loom.updated.'+id);
```

(`clearMiss` at line 216 is unchanged — it already routes through `saveMiss`, so it inherits `touch`.)

- [ ] **Step 4: Insert the sync module**

In `app/index.html`, immediately **after** `const label = id => …` (line 226) and **before** `function boot(){` (line 228), insert:

```js
/* ================= SYNC LAYER (cross-device quiz history) =================
   localStorage stays the source of truth; Supabase is the shared store.
   Every call is best-effort: failures degrade to local with console.warn.
   The one loud failure is an expired token (401) — see noteExpired(). */
const CFG = (typeof window.LOOM_SYNC !== 'undefined') ? window.LOOM_SYNC : {
  url:   "https://YOUR_PROJECT.supabase.co",  // ← fill before deploy (Task 10)
  anon:  "YOUR_ANON_KEY",                      // apikey header (PostgREST requires it)
  token: "YOUR_MUSE_READER_JWT"                // Bearer; RLS gates on its role claim
};
const syncConfigured = () => !!(CFG && CFG.url && CFG.token
  && CFG.url.indexOf('YOUR_') === -1 && CFG.token.indexOf('YOUR_') === -1
  && /^https?:$/.test(location.protocol));   // http(s) only → live on Pages, silent on file://
const syncEnabled = () => syncConfigured() && navigator.onLine;

function syncErr(e){
  if(e && e.expired) return noteExpired();
  console.warn('[sync]', (e && e.message) || e);
}
function noteExpired(){
  if(document.getElementById('syncnote')) return;
  const n=document.createElement('div'); n.id='syncnote'; n.className='syncnote';
  n.textContent='Sync paused — token expired; time to rotate.';
  document.body.appendChild(n);
}

async function sreq(method, path, body, headers){
  const res = await fetch(CFG.url + '/rest/v1/' + path, {
    method,
    headers: Object.assign({
      'apikey': CFG.anon,
      'Authorization': 'Bearer ' + CFG.token,
      'Content-Type': 'application/json'
    }, headers || {}),
    body: body ? JSON.stringify(body) : undefined
  });
  if(res.status === 401){ const err=new Error('token expired'); err.expired=true; throw err; }
  if(!res.ok) throw new Error(method+' '+path+' → '+res.status);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

/* GET all book_progress; merge remote→local (best=max, read=OR, misses=LWW). */
async function syncPull(){
  if(!syncEnabled()) return;
  const rows = await sreq('GET', 'book_progress?select=*');
  (rows||[]).forEach(row=>{
    const id=row.book_id; if(!id) return;
    const lb=bestScore(id);
    if(row.best_score!=null && (lb==null || row.best_score>lb))
      localStorage.setItem('loom.best.'+id, row.best_score);
    if(row.read) localStorage.setItem('loom.read.'+id, '1');
    const lu=localUpdated(id);
    if(row.updated_at && (!lu || row.updated_at > lu) && Array.isArray(row.misses)){
      localStorage.setItem('loom.miss.'+id, JSON.stringify(row.misses));
      localStorage.setItem('loom.updated.'+id, row.updated_at);
    }
  });
}

/* UPSERT one book_progress row from current localStorage. */
async function pushProgress(bookId, total){
  if(!syncEnabled()) return;
  const row = {
    book_id: bookId,
    best_score: bestScore(bookId),
    total: total,
    read: isRead(bookId),
    misses: priorMiss(bookId),
    updated_at: localUpdated(bookId) || new Date().toISOString()
  };
  await sreq('POST', 'book_progress', row,
    {'Prefer':'resolution=merge-duplicates,return=minimal'});
}

/* INSERT one attempts_summary row, get its id, then bulk-INSERT the raw omens. */
async function pushSitting(summary, rawRows){
  if(!syncEnabled()) return;
  const ins = await sreq('POST', 'attempts_summary', summary, {'Prefer':'return=representation'});
  const id = ins && ins[0] && ins[0].id;
  if(id==null) return;
  if(rawRows && rawRows.length){
    const stamped = rawRows.map(r => Object.assign({attempt_id:id}, r));
    await sreq('POST', 'attempts_raw', stamped, {'Prefer':'return=minimal'});
  }
}

/* GET the sitting headers for the Chronos history view. */
async function fetchSummaries(){
  if(!syncEnabled()) return [];
  return await sreq('GET', 'attempts_summary?select=*&order=taken_at.desc') || [];
}
/* ======================= END SYNC LAYER ======================= */
```

- [ ] **Step 5: Wire `boot()` to pull on load**

Replace `boot()` (lines 228–231) with:

```js
function boot(){
  const last = localStorage.getItem('loom.last');
  if(last && authored(last)) showBook(last); else showHome();
  // async: pull shared state, then refresh the home grid if that's what's showing
  syncPull().then(()=>{ if(current===null) showHome(); }).catch(syncErr);
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx playwright test tests/smoke.spec.js -g "pull on load"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/index.html package.json playwright.config.js tests/smoke.spec.js
git commit -m "feat(sync): sync layer + pull-on-load, with Playwright smoke harness"
```

---

## Task 3: Push a completed per-book sitting

Record each answered omen and, on the verdict, append the sitting and upsert progress. The push smoke test asserts the ordered trio.

**Files:**
- Modify: `app/index.html` (`buildQuiz` ~471-505; `reveal` ~507-523)
- Modify: `tests/smoke.spec.js` (add the push case)

**Interfaces:**
- Consumes: `pushSitting`, `pushProgress`, `syncErr` (Task 2).
- Produces: `reveal(score, total, stats, missArr, rawRows)` — the extra `rawRows` param is the per-omen trail for the sitting.

- [ ] **Step 1: Write the failing test (push on finish)**

Append to `tests/smoke.spec.js`:

```js
test('push on finish (per-book) fires summary → raw → progress', async ({ page }) => {
  const reqs = [];
  await stubSync(page, reqs);
  await page.goto('/app/index.html');
  await page.locator('.cell:not(.unwritten)').first().click();   // open first authored book
  const cards = page.locator('#quiz .q');
  const n = await cards.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    await cards.nth(i).locator('.opt').first().click();          // answer every omen
  }
  await expect.poll(() => reqs.some((x) => x.method === 'POST' && x.url.includes('/attempts_summary'))).toBeTruthy();
  const posts = reqs.filter((x) => x.method === 'POST');
  const iSum  = posts.findIndex((x) => x.url.includes('/attempts_summary'));
  const iRaw  = posts.findIndex((x) => x.url.includes('/attempts_raw'));
  expect(iSum).toBeGreaterThanOrEqual(0);
  expect(iRaw).toBeGreaterThan(iSum);                             // raw carries the summary id → must follow it
  expect(reqs.some((x) => x.url.includes('/book_progress') && x.method === 'POST')).toBeTruthy();
  const raw = JSON.parse(posts[iRaw].body);
  expect(raw[0]).toHaveProperty('attempt_id');
  expect(raw[0]).toHaveProperty('qi');
  expect(raw[0]).toHaveProperty('is_correct');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test tests/smoke.spec.js -g "push on finish"`
Expected: FAIL — no `POST …/attempts_summary` (push not wired).

- [ ] **Step 3: Accumulate `rawRows` in `buildQuiz` and pass them to `reveal`**

In `buildQuiz(Q)` (line 471), add a `rawRows` array beside the existing counters. Replace lines 474–475:

```js
  let answered=0, score=0;
  const missArr=[];
  const rawRows=[];
```

Inside the `b.onclick` handler, replace the correctness block + completion call (lines 495–499) with:

```js
        if(oi===item.correct){ b.classList.add('correct'); score++; stats[k].c++; }
        else{ b.classList.add('wrong'); btns[item.correct].classList.add('correct'); missArr.push(qi); }
        rawRows.push({book_id:current, qi, kind:k, chosen:oi, is_correct: oi===item.correct});
        truth.classList.add('show'); answered++;
        document.getElementById('tally').textContent=`Omens read · ${answered} of ${Q.length}`;
        if(answered===Q.length) reveal(score, Q.length, stats, missArr, rawRows);
```

- [ ] **Step 4: Push from `reveal`**

Replace the `reveal` signature and body-start (lines 507–509) with:

```js
function reveal(score,total,stats,missArr,rawRows){
  saveScore(current,score);
  saveMiss(current, missArr.slice().sort((a,b)=>a-b));
  // best-effort sync: append the sitting, upsert progress (independent, fire-and-forget)
  const breakdown={}; ['event','meaning','thread'].forEach(k=>{ if(stats[k]) breakdown[k]={c:stats[k].c,t:stats[k].t}; });
  pushSitting({book_id:current, score, total, breakdown}, rawRows).catch(syncErr);
  pushProgress(current, total).catch(syncErr);
```

(The rest of `reveal` — the verdict rendering from line 510 on — is unchanged.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx playwright test tests/smoke.spec.js -g "push on finish"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/index.html tests/smoke.spec.js
git commit -m "feat(sync): push per-book sitting (summary + raw + progress) on verdict"
```

---

## Task 4: Push a completed Grand Examination

Same push, from the exam path, carrying each omen's source book and the per-book breakdown.

**Files:**
- Modify: `app/index.html` (`buildExam` ~567-600; `examReveal` ~602-627)

**Interfaces:**
- Consumes: `pushSitting`, `pushProgress`, `syncErr` (Task 2).
- Produces: `examReveal(score, total, stats, byBook, rawRows)`.

- [ ] **Step 1: Accumulate `rawRows` in `buildExam` and pass them to `examReveal`**

In `buildExam(items)` (line 567), add the array beside the counters. Replace line 569:

```js
  const total=items.length; let answered=0, score=0;
  const rawRows=[];
```

Inside the `b.onclick` handler, replace the correctness block + completion call (lines 587–594) with:

```js
        if(oi===item.correct){ b.classList.add('correct'); score++; stats[k].c++; byBook[srcId].c++; clearMiss(srcId,qi); }
        else{ b.classList.add('wrong'); btns[item.correct].classList.add('correct');
              saveMiss(srcId, Array.from(new Set([...priorMiss(srcId), qi])).sort((a,b)=>a-b)); }
        rawRows.push({book_id:srcId, qi, kind:k, chosen:oi, is_correct: oi===item.correct});
        /* source book stays hidden until answered, then revealed with the truth */
        truth.innerHTML = item.truth + `<div class="examsrc">— ${label(srcId)}${item.n?` · ${item.n}`:''}</div>`;
        truth.classList.add('show'); answered++;
        document.getElementById('tally').textContent=`Omens read · ${answered} of ${total}`;
        if(answered===total) examReveal(score,total,stats,byBook,rawRows);
```

- [ ] **Step 2: Push from `examReveal`**

Replace the `examReveal` signature and first line (lines 602–603) with:

```js
function examReveal(score,total,stats,byBook,rawRows){
  saveScore('exam',score);
  // best-effort sync: exam sitting carries by_book + each omen's source book
  const breakdown={}; ['event','meaning','thread'].forEach(k=>{ if(stats[k]) breakdown[k]={c:stats[k].c,t:stats[k].t}; });
  const by_book={}; Object.keys(byBook).forEach(id=>{ by_book[id]={c:byBook[id].c,t:byBook[id].t}; });
  pushSitting({book_id:'exam', score, total, breakdown, by_book}, rawRows).catch(syncErr);
  pushProgress('exam', total).catch(syncErr);
```

(The rest of `examReveal` — verdict + per-book rows from line 604 on — is unchanged.)

- [ ] **Step 3: Run the full smoke suite to confirm nothing regressed**

Run: `npx playwright test`
Expected: PASS (pull + push-on-finish; fail-soft added next).

- [ ] **Step 4: Manual check — exam round-trip shape**

With real creds not yet set, the exam still runs locally. In DevTools, before finishing an exam set `window.LOOM_SYNC={url:'https://dummy.test',anon:'a',token:'t'}` and watch the Network tab: confirm a `POST attempts_summary` whose body has `book_id:"exam"` and a populated `by_book`, followed by `POST attempts_raw` with rows whose `book_id` is the omen's source (not `"exam"`).

- [ ] **Step 5: Commit**

```bash
git add app/index.html
git commit -m "feat(sync): push Grand Examination sitting with per-book breakdown"
```

---

## Task 5: Fail-soft under network failure

Prove that a dead network never breaks quizzing — local state persists and no error surfaces.

**Files:**
- Modify: `tests/smoke.spec.js` (add the fail-soft case)

**Interfaces:**
- Consumes: the `stubSync(page, reqs, {abort:true})` option (Task 2) and the push wiring (Tasks 3–4).

- [ ] **Step 1: Write the failing test (fail-soft)**

Append to `tests/smoke.spec.js`:

```js
test('fail-soft: aborted sync still completes the quiz and persists locally', async ({ page }) => {
  const reqs = [];
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await stubSync(page, reqs, { abort: true });          // every REST call aborts
  await page.goto('/app/index.html');
  await page.locator('.cell:not(.unwritten)').first().click();
  const cards = page.locator('#quiz .q');
  const n = await cards.count();
  for (let i = 0; i < n; i++) await cards.nth(i).locator('.opt').first().click();
  await expect(page.locator('#verdict')).toHaveClass(/show/);           // verdict still renders
  const best = await page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith('loom.best.'));
    return k ? localStorage.getItem(k) : null;
  });
  expect(best).not.toBeNull();                                          // score persisted locally
  expect(pageErrors).toEqual([]);                                       // nothing thrown to the page
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/smoke.spec.js -g "fail-soft"`
Expected: PASS immediately — the `.catch(syncErr)` wrappers from Tasks 2–4 already swallow the aborted-fetch rejections. (If it fails with an uncaught rejection, an `await`/`.catch` is missing on a sync call — add it, then re-run.)

- [ ] **Step 3: Commit**

```bash
git add tests/smoke.spec.js
git commit -m "test(sync): fail-soft smoke case — aborted network never breaks quizzing"
```

---

## Task 6: Merge policy — last-write-wins for misses (manual verification)

The merge code shipped in `syncPull` (Task 2). This task pins its behavior with a focused in-page check, since cross-device timing is out of Playwright's reach.

**Files:**
- (No new files — verification of Task 2's `syncPull` merge.)

**Interfaces:**
- Consumes: `syncPull` (Task 2).

- [ ] **Step 1: Verify `max()` / `OR` / LWW in isolation**

Serve the app locally (`python3 -m http.server 3000`) and open `http://localhost:3000/app/index.html`. In the console, simulate a remote row and drive the merge directly:

```js
// seed a LOWER local best + an OLDER local miss timestamp
localStorage.setItem('loom.best.iliad-01','3');
localStorage.setItem('loom.miss.iliad-01','[0,1]');
localStorage.setItem('loom.updated.iliad-01','2020-01-01T00:00:00.000Z');

// stub one remote row: higher score, read=true, newer misses
window.LOOM_SYNC = { url:'https://dummy.test', anon:'a', token:'t' };
window.fetch = async () => ({ status:200, ok:true, text: async () =>
  JSON.stringify([{book_id:'iliad-01', best_score:6, total:8, read:true,
                   misses:[2], updated_at:'2026-01-01T00:00:00.000Z'}]) });

await syncPull();
console.log(bestScore('iliad-01'), isRead('iliad-01'), priorMiss('iliad-01'));
// Expected: 6  true  [2]   (max wins, OR wins, newer misses win)
```

- [ ] **Step 2: Verify the older remote side does NOT clobber newer local misses**

Reload the page (clears the fetch stub), then:

```js
localStorage.setItem('loom.miss.iliad-01','[5]');
localStorage.setItem('loom.updated.iliad-01','2027-01-01T00:00:00.000Z'); // local is NEWER
window.LOOM_SYNC = { url:'https://dummy.test', anon:'a', token:'t' };
window.fetch = async () => ({ status:200, ok:true, text: async () =>
  JSON.stringify([{book_id:'iliad-01', best_score:1, total:8, read:false,
                   misses:[2], updated_at:'2026-01-01T00:00:00.000Z'}]) });
await syncPull();
console.log(priorMiss('iliad-01'));   // Expected: [5]  (local newer → remote misses ignored)
```

- [ ] **Step 3: Commit (no code change; record the verification)**

```bash
git commit --allow-empty -m "test(sync): manually verified merge policy (max/OR/LWW)"
```

---

## Task 7: The Chronos history view

Add the `showHistory()` view, its nav buttons (gated on `syncConfigured()`), and CSS.

**Files:**
- Modify: `app/index.html` (CSS in `<style>`; add `showHistory()` + `renderChronos()`; add a "Chronos" button to `showHome` homeacts and to the `topbar()`, `showThreads`, `showReview`, `showExam` topbars)

**Interfaces:**
- Consumes: `fetchSummaries`, `syncConfigured`, `syncErr` (Task 2); `ORDER`, `label` (existing).
- Produces: `showHistory() → void`, `renderChronos(rows) → void`.

- [ ] **Step 1: Add CSS**

In `app/index.html`, just before the mobile media query (before line 161, `/* --- mobile ... --- */`), insert:

```css
  /* history — "Chronos" reckonings, plus the token-expiry notice */
  .syncnote{position:fixed; left:50%; bottom:14px; transform:translateX(-50%);
    background:var(--wine); color:#fbeede; font-size:13px; padding:8px 16px;
    border-radius:20px; box-shadow:0 2px 12px #0003; z-index:50; letter-spacing:.5px;}
  .crow{display:flex; align-items:center; gap:12px; margin:7px 0; font-size:14px;}
  .crow .cdate{flex:0 0 auto; color:var(--soft); font-variant-numeric:tabular-nums; min-width:96px;}
  .crow .cbar{flex:1; height:5px; border-radius:3px; background:var(--parch2); overflow:hidden;}
  .crow .cbar i{display:block; height:100%; background:var(--gold);}
  .crow .csc{flex:0 0 auto; font-variant-numeric:tabular-nums; color:var(--ink);}
  .crow.weak .cbar i{background:#c98b8b;}
```

- [ ] **Step 2: Add `showHistory()` + `renderChronos()`**

Insert after `examReveal` (after line 627) and before the kickoff comment (line 629):

```js
/* ---- CHRONOS (the record of reckonings over time) ---- */
function showHistory(){
  current=null; localStorage.removeItem('loom.last');
  document.getElementById('topbar').innerHTML =
    `<div class="grp"><button onclick="showHome()">✦ All Books</button>`+
      `<button onclick="showThreads()">Threads</button>`+
      `<button onclick="showReview()">Review</button>`+
      `<button onclick="showExam()">Examination</button></div>`+
    `<div class="grp"><button class="active" disabled>Chronos</button></div>`;
  let h = `<div class="crown">◈ Χρόνος · the keeping of time ◈</div><h1>Chronos</h1>`+
          `<div class="sub">the record of your reckonings, newest first — every sitting the Fates have weighed</div>`+
          `<div class="meta">a thematic keeper of time · not a figure of the poems</div>`+
          `<div id="chronos"><div class="empty">Consulting the record…</div></div>`+
          `<div class="footnav"><button onclick="showHome()">✦ All Books</button></div>`;
  document.getElementById('view').innerHTML=h;
  window.scrollTo({top:0,behavior:'smooth'});
  fetchSummaries().then(renderChronos).catch(e=>{ syncErr(e); renderChronos([]); });
}

function renderChronos(rows){
  const box=document.getElementById('chronos'); if(!box) return;
  if(!rows || !rows.length){
    box.innerHTML=`<div class="empty">Chronos has kept no reckonings yet — sit an examination and the record begins.</div>`;
    return;
  }
  const groups={}; rows.forEach(r=>{ (groups[r.book_id]=groups[r.book_id]||[]).push(r); });
  const fmt = ts => { try{ return new Date(ts).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); }catch(e){ return ts; } };
  const section = (id,title) => {
    const list=(groups[id]||[]).slice().sort((a,b)=> (a.taken_at<b.taken_at?1:-1));
    if(!list.length) return '';
    let s=`<div class="band"><span>${title}</span><hr></div>`;
    list.forEach(r=>{ const pct=r.total?r.score/r.total:0; const weak=pct<0.5;
      s+=`<div class="crow${weak?' weak':''}"><span class="cdate">${fmt(r.taken_at)}</span>`+
         `<span class="cbar"><i style="width:${Math.round(pct*100)}%"></i></span>`+
         `<span class="csc">${r.score}/${r.total}</span></div>`; });
    return s;
  };
  let h='';
  ORDER.filter(id=>groups[id]).forEach(id=> h += section(id, label(id)));
  h += section('exam','The Grand Examination');
  box.innerHTML = h || `<div class="empty">Chronos has kept no reckonings yet.</div>`;
}
```

- [ ] **Step 3: Add the Chronos button to Home**

In `showHome` (line 246), change the homeacts condition and add the button. Replace lines 246–252:

```js
  if(examCount || threadCount || missCount || syncConfigured()){
    h += `<div class="homeacts">`;
    if(examCount)   h += `<button onclick="showExam()">◈ The Grand Examination (${examCount}) →</button>`;
    if(threadCount) h += `<button onclick="showThreads()">✦ The woven threads (${threadCount}) →</button>`;
    if(missCount)   h += `<button onclick="showReview()">↺ Re-walk the missed omens (${missCount}) →</button>`;
    if(syncConfigured()) h += `<button onclick="showHistory()">☙ Chronos — the record →</button>`;
    h += `</div>`;
  }
```

- [ ] **Step 4: Add the Chronos button to the four topbars**

In each of the four nav bars, append a gated Chronos button to the first `.grp`.

**`topbar(id)`** — replace the Examination line (line 403) with:

```js
      `<button onclick="showExam()">Examination</button>`+
      `${syncConfigured()?`<button onclick="showHistory()">Chronos</button>`:''}`+
```

**`showThreads`** (line 280): replace `` `<button onclick="showExam()">Examination</button></div>`+ `` with:

```js
      `<button onclick="showExam()">Examination</button>`+
      `${syncConfigured()?`<button onclick="showHistory()">Chronos</button>`:''}</div>`+
```

**`showReview`** (line 319): replace `` `<button onclick="showExam()">Examination</button></div>`+ `` with:

```js
      `<button onclick="showExam()">Examination</button>`+
      `${syncConfigured()?`<button onclick="showHistory()">Chronos</button>`:''}</div>`+
```

**`showExam`** (line 544): replace `` `<button onclick="showReview()">Review</button></div>`+ `` with:

```js
      `<button onclick="showReview()">Review</button>`+
      `${syncConfigured()?`<button onclick="showHistory()">Chronos</button>`:''}</div>`+
```

- [ ] **Step 5: Manual verification**

Serve locally. With `window.LOOM_SYNC` unset (placeholder creds → `syncConfigured()` false), confirm **no** Chronos buttons appear (offline-like). Then in the console set `window.LOOM_SYNC={url:'https://dummy.test',anon:'a',token:'t'}` and stub `fetch` to return two summary rows (one `iliad-01`, one `exam`); call `showHistory()` and confirm: an `iliad-01` section under its label, a "The Grand Examination" section, newest-first rows with date · bar · `score/total`, and weak rows (<50%) tinted. With `fetch` returning `[]`, confirm the in-voice empty state.

- [ ] **Step 6: Commit**

```bash
git add app/index.html
git commit -m "feat(sync): Chronos history view, nav buttons, and styles"
```

---

## Task 8: Token-expiry notice (401 path)

The `401 → noteExpired()` path shipped in Task 2 (`sreq` throws `{expired:true}`; `syncErr` renders the notice). Verify it end-to-end.

**Files:**
- (No new files — verification of Task 2's expiry path.)

**Interfaces:**
- Consumes: `sreq`, `syncErr`, `noteExpired` (Task 2).

- [ ] **Step 1: Add a smoke assertion for the expiry notice**

Append to `tests/smoke.spec.js`:

```js
test('expired token surfaces a visible notice (not silent)', async ({ page }) => {
  await page.addInitScript(() => {
    window.LOOM_SYNC = { url: 'https://dummy.test', anon: 'a', token: 't' };
  });
  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"JWT expired"}' }),
  );
  await page.goto('/app/index.html');
  await expect(page.locator('#syncnote')).toBeVisible();
  await expect(page.locator('#syncnote')).toContainText('token expired');
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/smoke.spec.js -g "expired token"`
Expected: PASS — `syncPull` on boot hits 401, `syncErr` renders `#syncnote`. (Local quizzing remains unaffected because every caller is `.catch`-guarded.)

- [ ] **Step 3: Commit**

```bash
git add tests/smoke.spec.js
git commit -m "test(sync): expired token shows a visible non-blocking notice"
```

---

## Task 9: Rebuild the bundle and verify the runtime surface gate

The deployed artifact is the single-file bundle. Because `syncConfigured()` requires an `http(s)` origin (Task 2), the bundle needs **no** build-time disable — it self-gates: live over `https:` (Pages), silent over `file://`. This task rebuilds the bundle from the now-sync-aware source and verifies both behaviors. **The bundler (`build-single-file.js`) is not modified.**

**Files:**
- (No source edits — runs `build-single-file.js`; produces `the-muses-odyssey.html`.)

**Interfaces:**
- Consumes: the `syncConfigured()` protocol gate + the whole sync module (Task 2), `showHistory` (Task 7).

- [ ] **Step 1: Confirm the bundler's anchors still match**

The sync module was inserted between `const label = …` and `function boot(){`, and never touched the three strings the bundler keys on: `<script src="../data/manifest.js"></script>`, `let pending = LOAD.length;` … `document.head.appendChild(s);\n});`, and the `<title>` line. Rebuild:

Run: `node build-single-file.js`
Expected output ends with `Leftover ../data/ refs: 0 (must be 0)` and `Books missing from output: none`. (A thrown "index.html shape changed" means an anchor moved — reconcile before continuing.)

- [ ] **Step 2: Verify sync is SILENT over file://**

Open the produced `the-muses-odyssey.html` directly (double-click / `file://`). Confirm:
- the app renders and a quiz completes with best-score persistence,
- **no** Chronos button anywhere (protocol gate → `syncConfigured()` false),
- the console shows **no** `[sync]` warnings and **no** `fetch` attempts to Supabase.

- [ ] **Step 3: Verify sync is LIVE over http:// (same bundle)**

Serve the bundle over http and open it: `python3 -m http.server 3001` then visit `http://localhost:3001/the-muses-odyssey.html`. With real creds not yet inlined (still `YOUR_*`), `syncConfigured()` is still false — so instead confirm the *gate itself* flips on origin: in the console, `syncConfigured()` returns `false` here only because creds are placeholders, but `/^https?:$/.test(location.protocol)` returns `true` (vs `false` on the `file://` open in Step 2). This proves the protocol arm of the gate. (Full live sync is exercised in Task 10 after real creds.)

- [ ] **Step 4: Commit the rebuilt bundle**

```bash
git add the-muses-odyssey.html
git commit -m "build(sync): rebuild single-file bundle with the sync-aware source"
```

---

## Task 10: Real credentials, deploy, cross-device verification

Fill live creds, deploy to Pages, and run the manual semantics pass from the spec.

**Files:**
- Modify: `app/index.html` (`CFG` defaults — the three `YOUR_*` placeholders)

**Interfaces:**
- Consumes: everything above; Task 1's project URL / anon key / minted token.

- [ ] **Step 1: Fill the real config**

In `app/index.html`, replace the three placeholder values in the inline `CFG` default with the real project URL, anon key, and the `muse_reader` JWT from Task 1:

```js
const CFG = (typeof window.LOOM_SYNC !== 'undefined') ? window.LOOM_SYNC : {
  url:   "https://<real-project>.supabase.co",
  anon:  "<real-anon-key>",
  token: "<real-muse_reader-jwt>"
};
```

- [ ] **Step 2: Sanity-run the smoke suite (still hermetic)**

Run: `npx playwright test`
Expected: PASS — the tests inject `window.LOOM_SYNC`, so they ignore the real inline creds.

- [ ] **Step 3: Rebuild the bundle and publish it as the Pages root**

The live site is the repo-root `index.html` (the bundle Pages serves). Regenerate it from the now-credentialed source and copy it into place:

```bash
node build-single-file.js          # source app/index.html → the-muses-odyssey.html (creds inlined)
cp the-muses-odyssey.html index.html   # index.html is what GitHub Pages serves
git add app/index.html the-muses-odyssey.html index.html
git commit -m "chore(sync): wire live Supabase credentials and rebuild Pages bundle"
git push origin feat/quiz-history-sync
```
Open a PR to `main` (or merge per your workflow); Pages publishes `https://mrojas54.github.io/muses-odyssey/` from `main`'s root `index.html`. Because the deployed page is served over `https:`, the protocol gate lets sync run live there.

- [ ] **Step 4: Manual verification (from spec §7)**

1. **Round-trip** — on Pages, finish a per-book quiz → in Supabase confirm one `attempts_summary` row, its N `attempts_raw` rows (correct `attempt_id`, `chosen`, `is_correct`), and the updated `book_progress` row.
2. **Cross-device** — finish a sitting on device A, load on device B, confirm the home-grid best score and the Chronos view reflect it after `syncPull`.
3. **Merge policy** — set a higher best on A and a lower on B; confirm `max()` wins after a pull; toggle read on one; confirm OR.
4. **Exam** — finish the 36-omen exam; confirm `by_book` populated and per-book rows render in Chronos under the Examination section.
5. **Token expiry** — temporarily point `CFG.token` at an expired/garbage JWT; confirm the "Sync paused — token expired" notice appears and local quizzing is unaffected; restore the good token.
6. **Offline** — open the offline bundle; confirm best score + misses persist, no console errors, no Chronos button.

- [ ] **Step 5: Record the rotation reminder**

Add a calendar reminder for **~day 85** from the token's mint date (Task 1): regenerate the `muse_reader` JWT → paste into `CFG.token` → redeploy.

---

## Self-Review

**Spec coverage:**
- §1 goal (cross-device history) → Tasks 2–4, 7, 10. Resume-in-progress exam is **Phase 2 / out of scope** here (spec §8) — intentionally not planned.
- §2 access model (RLS + `muse_reader` JWT), 90-day expiry, rotation → Task 1 (schema/role/policies/token), Task 8 (expiry notice), Task 10 §5 (rotation reminder).
- §3 architecture / three moments → boot pull (Task 2), finish push (Tasks 3–4), on-demand history (Task 7); offline no-op (Task 9).
- §4 three-table schema → Task 1 DDL (matches columns exactly, incl. `by_book` exam-only, `attempts_raw.book_id = srcId`).
- §5 sync module + touch points + Chronos + config seam → Tasks 2–4, 7.
- §6 error handling / fail-soft / expiry / no-retry orphan → Tasks 2 (`sreq`/`syncErr`), 5 (fail-soft), 8 (expiry).
- §7 testing (Playwright smoke: pull / push trio / fail-soft; manual list) → Tasks 2, 3, 5, 8 (automated), 6 & 10 (manual).
- §8 out of scope → nothing planned for auth, cross-device in-progress exam, trend charts, or `data/*.js` changes. ✓

**Placeholder scan:** The only `YOUR_*` / `<real-…>` tokens are the deploy-time credentials, explicitly filled in Task 10 and gated out by `syncConfigured()` until then. No `TODO`/`TBD`/"handle edge cases" left. ✓

**Type consistency:** `pushSitting(summary, rawRows)` — `summary` keys (`book_id/score/total/breakdown/by_book?`) and `rawRows` keys (`book_id/qi/kind/chosen/is_correct`) match Task 1's columns and the call sites in Tasks 3–4. `reveal(...,rawRows)` and `examReveal(...,rawRows)` signatures match their `buildQuiz`/`buildExam` callers. `pushProgress(bookId,total)` matches both call sites. `syncPull`/`fetchSummaries` names match boot/Chronos. ✓

**Deployment reconciliation (discovered at execution):** The live `mrojas54/muses-odyssey` repo tracked only the built single-file `index.html` — Pages serves the *bundle*, which is also the `file://` offline artifact. The plan's original "Pages = multi-file app, bundle = separate" split didn't match reality. Resolved (user decision) with a **runtime surface gate**: `syncConfigured()` requires an `http(s)` origin, so one bundle is live on Pages and silent offline. This honors spec §3's "offline bundle needs zero changes" *literally* — `build-single-file.js` is unmodified (Task 9 only rebuilds + verifies). The full source tree was imported into the repo (previously untracked) so this is genuinely one repo.
