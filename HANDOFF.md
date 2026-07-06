# Handoff — The Muse's Odyssey

**Session date:** 2026-07-05 (updated 2026-07-06)
**Status:** ✅ **RESOLVED via hosted `https://` — the durable fix is LIVE.**
The whole app (hardened single-file bundle, all 6 books inlined) is deployed to GitHub
Pages at **https://mrojas54.github.io/muses-odyssey/** (repo `mrojas54/muses-odyssey`,
public, HTTPS enforced, Pages `built`, last deploy succeeded 2026-07-05 ~10:45pm EDT).
Verified 2026-07-06: HTTP 200, 161 KB, `#view` present, all 6 `LOOM_DATA` books inlined,
direct `boot();`, 0 leftover `../data/` refs, harness shim + error net both present.

**On a real `https://` origin, `localStorage` works** — so this path renders AND persists
quiz scores, sidestepping the entire iOS `file://` null-origin blank-page problem. **The
iCloud/`file://` bundle is now a fallback, not the primary path.** Tell the reader to open
the hosted URL in Safari (and Add to Home Screen for an app-like icon).

Loose end: one GitHub Actions run (28763599704) is a harmless **zombie stuck in `queued`**
(GitHub won't let you cancel a never-started queued run); a later run succeeded and the site
is live, so it can be ignored / will be auto-reaped.

<details><summary>Earlier status (2026-07-05 4:55pm) — bundle-only fix, now superseded by hosting</summary>

Books 5 & 6 authored and live. Single-file mobile bundle built and shipped to
iCloud Drive. Desktop render in Vivaldi **confirmed working**. **FIX APPLIED for the blank-
iPhone bug** (localStorage shim + visible error net added to the bundler; rebuilt and
re-synced to iCloud) — pending on-device confirmation. (The shim still ships in the bundle
and does no harm on `https://`; it's just no longer load-bearing there.)
</details>

### Fix applied this pass (2026-07-05 4:55pm)
- `build-single-file.js` now prepends a **bundle-only hardening `<script>`** (project source
  under `app/`/`data/` untouched) with two nets:
  1. **localStorage shim** — probes storage; if access throws (iOS `file://` null origin),
     installs an in-memory fallback so `boot()`'s `localStorage.getItem('loom.last')` and all
     other bare `localStorage` calls stop throwing. Scores won't persist on the phone (known,
     accepted caveat), but the page renders.
  2. **visible error net** — a `window 'error'` listener that, if `#view` is still empty,
     paints the actual error message on the page ("The loom snagged…") instead of a silent
     blank. So if the phone is STILL blank for a *different* reason, we'll finally see it.
- Verified: 9 script blocks balanced, harness runs before all app code and before `boot()`,
  `#view` exists when it runs. Unit-tested the shim against a `localStorage` getter that
  throws `SecurityError` → `boot()`'s first line returns `null`, reads/writes round-trip,
  page would render. Rebuilt bundle (157.6 KB) and overwrote the iCloud copy.
- **On-device test order:** (a) let iCloud finish syncing the new file (old cached one may
  show first — confirm size ~157.6 KB / re-download); (b) open from Files, then **Share →
  Open in Safari** (cleaner than Quick Look, which can block JS); (c) if still blank, the new
  error net should now print the real error — screenshot it, that's hypothesis 3 territory
  (Quick Look JS sandbox) → hosted `https://` is the durable answer (see below).

### Original diagnosis (kept for reference)

---

## What got done this session

1. **Authored Iliad Book 5** — `data/iliad-05.js` ("Diomedes Fights the Gods", 10 movements,
   4 terms, 1 panel, 4 threads, 6 quiz). Syntax + runtime validated.
2. **Authored Iliad Book 6** — `data/iliad-06.js` ("Hector Returns to Troy", 8 movements,
   4 terms, 1 panel, 4 threads, 6 quiz). Syntax + runtime validated.
3. **Registered both** in `data/manifest.js` → `LOOM_BOOKS` is now iliad-01…iliad-06.
4. **Built a single-file bundle** for offline/phone reading:
   - `build-single-file.js` (project root) — bundler; inlines manifest + all registered
     books into `app/index.html`, neutralizes the async `../data/` loader with a direct
     `boot()`, adds iOS home-screen meta. Re-run with `node build-single-file.js` after
     authoring any new book. Idempotent; fails loud if index.html shape changes.
   - `the-muses-odyssey.html` (project root, ~156 KB) — the generated bundle.
5. **Copied the bundle to iCloud Drive:**
   `~/Library/Mobile Documents/com~apple~CloudDocs/The Muses Odyssey/the-muses-odyssey.html`

---

## THE OPEN BUG — blank home page on iPhone

**Symptom (user, on the way out):** "not showing nothing on home page, not even book tiles."
Observed on iPhone (opened from iCloud/Files). Desktop render in Vivaldi was **never
confirmed** before the user left — but see evidence below.

**Evidence it is NOT a bundle-structure bug** (ran `node` diagnostic on the generated file):
- `<script>` blocks: 8 open / 8 close (1 manifest + 6 books + 1 renderer). Balanced.
- Total `</script` tokens: 8 — so **no inlined data string prematurely closes a block**
  (the classic inline-JSON-in-HTML failure). Clean.
- `boot();` tail present; `../data/` refs: 0; all 6 `window.LOOM_DATA["…"]` present;
  manifest executes before the main script. Order correct.
- Conclusion: the HTML is sound and **should render in any desktop browser**. The blank is
  iPhone-specific.

### Leading hypothesis (fix this first): localStorage throws on iOS `file://`

`boot()` is the entry point and its very first line is **unguarded**:

```js
function boot(){
  const last = localStorage.getItem('loom.last');   // <-- can THROW on iOS file://
  if(last && authored(last)) showBook(last); else showHome();
}
```

On iOS, accessing `localStorage` from a local `file://` page (null origin) — or in the Files
"Quick Look" preview, or with content blockers / private mode — can throw a **SecurityError
on property access itself**, not just on the method. If `boot()` throws, nothing renders →
**blank page, no tiles**, exactly as reported. Desktop `file://` allows localStorage, which
is why Vivaldi would look fine — matching the "only broken on iPhone" shape.

Note `priorMiss()` already wraps its access in try/catch, but `boot()`, `isRead`, `setRead`,
`bestScore`, `saveScore`, `saveMiss`, `showBook`, `showHome`, `showThreads`, `showReview` do
**not** — any of them touching `localStorage` can throw and kill the render.

**Cleanest fix — a storage shim, bundle-only (keeps project source untouched):**
Prepend one `<script>` to the bundle (add it in `build-single-file.js`, before the inlined
data) that replaces `localStorage` with a safe in-memory fallback if the real one throws:

```js
(function(){
  try { var k='__t'; window.localStorage.setItem(k,'1'); window.localStorage.removeItem(k); }
  catch(e){
    var mem={};
    Object.defineProperty(window,'localStorage',{configurable:true,value:{
      getItem:function(k){return k in mem?mem[k]:null;},
      setItem:function(k,v){mem[k]=String(v);},
      removeItem:function(k){delete mem[k];},
      clear:function(){mem={};}
    }});
  }
})();
```

This makes the page render on iOS even when storage is blocked (scores just won't persist —
which is the already-known, accepted caveat). **Alternative:** guard the same way in
`app/index.html` source (helps the c11/desktop `file://` case too) — but the user has
repeatedly said *don't change the project source*, so prefer the bundle-only shim and ask
before touching `app/index.html`.

### Secondary hypotheses (rule out if the shim doesn't fix it)

2. **iCloud file not fully downloaded** — opening a not-yet-synced placeholder shows blank.
   Check the file size on the phone; re-open once with wifi/signal so iOS downloads it.
3. **iOS Quick Look JS limits** — Files preview usually runs JS, but opening in *real Safari*
   (Share → Open in Safari) is a cleaner test. If it works in Safari but not Quick Look,
   it's a preview-sandbox issue, not our code.
4. **Confirm desktop first** — quickest triage: open `the-muses-odyssey.html` in Vivaldi/
   Chrome. If it shows 6 tiles there (it should, per diagnostic), the bug is 100% iOS-side.

---

## Suggested next-session order of work

1. **Confirm desktop render** of `the-muses-odyssey.html` (Vivaldi/Chrome) → should show
   "6 of 48 books on the loom" + Iliad 6/24 tiles. Establishes the bundle is good.
2. **Add the localStorage shim** to `build-single-file.js`, rebuild, re-copy to iCloud,
   re-test on iPhone. Most likely fix.
3. If still blank on iPhone: work hypotheses 2→3 (sync, then real-Safari vs Quick Look).
4. **Decision to raise with user:** for durable quiz scores on the phone, a hosted `https://`
   origin is the only real fix (local files get ephemeral storage on iOS). Offer GitHub
   Pages / Netlify drop of the whole folder as a fallback — this also sidesteps the whole
   blank-page issue since it's no longer a `file://` page.

---

## Files touched this session
- `data/iliad-05.js` — NEW (Book 5)
- `data/iliad-06.js` — NEW (Book 6)
- `data/manifest.js` — appended iliad-05, iliad-06
- `build-single-file.js` — NEW (bundler, project root)
- `the-muses-odyssey.html` — NEW (generated bundle, project root)
- iCloud Drive copy at `…/The Muses Odyssey/the-muses-odyssey.html`
- `HANDOFF.md` — this file

## Related prior context
- `c11-file-access-findings.md` — the earlier investigation into why `file://` sibling-dir
  loads fail in the c11 browser pane (WKWebView `allowingReadAccessToURL:` scope). Same
  *family* of sandbox issue as this iOS storage bug: browser sandboxes treating a loose
  local file as low-trust. The appendix there maps build options (this bundle is the
  "inline/concat" option realized).

## Guardrails carried from user's CLAUDE.md
- **Do not modify project source (`app/`, `data/`) without explicit OK** — user wants the
  no-build reading flow (double-click `app/index.html`) preserved. Prefer bundle-only fixes.
- Data files are `.js` not `.json` on purpose (`<script>` load, no `fetch` on `file://`).
- Voice: Loom/Oracle register; epigraphs paraphrased "after Fagles" unless verbatim-confirmed
  (never wrap a paraphrase in quotation marks).
