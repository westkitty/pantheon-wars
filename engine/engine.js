/*
 * Pantheon Wars v0.2 — deterministic rules engine.
 * No DOM, no globals besides the UMD export. Runs identically in Node and the browser.
 * All randomness flows through state.rng (mulberry32), so (seed, config, actions) => identical game.
 * API:  var E = PWEngine.create(data);  var s = E.newGame(cfg);  s = E.step(s, action)   (pure, clones)
 *       E.apply(s, action) mutates in place (used by the simulator for speed). Both validate first.
 * cfg: { seed, players:[{faction, human, ai, name}], mode?: {kind:'standard'|'alt'|'scenario', victory?, scenario?} }
 * v0.1 states and replays belong to the frozen legacy engine in engine/legacy/ (different rules, different hashes).
 *
 * Round order (documented in docs/design.html): every god acts in seat order; then resolveRound():
 *   1 priests walk (roles, routes, frost)   2 landmark claims   3 conversion   4 control   5 income   6 growth
 *   7 needs   8 timers   9 climate   10 covenants, treaties, delayed miracles   11 grudges   12 elimination   13 victory   14 age
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rng.js'));
  else root.PWEngine = factory(root.PWRng);
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';

  var VERSION = '0.2.0';
  var NB_EVEN = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
  var NB_ODD = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];
  var HOSTILE_EFFECTS = { strike: 1, weigh: 1, shrineHit: 1, sway: 1, delayedHit: 1 };
  var ROLES = ['emissary', 'seer', 'warden'];
  var SPECS = ['oracle', 'sanctuary', 'beacon'];

  function clone(o) { return typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)); }
  function r2(x) { return Math.round(x * 100) / 100; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function cube(q, r) { var x = q - (r - (r & 1)) / 2; return [x, -x - r, r]; }
  function hexDist(a, b) { return Math.max(Math.abs(a.cx - b.cx), Math.abs(a.cy - b.cy), Math.abs(a.cz - b.cz)); }
  function fnv(str) { var h = 2166136261 >>> 0; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return ('00000000' + h.toString(16)).slice(-8); }
  function domainEffects(d) { return d.effects || (d.effect ? [d.effect] : []); }

  /* Every effect type a power or event may use. The engine refuses to start with data that names anything else (A002). */
  var EFFECT_TYPES = ['reveal', 'revealNearestSettlements', 'revealBand', 'revealRiver', 'revealThreats', 'forecast', 'ward', 'wardRadius', 'clearEclipse',
    'clearEclipseRadius', 'spawnPriest', 'retrain', 'buff', 'shrineBoost', 'siteBoon', 'popControlled', 'popTarget', 'popLargest', 'faith', 'favor', 'prosperity',
    'strike', 'weigh', 'sway', 'shrineHit', 'delayedHit', 'raiseShrine', 'waterBless', 'rains', 'restore', 'trust', 'faithPerRoute', 'followersLargest',
    'loseFollowersLargest', 'freePriest', 'shrineDiscount', 'wardAll', 'wardRandom'];
  var DOMAIN_TYPES = ['terrainFaith', 'waterFaith', 'favorEveryNTurns', 'shrineWard', 'seafaring', 'favorOnRivalConvert', 'eclipseDiscount', 'controlledGrowth',
    'favorOnEvent', 'conversionResist', 'omenMastery', 'favorFromControl', 'routeGrace', 'covenantTrust', 'eclipseShorten', 'wardRegen', 'priestDiscount',
    'forecastSight', 'counterDiscount', 'priestSight', 'climateBoon', 'wardShield', 'sanctuaryFavor', 'climateResist', 'defendResist', 'waterProsperity',
    'routeMastery', 'favorOnHit', 'ageOmen', 'stormGuard', 'contiguityFaith', 'stormPressure', 'hearthFaith', 'orderResist', 'dawnSight'];
  var TARGET_KINDS = ['none', 'anyTile', 'nearKnown', 'ownShrine', 'revealedSettlement', 'ownSettlement', 'rivalShrine', 'shrineSite', 'contestedSettlement',
    'rivalInfluenced', 'coastalShrineSite', 'linkedShrineSite'];

  function create(data) {
    var D = indexData(data);
    var rules = data.rules;
    checkData(data, D);

    /* ------------------------------------------------------------ map generation (unchanged from v0.1 so seeds keep their worlds) */
    function noiseField(rng, cells) {
      var g = []; for (var i = 0; i < (cells + 2) * (cells + 2); i++) g.push(R.next(rng));
      return function (x, y) {
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
        var homes = pickHomes(chosen, nPlayers);
        if (!homes) continue;
        R.shuffle(rng, homes);
        var used = {}, names = data.terrain.settlementNames;
        var settlements = chosen.map(function (t, i) {
          var nm; do { nm = R.pick(rng, names.prefix) + R.pick(rng, names.suffix); } while (used[nm]); used[nm] = 1;
          var fert = D.terrain[t.terrain].fertility;
          t.settlement = i;
          return { id: i, tile: t.id, name: nm, pop: 3 + Math.floor(fert * 4 + R.next(rng) * 3), followers: [], progress: [], shrine: null, controlledBy: -1 };
        });
        tiles.forEach(function (t) { if (t.settlement === undefined) t.settlement = -1; });
        return { w: W, h: H, tiles: tiles, settlements: settlements, homes: homes.map(function (t) { return t.settlement; }), attempt: attempt, comp: comp, main: best };
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

    /* Pilgrim routes: links between near settlements over land, found once per map (no RNG). */
    function genRoutes(tiles, settlements, W) {
      var RT = rules.routes, pairs = {}, out = [];
      function landPath(a, b) {
        var prev = {}; prev[a] = -1; var queue = [a], head = 0, depth = {}; depth[a] = 0;
        while (head < queue.length) {
          var k = queue[head++]; if (k === b) break; if (depth[k] >= RT.maxLen) continue;
          var nb = tiles[k].n;
          for (var i = 0; i < nb.length; i++) { var j = nb[i]; if (j >= 0 && prev[j] === undefined && D.terrain[tiles[j].terrain].passable) { prev[j] = k; depth[j] = depth[k] + 1; queue.push(j); } }
        }
        if (prev[b] === undefined) return null;
        var p = [], c = b; while (c !== -1) { p.push(c); c = prev[c]; } return p.reverse();
      }
      settlements.forEach(function (s) {
        var near = settlements.filter(function (o) { return o !== s; }).map(function (o) { return { o: o, d: hexDist(tiles[s.tile], tiles[o.tile]) }; })
          .filter(function (x) { return x.d <= RT.maxLen; }).sort(function (a, b) { return a.d - b.d || a.o.id - b.o.id; }).slice(0, RT.links);
        near.forEach(function (x) {
          var a = Math.min(s.id, x.o.id), b = Math.max(s.id, x.o.id), key = a + '-' + b; if (pairs[key]) return;
          var path = landPath(settlements[a].tile, settlements[b].tile); if (!path || path.length - 1 > RT.maxLen) return;
          pairs[key] = 1; out.push({ id: out.length, a: a, b: b, path: path, owner: -1, status: 'open', since: null, bad: 0 });
        });
      });
      return out;
    }

    /* Sacred landmarks: separate RNG stream so the v0.1 world layout of a seed is unchanged. Placement is checked for reachability and home fairness. */
    function genLandmarks(seed, tiles, settlements, homes, comp, main) {
      var L = rules.landmarks, kinds = Object.keys(L.kinds), homeTiles = homes.map(function (h) { return tiles[settlements[h].tile]; });
      for (var attempt = 0; attempt < 30; attempt++) {
        var rng = R.make(seed + ':landmarks:' + attempt), placed = [];
        var order = kinds.slice(); R.shuffle(rng, order);
        for (var i = 0; i < L.count; i++) {
          var kind = order[i % order.length], K = L.kinds[kind];
          var opts = tiles.filter(function (t) {
            if (t.settlement >= 0 || comp[t.id] !== main || K.terrains.indexOf(t.terrain) < 0) return false;
            if (K.coast && !t.coast) return false;
            if (homeTiles.some(function (h) { return hexDist(h, t) < L.minHomeDist; })) return false;
            return placed.every(function (p) { return hexDist(tiles[p.tile], t) >= L.spacing; });
          });
          if (!opts.length) { opts = tiles.filter(function (t) { return t.settlement < 0 && comp[t.id] === main && D.terrain[t.terrain].passable && homeTiles.every(function (h) { return hexDist(h, t) >= L.minHomeDist; }) && placed.every(function (p) { return hexDist(tiles[p.tile], t) >= L.spacing; }); }); }
          if (!opts.length) break;
          placed.push({ id: i, kind: kind, tile: R.pick(rng, opts).id, holder: -1, since: null, held: 0 });
        }
        if (placed.length < Math.min(L.count, 3)) continue;
        // fairness: every home's distance to its nearest landmark within L.fairness of the others
        var near = homeTiles.map(function (h) { return Math.min.apply(null, placed.map(function (p) { return hexDist(h, tiles[p.tile]); })); });
        if (Math.max.apply(null, near) - Math.min.apply(null, near) <= L.fairness || attempt === 29) return placed;
      }
      return [];
    }

    /* ------------------------------------------------------------ game creation */
    function modsFor(factionId) {
      var m = { terrainFaith: [], waterFaith: 0, favorEvery: [], shrineWard: 0, seafaring: false, coastalPressure: 0, favorOnRivalConvert: null,
        eclipseDiscount: 0, controlledGrowth: null, favorOnEvent: 0, conversionResist: 1, omenCostMult: 1, omenRadius: 0,
        favorFromControl: null, routeGrace: 0, covenantTrust: 0, eclipseShorten: 0, wardRegen: [], priestDiscount: 0, freeRetrain: false,
        forecastSight: 0, counterDiscount: 0, priestSight: 0, seerMove: 0, climateBoon: null, wardShield: null, sanctuaryFavor: null, climateResist: 1,
        defendResist: null, waterProsperity: 0, routeCostMult: 1, routeFaith: 0, favorOnHit: null, ageOmen: null, stormGuard: null, contiguityFaith: null,
        stormPressure: 1, hearthFaith: null, orderResist: null, startReveal: 0, dreamCooldown: 0 };
      D.factions[factionId].domains.forEach(function (did) {
        domainEffects(D.domains[did]).forEach(function (ef) {
          switch (ef.type) {
            case 'terrainFaith': m.terrainFaith.push({ terrains: ef.terrains, per: ef.perFollower, minProsperity: ef.minProsperity || 0 }); break;
            case 'waterFaith': m.waterFaith += ef.perFollower; break;
            case 'favorEveryNTurns': m.favorEvery.push({ n: ef.n, amount: ef.amount, ages: ef.ages || null }); break;
            case 'shrineWard': m.shrineWard += ef.amount; break;
            case 'seafaring': m.seafaring = true; m.coastalPressure += ef.coastalPressure; break;
            case 'favorOnRivalConvert': m.favorOnRivalConvert = { per: ef.per, amount: ef.amount, max: ef.max || 99 }; break;
            case 'eclipseDiscount': m.eclipseDiscount += ef.amount; break;
            case 'controlledGrowth': m.controlledGrowth = { n: ef.n, amount: ef.amount, max: ef.max || 99 }; break;
            case 'favorOnEvent': m.favorOnEvent += ef.amount; break;
            case 'conversionResist': m.conversionResist *= ef.mult; break;
            case 'omenMastery': m.omenCostMult *= ef.costMult; m.omenRadius += ef.radius; break;
            case 'favorFromControl': m.favorFromControl = { n: ef.n, per: ef.per, max: ef.max }; break;
            case 'routeGrace': m.routeGrace += ef.turns; break;
            case 'covenantTrust': m.covenantTrust += ef.amount; break;
            case 'eclipseShorten': m.eclipseShorten += ef.amount; break;
            case 'wardRegen': m.wardRegen.push({ n: ef.n, below: ef.below, amount: ef.amount, safety: ef.safety || 0 }); break;
            case 'priestDiscount': m.priestDiscount += ef.amount; m.freeRetrain = m.freeRetrain || !!ef.freeRetrain; break;
            case 'forecastSight': m.forecastSight = Math.max(m.forecastSight, ef.radius); break;
            case 'counterDiscount': m.counterDiscount += ef.amount; break;
            case 'priestSight': m.priestSight += ef.radius; m.seerMove += ef.seerMove || 0; break;
            case 'climateBoon': m.climateBoon = { kinds: ef.kinds, prosperity: ef.prosperity, growth: ef.growth, max: ef.max }; break;
            case 'wardShield': m.wardShield = { minWard: ef.minWard, reduce: ef.reduce }; break;
            case 'sanctuaryFavor': m.sanctuaryFavor = { n: ef.n, amount: ef.amount, minAge: ef.minAge, bonus: ef.sanctuaryBonus || 0 }; break;
            case 'climateResist': m.climateResist *= ef.mult; break;
            case 'defendResist': m.defendResist = { mult: ef.mult, turns: ef.turns }; break;
            case 'waterProsperity': m.waterProsperity += ef.amount; break;
            case 'routeMastery': m.routeCostMult *= ef.costMult; m.routeFaith += ef.faith; break;
            case 'favorOnHit': m.favorOnHit = { per: ef.per, max: ef.max }; break;
            case 'ageOmen': m.ageOmen = { ages: ef.ages, costMult: ef.costMult, radius: ef.radius }; break;
            case 'stormGuard': m.stormGuard = { amount: ef.amount, cooldown: ef.cooldown }; break;
            case 'contiguityFaith': m.contiguityFaith = { radius: ef.radius, per: ef.perFollower }; break;
            case 'stormPressure': m.stormPressure *= ef.mult; break;
            case 'hearthFaith': m.hearthFaith = { minAge: ef.minAge, amount: ef.amount }; break;
            case 'orderResist': m.orderResist = { base: ef.base, kept: ef.kept }; break;
            case 'dawnSight': m.startReveal += ef.startReveal || 0; m.dreamCooldown += ef.dreamCooldown || 0; break;
            default: throw new Error('unknown domain effect ' + ef.type);
          }
        });
      });
      return m;
    }

    function newGame(cfg) {
      var seed = cfg.seed === undefined ? 1 : cfg.seed;
      var pcfg = cfg.players;
      if (!pcfg || pcfg.length < 2 || pcfg.length > 3) throw new Error('2-3 players required');
      pcfg.forEach(function (pc) { if (!D.factions[pc.faction]) throw new Error('unknown faction ' + pc.faction); });
      var mode = normalizeMode(cfg.mode);
      if (!mode.allowMirror) { var ids = pcfg.map(function (p) { return p.faction; }); if (new Set(ids).size !== ids.length) throw new Error('each god must be a different pantheon (mirror matches need a scenario that allows them)'); }
      var map = genMap(seed, pcfg.length);
      var S = rules.start;
      var state = {
        version: VERSION, seed: seed, turn: 1, maxTurns: mode.turns || rules.turns, current: 0, over: false, winner: null,
        rng: R.make(seed + ':game'), nextPriest: 1, seq: 0, log: [], actions: [], mode: mode, age: ageOf(1).id,
        map: { w: map.w, h: map.h, tiles: map.tiles }, settlements: map.settlements, priests: [], players: [],
        routes: genRoutes(map.tiles, map.settlements, map.w), landmarks: genLandmarks(seed, map.tiles, map.settlements, map.homes, map.comp, map.main),
        climate: { fronts: [], next: 1 }, marks: [], nextMark: 1, covenants: [], nextCov: 1, treaties: [], proposals: [], nextDiplo: 1, pending: [], nextPending: 1
      };
      pcfg.forEach(function (pc, i) {
        var f = D.factions[pc.faction];
        var p = { id: i, faction: pc.faction, name: pc.name || f.name, human: !!pc.human, ai: pc.ai || 'hard',
          faith: S.faith + (pcfg.length === 2 && S.seatFaithBonusDuel !== undefined ? S.seatFaithBonusDuel : (S.seatFaithBonus || 0)) * i, favor: S.favor, revealed: new Array(map.tiles.length).fill(0), cooldowns: {}, buffs: [],
          flags: { omenUsed: false, shrineDiscount: 1 - (S.seatShrineDiscount || 0) * i, retrainUsed: false, proposed: false }, eliminated: false, pendingEvent: null, eventsSeen: [], rivalConverted: 0,
          mods: modsFor(pc.faction), home: map.homes[i], grudge: pcfg.map(function () { return 0; }), forecasts: [], hits: 0, favorFromHits: 0, favorFromConvert: 0,
          sacredRounds: 0,
          stats: { actions: {}, powers: {}, converted: 0, convertedFromRivals: 0, shrinesBuilt: 0, eclipses: 0, faithEarned: 0, peakShare: 0, priestsSent: 0, toppled: 0,
            covenantsKept: 0, covenantsBroken: 0, counters: 0, specs: 0, routes: 0, landmarks: 0, treaties: 0, breaches: 0 } };
        state.players.push(p);
      });
      state.settlements.forEach(function (s) {
        var fert = D.terrain[state.map.tiles[s.tile].terrain].fertility, nr = R.make(seed + ':needs:' + s.id);
        s.followers = pcfg.map(function () { return 0; }); s.progress = pcfg.map(function () { return 0; }); s.trust = pcfg.map(function () { return 0; });
        s.needs = { prosperity: clamp(Math.round(rules.needs.start.prosperityBase + fert * rules.needs.start.prosperityPerFertility + R.next(nr) * 2 - 1), 0, 10), safety: rules.needs.start.safety };
        s.mem = []; s.patrons = []; s.boons = []; s.peak = s.pop; s.unrest = 0;
      });
      state.players.forEach(function (p) {
        var s = state.settlements[p.home];
        s.pop = Math.max(s.pop, S.homePop); s.peak = s.pop;
        s.followers[p.id] = S.homeFollowers;
        placeShrine(state, p.id, s, true);
        for (var k = 0; k < S.priests; k++) spawnPriest(state, p.id, s.tile, 'emissary');
        revealAround(state, p.id, s.tile, S.revealRadius + (S.seatRevealBonus || 0) * p.id + p.mods.startReveal);
      });
      updateControl(state, true);
      if (mode.scenario) applyScenarioSetup(state, mode.scenario);
      log(state, -1, 'start', 'The mortal world wakes. ' + state.players.map(function (p) { return p.name; }).join(', ') + ' turn their gaze upon it.', { age: state.age });
      beginPlayerTurn(state);
      return state;
    }
    function normalizeMode(m) {
      m = m || { kind: 'standard' };
      var out = { kind: m.kind || 'standard' };
      if (out.kind === 'alt') out.victory = m.victory || 'sacredSites';
      if (out.kind === 'scenario') {
        var sc = D.scenarios[m.scenario]; if (!sc) throw new Error('unknown scenario ' + m.scenario);
        out.scenario = sc.id; out.turns = sc.turns; out.stage = 0; out.allowMirror = !!sc.allowMirror;
      }
      if (m.allowMirror) out.allowMirror = true;
      return out;
    }
    function applyScenarioSetup(state, sid) {
      var sc = D.scenarios[sid], su = sc.setup || {}, me = state.players[0];
      if (su.humanFaith !== undefined) me.faith = su.humanFaith;
      if (su.humanFavor !== undefined) me.favor = su.humanFavor;
      state.players.forEach(function (p, i) { if (i > 0) { if (su.rivalFavor !== undefined) p.favor = su.rivalFavor; if (su.rivalFaith !== undefined) p.faith = su.rivalFaith; } });
      if (su.homeFollowers !== undefined) { var hs = state.settlements[me.home]; hs.followers[0] = su.homeFollowers; }
      if (su.homeProsperity !== undefined) state.settlements[me.home].needs.prosperity = su.homeProsperity;
      if (su.homeWard !== undefined) state.settlements[me.home].shrine.ward = su.homeWard;
      (su.fronts || []).forEach(function (fr) {
        var anchor = fr.near === 'rival' ? state.settlements[state.players[1].home].tile : state.settlements[me.home].tile;
        state.climate.fronts.push({ id: state.climate.next++, kind: fr.kind, tile: anchor, radius: fr.radius || 3, phase: fr.phase || 'active', t0: state.turn, t1: state.turn + (fr.duration || rules.climate.kinds[fr.kind].duration) - 1, hitDone: false });
      });
      if (su.revealRivals) state.players.forEach(function (p) { if (p.id) revealAround(state, 0, state.settlements[p.home].tile, 1); });
      if (su.rivalPriestsNearHome) state.players.forEach(function (p) { if (p.id) for (var k = 0; k < su.rivalPriestsNearHome; k++) { var pr = spawnPriest(state, p.id, state.settlements[p.home].tile, 'emissary'); pr.dest = state.settlements[me.home].tile; } });
      updateControl(state, true);
    }

    /* ------------------------------------------------------------ helpers */
    function ageOf(turn) { var a = rules.ages[0]; rules.ages.forEach(function (x) { if (turn >= x.from) a = x; }); return a; }
    function ageMod(state, key, def) { var m = ageOf(state.turn).mods || {}; return m[key] === undefined ? def : m[key]; }
    function tileOf(state, id) { return state.map.tiles[id]; }
    function dist(state, a, b) { return hexDist(state.map.tiles[a], state.map.tiles[b]); }
    function log(state, p, k, m, x) { state.seq = (state.seq || 0) + 1; state.log.push({ id: state.seq, t: state.turn, p: p, k: k, m: m, x: x || null }); }
    function remember(state, s, k, p, extra) { var e = { t: state.turn, k: k, p: p }; if (extra) e.x = extra; s.mem.push(e); while (s.mem.length > rules.memory.max) s.mem.shift(); }
    function addTrust(s, pid, d) { s.trust[pid] = clamp(s.trust[pid] + d, rules.trust.min, rules.trust.max); }
    function addMark(state, k, tile, p, extra) {
      var K = rules.marks.kinds[k] || { turns: 4 };
      state.marks.push({ id: state.nextMark++, k: k, tile: tile, t: state.turn, p: p, until: K.turns ? state.turn + K.turns : 0, x: extra || null });
      if (state.marks.length > rules.marks.max) { var idx = state.marks.findIndex(function (m) { return m.until > 0; }); state.marks.splice(idx >= 0 ? idx : 0, 1); }
    }
    function marksAt(state, tile, k) { return state.marks.filter(function (m) { return m.tile === tile && (!k || m.k === k); }); }
    function shrineDef(state, pid) { return D.shrines[D.factions[state.players[pid].faction].shrine]; }
    function hasBuff(p, stat) { return p.buffs.some(function (b) { return b.stat === stat; }); }
    function buffMult(p, stat) { var v = 1; p.buffs.forEach(function (b) { if (b.stat === stat) v *= b.value; }); return v; }
    function buffSum(p, stat) { var v = 0; p.buffs.forEach(function (b) { if (b.stat === stat) v += b.value; }); return v; }
    function boonOf(s, pid, stat) { var v = null; s.boons.forEach(function (b) { if (b.p === pid && b.stat === stat) v = v === null ? b.value : (stat === 'pressure' ? v + b.value : v * b.value); }); return v; }
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
    function priestCost(state, pid) { return Math.max(4, rules.actions.priest.faith - state.players[pid].mods.priestDiscount); }
    function shrineCost(state, pid, tile) {
      var p = state.players[pid], c = (rules.actions.shrine.faith + rules.actions.shrine.faithStep * playerShrines(state, pid).length) * p.flags.shrineDiscount;
      if (tile !== undefined && tile !== null && marksAt(state, tile, 'ruin').length) c *= rules.marks.kinds.ruin.shrineCostMult;
      return Math.round(c);
    }
    function omenCost(state, pid) {
      var p = state.players[pid], c = rules.actions.omen.faith * p.mods.omenCostMult * ageMod(state, 'omenCostMult', 1);
      if (p.mods.ageOmen && p.mods.ageOmen.ages.indexOf(state.age) >= 0) c *= p.mods.ageOmen.costMult;
      if (hasBuff(p, 'omenFree')) return 0;
      state.landmarks.forEach(function (l) { if (l.holder === pid && l.kind === 'stones') c -= rules.landmarks.kinds.stones.omenDiscount; });
      return Math.max(0, Math.round(c));
    }
    function omenRadius(state, pid) { var p = state.players[pid], r = rules.actions.omen.radius + p.mods.omenRadius; if (p.mods.ageOmen && p.mods.ageOmen.ages.indexOf(state.age) >= 0) r += p.mods.ageOmen.radius; return r; }
    function eclipseCost(state, pid, tile) {
      var c = rules.actions.eclipse.favor - state.players[pid].mods.eclipseDiscount + ageMod(state, 'eclipseCostDelta', 0);
      if (tile !== undefined && tile !== null) state.climate.fronts.forEach(function (f) { if (f.kind === 'omen' && f.phase === 'active' && dist(state, f.tile, tile) <= f.radius) c -= rules.climate.kinds.omen.eclipseDiscount; });
      return Math.max(1, c);
    }
    function eclipseRange(state, pid) { var r = rules.actions.eclipse.range; state.landmarks.forEach(function (l) { if (l.holder === pid && l.kind === 'stones') r += rules.landmarks.kinds.stones.eclipseRange; }); return r; }
    function dreamCooldown(state, pid) { return Math.max(1, rules.actions.dream.cooldown + ageMod(state, 'dreamCooldownDelta', 0) - state.players[pid].mods.dreamCooldown); }
    function counterCost(state, pid) { return Math.max(1, rules.counterRite.favor - state.players[pid].mods.counterDiscount); }
    function routeCost(state, pid) { return Math.round(rules.routes.faith * state.players[pid].mods.routeCostMult); }
    function shrineRadius(state, s) {
      var def = D.shrines[s.shrine.type], r = def.radius;
      if (s.shrine.spec === 'beacon') r += rules.specs.beacon.radius;
      (s.shrine.boosts || []).forEach(function (b) { if (b.stat === 'radius') r += b.value; });
      return r;
    }
    function shrinePressure(state, s) {
      var def = D.shrines[s.shrine.type], v = def.pressure * ageMod(state, 'shrinePressureMult', 1);
      if (s.shrine.spec === 'beacon') v *= rules.specs.beacon.pressure;
      (s.shrine.boosts || []).forEach(function (b) { if (b.stat === 'pressure') v *= b.value; });
      return v;
    }
    function maxWard(state, s) {
      var def = D.shrines[s.shrine.type], base = def.ward + state.players[s.shrine.owner].mods.shrineWard;
      if (s.shrine.spec === 'beacon') return Math.min(rules.specs.beacon.wardCap, 5);
      return Math.max(5, base + (s.shrine.spec === 'sanctuary' ? rules.specs.sanctuary.maxWard : 0));
    }
    function inTerritory(state, pid, tileId, extra) {
      extra = extra || 0;
      return playerShrines(state, pid).some(function (s) { return dist(state, s.tile, tileId) <= shrineRadius(state, s) + extra; });
    }
    function nearOwnPresence(state, pid, tileId, range) {
      if (playerShrines(state, pid).some(function (s) { return dist(state, s.tile, tileId) <= range; })) return true;
      return playerPriests(state, pid).some(function (pr) { return dist(state, pr.tile, tileId) <= range; });
    }
    function hasPresence(state, pid, s) { return s.followers[pid] > 0 || inTerritory(state, pid, s.tile) || state.priests.some(function (pr) { return pr.owner === pid && pr.tile === s.tile; }); }
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
    function roleOf(pr) { return rules.roles[pr.role || 'emissary']; }
    function wardenAt(state, pid, tile) { return state.priests.some(function (pr) { return pr.owner === pid && pr.tile === tile && pr.role === 'warden'; }); }
    function placeShrine(state, pid, s, initial) {
      var def = shrineDef(state, pid), onRuin = marksAt(state, s.tile, 'ruin').length > 0;
      s.shrine = { owner: pid, type: def.id, ward: def.ward + state.players[pid].mods.shrineWard, eclipsed: 0, built: state.turn, spec: null, boosts: [], threat: null, guardUsed: -99 };
      revealAround(state, pid, s.tile, def.sight);
      if (!initial) {
        state.players[pid].stats.shrinesBuilt++;
        remember(state, s, onRuin ? 'rebuilt' : 'founded', pid);
        if (onRuin) { state.marks = state.marks.filter(function (m) { return !(m.tile === s.tile && m.k === 'ruin'); }); addMark(state, 'rebuilt', s.tile, pid); }
        borderCheck(state, pid, s);
      }
    }
    function spawnPriest(state, pid, tileId, role) {
      var pr = { id: state.nextPriest++, owner: pid, tile: tileId, dest: null, from: tileId, role: role || 'emissary' };
      state.priests.push(pr); return pr;
    }
    function routeActive(r) { return r.owner >= 0 && r.status === 'active'; }
    function routeMult(state, pid) { return buffMult(state.players[pid], 'routeMult'); }
    function activeRoutes(state, pid) { return state.routes.filter(function (r) { return r.owner === pid && r.status === 'active'; }); }
    function frontsAt(state, tile, kind, phase) {
      return state.climate.fronts.filter(function (f) { return (!kind || f.kind === kind) && (phase ? f.phase === phase : f.phase === 'active') && dist(state, f.tile, tile) <= f.radius; });
    }

    function pressureAt(state, s, pid) {
      var p = state.players[pid]; if (p.eliminated) return 0;
      var P = 0, fall = rules.conversion.falloff;
      state.settlements.forEach(function (o) {
        if (!o.shrine || o.shrine.owner !== pid || o.shrine.eclipsed > 0) return;
        var rad = shrineRadius(state, o), d = dist(state, o.tile, s.tile);
        if (d <= rad) P += fall[Math.min(d, fall.length - 1)] * (d < fall.length ? 1 : 0.6) * shrinePressure(state, o);
      });
      var pm = buffMult(p, 'priestMult'), sitePm = boonOf(s, pid, 'priestPower') || 1;
      state.priests.forEach(function (pr) { if (pr.owner === pid && pr.tile === s.tile) P += roleOf(pr).power * pm * sitePm; });
      if (P > 0 && s.controlledBy === pid) P += rules.conversion.controlMomentum;
      if (P > 0) state.routes.forEach(function (r) { if (r.owner === pid && r.status === 'active' && (r.a === s.id || r.b === s.id)) P += rules.routes.pressure * routeMult(state, pid); });
      var bp = boonOf(s, pid, 'pressure'); if (bp) P += bp;
      if (P > 0 && p.mods.coastalPressure && state.map.tiles[s.tile].coast) P *= 1 + p.mods.coastalPressure;
      if (P <= 0) return 0;
      // mortal factors: trust, needs, weather, solar contests
      P *= 1 + rules.trust.pressurePerPoint * s.trust[pid];
      if (s.controlledBy === pid && s.needs.prosperity <= rules.needs.hungry) P *= rules.needs.hungryPressureMult;
      if (s.needs.safety <= rules.needs.afraid && !protects(state, pid, s)) P *= rules.needs.afraidPressureMult;
      var z = boonOf(s, pid, 'zenith'); if (z) P *= z;
      s.boons.forEach(function (b) { if (b.stat === 'zenith' && b.p !== pid) P *= 0.7; });
      if (p.mods.stormPressure !== 1 && frontsAt(state, s.tile, 'storm').length) P *= p.mods.stormPressure;
      return r2(P * buffMult(p, 'pressureMult'));
    }
    function protects(state, pid, s) { return (s.shrine && s.shrine.owner === pid && s.shrine.ward >= 2) || wardenAt(state, pid, s.tile) || state.settlements.some(function (o) { return o.shrine && o.shrine.owner === pid && o.shrine.spec === 'sanctuary' && dist(state, o.tile, s.tile) <= 1; }); }
    function resistOf(state, s, rid) {
      var p = state.players[rid], v = p.mods.conversionResist;
      if (p.mods.orderResist) v *= p.stats.covenantsBroken === 0 ? p.mods.orderResist.kept : p.mods.orderResist.base;
      if (s.shrine && s.shrine.owner === rid && s.shrine.spec === 'sanctuary') v *= rules.specs.sanctuary.resist;
      var b = boonOf(s, rid, 'resist'); if (b) v *= b;
      return v;
    }
    function updateControl(state, silent) {
      state.settlements.forEach(function (s) {
        var best = -1, bf = 0;
        s.followers.forEach(function (f, pid) { if (f > bf) { bf = f; best = pid; } });
        var ctrl = (best >= 0 && bf * 2 >= s.pop) ? best : -1;
        if (ctrl !== s.controlledBy) {
          var prev = s.controlledBy; s.controlledBy = ctrl;
          if (ctrl >= 0) { s.patrons.push({ p: ctrl, f: state.players[ctrl].faction, t: state.turn }); while (s.patrons.length > rules.memory.patrons) s.patrons.shift(); }
          if (!silent) {
            if (ctrl >= 0) {
              var p = state.players[ctrl];
              p.favor = Math.min(rules.economy.favorCap, p.favor + rules.economy.favorOnControl);
              remember(state, s, 'won', ctrl, prev >= 0 ? { from: prev } : null);
              log(state, ctrl, 'control', s.name + ' now kneels to ' + p.name + (prev >= 0 ? ', torn from ' + state.players[prev].name : '') + '.', { tile: s.tile, settlement: s.id, from: prev });
            }
            if (prev >= 0) { remember(state, s, 'lost', prev); if (ctrl >= 0) addGrudge(state, prev, ctrl, rules.grudge.control); }
          }
        }
      });
    }
    function addGrudge(state, holder, target, n) { if (holder === target || holder < 0 || target < 0) return; var g = state.players[holder].grudge; g[target] = clamp(g[target] + n, 0, rules.grudge.max); }
    function incomeOf(state, pid) {
      var p = state.players[pid], inc = 0, ec = rules.economy, controlled = state.settlements.filter(function (s) { return s.controlledBy === pid; });
      state.settlements.forEach(function (s) {
        var f = s.followers[pid]; if (!f) return;
        var per = ec.faithPerFollower, t = state.map.tiles[s.tile];
        p.mods.terrainFaith.forEach(function (tf) { if (tf.terrains.indexOf(t.terrain) >= 0 && s.needs.prosperity >= tf.minProsperity) per += tf.per; });
        if (p.mods.waterFaith && t.coast) per += p.mods.waterFaith;
        if (p.mods.contiguityFaith && controlled.some(function (o) { return o !== s && dist(state, o.tile, s.tile) <= p.mods.contiguityFaith.radius; })) per += p.mods.contiguityFaith.per;
        frontsAt(state, s.tile, 'drought').forEach(function () { per += rules.climate.kinds.drought.faithPerFollower * (s.controlledBy === pid ? p.mods.climateResist : 1); });
        inc += f * Math.max(0, per);
      });
      playerShrines(state, pid).forEach(function (s) {
        if (s.shrine.eclipsed) return;
        inc += D.shrines[s.shrine.type].faith;
        if (s.shrine.spec === 'oracle') inc += rules.specs.oracle.faith;
        if (p.mods.hearthFaith && state.turn - s.shrine.built >= p.mods.hearthFaith.minAge) inc += p.mods.hearthFaith.amount;
      });
      inc += buffSum(p, 'faithPerControlled') * controlled.length;
      inc += activeRoutes(state, pid).length * (rules.routes.faithPer + p.mods.routeFaith) * routeMult(state, pid) * ageMod(state, 'routeFaithMult', 1);
      state.landmarks.forEach(function (l) { if (l.holder === pid && l.kind === 'spring') inc += rules.landmarks.kinds.spring.faith; });
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
    /* What a player legitimately knows about the weather: active fronts over revealed land; forecasts only through oracles, domains or forecast powers. */
    function frontKnown(state, pid, f) {
      var p = state.players[pid];
      if (!p.revealed[f.tile]) return false;
      if (f.phase !== 'forecast') return true;
      if (p.forecasts.some(function (fc) { return fc.until >= state.turn && (fc.tile === null ? playerShrines(state, pid).some(function (s) { return dist(state, s.tile, f.tile) <= fc.radius; }) : dist(state, fc.tile, f.tile) <= fc.radius); })) return true;
      return playerShrines(state, pid).some(function (s) {
        var d = dist(state, s.tile, f.tile);
        return (s.shrine.spec === 'oracle' && d <= rules.specs.oracle.forecast) || (p.mods.forecastSight && d <= p.mods.forecastSight);
      });
    }
    function knownFronts(state, pid) { return state.climate.fronts.filter(function (f) { return frontKnown(state, pid, f); }); }

    /* ------------------------------------------------------------ validation */
    function settlementAt(state, tileId) { var t = state.map.tiles[tileId]; return t && t.settlement >= 0 ? state.settlements[t.settlement] : null; }
    function nearKnown(state, pid, tile, range) { var p = state.players[pid]; return inRadius(state, tile, range).some(function (id) { return p.revealed[id]; }); }
    function contested(s) { return s.followers.filter(function (f) { return f > 0; }).length >= 2; }
    function targetError(state, pid, kind, tile, range) {
      var p = state.players[pid], t = state.map.tiles[tile];
      if (kind === 'none') return null;
      if (tile === undefined || tile === null || !t) return 'needs a target';
      var s = settlementAt(state, tile);
      switch (kind) {
        case 'anyTile': return null;
        case 'nearKnown': return nearKnown(state, pid, tile, range || 4) ? null : 'too far from the known world';
        case 'ownShrine': return s && s.shrine && s.shrine.owner === pid ? null : 'target one of your shrines';
        case 'revealedSettlement': return s && p.revealed[tile] ? null : 'target a revealed settlement';
        case 'ownSettlement': return s && s.followers[pid] > 0 ? null : 'target a settlement with your followers';
        case 'rivalShrine':
          if (!s || !s.shrine || s.shrine.owner === pid || !p.revealed[tile]) return 'target a revealed rival shrine';
          if (hasBuff(state.players[s.shrine.owner], 'eclipseImmune')) return 'that shrine is protected by prepared rites';
          return nearOwnPresence(state, pid, tile, range || eclipseRange(state, pid)) ? null : 'too far from your shrines and priests';
        case 'contestedSettlement':
          if (!s || !p.revealed[tile]) return 'target a revealed settlement';
          if (!contested(s) || !s.followers.some(function (f, r) { return r !== pid && f > 0; })) return 'that town is not contested by a rival';
          return hasPresence(state, pid, s) ? null : 'you need followers, a priest or territory there';
        case 'rivalInfluenced':
          if (!s || !p.revealed[tile]) return 'target a revealed settlement';
          if (!s.followers.some(function (f, r) { return r !== pid && f > 0; })) return 'no rival followers there';
          return nearOwnPresence(state, pid, tile, range || 3) ? null : 'too far from your shrines and priests';
        case 'shrineSite':
          if (!s || s.shrine || !p.revealed[tile]) return 'target a revealed settlement without a shrine';
          return inTerritory(state, pid, tile, Math.max(0, (range || 4) - shrineDef(state, pid).radius)) ? null : 'too far from your land';
        case 'coastalShrineSite':
          if (!s || s.shrine || !p.revealed[tile]) return 'target a revealed settlement without a shrine';
          if (!t.coast) return 'it must stand beside water';
          return (s.followers[pid] > 0 || inTerritory(state, pid, tile, Math.max(0, (range || 3) - shrineDef(state, pid).radius))) ? null : 'too far from your land';
        case 'linkedShrineSite':
          if (!s || s.shrine || !p.revealed[tile]) return 'target a revealed settlement without a shrine';
          return state.settlements.some(function (o) { return o.controlledBy === pid && o !== s && dist(state, o.tile, tile) <= (range || 2); }) ? null : 'it must lie within ' + (range || 2) + ' of a town you control';
      }
      return 'bad target kind';
    }
    function powerTargetError(state, pid, pw, tile) {
      var err = targetError(state, pid, pw.target, tile, pw.range); if (err) return err;
      var p = state.players[pid];
      for (var i = 0; i < pw.effects.length; i++) {
        var ef = pw.effects[i];
        if (ef.type === 'raiseShrine' && p.faith < Math.round(shrineCost(state, pid, tile) * ef.costMult) + pw.cost.faith) return 'not enough Faith to raise it';
        if (ef.type === 'spawnPriest' && playerPriests(state, pid).length >= priestCap(state, pid) + 1) return 'too many priests already';
        if (ef.type === 'faithPerRoute' && !activeRoutes(state, pid).length && pw.effects.length === 1) return 'you have no active pilgrim route';
        if (ef.type === 'restore') { var s = settlementAt(state, tile); if (s && s.pop >= s.peak && ef.pop && !ef.safety && s.needs.prosperity >= 8) return 'that town has lost nothing to restore'; }
        if (ef.type === 'delayedHit' && state.pending.some(function (x) { return x.tile === tile && x.by === pid; })) return 'a storm already gathers there';
      }
      return null;
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
          return nearKnown(state, pid, action.tile, A.omen.range) ? null : 'omens can only be read near the known world';
        case 'dream':
          if (p.cooldowns.dream > 0) return 'dream vision is recovering';
          if (p.favor < A.dream.favor) return 'not enough Favor';
          return hiddenSettlements(state, pid).length ? null : 'every settlement is already known';
        case 'shrine':
          s = settlementAt(state, action.tile);
          if (!s || !p.revealed[action.tile]) return 'target a revealed settlement';
          if (s.shrine) return 'a shrine already stands there';
          if (p.faith < shrineCost(state, pid, action.tile)) return 'not enough Faith';
          return hasPresence(state, pid, s) ? null : 'you need followers, a priest or territory there';
        case 'priest':
          s = settlementAt(state, action.tile);
          if (!s || !s.shrine || s.shrine.owner !== pid) return 'priests are ordained at your own shrines';
          if (action.role !== undefined && ROLES.indexOf(action.role) < 0) return 'unknown priest calling';
          if (playerPriests(state, pid).length >= priestCap(state, pid)) return 'priest limit reached (raise more shrines)';
          return p.faith >= priestCost(state, pid) ? null : 'not enough Faith';
        case 'retrain':
          var rp = state.priests.find(function (x) { return x.id === action.priest; });
          if (!rp || rp.owner !== pid) return 'not your priest';
          if (ROLES.indexOf(action.role) < 0) return 'unknown priest calling';
          if ((rp.role || 'emissary') === action.role) return 'it already follows that calling';
          s = settlementAt(state, rp.tile); if (!s || !s.shrine || s.shrine.owner !== pid) return 'priests take a new calling at your own shrines';
          return (p.mods.freeRetrain && !p.flags.retrainUsed) || p.faith >= A.retrain.faith ? null : 'not enough Faith';
        case 'movePriest':
          var pr = state.priests.find(function (x) { return x.id === action.priest; });
          if (!pr || pr.owner !== pid) return 'not your priest';
          if (!state.map.tiles[action.tile] || !passableFor(state, pid, action.tile)) return 'impassable';
          return pathStep(state, pid, pr.tile, action.tile) ? null : 'no path';
        case 'eclipse':
          if (p.cooldowns.eclipse > 0) return 'eclipse is recovering';
          if (p.favor < eclipseCost(state, pid, action.tile)) return 'not enough Favor';
          return targetError(state, pid, 'rivalShrine', action.tile, eclipseRange(state, pid));
        case 'power':
          var pw = D.powers[action.power];
          if (!pw || D.factions[p.faction].powers.indexOf(pw.id) < 0) return 'not your power';
          if (p.cooldowns[pw.id] > 0) return pw.name + ' is recovering';
          if (p.faith < pw.cost.faith || p.favor < pw.cost.favor) return 'cannot afford ' + pw.name;
          if (action.role !== undefined && ROLES.indexOf(action.role) < 0) return 'unknown priest calling';
          return powerTargetError(state, pid, pw, action.tile);
        case 'specialize':
          s = settlementAt(state, action.tile);
          if (!s || !s.shrine || s.shrine.owner !== pid) return 'target one of your shrines';
          if (SPECS.indexOf(action.spec) < 0) return 'unknown specialization';
          if (s.shrine.spec) return 'this shrine already has a calling';
          return p.faith >= rules.specs.faith && p.favor >= rules.specs.favor ? null : 'not enough Faith and Favor';
        case 'covenant':
          var K = rules.covenants.kinds[action.kind]; if (!K) return 'unknown covenant';
          s = settlementAt(state, action.tile); if (!s || !p.revealed[action.tile]) return 'target a revealed settlement';
          if (activeCovenants(state, pid).length >= rules.covenants.max) return 'you already keep ' + rules.covenants.max + ' covenants';
          if (state.covenants.some(function (c) { return c.status === 'active' && c.p === pid && c.s === s.id; })) return 'you already have a covenant with this town';
          if (action.kind === 'protect' && !(s.shrine && s.shrine.owner === pid)) return 'a covenant of protection needs your shrine there';
          if (action.kind === 'provide' && !(s.followers[pid] > 0)) return 'you need followers there';
          if (action.kind === 'provide' && s.needs.prosperity >= K.prosperity) return 'that town is already prosperous';
          if (action.kind === 'keep' && s.followers[pid] < K.minFollowers) return 'you need at least ' + K.minFollowers + ' followers there';
          if (state.turn + K.turns > state.maxTurns) return 'too late in the age to promise that';
          return null;
        case 'abandon':
          var cv = state.covenants.find(function (c) { return c.id === action.covenant; });
          return cv && cv.p === pid && cv.status === 'active' ? null : 'no such covenant of yours';
        case 'counterRite':
          s = settlementAt(state, action.tile);
          if (!s || !s.shrine || s.shrine.owner !== pid) return 'target one of your shrines';
          if (!s.shrine.threat || s.shrine.threat.until < state.turn) return 'nothing threatens this shrine';
          return p.favor >= counterCost(state, pid) ? null : 'not enough Favor';
        case 'route':
          var rt = state.routes[action.route];
          if (!rt) return 'no such route';
          if (rt.owner >= 0) return 'that road is already consecrated';
          var sa = state.settlements[rt.a], sb = state.settlements[rt.b];
          if (!p.revealed[sa.tile] || !p.revealed[sb.tile]) return 'both towns must be known';
          if (!(sa.followers[pid] > 0 && sb.followers[pid] > 0)) return 'you need followers at both ends';
          if (!((sa.shrine && sa.shrine.owner === pid) || (sb.shrine && sb.shrine.owner === pid))) return 'one end needs your shrine';
          if (state.routes.filter(function (r) { return r.owner === pid; }).length >= rules.routes.max) return 'you already keep ' + rules.routes.max + ' routes';
          return p.faith >= routeCost(state, pid) ? null : 'not enough Faith';
        case 'propose':
          var to = state.players[action.to];
          if (!to || action.to === pid || to.eliminated) return 'no such rival';
          if (['truce', 'festival', 'border'].indexOf(action.kind) < 0) return 'unknown proposal';
          if (p.flags.proposed) return 'one envoy per turn';
          if (state.treaties.some(function (t) { return t.status === 'active' && t.kind === action.kind && ((t.a === pid && t.b === action.to) || (t.b === pid && t.a === action.to)); })) return 'that agreement already stands';
          if (state.proposals.some(function (x) { return x.status === 'pending' && ((x.from === pid && x.to === action.to) || (x.from === action.to && x.to === pid)); })) return 'an envoy is already on the road';
          if (action.kind === 'festival' && p.faith < rules.diplomacy.festivalFaith) return 'a festival costs ' + rules.diplomacy.festivalFaith + ' Faith';
          if (state.turn + 2 > state.maxTurns) return 'too late in the age';
          return null;
        case 'answer':
          var pp = state.proposals.find(function (x) { return x.id === action.id; });
          if (!pp || pp.to !== pid || pp.status !== 'pending') return 'no such proposal';
          if (action.accept && pp.kind === 'festival' && p.faith < rules.diplomacy.festivalFaith) return 'a festival costs ' + rules.diplomacy.festivalFaith + ' Faith';
          return null;
      }
      return 'unknown action ' + action.type;
    }
    function activeCovenants(state, pid) { return state.covenants.filter(function (c) { return c.p === pid && c.status === 'active'; }); }

    /* ------------------------------------------------------------ hostility, treaties, grudges */
    function activeTreaty(state, a, b, kind) { return state.treaties.find(function (t) { return t.status === 'active' && (!kind || t.kind === kind) && ((t.a === a && t.b === b) || (t.a === b && t.b === a)); }); }
    function breach(state, pid, victim, t, why) {
      var D2 = rules.diplomacy, p = state.players[pid];
      t.status = 'broken'; t.brokenBy = pid; t.brokenTurn = state.turn;
      p.favor = Math.max(0, p.favor - D2.breachFavor); p.stats.breaches++;
      addGrudge(state, victim, pid, D2.breachGrudge);
      state.settlements.forEach(function (s) { if (s.controlledBy === victim) addTrust(s, pid, -D2.breachTrust); });
      log(state, pid, 'breach', p.name + ' breaks the ' + t.kind + ' with ' + state.players[victim].name + ' (' + why + ').', { treaty: t.id, victim: victim });
    }
    function hostile(state, pid, victim, why) {
      if (victim < 0 || victim === pid) return;
      var t = activeTreaty(state, pid, victim, 'truce'); if (t) breach(state, pid, victim, t, why);
    }
    function borderCheck(state, pid, s) {
      state.treaties.forEach(function (t) {
        if (t.status !== 'active' || t.kind !== 'border' || (t.a !== pid && t.b !== pid)) return;
        var other = t.a === pid ? t.b : t.a;
        if (playerShrines(state, other).some(function (o) { return dist(state, o.tile, s.tile) <= rules.diplomacy.borderRadius; })) breach(state, pid, other, t, 'a shrine raised on promised ground');
      });
    }

    /* ------------------------------------------------------------ effects */
    function addFollowers(state, pid, s, n) { var free = unaffiliated(s); var k = Math.min(n, free); s.followers[pid] += k; return k; }
    function bless(state, pid, s, prosperity, why) { if (prosperity) s.needs.prosperity = clamp(s.needs.prosperity + prosperity, 0, 10); addTrust(s, pid, 1); remember(state, s, 'blessed', pid, why ? { by: why } : null); addMark(state, 'blessed', s.tile, pid); }
    function growPop(s, n, cap) { var before = s.pop; s.pop = Math.min(cap, s.pop + n); if (s.pop > s.peak) s.peak = s.pop; return s.pop - before; }
    function runEffect(state, pid, ef, tile, src, act) {
      var p = state.players[pid], s = tile !== undefined && tile !== null ? settlementAt(state, tile) : null, res, k, cap = rules.growth.maxPop + 4;
      switch (ef.type) {
        case 'reveal': res = revealAround(state, pid, tile, ef.radius); log(state, pid, 'reveal', src + ' unveils ' + res.tiles + ' hexes' + (res.settlements.length ? ' and ' + res.settlements.length + ' settlement(s)' : '') + '.', { tile: tile, radius: ef.radius }); break;
        case 'revealNearestSettlements':
          var found = nearestHidden(state, pid, ef.count);
          found.forEach(function (o) { revealAround(state, pid, o.tile, ef.radius); });
          log(state, pid, 'reveal', src + (found.length ? ' reveals ' + found.map(function (o) { return o.name; }).join(' and ') + '.' : ' finds nothing new.'), { tiles: found.map(function (o) { return o.tile; }), radius: ef.radius });
          break;
        case 'revealBand':
          var t0 = state.map.tiles[tile], row = t0.r, half = Math.floor(ef.rows / 2), cnt = 0, hw = ef.halfWidth || 999, lo = row - half, hi = row - half + ef.rows - 1;
          state.map.tiles.forEach(function (t) { if (t.r >= lo && t.r <= hi && Math.abs(t.q - t0.q) <= hw && !p.revealed[t.id]) { p.revealed[t.id] = 1; cnt++; } });
          log(state, pid, 'reveal', src + ' crosses the sky and lights ' + cnt + ' hexes.', { tile: tile, band: [lo, hi], q: [t0.q - hw, t0.q + hw] }); break;
        case 'revealRiver':
          cnt = 0; inRadius(state, tile, ef.radius).forEach(function (id) { var t = state.map.tiles[id]; if ((t.coast || D.terrain[t.terrain].water) && !p.revealed[id]) { p.revealed[id] = 1; cnt++; } });
          log(state, pid, 'reveal', src + ' follows the water and shows ' + cnt + ' hexes.', { tile: tile, radius: ef.radius, river: true }); break;
        case 'revealThreats':
          var seen = 0; state.priests.forEach(function (pr) { if (pr.owner !== pid && playerShrines(state, pid).some(function (o) { return dist(state, o.tile, pr.tile) <= ef.radius; })) { if (!p.revealed[pr.tile]) seen++; p.revealed[pr.tile] = 1; } });
          log(state, pid, 'reveal', src + ': ' + seen + ' hidden rival priest(s) near your shrines are seen.', { threats: true }); break;
        case 'forecast':
          p.forecasts.push({ tile: (ef.fromShrines || tile === undefined || tile === null) ? null : tile, radius: ef.radius, until: state.turn + ef.turns });
          if (p.forecasts.length > 6) p.forecasts.shift();
          break;
        case 'ward': s.shrine.ward = Math.min(ef.max || 9, s.shrine.ward + ef.amount); if (s.shrine.spec === 'beacon') s.shrine.ward = Math.min(rules.specs.beacon.wardCap, s.shrine.ward); s.needs.safety = clamp(s.needs.safety + 1, 0, 10); break;
        case 'wardRadius': playerShrines(state, pid).forEach(function (o) { if (dist(state, o.tile, tile) <= ef.radius) { o.shrine.ward = Math.min(ef.max, o.shrine.ward + ef.amount); if (o.shrine.spec === 'beacon') o.shrine.ward = Math.min(rules.specs.beacon.wardCap, o.shrine.ward); } }); break;
        case 'clearEclipse': s.shrine.eclipsed = 0; break;
        case 'clearEclipseRadius': k = 0; playerShrines(state, pid).forEach(function (o) { if (o.shrine.eclipsed && dist(state, o.tile, tile) <= ef.radius) { o.shrine.eclipsed = 0; k++; } }); if (k) log(state, pid, 'restore', src + ' lifts the eclipse from ' + k + ' shrine(s).', { tile: tile }); break;
        case 'spawnPriest':
          var at = s ? s.tile : state.settlements[p.home].tile; spawnPriest(state, pid, at, (act && act.role) || ef.role || 'emissary'); p.stats.priestsSent++;
          log(state, pid, 'priest', 'A ' + rules.roles[(act && act.role) || ef.role || 'emissary'].name.toLowerCase() + ' rises at ' + (s ? s.name : 'home') + '.', { tile: at }); break;
        case 'retrain': var role = (act && act.role) || ef.role; if (!role) break; k = 0; state.priests.forEach(function (pr) { if (pr.owner === pid && pr.tile === tile && pr.role !== role) { pr.role = role; k++; } }); if (k) log(state, pid, 'priest', k + ' priest(s) at ' + s.name + ' take up the calling of ' + rules.roles[role].name + '.', { tile: tile }); break;
        case 'buff': p.buffs.push({ stat: ef.stat, value: ef.value, turns: ef.turns, src: src }); break;
        case 'shrineBoost': s.shrine.boosts.push({ stat: ef.stat, value: ef.value, turns: ef.turns }); break;
        case 'siteBoon':
          var sites = ef.radius ? state.settlements.filter(function (o) { return dist(state, o.tile, tile) <= ef.radius && (ef.stat !== 'resist' || o.followers[pid] > 0); }) : [s];
          sites.forEach(function (o) { o.boons.push({ p: pid, stat: ef.stat, value: ef.value, turns: ef.turns }); });
          if (ef.stat === 'pressure' || ef.stat === 'zenith') { sites.forEach(function (o) { o.followers.forEach(function (f, r) { if (r !== pid && f > 0) hostile(state, pid, r, src); }); }); }
          break;
        case 'popControlled':
          k = 0; state.settlements.forEach(function (o) {
            if (k >= (ef.max || 99) || o.controlledBy !== pid || o.pop >= rules.growth.maxPop) return;
            if (ef.terrains && ef.terrains.indexOf(state.map.tiles[o.tile].terrain) < 0) return;
            growPop(o, ef.amount, rules.growth.maxPop + 1); bless(state, pid, o, ef.prosperity || 1, src); k++;
          });
          log(state, pid, 'growth', src + ': ' + k + ' of your settlements grow.', { count: k }); break;
        case 'popTarget': growPop(s, ef.amount, cap); addFollowers(state, pid, s, ef.amount); bless(state, pid, s, 2, src); log(state, pid, 'growth', src + ' brings new life to ' + s.name + '.', { tile: s.tile }); break;
        case 'popLargest': k = largestOwn(state, pid); if (k) growPop(k, ef.amount, cap); break;
        case 'faith': p.faith = r2(Math.max(0, p.faith + ef.amount)); break;
        case 'favor': p.favor = Math.max(0, Math.min(rules.economy.favorCap, p.favor + ef.amount)); break;
        case 'prosperity': if (s) s.needs.prosperity = clamp(s.needs.prosperity + ef.amount, 0, 10); break;
        case 'strike':
          var killed = 0, lost = 0, victims = {};
          // "scattered": rival priests are driven back to their god's nearest shrine (or lost if their god has none)
          if (ef.killPriests) state.priests = state.priests.filter(function (pr) {
            if (pr.tile !== s.tile || pr.owner === pid) return true;
            killed++; victims[pr.owner] = 1;
            var refuge = playerShrines(state, pr.owner).filter(function (o) { return o.tile !== s.tile; }).sort(function (a, b) { return dist(state, a.tile, s.tile) - dist(state, b.tile, s.tile) || a.id - b.id; })[0];
            if (!refuge) return false;
            pr.tile = refuge.tile; pr.from = refuge.tile; pr.dest = null; return true;
          });
          for (k = 0; k < ef.rivalLoss; k++) { var rv = topRival(s, pid); if (rv < 0) break; if (k > 0 && resistOf(state, s, rv) >= 1.5 && k % 2) continue; s.followers[rv]--; lost++; victims[rv] = 1; }
          var g = addFollowers(state, pid, s, ef.gain);
          Object.keys(victims).forEach(function (v) { hostile(state, pid, +v, src); addGrudge(state, +v, pid, rules.grudge.strike); });
          addTrust(s, pid, -1); remember(state, s, 'struck', pid); addMark(state, 'scorch', s.tile, pid, { fx: act && act.fx });
          log(state, pid, 'miracle', src + ' strikes ' + s.name + ': ' + lost + ' rival followers fall silent' + (killed ? ', ' + killed + ' priest(s) scattered' : '') + (g ? ', ' + g + ' mortal(s) turn to you' : '') + '.', { tile: s.tile, fx: 'bolt' });
          break;
        case 'weigh':
          var moved = 0;
          s.followers.forEach(function (f, rid) { if (rid === pid || !f) return; var m = Math.ceil(f * ef.fraction); s.followers[rid] -= m; s.followers[pid] += m; moved += m; hostile(state, pid, rid, src); addGrudge(state, rid, pid, rules.grudge.strike); });
          if (moved) p.stats.convertedFromRivals += moved;
          remember(state, s, 'weighed', pid);
          log(state, pid, 'miracle', src + ' weighs the hearts of ' + s.name + ': ' + moved + ' turn to you.', { tile: s.tile, fx: 'feather' }); break;
        case 'sway':
          var rid2 = topRival(s, pid), mv = 0;
          if (rid2 >= 0) { mv = Math.min(ef.count, s.followers[rid2]); s.followers[rid2] -= mv; s.followers[pid] += mv; p.stats.convertedFromRivals += mv; hostile(state, pid, rid2, src); addGrudge(state, rid2, pid, rules.grudge.strike); }
          remember(state, s, 'swayed', pid);
          log(state, pid, 'miracle', src + ' shines over ' + s.name + ': ' + mv + ' follower(s) of ' + (rid2 >= 0 ? state.players[rid2].name : 'no one') + ' turn to you.', { tile: s.tile, fx: 'star' }); break;
        case 'shrineHit': hitShrine(state, pid, s, ef.ward, ef.eclipse, src, true); break;
        case 'delayedHit':
          state.pending.push({ id: state.nextPending++, by: pid, tile: tile, ward: ef.ward, eclipse: ef.eclipse, at: state.turn + ef.delay, src: src });
          s.shrine.threat = { by: pid, dmg: ef.ward, until: state.turn + ef.delay, storm: true };
          hostile(state, pid, s.shrine.owner, src);
          log(state, pid, 'threat', src + ' gathers over the shrine of ' + state.players[s.shrine.owner].name + ' at ' + s.name + '. It will break next round.', { tile: s.tile, owner: s.shrine.owner, fx: 'storm' }); break;
        case 'raiseShrine':
          p.faith = r2(p.faith - Math.round(shrineCost(state, pid, s.tile) * ef.costMult)); placeShrine(state, pid, s);
          log(state, pid, 'shrine', src + ': a ' + shrineDef(state, pid).name + ' rises at ' + s.name + '.', { tile: s.tile }); break;
        case 'waterBless':
          var list = state.settlements.filter(function (o) { return o === s || (o.followers[pid] > 0 && state.map.tiles[o.tile].coast && dist(state, o.tile, tile) <= ef.radius); })
            .sort(function (a, b) { return (a === s ? -1 : 0) - (b === s ? -1 : 0) || dist(state, a.tile, tile) - dist(state, b.tile, tile) || a.id - b.id; }).slice(0, ef.max);
          list.forEach(function (o) { growPop(o, ef.pop, rules.growth.maxPop + 2); bless(state, pid, o, ef.prosperity, src); });
          p.faith = r2(p.faith + ef.faithPer * list.length);
          log(state, pid, 'growth', src + ': sweet water rises in ' + list.length + ' town(s).', { tiles: list.map(function (o) { return o.tile; }) }); break;
        case 'rains':
          var rl = state.settlements.filter(function (o) { return o.followers[pid] > 0 && dist(state, o.tile, tile) <= ef.radius; }).sort(function (a, b) { return dist(state, a.tile, tile) - dist(state, b.tile, tile) || a.id - b.id; }).slice(0, ef.max);
          rl.forEach(function (o) { growPop(o, ef.pop, rules.growth.maxPop + 2); bless(state, pid, o, ef.prosperity, src); });
          var broke = 0; if (ef.breakDrought) state.climate.fronts.forEach(function (f) { if (f.kind === 'drought' && f.phase !== 'after' && rl.some(function (o) { return dist(state, f.tile, o.tile) <= f.radius; })) { f.phase = 'after'; f.t1 = state.turn; broke++; } });
          p.faith = r2(p.faith + ef.faithPer * rl.length);
          log(state, pid, 'growth', src + ': rain falls on ' + rl.length + ' town(s)' + (broke ? ' and the drought breaks' : '') + '.', { tiles: rl.map(function (o) { return o.tile; }), fx: 'rain' }); break;
        case 'restore':
          var regain = Math.max(0, Math.min(ef.pop || 0, s.peak - s.pop)); s.pop += regain;
          if (ef.prosperity) s.needs.prosperity = clamp(s.needs.prosperity + ef.prosperity, 0, 10);
          if (ef.safety) s.needs.safety = clamp(s.needs.safety + ef.safety, 0, 10);
          addTrust(s, pid, 1); remember(state, s, 'restored', pid);
          log(state, pid, 'restore', src + ' restores ' + s.name + (regain ? ': ' + regain + ' return home' : '') + '.', { tile: s.tile }); break;
        case 'trust':
          k = 0; state.settlements.forEach(function (o) { if (o.followers[pid] > 0 && dist(state, o.tile, tile) <= ef.radius) { addTrust(o, pid, ef.amount); k++; } });
          if (ef.faithPer) p.faith = r2(p.faith + ef.faithPer * k); break;
        case 'faithPerRoute': p.faith = r2(p.faith + ef.amount * activeRoutes(state, pid).length); break;
        case 'followersLargest': k = largestOwn(state, pid); if (k) { if (unaffiliated(k) < ef.amount) growPop(k, ef.amount - unaffiliated(k), cap); addFollowers(state, pid, k, ef.amount); } break;
        case 'loseFollowersLargest': k = largestOwn(state, pid); if (k) { k.followers[pid] = Math.max(0, k.followers[pid] - ef.amount); remember(state, k, 'neglected', pid); addTrust(k, pid, -1); } break;
        case 'freePriest': var hs = playerShrines(state, pid)[0]; if (hs) { spawnPriest(state, pid, hs.tile, 'emissary'); p.stats.priestsSent++; } break;
        case 'shrineDiscount': p.flags.shrineDiscount = ef.mult; break;
        case 'wardAll': playerShrines(state, pid).forEach(function (o) { o.shrine.ward = Math.min(o.shrine.spec === 'beacon' ? 3 : 5, o.shrine.ward + ef.amount); }); break;
        case 'wardRandom': var lst = playerShrines(state, pid); if (lst.length) { var o = R.pick(state.rng, lst); o.shrine.ward = Math.min(o.shrine.spec === 'beacon' ? 3 : 5, o.shrine.ward + ef.amount); } break;
        default: throw new Error('unknown effect ' + ef.type);
      }
    }
    function largestOwn(state, pid) {
      var best = null; state.settlements.forEach(function (s) { if (s.followers[pid] > 0 && (!best || s.followers[pid] > best.followers[pid])) best = s; });
      return best || state.settlements[state.players[pid].home];
    }
    function topRival(s, pid) { var best = -1, bf = 0; s.followers.forEach(function (f, r) { if (r !== pid && f > bf) { bf = f; best = r; } }); return best; }
    /* Ward damage after every defence: Sanctuary or Warden (miracles only, -1), domain shields, Gates of Arinna, groves. A 2+ hit always does at least 1. */
    function hitDamage(state, s, ward, miracle) {
      var owner = s.shrine.owner, op = state.players[owner], red = 0;
      if (miracle && (s.shrine.spec === 'sanctuary' || wardenAt(state, owner, s.tile))) red++;
      if (op.mods.wardShield && s.shrine.ward >= op.mods.wardShield.minWard) red += op.mods.wardShield.reduce;
      if (boonOf(s, owner, 'shield')) red += 1;
      if (miracle) state.landmarks.forEach(function (l) { if (l.holder === owner && l.kind === 'grove' && dist(state, l.tile, s.tile) <= rules.landmarks.kinds.grove.radius) red += rules.landmarks.kinds.grove.shield; });
      var d = Math.max(0, ward - red);
      if (ward >= 2 && d < 1) d = 1;
      if (!miracle && ward >= 1 && d < 1 && s.shrine.spec !== 'sanctuary' && !boonOf(s, owner, 'shield')) d = 1; // basic eclipses always bite unless the shrine is specifically guarded
      return d;
    }
    function hitShrine(state, pid, s, ward, ecl, src, miracle) {
      var owner = s.shrine.owner, op = state.players[owner], dmg = hitDamage(state, s, ward, miracle);
      var dur = ecl - op.mods.eclipseShorten - ((s.shrine.spec === 'sanctuary' || wardenAt(state, owner, s.tile)) ? 1 : 0);
      dur = Math.max(1, dur);
      hostile(state, pid, owner, src);
      s.shrine.ward -= dmg; s.shrine.eclipsed = Math.max(s.shrine.eclipsed, dur);
      var p = state.players[pid]; p.stats.eclipses++; p.hits++;
      if (p.mods.favorOnHit && p.hits % p.mods.favorOnHit.per === 0 && p.favorFromHits < p.mods.favorOnHit.max) { p.favor = Math.min(rules.economy.favorCap, p.favor + 1); p.favorFromHits++; }
      addGrudge(state, owner, pid, rules.grudge.hit);
      s.needs.safety = clamp(s.needs.safety - 1, 0, 10);
      if (op.mods.defendResist) s.boons.push({ p: owner, stat: 'resist', value: op.mods.defendResist.mult, turns: op.mods.defendResist.turns });
      if (s.shrine.ward <= 0) {
        log(state, pid, 'topple', src + ' topples the ' + D.shrines[s.shrine.type].name + ' of ' + op.name + ' at ' + s.name + '.', { tile: s.tile, fx: 'topple', owner: owner, type: s.shrine.type });
        s.shrine = null; p.stats.toppled++;
        remember(state, s, 'toppled', pid, { owner: owner }); addTrust(s, pid, -1);
        addMark(state, 'ruin', s.tile, owner, { type: D.factions[op.faction].shrine });
        state.pending = state.pending.filter(function (x) { return x.tile !== s.tile; });
      } else {
        s.shrine.threat = { by: pid, dmg: dmg, until: state.turn + 1 };
        addMark(state, 'eclipse', s.tile, pid);
        if (op.mods.stormGuard && state.turn - s.shrine.guardUsed >= op.mods.stormGuard.cooldown) { s.shrine.ward = Math.min(maxWard(state, s), s.shrine.ward + op.mods.stormGuard.amount); s.shrine.guardUsed = state.turn; }
        log(state, pid, 'eclipse', src + ' darkens the shrine of ' + op.name + ' at ' + s.name + ' (Ward ' + s.shrine.ward + ').', { tile: s.tile, fx: 'eclipse', owner: owner, dmg: dmg });
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
          p.buffs = p.buffs.filter(function (b) { return b.stat !== 'omenFree'; });
          runEffect(state, pid, { type: 'reveal', radius: omenRadius(state, pid) }, action.tile, 'Read Omens');
          break;
        case 'dream':
          p.favor -= A.dream.favor; p.cooldowns.dream = dreamCooldown(state, pid);
          runEffect(state, pid, { type: 'revealNearestSettlements', count: 1, radius: A.dream.radius + 1 }, null, 'A dream vision');
          break;
        case 'shrine':
          s = settlementAt(state, action.tile); p.faith = r2(p.faith - shrineCost(state, pid, action.tile)); p.flags.shrineDiscount = 1;
          placeShrine(state, pid, s);
          log(state, pid, 'shrine', p.name + ' raises a ' + shrineDef(state, pid).name + ' at ' + s.name + '.', { tile: s.tile });
          break;
        case 'priest':
          s = settlementAt(state, action.tile); p.faith = r2(p.faith - priestCost(state, pid));
          var npr = spawnPriest(state, pid, s.tile, action.role || 'emissary'); p.stats.priestsSent++;
          if (action.dest !== undefined && action.dest !== null && state.map.tiles[action.dest] && passableFor(state, pid, action.dest)) npr.dest = action.dest;
          log(state, pid, 'priest', 'A ' + rules.roles[npr.role].name.toLowerCase() + ' is ordained at ' + s.name + '.', { tile: s.tile, priest: npr.id, role: npr.role });
          break;
        case 'retrain':
          var rp = state.priests.find(function (x) { return x.id === action.priest; });
          if (p.mods.freeRetrain && !p.flags.retrainUsed) p.flags.retrainUsed = true; else p.faith = r2(p.faith - A.retrain.faith);
          rp.role = action.role;
          log(state, pid, 'priest', 'A priest at ' + settlementAt(state, rp.tile).name + ' takes the calling of ' + rules.roles[action.role].name + '.', { tile: rp.tile, priest: rp.id, role: rp.role });
          break;
        case 'movePriest':
          state.priests.find(function (x) { return x.id === action.priest; }).dest = action.tile;
          break;
        case 'eclipse':
          s = settlementAt(state, action.tile); p.favor -= eclipseCost(state, pid, action.tile); p.cooldowns.eclipse = A.eclipse.cooldown;
          hitShrine(state, pid, s, A.eclipse.wardDamage, A.eclipse.duration, 'An eclipse', false);
          break;
        case 'power':
          pw = D.powers[action.power];
          p.faith = r2(p.faith - pw.cost.faith); p.favor -= pw.cost.favor; p.cooldowns[pw.id] = pw.cooldown;
          p.stats.powers[pw.id] = (p.stats.powers[pw.id] || 0) + 1;
          log(state, pid, 'power', p.name + ' invokes ' + pw.name + '.', { power: pw.id, tile: action.tile === undefined ? null : action.tile, fx: pw.vfx || pw.icon, x: pw.x });
          pw.effects.forEach(function (ef) { runEffect(state, pid, ef, action.tile, pw.name, { role: action.role, fx: pw.vfx }); });
          break;
        case 'specialize':
          s = settlementAt(state, action.tile); var SP = rules.specs;
          p.faith = r2(p.faith - SP.faith); p.favor -= SP.favor; p.stats.specs++;
          s.shrine.spec = action.spec;
          if (action.spec === 'oracle') revealAround(state, pid, s.tile, SP.oracle.revealNow);
          if (action.spec === 'sanctuary') s.shrine.ward = Math.min(maxWard(state, s), s.shrine.ward + SP.sanctuary.ward);
          if (action.spec === 'beacon') s.shrine.ward = clamp(s.shrine.ward - SP.beacon.wardLoss, 1, SP.beacon.wardCap);
          remember(state, s, 'consecrated', pid, { spec: action.spec });
          log(state, pid, 'specialize', p.name + ' consecrates the shrine at ' + s.name + ' as a ' + SP[action.spec].name + '.', { tile: s.tile, spec: action.spec });
          break;
        case 'covenant':
          s = settlementAt(state, action.tile); var K = rules.covenants.kinds[action.kind];
          var cv = { id: state.nextCov++, p: pid, kind: action.kind, s: s.id, t0: state.turn, t1: state.turn + K.turns, base: s.followers[pid], status: 'active' };
          state.covenants.push(cv);
          remember(state, s, 'covenant', pid, { kind: action.kind, id: cv.id });
          log(state, pid, 'covenant', p.name + ' swears a ' + K.name + ' to ' + s.name + ' (until turn ' + cv.t1 + ').', { tile: s.tile, covenant: cv.id, kind: action.kind, until: cv.t1 });
          break;
        case 'abandon':
          var ac = state.covenants.find(function (c) { return c.id === action.covenant; });
          p.favor = Math.max(0, p.favor - rules.covenants.abandonFavor);
          resolveCovenant(state, ac, false, 'abandoned');
          break;
        case 'counterRite':
          s = settlementAt(state, action.tile); var th = s.shrine.threat, att = state.players[th.by];
          p.favor -= counterCost(state, pid); p.stats.counters++;
          if (th.storm) state.pending = state.pending.filter(function (x) { return !(x.tile === s.tile && x.by === th.by); });
          else s.shrine.ward = Math.min(maxWard(state, s), s.shrine.ward + th.dmg);
          s.shrine.eclipsed = 0; s.shrine.threat = null;
          att.favor = Math.max(0, att.favor - rules.counterRite.attackerFavorLoss);
          addTrust(s, pid, 1); remember(state, s, 'defended', pid, { from: th.by });
          log(state, pid, 'counter', p.name + ' answers ' + att.name + ' at ' + s.name + ' with a counter-rite' + (th.storm ? ': the storm disperses.' : ': the shrine is restored.'), { tile: s.tile, against: th.by, fx: 'counter' });
          break;
        case 'route':
          var rt = state.routes[action.route];
          p.faith = r2(p.faith - routeCost(state, pid)); rt.owner = pid; rt.status = 'active'; rt.since = state.turn; rt.bad = 0; p.stats.routes++;
          remember(state, state.settlements[rt.a], 'pilgrims', pid); remember(state, state.settlements[rt.b], 'pilgrims', pid);
          log(state, pid, 'route', p.name + ' consecrates the pilgrim road from ' + state.settlements[rt.a].name + ' to ' + state.settlements[rt.b].name + '.', { route: rt.id, tile: state.settlements[rt.a].tile, tiles: rt.path });
          break;
        case 'propose':
          p.flags.proposed = true;
          state.proposals.push({ id: state.nextDiplo++, kind: action.kind, from: pid, to: action.to, turn: state.turn, status: 'pending' });
          if (state.proposals.length > 30) state.proposals.shift();
          log(state, pid, 'envoy', p.name + ' sends an envoy to ' + state.players[action.to].name + ' proposing a ' + action.kind + '.', { to: action.to, kind: action.kind });
          break;
        case 'answer':
          var pr2 = state.proposals.find(function (x) { return x.id === action.id; }), from = state.players[pr2.from];
          pr2.status = action.accept ? 'accepted' : 'rejected';
          if (action.accept) acceptProposal(state, pr2);
          else log(state, pid, 'envoy', p.name + ' turns away the envoy of ' + from.name + '.', { to: pr2.from, kind: pr2.kind, rejected: true });
          break;
        case 'endTurn':
          endTurn(state);
          break;
      }
      if (action.type !== 'endTurn') updateControl(state, false);
      return null;
    }
    function step(state, action) { var n = clone(state); var err = apply(n, action); if (err) throw new Error(err); return n; }
    function acceptProposal(state, pr) {
      var D2 = rules.diplomacy, a = state.players[pr.from], b = state.players[pr.to];
      if (pr.kind === 'festival') {
        if (a.faith < D2.festivalFaith || b.faith < D2.festivalFaith) { pr.status = 'failed'; log(state, pr.to, 'envoy', 'The festival cannot be paid for.', null); return; }
        a.faith = r2(a.faith - D2.festivalFaith); b.faith = r2(b.faith - D2.festivalFaith);
      }
      var t = { id: state.nextDiplo++, kind: pr.kind, a: pr.from, b: pr.to, t0: state.turn, t1: state.turn + (pr.kind === 'festival' ? 1 : pr.kind === 'truce' ? D2.truceTurns : D2.borderTurns), status: 'active' };
      state.treaties.push(t); if (state.treaties.length > 30) state.treaties.shift();
      a.stats.treaties++; b.stats.treaties++;
      log(state, pr.to, 'treaty', b.name + ' accepts the ' + pr.kind + ' offered by ' + a.name + (pr.kind === 'festival' ? '; the feast is held next turn.' : ' until turn ' + t.t1 + '.'), { treaty: t.id, kind: pr.kind, a: pr.from, b: pr.to, until: t.t1 });
    }

    function endTurn(state) {
      var n = state.players.length, i = state.current;
      do { i++; } while (i < n && state.players[i].eliminated);
      if (i >= n) { resolveRound(state); if (state.over) return; i = 0; while (state.players[i].eliminated) i++; }
      state.current = i;
      beginPlayerTurn(state);
    }
    function beginPlayerTurn(state) {
      var p = state.players[state.current], E = rules.events;
      p.flags.retrainUsed = false; p.flags.proposed = false;
      if (state.turn >= E.firstTurn && (state.turn - E.firstTurn) % E.everyTurns === 0 && !p.pendingEvent) {
        var pool = data.events.filter(function (e) { return p.eventsSeen.indexOf(e.id) < 0 && eventAllowed(state, p, e); });
        if (!pool.length) { p.eventsSeen = []; pool = data.events.filter(function (e) { return eventAllowed(state, p, e); }); }
        var ev = R.weighted(state.rng, pool, function (e) { return eventWeight(state, p, e); });
        p.pendingEvent = { id: ev.id }; p.eventsSeen.push(ev.id);
        log(state, p.id, 'card', p.name + ' draws an event: ' + ev.title + '.', { event: ev.id });
      }
    }
    function eventAllowed(state, p, e) { return !e.factions || e.factions.indexOf(p.faction) >= 0; }
    /* Events follow the weather: a card tied to a climate is three times as likely while that weather lies over one of the player's towns. */
    function eventWeight(state, p, e) {
      var w = e.weight;
      if (e.climate && state.settlements.some(function (s) { return s.followers[p.id] > 0 && frontsAt(state, s.tile, e.climate).length; })) w *= 3;
      if (e.age && e.age !== state.age) w *= 0.5;
      return w;
    }

    function resolveRound(state) {
      var C = rules.conversion, np = state.players.length, G = rules.growth, N = rules.needs, CL = rules.climate;
      // 1. priests walk
      state.priests.forEach(function (pr) {
        pr.from = pr.tile;
        if (pr.dest === null || pr.dest === pr.tile) return;
        var owner = state.players[pr.owner], role = roleOf(pr), mv = role.move + (pr.role === 'seer' ? owner.mods.seerMove : 0);
        var here = settlementAt(state, pr.tile), there = settlementAt(state, pr.dest), road = null;
        if (here && there) road = state.routes.find(function (r) { return r.owner === pr.owner && r.status === 'active' && ((r.a === here.id && r.b === there.id) || (r.b === here.id && r.a === there.id)); });
        if (road) mv += rules.routes.move * (routeMult(state, pr.owner) > 1 ? 2 : 1);
        if (frontsAt(state, pr.tile, 'frost').length && state.map.tiles[pr.tile].t < CL.kinds.frost.coldOnly) mv += CL.kinds.frost.priestMove;
        mv = Math.max(1, mv);
        var path = road ? (road.path[0] === pr.tile ? road.path.slice() : road.path.slice().reverse()).slice(0, mv + 1) : pathStep(state, pr.owner, pr.tile, pr.dest, mv);
        if (!path) { pr.dest = null; return; }
        var sight = role.sight + owner.mods.priestSight;
        path.forEach(function (t) { revealAround(state, pr.owner, t, sight); });
        pr.tile = path[path.length - 1];
      });
      // 2. landmarks: a lone god's priest standing on a landmark claims it
      state.landmarks.forEach(function (l) {
        var here = {}; state.priests.forEach(function (pr) { if (pr.tile === l.tile) here[pr.owner] = 1; });
        var who = Object.keys(here).map(Number);
        if (who.length === 1 && who[0] !== l.holder) {
          var prevH = l.holder; l.holder = who[0]; l.since = state.turn; state.players[who[0]].stats.landmarks++;
          if (prevH >= 0) addGrudge(state, prevH, who[0], 1);
          log(state, who[0], 'landmark', state.players[who[0]].name + ' claims the ' + rules.landmarks.kinds[l.kind].name + (prevH >= 0 ? ' from ' + state.players[prevH].name : '') + '.', { tile: l.tile, landmark: l.id, kind: l.kind });
        }
        if (l.holder >= 0 && l.kind === 'summit') revealAround(state, l.holder, l.tile, rules.landmarks.kinds.summit.reveal);
      });
      // 3. conversion
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
            var cost = C.rivalCost * resistOf(state, s, rv);
            if (prog < cost) break;
            s.followers[rv]--; s.followers[pid]++; prog -= cost; p.stats.converted++; p.stats.convertedFromRivals++;
            var fr = p.mods.favorOnRivalConvert;
            if (fr) { p.rivalConverted++; if (p.rivalConverted % fr.per === 0 && p.favorFromConvert < fr.max) { p.favor = Math.min(rules.economy.favorCap, p.favor + fr.amount); p.favorFromConvert += fr.amount; } }
          }
          s.progress[pid] = r2(Math.min(prog, C.progressCap));
        }
      });
      updateControl(state, false);
      resolveRoutes(state);
      // 4. income
      state.players.forEach(function (p) { if (p.eliminated) return; var inc = incomeOf(state, p.id); p.faith = r2(p.faith + inc); p.stats.faithEarned = r2(p.stats.faithEarned + inc); });
      // 5. growth (needs- and weather-gated)
      state.settlements.forEach(function (s) {
        var hungry = s.needs.prosperity <= N.hungry, dry = frontsAt(state, s.tile, 'drought').length > 0;
        if (state.turn % G.everyTurns === 0 && s.pop < G.maxPop && !hungry && !dry) {
          growPop(s, G.amount + (s.needs.prosperity >= N.content && s.needs.safety >= 5 ? N.contentGrowth : 0), G.maxPop);
        }
        s.boons.forEach(function (b) { if (b.stat === 'growth' && state.turn % 2 === 0 && s.pop < G.maxPop) growPop(s, b.value, G.maxPop); });
      });
      state.players.forEach(function (p) {
        if (p.eliminated) return;
        var cg = p.mods.controlledGrowth;
        if (cg && state.turn % cg.n === 0) { var k = 0; state.settlements.forEach(function (s) { if (k < cg.max && s.controlledBy === p.id && s.pop < G.maxPop && s.needs.prosperity > N.hungry) { growPop(s, cg.amount, G.maxPop); k++; } }); }
        p.mods.favorEvery.forEach(function (fe) { if (state.turn % fe.n === 0 && (!fe.ages || fe.ages.indexOf(state.age) >= 0)) p.favor = Math.min(rules.economy.favorCap, p.favor + fe.amount); });
        var fc = p.mods.favorFromControl;
        if (fc && state.turn % fc.n === 0) p.favor = Math.min(rules.economy.favorCap, p.favor + Math.min(fc.max, Math.floor(controlledCount(state, p.id) / fc.per)));
        var sf = p.mods.sanctuaryFavor;
        if (sf && state.turn % sf.n === 0) { var old = playerShrines(state, p.id).filter(function (s) { return state.turn - s.shrine.built >= sf.minAge; }); if (old.length) p.favor = Math.min(rules.economy.favorCap, p.favor + sf.amount + (old.some(function (s) { return s.shrine.spec === 'sanctuary'; }) ? sf.bonus : 0)); }
        p.mods.wardRegen.forEach(function (wr) { if (state.turn % wr.n === 0) playerShrines(state, p.id).forEach(function (s) { if (s.shrine.ward < wr.below && s.shrine.ward < maxWard(state, s)) { s.shrine.ward = Math.min(maxWard(state, s), s.shrine.ward + wr.amount); } if (wr.safety && s.shrine.ward < 2) state.settlements.forEach(function (o) { if (dist(state, o.tile, s.tile) <= 1) o.needs.safety = clamp(o.needs.safety + wr.safety, 0, 10); }); }); });
      });
      state.landmarks.forEach(function (l) { if (l.holder >= 0 && l.kind === 'summit' && state.turn % rules.landmarks.kinds.summit.favorEvery === 0) { var h = state.players[l.holder]; h.favor = Math.min(rules.economy.favorCap, h.favor + 1); } });
      // 6. mortal needs: prosperity and safety drift toward targets set by land, patrons, weather and protection
      resolveNeeds(state);
      // 7. timers (before weather and delayed miracles, so an eclipse they cause lasts into the next round)
      state.players.forEach(function (p) {
        Object.keys(p.cooldowns).forEach(function (k) { if (p.cooldowns[k] > 0) p.cooldowns[k]--; });
        p.buffs.forEach(function (b) { b.turns--; }); p.buffs = p.buffs.filter(function (b) { return b.turns > 0; });
        p.forecasts = p.forecasts.filter(function (f) { return f.until > state.turn; });
        p.flags.omenUsed = false;
      });
      state.settlements.forEach(function (s) {
        s.boons.forEach(function (b) { b.turns--; }); s.boons = s.boons.filter(function (b) { return b.turns > 0; });
        if (!s.shrine) return;
        if (s.shrine.eclipsed > 0) s.shrine.eclipsed--;
        s.shrine.boosts.forEach(function (b) { b.turns--; }); s.shrine.boosts = s.shrine.boosts.filter(function (b) { return b.turns > 0; });
        if (s.shrine.threat && s.shrine.threat.until < state.turn + 1 && !s.shrine.threat.storm) s.shrine.threat = null;
        if (s.shrine.spec === 'oracle') revealAround(state, s.shrine.owner, s.tile, rules.specs.oracle.revealEach);
      });
      // 8. climate
      resolveClimate(state);
      // 9. covenants, treaties, proposals, delayed miracles
      resolveCovenants(state);
      resolveDiplomacy(state);
      state.pending.slice().forEach(function (x) {
        if (x.at > state.turn) return;
        state.pending = state.pending.filter(function (y) { return y !== x; });
        var s = settlementAt(state, x.tile);
        if (s.shrine && s.shrine.owner !== x.by && !state.players[x.by].eliminated) { if (s.shrine.threat && s.shrine.threat.storm) s.shrine.threat = null; hitShrine(state, x.by, s, x.ward, x.eclipse, x.src, true); addMark(state, 'storm', s.tile, x.by); }
      });
      state.marks = state.marks.filter(function (m) { return !m.until || m.until > state.turn; });
      // 10. grudges fade
      if (state.turn % rules.grudge.decayEvery === 0) state.players.forEach(function (p) { p.grudge = p.grudge.map(function (g) { return Math.max(0, g - 1); }); });
      // 11. elimination
      state.players.forEach(function (p) {
        if (p.eliminated) return;
        if (followersOf(state, p.id) === 0 && playerShrines(state, p.id).length === 0 && playerPriests(state, p.id).length === 0) {
          p.eliminated = true; log(state, p.id, 'eliminated', p.name + ' is forgotten. No mortal remembers their name.', null);
          state.routes.forEach(function (r) { if (r.owner === p.id) { r.owner = -1; r.status = 'open'; } });
        }
      });
      // 12. victory
      var tp = totalPop(state), V = rules.victory;
      state.players.forEach(function (p) { var sh = followersOf(state, p.id) / tp; if (sh > p.stats.peakShare) p.stats.peakShare = r2(sh); });
      var alive = state.players.filter(function (p) { return !p.eliminated; });
      if (state.mode.kind === 'scenario') { if (scenarioCheck(state)) return; }
      if (alive.length === 1) return finish(state, alive[0].id, 'dominion');
      if (state.mode.kind === 'alt' && altCheck(state, alive)) return;
      if (state.turn >= V.ascendancyMinTurn) {
        var best = null, bs = 0;
        alive.forEach(function (p) { var sh = followersOf(state, p.id) / tp; if (sh >= V.ascendancyShare && sh > bs) { bs = sh; best = p; } });
        if (best) return finish(state, best.id, 'ascendancy');
      }
      if (state.turn >= state.maxTurns) {
        if (state.mode.kind === 'scenario') return scenarioTimeout(state);
        var ranked = alive.map(function (p) { return { p: p, sc: scoreOf(state, p.id), f: followersOf(state, p.id) }; })
          .sort(function (a, b) { return b.sc - a.sc || b.f - a.f || a.p.id - b.p.id; });
        return finish(state, ranked[0].p.id, 'twilight');
      }
      state.turn++;
      var na = ageOf(state.turn);
      if (na.id !== state.age) { state.age = na.id; log(state, -1, 'age', na.name + ' begins. ' + na.text, { age: na.id }); }
    }
    /* A consecrated road stays active while its god has followers at both ends, no rival controls either end, and no shrine of the
     * owner at an end is eclipsed. A disrupted road gives nothing; after rules.routes.lapse (+ domain grace) disrupted rounds it lapses. */
    function resolveRoutes(state) {
      state.routes.forEach(function (r) {
        if (r.owner < 0) return;
        var a = state.settlements[r.a], b = state.settlements[r.b], o = r.owner, p = state.players[o];
        var ok = a.followers[o] > 0 && b.followers[o] > 0 && [a, b].every(function (x) { return x.controlledBy < 0 || x.controlledBy === o; }) && [a, b].every(function (x) { return !(x.shrine && x.shrine.owner === o && x.shrine.eclipsed > 0); });
        if (ok) { if (r.status !== 'active') log(state, o, 'route', 'Pilgrims walk again between ' + a.name + ' and ' + b.name + '.', { route: r.id, restored: true, tile: a.tile }); r.status = 'active'; r.bad = 0; return; }
        if (r.status === 'active') log(state, o, 'routeDisrupted', 'The road from ' + a.name + ' to ' + b.name + ' is cut.', { route: r.id, tile: a.tile });
        r.status = 'disrupted'; r.bad++;
        if (r.bad > rules.routes.lapse + p.mods.routeGrace) {
          log(state, o, 'routeLapsed', 'The pilgrim road from ' + a.name + ' to ' + b.name + ' falls out of use.', { route: r.id, tile: a.tile });
          r.owner = -1; r.status = 'open'; r.since = null; r.bad = 0;
        }
      });
    }
    function resolveNeeds(state) {
      var N = rules.needs;
      state.settlements.forEach(function (s) {
        var t = state.map.tiles[s.tile], fert = D.terrain[t.terrain].fertility, ctrl = s.controlledBy, cp = ctrl >= 0 ? state.players[ctrl] : null;
        var tp = N.start.prosperityBase + fert * N.start.prosperityPerFertility + (ctrl >= 0 ? 1 : 0) + (marksAt(state, s.tile, 'blessed').length ? 1 : 0);
        if (cp && cp.mods.waterProsperity && t.coast) tp += cp.mods.waterProsperity;
        state.landmarks.forEach(function (l) { if (l.kind === 'spring' && l.holder >= 0 && dist(state, l.tile, s.tile) <= rules.landmarks.kinds.spring.radius) tp += rules.landmarks.kinds.spring.prosperity; });
        tp = clamp(Math.round(tp), 0, 10);
        var step = cp && cp.mods.climateResist < 1 && s.needs.prosperity < tp ? 2 : 1;
        if (s.needs.prosperity < tp) s.needs.prosperity = Math.min(tp, s.needs.prosperity + step); else if (s.needs.prosperity > tp) s.needs.prosperity--;
        var ts = N.safetyTarget + (s.shrine && s.shrine.ward >= 3 ? 1 : 0) - (marksAt(state, s.tile, 'scorch').length ? 2 : 0);
        if (state.settlements.some(function (o) { return o.shrine && o.shrine.spec === 'sanctuary' && dist(state, o.tile, s.tile) <= 1; })) ts += N.sanctuarySafety;
        if (state.priests.some(function (pr) { return pr.tile === s.tile && pr.role === 'warden'; })) ts += N.wardenSafety;
        ts = clamp(ts, 0, 10);
        if (s.needs.safety < ts) s.needs.safety++; else if (s.needs.safety > ts) s.needs.safety--;
        // unrest: a hungry town slowly abandons the god it kneels to
        if (ctrl >= 0 && s.needs.prosperity <= N.hungry) {
          s.unrest = (s.unrest || 0) + 1;
          if (s.unrest >= N.unrestEvery && s.followers[ctrl] > 0) { s.followers[ctrl]--; s.unrest = 0; addTrust(s, ctrl, -1); remember(state, s, 'hunger', ctrl); log(state, ctrl, 'unrest', s.name + ' goes hungry; a family turns away from ' + cp.name + '.', { tile: s.tile }); }
        } else s.unrest = 0;
      });
    }
    function resolveClimate(state) {
      var CL = rules.climate, fronts = state.climate.fronts;
      fronts.forEach(function (f) {
        var K = CL.kinds[f.kind];
        if (f.phase === 'forecast' && state.turn + 1 >= f.t0) { f.phase = 'active'; log(state, -1, 'weather', K.name + ' arrives.', { tile: f.tile, kind: f.kind, radius: f.radius, front: f.id }); }
        else if (f.phase === 'active' && state.turn >= f.t1) { f.phase = 'after'; f.end = state.turn + CL.after; endFront(state, f); }
        else if (f.phase === 'active') applyFront(state, f);
      });
      state.climate.fronts = fronts.filter(function (f) { return !(f.phase === 'after' && state.turn >= (f.end || 0)); });
      // aftermath recovery
      state.climate.fronts.forEach(function (f) { if (f.phase !== 'after') return; state.settlements.forEach(function (s) { if (dist(state, f.tile, s.tile) <= f.radius && (f.kind === 'drought' || f.kind === 'frost')) s.needs.prosperity = clamp(s.needs.prosperity + 1, 0, 10); }); });
      if (state.climate.fronts.length < CL.maxFronts && R.next(state.rng) < CL.spawnChance && state.turn + CL.lead + 1 < state.maxTurns) {
        var kinds = Object.keys(CL.kinds), age = state.age, kind = R.weighted(state.rng, kinds, function (k) { return CL.kinds[k].weights[age] || 0.01; });
        var anchor = R.weighted(state.rng, state.settlements, function (s) { return 1 + s.followers.reduce(function (a, b) { return a + b; }, 0); }), rad = CL.radius[0] + R.int(state.rng, CL.radius[1] - CL.radius[0] + 1);
        var t0 = state.turn + CL.lead;
        fronts = state.climate.fronts;
        fronts.push({ id: state.climate.next++, kind: kind, tile: anchor.tile, radius: rad, phase: 'forecast', t0: t0, t1: t0 + CL.kinds[kind].duration - 1, hitDone: false });
        log(state, -1, 'forecast', CL.kinds[kind].name + ' gathers.', { tile: anchor.tile, kind: kind, radius: rad, hidden: true });
      }
    }
    function harm(state, s, amt) { var cp = s.controlledBy >= 0 ? state.players[s.controlledBy] : null; return Math.round(amt * (cp ? cp.mods.climateResist : 1)); }
    function applyFront(state, f) {
      var K = rules.climate.kinds[f.kind];
      state.settlements.forEach(function (s) {
        if (dist(state, f.tile, s.tile) > f.radius) return;
        if (K.coldOnly && state.map.tiles[s.tile].t >= K.coldOnly) return;
        if (K.prosperity) s.needs.prosperity = clamp(s.needs.prosperity + (K.prosperity < 0 ? harm(state, s, K.prosperity) : K.prosperity), 0, 10);
        if (K.safety) s.needs.safety = clamp(s.needs.safety + harm(state, s, K.safety), 0, 10);
        if (f.kind === 'storm' && !f.hitDone && s.shrine && s.shrine.spec !== 'sanctuary' && !wardenAt(state, s.shrine.owner, s.tile)) {
          s.shrine.eclipsed = Math.max(s.shrine.eclipsed, K.eclipse); addMark(state, 'storm', s.tile, -1);
          var op = state.players[s.shrine.owner];
          if (op.mods.stormGuard && state.turn - s.shrine.guardUsed >= op.mods.stormGuard.cooldown) { s.shrine.ward = Math.min(maxWard(state, s), s.shrine.ward + op.mods.stormGuard.amount); s.shrine.guardUsed = state.turn; }
          remember(state, s, 'storm', -1);
        }
        if (f.kind === 'drought' && !f.hitDone) { remember(state, s, 'drought', -1); addMark(state, 'drought', s.tile, -1); }
        state.players.forEach(function (p) {
          var cb = p.mods.climateBoon; if (!cb || s.controlledBy !== p.id || cb.kinds.indexOf(f.kind) < 0) return;
          s.needs.prosperity = clamp(s.needs.prosperity + cb.prosperity, 0, 10);
        });
      });
      f.hitDone = true;
    }
    function endFront(state, f) {
      var K = rules.climate.kinds[f.kind], counts = state.players.map(function () { return 0; });
      state.settlements.forEach(function (s) {
        if (dist(state, f.tile, s.tile) > f.radius) return;
        if (K.growthAfter && s.pop < rules.growth.maxPop) growPop(s, K.growthAfter, rules.growth.maxPop);
        state.players.forEach(function (p) { var cb = p.mods.climateBoon; if (cb && s.controlledBy === p.id && cb.kinds.indexOf(f.kind) >= 0 && counts[p.id] < cb.max) { growPop(s, cb.growth, rules.growth.maxPop + 1); counts[p.id]++; } });
        if (K.favorAfter && s.shrine) { var o = state.players[s.shrine.owner]; o.favor = Math.min(rules.economy.favorCap, o.favor + K.favorAfter); }
      });
      log(state, -1, 'weather', K.name + ' passes.', { tile: f.tile, kind: f.kind, radius: f.radius, front: f.id, ended: true });
    }
    function resolveCovenant(state, c, kept, why) {
      var p = state.players[c.p], s = state.settlements[c.s], K = rules.covenants.kinds[c.kind], CV = rules.covenants;
      c.status = kept ? 'kept' : 'broken'; c.resolved = state.turn;
      if (kept) {
        p.favor = Math.min(rules.economy.favorCap, p.favor + K.rewardFavor + ageMod(state, 'covenantFavorBonus', 0)); if (K.rewardFaith) p.faith = r2(p.faith + K.rewardFaith);
        addTrust(s, c.p, CV.trustReward + p.mods.covenantTrust); p.stats.covenantsKept++;
        remember(state, s, 'covenantKept', c.p, { kind: c.kind }); addMark(state, 'covenant', s.tile, c.p, { kind: c.kind });
        log(state, c.p, 'covenantKept', p.name + ' keeps the ' + K.name + ' to ' + s.name + '.', { tile: s.tile, covenant: c.id, kind: c.kind });
      } else {
        p.favor = Math.max(0, p.favor - K.penaltyFavor); addTrust(s, c.p, -CV.trustPenalty); p.stats.covenantsBroken++;
        if (c.kind !== 'protect' && s.followers[c.p] > 0) s.followers[c.p]--;
        remember(state, s, 'covenantBroken', c.p, { kind: c.kind });
        log(state, c.p, 'covenantBroken', p.name + ' breaks the ' + K.name + ' to ' + s.name + (why ? ' (' + why + ')' : '') + '.', { tile: s.tile, covenant: c.id, kind: c.kind });
      }
      var done = state.covenants.filter(function (x) { return x.status !== 'active'; });
      if (done.length > 24) state.covenants.splice(state.covenants.indexOf(done[0]), 1);
    }
    function resolveCovenants(state) {
      state.covenants.slice().forEach(function (c) {
        if (c.status !== 'active') return;
        var s = state.settlements[c.s], K = rules.covenants.kinds[c.kind], p = state.players[c.p];
        if (p.eliminated) { c.status = 'void'; return; }
        if (c.kind === 'protect' && !(s.shrine && s.shrine.owner === c.p)) return resolveCovenant(state, c, false, 'the shrine fell');
        if (c.kind === 'keep' && s.followers[c.p] < c.base) return resolveCovenant(state, c, false, 'followers were lost');
        if (state.turn >= c.t1) {
          if (c.kind === 'provide') return resolveCovenant(state, c, s.needs.prosperity >= K.prosperity, s.needs.prosperity >= K.prosperity ? null : 'the town still wants');
          resolveCovenant(state, c, true);
        }
      });
    }
    function resolveDiplomacy(state) {
      var D2 = rules.diplomacy;
      state.proposals.forEach(function (x) { if (x.status === 'pending' && x.turn < state.turn) { x.status = 'expired'; log(state, x.to, 'envoy', 'The envoy of ' + state.players[x.from].name + ' returns unanswered.', { to: x.from, kind: x.kind, expired: true }); } });
      state.treaties.forEach(function (t) {
        if (t.status !== 'active') return;
        if (state.players[t.a].eliminated || state.players[t.b].eliminated) { t.status = 'void'; return; }
        if (t.kind === 'festival' && state.turn >= t.t1) {
          [t.a, t.b].forEach(function (id) { var q = state.players[id]; q.favor = Math.min(rules.economy.favorCap, q.favor + D2.festivalFavor); });
          addGrudge(state, t.a, t.b, -D2.festivalGrudge); addGrudge(state, t.b, t.a, -D2.festivalGrudge);
          t.status = 'kept';
          log(state, t.a, 'festival', 'The shared festival of ' + state.players[t.a].name + ' and ' + state.players[t.b].name + ' fills the valleys with song.', { a: t.a, b: t.b });
        } else if (t.kind !== 'festival' && state.turn >= t.t1) { t.status = 'kept'; log(state, t.a, 'treaty', 'The ' + t.kind + ' between ' + state.players[t.a].name + ' and ' + state.players[t.b].name + ' ends in honour.', { a: t.a, b: t.b, kind: t.kind, ended: true }); }
      });
    }
    function altCheck(state, alive) {
      var A2 = rules.alt;
      if (state.mode.victory === 'sacredSites') {
        var winner = null;
        alive.forEach(function (p) {
          var held = state.landmarks.filter(function (l) { return l.holder === p.id; }).length;
          p.sacredRounds = held >= Math.min(A2.sacredSites.hold, state.landmarks.length) ? p.sacredRounds + 1 : 0;
          if (p.sacredRounds >= A2.sacredSites.rounds && !winner) winner = p;
        });
        if (winner) { finish(state, winner.id, 'sacred'); return true; }
      }
      if (state.mode.victory === 'covenants') {
        var w2 = alive.find(function (p) { return p.stats.covenantsKept >= A2.covenants.kept && p.stats.covenantsBroken === 0; });
        if (w2) { finish(state, w2.id, 'covenant'); return true; }
      }
      return false;
    }
    /* Scenario objectives are evaluated for seat 0 (the player). Success, failure and timeout are all explicit. */
    function objectiveStatus(state, o, pid) {
      var p = state.players[pid], tp = totalPop(state);
      switch (o.type) {
        case 'holdShrine': var hs = state.settlements[p.home]; if (!(hs.shrine && hs.shrine.owner === pid)) return 'fail'; return state.turn >= o.until ? 'win' : 'open';
        case 'share': if (followersOf(state, pid) / tp >= o.min) return 'win'; return state.turn >= o.by ? 'fail' : 'open';
        case 'survive': var n = playerShrines(state, pid).length; if (!n) return 'fail'; return state.turn >= o.until ? (n >= o.shrines ? 'win' : 'fail') : 'open';
        case 'shrines': if (playerShrines(state, pid).length >= o.min) return 'win'; return state.turn >= o.by ? 'fail' : 'open';
        case 'control': if (controlledCount(state, pid) >= o.min) return 'win'; return state.turn >= o.by ? 'fail' : 'open';
        case 'coastal': if (state.settlements.filter(function (s) { return s.controlledBy === pid && state.map.tiles[s.tile].coast; }).length >= o.min) return 'win'; return state.turn >= o.by ? 'fail' : 'open';
        case 'routes': if (activeRoutes(state, pid).length >= o.min) return 'win'; return state.turn >= o.by ? 'fail' : 'open';
        case 'leadScore': if (state.turn < o.at) return 'open'; var mine = scoreOf(state, pid); return state.players.every(function (q) { return q.id === pid || q.eliminated || scoreOf(state, q.id) < mine; }) ? 'win' : 'fail';
      }
      return 'open';
    }
    function scenarioCheck(state) {
      var sc = D.scenarios[state.mode.scenario], stages = sc.objectives, st = state.mode.stage;
      var me = state.players[0];
      if (me.eliminated) { finishScenario(state, false, 'forgotten'); return true; }
      var res = objectiveStatus(state, stages[st], 0);
      if (res === 'fail') { finishScenario(state, false, stages[st].text); return true; }
      if (res === 'win') {
        log(state, 0, 'objective', 'Objective met: ' + stages[st].text + '.', { stage: st });
        state.mode.stage++;
        if (state.mode.stage >= stages.length) { finishScenario(state, true, sc.name); return true; }
      }
      var alive = state.players.filter(function (p) { return !p.eliminated; }), tp = totalPop(state);
      var asc = alive.find(function (p) { return p.id !== 0 && state.turn >= rules.victory.ascendancyMinTurn && followersOf(state, p.id) / tp >= rules.victory.ascendancyShare; });
      if (asc) { finishScenario(state, false, 'a rival ascended'); return true; }
      return false;
    }
    function scenarioTimeout(state) { finishScenario(state, false, 'the age ended first'); }
    function finishScenario(state, success, why) {
      var best = state.players.filter(function (p) { return p.id !== 0 && !p.eliminated; }).sort(function (a, b) { return scoreOf(state, b.id) - scoreOf(state, a.id) || a.id - b.id; })[0];
      finish(state, success ? 0 : (best ? best.id : 0), success ? 'objective' : 'objectiveFailed', why);
    }
    function finish(state, pid, type, why) {
      state.over = true;
      state.winner = { pid: pid, type: type, turn: state.turn, scores: state.players.map(function (p) { return scoreOf(state, p.id); }) };
      if (why) state.winner.why = why;
      var names = { dominion: 'Dominion: every rival god is forgotten', ascendancy: 'Ascendancy: more than ' + Math.round(rules.victory.ascendancyShare * 100) + '% of all mortals follow one god',
        twilight: 'Twilight Judgment: the highest devotion when the age ends', sacred: 'Sacred Ground: the holy places answer to one god', covenant: 'The Kept Word: no promise broken',
        objective: 'The trial is passed', objectiveFailed: 'The trial is lost' };
      log(state, pid, 'victory', state.players[pid].name + ' prevails. ' + names[type] + (why ? ' (' + why + ')' : '') + '.', { type: type });
    }

    function hash(state) { return fnv(JSON.stringify(state)); }

    /* Deterministic numeric summary of an action's consequences (UI previews; AI lookahead uses the same step). */
    function preview(state, action) {
      if (validate(state, action)) return null;
      var pid = state.current, a = clone(state); apply(a, action);
      var p0 = state.players[pid], p1 = a.players[pid], out = { faith: r2(p1.faith - p0.faith), favor: p1.favor - p0.favor, followers: followersOf(a, pid) - followersOf(state, pid), revealed: 0, settlements: [] };
      for (var i = 0; i < p0.revealed.length; i++) if (p1.revealed[i] && !p0.revealed[i]) out.revealed++;
      a.settlements.forEach(function (s, i) {
        var o = state.settlements[i], d = { name: s.name, tile: s.tile };
        var df = s.followers.map(function (f, r) { return f - o.followers[r]; }), dp = s.pop - o.pop, dpros = s.needs.prosperity - o.needs.prosperity;
        var dw = (s.shrine ? s.shrine.ward : 0) - (o.shrine ? o.shrine.ward : 0);
        if (df.some(function (x) { return x; }) || dp || dpros || dw || (!!s.shrine !== !!o.shrine) || JSON.stringify(s.boons) !== JSON.stringify(o.boons)) { d.followers = df; d.pop = dp; d.prosperity = dpros; d.ward = dw; d.shrine = !!s.shrine && !o.shrine ? 'raised' : (!s.shrine && o.shrine ? 'toppled' : null); out.settlements.push(d); }
      });
      return out;
    }

    return {
      version: VERSION, data: data, D: D, rules: rules, EFFECT_TYPES: EFFECT_TYPES, DOMAIN_TYPES: DOMAIN_TYPES, TARGET_KINDS: TARGET_KINDS, ROLES: ROLES, SPECS: SPECS,
      newGame: newGame, step: step, apply: apply, validate: validate, hash: hash, clone: clone, preview: preview, ageOf: ageOf,
      helpers: { dist: dist, pressureAt: pressureAt, incomeOf: incomeOf, scoreOf: scoreOf, followersOf: followersOf, totalPop: totalPop,
        unaffiliated: unaffiliated, playerShrines: playerShrines, playerPriests: playerPriests, priestCap: priestCap, shrineCost: shrineCost, priestCost: priestCost,
        omenCost: omenCost, omenRadius: omenRadius, eclipseCost: eclipseCost, eclipseRange: eclipseRange, counterCost: counterCost, routeCost: routeCost, dreamCooldown: dreamCooldown,
        inTerritory: inTerritory, nearOwnPresence: nearOwnPresence, hiddenSettlements: hiddenSettlements, hasPresence: hasPresence,
        nearestHidden: nearestHidden, settlementAt: settlementAt, controlledCount: controlledCount, pathStep: pathStep, passableFor: passableFor,
        targetError: targetError, powerTargetError: powerTargetError, inRadius: inRadius, shrineDef: shrineDef, hasBuff: hasBuff, topRival: topRival,
        shrineRadius: shrineRadius, shrinePressure: shrinePressure, maxWard: maxWard, resistOf: resistOf, frontKnown: frontKnown, knownFronts: knownFronts, frontsAt: frontsAt,
        activeRoutes: activeRoutes, activeCovenants: activeCovenants, activeTreaty: activeTreaty, marksAt: marksAt, roleOf: roleOf, wardenAt: wardenAt,
        objectiveStatus: objectiveStatus, contested: contested, nearKnown: nearKnown, protects: protects, boonOf: boonOf, hitDamage: hitDamage }
    };
  }

  function indexData(data) {
    var D = { factions: {}, domains: {}, powers: {}, shrines: {}, events: {}, scenarios: {}, terrain: data.terrain.types, sources: data.sources };
    data.factions.forEach(function (f) { D.factions[f.id] = f; });
    data.domains.forEach(function (d) { D.domains[d.id] = d; });
    data.powers.forEach(function (p) { D.powers[p.id] = p; });
    data.shrines.forEach(function (s) { D.shrines[s.id] = s; });
    data.events.forEach(function (e) { D.events[e.id] = e; });
    (data.scenarios || []).forEach(function (s) { D.scenarios[s.id] = s; });
    return D;
  }
  /* Fail loudly on data the rules cannot execute (instead of silently rendering fallbacks). Full schema checks live in tools/validate-data.js. */
  function checkData(data, D) {
    data.factions.forEach(function (f) {
      f.domains.forEach(function (id) { if (!D.domains[id]) throw new Error(f.id + ': unknown domain ' + id); });
      f.powers.forEach(function (id) { if (!D.powers[id]) throw new Error(f.id + ': unknown power ' + id); });
      if (!D.shrines[f.shrine]) throw new Error(f.id + ': unknown shrine ' + f.shrine);
    });
    data.domains.forEach(function (d) { domainEffects(d).forEach(function (ef) { if (DOMAIN_TYPES.indexOf(ef.type) < 0) throw new Error(d.id + ': unknown domain effect ' + ef.type); }); });
    data.powers.forEach(function (p) {
      if (TARGET_KINDS.indexOf(p.target) < 0) throw new Error(p.id + ': unknown target ' + p.target);
      p.effects.forEach(function (ef) { if (EFFECT_TYPES.indexOf(ef.type) < 0) throw new Error(p.id + ': unknown effect ' + ef.type); });
    });
    data.events.forEach(function (e) { e.choices.forEach(function (c) { c.effects.forEach(function (ef) { if (EFFECT_TYPES.indexOf(ef.type) < 0) throw new Error(e.id + ': unknown effect ' + ef.type); }); }); });
  }

  return { create: create, VERSION: VERSION, fnv: fnv, EFFECT_TYPES: EFFECT_TYPES, DOMAIN_TYPES: DOMAIN_TYPES };
});
