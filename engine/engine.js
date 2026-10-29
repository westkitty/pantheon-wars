/*
 * Pantheon Wars v0.1 — deterministic rules engine.
 * No DOM, no globals besides the UMD export. Runs identically in Node and the browser.
 * All randomness flows through state.rng (mulberry32), so (seed, players, actions) => identical game.
 * API:  var E = PWEngine.create(data);  var s = E.newGame(cfg);  s = E.step(s, action)   (pure, clones)
 *       E.apply(s, action) mutates in place (used by the simulator for speed). Both validate first.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rng.js'));
  else root.PWEngine = factory(root.PWRng);
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';

  var VERSION = '0.1.0';
  var NB_EVEN = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
  var NB_ODD = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];

  function clone(o) { return typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)); }
  function r2(x) { return Math.round(x * 100) / 100; }
  function cube(q, r) { var x = q - (r - (r & 1)) / 2; return [x, -x - r, r]; }
  function hexDist(a, b) { return Math.max(Math.abs(a.cx - b.cx), Math.abs(a.cy - b.cy), Math.abs(a.cz - b.cz)); }
  function fnv(str) { var h = 2166136261 >>> 0; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return ('00000000' + h.toString(16)).slice(-8); }

  function create(data) {
    var D = indexData(data);
    var rules = data.rules;

    /* ------------------------------------------------------------ map generation */
    function noiseField(rng, cells) {
      var g = []; for (var i = 0; i < (cells + 2) * (cells + 2); i++) g.push(R.next(rng));
      return function (x, y) { // x,y in [0,1]
        var fx = x * cells, fy = y * cells, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
        tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
        var w = cells + 2, a = g[iy * w + ix], b = g[iy * w + ix + 1], c = g[(iy + 1) * w + ix], d = g[(iy + 1) * w + ix + 1];
        return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
      };
    }
    function quantile(sorted, q) { return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]; }

    function genMap(seed, nPlayers) {
      var M = rules.map, W = M.width, H = M.height;
      for (var attempt = 0; attempt < 40; attempt++) {
        var rng = R.make(seed + ':map:' + attempt);
        var n1 = noiseField(rng, 3), n2 = noiseField(rng, 6), n3 = noiseField(rng, 11), nm = noiseField(rng, 4), nt = noiseField(rng, 5), nd = noiseField(rng, 9);
        var tiles = [], elev = [], q, r;
        for (r = 0; r < H; r++) for (q = 0; q < W; q++) {
          var x = (q + 0.5 * (r & 1) + 0.5) / (W + 0.5), y = (r + 0.5) / H;
          var e = 0.55 * n1(x, y) + 0.3 * n2(x, y) + 0.15 * n3(x, y);
          var dx = (x - 0.5) * 2, dy = (y - 0.5) * 2, d = Math.sqrt(dx * dx * 0.85 + dy * dy);
          e = e - d * d * 0.6;
          if (q === 0 || r === 0 || q === W - 1 || r === H - 1) e -= 1;
          var c = cube(q, r);
          tiles.push({ id: r * W + q, q: q, r: r, cx: c[0], cy: c[1], cz: c[2], e: 0, m: nm(x, y), t: 0.85 * y + 0.3 * (nt(x, y) - 0.5), detail: nd(x, y) });
          elev.push(e);
        }
        var sorted = elev.slice().sort(function (a, b) { return a - b; });
        var qDeep = quantile(sorted, M.deepLevel), qSea = quantile(sorted, M.seaLevel), qHill = quantile(sorted, M.hillLevel), qMtn = quantile(sorted, M.mountainLevel);
        var lo = sorted[0], hi = sorted[sorted.length - 1];
        var ms = tiles.map(function (t) { return t.m; }).sort(function (a, b) { return a - b; });
        tiles.forEach(function (t) { var lo2 = 0, hi2 = ms.length; while (lo2 < hi2) { var mid = (lo2 + hi2) >> 1; if (ms[mid] < t.m) lo2 = mid + 1; else hi2 = mid; } t.m = lo2 / ms.length; });
        tiles.forEach(function (t, i) {
          var e = elev[i]; t.e = r2((e - lo) / (hi - lo));
          var ter;
          if (e < qDeep) ter = 'deep'; else if (e < qSea) ter = 'sea';
          else if (e >= qMtn) ter = 'mountains'; else if (e >= qHill) ter = 'hills';
          else if (t.t < 0.2) ter = 'tundra';
          else if (t.t > 0.66 && t.m < 0.5) ter = 'desert';
          else if (t.m > 0.7) ter = 'forest';
          else if (t.m > 0.38) ter = 'grassland'; else ter = 'plains';
          t.terrain = ter; t.m = r2(t.m); t.t = r2(t.t); t.detail = r2(t.detail);
        });
        tiles.forEach(function (t) {
          var nb = (t.r & 1) ? NB_ODD : NB_EVEN; t.n = [];
          nb.forEach(function (o) { var qq = t.q + o[0], rr = t.r + o[1]; if (qq >= 0 && rr >= 0 && qq < W && rr < H) t.n.push(rr * W + qq); else t.n.push(-1); });
          t.coast = !D.terrain[t.terrain].water && t.n.some(function (k) { return k >= 0 && D.terrain[tiles[k].terrain].water; });
        });
        // largest walkable component
        var comp = new Array(tiles.length).fill(-1), best = -1, bestSize = 0, cid = 0;
        tiles.forEach(function (t) {
          if (comp[t.id] >= 0 || !D.terrain[t.terrain].passable) return;
          var stack = [t.id], size = 0; comp[t.id] = cid;
          while (stack.length) { var k = stack.pop(); size++; tiles[k].n.forEach(function (j) { if (j >= 0 && comp[j] < 0 && D.terrain[tiles[j].terrain].passable) { comp[j] = cid; stack.push(j); } }); }
          if (size > bestSize) { bestSize = size; best = cid; } cid++;
        });
        if (bestSize < tiles.length * 0.4) continue;
        var cands = tiles.filter(function (t) { return comp[t.id] === best && D.terrain[t.terrain].settle > 0; })
          .map(function (t) { return { t: t, s: D.terrain[t.terrain].settle * (0.6 + 0.8 * R.next(rng)) + (t.coast ? 0.15 : 0) }; })
          .sort(function (a, b) { return b.s - a.s || a.t.id - b.t.id; });
        var chosen = [];
        cands.forEach(function (c) { if (chosen.length >= M.settlements) return; if (chosen.every(function (o) { return hexDist(o, c.t) >= M.minSpacing; })) chosen.push(c.t); });
        if (chosen.length < M.settlements - 2) continue;
        // home selection: maximise minimum pairwise distance, then balance local settlement density
        var homes = pickHomes(chosen, nPlayers);
        if (!homes) continue;
        R.shuffle(rng, homes); // seat order must not inherit site-quality ordering
        var used = {}, names = data.terrain.settlementNames;
        var settlements = chosen.map(function (t, i) {
          var nm; do { nm = R.pick(rng, names.prefix) + R.pick(rng, names.suffix); } while (used[nm]); used[nm] = 1;
          var fert = D.terrain[t.terrain].fertility;
          t.settlement = i;
          return { id: i, tile: t.id, name: nm, pop: 3 + Math.floor(fert * 4 + R.next(rng) * 3), followers: [], progress: [], shrine: null, controlledBy: -1 };
        });
        tiles.forEach(function (t) { if (t.settlement === undefined) t.settlement = -1; });
        return { w: W, h: H, tiles: tiles, settlements: settlements, homes: homes.map(function (t) { return t.settlement; }), attempt: attempt };
      }
      throw new Error('map generation failed for seed ' + seed);
    }

    function pickHomes(chosen, n) {
      var bestSet = null, bestScore = -1e9;
      function density(t) { return chosen.filter(function (o) { return o !== t && hexDist(o, t) <= 5; }).length; }
      var dens = chosen.map(density);
      function rec(start, set) {
        if (set.length === n) {
          var md = 1e9, ds = [];
          for (var i = 0; i < set.length; i++) { ds.push(dens[set[i]]); for (var j = i + 1; j < set.length; j++) md = Math.min(md, hexDist(chosen[set[i]], chosen[set[j]])); }
          var spread = Math.max.apply(null, ds) - Math.min.apply(null, ds);
          var sc = Math.min(md, 12) * 10 - spread * 4 + (ds.every(function (d) { return d >= 2; }) ? 5 : 0);
          if (sc > bestScore) { bestScore = sc; bestSet = set.slice(); }
          return;
        }
        for (var k = start; k < chosen.length; k++) { set.push(k); rec(k + 1, set); set.pop(); }
      }
      rec(0, []);
      return bestSet ? bestSet.map(function (k) { return chosen[k]; }) : null;
    }

    /* ------------------------------------------------------------ game creation */
    function modsFor(factionId) {
      var m = { terrainFaith: [], waterFaith: 0, favorEvery: null, shrineWard: 0, seafaring: false, coastalPressure: 0, favorOnRivalConvert: null,
        eclipseDiscount: 0, controlledGrowth: null, favorOnEvent: 0, conversionResist: 1, omenCostMult: 1, omenRadius: 0 };
      D.factions[factionId].domains.forEach(function (did) {
        var ef = D.domains[did].effect;
        switch (ef.type) {
          case 'terrainFaith': m.terrainFaith.push({ terrains: ef.terrains, per: ef.perFollower }); break;
          case 'waterFaith': m.waterFaith += ef.perFollower; break;
          case 'favorEveryNTurns': m.favorEvery = { n: ef.n, amount: ef.amount }; break;
          case 'shrineWard': m.shrineWard += ef.amount; break;
          case 'seafaring': m.seafaring = true; m.coastalPressure += ef.coastalPressure; break;
          case 'favorOnRivalConvert': m.favorOnRivalConvert = { per: ef.per, amount: ef.amount }; break;
          case 'eclipseDiscount': m.eclipseDiscount += ef.amount; break;
          case 'controlledGrowth': m.controlledGrowth = { n: ef.n, amount: ef.amount }; break;
          case 'favorOnEvent': m.favorOnEvent += ef.amount; break;
          case 'conversionResist': m.conversionResist *= ef.mult; break;
          case 'omenMastery': m.omenCostMult *= ef.costMult; m.omenRadius += ef.radius; break;
          default: throw new Error('unknown domain effect ' + ef.type);
        }
      });
      return m;
    }

    function newGame(cfg) {
      var seed = cfg.seed === undefined ? 1 : cfg.seed;
      var pcfg = cfg.players;
      if (!pcfg || pcfg.length < 2 || pcfg.length > 3) throw new Error('2-3 players required');
      var map = genMap(seed, pcfg.length);
      var S = rules.start;
      var state = {
        version: VERSION, seed: seed, turn: 1, maxTurns: rules.turns, current: 0, over: false, winner: null,
        rng: R.make(seed + ':game'), nextPriest: 1, log: [], actions: [],
        map: { w: map.w, h: map.h, tiles: map.tiles }, settlements: map.settlements, priests: [], players: []
      };
      pcfg.forEach(function (pc, i) {
        if (!D.factions[pc.faction]) throw new Error('unknown faction ' + pc.faction);
        var f = D.factions[pc.faction];
        var p = { id: i, faction: pc.faction, name: pc.name || f.name, human: !!pc.human, ai: pc.ai || 'hard',
          faith: S.faith + (S.seatFaithBonus || 0) * i, favor: S.favor, revealed: new Array(map.tiles.length).fill(0), cooldowns: {}, buffs: [],
          flags: { omenUsed: false, shrineDiscount: 1 }, eliminated: false, pendingEvent: null, eventsSeen: [], rivalConverted: 0,
          mods: modsFor(pc.faction), home: map.homes[i],
          stats: { actions: {}, powers: {}, converted: 0, convertedFromRivals: 0, shrinesBuilt: 0, eclipses: 0, faithEarned: 0, peakShare: 0, priestsSent: 0, toppled: 0 } };
        state.players.push(p);
      });
      state.settlements.forEach(function (s) { s.followers = pcfg.map(function () { return 0; }); s.progress = pcfg.map(function () { return 0; }); });
      state.players.forEach(function (p) {
        var s = state.settlements[p.home];
        s.pop = Math.max(s.pop, S.homePop);
        s.followers[p.id] = S.homeFollowers;
        placeShrine(state, p.id, s, true);
        for (var k = 0; k < S.priests; k++) spawnPriest(state, p.id, s.tile);
        revealAround(state, p.id, s.tile, S.revealRadius);
      });
      updateControl(state, true);
      log(state, -1, 'start', 'The mortal world wakes. ' + state.players.map(function (p) { return p.name; }).join(', ') + ' turn their gaze upon it.');
      beginPlayerTurn(state);
      return state;
    }

    /* ------------------------------------------------------------ helpers */
    function tileOf(state, id) { return state.map.tiles[id]; }
    function dist(state, a, b) { return hexDist(state.map.tiles[a], state.map.tiles[b]); }
    function log(state, p, k, m, x) { state.log.push({ t: state.turn, p: p, k: k, m: m, x: x || null }); }
    function shrineDef(state, pid) { return D.shrines[D.factions[state.players[pid].faction].shrine]; }
    function hasBuff(p, stat) { return p.buffs.some(function (b) { return b.stat === stat; }); }
    function buffMult(p, stat) { var v = 1; p.buffs.forEach(function (b) { if (b.stat === stat) v *= b.value; }); return v; }
    function buffSum(p, stat) { var v = 0; p.buffs.forEach(function (b) { if (b.stat === stat) v += b.value; }); return v; }
    function inRadius(state, center, rad) { var c = state.map.tiles[center]; return state.map.tiles.filter(function (t) { return hexDist(t, c) <= rad; }).map(function (t) { return t.id; }); }
    function revealAround(state, pid, center, rad) {
      var p = state.players[pid], newly = 0, newSett = [];
      inRadius(state, center, rad).forEach(function (id) { if (!p.revealed[id]) { p.revealed[id] = 1; newly++; var t = state.map.tiles[id]; if (t.settlement >= 0) newSett.push(t.settlement); } });
      return { tiles: newly, settlements: newSett };
    }
    function playerShrines(state, pid) { return state.settlements.filter(function (s) { return s.shrine && s.shrine.owner === pid; }); }
    function playerPriests(state, pid) { return state.priests.filter(function (pr) { return pr.owner === pid; }); }
    function followersOf(state, pid) { var n = 0; state.settlements.forEach(function (s) { n += s.followers[pid]; }); return n; }
    function totalPop(state) { var n = 0; state.settlements.forEach(function (s) { n += s.pop; }); return n; }
    function unaffiliated(s) { var n = s.pop; s.followers.forEach(function (f) { n -= f; }); return n; }
    function controlledCount(state, pid) { return state.settlements.filter(function (s) { return s.controlledBy === pid; }).length; }
    function priestCap(state, pid) { return rules.economy.maxPriestsBase + rules.economy.maxPriestsPerShrine * playerShrines(state, pid).length; }
    function shrineCost(state, pid) { var p = state.players[pid]; return Math.round((rules.actions.shrine.faith + rules.actions.shrine.faithStep * playerShrines(state, pid).length) * p.flags.shrineDiscount); }
    function omenCost(state, pid) { return Math.round(rules.actions.omen.faith * state.players[pid].mods.omenCostMult); }
    function eclipseCost(state, pid) { return Math.max(1, rules.actions.eclipse.favor - state.players[pid].mods.eclipseDiscount); }
    function inTerritory(state, pid, tileId, extra) {
      extra = extra || 0;
      var rad = shrineDef(state, pid).radius + extra;
      return playerShrines(state, pid).some(function (s) { return dist(state, s.tile, tileId) <= rad; });
    }
    function nearOwnPresence(state, pid, tileId, range) {
      if (playerShrines(state, pid).some(function (s) { return dist(state, s.tile, tileId) <= range; })) return true;
      return playerPriests(state, pid).some(function (pr) { return dist(state, pr.tile, tileId) <= range; });
    }
    function passableFor(state, pid, tileId) {
      var t = state.map.tiles[tileId], T = D.terrain[t.terrain];
      if (T.passable) return true;
      return t.terrain === 'sea' && state.players[pid].mods.seafaring;
    }
    function pathStep(state, pid, from, to, steps) {
      if (from === to) return [from];
      var prev = {}; prev[from] = -1; var queue = [from], head = 0, found = false;
      while (head < queue.length) {
        var k = queue[head++]; if (k === to) { found = true; break; }
        var nb = state.map.tiles[k].n;
        for (var i = 0; i < nb.length; i++) { var j = nb[i]; if (j >= 0 && prev[j] === undefined && passableFor(state, pid, j)) { prev[j] = k; queue.push(j); } }
      }
      if (!found) return null;
      var path = [], c = to; while (c !== -1) { path.push(c); c = prev[c]; } path.reverse();
      return steps === undefined ? path : path.slice(0, steps + 1);
    }
    function placeShrine(state, pid, s, initial) {
      var def = shrineDef(state, pid);
      s.shrine = { owner: pid, type: def.id, ward: def.ward + state.players[pid].mods.shrineWard, eclipsed: 0, built: state.turn };
      revealAround(state, pid, s.tile, def.sight);
      if (!initial) state.players[pid].stats.shrinesBuilt++;
    }
    function spawnPriest(state, pid, tileId) {
      var pr = { id: state.nextPriest++, owner: pid, tile: tileId, dest: null, from: tileId };
      state.priests.push(pr); return pr;
    }
    function pressureAt(state, s, pid) {
      var p = state.players[pid]; if (p.eliminated) return 0;
      var P = 0, fall = rules.conversion.falloff;
      state.settlements.forEach(function (o) {
        if (!o.shrine || o.shrine.owner !== pid || o.shrine.eclipsed > 0) return;
        var def = D.shrines[o.shrine.type], d = dist(state, o.tile, s.tile);
        if (d <= def.radius && d < fall.length) P += fall[d] * def.pressure;
      });
      var pm = rules.actions.priest.power * buffMult(p, 'priestMult');
      state.priests.forEach(function (pr) { if (pr.owner === pid && pr.tile === s.tile) P += pm; });
      if (P > 0 && s.controlledBy === pid) P += rules.conversion.controlMomentum;
      if (P > 0 && p.mods.coastalPressure && state.map.tiles[s.tile].coast) P *= 1 + p.mods.coastalPressure;
      return r2(P * buffMult(p, 'pressureMult'));
    }
    function updateControl(state, silent) {
      state.settlements.forEach(function (s) {
        var best = -1, bf = 0;
        s.followers.forEach(function (f, pid) { if (f > bf) { bf = f; best = pid; } });
        var ctrl = (best >= 0 && bf * 2 >= s.pop) ? best : -1;
        if (ctrl !== s.controlledBy) {
          var prev = s.controlledBy; s.controlledBy = ctrl;
          if (ctrl >= 0 && !silent) {
            var p = state.players[ctrl];
            p.favor = Math.min(rules.economy.favorCap, p.favor + rules.economy.favorOnControl);
            log(state, ctrl, 'control', s.name + ' now kneels to ' + p.name + (prev >= 0 ? ', torn from ' + state.players[prev].name : '') + '.', { tile: s.tile, settlement: s.id });
          }
        }
      });
    }
    function incomeOf(state, pid) {
      var p = state.players[pid], inc = 0, ec = rules.economy;
      state.settlements.forEach(function (s) {
        var f = s.followers[pid]; if (!f) return;
        var per = ec.faithPerFollower, t = state.map.tiles[s.tile];
        p.mods.terrainFaith.forEach(function (tf) { if (tf.terrains.indexOf(t.terrain) >= 0) per += tf.per; });
        if (p.mods.waterFaith && t.coast) per += p.mods.waterFaith;
        inc += f * per;
      });
      playerShrines(state, pid).forEach(function (s) { if (!s.shrine.eclipsed) inc += D.shrines[s.shrine.type].faith; });
      inc += buffSum(p, 'faithPerControlled') * controlledCount(state, pid);
      return r2(inc * buffMult(p, 'faithMult'));
    }
    function scoreOf(state, pid) {
      var w = rules.victory.score, p = state.players[pid];
      return r2(followersOf(state, pid) * w.followers + playerShrines(state, pid).length * w.shrines + controlledCount(state, pid) * w.settlements + p.favor * w.favor);
    }
    function hiddenSettlements(state, pid) { var p = state.players[pid]; return state.settlements.filter(function (s) { return !p.revealed[s.tile]; }); }
    function presenceTiles(state, pid) {
      var out = []; state.settlements.forEach(function (s) { if (s.followers[pid] > 0 || (s.shrine && s.shrine.owner === pid)) out.push(s.tile); });
      state.priests.forEach(function (pr) { if (pr.owner === pid) out.push(pr.tile); });
      return out;
    }
    function nearestHidden(state, pid, count) {
      var pres = presenceTiles(state, pid); if (!pres.length) pres = [state.settlements[state.players[pid].home].tile];
      return hiddenSettlements(state, pid).map(function (s) {
        var d = 1e9; pres.forEach(function (t) { d = Math.min(d, dist(state, t, s.tile)); }); return { s: s, d: d };
      }).sort(function (a, b) { return a.d - b.d || a.s.id - b.s.id; }).slice(0, count).map(function (o) { return o.s; });
    }

    /* ------------------------------------------------------------ validation */
    function settlementAt(state, tileId) { var t = state.map.tiles[tileId]; return t && t.settlement >= 0 ? state.settlements[t.settlement] : null; }
    function targetError(state, pid, kind, tile, range) {
      var p = state.players[pid], t = state.map.tiles[tile];
      if (kind === 'none') return null;
      if (tile === undefined || tile === null || !t) return 'needs a target';
      var s = settlementAt(state, tile);
      switch (kind) {
        case 'anyTile': return null;
        case 'ownShrine': return s && s.shrine && s.shrine.owner === pid ? null : 'target one of your shrines';
        case 'revealedSettlement': return s && p.revealed[tile] ? null : 'target a revealed settlement';
        case 'ownSettlement': return s && s.followers[pid] > 0 ? null : 'target a settlement with your followers';
        case 'rivalShrine':
          if (!s || !s.shrine || s.shrine.owner === pid || !p.revealed[tile]) return 'target a revealed rival shrine';
          if (hasBuff(state.players[s.shrine.owner], 'eclipseImmune')) return 'that shrine is protected by prepared rites';
          return nearOwnPresence(state, pid, tile, range || rules.actions.eclipse.range) ? null : 'too far from your shrines and priests';
        case 'shrineSite':
          if (!s || s.shrine || !p.revealed[tile]) return 'target a revealed settlement without a shrine';
          return inTerritory(state, pid, tile, (range || 4) - shrineDef(state, pid).radius) ? null : 'too far from your land';
      }
      return 'bad target kind';
    }
    function validate(state, action) {
      if (state.over) return 'the game is over';
      var pid = state.current, p = state.players[pid], A = rules.actions, s, err;
      if (!action || !action.type) return 'no action';
      if (p.pendingEvent && action.type !== 'event') return 'resolve the event card first';
      switch (action.type) {
        case 'endTurn': return null;
        case 'event':
          if (!p.pendingEvent) return 'no event pending';
          return (action.choice === 0 || action.choice === 1) ? null : 'bad choice';
        case 'omen':
          if (p.flags.omenUsed) return 'omens already read this turn';
          if (p.faith < omenCost(state, pid)) return 'not enough Faith';
          if (!state.map.tiles[action.tile]) return 'needs a target';
          var near = inRadius(state, action.tile, A.omen.range).some(function (id) { return p.revealed[id]; });
          return near ? null : 'omens can only be read near the known world';
        case 'dream':
          if (p.cooldowns.dream > 0) return 'dream vision is recovering';
          if (p.favor < A.dream.favor) return 'not enough Favor';
          return hiddenSettlements(state, pid).length ? null : 'every settlement is already known';
        case 'shrine':
          s = settlementAt(state, action.tile);
          if (!s || !p.revealed[action.tile]) return 'target a revealed settlement';
          if (s.shrine) return 'a shrine already stands there';
          if (p.faith < shrineCost(state, pid)) return 'not enough Faith';
          var presence = s.followers[pid] > 0 || inTerritory(state, pid, action.tile) || state.priests.some(function (pr) { return pr.owner === pid && pr.tile === action.tile; });
          return presence ? null : 'you need followers, a priest or territory there';
        case 'priest':
          s = settlementAt(state, action.tile);
          if (!s || !s.shrine || s.shrine.owner !== pid) return 'priests are ordained at your own shrines';
          if (playerPriests(state, pid).length >= priestCap(state, pid)) return 'priest limit reached (raise more shrines)';
          return p.faith >= A.priest.faith ? null : 'not enough Faith';
        case 'movePriest':
          var pr = state.priests.find(function (x) { return x.id === action.priest; });
          if (!pr || pr.owner !== pid) return 'not your priest';
          if (!state.map.tiles[action.tile] || !passableFor(state, pid, action.tile)) return 'impassable';
          return pathStep(state, pid, pr.tile, action.tile) ? null : 'no path';
        case 'eclipse':
          if (p.cooldowns.eclipse > 0) return 'eclipse is recovering';
          if (p.favor < eclipseCost(state, pid)) return 'not enough Favor';
          return targetError(state, pid, 'rivalShrine', action.tile, A.eclipse.range);
        case 'power':
          var pw = D.powers[action.power];
          if (!pw || D.factions[p.faction].powers.indexOf(pw.id) < 0) return 'not your power';
          if (p.cooldowns[pw.id] > 0) return pw.name + ' is recovering';
          if (p.faith < pw.cost.faith || p.favor < pw.cost.favor) return 'cannot afford ' + pw.name;
          err = targetError(state, pid, pw.target, action.tile, pw.range); if (err) return err;
          if (pw.target === 'shrineSite' && p.faith < Math.round(shrineCost(state, pid) * 0.5) + pw.cost.faith) return 'not enough Faith for the hall';
          return null;
      }
      return 'unknown action ' + action.type;
    }

    /* ------------------------------------------------------------ effects */
    function addFollowers(state, pid, s, n) { var free = unaffiliated(s); var k = Math.min(n, free); s.followers[pid] += k; return k; }
    function runEffect(state, pid, ef, tile, src) {
      var p = state.players[pid], s = tile !== undefined && tile !== null ? settlementAt(state, tile) : null, res, k;
      switch (ef.type) {
        case 'reveal': res = revealAround(state, pid, tile, ef.radius); log(state, pid, 'reveal', src + ' unveils ' + res.tiles + ' hexes' + (res.settlements.length ? ' and ' + res.settlements.length + ' settlement(s)' : '') + '.', { tile: tile, radius: ef.radius }); break;
        case 'revealNearestSettlements':
          var found = nearestHidden(state, pid, ef.count);
          found.forEach(function (o) { revealAround(state, pid, o.tile, ef.radius); });
          log(state, pid, 'reveal', src + (found.length ? ' reveals ' + found.map(function (o) { return o.name; }).join(' and ') + '.' : ' finds nothing new.'), { tiles: found.map(function (o) { return o.tile; }), radius: ef.radius });
          break;
        case 'revealBand':
          var row = state.map.tiles[tile].r, half = Math.floor(ef.rows / 2), cnt = 0;
          state.map.tiles.forEach(function (t) { if (Math.abs(t.r - row) <= half && !p.revealed[t.id]) { p.revealed[t.id] = 1; cnt++; } });
          log(state, pid, 'reveal', src + ' crosses the sky and lights ' + cnt + ' hexes.', { tile: tile, band: [row - half, row + half] }); break;
        case 'ward': s.shrine.ward = Math.min(ef.max || 9, s.shrine.ward + ef.amount); break;
        case 'clearEclipse': s.shrine.eclipsed = 0; break;
        case 'spawnPriest':
          var at = s ? s.tile : state.settlements[p.home].tile; spawnPriest(state, pid, at); p.stats.priestsSent++;
          log(state, pid, 'priest', 'A priest rises at ' + (s ? s.name : 'home') + '.', { tile: at }); break;
        case 'buff': p.buffs.push({ stat: ef.stat, value: ef.value, turns: ef.turns, src: src }); break;
        case 'popControlled':
          k = 0; state.settlements.forEach(function (o) { if (o.controlledBy === pid && o.pop < rules.growth.maxPop) { o.pop += ef.amount; k++; } });
          log(state, pid, 'growth', src + ': ' + k + ' of your settlements grow.', null); break;
        case 'popTarget': s.pop = Math.min(rules.growth.maxPop + 4, s.pop + ef.amount); addFollowers(state, pid, s, ef.amount); log(state, pid, 'growth', src + ' brings new life to ' + s.name + '.', { tile: s.tile }); break;
        case 'popLargest': k = largestOwn(state, pid); if (k) { k.pop = Math.min(rules.growth.maxPop + 4, k.pop + ef.amount); } break;
        case 'faith': p.faith = r2(Math.max(0, p.faith + ef.amount)); break;
        case 'favor': p.favor = Math.max(0, Math.min(rules.economy.favorCap, p.favor + ef.amount)); break;
        case 'strike':
          var killed = 0, lost = 0;
          if (ef.killPriests) state.priests = state.priests.filter(function (pr) { if (pr.tile === s.tile && pr.owner !== pid) { killed++; return false; } return true; });
          for (k = 0; k < ef.rivalLoss; k++) { var rv = topRival(s, pid); if (rv < 0) break; s.followers[rv]--; lost++; }
          var g = addFollowers(state, pid, s, ef.gain);
          log(state, pid, 'miracle', src + ' strikes ' + s.name + ': ' + lost + ' rival followers fall silent' + (killed ? ', ' + killed + ' priest(s) scattered' : '') + (g ? ', 1 mortal turns to you' : '') + '.', { tile: s.tile, fx: 'bolt' });
          break;
        case 'weigh':
          var moved = 0;
          s.followers.forEach(function (f, rid) { if (rid === pid || !f) return; var m = Math.ceil(f * ef.fraction); s.followers[rid] -= m; s.followers[pid] += m; moved += m; });
          if (moved) p.stats.convertedFromRivals += moved;
          log(state, pid, 'miracle', src + ' weighs the hearts of ' + s.name + ': ' + moved + ' turn to you.', { tile: s.tile, fx: 'feather' }); break;
        case 'shrineHit': hitShrine(state, pid, s, ef.ward, ef.eclipse, src); break;
        case 'raiseShrine':
          p.faith = r2(p.faith - Math.round(shrineCost(state, pid) * ef.costMult)); placeShrine(state, pid, s);
          log(state, pid, 'shrine', src + ': a ' + shrineDef(state, pid).name + ' rises at ' + s.name + '.', { tile: s.tile }); break;
        case 'followersLargest': k = largestOwn(state, pid); if (k) { if (unaffiliated(k) < ef.amount) k.pop = Math.min(rules.growth.maxPop + 4, k.pop + (ef.amount - unaffiliated(k))); addFollowers(state, pid, k, ef.amount); } break;
        case 'loseFollowersLargest': k = largestOwn(state, pid); if (k) k.followers[pid] = Math.max(0, k.followers[pid] - ef.amount); break;
        case 'freePriest': var hs = playerShrines(state, pid)[0]; if (hs) { spawnPriest(state, pid, hs.tile); p.stats.priestsSent++; } break;
        case 'shrineDiscount': p.flags.shrineDiscount = ef.mult; break;
        case 'wardAll': playerShrines(state, pid).forEach(function (o) { o.shrine.ward = Math.min(5, o.shrine.ward + ef.amount); }); break;
        case 'wardRandom': var list = playerShrines(state, pid); if (list.length) { var o = R.pick(state.rng, list); o.shrine.ward = Math.min(5, o.shrine.ward + ef.amount); } break;
        default: throw new Error('unknown effect ' + ef.type);
      }
    }
    function largestOwn(state, pid) {
      var best = null; state.settlements.forEach(function (s) { if (s.followers[pid] > 0 && (!best || s.followers[pid] > best.followers[pid])) best = s; });
      return best || state.settlements[state.players[pid].home];
    }
    function topRival(s, pid) { var best = -1, bf = 0; s.followers.forEach(function (f, r) { if (r !== pid && f > bf) { bf = f; best = r; } }); return best; }
    function hitShrine(state, pid, s, ward, ecl, src) {
      var owner = s.shrine.owner;
      s.shrine.ward -= ward; s.shrine.eclipsed = Math.max(s.shrine.eclipsed, ecl);
      state.players[pid].stats.eclipses++;
      if (s.shrine.ward <= 0) {
        log(state, pid, 'topple', src + ' topples the ' + D.shrines[s.shrine.type].name + ' of ' + state.players[owner].name + ' at ' + s.name + '.', { tile: s.tile, fx: 'topple', owner: owner });
        s.shrine = null; state.players[pid].stats.toppled++;
        // priests above the new cap are not removed; they simply cannot be replaced
      } else {
        log(state, pid, 'eclipse', src + ' darkens the shrine of ' + state.players[owner].name + ' at ' + s.name + ' (Ward ' + s.shrine.ward + ').', { tile: s.tile, fx: 'eclipse', owner: owner });
      }
    }

    /* ------------------------------------------------------------ apply */
    function apply(state, action) {
      var err = validate(state, action);
      if (err) return err;
      var pid = state.current, p = state.players[pid], A = rules.actions, s, pw;
      state.actions.push({ p: pid, a: action });
      p.stats.actions[action.type] = (p.stats.actions[action.type] || 0) + 1;
      switch (action.type) {
        case 'event':
          var ev = D.events[p.pendingEvent.id], ch = ev.choices[action.choice];
          p.pendingEvent = null;
          ch.effects.forEach(function (ef) { runEffect(state, pid, ef, null, ev.title); });
          if (p.mods.favorOnEvent) p.favor = Math.min(rules.economy.favorCap, p.favor + p.mods.favorOnEvent);
          log(state, pid, 'event', ev.title + ': ' + ch.label + '.', { event: ev.id, choice: action.choice });
          break;
        case 'omen':
          p.faith = r2(p.faith - omenCost(state, pid)); p.flags.omenUsed = true;
          runEffect(state, pid, { type: 'reveal', radius: A.omen.radius + p.mods.omenRadius }, action.tile, 'Read Omens');
          break;
        case 'dream':
          p.favor -= A.dream.favor; p.cooldowns.dream = A.dream.cooldown;
          runEffect(state, pid, { type: 'revealNearestSettlements', count: 1, radius: A.dream.radius + 1 }, null, 'A dream vision');
          break;
        case 'shrine':
          s = settlementAt(state, action.tile); p.faith = r2(p.faith - shrineCost(state, pid)); p.flags.shrineDiscount = 1;
          placeShrine(state, pid, s);
          log(state, pid, 'shrine', p.name + ' raises a ' + shrineDef(state, pid).name + ' at ' + s.name + '.', { tile: s.tile });
          break;
        case 'priest':
          s = settlementAt(state, action.tile); p.faith = r2(p.faith - A.priest.faith);
          var npr = spawnPriest(state, pid, s.tile); p.stats.priestsSent++;
          if (action.dest !== undefined && action.dest !== null && passableFor(state, pid, action.dest)) npr.dest = action.dest;
          log(state, pid, 'priest', 'A priest is ordained at ' + s.name + '.', { tile: s.tile, priest: npr.id });
          break;
        case 'movePriest':
          state.priests.find(function (x) { return x.id === action.priest; }).dest = action.tile;
          break;
        case 'eclipse':
          s = settlementAt(state, action.tile); p.favor -= eclipseCost(state, pid); p.cooldowns.eclipse = A.eclipse.cooldown;
          hitShrine(state, pid, s, A.eclipse.wardDamage, A.eclipse.duration, 'An eclipse');
          break;
        case 'power':
          pw = D.powers[action.power];
          p.faith = r2(p.faith - pw.cost.faith); p.favor -= pw.cost.favor; p.cooldowns[pw.id] = pw.cooldown;
          p.stats.powers[pw.id] = (p.stats.powers[pw.id] || 0) + 1;
          log(state, pid, 'power', p.name + ' invokes ' + pw.name + '.', { power: pw.id, tile: action.tile === undefined ? null : action.tile, fx: pw.icon });
          pw.effects.forEach(function (ef) { runEffect(state, pid, ef, action.tile, pw.name); });
          break;
        case 'endTurn':
          endTurn(state);
          break;
      }
      if (action.type !== 'endTurn') updateControl(state, false);
      return null;
    }
    function step(state, action) { var n = clone(state); var err = apply(n, action); if (err) throw new Error(err); return n; }

    function endTurn(state) {
      var n = state.players.length, i = state.current;
      do { i++; } while (i < n && state.players[i].eliminated);
      if (i >= n) { resolveRound(state); if (state.over) return; i = 0; while (state.players[i].eliminated) i++; }
      state.current = i;
      beginPlayerTurn(state);
    }
    function beginPlayerTurn(state) {
      var p = state.players[state.current], E = rules.events;
      if (state.turn >= E.firstTurn && (state.turn - E.firstTurn) % E.everyTurns === 0 && !p.pendingEvent) {
        var pool = data.events.filter(function (e) { return p.eventsSeen.indexOf(e.id) < 0; });
        if (!pool.length) { p.eventsSeen = []; pool = data.events.slice(); }
        var ev = R.weighted(state.rng, pool, function (e) { return e.weight; });
        p.pendingEvent = { id: ev.id }; p.eventsSeen.push(ev.id);
        log(state, p.id, 'card', p.name + ' draws an event: ' + ev.title + '.', { event: ev.id });
      }
    }

    function resolveRound(state) {
      var C = rules.conversion, np = state.players.length;
      // 1. priests walk
      state.priests.forEach(function (pr) {
        pr.from = pr.tile;
        if (pr.dest === null || pr.dest === pr.tile) return;
        var path = pathStep(state, pr.owner, pr.tile, pr.dest, rules.actions.priest.move);
        if (!path) { pr.dest = null; return; }
        path.forEach(function (t) { revealAround(state, pr.owner, t, 1); });
        pr.tile = path[path.length - 1];
      });
      // 2. conversion
      var offset = state.turn % np;
      state.settlements.forEach(function (s) {
        var P = state.players.map(function (p) { return pressureAt(state, s, p.id); });
        for (var k = 0; k < np; k++) {
          var pid = (k + offset) % np; if (P[pid] <= 0) continue;
          var prog = s.progress[pid] + P[pid], p = state.players[pid];
          for (var guard = 0; guard < 40; guard++) {
            if (unaffiliated(s) > 0) { if (prog < 1) break; s.followers[pid]++; prog -= 1; p.stats.converted++; continue; }
            var rv = -1, rf = 0;
            s.followers.forEach(function (f, r) { if (r !== pid && f > 0 && P[r] < P[pid] && f > rf) { rf = f; rv = r; } });
            if (rv < 0) break;
            var cost = C.rivalCost * state.players[rv].mods.conversionResist;
            if (prog < cost) break;
            s.followers[rv]--; s.followers[pid]++; prog -= cost; p.stats.converted++; p.stats.convertedFromRivals++;
            if (p.mods.favorOnRivalConvert) { p.rivalConverted++; if (p.rivalConverted % p.mods.favorOnRivalConvert.per === 0) p.favor = Math.min(rules.economy.favorCap, p.favor + p.mods.favorOnRivalConvert.amount); }
          }
          s.progress[pid] = r2(Math.min(prog, C.progressCap));
        }
      });
      updateControl(state, false);
      // 3. income
      state.players.forEach(function (p) { if (p.eliminated) return; var inc = incomeOf(state, p.id); p.faith = r2(p.faith + inc); p.stats.faithEarned = r2(p.stats.faithEarned + inc); });
      // 4. growth
      var G = rules.growth;
      if (state.turn % G.everyTurns === 0) state.settlements.forEach(function (s) { if (s.pop < G.maxPop) s.pop += G.amount; });
      state.players.forEach(function (p) {
        if (p.eliminated) return;
        var cg = p.mods.controlledGrowth;
        if (cg && state.turn % cg.n === 0) state.settlements.forEach(function (s) { if (s.controlledBy === p.id && s.pop < G.maxPop) s.pop += cg.amount; });
        var fe = p.mods.favorEvery;
        if (fe && state.turn % fe.n === 0) p.favor = Math.min(rules.economy.favorCap, p.favor + fe.amount);
      });
      // 5. timers
      state.players.forEach(function (p) {
        Object.keys(p.cooldowns).forEach(function (k) { if (p.cooldowns[k] > 0) p.cooldowns[k]--; });
        p.buffs.forEach(function (b) { b.turns--; }); p.buffs = p.buffs.filter(function (b) { return b.turns > 0; });
        p.flags.omenUsed = false;
      });
      state.settlements.forEach(function (s) { if (s.shrine && s.shrine.eclipsed > 0) s.shrine.eclipsed--; });
      // 6. elimination
      state.players.forEach(function (p) {
        if (p.eliminated) return;
        if (followersOf(state, p.id) === 0 && playerShrines(state, p.id).length === 0 && playerPriests(state, p.id).length === 0) {
          p.eliminated = true; log(state, p.id, 'eliminated', p.name + ' is forgotten. No mortal remembers their name.', null);
        }
      });
      // 7. victory
      var tp = totalPop(state), V = rules.victory;
      state.players.forEach(function (p) { var sh = followersOf(state, p.id) / tp; if (sh > p.stats.peakShare) p.stats.peakShare = r2(sh); });
      var alive = state.players.filter(function (p) { return !p.eliminated; });
      if (alive.length === 1) return finish(state, alive[0].id, 'dominion');
      if (state.turn >= V.ascendancyMinTurn) {
        var best = null, bs = 0;
        alive.forEach(function (p) { var sh = followersOf(state, p.id) / tp; if (sh >= V.ascendancyShare && sh > bs) { bs = sh; best = p; } });
        if (best) return finish(state, best.id, 'ascendancy');
      }
      if (state.turn >= state.maxTurns) {
        var ranked = alive.map(function (p) { return { p: p, sc: scoreOf(state, p.id), f: followersOf(state, p.id) }; })
          .sort(function (a, b) { return b.sc - a.sc || b.f - a.f || a.p.id - b.p.id; });
        return finish(state, ranked[0].p.id, 'twilight');
      }
      state.turn++;
    }
    function finish(state, pid, type) {
      state.over = true;
      state.winner = { pid: pid, type: type, turn: state.turn, scores: state.players.map(function (p) { return scoreOf(state, p.id); }) };
      var names = { dominion: 'Dominion: every rival god is forgotten', ascendancy: 'Ascendancy: more than ' + Math.round(rules.victory.ascendancyShare * 100) + '% of all mortals follow one god', twilight: 'Twilight Judgment: the highest devotion when the age ends' };
      log(state, pid, 'victory', state.players[pid].name + ' prevails. ' + names[type] + '.', { type: type });
    }

    function hash(state) { return fnv(JSON.stringify(state)); }

    return {
      version: VERSION, data: data, D: D, rules: rules,
      newGame: newGame, step: step, apply: apply, validate: validate, hash: hash, clone: clone,
      helpers: { dist: dist, pressureAt: pressureAt, incomeOf: incomeOf, scoreOf: scoreOf, followersOf: followersOf, totalPop: totalPop,
        unaffiliated: unaffiliated, playerShrines: playerShrines, playerPriests: playerPriests, priestCap: priestCap, shrineCost: shrineCost,
        omenCost: omenCost, eclipseCost: eclipseCost, inTerritory: inTerritory, nearOwnPresence: nearOwnPresence, hiddenSettlements: hiddenSettlements,
        nearestHidden: nearestHidden, settlementAt: settlementAt, controlledCount: controlledCount, pathStep: pathStep, passableFor: passableFor,
        targetError: targetError, inRadius: inRadius, shrineDef: shrineDef, hasBuff: hasBuff, topRival: topRival }
    };
  }

  function indexData(data) {
    var D = { factions: {}, domains: {}, powers: {}, shrines: {}, events: {}, terrain: data.terrain.types, sources: data.sources };
    data.factions.forEach(function (f) { D.factions[f.id] = f; });
    data.domains.forEach(function (d) { D.domains[d.id] = d; });
    data.powers.forEach(function (p) { D.powers[p.id] = p; });
    data.shrines.forEach(function (s) { D.shrines[s.id] = s; });
    data.events.forEach(function (e) { D.events[e.id] = e; });
    return D;
  }

  return { create: create, VERSION: VERSION, fnv: fnv };
});
