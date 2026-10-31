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
  function up(c, size) { var o = cv(size, Math.round(size * c.height / c.width)), og = o.getContext('2d'); og.imageSmoothingEnabled = size < c.width; // pixels scale up crisp, down smooth
    og.drawImage(c, 0, 0, o.width, o.height); return o; }
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
    // v0.5: a 64 px medallion (bevelled rim lit from the upper left, a deep field) carrying the minted 32 px device
    var m = cv(32, 32), mg = m.getContext('2d'); (EMBLEMS[id] || function () { throw new Error('no emblem ' + id); })(mg, pal);
    var c = cv(64, 64), g = c.getContext('2d'), field = mix(pal.dark, pal.secondary, 0.55);
    g.fillStyle = '#100c16'; g.beginPath(); g.arc(32, 32, 31.5, 0, 7); g.fill();
    var rim = g.createLinearGradient(8, 6, 56, 58); rim.addColorStop(0, shade(pal.accent, 0.45)); rim.addColorStop(0.5, pal.accent); rim.addColorStop(1, shade(pal.accent, -0.45)); g.fillStyle = rim; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill();
    var fg = g.createRadialGradient(24, 22, 2, 32, 32, 27); fg.addColorStop(0, shade(field, 0.18)); fg.addColorStop(1, shade(pal.dark, -0.2)); g.fillStyle = fg; g.beginPath(); g.arc(32, 32, 26.5, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1; g.beginPath(); g.arc(32, 32, 26.5, 0, 7); g.stroke();
    g.imageSmoothingEnabled = false; g.drawImage(mint(m, 170), 0, 0);
    return size ? up(c, size) : c;
  }

  /* ---------------- power & action icons (24x24). Every faction power has its own drawing; there is no generic fallback. */
  var ICONS = {
    // v0.1 originals
    oak: function (g) { g.fillStyle = '#6a4a2a'; g.fillRect(11, 13, 3, 9); [[12, 9, 6], [7, 11, 4], [17, 11, 4], [12, 5, 4]].forEach(function (d) { disc(g, d[0], d[1], d[2], '#4f7d33'); }); disc(g, 10, 7, 2, '#86b552'); px(g, 15, 9, '#e2b33c', 2, 2); px(g, 8, 12, '#e2b33c', 2, 2); },
    shield: function (g) { poly(g, [12, 3, 20, 6, 19, 15, 12, 21, 5, 15, 4, 6], '#c9a24a'); poly(g, [12, 5, 18, 7, 17, 14, 12, 19, 7, 14, 6, 7], '#2f6fb3'); disc(g, 12, 11, 2.5, '#e9e2cf'); px(g, 11, 10, '#111'); },
    sheaf: function (g) { for (var i = -4; i <= 4; i++) { line(g, 12, 20, 12 + i * 1.8, 5, '#c9a23a'); disc(g, 12 + i * 1.8, 5 + Math.abs(i) * 0.4, 1.5, i % 2 ? '#f1d27a' : '#e0b84a'); } rect(g, 8, 13, 9, 3, '#7a5e3a'); rect(g, 8, 13, 9, 1, '#a88a5a'); for (i = -2; i <= 2; i++) line(g, 12, 16, 12 + i * 2.5, 22, '#b8962e'); },
    bolt: function (g) { poly(g, [14, 2, 6, 13, 11, 13, 8, 22, 18, 9, 13, 9, 17, 2], '#ffd84a'); line(g, 14, 3, 9, 11, '#fff8d0'); },
    raven: function (g) { poly(g, [2, 15, 7, 10, 12, 10, 15, 6, 19, 5, 22, 7, 19, 8, 18, 11, 14, 14, 10, 15, 7, 19, 5, 17], '#22232b'); poly(g, [7, 10, 9, 3, 14, 2, 12, 9], '#30313b'); poly(g, [9, 4, 13, 3, 12, 8], '#4a4c58'); px(g, 18, 6, '#e8e8e8'); poly(g, [22, 7, 24, 8, 21, 9], '#6a6b74'); line(g, 10, 15, 9, 21, '#5a5b64'); line(g, 12, 14, 13, 21, '#5a5b64'); },
    rune: function (g) { poly(g, [7, 3, 17, 3, 18, 21, 6, 21], '#8c8a84'); poly(g, [8, 4, 16, 4, 17, 20, 7, 20], '#a9a7a0'); line(g, 10, 6, 10, 18, '#8a2b22', 2); line(g, 10, 7, 15, 10, '#8a2b22', 2); line(g, 10, 11, 15, 14, '#8a2b22', 2); },
    sunrain: function (g) { disc(g, 8, 8, 4, '#ffd36a'); disc(g, 15, 10, 5, '#c9d6de'); disc(g, 11, 11, 4, '#e4ecf0'); for (var i = 0; i < 4; i++) line(g, 9 + i * 3, 16, 8 + i * 3, 20, '#6fb0e0'); },
    hammer: function (g) { g.fillStyle = '#6a4a2a'; g.fillRect(11, 10, 3, 12); poly(g, [5, 4, 19, 4, 19, 11, 5, 11], '#9aa4ad'); poly(g, [5, 4, 19, 4, 19, 6, 5, 6], '#d6dde2'); line(g, 4, 2, 2, 0, '#ffd84a'); line(g, 20, 2, 22, 0, '#ffd84a'); },
    barque: function (g) { disc(g, 12, 7, 4, '#ffcf4a'); disc(g, 11, 6, 2, '#fff5c0'); poly(g, [2, 14, 22, 14, 19, 19, 5, 19], '#c9a24a'); poly(g, [2, 14, 4, 11, 5, 14], '#c9a24a'); poly(g, [22, 14, 20, 11, 19, 14], '#c9a24a'); line(g, 3, 21, 21, 21, '#2f6fb3'); },
    throne: function (g) { rect(g, 6, 2, 4, 17, '#c9a24a'); rect(g, 6, 2, 1, 17, '#f1d27a'); rect(g, 6, 12, 13, 4, '#c9a24a'); rect(g, 6, 12, 13, 1, '#f1d27a'); rect(g, 7, 16, 2, 6, '#8a6a2a'); rect(g, 16, 16, 2, 6, '#8a6a2a'); rect(g, 10, 4, 3, 8, '#1f5fa8'); poly(g, [13, 4, 22, 2, 20, 8, 13, 10], '#36b3a8'); poly(g, [13, 6, 21, 5, 19, 8, 13, 9], '#9fe0d8'); },
    sprout: function (g) { g.fillStyle = '#5b3a1e'; g.fillRect(4, 17, 16, 4); line(g, 12, 17, 12, 8, '#4f9a3c'); poly(g, [12, 11, 6, 7, 8, 12], '#7cc25a'); poly(g, [12, 9, 18, 5, 16, 10], '#7cc25a'); px(g, 5, 19, '#36b3a8', 14, 1); },
    feather: function (g) { poly(g, [5, 22, 9, 15, 13, 8, 18, 2, 19, 6, 16, 12, 11, 18], '#f4efe0'); poly(g, [9, 15, 13, 8, 18, 2, 17, 7, 14, 12], '#d8d0b8'); line(g, 5, 22, 18, 2, '#8a7a5a'); for (var i = 0; i < 4; i++) line(g, 10 + i * 2, 15 - i * 3, 14 + i * 2, 15 - i * 3, '#36b3a8'); },
    // Mesopotamian
    solar_path: function (g) { arc(g, 12, 18, 9, Math.PI, Math.PI * 2, '#ffe08a', 1); disc(g, 17, 11, 3, '#ffcf4a'); disc(g, 16, 10, 1.4, '#fff5c0'); for (var x = 2; x < 23; x += 2) px(g, x, 19 + (x % 4 ? 1 : 0), '#5b8fd8', 2, 1); rect(g, 2, 21, 20, 1, '#3d5fa0'); },
    sage_tablet: function (g) { poly(g, [6, 4, 17, 3, 18, 20, 7, 21], '#b89a6a'); poly(g, [7, 5, 16, 4, 17, 19, 8, 20], '#d4b884'); for (var i = 0; i < 5; i++) { line(g, 9, 7 + i * 3, 11, 7 + i * 3, '#6a5034'); px(g, 12, 7 + i * 3, '#6a5034'); line(g, 13, 7 + i * 3, 15, 8 + i * 3, '#6a5034'); } px(g, 18, 2, '#9fd8f0', 2, 2); px(g, 20, 5, '#9fd8f0'); },
    abzu_well: function (g) { poly(g, [4, 12, 20, 12, 18, 21, 6, 21], '#8a7a62'); rect(g, 6, 12, 12, 3, '#3f97a6'); for (var i = 0; i < 4; i++) line(g, 8 + i * 3, 11, 8 + i * 3 + (i % 2 ? 1 : -1), 4 + i, '#9fd8f0'); disc(g, 12, 3, 1.5, '#d8f4ff'); },
    star8: function (g) { star(g, 12, 12, 8, 10, 4.5, '#e8c15a'); star(g, 12, 12, 8, 6, 3, '#fff2b8', -Math.PI / 2 + Math.PI / 8); disc(g, 12, 12, 1.6, '#4b3d9a'); },
    // Irish
    crow_omen: function (g) { rect(g, 9, 13, 6, 10, '#8c8a84'); rect(g, 9, 13, 2, 10, '#aaa8a0'); poly(g, [6, 10, 11, 7, 15, 7, 19, 4, 18, 8, 21, 9, 15, 11, 12, 13, 8, 12], '#1e1f26'); px(g, 17, 6, '#d8d8d8'); for (var i = 0; i < 3; i++) rect(g, 1 + i * 8, 20 - (i % 2), 7, 1, '#b6f0c8'); },
    gathering: function (g) { ring(g, 12, 13, 9, '#c9a04a'); ring(g, 12, 13, 7, '#5a4a30'); [[12, 7], [7, 15], [17, 15], [12, 18]].forEach(function (p) { disc(g, p[0], p[1] - 2, 1.3, '#e6c8a0'); rect(g, p[0] - 1, p[1] - 1, 3, 3, '#2e7d4f'); }); disc(g, 12, 13, 1.5, '#ffb04a'); },
    cauldron: function (g) { poly(g, [4, 11, 20, 11, 18, 20, 6, 20], '#2a2a2a'); rect(g, 3, 10, 18, 2, '#555'); rect(g, 6, 20, 2, 2, '#333'); rect(g, 16, 20, 2, 2, '#333'); for (var i = 0; i < 3; i++) line(g, 8 + i * 4, 9, 7 + i * 4, 3, '#e6e1cf'); px(g, 7, 13, '#7a7a7a', 3, 1); },
    sovereignty: function (g) { disc(g, 12, 13, 8, '#2e7d4f'); disc(g, 12, 13, 6, '#3a9a62'); poly(g, [6, 6, 8, 2, 10, 5, 12, 1, 14, 5, 16, 2, 18, 6], '#e0b84a'); rect(g, 6, 6, 12, 2, '#c9a04a'); for (var i = 0; i < 3; i++) disc(g, 9 + i * 3, 4.5, 0.8, '#ffffff'); ring(g, 12, 13, 8, '#c9a04a'); line(g, 7, 18, 17, 8, '#e6e1cf'); },
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
    shaping_hands: function (g) { poly(g, [6, 20, 9, 12, 11, 15, 11, 21], '#a87a52'); poly(g, [18, 20, 15, 12, 13, 15, 13, 21], '#8a5a3a'); poly(g, [7, 12, 6, 8, 8, 9, 9, 12], '#a87a52'); poly(g, [17, 12, 18, 8, 16, 9, 15, 12], '#8a5a3a'); g.fillStyle = '#c8946a'; g.beginPath(); g.moveTo(9, 13); g.quadraticCurveTo(7, 6, 12, 4); g.quadraticCurveTo(17, 6, 15, 13); g.closePath(); g.fill(); rect(g, 10, 4, 4, 1, '#e0b088'); line(g, 10, 7, 11, 11, '#e0b088'); rect(g, 4, 21, 16, 2, '#6a4a2a'); },
    iron_road: function (g) { poly(g, [2, 22, 9, 10, 15, 10, 22, 22], '#b8a070'); for (var i = 0; i < 4; i++) rect(g, 6 + i * 0.8, 12 + i * 3, 12 - i * 1.6 + i * 3, 1, '#6a5a3a'); rect(g, 7, 4, 10, 3, '#5a5a62'); rect(g, 9, 7, 6, 2, '#4a4a52'); rect(g, 8, 4, 8, 1, '#9a9aa4'); px(g, 18, 2, '#ffd060'); px(g, 20, 4, '#ff9a3a'); px(g, 5, 2, '#ffd060'); },
    thunderstone: function (g) { poly(g, [11, 1, 6, 9, 10, 9, 8, 14, 15, 6, 11, 6, 13, 1], '#ffe070'); line(g, 11, 2, 8, 8, '#fff8d0'); poly(g, [5, 16, 10, 13, 18, 14, 20, 18, 16, 22, 7, 22, 4, 19], '#6a5a4a'); poly(g, [5, 16, 10, 13, 14, 14, 9, 18, 5, 19], '#9a8a78'); line(g, 10, 17, 16, 19, '#4a3a2a'); },
    // Japanese
    mirror_sun: function (g) { disc(g, 12, 12, 7, '#e9c46a'); ring(g, 12, 12, 7, '#fff2c8'); disc(g, 12, 12, 4, '#fffbe8'); for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; line(g, 12 + Math.cos(a) * 8.5, 12 + Math.sin(a) * 8.5, 12 + Math.cos(a) * 10.5, 12 + Math.sin(a) * 10.5, '#ffd9c2'); } },
    torii_gate: function (g) { rect(g, 2, 4, 20, 2, '#e5532d'); rect(g, 4, 6, 16, 1, '#2a1512'); rect(g, 4, 8, 16, 2, '#e5532d'); rect(g, 6, 6, 2, 16, '#e5532d'); rect(g, 16, 6, 2, 16, '#e5532d'); rect(g, 11, 6, 2, 2, '#e5532d'); rect(g, 5, 21, 4, 1, '#2a1512'); rect(g, 15, 21, 4, 1, '#2a1512'); },
    rice_sheaf: function (g) { for (var i = -2; i <= 2; i++) { var tx = 12 + i * 3; line(g, 12, 21, tx, 6, '#7a9a3a'); for (var k = 0; k < 5; k++) { px(g, tx + (i < 0 ? -1 : 1) + (i === 0 ? (k % 2 ? 1 : -1) : 0), 4 + k * 1.6 + Math.abs(i) * 0.6, '#f0d878', 1, 1); } } rect(g, 9, 15, 7, 2, '#e5532d'); rect(g, 9, 15, 7, 1, '#ff8a6a'); },
    storm_cloud: function (g) { disc(g, 8, 9, 4, '#5a6270'); disc(g, 14, 7, 5, '#6a7282'); disc(g, 18, 10, 3.5, '#5a6270'); rect(g, 5, 10, 16, 3, '#4a5260'); for (var i = 0; i < 4; i++) line(g, 7 + i * 4, 14, 5 + i * 4, 20, '#9fc0e0'); poly(g, [13, 13, 10, 18, 12, 18, 10, 22, 15, 16, 13, 16, 15, 13], '#fff2a0'); },
    // Vedic
    dawn_horizon: function (g) { for (var y = 0; y < 14; y++) rect(g, 1, y + 2, 22, 1, mix('#3a2a5a', '#ffb070', y / 13)); rect(g, 1, 16, 22, 6, '#2c220c'); for (var x = -6; x <= 6; x++) { var h = Math.round(Math.sqrt(36 - x * x) * 0.7); rect(g, 12 + x, 16 - h, 1, h, '#fff0a0'); } },
    altar_flame: function (g) { rect(g, 5, 16, 14, 5, '#c8a878'); rect(g, 6, 17, 12, 1, '#8a6a42'); poly(g, [12, 3, 17, 11, 15, 16, 12, 13, 9, 16, 7, 11], '#d4502a'); poly(g, [12, 7, 14, 12, 12, 14, 10, 12], '#fff0a0'); },
    order_rope: function (g) { for (var t = 0; t < 6.28; t += 0.12) { var x = 12 + Math.cos(t) * 9, y = 10 + Math.sin(t) * 6; px(g, x, y, t % 0.5 < 0.25 ? '#e0b81f' : '#a88010', 2, 2); } line(g, 4, 10, 1, 16, '#e0b81f', 2); for (var x2 = 2; x2 < 22; x2++) px(g, x2, 20 + Math.round(Math.sin(x2 * 0.7)), '#4aa8c8'); rect(g, 10, 8, 4, 4, '#fff0a0'); },
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
  /* Minting (v0.5): a glyph drawn on its pixel grid is doubled, then sculpted per pixel under the shared upper-left light — a lit edge where
     the shape faces the light, a shaded edge where it turns away, and a one-pixel dark silhouette outside — so every icon and emblem keeps a
     crisp, consistent outline at the sizes the interface shows (24–96 px). */
  function mint(src, outline) {
    var w = src.width, h = src.height, c = cv(w * 2, h * 2), g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(src, 0, 0, w * 2, h * 2);
    var W = c.width, H = c.height, im = g.getImageData(0, 0, W, H), d = im.data, a0 = new Uint8Array(W * H), i, x, y;
    for (i = 0; i < W * H; i++) a0[i] = d[i * 4 + 3];
    var on = function (xx, yy) { return xx >= 0 && yy >= 0 && xx < W && yy < H && a0[yy * W + xx] > 96; };
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) { i = (y * W + x) * 4; var me = on(x, y);
      if (me) { var lit = !on(x - 1, y - 1) || !on(x, y - 1), dark = !on(x + 1, y + 1) || !on(x + 1, y);
        if (lit && !dark) { d[i] += (255 - d[i]) * 0.35; d[i + 1] += (255 - d[i + 1]) * 0.35; d[i + 2] += (255 - d[i + 2]) * 0.3; }
        else if (dark && !lit) { d[i] *= 0.62; d[i + 1] *= 0.62; d[i + 2] *= 0.66; } }
      else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) { d[i] = 16; d[i + 1] = 12; d[i + 2] = 22; d[i + 3] = outline || 210; } }
    g.putImageData(im, 0, 0); return c;
  }
  function icon(id, size) { var c = cv(24, 24), g = c.getContext('2d'); if (!ICONS[id]) throw new Error('no icon ' + id); ICONS[id](g); var m = mint(c); return size ? up(m, size) : m; }

  /* ---------------- heraldic territory patterns (P046): shape-coded so factions differ in grayscale. 12x12 tiles. */
  var PATTERNS = { // v0.6: each a deliberate motif on a 12 px repeat, distinct by shape (greyscale-safe), drawn in one ink
    meander: function (g, c) { rect(g, 0, 1, 10, 1, c); rect(g, 9, 1, 1, 8, c); rect(g, 3, 8, 7, 1, c); rect(g, 3, 4, 1, 5, c); rect(g, 3, 4, 4, 1, c); rect(g, 6, 4, 1, 2, c); rect(g, 0, 11, 12, 1, c); },                 // Greek key
    chevron: function (g, c) { for (var i = 0; i < 6; i++) { px(g, i, 3 + i, c); px(g, 11 - i, 3 + i, c); px(g, i, 6 + i > 11 ? 11 : 6 + i, c); px(g, 11 - i, 6 + i > 11 ? 11 : 6 + i, c); } px(g, 5, 0, c, 2, 2); },  // interlaced double chevron
    hbar: function (g, c) { rect(g, 0, 2, 12, 2, c); rect(g, 0, 9, 12, 1, c); for (var i = 0; i < 3; i++) { poly(g, [1 + i * 4, 8, 3 + i * 4, 5, 5 + i * 4, 8], c); } },                                             // band over a row of buds
    grid: function (g, c) { rect(g, 0, 0, 12, 1, c); rect(g, 0, 6, 12, 1, c); rect(g, 0, 0, 1, 6, c); rect(g, 6, 6, 1, 6, c); },                                                                                        // brick bond
    dots: function (g, c) { disc(g, 3, 3, 1.2, c); disc(g, 6, 2, 1.2, c); disc(g, 4.5, 5.5, 1.2, c); disc(g, 9, 9, 1.2, c); },                                                                                         // dot triads
    zigzag: function (g, c) { rect(g, 0, 9, 3, 1, c); rect(g, 3, 6, 1, 4, c); rect(g, 3, 6, 3, 1, c); rect(g, 6, 3, 1, 4, c); rect(g, 6, 3, 3, 1, c); rect(g, 9, 3, 1, 7, c); rect(g, 9, 9, 3, 1, c); },          // stepped fret
    cross: function (g, c) { rect(g, 5, 1, 2, 10, c); rect(g, 1, 5, 10, 2, c); rect(g, 0, 0, 2, 2, c); rect(g, 10, 10, 2, 2, c); },                                                                                  // cross lattice
    wave: function (g, c) { for (var x = 0; x < 12; x++) { px(g, x, 3 + Math.round(Math.sin(x / 12 * Math.PI * 2) * 1.6), c); px(g, x, 8 + Math.round(Math.sin(x / 12 * Math.PI * 2 + Math.PI) * 1.6), c); } },  // double wave
    vbar: function (g, c) { rect(g, 2, 0, 1, 12, c); rect(g, 8, 0, 1, 12, c); rect(g, 2, 5, 7, 1, c); },                                                                                                                 // lattice screen
    ring: function (g, c) { ring(g, 6, 6, 3.5, c); px(g, 6, 6, c); }                                                                                                                                                     // ringed dot
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
  /* Event scenes v0.5: every illustration is composed in depth. The setting follows the subject (coast, river plain, lake, terraces,
     mountains, forest, town, open plain): sky with the age's sun or moon and cloud bands, a far range in atmospheric haze, a mid-ground
     with the land's own features and a settlement, the subject, then a foreground band with framing plants and stones. Dawn adds low mist
     and a warm rim, Zenith a high clear light, Twilight a violet sky, lit windows and long shadows. */
  var SETTING = { wave: 'coast', canal: 'river', chinampa: 'lake', paddy: 'terraces', forge: 'town', meadow: 'meadow', assembly: 'meadow', sheaf: 'plain', coins: 'town', road: 'plain', drop: 'town', chisel: 'mountain', altar: 'mountain', comet: 'plain', eclipse: 'plain', mask: 'forest', lyre: 'forest', sun: 'plain', cloudbank: 'plain' };
  var AGE_SUN = { dawn: [0.22, 0.62, '#ffd8a0'], zenith: [0.7, 0.16, '#fff6d8'], twilight: [0.82, 0.5, '#ff9a70'] };
  function sceneBack(g, W, H, art, sk, age, r, seed) {
    var set = SETTING[art] || 'plain', y, x, i, h, night = ['comet', 'eclipse', 'mask', 'forge', 'altar'].indexOf(art) >= 0;
    var top = mix(sk[0], AGE_TINT[age][0], 0.35), hor = mix(sk[1], AGE_TINT[age][1], 0.35);
    for (y = 0; y < H; y++) { g.fillStyle = mix(top, hor, Math.min(1, y / (H * 0.62))); g.fillRect(0, y, W, 1); }
    if (night) for (i = 0; i < 60; i++) px(g, r() * W, r() * H * 0.5, r() > 0.75 ? '#ffffff' : '#9aa6c8');
    var su = AGE_SUN[age]; if (!night && art !== 'sun') { var sx = su[0] * W, sy = su[1] * H; for (i = 6; i > 0; i--) disc(g, sx, sy, 3 + i * 2.2, rgba(su[2], 0.07)); disc(g, sx, sy, 4, su[2]); }
    if (night && art !== 'eclipse') { disc(g, 130, 16, 5, '#e8e4d0'); disc(g, 132, 15, 4.4, mix(top, hor, 0.2)); }
    for (i = 0; i < 4; i++) { var cy = 10 + i * 9 + r() * 4, cx0 = r() * W; g.fillStyle = rgba(night ? '#3a3a5a' : '#ffffff', night ? 0.35 : 0.22 + (age === 'dawn' ? 0.1 : 0)); g.fillRect(cx0, cy, 26 + r() * 30, 2); g.fillRect(cx0 + 6, cy - 1, 14 + r() * 10, 1); }
    // far range: snowy peaks in haze
    var far = mix(hor, '#5a6a8a', 0.45);
    for (x = 0; x < W; x++) { h = 50 - Math.abs(Math.sin(x * 0.045 + seed * 0.7)) * (set === 'mountain' ? 26 : 14) - Math.sin(x * 0.13) * 3; g.fillStyle = far; g.fillRect(x, h, 1, H - h); if (set === 'mountain' && h < 34) { g.fillStyle = mix('#ffffff', far, 0.35); g.fillRect(x, h, 1, 2); } }
    // mid-ground by setting
    var mid = { coast: '#4a6a5a', river: '#6a8a4a', lake: '#5a8a5a', terraces: '#5f8a48', town: '#5a5a4a', meadow: '#6a9a4a', plain: '#7a8a4a', mountain: '#5a5a58', forest: '#3a5a34' }[set];
    if (age === 'twilight') mid = mix(mid, '#3a2a4a', 0.45); else if (age === 'dawn') mid = mix(mid, '#c88a6a', 0.12);
    for (x = 0; x < W; x++) { h = 62 + Math.sin(x * 0.05 + seed) * 4 + Math.sin(x * 0.17 + 1) * 1.5; g.fillStyle = mid; g.fillRect(x, h, 1, H - h); g.fillStyle = shade(mid, 0.12); g.fillRect(x, h, 1, 1); }
    if (set === 'forest') for (i = 0; i < 22; i++) { x = r() * W; h = 58 + r() * 6; poly(g, [x - 4, h + 6, x, h - 6 - r() * 4, x + 4, h + 6], shade(mid, -0.2 + r() * 0.1)); }
    if (set === 'terraces') for (i = 0; i < 5; i++) { g.fillStyle = rgba('#9fd0e0', 0.5); g.fillRect(0, 66 + i * 4, W, 1); }
    if (set === 'coast' || set === 'lake') { for (y = 70; y < H; y++) { g.fillStyle = mix('#3a7a9a', '#1f4a6a', (y - 70) / 20); g.fillRect(0, y, W, 1); } for (i = 0; i < 18; i++) { g.fillStyle = 'rgba(220,240,255,0.5)'; g.fillRect(r() * W, 71 + r() * 18, 4, 1); } }
    if (set === 'river') { poly(g, [0, 74, W, 70, W, 76, 0, 80], '#4a8aa0'); g.fillStyle = 'rgba(220,240,255,0.5)'; for (i = 0; i < 10; i++) g.fillRect(r() * W, 74 + r() * 3, 3, 1); }
    // a settlement on the mid-ground ridge: houses with lit windows at Twilight
    if (set !== 'coast' && set !== 'mountain' && art !== 'wave') { var tx = 10 + r() * 30; for (i = 0; i < 4; i++) { var hx = tx + i * 7, hy = 62 + Math.sin(hx * 0.05 + seed) * 4; rect(g, hx, hy - 4, 5, 4, shade(mid, -0.35)); poly(g, [hx - 1, hy - 4, hx + 2.5, hy - 7, hx + 6, hy - 4], shade(mid, -0.45)); if (age === 'twilight' || night) px(g, hx + 2, hy - 2, '#ffd27a'); } }
    if (age === 'dawn') { g.fillStyle = 'rgba(255,230,210,0.16)'; g.fillRect(0, 56, W, 12); }
  }
  /* small figures and animals for event scenes, drawn on the ground line (x, y = feet), lit from the upper left */
  function fig(g, x, y, c, pose, s) {
    s = s || 1; var h = 9 * s, sk = '#d8b088';
    if (pose === 'sit') { rect(g, x - 2 * s, y - 4 * s, 5 * s, 4 * s, c); rect(g, x - 1.5 * s, y - 7 * s, 3 * s, 3 * s, shade(c, 0.1)); disc(g, x, y - 8.5 * s, 1.6 * s, sk); return; }
    if (pose === 'bend') { poly(g, [x - 3 * s, y - 5 * s, x + 3 * s, y - 7 * s, x + 4 * s, y - 4 * s, x - 2 * s, y - 2 * s], c); disc(g, x + 4.5 * s, y - 6.5 * s, 1.5 * s, sk); line(g, x - 1, y - 2 * s, x - 1, y, '#3a2a1a'); line(g, x + 2, y - 3 * s, x + 2, y, '#3a2a1a'); line(g, x + 4 * s, y - 4 * s, x + 5 * s, y, sk); return; }
    var st = pose === 'walk' ? 1.5 * s : 0.6 * s; line(g, x - st, y, x - 0.5, y - 3 * s, '#3a2a1a'); line(g, x + st, y, x + 0.5, y - 3 * s, '#3a2a1a');
    poly(g, [x - 2 * s, y - 3 * s, x + 2 * s, y - 3 * s, x + 1.5 * s, y - h + 2 * s, x - 1.5 * s, y - h + 2 * s], c); rect(g, x + 0.5 * s, y - h + 2 * s, 1.2 * s, h - 5 * s, shade(c, -0.25));
    if (pose !== 'back') disc(g, x, y - h + 0.5 * s, 1.6 * s, sk); else disc(g, x, y - h + 0.5 * s, 1.6 * s, '#2a1c14');
    if (pose === 'arms') { line(g, x - 2 * s, y - h + 3 * s, x - 4 * s, y - h - 1 * s, sk); line(g, x + 2 * s, y - h + 3 * s, x + 4 * s, y - h - 1 * s, sk); }
    if (pose === 'point') line(g, x + 2 * s, y - h + 3 * s, x + 5 * s, y - h - 2 * s, sk);
    if (pose === 'work') { line(g, x + 2 * s, y - h + 3 * s, x + 5 * s, y - h + 1 * s, sk); }
  }
  function ox(g, x, y) { rect(g, x - 6, y - 6, 12, 5, '#7a5a3a'); rect(g, x - 6, y - 6, 12, 1, '#9a7a52'); rect(g, x + 5, y - 7, 4, 4, '#6a4a2a'); line(g, x + 7, y - 7, x + 9, y - 9, '#e8e0c8'); for (var i = 0; i < 4; i++) line(g, x - 5 + i * 3.4, y - 1, x - 5 + i * 3.4, y + 1, '#4a3420'); }
  function sheep(g, x, y) { disc(g, x, y - 4, 3.6, '#d8d4c8'); disc(g, x - 2, y - 5, 2.4, '#e8e4d8'); disc(g, x + 4, y - 4, 1.6, '#3a3430'); line(g, x - 2, y - 1, x - 2, y + 1, '#3a3430'); line(g, x + 2, y - 1, x + 2, y + 1, '#3a3430'); }
  function horse(g, x, y, c) { rect(g, x - 6, y - 8, 12, 4, c); poly(g, [x + 5, y - 8, x + 9, y - 13, x + 11, y - 11, x + 7, y - 6], c); line(g, x - 5, y - 4, x - 7, y, c); line(g, x - 2, y - 4, x - 1, y, c); line(g, x + 3, y - 4, x + 5, y, c); line(g, x + 5, y - 4, x + 7, y - 1, c); line(g, x - 6, y - 7, x - 9, y - 5, shade(c, -0.3)); fig(g, x, y - 8, '#c84a2a', 'stand', 0.6); }
  function sheafB(g, x, y, i) { for (var k = -2; k <= 2; k++) line(g, x, y, x + k * 1.2, y - 9, '#c9a23a'); disc(g, x, y - 9, 2, i % 2 ? '#f1d27a' : '#e0c050'); rect(g, x - 1.5, y - 5, 3, 1, '#7a5e3a'); }
  function sceneFront(g, W, H, art, age, r) {
    var set = SETTING[art] || 'plain', fg = set === 'coast' || set === 'lake' ? '#6a5a3a' : set === 'mountain' ? '#4a4640' : '#3a5a2a', i, x;
    if (age === 'twilight') fg = mix(fg, '#1a1028', 0.45);
    // framing foreground: dark stones and plants at the corners, grass along the bottom edge
    poly(g, [0, H, 0, H - 14, 8, H - 18, 18, H - 12, 26, H - 6, 30, H], shade(fg, -0.2)); poly(g, [W, H, W, H - 12, W - 10, H - 16, W - 22, H - 8, W - 28, H], shade(fg, -0.25));
    for (i = 0; i < 40; i++) { x = r() * W; g.fillStyle = r() > 0.5 ? shade(fg, 0.1) : shade(fg, -0.3); g.fillRect(x, H - 2 - r() * 4, 1, 3 + r() * 3); }
    for (i = 0; i < 3; i++) { x = 4 + i * 8; line(g, x, H - 12, x + 2, H - 26 - i * 3, shade(fg, 0.15)); line(g, x + 2, H - 22 - i * 3, x + 6, H - 24 - i * 3, shade(fg, 0.25)); }
    if (age === 'twilight') { g.fillStyle = 'rgba(40,10,50,0.18)'; g.fillRect(0, 0, W, H); }
    if (age === 'zenith') { g.fillStyle = 'rgba(255,250,230,0.05)'; g.fillRect(0, 0, W, 40); }
  }
  var AGE_TINT = { dawn: ['#3a4a7a', '#f0b880'], zenith: ['#4a7ab8', '#e8e0b0'], twilight: ['#2a1a3a', '#c86a4a'] };
  function eventArt(art, seed, age) {
    var W = 160, H = 90, c = cv(W, H), g = c.getContext('2d'), r = rng(seed || 7), i, x, y, h, t;
    var skies = { comet: ['#0b1030', '#2b2f6a'], eclipse: ['#120c18', '#4a2a1a'], wave: ['#16222e', '#3d5566'], drop: ['#2a2a22', '#6b6a4a'], sun: ['#e9a24a', '#f6dc8a'], mask: ['#2a1e3a', '#7a4a5a'], altar: ['#1e2a3a', '#8a6a4a'],
      canal: ['#7a9ab8', '#e8d8a8'], assembly: ['#5a7a8a', '#d8e0c8'], chinampa: ['#5ab0d0', '#f0e8c0'], meadow: ['#8a9a8a', '#d8d0a8'], forge: ['#3a2a3a', '#c86a3a'], paddy: ['#c8a0a0', '#f8e8d8'], cloudbank: ['#4a4a5a', '#c8a878'] };
    var sk = skies[art] || AGE_TINT[age || 'zenith'];
    sceneBack(g, W, H, art, sk, age || 'zenith', r, seed || 0);
    var cx = 80, cy = 40, nt = age === 'twilight';
    // v0.6 subjects: each scene shows what its event is about, drawn on the scene's ground line with the same light (upper left)
    switch (art) {
      case 'sheaf': // the harvest heaped before the altar in the largest town, people singing round it, bunting between poles
        line(g, 34, 44, 126, 44, '#6a4a2a'); for (i = 0; i < 12; i++) poly(g, [38 + i * 7.5, 44, 42 + i * 7.5, 44, 40 + i * 7.5, 49], ['#d84a28', '#e0b33a', '#2f6fb3'][i % 3]); rect(g, 33, 40, 2, 34, '#5a3a20'); rect(g, 126, 40, 2, 34, '#5a3a20');
        rect(g, 66, 66, 28, 8, '#9a9080'); rect(g, 66, 66, 28, 2, '#c8c0aa'); for (i = 0; i < 7; i++) sheafB(g, 68 + i * 3.6, 66 - (i % 2) * 3, i);
        for (i = 0; i < 9; i++) fig(g, 22 + i * (i < 4 ? 9 : 10) + (i >= 4 ? 44 : 0), 80, ['#8a3a2a', '#2f6f8a', '#6a7a3a', '#7a5a8a'][i % 4], i % 2 ? 'arms' : 'stand'); break;
      case 'comet': // a pale comet over the hills; villagers on the ridge point up
        for (i = 0; i < 70; i++) px(g, 118 - i * 1.4, 16 + i * 0.55, 'rgba(210,225,255,' + (0.9 - i / 80).toFixed(2) + ')', 2, i < 20 ? 2 : 1); for (i = 0; i < 40; i++) px(g, 118 - i * 1.6, 13 + i * 0.4, 'rgba(255,240,200,' + (0.6 - i / 70).toFixed(2) + ')');
        disc(g, 119, 16, 3.5, '#ffffff'); disc(g, 119, 16, 6, 'rgba(220,235,255,0.35)');
        for (i = 0; i < 6; i++) fig(g, 34 + i * 12, 76 - (i % 2), '#1a1a26', 'point'); break;
      case 'road': // a crossroads with a signpost; pilgrims with staffs and bundles take the roads
        poly(g, [72, 60, 88, 60, 130, 90, 30, 90], '#c8b080'); poly(g, [0, 72, 160, 66, 160, 74, 0, 82], '#bea676'); for (i = 0; i < 30; i++) px(g, 40 + r() * 80, 70 + r() * 18, '#a89060');
        rect(g, 108, 52, 2, 22, '#5a3a20'); poly(g, [110, 54, 124, 54, 127, 56, 124, 58, 110, 58], '#8a6a42'); poly(g, [108, 60, 94, 60, 91, 62, 94, 64, 108, 64], '#8a6a42'); poly(g, [110, 66, 121, 66, 124, 68, 121, 70, 110, 70], '#7a5a38');
        for (i = 0; i < 4; i++) { fig(g, 52 + i * 11, 84 - i * 3, ['#7a6248', '#6a5a4a', '#8a7458', '#5a4a3a'][i], 'walk'); line(g, 56 + i * 11, 85 - i * 3, 57 + i * 11, 72 - i * 3, '#5a3a20'); disc(g, 50 + i * 11, 77 - i * 3, 1.8, '#a88a5a'); } break;
      case 'sun': // the dry season: a fierce sun, a sunken well with its bucket, the river reduced to stones
        disc(g, cx, 22, 12, '#fff1b0'); disc(g, cx, 22, 8, '#ffffff'); for (i = 0; i < 16; i++) { t = i * Math.PI / 8; line(g, cx + Math.cos(t) * 15, 22 + Math.sin(t) * 15, cx + Math.cos(t) * 21, 22 + Math.sin(t) * 21, '#ffd36a'); }
        poly(g, [0, 78, 160, 72, 160, 80, 0, 86], '#b89a68'); for (i = 0; i < 18; i++) { disc(g, 10 + i * 8.5 + r() * 3, 79 - i * 0.35 + r() * 2, 1.6 + r(), i % 2 ? '#8a8070' : '#a89c8a'); }
        rect(g, 112, 64, 14, 10, '#8a8070'); rect(g, 112, 64, 14, 2, '#a8a294'); rect(g, 113, 52, 2, 12, '#5a3a20'); rect(g, 123, 52, 2, 12, '#5a3a20'); rect(g, 112, 51, 14, 2, '#6a4a2a'); line(g, 119, 53, 119, 60, '#3a2a1a'); rect(g, 117, 60, 4, 3, '#7a5a38');
        fig(g, 104, 74, '#8a5a3a', 'stand'); fig(g, 134, 74, '#5a6a7a', 'arms'); for (i = 0; i < 4; i++) { line(g, 20 + i * 12, 70, 18 + i * 12, 64, '#8a7a4a'); line(g, 18 + i * 12, 64, 15 + i * 12, 66, '#8a7a4a'); } break;
      case 'mask': // a rival prophet: a speaker on a crate in the market, arms raised, the crowd turned toward him
        for (i = 0; i < 3; i++) { rect(g, 14 + i * 50, 56, 30, 12, '#5a4a3a'); poly(g, [12 + i * 50, 56, 29 + i * 50, 48, 46 + i * 50, 56], ['#8a3a2a', '#2f6f6a', '#8a6a2a'][i]); }
        rect(g, 74, 68, 14, 7, '#8a6a42'); rect(g, 74, 68, 14, 1, '#a88a5a'); fig(g, 81, 68, '#e8e0c8', 'arms', 1.3);
        for (i = 0; i < 12; i++) fig(g, 24 + i * 10 + (i > 5 ? 8 : 0), 84 + (i % 3), ['#3a2a2a', '#2a3a3a', '#3a3a2a'][i % 3], 'back'); break;
      case 'chisel': // the sculptor: a mason before a half-carved block, mallet raised; chips fly
        poly(g, [56, 80, 104, 80, 102, 40, 58, 38], '#c8c0b0'); poly(g, [58, 38, 102, 40, 98, 33, 62, 32], '#e0d8c8'); poly(g, [102, 40, 108, 36, 108, 76, 104, 80], '#9a9282');
        for (i = 0; i < 3; i++) { rect(g, 64, 50 + i * 9, 32, 1, '#9a9080'); for (var kk = 0; kk < 5; kk++) rect(g, 66 + kk * 6, 52 + i * 9, 3, 5, '#b0a898'); } // a relief band, lower courses finished, the top still rough
        for (i = 0; i < 8; i++) poly(g, [60 + i * 5, 38, 62 + i * 5, 34 - (i % 3), 64 + i * 5, 38], '#d8d0c0');
        fig(g, 118, 82, '#6a4a3a', 'work', 1.3); line(g, 112, 62, 106, 58, '#5a3a20', 2); rect(g, 103, 56, 4, 4, '#7a6a5a'); for (i = 0; i < 8; i++) px(g, 104 - r() * 10, 54 + r() * 10, '#ffffff'); break;
      case 'drop': // fever in the lowlands: low houses in the mist, lamps lit in doorways, a family waiting
        for (i = 0; i < 6; i++) { var hx = 12 + i * 24, hy = 74; rect(g, hx, hy - 10, 16, 10, '#5a4a3a'); poly(g, [hx - 2, hy - 10, hx + 8, hy - 17, hx + 18, hy - 10], '#3a2e24'); rect(g, hx + 6, hy - 6, 4, 6, '#ffcf6a'); disc(g, hx + 8, hy - 3, 5, 'rgba(255,200,100,0.18)'); }
        g.fillStyle = 'rgba(220,226,230,0.35)'; for (i = 0; i < 5; i++) g.fillRect(0, 62 + i * 4, 160, 2); fig(g, 64, 84, '#4a3a4a', 'stand'); fig(g, 70, 84, '#5a4a3a', 'stand'); fig(g, 75, 84, '#6a5a4a', 'stand', 0.7); break;
      case 'wave': // storm on the water: boats tossed under a black sky, women on the headland
        for (y = 52; y < H; y += 3) for (x = 0; x < W; x += 2) px(g, x, y + Math.sin(x * 0.11 + y * 0.7) * 2.5, y % 2 ? '#2f6f8a' : '#245a72', 2, 1); for (i = 0; i < 14; i++) line(g, r() * 160, 54 + r() * 30, r() * 160 + 6, 54 + r() * 30, '#d8eef8');
        [[56, 66, -0.3], [92, 72, 0.25]].forEach(function (b) { g.save(); g.translate(b[0], b[1]); g.rotate(b[2]); poly(g, [-10, 0, 10, 0, 7, 4, -7, 4], '#4a2e1a'); line(g, 0, 0, 0, -14, '#3a2a1a'); poly(g, [0, -14, 9, -3, 0, -3], '#e0d8c8'); g.restore(); });
        poly(g, [120, 90, 128, 58, 140, 52, 160, 54, 160, 90], '#3a4a3a'); for (i = 0; i < 3; i++) fig(g, 138 + i * 6, 54, '#1a1a22', 'arms', 0.9);
        for (i = 0; i < 10; i++) line(g, 10 + i * 16, 2, 4 + i * 16, 26, 'rgba(200,220,255,0.45)'); line(g, 100, 4, 94, 18, '#fff6c8'); line(g, 94, 18, 98, 22, '#fff6c8'); line(g, 98, 22, 92, 38, '#fff6c8'); break;
      case 'lyre': // the wandering poet on a stone under a tree, a stringed instrument in his lap; listeners
        rect(g, 116, 40, 4, 34, '#4a3420'); disc(g, 118, 34, 16, '#3a5a30'); disc(g, 112, 30, 8, '#4a6a3a'); poly(g, [64, 80, 86, 80, 84, 72, 66, 70], '#8a8478');
        fig(g, 75, 72, '#7a4a8a', 'sit', 1.2); line(g, 79, 66, 82, 58, '#c9a24a', 1.5); line(g, 85, 66, 86, 58, '#c9a24a', 1.5); line(g, 81, 58, 87, 58, '#c9a24a'); for (i = 0; i < 3; i++) line(g, 81 + i * 2, 58, 81 + i * 2, 66, '#f4efe0');
        for (i = 0; i < 4; i++) fig(g, 34 + i * 9, 82, ['#5a4a3a', '#3a4a5a', '#6a3a3a', '#4a5a3a'][i], 'sit'); break;
      case 'eclipse': // an eclipse foretold: the sun swallowed, its corona burning; watchers on a stepped platform with a sighting staff
        disc(g, cx, 30, 18, 'rgba(255,207,106,0.35)'); disc(g, cx, 30, 14, '#ffcf6a'); disc(g, cx, 30, 12.5, '#fff1b0'); disc(g, cx + 2, 30, 12.5, '#0a0810'); for (i = 0; i < 20; i++) { t = i * Math.PI / 10; line(g, cx + Math.cos(t) * 15, 30 + Math.sin(t) * 15, cx + Math.cos(t) * (18 + (i % 3) * 2), 30 + Math.sin(t) * (18 + (i % 3) * 2), 'rgba(255,200,120,0.6)'); }
        rect(g, 98, 70, 36, 10, '#5a5048'); rect(g, 104, 62, 24, 8, '#6a6058'); rect(g, 110, 56, 12, 6, '#7a7068'); line(g, 118, 56, 112, 40, '#c8a050'); fig(g, 114, 56, '#2a2030', 'point'); fig(g, 106, 62, '#2a2030', 'stand'); break;
      case 'coins': // a market town swells: stalls under awnings where the roads meet, a cart and new arrivals
        for (i = 0; i < 5; i++) { var sx = 14 + i * 28; rect(g, sx, 64, 20, 10, '#6a5040'); poly(g, [sx - 3, 64, sx + 10, 57, sx + 23, 64], ['#c84a2a', '#2f8a6a', '#d8a83a', '#3a6ab0', '#8a4a8a'][i]); for (var q2 = 0; q2 < 3; q2++) disc(g, sx + 4 + q2 * 6, 63, 2, ['#e0b33a', '#7cc25a', '#d86a3a'][q2]); }
        rect(g, 112, 78, 18, 6, '#7a5a38'); disc(g, 115, 84, 3, '#3a2a1a'); disc(g, 127, 84, 3, '#3a2a1a'); fig(g, 106, 84, '#5a4a3a', 'walk'); for (i = 0; i < 5; i++) fig(g, 30 + i * 13, 84 + (i % 2), ['#7a3a2a', '#2a4a6a', '#5a6a2a'][i % 3], i % 2 ? 'walk' : 'stand'); break;
      case 'altar': // the buried altar: a ploughed hillside, oxen and plough stopped, a carved stone half out of the furrow
        for (i = 0; i < 9; i++) line(g, 0, 70 + i * 2.4, 160, 64 + i * 2.6, 'rgba(70,50,30,0.5)');
        poly(g, [70, 80, 96, 80, 94, 62, 72, 60], '#8a8478'); poly(g, [72, 60, 94, 62, 92, 58, 74, 57], '#a8a294'); for (i = 0; i < 3; i++) rect(g, 75, 64 + i * 5, 16, 1, '#5a5650'); for (i = 0; i < 4; i++) rect(g, 76 + i * 4, 65, 2, 3, '#6a6660');
        ox(g, 26, 78); ox(g, 40, 80); line(g, 50, 76, 60, 72, '#5a3a20', 1.5); line(g, 60, 72, 64, 80, '#5a3a20', 1.5); fig(g, 112, 80, '#6a4a3a', 'point'); fig(g, 122, 80, '#4a3a2a', 'stand'); break;
      case 'canal': // silt in the canals: a choked channel, workers lifting mud in baskets, dry fields beyond
        for (y = 66; y < 76; y++) rect(g, 0, y, W, 1, mix('#4a7a80', '#3a5a50', (y - 66) / 10)); for (i = 0; i < 6; i++) { var mx = 10 + i * 26 + r() * 6; poly(g, [mx, 72, mx + 12, 66, mx + 20, 72], '#6a5034'); }
        rect(g, 0, 64, W, 2, '#8a6a42'); rect(g, 0, 76, W, 2, '#8a6a42'); for (i = 0; i < 5; i++) { fig(g, 18 + i * 30, 66, '#5a4030', 'work'); disc(g, 24 + i * 30, 57, 2.6, '#7a5a38'); }
        for (i = 0; i < 12; i++) line(g, 6 + i * 13, 88, 8 + i * 13, 82, '#a89a5a'); break;
      case 'assembly': // the assembly on the hill: a ring of people on the earthwork, horses racing along the foot, a poet on the mound
        g.fillStyle = '#5f8a42'; g.beginPath(); g.ellipse(80, 66, 54, 12, 0, 0, 7); g.fill(); g.fillStyle = '#4a6a34'; g.beginPath(); g.ellipse(80, 66, 44, 8, 0, 0, 7); g.fill(); g.fillStyle = '#6f9a4a'; g.beginPath(); g.ellipse(80, 64, 18, 5, 0, 0, 7); g.fill();
        for (i = 0; i < 16; i++) { t = Math.PI + i / 15 * Math.PI; fig(g, 80 + Math.cos(t) * 46, 66 + Math.sin(t) * 10, ['#2e7d4f', '#8a3a2a', '#c9a04a', '#3a4a7a'][i % 4], 'stand', 0.8); } fig(g, 80, 62, '#e8e0c8', 'arms');
        for (i = 0; i < 3; i++) horse(g, 30 + i * 22 + (i % 2) * 6, 84, ['#5a3a20', '#3a2a1a', '#8a6a42'][i]); break;
      case 'chinampa': // new fields on the lake: reed fences staked in the shallows, a canoe heaping lake mud, planted rows
        for (y = 58; y < H; y++) rect(g, 0, y, W, 1, mix('#3a9ab0', '#1f6a80', (y - 58) / 32)); for (i = 0; i < 4; i++) { var bx = 10 + i * 36; poly(g, [bx, 66, bx + 26, 66, bx + 24, 72, bx + 2, 72], i < 3 ? '#6a5034' : '#4a3a2a'); for (var k2 = 0; k2 <= 8; k2++) line(g, bx + k2 * 3.2, 72, bx + k2 * 3.2, 63, '#9a9a5a'); if (i < 3) for (k2 = 0; k2 < 6; k2++) { line(g, bx + 3 + k2 * 4, 66, bx + 3 + k2 * 4, 61 - (k2 % 2), '#7cc25a'); px(g, bx + 3 + k2 * 4, 60 - (k2 % 2), '#b8e870'); } }
        poly(g, [60, 80, 92, 80, 88, 84, 64, 84], '#5a3a20'); fig(g, 70, 80, '#6a4030', 'work'); fig(g, 82, 80, '#4a5a3a', 'stand'); rect(g, 86, 76, 2, 4, '#3a2a1a'); break;
      case 'meadow': // the meadows fall silent: grey grain that will not ripen, still sheep, the elders in a row, a bare tree
        for (i = 0; i < 34; i++) line(g, 4 + i * 4.6, 82, 4 + i * 4.6 + (r() - 0.5) * 3, 70 + r() * 4, '#8a8a6a'); for (i = 0; i < 4; i++) sheep(g, 24 + i * 22, 78 - (i % 2) * 2);
        line(g, 128, 76, 128, 48, '#5a4a3a', 2); line(g, 128, 56, 118, 48, '#5a4a3a'); line(g, 128, 52, 138, 44, '#5a4a3a'); for (i = 0; i < 3; i++) fig(g, 112 + i * 9, 84, '#4a4a4a', 'stand'); break;
      case 'forge': // smiths open a road: a forge glowing, an anvil and sparks, a fresh road cut through the bush with stumps
        rect(g, 20, 54, 38, 22, '#5a3a2a'); poly(g, [16, 56, 39, 40, 62, 56], '#3a2a1a'); disc(g, 39, 66, 6, '#ff8a3a'); disc(g, 39, 66, 3, '#ffe070'); rect(g, 64, 74, 10, 4, '#4a4a52'); rect(g, 66, 70, 6, 4, '#5a5a62'); for (i = 0; i < 16; i++) px(g, 68 + (r() - 0.5) * 16, 66 - r() * 14, '#ffd060');
        fig(g, 78, 82, '#3a2a2a', 'work'); poly(g, [100, 90, 112, 62, 124, 62, 160, 90], '#a88a5a'); for (i = 0; i < 6; i++) { var sxs = 96 + i * 10; rect(g, sxs, 78 - i * 2, 3, 2, '#6a4a2a'); disc(g, 100 + i * 9, 56 - (i % 2) * 3, 4, '#3a5a2a'); } fig(g, 120, 72, '#6a5a4a', 'walk', 0.8); break;
      case 'paddy': // planting the paddies: flooded terraces, villagers bent in a row, seedlings set in lines
        for (y = 0; y < 4; y++) { var ty = 60 + y * 8; rect(g, 0, ty, W, 6, mix('#8ab8c8', '#6a9ab0', y / 4)); rect(g, 0, ty + 6, W, 2, '#6a5a3a'); for (x = 4; x < W; x += 6) if ((x + y * 3) % 12 < 8) line(g, x, ty + 4, x, ty + 1, '#7cb85a'); }
        for (i = 0; i < 6; i++) fig(g, 26 + i * 20, 76 + (i % 2) * 8, ['#e5532d', '#3a4a7a', '#d8c8a0'][i % 3], 'bend'); break;
      case 'cloudbank': // the rains are late: clouds piled over the hills that do not break, cattle in a dry riverbed, a herder
        for (i = 0; i < 7; i++) disc(g, 14 + i * 24, 26 + (i % 2) * 6, 15 + (i % 3) * 3, i % 2 ? '#5a6270' : '#6a7282'); rect(g, 0, 32, W, 8, '#4a5260');
        poly(g, [0, 82, 160, 76, 160, 84, 0, 90], '#a89070'); for (i = 0; i < 10; i++) disc(g, 8 + i * 16, 82 - i * 0.4, 1.4, '#8a8070'); for (i = 0; i < 4; i++) ox(g, 30 + i * 22, 78); fig(g, 128, 80, '#5a4030', 'stand'); line(g, 132, 80, 133, 68, '#5a3a20'); break;
      default: throw new Error('no event art ' + art);
    }
    sceneFront(g, W, H, art, age || 'zenith', r);
    return c;
  }

  var ids = { emblems: Object.keys(EMBLEMS), icons: Object.keys(ICONS), patterns: Object.keys(PATTERNS), priests: [], landmarks: [],
    shrines: [], atmospheres: Object.keys(ATMOS), events: ['sheaf', 'comet', 'road', 'sun', 'mask', 'chisel', 'drop', 'wave', 'lyre', 'eclipse', 'coins', 'altar', 'canal', 'assembly', 'chinampa', 'meadow', 'forge', 'paddy', 'cloudbank'], conditions: CONDITIONS, roles: ['emissary', 'seer', 'warden'] };
  root.PWArt = { cv: cv, rng: rng, hex2rgb: hex2rgb, rgb: rgb, rgba: rgba, shade: shade, mix: mix, gray: gray, px: px, disc: disc, ring: ring, line: line, poly: poly, rect: rect, up: up, star: star, arc: arc,
    emblem: emblem, icon: icon, eventArt: eventArt, pattern: pattern, ATMOS: ATMOS, ids: ids };
})(typeof self !== 'undefined' ? self : this);
