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
