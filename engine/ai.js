/*
 * Pantheon Wars v0.1 — AI gods. Pure: reads state, returns ONE action for state.current.
 * Two levels: 'easy' (Acolyte) and 'hard' (Hierophant). Rules are documented in docs/ai.md.
 * Determinism: no Math.random. Hard AI is a deterministic utility maximiser; Easy AI draws from a private
 * PRNG seeded by (seed, turn, player, action index) so it never perturbs the game's own RNG stream.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rng.js'));
  else root.PWAI = factory(root.PWRng);
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';
  var FAVOR_VALUE = 6;            // 1 Favor is worth ~6 Faith to the AI
  var MAX_ACTIONS_PER_TURN = 24;

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

  function nextAction(E, state) {
    var pid = state.current, p = state.players[pid], H = E.helpers, level = p.ai === 'easy' ? 'easy' : 'hard';
    var n = actionsThisTurn(state);
    var rng = R.make(state.seed + ':ai:' + state.turn + ':' + pid + ':' + n);
    var per = level === 'hard' ? personality(state, pid) : { expand: 1, aggression: 0.6, explore: 1, economy: 0.8 };
    if (p.pendingEvent) return { type: 'event', choice: chooseEvent(E, state, pid, level, rng) };
    if (n >= MAX_ACTIONS_PER_TURN) return { type: 'endTurn' };
    var mv = priestOrders(E, state, pid, level, rng);
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
    var best = cands[0];
    // Saving rule: if a shrine is the best long-term buy but unaffordable soon, don't fritter Faith.
    var saveFor = shrineWish(E, state, pid, per);
    if (saveFor && best.faith > 0 && best.a.type !== 'shrine' && best.u < saveFor.u * 0.8 && p.faith - best.faith < saveFor.cost && p.faith + H.incomeOf(state, pid) * 2 >= saveFor.cost) return { type: 'endTurn' };
    return best.u >= 0.5 ? best.a : { type: 'endTurn' };
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
  function shrineWish(E, state, pid, per) {
    var H = E.helpers, p = state.players[pid], best = null, cost = H.shrineCost(state, pid);
    state.settlements.forEach(function (s) {
      if (s.shrine || !p.revealed[s.tile]) return;
      var presence = s.followers[pid] > 0 || H.inTerritory(state, pid, s.tile) || state.priests.some(function (pr) { return pr.owner === pid && pr.tile === s.tile; });
      if (!presence) return;
      var v = (s.pop * 0.6 + convertible(E, state, s, pid) + nearbyValue(E, state, s.tile, pid, 2) * 0.5) * per.expand;
      var turnsLeft = state.maxTurns - state.turn; if (turnsLeft < 6) v *= turnsLeft / 6;
      var u = v * 10 / cost;
      if (!best || u > best.u) best = { u: u, tile: s.tile, cost: cost };
    });
    return best;
  }
  function bestOmenTile(E, state, pid, radius) {
    var H = E.helpers, p = state.players[pid], best = null, R0 = E.rules.actions.omen.range;
    var home = state.settlements[p.home].tile;
    state.map.tiles.forEach(function (t) {
      if (p.revealed[t.id]) return;
      var area = H.inRadius(state, t.id, radius), hidden = 0;
      area.forEach(function (id) { if (!p.revealed[id]) hidden++; });
      if (hidden < 4) return;
      var near = H.inRadius(state, t.id, R0).some(function (id) { return p.revealed[id]; });
      if (!near) return;
      var sc = hidden - H.dist(state, t.id, home) * 0.3;
      if (!best || sc > best.sc || (sc === best.sc && t.id < best.tile)) best = { tile: t.id, sc: sc, hidden: hidden };
    });
    return best;
  }

  function candidates(E, state, pid, per, level) {
    var H = E.helpers, D = E.D, A = E.rules.actions, p = state.players[pid], out = [];
    var turnsLeft = state.maxTurns - state.turn, hiddenS = H.hiddenSettlements(state, pid).length, totalS = state.settlements.length;
    var exploreNeed = (hiddenS / totalS) * (turnsLeft > 10 ? 1 : 0.3) * per.explore;
    function push(a, u, faith, favor, key) { out.push({ a: a, u: u, faith: faith || 0, favor: favor || 0, key: key || JSON.stringify(a) }); }

    // shrines
    var sw = shrineWish(E, state, pid, per);
    if (sw && p.faith >= sw.cost) push({ type: 'shrine', tile: sw.tile }, sw.u, sw.cost);
    // priests
    var cap = H.priestCap(state, pid), mine = H.playerPriests(state, pid).length;
    if (mine < cap && p.faith >= A.priest.faith) {
      var homeShrine = H.playerShrines(state, pid).filter(function (s) { return !s.shrine.eclipsed; })[0] || H.playerShrines(state, pid)[0];
      var tgt = bestPriestTarget(E, state, pid, homeShrine ? homeShrine.tile : null, {});
      if (homeShrine && tgt) push({ type: 'priest', tile: homeShrine.tile, dest: tgt.tile }, tgt.v * 0.9 * per.expand * 10 / A.priest.faith, A.priest.faith);
    }
    // omen
    var oc = H.omenCost(state, pid);
    if (!p.flags.omenUsed && p.faith >= oc && hiddenS > 0) {
      var ot = bestOmenTile(E, state, pid, A.omen.radius + p.mods.omenRadius);
      if (ot) push({ type: 'omen', tile: ot.tile }, exploreNeed * ot.hidden * 0.5 * 6 / oc, oc);
    }
    // dream
    if (!(p.cooldowns.dream > 0) && p.favor >= A.dream.favor && hiddenS > 0) push({ type: 'dream' }, exploreNeed * 6 / (A.dream.favor * FAVOR_VALUE) * 6, 0, A.dream.favor);
    // eclipse
    var ec = H.eclipseCost(state, pid);
    if (!(p.cooldowns.eclipse > 0) && p.favor >= ec) {
      var et = bestRivalShrine(E, state, pid, A.eclipse.range);
      if (et) push({ type: 'eclipse', tile: et.tile }, et.v * per.aggression * 10 / (ec * FAVOR_VALUE), 0, ec);
    }
    // powers
    D.factions[p.faction].powers.forEach(function (pwId) {
      var pw = D.powers[pwId];
      if (p.cooldowns[pw.id] > 0 || p.faith < pw.cost.faith || p.favor < pw.cost.favor) return;
      var cost = pw.cost.faith + pw.cost.favor * FAVOR_VALUE, ev = powerValue(E, state, pid, pw, per, exploreNeed);
      if (!ev) return;
      push({ type: 'power', power: pw.id, tile: ev.tile }, ev.v * 10 / Math.max(4, cost + (ev.extraCost || 0)), pw.cost.faith, pw.cost.favor);
    });
    return out;
  }

  function bestPriestTarget(E, state, pid, from, taken) {
    var H = E.helpers, p = state.players[pid], best = null;
    state.settlements.forEach(function (s) {
      if (!p.revealed[s.tile] || taken[s.tile]) return;
      var c = convertible(E, state, s, pid); if (c < 1) return;
      var d = from === null ? 0 : H.dist(state, from, s.tile);
      if (from !== null && !H.pathStep(state, pid, from, s.tile)) return;
      var others = state.priests.filter(function (pr) { return pr.owner === pid && (pr.dest === s.tile || pr.tile === s.tile); }).length;
      var v = c / (1 + d * 0.35) / (1 + others);
      if (!best || v > best.v || (v === best.v && s.tile < best.tile)) best = { tile: s.tile, v: v };
    });
    return best;
  }

  function priestOrders(E, state, pid, level, rng) {
    var H = E.helpers, taken = {};
    var mine = H.playerPriests(state, pid);
    mine.forEach(function (pr) { if (pr.dest !== null) taken[pr.dest] = 1; });
    for (var i = 0; i < mine.length; i++) {
      var pr = mine[i], here = H.settlementAt(state, pr.tile);
      var arrived = pr.dest === null || pr.dest === pr.tile;
      if (!arrived) continue;
      var done = !here || convertible(E, state, here, pid) < 1 || (here.followers[pid] / here.pop >= 0.85);
      if (!done && pr.dest !== null) continue;
      var tgt;
      if (level === 'easy') {
        var opts = state.settlements.filter(function (s) { return state.players[pid].revealed[s.tile] && H.unaffiliated(s) > 0 && s.tile !== pr.tile; })
          .sort(function (a, b) { return H.dist(state, pr.tile, a.tile) - H.dist(state, pr.tile, b.tile) || a.id - b.id; }).slice(0, 3);
        tgt = opts.length ? { tile: R.pick(rng, opts).tile } : null;
      } else {
        delete taken[pr.dest];
        tgt = bestPriestTarget(E, state, pid, pr.tile, taken);
      }
      if (tgt && tgt.tile !== pr.dest && tgt.tile !== pr.tile) { var a = { type: 'movePriest', priest: pr.id, tile: tgt.tile }; if (!E.validate(state, a)) return a; }
      if (pr.dest === null && (!tgt || tgt.tile === pr.tile)) continue;
    }
    return null;
  }

  function bestRivalShrine(E, state, pid, range) {
    var H = E.helpers, best = null;
    state.settlements.forEach(function (s) {
      if (!s.shrine || s.shrine.owner === pid) return;
      if (H.targetError(state, pid, 'rivalShrine', s.tile, range)) return;
      var v = 0;
      state.settlements.forEach(function (o) { var d = H.dist(state, o.tile, s.tile); if (d <= 2) v += (o.followers[pid] + H.unaffiliated(o) * 0.5 + o.followers[s.shrine.owner] * 0.3) / (1 + d); });
      v = v * 0.5 * (s.shrine.ward <= 1 ? 2.5 : 1) * (s.shrine.eclipsed ? 0.3 : 1);
      if (!best || v > best.v || (v === best.v && s.tile < best.tile)) best = { tile: s.tile, v: v };
    });
    return best;
  }

  function powerValue(E, state, pid, pw, per, exploreNeed) {
    var H = E.helpers, p = state.players[pid], v = 0, tile = null, turnsLeft = state.maxTurns - state.turn;
    var ownShr = H.playerShrines(state, pid);
    for (var i = 0; i < pw.effects.length; i++) {
      var ef = pw.effects[i];
      switch (ef.type) {
        case 'reveal': var ot = bestOmenTile(E, state, pid, ef.radius); if (ot) { v += exploreNeed * ot.hidden * 0.5; tile = ot.tile; } break;
        case 'revealBand':
          var bestRow = -1, bh = 0; for (var r = 1; r < state.map.h - 1; r++) { var hcount = 0; state.map.tiles.forEach(function (t) { if (Math.abs(t.r - r) <= 1 && !p.revealed[t.id] && t.settlement >= 0) hcount += 4; else if (Math.abs(t.r - r) <= 1 && !p.revealed[t.id]) hcount += 0.3; }); if (hcount > bh) { bh = hcount; bestRow = r; } }
          if (bestRow >= 0) { v += exploreNeed * bh * 0.6; tile = bestRow * state.map.w + Math.floor(state.map.w / 2); } break;
        case 'revealNearestSettlements': if (H.hiddenSettlements(state, pid).length) v += exploreNeed * 8 * Math.min(ef.count, H.hiddenSettlements(state, pid).length); break;
        case 'spawnPriest':
          if (!ownShr.length) return null;
          var bt = bestPriestTarget(E, state, pid, ownShr[0].tile, {}); v += bt ? bt.v * 0.9 * per.expand : 0;
          if (tile === null) tile = pickOwnShrine(E, state, pid); break;
        case 'ward': var ws = pickOwnShrine(E, state, pid, true); if (ws !== null) { tile = ws; var sh = H.settlementAt(state, ws).shrine; v += (sh.ward <= 1 ? 6 : 1.5) + (sh.eclipsed ? 4 : 0); } break;
        case 'clearEclipse': break;
        case 'buff':
          if (ef.stat === 'faithMult') v += H.incomeOf(state, pid) * (ef.value - 1) * ef.turns * per.economy * 0.6;
          if (ef.stat === 'faithPerControlled') v += H.controlledCount(state, pid) * ef.value * ef.turns * per.economy * 0.6;
          if (ef.stat === 'priestMult') v += H.playerPriests(state, pid).filter(function (pr) { var s = H.settlementAt(state, pr.tile); return s && convertible(E, state, s, pid) >= 1; }).length * 0.6 * (ef.value - 1) * ef.turns * 1.2;
          break;
        case 'popControlled': v += H.controlledCount(state, pid) * ef.amount * 1.2 * Math.min(1, turnsLeft / 10); break;
        case 'popTarget':
          var bestS = null; state.settlements.forEach(function (s) { if (s.followers[pid] > 0 && (!bestS || s.followers[pid] > bestS.followers[pid])) bestS = s; });
          if (bestS) { tile = bestS.tile; v += ef.amount * 2.2; } break;
        case 'faith': v += ef.amount * 0.5; break;
        case 'strike': case 'weigh':
          var bs = null;
          state.settlements.forEach(function (s) {
            if (!p.revealed[s.tile]) return;
            var val = 0;
            if (ef.type === 'strike') { var rf = 0; s.followers.forEach(function (f, r) { if (r !== pid) rf += f; }); val = Math.min(ef.rivalLoss, rf) * 1.6 + state.priests.filter(function (pr) { return pr.tile === s.tile && pr.owner !== pid; }).length * 5 + (H.unaffiliated(s) + Math.min(ef.rivalLoss, rf) > 0 ? 1.5 : 0); if (rf < 2) val = 0; }
            else { s.followers.forEach(function (f, r) { if (r !== pid && f) val += Math.ceil(f * ef.fraction) * 3; }); }
            if (!bs || val > bs.v || (val === bs.v && s.tile < bs.tile)) bs = { tile: s.tile, v: val };
          });
          if (bs && bs.v > 0) { v += bs.v * per.aggression; tile = bs.tile; } break;
        case 'shrineHit': var rs = bestRivalShrine(E, state, pid, pw.range); if (rs) { v += rs.v * per.aggression; tile = rs.tile; } break;
        case 'raiseShrine':
          var site = null; state.settlements.forEach(function (s) {
            if (H.targetError(state, pid, 'shrineSite', s.tile, ef.range)) return;
            var sv = (s.pop * 0.6 + convertible(E, state, s, pid) + nearbyValue(E, state, s.tile, pid, 2) * 0.5) * per.expand;
            if (!site || sv > site.v) site = { tile: s.tile, v: sv };
          });
          if (!site || p.faith < Math.round(H.shrineCost(state, pid) * ef.costMult)) return null;
          v += site.v; tile = site.tile; return { v: v, tile: tile, extraCost: Math.round(H.shrineCost(state, pid) * ef.costMult) };
        default: break;
      }
    }
    if (pw.target !== 'none' && tile === null) return null;
    if (pw.target === 'none') tile = undefined;
    return v > 0 ? { v: v, tile: tile } : null;
  }
  function pickOwnShrine(E, state, pid, needy) {
    var H = E.helpers, best = null;
    H.playerShrines(state, pid).forEach(function (s) {
      var sc = needy ? (5 - s.shrine.ward) * 2 + (s.shrine.eclipsed ? 5 : 0) : nearbyValue(E, state, s.tile, pid, 3);
      if (!best || sc > best.sc) best = { tile: s.tile, sc: sc };
    });
    return best ? best.tile : null;
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
          case 'popControlled': v += H.controlledCount(state, pid) * 1.5; break;
          case 'popLargest': v += 2; break;
          case 'revealNearestSettlements': v += Math.min(ef.count, H.hiddenSettlements(state, pid).length) * 5; break;
          case 'freePriest': v += H.playerPriests(state, pid).length < 4 ? 12 : 4; break;
          case 'buff': v += ef.stat === 'pressureMult' ? 8 : 4; break;
          case 'shrineDiscount': v += 12; break;
          case 'wardAll': v += H.playerShrines(state, pid).length * 2; break;
          case 'wardRandom': v += 2; break;
          default: v += 1;
        }
      });
      return v;
    });
    return vals[1] > vals[0] ? 1 : 0;
  }

  /* Convenience: run an entire AI turn in place (simulator). */
  function playTurn(E, state) {
    var pid = state.current, guard = 0;
    while (!state.over && state.current === pid && guard++ < 60) {
      var a = nextAction(E, state), err = E.apply(state, a);
      if (err) { E.apply(state, { type: 'endTurn' }); }
      if (a.type === 'endTurn') break;
    }
  }

  return { nextAction: nextAction, playTurn: playTurn, personality: personality };
});
