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
  function knolls(seed, dry) {
    var w = 112, h = 68, ax = 56, ay = 50, r = A.rng(seed), gC = dry ? '#a8965e' : '#7d9450', gL = shade(gC, 0.22), gD = shade(gC, -0.3);
    var n = 1 + (r() < 0.7 ? 1 : 0) + (r() < 0.35 ? 1 : 0), ks = []; for (var i = 0; i < n; i++) ks.push({ x: ax + (n === 1 ? (r() - 0.5) * 12 : -26 + i * (52 / (n - 1)) + (r() - 0.5) * 16), y: ay - 2 + (r() - 0.5) * 10, w: 13 + r() * 16, h: 7 + r() * 14 });
    ks.sort(function (a, b) { return a.y - b.y; });
    return { c: outline(w, h, 'rgba(30,34,22,0.14)', function (g) {
      ks.forEach(function (k) {
        E(g, k.x + 8, k.y + 2, k.w + 4, 5, 'rgba(12,16,26,0.25)');
        g.fillStyle = gD; g.beginPath(); g.ellipse(k.x, k.y, k.w, k.h, 0, Math.PI, 0); g.fill();
        g.fillStyle = gC; g.beginPath(); g.ellipse(k.x - k.w * 0.18, k.y, k.w * 0.82, k.h * 0.96, 0, Math.PI, 0); g.fill();
        g.fillStyle = gL; g.beginPath(); g.ellipse(k.x - k.w * 0.38, k.y - k.h * 0.25, k.w * 0.4, k.h * 0.55, 0, Math.PI, 0); g.fill();
        for (var j = 0; j < k.w; j++) { var gx = k.x - k.w + j * 2, gy = k.y - Math.sqrt(Math.max(0, 1 - Math.pow((gx - k.x) / k.w, 2))) * k.h * (0.3 + r() * 0.6); L(g, gx, gy, gx + (r() - 0.5) * 2, gy - 2 - r() * 2, r() > 0.5 ? gL : gD, 0.8); }
        if (r() < 0.7) { var ox = k.x + (r() - 0.3) * k.w * 0.6, oy = k.y - k.h * (0.3 + r() * 0.4); P(g, [ox - 5, oy + 3, ox - 3, oy - 3, ox + 2, oy - 5, ox + 6, oy - 1, ox + 5, oy + 3], '#8c8478'); P(g, [ox - 3, oy - 3, ox + 2, oy - 5, ox + 1, oy, ox - 4, oy + 2], '#b0a898'); }
      });
      for (i = 0; i < 3; i++) { var q = inEllipse(r, ax, ay - 2, 44, 8); E(g, q[0], q[1] - 2, 3, 2.4, dry ? '#7a7a3a' : '#3e6a32'); E(g, q[0] - 1, q[1] - 3, 1.6, 1.2, dry ? '#9a9a4a' : '#5a8a40'); }
    }), ax: ax, ay: ay };
  }

  var POOL = 8;
  /* the variant for a tile: family by terrain; class, altitude band, climate and a seeded index pick from the pool */
  function keyFor(t, tiles) {
    if (t.terrain === 'forest') return 'forest:' + (t.t < 0.4 ? 'cold' : t.t > 0.75 ? 'dry' : 'temp') + ':' + (t.id * 2654435761 >>> 0) % POOL;
    if (t.terrain === 'hills') return 'hills:' + (t.t > 0.72 ? 'dry' : 'green') + ':' + (t.id * 2246822519 >>> 0) % POOL;
    if (t.terrain === 'mountains') { var mnb = t.n.filter(function (n) { return n >= 0 && tiles[n].terrain === 'mountains'; }).length;
      return 'mountain:' + (mnb >= 5 ? 'heart' : mnb <= 2 ? 'edge' : 'mid') + ':' + (t.e > 0.93 ? 1 : 0) + ':' + (t.t < 0.75 ? 'snow' : 'bare') + ':' + (t.id * 3266489917 >>> 0) % POOL; }
    return null;
  }
  function build(key) {
    var k = key.split(':'), seed = 0; for (var i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
    if (k[0] === 'forest') return forest(seed, k[1] === 'cold', k[1] === 'dry');
    if (k[0] === 'hills') return knolls(seed, k[1] === 'dry');
    if (k[0] === 'mountain') return massif(seed, k[1], +k[2] ? 1 : 0.35, k[3] === 'snow');
    return null;
  }
  A.terrain = { keyFor: keyFor, build: build, families: ['forest', 'hills', 'mountain'], POOL: POOL };
  A.ids.terrain = ['forest', 'hills', 'mountain'];
})(typeof self !== 'undefined' ? self : this);
