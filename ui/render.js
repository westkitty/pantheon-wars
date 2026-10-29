/*
 * Pantheon Wars — world renderer.
 * Pipeline per frame:
 *   1. world-space "frame" canvas = cached static terrain (extruded hex tiles, painted shading, AO, decorations, cast shadows)
 *      + animated water/foam + drifting cloud shadows + cached territory overlay + settlements/shrines/priests/glows/smoke
 *      + cached fog of war (soft, cross-faded when it lifts) + world FX.
 *   2. perspective projection: the frame is drawn to the screen in thin horizontal strips whose scale follows a pinhole
 *      projection, giving real foreshortening toward the horizon (Civ-style tilted camera) with nearest-neighbour pixels.
 *   3. screen-space atmosphere: horizon haze, warm grade, high parallax clouds, settlement banners, vignette, flashes.
 */
(function (root) {
  'use strict';
  var A = root.PWArt;
  var SQ = 0.6, HW = 26, RR = 30, ROW = 27, COL = 52, M = 150, H0 = 520;
  var VERTS = [[26, 9], [0, 18], [-26, 9], [-26, -9], [0, -18], [26, -9]];
  var EDGE_NB = [5, 4, 3, 2, 1, 0]; // edge k (VERTS[k]→VERTS[k+1]) borders neighbour index EDGE_NB[k]

  function Renderer(canvas, data) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.data = data; this.T = data.terrain.types;
    this.fac = {}; var self = this; data.factions.forEach(function (f) { self.fac[f.id] = f; });
    this.cam = { x: 0, y: 0, z: 1.9, tx: 0, ty: 0, tz: 1.9 };
    this.fx = []; this.texts = []; this.shake = 0; this.flash = null;
    this.quality = 'high'; this.autoQuality = true; this.frameTimes = [];
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.hover = -1; this.selected = -1; this.targets = null; this.path = null; this.viewer = 0;
    this.time = 0; this.priestAnim = {}; this.state = null;
    this.fogAlpha = 1; this.oldFog = null; this.fogFade = 0;
  }
  var P = Renderer.prototype;

  /* ---------------------------------------------------------- geometry */
  P.center = function (t) { return { x: M + 26 + t.q * COL + (t.r & 1) * 26, y: M + 30 + t.r * ROW }; };
  P.elev = function (t) {
    if (t.terrain === 'deep') return -3; if (t.terrain === 'sea') return -1;
    var micro = Math.round(Math.max(0, Math.min(1, (t.e - 0.5) * 3)) * 3);
    if (t.terrain === 'mountains') return 22 + micro; if (t.terrain === 'hills') return 15 + micro;
    return 7 + micro;
  };
  P.top = function (t) { var c = this.center(t); return { x: c.x, y: c.y - this.elev(t) }; };
  P.hexPath = function (g, x, y, s) { s = s || 1; g.beginPath(); for (var k = 0; k < 6; k++) { var v = VERTS[k]; if (k === 0) g.moveTo(x + v[0] * s, y + v[1] * s); else g.lineTo(x + v[0] * s, y + v[1] * s); } g.closePath(); };

  /* ---------------------------------------------------------- build static layers once per map */
  P.setMap = function (state) {
    this.map = state.map; var W = state.map.w, H = state.map.h;
    this.WW = M * 2 + COL * W + 26; this.WH = M * 2 + ROW * (H - 1) + 60;
    this.frame = A.cv(this.WW, this.WH); this.fg = this.frame.getContext('2d');
    this.buildPatterns();
    this.staticLayer = this.buildStatic(state);
    this.buildWaterPaths(state);
    this.villageCache = {};
    var mid = this.center(state.map.tiles[Math.floor(H / 2) * W + Math.floor(W / 2)]);
    this.cam.x = this.cam.tx = mid.x; this.cam.y = this.cam.ty = mid.y;
    this.clouds = []; var r = A.rng(state.seed * 7 + 3);
    for (var i = 0; i < 7; i++) this.clouds.push({ x: r() * this.WW, y: r() * this.WH, s: 0.7 + r() * 0.9, v: 4 + r() * 5 });
    this.highClouds = []; for (i = 0; i < 6; i++) this.highClouds.push({ x: r() * 2400 - 400, y: r() * 0.35, s: 0.8 + r() * 1.2, v: 5 + r() * 6 });
    this.fogKey = null; this.overlayKey = null;
  };

  P.buildPatterns = function () {
    var c = A.cv(128, 64), g = c.getContext('2d'), r = A.rng(99);
    for (var i = 0; i < 70; i++) { var x = r() * 128, y = r() * 64, w = 2 + r() * 6; g.fillStyle = 'rgba(220,240,255,' + (0.25 + r() * 0.5).toFixed(2) + ')'; g.fillRect(x | 0, y | 0, w | 0, 1); }
    this.waterPat = c;
    var c2 = A.cv(128, 64), g2 = c2.getContext('2d'); r = A.rng(7);
    for (i = 0; i < 40; i++) { g2.fillStyle = 'rgba(160,210,230,' + (0.15 + r() * 0.3).toFixed(2) + ')'; g2.fillRect(r() * 128 | 0, r() * 64 | 0, 3 + r() * 9 | 0, 1); }
    this.waterPat2 = c2;
    // cloud sprite: soft lumpy blob
    var cc = A.cv(240, 110), cg = cc.getContext('2d'); r = A.rng(5);
    for (i = 0; i < 14; i++) { var bx = 40 + r() * 160, by = 40 + r() * 35, br = 22 + r() * 30, gr = cg.createRadialGradient(bx, by, 0, bx, by, br); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); cg.fillStyle = gr; cg.fillRect(0, 0, 240, 110); }
    this.cloudSprite = cc;
    var cs = A.cv(240, 110), csg = cs.getContext('2d'); csg.drawImage(cc, 0, 0); csg.globalCompositeOperation = 'source-in'; csg.fillStyle = 'rgba(10,20,30,1)'; csg.fillRect(0, 0, 240, 110);
    this.cloudShadow = cs;
    // fog texture: soft, billowing storm-cloud (Endless Legend style mist rather than flat black)
    var fc = A.cv(256, 256), fgc = fc.getContext('2d'); r = A.rng(11);
    fgc.fillStyle = '#2b3446'; fgc.fillRect(0, 0, 256, 256);
    function blob(fx, fy, fr, col) { for (var ox = -256; ox <= 256; ox += 256) for (var oy = -256; oy <= 256; oy += 256) { var gr = fgc.createRadialGradient(fx + ox, fy + oy, 0, fx + ox, fy + oy, fr); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); fgc.fillStyle = gr; fgc.fillRect(fx + ox - fr, fy + oy - fr, fr * 2, fr * 2); } }
    for (i = 0; i < 26; i++) blob(r() * 256, r() * 256, 40 + r() * 50, 'rgba(12,16,26,0.45)');
    for (i = 0; i < 70; i++) { var bx2 = r() * 256, by2 = r() * 256, br2 = 14 + r() * 30; blob(bx2, by2 + br2 * 0.3, br2, 'rgba(14,18,30,0.35)'); blob(bx2, by2, br2, 'rgba(120,136,165,0.30)'); blob(bx2 - br2 * 0.25, by2 - br2 * 0.3, br2 * 0.5, 'rgba(190,200,220,0.16)'); }
    this.fogTex = fc;
  };

  P.buildWaterPaths = function (state) {
    var self = this, water = new Path2D(), foam = new Path2D();
    state.map.tiles.forEach(function (t) {
      if (!self.T[t.terrain].water) return;
      var p = self.top(t);
      for (var k = 0; k < 6; k++) { var v = VERTS[k]; if (k === 0) water.moveTo(p.x + v[0] * 1.02, p.y + v[1] * 1.02); else water.lineTo(p.x + v[0] * 1.02, p.y + v[1] * 1.02); }
      water.closePath();
      for (k = 0; k < 6; k++) {
        var n = t.n[EDGE_NB[k]]; if (n < 0 || self.T[state.map.tiles[n].terrain].water) continue;
        var a = VERTS[k], b = VERTS[(k + 1) % 6], cx = p.x, cy = p.y;
        foam.moveTo(cx + a[0] * 0.9, cy + a[1] * 0.9); foam.lineTo(cx + b[0] * 0.9, cy + b[1] * 0.9);
      }
    });
    // open sea outside the map
    water.rect(0, 0, this.WW, M); water.rect(0, this.WH - M + 20, this.WW, M); water.rect(0, 0, M, this.WH); water.rect(this.WW - M, 0, M, this.WH);
    this.waterPath = water; this.foamPath = foam;
  };

  P.buildStatic = function (state) {
    var self = this, c = A.cv(this.WW, this.WH), g = c.getContext('2d'), tiles = state.map.tiles, T = this.T, W = state.map.w;
    // ocean backdrop with depth gradient and swell lines
    var og = g.createLinearGradient(0, 0, 0, this.WH); og.addColorStop(0, '#173f5c'); og.addColorStop(1, '#0f3049');
    g.fillStyle = og; g.fillRect(0, 0, this.WW, this.WH);
    var r0 = A.rng(state.seed + 1);
    for (var i = 0; i < 900; i++) { g.fillStyle = 'rgba(120,180,210,' + (0.04 + r0() * 0.08).toFixed(2) + ')'; g.fillRect(r0() * this.WW | 0, r0() * this.WH | 0, 3 + r0() * 8 | 0, 1); }
    function landNb(t) { return t.n.map(function (n) { return n >= 0 && !T[tiles[n].terrain].water; }); }
    // pass 1: tiles row by row (faces then tops)
    for (var r = 0; r < state.map.h; r++) for (var q = 0; q < W; q++) self.drawTile(g, state, tiles[r * W + q], landNb);
    // pass 2: cast shadows of tall things
    tiles.forEach(function (t) { self.drawShadows(g, t); });
    // pass 3: decorations row by row
    for (r = 0; r < state.map.h; r++) for (q = 0; q < W; q++) self.drawDecor(g, state, tiles[r * W + q]);
    return c;
  };

  P.tileColor = function (t) {
    var base = this.T[t.terrain].top;
    if (t.terrain === 'grassland') base = A.mix(base, '#8fae48', Math.max(0, 0.5 - t.m));
    if (t.terrain === 'plains') base = A.mix(base, '#c8b062', t.detail * 0.5);
    if (t.terrain === 'deep') base = A.mix('#1b4d6e', '#163f5c', t.detail);
    return base;
  };

  P.drawTile = function (g, state, t, landNb) {
    var T = this.T, tiles = state.map.tiles, self = this, tt = T[t.terrain], c = this.center(t), h = this.elev(t), x = c.x, y = c.y - h;
    var rng = A.rng(t.id * 9973 + 17), k, v, a, b, n;
    if (tt.water) {
      var shallow = t.terrain === 'sea', coastal = t.n.some(function (n) { return n >= 0 && !T[tiles[n].terrain].water; });
      var col = shallow ? (coastal ? '#3f97a6' : '#2f7d9a') : this.tileColor(t);
      this.hexPath(g, x, y, 1.03); g.fillStyle = col; g.fill();
      if (coastal) { // shallow sand glow under water near land
        for (k = 0; k < 6; k++) { n = t.n[EDGE_NB[k]]; if (n < 0 || T[tiles[n].terrain].water) continue; a = VERTS[k]; b = VERTS[(k + 1) % 6];
          var gr = g.createLinearGradient(x + (a[0] + b[0]) / 2, y + (a[1] + b[1]) / 2, x, y); gr.addColorStop(0, 'rgba(160,200,170,0.55)'); gr.addColorStop(1, 'rgba(160,200,170,0)');
          g.fillStyle = gr; g.beginPath(); g.moveTo(x + a[0], y + a[1]); g.lineTo(x + b[0], y + b[1]); g.lineTo(x, y); g.closePath(); g.fill(); }
      }
      for (i = 0; i < 6; i++) { g.fillStyle = 'rgba(200,235,255,0.12)'; g.fillRect(x - 18 + rng() * 36 | 0, y - 10 + rng() * 20 | 0, 3 + rng() * 6 | 0, 1); }
      return;
    }
    var land = landNb(t);
    // side faces (SE = edge0, SW = edge1); extrude down to neighbour height or the water line
    var side = tt.side;
    [0, 1].forEach(function (k) {
      var nb = t.n[EDGE_NB[k]], nh = nb >= 0 ? self.elev(tiles[nb]) : -1; if (T[(nb >= 0 ? tiles[nb] : t).terrain].water || nb < 0) nh = -1;
      if (nh >= h) return;
      var d = h - nh, a = VERTS[k], b = VERTS[k + 1];
      var faceCol = k === 1 ? A.shade(side, 0.06) : A.shade(side, -0.28);
      g.fillStyle = faceCol; g.beginPath(); g.moveTo(x + a[0], y + a[1]); g.lineTo(x + b[0], y + b[1]); g.lineTo(x + b[0], y + b[1] + d); g.lineTo(x + a[0], y + a[1] + d); g.closePath(); g.fill();
      // strata
      for (var s = 3; s < d; s += 4) { g.fillStyle = k === 1 ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.14)'; var t0 = 0.08 + rng() * 0.1, t1 = 0.92 - rng() * 0.1; g.beginPath(); g.moveTo(x + a[0] + (b[0] - a[0]) * t0, y + a[1] + (b[1] - a[1]) * t0 + s); g.lineTo(x + a[0] + (b[0] - a[0]) * t1, y + a[1] + (b[1] - a[1]) * t1 + s); g.lineTo(x + a[0] + (b[0] - a[0]) * t1, y + a[1] + (b[1] - a[1]) * t1 + s + 1); g.lineTo(x + a[0] + (b[0] - a[0]) * t0, y + a[1] + (b[1] - a[1]) * t0 + s + 1); g.fill(); }
      // grass/soil overhang rim
      g.fillStyle = A.shade(self.tileColor(t), k === 1 ? -0.25 : -0.45); g.beginPath(); g.moveTo(x + a[0], y + a[1]); g.lineTo(x + b[0], y + b[1]); g.lineTo(x + b[0], y + b[1] + 2); g.lineTo(x + a[0], y + a[1] + 2); g.closePath(); g.fill();
      // wet line where the cliff meets water
      if (nh < 0) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(Math.min(x + a[0], x + b[0]), Math.max(y + a[1], y + b[1]) + d - 1, Math.abs(b[0] - a[0]), 1); }
    });
    // top face
    var col = this.tileColor(t);
    this.hexPath(g, x, y); g.fillStyle = col; g.fill();
    g.save(); this.hexPath(g, x, y); g.clip();
    // painterly dither texture
    // painted: a few soft tonal blotches (brush strokes) then fine low-contrast grain
    for (var i = 0; i < 7; i++) { var bx = x - 20 + rng() * 40, by = y - 12 + rng() * 24, br = 6 + rng() * 10, lt = rng() < 0.5, bgr = g.createRadialGradient(bx, by, 0, bx, by, br);
      bgr.addColorStop(0, A.rgba(A.shade(col, lt ? 0.14 : -0.14), 0.55)); bgr.addColorStop(1, A.rgba(A.shade(col, lt ? 0.14 : -0.14), 0)); g.fillStyle = bgr; g.fillRect(bx - br, by - br, br * 2, br * 2); }
    var light = A.shade(col, 0.09), dark = A.shade(col, -0.1);
    for (i = 0; i < 46; i++) { var px = x - 26 + rng() * 52, py = y - 18 + rng() * 36, rr = rng(); g.fillStyle = rr < 0.5 ? light : dark; g.fillRect(px | 0, py | 0, rr < 0.25 ? 2 : 1, 1); }
    // directional light: sun from upper-left
    var lg = g.createLinearGradient(x - 22, y - 16, x + 22, y + 16); lg.addColorStop(0, 'rgba(255,236,190,0.22)'); lg.addColorStop(0.5, 'rgba(255,236,190,0)'); lg.addColorStop(1, 'rgba(10,15,40,0.22)');
    g.fillStyle = lg; g.fillRect(x - 30, y - 20, 60, 40);
    // beaches along water edges
    for (k = 0; k < 6; k++) {
      n = t.n[EDGE_NB[k]]; if (n >= 0 && !T[tiles[n].terrain].water) continue;
      a = VERTS[k]; b = VERTS[(k + 1) % 6];
      g.fillStyle = t.terrain === 'tundra' ? 'rgba(200,205,200,0.85)' : 'rgba(222,204,150,0.9)';
      g.beginPath(); g.moveTo(x + a[0], y + a[1]); g.lineTo(x + b[0], y + b[1]); g.lineTo(x + b[0] * 0.8, y + b[1] * 0.8); g.lineTo(x + a[0] * 0.8, y + a[1] * 0.8); g.closePath(); g.fill();
    }
    // ambient occlusion where a neighbour stands taller; sun rim where we stand taller on the lit (NW/W/NE) side
    for (k = 0; k < 6; k++) {
      n = t.n[EDGE_NB[k]]; if (n < 0) continue;
      var nh2 = T[tiles[n].terrain].water ? -1 : this.elev(tiles[n]);
      a = VERTS[k]; b = VERTS[(k + 1) % 6];
      if (nh2 > h + 2) { var ag = g.createLinearGradient(x + (a[0] + b[0]) / 2, y + (a[1] + b[1]) / 2, x + (a[0] + b[0]) / 6, y + (a[1] + b[1]) / 6); ag.addColorStop(0, 'rgba(0,0,10,0.45)'); ag.addColorStop(1, 'rgba(0,0,10,0)'); g.fillStyle = ag; g.beginPath(); g.moveTo(x + a[0], y + a[1]); g.lineTo(x + b[0], y + b[1]); g.lineTo(x, y); g.closePath(); g.fill(); }
      else if (nh2 < h - 2 && (k === 2 || k === 3 || k === 4)) { g.strokeStyle = 'rgba(255,240,200,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + a[0] * 0.97, y + a[1] * 0.97); g.lineTo(x + b[0] * 0.97, y + b[1] * 0.97); g.stroke(); }
    }
    g.restore();
    // crisp darker outline on the far edges to read as separate tiles (subtle, Civ-like grid)
    g.strokeStyle = 'rgba(20,20,10,0.16)'; g.lineWidth = 1; this.hexPath(g, x, y); g.stroke();
  };

  P.drawShadows = function (g, t) {
    if (t.settlement >= 0) return;
    var p = this.top(t), rng = A.rng(t.id * 31 + 5);
    if (t.terrain === 'mountains') {
      g.fillStyle = 'rgba(10,15,35,0.28)';
      g.beginPath(); g.moveTo(p.x - 14, p.y + 6); g.lineTo(p.x + 40, p.y + 22); g.lineTo(p.x + 22, p.y + 4); g.closePath(); g.fill();
    } else if (t.terrain === 'forest') {
      g.fillStyle = 'rgba(10,20,10,0.20)'; g.beginPath(); g.ellipse(p.x + 6, p.y + 4, 22, 9, 0, 0, Math.PI * 2); g.fill();
    } else if (t.terrain === 'hills') {
      g.fillStyle = 'rgba(10,15,30,0.14)'; g.beginPath(); g.ellipse(p.x + 8, p.y + 6, 18, 6, 0, 0, Math.PI * 2); g.fill();
    }
  };

  function conifer(g, x, y, s, dark, mid, snow) {
    x = Math.round(x); y = Math.round(y);
    g.fillStyle = 'rgba(0,10,0,0.28)'; g.fillRect(x - 1, y, s + 3, 2);
    g.fillStyle = '#3a2a1a'; g.fillRect(x, y - 2, 1, 3);
    for (var tier = 0; tier < 3; tier++) {
      var w = s - tier * (s / 3.2), ty = y - 2 - tier * (s * 0.55);
      for (var row = 0; row < s * 0.75; row++) { var ww = Math.max(1, Math.round(w * (row / (s * 0.75)))); var yy = Math.round(ty - s * 0.75 + row);
        g.fillStyle = dark; g.fillRect(x - Math.floor(ww / 2), yy, ww, 1); g.fillStyle = mid; g.fillRect(x - Math.floor(ww / 2), yy, Math.max(1, Math.floor(ww / 2)), 1); }
    }
    if (snow) { g.fillStyle = '#e8eef2'; g.fillRect(x - 1, Math.round(y - 2 - s * 1.9), 2, 1); g.fillRect(x - 2, Math.round(y - 2 - s * 1.35), 2, 1); }
  }
  function broadleaf(g, x, y, s, base) {
    x = Math.round(x); y = Math.round(y);
    g.fillStyle = 'rgba(0,10,0,0.25)'; g.beginPath(); g.ellipse(x + 3, y + 1, s * 0.9, s * 0.35, 0, 0, 7); g.fill();
    g.fillStyle = '#4a3420'; g.fillRect(x, y - 3, 1, 4);
    A.disc(g, x, y - 3 - s * 0.6, s * 0.75, A.shade(base, -0.3)); A.disc(g, x - 1, y - 4 - s * 0.7, s * 0.6, base); A.disc(g, x - 2, y - 5 - s * 0.8, s * 0.3, A.shade(base, 0.25));
  }
  function palm(g, x, y) {
    x = Math.round(x); y = Math.round(y); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x, y, 6, 1);
    for (var i = 0; i < 8; i++) A.px(g, x + Math.round(i * 0.3), y - i, '#7a5a32');
    var tx = x + 2, ty = y - 8; [[-5, 2], [5, 2], [-4, -1], [4, -1], [0, -3]].forEach(function (f) { A.line(g, tx, ty, tx + f[0], ty + f[1], '#4f8a3a'); });
  }

  P.drawDecor = function (g, state, t) {
    var p = this.top(t), x = p.x, y = p.y, rng = A.rng(t.id * 7919 + 3), i, n;
    function inHex() { for (var tries = 0; tries < 20; tries++) { var dx = (rng() * 2 - 1) * 20, dy = (rng() * 2 - 1) * 12; if (Math.abs(dx) / 22 + Math.abs(dy) / 13 < 1) return [x + dx, y + dy]; } return [x, y]; }
    if (t.settlement >= 0) {
      // patchwork fields around settlements
      var fieldCols = t.terrain === 'desert' ? ['#c8b070', '#8aa04a', '#b89a5a'] : t.terrain === 'tundra' ? ['#9aa290', '#8a9078', '#b0b4a6'] : ['#a8a048', '#7f9a3a', '#c4ae5a', '#6f8c34'];
      for (i = 0; i < 7; i++) { var pt = inHex(); g.fillStyle = fieldCols[i % fieldCols.length]; g.save(); g.translate(pt[0], pt[1]); g.transform(1, 0, -0.6, 0.6, 0, 0); g.fillRect(-5, -4, 9, 7); g.fillStyle = 'rgba(0,0,0,0.12)'; for (var s = -4; s < 3; s += 2) g.fillRect(-5, s, 9, 1); g.restore(); }
      return;
    }
    var pts = [], k;
    switch (t.terrain) {
      case 'forest':
        n = 7 + (rng() * 4 | 0); for (i = 0; i < n; i++) pts.push(inHex());
        pts.sort(function (a, b) { return a[1] - b[1]; });
        var cold = t.t < 0.4;
        pts.forEach(function (q) { if (cold || rng() < 0.45) conifer(g, q[0], q[1], 5 + (rng() * 3 | 0), '#1f3d24', '#2f5a30', cold && rng() < 0.4); else broadleaf(g, q[0], q[1], 4 + rng() * 2, rng() < 0.3 ? '#6f8a2a' : '#4f7a2f'); });
        break;
      case 'tundra':
        for (i = 0; i < 4; i++) { var sp = inHex(); g.fillStyle = 'rgba(235,240,245,0.85)'; g.beginPath(); g.ellipse(sp[0], sp[1], 4 + rng() * 5, 2 + rng() * 1.5, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(150,170,200,0.5)'; g.fillRect(sp[0] - 3 | 0, sp[1] + 1 | 0, 6, 1); }
        for (i = 0; i < 3; i++) { sp = inHex(); g.fillStyle = '#6a6a66'; g.fillRect(sp[0] | 0, sp[1] | 0, 2, 1); }
        if (rng() < 0.6) { n = 1 + (rng() * 3 | 0); for (i = 0; i < n; i++) pts.push(inHex()); pts.sort(function (a, b) { return a[1] - b[1]; }); pts.forEach(function (q) { conifer(g, q[0], q[1], 4 + (rng() * 2 | 0), '#22392c', '#36503e', true); }); }
        break;
      case 'hills':
        n = 2 + (rng() * 2 | 0);
        for (i = 0; i < n; i++) pts.push(inHex()); pts.sort(function (a, b) { return a[1] - b[1]; });
        var hc = this.tileColor(t);
        pts.forEach(function (q) {
          var w = 9 + rng() * 6, hh = 5 + rng() * 4;
          g.fillStyle = A.shade(hc, -0.25); g.beginPath(); g.ellipse(q[0], q[1], w, hh, 0, Math.PI, 0); g.fill();
          g.fillStyle = A.shade(hc, 0.12); g.beginPath(); g.ellipse(q[0] - w * 0.25, q[1], w * 0.75, hh * 0.95, 0, Math.PI, 0); g.fill();
          g.fillStyle = A.shade(hc, 0.3); g.fillRect(q[0] - w * 0.5 | 0, q[1] - hh * 0.8 | 0, 3, 1);
        });
        if (rng() < 0.5) { var tp = inHex(); conifer(g, tp[0], tp[1], 4, '#2a4a2a', '#3a6a3a'); }
        break;
      case 'mountains':
        var peaks = [[x - 7 + rng() * 4, 30 + rng() * 6, 18], [x + 9 + rng() * 4, 22 + rng() * 6, 14]];
        if (rng() < 0.5) peaks.reverse();
        peaks.sort(function (a, b) { return b[1] - a[1]; });
        var snow = t.t < 0.75;
        peaks.forEach(function (pk, idx) {
          var px = pk[0], ph = pk[1], bw = pk[2], by = y + 6 + idx * 2, top = by - ph;
          g.fillStyle = '#8a8478'; g.beginPath(); g.moveTo(px - bw, by); g.lineTo(px, top); g.lineTo(px + bw * 0.15, by); g.closePath(); g.fill();
          g.fillStyle = '#4a4650'; g.beginPath(); g.moveTo(px, top); g.lineTo(px + bw, by); g.lineTo(px + bw * 0.15, by); g.closePath(); g.fill();
          for (var s = 0; s < 14; s++) { var tt = rng(), yy = top + tt * ph, half = bw * tt; g.fillStyle = rng() < 0.5 ? 'rgba(255,240,220,0.12)' : 'rgba(0,0,0,0.15)'; g.fillRect(px - half + rng() * half * 1.6 | 0, yy | 0, 2, 1); }
          if (snow) {
            var sh = ph * 0.38;
            g.fillStyle = '#f2f4f6'; g.beginPath(); g.moveTo(px, top); g.lineTo(px - bw * sh / ph, top + sh); g.lineTo(px - bw * 0.25 * sh / ph, top + sh * 0.8); g.lineTo(px, top + sh * 1.05); g.closePath(); g.fill();
            g.fillStyle = '#b8c4d6'; g.beginPath(); g.moveTo(px, top); g.lineTo(px + bw * sh / ph, top + sh); g.lineTo(px + bw * 0.3 * sh / ph, top + sh * 0.85); g.lineTo(px, top + sh * 1.05); g.closePath(); g.fill();
          }
          g.strokeStyle = 'rgba(255,245,220,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px, top); g.lineTo(px - bw * 0.55, by - 2); g.stroke();
        });
        break;
      case 'desert':
        for (i = 0; i < 4; i++) { var d = inHex(), dw = 8 + rng() * 8; g.strokeStyle = 'rgba(255,240,200,0.55)'; g.lineWidth = 1; g.beginPath(); g.ellipse(d[0], d[1] + 3, dw, 4, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.strokeStyle = 'rgba(120,80,40,0.30)'; g.beginPath(); g.ellipse(d[0] + 1, d[1] + 4, dw, 4, 0, Math.PI * 1.2, Math.PI * 1.9); g.stroke(); }
        if (t.coast && rng() < 0.7) { var pp = inHex(); palm(g, pp[0], pp[1]); pp = inHex(); palm(g, pp[0], pp[1]); }
        for (i = 0; i < 2; i++) { var rk = inHex(); g.fillStyle = '#8a6a48'; g.fillRect(rk[0] | 0, rk[1] | 0, 3, 2); g.fillStyle = '#b8946a'; g.fillRect(rk[0] | 0, rk[1] | 0, 2, 1); }
        break;
      case 'plains':
        g.save(); this.hexPath(g, x, y, 0.82); g.clip();
        for (var sx = -30; sx < 30; sx += 4) { g.strokeStyle = (sx / 4) % 2 ? 'rgba(220,190,90,0.35)' : 'rgba(120,110,40,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + sx, y - 20); g.lineTo(x + sx + 14, y + 20); g.stroke(); }
        g.restore();
        if (rng() < 0.5) { var hs = inHex(); g.fillStyle = '#d8b850'; g.fillRect(hs[0] | 0, hs[1] - 2 | 0, 3, 3); g.fillStyle = '#a88a30'; g.fillRect(hs[0] + 2 | 0, hs[1] - 1 | 0, 1, 2); }
        if (rng() < 0.35) { var bt = inHex(); broadleaf(g, bt[0], bt[1], 3.5, '#6a8a32'); }
        break;
      case 'grassland':
        for (i = 0; i < 18; i++) { var gp = inHex(); g.fillStyle = rng() < 0.5 ? '#9ac25a' : '#4f7a2a'; g.fillRect(gp[0] | 0, gp[1] | 0, 1, 2); }
        for (i = 0; i < 6; i++) { gp = inHex(); g.fillStyle = ['#f0e070', '#f4f0f0', '#d880a0', '#a0c0f0'][i % 4]; g.fillRect(gp[0] | 0, gp[1] | 0, 1, 1); }
        if (rng() < 0.55) { n = 1 + (rng() * 2 | 0); for (i = 0; i < n; i++) pts.push(inHex()); pts.sort(function (a, b) { return a[1] - b[1]; }); pts.forEach(function (q) { broadleaf(g, q[0], q[1], 4 + rng() * 1.5, '#4f8a2f'); }); }
        break;
    }
  };

  /* ---------------------------------------------------------- per-state caches */
  P.territory = function (state) {
    var self = this, own = new Array(state.map.tiles.length).fill(-1), best = new Array(state.map.tiles.length).fill(-1);
    state.settlements.forEach(function (s) {
      if (!s.shrine) return;
      var st = state.map.tiles[s.tile], def = self.data.shrines.find(function (d) { return d.id === s.shrine.type; });
      state.map.tiles.forEach(function (t) {
        var d = Math.max(Math.abs(t.cx - st.cx), Math.abs(t.cy - st.cy), Math.abs(t.cz - st.cz));
        if (d > def.radius || t.terrain === 'deep') return;
        var w = 10 - d * 3 + (s.shrine.eclipsed ? -1 : 0) + s.followers[s.shrine.owner] * 0.01;
        if (w > best[t.id]) { best[t.id] = w; own[t.id] = s.shrine.owner; }
      });
    });
    return own;
  };
  P.buildOverlay = function (state) {
    var self = this, c = this.overlay || A.cv(this.WW, this.WH), g = c.getContext('2d'), own = this.territory(state), tiles = state.map.tiles;
    g.clearRect(0, 0, c.width, c.height);
    this.terr = own;
    tiles.forEach(function (t) {
      var o = own[t.id]; if (o < 0) return;
      var pal = self.fac[state.players[o].faction].palette, p = self.top(t);
      self.hexPath(g, p.x, p.y, 0.98); g.fillStyle = A.rgba(pal.secondary, 0.14); g.fill();
    });
    tiles.forEach(function (t) {
      var o = own[t.id]; if (o < 0) return;
      var pal = self.fac[state.players[o].faction].palette, p = self.top(t);
      for (var k = 0; k < 6; k++) {
        var n = t.n[EDGE_NB[k]]; if (n >= 0 && own[n] === o) continue;
        var a = VERTS[k], b = VERTS[(k + 1) % 6], s = 0.9;
        g.lineCap = 'round';
        g.strokeStyle = A.rgba(pal.secondary, 0.35); g.lineWidth = 5; g.beginPath(); g.moveTo(p.x + a[0] * s, p.y + a[1] * s); g.lineTo(p.x + b[0] * s, p.y + b[1] * s); g.stroke();
        g.strokeStyle = pal.accent; g.lineWidth = 2; g.beginPath(); g.moveTo(p.x + a[0] * s, p.y + a[1] * s); g.lineTo(p.x + b[0] * s, p.y + b[1] * s); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x + a[0] * s, p.y + a[1] * s - 1); g.lineTo(p.x + b[0] * s, p.y + b[1] * s - 1); g.stroke();
      }
    });
    this.overlay = c;
  };
  P.buildFog = function (state) {
    var self = this, rev = state.players[this.viewer].revealed;
    var c = A.cv(this.WW, this.WH), g = c.getContext('2d');
    g.fillStyle = '#000';
    state.map.tiles.forEach(function (t) { if (rev[t.id]) return; var p = self.top(t); self.hexPath(g, p.x, p.y - 4, 1.35); g.fill(); var cc = self.center(t); self.hexPath(g, cc.x, cc.y + 6, 1.3); g.fill(); });
    // unknown beyond the map edge too
    // (beyond the map edge is open sea that dissolves into mist, see the feather below — not cloud wall)
    var b = A.cv(this.WW, this.WH), bg = b.getContext('2d');
    bg.filter = this.quality === 'low' ? 'blur(8px)' : 'blur(16px)'; bg.drawImage(c, 0, 0); bg.filter = 'none';
    bg.globalCompositeOperation = 'source-in';
    bg.fillStyle = bg.createPattern(this.fogTex, 'repeat'); bg.fillRect(0, 0, this.WW, this.WH);
    // a faint warm rim where knowledge ends
    var rim = A.cv(this.WW, this.WH), rg = rim.getContext('2d');
    rg.filter = 'blur(3px)'; rg.drawImage(c, 0, 0); rg.filter = 'none'; rg.globalCompositeOperation = 'source-in'; rg.fillStyle = 'rgba(180,150,100,0.18)'; rg.fillRect(0, 0, this.WW, this.WH);
    bg.globalCompositeOperation = 'destination-over'; bg.drawImage(rim, 0, 0);
    // feather the world's outer edge into the backdrop so the frame never reads as a rectangle
    bg.globalCompositeOperation = 'source-over';
    var E = 150, WW = this.WW, WH = this.WH, edge = [[0, 0, E, 0, 0, 0, E, WH], [WW, 0, WW - E, 0, WW - E, 0, E, WH], [0, 0, 0, E, 0, 0, WW, E], [0, WH, 0, WH - E, 0, WH - E, WW, E]];
    edge.forEach(function (e) { var gr = bg.createLinearGradient(e[0], e[1], e[2], e[3]); gr.addColorStop(0, 'rgba(27,48,68,1)'); gr.addColorStop(0.55, 'rgba(27,48,68,0.55)'); gr.addColorStop(1, 'rgba(27,48,68,0)'); bg.fillStyle = gr; bg.fillRect(e[4], e[5], e[6], e[7]); });
    return b;
  };

  /* ---------------------------------------------------------- sprites: villages, shrines, priests */
  P.village = function (state, s) {
    var t = state.map.tiles[s.tile], tier = Math.max(1, Math.min(5, Math.floor(s.pop / 2.6))), key = s.id + ':' + tier;
    if (this.villageCache[key]) return this.villageCache[key];
    var c = A.cv(64, 44), g = c.getContext('2d'), r = A.rng(s.id * 131 + tier), style = t.terrain === 'desert' ? 'mud' : (t.terrain === 'tundra' || t.t < 0.3) ? 'timber' : 'tile';
    var n = 2 + tier + (tier > 2 ? 1 : 0), houses = [], chim = [];
    for (var i = 0; i < n; i++) { var a = r() * Math.PI * 2, d = Math.sqrt(r()) * (8 + tier * 2); houses.push({ x: 32 + Math.cos(a) * d * 1.5, y: 30 + Math.sin(a) * d * 0.6, w: 5 + (r() * 3 | 0), h: 3 + (r() * 3 | 0), big: i === 0 && tier >= 3 }); }
    houses.sort(function (a, b) { return a.y - b.y; });
    if (tier >= 4) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(32, 31, 26, 10, 0, 0, 7); g.fill(); g.strokeStyle = style === 'mud' ? '#b89a68' : '#6a5038'; g.lineWidth = 2; g.beginPath(); g.ellipse(32, 30, 25, 9.5, 0, Math.PI * 0.05, Math.PI * 0.95); g.stroke(); }
    var wallL = style === 'mud' ? '#d8bc88' : style === 'timber' ? '#6a5240' : '#e8dcc4', wallR = style === 'mud' ? '#a88a5a' : style === 'timber' ? '#463628' : '#b4a68c';
    var roofL = style === 'mud' ? '#c8a874' : style === 'timber' ? '#5a6470' : '#c0583a', roofR = style === 'mud' ? '#a08458' : style === 'timber' ? '#3a424c' : '#8a3a28';
    houses.forEach(function (h) {
      var x = Math.round(h.x), y = Math.round(h.y), w = h.big ? 9 : h.w, hh = h.big ? 6 : h.h, dep = 3;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - w / 2 + 2 | 0, y + 1, w + 3, 2);
      g.fillStyle = wallL; g.fillRect(x - w / 2 | 0, y - hh, w, hh + 1);
      g.fillStyle = wallR; g.beginPath(); g.moveTo(x + w / 2, y + 1); g.lineTo(x + w / 2 + dep, y - 1); g.lineTo(x + w / 2 + dep, y - hh - 1); g.lineTo(x + w / 2, y - hh); g.closePath(); g.fill();
      if (style === 'mud') { g.fillStyle = A.shade(wallL, 0.15); g.fillRect(x - w / 2 | 0, y - hh - 1, w + dep, 1); }
      else { var rh = style === 'timber' ? 5 : 3; g.fillStyle = roofL; g.beginPath(); g.moveTo(x - w / 2 - 1, y - hh); g.lineTo(x + 0.5, y - hh - rh); g.lineTo(x + w / 2 + 1, y - hh); g.closePath(); g.fill(); g.fillStyle = roofR; g.beginPath(); g.moveTo(x + 0.5, y - hh - rh); g.lineTo(x + dep + 0.5, y - hh - rh - 2); g.lineTo(x + w / 2 + dep + 1, y - hh - 2); g.lineTo(x + w / 2 + 1, y - hh); g.closePath(); g.fill();
        if (style === 'timber') { g.fillStyle = 'rgba(240,245,250,0.85)'; g.fillRect(x - 1, y - hh - rh + 1, 3, 1); } }
      g.fillStyle = '#ffd27a'; g.fillRect(x - 1, y - (hh >> 1), 1, 1); if (w > 6) g.fillRect(x + 2, y - (hh >> 1), 1, 1);
      g.fillStyle = '#3a2a1a'; g.fillRect(x - w / 2 + 1 | 0, y - 1, 1, 2);
      chim.push([x + 1, y - hh - 4]);
    });
    var out = { c: c, chim: chim.slice(0, 3), tier: tier };
    this.villageCache[key] = out; return out;
  };
  P.shrineSprite = function (type, eclipsed) {
    this.shrineCache = this.shrineCache || {};
    var key = type + (eclipsed ? ':e' : ''); if (this.shrineCache[key]) return this.shrineCache[key];
    var c = A.cv(40, 44), g = c.getContext('2d'), def = this.data.shrines.find(function (d) { return d.id === type; }), fac = this.fac[def.faction].palette, i;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(22, 40, 17, 4, 0, 0, 7); g.fill();
    var art = ['columns', 'hall', 'pylon'].indexOf(def.art) >= 0 ? def.art : 'columns'; // data-only pantheons fall back to a palette-tinted temple
    if (art === 'columns') {
      g.fillStyle = '#b8b098'; g.fillRect(4, 36, 32, 3); g.fillStyle = '#d4ccb4'; g.fillRect(6, 33, 28, 3); g.fillStyle = '#e8e2cc'; g.fillRect(8, 31, 24, 2);
      g.fillStyle = '#3a3428'; g.fillRect(9, 17, 22, 14); g.fillStyle = A.rgba(fac.glow, 0.85); g.fillRect(14, 20, 12, 11);
      for (i = 0; i < 6; i++) { var cx = 8 + i * 4.6; g.fillStyle = '#f2ecd8'; g.fillRect(cx | 0, 17, 2, 14); g.fillStyle = '#b4ac94'; g.fillRect((cx | 0) + 2, 17, 1, 14); }
      g.fillStyle = '#e2dcc6'; g.fillRect(7, 14, 26, 3); g.fillStyle = fac.secondary; g.fillRect(7, 15, 26, 1);
      A.poly(g, [6, 14, 20, 6, 34, 14], '#efe8d2'); A.poly(g, [20, 6, 34, 14, 26, 14], '#c4bca4'); A.px(g, 19, 4, fac.accent, 2, 2); A.px(g, 6, 12, fac.accent); A.px(g, 33, 12, fac.accent);
    } else if (art === 'hall') {
      g.fillStyle = '#4a3626'; g.fillRect(6, 24, 28, 14); g.fillStyle = '#5e4632'; for (i = 0; i < 7; i++) g.fillRect(6 + i * 4, 24, 1, 14);
      g.fillStyle = '#2e2218'; g.beginPath(); g.moveTo(34, 38); g.lineTo(38, 35); g.lineTo(38, 22); g.lineTo(34, 24); g.closePath(); g.fill();
      A.poly(g, [3, 25, 20, 9, 37, 25], '#3a2c22'); A.poly(g, [20, 9, 37, 25, 39, 22, 22, 7], '#2a2018');
      for (i = 0; i < 6; i++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(8 + i * 4, 13 + (i % 2) * 5, 6, 1); }
      A.line(g, 20, 9, 15, 3, '#6a4a30'); A.line(g, 20, 9, 25, 3, '#6a4a30'); A.px(g, 14, 2, fac.accent); A.px(g, 25, 2, fac.accent);
      g.fillStyle = A.rgba(fac.glow, 0.95); g.fillRect(17, 29, 6, 9); g.fillStyle = fac.secondary; g.fillRect(8, 26, 3, 3); g.fillRect(29, 26, 3, 3);
      g.fillStyle = '#7a7872'; g.fillRect(1, 26, 4, 12); g.fillStyle = '#9a9890'; g.fillRect(1, 26, 2, 12); A.px(g, 2, 29, fac.secondary, 1, 6);
    } else {
      A.poly(g, [3, 38, 6, 12, 16, 12, 18, 38], '#d8bc84'); A.poly(g, [22, 38, 24, 12, 34, 12, 37, 38], '#c8a870'); A.poly(g, [30, 12, 34, 12, 37, 38, 33, 38], '#a8885a');
      g.fillStyle = fac.secondary; g.fillRect(6, 15, 10, 2); g.fillRect(24, 15, 10, 2); g.fillStyle = fac.accent; g.fillRect(6, 17, 10, 1); g.fillRect(24, 17, 10, 1);
      g.fillStyle = '#b89a68'; g.fillRect(16, 20, 8, 3); g.fillStyle = fac.secondary; g.fillRect(16, 21, 8, 1);
      g.fillStyle = A.rgba(fac.glow, 0.95); g.fillRect(17, 23, 6, 15);
      A.poly(g, [38, 38, 39, 8, 40, 38], '#e0c48a'); A.px(g, 38, 6, fac.accent, 2, 2);
      for (i = 0; i < 5; i++) { A.px(g, 8 + i * 1.5, 22 + i * 3, 'rgba(90,60,30,0.5)'); A.px(g, 27 + i * 1.5, 22 + i * 3, 'rgba(90,60,30,0.5)'); }
    }
    if (eclipsed) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(15,10,25,0.6)'; g.fillRect(0, 0, 40, 44); }
    this.shrineCache[key] = c; return c;
  };

  /* ---------------------------------------------------------- state sync */
  P.setState = function (state, viewer) {
    var prev = this.state; this.state = state; this.viewer = viewer;
    var rev = state.players[viewer].revealed, rk = 0; for (var i = 0; i < rev.length; i++) rk += rev[i] * (i % 97 + 1);
    var fogKey = rk + ':' + this.quality;
    if (fogKey !== this.fogKey) { if (this.fog && !this.reduced) { this.oldFog = this.fog; this.fogFade = 1; } this.fog = this.buildFog(state); this.fogKey = fogKey; }
    var ok = state.settlements.map(function (s) { return s.shrine ? s.shrine.owner + ':' + s.shrine.eclipsed : '-'; }).join(',');
    if (ok !== this.overlayKey) { this.buildOverlay(state); this.overlayKey = ok; }
    // priest walk animation
    var self = this, now = this.time;
    if (prev) state.priests.forEach(function (pr) { var old = prev.priests.find(function (o) { return o.id === pr.id; }); if (old && old.tile !== pr.tile) self.priestAnim[pr.id] = { from: old.tile, to: pr.tile, t0: now, dur: self.reduced ? 0.01 : 0.9 }; });
  };

  /* ---------------------------------------------------------- camera & projection */
  P.k = function () { return 0.16 + 0.11 * Math.max(0, this.cam.z - 1); };
  P.project = function (wx, wy) {
    var W = this.canvas.width, H = this.canvas.height, z = this.cam.z * this.dpr, k = this.k();
    var dy = wy - this.cam.y, w = Math.max(0.3, 1 - k * dy / H0);
    return { x: W / 2 + z * (wx - this.cam.x) / w, y: H * 0.55 + z * dy / w, s: z / w };
  };
  P.unproject = function (sx, sy) {
    var W = this.canvas.width, H = this.canvas.height, z = this.cam.z * this.dpr, k = this.k();
    var a = (sy - H * 0.55) / z, den = 1 + k * a / H0; if (den <= 0.05) den = 0.05;
    var dy = a / den, w = 1 - k * dy / H0;
    return { x: this.cam.x + (sx - W / 2) * w / z, y: this.cam.y + dy };
  };
  P.pick = function (sx, sy) {
    var st = this.state; if (!st) return -1;
    var p = this.unproject(sx, sy), tiles = st.map.tiles, W = st.map.w;
    for (var r = st.map.h - 1; r >= 0; r--) for (var q = 0; q < W; q++) {
      var t = tiles[r * W + q], tp = this.top(t), dx = Math.abs(p.x - tp.x); if (dx > HW) continue;
      var dy = Math.abs(p.y - tp.y) / SQ; if (dy <= RR - dx * (RR / 2) / HW) return t.id;
    }
    return -1;
  };
  P.clampCam = function () {
    var c = this.cam; c.tx = Math.max(M + 90, Math.min(this.WW - M - 90, c.tx)); c.ty = Math.max(M - 30, Math.min(this.WH - M + 10, c.ty)); c.tz = Math.max(1.05, Math.min(3.4, c.tz));
  };
  P.panBy = function (dsx, dsy) { var z = this.cam.z * this.dpr; this.cam.tx -= dsx / z; this.cam.ty -= dsy / z * 1.2; this.clampCam(); this.cam.x = this.cam.tx; this.cam.y = this.cam.ty; };
  P.zoomAt = function (factor, sx, sy) {
    var before = this.unproject(sx, sy); this.cam.tz *= factor; this.clampCam();
    var oz = this.cam.z; this.cam.z = this.cam.tz; var after = this.unproject(sx, sy); this.cam.z = oz;
    this.cam.tx += before.x - after.x; this.cam.ty += before.y - after.y; this.clampCam();
  };
  P.focusTile = function (id, instant) { var p = this.top(this.state.map.tiles[id]); this.cam.tx = p.x; this.cam.ty = p.y + 30; this.clampCam(); if (instant) { this.cam.x = this.cam.tx; this.cam.y = this.cam.ty; } };

  /* ---------------------------------------------------------- FX */
  P.addFx = function (kind, tileId, opts) {
    if (!this.state) return; opts = opts || {};
    var t = this.state.map.tiles[tileId], p = t ? this.top(t) : { x: this.cam.x, y: this.cam.y }, col = opts.color || '#ffe08a', n, i;
    var lowFx = this.reduced || this.quality === 'low';
    switch (kind) {
      case 'reveal': n = lowFx ? 6 : 26; for (i = 0; i < n; i++) this.fx.push({ k: 'mote', x: p.x + (Math.random() - 0.5) * 70, y: p.y + (Math.random() - 0.5) * 36, vx: (Math.random() - 0.5) * 8, vy: -8 - Math.random() * 14, life: 1.4 + Math.random(), t: 0, c: col }); this.fx.push({ k: 'ring', x: p.x, y: p.y, r0: 6, r1: 60 + (opts.radius || 2) * 20, life: 1.1, t: 0, c: col }); break;
      case 'shrine': this.fx.push({ k: 'beam', x: p.x + 8, y: p.y - 6, life: 1.6, t: 0, c: col }); this.fx.push({ k: 'ring', x: p.x, y: p.y, r0: 4, r1: 70, life: 1.0, t: 0, c: col }); this.shakeIt(2); break;
      case 'control': this.fx.push({ k: 'ring', x: p.x, y: p.y, r0: 10, r1: 46, life: 0.9, t: 0, c: col }); break;
      case 'priest': this.fx.push({ k: 'ring', x: p.x, y: p.y, r0: 2, r1: 22, life: 0.7, t: 0, c: col }); break;
      case 'bolt': case 'hammer':
        var segs = [], yy = p.y - 260, xx = p.x + (Math.random() - 0.5) * 60; while (yy < p.y - 6) { segs.push([xx, yy]); yy += 14 + Math.random() * 16; xx += (Math.random() - 0.5) * 22; } segs.push([p.x, p.y - 4]);
        this.fx.push({ k: 'bolt', segs: segs, x: p.x, y: p.y, life: 0.7, t: 0, c: kind === 'hammer' ? '#bfe4ff' : '#fff2a8' });
        this.fx.push({ k: 'ring', x: p.x, y: p.y, r0: 4, r1: 80, life: 0.8, t: 0, c: '#fff6c8' });
        n = lowFx ? 6 : 24; for (i = 0; i < n; i++) this.fx.push({ k: 'spark', x: p.x, y: p.y - 4, vx: (Math.random() - 0.5) * 120, vy: -40 - Math.random() * 80, life: 0.8 + Math.random() * 0.4, t: 0, c: '#ffe9a0' });
        this.shakeIt(kind === 'hammer' ? 7 : 6); this.flashIt('rgba(255,250,220,', 0.35); break;
      case 'eclipse': case 'topple':
        this.fx.push({ k: 'eclipse', x: p.x + 8, y: p.y - 30, life: 2.2, t: 0 });
        if (kind === 'topple') { n = lowFx ? 6 : 30; for (i = 0; i < n; i++) this.fx.push({ k: 'dust', x: p.x + 8 + (Math.random() - 0.5) * 30, y: p.y - 4, vx: (Math.random() - 0.5) * 40, vy: -10 - Math.random() * 20, life: 1.6, t: 0, c: '#8a8070' }); this.shakeIt(5); }
        this.flashIt('rgba(10,5,20,', 0.25); break;
      case 'feather': this.fx.push({ k: 'feather', x: p.x, y: p.y - 70, tx: p.y - 8, life: 2.0, t: 0 }); this.fx.push({ k: 'ring', x: p.x, y: p.y, r0: 6, r1: 50, life: 1.6, t: 0, c: '#7fe0d8' }); break;
      case 'band': this.fx.push({ k: 'band', y: p.y, life: 2.2, t: 0, rows: opts.rows || 3 }); this.flashIt('rgba(255,220,140,', 0.18); break;
      case 'growth': n = lowFx ? 4 : 14; for (i = 0; i < n; i++) this.fx.push({ k: 'mote', x: p.x + (Math.random() - 0.5) * 40, y: p.y, vx: 0, vy: -20 - Math.random() * 10, life: 1.2, t: 0, c: '#9fe07a' }); break;
      case 'victory': this.flashIt('rgba(255,240,200,', 0.4); break;
    }
  };
  P.addText = function (tileId, text, color) { if (!this.state) return; var p = this.top(this.state.map.tiles[tileId]); this.texts.push({ x: p.x, y: p.y - 26, text: text, c: color || '#fff', t: 0, life: 1.8 }); };
  P.shakeIt = function (a) { if (!this.reduced) this.shake = Math.max(this.shake, a); };
  P.flashIt = function (rgbaPrefix, a) { if (!this.reduced) this.flash = { c: rgbaPrefix, a: a, t: 0 }; };

  /* ---------------------------------------------------------- frame */
  P.resize = function () {
    var dpr = Math.min(2, root.devicePixelRatio || 1); this.dpr = dpr;
    var w = Math.round(this.canvas.clientWidth * dpr), h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  };
  P.render = function (dt) {
    var t0 = (root.performance || Date).now();
    this.resize();
    this.time += dt;
    var c = this.cam, f = 1 - Math.exp(-dt * 9); c.x += (c.tx - c.x) * f; c.y += (c.ty - c.y) * f; c.z += (c.tz - c.z) * f;
    if (!this.state) return;
    this.composeWorld(dt);
    this.drawScreen(dt);
    var ms = (root.performance || Date).now() - t0;
    if (this.autoQuality) { this.frameTimes.push(ms); if (this.frameTimes.length > 90) { var avg = this.frameTimes.reduce(function (a, b) { return a + b; }, 0) / this.frameTimes.length; this.frameTimes = []; if (avg > 24 && this.quality === 'high') this.setQuality('low'); } }
    this.lastFrameMs = ms;
  };
  P.setQuality = function (q) { this.quality = q; this.fogKey = null; if (this.state) this.setState(this.state, this.viewer); };

  P.composeWorld = function (dt) {
    var g = this.fg, st = this.state, self = this, time = this.time, low = this.quality === 'low';
    g.imageSmoothingEnabled = false;
    g.drawImage(this.staticLayer, 0, 0);
    // animated water
    g.save(); g.clip(this.waterPath);
    var drift = this.reduced ? 0 : time;
    g.globalAlpha = 0.55; g.fillStyle = g.createPattern(this.waterPat, 'repeat');
    g.translate((drift * 7) % 128, (Math.sin(drift * 0.6) * 3)); g.fillRect(-128, -64, this.WW + 256, this.WH + 128); g.setTransform(1, 0, 0, 1, 0, 0);
    if (!low) { g.globalAlpha = 0.45; g.fillStyle = g.createPattern(this.waterPat2, 'repeat'); g.translate(-(drift * 4) % 128, (drift * 2) % 64); g.fillRect(-128, -64, this.WW + 256, this.WH + 128); g.setTransform(1, 0, 0, 1, 0, 0); }
    g.globalAlpha = 1; g.restore();
    // shoreline foam
    g.save(); g.strokeStyle = 'rgba(235,250,255,0.55)'; g.lineWidth = 1.5; g.setLineDash([4, 5]); g.lineDashOffset = -drift * 6; g.stroke(this.foamPath);
    g.strokeStyle = 'rgba(235,250,255,0.25)'; g.lineWidth = 3; g.setLineDash([2, 9]); g.lineDashOffset = drift * 4; g.stroke(this.foamPath); g.restore();
    // drifting cloud shadows
    if (!low) { g.globalAlpha = 0.16; this.clouds.forEach(function (cl) { var x = ((cl.x + drift * cl.v) % (self.WW + 400)) - 200; g.drawImage(self.cloudShadow, x + 40, cl.y + 30, 240 * cl.s, 110 * cl.s); }); g.globalAlpha = 1; }
    // territory
    g.drawImage(this.overlay, 0, 0);
    // hover / selection / targets / path
    var pulse = 0.5 + 0.5 * Math.sin(time * 4);
    if (this.targets) this.targets.forEach(function (id) { var p = self.top(st.map.tiles[id]); self.hexPath(g, p.x, p.y, 0.92); g.fillStyle = 'rgba(255,220,120,' + (0.12 + pulse * 0.16).toFixed(3) + ')'; g.fill(); g.strokeStyle = 'rgba(255,230,150,' + (0.5 + pulse * 0.4).toFixed(3) + ')'; g.lineWidth = 1.5; g.stroke(); });
    if (this.path && this.path.length > 1) { g.save(); g.strokeStyle = 'rgba(255,240,200,0.9)'; g.lineWidth = 2; g.setLineDash([3, 3]); g.lineDashOffset = -time * 12; g.beginPath(); this.path.forEach(function (id, i) { var p = self.top(st.map.tiles[id]); if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); }); g.stroke(); g.restore(); }
    if (this.hover >= 0) { var hp = this.top(st.map.tiles[this.hover]); this.hexPath(g, hp.x, hp.y, 0.96); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.5; g.stroke(); }
    if (this.selected >= 0) { var sp = this.top(st.map.tiles[this.selected]); this.hexPath(g, sp.x, sp.y, 0.96 + pulse * 0.04); g.strokeStyle = 'rgba(255,215,110,0.95)'; g.lineWidth = 2; g.stroke(); }
    // objects, depth-sorted
    var rev = st.players[this.viewer].revealed, objs = [];
    st.settlements.forEach(function (s) { if (rev[s.tile]) objs.push({ y: self.top(st.map.tiles[s.tile]).y, s: s }); });
    st.priests.forEach(function (pr) { if (rev[pr.tile] || pr.owner === self.viewer) objs.push({ y: self.top(st.map.tiles[pr.tile]).y + 6, pr: pr }); });
    objs.sort(function (a, b) { return a.y - b.y; });
    g.globalCompositeOperation = 'lighter';
    objs.forEach(function (o) { if (o.s && o.s.shrine && !o.s.shrine.eclipsed) self.drawShrineGlow(g, st, o.s, time); });
    g.globalCompositeOperation = 'source-over';
    objs.forEach(function (o) { if (o.s) self.drawSettlement(g, st, o.s, time); else self.drawPriest(g, st, o.pr, time); });
    // fog of war (cross-fades when it lifts)
    g.drawImage(this.fog, 0, 0);
    if (this.oldFog && this.fogFade > 0) { g.globalAlpha = this.fogFade; g.drawImage(this.oldFog, 0, 0); g.globalAlpha = 1; this.fogFade -= dt / 1.3; if (this.fogFade <= 0) this.oldFog = null; }
    // world FX
    this.drawFx(g, dt);
  };

  P.drawShrineGlow = function (g, st, s, time) {
    var p = this.top(st.map.tiles[s.tile]), pal = this.fac[st.players[s.shrine.owner].faction].palette, pulse = this.reduced ? 0.8 : 0.8 + 0.2 * Math.sin(time * 2 + s.id);
    var gr = g.createRadialGradient(p.x + 8, p.y - 10, 2, p.x + 8, p.y - 10, 46 * pulse); gr.addColorStop(0, A.rgba(pal.glow, 0.55)); gr.addColorStop(0.4, A.rgba(pal.glow, 0.16)); gr.addColorStop(1, A.rgba(pal.glow, 0));
    g.fillStyle = gr; g.fillRect(p.x - 50, p.y - 60, 116, 100);
    // pool of light on the ground
    g.fillStyle = A.rgba(pal.glow, 0.18 * pulse); g.beginPath(); g.ellipse(p.x + 6, p.y + 2, 34, 12, 0, 0, 7); g.fill();
    // faint sky pillar
    var bg = g.createLinearGradient(0, p.y - 120, 0, p.y - 10); bg.addColorStop(0, A.rgba(pal.glow, 0)); bg.addColorStop(1, A.rgba(pal.glow, 0.12 * pulse)); g.fillStyle = bg; g.fillRect(p.x + 5, p.y - 120, 6, 110);
  };
  P.drawSettlement = function (g, st, s, time) {
    var p = this.top(st.map.tiles[s.tile]), v = this.village(st, s), self = this;
    var ctrl = s.controlledBy;
    if (ctrl >= 0) { var pal = this.fac[st.players[ctrl].faction].palette; g.strokeStyle = A.rgba(pal.accent, 0.8); g.lineWidth = 1.5; g.beginPath(); g.ellipse(p.x - 2, p.y + 2, 24, 9, 0, 0, 7); g.stroke(); }
    g.drawImage(v.c, Math.round(p.x - 34), Math.round(p.y - 28));
    if (s.shrine) {
      var spr = this.shrineSprite(s.shrine.type, s.shrine.eclipsed > 0);
      g.drawImage(spr, Math.round(p.x - 4), Math.round(p.y - 44));
      // ward pips
      for (var i = 0; i < s.shrine.ward; i++) { g.fillStyle = s.shrine.eclipsed ? '#6a6070' : '#ffe9a0'; g.fillRect(Math.round(p.x + 10 + i * 4), Math.round(p.y - 48), 2, 2); }
    }
    // chimney smoke
    if (!this.reduced && this.quality !== 'low') v.chim.forEach(function (ch, k) {
      for (var j = 0; j < 4; j++) { var ph = ((time * 0.35 + j / 4 + k * 0.37 + s.id * 0.13) % 1); var sx = p.x - 34 + ch[0] + Math.sin(ph * 6 + k) * 2 + ph * 6, sy = p.y - 28 + ch[1] - ph * 18; g.fillStyle = 'rgba(210,210,215,' + (0.35 * (1 - ph)).toFixed(3) + ')'; var sz = 1 + ph * 3; g.fillRect(Math.round(sx), Math.round(sy), Math.round(sz), Math.round(sz)); }
    });
    // banner pole with controlling colour
    if (ctrl >= 0) { var pal2 = this.fac[st.players[ctrl].faction].palette, wave = this.reduced ? 0 : Math.sin(time * 5 + s.id) * 1; g.fillStyle = '#3a2a1a'; g.fillRect(Math.round(p.x - 22), Math.round(p.y - 30), 1, 14); g.fillStyle = pal2.secondary; g.fillRect(Math.round(p.x - 21), Math.round(p.y - 30), 6, 3); g.fillStyle = pal2.accent; g.fillRect(Math.round(p.x - 21 + 6), Math.round(p.y - 30 + wave), 2, 3); }
  };
  P.drawPriest = function (g, st, pr, time) {
    var self = this, t = st.map.tiles[pr.tile], p = this.top(t), an = this.priestAnim[pr.id];
    if (an) { var k = (this.time - an.t0) / an.dur; if (k >= 1) delete this.priestAnim[pr.id]; else { var a = this.top(st.map.tiles[an.from]); k = k * k * (3 - 2 * k); p = { x: a.x + (p.x - a.x) * k, y: a.y + (p.y - a.y) * k - Math.sin(k * Math.PI) * 6 }; } }
    var pal = this.fac[st.players[pr.owner].faction].palette, bob = this.reduced ? 0 : Math.round(Math.sin(time * 3 + pr.id) * 0.8);
    var x = Math.round(p.x - 14 + (pr.id % 3) * 5), y = Math.round(p.y + 6);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x + 2, y + 1, 5, 2, 0, 0, 7); g.fill();
    g.fillStyle = A.shade(pal.secondary, -0.3); g.fillRect(x - 2, y - 8 + bob, 6, 9); g.fillStyle = pal.secondary; g.fillRect(x - 2, y - 8 + bob, 3, 9);
    g.fillStyle = pal.primary; g.fillRect(x - 1, y - 12 + bob, 4, 4); g.fillStyle = '#e0c098'; g.fillRect(x, y - 11 + bob, 2, 2);
    g.fillStyle = '#8a6a3a'; g.fillRect(x + 5, y - 13 + bob, 1, 13); g.fillStyle = pal.glow; g.fillRect(x + 4, y - 15 + bob, 3, 2);
    if (this.selPriest === pr.id) { g.strokeStyle = 'rgba(255,230,140,0.95)'; g.lineWidth = 1; g.beginPath(); g.ellipse(x + 2, y + 1, 8, 3.5, 0, 0, 7); g.stroke(); }
  };

  P.drawFx = function (g, dt) {
    var self = this, keep = [];
    this.fx.forEach(function (e) {
      e.t += dt; var k = e.t / e.life; if (k >= 1) return; keep.push(e);
      switch (e.k) {
        case 'mote': e.x += e.vx * dt; e.y += e.vy * dt; g.fillStyle = A.rgba(e.c, (1 - k).toFixed(3)); g.fillRect(Math.round(e.x), Math.round(e.y), 2, 2); break;
        case 'spark': e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 160 * dt; g.fillStyle = A.rgba(e.c, (1 - k).toFixed(3)); g.fillRect(Math.round(e.x), Math.round(e.y), 1, 1); break;
        case 'dust': e.x += e.vx * dt; e.y += e.vy * dt; g.fillStyle = 'rgba(140,130,110,' + (0.6 * (1 - k)).toFixed(3) + ')'; var ds = 2 + k * 6; g.fillRect(Math.round(e.x - ds / 2), Math.round(e.y - ds / 2), Math.round(ds), Math.round(ds)); break;
        case 'ring': var rr = e.r0 + (e.r1 - e.r0) * (1 - Math.pow(1 - k, 2)); g.strokeStyle = A.rgba(e.c, (0.9 * (1 - k)).toFixed(3)); g.lineWidth = 2; g.beginPath(); g.ellipse(e.x, e.y, rr, rr * SQ, 0, 0, 7); g.stroke(); break;
        case 'beam': var bg = g.createLinearGradient(0, e.y - 220, 0, e.y); bg.addColorStop(0, A.rgba(e.c, 0)); bg.addColorStop(1, A.rgba(e.c, 0.7 * (1 - k))); g.fillStyle = bg; var bw = 10 * (1 - k) + 2; g.fillRect(e.x - bw / 2, e.y - 220, bw, 220); break;
        case 'bolt':
          var a = k < 0.15 ? 1 : (1 - k); g.strokeStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')'; g.lineWidth = 2; g.beginPath(); e.segs.forEach(function (s, i) { if (i) g.lineTo(s[0], s[1]); else g.moveTo(s[0], s[1]); }); g.stroke();
          g.strokeStyle = A.rgba(e.c, (a * 0.5).toFixed(3)); g.lineWidth = 6; g.stroke();
          var gl = g.createRadialGradient(e.x, e.y, 0, e.x, e.y, 70); gl.addColorStop(0, A.rgba(e.c, (0.6 * a).toFixed(3))); gl.addColorStop(1, A.rgba(e.c, 0)); g.fillStyle = gl; g.fillRect(e.x - 70, e.y - 70, 140, 140); break;
        case 'eclipse':
          var cover = Math.min(1, k * 2.2), rad = 14;
          g.fillStyle = 'rgba(255,210,120,' + (0.7 * (1 - k)).toFixed(3) + ')'; g.beginPath(); g.arc(e.x, e.y, rad + 3, 0, 7); g.fill();
          g.fillStyle = 'rgba(8,6,16,' + (0.95 * (1 - k * 0.7)).toFixed(3) + ')'; g.beginPath(); g.arc(e.x - rad * 2 * (1 - cover), e.y, rad, 0, 7); g.fill();
          var sh = g.createRadialGradient(e.x, e.y + 30, 0, e.x, e.y + 30, 80); sh.addColorStop(0, 'rgba(5,0,15,' + (0.5 * Math.sin(k * Math.PI)).toFixed(3) + ')'); sh.addColorStop(1, 'rgba(5,0,15,0)'); g.fillStyle = sh; g.fillRect(e.x - 80, e.y - 50, 160, 160); break;
        case 'feather':
          var fy = e.y + (e.tx - e.y) * Math.min(1, k * 1.4), fx = e.x + Math.sin(k * 9) * 8; g.fillStyle = 'rgba(245,240,225,' + (1 - Math.max(0, k - 0.7) / 0.3).toFixed(3) + ')'; g.save(); g.translate(fx, fy); g.rotate(Math.sin(k * 9) * 0.5); g.fillRect(-1, -7, 2, 14); g.fillStyle = 'rgba(54,179,168,0.9)'; g.fillRect(-1, -7, 1, 4); g.restore(); break;
        case 'band':
          var bandY = e.y, sweepX = -100 + (self.WW + 200) * k; var hb = (e.rows / 2 + 0.5) * ROW;
          var bgr = g.createLinearGradient(sweepX - 260, 0, sweepX, 0); bgr.addColorStop(0, 'rgba(255,220,140,0)'); bgr.addColorStop(1, 'rgba(255,230,160,0.45)'); g.fillStyle = bgr; g.fillRect(sweepX - 260, bandY - hb, 260, hb * 2);
          A.disc(g, sweepX, bandY - hb - 10, 6, 'rgba(255,240,180,0.95)'); break;
      }
    });
    this.fx = keep;
  };

  P.drawScreen = function (dt) {
    var ctx = this.ctx, W = this.canvas.width, H = this.canvas.height, self = this, st = this.state, time = this.time;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    // sky / far ocean backdrop
    // sky only above the projected horizon; below it the world continues as open sea (so the map edge never shows a pale wedge)
    var hzY = Math.max(0, Math.min(H, H * 0.55 + (-H0 / this.k() * 0.98) * this.cam.z * this.dpr));
    ctx.fillStyle = '#1b3044'; ctx.fillRect(0, 0, W, H);
    if (hzY > 0) { var sky = ctx.createLinearGradient(0, 0, 0, hzY); sky.addColorStop(0, '#7d8ea3'); sky.addColorStop(0.7, '#4a5e74'); sky.addColorStop(1, '#2a4258'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hzY); }
    var sx = 0, sy = 0; if (this.shake > 0.05) { sx = (Math.random() - 0.5) * this.shake * this.dpr; sy = (Math.random() - 0.5) * this.shake * this.dpr; this.shake *= Math.pow(0.02, dt); } else this.shake = 0;
    // perspective strips
    var z = this.cam.z * this.dpr, k = this.k(), step = this.quality === 'low' ? 6 : 3, cx = this.cam.x, cy = this.cam.y, horizonA = -H0 / k * 0.98;
    for (var y = 0; y < H; y += step) {
      var a0 = (y - H * 0.55) / z, a1 = (y + step - H * 0.55) / z; if (a0 <= horizonA) continue;
      var dy0 = a0 / (1 + k * a0 / H0), dy1 = a1 / (1 + k * a1 / H0), wm = 1 - k * ((dy0 + dy1) / 2) / H0;
      var srcW = W * wm / z, srcX = cx - srcW / 2, srcY = cy + dy0, srcH = Math.max(0.5, dy1 - dy0);
      if (srcY + srcH < 0 || srcY > this.WH) continue;
      var dx = 0, dw = W;
      if (srcX < 0) { dx = -srcX / srcW * W; dw -= dx; srcW += srcX; srcX = 0; }
      if (srcX + srcW > this.WW) { var over = srcX + srcW - this.WW; dw -= over / srcW * W; srcW -= over; }
      if (srcW <= 0) continue;
      ctx.drawImage(this.frame, srcX, srcY, srcW, srcH, dx + sx, y + sy, dw, step + 0.5);
    }
    // atmospheric perspective: haze toward the horizon (top of screen)
    var hz = ctx.createLinearGradient(0, 0, 0, H * 0.55); hz.addColorStop(0, 'rgba(190,205,215,0.55)'); hz.addColorStop(0.35, 'rgba(170,190,205,0.18)'); hz.addColorStop(1, 'rgba(170,190,205,0)');
    ctx.fillStyle = hz; ctx.fillRect(0, 0, W, H * 0.55);
    // warm golden-hour grade from the sun side
    ctx.globalCompositeOperation = 'soft-light'; var wg = ctx.createRadialGradient(W * 0.1, -H * 0.2, 0, W * 0.1, -H * 0.2, W * 1.1); wg.addColorStop(0, 'rgba(255,200,120,0.55)'); wg.addColorStop(1, 'rgba(40,60,120,0.35)'); ctx.fillStyle = wg; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
    // high clouds with parallax (move faster than the ground when panning)
    if (this.quality !== 'low') {
      ctx.globalAlpha = 0.32;
      this.highClouds.forEach(function (cl) { var px = ((cl.x - self.cam.x * 1.25 * self.dpr + (self.reduced ? 0 : time * cl.v)) % (W + 800) + W + 800) % (W + 800) - 400; var py = cl.y * H - (self.cam.y - 300) * 0.3 * self.dpr; ctx.drawImage(self.cloudSprite, px, py, 300 * cl.s * self.dpr, 130 * cl.s * self.dpr); });
      ctx.globalAlpha = 1;
    }
    // settlement banners (crisp, screen-space, Civ-style)
    this.drawBanners(ctx);
    // floating texts
    var keep = [];
    this.texts.forEach(function (tx) { tx.t += dt; if (tx.t > tx.life) return; keep.push(tx); var p = self.project(tx.x, tx.y - tx.t * 14); ctx.globalAlpha = Math.min(1, (tx.life - tx.t) * 2); ctx.font = 'bold ' + Math.round(13 * self.dpr) + 'px Georgia, serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3 * self.dpr; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(tx.text, p.x, p.y); ctx.fillStyle = tx.c; ctx.fillText(tx.text, p.x, p.y); ctx.globalAlpha = 1; });
    this.texts = keep;
    // vignette
    var vg = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(5,8,15,0)'); vg.addColorStop(1, 'rgba(5,8,15,0.6)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (this.flash) { this.flash.t += dt; var fa = this.flash.a * Math.max(0, 1 - this.flash.t / 0.5); if (fa <= 0) this.flash = null; else { ctx.fillStyle = this.flash.c + fa.toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); } }
  };

  P.drawBanners = function (ctx) {
    var st = this.state, self = this, rev = st.players[this.viewer].revealed, dpr = this.dpr;
    if (this.cam.z < 1.25) return;
    st.settlements.forEach(function (s) {
      if (!rev[s.tile]) return;
      var tp = self.top(st.map.tiles[s.tile]), p = self.project(tp.x, tp.y + 20);
      if (p.x < -100 || p.x > self.canvas.width + 100 || p.y < -40 || p.y > self.canvas.height + 40) return;
      var sc = Math.max(0.7, Math.min(1.25, p.s / (2 * dpr))) * dpr;
      ctx.font = '600 ' + Math.round(11 * sc) + 'px Georgia, "Palatino Linotype", serif';
      var name = s.name, tw = ctx.measureText(name).width, w = tw + 30 * sc, h = 16 * sc, x = Math.round(p.x - w / 2), y = Math.round(p.y);
      var ctrl = s.controlledBy, pal = ctrl >= 0 ? self.fac[st.players[ctrl].faction].palette : null;
      ctx.fillStyle = 'rgba(12,14,22,0.78)'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = pal ? pal.secondary : '#55524a'; ctx.fillRect(x, y, 4 * sc, h);
      ctx.strokeStyle = pal ? pal.accent : 'rgba(200,190,160,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.fillStyle = '#f2ead6'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(name, x + 8 * sc, y + h / 2 + 0.5);
      ctx.fillStyle = '#e2c27a'; ctx.textAlign = 'right'; ctx.fillText(String(s.pop), x + w - 5 * sc, y + h / 2 + 0.5);
      // follower composition bar
      var bx = x, by = y + h, bw = w, bh = Math.max(3, 3 * sc), acc = 0;
      ctx.fillStyle = 'rgba(80,80,80,0.9)'; ctx.fillRect(bx, by, bw, bh);
      s.followers.forEach(function (f, pid) { if (!f) return; var fw = bw * f / s.pop; ctx.fillStyle = self.fac[st.players[pid].faction].palette.secondary; ctx.fillRect(bx + acc, by, fw, bh); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(bx + acc, by, fw, 1); acc += fw; });
    });
  };

  /* ---------------------------------------------------------- minimap */
  P.drawMinimap = function (mc) {
    var st = this.state; if (!st) return;
    var g = mc.getContext('2d'), W = mc.width, H = mc.height, tiles = st.map.tiles, rev = st.players[this.viewer].revealed, self = this;
    var sx = W / (st.map.w + 0.5), sy = H / st.map.h;
    g.fillStyle = '#0c1a26'; g.fillRect(0, 0, W, H);
    tiles.forEach(function (t) {
      var x = (t.q + (t.r & 1) * 0.5) * sx, y = t.r * sy;
      if (!rev[t.id]) { g.fillStyle = '#151a24'; g.fillRect(x, y, sx + 0.6, sy + 0.6); return; }
      g.fillStyle = t.terrain === 'mountains' ? '#9a958c' : self.T[t.terrain].top; g.fillRect(x, y, sx + 0.6, sy + 0.6);
      var o = self.terr ? self.terr[t.id] : -1; if (o >= 0) { g.fillStyle = A.rgba(self.fac[st.players[o].faction].palette.secondary, 0.55); g.fillRect(x, y, sx + 0.6, sy + 0.6); }
    });
    st.settlements.forEach(function (s) { if (!rev[s.tile]) return; var t = tiles[s.tile], x = (t.q + (t.r & 1) * 0.5 + 0.5) * sx, y = (t.r + 0.5) * sy; g.fillStyle = s.shrine ? self.fac[st.players[s.shrine.owner].faction].palette.accent : '#f2ead6'; g.fillRect(x - 2, y - 2, 4, 4); g.strokeStyle = '#000'; g.strokeRect(x - 2.5, y - 2.5, 5, 5); });
    // camera footprint (projected screen corners back to the map)
    var cw = this.canvas.width, ch = this.canvas.height, pts = [[0, ch * 0.05], [cw, ch * 0.05], [cw, ch], [0, ch]].map(function (c) { var w = self.unproject(c[0], c[1]); return [(w.x - M - 26) / COL * sx + sx * 0.5, (w.y - M - 30) / ROW * sy + sy * 0.5]; });
    g.strokeStyle = 'rgba(255,230,160,0.9)'; g.lineWidth = 1.5; g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); g.stroke();
  };
  P.minimapToWorld = function (mc, mx, my) {
    var st = this.state, sx = mc.width / (st.map.w + 0.5), sy = mc.height / st.map.h;
    return { x: M + 26 + (mx / sx - 0.5) * COL, y: M + 30 + (my / sy - 0.5) * ROW };
  };

  root.PWRenderer = Renderer;
})(typeof self !== 'undefined' ? self : this);
