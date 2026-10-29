/*
 * Pantheon Wars — Chronicle of Ages (P025) and End-of-Age Tapestry (P050).
 * reconstruct() replays a save/chronicle record on private states, keeping one checkpoint at the start of every turn; it never touches
 * the live game. decisiveEvents() picks the 3–7 most consequential entries of the canonical log. renderTapestry() paints a woven
 * commemorative image from those same verified records (browser only). UMD so the pure parts are tested in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PWChronicle = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function fastClone(E, s) { var m = s.map; s.map = null; var c = E.clone(s); s.map = m; c.map = m; return c; }

  function reconstruct(E, rec) {
    var cfg = rec.cfg || { seed: rec.seed, players: rec.players };
    var s; try { s = E.newGame({ seed: cfg.seed, players: cfg.players, mode: cfg.mode }); } catch (e) { return { error: e.message }; }
    var checkpoints = {}, order = [], mismatches = [], hashes = rec.turnHashes || {};
    function mark() { checkpoints[s.turn] = fastClone(E, s); order.push(s.turn); var h = hashes[s.turn]; if (h && h !== E.hash(s)) mismatches.push({ turn: s.turn, expected: h, got: E.hash(s) }); }
    mark();
    for (var i = 0; i < rec.actions.length; i++) {
      var t = s.turn, err = E.apply(s, rec.actions[i].a);
      if (err) return { error: 'action ' + (i + 1) + ' is illegal: ' + err, checkpoints: checkpoints };
      if (s.turn !== t && !s.over) mark();
    }
    var H = E.helpers, scores = order.map(function (t) { var c = checkpoints[t]; return c.players.map(function (p) { return H.scoreOf(c, p.id); }); });
    var shares = order.map(function (t) { var c = checkpoints[t], tp = H.totalPop(c); return c.players.map(function (p) { return H.followersOf(c, p.id) / tp; }); });
    scores.push(s.players.map(function (p) { return H.scoreOf(s, p.id); }));
    return { checkpoints: checkpoints, turns: order, final: s, scores: scores.slice(0, order.length), finalScores: scores[scores.length - 1], shares: shares, mismatches: mismatches };
  }

  var WEIGHT = { victory: 9, eliminated: 8, topple: 6, breach: 5, covenantBroken: 4, covenantKept: 4, age: 3, landmark: 2, festival: 2, counter: 3, specialize: 1, route: 1, shrine: 1 };
  function eventWeight(l) {
    if (l.k === 'control') return l.x && l.x.from >= 0 ? 5 : 0; // a town torn from another god
    if (l.k === 'route') return l.x && l.x.restored ? 0 : 1;
    return WEIGHT[l.k] || 0;
  }
  /* The most consequential moments, in chronological order. Always between 3 and max (when the history has at least 3 entries). */
  function decisiveEvents(book, max) {
    max = max || 7;
    var log = book.final.log.filter(function (l) { return eventWeight(l) > 0; });
    var ranked = log.slice().sort(function (a, b) { return eventWeight(b) - eventWeight(a) || a.id - b.id; });
    var pick = [], seenAge = {};
    ranked.forEach(function (l) { if (pick.length >= max) return; if (l.k === 'age') { if (seenAge[l.x.age]) return; seenAge[l.x.age] = 1; } if (l.k === 'shrine' && pick.length >= 3) return; pick.push(l); });
    if (pick.length < 3) book.final.log.filter(function (l) { return l.k === 'start' || l.k === 'shrine' || l.k === 'power'; }).slice(0, 3 - pick.length).forEach(function (l) { pick.push(l); });
    return pick.sort(function (a, b) { return a.id - b.id; }).slice(0, max);
  }
  function summary(E, book, rec) {
    var f = book.final, H = E.helpers, ev = decisiveEvents(book, 7);
    return {
      format: 'pantheon-wars-chronicle-summary', engine: E.version, seed: f.seed, mode: f.mode, turns: f.turn,
      winner: f.winner, players: f.players.map(function (p) { return { seat: p.id, faction: p.faction, name: p.name, followers: H.followersOf(f, p.id), shrines: H.playerShrines(f, p.id).length, score: H.scoreOf(f, p.id) }; }),
      decisive: ev.map(function (l) { return { id: l.id, turn: l.t, kind: l.k, text: l.m, tile: l.x && l.x.tile !== undefined ? l.x.tile : null }; }),
      scoreTimeline: book.scores, finalHash: E.hash(f), record: rec
    };
  }

  /* ---------------- tapestry (browser) */
  function renderTapestry(canvas, E, book, A, opts) {
    opts = opts || {};
    var W = canvas.width = opts.width || 1600, Hh = canvas.height = opts.height || 1000, g = canvas.getContext('2d'), f = book.final, D = E.D, H = E.helpers;
    var progress = opts.progress === undefined ? 1 : opts.progress;
    var winner = f.winner ? f.players[f.winner.pid] : null, wf = winner ? D.factions[winner.faction] : D.factions[f.players[0].faction], pal = wf.palette;
    // woven ground
    g.fillStyle = A.mix(pal.dark, '#2a2418', 0.5); g.fillRect(0, 0, W, Hh);
    var r = A.rng(f.seed * 7 + 1);
    for (var y = 0; y < Hh; y += 3) { g.fillStyle = 'rgba(255,240,210,' + (0.02 + r() * 0.03).toFixed(3) + ')'; g.fillRect(0, y, W, 1); }
    for (var x = 0; x < W; x += 3) { g.fillStyle = 'rgba(0,0,0,' + (0.02 + r() * 0.03).toFixed(3) + ')'; g.fillRect(x, 0, 1, Hh); }
    // border of every pantheon's insignia in play, repeated
    var emSize = 44, bx = 0, i = 0;
    for (bx = 20; bx < W - 40; bx += 60) { var pf = D.factions[f.players[i++ % f.players.length].faction]; g.drawImage(A.emblem(pf.emblem, pf.palette, emSize), bx, 14); g.drawImage(A.emblem(pf.emblem, pf.palette, emSize), bx, Hh - 58); }
    g.strokeStyle = pal.accent; g.lineWidth = 4; g.strokeRect(10, 70, W - 20, Hh - 140); g.lineWidth = 1; g.strokeRect(18, 78, W - 36, Hh - 156);
    // title
    g.textAlign = 'center'; g.fillStyle = '#f3d98e'; g.font = '600 46px "Palatino Linotype", Palatino, Georgia, serif';
    var title = winner ? winner.name + ' — ' + ({ ascendancy: 'Ascendancy', dominion: 'Dominion', twilight: 'Twilight Judgment', sacred: 'Sacred Ground', covenant: 'The Kept Word', objective: 'Trial Passed', objectiveFailed: 'Trial Lost' }[f.winner.type] || f.winner.type) : 'The Age Unfinished';
    g.fillText(title, W / 2, 130);
    g.font = 'italic 22px Georgia, serif'; g.fillStyle = '#e6dcc2';
    g.fillText('Seed ' + f.seed + ' · ' + f.turn + ' turns · ' + f.players.map(function (p) { return D.factions[p.faction].shortName || p.faction; }).join(' · '), W / 2, 162);
    if (winner) g.drawImage(A.emblem(wf.emblem, wf.palette, 120), W / 2 - 60, 176);
    // map silhouette in final territory colours
    var tiles = f.map.tiles, mw = f.map.w, mh = f.map.h, cell = Math.min(34, (W * 0.56) / (mw + 0.5)), ox = 70, oy = 320;
    var own = new Array(tiles.length).fill(-1), best = new Array(tiles.length).fill(-1);
    f.settlements.forEach(function (s) { if (!s.shrine) return; var st = tiles[s.tile], rad = H.shrineRadius(f, s); tiles.forEach(function (t) { var d = Math.max(Math.abs(t.cx - st.cx), Math.abs(t.cy - st.cy), Math.abs(t.cz - st.cz)); if (d > rad) return; var w = 10 - d * 3; if (w > best[t.id]) { best[t.id] = w; own[t.id] = s.shrine.owner; } }); });
    var shown = Math.floor(tiles.length * Math.min(1, progress * 1.6));
    tiles.forEach(function (t, k) {
      if (k > shown) return;
      var tx = ox + (t.q + (t.r & 1) * 0.5) * cell, ty = oy + t.r * cell * 0.82, water = D.terrain[t.terrain].water;
      if (water) { g.fillStyle = 'rgba(80,120,150,0.35)'; g.fillRect(tx, ty, cell - 1, cell * 0.82 - 1); return; }
      var col = own[t.id] >= 0 ? D.factions[f.players[own[t.id]].faction].palette.secondary : A.mix(D.terrain[t.terrain].top, '#c8b890', 0.4);
      g.fillStyle = col; g.fillRect(tx, ty, cell - 1, cell * 0.82 - 1);
      if (own[t.id] >= 0) { g.globalAlpha = 0.35; g.fillStyle = g.createPattern(A.pattern(D.factions[f.players[own[t.id]].faction].pattern, '#ffffff', 1), 'repeat'); g.fillRect(tx, ty, cell - 1, cell * 0.82 - 1); g.globalAlpha = 1; }
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(tx, ty + cell * 0.82 - 3, cell - 1, 2); // woven stitch
    });
    // key settlements: the five largest at the end
    g.font = '600 14px Georgia, serif'; g.textAlign = 'left';
    f.settlements.slice().sort(function (a, b) { return b.pop - a.pop || a.id - b.id; }).slice(0, 5).forEach(function (s) {
      var t = tiles[s.tile], tx = ox + (t.q + (t.r & 1) * 0.5) * cell + cell / 2, ty = oy + t.r * cell * 0.82 + cell * 0.4;
      g.fillStyle = '#f2ead6'; g.beginPath(); g.arc(tx, ty, 5, 0, 7); g.fill(); g.strokeStyle = '#2a2418'; g.stroke();
      g.fillStyle = 'rgba(20,16,10,0.75)'; var tw = g.measureText(s.name).width; g.fillRect(tx + 8, ty - 9, tw + 8, 18); g.fillStyle = '#f2ead6'; g.fillText(s.name, tx + 12, ty + 5);
    });
    // era band: Dawn | Zenith | Twilight with the score lines woven across
    var bx0 = 70, by0 = Hh - 200, bw = W * 0.56, bh = 90, ages = E.rules.ages, maxT = f.maxTurns;
    ages.forEach(function (a, k) { var a0 = (a.from - 1) / maxT, a1 = ((ages[k + 1] ? ages[k + 1].from : maxT + 1) - 1) / maxT; g.fillStyle = ['rgba(240,184,128,0.28)', 'rgba(200,220,240,0.22)', 'rgba(200,106,74,0.3)'][k]; g.fillRect(bx0 + bw * a0, by0, bw * (a1 - a0), bh); g.fillStyle = '#e6dcc2'; g.font = 'italic 14px Georgia, serif'; g.fillText(a.name, bx0 + bw * a0 + 6, by0 + 16); });
    var sc = book.scores, mx = 1; sc.forEach(function (row) { row.forEach(function (v) { mx = Math.max(mx, v); }); });
    f.players.forEach(function (p, pi) {
      g.strokeStyle = D.factions[p.faction].palette.secondary; g.lineWidth = 3; g.setLineDash(pi === 0 ? [] : pi === 1 ? [8, 4] : [2, 4]); g.beginPath();
      sc.forEach(function (row, k) { var xx = bx0 + bw * (k / Math.max(1, sc.length - 1)) * Math.min(1, progress * 1.3), yy = by0 + bh - 8 - (row[pi] / mx) * (bh - 24); if (k) g.lineTo(xx, yy); else g.moveTo(xx, yy); });
      g.stroke(); g.setLineDash([]);
    });
    // decisive events, 3–7 woven medallions down the right side, each linked to its turn on the era band
    var ev = decisiveEvents(book, 7), colX = W * 0.66, rowH = Math.min(96, (Hh - 360) / Math.max(1, ev.length));
    g.textAlign = 'left';
    ev.forEach(function (l, k) {
      if (k / ev.length > progress * 1.2) return;
      var yy = 250 + k * rowH, who = l.p >= 0 ? D.factions[f.players[l.p].faction] : null, c2 = who ? who.palette.accent : '#e6dcc2';
      g.fillStyle = 'rgba(20,16,10,0.6)'; g.fillRect(colX, yy, W - colX - 40, rowH - 10); g.strokeStyle = c2; g.strokeRect(colX + 0.5, yy + 0.5, W - colX - 41, rowH - 11);
      if (who) g.drawImage(A.emblem(who.emblem, who.palette, 40), colX + 8, yy + (rowH - 10) / 2 - 20);
      g.fillStyle = '#f3d98e'; g.font = '600 16px Georgia, serif'; g.fillText('Turn ' + l.t + ' · ' + ({ topple: 'A shrine falls', control: 'A town changes hands', covenantKept: 'A promise kept', covenantBroken: 'A promise broken', breach: 'A truce betrayed', age: 'A new age', victory: 'The judgment', eliminated: 'A god forgotten', landmark: 'A holy place claimed', festival: 'A shared festival', counter: 'A rite answered', shrine: 'A shrine raised', specialize: 'A shrine consecrated', route: 'A road opened', start: 'The world wakes', power: 'A miracle' }[l.k] || l.k), colX + 56, yy + 22);
      g.fillStyle = '#e6dcc2'; g.font = '14px Georgia, serif'; wrap(g, l.m, colX + 56, yy + 42, W - colX - 110, 17, 2);
      var tx = bx0 + bw * ((l.t - 1) / maxT); g.strokeStyle = A.rgba(c2, 0.6); g.beginPath(); g.moveTo(tx, by0); g.lineTo(tx, by0 - 6); g.stroke(); A.disc(g, tx, by0 - 9, 3, c2);
    });
    g.textAlign = 'center'; g.font = '13px Georgia, serif'; g.fillStyle = 'rgba(230,220,194,0.8)';
    g.fillText('Woven from the verified Chronicle (final state hash ' + E.hash(f) + '). Pantheon Wars ' + E.version + '.', W / 2, Hh - 82);
    return { events: ev };
  }
  function wrap(g, text, x, y, w, lh, maxLines) {
    var words = String(text).split(' '), line = '', n = 0;
    for (var i = 0; i < words.length; i++) { var t = line ? line + ' ' + words[i] : words[i]; if (g.measureText(t).width > w && line) { g.fillText(line, x, y + n * lh); n++; line = words[i]; if (n >= maxLines) return; } else line = t; }
    if (line && n < maxLines) g.fillText(n === maxLines - 1 && i < words.length ? line + '…' : line, x, y + n * lh);
  }

  return { reconstruct: reconstruct, decisiveEvents: decisiveEvents, summary: summary, renderTapestry: renderTapestry, eventWeight: eventWeight };
});
