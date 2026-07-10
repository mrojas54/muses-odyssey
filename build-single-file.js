#!/usr/bin/env node
/* Bundler: inline first-party scripts, manifest, and all registered books into
   app/index.html, producing a single self-contained the-muses-odyssey.html for
   offline / phone / AirDrop use.

   Reads the real source files (source of truth) and writes ONE derived file next to
   itself. It does not modify app/index.html or anything under data/. Re-run it after
   authoring a new book (once the id is in data/manifest.js) to refresh the bundle.

   Usage:  node build-single-file.js      (run from anywhere; paths are self-relative)
*/

const fs = require('fs');
const path = require('path');

const PROJ = __dirname;                                   // this script lives at project root
const OUT  = path.join(PROJ, 'the-muses-odyssey.html');

const read = p => fs.readFileSync(path.join(PROJ, p), 'utf8');

// 1. Renderer + manifest (manifest gives us the authoritative book order)
let html = read('app/index.html');
const manifest = read('data/manifest.js');

// derive the id list from the manifest itself so the bundle == what the app loads.
// Parse the array literal safely (no eval): grab the [...] and JSON.parse it.
const arrText = (manifest.match(/window\.LOOM_BOOKS\s*=\s*(\[[\s\S]*?\])/) || [])[1];
if (!arrText) throw new Error('could not find LOOM_BOOKS array in manifest.js');
const ids = JSON.parse(arrText.replace(/,\s*\]/, ']')); // tolerate a trailing comma
console.log('Books to inline:', ids.join(', '));

// 2a. iOS / file:// hardening (bundle-only — app/index.html source is untouched).
//     Two safety nets, in one script that must run BEFORE any app code:
//       (1) localStorage shim — iOS opens file:// (and Files "Quick Look") with a
//           null origin, where even *reading* window.localStorage throws SecurityError.
//           boot()'s first line is `localStorage.getItem('loom.last')`, so the whole
//           render dies and the page is blank. Swap in an in-memory store when the real
//           one throws (scores just don't persist — the already-accepted local-file caveat).
//       (2) visible error net — a phone has no dev console; if boot() still throws for
//           ANY other reason, paint the error into #view instead of a silent blank page.
const harness = [
  '<script>',
  '(function(){',
  '  var ok=false;',
  "  try{ var k='__loom_probe'; window.localStorage.setItem(k,'1'); window.localStorage.removeItem(k); ok=true; }",
  '  catch(e){ ok=false; }',
  '  if(!ok){',
  '    var mem=Object.create(null);',
  '    var shim={',
  '      getItem:function(k){ k=String(k); return k in mem?mem[k]:null; },',
  '      setItem:function(k,v){ mem[String(k)]=String(v); },',
  '      removeItem:function(k){ delete mem[String(k)]; },',
  '      clear:function(){ mem=Object.create(null); },',
  '      key:function(i){ return Object.keys(mem)[i]||null; },',
  '      get length(){ return Object.keys(mem).length; }',
  '    };',
  "    try{ Object.defineProperty(window,'localStorage',{configurable:true,writable:true,value:shim}); }",
  '    catch(e){ try{ window.localStorage=shim; }catch(e2){} }',
  '    window.__loomVolatile=true;   /* in-memory: writes vanish on reload. No streak may claim to persist. */',
  '  }',
  "  window.addEventListener('error',function(ev){",
  "    var view=document.getElementById('view');",
  "    if(view && view.innerHTML.trim()===''){",
  '      view.innerHTML=\'<div style="padding:28px 22px;color:#8a3a3f;font:15px Georgia,serif;line-height:1.5;">\'+',
  "        '<b>The loom snagged.</b><br><br>'+",
  "        String((ev && (ev.message||ev.error))||'unknown error')+",
  "        '<br><br><span style=\"color:#6b5d4f;font-size:13px;\">(shown so the page is not silently blank)</span></div>';",
  '    }',
  '  });',
  '})();',
  '</script>'
].join('\n');

// 2b. Build the inlined data blob: hardening first, then manifest, then each book,
//     each in its own <script>.
const blocks = [harness, '<script>\n' + manifest.trim() + '\n</script>'];
for (const id of ids) {
  const body = read(`data/${id}.js`).trim();
  blocks.push('<script>\n' + body + '\n</script>');
}
const inlined = blocks.join('\n');

// 3. Swap the external manifest tag for the full inlined data
const manifestTag = '<script src="../data/manifest.js"></script>';
if (!html.includes(manifestTag)) throw new Error('manifest <script> tag not found — index.html shape changed');
html = html.replace(manifestTag, inlined);

// 3b. Inline first-party app scripts. A relative src works when app/index.html is
//     double-clicked, but the bundle lives at the repo root, so the src would 404.
//     Guarded like the manifest tag: if the shape changes, fail loudly, never silently.
const APP_SCRIPTS = ['clock.js', 'omens.js'];
for (const name of APP_SCRIPTS) {
  const tag = `<script src="${name}"></script>`;
  if (!html.includes(tag)) throw new Error(`app script tag not found: ${tag} — index.html shape changed`);
  html = html.replace(tag, '<script>\n' + read(`app/${name}`).trim() + '\n</script>');
}

// 4. Neutralize the async ../data loader — data is already present, so just boot()
const startAnchor = 'let pending = LOAD.length;';
const endAnchor = 'document.head.appendChild(s);\n});';
const s = html.indexOf(startAnchor);
const e = html.indexOf(endAnchor);
if (s === -1 || e === -1) throw new Error('data loader block not found — index.html shape changed');
const loaderBlock = html.slice(s, e + endAnchor.length);
html = html.replace(loaderBlock,
  '/* single-file build: all book data is inlined above, so boot directly */\nboot();');

// 5. Mobile polish on the DERIVED file only: home-screen webapp meta (no logic change)
const mobileMeta =
  '<meta name="mobile-web-app-capable" content="yes">\n' +
  '<meta name="apple-mobile-web-app-capable" content="yes">\n' +
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n' +
  '<meta name="apple-mobile-web-app-title" content="Muse’s Odyssey">\n' +
  '<meta name="theme-color" content="#7c2331">\n';
html = html.replace('<title>The Muse’s Odyssey</title>',
  '<title>The Muse’s Odyssey</title>\n' + mobileMeta);
// fall back if the source title uses a straight apostrophe
html = html.replace("<title>The Muse's Odyssey</title>",
  "<title>The Muse's Odyssey</title>\n" + mobileMeta);

fs.writeFileSync(OUT, html);

// sanity: no leftover parent-dir references, and every book id appears in the output
const leftover = (html.match(/\.\.\/data\//g) || []).length;
const unInlined = APP_SCRIPTS.filter(n => html.includes(`<script src="${n}"></script>`));
const missing = ids.filter(id => !html.includes(`window.LOOM_DATA["${id}"]`));
console.log('Wrote:', OUT);
console.log('Size:', (Buffer.byteLength(html) / 1024).toFixed(1), 'KB');
console.log('Leftover ../data/ refs:', leftover, '(must be 0)');
console.log('Books missing from output:', missing.length ? missing.join(', ') : 'none');
console.log('Un-inlined app scripts:', unInlined.length ? unInlined.join(', ') : 'none');
if (unInlined.length) throw new Error('app scripts left un-inlined — the bundle would 404 on them');
