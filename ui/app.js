/*
 * Pantheon Wars — UI controller. Owns no rules: every change goes through PWEngine.step (validated, pure),
 * so the display can never desynchronise from the deterministic engine. AI gods are driven by PWAI.nextAction.
 * URL params (used by tests and for sharing): ?seed=N&faction=greek|norse|egyptian&rivals=1|2&diff=easy|hard&autostart=1&quality=high|low&speed=0..1
 */
(function () {
  'use strict';
  var D = window.PW_DATA, E = PWEngine.create(D), H = E.helpers, AI = window.PWAI, A = window.PWArt;
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SPEED = params.has('speed') ? Math.max(0, +params.get('speed')) : 1;
  var FACTIONS = {}; D.factions.forEach(function (f) { FACTIONS[f.id] = f; });
  var POWERS = {}; D.powers.forEach(function (p) { POWERS[p.id] = p; });
  var EVENTS = {}; D.events.forEach(function (e) { EVENTS[e.id] = e; });
  var DOMAINS = {}; D.domains.forEach(function (d) { DOMAINS[d.id] = d; });
  var RA = D.rules.actions;

  var app = { state: null, human: 0, cfg: null, mode: null, selPriest: null, busy: false, logSeen: 0, renderer: null, title: true, aiTimer: null };
  var canvas = $('world'), R = new PWRenderer(canvas, D); app.renderer = R;
  if (params.get('quality')) { R.autoQuality = false; R.quality = params.get('quality'); }

  /* ------------------------------------------------------------ helpers */
  function pal(pid) { return FACTIONS[app.state.players[pid].faction].palette; }
  function me() { return app.state.players[app.human]; }
  function myTurn() { var s = app.state; return s && !s.over && s.current === app.human && !app.busy; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms * SPEED); }); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toast(msg, err) { var d = document.createElement('div'); d.className = 'toast' + (err ? ' err' : ''); d.textContent = msg; $('toasts').appendChild(d); setTimeout(function () { d.remove(); }, 3100); }
  function fmt(n) { return (Math.round(n * 10) / 10).toString(); }
  function costStr(c) { var a = []; if (c.faith) a.push(c.faith + ' Faith'); if (c.favor) a.push(c.favor + ' Favor'); return a.join(' + ') || 'free'; }

  /* ------------------------------------------------------------ action catalogue (power bar) */
  // Core rites shared by all gods + the four faction powers. target: how the UI collects a tile.
  function barItems() {
    var p = me(), s = app.state, f = FACTIONS[p.faction];
    var core = [
      { id: 'omen', name: 'Read Omens', icon: 'omen', x: 'explore', target: 'omen', cost: { faith: H.omenCost(s, p.id) }, cd: 0, text: 'Lift the fog in radius ' + (RA.omen.radius + p.mods.omenRadius) + ' around a hex within ' + RA.omen.range + ' of the known world. Once per turn.' },
      { id: 'dream', name: 'Dream Vision', icon: 'dream', x: 'explore', target: 'none', cost: { favor: RA.dream.favor }, cd: p.cooldowns.dream || 0, maxcd: RA.dream.cooldown, text: 'Send a dream that reveals the nearest hidden settlement.' },
      { id: 'shrine', name: 'Raise Shrine', icon: 'shrine', x: 'expand', target: 'tile', cost: { faith: H.shrineCost(s, p.id) }, cd: 0, text: 'Build a ' + H.shrineDef(s, p.id).name + ' where you have followers, a priest or territory. Each shrine raises the next one\'s cost.' },
      { id: 'priest', name: 'Ordain Priest', icon: 'priest', x: 'expand', target: 'tile', cost: { faith: RA.priest.faith }, cd: 0, text: 'A priest at one of your shrines. Priests walk ' + RA.priest.move + ' hexes a turn and preach where they stand. Limit: ' + H.priestCap(s, p.id) + '.' },
      { id: 'eclipse', name: 'Eclipse', icon: 'eclipse', x: 'exterminate', target: 'tile', cost: { favor: H.eclipseCost(s, p.id) }, cd: p.cooldowns.eclipse || 0, maxcd: RA.eclipse.cooldown, text: 'Darken a rival shrine within ' + RA.eclipse.range + ' of your shrines or priests: −1 Ward and silent for ' + RA.eclipse.duration + ' turns. At 0 Ward it falls.' }
    ];
    var fp = f.powers.map(function (id) { var pw = POWERS[id]; return { id: id, power: true, name: pw.name, icon: pw.icon, x: pw.x, target: pw.target === 'none' ? 'none' : 'tile', cost: pw.cost, cd: p.cooldowns[id] || 0, maxcd: pw.cooldown, text: pw.text, inspired: pw.inspiredBy }; });
    return core.concat(fp);
  }
  function actionFor(item, tile) {
    if (item.power) return tile === undefined ? { type: 'power', power: item.id } : { type: 'power', power: item.id, tile: tile };
    return tile === undefined ? { type: item.id } : { type: item.id, tile: tile };
  }
  function validTargets(item) {
    var s = app.state, out = [];
    for (var i = 0; i < s.map.tiles.length; i++) {
      if (item.target === 'omen' && me().revealed[i]) continue; // omens on known land are wasted; still legal but not suggested
      if (!E.validate(s, actionFor(item, i))) out.push(i);
    }
    return out;
  }
  function itemError(item) {
    var s = app.state;
    if (item.target === 'none') return E.validate(s, actionFor(item));
    if (item.cd > 0) return item.name + ' is recovering (' + item.cd + ')';
    var probe = E.validate(s, actionFor(item, me().home !== undefined ? s.settlements[me().home].tile : 0));
    if (probe && /Faith|Favor|afford|already read|limit/.test(probe)) return probe;
    return validTargets(item).length ? null : 'no valid target right now';
  }

  /* ------------------------------------------------------------ doing things */
  function act(action, quiet) {
    var err = E.validate(app.state, action);
    if (err) { if (!quiet) toast(err.charAt(0).toUpperCase() + err.slice(1) + '.', true); return false; }
    var prev = app.state; app.state = E.step(prev, action);
    afterChange(prev);
    return true;
  }
  function afterChange(prev) {
    var s = app.state;
    R.setState(s, app.human);
    var newLog = s.log.slice(app.logSeen); app.logSeen = s.log.length;
    newLog.forEach(function (e) { fxFor(e); appendLog(e); });
    if (prev) diffTexts(prev, s);
    updateHud();
    if (s.over) { setTimeout(showVictory, reduced ? 50 : 1400 * SPEED); return; }
    if (s.current === app.human && me().pendingEvent) showEvent();
  }
  function visible(tile) { return tile === null || tile === undefined || me().revealed[tile]; }
  function fxFor(e) {
    var x = e.x || {}, col = e.p >= 0 ? pal(e.p).glow : '#ffe08a', mine = e.p === app.human;
    if (x.tile !== undefined && x.tile !== null && !visible(x.tile) && !mine) return;
    switch (e.k) {
      case 'reveal':
        if (!mine) break;
        if (x.band) { var row = Math.round((x.band[0] + x.band[1]) / 2), t = app.state.map.tiles.find(function (tt) { return tt.r === row && tt.q === Math.floor(app.state.map.w / 2); }); R.addFx('band', t ? t.id : x.tile, { rows: x.band[1] - x.band[0] + 1 }); }
        else if (x.tiles) x.tiles.forEach(function (id) { R.addFx('reveal', id, { color: col, radius: 1 }); });
        else if (x.tile !== null && x.tile !== undefined) R.addFx('reveal', x.tile, { color: col, radius: x.radius });
        break;
      case 'shrine': R.addFx('shrine', x.tile, { color: col }); break;
      case 'priest': if (x.tile !== undefined) R.addFx('priest', x.tile, { color: col }); break;
      case 'control': R.addFx('control', x.tile, { color: col }); R.addText(x.tile, mine ? 'Kneels to you' : 'Kneels to ' + FACTIONS[app.state.players[e.p].faction].tradition.replace('Ancient ', ''), mine ? '#fff0b0' : col); break;
      case 'miracle': R.addFx(x.fx, x.tile, { color: col }); break;
      case 'eclipse': case 'topple': R.addFx(e.k, x.tile); break;
      case 'power': if (x.fx === 'hammer' && x.tile !== null) R.addFx('hammer', x.tile); if ((x.fx === 'sheaf' || x.fx === 'sunrain' || x.fx === 'sprout') && mine) app.state.settlements.forEach(function (st) { if (st.controlledBy === app.human) R.addFx('growth', st.tile); }); break;
      case 'growth': if (x.tile !== undefined) R.addFx('growth', x.tile); break;
      case 'victory': R.addFx('victory'); break;
    }
  }
  function diffTexts(a, b) {
    if (a.turn === b.turn && a.current === b.current) return; // only after round resolution / turn passes
    b.settlements.forEach(function (s, i) {
      if (!me().revealed[s.tile]) return;
      var d = s.followers[app.human] - a.settlements[i].followers[app.human];
      if (d > 0) R.addText(s.tile, '+' + d, '#c8ff9a'); else if (d < 0) R.addText(s.tile, String(d), '#ff9a8a');
    });
  }
  function appendLog(e) {
    var x = e.x || {};
    if (e.p >= 0 && e.p !== app.human && x.tile !== undefined && x.tile !== null && !me().revealed[x.tile] && e.k !== 'eliminated' && e.k !== 'victory') return;
    if (e.p >= 0 && e.p !== app.human && (e.k === 'reveal' || e.k === 'card' || e.k === 'event')) return; // rivals' private visions
    var li = document.createElement('li');
    li.style.borderLeftColor = e.p >= 0 ? pal(e.p).secondary : '#d8b25a';
    li.innerHTML = '<span class="t">T' + e.t + '</span>' + esc(e.m);
    if (x.tile !== undefined && x.tile !== null) { li.tabIndex = 0; li.style.cursor = 'pointer'; li.onclick = li.onkeydown = function (ev) { if (ev.type === 'keydown' && ev.key !== 'Enter') return; R.focusTile(x.tile); select(x.tile); }; }
    var ol = $('log'); ol.appendChild(li); while (ol.children.length > 160) ol.removeChild(ol.firstChild); ol.scrollTop = ol.scrollHeight;
  }

  /* ------------------------------------------------------------ turn flow */
  function endTurn() {
    if (!myTurn()) return;
    if (me().pendingEvent) { showEvent(); return; }
    cancelMode(); deselectPriest();
    var turnBefore = app.state.turn;
    act({ type: 'endTurn' });
    runAI(turnBefore);
  }
  function runAI(turnBefore) {
    app.busy = true; updateHud();
    var steps = 0;
    function tick() {
      var s = app.state;
      if (s.over) { app.busy = false; updateHud(); return; }
      if (s.current === app.human) {
        app.busy = false; updateHud();
        if (s.turn !== turnBefore) banner('Turn ' + s.turn);
        return;
      }
      var a = AI.nextAction(E, s), prev = s;
      var err = E.validate(s, a); if (err) a = { type: 'endTurn' };
      app.state = E.step(s, a); steps++;
      if (a.type === 'endTurn' && app.state.turn !== prev.turn) banner('Turn ' + app.state.turn);
      afterChange(prev);
      var vis = a.tile !== undefined && a.tile !== null && me().revealed[a.tile];
      var delay = a.type === 'endTurn' ? 250 : (vis && (a.type === 'power' || a.type === 'eclipse' || a.type === 'shrine') ? 900 : 90);
      if (vis && delay > 500 && params.get('follow') !== '0') R.focusTile(a.tile);
      app.aiTimer = setTimeout(tick, delay * SPEED);
    }
    app.aiTimer = setTimeout(tick, 200 * SPEED);
  }
  function banner(text) { var b = $('turnbanner'); b.textContent = text; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }

  /* ------------------------------------------------------------ selection & targeting */
  function select(tile) {
    R.selected = tile; app.selTile = tile; renderPanel();
  }
  function onTileClick(tile) {
    if (tile < 0) { cancelMode(); return; }
    if (app.mode) {
      var err = E.validate(app.state, actionFor(app.mode.item, tile)); if (err) { toast(err.charAt(0).toUpperCase() + err.slice(1) + '.', true); return; }
      var item = app.mode.item; cancelMode();
      act(actionFor(item, tile)); select(tile); return;
    }
    if (app.selPriest !== null && myTurn()) {
      var pr = app.state.priests.find(function (p) { return p.id === app.selPriest; });
      if (pr && tile !== pr.tile) { if (act({ type: 'movePriest', priest: pr.id, tile: tile })) { toast('The priest sets out.'); deselectPriest(); select(tile); } return; }
      deselectPriest(); select(tile); return; // clicking the priest's own hex again cancels the order and shows the place
    }
    // clicking own priest selects it (cycles through priests on that tile)
    var mine = app.state.priests.filter(function (p) { return p.owner === app.human && p.tile === tile; });
    if (mine.length && myTurn() && app.selTile === tile) {
      var idx = mine.findIndex(function (p) { return p.id === app.selPriest; });
      selectPriest(mine[(idx + 1) % mine.length].id); return;
    }
    select(tile);
  }
  function selectPriest(id) { app.selPriest = id; R.path = null; renderPanel(); $('target-text').textContent = 'Choose where your priest should walk.'; $('targetbar').hidden = false; }
  function deselectPriest() { app.selPriest = null; R.path = null; if (!app.mode) $('targetbar').hidden = true; renderPanel(); }
  function arm(item) {
    if (!myTurn()) return;
    if (me().pendingEvent) { showEvent(); return; }
    var err = itemError(item); if (err) { toast(err.charAt(0).toUpperCase() + err.slice(1) + '.', true); return; }
    if (item.target === 'none') { act(actionFor(item)); return; }
    deselectPriest();
    var targets = validTargets(item);
    app.mode = { item: item, targets: targets }; R.targets = targets; canvas.classList.add('targeting');
    $('target-text').textContent = item.name + ': choose a highlighted hex (' + targets.length + ').'; $('targetbar').hidden = false;
    updatePowerbar();
  }
  function cancelMode() { app.mode = null; R.targets = null; canvas.classList.remove('targeting'); if (app.selPriest === null) $('targetbar').hidden = true; updatePowerbar(); }

  /* ------------------------------------------------------------ HUD */
  function updateHud() {
    if (!app.state) return;
    var s = app.state, p = me(), tp = H.totalPop(s), fol = H.followersOf(s, p.id), inc = H.incomeOf(s, p.id), sc = H.shrineCost(s, p.id);
    $('tb-name').textContent = p.name; $('tb-sub').textContent = FACTIONS[p.faction].deityTitle + ' · ' + FACTIONS[p.faction].tradition;
    $('tb-faith').textContent = fmt(p.faith); $('tb-inc').textContent = '+' + fmt(inc) + '/turn';
    var fm = $('faith-meter'), pct = Math.min(100, p.faith / sc * 100); fm.firstElementChild.style.width = pct + '%'; fm.setAttribute('aria-valuenow', Math.round(pct)); $('faith-meter-label').textContent = 'shrine ' + sc;
    $('tb-favor').textContent = p.favor; $('tb-favcap').textContent = ' / ' + D.rules.economy.favorCap;
    $('tb-follow').textContent = fol; $('tb-share').textContent = Math.round(fol / tp * 100) + '%';
    $('tb-turn').textContent = s.turn; $('tb-maxturn').textContent = ' / ' + s.maxTurns;
    var asc = $('asc-meter'); asc.innerHTML = '';
    s.players.forEach(function (pl) { var i = document.createElement('i'); i.style.width = (H.followersOf(s, pl.id) / tp * 100) + '%'; i.style.background = pal(pl.id).secondary; i.title = pl.name + ': ' + H.followersOf(s, pl.id); asc.appendChild(i); });
    var thr = document.createElement('div'); thr.className = 'thr'; thr.style.left = (D.rules.victory.ascendancyShare * 100) + '%'; asc.appendChild(thr);
    var et = $('endturn'), busy = app.busy || s.current !== app.human;
    et.disabled = busy || s.over; et.classList.toggle('event', !!p.pendingEvent && !busy); et.classList.toggle('ready', !busy && !p.pendingEvent && !reduced);
    $('endturn-label').textContent = busy ? 'Rivals act…' : (p.pendingEvent ? 'Event' : 'End Turn');
    $('endturn-sub').textContent = busy ? s.players[s.current].name.replace(/^The /, '') : (p.pendingEvent ? 'Resolve card' : 'Turn ' + s.turn);
    updatePowerbar(); renderPanel();
    R.drawMinimap($('minimap'));
    $('menu-seed').textContent = s.seed; $('menu-hash').textContent = E.hash(s);
  }
  var iconCache = {};
  function iconCanvas(id) { if (!iconCache[id]) iconCache[id] = A.icon(id, 48); var c = document.createElement('canvas'); c.width = 48; c.height = 48; c.getContext('2d').drawImage(iconCache[id], 0, 0); return c; }
  function updatePowerbar() {
    if (!app.state) return;
    var bar = $('powerbar'), items = barItems();
    if (bar.childElementCount !== items.length + 1) {
      bar.innerHTML = '';
      items.forEach(function (it, i) {
        if (i === 5) { var sep = document.createElement('div'); sep.className = 'sep'; bar.appendChild(sep); }
        var b = document.createElement('button'); b.className = 'pw x-' + it.x + (it.power ? ' faction' : ''); b.dataset.id = it.id;
        b.innerHTML = '<span class="key">' + (i + 1) + '</span><span class="cst"></span>'; b.appendChild(iconCanvas(it.icon));
        var nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = it.name; b.appendChild(nm);
        var cd = document.createElement('span'); cd.className = 'cd'; cd.hidden = true; b.appendChild(cd);
        b.onclick = function () { var cur = barItems()[i]; if (app.mode && app.mode.item.id === cur.id) cancelMode(); else arm(cur); };
        bar.appendChild(b);
      });
    }
    var btns = bar.querySelectorAll('.pw');
    items.forEach(function (it, i) {
      var b = btns[i], err = myTurn() ? itemError(it) : 'wait for your turn';
      b.classList.toggle('off', !!err); b.classList.toggle('armed', !!(app.mode && app.mode.item.id === it.id));
      b.querySelector('.cst').textContent = (it.cost.faith ? it.cost.faith + '✦' : '') + (it.cost.favor ? ' ' + it.cost.favor + '★' : '');
      var cd = b.querySelector('.cd'); cd.hidden = !(it.cd > 0); if (it.cd > 0) { cd.textContent = it.cd; cd.style.setProperty('--cd', (it.cd / (it.maxcd || it.cd)).toFixed(3)); }
      var tip = it.name + ' (' + (i + 1) + ') — ' + costStr(it.cost) + (it.maxcd ? ', cooldown ' + it.maxcd : '') + '. ' + it.text + (it.inspired ? ' Inspired by ' + it.inspired + '.' : '') + (err ? ' [' + err + ']' : '');
      b.title = tip; b.setAttribute('aria-label', tip); b.setAttribute('aria-disabled', err ? 'true' : 'false');
    });
  }
  function renderPanel() {
    var el = $('panel'), s = app.state; if (!s) { el.innerHTML = ''; return; }
    var tile = app.selTile, h = '';
    if (app.selPriest !== null) {
      var pr = s.priests.find(function (p) { return p.id === app.selPriest; });
      if (pr) h += '<h3>Priest of ' + esc(me().name.replace(/^The /, '')) + '</h3><div class="sub">Walks ' + RA.priest.move + ' hexes per turn. Preaches with pressure ' + fmt(RA.priest.power) + ' where it stands.</div><div class="hint">Click any reachable hex to send it; Esc to cancel.</div>' + (pr.dest !== null ? '<div class="row"><span>Heading to</span><span>' + esc(tileName(pr.dest)) + '</span></div>' : '');
      el.innerHTML = h; return;
    }
    if (tile === undefined || tile === null || tile < 0) {
      el.innerHTML = '<h3>' + esc(me().name) + '</h3><div class="sub">' + esc(FACTIONS[me().faction].blurb) + '</div>' + domainRows() + '<div class="hint">Select a settlement to see its people. Your priests can be sent by clicking them twice.</div>'; return;
    }
    var t = s.map.tiles[tile], T = D.terrain.types[t.terrain];
    if (!me().revealed[tile]) { el.innerHTML = '<h3>Unknown lands</h3><div class="sub">Hidden in cloud. Read omens or send a priest.</div>'; return; }
    var st = H.settlementAt(s, tile);
    if (!st) {
      h += '<h3>' + esc(T.name || t.terrain) + '</h3><div class="sub">' + (T.water ? (t.terrain === 'deep' ? 'Open water. Only priests of a seafaring pantheon may cross the shallows.' : 'Shallow water near the coast.') : (t.coast ? 'Coastal · ' : '') + 'height ' + Math.round(t.e * 100) + (T.passable ? '' : ' · impassable')) + '</div>';
      h += priestsHere(tile); el.innerHTML = h; bindPanel(); return;
    }
    h += '<h3>' + esc(st.name) + '</h3><div class="sub">' + esc(T.name || t.terrain) + (t.coast ? ' · coastal' : '') + ' · population ' + st.pop + (st.controlledBy >= 0 ? ' · kneels to ' + esc(s.players[st.controlledBy].name) : ' · undecided') + '</div>';
    h += '<div class="bar" aria-hidden="true">'; st.followers.forEach(function (f, pid) { if (f) h += '<i style="width:' + (f / st.pop * 100) + '%;background:' + pal(pid).secondary + '"></i>'; }); h += '</div>';
    h += '<div class="row tb-small"><span>God</span><span>followers · pressure</span></div>';
    st.followers.forEach(function (f, pid) { h += '<div class="row"><span><span class="pip" style="background:' + pal(pid).secondary + '"></span>' + esc(shortName(pid)) + (pid === app.human ? ' (you)' : '') + '</span><span>' + f + ' · ' + fmt(H.pressureAt(s, st, pid)) + '</span></div>'; });
    h += '<div class="row"><span>Unaffiliated</span><span>' + H.unaffiliated(st) + '</span></div>';
    if (st.shrine) { var sd = D.shrines.find(function (x) { return x.id === st.shrine.type; }); h += '<div class="row"><span>Shrine</span><span>' + esc(sd.name) + ' (' + esc(shortName(st.shrine.owner)) + ')</span></div><div class="row"><span>Ward</span><span>' + st.shrine.ward + (st.shrine.eclipsed ? ' · eclipsed ' + st.shrine.eclipsed : '') + '</span></div>'; }
    var bonus = domainBonusHere(t); if (bonus) h += '<div class="row"><span>Your domains here</span><span>' + bonus + '</span></div>';
    h += priestsHere(tile);
    if (myTurn()) {
      var acts = [];
      var items = barItems().filter(function (it) { return it.target === 'tile'; });
      items.forEach(function (it) { if (!E.validate(s, actionFor(it, tile))) acts.push('<button class="act" data-do="' + it.id + '"><span>' + esc(it.name) + '</span><span class="cost">' + costStr(it.cost) + '</span></button>'); });
      if (acts.length) h += '<div class="acts">' + acts.join('') + '</div>';
    }
    el.innerHTML = h; bindPanel();
  }
  function shortName(pid) { return FACTIONS[app.state.players[pid].faction].tradition.replace(/^(Ancient|Old) /, ''); }
  function tileName(id) { var st = H.settlementAt(app.state, id); return st ? st.name : (D.terrain.types[app.state.map.tiles[id].terrain].name || 'the wilds'); }
  function priestsHere(tile) {
    var list = app.state.priests.filter(function (p) { return p.tile === tile && (p.owner === app.human || me().revealed[tile]); }); if (!list.length) return '';
    return list.map(function (p) { var mine = p.owner === app.human; return '<div class="row"><span><span class="pip" style="background:' + pal(p.owner).secondary + '"></span>' + esc(shortName(p.owner)) + ' priest</span><span>' + (mine && myTurn() ? '<button class="ghost" style="min-height:28px;padding:2px 10px" data-priest="' + p.id + '">Send</button>' : (p.dest !== null && mine ? 'travelling' : '')) + '</span></div>'; }).join('');
  }
  function bindPanel() {
    var el = $('panel');
    el.querySelectorAll('[data-do]').forEach(function (b) { b.onclick = function () { var it = barItems().find(function (x) { return x.id === b.dataset.do; }); act(actionFor(it, app.selTile)); }; });
    el.querySelectorAll('[data-priest]').forEach(function (b) { b.onclick = function () { selectPriest(+b.dataset.priest); }; });
  }
  function domainRows() { return FACTIONS[me().faction].domains.map(function (id) { var d = DOMAINS[id]; return '<div class="row" title="' + esc(d.text) + '"><span>' + esc(d.name) + '</span><span class="tb-small" style="max-width:170px;text-align:right">' + esc(d.text) + '</span></div>'; }).join(''); }
  function domainBonusHere(t) {
    var m = me().mods, b = 0; m.terrainFaith.forEach(function (tf) { if (tf.terrains.indexOf(t.terrain) >= 0) b += tf.per; }); if (m.waterFaith && t.coast) b += m.waterFaith;
    var out = []; if (b) out.push('+' + fmt(b) + ' Faith per follower'); if (m.coastalPressure && t.coast) out.push('+' + Math.round(m.coastalPressure * 100) + '% pressure');
    return out.join(', ');
  }

  /* ------------------------------------------------------------ event card */
  function showEvent() {
    var p = me(); if (!p.pendingEvent) return;
    var ev = EVENTS[p.pendingEvent.id], m = $('event');
    $('ev-title').textContent = ev.title; $('ev-text').textContent = ev.text; $('ev-turn').textContent = app.state.turn;
    var art = A.eventArt(ev.art, app.state.seed + app.state.turn), c = $('ev-art'), g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 96, 54); g.drawImage(art, 0, 0, 96, 54);
    var em = A.emblem(FACTIONS[p.faction].emblem, FACTIONS[p.faction].palette), ec = $('ev-emblem'), eg = ec.getContext('2d'); eg.imageSmoothingEnabled = false; eg.clearRect(0, 0, 32, 32); eg.drawImage(em, 0, 0, 32, 32);
    var ch = $('ev-choices'); ch.innerHTML = '';
    ev.choices.forEach(function (c, i) { var b = document.createElement('button'); b.innerHTML = esc(c.label) + '<small>' + esc(describeEffects(c.effects)) + '</small>'; b.onclick = function () { m.hidden = true; act({ type: 'event', choice: i }); }; ch.appendChild(b); });
    m.hidden = false; setTimeout(function () { ch.firstElementChild && ch.firstElementChild.focus(); }, 30);
  }
  function describeEffects(efs) {
    return efs.map(function (e) {
      switch (e.type) {
        case 'faith': return (e.amount > 0 ? '+' : '') + e.amount + ' Faith';
        case 'favor': return (e.amount > 0 ? '+' : '') + e.amount + ' Favor';
        case 'popControlled': return '+' + e.amount + ' people in each settlement that kneels to you';
        case 'popLargest': return '+' + e.amount + ' people in your largest town';
        case 'followersLargest': return '+' + e.amount + ' followers in your largest town';
        case 'loseFollowersLargest': return '−' + e.amount + ' followers in your largest town';
        case 'freePriest': return 'a free priest';
        case 'shrineDiscount': return 'next shrine costs ' + Math.round(e.mult * 100) + '%';
        case 'wardAll': return '+' + e.amount + ' Ward on all shrines';
        case 'wardRandom': return '+' + e.amount + ' Ward on one shrine';
        case 'buff': return ({ faithMult: 'Faith ×', pressureMult: 'pressure ×', priestMult: 'priests ×', eclipseImmune: 'immune to eclipses', faithPerControlled: 'Faith per settlement +' }[e.stat] || e.stat) + (e.stat === 'eclipseImmune' ? '' : e.value) + ' for ' + e.turns + ' turns';
        default: return e.type;
      }
    }).join(' · ');
  }

  /* ------------------------------------------------------------ victory */
  function showVictory() {
    var s = app.state, w = s.winner; if (!w || !$('victory').hidden) return;
    var wp = s.players[w.pid], f = FACTIONS[wp.faction], youWon = w.pid === app.human;
    var em = A.emblem(f.emblem, f.palette), c = $('vic-emblem'), g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 96, 96); g.drawImage(em, 0, 0, 96, 96);
    var names = { ascendancy: 'Ascendancy', dominion: 'Dominion', twilight: 'Twilight Judgment' };
    $('vic-kicker').textContent = (youWon ? 'Victory' : 'Defeat') + ' · ' + names[w.type] + ' · Turn ' + w.turn;
    $('vic-title').textContent = youWon ? 'Your Name Endures' : wp.name + ' Prevails';
    var subs = { ascendancy: 'More than ' + Math.round(D.rules.victory.ascendancyShare * 100) + '% of all mortals follow one god.', dominion: 'Every rival god is forgotten.', twilight: 'The age ends. Devotion is weighed, and one name is remembered above the rest.' };
    $('vic-sub').textContent = subs[w.type];
    var tp = H.totalPop(s), rows = '<tr><th>God</th><th>Followers</th><th>Share</th><th>Shrines</th><th>Settlements</th><th>Score</th></tr>';
    s.players.map(function (p) { return p; }).sort(function (a, b) { return w.scores[b.id] - w.scores[a.id]; }).forEach(function (p) {
      rows += '<tr class="' + (p.id === w.pid ? 'win' : '') + '"><td><span class="pip" style="background:' + pal(p.id).secondary + '"></span>' + esc(p.name) + (p.id === app.human ? ' (you)' : '') + (p.eliminated ? ' — forgotten' : '') + '</td><td>' + H.followersOf(s, p.id) + '</td><td>' + Math.round(H.followersOf(s, p.id) / tp * 100) + '%</td><td>' + H.playerShrines(s, p.id).length + '</td><td>' + H.controlledCount(s, p.id) + '</td><td>' + w.scores[p.id] + '</td></tr>';
    });
    $('vic-table').innerHTML = rows;
    $('vic-meta').textContent = 'Seed ' + s.seed + ' · ' + s.actions.length + ' actions · final state hash ' + E.hash(s) + ' (replaying the same seed and actions reproduces this exactly)';
    $('victory').hidden = false; $('vic-new').focus();
  }

  /* ------------------------------------------------------------ title screen */
  var choice = { faction: params.get('faction') || 'greek', rivals: +(params.get('rivals') || 1), diff: params.get('diff') || 'hard' };
  function buildTitle() {
    var wrap = $('faction-cards'); wrap.innerHTML = '';
    D.factions.forEach(function (f) {
      var b = document.createElement('button'); b.className = 'fcard' + (f.id === choice.faction ? ' on' : ''); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', f.id === choice.faction ? 'true' : 'false'); b.dataset.faction = f.id;
      var head = document.createElement('div'); head.className = 'fh'; var em = A.emblem(f.emblem, f.palette, 64); head.appendChild(em);
      var tt = document.createElement('div'); tt.innerHTML = '<div class="trad">' + esc(f.tradition) + '</div><h3>' + esc(f.name) + '</h3>'; head.appendChild(tt); b.appendChild(head);
      var p = document.createElement('p'); p.textContent = f.blurb; b.appendChild(p);
      var ul = document.createElement('ul'); f.domains.forEach(function (d) { var li = document.createElement('li'); li.textContent = DOMAINS[d].name; ul.appendChild(li); }); b.appendChild(ul);
      b.style.borderTopColor = f.palette.secondary; b.style.borderTopWidth = '3px';
      b.onclick = function () { choice.faction = f.id; buildTitle(); };
      wrap.appendChild(b);
    });
    document.querySelectorAll('[data-rivals]').forEach(function (b) { var on = +b.dataset.rivals === choice.rivals; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); b.onclick = function () { choice.rivals = +b.dataset.rivals; buildTitle(); }; });
    document.querySelectorAll('[data-diff]').forEach(function (b) { var on = b.dataset.diff === choice.diff; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); b.onclick = function () { choice.diff = b.dataset.diff; buildTitle(); }; });
  }
  $('seed-rand').onclick = function () { $('seed').value = String(1 + Math.floor(Math.random() * 99999)); demoWorld(); };
  $('seed').onchange = demoWorld;
  function demoWorld() {
    // the title screen shows the actual world you are about to enter, fully revealed, slowly drifting
    var seed = parseInt($('seed').value, 10) || 1;
    var st = E.newGame({ seed: seed, players: [{ faction: 'greek' }, { faction: 'norse' }, { faction: 'egyptian' }] });
    st.players[0].revealed = st.players[0].revealed.map(function () { return 1; });
    app.demo = st; R.setMap(st); R.setState(st, 0); R.cam.tz = 1.6; R.cam.z = 1.6;
    R.cam.tx = R.cam.x = R.WW * 0.42; R.cam.ty = R.cam.y = R.WH * 0.55; R.clampCam();
  }
  function startGame(cfg) {
    clearTimeout(app.aiTimer);
    var others = D.factions.map(function (f) { return f.id; }).filter(function (id) { return id !== cfg.faction; });
    var players = [{ faction: cfg.faction, human: true }];
    for (var i = 0; i < cfg.rivals; i++) players.push({ faction: others[i], ai: cfg.diff });
    app.cfg = cfg; app.human = 0; app.busy = false; app.logSeen = 0; app.selTile = null; app.selPriest = null; app.mode = null; app.demo = null;
    app.state = E.newGame({ seed: cfg.seed, players: players });
    $('log').innerHTML = ''; $('victory').hidden = true; $('title').hidden = true; $('hud').hidden = false; app.title = false;
    var em = A.emblem(FACTIONS[cfg.faction].emblem, FACTIONS[cfg.faction].palette), tc = $('tb-emblem').getContext('2d'); tc.imageSmoothingEnabled = false; tc.clearRect(0, 0, 34, 34); tc.drawImage(em, 0, 0, 34, 34);
    $('powerbar').innerHTML = '';
    R.setMap(app.state); R.fog = null; R.fogKey = null; R.oldFog = null;
    afterChange(null);
    var home = app.state.settlements[me().home]; R.cam.tz = R.cam.z = innerWidth < 760 ? 1.45 : 2.1; R.focusTile(home.tile, true); select(home.tile);
    banner('Turn 1');
  }
  $('begin').onclick = function () { startGame({ faction: choice.faction, rivals: choice.rivals, diff: choice.diff, seed: parseInt($('seed').value, 10) || 1 }); };

  /* ------------------------------------------------------------ menus */
  function openModal(id) { $(id).hidden = false; var b = $(id).querySelector('button'); if (b) b.focus(); }
  document.querySelectorAll('[data-close]').forEach(function (b) { b.onclick = function () { b.closest('.modal').hidden = true; }; });
  $('btn-help').onclick = function () { openModal('help'); };
  $('btn-menu').onclick = function () { openModal('menu'); };
  $('btn-log').onclick = function () { var lp = $('logpanel'); lp.hidden = !lp.hidden; if (!lp.hidden) { var ol = $('log'); ol.scrollTop = ol.scrollHeight; } };
  $('menu-new').onclick = function () { $('menu').hidden = true; toTitle(); };
  $('vic-new').onclick = toTitle;
  $('vic-replay').onclick = function () { startGame(app.cfg); };
  $('target-cancel').onclick = function () { cancelMode(); deselectPriest(); };
  $('endturn').onclick = endTurn;
  document.querySelectorAll('#quality-seg [data-q]').forEach(function (b) { b.onclick = function () { document.querySelectorAll('#quality-seg [data-q]').forEach(function (o) { o.classList.toggle('on', o === b); }); if (b.dataset.q === 'auto') { R.autoQuality = true; R.setQuality('high'); } else { R.autoQuality = false; R.setQuality(b.dataset.q); } }; });
  function toTitle() { clearTimeout(app.aiTimer); $('victory').hidden = true; $('hud').hidden = true; $('title').hidden = false; app.title = true; app.state = null; buildTitle(); demoWorld(); }

  /* ------------------------------------------------------------ input: pointer (mouse + touch + pen) */
  var pointers = {}, drag = null, pinch = null;
  function cpos(e) { var r = canvas.getBoundingClientRect(), d = R.dpr || 1; return { x: (e.clientX - r.left) * d, y: (e.clientY - r.top) * d }; }
  canvas.addEventListener('pointerdown', function (e) {
    canvas.setPointerCapture(e.pointerId); pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pointers);
    if (ids.length === 1) drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, button: e.button };
    if (ids.length === 2) { var a = pointers[ids[0]], b = pointers[ids[1]]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; drag = null; }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (pointers[e.pointerId]) pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pointers);
    if (pinch && ids.length === 2) {
      var a = pointers[ids[0]], b = pointers[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.d > 0) { var r = canvas.getBoundingClientRect(), dp = R.dpr || 1; R.zoomAt(d / pinch.d, ((a.x + b.x) / 2 - r.left) * dp, ((a.y + b.y) / 2 - r.top) * dp); R.cam.z = R.cam.tz; R.cam.x = R.cam.tx; R.cam.y = R.cam.ty; }
      pinch.d = d; return;
    }
    if (drag) {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) { drag.moved = true; canvas.classList.add('dragging'); }
      if (drag.moved) { var dp2 = R.dpr || 1; R.panBy(dx * dp2, dy * dp2); }
      drag.x = e.clientX; drag.y = e.clientY;
    }
    if (e.pointerType === 'mouse' && !drag) { var p = cpos(e), t = R.pick(p.x, p.y); R.hover = t; updatePath(t); }
  });
  function endPointer(e) {
    var wasDrag = drag; delete pointers[e.pointerId];
    if (Object.keys(pointers).length < 2) pinch = null;
    if (wasDrag && !wasDrag.moved && e.type === 'pointerup') {
      if (app.title) return;
      var p = cpos(e), t = R.pick(p.x, p.y);
      if (wasDrag.button === 2) { cancelMode(); deselectPriest(); } else onTileClick(t);
    }
    drag = null; canvas.classList.remove('dragging');
  }
  canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('wheel', function (e) { e.preventDefault(); var p = cpos(e); R.zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y); }, { passive: false });
  function updatePath(t) {
    if (app.selPriest === null || t < 0 || !app.state) { R.path = null; return; }
    var pr = app.state.priests.find(function (p) { return p.id === app.selPriest; }); if (!pr) return;
    R.path = H.pathStep(app.state, app.human, pr.tile, t) || null;
  }
  $('minimap').addEventListener('pointerdown', function (e) {
    if (!app.state) return; var c = $('minimap'), r = c.getBoundingClientRect();
    var w = R.minimapToWorld(c, (e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height);
    R.cam.tx = w.x; R.cam.ty = w.y + 30; R.clampCam();
  });

  /* ------------------------------------------------------------ input: keyboard */
  window.addEventListener('keydown', function (e) {
    if (e.target && (e.target.tagName === 'INPUT')) return;
    var modalOpen = !$('event').hidden || !$('help').hidden || !$('menu').hidden;
    if (e.key === 'Escape') { if (!$('help').hidden) $('help').hidden = true; else if (!$('menu').hidden) $('menu').hidden = true; else if (app.mode || app.selPriest !== null) { cancelMode(); deselectPriest(); } else if (app.state) { R.selected = -1; app.selTile = null; renderPanel(); } return; }
    if (modalOpen || app.title || !app.state) return;
    var k = e.key.toLowerCase(), step = 60 * (R.dpr || 1);
    if (/^[1-9]$/.test(e.key)) { var it = barItems()[+e.key - 1]; if (it) arm(it); e.preventDefault(); return; }
    if (e.key === 'Enter' && e.target === document.body) { endTurn(); e.preventDefault(); return; }
    if (k === 'arrowleft' || k === 'a') R.panBy(step, 0); else if (k === 'arrowright' || k === 'd') R.panBy(-step, 0);
    else if (k === 'arrowup' || k === 'w') R.panBy(0, step); else if (k === 'arrowdown' || k === 's') R.panBy(0, -step);
    else if (k === '+' || k === '=') R.zoomAt(1.15, canvas.width / 2, canvas.height / 2); else if (k === '-' || k === '_') R.zoomAt(1 / 1.15, canvas.width / 2, canvas.height / 2);
    else if (k === 'l') $('btn-log').click(); else if (k === 'h' || k === '?') openModal('help');
    else if (k === 'home') { R.focusTile(app.state.settlements[me().home].tile); }
    else return;
    e.preventDefault();
  });

  /* ------------------------------------------------------------ main loop */
  var last = performance.now(), demoT = 0;
  function frame(now) {
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (app.title && app.demo && !reduced) { demoT += dt; R.cam.tx += dt * 6; if (R.cam.tx > R.WW * 0.62) R.cam.tx = R.WW * 0.38; R.cam.ty = R.WH * 0.55 + Math.sin(demoT * 0.2) * 20; R.clampCam(); }
    R.render(dt);
    if (app.state && !app.title && (now | 0) % 6 === 0) R.drawMinimap($('minimap'));
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------ test / automation hook (no game logic here) */
  window.PW = {
    E: E, AI: AI, app: app, get state() { return app.state; }, hash: function () { return app.state ? E.hash(app.state) : null; },
    start: startGame, endTurn: endTurn, barItems: function () { return barItems().map(function (b, i) { return { key: i + 1, id: b.id, target: b.target }; }); },
    // CSS-pixel screen position of a tile's top face, for scripted clicks
    tileScreen: function (id) { var tp = R.top(app.state.map.tiles[id]), p = R.project(tp.x, tp.y), d = R.dpr || 1, r = canvas.getBoundingClientRect(); return { x: r.left + p.x / d, y: r.top + p.y / d }; },
    focus: function (id) { R.focusTile(id, true); R.cam.z = R.cam.tz; }, settle: function () { R.cam.x = R.cam.tx; R.cam.y = R.cam.ty; R.cam.z = R.cam.tz; },
    suggest: function () { return app.state && app.state.current === app.human ? AI.nextAction(E, app.state) : null; },
    busy: function () { return app.busy; }, renderer: R
  };

  buildTitle();
  if (params.get('seed')) $('seed').value = params.get('seed');
  if (params.get('autostart') === '1') startGame({ faction: choice.faction, rivals: choice.rivals, diff: choice.diff, seed: parseInt($('seed').value, 10) || 1 });
  else demoWorld();
  requestAnimationFrame(frame);
})();
