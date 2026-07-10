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

test('isKinshipEpithet flags "grandson of X" — a kinship word the first pass missed', () => {
  // data/iliad-06.js, Glaucus
  assert.strictEqual(omens.isKinshipEpithet('grandson of Bellerophon, captain of Lycia'), true);
});

test('isKinshipEpithet flags the possessive form "Achilles\' foster-father"', () => {
  // data/iliad-09.js, Phoenix. Possessive names a kinsman just as plainly as "son of".
  assert.strictEqual(omens.isKinshipEpithet("the old charioteer, Achilles' foster-father"), true);
  // ...but a possessive naming a NON-kinsman must still pass through.
  assert.strictEqual(omens.isKinshipEpithet("goddess of desire, Paris's patron"), false);
});

test('isKinshipEpithet matches a possessive written with a typographic apostrophe', () => {
  // The corpus uses straight quotes today, but the app's prose voice is typographic.
  // The character class must accept U+2019 as well as U+0027.
  const curly = 'the old charioteer, Achilles’ foster-father';
  assert.strictEqual(omens.isKinshipEpithet(curly), true);
  const curlyS = 'Peleus’s son';
  assert.strictEqual(omens.isKinshipEpithet(curlyS), true);
  // A typographic possessive naming a NON-kinsman still passes through.
  assert.strictEqual(omens.isKinshipEpithet('goddess of desire, Paris’s patron'), false);
});

test('isKinshipEpithet does not match a word merely starting with a kinship token', () => {
  assert.strictEqual(omens.isKinshipEpithet("Penelope's motherland"), false);
  assert.strictEqual(omens.isKinshipEpithet("Zeus' brotherhood with Poseidon"), false);
  assert.strictEqual(omens.isKinshipEpithet('Hector’s fatherland'), false);
  assert.strictEqual(omens.isKinshipEpithet("Achilles' foster-father"), true);
  assert.strictEqual(omens.isKinshipEpithet('Peleus’s son'), true);
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

const SEQ_BOOK = { id: 'iliad-01', data: { movements: [
  { n: 'Movement I', title: 'The priest comes with ransom' },
  { n: 'Movement II', title: 'Apollo\'s arrows fall' },
  { n: 'Movement III', title: 'The quarrel in the assembly' },
  { n: 'Movement IV', title: 'Briseis is taken' },
  { n: 'Movement V', title: 'Achilles calls his mother from the sea' },
  { n: 'Movement VI', title: 'Thetis petitions Zeus' }
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

test('sequenceOmen prefers non-contiguous beats when the book can support them', () => {
  const spreadBook = { id: 'iliad-08', data: { movements: Array.from({ length: 8 }, (_, i) => ({
    n: 'Movement ' + (i + 1),
    title: 'Beat ' + (i + 1)
  })) } };
  for (let s = 1; s <= 40; s++) {
    const o = omens.sequenceOmen(spreadBook, seeded(s));
    const indexes = o.answer.map(i => Number(o.items[i].replace('Beat ', '')) - 1);
    for (let i = 1; i < indexes.length; i++) {
      assert.ok(indexes[i] - indexes[i - 1] > 1, 'seed ' + s + ' drew adjacent beats');
    }
  }
});

test('sequenceOmen truth lists the beats in order', () => {
  const o = omens.sequenceOmen(SEQ_BOOK, seeded(9));
  const first = o.items[o.answer[0]];
  assert.ok(o.truth.startsWith('1. ' + first));
});

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

const RITE_BOOKS = EPI_BOOKS.map((b, k) => ({
  id: b.id,
  data: {
    meta: b.data.meta,
    movements: SEQ_BOOK.data.movements,
    characters: BOOKS[0].data.characters,
    quiz: [
      { n: 1, kind: 'event', q: 'Authored Q' + k, opts: ['a', 'b', 'c', 'd'], correct: 0, truth: 't' },
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
