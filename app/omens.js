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
       "grandson of Bellerophon"        — kinship word, then "of", then a name
       "Achilles' foster-father"        — a possessive name, then a kinship word
                                          (straight ' and typographic ' both match)
     Note "of the Greek host" must NOT match: no person is named. Nor must
     "Paris's patron" — possessive, but "patron" is no kin. */
  const KIN = "(?:foster-|step-|half-|grand|great-grand)?(?:son|daughter|father|mother|brother|sister)|wife|husband";
  const KINSHIP = new RegExp(
    "\\b(?:" + KIN + ")\\s+of\\s+[A-Z]" +
    "|[A-Z][\\p{L}]*(?:['’']s|['’'])\\s+(?:" + KIN + ")\\b",
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

  /* movements[] is already an ordered list of self-contained beats, so it is a
     question bank with its answer key built in. Titles are deduped defensively:
     findIndex below assumes they are unique. */
  function sequenceOmen(book, rng) {
    const mv = (book.data && book.data.movements) || [];
    const seen = new Set();
    const uniq = [];
    mv.forEach((m, i) => {
      if (m && m.title && !seen.has(m.title)) {
        seen.add(m.title);
        uniq.push({ i, title: m.title });
      }
    });
    if (uniq.length < 4) return null;

    const spread = [];
    for (let a = 0; a < uniq.length; a++) {
      for (let b = a + 2; b < uniq.length; b++) {
        for (let c = b + 2; c < uniq.length; c++) {
          for (let d = c + 2; d < uniq.length; d++) {
            spread.push([uniq[a], uniq[b], uniq[c], uniq[d]]);
          }
        }
      }
    }
    const picked = spread.length
      ? spread[Math.floor(rng() * spread.length)]
      : shuffle(uniq, rng).slice(0, 4);
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
       quotation. Even indices are tokens, odd are the exact separators that stood
       between them. */
    const parts = ep.text.split(/([\s—–]+)/);
    const isSep = s => /^[\s—–]+$/.test(s);
    const cands = parts
      .map((w, i) => ({ i, raw: w, clean: w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '') }))
      .filter(x => !isSep(x.raw) && isCandidate(x.clean));
    if (!cands.length) return null;

    const pick = cands[Math.floor(rng() * cands.length)];

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
        seen.add(lw);
        foreign.push(w);
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

  const api = { isKinshipEpithet, bandOf, shuffle, epithetPool, epithetOmen, sequenceOmen, lineOmen };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LOOM_OMENS = api;
})(this);
