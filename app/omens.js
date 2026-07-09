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
     Note "of the Greek host" must NOT match — no person is named. */
  const KINSHIP = /\b(son|daughter|father|mother|wife|brother|sister|husband) of [A-Z]/;
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
