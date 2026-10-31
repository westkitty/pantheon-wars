/* Pantheon Wars — asset kits v0.4: the standing-object art library, authored at 2× resolution.
 * Ten architectural kits (houses, monuments, enclosures, props), the village composer, ten shrine families in seven conditions and
 * three callings, ten priest families in three callings with a six-frame set, and four landmarks. Everything is original procedural
 * source art drawn in code (no image files, nothing copied); the renderer draws these sprites at their world size in screen space,
 * so at normal gameplay zoom one source pixel is about one screen pixel. One light: upper left. Shadows fall to the lower right.
 * docs/ART_DIRECTION.md (v0.4) is the governing bible; data/asset-manifest.json lists every id; node tools/assets.js renders atlases. */
(function (root) {
  'use strict';
  var A = root.PWArt;
  var rng = A.rng, shade = A.shade, mix = A.mix, rgba = A.rgba;
  function cv(w, h) { return A.cv(w, h); }
  function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function P(g, pts, c) { g.fillStyle = c; g.beginPath(); g.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); }
  function L(g, x0, y0, x1, y1, c, w) { g.strokeStyle = c; g.lineWidth = w || 1; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  function E(g, x, y, rx, ry, c, a0, a1) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, a0 || 0, a1 === undefined ? Math.PI * 2 : a1); g.fill(); }
  function grad(g, x0, y0, x1, y1, stops) { var gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); }); return gr; }

  /* Silhouette outline: draw the art into a scratch canvas, stamp a dark copy one pixel around it, then the art on top.
     Gives every building and figure a crisp edge that survives on any terrain, which is what keeps small sprites readable. */
  /* Silhouette outline: draw the art into a scratch canvas, stamp a dark copy one pixel around it, then the art on top.
     Gives every building and figure a crisp edge that survives on any terrain, which is what keeps small sprites readable.
     The two scratch canvases are reused across calls (sprite builds happen on cache misses, so they must stay cheap). */
  var scratch = null, stamp = null;
  function outlined(g, w, h, col, draw, bx, by) { // optional (bx, by): the w×h box sits at that offset in g (a building's bounds)
    bx = bx || 0; by = by || 0;
    if (!scratch || scratch.width < w || scratch.height < h) { scratch = cv(Math.max(w, 160), Math.max(h, 120)); stamp = cv(scratch.width, scratch.height); }
    var s = scratch.getContext('2d'); s.setTransform(1, 0, 0, 1, 0, 0); s.globalCompositeOperation = 'source-over'; s.clearRect(0, 0, w, h);
    s.setTransform(1, 0, 0, 1, -bx, -by); draw(s); s.setTransform(1, 0, 0, 1, 0, 0);
    var og = stamp.getContext('2d'); og.globalCompositeOperation = 'source-over'; og.clearRect(0, 0, w, h); og.drawImage(scratch, 0, 0, w, h, 0, 0, w, h);
    og.globalCompositeOperation = 'source-in'; og.fillStyle = col; og.fillRect(0, 0, w, h); og.globalCompositeOperation = 'source-over';
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (d) { g.drawImage(stamp, 0, 0, w, h, bx + d[0], by + d[1], w, h); });
    g.drawImage(scratch, 0, 0, w, h, bx, by, w, h);
  }

  /* ---------------------------------------------------------------- materials (one light: upper left) */
  // Each material: base face colour, shaded side, lit top, and a surface texture painted inside a face.
  var MAT = {
    lime:    { f: '#efe8d8', s: '#bdb3a0', t: '#fbf7ec', tex: 'plaster' },   // whitewash over stone
    marble:  { f: '#ece6d4', s: '#b7ae98', t: '#fffbee', tex: 'ashlar' },
    timber:  { f: '#6b4e36', s: '#45311f', t: '#86664a', tex: 'planks' },
    oak:     { f: '#7d5c3c', s: '#4f3824', t: '#9a7652', tex: 'planks' },
    mud:     { f: '#cfae7a', s: '#a1814f', t: '#e2c896', tex: 'mudbrick' },
    mudred:  { f: '#b9744a', s: '#8a4f2e', t: '#cf8d60', tex: 'render' },
    sand:    { f: '#e2c896', s: '#b39762', t: '#f1dcae', tex: 'blocks' },
    stone:   { f: '#a9a397', s: '#7a756b', t: '#c2bdb1', tex: 'ashlar' },
    grey:    { f: '#9b968c', s: '#6f6a62', t: '#b4afa4', tex: 'polygonal' },
    wattle:  { f: '#d6c7a8', s: '#a8977a', t: '#e4d8be', tex: 'wattle' },
    paint:   { f: '#ece4d4', s: '#b9ad97', t: '#faf4e8', tex: 'plaster' },
    plaster: { f: '#ece2cc', s: '#b9ab90', t: '#f8f0de', tex: 'frame' },
    adobe:   { f: '#d9bf8f', s: '#aa8f5f', t: '#e9d3a6', tex: 'render' }
  };
  function texture(g, kind, x, y, w, h, base, r) {
    var dk = shade(base, -0.16), lt = shade(base, 0.1), i, j;
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    switch (kind) {
      case 'ashlar': for (j = 0; y + j * 3 < y + h; j++) { R(g, x, y + j * 3 + 2, w, 1, dk); for (i = (j % 2) * 3; i < w; i += 6) R(g, x + i, y + j * 3, 1, 2, dk); } break;
      case 'blocks': for (j = 0; j * 4 < h; j++) { R(g, x, y + j * 4 + 3, w, 1, dk); for (i = (j % 2) * 4; i < w; i += 8) R(g, x + i, y + j * 4, 1, 3, dk); } break;
      case 'polygonal': for (i = 0; i < w * h / 10; i++) { var px = x + r() * w, py = y + r() * h; L(g, px, py, px + 2 + r() * 3, py + (r() - 0.5) * 3, dk); } break;
      case 'mudbrick': for (j = 0; j * 2 < h; j++) { R(g, x, y + j * 2 + 1, w, 1, rgba(dk, 0.55)); for (i = (j % 2) * 2; i < w; i += 4) R(g, x + i, y + j * 2, 1, 1, rgba(dk, 0.5)); } break;
      case 'planks': for (i = 1; i < w; i += 2) R(g, x + i, y, 1, h, i % 4 === 1 ? dk : rgba(lt, 0.5)); for (i = 0; i < 4; i++) R(g, x + r() * w, y + r() * h, 1, 1, shade(base, -0.3)); break;
      case 'wattle': for (j = 0; j < h; j += 2) for (i = (j % 4) / 2; i < w; i += 3) R(g, x + i, y + j, 2, 1, j % 4 ? dk : lt); break;
      case 'frame': R(g, x, y, 1, h, '#3b2a1e'); R(g, x + w - 1, y, 1, h, '#3b2a1e'); R(g, x, y, w, 1, '#3b2a1e'); for (i = 4; i < w - 2; i += 5) R(g, x + i, y, 1, h, '#4a3524'); break;
      case 'render': for (i = 0; i < w * h / 14; i++) R(g, x + r() * w, y + r() * h, 1 + (r() * 2 | 0), 1, r() > 0.5 ? dk : lt); break;
      default: for (i = 0; i < w * h / 24; i++) R(g, x + r() * w, y + r() * h, 1, 1, r() > 0.5 ? rgba(dk, 0.6) : lt);
    }
    g.restore();
  }
  /* Oblique box: front face w×h standing on the ground line y, side face receding up-right by dep. Returns the roof frame. */
  function box(g, x, y, w, h, dep, m, r, o) {
    o = o || {}; var dx = dep, dy = Math.round(dep * 0.55);
    P(g, [x + w, y, x + w + dx, y - dy, x + w + dx, y - h - dy, x + w, y - h], m.s);                                  // side (in shade)
    texture(g, m.tex, x + w, y - h - dy, dx, h + dy, m.s, r);
    P(g, [x + w, y, x + w + dx, y - dy, x + w + dx, y - h - dy, x + w, y - h], 'rgba(30,20,40,0.12)');
    R(g, x, y - h, w, h, m.f); texture(g, m.tex, x, y - h, w, h, m.f, r);                                             // front (lit)
    R(g, x, y - h, 1, h, shade(m.f, 0.18));                                                                            // lit corner
    R(g, x, y - 2, w, 2, rgba('#1a1420', 0.18));                                                                       // ground grime
    if (!o.noTop) { P(g, [x, y - h, x + w, y - h, x + w + dx, y - h - dy, x + dx, y - h - dy], m.t); R(g, x, y - h, w, 1, shade(m.t, 0.1)); }
    return { x: x, y: y - h, w: w, dx: dx, dy: dy };
  }
  function door(g, x, y, w, h, night, col) { R(g, x, y - h, w, h, col || '#2c1e14'); R(g, x, y - h, w, 1, '#1b120c'); if (night) R(g, x + 1, y - h + 1, w - 2, h - 1, rgba('#ffcf7a', 0.55)); }
  function win(g, x, y, night, w, h) { w = w || 2; h = h || 2; R(g, x, y, w, h, night ? '#ffd27a' : '#2a2230'); if (night) R(g, x - 1, y - 1, w + 2, h + 2, rgba('#ffc060', 0.25)); }
  /* Roofs over a box frame f */
  function gable(g, f, rh, c, cR, o) { // ridge runs along the front; the near slope faces the viewer, gable end on the right
    o = o || {}; var x = f.x - 1, y = f.y, w = f.w + 2, dx = f.dx, dy = f.dy, ry = y - rh - Math.round(dy * 0.5), rx = Math.round(dx * 0.5);
    P(g, [x, y + 1, x + w, y + 1, x + w + rx, ry, x + rx, ry], c);                                              // near slope
    for (var j = y; j > ry; j -= 2) R(g, x + (y - j) * rx / (y - ry + 0.01), j, w, 1, rgba(shade(c, -0.35), 0.45)); // tile courses
    P(g, [x + w, y + 1, x + w + dx, y - dy + 1, x + w + rx, ry], cR);                                            // gable end, shaded
    L(g, x + rx, ry + 0.5, x + w + rx, ry + 0.5, shade(c, 0.35));                                               // sunlit ridge
    L(g, x, y + 1.5, x + w, y + 1.5, shade(c, -0.45));                                                          // eave shadow line
    if (o.horns) { L(g, x + w + rx, ry, x + w + rx + 3, ry - 4, '#3b2a1e', 1.5); L(g, x + w + rx, ry, x + w + rx - 3, ry - 4, '#3b2a1e', 1.5); }
    return { rx: x + rx, ry: ry, w: w };
  }
  function frontGable(g, f, rh, c, cR, wallC) { // gable end faces the viewer (temple front): pediment on the front, slope to the right
    var x = f.x - 1, y = f.y, w = f.w + 2, dx = f.dx, dy = f.dy, ax = x + w / 2, ay = y - rh;
    P(g, [ax, ay, x + w, y + 1, x + w + dx, y - dy + 1, ax + dx, ay - dy], cR);
    for (var i = 1; i < 6; i++) L(g, ax + dx * i / 6, ay - dy * i / 6, x + w + dx * i / 6, y + 1 - dy * i / 6, rgba(shade(cR, -0.3), 0.6));
    P(g, [x, y + 1, ax, ay, x + w, y + 1], c); P(g, [x + 3, y, ax, ay + 3, x + w - 3, y], wallC || shade(c, 0.1));
    L(g, x, y + 1, ax, ay, shade(c, 0.3)); L(g, ax, ay, ax + dx, ay - dy, shade(cR, 0.4));
    return { ax: ax, ay: ay };
  }
  function hip(g, f, rh, c, cR, over) { // hipped roof with deep eaves (over px overhang)
    var x = f.x - over, y = f.y + 1, w = f.w + over * 2, dx = f.dx, dy = f.dy, inset = Math.round(rh * 0.9);
    P(g, [x, y + 1, x + w, y + 1, x + w - inset + dx * 0.5, y - rh - dy * 0.5, x + inset + dx * 0.5, y - rh - dy * 0.5], c);
    for (var j = y; j > y - rh; j -= 2) R(g, x + (y - j) * 0.7, j, w - (y - j) * 1.2, 1, rgba(shade(c, -0.3), 0.4));
    P(g, [x + w, y + 1, x + w + dx, y - dy + 1, x + w - inset + dx * 0.5, y - rh - dy * 0.5], cR);
    L(g, x, y + 1.5, x + w, y + 1.5, shade(c, -0.5));
    return { x: x, w: w };
  }
  function cone(g, cx, y, rx, rh, c, r) { // conical thatch over a round wall
    var gr = grad(g, cx - rx, 0, cx + rx, 0, [[0, shade(c, 0.18)], [0.45, c], [1, shade(c, -0.38)]]);
    g.fillStyle = gr; g.beginPath(); g.moveTo(cx - rx - 2, y); g.quadraticCurveTo(cx - rx * 0.3, y - rh * 0.55, cx, y - rh); g.quadraticCurveTo(cx + rx * 0.3, y - rh * 0.55, cx + rx + 2, y); g.quadraticCurveTo(cx, y + rx * 0.42, cx - rx - 2, y); g.fill();
    for (var i = 0; i < rx * 2.5; i++) { var t = r(), a = cx - rx + t * rx * 2, k = 0.3 + r() * 0.6; L(g, a, y + 1 - Math.abs(t - 0.5) * 2, a + (cx - a) * k, y - rh * k + 1, rgba(shade(c, r() > 0.5 ? -0.3 : 0.2), 0.55)); }
    E(g, cx, y + 1, rx + 2, 1.5, rgba(shade(c, -0.5), 0.7), 0, Math.PI);
  }
  function shadowOf(g, x, y, w, h) { // contact + cast shadow toward the lower right
    g.fillStyle = 'rgba(16,12,28,0.30)'; g.beginPath(); g.moveTo(x - 1, y + 1); g.lineTo(x + w + 2, y + 1); g.lineTo(x + w + 2 + h * 0.6, y + 2 + h * 0.3); g.lineTo(x + h * 0.6, y + 2 + h * 0.3); g.closePath(); g.fill();
  }
  function rubble(g, x, y, w, m, r, n) { for (var i = 0; i < (n || 6); i++) { var bx = x + r() * w, s = 1 + r() * 2.5; R(g, bx, y - s, s + 1, s, r() > 0.5 ? m.f : m.s); R(g, bx, y - s, s + 1, 1, m.t); } }

  /* ---------------------------------------------------------------- props shared by the kits */
  var PROP = {
    cypress: function (g, x, y) { E(g, x + 2, y + 1, 4, 1.5, 'rgba(16,12,28,0.3)'); g.fillStyle = grad(g, x - 3, 0, x + 3, 0, [[0, '#5b7d43'], [1, '#2a4524']]); g.beginPath(); g.moveTo(x, y - 18); g.quadraticCurveTo(x + 4, y - 8, x + 1, y); g.lineTo(x - 1, y); g.quadraticCurveTo(x - 4, y - 8, x, y - 18); g.fill(); },
    palm: function (g, x, y, r) { E(g, x + 4, y + 1, 5, 1.5, 'rgba(16,12,28,0.3)'); g.strokeStyle = '#7a5a34'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - 2, y - 9, x + 1, y - 17); g.stroke(); for (var i = 0; i < 6; i++) { var a = -Math.PI * 0.95 + i * 0.36; g.strokeStyle = i % 2 ? '#3f7a34' : '#5b9a42'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 1, y - 17); g.quadraticCurveTo(x + 1 + Math.cos(a) * 5, y - 20 + Math.sin(a) * 3, x + 1 + Math.cos(a) * 8, y - 15 + Math.sin(a) * 4); g.stroke(); } R(g, x, y - 16, 2, 2, '#8a5a2a'); },
    pine: function (g, x, y) { E(g, x + 3, y + 1, 5, 1.5, 'rgba(16,12,28,0.3)'); R(g, x - 0.5, y - 4, 1.5, 4, '#4a3020'); for (var i = 0; i < 3; i++) P(g, [x - 6 + i * 1.5, y - 3 - i * 4, x + 0.5, y - 10 - i * 4, x + 7 - i * 1.5, y - 3 - i * 4], i % 2 ? '#2f5434' : '#3e6a3e'); P(g, [x + 0.5, y - 10, x + 7, y - 3, x + 2, y - 3], 'rgba(10,20,10,0.25)'); },
    broadleaf: function (g, x, y) { E(g, x + 4, y + 1, 7, 2, 'rgba(16,12,28,0.3)'); R(g, x - 0.5, y - 6, 2, 6, '#4a3020'); E(g, x, y - 10, 6, 5, '#3e6a32'); E(g, x - 2, y - 12, 4, 3, '#5a8a40'); E(g, x + 3, y - 8, 3, 3, '#2e5226'); },
    reeds: function (g, x, y) { for (var i = 0; i < 6; i++) L(g, x + i, y, x + i + (i % 2 ? 1 : -1), y - 5 - (i % 3), i % 2 ? '#8a9a4a' : '#6a7a3a'); },
    woodpile: function (g, x, y) { for (var i = 0; i < 3; i++) for (var j = 0; j < 3 - i; j++) { E(g, x + j * 3 + i * 1.5, y - 1.5 - i * 2.5, 1.5, 1.4, '#7a5636'); R(g, x + j * 3 + i * 1.5 - 0.5, y - 2 - i * 2.5, 1, 1, '#c8a070'); } },
    fence: function (g, x, y, o) { var w = (o && o.w) || 14; for (var i = 0; i < w; i += 3) R(g, x + i, y - 4, 1, 4, '#5e4630'); R(g, x, y - 3, w, 1, '#7a5e40'); R(g, x, y - 1, w, 1, '#6a5038'); },
    hearth: function (g, x, y, o) { var night = o && o.night; E(g, x, y, 3.5, 1.6, '#5a5048'); E(g, x, y - 0.5, 2.2, 1, night ? '#ffb050' : '#e07030'); R(g, x - 0.5, y - 3, 1, 2, '#ffe0a0'); },
    altarSquare: function (g, x, y, o) { var night = o && o.night; R(g, x - 3, y - 3, 7, 3, '#b89a6a'); R(g, x - 3, y - 3, 7, 1, '#d8bc8a'); R(g, x - 1, y - 5, 3, 2, night ? '#ffc060' : '#e0602a'); R(g, x, y - 7, 1, 2, '#ffe8a0'); },
    torii: function (g, x, y) { R(g, x - 6, y - 12, 13, 1.5, '#2a1612'); R(g, x - 5, y - 11, 11, 1.5, '#d84a28'); R(g, x - 4, y - 8, 9, 1, '#d84a28'); R(g, x - 4, y - 10, 1.5, 10, '#c43e20'); R(g, x + 3, y - 10, 1.5, 10, '#c43e20'); R(g, x - 0.5, y - 10, 1, 2, '#d84a28'); R(g, x - 4.5, y - 1, 2.5, 1, '#2a1612'); R(g, x + 2.5, y - 1, 2.5, 1, '#2a1612'); },
    column: function (g, x, y) { R(g, x - 2, y - 1, 5, 1, '#c8c0aa'); R(g, x - 1, y - 13, 3, 12, '#f2ecd8'); R(g, x + 1, y - 13, 1, 12, '#c8c0aa'); R(g, x - 2, y - 14, 5, 1.5, '#e2dcc6'); },
    jar: function (g, x, y) { E(g, x, y - 2, 1.8, 2, '#b06a3a'); R(g, x - 1, y - 5, 2, 1, '#8a4a2a'); R(g, x - 1, y - 3, 1, 1, '#d89060'); },
    maize: function (g, x, y) { for (var i = 0; i < 4; i++) { L(g, x + i * 2, y, x + i * 2, y - 6, '#6a9a3a'); R(g, x + i * 2 - 1, y - 6, 1, 1, '#e0c040'); L(g, x + i * 2, y - 3, x + i * 2 + 2, y - 5, '#8aba4a'); } },
    canal: function (g, x, y, o) { var w = (o && o.w) || 14; R(g, x, y - 2, w, 3, '#3f8ea0'); R(g, x, y - 2, w, 1, '#7ac0cc'); R(g, x, y + 1, w, 1, '#6a5034'); },
    stele: function (g, x, y) { R(g, x - 1, y - 8, 3, 8, '#8c8a84'); R(g, x - 1, y - 8, 1, 8, '#b0aea6'); R(g, x, y - 9, 2, 1, '#8c8a84'); },
  };

  /* ---------------------------------------------------------------- ten architectural kits (+ three neutral biome kits)
   * house(g, x, y, v, o): x,y = front-left ground corner; v = { w, h, dep, r } from the composer; o = { night, ruined, cold }
   * big(g, x, y, tier, o): the civic monument at the back of the plaza from tier 3 (larger at tier 5)
   * wall: tier 4+ enclosure material; ground and lane colours; prop list for the culture marker beside the plaza */
  var KITS = {
    greek: { ground: '#c8b88a', lane: '#e0d4ae', wall: 'stoneWall', props: ['cypress', 'column', 'jar'],
      house: function (g, x, y, v, o) { var f = box(g, x, y, v.w, v.h, v.dep, MAT.lime, v.r); if (o.ruined) return ruinTop(g, f, MAT.lime, v.r);
        gable(g, f, 4 + (v.w > 14 ? 1 : 0), '#c2603e', '#8e3e28'); door(g, x + 2, y, 3, 5, o.night); win(g, x + v.w - 5, y - v.h + 3, o.night); if (v.w > 13) R(g, x + v.w - 1, y - 6, 1, 6, '#d8d0bc'); },
      big: function (g, x, y, tier, o) { var w = tier >= 5 ? 34 : 28, f = box(g, x, y - 3, w, 13, 9, MAT.marble, rng(7));
        R(g, x - 3, y - 3, w + 6, 3, '#d8d0b8'); R(g, x - 3, y - 3, w + 6, 1, '#f4f0e2'); R(g, x - 1, y - 6, w + 2, 3, '#e6e0cc');      // stylobate steps
        R(g, x + 3, y - 16, w - 6, 10, '#5a4e3e'); for (var i = 0; i < w; i += 4.4) { R(g, x + 1 + i, y - 16, 2.5, 10, '#f6f1e2'); R(g, x + 2.5 + i, y - 16, 1, 10, '#c4bba4'); }
        R(g, x, y - 18, w, 2, '#e8e2cc'); R(g, x, y - 17, w, 1, '#7a9ac8');
        var p = frontGable(g, { x: x, y: y - 18, w: w, dx: 9, dy: 5 }, 8, '#f2ecd8', '#b8543a', '#e2dac2'); R(g, p.ax - 1, p.ay - 2, 2, 2, '#e0b84a');
        if (o.night) R(g, x + 3, y - 15, w - 6, 9, rgba('#ffc870', 0.35)); }
    },
    norse: { ground: '#8f8a6c', lane: '#a89e7c', wall: 'palisade', props: ['pine', 'woodpile', 'pine'],
      house: function (g, x, y, v, o) { var w = v.w + 4, f = box(g, x, y, w, Math.max(5, v.h - 4), v.dep + 2, MAT.timber, v.r, { noTop: true }); if (o.ruined) return ruinTop(g, f, MAT.timber, v.r);
        var top = gable(g, f, 8, '#5d6a52', '#3c4636', { horns: true }); // turf-and-shingle roof almost to the ground, crossed gable horns
        for (var i = 0; i < 6; i++) R(g, f.x + v.r() * f.w, f.y - 1 - v.r() * 6, 2, 1, rgba('#9aa880', 0.6));
        if (o.cold) { P(g, [f.x, f.y - 2, f.x + f.w + 2, f.y - 2, top.rx + top.w, top.ry + 2, top.rx, top.ry + 2], 'rgba(240,246,252,0.75)'); }
        door(g, x + 3, y, 3, 4, o.night, '#2a1a10'); R(g, x + 2, y - 5, 5, 1, '#3a2616'); win(g, x + w - 4, y - 3, o.night, 2, 1); },
      big: function (g, x, y, tier, o) { var w = tier >= 5 ? 36 : 30, f = box(g, x, y, w, 7, 12, MAT.oak, rng(11), { noTop: true });
        for (var i = 3; i < w; i += 5) R(g, x + i, y - 7, 1.5, 7, '#3a2616');
        var t = gable(g, f, 14, '#56624c', '#353f30', { horns: true }); L(g, t.rx - 1, t.ry, t.rx - 4, t.ry - 5, '#3b2a1e', 1.5); L(g, t.rx - 1, t.ry, t.rx + 2, t.ry - 5, '#3b2a1e', 1.5);
        for (i = 0; i < 4; i++) R(g, t.rx + 5 + i * 7, t.ry + 2, 3, 1, '#2e3626');
        door(g, x + w / 2 - 2, y, 5, 6, o.night, '#22160c'); R(g, x + w / 2 - 3, y - 7, 7, 1, '#c8a050'); }
    },
    egyptian: { ground: '#d8c08a', lane: '#ead7a8', wall: 'mudWall', props: ['palm', 'palm', 'canal'],
      house: function (g, x, y, v, o) { var f = box(g, x, y, v.w, v.h, v.dep, MAT.mud, v.r); if (o.ruined) return ruinTop(g, f, MAT.mud, v.r);
        R(g, f.x, f.y - 1, f.w, 1, shade(MAT.mud.t, 0.08)); R(g, x, y - v.h + 1, v.w, 1, '#b08a50');                        // parapet and cornice
        if (v.w > 12) { R(g, f.x + f.dx + 2, f.y - f.dy - 4, 1, 4, '#7a5a34'); R(g, f.x + f.dx + 7, f.y - f.dy - 4, 1, 4, '#7a5a34'); R(g, f.x + f.dx + 1, f.y - f.dy - 5, 8, 1, '#9a8a50'); } // roof-terrace shelter
        door(g, x + 2, y, 3, 5, o.night); win(g, x + v.w - 4, y - v.h + 2, o.night, 2, 1); R(g, x + 1, y - v.h + 4, v.w - 2, 1, rgba('#2f6fb3', 0.35)); },
      big: function (g, x, y, tier, o) { var w = tier >= 5 ? 36 : 30, half = w / 2 - 4; // pylon gateway: two battered towers and a lintel
        [0, w / 2 + 4].forEach(function (ox, k) { var x0 = x + ox; P(g, [x0, y, x0 + 2, y - 22, x0 + half - 2, y - 22, x0 + half, y], k ? '#d4b47c' : '#e6cc94'); texture(g, 'blocks', x0 + 2, y - 22, half - 4, 22, '#e2c48c', rng(3 + k));
          R(g, x0 + 2, y - 23, half - 4, 2, '#f2dcaa'); R(g, x0 + 2, y - 19, half - 4, 1, '#2f6fb3'); R(g, x0 + 2, y - 18, half - 4, 1, '#c8a040');
          P(g, [x0 + half, y, x0 + half + 4, y - 2, x0 + half + 2, y - 24, x0 + half - 2, y - 22], '#a8885a'); });
        R(g, x + half, y - 15, 8 + 0, 3, '#c8a878'); R(g, x + half + 1, y - 12, 6, 12, o.night ? '#ffc870' : '#3a2a1a'); R(g, x + half, y - 16, 8, 1, '#2f6fb3');
        R(g, x + 1, y - 30, 1, 8, '#7a5a34'); P(g, [x + 2, y - 30, x + 6, y - 29, x + 2, y - 27], '#2f6fb3'); }
    },
    mesopotamian: { ground: '#cdb27e', lane: '#e2cc9a', wall: 'mudWall', props: ['reeds', 'palm', 'reeds'],
      house: function (g, x, y, v, o) { var f = box(g, x, y, v.w, v.h, v.dep, MAT.adobe, v.r); if (o.ruined) return ruinTop(g, f, MAT.adobe, v.r);
        for (var i = 2; i < v.w - 1; i += 3) R(g, x + i, y - v.h + 1, 1, v.h - 2, shade(MAT.adobe.f, -0.12)); // niched buttress pattern
        R(g, f.x - 1, f.y - 1, f.w + 2, 1, shade(MAT.adobe.t, 0.1)); door(g, x + v.w / 2 - 1, y, 3, 5, o.night); },
      big: function (g, x, y, tier, o) { var w = tier >= 5 ? 38 : 32, m = MAT.mud, r = rng(5); // stepped terraces with a central stair and a top shrine
        for (var k = 0; k < 3; k++) { var ww = w - k * 10, xx = x + k * 5; box(g, xx, y - k * 7, ww, 7, 8 - k, m, r); for (var i = 2; i < ww; i += 3) R(g, xx + i, y - k * 7 - 6, 1, 5, shade(m.f, -0.14)); R(g, xx, y - k * 7 - 7, ww, 1, '#4b3d9a'); }
        R(g, x + w / 2 - 2, y - 21, 4, 21, '#e6cc96'); for (var j = y; j > y - 21; j -= 2) R(g, x + w / 2 - 2, j, 4, 1, '#a8885a');
        box(g, x + w / 2 - 5, y - 21, 10, 6, 5, MAT.adobe, r); R(g, x + w / 2 - 1, y - 25, 2, 4, o.night ? '#ffc870' : '#4a3424'); R(g, x + w / 2 - 6, y - 28, 12, 1, '#e8c15a'); }
    },
    irish: { ground: '#7f9a5a', lane: '#a8b07a', wall: 'bank', props: ['broadleaf', 'stele', 'fence'],
      house: function (g, x, y, v, o) { var rx = Math.round(v.w / 2) + 1, cx = x + rx, h = Math.max(4, v.h - 4);
        g.fillStyle = grad(g, cx - rx, 0, cx + rx, 0, [[0, MAT.wattle.t], [0.5, MAT.wattle.f], [1, MAT.wattle.s]]); g.fillRect(cx - rx, y - h, rx * 2, h); E(g, cx, y, rx, rx * 0.35, MAT.wattle.s, 0, Math.PI);
        texture(g, 'wattle', cx - rx, y - h, rx * 2, h, MAT.wattle.f, v.r);
        if (o.ruined) { R(g, cx - rx, y - h - 1, rx * 2, 1, '#3a2e20'); return; }
        cone(g, cx, y - h + 1, rx, rx + 5, '#a48a4c', v.r); door(g, cx - 1, y + 1, 3, 4, o.night, '#2a1e12'); },
      big: function (g, x, y, tier, o) { var rx = tier >= 5 ? 17 : 14, cx = x + rx + 2, r = rng(9); // great round hall with a porch
        g.fillStyle = grad(g, cx - rx, 0, cx + rx, 0, [[0, '#e8dcc0'], [0.5, '#d2c4a4'], [1, '#9e8e70']]); g.fillRect(cx - rx, y - 8, rx * 2, 8); E(g, cx, y, rx, 4, '#9e8e70', 0, Math.PI); texture(g, 'wattle', cx - rx, y - 8, rx * 2, 8, '#d6c7a8', r);
        cone(g, cx, y - 7, rx, rx + 9, '#9a8044', r); R(g, cx - 3, y - 7, 6, 7, '#5a4430'); R(g, cx - 2, y - 6, 4, 6, o.night ? '#ffc070' : '#2a1e12'); P(g, [cx - 5, y - 7, cx, y - 11, cx + 5, y - 7], '#8a7040'); }
    },
    mexica: { ground: '#c8b48a', lane: '#e6dcc0', wall: 'paintWall', props: ['maize', 'canal', 'jar'],
      house: function (g, x, y, v, o) { var f = box(g, x, y, v.w, v.h, v.dep, MAT.paint, v.r); if (o.ruined) return ruinTop(g, f, MAT.paint, v.r);
        R(g, x, y - v.h + 1, v.w, 1, '#12a38c'); R(g, x, y - v.h + 2, v.w, 1, '#d84a28'); R(g, x, y - 2, v.w, 1, '#c8a040');      // painted bands
        R(g, f.x, f.y - 1, f.w, 1, '#fffaf0'); door(g, x + 2, y, 3, 5, o.night); },
      big: function (g, x, y, tier, o) { var w = tier >= 5 ? 36 : 30, r = rng(13); // stepped platform with a twin stair and two small temples (dual shrine form, no rite shown)
        for (var k = 0; k < 4; k++) { var ww = w - k * 6, xx = x + k * 3; box(g, xx, y - k * 5, ww, 5, 7, MAT.paint, r, { noTop: k < 3 }); R(g, xx, y - k * 5 - 1, ww, 1, k % 2 ? '#d84a28' : '#12a38c'); }
        [w / 2 - 6, w / 2 + 2].forEach(function (sx) { R(g, x + sx, y - 20, 4, 20, '#f4ecdc'); for (var j = y; j > y - 20; j -= 2) R(g, x + sx, j, 4, 1, '#b8ac94'); });
        box(g, x + 7, y - 20, 8, 7, 4, MAT.paint, r); P(g, [x + 6, y - 27, x + 11, y - 32, x + 16, y - 27], '#12a38c'); box(g, x + w - 15, y - 20, 8, 7, 4, MAT.paint, r); P(g, [x + w - 16, y - 27, x + w - 11, y - 32, x + w - 6, y - 27], '#d84a28');
        if (o.night) { R(g, x + 9, y - 25, 3, 4, '#ffc870'); R(g, x + w - 13, y - 25, 3, 4, '#ffc870'); } }
    },
    hittite: { ground: '#a8a08a', lane: '#c2baa2', wall: 'stoneWall', props: ['stele', 'broadleaf', 'stele'],
      house: function (g, x, y, v, o) { var f = box(g, x, y, v.w, v.h, v.dep, MAT.grey, v.r); if (o.ruined) return ruinTop(g, f, MAT.grey, v.r);
        R(g, x, y - 3, v.w, 3, '#7e796f'); R(g, x, y - 3, v.w, 1, '#a8a296');                                              // stone socle under the upper wall
        R(g, f.x - 1, f.y - 1, f.w + 2, 1, '#c8c2b6'); for (var i = 0; i < 3; i++) R(g, f.x + 2 + i * 4, f.y - 2, 2, 1, '#6a5a48'); // roof beam ends
        door(g, x + 2, y, 3, 5, o.night); win(g, x + v.w - 4, y - v.h + 3, o.night, 2, 1); },
      big: function (g, x, y, tier, o) { var w = tier >= 5 ? 38 : 32, r = rng(17); // gate between two crenellated towers, polygonal masonry
        box(g, x, y, w, 10, 8, MAT.grey, r);
        [x - 2, x + w - 10].forEach(function (tx) { box(g, tx, y + 1, 12, 20, 7, MAT.stone, r); for (var i = 0; i < 12; i += 4) R(g, tx + i, y - 21, 2, 2, '#c2bdb1'); });
        P(g, [x + w / 2 - 5, y, x + w / 2 - 5, y - 9, x + w / 2, y - 13, x + w / 2 + 5, y - 9, x + w / 2 + 5, y], o.night ? '#ffc870' : '#2a2620');
        E(g, x + w / 2, y - 16, 2.5, 2.5, '#d9a441'); }
    },
    yoruba: { ground: '#b88a5a', lane: '#d0a878', wall: 'earthWall', props: ['broadleaf', 'jar', 'broadleaf'],
      house: function (g, x, y, v, o) { var f = box(g, x, y, v.w, v.h - 1, v.dep, MAT.mudred, v.r, { noTop: true }); if (o.ruined) return ruinTop(g, f, MAT.mudred, v.r);
        hip(g, f, 5, '#8a6a3a', '#5e4424', 2); for (var i = 0; i <= v.w; i += Math.max(4, v.w / 3)) { R(g, x + i - 0.5, y - v.h + 2, 1.5, v.h - 2, '#5a3a20'); R(g, x + i - 0.5, y - v.h + 4, 1.5, 1, '#e0b84a'); } // veranda on carved posts
        door(g, x + v.w / 2 - 1, y, 3, 5, o.night); },
      big: function (g, x, y, tier, o) { var w = tier >= 5 ? 38 : 32, r = rng(19); // compound: walls round an open courtyard, hipped roofs on carved posts
        E(g, x + w / 2 + 4, y - 7, w / 2 - 4, 5, '#d8c0a0'); E(g, x + w / 2 + 4, y - 7, 4, 2, '#4aa8c8');
        var b = box(g, x, y - 12, w, 6, 6, MAT.mudred, r, { noTop: true }); hip(g, b, 5, '#8a6a3a', '#5e4424', 2);
        box(g, x - 2, y, 10, 7, 4, MAT.mudred, r); box(g, x + w - 8, y, 10, 7, 4, MAT.mudred, r);
        for (var i = 2; i < w; i += 5) { R(g, x + i, y - 17, 1.5, 6, '#5a3a20'); R(g, x + i, y - 15, 1.5, 1, '#e0b84a'); }
        door(g, x + w / 2 - 1, y - 12, 4, 5, o.night); }
    },
    japanese: { ground: '#9aa078', lane: '#c8c0a0', wall: 'hedge', props: ['pine', 'torii', 'pine'],
      house: function (g, x, y, v, o) { R(g, x, y - 2, v.w + v.dep, 2, '#5a4030'); var f = box(g, x, y - 2, v.w, v.h - 2, v.dep, MAT.plaster, v.r, { noTop: true }); if (o.ruined) return ruinTop(g, f, MAT.plaster, v.r);
        var h = hip(g, f, 5, '#3c3a3a', '#262424', 3); L(g, h.x - 1, f.y + 1, h.x - 3, f.y - 2, '#3c3a3a', 1.5); L(g, h.x + h.w + f.dx + 1, f.y - f.dy + 1, h.x + h.w + f.dx + 3, f.y - f.dy - 2, '#262424', 1.5); // upturned eaves
        if (o.night) R(g, x + 2, y - v.h + 2, v.w - 4, 3, rgba('#ffd890', 0.7)); door(g, x + 2, y - 2, 3, 4, false, '#4a3626'); },
      big: function (g, x, y, tier, o) { var w = tier >= 5 ? 32 : 28, r = rng(23); // raised hall with a two-tier hip-and-gable roof
        R(g, x - 2, y - 3, w + 12, 3, '#5a4030'); for (var i = 0; i < w; i += 5) R(g, x + i, y - 3, 1.5, 3, '#2a1a10');
        var f = box(g, x, y - 3, w, 9, 10, MAT.plaster, r, { noTop: true }); if (o.night) R(g, x + 2, y - 11, w - 4, 6, rgba('#ffd890', 0.6));
        hip(g, f, 6, '#3a3838', '#242222', 4); var f2 = box(g, x + 6, y - 15, w - 12, 4, 7, MAT.plaster, r, { noTop: true }); var h2 = hip(g, f2, 6, '#3a3838', '#242222', 3);
        L(g, h2.x - 1, f2.y + 1, h2.x - 4, f2.y - 3, '#3a3838', 2); L(g, f.x - 4, f.y + 2, f.x - 7, f.y - 2, '#3a3838', 2); R(g, x + w / 2 - 1, y - 30, 2, 3, '#c8a050'); }
    },
    vedic: { ground: '#b8a272', lane: '#d2bf8e', wall: 'thorn', props: ['altarSquare', 'broadleaf', 'hearth'],
      house: function (g, x, y, v, o) { var f = box(g, x, y, v.w, v.h - 2, v.dep, MAT.adobe, v.r, { noTop: true }); if (o.ruined) return ruinTop(g, f, MAT.adobe, v.r);
        // barrel-vaulted thatch: a curved roof bulging over the walls, ridge pole visible
        var rh = 6, x0 = f.x - 2, w = f.w + 4; g.fillStyle = grad(g, 0, f.y - rh, 0, f.y + 1, [[0, '#d4b870'], [1, '#9a7e42']]); g.beginPath(); g.moveTo(x0, f.y + 1); g.quadraticCurveTo(x0 + w / 2, f.y - rh * 2, x0 + w, f.y + 1); g.fill();
        P(g, [x0 + w, f.y + 1, x0 + w + f.dx, f.y - f.dy + 1, x0 + w / 2 + f.dx, f.y - rh - f.dy, x0 + w / 2, f.y - rh], '#8a6e38');
        for (var i = 0; i < w; i += 2) L(g, x0 + i, f.y, x0 + w / 2, f.y - rh + 1, rgba('#6a5228', 0.35));
        door(g, x + v.w / 2 - 1, y, 3, 4, o.night); },
      big: function (g, x, y, tier, o) { var w = tier >= 5 ? 36 : 30, r = rng(29); // open hall on posts sheltering the three fires
        R(g, x - 3, y - 2, w + 10, 2, '#a8905a'); [[x + 5, 'round'], [x + w / 2 + 2, 'square'], [x + w - 2, 'half']].forEach(function (a) {
          if (a[1] === 'round') E(g, a[0], y - 3, 3, 1.4, '#9a8a5a'); else if (a[1] === 'square') R(g, a[0] - 3, y - 5, 6, 3, '#9a8a5a'); else E(g, a[0], y - 3, 3, 2, '#9a8a5a', Math.PI, 0);
          P(g, [a[0] - 1.5, y - 4, a[0], y - 9, a[0] + 1.5, y - 4], o.night ? '#ffc060' : '#e06a2a'); R(g, a[0] - 0.5, y - 7, 1, 2, '#fff0a0'); });
        for (var i = 0; i <= w; i += w / 4) { R(g, x + i, y - 14, 1.5, 12, '#6a4a2a'); }
        g.fillStyle = grad(g, 0, y - 24, 0, y - 13, [[0, '#d8bc74'], [1, '#9a7e42']]); g.beginPath(); g.moveTo(x - 3, y - 13); g.quadraticCurveTo(x + w / 2, y - 30, x + w + 3, y - 13); g.fill();
        P(g, [x + w + 3, y - 13, x + w + 10, y - 17, x + w / 2 + 7, y - 25, x + w / 2, y - 21], '#8a6e38'); R(g, x + w / 2 - 1, y - 23, 2, 2, '#e8c15a'); }
    },
    // neutral towns (no patron yet) follow the land
    mud: { ground: '#c9ad7a', lane: '#dcc496', wall: 'mudWall', props: ['palm'], house: function (g, x, y, v, o) { var f = box(g, x, y, v.w, v.h, v.dep, MAT.adobe, v.r); if (o.ruined) return ruinTop(g, f, MAT.adobe, v.r); door(g, x + 2, y, 3, 5, o.night); win(g, x + v.w - 4, y - v.h + 3, o.night, 2, 1); } },
    timber: { ground: '#8f8a74', lane: '#a8a08a', wall: 'palisade', props: ['pine'], house: function (g, x, y, v, o) { var f = box(g, x, y, v.w, v.h - 2, v.dep, MAT.oak, v.r, { noTop: true }); if (o.ruined) return ruinTop(g, f, MAT.oak, v.r); gable(g, f, 6, '#5a6470', '#3a424c'); if (o.cold) R(g, f.x + 2, f.y - 4, f.w - 2, 1, 'rgba(240,246,252,0.8)'); door(g, x + 2, y, 3, 4, o.night); } },
    tile: { ground: '#b8a678', lane: '#d0c296', wall: 'stoneWall', props: ['broadleaf'], house: function (g, x, y, v, o) { var f = box(g, x, y, v.w, v.h, v.dep, MAT.lime, v.r, { noTop: true }); if (o.ruined) return ruinTop(g, f, MAT.lime, v.r); gable(g, f, 4, '#c0583a', '#8a3a28'); door(g, x + 2, y, 3, 5, o.night); win(g, x + v.w - 5, y - v.h + 3, o.night); } }
  };
  function ruinTop(g, f, m, r) { // broken wall-head, no roof, rubble at the foot
    g.save(); g.globalCompositeOperation = 'destination-out'; for (var i = 0; i < f.w + f.dx; i += 2) R(g, f.x + i, f.y - f.dy - 2, 2, 2 + r() * 5, '#000'); g.restore();
    R(g, f.x, f.y + 2, f.w, 1, shade(m.f, -0.45)); rubble(g, f.x - 2, f.y + 10 + 4, f.w + 6, m, r, 5);
  }
  var WALLS = {
    stoneWall: function (g, cx, cy, rx, ry) { ringWall(g, cx, cy, rx, ry, '#b4aea2', '#868076', 3); },
    mudWall: function (g, cx, cy, rx, ry) { ringWall(g, cx, cy, rx, ry, '#d4b884', '#a8885a', 3); },
    paintWall: function (g, cx, cy, rx, ry) { ringWall(g, cx, cy, rx, ry, '#efe6d6', '#bcae94', 3); },
    earthWall: function (g, cx, cy, rx, ry) { ringWall(g, cx, cy, rx, ry, '#c07a4c', '#8a502e', 3); },
    palisade: function (g, cx, cy, rx, ry) { for (var a = 0.15; a < Math.PI * 0.85; a += 0.06) { var x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry; R(g, x, y - 5, 1.5, 5, a % 0.12 < 0.06 ? '#6a4c30' : '#7e5c3a'); R(g, x, y - 6, 1, 1, '#4a3420'); } },
    bank: function (g, cx, cy, rx, ry) { g.strokeStyle = '#5f7f3e'; g.lineWidth = 4; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, Math.PI * 0.08, Math.PI * 0.92); g.stroke(); g.strokeStyle = '#8aa85a'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(cx, cy - 1.5, rx, ry, 0, Math.PI * 0.08, Math.PI * 0.92); g.stroke(); },
    hedge: function (g, cx, cy, rx, ry) { for (var a = 0.12; a < Math.PI * 0.88; a += 0.1) E(g, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry - 1.5, 2.5, 2, a % 0.2 < 0.1 ? '#3e6a3e' : '#4e7a44'); },
    thorn: function (g, cx, cy, rx, ry) { for (var a = 0.12; a < Math.PI * 0.88; a += 0.08) { var x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry; L(g, x - 1, y, x + 1, y - 3, '#7a6a3a'); L(g, x + 1, y, x - 1, y - 3, '#8a7a4a'); } }
  };
  function ringWall(g, cx, cy, rx, ry, c, cs, h) {
    for (var a = Math.PI * 0.08; a < Math.PI * 0.92; a += 0.04) { var x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry; R(g, x, y - h, 2, h, a > Math.PI / 2 ? cs : c); R(g, x, y - h, 2, 1, shade(c, 0.15)); }
  }

  /* ---------------------------------------------------------------- village composer (P031/P032)
   * Canvas 144×104 (2×), ground centre (72, 76). Lanes leave the plaza toward the hex edges; plots line the lanes; the newest patron's
   * kit spreads from the plaza outward, older patrons keep the outer plots (layered history). Tier 3+: a civic monument closes the back
   * of the plaza and a well sits in it. Tier 4+: an enclosure in the culture's material. Decline: every third house stands roofless. */
  var VW2 = 144, VH2 = 104, VX2 = 72, VY2 = 76;
  function village(o) { // o: { id, tier, decline, night, cold, shrine, styles: [kitId per plot, inner first], current: kitId|null, biome }
    var c = cv(VW2, VH2), g = c.getContext('2d'), r = rng(o.id * 131 + o.tier), cur = KITS[o.current] || KITS[o.biome] || KITS.tile, base = KITS[o.biome] || KITS.tile;
    var ground = mix(base.ground, cur.ground, 0.6), lane = cur.lane;
    // worn ground under the town, then lanes
    var gr = g.createRadialGradient(VX2, VY2, 2, VX2, VY2, 30 + o.tier * 6); gr.addColorStop(0, rgba(shade(ground, 0.06), 0.85)); gr.addColorStop(0.7, rgba(ground, 0.45)); gr.addColorStop(1, rgba(ground, 0));
    g.fillStyle = gr; g.beginPath(); g.ellipse(VX2, VY2, 30 + o.tier * 7, 11 + o.tier * 2.5, 0, 0, 7); g.fill();
    var nl = Math.min(4, 1 + o.tier), lanes = [];
    for (var i = 0; i < nl; i++) lanes.push(-Math.PI * 0.9 + i * (Math.PI * 1.8 / Math.max(1, nl - 1)) + (r() - 0.5) * 0.4 + (i % 2 ? Math.PI : 0));
    g.lineCap = 'round';
    lanes.forEach(function (a) { var ex = VX2 + Math.cos(a) * 70, ey = VY2 + Math.sin(a) * 26; g.strokeStyle = rgba(shade(lane, -0.18), 0.6); g.lineWidth = 5; g.beginPath(); g.moveTo(VX2, VY2); g.quadraticCurveTo(VX2 + Math.cos(a) * 30, VY2 + Math.sin(a) * 9 + 3, ex, ey); g.stroke(); g.strokeStyle = rgba(lane, 0.85); g.lineWidth = 3; g.stroke(); });
    if (o.tier >= 2) { E(g, VX2, VY2, 9 + o.tier * 2, 4 + o.tier * 0.8, rgba(lane, 0.95)); E(g, VX2 - 2, VY2 - 1, 6 + o.tier, 2.5, rgba(shade(lane, 0.12), 0.8)); }
    var items = [];
    // plots: along the lanes, inner plots first
    var n = o.styles.length;
    // plots on rings round the plaza, evenly spaced with jitter; the back-centre slot is kept for the monument from tier 3
    var slots = [], ringN = [4, 6, 8, 10];
    for (var rk = 0; rk < 4 && slots.length < n + 2; rk++) for (var j = 0; j < ringN[rk]; j++) {
      var ang = (j + (rk % 2) * 0.5) / ringN[rk] * Math.PI * 2 + (r() - 0.5) * 0.35, rx = 21 + rk * 15;
      if (o.tier >= 3 && !o.shrine && Math.sin(ang) < -0.55 && Math.abs(Math.cos(ang)) < 0.5) continue;
      if (o.shrine && Math.sin(ang) < 0.1 && Math.cos(ang) > -0.25) continue; // the shrine stands behind the plaza on the right: keep plots clear of it
      if (o.shrine && o.tier >= 3 && Math.sin(ang) < 0 && Math.cos(ang) < -0.55) continue;
      slots.push({ x: VX2 + Math.cos(ang) * rx, y: VY2 + Math.sin(ang) * rx * 0.36 });
    }
    for (i = 0; i < n; i++) {
      var sl = slots[i], w = 11 + (r() * 5 | 0) + (o.tier >= 4 ? 1 : 0), h = 9 + (r() * 3 | 0);
      items.push({ k: 'house', x: Math.round(sl.x - w / 2 - 3), y: Math.round(sl.y + 4), w: w, h: h, dep: 6 + (r() * 2 | 0), style: o.styles[i], ruined: o.decline && i % 3 === 2, seed: r() * 1e6 | 0 });
    }
    if (o.tier >= 3) items.push({ k: 'big', x: o.shrine ? VX2 - 66 : VX2 - 15, y: o.shrine ? VY2 - 2 : VY2 - 9, style: o.current || o.biome, tier: o.tier });
    if (o.tier >= 3) items.push({ k: 'well', x: VX2, y: VY2 + 1 });
    (cur.props || []).forEach(function (pk, j) { if (j < Math.min(3, o.tier)) items.push({ k: 'prop', p: pk, x: VX2 + [-46, 44, -30][j] + (r() - 0.5) * 6, y: VY2 + [6, 4, 16][j] }); });
    items.sort(function (a, b) { return a.y - b.y; });
    // contact shadows first, so they sit under every neighbour
    items.forEach(function (it) { if (it.k === 'house') shadowOf(g, it.x, it.y, it.w + it.dep, it.h); if (it.k === 'big') shadowOf(g, it.x - 4, it.y, 44, 22); });
    if (o.tier >= 4 && cur.wall) (WALLS[cur.wall] || WALLS.stoneWall)(g, VX2, VY2 - 6, 62, 24);
    var chim = [];
    items.forEach(function (it) {
      var kit = KITS[it.style] || base, opt = { night: o.night, ruined: it.ruined, cold: o.cold };
      if (it.k === 'house') { var hr = rng(it.seed); outlined(g, it.w + 22, it.h + 30, 'rgba(26,18,22,0.55)', function (s) { kit.house(s, it.x, it.y, { w: it.w, h: it.h, dep: it.dep, r: hr }, opt); }, it.x - 8, it.y - it.h - 24); if (!it.ruined && chim.length < 3) chim.push([it.x + it.w / 2 + 2, it.y - it.h - 6]); }
      else if (it.k === 'big') { var bk = KITS[it.style] && KITS[it.style].big ? KITS[it.style] : null; if (bk) outlined(g, 64, 48, 'rgba(26,18,22,0.55)', function (s) { bk.big(s, it.x, it.y, it.tier, opt); }, it.x - 10, it.y - 40); else outlined(g, 64, 48, 'rgba(26,18,22,0.55)', function (s) { base.house(s, it.x + 4, it.y, { w: 22, h: 13, dep: 9, r: rng(3) }, opt); }, it.x - 10, it.y - 40); }
      else if (it.k === 'well') { E(g, it.x, it.y, 4, 2, '#8a8070'); E(g, it.x, it.y - 0.5, 2.8, 1.2, o.night ? '#ffe2a0' : '#4a8aa8'); R(g, it.x - 4, it.y - 4, 1, 4, '#5a4030'); R(g, it.x + 3, it.y - 4, 1, 4, '#5a4030'); R(g, it.x - 4, it.y - 5, 8, 1, '#6a4a30'); }
      else if (it.k === 'prop' && PROP[it.p]) PROP[it.p](g, Math.round(it.x), Math.round(it.y), { night: o.night, w: 14 });
    });
    // night: a warm lamp glow pooled on the plaza
    if (o.night) { var ng = g.createRadialGradient(VX2, VY2, 1, VX2, VY2, 26); ng.addColorStop(0, 'rgba(255,190,110,0.22)'); ng.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = ng; g.fillRect(VX2 - 30, VY2 - 20, 60, 34); }
    return { c: c, chim: chim, tier: o.tier, night: o.night };
  }

  /* ---------------------------------------------------------------- shrine families (P028–P030, P041), 88×100 (2×), base line y = 92
   * Each family is built from its own architecture. Conditions change the structure, not only the colour:
   *   healthy · fortified (a wall in the family's own material, gate, banners) · eclipsed (cold, darkened, the light occluded by a dark disc)
   *   damaged (breach in the roof, a fallen member, cracks, debris) · nearly toppled (leaning, roof mostly gone, shoring props)
   *   ruined (footings, stumps and rubble of that architecture) · restored (scaffold poles, fresh-material patches, garlands, a ladder) */
  var SH = {
    columns: { m: MAT.marble, draw: function (g, p, d, r) { // stepped platform, peristyle, pediment [G1]
      R(g, 8, 84, 72, 8, '#bdb39a'); R(g, 12, 78, 64, 6, '#d6ceb6'); R(g, 16, 74, 56, 4, '#ece6d2'); R(g, 8, 84, 72, 1, '#e6dec8'); R(g, 12, 78, 64, 1, '#f4f0e2');
      R(g, 20, 46, 48, 28, '#4e4434'); R(g, 30, 52, 28, 22, rgba(p.glow, 0.85)); R(g, 34, 56, 20, 18, rgba('#fff4d0', 0.6));
      for (var i = 0; i < 7; i++) { if (d >= 2 && i === 5) { R(g, 18 + i * 8.4, 66, 5, 8, '#e8e2ce'); continue; } if (d >= 3 && i === 1) continue; var cx = 17 + i * 8.4; R(g, cx, 46, 5, 28, '#f6f1e2'); R(g, cx + 3.5, 46, 1.5, 28, '#bdb49c'); for (var f = 1; f < 4; f += 2) R(g, cx + f, 47, 0.7, 26, '#ddd5c0'); R(g, cx - 1, 44, 7, 2, '#e8e2cc'); }
      if (d < 3) { R(g, 14, 40, 60, 5, '#ece6d2'); R(g, 14, 42, 60, 2, p.secondary); for (i = 16; i < 72; i += 4) R(g, i, 40, 2, 2, '#c8c0a8');
        P(g, [12, 40, 44, 22, 76, 40], '#f4eedc'); P(g, [20, 38, 44, 26, 68, 38], '#e2dac4'); R(g, 34, 33, 20, 3, rgba(p.accent, 0.8)); P(g, [44, 22, 76, 40, 84, 36, 52, 18], '#b8543a'); for (i = 0; i < 5; i++) L(g, 48 + i * 6, 20 + i * 3.4, 76 + i * 1.5, 40 - i * 0.8, rgba('#7a3020', 0.5)); R(g, 42, 18, 4, 4, p.accent);
        if (d === 2) { g.save(); g.globalCompositeOperation = 'destination-out'; P(g, [56, 24, 70, 32, 66, 40, 54, 36], '#000'); g.restore(); } }
      else { P(g, [12, 44, 36, 34, 52, 44], '#d8d2bc'); R(g, 50, 42, 26, 3, '#cfc8b2'); }
    } },
    hall: { m: MAT.timber, draw: function (g, p, d, r) { // timber hall, curved roof line, crossed gable finials, hearth stone [N5]
      R(g, 12, 58, 58, 32, '#4c3826'); texture(g, 'planks', 12, 58, 58, 32, '#4c3826', r); for (var i = 0; i < 6; i++) R(g, 13 + i * 11, 58, 2, 32, '#36261a');
      P(g, [70, 90, 80, 84, 80, 54, 70, 58], '#2e2218'); texture(g, 'planks', 70, 54, 10, 36, '#2e2218', r);
      R(g, 34, 66, 14, 24, rgba(p.glow, 0.95)); R(g, 36, 70, 10, 20, rgba('#fff0c0', 0.5)); R(g, 32, 64, 18, 2, '#2a1a10'); R(g, 18, 62, 7, 6, p.secondary); R(g, 58, 62, 7, 6, p.secondary);
      if (d < 3) { g.fillStyle = '#3a2c22'; g.beginPath(); g.moveTo(4, 60); g.quadraticCurveTo(42, 46, 42, 22); g.quadraticCurveTo(42, 46, 80, 60); g.fill(); P(g, [42, 22, 80, 60, 88, 55, 52, 17], '#2a2018'); for (var q = 1; q < 5; q++) L(g, 42 + q * 2.5, 22 - q * 1.2, 80 + q * 2, 60 - q * 1.2, 'rgba(70,52,36,0.6)');
        for (i = 0; i < 8; i++) R(g, 10 + i * 8, 44 + (i % 2) * 5 + Math.abs(i - 3.5) * 1.6, 8, 1, 'rgba(0,0,0,0.3)'); L(g, 42, 22, 32, 8, '#7a5634', 2.5); L(g, 42, 22, 52, 8, '#7a5634', 2.5); R(g, 30, 6, 3, 3, p.accent); R(g, 51, 6, 3, 3, p.accent);
        if (d === 2) { g.save(); g.globalCompositeOperation = 'destination-out'; P(g, [20, 50, 30, 38, 38, 44, 30, 56], '#000'); g.restore(); L(g, 20, 52, 38, 40, '#6a4a30', 1.5); } }
      else { P(g, [10, 64, 36, 44, 60, 64], '#2e2218'); L(g, 36, 44, 30, 30, '#5a3a20', 2); }
      R(g, 2, 60, 8, 30, '#7a7872'); R(g, 2, 60, 3, 30, '#9a9890'); R(g, 2, 59, 8, 2, '#aaa8a0');
    } },
    pylon: { m: MAT.sand, draw: function (g, p, d, r) { // twin battered pylons, relief bands, cavetto cornice, flagstaffs [E1]
      P(g, [6, 92, 12, 32, 32, 32, 36, 92], '#e2c48c'); texture(g, 'blocks', 12, 32, 20, 60, '#e2c48c', r);
      if (d < 3) { P(g, [48, 92, 52, 32, 72, 32, 78, 92], '#d0b07a'); texture(g, 'blocks', 52, 32, 20, 60, '#d0b07a', r); P(g, [72, 32, 76, 30, 82, 90, 78, 92], '#a88858'); }
      else { P(g, [48, 92, 52, 60, 68, 52, 78, 92], '#d0b07a'); rubble(g, 50, 92, 30, MAT.sand, r, 8); }
      [12, 52].forEach(function (x0, k) { if (k && d >= 3) return; R(g, x0 - 1, 30, 22, 3, '#f2dcaa'); R(g, x0, 33, 20, 2, '#c8a46a'); R(g, x0 + 1, 38, 18, 3, p.secondary); R(g, x0 + 1, 41, 18, 1, p.accent); for (var j = 0; j < 3; j++) { R(g, x0 + 3 + j * 6, 48, 3, 8, rgba('#7a5a30', 0.45)); R(g, x0 + 3 + j * 6, 62, 3, 8, rgba('#7a5a30', 0.45)); } });
      R(g, 32, 48, 20, 6, '#c8a878'); R(g, 32, 50, 20, 2, p.secondary); R(g, 36, 54, 12, 38, rgba(p.glow, 0.95)); R(g, 38, 58, 8, 34, rgba('#fff4d0', 0.5));
      if (d < 2) { [4, 82].forEach(function (fx) { R(g, fx, 14, 2, 78, '#e8cc90'); P(g, [fx + 2, 14, fx + 10, 16, fx + 2, 20], p.accent); }); }
      if (d === 2) { L(g, 18, 40, 24, 70, 'rgba(60,40,20,0.7)'); L(g, 60, 36, 56, 60, 'rgba(60,40,20,0.7)'); rubble(g, 6, 92, 30, MAT.sand, r, 6); }
    } },
    ziggurat: { m: MAT.mud, draw: function (g, p, d, r) { // mud-brick stepped terraces, triple stair, small top temple [M6]
      var m = MAT.mud; box(g, 4, 92, 74, 14, 8, m, r); box(g, 16, 78, 52, 14, 7, m, r); if (d < 3) box(g, 26, 64, 34, 12, 6, MAT.adobe, r);
      for (var x = 6; x < 76; x += 4) R(g, x, 80, 1, 11, rgba('#7a5a30', 0.3)); for (x = 18; x < 66; x += 4) R(g, x, 66, 1, 11, rgba('#7a5a30', 0.3));
      R(g, 4, 77, 74, 2, p.secondary); R(g, 16, 63, 52, 1, p.accent);
      R(g, 38, 50, 8, 42, '#e6cc96'); for (var y = 52; y < 92; y += 3) R(g, 38, y, 8, 1, '#a8885a'); P(g, [10, 92, 38, 66, 38, 70, 16, 92], '#dcc08c'); P(g, [76, 92, 46, 66, 46, 70, 70, 92], '#c8a874');
      if (d < 3) { box(g, 32, 52, 22, 14, 6, MAT.adobe, r); R(g, 38, 40, 10, 12, rgba(p.glow, 0.9)); R(g, 30, 36, 26, 3, p.secondary); R(g, 41, 28, 4, 8, p.accent);
        if (d === 2) { g.save(); g.globalCompositeOperation = 'destination-out'; P(g, [48, 36, 60, 38, 58, 48, 50, 46], '#000'); g.restore(); rubble(g, 50, 64, 14, m, r, 5); } }
      else { rubble(g, 28, 64, 30, m, r, 10); }
    } },
    enclosure: { m: MAT.wattle, draw: function (g, p, d, r) { // bank and ditch ring, mound, round timber hall [I6]
      E(g, 44, 80, 42, 13, '#4f7a3a'); E(g, 44, 78, 40, 11, '#6f9a4a'); E(g, 44, 80, 34, 9.5, '#2f4a24'); E(g, 44, 79, 27, 7.5, '#76a04e'); for (var i = 0; i < 30; i++) R(g, 12 + r() * 64, 70 + r() * 18, 1, 2, '#9ac070');
      if (d < 3) { var cx = 44, rx = 17; g.fillStyle = grad(g, cx - rx, 0, cx + rx, 0, [[0, '#7a5c40'], [0.5, '#5a4030'], [1, '#3a2a1c']]); g.fillRect(cx - rx, 60, rx * 2, 18); E(g, cx, 78, rx, 5, '#3a2a1c', 0, Math.PI); texture(g, 'planks', cx - rx, 60, rx * 2, 18, '#5a4030', r);
        cone(g, cx, 61, rx + 1, 26, '#9a8448', r); R(g, cx - 4, 66, 8, 13, rgba(p.glow, 0.9)); R(g, cx - 3, 68, 6, 11, rgba('#fff0c0', 0.5));
        if (d === 2) { g.save(); g.globalCompositeOperation = 'destination-out'; P(g, [46, 40, 58, 50, 54, 58, 44, 50], '#000'); g.restore(); L(g, 46, 46, 58, 56, '#4a3a20', 1.5); } }
      else { R(g, 30, 68, 10, 10, '#4a3424'); L(g, 44, 70, 54, 60, '#4a3424', 2); L(g, 40, 72, 46, 58, '#5a4430', 2); }
      R(g, 72, 58, 4, 22, '#8c8a84'); R(g, 72, 58, 1.5, 22, '#b0aea6'); R(g, 72, 57, 4, 2, p.accent);
    } },
    twin: { m: MAT.paint, draw: function (g, p, d, r) { // stepped platform, twin stair, two shrines side by side [X1]
      box(g, 6, 92, 72, 14, 8, MAT.paint, r); box(g, 14, 78, 56, 12, 7, MAT.paint, r); box(g, 22, 66, 40, 10, 6, MAT.paint, r);
      R(g, 6, 77, 72, 2, p.secondary); R(g, 14, 65, 56, 2, '#d84a28'); R(g, 22, 55, 40, 2, '#12a38c');
      [28, 48].forEach(function (sx) { R(g, sx, 52, 8, 40, '#f4ecdc'); for (var y = 54; y < 92; y += 3) R(g, sx, y, 8, 1, '#b8ac94'); });
      if (d < 3) { box(g, 22, 56, 18, 16, 5, MAT.paint, r); R(g, 26, 44, 9, 12, rgba(p.glow, 0.9)); P(g, [20, 40, 31, 28, 42, 40], p.secondary); R(g, 22, 38, 18, 2, '#12a38c');
        box(g, 48, 56, 18, 16, 5, MAT.paint, r); R(g, 52, 44, 9, 12, rgba(p.glow, 0.9)); P(g, [46, 40, 57, 28, 68, 40], '#d84a28'); R(g, 48, 38, 18, 2, '#e0b33a');
        if (d === 2) { g.save(); g.globalCompositeOperation = 'destination-out'; P(g, [52, 30, 66, 36, 62, 44, 54, 40], '#000'); g.restore(); rubble(g, 50, 66, 16, MAT.paint, r, 5); } }
      else { R(g, 24, 48, 14, 8, '#d8d0c0'); R(g, 52, 50, 10, 6, '#d8d0c0'); rubble(g, 22, 66, 40, MAT.paint, r, 8); }
    } },
    court: { m: MAT.stone, draw: function (g, p, d, r) { // polygonal stone gate between towers, walled court [H5]
      box(g, 4, 92, 76, 26, 6, MAT.grey, r);
      [8, 60].forEach(function (tx, k) { if (k && d >= 3) { rubble(g, 58, 92, 22, MAT.stone, r, 8); R(g, 60, 72, 18, 20, '#8a847a'); return; } box(g, tx, 92, 18, 56, 6, MAT.stone, r); for (var i = 0; i < 18; i += 6) R(g, tx + i, 32, 4, 4, '#c2bdb1'); R(g, tx + 6, 50, 4, 6, '#2a2620'); });
      if (d < 3) { P(g, [26, 92, 26, 58, 42, 46, 58, 58, 58, 92], '#2a2620'); R(g, 32, 66, 20, 26, rgba(p.glow, 0.75)); R(g, 36, 70, 12, 22, rgba('#fff0c0', 0.4)); R(g, 12, 24, 4, 6, p.accent); R(g, 64, 24, 4, 6, p.accent);
        if (d === 2) { L(g, 14, 40, 20, 80, 'rgba(30,24,20,0.8)'); L(g, 66, 44, 70, 70, 'rgba(30,24,20,0.8)'); g.save(); g.globalCompositeOperation = 'destination-out'; P(g, [60, 30, 78, 30, 78, 44, 66, 38], '#000'); g.restore(); rubble(g, 64, 92, 16, MAT.stone, r, 5); } }
      else { R(g, 26, 76, 32, 16, '#3a362e'); }
      E(g, 42, 40, 4, 4, p.accent); E(g, 41, 39, 1.5, 1.5, '#fff0c0');
    } },
    courtyard: { m: MAT.mudred, draw: function (g, p, d, r) { // compound round a courtyard, veranda on carved posts, rain basin, grove trees [Y5, Y1]
      PROP.broadleaf(g, 10, 62); PROP.broadleaf(g, 78, 58); E(g, 12, 44, 10, 9, '#2f5a2a'); E(g, 78, 40, 10, 9, '#3a6a30');
      box(g, 8, 92, 70, 28, 6, MAT.mudred, r, { noTop: true }); R(g, 20, 70, 46, 16, '#dcc8a4'); R(g, 34, 74, 16, 8, '#4aa8c8'); R(g, 34, 74, 16, 1, '#9fd8f0');
      if (d < 3) { var f = { x: 8, y: 64, w: 70, dx: 6, dy: 3 }; hip(g, f, 16, '#8a6a3a', '#5e4424', 4); for (var j = 6; j < 74; j += 3) L(g, 4 + j, 64, 14 + j * 0.8, 50, rgba('#5e4424', 0.4));
        for (var i = 0; i < 6; i++) { var px = 12 + i * 12; R(g, px, 64, 3, 14, '#5a3a20'); R(g, px, 67, 3, 2, p.accent); R(g, px, 72, 3, 1, '#e0b84a'); }
        R(g, 38, 52, 10, 12, rgba(p.glow, 0.9));
        if (d === 2) { g.save(); g.globalCompositeOperation = 'destination-out'; P(g, [56, 50, 72, 56, 70, 64, 58, 62], '#000'); g.restore(); rubble(g, 56, 92, 20, MAT.mudred, r, 5); } }
      else { P(g, [8, 66, 28, 54, 40, 66], '#6a4a2a'); R(g, 52, 64, 6, 12, '#5a3a20'); }
      R(g, 8, 90, 70, 2, p.secondary);
    } },
    honden: { m: MAT.plaster, draw: function (g, p, d, r) { // raised gabled honden on posts with crossed finials, torii before it [J6, J5]
      R(g, 26, 76, 50, 6, '#5a4030'); for (var i = 0; i < 6; i++) R(g, 28 + i * 9, 76, 2, 10, '#2a1a10');
      box(g, 26, 76, 44, 22, 8, { f: '#c84a2a', s: '#8a2a18', t: '#d8603a', tex: 'planks' }, r, { noTop: true }); for (i = 0; i < 4; i++) R(g, 28 + i * 12, 54, 3, 22, '#7a2414');
      R(g, 36, 58, 24, 18, rgba(p.glow, 0.85)); R(g, 24, 82, 52, 3, '#6a4a2a');
      if (d < 3) { P(g, [16, 56, 48, 34, 80, 56], '#3c3a3a'); P(g, [48, 34, 80, 56, 86, 50, 54, 30], '#262424'); for (i = 0; i < 6; i++) L(g, 20 + i * 5, 54 - i * 3, 76 - i * 5, 54 - i * 3, rgba('#5a5858', 0.6)); L(g, 48, 34, 40, 20, '#d8b878', 2); L(g, 48, 34, 56, 20, '#d8b878', 2); for (i = 0; i < 4; i++) E(g, 44 + i * 4, 33 - i, 1.5, 1.5, '#d8b878');
        if (d === 2) { g.save(); g.globalCompositeOperation = 'destination-out'; P(g, [24, 50, 36, 42, 40, 50, 30, 56], '#000'); g.restore(); } }
      else { P(g, [24, 60, 44, 50, 60, 62], '#3c3a3a'); }
      if (d < 2) { R(g, 2, 56, 24, 3, '#2a1612'); R(g, 3, 59, 22, 3, '#d84a28'); R(g, 5, 64, 18, 2, '#d84a28'); R(g, 6, 59, 3, 33, '#c43e20'); R(g, 19, 59, 3, 33, '#c43e20'); R(g, 13, 59, 2, 5, '#d84a28'); }
      else { R(g, 6, 76, 3, 16, '#a8402a'); R(g, 4, 90, 16, 2, '#a8402a'); }
      R(g, 28, 86, 46, 6, '#9a948a'); R(g, 28, 86, 46, 1, '#bab4aa');
    } },
    altar: { m: MAT.adobe, draw: function (g, p, d, r) { // open enclosure: round fire, square fire, grass-strewn vedi under a thatched shed [V2]
      R(g, 4, 80, 80, 12, '#b8a070'); R(g, 6, 81, 76, 2, '#d8c890'); for (var i = 0; i < 20; i++) R(g, 8 + r() * 72, 82 + r() * 8, 2, 1, '#9a8a50');
      E(g, 20, 78, 9, 4.5, '#9a8a5a'); E(g, 20, 77, 6, 2.5, '#6a5a3a'); R(g, 58, 70, 18, 10, '#9a8a5a'); R(g, 58, 70, 18, 2, '#b8a878'); P(g, [32, 80, 56, 80, 52, 72, 36, 72], '#7a9a4a'); for (i = 0; i < 10; i++) L(g, 36 + i * 2, 79, 38 + i * 2, 73, '#9aba5a');
      if (d < 3) { R(g, 8, 44, 4, 36, '#6a4a2a'); R(g, 76, 44, 4, 36, '#6a4a2a'); R(g, 42, 40, 3, 30, '#6a4a2a');
        g.fillStyle = grad(g, 0, 26, 0, 50, [[0, '#d8bc74'], [1, '#9a7e42']]); g.beginPath(); g.moveTo(2, 48); g.quadraticCurveTo(44, 16, 86, 48); g.lineTo(86, 52); g.quadraticCurveTo(44, 22, 2, 52); g.fill(); for (i = 0; i < 40; i++) L(g, 4 + i * 2, 50 - Math.sin(i / 40 * Math.PI) * 16, 4 + i * 2 + 1, 46 - Math.sin(i / 40 * Math.PI) * 16, rgba('#6a5228', 0.4));
        P(g, [20, 62, 25, 72, 20, 76, 15, 72], p.accent); R(g, 19, 67, 3, 4, '#fff0a0'); P(g, [67, 56, 73, 68, 67, 70, 61, 68], p.accent); R(g, 66, 62, 3, 4, '#fff0a0');
        if (d === 2) { g.save(); g.globalCompositeOperation = 'destination-out'; P(g, [56, 26, 76, 34, 72, 44, 58, 38], '#000'); g.restore(); L(g, 76, 44, 70, 76, '#6a4a2a', 3); } }
      else { L(g, 8, 60, 28, 52, '#6a4a2a', 3); L(g, 60, 78, 80, 60, '#5a3a20', 3); }
      R(g, 36, 36, 16, 2, p.secondary);
    } }
  };
  var CONDITIONS = A.ids.conditions;
  function shrine(art, pal, cond, spec) {
    var S = SH[art]; if (!S) throw new Error('no shrine art ' + art);
    var c = cv(88, 100), g = c.getContext('2d'), r = rng(art.length * 977 + 3);
    g.fillStyle = 'rgba(14,10,24,0.36)'; g.beginPath(); g.ellipse(46, 94, 40, 7, 0, 0, 7); g.fill(); // contact shadow, pushed right by the key light
    if (cond === 'ruined') { ruinShrine(g, art, S, pal, r); return c; }
    var dmg = cond === 'damaged' ? 2 : cond === 'nearlyToppled' ? 3 : 0;
    var body = function (s) { if (cond === 'nearlyToppled') { s.translate(44, 92); s.rotate(-0.07); s.translate(-44, -92); } S.draw(s, pal, dmg, rng(art.length * 31 + 7)); s.setTransform(1, 0, 0, 1, 0, 0); };
    outlined(g, 88, 100, 'rgba(22,14,20,0.7)', body);
    if (dmg) { // cracks and debris at the foot; nearly toppled gets shoring timbers propping the lean
      var rr = rng(art.length * 53 + dmg); for (var i = 0; i < 5 * dmg; i++) { var x = 14 + rr() * 60, y = 40 + rr() * 44; L(g, x, y, x + (rr() - 0.5) * 6, y + 3 + rr() * 6, 'rgba(24,16,10,0.7)'); }
      rubble(g, 10, 93, 68, S.m, rr, 6 * dmg);
      if (dmg === 3) { L(g, 78, 92, 62, 50, '#6a4a2a', 3); L(g, 84, 92, 70, 60, '#5a3a20', 2.5); L(g, 6, 92, 20, 56, '#6a4a2a', 3); R(g, 60, 48, 6, 3, '#4a3020'); }
    }
    if (cond === 'fortified') fortify(g, art, S, pal);
    if (cond === 'restored') { // scaffold poles lashed with cross-ties, a ladder, garlands; fresh material shows lighter
      for (i = 0; i < 4; i++) { R(g, 10 + i * 22, 36, 2, 56, '#c8a878'); R(g, 10 + i * 22, 36, 1, 56, '#e8d0a0'); } R(g, 8, 36, 70, 2, '#c8a878'); R(g, 8, 60, 70, 2, '#b89868');
      for (i = 0; i < 3; i++) L(g, 12 + i * 22, 38, 32 + i * 22, 60, rgba('#a88858', 0.9), 1.5); for (i = 40; i < 90; i += 5) R(g, 76, i, 8, 1.5, '#d8b888'); R(g, 76, 40, 1.5, 52, '#c8a878'); R(g, 83, 40, 1.5, 52, '#c8a878');
      for (i = 0; i < 9; i++) { E(g, 14 + i * 8, 34 + Math.sin(i * 1.3) * 2, 2, 2, i % 2 ? '#9fe07a' : '#ffd060'); }
    }
    if (spec === 'oracle') { R(g, 43, 4, 2, 12, '#8a6a3a'); L(g, 38, 16, 44, 8, '#8a6a3a', 1.5); L(g, 50, 16, 44, 8, '#8a6a3a', 1.5); E(g, 44, 6, 5, 4, '#efe6d2'); E(g, 44, 6, 3, 3, '#8a5ad8'); E(g, 44, 6, 1.4, 1.4, '#1a1020'); R(g, 42, 4, 1, 1, '#ffffff'); }
    if (spec === 'sanctuary') { g.strokeStyle = '#bab4a8'; g.lineWidth = 3; g.beginPath(); g.ellipse(44, 88, 42, 10, 0, Math.PI * 0.06, Math.PI * 0.94); g.stroke(); g.strokeStyle = '#e2dccf'; g.lineWidth = 1; g.beginPath(); g.ellipse(44, 86.5, 42, 10, 0, Math.PI * 0.06, Math.PI * 0.94); g.stroke(); R(g, 40, 95, 8, 4, '#6a6258'); }
    if (spec === 'beacon') { R(g, 82, 12, 3, 80, '#c8bca0'); R(g, 82, 12, 1, 80, '#e8dcc0'); R(g, 78, 8, 11, 5, '#6a5a48'); P(g, [79, 8, 83.5, -2, 88, 8], '#ffb040'); P(g, [81, 8, 83.5, 1, 86, 8], '#fff0a0'); }
    if (cond === 'eclipsed') { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(14,10,30,0.6)'; g.fillRect(0, 0, 88, 100); g.fillStyle = grad(g, 0, 0, 88, 0, [[0, 'rgba(150,170,255,0.18)'], [0.5, 'rgba(150,170,255,0)']]); g.fillRect(0, 0, 88, 100); g.globalCompositeOperation = 'source-over';
      E(g, 44, 12, 9, 9, 'rgba(255,200,120,0.75)'); E(g, 46, 12, 8.4, 8.4, '#0a0812'); }
    return c;
  }
  function fortify(g, art, S, pal) { // a wall in the family's own material across the front, a gate, corner towers and banners
    var m = S.m, r = rng(art.length * 7 + 1);
    box(g, 0, 98, 14, 16, 4, m, r); box(g, 70, 98, 14, 16, 4, m, r);
    R(g, 2, 88, 84, 10, m.f); texture(g, m.tex, 2, 88, 84, 10, m.f, r); R(g, 2, 88, 84, 1, m.t); for (var i = 2; i < 86; i += 6) R(g, i, 85, 3, 3, m.f);
    R(g, 38, 88, 12, 10, '#2a2018'); R(g, 37, 87, 14, 2, shade(m.f, -0.3));
    [6, 78].forEach(function (bx) { R(g, bx, 64, 1.5, 18, '#3a2a1a'); P(g, [bx + 1.5, 64, bx + 9, 66, bx + 1.5, 72], pal.secondary); R(g, bx + 1.5, 70, 6, 1, pal.accent); });
  }
  function ruinShrine(g, art, S, pal, r) { // footings, stumps and rubble that still read as that architecture
    var m = S.m; R(g, 10, 84, 68, 8, shade(m.f, -0.25)); R(g, 10, 84, 68, 1, shade(m.f, -0.05));
    outlined(g, 88, 100, 'rgba(22,14,20,0.6)', function (s) {
      var st = { columns: [[18, 16], [27, 10], [62, 20]], hall: [[16, 12], [64, 8]], pylon: [[10, 30], [56, 12]], ziggurat: [[10, 18], [30, 10]], enclosure: [[40, 6]], twin: [[20, 14], [50, 10]], court: [[10, 34], [62, 16]], courtyard: [[16, 12], [58, 8]], honden: [[30, 10], [62, 8]], altar: [[18, 6], [62, 8]] }[art] || [[20, 10]];
      st.forEach(function (sxy) { var w = art === 'columns' ? 5 : 9; R(s, sxy[0], 84 - sxy[1], w, sxy[1], m.f); R(s, sxy[0] + w - 2, 84 - sxy[1], 2, sxy[1], m.s); R(s, sxy[0], 84 - sxy[1], w, 1, m.t);
        s.save(); s.globalCompositeOperation = 'destination-out'; P(s, [sxy[0] - 1, 84 - sxy[1] - 1, sxy[0] + w + 1, 84 - sxy[1] - 1, sxy[0] + w + 1, 84 - sxy[1] + 4, sxy[0] + w / 2, 84 - sxy[1] + 1, sxy[0] - 1, 84 - sxy[1] + 3], '#000'); s.restore(); });
      rubble(s, 8, 92, 72, m, r, 22);
    });
    if (art === 'hall' || art === 'enclosure' || art === 'courtyard' || art === 'altar' || art === 'honden') for (var i = 0; i < 6; i++) L(g, 16 + i * 10, 88, 22 + i * 10, 80 - (i % 3) * 3, '#2a1e16', 2); // burnt timbers
    for (i = 0; i < 12; i++) R(g, 10 + r() * 68, 80 + r() * 12, 2, 1, '#5f8a3a');
  }

  /* ---------------------------------------------------------------- priest families (P042), 28×40 (2×), feet on y = 38
   * Frames: 0 idle · 1–4 walk (contact, passing, contact, passing; arms counter-swing, the robe hem sways, the head bobs one pixel on
   * passing frames) · 5 gesture (the calling's object raised). Callings read by silhouette: Emissary carries a tall staff with a pennant,
   * Seer a lantern of light on a crook, Warden a round shield and a short spear. */
  var DRESS = {
    chiton:   { robe: 'long', mantle: 'diag', head: 'band', skin: '#e2b98c' },
    cloak:    { robe: 'mid', mantle: 'cloak', head: 'hood', skin: '#e8cdb0' },
    linen:    { robe: 'long', mantle: 'collar', head: 'bare', skin: '#c89a6a', light: true },
    fringed:  { robe: 'tiers', mantle: 'wrap', head: 'cap', skin: '#c8946a' },
    brat:     { robe: 'mid', mantle: 'cape', head: 'bare', skin: '#ecd4b8' },
    tilmatli: { robe: 'short', mantle: 'knot', head: 'plume', skin: '#b8865a' },
    longrobe: { robe: 'long', mantle: 'none', head: 'tall', skin: '#d0a478' },
    agbada:   { robe: 'wide', mantle: 'none', head: 'cap', skin: '#8a5a3a' },
    kariginu: { robe: 'wide', mantle: 'sleeves', head: 'tall', skin: '#e8cca8' },
    dhoti:    { robe: 'short', mantle: 'shawl', head: 'bare', skin: '#b07a50' }
  };
  var FRAMES = 6;
  function priest(style, role, pal, frame) {
    var S = DRESS[style]; if (!S) throw new Error('no priest style ' + style);
    var c = cv(28, 40), g = c.getContext('2d');
    outlined(g, 28, 40, 'rgba(18,12,20,0.75)', function (s) { drawPriest(s, S, role, pal, frame || 0); });
    return c;
  }
  function drawPriest(g, S, role, pal, f) {
    var walk = f >= 1 && f <= 4, ph = walk ? [0, 1, 0, -1][f - 1] : 0, pass = walk && (f === 2 || f === 4), gest = f === 5;
    var cx = 13, bob = pass ? -1 : 0, top = 9 + bob;
    var body = S.light ? mix(pal.primary, '#ffffff', 0.35) : pal.secondary, dk = shade(body, -0.32), lt = shade(body, 0.22), trim = pal.accent;
    var hem = S.robe === 'short' ? 29 : S.robe === 'mid' ? 33 : 36, w = S.robe === 'wide' ? 15 : S.robe === 'tiers' ? 12 : 11;
    // legs and feet under the hem: stride by frame
    var stride = walk ? [3, 0, -3, 0][f - 1] : 0, legC = '#3a2a1c';
    if (hem < 37) { R(g, cx - 3 + stride * 0.5, hem, 2.5, 38 - hem, S.skin); R(g, cx + 1 - stride * 0.5, hem, 2.5, 38 - hem, shade(S.skin, -0.18)); }
    R(g, cx - 4 + stride * 0.6, 37, 4, 2, legC); R(g, cx + 1 - stride * 0.6, 37, 4, 2, shade(legC, -0.2));
    // robe: a flared trapezoid, lit left, folds as darker verticals, hem sways opposite the stride
    var sway = walk ? -stride * 0.4 : 0, x0 = cx - w / 2;
    P(g, [cx - 4, top + 6, cx + 5, top + 6, x0 + w + 1 + sway, hem, x0 - 1 + sway, hem], body);
    P(g, [cx + 1, top + 6, cx + 5, top + 6, x0 + w + 1 + sway, hem, cx + 2 + sway, hem], dk);
    L(g, cx - 3, top + 7, x0 + sway, hem - 1, lt);
    for (var k = 0; k < 3; k++) L(g, cx - 2 + k * 2.5, top + 10, cx - 3 + k * 3 + sway, hem - 1, rgba(shade(body, -0.45), 0.5));
    R(g, x0 - 1 + sway, hem - 1, w + 2, 1.5, trim);
    if (S.robe === 'tiers') for (var t = top + 12; t < hem - 2; t += 5) R(g, x0 + sway * 0.5, t, w, 1, trim);
    if (S.robe === 'wide') { P(g, [cx - 7, top + 7, cx - 4, top + 6, cx - 5, top + 20, cx - 9, top + 18], body); P(g, [cx + 5, top + 6, cx + 9, top + 8, cx + 10, top + 19, cx + 6, top + 20], dk); }
    // mantle and garment signatures
    if (S.mantle === 'diag') { P(g, [cx - 4, top + 6, cx + 1, top + 6, cx + 5, top + 16, cx + 2, top + 17], pal.primary); L(g, cx - 4, top + 6, cx + 3, top + 17, shade(pal.primary, 0.3)); }
    if (S.mantle === 'cloak' || S.mantle === 'cape') { P(g, [cx - 6, top + 5, cx + 6, top + 5, cx + 7 + sway, top + (S.mantle === 'cape' ? 18 : 24), cx - 7 + sway, top + (S.mantle === 'cape' ? 18 : 24)], shade(pal.dark, 0.2)); L(g, cx - 6, top + 6, cx - 7 + sway, top + 20, shade(pal.dark, 0.45)); R(g, cx - 1, top + 6, 2, 2, trim); }
    if (S.mantle === 'collar') { E(g, cx, top + 7, 5.5, 2.5, trim); E(g, cx, top + 7, 4, 1.5, pal.primary); }
    if (S.mantle === 'wrap') { R(g, x0, top + 10, w, 3, pal.primary); R(g, x0, top + 10, w, 1, shade(pal.primary, 0.3)); }
    if (S.mantle === 'knot') { P(g, [cx - 6, top + 5, cx + 6, top + 5, cx + 5, top + 20, cx - 5, top + 20], trim); R(g, cx + 3, top + 5, 3, 3, pal.primary); for (k = 0; k < 3; k++) R(g, cx - 4 + k * 3, top + 12, 2, 2, pal.primary); }
    if (S.mantle === 'shawl') { L(g, cx + 5, top + 6, cx - 4, top + 16, trim, 2); }
    if (S.mantle === 'sleeves') { R(g, cx - 9, top + 8, 4, 9, lt); R(g, cx + 6, top + 8, 4, 9, dk); R(g, cx - 9, top + 16, 4, 1, trim); R(g, cx + 6, top + 16, 4, 1, trim); }
    // arms: counter-swing while walking, raised in the gesture frame
    var armF = walk ? -stride * 0.7 : 0, armY = gest ? -7 : 0;
    L(g, cx - 4, top + 7, cx - 5 - armF * 0.3, top + 15 + armY - armF * 0.2, dk, 2.2); R(g, cx - 6 - armF * 0.3, top + 15 + armY - armF * 0.2, 2, 2, S.skin);
    // head: neck, face lit from the left, hair or headwear
    R(g, cx - 1, top + 4, 3, 2, shade(S.skin, -0.15)); E(g, cx + 0.5, top + 1, 3.6, 4, S.skin); E(g, cx + 2, top + 1.5, 1.8, 3, shade(S.skin, -0.2)); R(g, cx - 1.5, top + 1, 1, 1, '#2a1a14');
    var hc = '#2a1c14';
    if (S.head === 'bare') { P(g, [cx - 3, top - 1, cx + 4, top - 3, cx + 4.5, top + 1, cx - 3.5, top + 0.5], hc); }
    if (S.head === 'band') { P(g, [cx - 3, top - 1, cx + 4, top - 3, cx + 4.5, top + 1, cx - 3.5, top + 0.5], '#4a3020'); R(g, cx - 3.5, top - 1, 8, 1.2, trim); E(g, cx - 3, top - 1, 1.2, 1.2, '#6f9a3c'); }
    if (S.head === 'hood') { P(g, [cx - 5, top + 5, cx - 4, top - 3, cx + 1, top - 5, cx + 5, top - 2, cx + 5, top + 5, cx + 3, top + 4, cx + 3, top - 1, cx - 2, top - 1, cx - 3, top + 4], shade(pal.dark, 0.25)); }
    if (S.head === 'cap') { E(g, cx + 0.5, top - 2, 4.5, 2.5, trim); R(g, cx - 4, top - 2, 9, 1.5, shade(trim, -0.25)); }
    if (S.head === 'tall') { P(g, [cx - 3, top - 1, cx - 2, top - 8, cx + 3, top - 8, cx + 4, top - 1], pal.dark); R(g, cx - 3, top - 2, 7, 1, trim); }
    if (S.head === 'plume') { R(g, cx - 3.5, top - 2, 8, 2, trim); for (k = 0; k < 4; k++) L(g, cx + 1, top - 2, cx - 2 + k * 2.5, top - 9 - (k % 2) * 2, k % 2 ? pal.glow : '#3aa890', 1.5); }
    // the calling, held in the near (right) hand
    var hx = cx + 6 + armF * 0.3, hy = top + 15 + armY + armF * 0.2;
    if (role === 'seer') { L(g, hx + 1, hy + 18 - armY, hx + 1, hy - 14, '#8a6a3a', 1.6); L(g, hx + 1, hy - 14, hx + 4, hy - 12, '#8a6a3a', 1.6); R(g, hx + 3, hy - 12, 3, 4, '#c8a050'); E(g, hx + 4.5, hy - 9.5, 2.2, 2.2, pal.glow); R(g, hx + 4, hy - 10, 1, 1, '#ffffff'); }
    else if (role === 'warden') { L(g, hx + 2, hy + 14 - armY, hx + 2, hy - 16, '#6a4a2a', 1.4); P(g, [hx + 1, hy - 16, hx + 2, hy - 20, hx + 3, hy - 16], '#c8ccd0'); E(g, cx - 7, top + 14 + armY * 0.3, 4.5, 5.5, shade(pal.secondary, -0.1)); E(g, cx - 7, top + 14 + armY * 0.3, 3, 4, pal.accent); E(g, cx - 7, top + 14 + armY * 0.3, 1.2, 1.2, '#e8e2d0'); }
    else { L(g, hx + 1, hy + 18 - armY, hx + 1, hy - 18, '#6a4a2a', 1.6); P(g, [hx + 2, hy - 18, hx + 9, hy - 16, hx + 2, hy - 13], trim); R(g, hx, hy - 19, 3, 2, '#c8a050'); }
    L(g, cx + 5, top + 7, hx, hy, body, 2.2); R(g, hx - 1, hy - 1, 2.5, 2.5, S.skin);
  }

  /* ---------------------------------------------------------------- landmarks (P034), 64×56 (2×), base line y = 52 */
  var LM = {
    summit: function (g, r) { P(g, [2, 52, 24, 20, 34, 26, 48, 8, 62, 52], '#8a8478'); P(g, [48, 8, 62, 52, 40, 52, 44, 30], '#5a564e'); P(g, [24, 20, 34, 26, 30, 40, 20, 36], '#a8a294');
      P(g, [42, 16, 48, 8, 54, 18, 49, 16, 46, 20], '#f2f4f6'); P(g, [21, 24, 24, 20, 28, 24, 24, 26], '#e8ecf0'); for (var i = 0; i < 12; i++) L(g, 10 + r() * 40, 30 + r() * 20, 14 + r() * 40, 32 + r() * 20, rgba('#4a463e', 0.5));
      for (i = 0; i < 4; i++) R(g, 44 + (i % 2) * 2, 26 - i * 3, 6, 2, '#c8c0b0'); R(g, 50, 2, 1.5, 12, '#5a3a20'); P(g, [51.5, 2, 60, 4, 51.5, 7], '#e9c46a'); P(g, [51.5, 7, 58, 8.5, 51.5, 10], '#9fd2ff'); },
    spring: function (g, r) { E(g, 32, 44, 26, 9, 'rgba(14,10,24,0.3)'); E(g, 32, 42, 23, 8, '#7a7468'); E(g, 32, 41, 20, 6.5, '#3f8ea0'); E(g, 30, 40, 14, 4, '#5aaabb'); E(g, 26, 39, 6, 1.5, '#bfe8f0');
      for (var a = 0; a < 6.3; a += 0.42) { var x = 32 + Math.cos(a) * 21, y = 42 + Math.sin(a) * 7; R(g, x - 1.5, y - 2, 4, 3, a > 3.14 ? '#a8a294' : '#c8c2b4'); }
      for (var i = 0; i < 5; i++) { g.strokeStyle = 'rgba(220,245,255,0.85)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(32, 40); g.quadraticCurveTo(32 + (i - 2) * 3, 22 - (i % 2) * 3, 32 + (i - 2) * 6, 36); g.stroke(); } PROP.reeds(g, 8, 42); PROP.reeds(g, 52, 44); },
    grove: function (g, r) { E(g, 34, 50, 26, 5, 'rgba(14,10,24,0.3)'); [[16, 48, 13], [42, 46, 15], [30, 40, 12]].forEach(function (t, k) { R(g, t[0] - 1.5, t[1] - 14, 4, 14, '#4a3420'); E(g, t[0], t[1] - 20, t[2], t[2] * 0.85, ['#2f5a2a', '#3a6a30', '#4a7a3a'][k]); E(g, t[0] - 3, t[1] - 24, t[2] * 0.5, t[2] * 0.4, '#6a9a4a'); E(g, t[0] + 4, t[1] - 16, t[2] * 0.5, t[2] * 0.4, '#24461f'); });
      R(g, 24, 44, 14, 6, '#8a8478'); R(g, 24, 44, 14, 1.5, '#b0aaa0'); for (var i = 0; i < 8; i++) E(g, 10 + r() * 46, 50 + r() * 3, 1, 1, '#e8e0a0'); },
    stones: function (g, r) { E(g, 34, 50, 28, 5, 'rgba(14,10,24,0.3)'); [[26, 8, 14, 42], [8, 24, 8, 26], [46, 28, 8, 22], [16, 32, 6, 18], [40, 34, 6, 16]].sort(function (a, b) { return a[1] + a[3] - b[1] - b[3]; }).forEach(function (s) { var x = s[0], y = 52 - s[3], w = s[2]; R(g, x, y, w, s[3], '#8c8a84'); R(g, x, y, Math.ceil(w * 0.4), s[3], '#aaa8a0'); R(g, x + w - 2, y, 2, s[3], '#6a6862'); P(g, [x, y, x + w * 0.4, y - 3, x + w, y], '#aaa8a0'); for (var k = 0; k < s[3] / 6; k++) R(g, x + 1 + r() * (w - 3), y + 3 + r() * (s[3] - 6), 2, 1, '#6e8a4a'); }); }
  };
  function landmark(kind) { var c = cv(64, 56), g = c.getContext('2d'); if (!LM[kind]) throw new Error('no landmark ' + kind); var r = rng(kind.length * 41); outlined(g, 64, 56, 'rgba(22,14,20,0.55)', function (s) { LM[kind](s, r); }); return c; }

  /* ---------------------------------------------------------------- pilgrims on consecrated roads, 16×24 (2×), feet on (8, 22)
   * Lay travellers, not priests: a hooded travelling cloak in earth tones, the road owner's colour only as a sash, a bundle on the back
   * and a walking staff. Four walk frames, stride driven by the distance walked like the priests. */
  function pilgrim(pal, frame, kind) {
    var c = cv(16, 24), cloak = ['#7a6248', '#6a5a4a', '#8a7458'][kind % 3];
    outlined(c.getContext('2d'), 16, 24, 'rgba(18,12,20,0.7)', function (g) {
      var st = [2, 0, -2, 0][frame % 4], bob = frame % 2 ? -0.5 : 0;
      R(g, 6 + st * 0.5, 19, 2, 3, '#3a2a1c'); R(g, 8 - st * 0.5, 19, 2, 3, '#2a1c12');
      P(g, [5, 9 + bob, 11, 9 + bob, 12, 20, 4, 20], cloak); P(g, [8, 9 + bob, 11, 9 + bob, 12, 20, 8, 20], shade(cloak, -0.25));
      R(g, 4.5, 13 + bob, 7, 1.5, pal.secondary); E(g, 3.5, 12 + bob, 2.2, 3, '#a88a5a'); // sash and bundle
      E(g, 8, 6 + bob, 2.6, 3, '#e0c098'); P(g, [4.5, 9 + bob, 5, 4 + bob, 8, 2 + bob, 11, 4 + bob, 11.5, 9 + bob, 10, 8 + bob, 10, 5 + bob, 6, 5 + bob, 6, 8 + bob], shade(cloak, -0.12));
      L(g, 12.5, 22, 12.5 - st * 0.3, 6 + bob, '#5a3a20', 1.2);
    });
    return c;
  }

  /* registry: replaces the v0.3 small-sprite generators; ids stay the same so data and validators are unchanged */
  A.shrineArt = shrine; A.priestSprite = priest; A.landmarkSprite = landmark; A.village = village; A.pilgrim = pilgrim;
  A.KITS = KITS; A.kitIds = Object.keys(KITS); A.PRIEST_FRAMES = FRAMES; A.RES = 2;
  A.SPRITE = { village: [VW2, VH2, VX2, VY2], shrine: [88, 100, 0, 92], priest: [28, 40, 13, 38], landmark: [64, 56, 32, 52] }; // source size and ground anchor (2×)
  A.ids.shrines = Object.keys(SH); A.ids.priests = Object.keys(DRESS); A.ids.landmarks = Object.keys(LM); A.ids.kits = Object.keys(KITS).filter(function (k) { return ['mud', 'timber', 'tile'].indexOf(k) < 0; }); A.ids.props = Object.keys(PROP);
})(typeof self !== 'undefined' ? self : this);
