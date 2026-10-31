/* Pantheon Wars — terrain art v0.5: the tall landscape features, authored at 2× resolution.
 * Forest stands (seeded clusters of conifers, broadleaves and birches with lit crowns and shaded flanks, snow in the cold), mountain massifs
 * (faceted rock with ridgelines, cliffs, strata, scree fans and broken snow caps; the heart of a range, its middle and its foothill edge
 * each have their own forms) and hill knolls (rounded grassy rises with rock outcrops and shrubs). One light, upper left; one-pixel dark
 * silhouette; cast shadow to the lower right, as in ui/kits.js. Each family is a pool of seeded variants built once per map, so the land
 * never shows one stamped shape. The renderer bakes the same sprite at 1× into the static terrain layer (overview zoom, Low quality) and
 * draws it at 2× in screen space at normal zoom, so the two always coincide. Sizes and ground anchors (2× px): forest 112×76 at (56, 54),
 * mountain 128×124 at (64, 108), hills 112×68 at (56, 50). */
(function (root) {
  'use strict';
  var A = root.PWArt, shade = A.shade, mix = A.mix, rgba = A.rgba;
  function cv(w, h) { return A.cv(w, h); }
  function P(g, p, c) { g.fillStyle = c; g.beginPath(); g.moveTo(p[0], p[1]); for (var i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath(); g.fill(); }
  function E(g, x, y, rx, ry, c, a0, a1) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, a0 || 0, a1 === undefined ? Math.PI * 2 : a1); g.fill(); }
  function L(g, x0, y0, x1, y1, c, w) { g.strokeStyle = c; g.lineWidth = w || 1; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  /* draw into a scratch canvas, then stamp a dark one-pixel silhouette under it (the shared outline language) */
  function outline(w, h, col, draw) {
    var a = cv(w, h), ag = a.getContext('2d'); draw(ag);
    var o = cv(w, h), og = o.getContext('2d'); og.drawImage(a, 0, 0); og.globalCompositeOperation = 'source-in'; og.fillStyle = col; og.fillRect(0, 0, w, h);
    var c = cv(w, h), g = c.getContext('2d'); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (d) { g.drawImage(o, d[0], d[1]); }); g.drawImage(a, 0, 0); return c;
  }
  function inEllipse(r, cx, cy, rx, ry) { for (var i = 0; i < 30; i++) { var x = (r() * 2 - 1), y = (r() * 2 - 1); if (x * x + y * y < 1) return [cx + x * rx, cy + y * ry]; } return [cx, cy]; }

  /* ------------------------------------------------------------------ trees */
  function conifer(g, x, y, s, r, cold) {
    E(g, x + s * 0.5, y + 1, s * 0.75, s * 0.22, 'rgba(10,16,20,0.30)');
    g.fillStyle = '#4a3020'; g.fillRect(x - 1, y - s * 0.35, 2, s * 0.4);
    var dk = cold ? '#1f3a30' : '#1f3d24', md = cold ? '#2f5040' : '#2f5a30', lt = cold ? '#4a7058' : '#4f7f3e';
    for (var t = 0; t < 4; t++) { var w = s * (0.62 - t * 0.12), ty = y - s * 0.25 - t * s * 0.32, th = s * 0.5;
      P(g, [x - w, ty, x + 0.5, ty - th, x + w, ty], dk); P(g, [x - w, ty, x + 0.5, ty - th, x - w * 0.15, ty], md); L(g, x - w + 1, ty - 0.5, x - 0.5, ty - th + 1.5, lt);
      if (cold && r() < 0.8) { P(g, [x - w * 0.7, ty - th * 0.3, x + 0.5, ty - th, x + w * 0.4, ty - th * 0.35], 'rgba(238,244,250,0.85)'); } }
  }
  function broadleaf(g, x, y, s, r, hue) {
    E(g, x + s * 0.6, y + 1, s * 0.9, s * 0.25, 'rgba(10,16,20,0.30)');
    g.fillStyle = '#4a3420'; g.fillRect(x - 1, y - s * 0.7, 2.2, s * 0.72); L(g, x, y - s * 0.6, x - s * 0.3, y - s * 0.9, '#4a3420', 1.2);
    var base = hue || mix('#3e6a2e', '#5a7a2a', r()), dk = shade(base, -0.3), lt = shade(base, 0.25);
    for (var i = 0; i < 6; i++) { var a = i / 6 * Math.PI * 2, cx = x + Math.cos(a) * s * 0.42, cy = y - s * 1.05 + Math.sin(a) * s * 0.3; E(g, cx + 1, cy + 1, s * 0.38, s * 0.32, dk); }
    for (i = 0; i < 6; i++) { a = i / 6 * Math.PI * 2; cx = x + Math.cos(a) * s * 0.38; cy = y - s * 1.08 + Math.sin(a) * s * 0.26; E(g, cx, cy, s * 0.34, s * 0.28, base); }
    E(g, x - s * 0.25, y - s * 1.3, s * 0.3, s * 0.22, lt); E(g, x - s * 0.4, y - s * 1.1, s * 0.16, s * 0.12, shade(lt, 0.15));
    for (i = 0; i < 5; i++) E(g, x + (r() - 0.3) * s * 0.8, y - s * (0.85 + r() * 0.5), 1, 1, r() > 0.5 ? lt : dk);
  }
  function birch(g, x, y, s, r) {
    E(g, x + s * 0.4, y + 1, s * 0.5, s * 0.18, 'rgba(10,16,20,0.28)');
    g.fillStyle = '#e8e4d8'; g.fillRect(x - 1, y - s * 1.2, 2, s * 1.2); for (var i = 0; i < 4; i++) { g.fillStyle = '#3a3630'; g.fillRect(x - 1, y - s * (0.2 + i * 0.25), 2, 1); }
    E(g, x, y - s * 1.3, s * 0.32, s * 0.45, '#7a9a3a'); E(g, x - s * 0.1, y - s * 1.42, s * 0.18, s * 0.25, '#a8c050');
  }
  function forest(seed, cold, dry) {
    var w = 112, h = 76, ax = 56, ay = 54, r = A.rng(seed);
    return { c: outline(w, h, 'rgba(14,22,16,0.55)', function (g) {
      E(g, ax + 4, ay + 2, 42, 14, 'rgba(10,20,10,0.22)'); // stand shadow and undergrowth
      for (var i = 0; i < 30; i++) { var u = inEllipse(r, ax, ay, 40, 14); E(g, u[0], u[1], 2 + r() * 2, 1.2, r() > 0.5 ? 'rgba(40,70,30,0.6)' : 'rgba(90,110,50,0.45)'); }
      var n = 8 + (r() * 5 | 0), pts = []; for (i = 0; i < n; i++) pts.push(inEllipse(r, ax, ay - 2, 38, 13)); pts.sort(function (a, b) { return a[1] - b[1]; });
      pts.forEach(function (q) { var k = r(), s = 14 + r() * 8 + (q[1] - ay + 13) * 0.25; if (cold || k < (dry ? 0.25 : 0.45)) conifer(g, q[0], q[1], s, r, cold); else if (!dry && k < 0.55) birch(g, q[0], q[1], s * 0.8, r); else broadleaf(g, q[0], q[1], s * 0.75, r, dry ? '#6a7a32' : null); });
    }), ax: ax, ay: ay };
  }

  /* ------------------------------------------------------------------ mountains */
  function massif(seed, cls, alt, snow) { // cls: 'heart' (one dominant peak), 'mid' (two to three), 'edge' (foothills)
    var w = 128, h = 124, ax = 64, ay = 108, r = A.rng(seed);
    var rockL = mix('#a89e8a', '#c0b6a2', alt * 0.5), rockM = mix('#857d6c', '#8e8676', alt * 0.4), rockD = mix('#5e5850', '#545060', alt), rockDD = shade(rockD, -0.2);
    var peaks = [], np = cls === 'heart' ? 1 + (r() < 0.6 ? 1 : 0) + (r() < 0.25 ? 1 : 0) : cls === 'edge' ? 2 + (r() < 0.6 ? 1 : 0) : 2 + (r() < 0.4 ? 1 : 0);
    for (var i = 0; i < np; i++) { var big = cls === 'heart' && i === 0;
      peaks.push({ x: ax + (np === 1 ? (r() - 0.5) * 10 : -26 + i * (52 / Math.max(1, np - 1)) + (r() - 0.5) * 12), hh: big ? 44 + alt * 14 + r() * 16 : cls === 'edge' ? 18 + r() * 12 + alt * 6 : 30 + r() * 18 + alt * 12, bw: big ? 46 + r() * 10 : cls === 'edge' ? 22 + r() * 12 : 30 + r() * 12, lean: (r() - 0.5) * 0.5, sh: r() }); }
    peaks.sort(function (a, b) { return a.hh - b.hh; });
    return { c: outline(w, h, 'rgba(26,22,24,0.4)', function (g) {
      g.fillStyle = 'rgba(12,14,28,0.22)'; g.beginPath(); g.ellipse(ax + 10, ay + 2, 56, 12, 0, 0, Math.PI * 2); g.fill();
      peaks.forEach(function (pk, idx) {
        var by = ay - (idx % 2) * 3, top = by - pk.hh, tx = pk.x + pk.lean * pk.bw, lx = pk.x - pk.bw, rx = pk.x + pk.bw;
        // silhouette with a broken ridgeline: shoulders and notches on both flanks
        var lsh = [lx, by, lx + pk.bw * (0.2 + pk.sh * 0.2), by - pk.hh * (0.2 + r() * 0.2), lx + pk.bw * 0.45, by - pk.hh * (0.38 + r() * 0.14), lx + pk.bw * 0.55, by - pk.hh * (0.34 + r() * 0.1), tx - pk.bw * 0.22, top + pk.hh * (0.12 + r() * 0.12), tx - 3, top + 2 + r() * 3];
        var rsh = [tx + 2 + r() * 3, top + 3, tx + pk.bw * (0.15 + r() * 0.15), top + pk.hh * (0.18 + r() * 0.1), rx - pk.bw * 0.5, by - pk.hh * (0.42 + r() * 0.12), rx - pk.bw * 0.38, by - pk.hh * (0.36 + r() * 0.08), rx - pk.bw * 0.2, by - pk.hh * (0.18 + r() * 0.1), rx, by];
        P(g, lsh.concat([tx, top]).concat(rsh), rockM);
        // lit face (left of the main ridge line) and shaded face (right), then a cool cast shadow in the hollow
        P(g, [lx, by].concat(lsh.slice(2)).concat([tx, top, tx + pk.bw * 0.05, top + pk.hh * 0.45, pk.x - pk.bw * 0.05, by]), rockL);
        P(g, [tx, top].concat(rsh).concat([pk.x + pk.bw * 0.05, by, tx + pk.bw * 0.05, top + pk.hh * 0.45]), rockD);
        P(g, [tx + pk.bw * 0.05, top + pk.hh * 0.45, pk.x + pk.bw * 0.05, by, pk.x + pk.bw * 0.4, by, tx + pk.bw * 0.25, top + pk.hh * 0.55], rockDD);
        // gullies and facets on the lit face, strata on the shaded face
        for (var f = 0; f < 5; f++) { var fy = top + pk.hh * (0.2 + f * 0.15), fx = tx - pk.bw * (0.1 + f * 0.16); L(g, fx, fy, fx - pk.bw * 0.12, fy + pk.hh * 0.22, rgba(shade(rockL, -0.25), 0.8), 1.2); L(g, fx + 1, fy, fx - pk.bw * 0.1 + 1, fy + pk.hh * 0.2, rgba('#fff4dc', 0.25), 1); }
        for (f = 0; f < 6; f++) { var sy = top + pk.hh * (0.3 + f * 0.11); L(g, tx + pk.bw * 0.15 + f, sy, tx + pk.bw * (0.55 + f * 0.06), sy + 3 + r() * 2, rgba('#000000', 0.18), 1); }
        // cliff band low on the lit side
        if (pk.hh > 40) { P(g, [lx + pk.bw * 0.4, by - pk.hh * 0.3, lx + pk.bw * 0.72, by - pk.hh * 0.36, lx + pk.bw * 0.75, by - pk.hh * 0.24, lx + pk.bw * 0.42, by - pk.hh * 0.2], shade(rockL, -0.18)); }
        // snow: broken cap following the ridges, blue in shade
        if (snow && pk.hh > 30) { var sd = pk.hh * (0.22 + alt * 0.2);
          P(g, [tx, top, tx - pk.bw * 0.32 * sd / pk.hh * 2.2, top + sd + r() * 3, tx - pk.bw * 0.2, top + sd * 0.65, tx - pk.bw * 0.1, top + sd * 1.05, tx + 1, top + sd * 0.7, tx + pk.bw * 0.05, top + pk.hh * 0.3], '#f2f5f8');
          P(g, [tx + 1, top + 1, tx + pk.bw * 0.05, top + pk.hh * 0.3, tx + pk.bw * 0.22, top + sd * 0.95, tx + pk.bw * 0.3 * sd / pk.hh * 2.4, top + sd * 0.7], '#aebcd4');
          for (f = 0; f < 3; f++) L(g, tx - pk.bw * (0.08 + f * 0.1), top + sd * (0.9 + f * 0.1), tx - pk.bw * (0.12 + f * 0.1), top + sd * (1.3 + f * 0.15), 'rgba(242,245,248,0.8)', 1.5); }
        L(g, tx, top, lx + pk.bw * 0.5, by - pk.hh * 0.42, rgba('#fff0d0', 0.35), 1);
      });
      for (i = 0; i < 26; i++) { var q = inEllipse(r, ax, ay - 4, 54, 8); E(g, q[0], q[1], 1 + r() * 2, 0.8 + r(), r() > 0.5 ? '#9a9282' : '#6a645a'); } // scree fans at the foot
    }), ax: ax, ay: ay };
  }

  /* ------------------------------------------------------------------ hills */
  /* Hills v0.6: not domes but ridged rises. Each knoll is an asymmetric profile (crest off-centre, one long and one short flank) whose
     ridge leans left or right per variant; the face toward the light is lit, the far face shaded, a crest line catches the light, rock
     breaks through on the steep flank and the foot fades into the ground without an outline. 12 variants per climate. */
  function knolls(seed, dry) {
    var w = 112, h = 68, ax = 56, ay = 50, r = A.rng(seed), gC = dry ? '#a8965e' : '#7d9450', gL = shade(gC, 0.2), gD = shade(gC, -0.28), rock = dry ? '#a89c84' : '#8c8678';
    var n = 1 + (r() < 0.65 ? 1 : 0) + (r() < 0.25 ? 1 : 0), ks = [], lean = r() < 0.5 ? -1 : 1;
    for (var i = 0; i < n; i++) ks.push({ x: ax + (n === 1 ? (r() - 0.5) * 14 : (i - (n - 1) / 2) * (44 / Math.max(1, n - 1)) * (0.8 + r() * 0.4)), y: ay - 1 + (r() - 0.5) * 10, w: 12 + r() * 14 + (i === 0 ? 4 : 0), h: 8 + r() * 13, c: (r() - 0.5) * 0.7 + lean * 0.25 });
    ks.sort(function (a, b) { return a.y - b.y; });
    var c = cv(w, h), g = c.getContext('2d');
    ks.forEach(function (k) {
      var L = k.x - k.w, Rr = k.x + k.w, cx = k.x + k.c * k.w, top = k.y - k.h;
      E(g, k.x + 6, k.y + 2, k.w + 6, 4.5, 'rgba(12,16,26,0.22)');
      var prof = function () { g.beginPath(); g.moveTo(L - 4, k.y + 1); g.bezierCurveTo(L + (cx - L) * 0.4, k.y - k.h * 0.15, cx - k.w * 0.35, top, cx, top); g.bezierCurveTo(cx + k.w * 0.25, top, Rr - (Rr - cx) * 0.35, k.y - k.h * 0.2, Rr + 4, k.y + 1); g.closePath(); };
      prof(); g.fillStyle = gD; g.fill();
      g.save(); prof(); g.clip(); g.fillStyle = gC; g.beginPath(); g.moveTo(L - 6, k.y + 2); g.lineTo(cx + 1, top - 2); g.lineTo(cx + k.w * 0.18, k.y + 2); g.closePath(); g.fill();
      g.fillStyle = gL; g.beginPath(); g.moveTo(L + k.w * 0.25, k.y - k.h * 0.2); g.lineTo(cx, top); g.lineTo(cx - k.w * 0.18, k.y - k.h * 0.35); g.closePath(); g.fill();
      for (var j = 0; j < k.w * 1.6; j++) { var gx = L + r() * k.w * 2, gy = k.y - r() * k.h; L2(g, gx, gy, gx + (r() - 0.5) * 1.5, gy - 1.5 - r() * 1.5, r() > 0.5 ? rgba(gL, 0.8) : rgba(gD, 0.7), 0.8); }
      var rs = cx + (k.c > 0 ? -1 : 1) * k.w * 0.35, ry = top + k.h * 0.35; if (k.h > 11 && r() < 0.8) { P(g, [rs - 6, ry + 4, rs - 3, ry - 3, rs + 3, ry - 4, rs + 7, ry + 2, rs + 2, ry + 5], rock); P(g, [rs - 3, ry - 3, rs + 3, ry - 4, rs + 1, ry, rs - 4, ry + 2], shade(rock, 0.2)); L2(g, rs - 1, ry, rs + 4, ry + 2, shade(rock, -0.3), 0.8); }
      g.restore();
      g.strokeStyle = rgba('#fff4d8', 0.35); g.lineWidth = 1; g.beginPath(); g.moveTo(cx - k.w * 0.5, top + k.h * 0.3); g.quadraticCurveTo(cx - k.w * 0.2, top, cx, top + 0.5); g.stroke();
    });
    for (i = 0; i < 2 + (r() * 3 | 0); i++) { var q = inEllipse(r, ax, ay - 1, 46, 8); E(g, q[0], q[1] - 2, 2.6, 2, dry ? '#7a7a3a' : '#3e6a32'); E(g, q[0] - 1, q[1] - 3, 1.4, 1.1, dry ? '#9a9a4a' : '#5a8a40'); }
    return { c: c, ax: ax, ay: ay };
  }
  function L2(g, x0, y0, x1, y1, c, w) { L(g, x0, y0, x1, y1, c, w); }

  /* Flat ground v0.6 (grassland, plains, desert, cold ground; wet, cold and shore variants from the tile's moisture, temperature and coast):
     authored at 2× inside the hex top and baked at 1× into the static terrain layer. Details cluster in groups instead of a uniform sprinkle. */
  function ground(seed, kind, wet, cold, coast) {
    var w = 96, h = 56, ax = 48, ay = 28, r = A.rng(seed), c = cv(w, h), g = c.getContext('2d'), i, j, q;
    var clump = function (x, y, n, a, b, hgt) { for (var k = 0; k < n; k++) { var dx = (k - n / 2) * 0.9; L(g, x + dx, y, x + dx * 1.8 + (r() - 0.5), y - hgt * (0.6 + r() * 0.5), k % 2 ? a : b, 0.9); } };
    var stone = function (x, y, s, col) { E(g, x + s * 0.6, y + 1, s * 1.1, s * 0.35, 'rgba(14,12,24,0.28)'); E(g, x, y - s * 0.3, s, s * 0.65, col); E(g, x - s * 0.3, y - s * 0.55, s * 0.5, s * 0.3, shade(col, 0.25)); };
    var spot = function () { return inEllipse(r, ax, ay, 38, 19); };
    if (kind === 'grassland') {
      for (i = 0; i < 3; i++) { q = spot(); E(g, q[0], q[1], 7 + r() * 6, 3 + r() * 2, rgba(r() > 0.5 ? '#9ac25a' : '#5f8a32', 0.35)); } // tonal patches
      for (i = 0; i < 6 + (r() * 4 | 0); i++) { q = spot(); clump(q[0], q[1], 5 + (r() * 4 | 0), '#4f7a2a', '#a8d06a', 5 + r() * 3); }
      var fc = ['#f4e070', '#f4f0f4', '#e890b0', '#a8c0f4'][r() * 4 | 0]; for (j = 0; j < 1 + (r() < 0.5 ? 1 : 0); j++) { q = spot(); for (i = 0; i < 7; i++) E(g, q[0] + (r() - 0.5) * 8, q[1] + (r() - 0.5) * 4, 0.9, 0.9, i % 3 ? fc : '#ffffff'); }
      if (r() < 0.5) { q = spot(); E(g, q[0], q[1], 5, 2.2, '#8a7048'); E(g, q[0] - 1, q[1] - 0.5, 3, 1.2, '#a88a5a'); stone(q[0] + 2, q[1], 1.2, '#9a9488'); }
      if (wet) { for (j = 0; j < 2; j++) { q = spot(); E(g, q[0], q[1], 6 + r() * 4, 2.4, '#3f6a6a'); E(g, q[0] - 1, q[1] - 0.6, 4, 1, rgba('#bfe0e0', 0.6)); for (i = 0; i < 9; i++) L(g, q[0] - 7 + i * 1.6, q[1] + 1.5, q[0] - 7 + i * 1.6 + (r() - 0.5) * 2, q[1] - 5 - r() * 4, i % 2 ? '#7a8a3a' : '#5a6a2a', 1); } }
    } else if (kind === 'plains') {
      g.save(); g.beginPath(); g.ellipse(ax, ay, 40, 20, 0, 0, Math.PI * 2); g.clip(); var dir = r() < 0.5 ? 1 : -1;
      for (i = -50; i < 50; i += 4) { L(g, ax + i, ay - 22, ax + i + dir * 22, ay + 22, rgba(i % 8 ? '#e8cc6e' : '#8a7a30', 0.28), 2); } g.restore();
      for (i = 0; i < 5 + (r() * 3 | 0); i++) { q = spot(); clump(q[0], q[1], 4 + (r() * 3 | 0), '#a88a30', '#f0d870', 4 + r() * 2); }
      if (r() < 0.45) { q = spot(); E(g, q[0] + 3, q[1] + 1, 6, 1.6, 'rgba(14,12,24,0.25)'); g.fillStyle = '#d8b850'; g.beginPath(); g.moveTo(q[0] - 4, q[1]); g.quadraticCurveTo(q[0], q[1] - 10, q[0] + 4, q[1]); g.fill(); L(g, q[0], q[1] - 8, q[0] + 3, q[1], '#a88a30', 1); }
      for (i = 0; i < 2; i++) { q = spot(); stone(q[0], q[1], 1.3 + r(), '#a09888'); }
    } else if (kind === 'desert') {
      for (j = 0; j < 4 + (r() * 3 | 0); j++) { q = spot(); var rw = 10 + r() * 12; g.strokeStyle = rgba('#fff0c8', 0.45); g.lineWidth = 1; g.beginPath(); g.ellipse(q[0], q[1] + 3, rw, 4, -0.08, Math.PI * 1.08, Math.PI * 1.9); g.stroke(); g.strokeStyle = rgba('#a07a40', 0.35); g.beginPath(); g.ellipse(q[0] + 1, q[1] + 4, rw, 4, -0.08, Math.PI * 1.1, Math.PI * 1.85); g.stroke(); }
      if (r() < 0.5) { q = spot(); for (i = 0; i < 6; i++) { var a = r() * 6.28; L(g, q[0], q[1], q[0] + Math.cos(a) * 5, q[1] + Math.sin(a) * 2.2, 'rgba(110,80,40,0.5)', 0.8); } } // a cracked pan
      for (i = 0; i < 2 + (r() * 2 | 0); i++) { q = spot(); stone(q[0], q[1], 1.8 + r() * 1.6, '#a07a52'); }
      if (r() < 0.6) { q = spot(); for (i = 0; i < 6; i++) L(g, q[0], q[1], q[0] + (i - 2.5) * 1.4, q[1] - 3 - r() * 2, '#8a8a4a', 0.9); }
    } else { // tundra and cold ground
      for (j = 0; j < 3 + (r() * 3 | 0); j++) { q = spot(); var sw = 5 + r() * 8; g.fillStyle = '#eef3f8'; g.beginPath(); g.ellipse(q[0], q[1], sw, sw * 0.38, (r() - 0.5) * 0.3, 0, 7); g.fill(); g.fillStyle = 'rgba(150,170,205,0.55)'; g.beginPath(); g.ellipse(q[0] + 1, q[1] + 1, sw, sw * 0.3, 0, 0, Math.PI); g.fill(); g.fillStyle = '#ffffff'; g.fillRect(q[0] - sw * 0.5, q[1] - 1, sw * 0.4, 1); }
      for (i = 0; i < 3; i++) { q = spot(); stone(q[0], q[1], 1.6 + r(), '#7a7a78'); E(g, q[0] - 0.4, q[1] - 1.6, 1.4, 0.6, '#f4f8fc'); }
      for (i = 0; i < 4; i++) { q = spot(); clump(q[0], q[1], 4, '#6a6a4a', '#8a8a6a', 3); }
      for (i = 0; i < 2; i++) { q = spot(); L(g, q[0] - 4, q[1], q[0], q[1] - 1, 'rgba(200,220,240,0.7)'); L(g, q[0], q[1] - 1, q[0] + 3, q[1] + 1, 'rgba(200,220,240,0.7)'); }
    }
    if (cold && kind !== 'tundra') for (i = 0; i < 3; i++) { q = spot(); E(g, q[0], q[1], 5 + r() * 4, 1.6, 'rgba(236,242,248,0.75)'); }
    if (coast) for (i = 0; i < 5; i++) { q = spot(); E(g, q[0], q[1], 1.2, 0.8, ['#c8c0b0', '#a89c88', '#e0d8c8'][i % 3]); if (i === 2) L(g, q[0] - 4, q[1] + 1, q[0] + 4, q[1], '#8a6a48', 1.4); } // pebbles and a piece of driftwood
    return { c: c, ax: ax, ay: ay };
  }

  var POOL = 8, HILL_POOL = 12;
  /* the variant for a tile: family by terrain; class, altitude band, climate and a seeded index pick from the pool */
  function keyFor(t, tiles) {
    if (t.terrain === 'forest') return 'forest:' + (t.t < 0.4 ? 'cold' : t.t > 0.75 ? 'dry' : 'temp') + ':' + (t.id * 2654435761 >>> 0) % POOL;
    if (t.terrain === 'hills') return 'hills:' + (t.t > 0.72 ? 'dry' : 'green') + ':' + (t.id * 2246822519 >>> 0) % HILL_POOL;
    if (t.terrain === 'mountains') { var mnb = t.n.filter(function (n) { return n >= 0 && tiles[n].terrain === 'mountains'; }).length;
      return 'mountain:' + (mnb >= 5 ? 'heart' : mnb <= 2 ? 'edge' : 'mid') + ':' + (t.e > 0.93 ? 1 : 0) + ':' + (t.t < 0.75 ? 'snow' : 'bare') + ':' + (t.id * 3266489917 >>> 0) % POOL; }
    return null;
  }
  /* the flat-ground variant for a tile (baked only): kind, wet (moisture), cold (temperature), shore (coast), seeded index */
  function groundKey(t) {
    if (['grassland', 'plains', 'desert', 'tundra'].indexOf(t.terrain) < 0) return null;
    return 'ground:' + t.terrain + ':' + (t.m > 0.68 && t.terrain === 'grassland' ? 1 : 0) + ':' + (t.t < 0.32 ? 1 : 0) + ':' + (t.coast ? 1 : 0) + ':' + (t.id * 2654435761 >>> 0) % 10;
  }
  function build(key) {
    var k = key.split(':'), seed = 0; for (var i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
    if (k[0] === 'forest') return forest(seed, k[1] === 'cold', k[1] === 'dry');
    if (k[0] === 'hills') return knolls(seed, k[1] === 'dry');
    if (k[0] === 'mountain') return massif(seed, k[1], +k[2] ? 1 : 0.35, k[3] === 'snow');
    if (k[0] === 'ground') return ground(seed, k[1], +k[2], +k[3], +k[4]);
    return null;
  }
  A.terrain = { keyFor: keyFor, groundKey: groundKey, build: build, families: ['forest', 'hills', 'mountain'], POOL: POOL };
  A.ids.terrain = ['forest', 'hills', 'mountain', 'ground'];
})(typeof self !== 'undefined' ? self : this);
