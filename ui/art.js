/* Pantheon Wars — procedural pixel art. Everything is drawn in code at low resolution and upscaled with
 * nearest-neighbour filtering. No external images. Symbolic emblems only — no portraits of gods. */
(function (root) {
  'use strict';
  function cv(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hex2rgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgb(a) { return 'rgb(' + (a[0] | 0) + ',' + (a[1] | 0) + ',' + (a[2] | 0) + ')'; }
  function rgba(h, a) { var c = hex2rgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function shade(h, f) { var c = hex2rgb(h); return rgb(f >= 0 ? c.map(function (v) { return v + (255 - v) * f; }) : c.map(function (v) { return v * (1 + f); })); }
  function mix(a, b, t) { var A = hex2rgb(a), B = hex2rgb(b); return rgb([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]); }
  function px(g, x, y, c, w, h) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w || 1, h || 1); }
  function disc(g, cx, cy, r, c) { g.fillStyle = c; for (var y = -Math.floor(r); y <= r; y++) { var w = Math.round(Math.sqrt(Math.max(0, r * r - y * y))); g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); } }
  function ring(g, cx, cy, r, c) { for (var a = 0; a < 360; a += 3) { var t = a * Math.PI / 180; px(g, cx + Math.cos(t) * r, cy + Math.sin(t) * r, c); } }
  function line(g, x0, y0, x1, y1, c, w) { var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0; for (var i = 0; i <= n; i++) { var t = n ? i / n : 0; px(g, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, c, w || 1, w || 1); } }
  function poly(g, pts, c) { g.fillStyle = c; g.beginPath(); g.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); }
  function up(c, size) { var o = cv(size, Math.round(size * c.height / c.width)), og = o.getContext('2d'); og.imageSmoothingEnabled = false; og.drawImage(c, 0, 0, o.width, o.height); return o; }

  /* ---------------- faction emblems (32x32 grid) */
  function emblem(id, pal, size) {
    var c = cv(32, 32), g = c.getContext('2d');
    disc(g, 16, 16, 15, pal.dark); disc(g, 16, 16, 13, mix(pal.dark, pal.secondary, 0.55)); ring(g, 16, 16, 14, pal.accent);
    if (id === 'thunderbolt_wreath') {
      for (var a = 0; a < 360; a += 24) { if (a > 240 && a < 300) continue; var t = a * Math.PI / 180, x = 16 + Math.cos(t) * 10, y = 16 + Math.sin(t) * 10; disc(g, x, y, 1.6, '#6f9a3c'); px(g, x - 1, y - 1, '#a8cf6a'); }
      poly(g, [18, 5, 11, 17, 15, 17, 12, 27, 21, 14, 17, 14, 20, 5], pal.accent); line(g, 18, 6, 13, 15, '#fff3c0');
    } else if (id === 'ash_tree') {
      [[16, 12, 9, 6], [16, 12, 23, 6], [16, 14, 7, 11], [16, 14, 25, 11], [16, 10, 16, 4]].forEach(function (b) { line(g, b[0], b[1], b[2], b[3], '#d8c8a8'); });
      g.fillStyle = '#d8c8a8'; g.fillRect(15, 10, 3, 13);
      [[9, 6], [23, 6], [7, 11], [25, 11], [16, 4], [12, 5], [20, 5]].forEach(function (p) { disc(g, p[0], p[1], 2.2, '#6d8f4e'); px(g, p[0] - 1, p[1] - 1, '#9fc27a'); });
      [[16, 23, 9, 27], [16, 23, 16, 28], [16, 23, 23, 27]].forEach(function (b) { line(g, b[0], b[1], b[2], b[3], pal.accent); });
      px(g, 22, 8, '#111', 2, 1); px(g, 21, 9, '#111');
    } else if (id === 'winged_sun') {
      for (var i = 0; i < 4; i++) { poly(g, [13, 15 + i, 3 + i * 0.5, 11 + i * 2.2, 4 + i, 13 + i * 2.2, 13, 17 + i], i % 2 ? pal.accent : pal.secondary); poly(g, [19, 15 + i, 29 - i * 0.5, 11 + i * 2.2, 28 - i, 13 + i * 2.2, 19, 17 + i], i % 2 ? pal.accent : pal.secondary); }
      disc(g, 16, 15, 4.5, pal.primary); disc(g, 15, 14, 2, '#fff7d0');
      line(g, 12, 21, 20, 21, pal.accent);
    }
    return size ? up(c, size) : c;
  }

  /* ---------------- power & action icons (24x24) */
  var ICONS = {
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
    omen: function (g) { poly(g, [2, 12, 8, 7, 16, 7, 22, 12, 16, 17, 8, 17], '#e9e2cf'); disc(g, 12, 12, 4, '#2f6fb3'); disc(g, 12, 12, 2, '#111'); px(g, 11, 10, '#fff'); px(g, 4, 3, '#ffd84a'); px(g, 19, 4, '#ffd84a'); px(g, 20, 20, '#ffd84a'); },
    dream: function (g) { disc(g, 11, 12, 8, '#d8d2f0'); g.globalCompositeOperation = 'destination-out'; disc(g, 15, 9, 7, '#000'); g.globalCompositeOperation = 'source-over'; px(g, 18, 15, '#fff'); px(g, 20, 5, '#fff'); px(g, 6, 3, '#9fd2ff'); px(g, 15, 20, '#9fd2ff'); },
    shrine: function (g) { poly(g, [3, 8, 12, 3, 21, 8], '#e9e2cf'); g.fillStyle = '#d0c8b0'; for (var i = 0; i < 4; i++) g.fillRect(5 + i * 4, 9, 2, 10); g.fillStyle = '#b8b098'; g.fillRect(3, 19, 18, 3); },
    priest: function (g) { disc(g, 12, 6, 3, '#e8c9a0'); poly(g, [8, 10, 16, 10, 18, 21, 6, 21], '#7a5ab8'); line(g, 18, 4, 18, 21, '#c9a24a'); disc(g, 18, 4, 1.5, '#ffe08a'); },
    eclipse: function (g) { disc(g, 12, 12, 9, '#ffcf4a'); disc(g, 12, 12, 7, '#fff1b0'); disc(g, 13, 11, 7, '#111522'); ring(g, 12, 12, 10, '#ff9a3a'); }
  };
  function icon(id, size) { var c = cv(24, 24), g = c.getContext('2d'); (ICONS[id] || ICONS.omen)(g); return size ? up(c, size) : c; }

  /* ---------------- event card illustration (96x54 scene) */
  function eventArt(art, seed) {
    var W = 96, H = 54, c = cv(W, H), g = c.getContext('2d'), r = rng(seed || 7), i, x, y, h, t;
    var skies = { comet: ['#0b1030', '#2b2f6a'], eclipse: ['#120c18', '#4a2a1a'], wave: ['#16222e', '#3d5566'], drop: ['#2a2a22', '#6b6a4a'], sun: ['#e9a24a', '#f6dc8a'], mask: ['#2a1e3a', '#7a4a5a'], altar: ['#1e2a3a', '#8a6a4a'] };
    var sk = skies[art] || ['#3a5a8a', '#e8c58a'];
    for (y = 0; y < H; y++) { g.fillStyle = mix(sk[0], sk[1], y / H); g.fillRect(0, y, W, 1); }
    if (art === 'comet' || art === 'eclipse' || art === 'mask' || art === 'altar') for (i = 0; i < 40; i++) px(g, r() * W, r() * H * 0.6, r() > 0.7 ? '#fff' : '#9aa6c8');
    g.fillStyle = 'rgba(30,40,60,0.55)'; for (x = 0; x < W; x++) { h = 36 + Math.sin(x * 0.09 + (seed || 0)) * 4 + Math.sin(x * 0.23) * 2; g.fillRect(x, h, 1, H - h); }
    g.fillStyle = 'rgba(20,28,30,0.85)'; for (x = 0; x < W; x++) { h = 43 + Math.sin(x * 0.05 + 1) * 3 + Math.sin(x * 0.31) * 1.5; g.fillRect(x, h, 1, H - h); }
    var cx = 48, cy = 24;
    switch (art) {
      case 'sheaf': for (i = -4; i <= 4; i++) { line(g, cx, cy + 14, cx + i * 3, cy - 8, '#c9a23a'); disc(g, cx + i * 3, cy - 8, 1.6, '#f1d27a'); } g.fillStyle = '#7a5e3a'; g.fillRect(cx - 5, cy + 6, 10, 2); break;
      case 'comet': disc(g, 70, 12, 2.5, '#fff'); for (i = 0; i < 30; i++) px(g, 68 - i * 1.6, 13 + i * 0.7, 'rgba(200,220,255,' + (1 - i / 30).toFixed(2) + ')', 2, 1); break;
      case 'road': line(g, 48, 30, 30, 54, '#b8a070', 3); line(g, 48, 30, 70, 54, '#b8a070', 3); for (i = 0; i < 3; i++) { var fx = 38 + i * 9; g.fillStyle = '#2a2018'; g.fillRect(fx, 40 - i, 2, 6); disc(g, fx + 1, 38 - i, 1.2, '#2a2018'); line(g, fx + 3, 35 - i, fx + 3, 46 - i, '#5a4a30'); } break;
      case 'sun': disc(g, cx, 20, 10, '#fff1b0'); disc(g, cx, 20, 7, '#ffffff'); for (i = 0; i < 12; i++) { t = i * Math.PI / 6; line(g, cx + Math.cos(t) * 12, 20 + Math.sin(t) * 12, cx + Math.cos(t) * 16, 20 + Math.sin(t) * 16, '#ffd36a'); } g.fillStyle = '#8a6a3a'; for (x = 20; x < 76; x += 7) g.fillRect(x, 47 + (x % 3), 4, 1); break;
      case 'mask': poly(g, [cx - 9, 12, cx + 9, 12, cx + 7, 30, cx, 36, cx - 7, 30], '#d8d0c0'); disc(g, cx - 4, 21, 2, '#111'); disc(g, cx + 4, 21, 2, '#111'); line(g, cx - 3, 29, cx + 3, 29, '#5a3a3a'); break;
      case 'chisel': poly(g, [30, 46, 60, 46, 58, 20, 34, 18], '#b8b0a0'); poly(g, [34, 18, 58, 20, 56, 16, 36, 15], '#d8d0c0'); line(g, 62, 10, 52, 26, '#6a4a2a', 2); line(g, 52, 26, 50, 30, '#c0c8d0', 2); for (i = 0; i < 6; i++) px(g, 46 + r() * 8, 28 + r() * 6, '#fff'); break;
      case 'drop': for (i = 0; i < 5; i++) { var hx = 22 + i * 13; poly(g, [hx, 44, hx + 8, 44, hx + 8, 38, hx + 4, 34, hx, 38], '#4a3a2a'); px(g, hx + 3, 40, '#ffcf6a', 2, 2); } disc(g, cx, 16, 5, '#7fb3d8'); poly(g, [cx - 5, 15, cx, 6, cx + 5, 15], '#7fb3d8'); break;
      case 'wave': for (y = 30; y < H; y += 3) for (x = 0; x < W; x++) px(g, x, y + Math.sin(x * 0.2 + y) * 1.5, y % 2 ? '#2f6f8a' : '#245a72'); poly(g, [40, 28, 56, 28, 52, 32, 44, 32], '#5a3a1a'); line(g, 48, 28, 48, 16, '#5a3a1a'); poly(g, [48, 16, 56, 24, 48, 24], '#d8d0c0'); for (i = 0; i < 6; i++) line(g, 10 + i * 15, 2, 6 + i * 15, 14, 'rgba(200,220,255,0.5)'); break;
      case 'lyre': line(g, cx - 7, 34, cx - 9, 10, '#c9a24a', 2); line(g, cx + 7, 34, cx + 9, 10, '#c9a24a', 2); line(g, cx - 9, 12, cx + 9, 12, '#c9a24a', 2); g.fillStyle = '#c9a24a'; g.fillRect(cx - 8, 33, 17, 3); for (i = -2; i <= 2; i++) line(g, cx + i * 2.5, 13, cx + i * 2.5, 33, '#f4efe0'); break;
      case 'eclipse': disc(g, cx, 20, 11, '#ffcf6a'); disc(g, cx, 20, 9, '#fff1b0'); disc(g, cx + 1, 20, 9, '#0a0810'); ring(g, cx, 20, 12, '#ff8a3a'); break;
      case 'coins': for (i = 0; i < 4; i++) { var bx = 22 + i * 14; g.fillStyle = ['#8a5a3a', '#6a7a4a', '#7a4a6a', '#4a6a8a'][i]; g.fillRect(bx, 34, 10, 8); poly(g, [bx - 1, 34, bx + 5, 29, bx + 11, 34], '#b8a070'); } disc(g, cx, 18, 4, '#f1d27a'); disc(g, cx - 6, 21, 3, '#e2b33c'); disc(g, cx + 6, 21, 3, '#e2b33c'); break;
      case 'altar': poly(g, [34, 46, 62, 46, 60, 30, 36, 30], '#8a8478'); poly(g, [36, 30, 60, 30, 56, 26, 40, 26], '#a8a294'); for (i = 0; i < 4; i++) px(g, 40 + i * 5, 36, '#3a3530', 2, 5); g.fillStyle = 'rgba(255,220,140,0.35)'; for (i = 0; i < 6; i++) g.fillRect(44 + i, 8 + i * 3, 8 - i, 18 - i * 3); break;
      default: disc(g, cx, 20, 8, '#e9e2cf');
    }
    return c;
  }

  root.PWArt = { cv: cv, rng: rng, hex2rgb: hex2rgb, rgb: rgb, rgba: rgba, shade: shade, mix: mix, px: px, disc: disc, ring: ring, line: line, poly: poly, up: up, emblem: emblem, icon: icon, eventArt: eventArt };
})(typeof self !== 'undefined' ? self : this);
