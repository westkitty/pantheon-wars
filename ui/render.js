/*
 * Pantheon Wars — world renderer (render-only: it reads state, never changes it).
 * Pipeline per frame:
 *   1. world-space "frame" canvas = cached static terrain (extruded hex tiles, painted shading, AO, cliff shadows, micro-decor)
 *      + animated water/foam + cloud shadows + cached territory overlay (heraldic patterns) + cached marks layer (scars, blessings, ruins)
 *      + routes/travellers + landmarks + weather + settlements/shrines/priests + threat/covenant markers + influence layer
 *      + cached fog of war (soft, cross-faded, per-tile reveal theatre) + world FX (three-beat miracle choreography).
 *   2. perspective projection: thin horizontal strips scaled by a pinhole projection (unchanged from v0.1, so picking math holds).
 *   3. screen-space atmosphere: sky that moves through the 45 turns, faction atmosphere, haze, high clouds, banners, vignette, flashes.
 * Cosmetic randomness comes from a private stream (this.fxr) and never touches the game RNG.
 */
(function (root) {
  'use strict';
  var A = root.PWArt;
  var SQ = 0.6, HW = 26, RR = 30, ROW = 27, COL = 52, M = 150, H0 = 520;
  var VERTS = [[26, 9], [0, 18], [-26, 9], [-26, -9], [0, -18], [26, -9]];
  var EDGE_NB = [5, 4, 3, 2, 1, 0]; // edge k (VERTS[k]→VERTS[k+1]) borders neighbour index EDGE_NB[k]
  var DASH = { meander: [6, 2, 2, 2], chevron: [5, 3], hbar: [], grid: [2, 2], dots: [1, 3], zigzag: [4, 2, 1, 2], cross: [8, 2, 2, 2], wave: [3, 3], vbar: [10, 3], ring: [1, 2, 4, 2] };

  /* Village architecture per culture (P031): wall, shade, roof colours and a roof form. Neutral towns use the biome style. */
  var ARCH = {
    greek: { wall: '#ece6d6', side: '#b8b0a0', roof: '#c0583a', roofR: '#8a3a28', form: 'gable', extra: 'column' },
    norse: { wall: '#6a5240', side: '#463628', roof: '#5a6470', roofR: '#3a424c', form: 'steep', extra: 'smoke' },
    egyptian: { wall: '#e0c48c', side: '#b0925e', roof: null, form: 'flat', extra: 'palm' },
    mesopotamian: { wall: '#c8a878', side: '#9a7a50', roof: null, form: 'flat', extra: 'stair' },
    irish: { wall: '#d8d0c0', side: '#a89c88', roof: '#9a8448', roofR: '#6a5a30', form: 'round', extra: 'fence' },
    mexica: { wall: '#e8e0d0', side: '#b8a890', roof: null, form: 'flat', extra: 'paint' },
    hittite: { wall: '#a8a294', side: '#7a766c', roof: null, form: 'flat', extra: 'stone' },
    yoruba: { wall: '#b8784a', side: '#8a5430', roof: '#8a6a3a', roofR: '#6a4a2a', form: 'hip', extra: 'post' },
    japanese: { wall: '#e8dcc4', side: '#b4a68c', roof: '#4a3a2a', roofR: '#2a2018', form: 'steep', extra: 'torii' },
    vedic: { wall: '#d8c090', side: '#a88a5a', roof: '#b89a5a', roofR: '#8a6a3a', form: 'thatch', extra: 'fire' },
    mud: { wall: '#d8bc88', side: '#a88a5a', roof: null, form: 'flat' }, timber: { wall: '#6a5240', side: '#463628', roof: '#5a6470', roofR: '#3a424c', form: 'steep' },
    tile: { wall: '#e8dcc4', side: '#b4a68c', roof: '#c0583a', roofR: '#8a3a28', form: 'gable' }
  };

  /* Forty faction-power signatures plus core rites (P043/P044). Each is three beats built from shared primitives:
   *   a: anticipation (sky tint, gathering motes at the target), m: manifestation (the motif), c: consequence (aftermath on the ground).
   * Distinct compositions, not recolours: motif primitive, path, palette, duration and aftermath all differ. */
  var VFX = {
    oak_whisper: { tint: '#9fd2ff', a: 'leaves', m: 'leafSwirl', c: 'ring', col: '#86b552' },
    aegis_wall: { tint: '#9fd2ff', a: 'rise', m: 'dome', c: 'wardPips', col: '#e2b33c' },
    grain_wave: { tint: '#ffe08a', a: 'motes', m: 'wheat', c: 'growth', col: '#f1d27a', wide: true },
    bolt_strike: { tint: '#fff6c8', a: 'darken', m: 'bolt', c: 'scorch', col: '#fff2a8', flash: 0.35, shake: 6 },
    raven_flight: { tint: '#c9d6de', a: 'none', m: 'birds', c: 'ring', col: '#22232b' },
    rune_carve: { tint: '#ffb067', a: 'sparks', m: 'runes', c: 'beam', col: '#8a2b22' },
    sunrain_shower: { tint: '#ffd36a', a: 'cloud', m: 'rain', c: 'growth', col: '#6fb0e0', wide: true },
    hammer_arc: { tint: '#bfe4ff', a: 'darken', m: 'hammer', c: 'eclipseRing', col: '#bfe4ff', flash: 0.3, shake: 7 },
    barque_sail: { tint: '#ffe08a', a: 'glow', m: 'band', c: 'none', col: '#ffcf4a' },
    throne_wings: { tint: '#ffe08a', a: 'rise', m: 'wings', c: 'ring', col: '#36b3a8' },
    sprout_mound: { tint: '#9fe07a', a: 'motes', m: 'sprouts', c: 'growth', col: '#7cc25a' },
    feather_scale: { tint: '#7fe0d8', a: 'darken', m: 'feather', c: 'ring', col: '#7fe0d8' },
    solar_traverse: { tint: '#ffe08a', a: 'glow', m: 'sunArc', c: 'riverGlint', col: '#ffcf4a' },
    rising_tablets: { tint: '#c9b8ff', a: 'water', m: 'tablets', c: 'ring', col: '#d4b884' },
    spring_rise: { tint: '#9fd8f0', a: 'motes', m: 'fountain', c: 'growth', col: '#9fd8f0' },
    star_descent: { tint: '#c9b8ff', a: 'darken', m: 'star8', c: 'ring', col: '#e8c15a', flash: 0.15 },
    omen_script: { tint: '#b6f0c8', a: 'mist', m: 'glyphs', c: 'none', col: '#b6f0c8' },
    assembly_fires: { tint: '#ffb04a', a: 'motes', m: 'fires', c: 'wardPips', col: '#ffb04a' },
    hearth_steam: { tint: '#ffd090', a: 'none', m: 'steam', c: 'growth', col: '#e6e1cf', wide: true },
    challenge_rings: { tint: '#c9a04a', a: 'darken', m: 'rings', c: 'none', col: '#c9a04a' },
    wind_sweep: { tint: '#9ff5e4', a: 'none', m: 'wind', c: 'none', col: '#bff5ea' },
    garden_rise: { tint: '#9ff5e4', a: 'water', m: 'sprouts', c: 'beam', col: '#7cc25a' },
    rain_curtain: { tint: '#9fd8f0', a: 'cloud', m: 'rain', c: 'growth', col: '#9fd8f0' },
    noon_glare: { tint: '#fff8d0', a: 'glow', m: 'sunburst', c: 'ring', col: '#ffe070', flash: 0.25 },
    sun_disc_omen: { tint: '#ffe2a8', a: 'none', m: 'disc', c: 'none', col: '#d9a441' },
    gate_rebuild: { tint: '#e2d6bf', a: 'dust', m: 'blocks', c: 'wardPips', col: '#a09a8e' },
    meadow_wake: { tint: '#9fd870', a: 'none', m: 'bees', c: 'growth', col: '#e0b030' },
    tempest_front: { tint: '#9fb8d8', a: 'cloud', m: 'tempest', c: 'eclipseRing', col: '#e8eef4', flash: 0.3, shake: 6 },
    mirror_ripple: { tint: '#9fd8f0', a: 'none', m: 'ripples', c: 'riverGlint', col: '#9fd8f0' },
    clay_restore: { tint: '#efe6d2', a: 'dust', m: 'shards', c: 'wardPips', col: '#c8946a' },
    forge_sparks: { tint: '#ffd060', a: 'none', m: 'forge', c: 'roads', col: '#ffd060' },
    thunder_stone: { tint: '#ffe070', a: 'darken', m: 'stone', c: 'scorch', col: '#ffe070', flash: 0.3, shake: 5 },
    dawn_rays: { tint: '#ffd9c2', a: 'glow', m: 'rays', c: 'ring', col: '#ffd9c2' },
    gate_raise: { tint: '#e5532d', a: 'none', m: 'torii', c: 'beam', col: '#e5532d' },
    paddy_glow: { tint: '#e9c46a', a: 'none', m: 'paddy', c: 'growth', col: '#9fe07a', wide: true },
    gathering_storm: { tint: '#5a6270', a: 'cloud', m: 'stormCloud', c: 'none', col: '#9fc0e0' },
    dawn_unveil: { tint: '#fff0a0', a: 'none', m: 'horizon', c: 'ring', col: '#fff0a0' },
    fire_kindle: { tint: '#ffb070', a: 'sparks', m: 'flame', c: 'beam', col: '#d4502a' },
    water_measure: { tint: '#9fd8f0', a: 'none', m: 'measure', c: 'ring', col: '#e0b81f' },
    monsoon_burst: { tint: '#7fb8f0', a: 'cloud', m: 'downpour', c: 'scorch', col: '#7fb8f0', flash: 0.2, shake: 4 },
    // core rites and system effects
    omen: { tint: '#ffe08a', a: 'none', m: 'eye', c: 'none', col: '#ffe08a' }, eclipse: { tint: '#100818', a: 'darken', m: 'eclipseDisc', c: 'eclipseRing', col: '#ffd27a', flash: 0.25 },
    counter: { tint: '#9fd2ff', a: 'none', m: 'shieldArc', c: 'wardPips', col: '#9fd2ff' }, storm: { tint: '#5a6270', a: 'cloud', m: 'stormCloud', c: 'none', col: '#9fc0e0' }
  };
  var VFX_IDS = Object.keys(VFX);

  function Renderer(canvas, data) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.data = data; this.T = data.terrain.types;
    this.fac = {}; var self = this; data.factions.forEach(function (f) { self.fac[f.id] = f; });
    this.shrineDefs = {}; data.shrines.forEach(function (s) { self.shrineDefs[s.id] = s; });
    this.cam = { x: 0, y: 0, z: 1.9, tx: 0, ty: 0, tz: 1.9 };
    this.fx = []; this.texts = []; this.shake = 0; this.flash = null; this.tint = null;
    this.quality = 'high'; this.autoQuality = true; this.frameTimes = []; this.lowSince = 0;
    this.sysReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.reduced = this.sysReduced; this.reducedFlash = false; this.patterns = true; this.contrast = false; this.influence = null; this.showRoutes = false;
    this.hover = -1; this.selected = -1; this.targets = null; this.path = null; this.viewer = 0; this.blackout = false;
    this.time = 0; this.priestAnim = {}; this.state = null; this.E = null; this.fxr = A.rng(12345);
    this.fogAlpha = 1; this.oldFog = null; this.fogFade = 0; this.revealAnims = [];
    this.spriteCache = {};
  }
  var P = Renderer.prototype;
  Renderer.VFX = VFX; Renderer.VFX_IDS = VFX_IDS; Renderer.ARCH = ARCH;
  P.setEngine = function (E) { this.E = E; };
  P.rand = function () { return this.fxr(); };

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
    this.waterDepth = this.computeDepth(state);
    this.buildPatterns();
    this.staticLayer = this.buildStatic(state);
    this.buildWaterPaths(state);
    this.villageCache = {}; this.spriteCache = {}; this.marksKey = null; this.marksLayer = null; this.overlay = null;
    var mid = this.center(state.map.tiles[Math.floor(H / 2) * W + Math.floor(W / 2)]);
    this.cam.x = this.cam.tx = mid.x; this.cam.y = this.cam.ty = mid.y;
    this.clouds = []; var r = A.rng(state.seed * 7 + 3);
    for (var i = 0; i < 7; i++) this.clouds.push({ x: r() * this.WW, y: r() * this.WH, s: 0.7 + r() * 0.9, v: 4 + r() * 5 });
    this.highClouds = []; for (i = 0; i < 6; i++) this.highClouds.push({ x: r() * 2400 - 400, y: r() * 0.35, s: 0.8 + r() * 1.2, v: 5 + r() * 6 });
    this.motes = []; for (i = 0; i < 36; i++) this.motes.push({ x: r(), y: r(), v: 0.3 + r() * 0.7, p: r() * 6.28 });
    this.fogKey = null; this.overlayKey = null; this.prevRevealed = null; this.revealAnims = [];
  };
  /* distance (in tiles, capped at 3) from every water tile to the nearest land: drives shallow-to-deep colour (P037) */
  P.computeDepth = function (state) {
    var T = this.T, tiles = state.map.tiles, d = tiles.map(function (t) { return T[t.terrain].water ? 9 : 0; }), q = [];
    tiles.forEach(function (t) { if (!T[t.terrain].water) q.push(t.id); });
    for (var head = 0; head < q.length; head++) { var k = q[head]; tiles[k].n.forEach(function (j) { if (j >= 0 && d[j] > d[k] + 1) { d[j] = d[k] + 1; q.push(j); } }); }
    return d;
  };

  P.buildPatterns = function () {
    var c = A.cv(128, 64), g = c.getContext('2d'), r = A.rng(99);
    for (var i = 0; i < 70; i++) { var x = r() * 128, y = r() * 64, w = 2 + r() * 6; g.fillStyle = 'rgba(220,240,255,' + (0.25 + r() * 0.5).toFixed(2) + ')'; g.fillRect(x | 0, y | 0, w | 0, 1); }
    this.waterPat = c;
    var c2 = A.cv(128, 64), g2 = c2.getContext('2d'); r = A.rng(7);
    for (i = 0; i < 40; i++) { g2.fillStyle = 'rgba(160,210,230,' + (0.15 + r() * 0.3).toFixed(2) + ')'; g2.fillRect(r() * 128 | 0, r() * 64 | 0, 3 + r() * 9 | 0, 1); }
    this.waterPat2 = c2;
    var cc = A.cv(240, 110), cg = cc.getContext('2d'); r = A.rng(5);
    for (i = 0; i < 14; i++) { var bx = 40 + r() * 160, by = 40 + r() * 35, br = 22 + r() * 30, gr = cg.createRadialGradient(bx, by, 0, bx, by, br); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); cg.fillStyle = gr; cg.fillRect(0, 0, 240, 110); }
    this.cloudSprite = cc;
    var cs = A.cv(240, 110), csg = cs.getContext('2d'); csg.drawImage(cc, 0, 0); csg.globalCompositeOperation = 'source-in'; csg.fillStyle = 'rgba(10,20,30,1)'; csg.fillRect(0, 0, 240, 110);
    this.cloudShadow = cs;
    var dk = A.cv(240, 110), dkg = dk.getContext('2d'); dkg.drawImage(cc, 0, 0); dkg.globalCompositeOperation = 'source-in'; dkg.fillStyle = 'rgba(40,46,60,1)'; dkg.fillRect(0, 0, 240, 110);
    this.stormSprite = dk;
    var fc = A.cv(256, 256), fgc = fc.getContext('2d'); r = A.rng(11);
    fgc.fillStyle = '#2b3446'; fgc.fillRect(0, 0, 256, 256);
    function blob(fx, fy, fr, col) { for (var ox = -256; ox <= 256; ox += 256) for (var oy = -256; oy <= 256; oy += 256) { var gr = fgc.createRadialGradient(fx + ox, fy + oy, 0, fx + ox, fy + oy, fr); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); fgc.fillStyle = gr; fgc.fillRect(fx + ox - fr, fy + oy - fr, fr * 2, fr * 2); } }
    for (i = 0; i < 26; i++) blob(r() * 256, r() * 256, 40 + r() * 50, 'rgba(12,16,26,0.45)');
    for (i = 0; i < 70; i++) { var bx2 = r() * 256, by2 = r() * 256, br2 = 14 + r() * 30; blob(bx2, by2 + br2 * 0.3, br2, 'rgba(14,18,30,0.35)'); blob(bx2, by2, br2, 'rgba(120,136,165,0.30)'); blob(bx2 - br2 * 0.25, by2 - br2 * 0.3, br2 * 0.5, 'rgba(190,200,220,0.16)'); }
    this.fogTex = fc;
  };

  P.buildWaterPaths = function (state) {
    var self = this, water = new Path2D(), foam = new Path2D(), shallow = new Path2D();
    state.map.tiles.forEach(function (t) {
      if (!self.T[t.terrain].water) return;
      var p = self.top(t), sh = self.waterDepth[t.id] <= 1;
      for (var k = 0; k < 6; k++) { var v = VERTS[k]; var path = sh ? shallow : water; if (k === 0) path.moveTo(p.x + v[0] * 1.02, p.y + v[1] * 1.02); else path.lineTo(p.x + v[0] * 1.02, p.y + v[1] * 1.02); }
      (sh ? shallow : water).closePath();
      for (k = 0; k < 6; k++) {
        var n = t.n[EDGE_NB[k]]; if (n < 0 || self.T[state.map.tiles[n].terrain].water) continue;
        var a = VERTS[k], b = VERTS[(k + 1) % 6], cx = p.x, cy = p.y;
        foam.moveTo(cx + a[0] * 0.9, cy + a[1] * 0.9); foam.lineTo(cx + b[0] * 0.9, cy + b[1] * 0.9);
      }
    });
    water.rect(0, 0, this.WW, M); water.rect(0, this.WH - M + 20, this.WW, M); water.rect(0, 0, M, this.WH); water.rect(this.WW - M, 0, M, this.WH);
    this.waterPath = water; this.foamPath = foam; this.shallowPath = shallow;
  };

  P.buildStatic = function (state) {
    var self = this, c = A.cv(this.WW, this.WH), g = c.getContext('2d'), tiles = state.map.tiles, T = this.T, W = state.map.w;
    var og = g.createLinearGradient(0, 0, 0, this.WH); og.addColorStop(0, '#173f5c'); og.addColorStop(1, '#0f3049');
    g.fillStyle = og; g.fillRect(0, 0, this.WW, this.WH);
    var r0 = A.rng(state.seed + 1);
    for (var i = 0; i < 900; i++) { g.fillStyle = 'rgba(120,180,210,' + (0.04 + r0() * 0.08).toFixed(2) + ')'; g.fillRect(r0() * this.WW | 0, r0() * this.WH | 0, 3 + r0() * 8 | 0, 1); }
    function landNb(t) { return t.n.map(function (n) { return n >= 0 && !T[tiles[n].terrain].water; }); }
    for (var r = 0; r < state.map.h; r++) for (var q = 0; q < W; q++) self.drawTile(g, state, tiles[r * W + q], landNb);
    tiles.forEach(function (t) { self.drawCliffShadow(g, state, t); });
    tiles.forEach(function (t) { self.drawShadows(g, t); });
    for (r = 0; r < state.map.h; r++) for (q = 0; q < W; q++) self.drawDecor(g, state, tiles[r * W + q]);
    return c;
  };

  P.tileColor = function (t) {
    var base = this.T[t.terrain].top;
    if (t.terrain === 'grassland') base = A.mix(base, '#8fae48', Math.max(0, 0.5 - t.m));
    if (t.terrain === 'plains') base = A.mix(base, '#c8b062', t.detail * 0.5);
    if (t.terrain === 'deep') base = A.mix('#1b4d6e', '#163f5c', t.detail);
    if (t.terrain === 'tundra') base = A.mix(base, '#c8d0cc', Math.max(0, 0.3 - t.t) * 1.5);
    return base;
  };

  P.drawTile = function (g, state, t, landNb) {
    var T = this.T, tiles = state.map.tiles, self = this, tt = T[t.terrain], c = this.center(t), h = this.elev(t), x = c.x, y = c.y - h;
    var rng = A.rng(t.id * 9973 + 17), k, a, b, n, i;
    if (tt.water) {
      var depth = this.waterDepth ? this.waterDepth[t.id] : 2, coastal = depth <= 1;
      var col = coastal ? '#3f97a6' : depth === 2 ? '#2f7d9a' : t.terrain === 'sea' ? '#2a7090' : this.tileColor(t);
      this.hexPath(g, x, y, 1.03); g.fillStyle = col; g.fill();
      if (coastal) {
        for (k = 0; k < 6; k++) { n = t.n[EDGE_NB[k]]; if (n < 0 || T[tiles[n].terrain].water) continue; a = VERTS[k]; b = VERTS[(k + 1) % 6];
          var gr = g.createLinearGradient(x + (a[0] + b[0]) / 2, y + (a[1] + b[1]) / 2, x, y); gr.addColorStop(0, 'rgba(170,210,175,0.6)'); gr.addColorStop(1, 'rgba(160,200,170,0)');
          g.fillStyle = gr; g.beginPath(); g.moveTo(x + a[0], y + a[1]); g.lineTo(x + b[0], y + b[1]); g.lineTo(x, y); g.closePath(); g.fill(); }
        for (i = 0; i < 3; i++) { g.fillStyle = 'rgba(210,200,160,0.35)'; g.fillRect(x - 14 + rng() * 28 | 0, y - 6 + rng() * 12 | 0, 2, 1); } // sand ripples through clear water
      }
      if (depth >= 3) { g.fillStyle = 'rgba(8,24,40,0.18)'; this.hexPath(g, x, y, 1.03); g.fill(); }
      for (i = 0; i < 6; i++) { g.fillStyle = 'rgba(200,235,255,0.12)'; g.fillRect(x - 18 + rng() * 36 | 0, y - 10 + rng() * 20 | 0, 3 + rng() * 6 | 0, 1); }
      return;
    }
    var side = tt.side;
    [0, 1].forEach(function (k) {
      var nb = t.n[EDGE_NB[k]], nh = nb >= 0 ? self.elev(tiles[nb]) : -1; if (T[(nb >= 0 ? tiles[nb] : t).terrain].water || nb < 0) nh = -1;
      if (nh >= h) return;
      var d = h - nh, a = VERTS[k], b = VERTS[k + 1];
      var faceCol = k === 1 ? A.shade(side, 0.06) : A.shade(side, -0.28);
      g.fillStyle = faceCol; g.beginPath(); g.moveTo(x + a[0], y + a[1]); g.lineTo(x + b[0], y + b[1]); g.lineTo(x + b[0], y + b[1] + d); g.lineTo(x + a[0], y + a[1] + d); g.closePath(); g.fill();
      // vertical gradient: darker at the foot of the cliff (ambient occlusion where it meets the ground)
      var vg = g.createLinearGradient(0, y + Math.min(a[1], b[1]), 0, y + Math.max(a[1], b[1]) + d); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,10,0.28)');
      g.fillStyle = vg; g.beginPath(); g.moveTo(x + a[0], y + a[1]); g.lineTo(x + b[0], y + b[1]); g.lineTo(x + b[0], y + b[1] + d); g.lineTo(x + a[0], y + a[1] + d); g.closePath(); g.fill();
      for (var s = 3; s < d; s += 4) { g.fillStyle = k === 1 ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.14)'; var t0 = 0.08 + rng() * 0.1, t1 = 0.92 - rng() * 0.1; g.beginPath(); g.moveTo(x + a[0] + (b[0] - a[0]) * t0, y + a[1] + (b[1] - a[1]) * t0 + s); g.lineTo(x + a[0] + (b[0] - a[0]) * t1, y + a[1] + (b[1] - a[1]) * t1 + s); g.lineTo(x + a[0] + (b[0] - a[0]) * t1, y + a[1] + (b[1] - a[1]) * t1 + s + 1); g.lineTo(x + a[0] + (b[0] - a[0]) * t0, y + a[1] + (b[1] - a[1]) * t0 + s + 1); g.fill(); }
      if (d > 8 && (t.terrain === 'hills' || t.terrain === 'mountains')) for (var sc = 0; sc < 3; sc++) { g.fillStyle = 'rgba(200,190,170,0.25)'; g.fillRect(x + a[0] + (b[0] - a[0]) * (0.2 + rng() * 0.6) | 0, y + Math.max(a[1], b[1]) + d - 2 - rng() * 3 | 0, 2, 1); } // scree
      g.fillStyle = A.shade(self.tileColor(t), k === 1 ? -0.25 : -0.45); g.beginPath(); g.moveTo(x + a[0], y + a[1]); g.lineTo(x + b[0], y + b[1]); g.lineTo(x + b[0], y + b[1] + 2); g.lineTo(x + a[0], y + a[1] + 2); g.closePath(); g.fill();
      if (nh < 0) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(Math.min(x + a[0], x + b[0]), Math.max(y + a[1], y + b[1]) + d - 1, Math.abs(b[0] - a[0]), 1); }
    });
    var col2 = this.tileColor(t);
    this.hexPath(g, x, y); g.fillStyle = col2; g.fill();
    g.save(); this.hexPath(g, x, y); g.clip();
    for (i = 0; i < 7; i++) { var bx = x - 20 + rng() * 40, by = y - 12 + rng() * 24, br = 6 + rng() * 10, lt = rng() < 0.5, bgr = g.createRadialGradient(bx, by, 0, bx, by, br);
      bgr.addColorStop(0, A.rgba(A.shade(col2, lt ? 0.14 : -0.14), 0.55)); bgr.addColorStop(1, A.rgba(A.shade(col2, lt ? 0.14 : -0.14), 0)); g.fillStyle = bgr; g.fillRect(bx - br, by - br, br * 2, br * 2); }
    var light = A.shade(col2, 0.09), dark = A.shade(col2, -0.1);
    for (i = 0; i < 46; i++) { var px = x - 26 + rng() * 52, py = y - 18 + rng() * 36, rr = rng(); g.fillStyle = rr < 0.5 ? light : dark; g.fillRect(px | 0, py | 0, rr < 0.25 ? 2 : 1, 1); }
    var lg = g.createLinearGradient(x - 22, y - 16, x + 22, y + 16); lg.addColorStop(0, 'rgba(255,236,190,0.22)'); lg.addColorStop(0.5, 'rgba(255,236,190,0)'); lg.addColorStop(1, 'rgba(10,15,40,0.22)');
    g.fillStyle = lg; g.fillRect(x - 30, y - 20, 60, 40);
    for (k = 0; k < 6; k++) {
      n = t.n[EDGE_NB[k]]; if (n >= 0 && !T[tiles[n].terrain].water) continue;
      a = VERTS[k]; b = VERTS[(k + 1) % 6];
      g.fillStyle = t.terrain === 'tundra' ? 'rgba(200,205,200,0.85)' : t.terrain === 'forest' ? 'rgba(150,140,100,0.7)' : 'rgba(222,204,150,0.9)';
      g.beginPath(); g.moveTo(x + a[0], y + a[1]); g.lineTo(x + b[0], y + b[1]); g.lineTo(x + b[0] * 0.8, y + b[1] * 0.8); g.lineTo(x + a[0] * 0.8, y + a[1] * 0.8); g.closePath(); g.fill();
      for (i = 0; i < 3; i++) { var tt2 = rng(); g.fillStyle = 'rgba(120,110,90,0.5)'; g.fillRect(x + (a[0] + (b[0] - a[0]) * tt2) * 0.88 | 0, y + (a[1] + (b[1] - a[1]) * tt2) * 0.88 | 0, 1, 1); } // pebbles
    }
    for (k = 0; k < 6; k++) {
      n = t.n[EDGE_NB[k]]; if (n < 0) continue;
      var nh2 = T[tiles[n].terrain].water ? -1 : this.elev(tiles[n]);
      a = VERTS[k]; b = VERTS[(k + 1) % 6];
      if (nh2 > h + 2) { var ag = g.createLinearGradient(x + (a[0] + b[0]) / 2, y + (a[1] + b[1]) / 2, x + (a[0] + b[0]) / 6, y + (a[1] + b[1]) / 6); ag.addColorStop(0, 'rgba(0,0,10,0.45)'); ag.addColorStop(1, 'rgba(0,0,10,0)'); g.fillStyle = ag; g.beginPath(); g.moveTo(x + a[0], y + a[1]); g.lineTo(x + b[0], y + b[1]); g.lineTo(x, y); g.closePath(); g.fill(); }
      else if (nh2 < h - 2 && (k === 2 || k === 3 || k === 4)) { g.strokeStyle = 'rgba(255,240,200,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + a[0] * 0.97, y + a[1] * 0.97); g.lineTo(x + b[0] * 0.97, y + b[1] * 0.97); g.stroke(); }
      // ridge continuity: a light crest along edges shared with an equally high hill/mountain neighbour
      if ((t.terrain === 'hills' || t.terrain === 'mountains') && tiles[n].terrain === t.terrain && (k === 3 || k === 4)) { g.strokeStyle = 'rgba(255,245,220,0.12)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (a[0] + b[0]) / 2, y + (a[1] + b[1]) / 2); g.stroke(); }
    }
    g.restore();
    g.strokeStyle = 'rgba(20,20,10,0.16)'; g.lineWidth = 1; this.hexPath(g, x, y); g.stroke();
  };
  /* cast shadow of a tall tile onto the lower land south-east of it (sun from the upper left) — P036 */
  P.drawCliffShadow = function (g, state, t) {
    if (this.T[t.terrain].water) return;
    var h = this.elev(t), tiles = state.map.tiles, self = this;
    [0, 5].forEach(function (k) {
      var n = t.n[EDGE_NB[k]]; if (n < 0) return; var o = tiles[n]; if (self.T[o.terrain].water) return;
      var d = h - self.elev(o); if (d < 6) return;
      var p = self.top(o); g.save(); self.hexPath(g, p.x, p.y); g.clip();
      var a = VERTS[(k + 3) % 6], b = VERTS[(k + 4) % 6], len = Math.min(18, d * 0.9);
      var sg = g.createLinearGradient(p.x + (a[0] + b[0]) / 2, p.y + (a[1] + b[1]) / 2, p.x + (a[0] + b[0]) / 2 * (1 - len / 26), p.y + (a[1] + b[1]) / 2 * (1 - len / 26));
      sg.addColorStop(0, 'rgba(10,15,35,0.32)'); sg.addColorStop(1, 'rgba(10,15,35,0)');
      g.fillStyle = sg; g.fillRect(p.x - 30, p.y - 20, 60, 40); g.restore();
    });
  };

  P.drawShadows = function (g, t) {
    if (t.settlement >= 0) return;
    var p = this.top(t);
    if (t.terrain === 'mountains') { g.fillStyle = 'rgba(10,15,35,0.28)'; g.beginPath(); g.moveTo(p.x - 14, p.y + 6); g.lineTo(p.x + 40, p.y + 22); g.lineTo(p.x + 22, p.y + 4); g.closePath(); g.fill(); }
    else if (t.terrain === 'forest') { g.fillStyle = 'rgba(10,20,10,0.20)'; g.beginPath(); g.ellipse(p.x + 6, p.y + 4, 22, 9, 0, 0, Math.PI * 2); g.fill(); }
    else if (t.terrain === 'hills') { g.fillStyle = 'rgba(10,15,30,0.14)'; g.beginPath(); g.ellipse(p.x + 8, p.y + 6, 18, 6, 0, 0, Math.PI * 2); g.fill(); }
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
  function shrub(g, x, y, c) { A.disc(g, x, y, 2, A.shade(c, -0.25)); A.disc(g, x - 1, y - 1, 1.3, c); }

  /* Seeded micro-decoration per biome (P035): only on matching passable land, never on water or settlements' centre. */
  P.drawDecor = function (g, state, t) {
    var p = this.top(t), x = p.x, y = p.y, rng = A.rng(t.id * 7919 + 3), i, n;
    function inHex() { for (var tries = 0; tries < 20; tries++) { var dx = (rng() * 2 - 1) * 20, dy = (rng() * 2 - 1) * 12; if (Math.abs(dx) / 22 + Math.abs(dy) / 13 < 1) return [x + dx, y + dy]; } return [x, y]; }
    if (t.settlement >= 0) {
      var fieldCols = t.terrain === 'desert' ? ['#c8b070', '#8aa04a', '#b89a5a'] : t.terrain === 'tundra' ? ['#9aa290', '#8a9078', '#b0b4a6'] : ['#a8a048', '#7f9a3a', '#c4ae5a', '#6f8c34'];
      for (i = 0; i < 7; i++) { var pt = inHex(); g.fillStyle = fieldCols[i % fieldCols.length]; g.save(); g.translate(pt[0], pt[1]); g.transform(1, 0, -0.6, 0.6, 0, 0); g.fillRect(-5, -4, 9, 7); g.fillStyle = 'rgba(0,0,0,0.12)'; for (var s = -4; s < 3; s += 2) g.fillRect(-5, s, 9, 1); g.restore(); }
      return;
    }
    var pts = [];
    switch (t.terrain) {
      case 'forest':
        for (i = 0; i < 10; i++) { var u = inHex(); g.fillStyle = rng() < 0.5 ? 'rgba(30,50,20,0.5)' : 'rgba(80,110,40,0.4)'; g.fillRect(u[0] | 0, u[1] | 0, 2, 1); } // undergrowth
        n = 7 + (rng() * 4 | 0); for (i = 0; i < n; i++) pts.push(inHex());
        pts.sort(function (a, b) { return a[1] - b[1]; });
        var cold = t.t < 0.4;
        pts.forEach(function (q) { if (cold || rng() < 0.45) conifer(g, q[0], q[1], 5 + (rng() * 3 | 0), '#1f3d24', '#2f5a30', cold && rng() < 0.4); else broadleaf(g, q[0], q[1], 4 + rng() * 2, rng() < 0.3 ? '#6f8a2a' : '#4f7a2f'); });
        break;
      case 'tundra':
        for (i = 0; i < 4; i++) { var sp = inHex(); g.fillStyle = 'rgba(235,240,245,0.85)'; g.beginPath(); g.ellipse(sp[0], sp[1], 4 + rng() * 5, 2 + rng() * 1.5, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(150,170,200,0.5)'; g.fillRect(sp[0] - 3 | 0, sp[1] + 1 | 0, 6, 1); }
        for (i = 0; i < 3; i++) { sp = inHex(); g.strokeStyle = 'rgba(200,215,230,0.55)'; g.beginPath(); g.moveTo(sp[0] - 4, sp[1]); g.lineTo(sp[0], sp[1] - 1); g.lineTo(sp[0] + 3, sp[1] + 1); g.stroke(); } // frost cracks
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
        for (i = 0; i < 5; i++) { var sc = inHex(); g.fillStyle = 'rgba(160,150,130,0.6)'; g.fillRect(sc[0] | 0, sc[1] | 0, 1 + (rng() * 2 | 0), 1); } // scree
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
          for (var s2 = 0; s2 < 14; s2++) { var tt = rng(), yy = top + tt * ph, half = bw * tt; g.fillStyle = rng() < 0.5 ? 'rgba(255,240,220,0.12)' : 'rgba(0,0,0,0.15)'; g.fillRect(px - half + rng() * half * 1.6 | 0, yy | 0, 2, 1); }
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
        if (rng() < 0.6) { var sb = inHex(); shrub(g, sb[0], sb[1], '#8a8a4a'); }
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
        if (rng() < 0.4) { var cl = inHex(); for (i = 0; i < 4; i++) g.fillRect(cl[0] + i * 2 | 0, cl[1] - (i % 2) | 0, 1, 2); }
        if (rng() < 0.55) { n = 1 + (rng() * 2 | 0); for (i = 0; i < n; i++) pts.push(inHex()); pts.sort(function (a, b) { return a[1] - b[1]; }); pts.forEach(function (q) { broadleaf(g, q[0], q[1], 4 + rng() * 1.5, '#4f8a2f'); }); }
        break;
    }
  };

  /* ---------------------------------------------------------- per-state caches: territory with heraldic patterns (P046) */
  P.territory = function (state) {
    var self = this, own = new Array(state.map.tiles.length).fill(-1), best = new Array(state.map.tiles.length).fill(-1), E = this.E;
    state.settlements.forEach(function (s) {
      if (!s.shrine) return;
      var st = state.map.tiles[s.tile], def = self.shrineDefs[s.shrine.type], rad = E ? E.helpers.shrineRadius(state, s) : def.radius;
      state.map.tiles.forEach(function (t) {
        var d = Math.max(Math.abs(t.cx - st.cx), Math.abs(t.cy - st.cy), Math.abs(t.cz - st.cz));
        if (d > rad || t.terrain === 'deep') return;
        var w = 10 - d * 3 + (s.shrine.eclipsed ? -1 : 0) + s.followers[s.shrine.owner] * 0.01;
        if (w > best[t.id]) { best[t.id] = w; own[t.id] = s.shrine.owner; }
      });
    });
    return own;
  };
  P.factionPattern = function (fid) {
    var key = 'pat:' + fid + (this.contrast ? ':hc' : ''); if (this.spriteCache[key]) return this.spriteCache[key];
    var f = this.fac[fid], c = A.pattern(f.pattern, this.contrast ? '#ffffff' : A.shade(f.palette.secondary, 0.35), 1);
    this.spriteCache[key] = c; return c;
  };
  P.buildOverlay = function (state) {
    var self = this, c = this.overlay || A.cv(this.WW, this.WH), g = c.getContext('2d'), own = this.territory(state), tiles = state.map.tiles, hc = this.contrast;
    g.clearRect(0, 0, c.width, c.height);
    this.terr = own;
    tiles.forEach(function (t) {
      var o = own[t.id]; if (o < 0) return;
      var f = self.fac[state.players[o].faction], pal = f.palette, p = self.top(t);
      self.hexPath(g, p.x, p.y, 0.98); g.fillStyle = A.rgba(pal.secondary, hc ? 0.22 : 0.14); g.fill();
      if (self.patterns) { g.save(); self.hexPath(g, p.x, p.y, 0.9); g.clip(); g.globalAlpha = hc ? 0.5 : 0.28; g.fillStyle = g.createPattern(self.factionPattern(f.id), 'repeat'); g.fillRect(p.x - 30, p.y - 20, 60, 40); g.restore(); }
    });
    tiles.forEach(function (t) {
      var o = own[t.id]; if (o < 0) return;
      var f = self.fac[state.players[o].faction], pal = f.palette, p = self.top(t);
      for (var k = 0; k < 6; k++) {
        var n = t.n[EDGE_NB[k]]; if (n >= 0 && own[n] === o) continue;
        var a = VERTS[k], b = VERTS[(k + 1) % 6], s = 0.9;
        g.lineCap = 'round';
        g.strokeStyle = hc ? 'rgba(0,0,0,0.85)' : A.rgba(pal.secondary, 0.35); g.lineWidth = hc ? 6 : 5; g.beginPath(); g.moveTo(p.x + a[0] * s, p.y + a[1] * s); g.lineTo(p.x + b[0] * s, p.y + b[1] * s); g.stroke();
        g.setLineDash(DASH[f.pattern] || []); g.strokeStyle = hc ? '#ffffff' : pal.accent; g.lineWidth = hc ? 3 : 2; g.beginPath(); g.moveTo(p.x + a[0] * s, p.y + a[1] * s); g.lineTo(p.x + b[0] * s, p.y + b[1] * s); g.stroke(); g.setLineDash([]);
        if (!hc) { g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x + a[0] * s, p.y + a[1] * s - 1); g.lineTo(p.x + b[0] * s, p.y + b[1] * s - 1); g.stroke(); }
      }
    });
    this.overlay = c;
  };
  P.buildFog = function (state) {
    var self = this, rev = state.players[this.viewer].revealed;
    var c = A.cv(this.WW, this.WH), g = c.getContext('2d');
    g.fillStyle = '#000';
    state.map.tiles.forEach(function (t) { if (rev[t.id]) return; var p = self.top(t); self.hexPath(g, p.x, p.y - 4, 1.35); g.fill(); var cc = self.center(t); self.hexPath(g, cc.x, cc.y + 6, 1.3); g.fill(); });
    var b = A.cv(this.WW, this.WH), bg = b.getContext('2d');
    bg.filter = this.quality === 'low' ? 'blur(8px)' : 'blur(16px)'; bg.drawImage(c, 0, 0); bg.filter = 'none';
    bg.globalCompositeOperation = 'source-in';
    bg.fillStyle = bg.createPattern(this.fogTex, 'repeat'); bg.fillRect(0, 0, this.WW, this.WH);
    var rim = A.cv(this.WW, this.WH), rg = rim.getContext('2d');
    rg.filter = 'blur(3px)'; rg.drawImage(c, 0, 0); rg.filter = 'none'; rg.globalCompositeOperation = 'source-in'; rg.fillStyle = 'rgba(180,150,100,0.18)'; rg.fillRect(0, 0, this.WW, this.WH);
    bg.globalCompositeOperation = 'destination-over'; bg.drawImage(rim, 0, 0);
    bg.globalCompositeOperation = 'source-over';
    var E = 150, WW = this.WW, WH = this.WH, edge = [[0, 0, E, 0, 0, 0, E, WH], [WW, 0, WW - E, 0, WW - E, 0, E, WH], [0, 0, 0, E, 0, 0, WW, E], [0, WH, 0, WH - E, 0, WH - E, WW, E]];
    edge.forEach(function (e) { var gr = bg.createLinearGradient(e[0], e[1], e[2], e[3]); gr.addColorStop(0, 'rgba(27,48,68,1)'); gr.addColorStop(0.55, 'rgba(27,48,68,0.55)'); gr.addColorStop(1, 'rgba(27,48,68,0)'); bg.fillStyle = gr; bg.fillRect(e[4], e[5], e[6], e[7]); });
    return b;
  };

  /* ---------------------------------------------------------- marks layer (P017/P040): scars and blessings from authoritative state.marks */
  P.buildMarks = function (state) {
    var self = this, c = this.marksLayer || A.cv(this.WW, this.WH), g = c.getContext('2d'), rev = state.players[this.viewer].revealed;
    g.clearRect(0, 0, c.width, c.height);
    state.marks.forEach(function (m) {
      if (!rev[m.tile]) return;
      var t = state.map.tiles[m.tile], p = self.top(t), r = A.rng(m.id * 131 + 7), i, age = state.turn - m.t;
      var fade = m.until ? Math.max(0.35, 1 - age / Math.max(1, m.until - m.t)) : 1;
      g.globalAlpha = fade;
      switch (m.k) {
        case 'scorch': for (i = 0; i < 7; i++) { var dx = (r() - 0.5) * 34, dy = (r() - 0.5) * 16; g.fillStyle = 'rgba(30,20,12,0.45)'; g.beginPath(); g.ellipse(p.x + dx, p.y + dy, 3 + r() * 5, 1.5 + r() * 2, 0, 0, 7); g.fill(); } for (i = 0; i < 4; i++) A.px(g, p.x + (r() - 0.5) * 24, p.y + (r() - 0.5) * 10, '#ff7a3a'); break;
        case 'blessed': for (i = 0; i < 9; i++) { var bx = p.x + (r() - 0.5) * 38, by = p.y + (r() - 0.5) * 18; A.px(g, bx, by, ['#f0e070', '#f8f0f8', '#9fe07a'][i % 3]); A.px(g, bx, by + 1, '#4f8a2f'); } break;
        case 'eclipse': g.strokeStyle = 'rgba(20,10,30,0.55)'; g.lineWidth = 2; g.beginPath(); g.ellipse(p.x + 8, p.y + 2, 18, 7, 0, 0, 7); g.stroke(); break;
        case 'storm': for (i = 0; i < 4; i++) { var sx = p.x + (r() - 0.5) * 34, sy = p.y + (r() - 0.5) * 14; A.line(g, sx, sy, sx + 6, sy + 1, '#4a3420'); A.disc(g, sx + 6, sy, 1.5, '#3a5a2a'); } break;
        case 'drought': g.strokeStyle = 'rgba(90,60,30,0.55)'; g.lineWidth = 1; for (i = 0; i < 5; i++) { var cx = p.x + (r() - 0.5) * 30, cy = p.y + (r() - 0.5) * 12; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 4, cy + 1); g.lineTo(cx + 6, cy - 1); g.stroke(); } break;
        case 'ruin': var ft = (m.x && m.x.type) ? self.shrineDefs[m.x.type] : null; if (ft && !state.settlements[t.settlement].shrine) { g.drawImage(self.shrineImage(ft.art, self.fac[ft.faction].palette, 'ruined', null), Math.round(p.x - 6), Math.round(p.y - 44)); } break;
        case 'rebuilt': A.rect(g, p.x + 22, p.y - 20, 1, 10, '#6a4a2a'); A.rect(g, p.x + 23, p.y - 20, 4, 3, '#9fe07a'); break;
        case 'covenant': A.rect(g, p.x - 26, p.y - 8, 4, 8, '#b8b0a0'); A.rect(g, p.x - 26, p.y - 9, 4, 1, '#d8d0c0'); A.px(g, p.x - 25, p.y - 6, '#b8302a', 2, 2); break;
      }
      g.globalAlpha = 1;
    });
    this.marksLayer = c;
  };

  /* ---------------------------------------------------------- sprites: villages (P031/P032), shrines (P041), priests (P042) */
  P.villageStyle = function (state, s, t) {
    var biome = t.terrain === 'desert' ? 'mud' : (t.terrain === 'tundra' || t.t < 0.3) ? 'timber' : 'tile';
    // layered patronage: the newest patron's style spreads one house every 2 turns since control changed; older patrons remain in the rest
    var layers = [], pats = s.patrons || [];
    for (var i = pats.length - 1; i >= 0; i--) layers.push({ f: pats[i].f, since: pats[i].t });
    return { biome: biome, layers: layers, key: biome + ':' + layers.map(function (l) { return l.f + '@' + Math.min(9, Math.floor((state.turn - l.since) / 2)); }).join('>') };
  };
  P.village = function (state, s) {
    var t = state.map.tiles[s.tile], tier = Math.max(1, Math.min(5, Math.floor(s.pop / 2.6))), decline = (s.peak || s.pop) - s.pop >= 3 ? 1 : 0;
    var st = this.villageStyle(state, s, t), key = s.id + ':' + tier + ':' + decline + ':' + st.key;
    if (this.villageCache[key]) return this.villageCache[key];
    if (Object.keys(this.villageCache).length > 400) this.villageCache = {}; // bounded cache
    var c = A.cv(64, 48), g = c.getContext('2d'), r = A.rng(s.id * 131 + tier);
    var n = 2 + tier + (tier > 2 ? 1 : 0), houses = [], chim = [];
    for (var i = 0; i < n; i++) { var a = r() * Math.PI * 2, d = Math.sqrt(r()) * (8 + tier * 2); houses.push({ x: 32 + Math.cos(a) * d * 1.5, y: 34 + Math.sin(a) * d * 0.6, w: 5 + (r() * 3 | 0), h: 3 + (r() * 3 | 0), big: i === 0 && tier >= 3, d: d }); }
    houses.sort(function (a, b) { return a.d - b.d; });
    // assign styles: centre houses take the newest patron, spreading outward with time
    houses.forEach(function (h, i) {
      var style = st.biome;
      if (st.layers.length) { var newest = st.layers[0], spread = 1 + Math.floor((state.turn - newest.since) / 2); style = i < spread ? newest.f : (st.layers[1] ? st.layers[1].f : st.biome); }
      h.style = style;
    });
    houses.sort(function (a, b) { return a.y - b.y; });
    if (tier >= 2) { g.fillStyle = 'rgba(200,190,150,0.35)'; g.beginPath(); g.ellipse(32, 35, 10 + tier * 2, 4 + tier, 0, 0, 7); g.fill(); } // plaza
    if (tier >= 4) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(32, 35, 26, 10, 0, 0, 7); g.fill(); g.strokeStyle = st.biome === 'mud' ? '#b89a68' : '#6a5038'; g.lineWidth = 2; g.beginPath(); g.ellipse(32, 34, 25, 9.5, 0, Math.PI * 0.05, Math.PI * 0.95); g.stroke(); A.rect(g, 30, 42, 4, 3, '#3a2a1a'); } // palisade with gate
    if (tier >= 3) for (i = 0; i < 2; i++) { A.rect(g, 20 + i * 20, 37, 5, 2, ['#b8302a', '#2f6fb3'][i]); A.rect(g, 20 + i * 20, 39, 1, 2, '#3a2a1a'); A.rect(g, 24 + i * 20, 39, 1, 2, '#3a2a1a'); } // market stalls
    houses.forEach(function (h, idx) {
      var S = ARCH[h.style] || ARCH.tile, x = Math.round(h.x), y = Math.round(h.y), w = h.big ? 9 : h.w, hh = h.big ? 6 : h.h, dep = 3, ruined = decline && idx % 3 === 2;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - w / 2 + 2 | 0, y + 1, w + 3, 2);
      g.fillStyle = ruined ? A.shade(S.wall, -0.4) : S.wall; g.fillRect(x - w / 2 | 0, y - hh, w, hh + 1);
      g.fillStyle = S.side; g.beginPath(); g.moveTo(x + w / 2, y + 1); g.lineTo(x + w / 2 + dep, y - 1); g.lineTo(x + w / 2 + dep, y - hh - 1); g.lineTo(x + w / 2, y - hh); g.closePath(); g.fill();
      if (ruined) { A.rect(g, x - w / 2, y - hh - 1, w, 1, '#3a3020'); return; }
      if (!S.roof) { g.fillStyle = A.shade(S.wall, 0.15); g.fillRect(x - w / 2 | 0, y - hh - 1, w + dep, 1); if (S.extra === 'stair' && h.big) { A.rect(g, x - 2, y - hh - 4, 5, 3, S.wall); A.rect(g, x - 1, y - hh - 6, 3, 2, S.wall); } if (S.extra === 'paint') A.rect(g, x - w / 2, y - hh + 1, w, 1, '#12a38c'); if (S.extra === 'stone') { A.px(g, x - 1, y - 2, S.side); A.px(g, x + 1, y - hh + 1, S.side); } }
      else {
        var rh = S.form === 'steep' ? 5 : S.form === 'thatch' || S.form === 'round' ? 4 : 3;
        if (S.form === 'round') { g.fillStyle = S.roof; g.beginPath(); g.ellipse(x + 1, y - hh, w / 2 + 2, rh, 0, Math.PI, 0); g.fill(); }
        else { g.fillStyle = S.roof; g.beginPath(); g.moveTo(x - w / 2 - 1, y - hh); g.lineTo(x + 0.5, y - hh - rh); g.lineTo(x + w / 2 + 1, y - hh); g.closePath(); g.fill(); g.fillStyle = S.roofR; g.beginPath(); g.moveTo(x + 0.5, y - hh - rh); g.lineTo(x + dep + 0.5, y - hh - rh - 2); g.lineTo(x + w / 2 + dep + 1, y - hh - 2); g.lineTo(x + w / 2 + 1, y - hh); g.closePath(); g.fill(); }
        if (S.form === 'steep' && h.style === 'japanese') { A.line(g, x - w / 2 - 1, y - hh, x - w / 2 - 3, y - hh - 2, S.roof); }
        if (h.style === 'timber' || h.style === 'norse') { g.fillStyle = 'rgba(240,245,250,0.85)'; if (t.t < 0.35) g.fillRect(x - 1, y - hh - rh + 1, 3, 1); }
        if (S.extra === 'post') A.rect(g, x - w / 2, y - hh + 1, 1, hh, '#5a3a20');
      }
      g.fillStyle = '#ffd27a'; g.fillRect(x - 1, y - (hh >> 1), 1, 1); if (w > 6) g.fillRect(x + 2, y - (hh >> 1), 1, 1);
      g.fillStyle = '#3a2a1a'; g.fillRect(x - w / 2 + 1 | 0, y - 1, 1, 2);
      chim.push([x + 1, y - hh - 4]);
    });
    // culture markers that identify the current patron even from afar (shape, not only colour)
    var cur = st.layers[0] ? ARCH[st.layers[0].f] : null;
    if (cur && cur.extra === 'column') { A.rect(g, 52, 28, 2, 9, '#f2ecd8'); A.rect(g, 51, 27, 4, 1, '#e2dcc6'); }
    if (cur && cur.extra === 'palm') { A.line(g, 10, 36, 11, 28, '#7a5a32'); A.line(g, 11, 28, 7, 30, '#4f8a3a'); A.line(g, 11, 28, 15, 30, '#4f8a3a'); }
    if (cur && cur.extra === 'fence') for (i = 0; i < 5; i++) A.rect(g, 8 + i * 3, 38, 1, 3, '#6a5a3a');
    if (cur && cur.extra === 'torii') { A.rect(g, 48, 30, 8, 1, '#e5532d'); A.rect(g, 49, 31, 1, 7, '#e5532d'); A.rect(g, 54, 31, 1, 7, '#e5532d'); }
    if (cur && cur.extra === 'fire') { A.disc(g, 52, 38, 1.5, '#ffb070'); A.px(g, 52, 36, '#fff0a0'); }
    var out = { c: c, chim: chim.slice(0, 3), tier: tier };
    this.villageCache[key] = out; return out;
  };
  P.shrineImage = function (art, pal, cond, spec) {
    var key = 'sh:' + art + ':' + cond + ':' + (spec || '') + ':' + pal.secondary; if (this.spriteCache[key]) return this.spriteCache[key];
    var c = A.shrineArt(art, pal, cond, spec); this.spriteCache[key] = c; return c;
  };
  P.shrineCondition = function (state, s) {
    var sh = s.shrine, def = this.shrineDefs[sh.type];
    if (sh.eclipsed > 0) return 'eclipsed';
    if (sh.ward <= 1) return 'nearlyToppled';
    if (sh.ward < def.ward) return 'damaged';
    if (state.marks && state.marks.some(function (m) { return m.tile === s.tile && m.k === 'rebuilt' && state.turn - m.t <= 6; })) return 'restored';
    if (sh.ward >= 4) return 'fortified';
    return 'healthy';
  };
  P.priestImage = function (fid, role, frame) {
    var key = 'pr:' + fid + ':' + role + ':' + frame; if (this.spriteCache[key]) return this.spriteCache[key];
    var f = this.fac[fid], c = A.priestSprite(f.priestStyle, role, f.palette, frame); this.spriteCache[key] = c; return c;
  };
  P.landmarkImage = function (kind) { var key = 'lm:' + kind; if (!this.spriteCache[key]) this.spriteCache[key] = A.landmarkSprite(kind); return this.spriteCache[key]; };
  P.emblemImage = function (fid, size) { var key = 'em:' + fid + ':' + size; if (!this.spriteCache[key]) { var f = this.fac[fid]; this.spriteCache[key] = A.emblem(f.emblem, f.palette, size); } return this.spriteCache[key]; };

  /* ---------------------------------------------------------- state sync */
  P.setState = function (state, viewer) {
    var prev = this.state; this.state = state; this.viewer = viewer;
    var rev = state.players[viewer].revealed, rk = 0; for (var i = 0; i < rev.length; i++) rk += rev[i] * (i % 97 + 1);
    var fogKey = viewer + ':' + rk + ':' + this.quality;
    if (fogKey !== this.fogKey) {
      // fog theatre (P047): every newly revealed hex plays its own small parting, once
      if (this.prevRevealed && this.prevViewer === viewer && !this.reduced && this.quality !== 'low') {
        for (i = 0; i < rev.length; i++) if (rev[i] && !this.prevRevealed[i] && this.revealAnims.length < 140) this.revealAnims.push({ tile: i, t: -this.rand() * 0.35, life: 1.1 });
      }
      if (this.fog && !this.reduced && this.prevViewer === viewer) { this.oldFog = this.fog; this.fogFade = 1; } else { this.oldFog = null; }
      this.fog = this.buildFog(state); this.fogKey = fogKey;
    }
    this.prevRevealed = rev.slice(); this.prevViewer = viewer;
    var ok = viewer + ':' + this.patterns + ':' + this.contrast + ':' + state.settlements.map(function (s) { return s.shrine ? s.shrine.owner + ':' + s.shrine.eclipsed + ':' + (s.shrine.spec || '') : '-'; }).join(',');
    if (ok !== this.overlayKey) { this.buildOverlay(state); this.overlayKey = ok; }
    var mk = viewer + ':' + rk + ':' + state.turn + ':' + state.marks.map(function (m) { return m.id; }).join(',') + ':' + state.settlements.map(function (s) { return s.shrine ? 1 : 0; }).join('');
    if (mk !== this.marksKey) { this.buildMarks(state); this.marksKey = mk; }
    var self = this, now = this.time;
    if (prev && prev.priests) state.priests.forEach(function (pr) { var old = prev.priests.find(function (o) { return o.id === pr.id; }); if (old && old.tile !== pr.tile) self.priestAnim[pr.id] = { from: old.tile, to: pr.tile, t0: now, dur: self.reduced ? 0.01 : 0.9 }; });
  };

  /* ---------------------------------------------------------- camera & projection (unchanged geometry: picking stays exact) */
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
    var st = this.state; if (!st || this.blackout) return -1;
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

  /* ---------------------------------------------------------- FX: primitives + three-beat choreography (P043/P044) */
  P.particles = function (n) { return (this.reduced || this.quality === 'low') ? Math.max(1, Math.round(n * 0.25)) : n; };
  P.addFx = function (kind, tileId, opts) {
    if (!this.state) return; opts = opts || {};
    var t = this.state.map.tiles[tileId], p = t ? this.top(t) : { x: this.cam.x, y: this.cam.y }, col = opts.color || '#ffe08a', n, i, R = this.rand.bind(this), self = this;
    if (this.fx.length > 900) this.fx.splice(0, this.fx.length - 700); // never an unbounded queue
    function push(e) { e.t = e.t || 0; e.delay = e.delay || 0; self.fx.push(e); }
    var d = opts.delay || 0;
    switch (kind) {
      case 'reveal': n = this.particles(26); for (i = 0; i < n; i++) push({ k: 'mote', x: p.x + (R() - 0.5) * 70, y: p.y + (R() - 0.5) * 36, vx: (R() - 0.5) * 8, vy: -8 - R() * 14, life: 1.4 + R(), c: col, delay: d }); push({ k: 'ring', x: p.x, y: p.y, r0: 6, r1: 60 + (opts.radius || 2) * 20, life: 1.1, c: col, delay: d }); break;
      case 'shrine': push({ k: 'beam', x: p.x + 8, y: p.y - 6, life: 1.6, c: col, delay: d }); push({ k: 'ring', x: p.x, y: p.y, r0: 4, r1: 70, life: 1.0, c: col, delay: d }); this.shakeIt(2); break;
      case 'control': push({ k: 'ring', x: p.x, y: p.y, r0: 10, r1: 46, life: 0.9, c: col, delay: d }); break;
      case 'priest': push({ k: 'ring', x: p.x, y: p.y, r0: 2, r1: 22, life: 0.7, c: col, delay: d }); break;
      case 'ring': push({ k: 'ring', x: p.x, y: p.y, r0: opts.r0 || 6, r1: opts.r1 || 50, life: opts.life || 1.0, c: col, delay: d }); break;
      case 'bolt': case 'hammer':
        var segs = [], yy = p.y - 260, xx = p.x + (R() - 0.5) * 60; while (yy < p.y - 6) { segs.push([xx, yy]); yy += 14 + R() * 16; xx += (R() - 0.5) * 22; } segs.push([p.x, p.y - 4]);
        push({ k: 'bolt', segs: segs, x: p.x, y: p.y, life: 0.7, c: kind === 'hammer' ? '#bfe4ff' : '#fff2a8', delay: d });
        push({ k: 'ring', x: p.x, y: p.y, r0: 4, r1: 80, life: 0.8, c: '#fff6c8', delay: d });
        n = this.particles(24); for (i = 0; i < n; i++) push({ k: 'spark', x: p.x, y: p.y - 4, vx: (R() - 0.5) * 120, vy: -40 - R() * 80, life: 0.8 + R() * 0.4, c: '#ffe9a0', delay: d });
        break;
      case 'eclipse': case 'topple':
        push({ k: 'eclipse', x: p.x + 8, y: p.y - 30, life: 2.2, delay: d });
        if (kind === 'topple') { n = this.particles(30); for (i = 0; i < n; i++) push({ k: 'dust', x: p.x + 8 + (R() - 0.5) * 30, y: p.y - 4, vx: (R() - 0.5) * 40, vy: -10 - R() * 20, life: 1.6, c: '#8a8070', delay: d }); this.shakeIt(5); }
        this.flashIt('rgba(10,5,20,', 0.25); break;
      case 'feather': push({ k: 'feather', x: p.x, y: p.y - 70, tx: p.y - 8, life: 2.0, delay: d }); push({ k: 'ring', x: p.x, y: p.y, r0: 6, r1: 50, life: 1.6, c: '#7fe0d8', delay: d }); break;
      case 'band': push({ k: 'band', y: p.y, x: p.x, life: 2.2, rows: opts.rows || 3, hw: opts.hw, delay: d }); this.flashIt('rgba(255,220,140,', 0.18); break;
      case 'growth': n = this.particles(14); for (i = 0; i < n; i++) push({ k: 'mote', x: p.x + (R() - 0.5) * 40, y: p.y, vx: 0, vy: -20 - R() * 10, life: 1.2, c: '#9fe07a', delay: d }); break;
      case 'victory': this.flashIt('rgba(255,240,200,', 0.4); break;
      case 'text': this.addText(tileId, opts.text, col); break;
    }
  };
  /* Play a power/rite signature at a tile. Returns the total duration (s) so the caller can pace AI turns without blocking input. */
  P.playVfx = function (id, tileId, opts) {
    var V = VFX[id]; if (!V || !this.state) return 0; opts = opts || {};
    var t = this.state.map.tiles[tileId], p = t ? this.top(t) : { x: this.cam.x, y: this.cam.y }, col = opts.color || V.col, self = this, R = this.rand.bind(this), i, n;
    if (this.reduced) { // static, non-flashing equivalent: icon pulse + ring + label
      this.fx.push({ k: 'ring', x: p.x, y: p.y, r0: 20, r1: 34, life: 0.6, c: col, t: 0, delay: 0 });
      if (opts.label) this.addText(tileId, opts.label, col);
      return 0.6;
    }
    var A1 = 0.35, M1 = A1, C1 = A1 + 0.8;
    function push(e, delay) { e.t = 0; e.delay = delay; e.c = e.c || col; self.fx.push(e); }
    // beat 1: anticipation
    if (V.tint) this.tintIt(V.tint, 0.16, 1.5);
    switch (V.a) {
      case 'darken': push({ k: 'shadow', x: p.x, y: p.y, life: 1.2 }, 0); break;
      case 'cloud': case 'mist': push({ k: 'cloud', x: p.x, y: p.y - 70, life: 1.6, dark: V.a === 'cloud' }, 0); break;
      case 'glow': push({ k: 'glow', x: p.x, y: p.y - 10, life: 0.9, c: col }, 0); break;
      case 'rise': case 'water': case 'dust': case 'sparks': case 'motes': case 'leaves':
        n = this.particles(16); for (i = 0; i < n; i++) push({ k: V.a === 'sparks' ? 'spark' : 'mote', x: p.x + (R() - 0.5) * 60, y: p.y + (R() - 0.5) * 20, vx: (p.x - (p.x + (R() - 0.5) * 60)) * 0.5, vy: V.a === 'dust' ? -6 : -12 - R() * 8, life: 0.8, c: V.a === 'water' ? '#9fd8f0' : V.a === 'dust' ? '#b8b0a0' : V.a === 'leaves' ? '#86b552' : col }, 0); break;
      default: break;
    }
    // beat 2: manifestation
    var m = { k: V.m, x: p.x, y: p.y, life: 1.1, c: col, seed: R() * 1000 };
    switch (V.m) {
      case 'bolt': case 'hammer': this.addFx(V.m === 'bolt' ? 'bolt' : 'hammer', tileId, { delay: M1 }); break;
      case 'feather': this.addFx('feather', tileId, { delay: M1 }); break;
      case 'band': case 'sunArc': this.addFx('band', tileId, { delay: M1, rows: opts.rows || 3, hw: opts.hw }); if (V.m === 'sunArc') push({ k: 'sunArc', x: p.x, y: p.y, life: 1.6 }, M1); break;
      case 'eclipseDisc': this.addFx('eclipse', tileId, { delay: M1 }); break;
      default: push(m, M1);
    }
    if ((V.flash && !this.reducedFlash) || V.shake) push({ k: 'cue', life: 0.05, flash: this.reducedFlash ? 0 : (V.flash || 0), flashC: 'rgba(' + A.hex2rgb(V.tint).join(',') + ',', shake: V.shake || 0 }, M1);
    // beat 3: consequence
    switch (V.c) {
      case 'ring': push({ k: 'ring', x: p.x, y: p.y, r0: 6, r1: 56, life: 1.0 }, C1); break;
      case 'growth': if (V.wide && opts.tiles) opts.tiles.forEach(function (tt, j) { self.addFx('growth', tt, { delay: C1 + j * 0.05 }); }); else this.addFx('growth', tileId, { delay: C1 }); break;
      case 'scorch': n = this.particles(10); for (i = 0; i < n; i++) push({ k: 'dust', x: p.x + (R() - 0.5) * 24, y: p.y, vx: (R() - 0.5) * 20, vy: -8 - R() * 10, life: 1.4, c: '#4a3a2a' }, C1); break;
      case 'wardPips': push({ k: 'pips', x: p.x + 10, y: p.y - 52, life: 1.2 }, C1); break;
      case 'eclipseRing': push({ k: 'ring', x: p.x, y: p.y, r0: 30, r1: 8, life: 1.0, c: '#2a1a3a' }, C1); break;
      case 'beam': push({ k: 'beam', x: p.x + 8, y: p.y - 6, life: 1.3 }, C1); break;
      case 'riverGlint': n = this.particles(12); for (i = 0; i < n; i++) push({ k: 'mote', x: p.x + (R() - 0.5) * 140, y: p.y + (R() - 0.5) * 60, vx: 0, vy: -4, life: 1.2, c: '#d8f4ff' }, C1); break;
      case 'roads': push({ k: 'ring', x: p.x, y: p.y, r0: 10, r1: 90, life: 1.2, c: '#ffd060' }, C1); break;
      default: break;
    }
    if (opts.label) this.addText(tileId, opts.label, col);
    return C1 + 1.0;
  };
  P.addText = function (tileId, text, color) { if (!this.state || tileId === undefined || tileId === null || !this.state.map.tiles[tileId]) return; var p = this.top(this.state.map.tiles[tileId]); if (this.texts.length > 40) this.texts.shift(); this.texts.push({ x: p.x, y: p.y - 26, text: text, c: color || '#fff', t: 0, life: 1.8 }); };
  P.shakeIt = function (a) { if (!this.reduced) this.shake = Math.max(this.shake, a); };
  P.flashIt = function (rgbaPrefix, a) { if (!this.reduced && !this.reducedFlash) this.flash = { c: rgbaPrefix, a: a, t: 0 }; };
  P.tintIt = function (hex, a, life) { if (!this.reduced) this.tint = { c: hex, a: a, t: 0, life: life }; };

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
    if (this.blackout) { var ctx = this.ctx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); this.lastFrameMs = 0; return; }
    this.view = this.viewRect();
    this.composeWorld(dt);
    this.drawScreen(dt);
    var ms = (root.performance || Date).now() - t0;
    // Auto quality with hysteresis: drop to Low after a sustained 90-frame average above 24 ms; climb back only after 10 s under 12 ms.
    if (this.autoQuality) {
      this.frameTimes.push(ms);
      if (this.frameTimes.length > 90) {
        var avg = this.frameTimes.reduce(function (a, b) { return a + b; }, 0) / this.frameTimes.length; this.frameTimes = [];
        if (avg > 24 && this.quality === 'high') { this.setQuality('low'); this.lowSince = this.time; }
        else if (avg < 12 && this.quality === 'low' && this.time - this.lowSince > 10) this.setQuality('high');
      }
    }
    this.lastFrameMs = ms;
  };
  P.setQuality = function (q) { this.quality = q; this.fogKey = null; if (this.state) this.setState(this.state, this.viewer); };
  P.setReduced = function (r) { this.reduced = r; };

  /* The world-space rectangle the perspective strips will sample this frame (same maths as drawScreen), padded for shake. */
  P.viewRect = function () {
    var W = this.canvas.width, H = this.canvas.height, z = this.cam.z * this.dpr, k = this.k(), step = this.quality === 'low' ? 6 : 3, cx = this.cam.x, cy = this.cam.y, horizonA = -H0 / k * 0.98;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (var y = 0; y < H; y += step) {
      var a0 = (y - H * 0.55) / z, a1 = (y + step - H * 0.55) / z; if (a0 <= horizonA) continue;
      var dy0 = a0 / (1 + k * a0 / H0), dy1 = a1 / (1 + k * a1 / H0), wm = 1 - k * ((dy0 + dy1) / 2) / H0, srcW = W * wm / z, srcX = cx - srcW / 2, srcY = cy + dy0, srcH = Math.max(0.5, dy1 - dy0);
      if (srcX < x0) x0 = srcX; if (srcX + srcW > x1) x1 = srcX + srcW; if (srcY < y0) y0 = srcY; if (srcY + srcH > y1) y1 = srcY + srcH;
    }
    if (x0 === Infinity) return null;
    var pad = 24; x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad)); x1 = Math.min(this.WW, Math.ceil(x1 + pad)); y1 = Math.min(this.WH, Math.ceil(y1 + pad));
    return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  };
  P.composeWorld = function (dt) {
    var g = this.fg, st = this.state, self = this, time = this.time, low = this.quality === 'low', v = this.view;
    // Only the part of the world under the camera is sampled by the projection: clip all world compositing to it, which keeps every
    // layer and effect intact while skipping raster work for the rest of the map.
    g.save(); if (v) { g.beginPath(); g.rect(v.x, v.y, v.w, v.h); g.clip(); }
    g.imageSmoothingEnabled = false;
    g.drawImage(this.staticLayer, 0, 0);
    g.save(); g.clip(this.waterPath);
    var drift = this.reduced ? 0 : time;
    g.globalAlpha = 0.55; g.fillStyle = g.createPattern(this.waterPat, 'repeat');
    g.translate((drift * 7) % 128, (Math.sin(drift * 0.6) * 3)); g.fillRect(-128, -64, this.WW + 256, this.WH + 128); g.setTransform(1, 0, 0, 1, 0, 0);
    if (!low) { g.globalAlpha = 0.45; g.fillStyle = g.createPattern(this.waterPat2, 'repeat'); g.translate(-(drift * 4) % 128, (drift * 2) % 64); g.fillRect(-128, -64, this.WW + 256, this.WH + 128); g.setTransform(1, 0, 0, 1, 0, 0); }
    g.globalAlpha = 1; g.restore();
    if (!low) { g.save(); g.clip(this.shallowPath); g.globalAlpha = 0.35; g.fillStyle = g.createPattern(this.waterPat2, 'repeat'); g.translate((drift * 2) % 128, 0); g.fillRect(-128, -64, this.WW + 256, this.WH + 128); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.restore(); }
    g.save(); g.strokeStyle = 'rgba(235,250,255,0.55)'; g.lineWidth = 1.5; g.setLineDash([4, 5]); g.lineDashOffset = -drift * 6; g.stroke(this.foamPath);
    if (!low) { g.strokeStyle = 'rgba(235,250,255,0.25)'; g.lineWidth = 3; g.setLineDash([2, 9]); g.lineDashOffset = drift * 4; g.stroke(this.foamPath); }
    g.restore();
    if (!low) { g.globalAlpha = 0.16; this.clouds.forEach(function (cl) { var x = ((cl.x + drift * cl.v) % (self.WW + 400)) - 200; g.drawImage(self.cloudShadow, x + 40, cl.y + 30, 240 * cl.s, 110 * cl.s); }); g.globalAlpha = 1; }
    g.drawImage(this.overlay, 0, 0);
    g.drawImage(this.marksLayer, 0, 0);
    this.drawRoutes(g, st, time);
    var pulse = 0.5 + 0.5 * Math.sin(time * 4);
    if (this.targets) this.targets.forEach(function (id) { var p = self.top(st.map.tiles[id]); self.hexPath(g, p.x, p.y, 0.92); g.fillStyle = 'rgba(255,220,120,' + (0.12 + pulse * 0.16).toFixed(3) + ')'; g.fill(); g.strokeStyle = 'rgba(255,230,150,' + (0.5 + pulse * 0.4).toFixed(3) + ')'; g.lineWidth = 1.5; g.stroke(); });
    if (this.path && this.path.length > 1) { g.save(); g.strokeStyle = 'rgba(255,240,200,0.9)'; g.lineWidth = 2; g.setLineDash([3, 3]); g.lineDashOffset = -time * 12; g.beginPath(); this.path.forEach(function (id, i) { var p = self.top(st.map.tiles[id]); if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); }); g.stroke(); g.restore(); }
    if (this.hover >= 0) { var hp = this.top(st.map.tiles[this.hover]); this.hexPath(g, hp.x, hp.y, 0.96); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.5; g.stroke(); }
    if (this.selected >= 0) { var sp = this.top(st.map.tiles[this.selected]); this.hexPath(g, sp.x, sp.y, 0.96 + pulse * 0.04); g.strokeStyle = 'rgba(255,215,110,0.95)'; g.lineWidth = 2; g.stroke(); }
    var rev = st.players[this.viewer].revealed, objs = [];
    st.landmarks.forEach(function (l) { if (rev[l.tile]) objs.push({ y: self.top(st.map.tiles[l.tile]).y, lm: l }); });
    st.settlements.forEach(function (s) { if (rev[s.tile]) objs.push({ y: self.top(st.map.tiles[s.tile]).y, s: s }); });
    st.priests.forEach(function (pr) { if (rev[pr.tile] || pr.owner === self.viewer) objs.push({ y: self.top(st.map.tiles[pr.tile]).y + 6, pr: pr }); });
    objs.sort(function (a, b) { return a.y - b.y; });
    g.globalCompositeOperation = 'lighter';
    objs.forEach(function (o) { if (o.s && o.s.shrine && !o.s.shrine.eclipsed) self.drawShrineGlow(g, st, o.s, time); });
    g.globalCompositeOperation = 'source-over';
    objs.forEach(function (o) { if (o.s) self.drawSettlement(g, st, o.s, time); else if (o.lm) self.drawLandmark(g, st, o.lm, time); else self.drawPriest(g, st, o.pr, time); });
    this.drawWeather(g, st, time, dt);
    if (this.influence) this.drawInfluence(g, st);
    g.drawImage(this.fog, 0, 0);
    if (this.oldFog && this.fogFade > 0) { g.globalAlpha = this.fogFade; g.drawImage(this.oldFog, 0, 0); g.globalAlpha = 1; this.fogFade -= dt / 1.3; if (this.fogFade <= 0) this.oldFog = null; }
    this.drawRevealTheatre(g, st, dt);
    this.drawFx(g, dt);
    g.restore();
  };

  P.drawRevealTheatre = function (g, st, dt) {
    if (!this.revealAnims.length) return;
    var self = this, keep = [];
    this.revealAnims.forEach(function (a) {
      a.t += dt; if (a.t < 0) { keep.push(a); return; } var k = a.t / a.life; if (k >= 1) return; keep.push(a);
      var p = self.top(st.map.tiles[a.tile]);
      g.globalAlpha = (1 - k) * 0.55; g.drawImage(self.cloudSprite, p.x - 30 - k * 26, p.y - 22 - k * 8, 60, 28); g.drawImage(self.cloudSprite, p.x - 30 + k * 26, p.y - 18 + k * 6, 60, 28); g.globalAlpha = 1;
      if (k < 0.5) { g.strokeStyle = 'rgba(255,220,150,' + (0.5 - k).toFixed(2) + ')'; self.hexPath(g, p.x, p.y, 0.95); g.stroke(); }
    });
    this.revealAnims = keep;
  };

  P.drawRoutes = function (g, st, time) {
    var self = this, rev = st.players[this.viewer].revealed;
    st.routes.forEach(function (r) {
      var owned = r.owner >= 0, show = owned || self.showRoutes; if (!show) return;
      var vis = r.path.every(function (t) { return rev[t]; }); if (!vis) return;
      var pal = owned ? self.fac[st.players[r.owner].faction].palette : null, pts = r.path.map(function (t) { return self.top(st.map.tiles[t]); });
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
      if (!owned) { g.setLineDash([2, 5]); g.strokeStyle = 'rgba(255,240,200,0.55)'; g.lineWidth = 1.5; }
      else if (r.status === 'disrupted') { g.setLineDash([6, 6]); g.strokeStyle = 'rgba(120,100,80,0.75)'; g.lineWidth = 3; }
      else { g.strokeStyle = 'rgba(200,180,130,0.85)'; g.lineWidth = 4; }
      g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p.x, p.y + 4); else g.moveTo(p.x, p.y + 4); }); g.stroke();
      if (owned && r.status === 'active') { g.strokeStyle = A.rgba(pal.accent, 0.6); g.lineWidth = 1; g.setLineDash([1, 4]); g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p.x, p.y + 3); else g.moveTo(p.x, p.y + 3); }); g.stroke(); }
      g.restore();
      if (!owned) return;
      [pts[0], pts[pts.length - 1]].forEach(function (p) { A.rect(g, p.x - 14, p.y - 2, 1, 8, '#3a2a1a'); A.rect(g, p.x - 15, p.y - 4, 3, 2, r.status === 'active' ? '#ffd27a' : '#555'); });
      if (r.status !== 'active') return;
      // tiny travellers walk the road; pace is constant, count follows the route state
      var n = 2, L = pts.length - 1;
      for (var i = 0; i < n; i++) {
        var u = self.reduced ? (i + 0.5) / n : ((time * 0.12 + i / n + r.id * 0.17) % 1), seg = Math.min(L - 1, Math.floor(u * L)), f = u * L - seg;
        var a = pts[seg], b = pts[seg + 1] || a, x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f + 2;
        A.rect(g, x - 1, y - 5, 2, 4, pal.secondary); A.rect(g, x - 1, y - 7, 2, 2, '#e0c098'); A.rect(g, x + 1, y - 4, 2, 2, '#8a6a3a');
      }
    });
  };
  P.drawLandmark = function (g, st, l, time) {
    var p = this.top(st.map.tiles[l.tile]), img = this.landmarkImage(l.kind);
    g.drawImage(img, Math.round(p.x - 16), Math.round(p.y - 24));
    if (l.holder >= 0) { var pal = this.fac[st.players[l.holder].faction].palette; A.rect(g, p.x + 12, p.y - 26, 1, 12, '#3a2a1a'); A.rect(g, p.x + 13, p.y - 26, 6, 4, pal.secondary); A.rect(g, p.x + 13, p.y - 22, 6, 1, pal.accent); }
  };
  P.drawWeather = function (g, st, time, dt) {
    var self = this, E = this.E, rev = st.players[this.viewer].revealed, low = this.quality === 'low' || this.reduced;
    st.climate.fronts.forEach(function (f) {
      if (E && !E.helpers.frontKnown(st, self.viewer, f)) return;
      var tiles = E ? E.helpers.inRadius(st, f.tile, f.radius) : [f.tile];
      tiles = tiles.filter(function (id) { return rev[id]; }); if (!tiles.length) return;
      var c = self.top(st.map.tiles[f.tile]);
      if (f.phase === 'forecast') {
        g.save(); g.setLineDash([4, 6]); g.strokeStyle = 'rgba(255,240,200,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(c.x, c.y, f.radius * 52 + 20, (f.radius * 52 + 20) * SQ, 0, 0, 7); g.stroke(); g.restore();
        self.weatherGlyph(g, f.kind, c.x, c.y - 30, 0.7); return;
      }
      if (f.phase === 'after') return;
      tiles.forEach(function (id) {
        var p = self.top(st.map.tiles[id]), r = A.rng(id * 31 + f.id), i;
        if (f.kind === 'drought') { g.fillStyle = 'rgba(255,200,120,0.10)'; self.hexPath(g, p.x, p.y, 0.98); g.fill(); }
        if (f.kind === 'frost' && st.map.tiles[id].t < 0.4) { g.fillStyle = 'rgba(230,240,255,0.18)'; self.hexPath(g, p.x, p.y, 0.98); g.fill(); }
        if (f.kind === 'omen') { g.fillStyle = 'rgba(160,120,220,0.08)'; self.hexPath(g, p.x, p.y, 0.98); g.fill(); }
        if (f.kind === 'rains' || f.kind === 'storm') {
          g.fillStyle = f.kind === 'storm' ? 'rgba(20,30,50,0.16)' : 'rgba(120,160,200,0.08)'; self.hexPath(g, p.x, p.y, 0.98); g.fill();
          var n = low ? 3 : 9; g.strokeStyle = f.kind === 'storm' ? 'rgba(190,210,240,0.55)' : 'rgba(170,200,240,0.45)'; g.lineWidth = 1; g.beginPath();
          for (i = 0; i < n; i++) { var rx = p.x + (r() - 0.5) * 48, ph = low ? r() : ((time * (f.kind === 'storm' ? 1.6 : 1.1) + r()) % 1), ry = p.y - 40 + ph * 44; g.moveTo(rx, ry); g.lineTo(rx - 2, ry + 6); }
          g.stroke();
        }
      });
      if (f.kind === 'storm' && !low) { g.globalAlpha = 0.5; g.drawImage(self.stormSprite, c.x - 120, c.y - 120, 240, 110); g.globalAlpha = 1; if (!self.reducedFlash && Math.sin(time * 1.3 + f.id) > 0.995) self.flashIt('rgba(220,230,255,', 0.12); }
      if (f.kind === 'omen' && !low) for (var s2 = 0; s2 < 6; s2++) { var a = s2 * 1.05 + time * 0.2; A.px(g, c.x + Math.cos(a) * 40, c.y - 60 + Math.sin(a * 1.3) * 10, 'rgba(255,240,200,' + (0.5 + 0.5 * Math.sin(time * 3 + s2)).toFixed(2) + ')', 2, 2); }
      self.weatherGlyph(g, f.kind, c.x, c.y - 34, 1);
    });
  };
  P.weatherGlyph = function (g, kind, x, y, a) {
    g.globalAlpha = a; x = Math.round(x); y = Math.round(y);
    if (kind === 'drought') { A.disc(g, x, y, 4, '#ffb050'); for (var i = 0; i < 8; i++) A.px(g, x + Math.cos(i * 0.785) * 7, y + Math.sin(i * 0.785) * 7, '#ffd090'); }
    if (kind === 'rains') { A.disc(g, x - 3, y, 3, '#c8d0dc'); A.disc(g, x + 2, y - 1, 4, '#d8e0ea'); for (i = 0; i < 3; i++) A.line(g, x - 3 + i * 3, y + 4, x - 4 + i * 3, y + 7, '#7fb0e0'); }
    if (kind === 'storm') { A.disc(g, x - 3, y, 3, '#6a7282'); A.disc(g, x + 2, y - 1, 4, '#5a6270'); A.poly(g, [x, y + 2, x - 2, y + 7, x + 1, y + 6, x - 1, y + 10, x + 3, y + 4, x + 1, y + 4], '#fff2a0'); }
    if (kind === 'frost') { for (i = 0; i < 3; i++) A.line(g, x + Math.cos(i * 1.05) * 5, y + Math.sin(i * 1.05) * 5, x - Math.cos(i * 1.05) * 5, y - Math.sin(i * 1.05) * 5, '#e8f4ff'); }
    if (kind === 'omen') { A.star(g, x, y, 5, 5, 2, '#e8d8ff'); }
    g.globalAlpha = 1;
  };
  /* Influence flow (P045): rings for measured pressure at each settlement and arrows from the visible sources; numbers are exact engine values
   * computed by the app from a viewer-redacted state, so no hidden shrine or priest can leak through this layer. */
  P.drawInfluence = function (g, st) {
    var self = this, data = this.influence;
    data.forEach(function (d) {
      var p = self.top(st.map.tiles[d.tile]);
      d.values.forEach(function (v, i) {
        if (v.v <= 0) return; var pal = self.fac[st.players[v.p].faction].palette, rr = 10 + Math.min(30, v.v * 9);
        g.strokeStyle = A.rgba(pal.accent, 0.9); g.lineWidth = 2; g.setLineDash(DASH[self.fac[st.players[v.p].faction].pattern] || []); g.beginPath(); g.ellipse(p.x, p.y, rr + i * 3, (rr + i * 3) * SQ, 0, 0, 7); g.stroke(); g.setLineDash([]);
      });
      (d.sources || []).forEach(function (s) {
        var a = self.top(st.map.tiles[s.from]), pal = self.fac[st.players[s.p].faction].palette;
        g.strokeStyle = A.rgba(pal.secondary, 0.75); g.lineWidth = 1 + Math.min(3, s.v * 2); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(p.x, p.y); g.stroke();
        var ang = Math.atan2(p.y - a.y, p.x - a.x); A.poly(g, [p.x - Math.cos(ang) * 10, p.y - Math.sin(ang) * 10, p.x - Math.cos(ang - 0.4) * 16, p.y - Math.sin(ang - 0.4) * 16, p.x - Math.cos(ang + 0.4) * 16, p.y - Math.sin(ang + 0.4) * 16], A.rgba(pal.secondary, 0.9));
      });
      var label = d.values.filter(function (v) { return v.v > 0; }).map(function (v) { return v.v.toFixed(1); }).join(' / ');
      if (label) { g.font = 'bold 10px sans-serif'; g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(p.x - 22, p.y + 14, 44, 12); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(label, p.x, p.y + 23); }
    });
  };

  P.drawShrineGlow = function (g, st, s, time) {
    var p = this.top(st.map.tiles[s.tile]), pal = this.fac[st.players[s.shrine.owner].faction].palette, pulse = this.reduced ? 0.8 : 0.8 + 0.2 * Math.sin(time * 2 + s.id);
    var gr = g.createRadialGradient(p.x + 8, p.y - 10, 2, p.x + 8, p.y - 10, 46 * pulse); gr.addColorStop(0, A.rgba(pal.glow, 0.55)); gr.addColorStop(0.4, A.rgba(pal.glow, 0.16)); gr.addColorStop(1, A.rgba(pal.glow, 0));
    g.fillStyle = gr; g.fillRect(p.x - 50, p.y - 60, 116, 100);
    g.fillStyle = A.rgba(pal.glow, 0.18 * pulse); g.beginPath(); g.ellipse(p.x + 6, p.y + 2, 34, 12, 0, 0, 7); g.fill();
    var bg = g.createLinearGradient(0, p.y - 120, 0, p.y - 10); bg.addColorStop(0, A.rgba(pal.glow, 0)); bg.addColorStop(1, A.rgba(pal.glow, (s.shrine.spec === 'beacon' ? 0.3 : 0.12) * pulse)); g.fillStyle = bg; g.fillRect(p.x + 5, p.y - 120, s.shrine.spec === 'beacon' ? 10 : 6, 110);
  };
  P.drawSettlement = function (g, st, s, time) {
    var p = this.top(st.map.tiles[s.tile]), v = this.village(st, s), self = this, viewer = this.viewer;
    var ctrl = s.controlledBy;
    if (ctrl >= 0) { var pal = this.fac[st.players[ctrl].faction].palette; g.strokeStyle = A.rgba(pal.accent, 0.8); g.lineWidth = 1.5; g.beginPath(); g.ellipse(p.x - 2, p.y + 2, 24, 9, 0, 0, 7); g.stroke(); }
    g.drawImage(v.c, Math.round(p.x - 34), Math.round(p.y - 32));
    if (s.shrine) {
      var def = this.shrineDefs[s.shrine.type], spal = this.fac[st.players[s.shrine.owner].faction].palette, cond = this.shrineCondition(st, s);
      g.drawImage(this.shrineImage(def.art, spal, cond, s.shrine.spec), Math.round(p.x - 6), Math.round(p.y - 50));
      // ward stones: one per point of Ward; hollow when eclipsed (matches the architecture state)
      for (var i = 0; i < s.shrine.ward; i++) { g.fillStyle = s.shrine.eclipsed ? '#6a6070' : '#ffe9a0'; g.fillRect(Math.round(p.x + 10 + i * 4), Math.round(p.y - 54), 3, 3); if (s.shrine.eclipsed) { g.fillStyle = '#2a2030'; g.fillRect(Math.round(p.x + 11 + i * 4), Math.round(p.y - 53), 1, 1); } }
      var th = s.shrine.threat;
      if (th && (s.shrine.owner === viewer || th.by === viewer || th.storm)) { // telegraphed danger (P008): a pulsing red ring and a storm cloud for delayed miracles
        var k = this.reduced ? 1 : 0.6 + 0.4 * Math.sin(time * 5);
        g.strokeStyle = 'rgba(255,90,70,' + (0.8 * k).toFixed(2) + ')'; g.lineWidth = 2; g.beginPath(); g.ellipse(p.x + 10, p.y - 4, 26, 10, 0, 0, 7); g.stroke();
        A.poly(g, [p.x + 34, p.y - 44, p.x + 30, p.y - 36, p.x + 38, p.y - 36], '#ff5a46'); A.px(g, p.x + 33, p.y - 42, '#fff', 2, 4);
        if (th.storm) { g.globalAlpha = 0.85; g.drawImage(this.stormSprite, p.x - 30, p.y - 110, 90, 42); g.globalAlpha = 1; }
      }
    }
    if (!this.reduced && this.quality !== 'low') v.chim.forEach(function (ch, k) {
      for (var j = 0; j < 4; j++) { var ph = ((time * 0.35 + j / 4 + k * 0.37 + s.id * 0.13) % 1); var sx = p.x - 34 + ch[0] + Math.sin(ph * 6 + k) * 2 + ph * 6, sy = p.y - 32 + ch[1] - ph * 18; g.fillStyle = 'rgba(210,210,215,' + (0.35 * (1 - ph)).toFixed(3) + ')'; var sz = 1 + ph * 3; g.fillRect(Math.round(sx), Math.round(sy), Math.round(sz), Math.round(sz)); }
    });
    if (ctrl >= 0) { var pal2 = this.fac[st.players[ctrl].faction].palette, wave = this.reduced ? 0 : Math.sin(time * 5 + s.id) * 1; g.fillStyle = '#3a2a1a'; g.fillRect(Math.round(p.x - 22), Math.round(p.y - 30), 1, 14); g.fillStyle = pal2.secondary; g.fillRect(Math.round(p.x - 21), Math.round(p.y - 30), 6, 3); g.fillStyle = pal2.accent; g.fillRect(Math.round(p.x - 21 + 6), Math.round(p.y - 30 + wave), 2, 3); }
    // the viewer's own covenants are marked with a sealed scroll
    if (st.covenants && st.covenants.some(function (c) { return c.status === 'active' && c.p === viewer && c.s === s.id; })) { A.rect(g, p.x - 34, p.y - 22, 7, 5, '#e9dcc0'); A.px(g, p.x - 31, p.y - 20, '#b8302a', 2, 2); }
  };
  P.drawPriest = function (g, st, pr, time) {
    var t = st.map.tiles[pr.tile], p = this.top(t), an = this.priestAnim[pr.id], walking = false;
    if (an) { var k = (this.time - an.t0) / an.dur; if (k >= 1) delete this.priestAnim[pr.id]; else { walking = true; var a = this.top(st.map.tiles[an.from]); k = k * k * (3 - 2 * k); p = { x: a.x + (p.x - a.x) * k, y: a.y + (p.y - a.y) * k - Math.sin(k * Math.PI) * 4 }; } }
    var fid = st.players[pr.owner].faction, role = pr.role || 'emissary';
    var frame = this.reduced ? 0 : walking ? (Math.floor(this.time * 8) % 2 ? 1 : 2) : (st.settlements[t.settlement] && Math.sin(time * 1.3 + pr.id) > 0.7 ? 3 : 0);
    var x = Math.round(p.x - 20 + (pr.id % 3) * 6), y = Math.round(p.y - 12);
    g.drawImage(this.priestImage(fid, role, frame), x, y);
    if (this.selPriest === pr.id) { g.strokeStyle = 'rgba(255,230,140,0.95)'; g.lineWidth = 1; g.beginPath(); g.ellipse(x + 7, y + 19, 8, 3.5, 0, 0, 7); g.stroke(); }
  };

  P.drawFx = function (g, dt) {
    var self = this, keep = [];
    this.fx.forEach(function (e) {
      if (e.delay > 0) { e.delay -= dt; keep.push(e); return; }
      e.t += dt; var k = e.t / e.life; if (k >= 1) return; keep.push(e);
      var R = A.rng((e.seed || 1) * 1000 | 0), i, x, y;
      switch (e.k) {
        case 'mote': e.x += e.vx * dt; e.y += e.vy * dt; g.fillStyle = A.rgba(e.c, (1 - k).toFixed(3)); g.fillRect(Math.round(e.x), Math.round(e.y), 2, 2); break;
        case 'spark': e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 160 * dt; g.fillStyle = A.rgba(e.c, (1 - k).toFixed(3)); g.fillRect(Math.round(e.x), Math.round(e.y), 1, 1); break;
        case 'dust': e.x += e.vx * dt; e.y += e.vy * dt; g.fillStyle = A.rgba(e.c || '#8c826e', (0.6 * (1 - k)).toFixed(3)); var ds = 2 + k * 6; g.fillRect(Math.round(e.x - ds / 2), Math.round(e.y - ds / 2), Math.round(ds), Math.round(ds)); break;
        case 'ring': var rr = e.r0 + (e.r1 - e.r0) * (1 - Math.pow(1 - k, 2)); g.strokeStyle = A.rgba(e.c, (0.9 * (1 - k)).toFixed(3)); g.lineWidth = 2; g.beginPath(); g.ellipse(e.x, e.y, Math.max(1, rr), Math.max(1, rr * SQ), 0, 0, 7); g.stroke(); break;
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
          var bandY = e.y, sweepX = -100 + (self.WW + 200) * k, hb = (e.rows / 2 + 0.5) * ROW, x0 = e.hw ? e.x - e.hw * COL : -1e9, x1 = e.hw ? e.x + e.hw * COL : 1e9;
          g.save(); g.beginPath(); g.rect(Math.max(0, x0), bandY - hb - 20, Math.min(self.WW, x1) - Math.max(0, x0), hb * 2 + 20); g.clip();
          var bgr = g.createLinearGradient(sweepX - 260, 0, sweepX, 0); bgr.addColorStop(0, 'rgba(255,220,140,0)'); bgr.addColorStop(1, 'rgba(255,230,160,0.45)'); g.fillStyle = bgr; g.fillRect(sweepX - 260, bandY - hb, 260, hb * 2);
          A.disc(g, sweepX, bandY - hb - 10, 6, 'rgba(255,240,180,0.95)'); g.restore(); break;
        // ---- signature motifs
        case 'shadow': var sg = g.createRadialGradient(e.x, e.y, 0, e.x, e.y, 120); sg.addColorStop(0, 'rgba(5,0,15,' + (0.45 * Math.sin(k * Math.PI)).toFixed(3) + ')'); sg.addColorStop(1, 'rgba(5,0,15,0)'); g.fillStyle = sg; g.fillRect(e.x - 120, e.y - 120, 240, 240); break;
        case 'cloud': g.globalAlpha = 0.7 * Math.sin(k * Math.PI); g.drawImage(e.dark ? self.stormSprite : self.cloudSprite, e.x - 90 + k * 10, e.y - 30, 180, 80); g.globalAlpha = 1; break;
        case 'glow': var gg = g.createRadialGradient(e.x, e.y, 0, e.x, e.y, 60); gg.addColorStop(0, A.rgba(e.c, (0.6 * Math.sin(k * Math.PI)).toFixed(3))); gg.addColorStop(1, A.rgba(e.c, 0)); g.fillStyle = gg; g.fillRect(e.x - 60, e.y - 60, 120, 120); break;
        case 'leafSwirl': for (i = 0; i < 14; i++) { var la = i * 0.45 + k * 5, lr = 10 + k * 40 + i; A.px(g, e.x + Math.cos(la) * lr, e.y - 10 + Math.sin(la) * lr * 0.5 - k * 20, i % 2 ? '#86b552' : '#e2b33c', 2, 1); } break;
        case 'dome': g.strokeStyle = A.rgba(e.c, (0.9 * (1 - k)).toFixed(2)); g.lineWidth = 3; g.beginPath(); g.ellipse(e.x + 8, e.y - 6, 30, 30 * (0.4 + k * 0.6), 0, Math.PI, 0); g.stroke(); break;
        case 'wheat': for (i = -5; i <= 5; i++) { var wy = e.y - 4 - Math.min(1, k * 2) * 16; A.line(g, e.x + i * 5, e.y + 2, e.x + i * 5 + Math.sin(self.time * 4 + i) * 2, wy, '#c9a23a'); A.disc(g, e.x + i * 5, wy, 1.6, '#f1d27a'); } break;
        case 'birds': for (i = 0; i < 2; i++) { var bx = e.x - 80 + k * 160 + i * 14, by = e.y - 60 - Math.sin(k * Math.PI) * 30 + i * 8, flap = Math.sin(self.time * 18 + i) * 3; A.line(g, bx - 5, by - flap, bx, by, '#22232b'); A.line(g, bx, by, bx + 5, by - flap, '#22232b'); } break;
        case 'runes': for (i = 0; i < 4; i++) { var rx = e.x - 18 + i * 12, ry = e.y - 30 - k * 20; g.globalAlpha = 1 - k; A.line(g, rx, ry, rx, ry + 10, '#ffb067', 2); A.line(g, rx, ry + 1, rx + 4, ry + 4, '#ffb067', 2); g.globalAlpha = 1; } break;
        case 'rain': case 'downpour': g.strokeStyle = A.rgba(e.c, 0.7 * (1 - k)); g.lineWidth = 1; g.beginPath(); for (i = 0; i < (e.k === 'downpour' ? 60 : 36); i++) { var rx2 = e.x + (R() - 0.5) * 120, ry2 = e.y - 90 + ((R() + k * 3) % 1) * 90; g.moveTo(rx2, ry2); g.lineTo(rx2 - 3, ry2 + 8); } g.stroke(); break;
        case 'wings': for (i = 0; i < 6; i++) { g.strokeStyle = A.rgba(e.c, (1 - k).toFixed(2)); g.lineWidth = 2; g.beginPath(); g.moveTo(e.x + 8, e.y - 26); g.quadraticCurveTo(e.x + 8 - 30 - i * 3, e.y - 40 + i * 4, e.x + 8 - 40, e.y - 18 + i * 3); g.moveTo(e.x + 8, e.y - 26); g.quadraticCurveTo(e.x + 8 + 30 + i * 3, e.y - 40 + i * 4, e.x + 8 + 40, e.y - 18 + i * 3); g.stroke(); } break;
        case 'sprouts': for (i = 0; i < 8; i++) { var sx = e.x - 20 + i * 6, sh2 = Math.min(1, k * 2) * (6 + (i % 3) * 3); A.line(g, sx, e.y + 4, sx, e.y + 4 - sh2, '#5f9c48'); A.px(g, sx - 1, e.y + 3 - sh2, '#9fe07a', 3, 1); } break;
        case 'sunArc': var sa = Math.PI + k * Math.PI; A.disc(g, e.x + Math.cos(sa) * 140, e.y - 40 + Math.sin(sa) * 70, 7, '#ffe08a'); break;
        case 'tablets': for (i = 0; i < 3; i++) { var ty = e.y - 10 - k * 50 - i * 8; g.globalAlpha = 1 - k; A.rect(g, e.x - 16 + i * 12, ty, 7, 9, '#d4b884'); A.rect(g, e.x - 15 + i * 12, ty + 2, 5, 1, '#6a5034'); A.rect(g, e.x - 15 + i * 12, ty + 5, 4, 1, '#6a5034'); g.globalAlpha = 1; } break;
        case 'fountain': for (i = 0; i < 18; i++) { var fa = -Math.PI / 2 + (i - 9) * 0.08, fr = Math.sin(k * Math.PI) * 40; A.px(g, e.x + Math.cos(fa) * fr * 0.6, e.y - 4 + Math.sin(fa) * fr, '#d8f4ff', 2, 2); } break;
        case 'star8': var sy2 = e.y - 120 + Math.min(1, k * 1.6) * 90; A.star(g, e.x + 8, sy2, 8, 12 * (1 - k * 0.3), 5, A.rgba('#e8c15a', (1 - k * 0.5).toFixed(2))); A.star(g, e.x + 8, sy2, 8, 6, 3, 'rgba(255,242,184,0.9)', -Math.PI / 2 + Math.PI / 8); break;
        case 'glyphs': g.font = 'bold 12px serif'; g.textAlign = 'center'; for (i = 0; i < 5; i++) { g.fillStyle = A.rgba('#b6f0c8', (1 - k).toFixed(2)); g.fillText('ᚁᚂᚃᚄᚅ'.charAt(i), e.x - 30 + i * 15, e.y - 30 - Math.sin(k * 3 + i) * 10); } break;
        case 'fires': for (i = 0; i < 4; i++) { var fx2 = e.x - 20 + i * 13, fh = 6 + Math.sin(self.time * 12 + i) * 2; A.poly(g, [fx2, e.y, fx2 + 3, e.y - fh, fx2 + 6, e.y], '#ffb04a'); A.px(g, fx2 + 2, e.y - fh / 2, '#fff0a0', 2, 2); } break;
        case 'steam': for (i = 0; i < 10; i++) { g.fillStyle = 'rgba(240,240,230,' + (0.5 * (1 - k)).toFixed(2) + ')'; g.fillRect(e.x - 10 + Math.sin(k * 8 + i) * 8, e.y - 10 - k * 50 - i * 4, 3 + i % 3, 2); } break;
        case 'rings': for (i = 0; i < 3; i++) { var ck = Math.max(0, k - i * 0.15); g.strokeStyle = A.rgba(e.c, (0.9 * (1 - ck)).toFixed(2)); g.lineWidth = 2; g.beginPath(); g.ellipse(e.x, e.y, 50 - ck * 40, (50 - ck * 40) * SQ, 0, 0, 7); g.stroke(); } break;
        case 'wind': g.strokeStyle = A.rgba(e.c, (0.8 * (1 - k)).toFixed(2)); g.lineWidth = 1.5; for (i = 0; i < 5; i++) { g.beginPath(); var wx = e.x - 100 + k * 200 - i * 20, wy2 = e.y - 30 + i * 10; g.moveTo(wx, wy2); g.bezierCurveTo(wx + 20, wy2 - 10, wx + 40, wy2 + 10, wx + 60, wy2); g.stroke(); } break;
        case 'sunburst': for (i = 0; i < 16; i++) { var ra = i * Math.PI / 8; A.line(g, e.x + Math.cos(ra) * 10, e.y - 30 + Math.sin(ra) * 10, e.x + Math.cos(ra) * (20 + k * 40), e.y - 30 + Math.sin(ra) * (20 + k * 40), A.rgba('#ffe070', (1 - k).toFixed(2))); } A.disc(g, e.x, e.y - 30, 8 * (1 - k * 0.5), '#fffbe0'); break;
        case 'disc': A.disc(g, e.x, e.y - 50, 10 + k * 4, A.rgba('#d9a441', (1 - k).toFixed(2))); A.ring(g, e.x, e.y - 50, 14 + k * 20, A.rgba('#fff0c0', (1 - k).toFixed(2))); break;
        case 'blocks': for (i = 0; i < 6; i++) { var bk = Math.min(1, Math.max(0, k * 2 - i * 0.12)); A.rect(g, e.x - 16 + (i % 3) * 11, e.y - 4 - Math.floor(i / 3) * 7 - (1 - bk) * 30, 10, 6, A.rgba('#a09a8e', bk.toFixed(2))); } break;
        case 'bees': for (i = 0; i < 6; i++) { var ba = self.time * 4 + i, br2 = 14 + i * 3; A.px(g, e.x + Math.cos(ba) * br2, e.y - 14 + Math.sin(ba * 1.3) * br2 * 0.4, '#e0b030', 2, 2); } break;
        case 'tempest': g.globalAlpha = 0.8 * (1 - k); g.drawImage(self.stormSprite, e.x - 100, e.y - 130, 200, 90); g.globalAlpha = 1; if (k > 0.3 && k < 0.5) { var segs = [[e.x - 10, e.y - 80], [e.x + 4, e.y - 50], [e.x - 6, e.y - 30], [e.x + 8, e.y - 4]]; g.strokeStyle = '#e8eef4'; g.lineWidth = 2; g.beginPath(); segs.forEach(function (s, i) { if (i) g.lineTo(s[0], s[1]); else g.moveTo(s[0], s[1]); }); g.stroke(); } break;
        case 'ripples': for (i = 0; i < 4; i++) { var rk2 = (k + i * 0.25) % 1; g.strokeStyle = A.rgba('#9fd8f0', (0.8 * (1 - rk2)).toFixed(2)); g.lineWidth = 1.5; g.beginPath(); g.ellipse(e.x, e.y, 6 + rk2 * 70, (6 + rk2 * 70) * SQ, 0, 0, 7); g.stroke(); } break;
        case 'shards': for (i = 0; i < 8; i++) { var sk = Math.min(1, k * 1.5), sa2 = i * 0.785; A.rect(g, e.x + Math.cos(sa2) * 40 * (1 - sk), e.y - 20 + Math.sin(sa2) * 20 * (1 - sk), 3, 2, '#c8946a'); } break;
        case 'forge': for (i = 0; i < 20; i++) { var fa2 = -Math.PI / 2 + (R() - 0.5) * 2.4, fr2 = k * (20 + R() * 40); A.px(g, e.x + Math.cos(fa2) * fr2, e.y - 10 + Math.sin(fa2) * fr2 + k * k * 30, '#ffd060'); } A.disc(g, e.x, e.y - 8, 4 * (1 - k), '#ff8a3a'); break;
        case 'stone': var sy3 = e.y - 140 + Math.min(1, k * 2.2) * 130; A.poly(g, [e.x - 5, sy3, e.x + 5, sy3, e.x + 4, sy3 + 8, e.x - 4, sy3 + 8], '#7a6a5a'); if (k < 0.45) A.line(g, e.x, sy3 - 30, e.x, sy3, 'rgba(255,224,112,0.8)', 2); break;
        case 'rays': for (i = 0; i < 9; i++) { var ra2 = -Math.PI * 0.9 + i * 0.2; g.strokeStyle = A.rgba('#ffd9c2', (0.6 * Math.sin(k * Math.PI)).toFixed(2)); g.lineWidth = 3; g.beginPath(); g.moveTo(e.x - 120, e.y - 120); g.lineTo(e.x + Math.cos(ra2 + 1.2) * 90, e.y + Math.sin(ra2 + 1.2) * 40); g.stroke(); } break;
        case 'torii': var tk = Math.min(1, k * 2); A.rect(g, e.x - 14, e.y - 6 - tk * 22, 28, 3, '#e5532d'); A.rect(g, e.x - 10, e.y - 6 - tk * 22, 2, tk * 22, '#e5532d'); A.rect(g, e.x + 8, e.y - 6 - tk * 22, 2, tk * 22, '#e5532d'); break;
        case 'paddy': for (i = 0; i < 5; i++) { g.fillStyle = A.rgba('#9fe07a', (0.5 * Math.sin(k * Math.PI)).toFixed(2)); g.fillRect(e.x - 30 + i * 12, e.y - 2, 10, 4); } break;
        case 'stormCloud': g.globalAlpha = 0.85 * Math.sin(Math.min(1, k * 1.2) * Math.PI * 0.5); g.drawImage(self.stormSprite, e.x - 70, e.y - 120, 150, 60); g.globalAlpha = 1; break;
        case 'horizon': g.fillStyle = A.rgba('#fff0a0', (0.4 * Math.sin(k * Math.PI)).toFixed(2)); g.fillRect(e.x - 160, e.y - 60 + (1 - k) * 40, 320, 6); break;
        case 'flame': var fh2 = Math.sin(Math.min(1, k * 1.5) * Math.PI) * 30; A.poly(g, [e.x - 8, e.y - 4, e.x, e.y - 4 - fh2, e.x + 8, e.y - 4], '#d4502a'); A.poly(g, [e.x - 4, e.y - 4, e.x, e.y - 4 - fh2 * 0.6, e.x + 4, e.y - 4], '#fff0a0'); break;
        case 'measure': g.strokeStyle = A.rgba('#e0b81f', (1 - k).toFixed(2)); g.lineWidth = 1; for (i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(e.x, e.y, 30 + i * 12 + k * 10, (30 + i * 12 + k * 10) * SQ, 0, 0, 7); g.stroke(); } break;
        case 'eye': A.poly(g, [e.x - 20, e.y - 30, e.x, e.y - 40, e.x + 20, e.y - 30, e.x, e.y - 20], A.rgba('#e9e2cf', (1 - k).toFixed(2))); A.disc(g, e.x, e.y - 30, 5, A.rgba('#2f6fb3', (1 - k).toFixed(2))); break;
        case 'shieldArc': g.strokeStyle = A.rgba('#9fd2ff', (1 - k).toFixed(2)); g.lineWidth = 3; g.beginPath(); g.ellipse(e.x + 8, e.y - 10, 34, 24, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); break;
        case 'cue': if (!e.done) { e.done = true; if (e.flash) self.flashIt(e.flashC, e.flash); if (e.shake) self.shakeIt(e.shake); } break;
        case 'pips': for (i = 0; i < 3; i++) A.rect(g, e.x + i * 5, e.y - k * 10, 3, 3, A.rgba('#ffe9a0', (1 - k).toFixed(2))); break;
      }
    });
    this.fx = keep;
  };

  /* Sky through the age (P038): the sun climbs through the Dawn, stands high at the Zenith and sinks through the Twilight. Pure function of the turn. */
  P.skyFor = function (turn, maxTurns) {
    var u = Math.max(0, Math.min(1, (turn - 1) / Math.max(1, (maxTurns || 45) - 1)));
    var keys = [[0, '#3a4a7a', '#e8a890', '#ffb890'], [0.33, '#5a7aaa', '#b8c8de', '#ffe8c0'], [0.66, '#6a88b8', '#c8d0d8', '#fff4e0'], [1, '#2a1a3a', '#c86a4a', '#ff8a5a']];
    for (var i = 1; i < keys.length; i++) if (u <= keys[i][0]) { var a = keys[i - 1], b = keys[i], f = (u - a[0]) / (b[0] - a[0]); return { top: A.mix(a[1], b[1], f), mid: A.mix(a[2], b[2], f), sun: A.mix(a[3], b[3], f), sunX: 0.08 + u * 0.84, sunH: Math.sin(u * Math.PI), u: u }; }
    return { top: keys[3][1], mid: keys[3][2], sun: keys[3][3], sunX: 0.92, sunH: 0, u: 1 };
  };
  /* Cached half-resolution screen layer for smooth gradients; repainted only when its key or the canvas size changes. */
  P.screenLayer = function (name, key, W, H, paint) {
    var L = this.layers || (this.layers = {}), c = L[name], w = Math.max(1, Math.ceil(W / 2)), h = Math.max(1, Math.ceil(H / 2));
    if (c && c.key === key) return c;
    if (!c || c.width !== w || c.height !== h) c = A.cv(w, h);
    var g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); paint(g, w, h);
    c.key = key; L[name] = c; return c;
  };
  P.drawScreen = function (dt) {
    var ctx = this.ctx, W = this.canvas.width, H = this.canvas.height, self = this, st = this.state, time = this.time;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    var sky = this.skyFor(st.turn, st.maxTurns), atm = A.ATMOS[this.fac[st.players[this.viewer].faction].atmosphere] || A.ATMOS.olympus;
    var top = A.mix(sky.top, atm.top, 0.25), mid = A.mix(sky.mid, atm.mid, 0.25);
    var hzY = Math.max(0, Math.min(H, H * 0.55 + (-H0 / this.k() * 0.98) * this.cam.z * this.dpr));
    // sky, haze and vignette are smooth full-screen gradients: painted once into cached half-resolution layers and redrawn only
    // when their inputs change (size, horizon, turn, atmosphere); a full-screen gradient fill costs several times a cached copy
    var hzR = Math.round(hzY);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.screenLayer('sky', [W, H, hzR, top, mid, sky.sun, sky.sunX.toFixed(3), sky.sunH.toFixed(3)].join('|'), W, H, function (g, w, h) {
      g.fillStyle = '#1b3044'; g.fillRect(0, 0, w, h);
      if (hzR > 0) { var hy = hzR / 2, skyg = g.createLinearGradient(0, 0, 0, hy); skyg.addColorStop(0, top); skyg.addColorStop(0.7, mid); skyg.addColorStop(1, '#2a4258'); g.fillStyle = skyg; g.fillRect(0, 0, w, hy);
        var sx0 = w * sky.sunX, sy0 = hy * (1 - 0.8 * sky.sunH), sun = g.createRadialGradient(sx0, sy0, 0, sx0, sy0, w * 0.25); sun.addColorStop(0, A.rgba(sky.sun, 0.6)); sun.addColorStop(1, A.rgba(sky.sun, 0)); g.fillStyle = sun; g.fillRect(0, 0, w, hy); }
    }), 0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    var sx = 0, sy = 0; if (this.shake > 0.05) { sx = (this.rand() - 0.5) * this.shake * this.dpr; sy = (this.rand() - 0.5) * this.shake * this.dpr; this.shake *= Math.pow(0.02, dt); } else this.shake = 0;
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
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.screenLayer('haze', W + '|' + H + '|' + mid, W, H, function (g, w, h) { var hz = g.createLinearGradient(0, 0, 0, h * 0.55); hz.addColorStop(0, A.rgba(mid, 0.55)); hz.addColorStop(0.35, A.rgba(mid, 0.18)); hz.addColorStop(1, A.rgba(mid, 0)); g.fillStyle = hz; g.fillRect(0, 0, w, h * 0.55); }), 0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    // light grade from the sun's side; Twilight deepens, Zenith neutralises
    ctx.globalCompositeOperation = 'soft-light'; var wg = ctx.createRadialGradient(W * sky.sunX, -H * 0.2, 0, W * sky.sunX, -H * 0.2, W * 1.1); wg.addColorStop(0, atm.grade + (0.35 + 0.2 * (1 - sky.sunH)).toFixed(2) + ')'); wg.addColorStop(1, 'rgba(40,60,120,' + (0.25 + 0.2 * sky.u).toFixed(2) + ')'); ctx.fillStyle = wg; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
    if (this.quality !== 'low') {
      ctx.globalAlpha = 0.32;
      this.highClouds.forEach(function (cl) { var px = ((cl.x - self.cam.x * 1.25 * self.dpr + (self.reduced ? 0 : time * cl.v)) % (W + 800) + W + 800) % (W + 800) - 400; var py = cl.y * H - (self.cam.y - 300) * 0.3 * self.dpr; ctx.drawImage(self.cloudSprite, px, py, 300 * cl.s * self.dpr, 130 * cl.s * self.dpr); });
      ctx.globalAlpha = 1;
      if (!this.reduced) this.motes.forEach(function (m) { var mx = ((m.x * W + time * 12 * m.v) % W), my = ((m.y * H + time * 18 * m.v) % H); ctx.fillStyle = A.rgba(atm.motes, (0.25 + 0.25 * Math.sin(time * 2 + m.p)).toFixed(2)); ctx.fillRect(mx, my, 2 * self.dpr, 2 * self.dpr); });
    }
    this.drawBanners(ctx);
    var keep = [];
    this.texts.forEach(function (tx) { tx.t += dt; if (tx.t > tx.life) return; keep.push(tx); var p = self.project(tx.x, tx.y - tx.t * 14); ctx.globalAlpha = Math.min(1, (tx.life - tx.t) * 2); ctx.font = 'bold ' + Math.round(13 * self.dpr) + 'px Georgia, serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3 * self.dpr; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(tx.text, p.x, p.y); ctx.fillStyle = tx.c; ctx.fillText(tx.text, p.x, p.y); ctx.globalAlpha = 1; });
    this.texts = keep;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.screenLayer('vignette', W + '|' + H, W, H, function (g, w, h) { var vg = g.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.35, w / 2, h * 0.55, Math.max(w, h) * 0.75); vg.addColorStop(0, 'rgba(5,8,15,0)'); vg.addColorStop(1, 'rgba(5,8,15,0.6)'); g.fillStyle = vg; g.fillRect(0, 0, w, h); }), 0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    if (this.tint) { this.tint.t += dt; var ta = this.tint.a * Math.sin(Math.min(1, this.tint.t / this.tint.life) * Math.PI); if (this.tint.t >= this.tint.life) this.tint = null; else { ctx.fillStyle = A.rgba(this.tint.c, ta.toFixed(3)); ctx.fillRect(0, 0, W, H); } }
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
      var ctrl = s.controlledBy, f = ctrl >= 0 ? self.fac[st.players[ctrl].faction] : null, pal = f ? f.palette : null;
      ctx.fillStyle = 'rgba(12,14,22,0.78)'; ctx.fillRect(x, y, w, h);
      if (f) { ctx.fillStyle = pal.secondary; ctx.fillRect(x, y, 4 * sc, h); var em = self.emblemImage(f.id, 16); ctx.drawImage(em, x - 14 * sc, y, 14 * sc, 14 * sc); }
      else { ctx.fillStyle = '#55524a'; ctx.fillRect(x, y, 4 * sc, h); }
      ctx.strokeStyle = self.contrast ? '#ffffff' : pal ? pal.accent : 'rgba(200,190,160,0.5)'; ctx.lineWidth = self.contrast ? 2 : 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.fillStyle = '#f2ead6'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(name, x + 8 * sc, y + h / 2 + 0.5);
      ctx.fillStyle = '#e2c27a'; ctx.textAlign = 'right'; ctx.fillText(String(s.pop), x + w - 5 * sc, y + h / 2 + 0.5);
      var bx = x, by = y + h, bw = w, bh = Math.max(3, 3 * sc), acc = 0;
      ctx.fillStyle = 'rgba(80,80,80,0.9)'; ctx.fillRect(bx, by, bw, bh);
      s.followers.forEach(function (fl, pid) { if (!fl) return; var fw = bw * fl / s.pop; ctx.fillStyle = self.fac[st.players[pid].faction].palette.secondary; ctx.fillRect(bx + acc, by, fw, bh); if (self.patterns) { ctx.globalAlpha = 0.5; ctx.fillStyle = ctx.createPattern(self.factionPattern(st.players[pid].faction), 'repeat'); ctx.fillRect(bx + acc, by, fw, bh); ctx.globalAlpha = 1; } ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(bx + acc, by, fw, 1); acc += fw; });
    });
  };

  P.drawMinimap = function (mc) {
    var st = this.state; if (!st) return;
    var g = mc.getContext('2d'), W = mc.width, H = mc.height, tiles = st.map.tiles, rev = st.players[this.viewer].revealed, self = this;
    if (this.blackout) { g.fillStyle = '#05070c'; g.fillRect(0, 0, W, H); return; }
    var sx = W / (st.map.w + 0.5), sy = H / st.map.h;
    g.fillStyle = '#0c1a26'; g.fillRect(0, 0, W, H);
    tiles.forEach(function (t) {
      var x = (t.q + (t.r & 1) * 0.5) * sx, y = t.r * sy;
      if (!rev[t.id]) { g.fillStyle = '#151a24'; g.fillRect(x, y, sx + 0.6, sy + 0.6); return; }
      g.fillStyle = t.terrain === 'mountains' ? '#9a958c' : self.T[t.terrain].top; g.fillRect(x, y, sx + 0.6, sy + 0.6);
      var o = self.terr ? self.terr[t.id] : -1; if (o >= 0) { g.fillStyle = A.rgba(self.fac[st.players[o].faction].palette.secondary, 0.55); g.fillRect(x, y, sx + 0.6, sy + 0.6); }
    });
    st.settlements.forEach(function (s) { if (!rev[s.tile]) return; var t = tiles[s.tile], x = (t.q + (t.r & 1) * 0.5 + 0.5) * sx, y = (t.r + 0.5) * sy; g.fillStyle = s.shrine ? self.fac[st.players[s.shrine.owner].faction].palette.accent : '#f2ead6'; g.fillRect(x - 2, y - 2, 4, 4); g.strokeStyle = '#000'; g.strokeRect(x - 2.5, y - 2.5, 5, 5); });
    st.landmarks.forEach(function (l) { if (!rev[l.tile]) return; var t = tiles[l.tile], x = (t.q + (t.r & 1) * 0.5 + 0.5) * sx, y = (t.r + 0.5) * sy; g.fillStyle = '#e8d8ff'; g.beginPath(); g.moveTo(x, y - 3); g.lineTo(x + 3, y + 2); g.lineTo(x - 3, y + 2); g.closePath(); g.fill(); });
    var cw = this.canvas.width, ch = this.canvas.height, pts = [[0, ch * 0.05], [cw, ch * 0.05], [cw, ch], [0, ch]].map(function (c) { var w = self.unproject(c[0], c[1]); return [(w.x - M - 26) / COL * sx + sx * 0.5, (w.y - M - 30) / ROW * sy + sy * 0.5]; });
    g.strokeStyle = 'rgba(255,230,160,0.9)'; g.lineWidth = 1.5; g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); g.stroke();
  };
  P.minimapToWorld = function (mc, mx, my) {
    var st = this.state, sx = mc.width / (st.map.w + 0.5), sy = mc.height / st.map.h;
    return { x: M + 26 + (mx / sx - 0.5) * COL, y: M + 30 + (my / sy - 0.5) * ROW };
  };

  root.PWRenderer = Renderer;
})(typeof self !== 'undefined' ? self : this);
