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

  /* Precise, absolute-instant countdown for the final night. targetMs/nowMs are
     epoch milliseconds (UTC), so the gap is real elapsed time — timezone- and
     DST-proof. The "7:30 PM ET" label lives in the view; here we only measure. */
  function timeLeft(targetMs, nowMs) {
    const diff = targetMs - (nowMs == null ? Date.now() : nowMs);
    const total = Math.max(0, diff);
    return {
      past: diff <= 0,                         // at or after the instant
      ms: diff,
      h: Math.floor(total / 3600000),          // total hours (may exceed 24)
      m: Math.floor(total / 60000) % 60,
      s: Math.floor(total / 1000) % 60
    };
  }

  // Human phrase for the gap, coarsening as it widens. null once the door opens.
  function countdownLabel(targetMs, nowMs) {
    const t = timeLeft(targetMs, nowMs);
    if (t.past) return null;
    const d = Math.floor(t.h / 24), h = t.h % 24;
    if (d >= 1) return d + 'd ' + h + 'h';
    if (t.h >= 1) return t.h + 'h ' + t.m + 'm';
    if (t.m >= 1) return t.m + 'm ' + t.s + 's';
    return t.s + 's';
  }

  const api = { todayKey, prevKey, streakNext, daysUntil, timeLeft, countdownLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LOOM_CLOCK = api;
})(this);
