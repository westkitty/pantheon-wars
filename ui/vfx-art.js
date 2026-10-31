/* Pantheon Wars — forty divine-power manifestations (v0.5), original procedural source art.
 * One painter per power, drawn live in world units around the target's ground point (0, 0; up is −y), under the local screen projection,
 * so effects are rasterised at screen resolution. paint(g, k, c, seed): k runs 0 → 1 over the manifestation beat (anticipation and
 * aftermath stay with the shared three-beat choreography in ui/render.js). Each painter has its own silhouette and motion: things rise,
 * fall, sweep, unfold, rotate or grow; none is a recoloured circle. Shapes follow the power's mechanic and the identity in data/powers.json;
 * no deity is shown and no sacred emblem of a living tradition is reproduced. Reduced motion draws one still frame (k = 0.6). */
(function (root) {
  'use strict';
  var A = root.PWArt, rgba = A.rgba, shade = A.shade;
  var PI = Math.PI, TAU = PI * 2;
  function rng(s) { return A.rng(s); }
  function ease(k) { return k * k * (3 - 2 * k); }
  function out(k) { return 1 - (1 - k) * (1 - k); }
  function bell(k, a, b) { return k < a ? k / a : k > b ? Math.max(0, (1 - k) / (1 - b)) : 1; } // fade in by a, out after b
  function poly(g, p, c) { g.fillStyle = c; g.beginPath(); g.moveTo(p[0], p[1]); for (var i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath(); g.fill(); }
  function line(g, x0, y0, x1, y1, c, w) { g.strokeStyle = c; g.lineWidth = w || 1; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  function ell(g, x, y, rx, ry, c, a0, a1) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, a0 || 0, a1 === undefined ? TAU : a1); g.fill(); }
  function ring(g, x, y, rx, ry, c, w) { g.strokeStyle = c; g.lineWidth = w || 1; g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); g.stroke(); }
  var GLOW = {}; // one cached radial sprite per colour, scaled per use (no gradient object per frame)
  function glow(g, x, y, r, c, a) {
    if (r <= 0 || a <= 0) return; var s = GLOW[c];
    if (!s) { s = GLOW[c] = A.cv(64, 64); var sg = s.getContext('2d'), gr = sg.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, rgba(c, 1)); gr.addColorStop(0.45, rgba(c, 0.35)); gr.addColorStop(1, rgba(c, 0)); sg.fillStyle = gr; sg.fillRect(0, 0, 64, 64); }
    var o = g.globalAlpha, sm = g.imageSmoothingEnabled; g.globalAlpha = o * Math.min(1, a); g.imageSmoothingEnabled = true; g.drawImage(s, x - r, y - r, r * 2, r * 2); g.globalAlpha = o; g.imageSmoothingEnabled = sm;
  }
  function lighter(g, f) { var o = g.globalCompositeOperation; g.globalCompositeOperation = 'lighter'; f(); g.globalCompositeOperation = o; }
  function alpha(g, a, f) { var o = g.globalAlpha; g.globalAlpha = o * Math.max(0, Math.min(1, a)); f(); g.globalAlpha = o; }
  /* a jagged electric path from (x0,y0) to (x1,y1) with seeded side branches */
  function bolt(g, x0, y0, x1, y1, r, c, w, branches) {
    var n = 9, pts = [];
    for (var i = 0; i <= n; i++) { var t = i / n; pts.push([x0 + (x1 - x0) * t + (i && i < n ? (r() - 0.5) * 12 : 0), y0 + (y1 - y0) * t]); }
    [[w + 4, rgba(c, 0.25)], [w + 1.5, rgba(c, 0.6)], [w * 0.6, '#ffffff']].forEach(function (s) { g.strokeStyle = s[1]; g.lineWidth = s[0]; g.lineJoin = 'round'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.forEach(function (p) { g.lineTo(p[0], p[1]); }); g.stroke(); });
    for (var b = 0; b < (branches || 0); b++) { var p = pts[2 + (r() * (n - 4) | 0)], len = 10 + r() * 14, dir = r() > 0.5 ? 1 : -1; g.strokeStyle = rgba(c, 0.8); g.lineWidth = 1; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0] + dir * len * 0.5, p[1] + len * 0.4); g.lineTo(p[0] + dir * len, p[1] + len * 0.9); g.stroke(); }
  }
  function cloud(g, x, y, w, c, dk) { for (var i = 0; i < 5; i++) ell(g, x - w / 2 + i * w / 4, y - Math.sin(i * 1.3) * w * 0.08, w * 0.22, w * 0.16, i % 2 ? c : shade(c, -0.08)); ell(g, x, y + w * 0.06, w * 0.55, w * 0.12, dk || shade(c, -0.25)); }
  function rain(g, x, y, w, h, k, c, n, slant) { g.strokeStyle = c; g.lineWidth = 1; g.beginPath(); for (var i = 0; i < n; i++) { var px = x - w / 2 + ((i * 37) % 100) / 100 * w, ph = ((k * 3 + i * 0.137) % 1); g.moveTo(px + ph * h * (slant || 0), y + ph * h); g.lineTo(px + ph * h * (slant || 0) - (slant || 0) * 5, y + ph * h - 6); } g.stroke(); }
  function leaf(g, x, y, s, a, c) { g.save(); g.translate(x, y); g.rotate(a); ell(g, 0, 0, s, s * 0.45, c); line(g, -s, 0, s, 0, shade(c, -0.3), 0.6); g.restore(); }
  function wing(g, x, y, s, dir, open, c, c2) { // a long wing of overlapping feathers; dir ±1, open 0..1
    for (var i = 0; i < 7; i++) { var a = -PI / 2 + dir * (0.25 + open * (0.25 + i * 0.16)), len = s * (0.55 + i * 0.07); g.save(); g.translate(x, y); g.rotate(a + (dir > 0 ? PI / 2 : -PI / 2) * 0); poly(g, [0, 0, Math.cos(a - dir * 0.06) * len, Math.sin(a - dir * 0.06) * len, Math.cos(a + dir * 0.08) * len * 0.92, Math.sin(a + dir * 0.08) * len * 0.92], i % 2 ? c : c2); g.restore(); }
  }
  function sunDisc(g, x, y, r, c) { glow(g, x, y, r * 2.6, c, 0.55); ell(g, x, y, r, r, c); ell(g, x - r * 0.25, y - r * 0.25, r * 0.55, r * 0.55, '#fffbe6'); }
  function groundRing(g, k, c, r) { ring(g, 0, 0, r * k, r * k * 0.36, rgba(c, 0.8 * (1 - k)), 2); }

  var V = {
    /* ---- Olympian Court */
    oak_whisper: function (g, k, c) { // an oak of light grows from the ground; its leaves spiral out over the revealed land
      var h = 46 * ease(Math.min(1, k * 1.6)), a = bell(k, 0.1, 0.75);
      alpha(g, a, function () { line(g, 0, 0, 0, -h, '#6a4a2a', 3); for (var i = 0; i < 5; i++) { var bh = -h * (0.45 + i * 0.1); line(g, 0, bh, (i % 2 ? 1 : -1) * (8 + i * 2) * (h / 46), bh - 8, '#6a4a2a', 1.5); }
        lighter(g, function () { glow(g, 0, -h * 0.8, 24 * (h / 46) + 2, c, 0.5); }); ell(g, 0, -h * 0.82, 18 * (h / 46) + 1, 13 * (h / 46) + 1, rgba('#4f7d33', 0.9)); ell(g, -5, -h * 0.9, 9 * (h / 46) + 1, 7 * (h / 46) + 1, rgba('#86b552', 0.9)); });
      for (var j = 0; j < 14; j++) { var t = (k * 1.4 + j / 14) % 1, ang = j * 2.4 + t * 4, rr = 6 + t * 46; alpha(g, (1 - t) * bell(k, 0.2, 0.85), function () { leaf(g, Math.cos(ang) * rr, -h * 0.8 + Math.sin(ang) * rr * 0.45 + t * 30, 3, ang, j % 3 ? '#86b552' : '#d8e890'); }); }
      groundRing(g, k, c, 50);
    },
    aegis_wall: function (g, k, c) { // a faceted bronze-rimmed shield dome rises over the shrine
      var r = 34 * out(Math.min(1, k * 1.5)), a = bell(k, 0.05, 0.8);
      alpha(g, a, function () { lighter(g, function () { ell(g, 0, 0, r, r * 0.95, rgba(c, 0.16), PI, TAU); });
        g.strokeStyle = rgba('#fff2c0', 0.7); g.lineWidth = 1; for (var i = -3; i <= 3; i++) { g.beginPath(); g.ellipse(0, 0, Math.abs(i) / 3 * r + 0.1, r * 0.95, 0, PI, TAU); g.stroke(); }
        for (var j = 1; j < 4; j++) { g.beginPath(); g.ellipse(0, -r * 0.95 * j / 4, r * Math.sqrt(1 - j * j / 16), r * 0.3 * Math.sqrt(1 - j * j / 16), 0, PI, TAU); g.stroke(); }
        ring(g, 0, 0, r, r * 0.34, rgba(c, 0.95), 3); ring(g, 0, -1, r, r * 0.34, rgba('#fff6d0', 0.8), 1); });
    },
    grain_wave: function (g, k, c) { // a golden wave of ripening grain runs out from the town
      for (var i = -9; i <= 9; i++) for (var row = 0; row < 3; row++) { var x = i * 5 + row * 2.5, y = row * 6 - 6, d = Math.abs(i) / 9, t = Math.min(1, Math.max(0, k * 1.7 - d * 0.6)); if (t <= 0) continue;
        var h = 14 * out(t), bend = Math.sin(k * 8 - d * 4) * 3; alpha(g, bell(k, 0.05, 0.8), function () { line(g, x, y, x + bend, y - h, '#b8962e', 1); ell(g, x + bend, y - h - 2, 1.4, 3, row ? c : '#fff0b0'); }); }
      lighter(g, function () { glow(g, 0, -6, 40 * k, c, 0.3 * (1 - k)); });
    },
    bolt_strike: function (g, k, c, s) { // a branching thunderbolt splits the sky and scorches the ground
      var r = rng(s + (k * 6 | 0)), on = k < 0.55;
      if (on) { alpha(g, 1 - k * 1.2, function () { lighter(g, function () { glow(g, 0, -40, 50, c, 0.35); bolt(g, 6, -110, 0, 0, r, c, 3, 4); bolt(g, 20, -110, 4, -30, r, c, 1.5, 1); }); }); }
      alpha(g, bell(k, 0.15, 0.6), function () { lighter(g, function () { glow(g, 0, 0, 26, '#ffffff', 0.8); }); });
      for (var i = 0; i < 10; i++) { var a = -PI * (0.1 + i * 0.08), d = 6 + k * 28; alpha(g, 1 - k, function () { poly(g, [Math.cos(a) * d, Math.sin(a) * d * 0.5, Math.cos(a) * d + 2, Math.sin(a) * d * 0.5 - 1, Math.cos(a) * (d + 4), Math.sin(a) * (d + 4) * 0.5], '#ffe8a0'); }); }
      alpha(g, Math.min(1, k * 3), function () { ell(g, 0, 1, 12, 4, 'rgba(30,20,14,0.55)'); });
    },
    /* ---- Hall of the Ash */
    raven_flight: function (g, k) { // two ravens beat up and out in opposite arcs, then turn back
      for (var j = 0; j < 2; j++) { var dir = j ? 1 : -1, t = k, x = dir * Math.sin(t * PI) * 36, y = -18 - Math.sin(t * PI) * 34 + Math.sin(t * TAU) * 4, flap = Math.sin(k * 40 + j) * 0.8;
        alpha(g, bell(k, 0.05, 0.85), function () { g.save(); g.translate(x, y); g.scale(dir * (t < 0.5 ? 1.8 : -1.8), 1.8);
          poly(g, [-7, 0, -2, -2, 4, -1, 8, 1, 3, 2, -2, 2], '#16171d'); poly(g, [-1, -1, -6, -8 * flap - 2, 2, -2], '#22232b'); poly(g, [0, 0, 6, -7 * flap - 1, 4, 0], '#2c2d36'); poly(g, [8, 1, 11, 1.5, 8, 2.2], '#5a5b64'); g.restore();
          ell(g, x, 0, 4, 1.2, 'rgba(10,10,20,0.25)'); }); }
    },
    rune_carve: function (g, k, c) { // a stone rises from the earth and angular carved marks burn into its face one stroke at a time
      var h = 30 * ease(Math.min(1, k * 2)), a = bell(k, 0.02, 0.85);
      alpha(g, a, function () { poly(g, [-8, 0, -9, -h + 4, -4, -h, 6, -h + 2, 8, 0], '#8c8a84'); poly(g, [3, -h + 1, 6, -h + 2, 8, 0, 3, 0], '#6a6862'); ell(g, 0, 0, 12, 3, 'rgba(60,40,20,0.5)');
        var strokes = [[-4, -8, -4, -24], [-4, -24, 1, -18], [-4, -16, 1, -11], [3, -10, 3, -24], [3, -24, -1, -20]], n = Math.floor(Math.max(0, k - 0.3) * 12);
        lighter(g, function () { strokes.slice(0, n).forEach(function (s) { if (-h < s[3]) { line(g, s[0], s[1], s[2], s[3], rgba(c, 0.9), 2); line(g, s[0], s[1], s[2], s[3], '#ffd0a0', 0.8); } }); glow(g, 0, -h / 2, 22, '#ff9a50', 0.25 * a); }); });
      for (var i = 0; i < 8; i++) { var t = (k * 2 + i / 8) % 1; alpha(g, 1 - t, function () { ell(g, (i - 4) * 2 + t * (i - 4) * 3, -14 - t * 20, 0.8, 0.8, '#ffc070'); }); }
    },
    sunrain_shower: function (g, k, c) { // sun breaks through a rain cloud; a bow stands over the fields
      var a = bell(k, 0.1, 0.8);
      alpha(g, a, function () { sunDisc(g, 14, -66, 7, '#ffd36a'); cloud(g, -4, -56, 46, '#c9d6de'); rain(g, -4, -50, 40, 46, k, rgba(c, 0.7), 18, 0.15);
        g.lineWidth = 2; ['#e86a6a', '#ffd36a', '#7fd07a', '#6fb0e0'].forEach(function (col, i) { g.strokeStyle = rgba(col, 0.55 * a); g.beginPath(); g.ellipse(0, 0, 44 - i * 2.2, 40 - i * 2.2, 0, PI + 0.15, TAU - 0.15); g.stroke(); }); });
    },
    hammer_arc: function (g, k, c, s) { // a hammer wheels down on a thunder arc and cracks the shrine's ground
      var t = Math.min(1, k * 1.8), ang = -PI * 0.9 + t * PI * 0.9, x = Math.cos(ang) * 40, y = -40 + Math.sin(ang) * 40 + t * 40;
      if (t < 1) alpha(g, 0.9, function () { g.save(); g.translate(x, y); g.rotate(ang + PI / 2 + t * 6); g.scale(1.6, 1.6); poly(g, [-2, 0, 2, 0, 2, 14, -2, 14], '#6a4a2a'); poly(g, [-8, -6, 8, -6, 8, 1, -8, 1], '#9aa4ad'); poly(g, [-8, -6, 8, -6, 8, -4, -8, -4], '#e6ecf0'); poly(g, [-8, 1, 8, 1, 8, 0, -8, 0], '#5a646d'); g.restore();
        lighter(g, function () { g.strokeStyle = rgba(c, 0.55); g.lineWidth = 3; g.beginPath(); for (var q = 0; q <= t; q += 0.05) { var aq = -PI * 0.9 + q * PI * 0.9; g.lineTo(Math.cos(aq) * 40, -40 + Math.sin(aq) * 40 + q * 40); } g.stroke(); }); });
      if (k > 0.5) { var r = rng(s); alpha(g, (1 - k) * 2, function () { lighter(g, function () { glow(g, 0, -4, 30, c, 0.6); for (var i = 0; i < 3; i++) bolt(g, 0, -2, (r() - 0.5) * 50, -12 - r() * 20, r, c, 1, 0); }); }); }
      if (k > 0.55) for (var i = 0; i < 6; i++) { var a2 = i * 1.05; line(g, 0, 0, Math.cos(a2) * 14 * (k - 0.4), Math.sin(a2) * 5 * (k - 0.4), 'rgba(30,24,30,0.7)', 1); }
    },
    /* ---- Ennead of the Two Lands */
    barque_sail: function (g, k, c) { // the sun's boat glides across the sky over the revealed band
      var x = -70 + k * 140, y = -60 - Math.sin(k * PI) * 10, a = bell(k, 0.08, 0.9);
      alpha(g, a, function () { lighter(g, function () { glow(g, x, y - 10, 30, c, 0.5); }); sunDisc(g, x, y - 14, 6, c);
        g.fillStyle = '#c9a24a'; g.beginPath(); g.moveTo(x - 18, y - 4); g.quadraticCurveTo(x, y + 6, x + 18, y - 4); g.lineTo(x + 14, y - 1); g.quadraticCurveTo(x, y + 3, x - 14, y - 1); g.closePath(); g.fill(); poly(g, [x - 18, y - 4, x - 21, y - 10, x - 15, y - 3], '#c9a24a'); poly(g, [x + 18, y - 4, x + 21, y - 10, x + 15, y - 3], '#c9a24a');
        line(g, x - 70, y + 12, x - 4, y + 12, rgba('#ffe8a0', 0.4), 2); });
    },
    throne_wings: function (g, k, c) { // two great wings unfold above a stepped seat, sheltering the shrine
      var o = ease(Math.min(1, k * 1.6)), a = bell(k, 0.05, 0.82);
      alpha(g, a, function () { poly(g, [-7, 0, 7, 0, 7, -10, 2, -10, 2, -16, -7, -16], '#e9d8a8'); poly(g, [-5, -2, 5, -2, 5, -8, 0, -8, 0, -14, -5, -14], rgba(c, 0.9));
        wing(g, -2, -18, 34, -1, o, '#36b3a8', '#e9d8a8'); wing(g, 2, -18, 34, 1, o, '#36b3a8', '#e9d8a8'); lighter(g, function () { glow(g, 0, -20, 30 * o, c, 0.3); }); });
    },
    sprout_mound: function (g, k, c) { // black earth heaves into a mound and green shoots break out of it
      var m = out(Math.min(1, k * 2)), a = bell(k, 0.02, 0.85);
      alpha(g, a, function () { ell(g, 0, 0, 22, 8 * m + 0.1, '#3a2a18', PI, TAU); ell(g, -4, -2 * m, 12, 4 * m + 0.1, '#5b3a1e', PI, TAU); ring(g, 0, 0, 24, 8, rgba('#36b3a8', 0.7 * m), 1.5);
        for (var i = 0; i < 9; i++) { var t = Math.max(0, Math.min(1, k * 2 - i * 0.08)), x = -16 + i * 4, base = -Math.sqrt(Math.max(0, 1 - x * x / 484)) * 7 * m, h = 12 * out(t); line(g, x, base, x + Math.sin(i) * 2, base - h, '#4f9a3c', 1.2); if (t > 0.5) { leaf(g, x - 2, base - h, 2.4, -0.6, c); leaf(g, x + 2, base - h + 1, 2.2, 0.6, '#9fe07a'); } } });
    },
    feather_scale: function (g, k, c) { // a balance hangs in the air: a feather on one pan, the scale tips and holds
      var tilt = Math.sin(Math.min(1, k * 1.4) * PI * 1.5) * 0.18 * (1 - k * 0.5), a = bell(k, 0.08, 0.85);
      alpha(g, a, function () { line(g, 0, -64, 0, -30, '#c9a24a', 2); g.save(); g.translate(0, -60); g.rotate(tilt); line(g, -26, 0, 26, 0, '#e2c060', 2);
        [-26, 26].forEach(function (x, i) { line(g, x, 0, x - 6, 14, rgba('#e2c060', 0.8)); line(g, x, 0, x + 6, 14, rgba('#e2c060', 0.8)); ell(g, x, 14, 8, 2.5, '#c9a24a', 0, PI);
          if (!i) { g.save(); g.translate(x, 10); g.rotate(-0.5); line(g, -7, 3, 7, -3, '#f4efe0', 1); for (var f = 0; f < 6; f++) line(g, -5 + f * 2, 2 - f * 0.8, -6 + f * 2, -2 - f * 0.8, f % 2 ? c : '#f4efe0', 1); g.restore(); } else ell(g, x, 10, 4, 4, '#8a3a2a'); });
        g.restore(); lighter(g, function () { glow(g, 0, -60, 30, c, 0.35); }); });
    },
    /* ---- Assembly of the Gods */
    solar_traverse: function (g, k, c) { // the sun crosses on a high arc and lights every waterway beneath it
      var ang = PI + k * PI, x = Math.cos(ang) * 64, y = Math.sin(ang) * 48 - 10, a = bell(k, 0.08, 0.9);
      alpha(g, a, function () { g.strokeStyle = rgba(c, 0.35); g.lineWidth = 1.5; g.setLineDash([3, 4]); g.beginPath(); g.ellipse(0, -10, 64, 48, 0, PI, ang); g.stroke(); g.setLineDash([]);
        sunDisc(g, x, y, 7, c); for (var i = 0; i < 8; i++) { var r0 = i * PI / 4 + k * 3; line(g, x + Math.cos(r0) * 10, y + Math.sin(r0) * 10, x + Math.cos(r0) * 15, y + Math.sin(r0) * 15, rgba(c, 0.8), 1.5); }
        lighter(g, function () { line(g, x, y, x * 0.6, 4, rgba(c, 0.25), 6); }); for (var w = -3; w <= 3; w++) ell(g, x * 0.6 + w * 7, 4 + (w % 2), 4, 0.8, rgba('#bfe8ff', 0.7)); });
    },
    rising_tablets: function (g, k, c) { // three clay tablets rise from the deep, wedge marks glowing, and stack as a teaching
      for (var i = 0; i < 3; i++) { var t = Math.max(0, Math.min(1, k * 1.8 - i * 0.25)), y = -8 - out(t) * (24 + i * 12), x = (i - 1) * 14 * (1 - t * 0.6), a = Math.min(1, t * 3) * bell(k, 0, 0.85);
        alpha(g, a, function () { g.save(); g.translate(x, y); g.rotate((i - 1) * 0.15 * (1 - t)); poly(g, [-7, -9, 7, -10, 8, 9, -6, 10], '#b89a6a'); poly(g, [-6, -8, 6, -9, 7, 8, -5, 9], '#d4b884');
          for (var r = 0; r < 4; r++) { var yy = -6 + r * 4; poly(g, [-4, yy, -2, yy - 1, -2, yy + 1], rgba('#6a5034', 1)); line(g, -2, yy, 4, yy + 0.4, '#6a5034', 0.8); }
          lighter(g, function () { glow(g, 0, 0, 14, c, 0.3 * t); }); g.restore(); }); }
      ring(g, 0, 0, 20, 6, rgba('#9fd8f0', 0.6 * (1 - k)), 1.5);
    },
    spring_rise: function (g, k, c) { // sweet water bursts up in a fountain and runs out in rings
      var h = 44 * Math.sin(Math.min(1, k * 1.3) * PI * 0.5) * (1 - Math.max(0, k - 0.8) * 3), a = bell(k, 0.02, 0.88);
      alpha(g, a, function () { for (var i = 0; i < 14; i++) { var s = (i / 13 - 0.5) * 2, t = (k * 2.5 + i * 0.07) % 1; g.strokeStyle = rgba(i % 2 ? c : '#e8f8ff', 0.75); g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * 6, -h * 1.4, s * 20, -h * 0.2 + 8); g.stroke(); ell(g, s * 20 * t, -h * Math.sin(t * PI) + 4 * t, 1, 1, '#ffffff'); }
        for (var r = 0; r < 3; r++) { var t2 = (k * 1.5 + r / 3) % 1; ring(g, 0, 0, 6 + t2 * 30, (6 + t2 * 30) * 0.35, rgba(c, 0.8 * (1 - t2)), 1.2); } });
    },
    star_descent: function (g, k, c) { // an eight-pointed star of light descends onto the contested town and sets in the ground
      var y = -90 + ease(Math.min(1, k * 1.4)) * 80, s = 10 + k * 4, rot = k * 2, a = bell(k, 0.05, 0.85);
      alpha(g, a, function () { lighter(g, function () { glow(g, 0, y, 34, c, 0.6); line(g, 0, y, 0, 0, rgba(c, 0.25), 8); });
        var p = []; for (var i = 0; i < 16; i++) { var r0 = i % 2 ? s * 0.42 : s, an = rot + i * PI / 8; p.push(Math.cos(an) * r0, y + Math.sin(an) * r0); } poly(g, p, c); ell(g, 0, y, s * 0.3, s * 0.3, '#fff6d8'); });
      if (k > 0.7) groundRing(g, (k - 0.7) / 0.3, c, 40);
    },
    /* ---- Tuatha Dé Danann */
    omen_script: function (g, k, c) { // a mist bank rolls in and three crows rise from it, wheeling toward what is hidden
      var a = bell(k, 0.1, 0.8);
      alpha(g, a * 0.8, function () { for (var i = 0; i < 6; i++) ell(g, -40 + i * 16 + Math.sin(k * 3 + i) * 4, -8 - (i % 2) * 6, 16, 7, rgba('#d8eee0', 0.35)); });
      for (var j = 0; j < 3; j++) { var t = Math.max(0, k * 1.3 - j * 0.12), x = -20 + j * 20 + Math.sin(t * 5 + j) * 10, y = -10 - t * 60, f = Math.sin(k * 36 + j * 2);
        alpha(g, a, function () { poly(g, [x - 5, y, x, y - 1, x + 5, y + 1, x, y + 2], '#1e1f26'); poly(g, [x - 1, y, x - 7, y - 5 * f - 1, x + 1, y - 1], '#2a2b33'); poly(g, [x, y, x + 6, y - 5 * f - 1, x + 3, y], '#1e1f26'); }); }
    },
    assembly_fires: function (g, k, c) { // a ring of gathering fires lights one by one round the shrine
      for (var i = 0; i < 7; i++) { var an = i / 7 * TAU, t = Math.max(0, Math.min(1, k * 2 - i * 0.12)), x = Math.cos(an) * 30, y = Math.sin(an) * 11; if (t <= 0) continue;
        var fl = 6 + 3 * Math.sin(k * 30 + i * 2); alpha(g, bell(k, 0, 0.85), function () { line(g, x - 3, y, x + 3, y - 1, '#5a3a20', 1.5); line(g, x - 3, y - 1, x + 3, y, '#4a3018', 1.5);
          lighter(g, function () { glow(g, x, y - 4, 10, c, 0.5 * t); }); poly(g, [x - 3, y - 1, x, y - fl * t, x + 3, y - 1], c); poly(g, [x - 1.4, y - 1, x, y - fl * 0.6 * t, x + 1.4, y - 1], '#fff0a0'); }); }
    },
    hearth_steam: function (g, k, c) { // a great cauldron steams; plumes rise and drift toward the towns it feeds
      var a = bell(k, 0.05, 0.85);
      alpha(g, a, function () { g.fillStyle = '#26262a'; g.beginPath(); g.moveTo(-12, -14); g.quadraticCurveTo(-14, 2, 0, 3); g.quadraticCurveTo(14, 2, 12, -14); g.closePath(); g.fill(); ell(g, 0, -14, 12, 3, '#3a3a40'); ell(g, 0, -14, 10, 2, '#e8c070');
        line(g, -10, 1, -12, 5, '#26262a', 2); line(g, 10, 1, 12, 5, '#26262a', 2); lighter(g, function () { glow(g, 0, 2, 12, '#ff8a3a', 0.4); });
        for (var i = 0; i < 9; i++) { var t = (k * 1.6 + i / 9) % 1, dx = Math.sin(t * 4 + i) * 6 + (i % 3 - 1) * t * 26; ell(g, dx, -16 - t * 50, 4 + t * 8, 3 + t * 5, rgba(c, 0.5 * (1 - t))); } });
    },
    challenge_rings: function (g, k, c) { // two rings of the assembly turn against each other over the contested town
      var a = bell(k, 0.08, 0.85), r1 = 30 * out(Math.min(1, k * 1.6)), r2 = 20 * out(Math.min(1, k * 1.6));
      alpha(g, a, function () { [[r1, k * 4, 1], [r2, -k * 5, -1]].forEach(function (R) { ring(g, 0, -4, R[0], R[0] * 0.38, rgba(c, 0.95), 2.5); for (var i = 0; i < 8; i++) { var an = R[1] + i * PI / 4; ell(g, Math.cos(an) * R[0], -4 + Math.sin(an) * R[0] * 0.38, 2.2, 1.6, i % 2 ? '#fff0b0' : '#5a4a30'); } });
        lighter(g, function () { glow(g, 0, -4, 20, c, 0.3); }); });
    },
    /* ---- The Fifth Sun */
    wind_sweep: function (g, k, c) { // spiralling gusts sweep across the swath, trailing streamers
      for (var j = 0; j < 4; j++) { var cx = -60 + ((k * 1.2 + j * 0.25) % 1) * 120, cy = -14 - j * 9, a = bell(k, 0.05, 0.9);
        alpha(g, a, function () { g.strokeStyle = rgba(j % 2 ? c : '#ffffff', 0.75); g.lineWidth = 1.4; g.beginPath(); for (var t = 0; t < 10; t += 0.25) { var rr = 1 + t * 0.9; g.lineTo(cx + Math.cos(t + k * 9) * rr - t * 2, cy + Math.sin(t + k * 9) * rr * 0.5); } g.stroke();
          g.beginPath(); g.moveTo(cx - 20, cy + 4); g.quadraticCurveTo(cx - 40, cy + 8 + Math.sin(k * 12 + j) * 3, cx - 60, cy + 2); g.stroke(); }); }
    },
    garden_rise: function (g, k, c) { // a reed-bound garden plot rises from the lake, planted as it surfaces
      var t = out(Math.min(1, k * 1.6)), a = bell(k, 0.02, 0.88), y = 4 - t * 8;
      alpha(g, a, function () { ell(g, 0, 4, 34, 10, rgba('#2f8fa0', 0.6)); for (var r = 0; r < 3; r++) ring(g, 0, 4, 20 + r * 6 + k * 6, (20 + r * 6 + k * 6) * 0.3, rgba('#9ff5e4', 0.5 * (1 - k)), 1);
        poly(g, [-20, y, 20, y, 17, y + 5, -17, y + 5], '#6a5034'); poly(g, [-20, y, 20, y, 18, y - 2, -18, y - 2], '#4f7a3a'); for (var i = 0; i < 9; i++) { var h = 10 * Math.max(0, Math.min(1, k * 2 - 0.4 - i * 0.03)); line(g, -16 + i * 4, y - 2, -16 + i * 4, y - 2 - h, i % 2 ? '#7cc25a' : '#5aa040', 1.2); if (h > 6) ell(g, -16 + i * 4, y - 2 - h, 1.2, 1.2, i % 3 ? '#e0c040' : c); }
        for (var p = -18; p <= 18; p += 6) line(g, p, y + 5, p, y + 8, '#5a3a20', 1); });
    },
    rain_curtain: function (g, k, c) { // a heavy cloud stands over the towns and lets down a curtain of rain; jade drops splash
      var a = bell(k, 0.08, 0.85);
      alpha(g, a, function () { cloud(g, 0, -64, 70, '#4a5868', '#2e3a48'); rain(g, 0, -56, 64, 56, k, rgba(c, 0.85), 30, 0.05);
        for (var i = 0; i < 8; i++) { var t = (k * 3 + i * 0.13) % 1, x = -28 + i * 8; ring(g, x, 2, 2 + t * 4, 1 + t * 1.5, rgba('#7fe0c8', 1 - t), 1); } });
    },
    noon_glare: function (g, k, c) { // the sun stands at the zenith: a vertical shaft of noon light pins the town, heat shimmers out
      var a = bell(k, 0.1, 0.75);
      alpha(g, a, function () { lighter(g, function () { var gr = g.createLinearGradient(0, -110, 0, 0); gr.addColorStop(0, rgba(c, 0)); gr.addColorStop(1, rgba(c, 0.5)); g.fillStyle = gr; g.fillRect(-10, -110, 20, 110); glow(g, 0, 0, 34, '#ffffff', 0.5); });
        sunDisc(g, 0, -104, 8, c); for (var i = 0; i < 12; i++) { var an = i * PI / 6 + k; line(g, Math.cos(an) * 11, -104 + Math.sin(an) * 11, Math.cos(an) * (i % 2 ? 15 : 19), -104 + Math.sin(an) * (i % 2 ? 15 : 19), c, 1.5); }
        for (var w = 0; w < 4; w++) { var t = (k * 2 + w / 4) % 1; g.strokeStyle = rgba('#fff8d0', 0.5 * (1 - t)); g.lineWidth = 1; g.beginPath(); for (var x = -30; x <= 30; x += 3) g.lineTo(x * (0.5 + t), -4 - t * 20 + Math.sin(x * 0.4 + k * 20) * 1.5); g.stroke(); } });
    },
    /* ---- Thousand Gods of Hatti */
    sun_disc_omen: function (g, k, c) { // a banded sun disc turns in the sky; an omen bird crosses it, and weather to come is read in its bands
      var a = bell(k, 0.1, 0.85), y = -70;
      alpha(g, a, function () { lighter(g, function () { glow(g, 0, y, 34, c, 0.4); }); ell(g, 0, y, 14, 14, c); for (var r = 1; r <= 3; r++) ring(g, 0, y, 14 - r * 3.5, 14 - r * 3.5, r % 2 ? '#fff0c0' : shade(c, -0.3), 1.2);
        for (var i = 0; i < 16; i++) { var an = i * PI / 8 + k; line(g, Math.cos(an) * 16, y + Math.sin(an) * 16, Math.cos(an) * 19, y + Math.sin(an) * 19, rgba(c, 0.8), 1); }
        var bx = -40 + k * 80, by = y - 4 + Math.sin(k * 8) * 4, f = Math.sin(k * 30); poly(g, [bx - 5, by, bx + 5, by + 1, bx, by + 2], '#2a2620'); poly(g, [bx - 1, by, bx - 6, by - 5 * f, bx + 2, by], '#2a2620'); });
    },
    gate_rebuild: function (g, k, c) { // dressed stones fly in and lock into a gate round the shrine, a lintel last
      var blocks = [[-14, -6], [10, -6], [-14, -14], [10, -14], [-14, -22], [10, -22], [-14, -30, 28]];
      blocks.forEach(function (b, i) { var t = Math.max(0, Math.min(1, k * 2.2 - i * 0.18)); if (t <= 0) return; var sx = b[0] + (i % 2 ? 40 : -40) * (1 - out(t)), sy = b[1] - 40 * (1 - out(t)), w = b[2] || 6;
        alpha(g, bell(k, 0, 0.88), function () { g.fillStyle = '#a09a8e'; g.fillRect(sx, sy, w, 8); g.fillStyle = '#c2bdb1'; g.fillRect(sx, sy, w, 1.5); g.fillStyle = '#6e6a62'; g.fillRect(sx + w - 1.5, sy, 1.5, 8); if (t >= 1) { lighter(g, function () { glow(g, sx + w / 2, sy + 4, 8, c, 0.25 * (1 - k)); }); } }); });
      for (var d = 0; d < 6; d++) { var t2 = (k * 2 + d / 6) % 1; alpha(g, (1 - t2) * 0.6, function () { ell(g, (d - 3) * 6, -2 - t2 * 6, 3 + t2 * 3, 2, '#c8bca8'); }); }
    },
    meadow_wake: function (g, k, c) { // the meadow wakes: flowers open outward in a widening ring and bees work them
      for (var i = 0; i < 26; i++) { var an = i * 2.4, rr = 8 + (i % 7) * 5, t = Math.max(0, Math.min(1, k * 2 - rr / 50)); if (t <= 0) continue; var x = Math.cos(an) * rr, y = Math.sin(an) * rr * 0.36;
        alpha(g, bell(k, 0, 0.9), function () { line(g, x, y, x, y - 5 * t, '#5fa040', 1); for (var p = 0; p < 5; p++) ell(g, x + Math.cos(p * 1.26) * 1.6 * t, y - 5 * t + Math.sin(p * 1.26) * 1.6 * t, 1 * t, 1 * t, i % 3 ? '#f4e0f0' : '#ffe070'); }); }
      for (var b = 0; b < 4; b++) { var bt = k * 4 + b * 1.7, bx = Math.cos(bt) * (14 + b * 5), by = -10 + Math.sin(bt * 1.7) * 6; alpha(g, bell(k, 0.15, 0.85), function () { ell(g, bx, by, 1.6, 1.1, c); ell(g, bx, by - 1.2, 1.2, 0.7, rgba('#ffffff', 0.7)); }); }
    },
    tempest_front: function (g, k, c, s) { // a wall of storm rolls in from the side and throws forked lightning at the shrine
      var x = 60 - out(Math.min(1, k * 1.5)) * 60, a = bell(k, 0.05, 0.85), r = rng(s + (k * 8 | 0));
      alpha(g, a, function () { for (var i = 0; i < 7; i++) ell(g, x - 40 + i * 13, -60 + Math.sin(i * 1.9) * 6, 14, 10, i % 2 ? '#4a5260' : '#3a4250'); ell(g, x, -52, 50, 7, '#2e3440'); rain(g, x, -50, 80, 50, k, rgba('#9fb8d8', 0.5), 24, -0.35);
        if (k > 0.35 && (k * 10 | 0) % 3 === 0) lighter(g, function () { bolt(g, x - 6, -54, 0, -4, r, c, 2, 3); }); });
    },
    /* ---- Council of the Òrìṣà */
    mirror_ripple: function (g, k, c) { // the river becomes a mirror: a bright disc of water opens and rings run out across it
      var a = bell(k, 0.05, 0.88), r0 = 26 * out(Math.min(1, k * 1.5));
      alpha(g, a, function () { var gr = g.createRadialGradient(-6, -2, 0, 0, 0, r0 + 0.1); gr.addColorStop(0, '#e8f8ff'); gr.addColorStop(0.5, rgba(c, 0.9)); gr.addColorStop(1, rgba('#2f7a9a', 0.7)); g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, r0 + 0.1, r0 * 0.36 + 0.1, 0, 0, TAU); g.fill();
        ring(g, 0, 0, r0, r0 * 0.36, '#e6b84a', 1.5); for (var i = 0; i < 4; i++) { var t = (k * 1.8 + i / 4) % 1; ring(g, 0, 0, r0 + t * 30, (r0 + t * 30) * 0.36, rgba('#e8f8ff', 0.6 * (1 - t)), 1); }
        lighter(g, function () { line(g, -r0 * 0.5, -1, -r0 * 0.1, -3, rgba('#ffffff', 0.8), 1.5); }); });
    },
    clay_restore: function (g, k, c) { // shards of fired clay fly together and fuse into a whole vessel at the shrine
      var r = rng(31), t = ease(Math.min(1, k * 1.6)), a = bell(k, 0.02, 0.88);
      alpha(g, a, function () { for (var i = 0; i < 10; i++) { var an = r() * TAU, d = (1 - t) * (20 + r() * 20), sx = Math.cos(an) * d, sy = -14 + Math.sin(an) * d * 0.6, ro = (1 - t) * (r() - 0.5) * 6;
          g.save(); g.translate(sx, sy); g.rotate(ro); poly(g, [-3, -2, 3, -3, 4, 2, -2, 3], i % 2 ? '#c8946a' : '#a87048'); g.restore(); }
        if (t > 0.95) { g.fillStyle = '#c8946a'; g.beginPath(); g.moveTo(-6, -24); g.quadraticCurveTo(-12, -14, -6, -4); g.lineTo(6, -4); g.quadraticCurveTo(12, -14, 6, -24); g.closePath(); g.fill(); line(g, -6, -24, 6, -24, '#e0b088', 2); lighter(g, function () { glow(g, 0, -14, 18, c, 0.5 * (1 - k)); }); } });
    },
    forge_sparks: function (g, k, c) { // an anvil rings: sparks fountain up and run out along the roads as bright filaments
      var a = bell(k, 0.05, 0.88);
      alpha(g, a, function () { poly(g, [-8, -6, 8, -6, 6, -3, 3, -3, 3, 0, -3, 0, -3, -3, -8, -3], '#4a4a52'); poly(g, [-8, -6, 8, -6, 7, -5, -8, -5], '#8a8a94'); line(g, -4, -7, 5, -7, '#ff8a3a', 2);
        lighter(g, function () { glow(g, 0, -7, 14, '#ff8a3a', 0.5); for (var i = 0; i < 18; i++) { var t = (k * 2.4 + i / 18) % 1, an = -PI / 2 + (i % 9 - 4) * 0.18, v = 30 + (i % 5) * 6; var x = Math.cos(an) * v * t, y = -7 + Math.sin(an) * v * t + 40 * t * t; ell(g, x, y, 1, 1, i % 3 ? c : '#ffffff'); } });
        [[-1, 0.3], [1, 0.25], [1, -0.4]].forEach(function (d) { var L = 50 * Math.min(1, k * 1.5); line(g, 0, 0, d[0] * L, d[1] * L * 0.6, rgba(c, 0.7 * (1 - k)), 1.5); }); });
    },
    thunder_stone: function (g, k, c, s) { // a thunderstone falls on twin bolts and buries itself in the shrine's ground
      var t = Math.min(1, k * 2), y = -100 + t * t * 96, r = rng(s + (k * 5 | 0));
      if (t < 1) alpha(g, 1, function () { lighter(g, function () { bolt(g, -6, -110, -2, y, r, c, 1.5, 1); bolt(g, 6, -110, 2, y, r, c, 1.5, 1); }); g.save(); g.translate(0, y); g.rotate(t * 4); poly(g, [-5, -3, 0, -6, 5, -2, 4, 4, -3, 5], '#7a6a5a'); poly(g, [-5, -3, 0, -6, 2, -3, -2, 0], '#9a8a78'); g.restore(); });
      else alpha(g, (1 - k) * 2, function () { lighter(g, function () { glow(g, 0, -2, 28, c, 0.7); }); for (var i = 0; i < 8; i++) { var an = PI + i * PI / 7, d = (k - 0.5) * 50; ell(g, Math.cos(an) * d, Math.sin(an) * d * 0.4, 1.5, 1.5, '#9a8a78'); } });
      if (k > 0.5) ell(g, 0, 1, 10, 3.5, 'rgba(26,20,14,0.6)');
    },
    /* ---- Shrines of the Kami */
    dawn_rays: function (g, k, c) { // the first light opens like a fan from behind a bright disc and washes across the land
      var a = bell(k, 0.05, 0.85), open = ease(Math.min(1, k * 1.5));
      alpha(g, a, function () { lighter(g, function () { for (var i = -6; i <= 6; i++) { var an = -PI / 2 + i * 0.2 * open; poly(g, [0, -40, Math.cos(an - 0.05) * 90, -40 + Math.sin(an - 0.05) * 90, Math.cos(an + 0.05) * 90, -40 + Math.sin(an + 0.05) * 90], rgba(i % 2 ? c : '#fff4e0', 0.18)); } glow(g, 0, -40, 40, c, 0.5); });
        ell(g, 0, -40, 9, 9, '#fff6e8'); ring(g, 0, -40, 9, 9, '#e9c46a', 1.5); });
    },
    gate_raise: function (g, k, c) { // two red posts rise from the ground, the tie-beam and the upper lintel drop onto them
      var p = out(Math.min(1, k * 2)), l = ease(Math.max(0, Math.min(1, k * 2.4 - 1))), a = bell(k, 0, 0.9);
      alpha(g, a, function () { g.fillStyle = '#c43e20'; g.fillRect(-12, -30 * p, 3, 30 * p); g.fillRect(9, -30 * p, 3, 30 * p); g.fillStyle = '#2a1612'; g.fillRect(-13, -1, 5, 1); g.fillRect(8, -1, 5, 1);
        if (l > 0) { var dy = (1 - l) * -30; g.fillStyle = '#d84a28'; g.fillRect(-13, -24 + dy, 26, 2); g.fillStyle = '#2a1612'; g.fillRect(-17, -32 + dy, 34, 2); g.fillStyle = '#d84a28'; g.fillRect(-16, -30 + dy, 32, 2.5); g.fillRect(-1, -28 + dy, 2, 4); }
        if (l >= 1) lighter(g, function () { glow(g, 0, -16, 30, c, 0.4 * (1 - k)); }); });
    },
    paddy_glow: function (g, k, c) { // flooded fields light up plot by plot and rice stands up in rows
      for (var r = 0; r < 3; r++) for (var q = -3; q <= 3; q++) { var x = q * 12 + (r % 2) * 6, y = r * 7 - 8, d = Math.hypot(q, r - 1) / 4, t = Math.max(0, Math.min(1, k * 2 - d)); if (t <= 0) continue;
        alpha(g, bell(k, 0, 0.88), function () { poly(g, [x - 6, y, x, y - 3, x + 6, y, x, y + 3], rgba('#7ab0c8', 0.85)); lighter(g, function () { poly(g, [x - 6, y, x, y - 3, x + 6, y, x, y + 3], rgba(c, 0.35 * t)); });
          for (var s = 0; s < 3; s++) line(g, x - 3 + s * 3, y, x - 3 + s * 3, y - 4 * t, '#7cb85a', 1); }); }
    },
    gathering_storm: function (g, k, c, s) { // a dark vortex turns over the rival shrine, tightening, lit from inside
      var a = bell(k, 0.08, 0.92), r = rng(s + (k * 6 | 0));
      alpha(g, a, function () { for (var i = 0; i < 18; i++) { var an = i * 0.7 + k * 5, rr = 44 - i * 2 + Math.sin(k * 3) * 2; ell(g, Math.cos(an) * rr, -62 + Math.sin(an) * rr * 0.3, 10 - i * 0.3, 6, i % 2 ? '#4a5260' : '#3a4250'); }
        if ((k * 12 | 0) % 4 === 1) lighter(g, function () { glow(g, 0, -62, 30, c, 0.6); bolt(g, 0, -60, (r() - 0.5) * 10, -4, r, c, 1.5, 2); }); rain(g, 0, -56, 40, 50, k, rgba('#9fc0e0', 0.45), 14, 0); });
    },
    /* ---- Vedic Hymns */
    dawn_unveil: function (g, k, c) { // a band of night draws back like a curtain from a rose-gold horizon
      var o = ease(Math.min(1, k * 1.4)), a = bell(k, 0.02, 0.85);
      alpha(g, a, function () { lighter(g, function () { glow(g, 0, -4, 64, c, 0.5); glow(g, 0, -20, 40, '#ff9a70', 0.3); });
        var w = 60 * (1 - o), gl = g.createLinearGradient(-60, 0, -60 + w + 12, 0); gl.addColorStop(0, 'rgba(40,24,70,0.6)'); gl.addColorStop(Math.max(0.01, w / (w + 12)), 'rgba(40,24,70,0.45)'); gl.addColorStop(1, 'rgba(40,24,70,0)'); g.fillStyle = gl; g.fillRect(-60, -70, w + 12, 70);
        var gr2 = g.createLinearGradient(60, 0, 60 - w - 12, 0); gr2.addColorStop(0, 'rgba(40,24,70,0.6)'); gr2.addColorStop(Math.max(0.01, w / (w + 12)), 'rgba(40,24,70,0.45)'); gr2.addColorStop(1, 'rgba(40,24,70,0)'); g.fillStyle = gr2; g.fillRect(60 - w - 12, -70, w + 12, 70);
        for (var i = 0; i < 4; i++) ell(g, (i - 1.5) * 24 + Math.sin(k * 4 + i) * 3, -40 - i * 4, 12, 2.5, rgba('#ffd0c0', 0.5 * o)); line(g, -60, 0, 60, 0, rgba('#fff0a0', 0.8 * o), 1.5); });
    },
    fire_kindle: function (g, k, c) { // fire is kindled on the altar: a small flame climbs into a tall standing fire and throws sparks
      var h = 8 + 34 * ease(Math.min(1, k * 1.6)), a = bell(k, 0.02, 0.88), fl = Math.sin(k * 40) * 2;
      alpha(g, a, function () { g.fillStyle = '#c8a878'; g.fillRect(-8, -4, 16, 4); g.fillStyle = '#e0c898'; g.fillRect(-8, -4, 16, 1);
        lighter(g, function () { glow(g, 0, -h * 0.4, h * 0.9, c, 0.5); });
        g.fillStyle = c; g.beginPath(); g.moveTo(-7, -4); g.quadraticCurveTo(-9, -h * 0.5, fl, -h); g.quadraticCurveTo(9, -h * 0.5, 7, -4); g.fill();
        g.fillStyle = '#ffb040'; g.beginPath(); g.moveTo(-4, -4); g.quadraticCurveTo(-5, -h * 0.4, fl * 0.6, -h * 0.7); g.quadraticCurveTo(5, -h * 0.4, 4, -4); g.fill(); g.fillStyle = '#fff0a0'; g.beginPath(); g.ellipse(0, -h * 0.25, 2, h * 0.18, 0, 0, TAU); g.fill();
        for (var i = 0; i < 7; i++) { var t = (k * 2 + i / 7) % 1; ell(g, Math.sin(i * 3 + t * 6) * 8, -h - t * 20, 1, 1, rgba('#ffe0a0', 1 - t)); } });
    },
    water_measure: function (g, k, c) { // a golden cord measures out the land: it loops round the followers and the waters settle into order
      var a = bell(k, 0.05, 0.88), L = Math.min(1, k * 1.5);
      alpha(g, a, function () { g.strokeStyle = c; g.lineWidth = 1.5; g.beginPath(); for (var t = 0; t <= L * TAU * 1.5; t += 0.1) { var rr = 34 - t * 2.5; g.lineTo(Math.cos(t) * rr, -8 + Math.sin(t) * rr * 0.36 - Math.sin(t * 6) * 1.2); } g.stroke();
        for (var r = 0; r < 3; r++) ring(g, 0, 0, 10 + r * 9, (10 + r * 9) * 0.34, rgba('#9fd8f0', 0.6 * L), 1); lighter(g, function () { glow(g, 0, -8, 20, c, 0.25 * L); }); });
    },
    monsoon_burst: function (g, k, c, s) { // the cloud wall breaks: a downpour falls in sheets with forked light, flooding out from the town
      var a = bell(k, 0.05, 0.85), r = rng(s + (k * 7 | 0));
      alpha(g, a, function () { cloud(g, 0, -70, 90, '#3a4868', '#24304a'); rain(g, 0, -62, 84, 64, k * 1.6, rgba(c, 0.9), 44, 0.2);
        if ((k * 14 | 0) % 5 === 2) lighter(g, function () { bolt(g, -10, -64, 6, -2, r, '#e8f0ff', 2, 3); glow(g, 0, -60, 40, '#c8d8ff', 0.4); });
        for (var i = 0; i < 3; i++) { var t = (k * 1.4 + i / 3) % 1; ring(g, 0, 2, 10 + t * 40, (10 + t * 40) * 0.34, rgba('#7fb8f0', 0.7 * (1 - t)), 1.5); } });
    }
  };
  root.PWVfxArt = { paint: V, ids: Object.keys(V) };
})(typeof self !== 'undefined' ? self : this);
