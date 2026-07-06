# c11 browser pane: `file://` pages can't load sibling-directory subresources

**Date:** 2026-07-04
**Reporter:** Michelle Rojas
**Context:** Diagnosing why *The Muse's Odyssey* (a static `file://` reading app) rendered every book as "unwritten" in the c11 browser pane, but correctly in Safari/Chrome.

---

## TL;DR

The c11 browser pane (WKWebView) opens a local `file://` page with read access scoped to **the opened file's own directory**. Subresources in a **parent or sibling directory** (e.g. `<script src="../data/foo.js">`) silently fail to load. Safari and Chrome allow these loads, so the same file works there. This is a c11-side choice (`allowingReadAccessToURL:` scope), not an unavoidable WKWebView limitation.

---

## Symptom

- App layout: `the-muses-odyssey/app/index.html` renders books; data lives in the **sibling** dir `the-muses-odyssey/data/` as `data/<id>.js` files.
- `index.html` loads them with relative tags: `<script src="../data/manifest.js">` and dynamically-injected `<script src="../data/<id>.js">`.
- In the **c11 browser pane**: all 48 book cells show the dashed "unwritten" placeholder.
- In **Safari / Chrome / Vivaldi** (same file, same paths): the authored books render correctly.

## Root cause

c11's browser surface is a **WKWebView**. It appears to open local files via:

```swift
webView.loadFileURL(fileURL, allowingReadAccessToURL: <fileURL's own directory>)
```

`allowingReadAccessToURL:` defines the filesystem subtree the page may read. Because it's scoped to `app/`, any subresource under `app/` loads, but `../data/` (a sibling of `app/`) is outside the granted scope and is blocked. The block is **silent** — no console error — so a page that depends on those subresources boots with missing data and no visible failure.

## Reproduction (verified live in the c11 pane)

Run against the loaded page (`surface:N` = the browser surface):

```bash
# 1. Page state — manifest never loaded, no data registered
c11 browser surface:N eval "JSON.stringify({books: window.LOOM_BOOKS||null, loaded: Object.keys(window.LOOM_DATA||{})})"
# => {"books":null,"loaded":[]}

# 2. Same-directory subresource: LOADS
#    (drop a trivial app/__probe.js that sets window.__PROBE_OK = true)
c11 browser surface:N eval "new Promise(r=>{const s=document.createElement('script');s.src='./__probe.js';s.onload=()=>r('LOADED');s.onerror=()=>r('ERROR');document.head.appendChild(s);})"
# => LOADED

# 3. Parent/sibling subresource: ERROR
c11 browser surface:N eval "new Promise(r=>{const s=document.createElement('script');s.src='../data/manifest.js';s.onload=()=>r('LOADED');s.onerror=()=>r('ERROR');document.head.appendChild(s);})"
# => ERROR
```

Minimal standalone repro (no app needed):

```
/tmp/repro/
├── app/index.html      <script src="../data/x.js"></script>
└── data/x.js           document.body.dataset.loaded = "yes"
```

Open `/tmp/repro/app/index.html` in the c11 pane → `x.js` never runs. Open the same file in Chrome → it runs.

## Why it matters

A static site whose entry file references assets in a **parent or sibling** directory (e.g. `app/index.html` loading `../data/…`) will silently lose those assets in the c11 pane while behaving fine in every mainstream browser. The silent-failure aspect (no console signal, page boots anyway) makes it especially confusing to diagnose.

### Nuance: it's the *direction* of the reference, not the split

The severity depends on path direction, and this is worth stating plainly:

- **Down-references** (`./data/…`, `./assets/…`) — the common case, where `index.html` sits at the project root and assets nest *below* it — stay within the granted read scope and **work fine in c11**.
- **Up-and-over references** (`../data/…`) — where the entry file lives in a subdirectory and reaches into a *sibling* directory — are what c11 blocks.

Most static-site conventions keep the entry file at the top with assets nested beneath, so they never hit this. This app is on the less-common side because it deliberately puts the renderer in `app/` as a sibling of `data/`. That slightly **lowers the real-world blast radius** of the bug — but does not make it invalid: up-and-over `file://` references are legal, and Chrome/Safari/Vivaldi honor them. c11 is the outlier in *silently* dropping them.

## Proposed fix direction (for discussion — security scope is the open question)

Widen `allowingReadAccessToURL:` beyond the file's own directory. Options, roughly in order of preference:

1. **Scope to the workspace cwd / root.** c11 already knows the directory each workspace was launched in. Granting the browser read access to that root is coherent ("I can view files under the project I'm working in"), bounded, and matches user intent.
2. **A `--file-access-root <dir>` flag** on `c11 browser open` / `new-surface`, so the caller opts into a wider scope explicitly.
3. Scope to the file's parent directory — cheapest, but still breaks anything two levels up.

**Security tradeoff to weigh:** a wider read scope lets a local HTML file read other files in that subtree via `<script>`/`<img>`/`fetch`-of-same-origin and potentially exfiltrate them. That's why this is worth a design conversation rather than a drive-by PR. Mainstream browsers make their own (more permissive) tradeoff here; c11 should pick one deliberately.

## Local workaround (app side, if not fixed upstream)

Make the app self-contained under one directory: move `data/` → `app/data/` and change the two `../data/` prefixes in `index.html` to `data/`. Then every subresource is within the granted scope. (Not applied — keeping the repro intact and preferring the upstream fix.)

---

## Discord draft for Atin

> hey Atin — ran into a neat reproducible bug in the c11 browser pane and figured I'd give you context before tomorrow.
>
> a local `file://` static site renders fine in Safari/Chrome/Vivaldi but shows up broken in the c11 pane. traced it: the browser surface (WKWebView) grants the page read access only to the opened file's own directory, so any `<script src="../data/…">` into a **sibling** folder silently fails to load. same-dir subresources load fine, parent/sibling ones error with no console signal.
>
> verified it live in the pane — `<script src="./x.js">` loads, `<script src="../data/x.js">` errors. minimal repro is just `app/index.html` referencing a sibling `data/x.js`.
>
> looks like it's the `allowingReadAccessToURL:` scope on `loadFileURL`. could widen it to the workspace cwd, or add a `--file-access-root` flag — but there's a real security tradeoff (wider scope = local html can read the subtree), so wanted your read on how you'd want it scoped before I touch anything. happy to take a crack at the PR if you're open to it. full write-up + repro steps in hand for tomorrow.

---

## Appendix: build options and their tradeoffs

This is context for a *separate* question — not part of the c11 bug — but it's the lens that
makes the bug make sense, so it lives here. The Muse's Odyssey is deliberately a **no-build**
app: one renderer, one `.js` data file per book, a manifest, no server, double-click to read.
The `.js`-not-`.json` trick and the `<script>`-tag data registry exist precisely so there's
nothing to compile. That's the philosophy the c11 bug collides with.

**Important:** you don't need a build to fix c11. The down-reference restructure (move `data/`
below `index.html`, change `../data/` → `./data/`) does it with zero tooling. So the options
below are really "what would adding a build buy me in general, and what would it cost the
no-build philosophy" — the actual question worth mapping.

Spectrum, lightest to heaviest:

| Option | What it is | Fixes c11? | Keeps "double-click to read"? | Main cost |
|---|---|---|---|---|
| **No build (today)** | Raw `file://`, `<script>`-tag data registry | ✗ (the bug) | ✅ | Brittle on strict sandboxes |
| **Local static server** | `python3 -m http.server` / `npx serve` in the repo | ✅ (becomes `http://`) | ✗ — must run a command | A running process; not a file you can email |
| **Inline/concat step** | Tiny script globs `data/*.js` + renderer → one self-contained `index.html` | ✅ (no subresources at all) | ✅ | Adds a build; must rebuild after editing a book; generated artifact in the repo |
| **Static site generator** (Eleventy/Astro/Hugo) | Templating + data pipeline, outputs static HTML | ✅ | Depends on output | Real toolchain, `node_modules`, config, learning curve |
| **Bundler** (Vite/esbuild) | Dev server + HMR + production bundle | ✅ | ✗ in dev | Heaviest; fully abandons the ethos |

**The tradeoff each is really making:**

- **Local server** — the *smallest conceptual change*: same files, served over HTTP instead of
  opened. Sidesteps **every** `file://` sandbox quirk (c11, CORS, `fetch`) at once — you could
  even drop the `.js`-not-`.json` trick and use real `fetch`. Cost: it's no longer "a file," it's
  "a thing you start" — the exact property the project was designed to avoid.

- **Inline/concat step** — the *most philosophy-preserving fix*. Still one openable HTML file with
  no dependencies; you've just moved assembly from "browser does it at load time via script tags"
  to "a ~20-line script does it once at author time." It even makes the artifact *more* portable
  (a single file survives being emailed, dropped in Drive, opened in any webview). Cost: a build
  step now exists and editing a book means re-running it — precisely the friction the
  manifest-registry design exists to eliminate.

- **SSG / bundler** — buy things this app doesn't need: routing, componentization, incremental
  rendering, hot reload. For a reader that's just data → one template, they're all cost and little
  benefit, and they bury the app under `node_modules` and version churn, working against the
  "open this in 10 years and it still runs" longevity that no-build gives you.

**Bottom line for this project:** the no-build design is optimizing for **longevity and
zero-dependency portability** — no supply chain to rot, nothing to `npm install`, no toolchain to
break. If the brittleness ever needs fixing without betraying that, the **inline/concat step** is
the only build worth considering — and the no-build **down-reference restructure** gets c11
compatibility for free. A build only becomes genuinely attractive if you *also* want single-file
portability; that's the inline/concat option's actual niche.
