/* Pantheon Wars — seeded PRNG (mulberry32). Pure: the generator state lives in a plain object {s} that can be stored inside game state. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PWRng = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function hashSeed(seed) {
    var str = String(seed), h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function make(seed) { return { s: hashSeed(seed) }; }
  function next(st) {
    var t = (st.s = (st.s + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function int(st, n) { return Math.floor(next(st) * n); }
  function range(st, a, b) { return a + next(st) * (b - a); }
  function pick(st, arr) { return arr[int(st, arr.length)]; }
  function shuffle(st, arr) { for (var i = arr.length - 1; i > 0; i--) { var j = int(st, i + 1); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
  function weighted(st, items, w) {
    var total = 0, i; for (i = 0; i < items.length; i++) total += w(items[i]);
    var r = next(st) * total;
    for (i = 0; i < items.length; i++) { r -= w(items[i]); if (r < 0) return items[i]; }
    return items[items.length - 1];
  }
  return { hashSeed: hashSeed, make: make, next: next, int: int, range: range, pick: pick, shuffle: shuffle, weighted: weighted };
});
