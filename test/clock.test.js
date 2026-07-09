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
  assert.strictEqual(clock.daysUntil('2026-07-15', '2026-07-09'), 6);
});

test('daysUntil is negative once the door has passed', () => {
  assert.strictEqual(clock.daysUntil('2026-07-15', '2026-07-16'), -1);
});
