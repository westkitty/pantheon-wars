/*
 * Pantheon Wars v0.2 — AI gods. Pure: reads state, returns ONE action for state.current.
 * Two levels: 'easy' (Acolyte) and 'hard' (Hierophant). Rules are documented in docs/ai.md.
 * Determinism: no Math.random. Hard AI is a deterministic utility maximiser with a bounded one-round lookahead that runs on
 * private clones (the clone carries its own copy of the RNG, so the real game stream is never advanced). Easy AI draws from
 * a private PRNG seeded by (seed, turn, player, action index). Fog: every target is chosen from what the god has revealed;
 * weather forecasts are read only through E.helpers.knownFronts.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rng.js'));
  else root.PWAI = factory(root.PWRng);
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';
  var FAVOR_VALUE = 6;            // 1 Favor is worth ~6 Faith to the AI
  var MAX_ACTIONS_PER_TURN = 24;
  /* Effect types the AI knows how to value. tests/systems.test.js asserts every effect used by data is in this list. */
  var VALUED = ['reveal', 'revealNearestSettlements', 'revealBand', 'revealRiver', 'revealThreats', 'forecast', 'ward', 'wardRadius', 'clearEclipse', 'clearEclipseRadius',
    'spawnPriest', 'retrain', 'buff', 'shrineBoost', 'siteBoon', 'popControlled', 'popTarget', 'popLargest', 'faith', 'favor', 'prosperity', 'strike', 'weigh', 'sway',
    'shrineHit', 'delayedHit', 'raiseShrine', 'waterBless', 'rains', 'restore', 'trust', 'faithPerRoute', 'followersLargest', 'loseFollowersLargest', 'freePriest',
    'shrineDiscount', 'wardAll', 'wardRandom'];
  var stats = { lookaheads: 0, lookaheadMs: 0 };

  function personality(state, pid) {
    var rng = R.make(state.seed + ':persona:' + pid);
    var p = { expand: R.range(rng, 0.7, 1.3), aggression: R.range(rng, 0.6, 1.4), explore: R.range(rng, 0.7, 1.3), economy: R.range(rng, 0.7, 1.3) };
    var top = Object.keys(p).sort(function (a, b) { return p[b] - p[a]; })[0];
    p.archetype = { expand: 'Builder', aggression: 'Zealot', explore: 'Seer', economy: 'Steward' }[top];
    return p;
  }
  function actionsThisTurn(state) {
    var n = 0;
    for (var i = state.actions.length - 1; i >= 0; i--) { var a = state.actions[i]; if (a.a.type === 'endTurn' || a.p !== state.current) break; n++; }
    return n;
  }
  function ageWeights(state, per) {
    var w = { expand: per.expand, aggression: per.aggression, explore: per.explore, economy: per.economy, archetype: per.archetype };
    if (state.age === 'dawn') w.explore *= 1.2; else if (state.age === 'zenith') w.expand *= 1.1; else w.aggression *= 1.15;
    return w;
  }

  function nextAction(E, state, opts) {
    var pid = state.current, p = state.players[pid], H = E.helpers, level = p.ai === 'easy' ? 'easy' : 'hard';
    var n = actionsThisTurn(state);
    var rng = R.make(state.seed + ':ai:' + state.turn + ':' + pid + ':' + n);
    var per = ageWeights(state, level === 'hard' ? personality(state, pid) : { expand: 1, aggression: 0.6, explore: 1, economy: 0.8, archetype: 'Acolyte' });
    if (p.pendingEvent) return { type: 'event', choice: chooseEvent(E, state, pid, level, rng) };
    var ans = answerProposals(E, state, pid, per, level, rng); if (ans) return ans;
    if (n >= MAX_ACTIONS_PER_TURN) return { type: 'endTurn' };
    var mv = priestOrders(E, state, pid, level, rng, per);
    if (mv) return mv;
    var cands = candidates(E, state, pid, per, level);
    cands = cands.filter(function (c) { return !E.validate(state, c.a); });
    if (!cands.length) return { type: 'endTurn' };
    if (level === 'easy') {
      if (R.next(rng) < 0.3) return { type: 'endTurn' };
      var pool = cands.filter(function (c) { return c.u > 0.15; });
      if (!pool.length) return { type: 'endTurn' };
      return R.weighted(rng, pool, function (c) { return Math.sqrt(c.u); }).a;
    }
    cands.sort(function (a, b) { return b.u - a.u || (a.key < b.key ? -1 : 1); });
    if (!(opts && opts.noLookahead)) cands = lookahead(E, state, pid, cands);
    var best = cands[0];
    var saveFor = shrineWish(E, state, pid, per);
    if (saveFor && best.faith > 0 && best.a.type !== 'shrine' && !best.forced && best.u < saveFor.u * 0.8 && p.faith - best.faith < saveFor.cost && p.faith + H.incomeOf(state, pid) * 2 >= saveFor.cost) return { type: 'endTurn' };
    return best.u >= 0.5 ? best.a : { type: 'endTurn' };
  }

  /* ---------- bounded lookahead (Hierophant only) */
  function fastClone(E, state) { var m = state.map; state.map = null; var c = E.clone(state); state.map = m; c.map = m; return c; } // tiles are immutable after map generation
  function projectRound(E, s, pid) {
    // play the rest of this round with every god passing (pending cards are set aside in the hypothetical), so conversion, income, weather and victory resolve
    var t = s.turn, guard = 0;
    while (!s.over && s.turn === t && guard++ < 8) { s.players[s.current].pendingEvent = null; E.apply(s, { type: 'endTurn' }); }
    var H = E.helpers, me = s.players[pid];
    if (s.over) return s.winner.pid === pid ? 1000 : -1000;
    var left = Math.max(1, s.maxTurns - s.turn), w = Math.min(1, left / 8);
    var mine = H.scoreOf(s, pid) + H.incomeOf(s, pid) * 0.6 * w + me.faith * 0.05, best = -1e9;
    s.players.forEach(function (q) { if (q.id !== pid && !q.eliminated) best = Math.max(best, H.scoreOf(s, q.id) + H.incomeOf(s, q.id) * 0.6 * w); });
    return mine - (best === -1e9 ? 0 : best);
  }
  function needsLookahead(E, state, pid, cands) {
    var H = E.helpers, tp = H.totalPop(state), left = state.maxTurns - state.turn;
    if (left <= 2) return true;
    if (state.players.some(function (q) { return !q.eliminated && H.followersOf(state, q.id) / tp >= 0.5; })) return true;
    return cands.length > 1 && cands[1].u >= cands[0].u * 0.85;
  }
  function lookahead(E, state, pid, cands) {
    var L = E.rules.lookahead; if (!L || !needsLookahead(E, state, pid, cands)) return cands;
    var t0 = Date.now(), K = Math.min(state.maxTurns - state.turn <= 1 ? 8 : L.candidates, cands.length);
    var base = projectRound(E, fastClone(E, state), pid);
    var top = cands.slice(0, K).map(function (c) {
      var s = fastClone(E, state); E.apply(s, c.a);
      var v = projectRound(E, s, pid) - base;
      return Object.assign({}, c, { la: v, u2: c.u + L.weight * v, forced: v >= 500 });
    });
    stats.lookaheads++; stats.lookaheadMs += Date.now() - t0;
    if (base <= -500 && top.every(function (c) { return c.la <= 0; })) return cands; // nothing found that changes a losing round; keep the greedy order
    top.sort(function (a, b) { return b.u2 - a.u2 || (a.key < b.key ? -1 : 1); });
    if (top[0].la >= 500) top[0].u = Math.max(top[0].u, 50);
    return top.concat(cands.slice(K));
  }

  /* ---------- valuation helpers */
  function convertible(E, state, s, pid) {
    var H = E.helpers, u = H.unaffiliated(s), rivals = 0;
    s.followers.forEach(function (f, r) { if (r !== pid) rivals += f; });
    return u + 0.5 * rivals;
  }
  function nearbyValue(E, state, tile, pid, rad) {
    var H = E.helpers, v = 0;
    state.settlements.forEach(function (o) { var d = H.dist(state, o.tile, tile); if (d <= rad && !(o.shrine && o.shrine.owner === pid)) v += convertible(E, state, o, pid) / (1 + d); });
    return v;
  }
  function grudgeMult(state, pid, target) { var g = state.players[pid].grudge[target] || 0; return 1 + 0.12 * g; }
  function treatyMult(E, state, pid, target, per) {
    if (target < 0) return 1;
    var t = E.helpers.activeTreaty(state, pid, target, 'truce'); if (!t) return grudgeMult(state, pid, target);
    return state.players[pid].grudge[target] >= 8 && per.aggression > 1.15 ? 0.6 : 0.08; // honoured unless the god is a Zealot with a deep grudge
  }
  function shrineWish(E, state, pid, per) {
    var H = E.helpers, p = state.players[pid], best = null;
    state.settlements.forEach(function (s) {
      if (s.shrine || !p.revealed[s.tile]) return;
      if (!H.hasPresence(state, pid, s)) return;
      var cost = H.shrineCost(state, pid, s.tile);
      if (borderBlocked(E, state, pid, s)) return;
      var v = (s.pop * 0.6 + convertible(E, state, s, pid) + nearbyValue(E, state, s.tile, pid, 2) * 0.5) * per.expand;
      var turnsLeft = state.maxTurns - state.turn; if (turnsLeft < 6) v *= turnsLeft / 6;
      var u = v * 10 / cost;
      if (!best || u > best.u) best = { u: u, tile: s.tile, cost: cost };
    });
    return best;
  }
  function borderBlocked(E, state, pid, s) {
    var H = E.helpers;
    return state.treaties.some(function (t) {
      if (t.status !== 'active' || t.kind !== 'border' || (t.a !== pid && t.b !== pid)) return false;
      var other = t.a === pid ? t.b : t.a;
      return H.playerShrines(state, other).some(function (o) { return H.dist(state, o.tile, s.tile) <= E.rules.diplomacy.borderRadius; });
    });
  }
  function hiddenCount(E, state, pid, tile, radius) { var p = state.players[pid], n = 0; E.helpers.inRadius(state, tile, radius).forEach(function (id) { if (!p.revealed[id]) n++; }); return n; }
  function bestOmenTile(E, state, pid, radius, range, anywhere) {
    var H = E.helpers, p = state.players[pid], best = null, R0 = range || E.rules.actions.omen.range;
    var home = state.settlements[p.home].tile;
    state.map.tiles.forEach(function (t) {
      if (p.revealed[t.id]) return;
      var hidden = hiddenCount(E, state, pid, t.id, radius);
      if (hidden < 4) return;
      if (!anywhere && !H.nearKnown(state, pid, t.id, R0)) return;
      var sc = hidden - H.dist(state, t.id, home) * 0.3;
      if (!best || sc > best.sc || (sc === best.sc && t.id < best.tile)) best = { tile: t.id, sc: sc, hidden: hidden };
    });
    return best;
  }
  function threatLevel(E, state, pid, s) {
    // how exposed is one of my shrines? counts revealed rival shrines and priests in eclipse reach
    var H = E.helpers, p = state.players[pid], n = 0;
    state.settlements.forEach(function (o) { if (o.shrine && o.shrine.owner !== pid && p.revealed[o.tile] && H.dist(state, o.tile, s.tile) <= 4) n += 1; });
    state.priests.forEach(function (pr) { if (pr.owner !== pid && p.revealed[pr.tile] && H.dist(state, pr.tile, s.tile) <= 3) n += 0.7; });
    return n;
  }

  function candidates(E, state, pid, per, level) {
    var H = E.helpers, D = E.D, A = E.rules.actions, p = state.players[pid], out = [];
    var turnsLeft = state.maxTurns - state.turn, hiddenS = H.hiddenSettlements(state, pid).length, totalS = state.settlements.length;
    var exploreNeed = (hiddenS / totalS) * (turnsLeft > 10 ? 1 : 0.3) * per.explore;
    function push(a, u, faith, favor, key) { out.push({ a: a, u: u, faith: faith || 0, favor: favor || 0, key: key || JSON.stringify(a) }); }

    var sw = shrineWish(E, state, pid, per);
    if (sw && p.faith >= sw.cost) push({ type: 'shrine', tile: sw.tile }, sw.u, sw.cost);
    var cap = H.priestCap(state, pid), mine = H.playerPriests(state, pid).length, pc = H.priestCost(state, pid);
    if (mine < cap && p.faith >= pc) {
      var homeShrine = H.playerShrines(state, pid).filter(function (s) { return !s.shrine.eclipsed; })[0] || H.playerShrines(state, pid)[0];
      var tgt = bestPriestTarget(E, state, pid, homeShrine ? homeShrine.tile : null, {});
      if (homeShrine && tgt) {
        var role = chooseRole(E, state, pid, per, exploreNeed, level), a = { type: 'priest', tile: homeShrine.tile, dest: tgt.tile };
        if (role !== 'emissary') a.role = role;
        push(a, tgt.v * 0.9 * per.expand * 10 / pc, pc);
      }
    }
    var oc = H.omenCost(state, pid);
    if (!p.flags.omenUsed && p.faith >= oc && hiddenS > 0) {
      var ot = bestOmenTile(E, state, pid, H.omenRadius(state, pid));
      if (ot) push({ type: 'omen', tile: ot.tile }, exploreNeed * ot.hidden * 0.5 * 6 / Math.max(2, oc), oc);
    }
    if (!(p.cooldowns.dream > 0) && p.favor >= A.dream.favor && hiddenS > 0) push({ type: 'dream' }, exploreNeed * 6 / (A.dream.favor * FAVOR_VALUE) * 6, 0, A.dream.favor);
    if (!(p.cooldowns.eclipse > 0)) {
      var et = bestRivalShrine(E, state, pid, H.eclipseRange(state, pid), per);
      if (et) { var ec = H.eclipseCost(state, pid, et.tile); if (p.favor >= ec) push({ type: 'eclipse', tile: et.tile }, et.v * per.aggression * 10 / (ec * FAVOR_VALUE), 0, ec); }
    }
    D.factions[p.faction].powers.forEach(function (pwId) {
      var pw = D.powers[pwId];
      if (p.cooldowns[pw.id] > 0 || p.faith < pw.cost.faith || p.favor < pw.cost.favor) return;
      var cost = pw.cost.faith + pw.cost.favor * FAVOR_VALUE, ev = powerValue(E, state, pid, pw, per, exploreNeed);
      if (!ev) return;
      var a = { type: 'power', power: pw.id }; if (ev.tile !== undefined) a.tile = ev.tile; if (ev.role) a.role = ev.role;
      push(a, ev.v * 10 / Math.max(4, cost + (ev.extraCost || 0)), pw.cost.faith, pw.cost.favor);
    });
    // v0.2 systems
    counterCandidates(E, state, pid, push);
    specCandidates(E, state, pid, per, exploreNeed, push);
    covenantCandidates(E, state, pid, per, push);
    routeCandidates(E, state, pid, per, push);
    if (level === 'hard') diplomacyCandidates(E, state, pid, per, push);
    retrainCandidates(E, state, pid, per, push);
    return out;
  }

  function chooseRole(E, state, pid, per, exploreNeed, level) {
    if (level === 'easy') return 'emissary';
    var H = E.helpers, home = state.settlements[state.players[pid].home];
    if (home.shrine && home.shrine.owner === pid && threatLevel(E, state, pid, home) >= 2 && home.shrine.ward <= 2 && !H.wardenAt(state, pid, home.tile)) return 'warden';
    if (exploreNeed > 0.45 && !H.playerPriests(state, pid).some(function (pr) { return pr.role === 'seer'; })) return 'seer';
    return 'emissary';
  }
  function counterCandidates(E, state, pid, push) {
    var H = E.helpers, p = state.players[pid], cc = H.counterCost(state, pid);
    if (p.favor < cc) return;
    H.playerShrines(state, pid).forEach(function (s) {
      var th = s.shrine.threat; if (!th || th.until < state.turn) return;
      var v = th.storm ? (s.shrine.ward <= H.hitDamage(state, s, th.dmg, true) ? 16 : 7) : 3 * th.dmg + (s.shrine.ward <= 1 ? 6 : 0) + (s.shrine.eclipsed ? 2 : 0);
      push({ type: 'counterRite', tile: s.tile }, v * 10 / (cc * FAVOR_VALUE), 0, cc);
    });
  }
  function specCandidates(E, state, pid, per, exploreNeed, push) {
    var H = E.helpers, p = state.players[pid], SP = E.rules.specs, left = state.maxTurns - state.turn;
    if (p.faith < SP.faith || p.favor < SP.favor || left < 4) return;
    var cost = SP.faith + SP.favor * FAVOR_VALUE;
    H.playerShrines(state, pid).forEach(function (s) {
      if (s.shrine.spec) return;
      var th = threatLevel(E, state, pid, s), isHome = s.id === p.home;
      var vs = (th * 2.2 + (s.shrine.ward <= 1 ? 4 : 0) + (isHome ? 2 : 0)) * Math.min(1, left / 10);
      var vb = th > 0.5 ? 0 : nearbyValue(E, state, s.tile, pid, H.shrineRadius(state, s) + 1) * 0.35 * Math.min(1, left / 12) * per.expand;
      var vo = hiddenCount(E, state, pid, s.tile, 4) * 0.25 * per.explore + Math.min(left, 15) * 0.2;
      var best = vs >= vb && vs >= vo ? ['sanctuary', vs] : vb >= vo ? ['beacon', vb] : ['oracle', vo];
      push({ type: 'specialize', tile: s.tile, spec: best[0] }, best[1] * 10 / cost, SP.faith, SP.favor);
    });
  }
  function covenantCandidates(E, state, pid, per, push) {
    var H = E.helpers, p = state.players[pid], CV = E.rules.covenants, left = state.maxTurns - state.turn;
    if (H.activeCovenants(state, pid).length >= CV.max || left < 7) return;
    if (p.stats.covenantsBroken > p.stats.covenantsKept + 1) return; // a god that keeps failing stops promising
    var bonus = (E.ageOf(state.turn).mods || {}).covenantFavorBonus || 0, best = null, steward = per.economy / 1;
    state.settlements.forEach(function (s) {
      if (!p.revealed[s.tile] || state.covenants.some(function (c) { return c.status === 'active' && c.p === pid && c.s === s.id; })) return;
      var rivalP = 0; state.players.forEach(function (q) { if (q.id !== pid) rivalP += H.pressureAt(state, s, q.id); });
      var opts = [];
      if (s.shrine && s.shrine.owner === pid) { var risk = Math.min(0.9, threatLevel(E, state, pid, s) * 0.18 + (s.shrine.ward <= 1 ? 0.3 : 0)); opts.push(['protect', 1 - risk, CV.kinds.protect]); }
      if (s.followers[pid] >= CV.kinds.keep.minFollowers && s.controlledBy === pid) { var risk2 = Math.min(0.95, rivalP * 0.35 + (s.needs.prosperity <= 2 ? 0.3 : 0)); opts.push(['keep', 1 - risk2, CV.kinds.keep]); }
      if (s.followers[pid] > 0 && s.needs.prosperity < CV.kinds.provide.prosperity && s.needs.prosperity >= CV.kinds.provide.prosperity - 3 && !H.frontsAt(state, s.tile, 'drought').length) {
        var fert = E.D.terrain[state.map.tiles[s.tile].terrain].fertility, target = 2 + fert * 5 + 1; opts.push(['provide', target >= CV.kinds.provide.prosperity ? 0.75 : 0.25, CV.kinds.provide]);
      }
      opts.forEach(function (o) {
        var K = o[2], gain = (K.rewardFavor + bonus) * FAVOR_VALUE + (K.rewardFaith || 0) + 3, loss = K.penaltyFavor * FAVOR_VALUE + 4;
        var ev = o[1] * gain - (1 - o[1]) * loss;
        if (ev > 0 && (!best || ev > best.v)) best = { v: ev, a: { type: 'covenant', kind: o[0], tile: s.tile } };
      });
    });
    if (best) push(best.a, best.v * 0.12 * steward, 0, 0);
  }
  function routeCandidates(E, state, pid, per, push) {
    var H = E.helpers, p = state.players[pid], cost = H.routeCost(state, pid), left = state.maxTurns - state.turn;
    if (p.faith < cost || left < 5) return;
    var best = null;
    state.routes.forEach(function (r) {
      if (r.owner >= 0) return;
      var a = { type: 'route', route: r.id }; if (E.validate(state, a)) return;
      var v = (E.rules.routes.faithPer + p.mods.routeFaith) * Math.min(left, 14) * 0.6 + E.rules.routes.pressure * 6 * per.expand;
      if (!best || v > best.v) best = { v: v, a: a };
    });
    if (best) push(best.a, best.v * 10 / cost * 0.5, cost);
  }
  function retrainCandidates(E, state, pid, per, push) {
    var H = E.helpers, p = state.players[pid];
    H.playerPriests(state, pid).forEach(function (pr) {
      var s = H.settlementAt(state, pr.tile); if (!s || !s.shrine || s.shrine.owner !== pid || pr.role === 'warden') return;
      if (threatLevel(E, state, pid, s) >= 2 && s.shrine.ward <= 2 && !H.wardenAt(state, pid, s.tile)) {
        var free = p.mods.freeRetrain && !p.flags.retrainUsed;
        push({ type: 'retrain', priest: pr.id, role: 'warden' }, free ? 9 : 4 * 10 / E.rules.actions.retrain.faith, free ? 0 : E.rules.actions.retrain.faith);
      }
    });
  }
  function diplomacyCandidates(E, state, pid, per, push) {
    var H = E.helpers, p = state.players[pid], left = state.maxTurns - state.turn;
    if (p.flags.proposed || left < 4 || (state.turn + pid) % 4 !== 0) return;
    var mine = H.scoreOf(state, pid);
    state.players.forEach(function (q) {
      if (q.id === pid || q.eliminated || q.human) return; // envoys to human gods come from the UI flow only when the AI wants a truce with a human (below)
    });
    state.players.forEach(function (q) {
      if (q.id === pid || q.eliminated) return;
      var theirs = H.scoreOf(state, q.id), g = p.grudge[q.id];
      if (!H.activeTreaty(state, pid, q.id, 'truce') && g <= 3 && theirs > mine * 1.1 && per.aggression < 1.2) push({ type: 'propose', kind: 'truce', to: q.id }, 1.2, 0);
      if (per.economy > 1.05 && g >= 2 && g <= 6 && p.faith >= 12 && p.favor < 12) push({ type: 'propose', kind: 'festival', to: q.id }, 0.9, E.rules.diplomacy.festivalFaith);
    });
  }
  function answerProposals(E, state, pid, per, level, rng) {
    var H = E.helpers, p = state.players[pid];
    var pr = state.proposals.find(function (x) { return x.status === 'pending' && x.to === pid; });
    if (!pr) return null;
    var accept;
    if (level === 'easy') accept = R.next(rng) < 0.5;
    else {
      var g = p.grudge[pr.from], mine = H.scoreOf(state, pid), theirs = H.scoreOf(state, pr.from);
      if (pr.kind === 'truce') accept = g <= 3 && (theirs <= mine * 1.3) && per.aggression < 1.3 && state.maxTurns - state.turn > 3;
      else if (pr.kind === 'festival') accept = g <= 5 && p.faith >= E.rules.diplomacy.festivalFaith + 6;
      else accept = g <= 2 && H.playerShrines(state, pid).length >= H.playerShrines(state, pr.from).length;
    }
    var a = { type: 'answer', id: pr.id, accept: !!accept };
    if (E.validate(state, a)) a.accept = false;
    return a;
  }

  function landmarkTargets(E, state, pid) {
    var p = state.players[pid];
    return state.landmarks.filter(function (l) { return l.holder !== pid && p.revealed[l.tile]; }).map(function (l) { return { tile: l.tile, v: 2.6 + (l.holder >= 0 ? 0.6 : 0) }; });
  }
  function bestPriestTarget(E, state, pid, from, taken, role) {
    var H = E.helpers, p = state.players[pid], best = null;
    function consider(tile, c) {
      if (taken[tile]) return;
      var d = from === null ? 0 : H.dist(state, from, tile);
      if (from !== null && !H.pathStep(state, pid, from, tile)) return;
      var others = state.priests.filter(function (pr) { return pr.owner === pid && (pr.dest === tile || pr.tile === tile); }).length;
      var v = c / (1 + d * (role === 'seer' ? 0.2 : 0.35)) / (1 + others);
      if (!best || v > best.v || (v === best.v && tile < best.tile)) best = { tile: tile, v: v };
    }
    state.settlements.forEach(function (s) {
      if (!p.revealed[s.tile]) return;
      var c = convertible(E, state, s, pid); if (c < 1) return;
      if (role === 'seer') c = c * 0.4 + hiddenCount(E, state, pid, s.tile, 3) * 0.3;
      consider(s.tile, c);
    });
    landmarkTargets(E, state, pid).forEach(function (l) { consider(l.tile, l.v * (role === 'seer' ? 1.5 : 1)); });
    return best;
  }
  function priestOrders(E, state, pid, level, rng, per) {
    var H = E.helpers, taken = {};
    var mine = H.playerPriests(state, pid);
    mine.forEach(function (pr) { if (pr.dest !== null) taken[pr.dest] = 1; });
    for (var i = 0; i < mine.length; i++) {
      var pr = mine[i], here = H.settlementAt(state, pr.tile);
      var arrived = pr.dest === null || pr.dest === pr.tile;
      if (!arrived) continue;
      if (pr.role === 'warden' && here && here.shrine && here.shrine.owner === pid && threatLevel(E, state, pid, here) >= 1) continue; // wardens hold threatened shrines
      var onLandmark = state.landmarks.some(function (l) { return l.tile === pr.tile && l.holder !== pid; });
      if (onLandmark) continue; // stay one round to claim
      var done = !here || convertible(E, state, here, pid) < 1 || (here.followers[pid] / here.pop >= 0.85);
      if (!done && pr.dest !== null) continue;
      var tgt;
      if (level === 'easy') {
        var opts = state.settlements.filter(function (s) { return state.players[pid].revealed[s.tile] && H.unaffiliated(s) > 0 && s.tile !== pr.tile; })
          .sort(function (a, b) { return H.dist(state, pr.tile, a.tile) - H.dist(state, pr.tile, b.tile) || a.id - b.id; }).slice(0, 3);
        tgt = opts.length ? { tile: R.pick(rng, opts).tile } : null;
      } else {
        delete taken[pr.dest];
        tgt = bestPriestTarget(E, state, pid, pr.tile, taken, pr.role);
      }
      if (tgt && tgt.tile !== pr.dest && tgt.tile !== pr.tile) { var a = { type: 'movePriest', priest: pr.id, tile: tgt.tile }; if (!E.validate(state, a)) return a; }
    }
    return null;
  }

  function bestRivalShrine(E, state, pid, range, per) {
    var H = E.helpers, best = null;
    state.settlements.forEach(function (s) {
      if (!s.shrine || s.shrine.owner === pid) return;
      if (H.targetError(state, pid, 'rivalShrine', s.tile, range)) return;
      var v = 0;
      state.settlements.forEach(function (o) { var d = H.dist(state, o.tile, s.tile); if (d <= 2) v += (o.followers[pid] + H.unaffiliated(o) * 0.5 + o.followers[s.shrine.owner] * 0.3) / (1 + d); });
      var dmg = H.hitDamage(state, s, 1, false);
      v = v * 0.5 * (s.shrine.ward <= dmg ? 2.5 : 1) * (s.shrine.eclipsed ? 0.3 : 1) * (dmg ? 1 : 0.4);
      v *= per ? treatyMult(E, state, pid, s.shrine.owner, per) : 1;
      if (!best || v > best.v || (v === best.v && s.tile < best.tile)) best = { tile: s.tile, v: v };
    });
    return best;
  }

  /* Per-target valuation of a faction power: every effect is scored at every legal target; the best target wins. */
  function powerTargets(E, state, pid, pw) {
    var H = E.helpers, p = state.players[pid];
    if (pw.target === 'none') return [undefined];
    if (pw.target === 'anyTile' || pw.target === 'nearKnown') {
      var out = [], rad = 3;
      pw.effects.forEach(function (ef) { if (ef.radius) rad = Math.max(rad, ef.radius); });
      state.map.tiles.forEach(function (t) { if (!p.revealed[t.id] && (t.q + t.r) % 2 === 0 && hiddenCount(E, state, pid, t.id, Math.min(rad, 3)) >= 4) out.push(t.id); });
      // shrines can be targets too (light, rivers)
      H.playerShrines(state, pid).forEach(function (s) { out.push(s.tile); });
      return out;
    }
    return state.settlements.map(function (s) { return s.tile; });
  }
  function powerValue(E, state, pid, pw, per, exploreNeed) {
    var H = E.helpers, best = null;
    var tiles = powerTargets(E, state, pid, pw);
    for (var i = 0; i < tiles.length; i++) {
      var tile = tiles[i];
      if (H.powerTargetError(state, pid, pw, tile)) continue;
      var r = valueAt(E, state, pid, pw, per, exploreNeed, tile);
      if (r && r.v > 0 && (!best || r.v > best.v || (r.v === best.v && (tile || 0) < (best.tile || 0)))) best = r;
    }
    return best;
  }
  function valueAt(E, state, pid, pw, per, exploreNeed, tile) {
    var H = E.helpers, p = state.players[pid], v = 0, turnsLeft = state.maxTurns - state.turn, s = tile !== undefined ? H.settlementAt(state, tile) : null, extra = 0, role;
    var ownShr = H.playerShrines(state, pid), RL = E.rules;
    for (var i = 0; i < pw.effects.length; i++) {
      var ef = pw.effects[i];
      switch (ef.type) {
        case 'reveal': v += exploreNeed * hiddenCount(E, state, pid, tile, ef.radius) * 0.5; break;
        case 'revealBand':
          var t0 = state.map.tiles[tile], half = Math.floor(ef.rows / 2), lo = t0.r - half, hi = lo + ef.rows - 1, hw = ef.halfWidth || 999, hc = 0;
          state.map.tiles.forEach(function (t) { if (t.r >= lo && t.r <= hi && Math.abs(t.q - t0.q) <= hw && !p.revealed[t.id]) hc += t.settlement >= 0 ? 4 : 0.3; });
          v += exploreNeed * hc * 0.6; break;
        case 'revealRiver': var rc = 0; H.inRadius(state, tile, ef.radius).forEach(function (id) { var t = state.map.tiles[id]; if (!p.revealed[id] && (t.coast || E.D.terrain[t.terrain].water)) rc += t.settlement >= 0 ? 3 : 0.25; }); v += exploreNeed * rc * 0.6; break;
        case 'revealNearestSettlements': var hs = H.hiddenSettlements(state, pid).length; if (hs) v += exploreNeed * 8 * Math.min(ef.count, hs); break;
        case 'revealThreats': v += exploreNeed > 0.1 ? ownShr.length * 0.15 : 0; break;
        case 'forecast': v += 0.25; break; // weather foresight is worth little to a utility AI; it must never carry a cast by itself
        case 'spawnPriest':
          if (!ownShr.length) return null;
          var bt = bestPriestTarget(E, state, pid, tile !== undefined ? tile : ownShr[0].tile, {}); v += bt ? bt.v * 0.9 * per.expand : 0;
          if (H.playerPriests(state, pid).length >= H.priestCap(state, pid)) v *= 0.6; break;
        case 'retrain':
          if (s && s.shrine && threatLevel(E, state, pid, s) >= 2 && s.shrine.ward <= 2) { role = 'warden'; v += 1.5 + 2 * state.priests.filter(function (pr) { return pr.owner === pid && pr.tile === tile && pr.role !== 'warden'; }).length; }
          break;
        case 'ward': case 'wardRadius':
          var sh = s && s.shrine; if (!sh) break;
          var th = threatLevel(E, state, pid, s); v += (sh.ward <= 1 ? 6 : 1.5) * (0.5 + Math.min(1.5, th * 0.5)) + (sh.eclipsed ? 3 : 0);
          if (ef.type === 'wardRadius') ownShr.forEach(function (o) { if (o !== s && H.dist(state, o.tile, tile) <= ef.radius && o.shrine.ward < ef.max) v += 1.2; });
          break;
        case 'clearEclipse': if (s && s.shrine && s.shrine.eclipsed) v += 3 + s.shrine.eclipsed; break;
        case 'clearEclipseRadius': ownShr.forEach(function (o) { if (o.shrine.eclipsed && H.dist(state, o.tile, tile) <= ef.radius) v += 3 + o.shrine.eclipsed; }); break;
        case 'buff':
          if (ef.stat === 'faithMult') v += H.incomeOf(state, pid) * (ef.value - 1) * ef.turns * per.economy * 0.6;
          if (ef.stat === 'faithPerControlled') v += H.controlledCount(state, pid) * ef.value * ef.turns * per.economy * 0.6;
          if (ef.stat === 'priestMult') v += H.playerPriests(state, pid).filter(function (pr) { var o = H.settlementAt(state, pr.tile); return o && convertible(E, state, o, pid) >= 1; }).length * 0.6 * (ef.value - 1) * ef.turns * 1.2;
          if (ef.stat === 'routeMult') v += H.activeRoutes(state, pid).length * (RL.routes.faithPer + p.mods.routeFaith) * (ef.value - 1) * ef.turns * 0.8 + H.activeRoutes(state, pid).length * 0.5;
          if (ef.stat === 'omenFree') v += H.hiddenSettlements(state, pid).length ? Math.min(6, H.omenCost(state, pid)) * 0.5 : 0;
          if (ef.stat === 'pressureMult') v += 4;
          break;
        case 'shrineBoost':
          if (!s || !s.shrine) break;
          if (ef.stat === 'pressure') v += nearbyValue(E, state, tile, pid, H.shrineRadius(state, s)) * (ef.value - 1) * ef.turns * 0.35;
          if (ef.stat === 'radius') { var ring = 0; state.settlements.forEach(function (o) { if (H.dist(state, o.tile, tile) === H.shrineRadius(state, s) + 1) ring += convertible(E, state, o, pid); }); v += ring * 0.25 * ef.turns * 0.5; }
          break;
        case 'siteBoon':
          var sites = ef.radius ? state.settlements.filter(function (o) { return H.dist(state, o.tile, tile) <= ef.radius && o.followers[pid] > 0; }) : (s ? [s] : []);
          sites.forEach(function (o) {
            var rivalP = 0; state.players.forEach(function (q) { if (q.id !== pid) rivalP += H.pressureAt(state, o, q.id); });
            if (ef.stat === 'pressure') v += convertible(E, state, o, pid) * Math.min(1, ef.value * 0.4) * ef.turns * 0.5 * per.aggression * treatyMult(E, state, pid, H.topRival(o, pid), per);
            if (ef.stat === 'zenith') v += (convertible(E, state, o, pid) * 0.5 + rivalP) * ef.turns * 0.9 * per.aggression * treatyMult(E, state, pid, H.topRival(o, pid), per);
            if (ef.stat === 'resist') v += o.followers[pid] * Math.min(1, rivalP) * (ef.value - 1) * ef.turns * 0.8;
            if (ef.stat === 'growth') v += ef.turns * 0.6;
            if (ef.stat === 'priestPower') v += state.priests.filter(function (pr) { return pr.owner === pid && pr.tile === o.tile; }).length * (ef.value - 1) * ef.turns * 1.2;
            if (ef.stat === 'shield') v += (o.shrine && o.shrine.owner === pid ? threatLevel(E, state, pid, o) * 1.5 : 0);
          });
          break;
        case 'popControlled':
          var k = 0; state.settlements.forEach(function (o) { if (o.controlledBy === pid && o.pop < RL.growth.maxPop && (!ef.terrains || ef.terrains.indexOf(state.map.tiles[o.tile].terrain) >= 0)) k++; });
          v += Math.min(k, ef.max || 99) * ef.amount * 1.2 * Math.min(1, turnsLeft / 10) + (ef.prosperity ? Math.min(k, ef.max || 99) * 0.4 : 0); break;
        case 'popTarget': if (s) v += ef.amount * 2.2 + (s.needs.prosperity <= 3 ? 2 : 0); break;
        case 'faith': v += ef.amount * 0.5; break;
        case 'favor': v += ef.amount * FAVOR_VALUE * 0.5; break;
        case 'prosperity': if (s) v += (s.needs.prosperity <= 3 ? 1.5 : 0.5) * ef.amount * 0.5; break;
        case 'waterBless': case 'rains':
          var list = state.settlements.filter(function (o) { return o.followers[pid] > 0 && H.dist(state, o.tile, tile) <= ef.radius && (ef.type === 'rains' || o === s || state.map.tiles[o.tile].coast); }).slice(0, ef.max);
          list.forEach(function (o) { v += ef.pop * 1.1 + (o.needs.prosperity <= 4 ? 1.5 : 0.4) + (ef.type === 'rains' && H.frontsAt(state, o.tile, 'drought').length ? 3 : 0); });
          v += ef.faithPer * list.length * 0.5; v *= Math.min(1, turnsLeft / 8); break;
        case 'restore':
          if (!s) break; v += Math.min(ef.pop || 0, s.peak - s.pop) * 2 + (ef.prosperity && s.needs.prosperity <= 4 ? 3 : 0.5) + (ef.safety && s.needs.safety <= 3 ? 2 : 0); break;
        case 'trust': v += state.settlements.filter(function (o) { return o.followers[pid] > 0 && H.dist(state, o.tile, tile) <= ef.radius; }).length * (0.6 + (ef.faithPer || 0) * 0.5); break;
        case 'faithPerRoute': v += H.activeRoutes(state, pid).length * ef.amount * 0.5; break;
        case 'strike': case 'weigh': case 'sway':
          if (!s || !p.revealed[s.tile]) return null;
          var val = 0, victim = H.topRival(s, pid);
          if (ef.type === 'strike') { var rf = 0; s.followers.forEach(function (f, r) { if (r !== pid) rf += f; }); val = Math.min(ef.rivalLoss, rf) * 1.6 + (ef.killPriests ? state.priests.filter(function (pr) { return pr.tile === s.tile && pr.owner !== pid; }).length * 5 : 0) + (ef.gain && H.unaffiliated(s) + Math.min(ef.rivalLoss, rf) > 0 ? 1.5 : 0); if (rf < 2) val = 0; }
          else if (ef.type === 'weigh') { s.followers.forEach(function (f, r) { if (r !== pid && f) val += Math.ceil(f * ef.fraction) * 3; }); }
          else { if (victim >= 0) val = Math.min(ef.count, s.followers[victim]) * 3 + (s.controlledBy === victim ? 2 : 0); }
          v += val * per.aggression * treatyMult(E, state, pid, victim, per); break;
        case 'shrineHit': case 'delayedHit':
          if (!s || !s.shrine || s.shrine.owner === pid) return null;
          var hv = 0; state.settlements.forEach(function (o) { var d = H.dist(state, o.tile, s.tile); if (d <= 2) hv += (o.followers[pid] + H.unaffiliated(o) * 0.5 + o.followers[s.shrine.owner] * 0.3) / (1 + d); });
          var dmg = H.hitDamage(state, s, ef.ward, true);
          hv = hv * 0.5 * (s.shrine.ward <= dmg ? 2.5 : 1) * (s.shrine.eclipsed ? 0.3 : 1) * (dmg ? 1 : 0.35) * (ef.type === 'delayedHit' ? 0.85 : 1) * (1 + (ef.eclipse - 2) * 0.15);
          v += hv * per.aggression * treatyMult(E, state, pid, s.shrine.owner, per); break;
        case 'raiseShrine':
          if (!s) return null;
          var sv = (s.pop * 0.6 + convertible(E, state, s, pid) + nearbyValue(E, state, s.tile, pid, 2) * 0.5) * per.expand;
          if (turnsLeft < 6) sv *= turnsLeft / 6;
          extra += Math.round(H.shrineCost(state, pid, s.tile) * ef.costMult);
          if (borderBlocked(E, state, pid, s)) sv *= 0.1;
          v += sv; break;
        case 'popLargest': case 'followersLargest': v += (ef.amount || 1) * 2; break;
        case 'loseFollowersLargest': v -= ef.amount * 3; break;
        case 'freePriest': v += 6; break;
        case 'shrineDiscount': v += 6; break;
        case 'wardAll': v += ownShr.length * 1.5; break;
        case 'wardRandom': v += 1.5; break;
        default: break;
      }
    }
    if (pw.target !== 'none' && tile === undefined) return null;
    return v > 0 ? { v: v, tile: pw.target === 'none' ? undefined : tile, extraCost: extra, role: role } : null;
  }

  function chooseEvent(E, state, pid, level, rng) {
    var ev = E.D.events[state.players[pid].pendingEvent.id];
    if (level === 'easy') return R.int(rng, 2);
    var H = E.helpers, p = state.players[pid];
    var vals = ev.choices.map(function (ch) {
      var v = 0;
      ch.effects.forEach(function (ef) {
        switch (ef.type) {
          case 'faith': v += (ef.amount < 0 && p.faith + ef.amount < 0) ? -50 : ef.amount; break;
          case 'favor': v += ef.amount * FAVOR_VALUE; break;
          case 'followersLargest': v += ef.amount * 3; break;
          case 'loseFollowersLargest': v -= ef.amount * 3.2; break;
          case 'popControlled': v += Math.min(H.controlledCount(state, pid), ef.max || 99) * 1.5; break;
          case 'popLargest': v += 2; break;
          case 'revealNearestSettlements': v += Math.min(ef.count, H.hiddenSettlements(state, pid).length) * 5; break;
          case 'freePriest': v += H.playerPriests(state, pid).length < 4 ? 12 : 4; break;
          case 'buff': v += ef.stat === 'pressureMult' ? 8 : 4; break;
          case 'shrineDiscount': v += 12; break;
          case 'wardAll': v += H.playerShrines(state, pid).length * 2; break;
          case 'wardRandom': v += 2; break;
          case 'prosperity': v += 2; break;
          case 'forecast': v += 2; break;
          default: v += 1;
        }
      });
      return v;
    });
    return vals[1] > vals[0] ? 1 : 0;
  }

  /* Convenience: run an entire AI turn in place (simulator). */
  function playTurn(E, state, opts) {
    var pid = state.current, guard = 0;
    while (!state.over && state.current === pid && guard++ < 60) {
      var a = nextAction(E, state, opts), err = E.apply(state, a);
      if (err) { E.apply(state, { type: 'endTurn' }); stats.illegal = (stats.illegal || 0) + 1; }
      if (a.type === 'endTurn') break;
    }
    if (!state.over && state.current === pid) { state.players[pid].pendingEvent = null; E.apply(state, { type: 'endTurn' }); stats.forcedEnd = (stats.forcedEnd || 0) + 1; }
  }

  return { nextAction: nextAction, playTurn: playTurn, personality: personality, VALUED: VALUED, stats: stats, lookahead: lookahead };
});
