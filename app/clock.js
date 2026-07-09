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

  const api = { todayKey, prevKey, streakNext, daysUntil };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LOOM_CLOCK = api;
})(this);
