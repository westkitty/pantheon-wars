/* Pantheon Wars — procedural pixel art. Everything is drawn in code at low resolution and upscaled with nearest-neighbour filtering.
 * No external images, no generated or copied pictures. Symbols are original geometric abstractions; no portraits of gods, no copies of
 * institutional crests or sacred objects of living traditions. docs/ART_DIRECTION.md is the governing visual bible.
 * Registries (ART.ids) list every drawable id so tools/validate-data.js and tools/assets.js can prove nothing falls back silently. */
(function (root) {
  'use strict';
  function cv(w, h) { var c = (root.document ? document.createElement('canvas') : new root.OffscreenCanvas(w, h)); c.width = w; c.height = h; return c; }
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hex2rgb(h) { if (h.charAt(0) !== '#') { var m = h.match(/\d+/g); return [+m[0], +m[1], +m[2]]; } var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgb(a) { return 'rgb(' + (a[0] | 0) + ',' + (a[1] | 0) + ',' + (a[2] | 0) + ')'; }
  function rgba(h, a) { var c = hex2rgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function shade(h, f) { var c = hex2rgb(h); return rgb(f >= 0 ? c.map(function (v) { return v + (255 - v) * f; }) : c.map(function (v) { return v * (1 + f); })); }
  function mix(a, b, t) { var A = hex2rgb(a), B = hex2rgb(b); return rgb([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]); }
  function gray(h) { var c = hex2rgb(h), l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; return rgb([l, l, l]); }
  function px(g, x, y, c, w, h) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w || 1, h || 1); }
  function disc(g, cx, cy, r, c) { g.fillStyle = c; for (var y = -Math.floor(r); y <= r; y++) { var w = Math.round(Math.sqrt(Math.max(0, r * r - y * y))); g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); } }
  function ring(g, cx, cy, r, c) { for (var a = 0; a < 360; a += 3) { var t = a * Math.PI / 180; px(g, cx + Math.cos(t) * r, cy + Math.sin(t) * r, c); } }
  function line(g, x0, y0, x1, y1, c, w) { var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0; for (var i = 0; i <= n; i++) { var t = n ? i / n : 0; px(g, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, c, w || 1, w || 1); } }
  function poly(g, pts, c) { g.fillStyle = c; g.beginPath(); g.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); }
  function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function up(c, size) { var o = cv(size, Math.round(size * c.height / c.width)), og = o.getContext('2d'); og.imageSmoothingEnabled = false; og.drawImage(c, 0, 0, o.width, o.height); return o; }
  function star(g, cx, cy, n, r1, r2, c, rot) { var pts = []; for (var i = 0; i < n * 2; i++) { var a = (rot || -Math.PI / 2) + i * Math.PI / n, r = i % 2 ? r2 : r1; pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } poly(g, pts, c); }
  function arc(g, cx, cy, r, a0, a1, c, w) { for (var a = a0; a <= a1; a += 0.04) px(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r, c, w || 1, w || 1); }

  /* ---------------- faction emblems (32x32 grid) */
  var EMBLEMS = {
    thunderbolt_wreath: function (g, pal) {
      for (var a = 0; a < 360; a += 24) { if (a > 240 && a < 300) continue; var t = a * Math.PI / 180, x = 16 + Math.cos(t) * 10, y = 16 + Math.sin(t) * 10; disc(g, x, y, 1.6, '#6f9a3c'); px(g, x - 1, y - 1, '#a8cf6a'); }
      poly(g, [18, 5, 11, 17, 15, 17, 12, 27, 21, 14, 17, 14, 20, 5], pal.accent); line(g, 18, 6, 13, 15, '#fff3c0');
    },
    ash_tree: function (g, pal) {
      [[16, 12, 9, 6], [16, 12, 23, 6], [16, 14, 7, 11], [16, 14, 25, 11], [16, 10, 16, 4]].forEach(function (b) { line(g, b[0], b[1], b[2], b[3], '#d8c8a8'); });
      g.fillStyle = '#d8c8a8'; g.fillRect(15, 10, 3, 13);
      [[9, 6], [23, 6], [7, 11], [25, 11], [16, 4], [12, 5], [20, 5]].forEach(function (p) { disc(g, p[0], p[1], 2.2, '#6d8f4e'); px(g, p[0] - 1, p[1] - 1, '#9fc27a'); });
      [[16, 23, 9, 27], [16, 23, 16, 28], [16, 23, 23, 27]].forEach(function (b) { line(g, b[0], b[1], b[2], b[3], pal.accent); });
      px(g, 22, 8, '#111', 2, 1); px(g, 21, 9, '#111');
    },
    winged_sun: function (g, pal) {
      for (var i = 0; i < 4; i++) { poly(g, [13, 15 + i, 3 + i * 0.5, 11 + i * 2.2, 4 + i, 13 + i * 2.2, 13, 17 + i], i % 2 ? pal.accent : pal.secondary); poly(g, [19, 15 + i, 29 - i * 0.5, 11 + i * 2.2, 28 - i, 13 + i * 2.2, 19, 17 + i], i % 2 ? pal.accent : pal.secondary); }
      disc(g, 16, 15, 4.5, pal.primary); disc(g, 15, 14, 2, '#fff7d0'); line(g, 12, 21, 20, 21, pal.accent);
    },
    eight_pointed_star: function (g, pal) { // the eight-pointed star of Inana/Ištar [M3], drawn as plain geometry
      star(g, 16, 16, 8, 12, 5.5, pal.accent, -Math.PI / 2); star(g, 16, 16, 8, 8, 4, '#fff2b8', -Math.PI / 2 + Math.PI / 8); disc(g, 16, 16, 2.5, pal.secondary);
    },
    cauldron_ring: function (g, pal) { // a bank-outside-ditch assembly ring [I6] around a cauldron [I4]
      ring(g, 16, 16, 11, pal.accent); ring(g, 16, 16, 9, shade(pal.dark, 0.2));
      poly(g, [9, 15, 23, 15, 21, 23, 11, 23], '#2b2b2b'); rect(g, 8, 14, 16, 2, '#4a4a4a'); px(g, 9, 17, '#6a6a6a', 2, 1);
      line(g, 13, 12, 12, 8, '#e6e1cf'); line(g, 16, 12, 17, 7, '#e6e1cf'); line(g, 19, 12, 20, 8, '#e6e1cf');
      rect(g, 12, 24, 8, 1, pal.accent);
    },
    sun_rain_water: function (g, pal) { // original composition: sun over falling rain over lake water [X1, X4]
      disc(g, 16, 10, 5, pal.accent); for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; line(g, 16 + Math.cos(a) * 6.5, 10 + Math.sin(a) * 6.5, 16 + Math.cos(a) * 8.5, 10 + Math.sin(a) * 8.5, '#ffe9a0'); }
      for (i = 0; i < 5; i++) line(g, 9 + i * 3.5, 17, 8 + i * 3.5, 21, '#9ff5e4');
      for (var x = 6; x < 27; x++) { px(g, x, 24 + Math.round(Math.sin(x * 0.8)), pal.secondary); px(g, x, 26 + Math.round(Math.sin(x * 0.8 + 1.5)), shade(pal.secondary, 0.3)); }
    },
    storm_sun_disc: function (g, pal) { // sun disk with a storm line across it [H1, H2]
      disc(g, 16, 16, 9, pal.accent); ring(g, 16, 16, 9, '#fff0c0'); ring(g, 16, 16, 6, shade(pal.accent, -0.25));
      poly(g, [21, 5, 13, 16, 17, 16, 11, 28, 22, 13, 18, 13, 24, 5], '#e8eef4'); line(g, 21, 6, 15, 14, '#ffffff');
    },
    river_rings: function (g, pal) { // abstract river bends and beads; deliberately not a sacred emblem [Y1]
      for (var t = 0; t < 30; t += 0.25) { var x = 4 + t * 0.85, y = 16 + Math.sin(t * 0.42) * 6; px(g, x, y, '#9fd8f0', 2, 2); px(g, x, y + 4, pal.accent); }
      [[8, 9], [16, 7], [24, 9], [8, 25], [16, 27], [24, 25]].forEach(function (p) { disc(g, p[0], p[1], 1.4, '#f4ead2'); });
    },
    rising_field: function (g, pal) { // rising sun over paddy grid; original, not a crest [J1, J4]
      for (var a = Math.PI; a <= Math.PI * 2; a += Math.PI / 8) line(g, 16 + Math.cos(a) * 9, 15 + Math.sin(a) * 9, 16 + Math.cos(a) * 12, 15 + Math.sin(a) * 12, pal.accent);
      for (var y = -7; y <= 0; y++) { var w = Math.round(Math.sqrt(49 - y * y)); rect(g, 16 - w, 15 + y, w * 2 + 1, 1, pal.secondary); }
      for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) rect(g, 8 + c * 4.2, 18 + r * 2.4, 3.4, 1.8, r % 2 ? '#7cb85a' : '#5f9c48');
    },
    flame_dawn: function (g, pal) { // flame over the horizon with three hearths: round, square, half-round [V2, V4]
      rect(g, 4, 21, 24, 1, pal.accent);
      poly(g, [16, 4, 22, 14, 20, 20, 16, 17, 12, 20, 10, 14], pal.accent); poly(g, [16, 9, 19, 15, 16, 18, 13, 15], '#fff0a0');
      disc(g, 9, 26, 2.2, '#f4e6c8'); rect(g, 14, 24, 4, 4, '#f4e6c8'); for (var i = -2; i <= 2; i++) px(g, 23 + i, 26 - Math.round(Math.sqrt(4 - i * i)), '#f4e6c8', 1, 3);
    }
  };
  function emblem(id, pal, size) {
    var c = cv(32, 32), g = c.getContext('2d');
    disc(g, 16, 16, 15, pal.dark); disc(g, 16, 16, 13, mix(pal.dark, pal.secondary, 0.55)); ring(g, 16, 16, 14, pal.accent);
    (EMBLEMS[id] || function () { throw new Error('no emblem ' + id); })(g, pal);
    return size ? up(c, size) : c;
  }

  /* ---------------- power & action icons (24x24). Every faction power has its own drawing; there is no generic fallback. */
  var ICONS = {
    // v0.1 originals
    oak: function (g) { g.fillStyle = '#6a4a2a'; g.fillRect(11, 13, 3, 9); [[12, 9, 6], [7, 11, 4], [17, 11, 4], [12, 5, 4]].forEach(function (d) { disc(g, d[0], d[1], d[2], '#4f7d33'); }); disc(g, 10, 7, 2, '#86b552'); px(g, 15, 9, '#e2b33c', 2, 2); px(g, 8, 12, '#e2b33c', 2, 2); },
    shield: function (g) { poly(g, [12, 3, 20, 6, 19, 15, 12, 21, 5, 15, 4, 6], '#c9a24a'); poly(g, [12, 5, 18, 7, 17, 14, 12, 19, 7, 14, 6, 7], '#2f6fb3'); disc(g, 12, 11, 2.5, '#e9e2cf'); px(g, 11, 10, '#111'); },
    sheaf: function (g) { for (var i = -3; i <= 3; i++) { line(g, 12, 20, 12 + i * 2, 6, '#c9a23a'); disc(g, 12 + i * 2, 6, 1.4, '#f1d27a'); } g.fillStyle = '#7a5e3a'; g.fillRect(9, 14, 7, 2); },
    bolt: function (g) { poly(g, [14, 2, 6, 13, 11, 13, 8, 22, 18, 9, 13, 9, 17, 2], '#ffd84a'); line(g, 14, 3, 9, 11, '#fff8d0'); },
    raven: function (g) { poly(g, [4, 14, 10, 9, 15, 9, 20, 6, 18, 10, 21, 12, 15, 14, 12, 18, 9, 15], '#22232b'); px(g, 16, 9, '#e8e8e8'); poly(g, [20, 6, 23, 7, 20, 8], '#5a5b64'); line(g, 7, 13, 12, 11, '#4a4c58'); },
    rune: function (g) { poly(g, [7, 3, 17, 3, 18, 21, 6, 21], '#8c8a84'); poly(g, [8, 4, 16, 4, 17, 20, 7, 20], '#a9a7a0'); line(g, 10, 6, 10, 18, '#8a2b22', 2); line(g, 10, 7, 15, 10, '#8a2b22', 2); line(g, 10, 11, 15, 14, '#8a2b22', 2); },
    sunrain: function (g) { disc(g, 8, 8, 4, '#ffd36a'); disc(g, 15, 10, 5, '#c9d6de'); disc(g, 11, 11, 4, '#e4ecf0'); for (var i = 0; i < 4; i++) line(g, 9 + i * 3, 16, 8 + i * 3, 20, '#6fb0e0'); },
    hammer: function (g) { g.fillStyle = '#6a4a2a'; g.fillRect(11, 10, 3, 12); poly(g, [5, 4, 19, 4, 19, 11, 5, 11], '#9aa4ad'); poly(g, [5, 4, 19, 4, 19, 6, 5, 6], '#d6dde2'); line(g, 4, 2, 2, 0, '#ffd84a'); line(g, 20, 2, 22, 0, '#ffd84a'); },
    barque: function (g) { disc(g, 12, 7, 4, '#ffcf4a'); disc(g, 11, 6, 2, '#fff5c0'); poly(g, [2, 14, 22, 14, 19, 19, 5, 19], '#c9a24a'); poly(g, [2, 14, 4, 11, 5, 14], '#c9a24a'); poly(g, [22, 14, 20, 11, 19, 14], '#c9a24a'); line(g, 3, 21, 21, 21, '#2f6fb3'); },
    throne: function (g) { poly(g, [7, 3, 12, 3, 12, 13, 18, 13, 18, 21, 7, 21], '#c9a24a'); poly(g, [8, 4, 11, 4, 11, 14, 17, 14, 17, 20, 8, 20], '#1f5fa8'); px(g, 9, 6, '#f1d27a', 2, 6); },
    sprout: function (g) { g.fillStyle = '#5b3a1e'; g.fillRect(4, 17, 16, 4); line(g, 12, 17, 12, 8, '#4f9a3c'); poly(g, [12, 11, 6, 7, 8, 12], '#7cc25a'); poly(g, [12, 9, 18, 5, 16, 10], '#7cc25a'); px(g, 5, 19, '#36b3a8', 14, 1); },
    feather: function (g) { line(g, 6, 21, 17, 3, '#e8e2d0'); for (var i = 0; i < 12; i++) { var x = 7 + i * 0.9, y = 19 - i * 1.4; line(g, x, y, x - 3, y - 2, i % 3 ? '#f4efe0' : '#36b3a8'); line(g, x, y, x + 3, y + 1, '#d8d0b8'); } },
    // Mesopotamian
    solar_path: function (g) { arc(g, 12, 18, 9, Math.PI, Math.PI * 2, '#ffe08a', 1); disc(g, 17, 11, 3, '#ffcf4a'); disc(g, 16, 10, 1.4, '#fff5c0'); for (var x = 2; x < 23; x += 2) px(g, x, 19 + (x % 4 ? 1 : 0), '#5b8fd8', 2, 1); rect(g, 2, 21, 20, 1, '#3d5fa0'); },
    sage_tablet: function (g) { poly(g, [6, 4, 17, 3, 18, 20, 7, 21], '#b89a6a'); poly(g, [7, 5, 16, 4, 17, 19, 8, 20], '#d4b884'); for (var i = 0; i < 5; i++) { line(g, 9, 7 + i * 3, 11, 7 + i * 3, '#6a5034'); px(g, 12, 7 + i * 3, '#6a5034'); line(g, 13, 7 + i * 3, 15, 8 + i * 3, '#6a5034'); } px(g, 18, 2, '#9fd8f0', 2, 2); px(g, 20, 5, '#9fd8f0'); },
    abzu_well: function (g) { poly(g, [4, 12, 20, 12, 18, 21, 6, 21], '#8a7a62'); rect(g, 6, 12, 12, 3, '#3f97a6'); for (var i = 0; i < 4; i++) line(g, 8 + i * 3, 11, 8 + i * 3 + (i % 2 ? 1 : -1), 4 + i, '#9fd8f0'); disc(g, 12, 3, 1.5, '#d8f4ff'); },
    star8: function (g) { star(g, 12, 12, 8, 10, 4.5, '#e8c15a'); star(g, 12, 12, 8, 6, 3, '#fff2b8', -Math.PI / 2 + Math.PI / 8); disc(g, 12, 12, 1.6, '#4b3d9a'); },
    // Irish
    crow_omen: function (g) { poly(g, [3, 13, 9, 9, 13, 10, 18, 7, 17, 11, 21, 12, 14, 14, 11, 17, 8, 14], '#1e1f26'); px(g, 15, 9, '#d8d8d8'); for (var i = 0; i < 3; i++) line(g, 5 + i * 6, 19, 8 + i * 6, 21, '#b6f0c8'); px(g, 20, 4, '#e6e1cf'); px(g, 3, 5, '#e6e1cf'); },
    gathering: function (g) { ring(g, 12, 13, 9, '#c9a04a'); ring(g, 12, 13, 7, '#5a4a30'); [[12, 7], [7, 15], [17, 15], [12, 18]].forEach(function (p) { disc(g, p[0], p[1] - 2, 1.3, '#e6c8a0'); rect(g, p[0] - 1, p[1] - 1, 3, 3, '#2e7d4f'); }); disc(g, 12, 13, 1.5, '#ffb04a'); },
    cauldron: function (g) { poly(g, [4, 11, 20, 11, 18, 20, 6, 20], '#2a2a2a'); rect(g, 3, 10, 18, 2, '#555'); rect(g, 6, 20, 2, 2, '#333'); rect(g, 16, 20, 2, 2, '#333'); for (var i = 0; i < 3; i++) line(g, 8 + i * 4, 9, 7 + i * 4, 3, '#e6e1cf'); px(g, 7, 13, '#7a7a7a', 3, 1); },
    sovereignty: function (g) { ring(g, 12, 12, 9, '#c9a04a'); ring(g, 12, 12, 5, '#2e7d4f'); line(g, 3, 12, 21, 12, '#e6e1cf'); line(g, 12, 3, 12, 21, '#e6e1cf'); disc(g, 12, 12, 2, '#ffd84a'); },
    // Mexica
    wind_spiral: function (g) { for (var t = 0; t < 12; t += 0.12) { var r = 1 + t * 0.75; px(g, 12 + Math.cos(t) * r, 12 + Math.sin(t) * r * 0.8, '#bff5ea'); } line(g, 2, 19, 22, 17, '#9ff5e4'); line(g, 4, 21, 18, 20, '#6fd8c8'); },
    lake_garden: function (g) { rect(g, 2, 15, 20, 7, '#2f8fa0'); poly(g, [5, 14, 19, 14, 18, 18, 6, 18], '#6a5034'); for (var i = 0; i < 6; i++) { line(g, 7 + i * 2, 14, 7 + i * 2, 9 + (i % 2), '#7cc25a'); px(g, 7 + i * 2, 8 + (i % 2), '#b8e870'); } for (i = 0; i < 4; i++) px(g, 5 + i * 4, 20, '#9ff5e4', 2, 1); },
    rain_jar: function (g) { poly(g, [7, 9, 17, 9, 19, 16, 15, 21, 9, 21, 5, 16], '#2a9a86'); rect(g, 9, 6, 6, 3, '#1f7a6a'); for (var i = 0; i < 5; i++) line(g, 4 + i * 4, 1, 3 + i * 4, 5, '#9fd8f0'); px(g, 9, 13, '#9ff5e4', 6, 1); },
    zenith_sun: function (g) { disc(g, 12, 12, 6, '#ffe070'); disc(g, 12, 12, 3.5, '#fffbe0'); for (var i = 0; i < 12; i++) { var a = i * Math.PI / 6; line(g, 12 + Math.cos(a) * 7.5, 12 + Math.sin(a) * 7.5, 12 + Math.cos(a) * (i % 2 ? 10 : 11.5), 12 + Math.sin(a) * (i % 2 ? 10 : 11.5), '#e0b33a'); } },
    // Hittite
    omen_disc: function (g) { disc(g, 12, 11, 7, '#d9a441'); ring(g, 12, 11, 7, '#fff0c0'); ring(g, 12, 11, 4, '#8a6420'); px(g, 12, 11, '#fff0c0'); for (var i = 0; i < 5; i++) px(g, 4 + i * 4, 20, '#9fb8d8', 2, 1); },
    stone_gate: function (g) { rect(g, 3, 6, 6, 16, '#9a948a'); rect(g, 15, 6, 6, 16, '#9a948a'); rect(g, 3, 4, 18, 3, '#b8b2a6'); rect(g, 9, 8, 6, 14, '#2a2620'); for (var i = 0; i < 4; i++) { line(g, 3, 9 + i * 4, 8, 10 + i * 4, '#6e6a62'); line(g, 15, 10 + i * 4, 20, 9 + i * 4, '#6e6a62'); } px(g, 4, 2, '#d9a441', 2, 2); px(g, 18, 2, '#d9a441', 2, 2); },
    returning_bee: function (g) { for (var i = 0; i < 4; i++) { line(g, 5 + i * 4, 21, 5 + i * 4, 15 - i % 2, '#5fa040'); px(g, 4 + i * 4, 14 - i % 2, '#9fd870', 3, 1); } rect(g, 12, 6, 6, 4, '#e0b030'); rect(g, 14, 6, 1, 4, '#2a2010'); rect(g, 16, 6, 1, 4, '#2a2010'); disc(g, 11, 8, 1.5, '#2a2010'); poly(g, [13, 6, 15, 2, 17, 6], '#e8f0f8'); },
    storm_axe: function (g) { line(g, 6, 21, 15, 5, '#6a4a2a', 2); poly(g, [13, 3, 21, 5, 19, 11, 14, 9], '#aab4bc'); poly(g, [3, 4, 9, 9, 6, 9, 10, 15, 4, 9, 7, 9], '#e8eef4'); },
    // Yoruba
    river_mirror: function (g) { disc(g, 12, 12, 8, '#4aa8c8'); disc(g, 12, 12, 6, '#9fd8f0'); ring(g, 12, 12, 8, '#e6b84a'); line(g, 7, 9, 10, 6, '#ffffff'); for (var x = 5; x < 20; x++) px(g, x, 15 + Math.round(Math.sin(x)), '#2f7a9a'); },
    shaping_hands: function (g) { poly(g, [3, 18, 8, 10, 11, 12, 9, 19], '#c8946a'); poly(g, [21, 18, 16, 10, 13, 12, 15, 19], '#a87a52'); disc(g, 12, 9, 4, '#efe6d2'); px(g, 11, 7, '#ffffff', 2, 1); rect(g, 6, 20, 12, 2, '#8a6a4a'); },
    iron_road: function (g) { poly(g, [9, 22, 15, 22, 13, 4, 11, 4], '#b8a070'); for (var i = 0; i < 5; i++) rect(g, 8 + i * 0.4, 6 + i * 3.6, 8 - i * 0.6, 1, '#6a6a6a'); line(g, 18, 4, 21, 1, '#ffd060'); px(g, 20, 6, '#ff9a3a'); px(g, 17, 2, '#ffd060'); },
    thunderstone: function (g) { poly(g, [12, 2, 7, 11, 11, 11, 9, 15, 15, 8, 12, 8, 14, 2], '#ffe070'); poly(g, [6, 16, 18, 16, 16, 21, 8, 21], '#7a6a5a'); poly(g, [7, 16, 12, 14, 17, 16], '#9a8a78'); },
    // Japanese
    mirror_sun: function (g) { disc(g, 12, 12, 7, '#e9c46a'); ring(g, 12, 12, 7, '#fff2c8'); disc(g, 12, 12, 4, '#fffbe8'); for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; line(g, 12 + Math.cos(a) * 8.5, 12 + Math.sin(a) * 8.5, 12 + Math.cos(a) * 10.5, 12 + Math.sin(a) * 10.5, '#ffd9c2'); } },
    torii_gate: function (g) { rect(g, 2, 4, 20, 2, '#e5532d'); rect(g, 4, 6, 16, 1, '#2a1512'); rect(g, 4, 8, 16, 2, '#e5532d'); rect(g, 6, 6, 2, 16, '#e5532d'); rect(g, 16, 6, 2, 16, '#e5532d'); rect(g, 11, 6, 2, 2, '#e5532d'); rect(g, 5, 21, 4, 1, '#2a1512'); rect(g, 15, 21, 4, 1, '#2a1512'); },
    rice_sheaf: function (g) { for (var i = -2; i <= 2; i++) { line(g, 12, 21, 12 + i * 3, 8, '#b89a3a'); for (var k = 0; k < 4; k++) px(g, 12 + i * 3 + (i < 0 ? -1 : 1) * (k % 2), 7 + k * 1.5, '#f0d878'); } rect(g, 9, 15, 6, 2, '#e5532d'); },
    storm_cloud: function (g) { disc(g, 8, 9, 4, '#5a6270'); disc(g, 14, 7, 5, '#6a7282'); disc(g, 18, 10, 3.5, '#5a6270'); rect(g, 5, 10, 16, 3, '#4a5260'); for (var i = 0; i < 4; i++) line(g, 7 + i * 4, 14, 5 + i * 4, 20, '#9fc0e0'); poly(g, [13, 13, 10, 18, 12, 18, 10, 22, 15, 16, 13, 16, 15, 13], '#fff2a0'); },
    // Vedic
    dawn_horizon: function (g) { for (var y = 0; y < 14; y++) rect(g, 1, y + 2, 22, 1, mix('#3a2a5a', '#ffb070', y / 13)); rect(g, 1, 16, 22, 6, '#2c220c'); for (var x = -6; x <= 6; x++) { var h = Math.round(Math.sqrt(36 - x * x) * 0.7); rect(g, 12 + x, 16 - h, 1, h, '#fff0a0'); } },
    altar_flame: function (g) { rect(g, 5, 16, 14, 5, '#c8a878'); rect(g, 6, 17, 12, 1, '#8a6a42'); poly(g, [12, 3, 17, 11, 15, 16, 12, 13, 9, 16, 7, 11], '#d4502a'); poly(g, [12, 7, 14, 12, 12, 14, 10, 12], '#fff0a0'); },
    order_rope: function (g) { for (var t = 0; t < 20; t += 0.5) { px(g, 2 + t, 11 + Math.sin(t * 0.9) * 2, '#e0b81f'); px(g, 2 + t, 13 + Math.sin(t * 0.9 + Math.PI) * 2, '#c8a018'); } for (var x = 3; x < 22; x++) px(g, x, 19 + Math.round(Math.sin(x * 0.7)), '#4aa8c8'); px(g, 3, 5, '#fff0a0', 2, 2); px(g, 19, 4, '#fff0a0', 2, 2); },
    vajra_cloud: function (g) { disc(g, 8, 7, 4, '#4a5878'); disc(g, 15, 6, 5, '#56648a'); rect(g, 4, 8, 16, 3, '#3a4868'); for (var i = 0; i < 6; i++) line(g, 5 + i * 3, 12, 4 + i * 3, 19, '#7fb8f0'); rect(g, 3, 20, 18, 2, '#2f6f9a'); },
    // core rites
    omen: function (g) { poly(g, [2, 12, 8, 7, 16, 7, 22, 12, 16, 17, 8, 17], '#e9e2cf'); disc(g, 12, 12, 4, '#2f6fb3'); disc(g, 12, 12, 2, '#111'); px(g, 11, 10, '#fff'); px(g, 4, 3, '#ffd84a'); px(g, 19, 4, '#ffd84a'); px(g, 20, 20, '#ffd84a'); },
    dream: function (g) { disc(g, 11, 12, 8, '#d8d2f0'); g.globalCompositeOperation = 'destination-out'; disc(g, 15, 9, 7, '#000'); g.globalCompositeOperation = 'source-over'; px(g, 18, 15, '#fff'); px(g, 20, 5, '#fff'); px(g, 6, 3, '#9fd2ff'); px(g, 15, 20, '#9fd2ff'); },
    shrine: function (g) { poly(g, [3, 8, 12, 3, 21, 8], '#e9e2cf'); g.fillStyle = '#d0c8b0'; for (var i = 0; i < 4; i++) g.fillRect(5 + i * 4, 9, 2, 10); g.fillStyle = '#b8b098'; g.fillRect(3, 19, 18, 3); },
    priest: function (g) { disc(g, 12, 6, 3, '#e8c9a0'); poly(g, [8, 10, 16, 10, 18, 21, 6, 21], '#7a5ab8'); line(g, 18, 4, 18, 21, '#c9a24a'); disc(g, 18, 4, 1.5, '#ffe08a'); },
    eclipse: function (g) { disc(g, 12, 12, 9, '#ffcf4a'); disc(g, 12, 12, 7, '#fff1b0'); disc(g, 13, 11, 7, '#111522'); ring(g, 12, 12, 10, '#ff9a3a'); },
    spec_oracle: function (g) { poly(g, [2, 12, 8, 6, 16, 6, 22, 12, 16, 18, 8, 18], '#efe6d2'); disc(g, 12, 12, 4, '#8a5ad8'); disc(g, 12, 12, 1.8, '#111'); for (var i = 0; i < 3; i++) px(g, 6 + i * 6, 2, '#ffe08a'); },
    spec_sanctuary: function (g) { ring(g, 12, 13, 9, '#b8b2a6'); ring(g, 12, 13, 8, '#8a847a'); poly(g, [7, 12, 12, 7, 17, 12, 17, 18, 7, 18], '#e9e2cf'); rect(g, 10, 14, 4, 4, '#3a3428'); },
    spec_beacon: function (g) { rect(g, 10, 6, 4, 16, '#c8bca0'); poly(g, [8, 6, 16, 6, 12, 1], '#ffe08a'); for (var i = 0; i < 4; i++) line(g, 12, 3, 12 + Math.cos(i * 1.57 + 0.78) * 10, 3 + Math.sin(i * 1.57 + 0.78) * 10, 'rgba(255,230,140,0.8)'); },
    covenant: function (g) { poly(g, [5, 4, 19, 4, 19, 20, 12, 17, 5, 20], '#e9dcc0'); line(g, 8, 8, 16, 8, '#6a5034'); line(g, 8, 11, 16, 11, '#6a5034'); disc(g, 12, 15, 2.5, '#b8302a'); },
    route: function (g) { for (var i = 0; i < 8; i++) rect(g, 3 + i * 2.4, 19 - i * 2, 3, 2, '#c8b080'); disc(g, 4, 20, 2.5, '#e9e2cf'); disc(g, 20, 4, 2.5, '#e9e2cf'); disc(g, 12, 11, 1.5, '#3a2a1a'); rect(g, 11, 12, 3, 3, '#7a5ab8'); },
    counter: function (g) { arc(g, 12, 12, 8, 0.4, 5.6, '#9fd2ff', 2); poly(g, [19, 6, 22, 11, 16, 10], '#9fd2ff'); disc(g, 12, 12, 3, '#fff0c0'); },
    envoy: function (g) { line(g, 7, 3, 7, 21, '#6a4a2a'); poly(g, [8, 4, 19, 6, 8, 11], '#e9e2cf'); line(g, 10, 7, 15, 7, '#2f6fb3'); disc(g, 15, 18, 3, '#e8c9a0'); },
    retrain: function (g) { disc(g, 9, 7, 3, '#e8c9a0'); poly(g, [5, 10, 13, 10, 14, 21, 4, 21], '#7a5ab8'); arc(g, 16, 13, 5, -1.2, 2.6, '#ffe08a', 1); poly(g, [19, 17, 21, 13, 17, 15], '#ffe08a'); },
    landmark: function (g) { poly(g, [4, 20, 12, 4, 20, 20], '#8a847a'); poly(g, [12, 4, 20, 20, 14, 20], '#5a564e'); rect(g, 11, 2, 1, 6, '#6a4a2a'); poly(g, [12, 2, 17, 3, 12, 5], '#e5532d'); }
  };
  function icon(id, size) { var c = cv(24, 24), g = c.getContext('2d'); if (!ICONS[id]) throw new Error('no icon ' + id); ICONS[id](g); return size ? up(c, size) : c; }

  /* ---------------- heraldic territory patterns (P046): shape-coded so factions differ in grayscale. 12x12 tiles. */
  var PATTERNS = {
    meander: function (g, c) { rect(g, 1, 1, 9, 1, c); rect(g, 9, 1, 1, 7, c); rect(g, 4, 7, 6, 1, c); rect(g, 4, 4, 1, 4, c); rect(g, 4, 4, 3, 1, c); },
    chevron: function (g, c) { for (var i = 0; i < 6; i++) { px(g, i, 4 + i, c, 1, 2); px(g, 11 - i, 4 + i, c, 1, 2); } },
    hbar: function (g, c) { rect(g, 0, 2, 12, 2, c); rect(g, 0, 8, 12, 2, c); },
    grid: function (g, c) { rect(g, 0, 0, 12, 1, c); rect(g, 0, 0, 1, 12, c); rect(g, 6, 6, 1, 1, c); },
    dots: function (g, c) { rect(g, 2, 2, 2, 2, c); rect(g, 8, 8, 2, 2, c); },
    zigzag: function (g, c) { for (var x = 0; x < 12; x++) px(g, x, 5 + (x % 4 < 2 ? x % 2 : 1 - x % 2) * 2, c, 1, 2); },
    cross: function (g, c) { rect(g, 5, 2, 2, 8, c); rect(g, 2, 5, 8, 2, c); },
    wave: function (g, c) { for (var x = 0; x < 12; x++) px(g, x, 5 + Math.round(Math.sin(x / 12 * Math.PI * 2) * 2), c, 1, 2); },
    vbar: function (g, c) { rect(g, 2, 0, 2, 12, c); rect(g, 8, 0, 2, 12, c); },
    ring: function (g, c) { ring(g, 6, 6, 3.5, c); }
  };
  function pattern(id, color, scale) { var c = cv(12, 12), g = c.getContext('2d'); (PATTERNS[id] || (function () { throw new Error('no pattern ' + id); })())(g, color); return scale ? up(c, 12 * scale) : c; }

  /* ---------------- priests (P042), landmarks (P034), shrine families (P028–P030, P041): authored at 2× in ui/kits.js (v0.4), which
   * registers priestSprite, landmarkSprite and shrineArt on PWArt and fills ids.priests, ids.landmarks and ids.shrines. Garments stay
   * generic, inspired silhouettes (robe length, mantle, headwear block), not reconstructions of real religious dress. */
  var CONDITIONS = ['healthy', 'fortified', 'eclipsed', 'damaged', 'nearlyToppled', 'ruined', 'restored'];

  /* ---------------- atmospheres (P027): per-pantheon sky and grade. Applied subtly on top of the shared age/turn sky. */
  var ATMOS = {
    olympus: { top: '#7f9ccf', mid: '#b8c8de', grade: 'rgba(255,236,200,', motes: '#ffffff', name: 'Olympian daylight' },
    ash: { top: '#59606e', mid: '#9aa0a8', grade: 'rgba(255,170,110,', motes: '#ffb067', name: 'Ash-hall embers and frost' },
    twolands: { top: '#d8a860', mid: '#f0d8a0', grade: 'rgba(255,214,140,', motes: '#ffe08a', name: 'River light of the Two Lands' },
    assembly: { top: '#3a3a78', mid: '#9a90c0', grade: 'rgba(200,180,255,', motes: '#e8c15a', name: 'Star-lit river plain' },
    hearth: { top: '#5f7a72', mid: '#b8c8bc', grade: 'rgba(255,200,140,', motes: '#ffd090', name: 'Hearth smoke and mist' },
    fifthsun: { top: '#4aa0c8', mid: '#f0e0b0', grade: 'rgba(255,230,140,', motes: '#9ff5e4', name: 'High sun and lake light' },
    hatti: { top: '#5a6676', mid: '#a8aeb4', grade: 'rgba(240,210,150,', motes: '#e2d6bf', name: 'Stone, storm and sun disk' },
    orisa: { top: '#6a4a6a', mid: '#e0b8a0', grade: 'rgba(255,190,150,', motes: '#ffc2de', name: 'River warmth and forge glow' },
    kami: { top: '#c88a7a', mid: '#f4dcc8', grade: 'rgba(255,214,190,', motes: '#ffd9c2', name: 'First light' },
    vedic: { top: '#7a4a3a', mid: '#f0c890', grade: 'rgba(255,200,120,', motes: '#fff0a0', name: 'Fire and dawn' }
  };

  /* ---------------- event-card illustrations (P048): 160x90 scenes, tinted by the age (conditional variant). */
  var AGE_TINT = { dawn: ['#3a4a7a', '#f0b880'], zenith: ['#4a7ab8', '#e8e0b0'], twilight: ['#2a1a3a', '#c86a4a'] };
  function eventArt(art, seed, age) {
    var W = 160, H = 90, c = cv(W, H), g = c.getContext('2d'), r = rng(seed || 7), i, x, y, h, t;
    var skies = { comet: ['#0b1030', '#2b2f6a'], eclipse: ['#120c18', '#4a2a1a'], wave: ['#16222e', '#3d5566'], drop: ['#2a2a22', '#6b6a4a'], sun: ['#e9a24a', '#f6dc8a'], mask: ['#2a1e3a', '#7a4a5a'], altar: ['#1e2a3a', '#8a6a4a'],
      canal: ['#7a9ab8', '#e8d8a8'], assembly: ['#5a7a8a', '#d8e0c8'], chinampa: ['#5ab0d0', '#f0e8c0'], meadow: ['#8a9a8a', '#d8d0a8'], forge: ['#3a2a3a', '#c86a3a'], paddy: ['#c8a0a0', '#f8e8d8'], cloudbank: ['#4a4a5a', '#c8a878'] };
    var sk = skies[art] || AGE_TINT[age || 'zenith'];
    for (y = 0; y < H; y++) { var col = mix(sk[0], sk[1], y / H); if (age && AGE_TINT[age]) col = mix(col, AGE_TINT[age][1], 0.12); g.fillStyle = col; g.fillRect(0, y, W, 1); }
    if (['comet', 'eclipse', 'mask', 'altar', 'forge', 'cloudbank'].indexOf(art) >= 0) for (i = 0; i < 70; i++) px(g, r() * W, r() * H * 0.55, r() > 0.7 ? '#fff' : '#9aa6c8');
    g.fillStyle = 'rgba(30,40,60,0.55)'; for (x = 0; x < W; x++) { h = 58 + Math.sin(x * 0.055 + (seed || 0)) * 6 + Math.sin(x * 0.14) * 3; g.fillRect(x, h, 1, H - h); }
    g.fillStyle = 'rgba(20,28,30,0.85)'; for (x = 0; x < W; x++) { h = 72 + Math.sin(x * 0.03 + 1) * 4 + Math.sin(x * 0.19) * 2; g.fillRect(x, h, 1, H - h); }
    var cx = 80, cy = 40;
    switch (art) {
      case 'sheaf': for (i = -6; i <= 6; i++) { line(g, cx, cy + 26, cx + i * 4, cy - 14, '#c9a23a'); disc(g, cx + i * 4, cy - 14, 2.2, '#f1d27a'); } rect(g, cx - 8, cy + 12, 16, 3, '#7a5e3a'); for (i = 0; i < 5; i++) { rect(g, 20 + i * 26, 66, 6, 8, '#c9a23a'); } break;
      case 'comet': disc(g, 118, 18, 4, '#fff'); for (i = 0; i < 60; i++) px(g, 114 - i * 1.6, 20 + i * 0.7, 'rgba(200,220,255,' + (1 - i / 60).toFixed(2) + ')', 3, 1); for (i = 0; i < 6; i++) { rect(g, 30 + i * 18, 64, 2, 8, '#1a1a22'); disc(g, 31 + i * 18, 62, 1.5, '#1a1a22'); } break;
      case 'road': poly(g, [76, 50, 84, 50, 110, 90, 50, 90], '#b8a070'); for (i = 0; i < 4; i++) { var fx = 66 + i * 10; rect(g, fx, 60 - i, 3, 10, '#2a2018'); disc(g, fx + 1, 57 - i, 2, '#2a2018'); line(g, fx + 4, 52 - i, fx + 4, 70 - i, '#5a4a30'); } disc(g, 80, 30, 6, '#ffe8a0'); break;
      case 'sun': disc(g, cx, 30, 16, '#fff1b0'); disc(g, cx, 30, 11, '#ffffff'); for (i = 0; i < 16; i++) { t = i * Math.PI / 8; line(g, cx + Math.cos(t) * 19, 30 + Math.sin(t) * 19, cx + Math.cos(t) * 26, 30 + Math.sin(t) * 26, '#ffd36a'); } g.fillStyle = '#8a6a3a'; for (x = 10; x < 150; x += 9) g.fillRect(x, 76 + (x % 3), 6, 1); for (i = 0; i < 5; i++) line(g, 20 + i * 30, 70, 26 + i * 30, 64, '#6a4a2a'); break;
      case 'mask': poly(g, [cx - 14, 18, cx + 14, 18, cx + 11, 46, cx, 56, cx - 11, 46], '#d8d0c0'); disc(g, cx - 6, 32, 3, '#111'); disc(g, cx + 6, 32, 3, '#111'); line(g, cx - 5, 45, cx + 5, 45, '#5a3a3a'); for (i = 0; i < 9; i++) { rect(g, 20 + i * 14, 66, 5, 8, '#2a1e2a'); disc(g, 22 + i * 14, 64, 2, '#2a1e2a'); } break;
      case 'chisel': poly(g, [50, 74, 104, 74, 100, 30, 56, 26], '#b8b0a0'); poly(g, [56, 26, 100, 30, 96, 22, 60, 20], '#d8d0c0'); line(g, 112, 12, 96, 40, '#6a4a2a', 3); line(g, 96, 40, 92, 48, '#c0c8d0', 3); for (i = 0; i < 10; i++) px(g, 84 + r() * 12, 44 + r() * 8, '#fff'); for (i = 0; i < 4; i++) line(g, 62, 34 + i * 9, 92, 36 + i * 9, '#9a9080'); break;
      case 'drop': for (i = 0; i < 7; i++) { var hx = 18 + i * 19; poly(g, [hx, 72, hx + 12, 72, hx + 12, 62, hx + 6, 56, hx, 62], '#4a3a2a'); px(g, hx + 5, 65, '#ffcf6a', 3, 3); } disc(g, cx, 26, 8, '#7fb3d8'); poly(g, [cx - 8, 24, cx, 10, cx + 8, 24], '#7fb3d8'); break;
      case 'wave': for (y = 50; y < H; y += 3) for (x = 0; x < W; x++) px(g, x, y + Math.sin(x * 0.12 + y) * 2, y % 2 ? '#2f6f8a' : '#245a72'); poly(g, [66, 48, 94, 48, 88, 54, 72, 54], '#5a3a1a'); line(g, 80, 48, 80, 26, '#5a3a1a', 2); poly(g, [80, 26, 94, 40, 80, 40], '#d8d0c0'); for (i = 0; i < 10; i++) line(g, 10 + i * 16, 2, 4 + i * 16, 22, 'rgba(200,220,255,0.5)'); break;
      case 'lyre': line(g, cx - 12, 56, cx - 15, 16, '#c9a24a', 3); line(g, cx + 12, 56, cx + 15, 16, '#c9a24a', 3); line(g, cx - 15, 18, cx + 15, 18, '#c9a24a', 3); rect(g, cx - 13, 55, 27, 4, '#c9a24a'); for (i = -3; i <= 3; i++) line(g, cx + i * 3.5, 20, cx + i * 3.5, 54, '#f4efe0'); break;
      case 'eclipse': disc(g, cx, 32, 18, '#ffcf6a'); disc(g, cx, 32, 15, '#fff1b0'); disc(g, cx + 2, 32, 15, '#0a0810'); ring(g, cx, 32, 20, '#ff8a3a'); for (i = 0; i < 8; i++) { rect(g, 22 + i * 16, 66, 3, 8, '#120c18'); disc(g, 23 + i * 16, 64, 2, '#120c18'); } break;
      case 'coins': for (i = 0; i < 6; i++) { var bx = 20 + i * 22; g.fillStyle = ['#8a5a3a', '#6a7a4a', '#7a4a6a', '#4a6a8a', '#8a6a3a', '#5a7a6a'][i]; g.fillRect(bx, 56, 16, 12); poly(g, [bx - 2, 56, bx + 8, 48, bx + 18, 56], '#b8a070'); } disc(g, cx, 28, 6, '#f1d27a'); disc(g, cx - 10, 33, 5, '#e2b33c'); disc(g, cx + 10, 33, 5, '#e2b33c'); break;
      case 'altar': poly(g, [56, 76, 104, 76, 100, 50, 60, 50], '#8a8478'); poly(g, [60, 50, 100, 50, 94, 44, 66, 44], '#a8a294'); for (i = 0; i < 6; i++) px(g, 66 + i * 6, 58, '#3a3530', 3, 8); g.fillStyle = 'rgba(255,220,140,0.35)'; for (i = 0; i < 8; i++) g.fillRect(74 + i, 12 + i * 4, 12 - i, 30 - i * 4); for (i = 0; i < 3; i++) line(g, 30 + i * 6, 76, 34 + i * 6, 64, '#5a4a30', 2); break;
      case 'canal': for (y = 60; y < 70; y++) rect(g, 0, y, W, 1, mix('#4a8aa0', '#2a6a80', (y - 60) / 10)); rect(g, 0, 58, W, 2, '#8a6a42'); rect(g, 0, 70, W, 2, '#8a6a42'); for (i = 0; i < 6; i++) { rect(g, 14 + i * 24, 48, 4, 10, '#3a2a1a'); disc(g, 16 + i * 24, 46, 2, '#3a2a1a'); line(g, 18 + i * 24, 50, 24 + i * 24, 60, '#6a4a2a', 2); } rect(g, 116, 30, 26, 18, '#c8a878'); rect(g, 122, 22, 14, 8, '#d8bc8c'); break;
      case 'assembly': g.fillStyle = '#4f7a3a'; g.beginPath(); g.ellipse(80, 66, 60, 14, 0, 0, 7); g.fill(); g.fillStyle = '#2f4a24'; g.beginPath(); g.ellipse(80, 66, 50, 10, 0, 0, 7); g.fill(); g.fillStyle = '#6f9a4a'; g.beginPath(); g.ellipse(80, 64, 40, 8, 0, 0, 7); g.fill(); for (i = 0; i < 12; i++) { var ax = 46 + i * 6; rect(g, ax, 56 - (i % 3), 3, 7, ['#2e7d4f', '#8a3a2a', '#c9a04a'][i % 3]); disc(g, ax + 1, 54 - (i % 3), 1.5, '#e6c8a0'); } disc(g, 80, 50, 3, '#ffb04a'); break;
      case 'chinampa': for (y = 56; y < H; y++) rect(g, 0, y, W, 1, mix('#3a9ab0', '#1f6a80', (y - 56) / 34)); for (i = 0; i < 5; i++) { var cxx = 14 + i * 30; poly(g, [cxx, 62, cxx + 24, 62, cxx + 22, 70, cxx + 2, 70], '#6a5034'); for (var k = 0; k < 6; k++) line(g, cxx + 3 + k * 3.5, 62, cxx + 3 + k * 3.5, 54 - (k % 2) * 2, '#7cc25a'); } rect(g, 58, 76, 30, 4, '#5a3a20'); disc(g, 72, 72, 2, '#3a2a1a'); break;
      case 'meadow': for (i = 0; i < 30; i++) line(g, 6 + i * 5, 78, 6 + i * 5 + (r() - 0.5) * 4, 66 + r() * 4, '#9a9a6a'); for (i = 0; i < 4; i++) { disc(g, 30 + i * 30, 70, 4, '#d8d0c0'); disc(g, 28 + i * 30, 67, 2, '#d8d0c0'); } rect(g, 116, 40, 6, 3, '#e0b030'); disc(g, 115, 41, 1.5, '#2a2010'); line(g, 100, 30, 116, 40, 'rgba(255,240,180,0.6)'); break;
      case 'forge': rect(g, 58, 50, 44, 26, '#5a3a2a'); poly(g, [54, 52, 80, 34, 106, 52], '#3a2a1a'); disc(g, 80, 64, 8, '#ff8a3a'); disc(g, 80, 64, 4, '#ffe070'); for (i = 0; i < 18; i++) px(g, 70 + r() * 20, 40 + r() * 20, '#ffd060'); poly(g, [0, 82, 160, 76, 160, 90, 0, 90], '#8a6a42'); for (i = 0; i < 4; i++) { rect(g, 14 + i * 9, 66, 3, 9, '#2a1a1a'); disc(g, 15 + i * 9, 64, 2, '#2a1a1a'); } break;
      case 'paddy': for (y = 58; y < H; y += 6) for (x = 0; x < W; x += 20) { rect(g, x + 1, y + 1, 18, 4, '#7ab0c8'); for (k = 0; k < 4; k++) px(g, x + 3 + k * 4, y + 1, '#7cb85a', 1, 3); } for (i = 0; i < 6; i++) { rect(g, 20 + i * 22, 52, 3, 8, '#e5532d'); disc(g, 21 + i * 22, 50, 2.5, '#d8c8a0'); } break;
      case 'cloudbank': for (i = 0; i < 6; i++) disc(g, 20 + i * 26, 22 + (i % 2) * 6, 16 + (i % 3) * 3, i % 2 ? '#5a6270' : '#6a7282'); rect(g, 0, 30, W, 8, '#4a5260'); for (y = 72; y < H; y++) rect(g, 0, y, W, 1, '#8a6a42'); for (i = 0; i < 4; i++) { rect(g, 30 + i * 30, 66, 10, 5, '#b8a080'); rect(g, 31 + i * 30, 63, 2, 3, '#b8a080'); } for (i = 0; i < 8; i++) line(g, 40 + i * 10, 40, 38 + i * 10, 44, 'rgba(160,190,230,0.5)'); break;
      default: throw new Error('no event art ' + art);
    }
    // age variants: dawn mist, twilight long shadows
    if (age === 'dawn') { g.fillStyle = 'rgba(255,230,210,0.12)'; g.fillRect(0, 50, W, 20); }
    if (age === 'twilight') { g.fillStyle = 'rgba(40,10,40,0.22)'; g.fillRect(0, 0, W, H); }
    return c;
  }

  var ids = { emblems: Object.keys(EMBLEMS), icons: Object.keys(ICONS), patterns: Object.keys(PATTERNS), priests: [], landmarks: [],
    shrines: [], atmospheres: Object.keys(ATMOS), events: ['sheaf', 'comet', 'road', 'sun', 'mask', 'chisel', 'drop', 'wave', 'lyre', 'eclipse', 'coins', 'altar', 'canal', 'assembly', 'chinampa', 'meadow', 'forge', 'paddy', 'cloudbank'], conditions: CONDITIONS, roles: ['emissary', 'seer', 'warden'] };
  root.PWArt = { cv: cv, rng: rng, hex2rgb: hex2rgb, rgb: rgb, rgba: rgba, shade: shade, mix: mix, gray: gray, px: px, disc: disc, ring: ring, line: line, poly: poly, rect: rect, up: up, star: star, arc: arc,
    emblem: emblem, icon: icon, eventArt: eventArt, pattern: pattern, ATMOS: ATMOS, ids: ids };
})(typeof self !== 'undefined' ? self : this);
