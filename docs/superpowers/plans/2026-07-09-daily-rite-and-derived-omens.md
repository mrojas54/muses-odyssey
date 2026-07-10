# The Daily Rite & Derived Omens — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three derived comprehension-check formats (sequence, epithet, line) and a daily reading goal with a fraying-thread barometer, without touching the 60 authored omens.

**Architecture:** Two new pure-function files (`app/clock.js`, `app/omens.js`) loaded by `<script>` tag exactly as `data/*.js` are, unit-tested with Node's built-in runner. The bundler learns to inline them. All storage and DOM work stays in `app/index.html`. The day log is written only from human actions, so `seedProgress()` can never satisfy a day.

**Tech Stack:** Vanilla ES2015+ browser JS, no framework, no bundler beyond `build-single-file.js`. CommonJS for tests. Node 20 (`node --test`).

## Global Constraints

- **Node version:** system Node is **v14**, which lacks `node --test`. All test commands must run under Node ≥18. A repo hook auto-prepends `nvm use 20`; if it does not fire, run `nvm use 20` first.
- **No `package.json`.** New JS files are CommonJS-compatible (`module.exports`) *and* browser-global-compatible (`window.LOOM_*`). Never add `"type": "module"`.
- **No `fetch`.** The app runs from `file://`; data and code load via `<script>` tags only.
- **Spoiler gate:** every derived omen draws only from books where `isRead(id)` is true. Same rule as `collectCast()` (`app/index.html:360`).
- **No timer. No fail state.** The fraying thread is a barometer; nothing locks or resets.
- **Pass threshold is `0.7`**, reusing the existing verdict tier at `app/index.html:735`. Do not invent a new number.
- **Deadline constant:** `'2026-07-28'`. When it has passed, the Atropos line hides — never render a negative countdown.
- **Voice:** parchment register, wine + gold. Quotation marks are reserved for verbatim Fagles. Do not wrap paraphrase in quotes.
- **Deploy is:** `node build-single-file.js && cp the-muses-odyssey.html index.html`, then commit and push `main`.

**Deviation from spec §7 (deliberate):** the spec named one new file, `app/omens.js`. This plan splits out `app/clock.js` as well, because spec §7 also requires a unit test for `todayKey()`, which is not an omen generator. Two files, two responsibilities. The bundler change is identical either way (it inlines a list).

## File Structure

| File | Status | Responsibility |
| --- | --- | --- |
| `app/clock.js` | create | Pure date/streak math. Knows nothing of storage or DOM. |
| `app/omens.js` | create | Pure omen generators over plain book objects. No storage, no DOM. |
| `test/clock.test.js` | create | Unit tests for clock. |
| `test/omens.test.js` | create | Unit tests for generators, encoding the band/dedup rules. |
| `build-single-file.js` | modify | Inline `APP_SCRIPTS`; set `window.__loomVolatile` in the shim. |
| `app/index.html` | modify | Script tags, `dayLog`, home hub, fraying thread, sequence renderer, Daily Rite view. |

---

### Task 1: `app/clock.js` — pure date and streak math

**Files:**
- Create: `app/clock.js`
- Test: `test/clock.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `window.LOOM_CLOCK` / `module.exports` = `{ todayKey(date?) -> string, prevKey(key) -> string, streakNext(prev, todayKey) -> {count,lastDay}, daysUntil(targetKey, fromKey?) -> number }`

- [ ] **Step 1: Write the failing test**

Create `test/clock.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const clock = require('../app/clock.js');

test('todayKey uses LOCAL date parts, not UTC', () => {
  // 2026-07-09 23:30 local. toISOString() would report 2026-07-10 in UTC-4.
  const d = new Date(2026, 6, 9, 23, 30, 0);
  assert.strictEqual(clock.todayKey(d), '2026-07-09');
});

test('todayKey zero-pads month and day', () => {
  assert.strictEqual(clock.todayKey(new Date(2026, 0, 5)), '2026-01-05');
});

test('prevKey crosses a month boundary', () => {
  assert.strictEqual(clock.prevKey('2026-07-01'), '2026-06-30');
});

test('prevKey crosses a year boundary', () => {
  assert.strictEqual(clock.prevKey('2026-01-01'), '2025-12-31');
});

test('streakNext starts at 1 with no prior', () => {
  assert.deepStrictEqual(clock.streakNext(null, '2026-07-09'), { count: 1, lastDay: '2026-07-09' });
});

test('streakNext increments when yesterday was the last day', () => {
  const prev = { count: 3, lastDay: '2026-07-08' };
  assert.deepStrictEqual(clock.streakNext(prev, '2026-07-09'), { count: 4, lastDay: '2026-07-09' });
});

test('streakNext is idempotent on the same day', () => {
  const prev = { count: 3, lastDay: '2026-07-09' };
  assert.deepStrictEqual(clock.streakNext(prev, '2026-07-09'), { count: 3, lastDay: '2026-07-09' });
});

test('streakNext resets to 1 after a missed day', () => {
  const prev = { count: 9, lastDay: '2026-07-06' };
  assert.deepStrictEqual(clock.streakNext(prev, '2026-07-09'), { count: 1, lastDay: '2026-07-09' });
});

test('daysUntil counts forward to the deadline', () => {
  assert.strictEqual(clock.daysUntil('2026-07-28', '2026-07-09'), 19);
});

test('daysUntil is negative once the door has passed', () => {
  assert.strictEqual(clock.daysUntil('2026-07-28', '2026-07-29'), -1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/clock.test.js`
Expected: FAIL — `Cannot find module '../app/clock.js'`

- [ ] **Step 3: Write minimal implementation**

Create `app/clock.js`:

```js
/* The only thing in the loom that knows what day it is.
   Pure: no storage, no DOM. Local date parts throughout — toISOString() is UTC
   and would roll the day over at 20:00 EDT, breaking a streak the reader kept. */
(function (root) {
  'use strict';

  const p2 = n => String(n).padStart(2, '0');

  function todayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  }

  function parseKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);   // local midnight
  }

  function prevKey(key) {
    const d = parseKey(key);
    d.setDate(d.getDate() - 1);     // handles month/year/DST rollover
    return todayKey(d);
  }

  function streakNext(prev, today) {
    if (!prev || !prev.lastDay) return { count: 1, lastDay: today };
    if (prev.lastDay === today) return { count: prev.count, lastDay: today };
    if (prev.lastDay === prevKey(today)) return { count: prev.count + 1, lastDay: today };
    return { count: 1, lastDay: today };
  }

  function daysUntil(targetKey, fromKey) {
    const t = parseKey(targetKey);
    const f = parseKey(fromKey || todayKey());
    return Math.round((t - f) / 86400000);   // round absorbs DST's 23/25-hour days
  }

  const api = { todayKey, prevKey, streakNext, daysUntil };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LOOM_CLOCK = api;
})(this);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/clock.test.js`
Expected: PASS — `# pass 12`, `# fail 0`

(10 tests above, plus two DST-crossing tests added in review: `daysUntil` across the 23-hour spring-forward day and the 25-hour fall-back day. `test/clock.test.js` pins `process.env.TZ = 'America/New_York'` at the top — without it, a UTC environment makes both days exactly 24 hours and the rounding assertions become vacuous.)

- [ ] **Step 5: Commit**

```bash
git add app/clock.js test/clock.test.js
git commit -m "feat(clock): local-date day keys and streak transitions"
```

---

### Task 2: Teach the bundler to inline app scripts and flag volatile storage

The bundler currently inlines only `data/manifest.js` and the books. A plain `<script src="clock.js">` works when `app/index.html` is double-clicked but **404s in the bundle**, because `the-muses-odyssey.html` sits at the repo root. It must be inlined.

Separately, `durable()` cannot detect the shim by probing: the shim *is* `localStorage` and accepts writes. The shim must raise a flag.

**Files:**
- Modify: `build-single-file.js:31-70` (harness), `build-single-file.js:72-84` (inlining), `build-single-file.js:111-117` (sanity)
- Modify: `app/index.html:205`

**Interfaces:**
- Consumes: `app/clock.js` from Task 1.
- Produces: `window.__loomVolatile === true` when storage is in-memory. `window.LOOM_CLOCK` available in both source and bundle.

- [ ] **Step 1: Add the script tag to the source**

In `app/index.html`, replace line 205:

```html
<script src="../data/manifest.js"></script>
```

with:

```html
<script src="../data/manifest.js"></script>
<script src="clock.js"></script>
```

- [ ] **Step 2: Verify the bundle is now broken (proving the guard is needed)**

Run: `node build-single-file.js && grep -c 'src="clock.js"' the-muses-odyssey.html`
Expected: `1` — the tag survived un-inlined. This is the silent-breakage the spec warned about. Do not ship this.

- [ ] **Step 3: Make the shim flag itself volatile**

In `build-single-file.js`, inside the `harness` array, change the line:

```js
  '  if(!ok){',
```

so the block that follows also sets the flag. Replace:

```js
  '    try{ Object.defineProperty(window,\'localStorage\',{configurable:true,writable:true,value:shim}); }',
  '    catch(e){ try{ window.localStorage=shim; }catch(e2){} }',
  '  }',
```

with:

```js
  "    try{ Object.defineProperty(window,'localStorage',{configurable:true,writable:true,value:shim}); }",
  '    catch(e){ try{ window.localStorage=shim; }catch(e2){} }',
  '    window.__loomVolatile=true;   /* in-memory: writes vanish on reload. No streak may claim to persist. */',
  '  }',
```

- [ ] **Step 4: Inline app scripts**

In `build-single-file.js`, immediately after the `html = html.replace(manifestTag, inlined);` line (currently line 84), add:

```js
// 3b. Inline first-party app scripts. A relative src works when app/index.html is
//     double-clicked, but the bundle lives at the repo root, so the src would 404.
//     Guarded like the manifest tag: if the shape changes, fail loudly, never silently.
const APP_SCRIPTS = ['clock.js'];
for (const name of APP_SCRIPTS) {
  const tag = `<script src="${name}"></script>`;
  if (!html.includes(tag)) throw new Error(`app script tag not found: ${tag} — index.html shape changed`);
  html = html.replace(tag, '<script>\n' + read(`app/${name}`).trim() + '\n</script>');
}
```

- [ ] **Step 5: Extend the sanity check**

In `build-single-file.js`, replace:

```js
const leftover = (html.match(/\.\.\/data\//g) || []).length;
```

with:

```js
const leftover = (html.match(/\.\.\/data\//g) || []).length;
const unInlined = APP_SCRIPTS.filter(n => html.includes(`<script src="${n}"></script>`));
```

and after the `console.log('Books missing from output:', ...)` line, add:

```js
console.log('Un-inlined app scripts:', unInlined.length ? unInlined.join(', ') : 'none');
if (unInlined.length) throw new Error('app scripts left un-inlined — the bundle would 404 on them');
```

- [ ] **Step 6: Rebuild and verify**

Run:
```bash
node build-single-file.js && grep -c 'src="clock.js"' the-muses-odyssey.html; grep -c '__loomVolatile' the-muses-odyssey.html
```
Expected: `grep -c 'src="clock.js"'` prints `0` (inlined). `grep -c '__loomVolatile'` prints `1`. Bundler output ends with `Un-inlined app scripts: none`.

- [ ] **Step 7: Commit**

```bash
git add build-single-file.js app/index.html
git commit -m "build: inline first-party app scripts; flag volatile storage"
```

---

### Task 3: `app/omens.js` — the kinship filter and the epithet pool

**Files:**
- Create: `app/omens.js`
- Test: `test/omens.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `window.LOOM_OMENS` / `module.exports` = `{ isKinshipEpithet(ep) -> bool, bandOf(groupName, char) -> 'gods'|'mortals', epithetPool(books) -> {mortals: Map<name,[{ep,book}]>, gods: Map<...>}, shuffle(arr, rng) -> arr }`
  where `books` is `[{ id: string, data: BookObject }]`.

- [ ] **Step 1: Write the failing test**

Create `test/omens.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const omens = require('../app/omens.js');

// Deterministic RNG so every test is reproducible.
function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BOOKS = [{
  id: 'iliad-01',
  data: {
    characters: {
      'Mortals': [
        { name: 'Achilles',  epithet: 'swift-footed, son of Peleus' },
        { name: 'Agamemnon', epithet: 'lord of men, high king' },
        { name: 'Nestor',    epithet: 'old horseman of Pylos' },
        { name: 'Calchas',   epithet: 'seer of the Greeks, reader of birds' },
        { name: 'Odysseus',  epithet: 'man of many turns' }
      ],
      'Gods & Powers': [
        { name: 'Apollo', epithet: 'the far-shooter, lord of plague and the bow' },
        { name: 'Athena', epithet: 'grey-eyed goddess of war-craft' },
        { name: 'Hera',   epithet: 'queen of heaven, implacable' },
        { name: 'Zeus',   epithet: 'lord of the storm cloud' }
      ]
    }
  }
}];

test('isKinshipEpithet flags an epithet that names a relative', () => {
  assert.strictEqual(omens.isKinshipEpithet('swift-footed, son of Peleus'), true);
  assert.strictEqual(omens.isKinshipEpithet('son of Anchises and the goddess Aphrodite'), true);
});

test('isKinshipEpithet passes a true epithet naming no person', () => {
  assert.strictEqual(omens.isKinshipEpithet('grey-eyed goddess of war-craft'), false);
  assert.strictEqual(omens.isKinshipEpithet('lord of men, high king'), false);
});

test('isKinshipEpithet does not flag "of the Greek host" — no person named', () => {
  assert.strictEqual(omens.isKinshipEpithet('lord of men, high king of the Greek host'), false);
});

test('bandOf routes by group name and by the god flag', () => {
  assert.strictEqual(omens.bandOf('Gods & Powers', { name: 'Athena' }), 'gods');
  assert.strictEqual(omens.bandOf('Mortals', { name: 'Ajax' }), 'mortals');
  assert.strictEqual(omens.bandOf('Mortals', { name: 'Thetis', god: true }), 'gods');
});

test('epithetPool excludes kinship epithets', () => {
  const pool = omens.epithetPool(BOOKS);
  assert.ok(!pool.mortals.has('Achilles'), 'Achilles is "son of Peleus" — self-answering');
  assert.ok(pool.mortals.has('Agamemnon'));
});

test('epithetPool separates bands', () => {
  const pool = omens.epithetPool(BOOKS);
  assert.strictEqual(pool.gods.size, 4);
  assert.strictEqual(pool.mortals.size, 4);   // 5 mortals minus Achilles
});

test('epithetPool dedupes identical epithets but keeps distinct variants', () => {
  const twoBooks = BOOKS.concat([{
    id: 'iliad-05',
    data: { characters: { 'Gods & Powers': [
      { name: 'Athena', epithet: 'grey-eyed goddess of war-craft' },        // duplicate
      { name: 'Athena', epithet: 'grey-eyed goddess of wisdom and war-craft' } // variant
    ] } }
  }]);
  const pool = omens.epithetPool(twoBooks);
  assert.strictEqual(pool.gods.get('Athena').length, 2);
});

test('shuffle is a permutation and is deterministic under a seeded rng', () => {
  const src = [1, 2, 3, 4, 5];
  const a = omens.shuffle(src, seeded(42));
  const b = omens.shuffle(src, seeded(42));
  assert.deepStrictEqual(a, b);
  assert.deepStrictEqual(a.slice().sort(), src);
  assert.deepStrictEqual(src, [1, 2, 3, 4, 5], 'shuffle must not mutate its input');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/omens.test.js`
Expected: FAIL — `Cannot find module '../app/omens.js'`

- [ ] **Step 3: Write minimal implementation**

Create `app/omens.js`:

```js
/* Derived omens: questions generated from data the books already carry.
   Pure — no storage, no DOM. Every generator returns null when its pool is too
   thin, so a reader one book in simply sees fewer omens rather than a crash.

   Callers must pass only books the reader has read. The spoiler gate lives at
   the call site, exactly as it does for collectCast(). */
(function (root) {
  'use strict';

  /* An epithet that names a kinsman answers itself: "son of Peleus" IS Achilles.
     Such epithets are fine roster glosses and useless quiz prompts, so they are
     filtered here rather than corrected in the data.

     Two constructions appear in the corpus:
       "grandson of Bellerophon"   — kinship word, then "of", then a name
       "Achilles' foster-father"   — a possessive name, then a kinship word
                                     (straight ' and typographic ’ both match)
     Note "of the Greek host" must NOT match: no person is named. Nor must
     "Paris's patron" — possessive, but "patron" is no kin. */
  const KIN = "(?:foster-|step-|half-|grand|great-grand)?(?:son|daughter|father|mother|brother|sister)|wife|husband";
  const KINSHIP = new RegExp(
    "\\b(?:" + KIN + ")\\s+of\\s+[A-Z]" +
    "|[A-Z][\\p{L}]*(?:[’']s|[’'])\\s+(?:" + KIN + ")",
    "u"
  );
  const isKinshipEpithet = ep => KINSHIP.test(ep || '');

  const bandOf = (group, c) =>
    (String(group).toLowerCase().includes('god') || c.god) ? 'gods' : 'mortals';

  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* name -> [{ep, book}], per band. Keyed by CHARACTER, not by pair: Athena
     carries two epithet variants, and drawing distractors by pair would let her
     stand as her own distractor. */
  function epithetPool(books) {
    const out = { mortals: new Map(), gods: new Map() };
    books.forEach(({ id, data }) => {
      const chars = (data && data.characters) || {};
      Object.keys(chars).forEach(group => {
        (chars[group] || []).forEach(c => {
          const ep = (c.epithet || '').trim();
          if (!ep || isKinshipEpithet(ep)) return;
          const m = out[bandOf(group, c)];
          if (!m.has(c.name)) m.set(c.name, []);
          const list = m.get(c.name);
          if (!list.some(x => x.ep === ep)) list.push({ ep, book: id });
        });
      });
    });
    return out;
  }

  const api = { isKinshipEpithet, bandOf, shuffle, epithetPool };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LOOM_OMENS = api;
})(this);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/omens.test.js`
Expected: PASS — `# pass 11`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add app/omens.js test/omens.test.js
git commit -m "feat(omens): kinship filter and band-separated epithet pool"
```

---

### Task 4: `epithetOmen` — same-band distractors, no repeated character

**Files:**
- Modify: `app/omens.js`
- Test: `test/omens.test.js`

**Interfaces:**
- Consumes: `epithetPool`, `shuffle` from Task 3.
- Produces: `epithetOmen(pool, opts) -> omen|null` where `opts = {rng, label}`, `label(bookId) -> string`.
  Omen shape: `{format:'choice', kind:'meaning', q, opts:[string], correct:number, truth}`.

- [ ] **Step 1: Write the failing test**

Append to `test/omens.test.js`:

```js
const LABEL = id => 'Iliad · Book ' + Number(id.split('-')[1]);

test('epithetOmen returns null when no band has four distinct characters', () => {
  const thin = [{ id: 'iliad-01', data: { characters: { 'Mortals': [
    { name: 'Agamemnon', epithet: 'lord of men' },
    { name: 'Nestor', epithet: 'old horseman of Pylos' }
  ] } } }];
  assert.strictEqual(omens.epithetOmen(omens.epithetPool(thin), { rng: seeded(1), label: LABEL }), null);
});

test('epithetOmen draws exactly four options, all distinct characters', () => {
  const pool = omens.epithetPool(BOOKS);
  for (let s = 1; s <= 40; s++) {
    const o = omens.epithetOmen(pool, { rng: seeded(s), label: LABEL });
    assert.ok(o, 'expected an omen for seed ' + s);
    assert.strictEqual(o.opts.length, 4);
    assert.strictEqual(new Set(o.opts).size, 4, 'a character must never be its own distractor');
  }
});

test('epithetOmen keeps distractors inside the prompt\'s band', () => {
  const pool = omens.epithetPool(BOOKS);
  const gods = new Set(pool.gods.keys());
  const mortals = new Set(pool.mortals.keys());
  for (let s = 1; s <= 40; s++) {
    const o = omens.epithetOmen(pool, { rng: seeded(s), label: LABEL });
    const allGods = o.opts.every(n => gods.has(n));
    const allMortals = o.opts.every(n => mortals.has(n));
    assert.ok(allGods || allMortals, 'seed ' + s + ' mixed bands: ' + o.opts.join(', '));
  }
});

test('epithetOmen marks the correct index and it names a real character', () => {
  const pool = omens.epithetPool(BOOKS);
  const o = omens.epithetOmen(pool, { rng: seeded(7), label: LABEL });
  const answer = o.opts[o.correct];
  assert.ok(pool.gods.has(answer) || pool.mortals.has(answer));
  assert.ok(o.truth.includes(answer));
  assert.strictEqual(o.format, 'choice');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/omens.test.js`
Expected: FAIL — `omens.epithetOmen is not a function`

- [ ] **Step 3: Write minimal implementation**

In `app/omens.js`, insert before the `const api = ...` line:

```js
  /* "Whose name does the Loom hide?" Distractors come from the SAME band, or the
     word "goddess" alone eliminates three mortals. Drawn by character, so a
     two-variant name like Athena can never appear twice. */
  function epithetOmen(pool, opts) {
    const rng = opts.rng, label = opts.label;
    const bands = ['mortals', 'gods'].filter(b => pool[b].size >= 4);
    if (!bands.length) return null;

    const band = bands[Math.floor(rng() * bands.length)];
    const names = shuffle(Array.from(pool[band].keys()), rng);
    const answer = names[0];
    const variants = pool[band].get(answer);
    const chosen = variants[Math.floor(rng() * variants.length)];

    const choices = shuffle([answer, names[1], names[2], names[3]], rng);
    return {
      format: 'choice',
      kind: 'meaning',
      q: 'Whose name does the Loom hide? <i>' + chosen.ep + '</i>',
      opts: choices,
      correct: choices.indexOf(answer),
      truth: '<b>' + answer + '</b> — ' + chosen.ep + '. <span class="small">' + label(chosen.book) + '</span>'
    };
  }
```

and add `epithetOmen` to the `api` object:

```js
  const api = { isKinshipEpithet, bandOf, shuffle, epithetPool, epithetOmen };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/omens.test.js`
Expected: PASS — `# pass 15`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add app/omens.js test/omens.test.js
git commit -m "feat(omens): epithet omen with band-locked distractors"
```

---

### Task 5: `sequenceOmen` — order the movements

**Files:**
- Modify: `app/omens.js`
- Test: `test/omens.test.js`

**Interfaces:**
- Consumes: `shuffle` from Task 3.
- Produces: `sequenceOmen(book, rng) -> omen|null`, `book = {id, data}`.
  Omen shape: `{format:'sequence', kind:'event', q, items:[string], answer:[number], truth}` where `answer` lists indices into `items` in true reading order.

- [ ] **Step 1: Write the failing test**

Append to `test/omens.test.js`:

```js
const SEQ_BOOK = { id: 'iliad-01', data: { movements: [
  { n: 'Movement I',   title: 'The priest comes with ransom' },
  { n: 'Movement II',  title: 'Apollo\'s arrows fall' },
  { n: 'Movement III', title: 'The quarrel in the assembly' },
  { n: 'Movement IV',  title: 'Briseis is taken' },
  { n: 'Movement V',   title: 'Achilles calls his mother from the sea' },
  { n: 'Movement VI',  title: 'Thetis petitions Zeus' }
] } };

test('sequenceOmen returns null with fewer than four movements', () => {
  const thin = { id: 'x', data: { movements: SEQ_BOOK.data.movements.slice(0, 3) } };
  assert.strictEqual(omens.sequenceOmen(thin, seeded(1)), null);
});

test('sequenceOmen presents four distinct beats', () => {
  const o = omens.sequenceOmen(SEQ_BOOK, seeded(3));
  assert.strictEqual(o.format, 'sequence');
  assert.strictEqual(o.items.length, 4);
  assert.strictEqual(new Set(o.items).size, 4);
});

test('sequenceOmen answer indices reconstruct true reading order', () => {
  const order = SEQ_BOOK.data.movements.map(m => m.title);
  for (let s = 1; s <= 40; s++) {
    const o = omens.sequenceOmen(SEQ_BOOK, seeded(s));
    assert.strictEqual(o.answer.length, 4);
    assert.strictEqual(new Set(o.answer).size, 4, 'answer must be a permutation');
    const restored = o.answer.map(i => o.items[i]);
    const sorted = restored.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
    assert.deepStrictEqual(restored, sorted, 'seed ' + s + ' produced a wrong answer key');
  }
});

test('sequenceOmen truth lists the beats in order', () => {
  const o = omens.sequenceOmen(SEQ_BOOK, seeded(9));
  const first = o.items[o.answer[0]];
  assert.ok(o.truth.startsWith('1. ' + first));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/omens.test.js`
Expected: FAIL — `omens.sequenceOmen is not a function`

- [ ] **Step 3: Write minimal implementation**

In `app/omens.js`, insert before the `const api = ...` line:

```js
  /* movements[] is already an ordered list of self-contained beats, so it is a
     question bank with its answer key built in. Four NON-CONTIGUOUS beats: adjacent
     ones are near-impossible to separate, spread ones test the book's arc.
     Titles are deduped defensively — findIndex below assumes they are unique. */
  function sequenceOmen(book, rng) {
    const mv = (book.data && book.data.movements) || [];
    const seen = new Set();
    const uniq = [];
    mv.forEach((m, i) => {
      if (m && m.title && !seen.has(m.title)) { seen.add(m.title); uniq.push({ i, title: m.title }); }
    });
    if (uniq.length < 4) return null;

    const picked = shuffle(uniq, rng).slice(0, 4);
    const items = shuffle(picked, rng);
    const trueOrder = picked.slice().sort((a, b) => a.i - b.i);
    const answer = trueOrder.map(t => items.findIndex(x => x.i === t.i));

    return {
      format: 'sequence',
      kind: 'event',
      q: 'The Loom shows four beats. Set them in their true order.',
      items: items.map(x => x.title),
      answer: answer,
      truth: trueOrder.map((t, k) => (k + 1) + '. ' + t.title).join('<br>')
    };
  }
```

and add `sequenceOmen` to `api`:

```js
  const api = { isKinshipEpithet, bandOf, shuffle, epithetPool, epithetOmen, sequenceOmen };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/omens.test.js`
Expected: PASS — `# pass 19`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add app/omens.js test/omens.test.js
git commit -m "feat(omens): sequence omen from the movements' true order"
```

---

### Task 6: `lineOmen` — the blanked Fagles line

Epigraphs are the corpus's only verbatim Fagles. Blanking a word preserves that. Distractors come from **other books' epigraphs**, never from words visible in the displayed line.

**Files:**
- Modify: `app/omens.js`
- Test: `test/omens.test.js`

**Interfaces:**
- Consumes: `shuffle` from Task 3.
- Produces: `lineOmen(book, allBooks, rng) -> omen|null`. Omen shape is `format:'choice'`.

- [ ] **Step 1: Write the failing test**

Append to `test/omens.test.js`:

```js
const EPI = (id, text) => ({ id, data: { meta: { epigraph: { text, src: 'Fagles, Iliad ' + id } } } });
const EPI_BOOKS = [
  EPI('iliad-01', '"Rage—Goddess, sing the rage of Peleus\' son Achilles, murderous, doomed, that cost the Achaeans countless losses…"'),
  EPI('iliad-02', 'Now the great array of chariot-driven fighters slept the whole night through, peaceful.'),
  EPI('iliad-03', 'The Trojans came with clamor like birds, the Achaeans in silence, breathing fury.'),
  EPI('iliad-04', 'Across the golden floor they poured the nectar, lifted their goblets.')
];

test('lineOmen blanks a word and offers four options', () => {
  const o = omens.lineOmen(EPI_BOOKS[0], EPI_BOOKS, seeded(5));
  assert.ok(o, 'expected an omen');
  assert.strictEqual(o.format, 'choice');
  assert.strictEqual(o.opts.length, 4);
  assert.ok(o.q.includes('____'), 'the line must show a blank');
});

test('lineOmen never mangles a token joined by an em-dash', () => {
  // "Rage—Goddess" must tokenize to Rage and Goddess, never RageGoddess.
  for (let s = 1; s <= 30; s++) {
    const o = omens.lineOmen(EPI_BOOKS[0], EPI_BOOKS, seeded(s));
    assert.ok(!o.opts.includes('RageGoddess'));
  }
});

test('lineOmen preserves Fagles verbatim apart from the single blank', () => {
  // The displayed line must differ from the source ONLY where the blank stands.
  // Rejoining on ' ' would eat the em-dash and silently alter a verbatim quote.
  const src = EPI_BOOKS[0].data.meta.epigraph.text;
  for (let s = 1; s <= 30; s++) {
    const o = omens.lineOmen(EPI_BOOKS[0], EPI_BOOKS, seeded(s));
    const line = o.q.split('<i>')[1].replace('</i>', '');
    const answer = o.opts[o.correct];
    assert.strictEqual(line.replace('____', answer), src, 'seed ' + s + ' altered the epigraph');
    assert.ok(line.includes('Rage—Goddess') || line.includes('____'), 'em-dash must survive');
  }
});

test('lineOmen distractors never appear in the displayed line', () => {
  // Scope the check to the epigraph itself: the surrounding prompt says "Fagles
  // wrote it thus", and a distractor must not false-fail on the word "wrote".
  for (let s = 1; s <= 30; s++) {
    const o = omens.lineOmen(EPI_BOOKS[0], EPI_BOOKS, seeded(s));
    const line = o.q.split('<i>')[1].replace('</i>', '');
    o.opts.forEach((w, i) => {
      if (i === o.correct) return;
      assert.ok(!line.includes(w), 'seed ' + s + ': distractor "' + w + '" is visible in the line');
    });
  }
});

test('lineOmen correct answer is the blanked word and truth cites the source', () => {
  const o = omens.lineOmen(EPI_BOOKS[0], EPI_BOOKS, seeded(11));
  assert.ok(o.truth.includes(o.opts[o.correct]));
  assert.ok(o.truth.includes('Fagles'));
});

test('lineOmen returns null without an epigraph', () => {
  assert.strictEqual(omens.lineOmen({ id: 'x', data: { meta: {} } }, EPI_BOOKS, seeded(1)), null);
});

test('lineOmen returns null when no other book can supply distractors', () => {
  assert.strictEqual(omens.lineOmen(EPI_BOOKS[0], [EPI_BOOKS[0]], seeded(1)), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/omens.test.js`
Expected: FAIL — `omens.lineOmen is not a function`

- [ ] **Step 3: Write minimal implementation**

In `app/omens.js`, insert before the `const api = ...` line:

```js
  /* Split on whitespace AND em/en dashes: "Rage—Goddess" is two words, and a naive
     strip of non-letters would fuse them into "RageGoddess". Trailing/leading
     punctuation is shaved; internal hyphens ("chariot-driven") survive. */
  const DASHES = /[\s—–]+/;
  const tokenize = t => t.split(DASHES)
    .map(w => w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ''))
    .filter(Boolean);

  /* Function words make dull prompts: "which word is missing? their" */
  const STOP = new Set(['their', 'there', 'those', 'these', 'which', 'would', 'could', 'should', 'about', 'whole', 'through']);
  const isCandidate = w => w.length >= 5 && !STOP.has(w.toLowerCase());

  function lineOmen(book, allBooks, rng) {
    const ep = book.data && book.data.meta && book.data.meta.epigraph;
    if (!ep || !ep.text) return null;

    /* Split with a CAPTURING group so separators survive in the array. Rejoining on
       ' ' would turn Fagles' em-dash into a space, silently altering a verbatim
       quotation — the one thing CLAUDE.md forbids. Even indices are tokens, odd are
       the exact separators that stood between them. */
    const parts = ep.text.split(/([\s—–]+)/);
    const isSep = s => /^[\s—–]+$/.test(s);
    const cands = parts
      .map((w, i) => ({ i, raw: w, clean: w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '') }))
      .filter(x => !isSep(x.raw) && isCandidate(x.clean));
    if (!cands.length) return null;

    const pick = cands[Math.floor(rng() * cands.length)];

    // Distractors from OTHER books' epigraphs, excluding anything visible in this line.
    const visible = new Set(tokenize(ep.text).map(w => w.toLowerCase()));
    const foreign = [];
    const seen = new Set();
    allBooks.forEach(b => {
      if (b.id === book.id) return;
      const t = b.data && b.data.meta && b.data.meta.epigraph;
      if (!t || !t.text) return;
      tokenize(t.text).forEach(w => {
        const lw = w.toLowerCase();
        if (!isCandidate(w) || visible.has(lw) || seen.has(lw)) return;
        seen.add(lw); foreign.push(w);
      });
    });
    if (foreign.length < 3) return null;

    const distract = shuffle(foreign, rng).slice(0, 3);
    const choices = shuffle([pick.clean].concat(distract), rng);

    const shown = parts.slice();
    shown[pick.i] = pick.raw.replace(pick.clean, '____');

    return {
      format: 'choice',
      kind: 'meaning',
      q: 'Fagles wrote it thus. Which word is missing?<br><i>' + shown.join('') + '</i>',
      opts: choices,
      correct: choices.indexOf(pick.clean),
      truth: '<b>' + pick.clean + '</b> — ' + (ep.src || '')
    };
  }
```

and add `lineOmen` to `api`:

```js
  const api = { isKinshipEpithet, bandOf, shuffle, epithetPool, epithetOmen, sequenceOmen, lineOmen };
```

Because `parts` retains its separators, `shown.join('')` reproduces the epigraph byte-for-byte except for the one blanked word. Fagles' em-dash in `Rage—Goddess` survives.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/omens.test.js`
Expected: PASS — `# pass 26`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add app/omens.js test/omens.test.js
git commit -m "feat(omens): blanked-line omen over verbatim Fagles epigraphs"
```

---

### Task 7: `dailyRite` — the shuffled mixed draw, and wire `omens.js` into the page

**Files:**
- Modify: `app/omens.js`, `build-single-file.js` (the `APP_SCRIPTS` array), `app/index.html` (script tag)
- Test: `test/omens.test.js`

**Interfaces:**
- Consumes: all generators.
- Produces: `dailyRite(books, opts) -> [omen]`, `opts = {n=5, rng, label}`. Never longer than `n`. Never contains `null`.

- [ ] **Step 1: Write the failing test**

Append to `test/omens.test.js`:

```js
const RITE_BOOKS = EPI_BOOKS.map((b, k) => ({
  id: b.id,
  data: {
    meta: b.data.meta,
    movements: SEQ_BOOK.data.movements,
    characters: BOOKS[0].data.characters,
    quiz: [
      { n: 1, kind: 'event',   q: 'Authored Q' + k, opts: ['a', 'b', 'c', 'd'], correct: 0, truth: 't' },
      { n: 2, kind: 'meaning', q: 'Authored R' + k, opts: ['a', 'b', 'c', 'd'], correct: 1, truth: 't' }
    ]
  }
}));

test('dailyRite returns exactly n omens and no nulls', () => {
  const r = omens.dailyRite(RITE_BOOKS, { n: 5, rng: seeded(2), label: LABEL });
  assert.strictEqual(r.length, 5);
  assert.ok(r.every(Boolean));
});

test('dailyRite includes derived formats, not only authored omens', () => {
  const r = omens.dailyRite(RITE_BOOKS, { n: 5, rng: seeded(2), label: LABEL });
  assert.ok(r.some(o => o.format === 'sequence'), 'expected a sequence omen');
});

test('dailyRite every omen carries a format', () => {
  const r = omens.dailyRite(RITE_BOOKS, { n: 5, rng: seeded(4), label: LABEL });
  r.forEach(o => assert.ok(o.format === 'choice' || o.format === 'sequence'));
});

test('dailyRite on an empty read-list yields nothing', () => {
  assert.deepStrictEqual(omens.dailyRite([], { n: 5, rng: seeded(1), label: LABEL }), []);
});

test('dailyRite degrades gracefully for a reader one book in', () => {
  const one = [RITE_BOOKS[0]];
  const r = omens.dailyRite(one, { n: 5, rng: seeded(6), label: LABEL });
  assert.ok(r.length >= 1 && r.length <= 5);
  assert.ok(r.every(Boolean), 'a thin pool must drop omens, never emit null');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/omens.test.js`
Expected: FAIL — `omens.dailyRite is not a function`

- [ ] **Step 3: Write minimal implementation**

In `app/omens.js`, insert before the `const api = ...` line:

```js
  /* The Daily Rite: a mixed draw across every read book. Derived omens first (they
     are the new flavor), then authored omens fill to n, then the whole draw is
     shuffled so the sequence question is not always at the top. */
  function dailyRite(books, opts) {
    opts = opts || {};
    const n = opts.n || 5;
    const rng = opts.rng || Math.random;
    const label = opts.label || (id => id);
    if (!books.length) return [];

    const anyBook = () => books[Math.floor(rng() * books.length)];
    const draw = [
      sequenceOmen(anyBook(), rng),
      epithetOmen(epithetPool(books), { rng, label }),
      lineOmen(anyBook(), books, rng)
    ].filter(Boolean);

    const authored = [];
    books.forEach(b => (b.data.quiz || []).forEach((item, qi) => {
      authored.push(Object.assign({}, item, { format: 'choice', srcId: b.id, qi }));
    }));

    const need = Math.max(0, n - draw.length);
    const filled = draw.concat(shuffle(authored, rng).slice(0, need));
    return shuffle(filled, rng).slice(0, n);
  }
```

and add `dailyRite` to `api`:

```js
  const api = { isKinshipEpithet, bandOf, shuffle, epithetPool, epithetOmen, sequenceOmen, lineOmen, dailyRite };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/omens.test.js`
Expected: PASS — `# pass 31`, `# fail 0`

- [ ] **Step 5: Wire it into the page**

In `app/index.html`, change:

```html
<script src="clock.js"></script>
```

to:

```html
<script src="clock.js"></script>
<script src="omens.js"></script>
```

In `build-single-file.js`, change:

```js
const APP_SCRIPTS = ['clock.js'];
```

to:

```js
const APP_SCRIPTS = ['clock.js', 'omens.js'];
```

- [ ] **Step 6: Rebuild and verify both are inlined**

Run:
```bash
node build-single-file.js && grep -c 'src="omens.js"' the-muses-odyssey.html
```
Expected: `0`, and the bundler prints `Un-inlined app scripts: none`.

- [ ] **Step 7: Commit**

```bash
git add app/omens.js test/omens.test.js app/index.html build-single-file.js
git commit -m "feat(omens): the Daily Rite mixed draw; inline omens.js in the bundle"
```

---

### Task 8: `dayLog` — time enters the loom

The day log must be written **only** on human action. `seedProgress()` never touches it, which is why seeded Books 1–4 can never satisfy a day. This is structural, not defensive: there is no flag to forget.

**Files:**
- Modify: `app/index.html` (after `saveMiss`, around line 232; and `toggleRead` at line 573; and `reveal` at line 728)

**Interfaces:**
- Consumes: `window.LOOM_CLOCK` from Task 1.
- Produces: `durable() -> bool`, `goalBooks() -> number`, `setGoalBooks(n)`, `bookPasses(id) -> bool`, `dayComplete(key) -> bool`, `recordDay(kind, id)`, `readStreak() -> {count,lastDay}|null`, `booksDoneToday() -> number`, `DEADLINE`.

- [ ] **Step 1: Add the day log**

In `app/index.html`, immediately after the `saveMiss` line (currently line 232), insert:

```js
/* ---- the day log: the first thing in the loom that knows what day it is ----
   Written ONLY from toggleRead() and the per-book reveal(), both of which fire
   only on a human action. seedProgress() writes read/best flags and never calls
   recordDay(), so the four seeded books are an undated past: they count toward
   lifetime totals and can never complete a day or begin a streak. No
   `loom.seeded.*` flag is needed — the rule falls out of where the writes live.

   The Daily Rite and the Grand Examination must NOT call recordDay(). Only a
   per-book sitting can advance a day. */
const DEADLINE = '2026-07-28';
const PASS_RATIO = 0.7;                 // the "thread holds bright" tier, reused
const dayKey = k => 'loom.day.' + k;

/* The bundle's shim IS localStorage and happily accepts writes, so a canary probe
   cannot detect it. The shim raises __loomVolatile instead. Where storage is
   volatile, a streak would silently reset on every reload — so we show none. */
function durable(){
  if(typeof window !== 'undefined' && window.__loomVolatile) return false;
  try{
    localStorage.setItem('__loom_durable','1');
    const ok = localStorage.getItem('__loom_durable')==='1';
    localStorage.removeItem('__loom_durable');
    return ok;
  }catch(e){ return false; }
}

function dayEntry(k){
  try{ return JSON.parse(localStorage.getItem(dayKey(k)) || '{"read":[],"sat":[]}'); }
  catch(e){ return {read:[],sat:[]}; }
}
function goalBooks(){
  try{ return (JSON.parse(localStorage.getItem('loom.goal')||'{}').books) || 1; }
  catch(e){ return 1; }
}
function setGoalBooks(n){
  try{ localStorage.setItem('loom.goal', JSON.stringify({books: Math.max(1, n|0)})); }catch(e){}
}
function readStreak(){
  try{ return JSON.parse(localStorage.getItem('loom.streak')||'null'); }catch(e){ return null; }
}

/* A book passes when its best reckoning clears the Fates' "thread holds bright". */
function bookPasses(id){
  const d = window.LOOM_DATA[id];
  const total = (d && d.quiz) ? d.quiz.length : 0;
  const best = bestScore(id);
  return total > 0 && best != null && best >= PASS_RATIO * total;
}

/* A book counts on the day its SECOND condition lands. Read Monday, passed
   Tuesday → Tuesday completes, because Tuesday's entry names the book and both
   conditions now hold. */
function booksDoneOn(k){
  const e = dayEntry(k);
  const touched = {};
  e.read.concat(e.sat).forEach(id => { touched[id] = true; });
  return Object.keys(touched).filter(id => isRead(id) && bookPasses(id)).length;
}
const booksDoneToday = () => booksDoneOn(LOOM_CLOCK.todayKey());
const dayComplete = k => booksDoneOn(k) >= goalBooks();

function recordDay(kind, id){
  const k = LOOM_CLOCK.todayKey();
  const e = dayEntry(k);
  if(e[kind].indexOf(id) < 0) e[kind].push(id);
  try{ localStorage.setItem(dayKey(k), JSON.stringify(e)); }catch(err){}
  if(dayComplete(k)){
    try{ localStorage.setItem('loom.streak', JSON.stringify(LOOM_CLOCK.streakNext(readStreak(), k))); }catch(err){}
  }
}
```

- [ ] **Step 2: Record the read action**

In `app/index.html`, replace line 573:

```js
function toggleRead(id){ setRead(id, !isRead(id)); topbar(id); }
```

with:

```js
function toggleRead(id){
  const now = !isRead(id);
  setRead(id, now);
  if(now) recordDay('read', id);      // un-marking never rewrites history
  topbar(id);
}
```

- [ ] **Step 3: Record the sitting**

In `app/index.html`, in `reveal()` (line 728), replace:

```js
function reveal(score,total,stats,missArr){
  saveScore(current,score);
  saveMiss(current, missArr.slice().sort((a,b)=>a-b));
```

with:

```js
function reveal(score,total,stats,missArr){
  saveScore(current,score);
  saveMiss(current, missArr.slice().sort((a,b)=>a-b));
  recordDay('sat', current);   // per-book only; the Rite and the Exam never call this
```

- [ ] **Step 4: Verify the Grand Examination does not record**

The Examination has its own `examReveal()` (`app/index.html:825`) and never calls `reveal()` — verified before this plan was written. So adding `recordDay` to `reveal()` cannot leak into the Exam.

Run: `rg -n 'recordDay' app/index.html`
Expected: exactly three hits — the definition, the call in `toggleRead`, the call in `reveal`.

Run: `rg -n 'reveal\(' app/index.html`
Expected: `reveal(` is called only from `buildQuiz` (line ~709) and defined at ~728. `examReveal(` is a distinct symbol. If this ever changes, the Exam needs its own non-recording path.

- [ ] **Step 5: Verify seeding cannot complete a day**

Run:
```bash
rg -n -A8 'function seedProgress' app/index.html | rg -c 'recordDay' || echo "0 — seedProgress does not record. Correct."
```
Expected: `0 — seedProgress does not record. Correct.`

- [ ] **Step 6: Commit**

```bash
git add app/index.html
git commit -m "feat(rite): the day log, written only on human action"
```

---

### Task 9: The home hub — goal, streak, and Atropos at the door

**Files:**
- Modify: `app/index.html` — `showHome()` (line 269), and the CSS block near line 117.

**Interfaces:**
- Consumes: `booksDoneToday`, `goalBooks`, `setGoalBooks`, `readStreak`, `durable`, `DEADLINE`, `LOOM_CLOCK.daysUntil`.
- Produces: `riteCard() -> html string`, `bumpGoal(delta)`.

- [ ] **Step 1: Add the styles**

In `app/index.html`, immediately before the `/* quiz */` comment (line 117), insert:

```css
  /* the day's measure */
  .rite{background:var(--card); border:1px solid var(--line); border-radius:10px;
        padding:14px 16px; margin:14px 0 6px;}
  .rite .hd{font-size:12px; letter-spacing:3px; text-transform:uppercase; color:var(--wine);}
  .rite .goal{font-size:17px; margin:6px 0 2px;}
  .rite .goal b{color:var(--wine);}
  .rite .meta{font-size:13px; color:var(--soft); font-style:italic;}
  .rite .streak{font-size:13px; color:var(--gold); margin-top:4px;}
  .rite .door{font-size:13px; color:var(--soft); margin-top:4px;}
  .rite .adj{background:none; border:1px solid var(--line); color:var(--soft);
             border-radius:6px; min-width:34px; min-height:34px; font:inherit; cursor:pointer;}
  .rite .adj:active{background:var(--parch2);}
```

- [ ] **Step 2: Add the card builder**

In `app/index.html`, immediately before `function showHome(){` (line 269), insert:

```js
/* Lachesis allots the measure; Atropos waits at the door. The pace line counts
   only books that are AUTHORED and UNREAD — a line reading "44 books remain" is a
   lie dressed as motivation, since 38 of them are unwritten. */
function bumpGoal(delta){ setGoalBooks(goalBooks() + delta); showHome(); }

function riteCard(){
  const goal = goalBooks();
  const done = booksDoneToday();
  const left = ORDER.filter(id => authored(id) && !isRead(id)).length;
  const days = LOOM_CLOCK.daysUntil(DEADLINE);

  let h = `<div class="rite"><div class="hd">The day's measure</div>`;
  h += `<div class="goal"><b>${done}</b> of <b>${goal}</b> book${goal===1?'':'s'} today`;
  h += ` <button class="adj" onclick="bumpGoal(-1)" aria-label="fewer books">–</button>`;
  h += ` <button class="adj" onclick="bumpGoal(1)" aria-label="more books">+</button></div>`;
  h += done >= goal
    ? `<div class="meta">The thread is spun. The day is kept.</div>`
    : `<div class="meta">A book is kept when it is read and its omens hold.</div>`;

  if(durable()){
    const s = readStreak();
    const c = s ? s.count : 0;
    h += c > 0
      ? `<div class="streak">✦ ${c} day${c===1?'':'s'} unbroken</div>`
      : `<div class="streak">✦ the thread waits to be spun</div>`;
  }else{
    h += `<div class="meta">This copy cannot keep a streak — open it from the web to have the Fates remember.</div>`;
  }

  if(days > 0 && left > 0){
    h += `<div class="door">Atropos waits ${days} day${days===1?'':'s'} hence · ${left} book${left===1?'':'s'} on the loom, unread</div>`;
  }else if(days > 0){
    h += `<div class="door">Atropos waits ${days} day${days===1?'':'s'} hence · every written book is read</div>`;
  }
  return h + `</div>`;
}
```

- [ ] **Step 3: Render it**

In `showHome()`, replace:

```js
  h += `<div class="progress">${authoredAll} of 48 books on the loom · ${readAll} read</div>`;
  h += `<div class="progbar"><i style="width:${(authoredAll/48*100).toFixed(1)}%"></i></div>`;
```

with:

```js
  h += `<div class="progress">${authoredAll} of 48 books on the loom · ${readAll} read</div>`;
  h += `<div class="progbar"><i style="width:${(authoredAll/48*100).toFixed(1)}%"></i></div>`;
  h += riteCard();
```

- [ ] **Step 4: Verify in the browser**

Rebuild and open the bundle:
```bash
node build-single-file.js
```
Load the c11-browser skill and open `the-muses-odyssey.html`. Confirm on the home screen:
- "The day's measure" card shows `0 of 1 books today`.
- The `–` / `+` buttons change the goal and the card re-renders.
- The Atropos line reads `Atropos waits 19 days hence · 6 books on the loom, unread` (on 2026-07-09).
- A streak line appears (storage is durable when served over `http`/`file` with a real origin).

- [ ] **Step 5: Verify the deadline expires cleanly**

In the browser console, run `LOOM_CLOCK.daysUntil('2026-07-28','2026-07-29')`.
Expected: `-1`. Confirm `riteCard()` renders no door line for a non-positive value (the `days > 0` guard).

- [ ] **Step 6: Commit**

```bash
git add app/index.html
git commit -m "feat(rite): the day's measure, the streak, and Atropos at the door"
```

---

### Task 10: The fraying thread and the sequence renderer

The thread is a barometer, not a life bar. Nothing locks; nothing resets; there is no fail state. `FORMAT[f] || FORMAT.choice` mirrors the existing `KIND[k] || KIND.event` fallback, so authored omens (which carry no `format`) render through today's exact path.

**Files:**
- Modify: `app/index.html` — CSS near line 117; `buildQuiz` (line 651).

**Interfaces:**
- Consumes: omen objects with `format`; `shuffleOpts` (`app/index.html:640`).
- Produces: `renderThread(total) -> html`, `frayThread(missCount, total)`, `renderChoice(card, item, onDone)`, `renderSequence(card, item, onDone)`, `formatOf(omen) -> string`.
  Both renderers share the signature `(card, item, onDone)` and call `onDone(right: boolean)` exactly once. Neither reveals the truth or updates the tally — that is the caller's bookkeeping.

- [ ] **Step 1: Add the styles**

In `app/index.html`, immediately after the `.rite .adj:active` rule from Task 9, insert:

```css
  /* the fraying thread — a barometer, never a life bar */
  .thread{display:flex; align-items:center; gap:8px; margin:12px 0 4px;}
  .thread .pips{display:flex; gap:5px;}
  .thread .pip{width:9px; height:9px; border-radius:50%; background:var(--gold);
               transition:background .35s, opacity .35s;}
  .thread .pip.frayed{background:transparent; box-shadow:inset 0 0 0 1px var(--no); opacity:.55;}
  .thread .shears{color:var(--soft); font-size:15px; transition:color .35s;}
  .thread .shears.near{color:var(--no);}
  .thread .lbl{font-size:12px; letter-spacing:2px; text-transform:uppercase; color:var(--soft);}

  /* sequence omens — tap the beats into their true order */
  .seq{display:flex; flex-direction:column; gap:8px; margin-top:8px;}
  .seq .beat{text-align:left; background:var(--card); border:1px solid var(--line);
             border-radius:8px; padding:11px 13px; font:inherit; color:var(--ink);
             cursor:pointer; min-height:44px;}
  .seq .beat:active{background:var(--parch2);}
  .seq .beat.chosen{border-color:var(--gold); color:var(--soft);}
  .seq .beat .ord{color:var(--wine); font-weight:bold; margin-right:8px;}
  .seq .beat[disabled]{cursor:default;}
```

- [ ] **Step 2: Add the thread and the sequence renderer**

In `app/index.html`, immediately before `function buildQuiz(Q, forceFresh){` (line 651), insert:

```js
/* Formats. Authored omens carry no `format`, so they fall through to 'choice' —
   the same graceful degradation KIND already relies on. No migration needed. */
const FORMAT = { choice:'choice', sequence:'sequence' };
const formatOf = o => FORMAT[o && o.format] || FORMAT.choice;

/* The thread frays as omens are missed. Atropos' shears draw near — and stop there.
   There is no fail state: the app's own verdict copy says "No frown — sit longer."
   A punishment here would contradict the book. */
function renderThread(total){
  const pips = Array.from({length: total}, () => '<i class="pip"></i>').join('');
  return `<div class="thread"><span class="lbl">The thread</span>`+
         `<span class="pips">${pips}</span><span class="shears">✂</span></div>`;
}
function frayThread(missCount, total){
  const pips = document.querySelectorAll('.thread .pip');
  for(let i=0; i<pips.length; i++) pips[i].classList.toggle('frayed', i < missCount);
  const sh = document.querySelector('.thread .shears');
  if(sh) sh.classList.toggle('near', total>0 && missCount > total/2);
}

/* The two renderers share one shape: (card, item, onDone), calling onDone(right)
   exactly once. Neither reveals the truth nor touches the tally — that bookkeeping
   differs between a graded sitting and the Rite's practice, and belongs to the caller.
   buildQuiz() and showRite() both drive them, so the option loop exists once. */
function renderChoice(card, item, onDone){
  const view = shuffleOpts(item);
  view.opts.forEach((text, oi) => {
    const b = document.createElement('button'); b.className='opt'; b.textContent = text;
    b.onclick = () => {
      card.querySelectorAll('.opt').forEach(x => x.disabled = true);
      const btns = card.querySelectorAll('.opt');
      const right = oi === view.correct;
      if(right) b.classList.add('correct');
      else { b.classList.add('wrong'); btns[view.correct].classList.add('correct'); }
      onDone(right);
    };
    card.appendChild(b);
  });
}

/* Tap the beats into their true order. Each tap fixes the next position; when all
   four are placed, the omen resolves. Correct iff the tapped order equals item.answer. */
function renderSequence(card, item, onDone){
  const wrap = document.createElement('div'); wrap.className='seq';
  const chosen = [];
  item.items.forEach((title, idx) => {
    const b = document.createElement('button');
    b.className = 'beat'; b.type = 'button';
    b.innerHTML = `<span class="ord"></span>${title}`;
    b.onclick = () => {
      if(b.classList.contains('chosen')) return;
      chosen.push(idx);
      b.classList.add('chosen');
      b.querySelector('.ord').textContent = chosen.length + '.';
      if(chosen.length === item.items.length){
        wrap.querySelectorAll('.beat').forEach(x => x.disabled = true);
        const right = chosen.every((v,i) => v === item.answer[i]);
        wrap.querySelectorAll('.beat').forEach((x,i) => {
          const place = item.answer.indexOf(i);
          x.querySelector('.ord').textContent = (place+1) + '.';
          x.style.borderColor = right ? 'var(--ok)' : 'var(--line)';
        });
        onDone(right);
      }
    };
    wrap.appendChild(b);
  });
  card.appendChild(wrap);
}
```

- [ ] **Step 3: Render the thread in the per-book sitting**

In `app/index.html`, in `renderBody`, replace:

```js
    h += `<div class="tally" id="tally">${d.quiz.length} omens to read · none yet turned</div><div id="quiz"></div>`;
```

with:

```js
    h += renderThread(d.quiz.length);
    h += `<div class="tally" id="tally">${d.quiz.length} omens to read · none yet turned</div><div id="quiz"></div>`;
```

- [ ] **Step 4: Drive `buildQuiz` through the shared renderer, and fray on each miss**

`buildQuiz` currently inlines its own option loop. Move it onto `renderChoice` so the loop exists once, and fray the thread on a miss. In `app/index.html`, inside `buildQuiz`'s `Q.forEach((item,qi)=>{...})` body, replace the whole block from `const view=shuffleOpts(item);` through the closing `});` of the `view.opts.forEach(...)` call:

```js
    const view=shuffleOpts(item);
    view.opts.forEach((text,oi)=>{
      const b=document.createElement('button'); b.className='opt'; b.textContent=text;
      b.onclick=()=>{
        card.querySelectorAll('.opt').forEach(x=>x.disabled=true);
        const btns=card.querySelectorAll('.opt');
        if(oi===view.correct){ b.classList.add('correct'); score++; stats[k].c++; }
        else{ b.classList.add('wrong'); btns[view.correct].classList.add('correct'); missArr.push(qi); }
        truth.classList.add('show'); answered++;
        document.getElementById('tally').textContent=`Omens read · ${answered} of ${Q.length}`;
        if(answered===Q.length) reveal(score, Q.length, stats, missArr);
      };
      card.appendChild(b);
    });
```

with:

```js
    renderChoice(card, item, right => {
      if(right){ score++; stats[k].c++; }
      else { missArr.push(qi); frayThread(missArr.length, Q.length); }
      truth.classList.add('show'); answered++;
      document.getElementById('tally').textContent=`Omens read · ${answered} of ${Q.length}`;
      if(answered===Q.length) reveal(score, Q.length, stats, missArr);
    });
```

Leave `buildQuiz`'s completed-view branch (the pre-answered reconstruction for a read book with a perfect score) untouched — it renders no live options and has nothing to fray.

- [ ] **Step 5: Mend the thread on a retake**

`retakeQuiz()` (line ~719) clears the quiz and resets the tally, but the frayed pips are DOM state it does not know about — a fresh attempt would begin with a thread already frayed from the last one.

In `app/index.html`, in `retakeQuiz()`, replace:

```js
  document.getElementById('quiz').innerHTML='';
  document.getElementById('tally').textContent=`${d.quiz.length} omens to read · none yet turned`;
```

with:

```js
  document.getElementById('quiz').innerHTML='';
  frayThread(0, d.quiz.length);   // a new sitting begins on an unfrayed thread
  document.getElementById('tally').textContent=`${d.quiz.length} omens to read · none yet turned`;
```

- [ ] **Step 6: Verify in the browser**

Rebuild, open `the-muses-odyssey.html` via the c11-browser skill, open Book 5 (unread, so the live quiz builds), and answer one omen wrong. Confirm:
- Six gold pips render above the tally.
- One pip hollows to a wine outline on the miss.
- After four misses of six, the shears turn wine-red.
- Nothing locks, nothing resets, and the verdict still renders at the end.
- Pressing **"Sit the omens again"** restores all six pips to gold.

- [ ] **Step 7: Commit**

```bash
git add app/index.html
git commit -m "feat(rite): the fraying thread and the tap-to-order sequence omen"
```

---

### Task 11: The Daily Rite view

The Rite is separate practice: unlimited, optional, and it **never** calls `recordDay()`. Only reading a book and passing its omens completes a day.

**Files:**
- Modify: `app/index.html` — `showHome()` action buttons (line 283), and a new `showRite()` near `showReview()`.

**Interfaces:**
- Consumes: `LOOM_OMENS.dailyRite`, `label`, `renderThread`, `frayThread`, `formatOf`, `renderChoice`, `renderSequence` (all from Task 10).
- Produces: `showRite()`, `readBooks()`.

Do **not** re-inline an option-rendering loop here. Task 10 extracted `renderChoice` precisely so this view and `buildQuiz` share one copy.

- [ ] **Step 1: Add the view**

In `app/index.html`, immediately before `function showThreads(){` (line 311), insert:

```js
/* ---- THE DAILY RITE (practice; never spins the thread) ----
   Drawn only from READ books — an epithet question that reveals Helenus exists
   leaks exactly as a roster card would. Deliberately does NOT call recordDay(). */
function readBooks(){
  return ORDER.filter(id => authored(id) && isRead(id))
              .map(id => ({ id, data: window.LOOM_DATA[id] }));
}

function showRite(){
  current = null;
  localStorage.removeItem('loom.last');
  document.getElementById('topbar').innerHTML =
    `<div class="grp"><button onclick="showHome()">✦ All Books</button>`+
      `<button onclick="showRoster()">Players</button>`+
      `<button onclick="showExam()">Examination</button></div>`+
    `<div class="grp"><button class="active" disabled>The Daily Rite</button></div>`;

  const books = readBooks();
  const draw = window.LOOM_OMENS.dailyRite(books, { n:5, rng:Math.random, label });

  let h = `<div class="crown">◈ The Loom offers practice ◈</div><h1>The Daily Rite</h1>`;
  if(!draw.length){
    h += `<div class="priorscore">Mark a book read and the Loom will draw from it.</div>`;
    document.getElementById('view').innerHTML = h;
    return;
  }
  h += `<div class="sub">${draw.length} omens · practice only · the thread is not spun here</div>`;
  h += renderThread(draw.length);
  h += `<div class="tally" id="tally">${draw.length} omens to read · none yet turned</div><div id="quiz"></div>`;
  h += `<div style="text-align:center;margin-top:18px;"><button onclick="showRite()">Draw again</button></div>`;
  document.getElementById('view').innerHTML = h;

  const quiz = document.getElementById('quiz');
  let answered = 0, missed = 0;
  const finish = right => {
    if(!right){ missed++; frayThread(missed, draw.length); }
    answered++;
    document.getElementById('tally').textContent = `Omens read · ${answered} of ${draw.length}`;
  };

  draw.forEach(item => {
    const card = document.createElement('div'); card.className='q';
    const ki = KIND[item.kind] || KIND.event;
    card.innerHTML = `<div class="qhead"><span class="qkind ${ki.cls}">${ki.label}</span></div>`+
                     `<div class="qt">${item.q}</div>`;
    const truth = document.createElement('div'); truth.className='truth'; truth.innerHTML = item.truth;

    const render = formatOf(item) === 'sequence' ? renderSequence : renderChoice;
    render(card, item, right => { truth.classList.add('show'); finish(right); });
    card.appendChild(truth); quiz.appendChild(card);
  });
  window.scrollTo({top:0, behavior:'smooth'});
}
```

- [ ] **Step 2: Add the home button**

In `showHome()`, replace:

```js
    if(examCount)   h += `<button onclick="showExam()">◈ The Grand Examination (${examCount}) →</button>`;
```

with:

```js
    if(readAll)     h += `<button onclick="showRite()">☼ The Daily Rite (practice) →</button>`;
    if(examCount)   h += `<button onclick="showExam()">◈ The Grand Examination (${examCount}) →</button>`;
```

- [ ] **Step 3: Verify the Rite never records**

Run: `rg -n 'recordDay' app/index.html`
Expected: exactly three hits (definition, `toggleRead`, `reveal`). `showRite` must not appear.

- [ ] **Step 4: Verify in the browser**

Rebuild, open the bundle in c11-browser, click **The Daily Rite**. Confirm:
- Five omens render, mixing authored questions with at least one sequence card.
- Tapping four beats in order marks them `1. 2. 3. 4.` and reveals the truth.
- Missing an omen frays a pip.
- Returning home, the streak count is **unchanged** — the Rite does not spin the thread.
- "Draw again" produces a different draw.

- [ ] **Step 5: Verify the spoiler gate**

In the browser console, run:
```js
readBooks().map(b => b.id)
```
Expected: only ids where the book is marked read (`iliad-01..04` by default). No unread book appears. An epithet drawn from Book 7 would name Helenus and spoil him.

- [ ] **Step 6: Commit**

```bash
git add app/index.html
git commit -m "feat(rite): the Daily Rite — practice that never spins the thread"
```

---

### Task 12: Full verification and deploy

**Files:**
- Modify: `index.html` (the committed deploy bundle)

- [ ] **Step 1: Run the whole test suite**

Run: `node --test test/*.test.js`
Expected: PASS — `# pass 43`, `# fail 0` (12 clock + 31 omens).

**Do not run `node --test test/`.** Node 22 resolves a bare directory as a *module path*, not a glob, and fails with `Cannot find module '.../test'` — a failure that looks like a broken suite but is a broken command. Either pass the glob (`test/*.test.js`) or run bare `node --test`, which uses Node's default test discovery.

- [ ] **Step 2: Rebuild and check the bundler's own sanity output**

Run: `node build-single-file.js`
Expected output ends with:
```
Leftover ../data/ refs: 0 (must be 0)
Books missing from output: none
Un-inlined app scripts: none
```

- [ ] **Step 3: Confirm the source still opens without a build**

Open `app/index.html` directly in a browser (double-click). Confirm the home screen renders with the day's measure card — proving `clock.js` and `omens.js` load by relative `<script src>` when un-bundled.

- [ ] **Step 4: Verify volatile-storage degradation**

In the c11 browser on the bundle, run in the console:
```js
window.__loomVolatile = true; showHome();
```
Expected: the streak line disappears and is replaced by "This copy cannot keep a streak…". The day's measure still renders. Reload to restore.

- [ ] **Step 5: Refresh the deploy bundle on the branch**

`index.html` (repo root, committed) is the byte-identical copy GitHub Pages serves. Rebuild it so the branch carries the deployable artifact:

```bash
cp the-muses-odyssey.html index.html
git add index.html
git commit -m "build: refresh the deploy bundle with the Daily Rite"
```

- [ ] **Step 6: Confirm the tree is clean and the bundle matches**

Run: `git status --short && diff <(cat the-muses-odyssey.html) index.html && echo "bundle == deploy copy"`
Expected: no output from `git status --short`, and `bundle == deploy copy`.

**Do not push to `main` and do not open the PR here.** The controller opens the PR after the final whole-branch review, per `superpowers:finishing-a-development-branch`. Pages redeploys when the PR merges to `main`.

---

## Notes for the implementer

- **`booksDoneOn` is evaluated at record time**, so a book read Monday and passed Tuesday completes *Tuesday*. Monday's entry stays incomplete forever. That is intended: the day is credited when the reader finishes the work, not retroactively.
- **The device clock is trusted.** A reader who changes their system date can inflate a streak. Not defended against — this is a single-reader, local-first study app.
- **Do not rewrite the 27 kinship epithets.** They are good roster glosses and bad quiz prompts; `isKinshipEpithet` filters them at generation time. Correcting the data would degrade the Players view.
