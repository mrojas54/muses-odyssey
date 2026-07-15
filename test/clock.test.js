process.env.TZ = 'America/New_York';   // DST tests below depend on US transition dates

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

test('daysUntil matches the July 10 book-club countdown', () => {
  assert.strictEqual(clock.daysUntil('2026-07-28', '2026-07-10'), 18);
});

test('daysUntil is negative once the door has passed', () => {
  assert.strictEqual(clock.daysUntil('2026-07-28', '2026-07-29'), -1);
});

test('daysUntil absorbs a 23-hour spring-forward day', () => {
  // 2026-03-08 is the spring-forward DST transition (clock springs forward 1 hour).
  // (new Date(2026, 2, 9) - new Date(2026, 2, 8)) / 86400000 yields ~0.958
  // Math.round(0.958) = 1, so naive Math.floor would regress.
  assert.strictEqual(clock.daysUntil('2026-03-09', '2026-03-08'), 1);
});

test('daysUntil absorbs a 25-hour fall-back day', () => {
  // 2026-11-01 is the fall-back DST transition (clock falls back 1 hour).
  // (new Date(2026, 10, 2) - new Date(2026, 10, 1)) / 86400000 yields ~1.042
  // Math.round(1.042) = 1, so naive Math.floor would regress.
  assert.strictEqual(clock.daysUntil('2026-11-02', '2026-11-01'), 1);
});

// --- the final-night countdown (absolute instants) ---
const CURTAIN = Date.UTC(2026, 6, 15, 23, 30, 0);   // 2026-07-15 19:30 ET (EDT)

test('timeLeft breaks the gap into h/m/s', () => {
  const now = CURTAIN - ((3 * 3600 + 12 * 60 + 5) * 1000);
  const t = clock.timeLeft(CURTAIN, now);
  assert.deepStrictEqual({ past: t.past, h: t.h, m: t.m, s: t.s }, { past: false, h: 3, m: 12, s: 5 });
});

test('timeLeft flags the instant as past at and after the curtain', () => {
  assert.strictEqual(clock.timeLeft(CURTAIN, CURTAIN).past, true);       // exact
  assert.strictEqual(clock.timeLeft(CURTAIN, CURTAIN + 1000).past, true); // after
  assert.strictEqual(clock.timeLeft(CURTAIN, CURTAIN - 1000).past, false);// before
});

test('countdownLabel shows hours and minutes when over an hour out', () => {
  assert.strictEqual(clock.countdownLabel(CURTAIN, CURTAIN - ((3 * 3600 + 12 * 60) * 1000)), '3h 12m');
});

test('countdownLabel drops to minutes and seconds under an hour', () => {
  assert.strictEqual(clock.countdownLabel(CURTAIN, CURTAIN - ((12 * 60 + 5) * 1000)), '12m 5s');
});

test('countdownLabel shows seconds only in the final minute', () => {
  assert.strictEqual(clock.countdownLabel(CURTAIN, CURTAIN - 45000), '45s');
});

test('countdownLabel is null once the door has opened', () => {
  assert.strictEqual(clock.countdownLabel(CURTAIN, CURTAIN), null);
  assert.strictEqual(clock.countdownLabel(CURTAIN, CURTAIN + 60000), null);
});
