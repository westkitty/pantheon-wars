/*
 * Pantheon Wars — UI controller. Owns no rules: every change goes through PWEngine.step (validated, pure), so the display can never
 * desynchronise from the deterministic engine. AI gods are driven by PWAI.nextAction. The renderer, audio and chronicle only read state.
 * URL options (tests and sharing): ?seed=N&faction=<id>&rivals=1|2|<id>,<id>&diff=easy|hard&mode=standard|sacredSites|covenants|scenario:<id>
 *   &hotseat=1..3&autostart=1&quality=high|low|auto&motion=reduced|full&speed=0..1&tutorial=1&nosave=1&follow=0
 */
(function () {
  'use strict';
  var D = window.PW_DATA, E = PWEngine.create(D), H = E.helpers, AI = window.PWAI, A = window.PWArt, S = window.PWStorage, C = window.PWChronicle;
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var SPEED = params.has('speed') ? Math.max(0, +params.get('speed')) : 1;
  var FACTIONS = {}; D.factions.forEach(function (f) { FACTIONS[f.id] = f; });
  var POWERS = {}; D.powers.forEach(function (p) { POWERS[p.id] = p; });
  var EVENTS = {}; D.events.forEach(function (e) { EVENTS[e.id] = e; });
  var DOMAINS = {}; D.domains.forEach(function (d) { DOMAINS[d.id] = d; });
  var SCEN = {}; (D.scenarios || []).forEach(function (s) { SCEN[s.id] = s; });
  var RA = D.rules.actions, RU = D.rules;

  /* ------------------------------------------------------------ settings (per-viewer conveniences in localStorage; all reads guarded) */
  var DEFAULT_KEYS = { power1: '1', power2: '2', power3: '3', power4: '4', power5: '5', power6: '6', power7: '7', power8: '8', power9: '9', endTurn: 'Enter', cancel: 'Escape', log: 'l', help: 'h', menu: 'm', codex: 'e', envoy: 'v', layers: 'i', home: 'Home', panUp: 'w', panDown: 's', panLeft: 'a', panRight: 'd', zoomIn: '+', zoomOut: '-' };
  var KEY_LABELS = { power1: 'Power 1 (Read Omens)', power2: 'Power 2 (Dream)', power3: 'Power 3 (Shrine)', power4: 'Power 4 (Priest)', power5: 'Power 5 (Eclipse)', power6: 'Faction power 1', power7: 'Faction power 2', power8: 'Faction power 3', power9: 'Faction power 4', endTurn: 'End turn', cancel: 'Cancel', log: 'Turn log', help: 'Help', menu: 'Menu', codex: 'Encyclopedia', envoy: 'Envoys', layers: 'Map layers', home: 'Jump home', panUp: 'Pan up', panDown: 'Pan down', panLeft: 'Pan left', panRight: 'Pan right', zoomIn: 'Zoom in', zoomOut: 'Zoom out' };
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  var settings = Object.assign({ quality: 'auto', motion: 'system', flash: 'on', patterns: true, contrast: false, sr: true, previews: true, tutorialDone: false,
    audio: { master: 0.8, music: 0.5, sfx: 0.8, ambience: 0.4, mute: false }, keys: {} }, lsGet('pw.settings', {}));
  settings.keys = Object.assign({}, DEFAULT_KEYS, settings.keys || {});
  if (params.get('motion')) settings.motion = params.get('motion');
  function saveSettings() { lsSet('pw.settings', settings); }

  var app = { state: null, humans: [0], viewer: 0, cfg: null, mode: null, selTile: null, selPriest: null, busy: false, title: true, aiTimer: null, demo: null, turnHashes: {}, replay: null, tutorial: null, handoff: false, lastSummaryTurn: 0 };
  var canvas = $('world'), R = new PWRenderer(canvas, D); R.setEngine(E); app.renderer = R;
  var audio = new PWAudio(settings.audio); app.audio = audio;
  var store = null; try { store = new S.Store(window.localStorage, (sessionStorage.getItem('pw.session') || (function () { var s = 's' + Date.now().toString(36); sessionStorage.setItem('pw.session', s); return s; })())); } catch (e) { store = null; }
  function applyVisualSettings() {
    R.reduced = settings.motion === 'reduced' || (settings.motion === 'system' && R.sysReduced);
    document.documentElement.classList.toggle('reduce-motion', R.reduced);
    R.reducedFlash = settings.flash === 'off'; R.patterns = settings.patterns; R.contrast = settings.contrast;
    if (params.get('quality')) settings.quality = params.get('quality');
    R.autoQuality = settings.quality === 'auto'; if (!R.autoQuality) R.quality = settings.quality;
    if (app.state) { R.overlayKey = null; R.setState(app.state, app.viewer); }
  }
  applyVisualSettings();

  /* ------------------------------------------------------------ helpers */
  function pal(pid) { return FACTIONS[app.state.players[pid].faction].palette; }
  function me() { return app.state.players[app.viewer]; }
  function isHuman(pid) { return app.humans.indexOf(pid) >= 0; }
  function myTurn() { var s = app.state; return s && !s.over && s.current === app.viewer && isHuman(s.current) && !app.busy && !app.handoff && !app.replay; }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var toastLast = {};
  function toast(msg, err) { var now = Date.now(); if (toastLast[msg] && now - toastLast[msg] < 1500) return; toastLast[msg] = now; var box = $('toasts'); while (box.children.length > 4) box.removeChild(box.firstChild); var d = document.createElement('div'); d.className = 'toast' + (err ? ' err' : ''); d.textContent = msg; box.appendChild(d); setTimeout(function () { d.remove(); }, 3100); }
  function fmt(n) { return (Math.round(n * 10) / 10).toString(); }
  function costStr(c) { var a = []; if (c.faith) a.push(c.faith + ' Faith'); if (c.favor) a.push(c.favor + ' Favor'); return a.join(' + ') || 'free'; }
  function cap(err) { return err.charAt(0).toUpperCase() + err.slice(1) + '.'; }
  function shortName(pid) { return FACTIONS[app.state.players[pid].faction].shortName; }
  function godName(pid) { return pid < 0 ? 'the heavens' : pid === app.viewer ? 'you' : app.state.players[pid].name; }
  function tileName(id) { var st = H.settlementAt(app.state, id); return st ? st.name : (D.terrain.types[app.state.map.tiles[id].terrain].name || 'the wilds'); }
  function say(text) { if (!settings.sr) return; var el = $('sr-live'); el.textContent = ''; setTimeout(function () { el.textContent = text; }, 30); }
  function canvasCopy(src, w, h, label) { var c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); c.style.width = w + 'px'; c.style.height = h + 'px'; c.className = 'pix'; if (label) { c.setAttribute('role', 'img'); c.setAttribute('aria-label', label); } return c; }
  /* A copy of the state that removes what the viewer cannot see (hidden rival shrines and priests): used for pressure tooltips and the influence layer. */
  function redacted(s, viewer) {
    var rev = s.players[viewer].revealed, m = s.map; s.map = null; var c = E.clone(s); s.map = m; c.map = m;
    c.settlements.forEach(function (x) { if (x.shrine && x.shrine.owner !== viewer && !rev[x.tile]) x.shrine = null; });
    c.priests = c.priests.filter(function (pr) { return pr.owner === viewer || rev[pr.tile]; });
    return c;
  }

  /* ------------------------------------------------------------ action catalogue (power bar: five common rites + four faction powers = keys 1..9) */
  function barItems() {
    var p = me(), s = app.state, f = FACTIONS[p.faction];
    var core = [
      { id: 'omen', name: 'Read Omens', icon: 'omen', x: 'explore', target: 'omen', cost: { faith: H.omenCost(s, p.id) }, cd: 0, text: 'Lift the fog in radius ' + H.omenRadius(s, p.id) + ' around a hex within ' + RA.omen.range + ' of the known world. Once per turn.' },
      { id: 'dream', name: 'Dream Vision', icon: 'dream', x: 'explore', target: 'none', cost: { favor: RA.dream.favor }, cd: p.cooldowns.dream || 0, maxcd: H.dreamCooldown(s, p.id), text: 'Send a dream that reveals the nearest hidden town.' },
      { id: 'shrine', name: 'Raise Shrine', icon: 'shrine', x: 'expand', target: 'tile', cost: { faith: H.shrineCost(s, p.id) }, cd: 0, text: 'Build a ' + H.shrineDef(s, p.id).name + ' where you have followers, a priest or territory. Each shrine raises the next one\'s cost; ruins are cheaper.' },
      { id: 'priest', name: 'Ordain Priest', icon: 'priest', x: 'expand', target: 'tile', cost: { faith: H.priestCost(s, p.id) }, cd: 0, text: 'A priest at one of your shrines (Emissary by default; choose a calling in the town panel). Limit: ' + H.priestCap(s, p.id) + '.' },
      { id: 'eclipse', name: 'Eclipse', icon: 'eclipse', x: 'exterminate', target: 'tile', cost: { favor: H.eclipseCost(s, p.id) }, cd: p.cooldowns.eclipse || 0, maxcd: RA.eclipse.cooldown, text: 'Darken a rival shrine within ' + H.eclipseRange(s, p.id) + ' of your shrines or priests: −1 Ward and silent for ' + RA.eclipse.duration + ' turns. At 0 Ward it falls. Its god may answer with a counter-rite.' }
    ];
    var fp = f.powers.map(function (id) { var pw = POWERS[id]; return { id: id, power: true, name: pw.name, icon: pw.icon, x: pw.x, target: pw.target === 'none' ? 'none' : 'tile', cost: pw.cost, cd: p.cooldowns[id] || 0, maxcd: pw.cooldown, text: pw.text, inspired: pw.inspiredBy, flavor: pw.flavor }; });
    return core.concat(fp);
  }
  function actionFor(item, tile, extra) {
    var a = item.power ? { type: 'power', power: item.id } : { type: item.id };
    if (tile !== undefined) a.tile = tile;
    if (extra) Object.keys(extra).forEach(function (k) { a[k] = extra[k]; });
    return a;
  }
  function validTargets(item) {
    var s = app.state, out = [];
    for (var i = 0; i < s.map.tiles.length; i++) {
      if (item.target === 'omen' && me().revealed[i]) continue;
      if (!E.validate(s, actionFor(item, i))) out.push(i);
    }
    return out;
  }
  function itemError(item) {
    var s = app.state;
    if (item.target === 'none') return E.validate(s, actionFor(item));
    if (item.cd > 0) return item.name + ' is recovering (' + item.cd + ')';
    var probe = E.validate(s, actionFor(item, s.settlements[me().home].tile));
    if (probe && /Faith|Favor|afford|already read|limit/.test(probe)) return probe;
    return validTargets(item).length ? null : 'no valid target right now';
  }

  /* ------------------------------------------------------------ doing things */
  function act(action, quiet) {
    if (app.replay) return false;
    var err = E.validate(app.state, action);
    if (err) { if (!quiet) toast(cap(err), true); return false; }
    var prev = app.state; app.state = E.step(prev, action);
    afterChange(prev);
    return true;
  }
  function afterChange(prev) {
    var s = app.state;
    if (!app.turnHashes[s.turn]) app.turnHashes[s.turn] = E.hash(s);
    if (!app.handoff) R.setState(s, app.viewer);
    var newLog = s.log.slice(prev ? prev.log.length : 0), sig = false;
    newLog.forEach(function (e) { if (!app.handoff) sig = fxFor(e, sig) || sig; cueFor(e); appendLog(e); });
    if (prev && !app.handoff) diffTexts(prev, s);
    updateHud();
    if (prev && s.turn !== prev.turn && !s.over) roundSummary(prev, s);
    if (s.over) { setTimeout(showVictory, R.reduced ? 50 : 1400 * SPEED); return; }
    checkHandoff();
    if (s.current === app.viewer && !app.handoff && me().pendingEvent) showEvent();
    tutorialTick();
  }
  function visible(tile) { return tile === null || tile === undefined || me().revealed[tile]; }
  /* map log entries to the renderer's three-beat signatures; the 'power' entry plays the bespoke signature and suppresses generic ones after it */
  function fxFor(e, sigPlayed) {
    var x = e.x || {}, col = e.p >= 0 ? pal(e.p).glow : '#ffe08a', mine = e.p === app.viewer;
    if (x.tile !== undefined && x.tile !== null && !visible(x.tile) && !mine) return false;
    switch (e.k) {
      case 'power':
        var pw = POWERS[x.power], tile = x.tile !== null && x.tile !== undefined ? x.tile : app.state.settlements[app.state.players[e.p].home].tile;
        if (!mine && !visible(tile)) return false;
        var tiles = app.state.settlements.filter(function (st) { return st.controlledBy === e.p && visible(st.tile); }).map(function (st) { return st.tile; });
        R.playVfx(pw.vfx, tile, { label: pw.name, tiles: tiles, rows: (pw.effects.find(function (f) { return f.type === 'revealBand'; }) || {}).rows, hw: (pw.effects.find(function (f) { return f.type === 'revealBand'; }) || {}).halfWidth });
        return true;
      case 'reveal':
        if (!mine || sigPlayed) break;
        if (x.tiles) x.tiles.forEach(function (id) { R.addFx('reveal', id, { color: col, radius: 1 }); });
        else if (x.tile !== null && x.tile !== undefined) R.playVfx('omen', x.tile, {});
        break;
      case 'shrine': R.addFx('shrine', x.tile, { color: col }); break;
      case 'priest': if (x.tile !== undefined) R.addFx('priest', x.tile, { color: col }); break;
      case 'control': R.addFx('control', x.tile, { color: col }); R.addText(x.tile, mine ? 'Kneels to you' : 'Kneels to ' + shortName(e.p), mine ? '#fff0b0' : col); break;
      case 'miracle': if (!sigPlayed) R.addFx(x.fx === 'feather' ? 'feather' : 'bolt', x.tile, { color: col }); break;
      case 'eclipse': if (!sigPlayed) R.playVfx('eclipse', x.tile, {}); break;
      case 'topple': R.addFx('topple', x.tile); break;
      case 'counter': R.playVfx('counter', x.tile, { label: 'Counter-rite' }); break;
      case 'threat': R.playVfx('storm', x.tile, {}); break;
      case 'growth': if (!sigPlayed && x.tile !== undefined) R.addFx('growth', x.tile); break;
      case 'covenant': case 'covenantKept': case 'covenantBroken': R.addText(x.tile, e.k === 'covenantBroken' ? 'Promise broken' : e.k === 'covenantKept' ? 'Promise kept' : 'Covenant sworn', e.k === 'covenantBroken' ? '#ff9a8a' : '#fff0b0'); R.addFx('ring', x.tile, { color: e.k === 'covenantBroken' ? '#ff6a5a' : '#ffe08a' }); break;
      case 'route': if (x.tiles) x.tiles.forEach(function (t, i) { R.addFx('ring', t, { color: col, r0: 2, r1: 14, delay: i * 0.08 }); }); break;
      case 'specialize': R.addFx('shrine', x.tile, { color: col }); break;
      case 'landmark': R.addFx('ring', x.tile, { color: col, r1: 40 }); break;
      case 'victory': R.addFx('victory'); break;
    }
    return false;
  }
  function cueFor(e) {
    var x = e.x || {}, mine = e.p === app.viewer;
    if (x.tile !== undefined && x.tile !== null && !visible(x.tile) && !mine) return;
    var map = { shrine: 'shrine', priest: 'priest', eclipse: 'eclipse', topple: 'topple', counter: 'shrine', threat: 'threat', covenant: 'covenant', covenantKept: 'covenant', covenantBroken: 'defeat', age: 'age' };
    if (e.k === 'power') { audio.cue(POWERS[x.power].x, { faction: app.state.players[e.p].faction }); return; }
    if (e.k === 'weather' && !x.ended && visible(x.tile)) { audio.cue(x.kind); return; }
    if (e.k === 'age') audio.setAge(x.age);
    if (map[e.k]) audio.cue(map[e.k]);
  }
  function diffTexts(a, b) {
    if (a.turn === b.turn && a.current === b.current) return;
    b.settlements.forEach(function (s, i) {
      if (!me().revealed[s.tile]) return;
      var d = s.followers[app.viewer] - a.settlements[i].followers[app.viewer];
      if (d > 0) R.addText(s.tile, '+' + d, '#c8ff9a'); else if (d < 0) R.addText(s.tile, String(d), '#ff9a8a');
    });
  }
  /* what this viewer may read in the chronicle: rivals' private visions, cards and envoys to others stay private */
  function logVisible(e) {
    var x = e.x || {};
    if (e.k === 'forecast') return false;
    if (e.p >= 0 && e.p !== app.viewer && x.tile !== undefined && x.tile !== null && !me().revealed[x.tile] && e.k !== 'eliminated' && e.k !== 'victory') return false;
    if (e.p >= 0 && e.p !== app.viewer && (e.k === 'reveal' || e.k === 'card' || e.k === 'event' || e.k === 'priest' || e.k === 'unrest')) return false;
    if (e.k === 'envoy' && e.p !== app.viewer && x.to !== app.viewer) return false;
    if (e.k === 'weather' && x.tile !== undefined && !me().revealed[x.tile]) return false;
    return true;
  }
  function appendLog(e) {
    if (app.handoff || !logVisible(e)) return;
    var x = e.x || {}, li = document.createElement('li');
    li.style.borderLeftColor = e.p >= 0 ? pal(e.p).secondary : '#d8b25a';
    li.innerHTML = '<span class="t">T' + e.t + '</span>' + esc(e.m);
    if (x.tile !== undefined && x.tile !== null) { li.tabIndex = 0; li.style.cursor = 'pointer'; li.onclick = li.onkeydown = function (ev) { if (ev.type === 'keydown' && ev.key !== 'Enter') return; R.focusTile(x.tile); select(x.tile); }; }
    var ol = $('log'); ol.appendChild(li); while (ol.children.length > 200) ol.removeChild(ol.firstChild); ol.scrollTop = ol.scrollHeight;
  }
  function rebuildLog() { $('log').innerHTML = ''; var keep = app.handoff; app.handoff = false; app.state.log.forEach(appendLog); app.handoff = keep; }
  /* screen-reader round summary (P022): one compact sentence block per turn for the viewer */
  function roundSummary(prev, s) {
    if (app.lastSummaryTurn === s.turn) return; app.lastSummaryTurn = s.turn;
    var v = app.viewer, p = s.players[v], p0 = prev.players[v], parts = [];
    var age = E.ageOf(s.turn); parts.push('Turn ' + s.turn + ', ' + age.name + '.');
    parts.push('Faith ' + fmt(p.faith) + ' (' + (p.faith >= p0.faith ? '+' : '') + fmt(p.faith - p0.faith) + '), Favor ' + p.favor + ', followers ' + H.followersOf(s, v) + ' of ' + H.totalPop(s) + '.');
    var won = [], lost = [];
    s.settlements.forEach(function (x, i) { var o = prev.settlements[i]; if (x.controlledBy === v && o.controlledBy !== v) won.push(x.name); if (o.controlledBy === v && x.controlledBy !== v) lost.push(x.name); });
    if (won.length) parts.push('Won: ' + won.join(', ') + '.'); if (lost.length) parts.push('Lost: ' + lost.join(', ') + '.');
    var threats = H.playerShrines(s, v).filter(function (x) { return x.shrine.threat; }).map(function (x) { return x.name; }); if (threats.length) parts.push('Threatened shrines: ' + threats.join(', ') + '.');
    var wx = H.knownFronts(s, v).filter(function (f) { return f.phase !== 'after'; }).map(function (f) { return RU.climate.kinds[f.kind].name + (f.phase === 'forecast' ? ' coming' : '') + ' near ' + tileName(f.tile); }); if (wx.length) parts.push('Weather: ' + wx.join('; ') + '.');
    var due = H.activeCovenants(s, v).filter(function (c) { return c.t1 - s.turn <= 1; }).map(function (c) { return RU.covenants.kinds[c.kind].name + ' to ' + s.settlements[c.s].name; }); if (due.length) parts.push('Due now: ' + due.join(', ') + '.');
    if (age.from === s.turn && s.turn > 1) { banner(age.name); }
    say(parts.join(' '));
  }

  /* ------------------------------------------------------------ turn flow, AI pacing and hot-seat handoff */
  function endTurn() {
    if (!myTurn()) return;
    if (me().pendingEvent) { showEvent(); return; }
    cancelMode(); deselectPriest();
    act({ type: 'endTurn' });
    autosave();
    if (!app.state.over) runAI();
  }
  function runAI() {
    var s = app.state; if (s.over || isHuman(s.current)) { app.busy = false; updateHud(); return; }
    app.busy = true; updateHud();
    function tick() {
      var s = app.state;
      if (s.over || app.replay) { app.busy = false; updateHud(); return; }
      if (isHuman(s.current)) { app.busy = false; updateHud(); checkHandoff(); return; }
      var a = AI.nextAction(E, s), prev = s;
      if (E.validate(s, a)) a = { type: 'endTurn' };
      app.state = E.step(s, a);
      if (a.type === 'endTurn' && app.state.turn !== prev.turn) { banner('Turn ' + app.state.turn); audio.cue('turn'); }
      afterChange(prev);
      var vis = a.tile !== undefined && a.tile !== null && me().revealed[a.tile];
      var delay = a.type === 'endTurn' ? 250 : (vis && (a.type === 'power' || a.type === 'eclipse' || a.type === 'shrine') ? 900 : 90);
      if (vis && delay > 500 && params.get('follow') !== '0') R.focusTile(a.tile);
      app.aiTimer = setTimeout(tick, delay * SPEED);
    }
    clearTimeout(app.aiTimer); app.aiTimer = setTimeout(tick, 200 * SPEED);
  }
  function checkHandoff() {
    var s = app.state; if (!s || s.over || !isHuman(s.current) || s.current === app.viewer) return;
    if (app.humans.length < 2) { app.viewer = s.current; return; }
    // the next god is another human at this screen: hide everything until they take the seat (P024)
    app.handoff = true; R.blackout = true; cancelMode(); deselectPriest(); app.selTile = null;
    ['event', 'envoys', 'saves', 'menu', 'logpanel'].forEach(function (id) { $(id).hidden = true; });
    $('panel').innerHTML = ''; $('log').innerHTML = '';
    var p = s.players[s.current], f = FACTIONS[p.faction];
    var c = $('handoff-emblem').getContext('2d'); c.imageSmoothingEnabled = false; c.clearRect(0, 0, 96, 96); c.drawImage(A.emblem(f.emblem, f.palette, 96), 0, 0);
    $('handoff-title').textContent = 'Pass the screen to ' + p.name;
    $('handoff-text').textContent = 'Turn ' + s.turn + '. The previous god\'s world is hidden. When ' + p.name + ' is ready, they may look.';
    $('handoff').hidden = false; $('handoff-go').focus();
  }
  $('handoff-go').onclick = function () {
    app.viewer = app.state.current; app.handoff = false; R.blackout = false; R.prevRevealed = null; R.fogKey = null; R.overlayKey = null; R.marksKey = null;
    $('handoff').hidden = true; R.setState(app.state, app.viewer); rebuildLog(); paintEmblem(); updateHud();
    var home = app.state.settlements[me().home]; R.focusTile(home.tile, true); select(home.tile);
    if (me().pendingEvent) showEvent();
  };
  function banner(text) { var b = $('turnbanner'); b.textContent = text; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }

  /* ------------------------------------------------------------ selection, targeting and previews */
  function select(tile) { R.selected = tile; app.selTile = tile; renderPanel(); }
  function onTileClick(tile) {
    if (app.replay || app.handoff) return;
    if (tile < 0) { cancelMode(); return; }
    if (app.mode) {
      var a = actionFor(app.mode.item, tile, app.mode.extra), err = E.validate(app.state, a); if (err) { toast(cap(err), true); return; }
      cancelMode(); act(a); select(tile); return;
    }
    if (app.selPriest !== null && myTurn()) {
      var pr = app.state.priests.find(function (p) { return p.id === app.selPriest; });
      if (pr && tile !== pr.tile) { if (act({ type: 'movePriest', priest: pr.id, tile: tile })) { toast('The priest sets out.'); deselectPriest(); select(tile); } return; }
      deselectPriest(); select(tile); return;
    }
    var mine = app.state.priests.filter(function (p) { return p.owner === app.viewer && p.tile === tile; });
    if (mine.length && myTurn() && app.selTile === tile) { var idx = mine.findIndex(function (p) { return p.id === app.selPriest; }); selectPriest(mine[(idx + 1) % mine.length].id); return; }
    select(tile);
  }
  function selectPriest(id) { app.selPriest = id; R.selPriest = id; R.path = null; renderPanel(); $('target-text').textContent = 'Choose where your priest should walk.'; $('target-preview').textContent = ''; $('targetbar').hidden = false; }
  function deselectPriest() { app.selPriest = null; R.selPriest = null; R.path = null; if (!app.mode) $('targetbar').hidden = true; renderPanel(); }
  function arm(item, extra) {
    if (!myTurn()) return;
    if (me().pendingEvent) { showEvent(); return; }
    var err = itemError(item); if (err) { toast(cap(err), true); return; }
    if (item.target === 'none') { act(actionFor(item, undefined, extra)); return; }
    deselectPriest();
    var targets = validTargets(item);
    app.mode = { item: item, targets: targets, extra: extra }; R.targets = targets; canvas.classList.add('targeting');
    $('target-text').textContent = item.name + ': choose a highlighted hex (' + targets.length + ').'; $('target-preview').textContent = ''; $('targetbar').hidden = false;
    updatePowerbar(); tutorialTick();
  }
  function cancelMode() { app.mode = null; R.targets = null; canvas.classList.remove('targeting'); if (app.selPriest === null) $('targetbar').hidden = true; updatePowerbar(); }
  function describePreview(pv) {
    if (!pv) return '';
    var out = [];
    if (pv.faith) out.push((pv.faith > 0 ? '+' : '') + fmt(pv.faith) + ' Faith'); if (pv.favor) out.push((pv.favor > 0 ? '+' : '') + pv.favor + ' Favor');
    if (pv.revealed) out.push('reveals ' + pv.revealed + ' hexes'); if (pv.followers) out.push((pv.followers > 0 ? '+' : '') + pv.followers + ' followers');
    pv.settlements.slice(0, 3).forEach(function (d) {
      var bits = []; if (d.shrine) bits.push('shrine ' + d.shrine); if (d.pop) bits.push((d.pop > 0 ? '+' : '') + d.pop + ' people'); if (d.prosperity) bits.push((d.prosperity > 0 ? '+' : '') + d.prosperity + ' prosperity'); if (d.ward) bits.push((d.ward > 0 ? '+' : '') + d.ward + ' Ward');
      d.followers.forEach(function (f, r) { if (f) bits.push((f > 0 ? '+' : '') + f + ' ' + (r === app.viewer ? 'yours' : shortName(r))); });
      if (bits.length) out.push(d.name + ': ' + bits.join(', ')); else out.push(d.name + ': blessing or curse for some turns');
    });
    return out.length ? '→ ' + out.join(' · ') : '→ no immediate change (it acts over the coming turns)';
  }
  function updateTargetPreview(tile) {
    if (!app.mode || !settings.previews || tile < 0) return;
    var a = actionFor(app.mode.item, tile, app.mode.extra), err = E.validate(app.state, a);
    $('target-preview').textContent = err ? '✗ ' + err : describePreview(E.preview(app.state, a));
  }

  /* ------------------------------------------------------------ HUD */
  function paintEmblem() { var f = FACTIONS[me().faction], tc = $('tb-emblem').getContext('2d'); tc.imageSmoothingEnabled = false; tc.clearRect(0, 0, 34, 34); tc.drawImage(A.emblem(f.emblem, f.palette), 0, 0, 34, 34); }
  function updateHud() {
    if (!app.state || app.title) return;
    var s = app.state, p = me(), tp = H.totalPop(s), fol = H.followersOf(s, p.id), inc = H.incomeOf(s, p.id), sc = H.shrineCost(s, p.id);
    $('tb-name').textContent = p.name; $('tb-sub').textContent = FACTIONS[p.faction].deityTitle + ' · ' + FACTIONS[p.faction].tradition;
    $('tb-faith').textContent = fmt(p.faith); $('tb-inc').textContent = '+' + fmt(inc) + '/turn';
    var fm = $('faith-meter'), pct = Math.min(100, p.faith / sc * 100); fm.firstElementChild.style.width = pct + '%'; fm.setAttribute('aria-valuenow', Math.round(pct)); $('faith-meter-label').textContent = 'shrine ' + sc;
    $('tb-favor').textContent = p.favor; $('tb-favcap').textContent = ' / ' + RU.economy.favorCap;
    $('tb-follow').textContent = fol; $('tb-share').textContent = Math.round(fol / tp * 100) + '%';
    $('tb-turn').textContent = s.turn; $('tb-maxturn').textContent = ' / ' + s.maxTurns; $('tb-age-name').textContent = E.ageOf(s.turn).name;
    var asc = $('asc-meter'); asc.innerHTML = '';
    s.players.forEach(function (pl) { var i = document.createElement('i'); i.style.width = (H.followersOf(s, pl.id) / tp * 100) + '%'; i.style.background = pal(pl.id).secondary; i.title = pl.name + ': ' + H.followersOf(s, pl.id); asc.appendChild(i); });
    var thr = document.createElement('div'); thr.className = 'thr'; thr.style.left = (RU.victory.ascendancyShare * 100) + '%'; asc.appendChild(thr);
    // alerts: threatened shrines, envoys waiting, covenants due
    var al = [], threats = H.playerShrines(s, p.id).filter(function (x) { return x.shrine.threat; }), env = s.proposals.filter(function (x) { return x.status === 'pending' && x.to === p.id; }), due = H.activeCovenants(s, p.id).filter(function (c) { return c.t1 - s.turn <= 1; });
    if (threats.length) al.push('<button class="alert bad" data-focus="' + threats[0].tile + '" title="A rival struck your shrine: answer with a counter-rite from the town panel">⚠ ' + threats.length + ' threatened</button>');
    if (env.length) al.push('<button class="alert" data-envoy="1">✉ ' + env.length + ' envoy' + (env.length > 1 ? 's' : '') + '</button>');
    if (due.length) al.push('<button class="alert" data-focus="' + s.settlements[due[0].s].tile + '">✒ covenant due</button>');
    $('tb-alerts').innerHTML = al.join('');
    $('tb-alerts').querySelectorAll('[data-focus]').forEach(function (b) { b.onclick = function () { R.focusTile(+b.dataset.focus); select(+b.dataset.focus); }; });
    $('tb-alerts').querySelectorAll('[data-envoy]').forEach(function (b) { b.onclick = openEnvoys; });
    // objective
    var ob = $('objective');
    if (s.mode.kind === 'scenario') { var scn = SCEN[s.mode.scenario], o = scn.objectives[Math.min(s.mode.stage, scn.objectives.length - 1)]; ob.hidden = false; ob.innerHTML = '<b>' + esc(scn.name) + '</b> · ' + (s.mode.stage + 1) + '/' + scn.objectives.length + ': ' + esc(o.text); }
    else if (s.mode.kind === 'alt') { ob.hidden = false; ob.innerHTML = s.mode.victory === 'sacredSites' ? '<b>Sacred Ground</b> · hold ' + Math.min(3, s.landmarks.length) + ' holy places for 3 rounds (you hold ' + s.landmarks.filter(function (l) { return l.holder === p.id; }).length + ', ' + p.sacredRounds + ' rounds)' : '<b>The Kept Word</b> · keep 3 covenants, break none (kept ' + p.stats.covenantsKept + ', broken ' + p.stats.covenantsBroken + ')'; }
    else ob.hidden = true;
    var et = $('endturn'), busy = app.busy || s.current !== app.viewer || app.handoff;
    et.disabled = busy || s.over || !!app.replay; et.classList.toggle('event', !!p.pendingEvent && !busy); et.classList.toggle('ready', !busy && !p.pendingEvent && !R.reduced);
    $('endturn-label').textContent = busy ? 'Rivals act…' : (p.pendingEvent ? 'Event' : 'End Turn');
    $('endturn-sub').textContent = busy ? s.players[s.current].name.replace(/^The /, '') : (p.pendingEvent ? 'Resolve card' : 'Turn ' + s.turn);
    updatePowerbar(); renderPanel();
    R.drawMinimap($('minimap'));
    $('menu-seed').textContent = s.seed; $('menu-hash').textContent = E.hash(s); $('menu-mode').textContent = modeName(s.mode);
    if (app.layers && app.layers.influence) computeInfluence();
  }
  function modeName(m) { return m.kind === 'scenario' ? 'Trial: ' + SCEN[m.scenario].name : m.kind === 'alt' ? (m.victory === 'sacredSites' ? 'Sacred Ground' : 'The Kept Word') : 'Standard'; }
  var iconCache = {};
  function iconCanvas(id, size) { size = size || 48; var key = id + ':' + size; if (!iconCache[key]) iconCache[key] = A.icon(id, size); var c = document.createElement('canvas'); c.width = size; c.height = size; c.getContext('2d').drawImage(iconCache[key], 0, 0); return c; }
  function keyLabel(k) { var v = settings.keys[k]; return v === ' ' ? 'Space' : v; }
  function updatePowerbar() {
    if (!app.state || app.title) return;
    var bar = $('powerbar'), items = barItems();
    if (bar.dataset.faction !== me().faction || bar.childElementCount !== items.length + 1) {
      bar.innerHTML = ''; bar.dataset.faction = me().faction;
      items.forEach(function (it, i) {
        if (i === 5) { var sep = document.createElement('div'); sep.className = 'sep'; bar.appendChild(sep); }
        var b = document.createElement('button'); b.className = 'pw x-' + it.x + (it.power ? ' faction' : ''); b.dataset.id = it.id;
        b.innerHTML = '<span class="key"></span><span class="cst"></span>'; b.appendChild(iconCanvas(it.icon));
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
      b.querySelector('.key').textContent = keyLabel('power' + (i + 1));
      b.querySelector('.cst').textContent = (it.cost.faith ? it.cost.faith + '✦' : '') + (it.cost.favor ? ' ' + it.cost.favor + '★' : '');
      var cd = b.querySelector('.cd'); cd.hidden = !(it.cd > 0); if (it.cd > 0) { cd.textContent = it.cd; cd.style.setProperty('--cd', (it.cd / (it.maxcd || it.cd)).toFixed(3)); }
      var tip = it.name + ' (' + keyLabel('power' + (i + 1)) + ') — ' + costStr(it.cost) + (it.maxcd ? ', cooldown ' + it.maxcd : '') + '. ' + it.text + (it.inspired ? ' Inspired by ' + it.inspired + '.' : '') + (err ? ' [' + err + ']' : '');
      b.title = tip; b.setAttribute('aria-label', tip); b.setAttribute('aria-disabled', err ? 'true' : 'false');
    });
  }

  /* ------------------------------------------------------------ the place panel: people, needs, memory, and every action that targets this place */
  function needBar(label, v, explain) { var cls = v <= 2 ? 'bad' : v >= 7 ? 'good' : ''; return '<div class="row need" title="' + esc(explain) + '"><span>' + label + '</span><span class="nb ' + cls + '"><i style="width:' + v * 10 + '%"></i></span><span>' + v + '/10</span></div>'; }
  function memLine(m) {
    var who = m.p >= 0 ? (m.p === app.viewer ? 'you' : shortName(m.p)) : '', x = m.x || {};
    var owner = x.owner === undefined ? '?' : x.owner === app.viewer ? 'you' : shortName(x.owner);
    var T = { founded: 'shrine raised by %', rebuilt: 'shrine rebuilt by %', won: 'won by %', lost: '% lost it', blessed: 'blessed by %', struck: 'struck by %', weighed: 'hearts weighed by %', swayed: 'swayed by %',
      covenant: '% swore a covenant', covenantKept: '% kept a promise', covenantBroken: '% broke a promise', defended: '% answered an attack', hunger: 'went hungry under %', storm: 'a storm passed', drought: 'a drought came', restored: 'restored by %', neglected: 'neglected by %', consecrated: 'shrine consecrated by %', pilgrims: 'pilgrims of %' };
    var t = m.k === 'toppled' ? 'shrine of ' + owner + ' toppled by ' + who : (T[m.k] || m.k).replace('%', who);
    return '<li><span class="t">T' + m.t + '</span>' + esc(t) + '</li>';
  }
  function renderPanel() {
    var el = $('panel'), s = app.state; if (!s || app.handoff) { el.innerHTML = ''; return; }
    var tile = app.selTile, h = '', v = app.viewer;
    if (app.selPriest !== null) {
      var pr = s.priests.find(function (p) { return p.id === app.selPriest; });
      if (pr) { var role = RU.roles[pr.role || 'emissary']; h += '<h3>' + esc(role.name) + ' of ' + esc(me().name.replace(/^The /, '')) + '</h3><div class="sub">' + esc(role.text) + '</div><div class="hint">Click any reachable hex to send it; Esc to cancel.</div>' + (pr.dest !== null ? '<div class="row"><span>Heading to</span><span>' + esc(tileName(pr.dest)) + '</span></div>' : ''); }
      el.innerHTML = h; return;
    }
    if (tile === undefined || tile === null || tile < 0) {
      var f = FACTIONS[me().faction];
      h = '<h3>' + esc(me().name) + '</h3><div class="sub">' + esc(f.blurb) + '</div>' + domainRows();
      var cov = H.activeCovenants(s, v); if (cov.length) h += '<div class="sect">Your covenants</div>' + cov.map(function (c) { return '<div class="row"><span>' + esc(RU.covenants.kinds[c.kind].name) + ' · ' + esc(s.settlements[c.s].name) + '</span><span>until T' + c.t1 + (myTurn() ? ' <button class="ghost small" data-abandon="' + c.id + '">abandon</button>' : '') + '</span></div>'; }).join('');
      var tr = s.treaties.filter(function (t) { return t.status === 'active' && (t.a === v || t.b === v); }); if (tr.length) h += '<div class="sect">Treaties</div>' + tr.map(function (t) { return '<div class="row"><span>' + esc(t.kind) + ' with ' + esc(s.players[t.a === v ? t.b : t.a].name) + '</span><span>until T' + t.t1 + '</span></div>'; }).join('');
      h += '<div class="hint">Select a town to see its people, needs and history. Click your priest\'s town twice to command it.</div>';
      el.innerHTML = h; bindPanel(); return;
    }
    var t = s.map.tiles[tile], T = D.terrain.types[t.terrain];
    if (!me().revealed[tile]) { el.innerHTML = '<h3>Unknown lands</h3><div class="sub">Hidden in cloud. Read omens or send a priest.</div>'; return; }
    var st = H.settlementAt(s, tile), lm = s.landmarks.find(function (l) { return l.tile === tile; });
    var fronts = H.knownFronts(s, v).filter(function (fr) { return H.dist(s, fr.tile, tile) <= fr.radius && fr.phase !== 'after'; });
    var weather = fronts.map(function (fr) { return '<div class="row weather"><span>' + esc(RU.climate.kinds[fr.kind].name) + '</span><span>' + (fr.phase === 'forecast' ? 'coming, turn ' + fr.t0 : 'until turn ' + fr.t1) + '</span></div>'; }).join('');
    if (!st) {
      h += '<h3>' + esc(lm ? RU.landmarks.kinds[lm.kind].name : (T.name || t.terrain)) + '</h3><div class="sub">' + (lm ? esc(RU.landmarks.kinds[lm.kind].text) + ' Held by ' + esc(lm.holder >= 0 ? godName(lm.holder) : 'no one') + '. A priest standing here alone at the end of a round claims it.' : (T.water ? (t.terrain === 'deep' ? 'Open water. Only priests of a seafaring pantheon may cross the shallows.' : 'Shallow water near the coast.') : (t.coast ? 'Coastal · ' : '') + 'height ' + Math.round(t.e * 100) + (T.passable ? '' : ' · impassable'))) + '</div>';
      h += weather + priestsHere(tile); el.innerHTML = h; bindPanel(); return;
    }
    var red = redacted(s, v), rst = red.settlements[st.id];
    h += '<h3>' + esc(st.name) + '</h3><div class="sub">' + esc(T.name || t.terrain) + (t.coast ? ' · beside water' : '') + ' · population ' + st.pop + (st.peak > st.pop ? ' (once ' + st.peak + ')' : '') + (st.controlledBy >= 0 ? ' · kneels to ' + esc(godName(st.controlledBy)) : ' · undecided') + '</div>';
    h += '<div class="bar" aria-hidden="true">'; st.followers.forEach(function (fl, pid) { if (fl) h += '<i style="width:' + (fl / st.pop * 100) + '%;background:' + pal(pid).secondary + '"></i>'; }); h += '</div>';
    h += '<div class="row tb-small"><span>God</span><span>followers · pressure · trust</span></div>';
    st.followers.forEach(function (fl, pid) { h += '<div class="row"><span><span class="pip" style="background:' + pal(pid).secondary + '"></span>' + esc(shortName(pid)) + (pid === v ? ' (you)' : '') + '</span><span>' + fl + ' · ' + fmt(H.pressureAt(red, rst, pid)) + ' · ' + (st.trust[pid] > 0 ? '+' : '') + st.trust[pid] + '</span></div>'; });
    h += '<div class="row"><span>Unaffiliated</span><span>' + H.unaffiliated(st) + '</span></div>';
    var fert = D.terrain[t.terrain] ? 0 : D.terrain.types[t.terrain].fertility;
    h += needBar('Prosperity', st.needs.prosperity, 'Drifts toward a level set by the land (' + D.terrain.types[t.terrain].name + '), having a patron, blessings, springs and weather. At 2 or less the town goes hungry: no growth, and it slowly abandons its god.');
    h += needBar('Safety', st.needs.safety, 'Falls after strikes, eclipses and storms; rises near Sanctuaries, Wardens and strong shrines. At 2 or less the town listens less to gods who cannot protect it.');
    if (st.needs.prosperity <= RU.needs.hungry) h += '<div class="hint warn">Hungry: feed it with a blessing, rain or a covenant of plenty, or it will turn away.</div>';
    if (st.shrine) { var sd = D.shrines.find(function (x) { return x.id === st.shrine.type; }); h += '<div class="row"><span>Shrine</span><span>' + esc(sd.name) + (st.shrine.spec ? ' · ' + RU.specs[st.shrine.spec].name : '') + ' (' + esc(godName(st.shrine.owner)) + ')</span></div><div class="row"><span>Ward</span><span>' + st.shrine.ward + (st.shrine.eclipsed ? ' · eclipsed ' + st.shrine.eclipsed : '') + (st.shrine.threat ? ' · <b class="bad">threatened</b>' : '') + '</span></div>'; }
    var bonus = domainBonusHere(t, st); if (bonus) h += '<div class="row"><span>Your domains here</span><span>' + bonus + '</span></div>';
    h += weather;
    var routes = s.routes.filter(function (r) { return (r.a === st.id || r.b === st.id) && me().revealed[s.settlements[r.a === st.id ? r.b : r.a].tile]; });
    if (routes.length) h += '<div class="sect">Pilgrim roads</div>' + routes.map(function (r) { var o = s.settlements[r.a === st.id ? r.b : r.a], ok = myTurn() && !E.validate(s, { type: 'route', route: r.id }); return '<div class="row"><span>to ' + esc(o.name) + '</span><span>' + (r.owner >= 0 ? esc(godName(r.owner)) + ' · ' + r.status : 'open') + (ok ? ' <button class="ghost small" data-route="' + r.id + '">consecrate ' + H.routeCost(s, v) + '✦</button>' : '') + '</span></div>'; }).join('');
    h += priestsHere(tile);
    if (st.mem.length) h += '<details class="mem"><summary>Memory of ' + esc(st.name) + '</summary><ol>' + st.mem.slice().reverse().map(memLine).join('') + '</ol>' + (st.patrons.length ? '<div class="tb-small">Patrons: ' + st.patrons.map(function (pp) { return esc(FACTIONS[pp.f].shortName) + ' (T' + pp.t + ')'; }).join(' → ') + '</div>' : '') + '</details>';
    if (myTurn()) h += actionsFor(st, tile);
    el.innerHTML = h; bindPanel();
  }
  function actionsFor(st, tile) {
    var s = app.state, v = app.viewer, acts = [];
    var items = barItems().filter(function (it) { return it.target === 'tile'; });
    var rivalHere = st.followers.some(function (f, r) { return r !== v && f > 0; }) || s.priests.some(function (pr) { return pr.owner !== v && pr.tile === tile; }) || (st.shrine && st.shrine.owner !== v);
    items.forEach(function (it) { if (it.x === 'exterminate' && !rivalHere) return; if (!E.validate(s, actionFor(it, tile))) acts.push('<button class="act" data-do="' + it.id + '"><span>' + esc(it.name) + '</span><span class="cost">' + costStr(it.cost) + '</span></button>'); });
    if (!E.validate(s, { type: 'priest', tile: tile })) ['seer', 'warden'].forEach(function (r) { acts.push('<button class="act" data-ordain="' + r + '"><span>Ordain a ' + RU.roles[r].name + '</span><span class="cost">' + H.priestCost(s, v) + ' Faith</span></button>'); });
    if (st.shrine && st.shrine.owner === v && !st.shrine.spec) E.SPECS.forEach(function (sp) { if (!E.validate(s, { type: 'specialize', tile: tile, spec: sp })) acts.push('<button class="act" data-spec="' + sp + '" title="' + esc(RU.specs[sp].text) + '"><span>Consecrate as ' + RU.specs[sp].name + '</span><span class="cost">' + RU.specs.faith + ' Faith + ' + RU.specs.favor + ' Favor</span></button>'); });
    if (!E.validate(s, { type: 'counterRite', tile: tile })) acts.push('<button class="act urgent" data-counter="1"><span>Counter-rite' + (st.shrine.threat.storm ? ': disperse the storm' : ': restore ' + st.shrine.threat.dmg + ' Ward') + '</span><span class="cost">' + H.counterCost(s, v) + ' Favor</span></button>');
    Object.keys(RU.covenants.kinds).forEach(function (k) { if (!E.validate(s, { type: 'covenant', kind: k, tile: tile })) acts.push('<button class="act" data-cov="' + k + '" title="' + esc(RU.covenants.kinds[k].text) + ' Reward ' + RU.covenants.kinds[k].rewardFavor + ' Favor; breaking it costs ' + RU.covenants.kinds[k].penaltyFavor + ' Favor and trust."><span>Swear ' + esc(RU.covenants.kinds[k].name) + '</span><span class="cost">promise · ' + RU.covenants.kinds[k].turns + ' turns</span></button>'); });
    return acts.length ? '<div class="acts">' + acts.join('') + '</div>' : '';
  }
  function priestsHere(tile) {
    var s = app.state, list = s.priests.filter(function (p) { return p.tile === tile && (p.owner === app.viewer || me().revealed[tile]); }); if (!list.length) return '';
    var atOwnShrine = (function () { var st = H.settlementAt(s, tile); return st && st.shrine && st.shrine.owner === app.viewer; })();
    return list.map(function (p) {
      var mine = p.owner === app.viewer, role = RU.roles[p.role || 'emissary'];
      var btns = mine && myTurn() ? '<button class="ghost small" data-priest="' + p.id + '">Send</button>' + (atOwnShrine ? E.ROLES.filter(function (r) { return r !== (p.role || 'emissary') && !E.validate(s, { type: 'retrain', priest: p.id, role: r }); }).map(function (r) { return ' <button class="ghost small" data-retrain="' + p.id + ':' + r + '" title="Retrain as ' + RU.roles[r].name + ': ' + esc(RU.roles[r].text) + '">→' + RU.roles[r].name + '</button>'; }).join('') : '') : (p.dest !== null && mine ? 'travelling' : '');
      return '<div class="row"><span><span class="pip" style="background:' + pal(p.owner).secondary + '"></span>' + esc(shortName(p.owner)) + ' ' + role.name.toLowerCase() + '</span><span>' + btns + '</span></div>';
    }).join('');
  }
  function bindPanel() {
    var el = $('panel'), tile = app.selTile;
    el.querySelectorAll('[data-do]').forEach(function (b) { b.onclick = function () { var it = barItems().find(function (x) { return x.id === b.dataset.do; }); act(actionFor(it, tile)); }; });
    el.querySelectorAll('[data-ordain]').forEach(function (b) { b.onclick = function () { act({ type: 'priest', tile: tile, role: b.dataset.ordain }); }; });
    el.querySelectorAll('[data-spec]').forEach(function (b) { b.onclick = function () { act({ type: 'specialize', tile: tile, spec: b.dataset.spec }); }; });
    el.querySelectorAll('[data-counter]').forEach(function (b) { b.onclick = function () { act({ type: 'counterRite', tile: tile }); }; });
    el.querySelectorAll('[data-cov]').forEach(function (b) { b.onclick = function () { confirmBox('Swear the ' + RU.covenants.kinds[b.dataset.cov].name + '?', RU.covenants.kinds[b.dataset.cov].text + ' If you keep it: +' + RU.covenants.kinds[b.dataset.cov].rewardFavor + ' Favor and the town\'s trust. If it breaks, or you abandon it: −' + RU.covenants.kinds[b.dataset.cov].penaltyFavor + ' Favor, lost trust, and the town remembers.', function () { act({ type: 'covenant', kind: b.dataset.cov, tile: tile }); }); }; });
    el.querySelectorAll('[data-route]').forEach(function (b) { b.onclick = function () { act({ type: 'route', route: +b.dataset.route }); }; });
    el.querySelectorAll('[data-priest]').forEach(function (b) { b.onclick = function () { selectPriest(+b.dataset.priest); }; });
    el.querySelectorAll('[data-retrain]').forEach(function (b) { b.onclick = function () { var x = b.dataset.retrain.split(':'); act({ type: 'retrain', priest: +x[0], role: x[1] }); }; });
    el.querySelectorAll('[data-abandon]').forEach(function (b) { b.onclick = function () { confirmBox('Abandon this covenant?', 'Abandoning counts as breaking it: you lose Favor and the town\'s trust.', function () { act({ type: 'abandon', covenant: +b.dataset.abandon }); }); }; });
  }
  function domainRows() { return FACTIONS[me().faction].domains.map(function (id) { var d = DOMAINS[id]; return '<div class="row" title="' + esc(d.flavor) + '"><span>' + esc(d.name) + '</span><span class="tb-small dtext">' + esc(d.text) + '</span></div>'; }).join(''); }
  function domainBonusHere(t, st) {
    var m = me().mods, b = 0; m.terrainFaith.forEach(function (tf) { if (tf.terrains.indexOf(t.terrain) >= 0 && st.needs.prosperity >= tf.minProsperity) b += tf.per; }); if (m.waterFaith && t.coast) b += m.waterFaith;
    var out = []; if (b) out.push('+' + fmt(b) + ' Faith per follower'); if (m.coastalPressure && t.coast) out.push('+' + Math.round(m.coastalPressure * 100) + '% pressure');
    return out.join(', ');
  }

  /* ------------------------------------------------------------ event card */
  function showEvent() {
    var p = me(); if (!p.pendingEvent || app.handoff) return;
    var ev = EVENTS[p.pendingEvent.id], m = $('event');
    $('ev-title').textContent = ev.title; $('ev-text').textContent = ev.text; $('ev-turn').textContent = app.state.turn;
    var art = A.eventArt(ev.art, app.state.seed + app.state.turn, app.state.age), c = $('ev-art'), g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 160, 90); g.drawImage(art, 0, 0, 160, 90);
    c.setAttribute('aria-label', ev.title + ' illustration');
    var em = A.emblem(FACTIONS[p.faction].emblem, FACTIONS[p.faction].palette), ec = $('ev-emblem'), eg = ec.getContext('2d'); eg.imageSmoothingEnabled = false; eg.clearRect(0, 0, 32, 32); eg.drawImage(em, 0, 0, 32, 32);
    var ch = $('ev-choices'); ch.innerHTML = '';
    ev.choices.forEach(function (cc, i) { var b = document.createElement('button'); b.innerHTML = esc(cc.label) + '<small>' + esc(describeEffects(cc.effects)) + '</small>'; b.onclick = function () { m.hidden = true; act({ type: 'event', choice: i }); }; ch.appendChild(b); });
    m.hidden = false; trapFocus(m); setTimeout(function () { ch.firstElementChild && ch.firstElementChild.focus(); }, 30);
  }
  function describeEffects(efs) {
    return efs.map(function (e) {
      switch (e.type) {
        case 'faith': return (e.amount > 0 ? '+' : '') + e.amount + ' Faith';
        case 'favor': return (e.amount > 0 ? '+' : '') + e.amount + ' Favor';
        case 'popControlled': return (e.amount ? '+' + e.amount + ' people' : 'relief') + (e.prosperity ? ' and +' + e.prosperity + ' prosperity' : '') + ' in ' + (e.max ? 'up to ' + e.max + ' towns' : 'each town') + ' that kneel to you';
        case 'popLargest': return '+' + e.amount + ' people in your largest town';
        case 'followersLargest': return '+' + e.amount + ' followers in your largest town';
        case 'loseFollowersLargest': return '−' + e.amount + ' followers in your largest town';
        case 'freePriest': return 'a free priest';
        case 'shrineDiscount': return 'next shrine costs ' + Math.round(e.mult * 100) + '%';
        case 'wardAll': return '+' + e.amount + ' Ward on all shrines';
        case 'wardRandom': return '+' + e.amount + ' Ward on one shrine';
        case 'revealNearestSettlements': return 'reveal ' + e.count + ' hidden town' + (e.count > 1 ? 's' : '');
        case 'buff': return ({ faithMult: 'Faith ×', pressureMult: 'pressure ×', priestMult: 'priests ×', eclipseImmune: 'immune to eclipses', faithPerControlled: 'Faith per town +', routeMult: 'roads count ×' }[e.stat] || e.stat) + (e.stat === 'eclipseImmune' ? '' : e.value) + ' for ' + e.turns + ' turns';
        default: return e.type;
      }
    }).join(' · ');
  }

  /* ------------------------------------------------------------ envoys (P011) */
  function openEnvoys() {
    var s = app.state, v = app.viewer, b = $('envoys-body'), h = '';
    var inc = s.proposals.filter(function (x) { return x.status === 'pending' && x.to === v; });
    if (inc.length) h += '<h3>Envoys waiting</h3>' + inc.map(function (x) { return '<div class="row"><span>' + esc(s.players[x.from].name) + ' proposes a <b>' + x.kind + '</b></span><span>' + (myTurn() ? '<button class="ghost small" data-ans="' + x.id + ':1">Accept</button> <button class="ghost small" data-ans="' + x.id + ':0">Refuse</button>' : 'wait for your turn') + '</span></div>'; }).join('');
    h += '<h3>Rival gods</h3>';
    s.players.forEach(function (q) {
      if (q.id === v) return;
      var tr = s.treaties.filter(function (t) { return t.status === 'active' && ((t.a === v && t.b === q.id) || (t.b === v && t.a === q.id)); }), g = q.grudge[v];
      h += '<div class="envoy"><div class="row"><span><span class="pip" style="background:' + pal(q.id).secondary + '"></span><b>' + esc(q.name) + '</b>' + (q.eliminated ? ' (forgotten)' : '') + '</span><span title="How much this god resents you (0–10). Strikes, eclipses, taking their towns and broken treaties raise it; time and festivals lower it.">grudge ' + g + '/10</span></div>';
      if (tr.length) h += '<div class="tb-small">' + tr.map(function (t) { return t.kind + ' until turn ' + t.t1; }).join(', ') + '</div>';
      if (myTurn() && !q.eliminated) h += '<div class="acts row3">' + ['truce', 'festival', 'border'].map(function (k) { var err = E.validate(s, { type: 'propose', kind: k, to: q.id }); return '<button class="act" ' + (err ? 'disabled title="' + esc(err) + '"' : '') + ' data-prop="' + k + ':' + q.id + '"><span>' + { truce: 'Propose a truce', festival: 'Shared festival', border: 'Border promise' }[k] + '</span><span class="cost">' + { truce: RU.diplomacy.truceTurns + ' turns', festival: RU.diplomacy.festivalFaith + ' Faith each', border: RU.diplomacy.borderTurns + ' turns' }[k] + '</span></button>'; }).join('') + '</div>';
      h += '</div>';
    });
    h += '<p class="tb-small">A truce forbids eclipses, strikes and conversion miracles against the partner; breaking it costs ' + RU.diplomacy.breachFavor + ' Favor and the partner\'s trust. A festival costs both gods ' + RU.diplomacy.festivalFaith + ' Faith and gives both ' + RU.diplomacy.festivalFavor + ' Favor next turn. A border promise forbids shrines within ' + RU.diplomacy.borderRadius + ' hexes of the other\'s shrines. Envoys not answered by the end of the next round return home.</p>';
    b.innerHTML = h;
    b.querySelectorAll('[data-ans]').forEach(function (x) { x.onclick = function () { var y = x.dataset.ans.split(':'); act({ type: 'answer', id: +y[0], accept: y[1] === '1' }); openEnvoys(); }; });
    b.querySelectorAll('[data-prop]').forEach(function (x) { x.onclick = function () { var y = x.dataset.prop.split(':'); if (act({ type: 'propose', kind: y[0], to: +y[1] })) toast('Your envoy sets out.'); openEnvoys(); }; });
    openModal('envoys');
  }

  /* ------------------------------------------------------------ victory, chronicle, tapestry */
  function showVictory() {
    var s = app.state, w = s.winner; if (!w || !$('victory').hidden || app.replay) return;
    var wp = s.players[w.pid], f = FACTIONS[wp.faction], youWon = isHuman(w.pid) && (app.humans.length === 1 ? w.pid === app.viewer : true);
    var em = A.emblem(f.emblem, f.palette), c = $('vic-emblem'), g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 96, 96); g.drawImage(em, 0, 0, 96, 96);
    var names = { ascendancy: 'Ascendancy', dominion: 'Dominion', twilight: 'Twilight Judgment', sacred: 'Sacred Ground', covenant: 'The Kept Word', objective: 'Trial passed', objectiveFailed: 'Trial lost' };
    var lostTrial = w.type === 'objectiveFailed';
    $('vic-kicker').textContent = (lostTrial ? 'Defeat' : youWon ? 'Victory' : 'Defeat') + ' · ' + names[w.type] + ' · Turn ' + w.turn;
    $('vic-title').textContent = lostTrial ? 'The Trial Is Lost' : w.type === 'objective' ? 'The Trial Is Passed' : youWon ? (app.humans.length > 1 ? wp.name + ' Endures' : 'Your Name Endures') : wp.name + ' Prevails';
    var subs = { ascendancy: 'More than ' + Math.round(RU.victory.ascendancyShare * 100) + '% of all mortals follow one god.', dominion: 'Every rival god is forgotten.', twilight: 'The age ends. Devotion is weighed, and one name is remembered above the rest.', sacred: 'The holy places of the world answer to one god.', covenant: 'Three promises kept, none broken.', objective: (SCEN[s.mode.scenario] || {}).name + ': every objective met.', objectiveFailed: (w.why || '') };
    $('vic-sub').textContent = subs[w.type];
    var tp = H.totalPop(s), rows = '<tr><th>God</th><th>Followers</th><th>Share</th><th>Shrines</th><th>Towns</th><th>Score</th></tr>';
    s.players.slice().sort(function (a, b) { return w.scores[b.id] - w.scores[a.id]; }).forEach(function (p) {
      rows += '<tr class="' + (p.id === w.pid ? 'win' : '') + '"><td><span class="pip" style="background:' + pal(p.id).secondary + '"></span>' + esc(p.name) + (isHuman(p.id) ? ' (human)' : '') + (p.eliminated ? ' — forgotten' : '') + '</td><td>' + H.followersOf(s, p.id) + '</td><td>' + Math.round(H.followersOf(s, p.id) / tp * 100) + '%</td><td>' + H.playerShrines(s, p.id).length + '</td><td>' + H.controlledCount(s, p.id) + '</td><td>' + w.scores[p.id] + '</td></tr>';
    });
    $('vic-table').innerHTML = rows;
    $('vic-meta').textContent = 'Seed ' + s.seed + ' · ' + modeName(s.mode) + ' · ' + s.actions.length + ' actions · final state hash ' + E.hash(s) + ' (replaying the same seed and actions reproduces this exactly)';
    audio.cue(youWon && !lostTrial ? 'victory' : 'defeat');
    $('victory').hidden = false; trapFocus($('victory')); $('vic-new').focus();
    autosave(true);
  }
  function currentRecord(kind) { return S.makeRecord(E, app.state, { kind: kind || 'save', turnHashes: app.turnHashes, session: store ? store.session : null, label: me().name + ' · turn ' + app.state.turn, mode: app.state.mode }); }
  function download(name, mime, data) {
    try { var blob = data instanceof Blob ? data : new Blob([data], { type: mime }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500); return true; }
    catch (e) { toast('This browser blocked the download: ' + e.message, true); return false; }
  }
  /* Chronicle: rebuilds every turn on private states and shows them; the live game is untouched and input is locked while it is open. */
  function shim(st) { ['marks', 'routes', 'landmarks', 'covenants', 'treaties', 'proposals', 'pending'].forEach(function (k) { if (!st[k]) st[k] = []; }); if (!st.climate) st.climate = { fronts: [] }; if (!st.mode) st.mode = { kind: 'standard' }; st.settlements.forEach(function (x) { x.mem = x.mem || []; x.patrons = x.patrons || []; x.boons = x.boons || []; x.trust = x.trust || x.followers.map(function () { return 0; }); x.needs = x.needs || { prosperity: 5, safety: 6 }; x.peak = x.peak || x.pop; }); st.players.forEach(function (p) { p.grudge = p.grudge || []; p.forecasts = p.forecasts || []; }); return st; }
  function openChronicle(fromRecord, legacyEngine) {
    var rec = fromRecord || currentRecord('chronicle'), Ex = legacyEngine || E;
    var book = C.reconstruct(Ex, rec);
    if (book.error) { toast('The chronicle cannot be rebuilt: ' + book.error, true); return; }
    app.replay = { book: book, rec: rec, E: Ex, turn: 1, playing: null, legacy: !!legacyEngine, viewer: app.state ? app.viewer : 0 };
    if (!app.state) { app.demo = null; R.setMap(shim(Ex.clone(book.checkpoints[book.turns[0]]))); $('title').hidden = true; }
    clearTimeout(app.aiTimer); cancelMode(); deselectPriest();
    ['menu', 'victory', 'saves'].forEach(function (id) { $(id).hidden = true; });
    $('hud').hidden = true;
    var over = book.final.over, sel = $('chron-viewer'); sel.innerHTML = '';
    book.final.players.forEach(function (p) { if (over || app.replay.legacy || p.id === app.viewer) { var o = document.createElement('option'); o.value = p.id; o.textContent = p.name; sel.appendChild(o); } });
    sel.value = String(app.replay.viewer); if (sel.value === '') sel.value = sel.options[0].value; app.replay.viewer = +sel.value;
    var turns = book.turns, slider = $('chron-turn'); slider.min = turns[0]; slider.max = turns[turns.length - 1]; slider.value = turns[0];
    $('chronicle').hidden = false; trapFocus($('chronicle'));
    $('chron-tapestry').disabled = !over;
    showTurn(turns[0]);
    if (book.mismatches.length) toast('Warning: ' + book.mismatches.length + ' turn(s) do not match the hashes recorded during play.', true);
  }
  function showTurn(t) {
    var rp = app.replay, cp = rp.book.checkpoints[t]; if (!cp) return;
    rp.turn = t; $('chron-turn').value = t; $('chron-label').textContent = 'Turn ' + t + ' · ' + rp.E.ageOf ? ('Turn ' + t) : ('Turn ' + t);
    if (rp.E.ageOf) $('chron-label').textContent = 'Turn ' + t + ' · ' + rp.E.ageOf(t).name;
    var st = shim(rp.E.clone(cp)); R.setState(st, rp.viewer);
    // decisive notes from this turn that this viewer could see then
    var rev = cp.players[rp.viewer].revealed, notes = rp.book.final.log.filter(function (l) { return l.t === t && C.eventWeight(l) > 0 && (l.p === rp.viewer || !l.x || l.x.tile === undefined || l.x.tile === null || rev[l.x.tile] || l.k === 'age' || l.k === 'victory'); });
    $('chron-notes').innerHTML = notes.length ? notes.slice(0, 6).map(function (l) { return '<button class="ghost small note" data-tile="' + (l.x && l.x.tile !== undefined ? l.x.tile : '') + '">' + esc(l.m) + '</button>'; }).join('') : '<span class="tb-small">A quiet turn.</span>';
    $('chron-notes').querySelectorAll('[data-tile]').forEach(function (b) { b.onclick = function () { if (b.dataset.tile !== '') R.focusTile(+b.dataset.tile); }; });
    drawScores(); say('Chronicle, turn ' + t + '. ' + notes.map(function (l) { return l.m; }).join(' '));
  }
  function drawScores() {
    var rp = app.replay, c = $('chron-scores'), g = c.getContext('2d'), sc = rp.book.scores, W = c.width, Hh = c.height, mx = 1;
    g.clearRect(0, 0, W, Hh); sc.forEach(function (row) { row.forEach(function (v) { mx = Math.max(mx, v); }); });
    rp.book.final.players.forEach(function (p, pi) { g.strokeStyle = FACTIONS[p.faction].palette.secondary; g.lineWidth = 2; g.setLineDash(pi === 0 ? [] : pi === 1 ? [6, 3] : [2, 3]); g.beginPath(); sc.forEach(function (row, k) { var x = 6 + (W - 12) * k / Math.max(1, sc.length - 1), y = Hh - 6 - (row[pi] / mx) * (Hh - 12); if (k) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); });
    g.setLineDash([]); var k = rp.book.turns.indexOf(rp.turn), x = 6 + (W - 12) * k / Math.max(1, sc.length - 1); g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, Hh); g.stroke();
  }
  function closeChronicle() {
    var rp = app.replay; if (!rp) return; clearInterval(rp.playing); app.replay = null; $('chronicle').hidden = true;
    if (rp.legacy || !app.cfg) { toTitle(); return; }
    $('hud').hidden = false; R.prevRevealed = null; R.setState(app.state, app.viewer); updateHud();
    if (app.state.over) $('victory').hidden = false; else if (!isHuman(app.state.current)) runAI();
  }
  $('chron-turn').oninput = function () { var t = +$('chron-turn').value, ts = app.replay.book.turns; while (ts.indexOf(t) < 0 && t > ts[0]) t--; showTurn(t); };
  $('chron-prev').onclick = function () { var ts = app.replay.book.turns, i = ts.indexOf(app.replay.turn); if (i > 0) showTurn(ts[i - 1]); };
  $('chron-next').onclick = function () { var ts = app.replay.book.turns, i = ts.indexOf(app.replay.turn); if (i < ts.length - 1) showTurn(ts[i + 1]); };
  $('chron-play').onclick = function () { var rp = app.replay; if (rp.playing) { clearInterval(rp.playing); rp.playing = null; $('chron-play').textContent = '▶'; return; } $('chron-play').textContent = '❚❚'; rp.playing = setInterval(function () { var ts = rp.book.turns, i = ts.indexOf(rp.turn); if (i >= ts.length - 1) { clearInterval(rp.playing); rp.playing = null; $('chron-play').textContent = '▶'; return; } showTurn(ts[i + 1]); }, +$('chron-speed').value * 1000); };
  $('chron-viewer').onchange = function () { app.replay.viewer = +$('chron-viewer').value; R.prevRevealed = null; showTurn(app.replay.turn); };
  $('chron-close').onclick = closeChronicle;
  $('chron-export').onclick = function () { var rp = app.replay; download('pantheon-wars-chronicle-seed' + rp.book.final.seed + '.json', 'application/json', JSON.stringify(C.summary(rp.E, rp.book, rp.rec), null, 1)); };
  $('chron-tapestry').onclick = function () { openTapestry(app.replay.book, app.replay.E, app.replay.rec); };
  function openTapestry(book, Ex, rec) {
    Ex = Ex || E;
    if (!book) { rec = currentRecord('chronicle'); book = C.reconstruct(E, rec); if (book.error) { toast(book.error, true); return; } }
    var c = $('tap-canvas'), t0 = performance.now(), facts;
    function frame(now) { var k = R.reduced ? 1 : Math.min(1, (now - t0) / 2400); facts = C.renderTapestry(c, Ex, book, A, { progress: k }); if (k < 1 && !$('tapestry').hidden) requestAnimationFrame(frame); }
    $('tapestry').hidden = false; trapFocus($('tapestry')); requestAnimationFrame(frame);
    facts = C.renderTapestry(c, Ex, book, A, { progress: R.reduced ? 1 : 0.01 });
    $('tap-facts').textContent = 'Woven from ' + book.turns.length + ' verified turns. Moments shown: ' + C.decisiveEvents(book, 7).map(function (l) { return 'T' + l.t + ' ' + l.k; }).join(', ') + '.';
    $('tap-png').onclick = function () { C.renderTapestry(c, Ex, book, A, { progress: 1 }); try { c.toBlob(function (b) { if (b) download('pantheon-wars-tapestry-seed' + book.final.seed + '.png', 'image/png', b); else toast('Could not encode the image.', true); }, 'image/png'); } catch (e) { toast('Could not export the image: ' + e.message, true); } };
    $('tap-json').onclick = function () { download('pantheon-wars-tapestry-seed' + book.final.seed + '.json', 'application/json', JSON.stringify(C.summary(Ex, book, rec || currentRecord('chronicle')), null, 1)); };
  }
  app.openTapestry = openTapestry;

  /* ------------------------------------------------------------ saves, export, import (P023/P024) */
  function autosave(force) { if (!store || params.get('nosave') === '1' || !app.state || app.replay) return; var r = store.write('auto', currentRecord('save')); if (r.error && force) toast('Autosave failed: ' + r.error, true); app.lastAutosave = r; }
  function openSaves(mode) {
    var b = $('saves-body'), h = '';
    if (!store) { b.innerHTML = '<p class="bad">Browser storage is not available here (private window or blocked site data). You can still export and import game files.</p>' + (app.state && !app.title ? '<button class="ghost" id="sv-export">Export game file</button>' : ''); bindSaves(); openModal('saves'); return; }
    store.slots().forEach(function (slot) {
      var sm = store.summary(slot);
      h += '<div class="row save"><span><b>' + (slot === 'auto' ? 'Autosave' : 'Slot ' + slot.slice(4)) + '</b> ' + (sm.empty ? '<span class="tb-small">empty</span>' : sm.error ? '<span class="bad">' + esc(sm.error) + '</span>' : '<span class="tb-small">' + esc(sm.players.map(function (p) { return (FACTIONS[p.faction] || {}).shortName || p.faction; }).join(' vs ')) + ' · turn ' + sm.turn + (sm.over ? ' (finished)' : '') + ' · ' + esc(new Date(sm.created).toLocaleString()) + (sm.warning ? ' · ' + esc(sm.warning) : '') + '</span>') + '</span><span>';
      if (app.state && !app.title && !app.state.over && slot !== 'auto') h += '<button class="ghost small" data-save="' + slot + '">Save here</button> ';
      if (sm.slot) h += '<button class="ghost small" data-load="' + slot + '">Load</button> <button class="ghost small" data-del="' + slot + '">Delete</button>';
      h += '</span></div>';
    });
    if (app.state && !app.title) h += '<p><button class="ghost" id="sv-export">Export this game</button> <button class="ghost" id="sv-challenge">Export as challenge</button></p>';
    b.innerHTML = h; bindSaves(); openModal('saves');
  }
  function bindSaves() {
    var b = $('saves-body');
    b.querySelectorAll('[data-save]').forEach(function (x) { x.onclick = function () { var r = store.write(x.dataset.save, currentRecord('save')); if (r.conflict) confirmBox('Overwrite this slot?', 'Another tab saved here after this game was opened.', function () { var r2 = store.write(x.dataset.save, currentRecord('save'), { force: true }); toast(r2.ok ? 'Saved.' : r2.error, !r2.ok); openSaves(); }); else { toast(r.ok ? 'Saved (' + Math.round(r.bytes / 1024) + ' KB).' : r.error, !r.ok); openSaves(); } }; });
    b.querySelectorAll('[data-load]').forEach(function (x) { x.onclick = function () { var r = store.read(x.dataset.load); if (!r.record) { toast(r.error || 'Empty slot.', true); return; } loadRecord(r.record); }; });
    b.querySelectorAll('[data-del]').forEach(function (x) { x.onclick = function () { confirmBox('Delete this save?', 'It cannot be recovered.', function () { store.remove(x.dataset.del); openSaves(); }); }; });
    var ex = $('sv-export'); if (ex) ex.onclick = function () { var rec = currentRecord('save'); download(S.exportName(rec), 'application/json', JSON.stringify(rec)); };
    var ch = $('sv-challenge'); if (ch) ch.onclick = function () { var rec = currentRecord('challenge'); download(S.exportName(rec), 'application/json', JSON.stringify(rec)); toast('Challenge exported. The receiver imports it and continues from this exact turn.'); };
  }
  $('import-file').onchange = function (e) {
    var file = e.target.files && e.target.files[0]; if (!file) return;
    var rd = new FileReader();
    rd.onload = function () { var r = S.parseImport(String(rd.result)); e.target.value = ''; if (r.error) { toast('Import failed: ' + r.error, true); return; } if (r.legacy) openLegacy(r.record); else loadRecord(r.record); };
    rd.onerror = function () { toast('The file could not be read.', true); };
    rd.readAsText(file);
  };
  function loadRecord(rec) {
    var r = S.restore(E, rec);
    if (r.error && !r.state) { toast('Cannot load: ' + r.error, true); return; }
    if (r.error) { confirmBox('This save no longer matches the rules', r.error + '. Load the re-simulated game anyway? (It will differ from the original.)', function () { beginFromState(r.state, rec); }); return; }
    beginFromState(r.state, rec);
  }
  function beginFromState(state, rec) {
    $('saves').hidden = true; $('victory').hidden = true; $('menu').hidden = true;
    var cfg = rec.cfg; app.cfg = { seed: cfg.seed, players: cfg.players, mode: cfg.mode };
    app.humans = cfg.players.map(function (p, i) { return p.human ? i : -1; }).filter(function (i) { return i >= 0; }); if (!app.humans.length) app.humans = [0];
    app.turnHashes = rec.turnHashes || {}; app.viewer = isHuman(state.current) ? state.current : app.humans[0];
    enterGame(state);
    toast('Resumed at turn ' + state.turn + '.');
    if (state.over) { setTimeout(showVictory, 200); return; }
    if (!isHuman(state.current)) runAI(); else if (app.humans.length > 1) { app.viewer = -1; checkHandoff(); }
  }
  function openLegacy(rec) {
    function go() {
      if (!window.PWEngineV01 || !window.PW_LEGACY_DATA) { toast('The v0.1 legacy player could not be loaded.', true); return; }
      var L = PWEngineV01.create(window.PW_LEGACY_DATA), res = S.restoreLegacy(L, rec);
      if (res.error) { toast('Legacy replay: ' + res.error, true); return; }
      toast('v0.1 replay verified (hash ' + L.hash(res.state) + '). Opening it read-only in the Chronicle.');
      $('saves').hidden = true;
      openChronicle({ seed: rec.seed, players: rec.players, actions: rec.actions, cfg: { seed: rec.seed, players: rec.players } }, L);
    }
    if (window.PWEngineV01) return go();
    var a = document.createElement('script'); a.src = 'data/legacy-data.js'; a.onload = function () { var b = document.createElement('script'); b.src = 'engine/legacy/engine-v0.1.js'; b.onload = go; b.onerror = function () { toast('Missing engine/legacy/engine-v0.1.js', true); }; document.body.appendChild(b); }; a.onerror = function () { toast('Missing data/legacy-data.js', true); }; document.body.appendChild(a);
  }

  /* ------------------------------------------------------------ tutorial (P022): optional, skippable, driven by real actions */
  var TUT = [
    { title: 'Read the omens', text: 'Press {power1} or the eye on the power bar, then choose a glowing hex at the edge of the fog. Omens lift the cloud so you can find towns.', done: function (s) { return s.actions.some(function (x) { return x.p === app.viewer && (x.a.type === 'omen' || (x.a.type === 'power' && POWERS[x.a.power].x === 'explore')); }); } },
    { title: 'Gather people', text: 'Select your home town and ordain a priest ({power4}), or raise a shrine ({power3}) where you have followers. Shrines convert the town they stand in; priests carry your word to other towns.', done: function (s) { return s.actions.some(function (x) { return x.p === app.viewer && (x.a.type === 'priest' || x.a.type === 'shrine' || (x.a.type === 'power' && POWERS[x.a.power].x === 'expand')); }); } },
    { title: 'Send a priest', text: 'Click the town where your priest stands, click it again (or press Send in the panel), then click a nearby town. Priests walk at the end of the round.', done: function (s) { return s.actions.some(function (x) { return x.p === app.viewer && x.a.type === 'movePriest'; }); } },
    { title: 'End the turn', text: 'Press End Turn ({endTurn}). When every god has acted, the round resolves: priests walk, shrines and priests convert mortals, Faith arrives.', done: function (s) { return s.turn >= 2; } },
    { title: 'Read a conversion', text: 'Select a town. "Pressure" is how many mortals turn to a god each round; followers past half the town make it kneel to you. Trust, hunger and fear change pressure — hover the rows to see why. You can always open the encyclopedia (❦).', done: null }
  ];
  function tutorialStart() { app.tutorial = { step: 0 }; $('tutorial').hidden = false; tutorialShow(); }
  function tutorialShow() {
    var t = app.tutorial; if (!t) return; var st = TUT[t.step];
    $('tut-step').textContent = (t.step + 1) + ' of ' + TUT.length; $('tut-title').textContent = st.title;
    $('tut-text').textContent = st.text.replace(/\{(\w+)\}/g, function (m, k) { return keyLabel(k); });
    $('tut-next').hidden = !!st.done; say('Tutorial: ' + st.title + '. ' + $('tut-text').textContent);
  }
  function tutorialTick() { var t = app.tutorial; if (!t || !app.state) return; var st = TUT[t.step]; if (st.done && st.done(app.state)) { t.step++; if (t.step >= TUT.length) tutorialEnd(); else tutorialShow(); } }
  function tutorialEnd() { app.tutorial = null; $('tutorial').hidden = true; settings.tutorialDone = true; saveSettings(); }
  $('tut-skip').onclick = tutorialEnd; $('tut-next').onclick = function () { app.tutorial.step++; if (app.tutorial.step >= TUT.length) tutorialEnd(); else tutorialShow(); };

  /* ------------------------------------------------------------ title: ten-pantheon gallery and rival composer (A001) */
  var choice = { faction: params.get('faction') || 'greek', rivals: 1, rivalPick: ['random', 'random'], diff: params.get('diff') || 'hard', mode: 'standard', scenario: (D.scenarios || [])[0] ? D.scenarios[0].id : null, humans: +(params.get('hotseat') || 1), compare: [], comparing: false };
  (function parseRivals() { var r = params.get('rivals'); if (!r) return; if (/^\d$/.test(r)) choice.rivals = +r; else { var ids = r.split(',').filter(function (x) { return FACTIONS[x]; }); if (ids.length) { choice.rivals = Math.min(2, ids.length); choice.rivalPick = [ids[0], ids[1] || 'random']; } } })();
  (function parseMode() { var m = params.get('mode'); if (!m) return; if (m.indexOf('scenario:') === 0 && SCEN[m.slice(9)]) { choice.mode = 'scenario'; choice.scenario = m.slice(9); } else if (['standard', 'sacredSites', 'covenants'].indexOf(m) >= 0) choice.mode = m; })();
  if (!FACTIONS[choice.faction]) choice.faction = 'greek';
  function seedValue() { return parseInt($('seed').value, 10) || 1; }
  function seededPick(list, salt) { var r = PWRng.make(seedValue() + ':' + salt); return list[PWRng.int(r, list.length)]; }
  function resolveRivals(fac) {
    var pool = D.factions.map(function (f) { return f.id; }).filter(function (id) { return id !== fac; }), out = [];
    for (var i = 0; i < choice.rivals; i++) {
      var pick = choice.rivalPick[i];
      if (pick === 'random' || out.indexOf(pick) >= 0 || pick === fac) { var left = pool.filter(function (id) { return out.indexOf(id) < 0 && choice.rivalPick.indexOf(id) < 0; }); if (!left.length) left = pool.filter(function (id) { return out.indexOf(id) < 0; }); pick = seededPick(left, 'rival' + i); }
      out.push(pick);
    }
    return out;
  }
  function buildTitle() {
    var wrap = $('faction-cards'), q = ($('faction-search').value || '').trim().toLowerCase(); wrap.innerHTML = '';
    var scen = choice.mode === 'scenario' ? SCEN[choice.scenario] : null;
    if (scen) choice.faction = scen.players[0].faction;
    D.factions.forEach(function (f, idx) {
      var hay = (f.name + ' ' + f.tradition + ' ' + f.blurb + ' ' + f.domains.map(function (d) { return DOMAINS[d].name + ' ' + DOMAINS[d].inspiredBy; }).join(' ')).toLowerCase();
      if (q && hay.indexOf(q) < 0) return;
      var on = f.id === choice.faction, cmp = choice.compare.indexOf(f.id) >= 0;
      var b = document.createElement('button'); b.className = 'fcard' + (on ? ' on' : '') + (cmp ? ' cmp' : ''); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.dataset.faction = f.id; b.disabled = !!scen && !on;
      b.setAttribute('aria-label', f.name + ', ' + f.tradition + '. ' + f.blurb);
      var head = document.createElement('div'); head.className = 'fh'; head.appendChild(canvasCopy(A.emblem(f.emblem, f.palette, 64), 48, 48));
      var tt = document.createElement('div'); tt.innerHTML = '<div class="trad">' + esc(f.tradition) + '</div><h3>' + esc(f.name) + '</h3>'; head.appendChild(tt); b.appendChild(head);
      var p = document.createElement('p'); p.textContent = f.blurb; b.appendChild(p);
      var ul = document.createElement('ul'); f.domains.forEach(function (d) { var li = document.createElement('li'); li.textContent = DOMAINS[d].name; ul.appendChild(li); }); b.appendChild(ul);
      var sw = document.createElement('div'); sw.className = 'swatch'; sw.style.background = f.palette.secondary; sw.appendChild(canvasCopy(A.pattern(f.pattern, A.shade(f.palette.secondary, 0.45), 2), 24, 24)); b.appendChild(sw);
      b.style.borderTopColor = f.palette.secondary;
      b.onclick = function () {
        if (choice.comparing) { var i2 = choice.compare.indexOf(f.id); if (i2 >= 0) choice.compare.splice(i2, 1); else { choice.compare.push(f.id); if (choice.compare.length > 2) choice.compare.shift(); } buildTitle(); return; }
        choice.faction = f.id; choice.rivalPick = choice.rivalPick.map(function (r) { return r === f.id ? 'random' : r; }); buildTitle(); audio.cue('click'); say(f.name + ' chosen. ' + f.blurb);
      };
      b.onkeydown = function (e) { var cards = Array.prototype.slice.call(wrap.querySelectorAll('.fcard')), i3 = cards.indexOf(b), cols = Math.max(1, Math.round(wrap.clientWidth / Math.max(1, b.offsetWidth))); var nx = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key]; if (nx) { e.preventDefault(); var c2 = cards[Math.max(0, Math.min(cards.length - 1, i3 + nx))]; c2.focus(); } };
      wrap.appendChild(b);
    });
    renderDetail(); renderCompare(); renderRivalSlots();
    document.querySelectorAll('[data-rivals]').forEach(function (b) { var on = +b.dataset.rivals === choice.rivals; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); b.disabled = !!scen; b.onclick = function () { choice.rivals = +b.dataset.rivals; if (choice.humans > choice.rivals + 1) choice.humans = choice.rivals + 1; buildTitle(); }; });
    document.querySelectorAll('[data-diff]').forEach(function (b) { var on = b.dataset.diff === choice.diff; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); b.onclick = function () { choice.diff = b.dataset.diff; buildTitle(); }; });
    document.querySelectorAll('[data-humans]').forEach(function (b) { var n = +b.dataset.humans, on = n === choice.humans; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); b.disabled = !!scen || n > choice.rivals + 1; b.onclick = function () { choice.humans = n; buildTitle(); }; });
    document.querySelectorAll('[data-mode]').forEach(function (b) { var on = b.dataset.mode === choice.mode; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); b.onclick = function () { choice.mode = b.dataset.mode; if (choice.mode === 'scenario') { choice.humans = 1; } buildTitle(); }; });
    var ss = $('scenario-select'); ss.hidden = choice.mode !== 'scenario';
    if (!ss.options.length) (D.scenarios || []).forEach(function (s) { var o = document.createElement('option'); o.value = s.id; o.textContent = s.name + ' — ' + s.kind; ss.appendChild(o); });
    ss.value = choice.scenario; ss.onchange = function () { choice.scenario = ss.value; buildTitle(); };
    if (scen) { $('seed').value = String(scen.seed); choice.rivals = scen.players.length - 1; choice.rivalPick = scen.players.slice(1).map(function (p) { return p.faction; }).concat(['random']); }
    $('opt-tutorial').checked = app.tutorialWanted !== undefined ? app.tutorialWanted : (!settings.tutorialDone || params.get('tutorial') === '1');
    renderContinue();
  }
  function renderDetail() {
    var f = FACTIONS[choice.faction], el = $('faction-detail'), scen = choice.mode === 'scenario' ? SCEN[choice.scenario] : null;
    var h = scen ? '<div class="scen"><b>' + esc(scen.name) + '</b> <span class="tb-small">' + esc(scen.kind) + ' · ' + scen.turns + ' turns · ' + scen.players.map(function (p) { return FACTIONS[p.faction].shortName; }).join(' vs ') + '</span><p>' + esc(scen.text) + '</p><p class="tb-small">' + esc(scen.hint) + ' ' + esc(scen.fiction) + '</p></div>' : '';
    h += '<div class="fd-head"><h3>' + esc(f.name) + '</h3><span class="tb-small">' + esc(f.tradition) + ' · ' + esc(f.deityTitle) + '</span> <button class="ghost small" id="fd-codex">Sources and more</button></div>';
    h += '<div class="fd-grid">' + f.powers.map(function (id) { var p = POWERS[id]; return '<div class="fd-power x-' + p.x + '" data-icon="' + p.icon + '"><b>' + esc(p.name) + '</b> <span class="tb-small">' + p.x + ' · ' + costStr(p.cost) + '</span><div class="tb-small">' + esc(p.text) + '</div></div>'; }).join('') + '</div>';
    if (f.representation) h += '<p class="tb-small rep">' + esc(f.representation) + '</p>';
    el.innerHTML = h;
    el.querySelectorAll('.fd-power').forEach(function (d) { d.insertBefore(canvasCopy(A.icon(d.dataset.icon, 48), 32, 32), d.firstChild); });
    var sh = D.shrines.find(function (x) { return x.id === f.shrine; }), fig = document.createElement('div'); fig.className = 'fd-shrine';
    fig.appendChild(canvasCopy(A.up(A.shrineArt(sh.art, f.palette, 'healthy', null), 88), 66, 75, sh.name)); ['emissary', 'seer', 'warden'].forEach(function (r) { fig.appendChild(canvasCopy(A.up(A.priestSprite(f.priestStyle, r, f.palette, 0), 42), 28, 40, r)); });
    el.querySelector('.fd-head').appendChild(fig);
    $('fd-codex').onclick = function () { openCodex({ faction: f.id }); };
  }
  function renderCompare() {
    var el = $('compare'); el.hidden = !choice.comparing || choice.compare.length < 2; if (el.hidden) return;
    el.innerHTML = '<div class="cmp-grid">' + choice.compare.map(function (id) { var f = FACTIONS[id]; return '<div><h3 style="color:' + f.palette.accent + '">' + esc(f.name) + '</h3><div class="tb-small">' + esc(f.tradition) + '</div><ul>' + f.domains.map(function (d) { return '<li><b>' + esc(DOMAINS[d].name) + '</b>: ' + esc(DOMAINS[d].text) + '</li>'; }).join('') + '</ul><ul>' + f.powers.map(function (p) { return '<li><b>' + esc(POWERS[p].name) + '</b> (' + POWERS[p].x + '): ' + esc(POWERS[p].text) + '</li>'; }).join('') + '</ul></div>'; }).join('') + '</div>';
  }
  function renderRivalSlots() {
    var el = $('rival-slots'), scen = choice.mode === 'scenario'; el.innerHTML = '';
    for (var i = 0; i < choice.rivals; i++) {
      var sel = document.createElement('select'); sel.setAttribute('aria-label', 'Rival ' + (i + 1)); sel.dataset.slot = i; sel.disabled = scen;
      var o = document.createElement('option'); o.value = 'random'; o.textContent = 'Random (from seed)'; sel.appendChild(o);
      D.factions.forEach(function (f) { if (f.id === choice.faction) return; var other = choice.rivalPick[1 - i]; var op = document.createElement('option'); op.value = f.id; op.textContent = f.name; op.disabled = other === f.id && choice.rivals > 1; sel.appendChild(op); });
      sel.value = choice.rivalPick[i] && choice.rivalPick[i] !== choice.faction ? choice.rivalPick[i] : 'random';
      sel.onchange = function () { choice.rivalPick[+this.dataset.slot] = this.value; renderRivalSlots(); };
      var lab = document.createElement('label'); lab.className = 'tb-small'; lab.textContent = (i + 1 < choice.humans ? 'Human ' : 'Rival ') + (i + 1) + ' '; lab.appendChild(sel); el.appendChild(lab);
    }
    var resolved = resolveRivals(choice.faction); el.appendChild(Object.assign(document.createElement('div'), { className: 'tb-small', textContent: 'This seed: you (' + FACTIONS[choice.faction].shortName + ') vs ' + resolved.map(function (r) { return FACTIONS[r].shortName; }).join(' and ') }));
  }
  function renderContinue() {
    var el = $('continue-row'); el.innerHTML = '';
    if (!store) return; var sm = store.summary('auto'); if (!sm.slot || sm.over) return;
    var b = document.createElement('button'); b.className = 'primary small'; b.textContent = 'Continue: ' + sm.players.map(function (p) { return (FACTIONS[p.faction] || {}).shortName || p.faction; }).join(' vs ') + ', turn ' + sm.turn;
    b.onclick = function () { var r = store.read('auto'); if (r.record) loadRecord(r.record); else toast(r.error, true); }; el.appendChild(b);
  }
  $('faction-search').oninput = buildTitle;
  $('faction-random').onclick = function () { choice.faction = seededPick(D.factions.map(function (f) { return f.id; }), 'faction'); buildTitle(); say(FACTIONS[choice.faction].name + ' chosen by the seed.'); };
  $('faction-compare').onclick = function () { choice.comparing = !choice.comparing; $('faction-compare').setAttribute('aria-pressed', choice.comparing); $('faction-compare').classList.toggle('on', choice.comparing); if (!choice.comparing) choice.compare = []; buildTitle(); if (choice.comparing) toast('Pick two pantheons to compare.'); };
  $('seed-rand').onclick = function () { $('seed').value = String(1 + Math.floor(Math.random() * 99999)); demoWorld(); renderRivalSlots(); };
  $('seed').onchange = function () { demoWorld(); renderRivalSlots(); };
  $('opt-tutorial').onchange = function () { app.tutorialWanted = $('opt-tutorial').checked; };
  function demoWorld() {
    var seed = seedValue(), fac = choice.faction, riv = resolveRivals(fac), st;
    try { st = E.newGame({ seed: seed, players: [{ faction: fac }].concat(riv.map(function (r) { return { faction: r }; })) }); } catch (e) { return; }
    st.players[0].revealed = st.players[0].revealed.map(function () { return 1; });
    app.demo = st; R.setMap(st); R.setState(st, 0); R.cam.tz = 1.6; R.cam.z = 1.6;
    R.cam.tx = R.cam.x = R.WW * 0.42; R.cam.ty = R.cam.y = R.WH * 0.55; R.clampCam();
  }
  function buildConfig() {
    var seed = seedValue();
    if (choice.mode === 'scenario') { var sc = SCEN[choice.scenario]; return { seed: sc.seed, players: sc.players.map(function (p, i) { return { faction: p.faction, human: i === 0, ai: i === 0 ? undefined : (p.ai || choice.diff) }; }), mode: { kind: 'scenario', scenario: sc.id } }; }
    var riv = resolveRivals(choice.faction), players = [{ faction: choice.faction, human: true }];
    riv.forEach(function (r, i) { var human = i + 1 < choice.humans; players.push(human ? { faction: r, human: true } : { faction: r, ai: choice.diff }); });
    var mode = choice.mode === 'standard' ? { kind: 'standard' } : { kind: 'alt', victory: choice.mode };
    return { seed: seed, players: players, mode: mode };
  }
  function startGame(cfg) {
    clearTimeout(app.aiTimer);
    var state; try { state = E.newGame(cfg); } catch (e) { toast('Cannot start: ' + e.message, true); return; }
    app.cfg = cfg; app.humans = cfg.players.map(function (p, i) { return p.human ? i : -1; }).filter(function (i) { return i >= 0; }); if (!app.humans.length) app.humans = [0];
    app.viewer = app.humans[0]; app.turnHashes = {};
    enterGame(state);
    banner('Turn 1'); audio.cue('turn');
    var wantTut = app.tutorialWanted !== undefined ? app.tutorialWanted : $('opt-tutorial').checked;
    if (wantTut && cfg.mode.kind !== 'scenario') tutorialStart();
    if (!isHuman(state.current)) runAI();
    autosave();
  }
  function enterGame(state) {
    app.busy = false; app.selTile = null; app.selPriest = null; app.mode = null; app.demo = null; app.replay = null; app.handoff = false; R.blackout = false; app.lastSummaryTurn = state.turn;
    app.state = state; app.turnHashes[state.turn] = app.turnHashes[state.turn] || E.hash(state);
    $('log').innerHTML = ''; ['victory', 'title', 'handoff', 'chronicle'].forEach(function (id) { $(id).hidden = true; }); $('hud').hidden = false; app.title = false;
    paintEmblem(); $('powerbar').innerHTML = ''; $('powerbar').dataset.faction = '';
    R.setMap(state); R.fog = null; R.fogKey = null; R.oldFog = null; R.prevRevealed = null; R.setState(state, app.viewer);
    rebuildLog(); updateHud();
    var home = state.settlements[me().home]; R.cam.tz = R.cam.z = innerWidth < 760 ? 1.45 : 2.1; R.focusTile(home.tile, true); select(home.tile);
    audio.setAge(state.age); audio.startMusic(me().faction);
    if (me().pendingEvent && state.current === app.viewer) showEvent();
  }
  $('begin').onclick = function () { audio.unlock(); startGame(buildConfig()); };
  $('title-load').onclick = function () { openSaves(); };
  $('title-codex').onclick = function () { openCodex({}); };
  $('title-settings').onclick = function () { openSettings(); };

  /* ------------------------------------------------------------ modals, focus, confirm */
  var lastFocus = null;
  function trapFocus(m) { m.onkeydown = function (e) { if (e.key !== 'Tab') return; var f = Array.prototype.filter.call(m.querySelectorAll('button, [href], input, select, summary, [tabindex]:not([tabindex="-1"])'), function (x) { return !x.disabled && x.offsetParent !== null; }); if (!f.length) return; var first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }; }
  function openModal(id) { lastFocus = document.activeElement; var m = $(id); m.hidden = false; trapFocus(m); var b = m.querySelector('button:not([disabled]), input, select'); if (b) b.focus(); }
  function closeModal(m) { m.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  function anyModal() { return ['event', 'help', 'menu', 'settings', 'codex', 'envoys', 'saves', 'confirm', 'tapestry', 'handoff'].some(function (id) { return !$(id).hidden; }); }
  document.querySelectorAll('[data-close]').forEach(function (b) { b.onclick = function () { closeModal(b.closest('.modal')); }; });
  function confirmBox(title, text, yes) { $('confirm-title').textContent = title; $('confirm-text').textContent = text; openModal('confirm'); $('confirm-yes').onclick = function () { $('confirm').hidden = true; yes(); }; $('confirm-no').onclick = function () { closeModal($('confirm')); }; }
  function openCodex(opts) { var b = $('codex-body'); b.innerHTML = ''; b.appendChild(PWEncyclopedia.build(D, opts || {})); openModal('codex'); }
  $('btn-help').onclick = function () { $('help-keys').innerHTML = ['power1', 'power9', 'endTurn', 'cancel', 'log', 'codex', 'envoy', 'layers', 'menu'].map(function (k) { return '<kbd>' + esc(keyLabel(k)) + '</kbd> ' + esc(KEY_LABELS[k].replace(/ \(.*\)/, '')); }).join(' · '); openModal('help'); };
  $('help-codex').onclick = function () { $('help').hidden = true; openCodex({ tab: 'rules' }); };
  $('help-tutorial').onclick = function () { settings.tutorialDone = false; saveSettings(); app.tutorialWanted = true; toast('The tutorial will run at the start of your next game.'); };
  $('btn-menu').onclick = function () { openModal('menu'); };
  $('btn-codex').onclick = function () { openCodex({ faction: me().faction }); };
  $('btn-envoy').onclick = openEnvoys;
  $('btn-log').onclick = function () { var lp = $('logpanel'); lp.hidden = !lp.hidden; if (!lp.hidden) { var ol = $('log'); ol.scrollTop = ol.scrollHeight; } };
  $('btn-layers').onclick = function () { $('layerbar').hidden = !$('layerbar').hidden; };
  app.layers = { influence: false };
  function computeInfluence() {
    if (!app.state || !$('layer-influence').checked) { R.influence = null; return; }
    var s = app.state, v = app.viewer, red = redacted(s, v), rev = s.players[v].revealed, fall = RU.conversion.falloff;
    R.influence = s.settlements.filter(function (x) { return rev[x.tile]; }).map(function (x) {
      var rx = red.settlements[x.id], vals = s.players.map(function (p) { return { p: p.id, v: H.pressureAt(red, rx, p.id) }; }), src = [];
      red.settlements.forEach(function (o) { if (!o.shrine || o.shrine.eclipsed || o === rx) return; var d = H.dist(red, o.tile, x.tile), rad = H.shrineRadius(red, o); if (d <= rad && d > 0) src.push({ from: o.tile, p: o.shrine.owner, v: fall[Math.min(d, fall.length - 1)] * H.shrinePressure(red, o) }); });
      return { tile: x.tile, values: $('layer-numbers').checked ? vals : vals.map(function (q) { return { p: q.p, v: q.v }; }), sources: src };
    });
  }
  $('layer-influence').onchange = function () { app.layers.influence = this.checked; computeInfluence(); say(this.checked ? 'Influence layer on. ' + (R.influence || []).filter(function (d) { return d.values.some(function (q) { return q.v > 0; }); }).map(function (d) { return tileName(d.tile) + ': ' + d.values.filter(function (q) { return q.v > 0; }).map(function (q) { return shortName(q.p) + ' ' + q.v.toFixed(1); }).join(', '); }).join('; ') : 'Influence layer off.'); };
  $('layer-routes').onchange = function () { R.showRoutes = this.checked; };
  $('layer-numbers').onchange = computeInfluence;
  $('menu-new').onclick = function () { $('menu').hidden = true; confirmBox('Leave this game?', 'It is autosaved; you can continue it from the title screen.', function () { autosave(true); toTitle(); }); };
  $('menu-save').onclick = function () { $('menu').hidden = true; openSaves(); };
  $('menu-load').onclick = function () { $('menu').hidden = true; openSaves(); };
  $('menu-export').onclick = function () { var rec = currentRecord('save'); download(S.exportName(rec), 'application/json', JSON.stringify(rec)); };
  $('menu-chronicle').onclick = function () { $('menu').hidden = true; openChronicle(); };
  $('menu-settings').onclick = function () { $('menu').hidden = true; openSettings(); };
  $('menu-codex').onclick = function () { $('menu').hidden = true; openCodex({}); };
  $('vic-new').onclick = toTitle;
  $('vic-replay').onclick = function () { startGame(app.cfg); };
  $('vic-chronicle').onclick = function () { $('victory').hidden = true; openChronicle(); };
  $('vic-tapestry').onclick = function () { openTapestry(); };
  $('vic-export').onclick = function () { var rec = currentRecord('chronicle'); download(S.exportName(rec), 'application/json', JSON.stringify(rec)); };
  $('target-cancel').onclick = function () { cancelMode(); deselectPriest(); };
  $('endturn').onclick = endTurn;
  function toTitle() { clearTimeout(app.aiTimer); audio.stopMusic(); tutorialEnd(); app.replay = null; ['victory', 'hud', 'chronicle', 'handoff'].forEach(function (id) { $(id).hidden = true; }); $('title').hidden = false; app.title = true; app.state = null; R.blackout = false; buildTitle(); demoWorld(); }

  /* ------------------------------------------------------------ settings modal */
  function seg(id, attr, val, fn) { document.querySelectorAll('#' + id + ' [data-' + attr + ']').forEach(function (b) { b.classList.toggle('on', b.dataset[attr] === val); b.onclick = function () { fn(b.dataset[attr]); openSettings(true); }; }); }
  function openSettings(refresh) {
    seg('quality-seg', 'q', settings.quality, function (v) { settings.quality = v; if (v === 'auto') { R.autoQuality = true; R.setQuality('high'); } else { R.autoQuality = false; R.setQuality(v); } saveSettings(); });
    seg('motion-seg', 'motion', settings.motion, function (v) { settings.motion = v; saveSettings(); applyVisualSettings(); });
    seg('flash-seg', 'flash', settings.flash, function (v) { settings.flash = v; saveSettings(); applyVisualSettings(); });
    $('set-patterns').checked = settings.patterns; $('set-patterns').onchange = function () { settings.patterns = this.checked; saveSettings(); applyVisualSettings(); };
    $('set-contrast').checked = settings.contrast; $('set-contrast').onchange = function () { settings.contrast = this.checked; saveSettings(); applyVisualSettings(); document.documentElement.classList.toggle('hc', this.checked); };
    $('set-sr').checked = settings.sr; $('set-sr').onchange = function () { settings.sr = this.checked; saveSettings(); };
    $('set-previews').checked = settings.previews; $('set-previews').onchange = function () { settings.previews = this.checked; saveSettings(); };
    ['master', 'music', 'sfx', 'ambience'].forEach(function (k) { var r = $('vol-' + k); r.value = Math.round(settings.audio[k] * 100); r.oninput = function () { settings.audio[k] = +r.value / 100; audio.unlock(); audio.set(k, settings.audio[k]); saveSettings(); if (k === 'sfx') audio.cue('click'); }; });
    $('vol-mute').checked = settings.audio.mute; $('vol-mute').onchange = function () { settings.audio.mute = this.checked; audio.set('mute', this.checked); saveSettings(); };
    $('audio-status').textContent = !audio.supported() ? 'Sound is not available in this browser; every cue also appears on screen.' : audio.ready ? 'Sound is on (original, generated as you play).' : 'Sound starts after your first click or key press.';
    var km = $('keymap'); km.innerHTML = '';
    Object.keys(DEFAULT_KEYS).forEach(function (k) {
      var row = document.createElement('div'); row.className = 'row'; row.innerHTML = '<span>' + esc(KEY_LABELS[k]) + '</span>';
      var b = document.createElement('button'); b.className = 'ghost small'; b.textContent = keyLabel(k); b.setAttribute('aria-label', 'Change key for ' + KEY_LABELS[k] + ', now ' + keyLabel(k));
      b.onclick = function () { b.textContent = 'press a key…'; app.rebinding = function (key) { if (key === 'Tab') return false; var clash = Object.keys(settings.keys).find(function (o) { return o !== k && settings.keys[o].toLowerCase() === key.toLowerCase(); }); if (clash) settings.keys[clash] = settings.keys[k]; settings.keys[k] = key; saveSettings(); app.rebinding = null; openSettings(true); updatePowerbar(); return true; }; };
      row.appendChild(b); km.appendChild(row);
    });
    $('keys-reset').onclick = function () { settings.keys = Object.assign({}, DEFAULT_KEYS); saveSettings(); openSettings(true); updatePowerbar(); };
    if (!refresh) openModal('settings');
  }

  /* ------------------------------------------------------------ input: pointer (mouse + touch + pen) */
  var pointers = {}, drag = null, pinch = null;
  function cpos(e) { var r = canvas.getBoundingClientRect(), d = R.dpr || 1; return { x: (e.clientX - r.left) * d, y: (e.clientY - r.top) * d }; }
  window.addEventListener('pointerdown', function () { audio.unlock(); }, { capture: true });
  window.addEventListener('keydown', function () { audio.unlock(); }, { capture: true });
  canvas.addEventListener('pointerdown', function (e) {
    canvas.setPointerCapture(e.pointerId); pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pointers);
    if (ids.length === 1) drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, button: e.button, type: e.pointerType };
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
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > (drag.type === 'touch' ? 10 : 6)) { drag.moved = true; canvas.classList.add('dragging'); }
      if (drag.moved) { var dp2 = R.dpr || 1; R.panBy(dx * dp2, dy * dp2); }
      drag.x = e.clientX; drag.y = e.clientY;
    }
    if (e.pointerType === 'mouse' && !drag && app.state && !app.title) { var p = cpos(e), t = R.pick(p.x, p.y); if (t !== R.hover) { R.hover = t; updatePath(t); updateTargetPreview(t); } }
  });
  function endPointer(e) {
    var wasDrag = drag; delete pointers[e.pointerId];
    if (Object.keys(pointers).length < 2) pinch = null;
    if (wasDrag && !wasDrag.moved && e.type === 'pointerup') {
      if (app.title || !app.state) return;
      var p = cpos(e), t = R.pick(p.x, p.y);
      if (wasDrag.button === 2) { cancelMode(); deselectPriest(); } else { if (app.mode && wasDrag.type !== 'mouse') updateTargetPreview(t); onTileClick(t); }
    }
    drag = null; canvas.classList.remove('dragging');
  }
  canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('wheel', function (e) { e.preventDefault(); var p = cpos(e); R.zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y); }, { passive: false });
  function updatePath(t) {
    if (app.selPriest === null || t < 0 || !app.state) { R.path = null; return; }
    var pr = app.state.priests.find(function (p) { return p.id === app.selPriest; }); if (!pr) return;
    R.path = H.pathStep(app.state, app.viewer, pr.tile, t) || null;
  }
  $('minimap').addEventListener('pointerdown', function (e) {
    if (!app.state || app.handoff) return; var c = $('minimap'), r = c.getBoundingClientRect();
    var w = R.minimapToWorld(c, (e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height);
    R.cam.tx = w.x; R.cam.ty = w.y + 30; R.clampCam();
  });
  window.addEventListener('resize', function () { R.resize(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) autosave(); });

  /* ------------------------------------------------------------ input: keyboard (remappable) */
  function keyIs(e, action) { var k = settings.keys[action]; if (!k) return false; return e.key === k || e.key.toLowerCase() === k.toLowerCase() || (k === '+' && e.key === '=') || (k === '-' && e.key === '_'); }
  window.addEventListener('keydown', function (e) {
    if (app.rebinding) { e.preventDefault(); app.rebinding(e.key); return; }
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) { if (e.key === 'Escape') e.target.blur(); return; }
    if (app.replay) { if (e.key === 'Escape') { closeChronicle(); e.preventDefault(); } else if (e.key === 'ArrowLeft') $('chron-prev').click(); else if (e.key === 'ArrowRight') $('chron-next').click(); else if (e.key === ' ') { $('chron-play').click(); e.preventDefault(); } return; }
    if (keyIs(e, 'cancel')) {
      var open = ['confirm', 'codex', 'settings', 'envoys', 'saves', 'help', 'menu', 'tapestry'].find(function (id) { return !$(id).hidden; });
      if (open) closeModal($(open));
      else if (app.mode || app.selPriest !== null) { cancelMode(); deselectPriest(); }
      else if (app.state && !app.title) { R.selected = -1; app.selTile = null; renderPanel(); }
      return;
    }
    if (anyModal() || app.title || !app.state) return;
    var step = 60 * (R.dpr || 1);
    for (var i = 1; i <= 9; i++) if (keyIs(e, 'power' + i)) { var it = barItems()[i - 1]; if (it) { if (app.mode && app.mode.item.id === it.id) cancelMode(); else arm(it); } e.preventDefault(); return; }
    if (keyIs(e, 'endTurn')) { if (e.target === document.body || e.target === canvas || e.target === $('endturn')) { endTurn(); e.preventDefault(); } return; }
    if (keyIs(e, 'panLeft') || e.key === 'ArrowLeft') R.panBy(step, 0); else if (keyIs(e, 'panRight') || e.key === 'ArrowRight') R.panBy(-step, 0);
    else if (keyIs(e, 'panUp') || e.key === 'ArrowUp') R.panBy(0, step); else if (keyIs(e, 'panDown') || e.key === 'ArrowDown') R.panBy(0, -step);
    else if (keyIs(e, 'zoomIn')) R.zoomAt(1.15, canvas.width / 2, canvas.height / 2); else if (keyIs(e, 'zoomOut')) R.zoomAt(1 / 1.15, canvas.width / 2, canvas.height / 2);
    else if (keyIs(e, 'log')) $('btn-log').click(); else if (keyIs(e, 'help') || e.key === '?') $('btn-help').click();
    else if (keyIs(e, 'menu')) $('btn-menu').click(); else if (keyIs(e, 'codex')) $('btn-codex').click(); else if (keyIs(e, 'envoy')) openEnvoys();
    else if (keyIs(e, 'layers')) { $('layer-influence').checked = !$('layer-influence').checked; $('layer-influence').onchange(); }
    else if (keyIs(e, 'home')) { R.focusTile(app.state.settlements[me().home].tile); }
    else return;
    e.preventDefault();
  });

  /* ------------------------------------------------------------ main loop */
  var last = performance.now(), demoT = 0;
  function frame(now) {
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (app.title && app.demo && !R.reduced) { demoT += dt; R.cam.tx += dt * 6; if (R.cam.tx > R.WW * 0.62) R.cam.tx = R.WW * 0.38; R.cam.ty = R.WH * 0.55 + Math.sin(demoT * 0.2) * 20; R.clampCam(); }
    R.render(dt);
    if (app.state && !app.title && (now | 0) % 6 === 0) R.drawMinimap($('minimap'));
    requestAnimationFrame(frame);
  }
  window.addEventListener('error', function (e) { if (window.PW) (window.PW.errors = window.PW.errors || []).push(String(e.message)); });

  /* ------------------------------------------------------------ test / automation hook (no game logic here) */
  window.PW = {
    E: E, AI: AI, app: app, S: S, C: C, get state() { return app.state; }, hash: function () { return app.state ? E.hash(app.state) : null; },
    start: startGame, buildConfig: buildConfig, endTurn: endTurn, act: function (a) { return act(a, true); }, errors: [], choice: choice, barItems: function () { return barItems().map(function (b, i) { return { key: keyLabel('power' + (i + 1)), id: b.id, target: b.target }; }); },
    tileScreen: function (id) { var tp = R.top(app.state.map.tiles[id]), p = R.project(tp.x, tp.y), d = R.dpr || 1, r = canvas.getBoundingClientRect(); return { x: r.left + p.x / d, y: r.top + p.y / d }; },
    focus: function (id) { R.focusTile(id, true); R.cam.z = R.cam.tz; }, settle: function () { R.cam.x = R.cam.tx; R.cam.y = R.cam.ty; R.cam.z = R.cam.tz; },
    suggest: function () { return app.state && app.state.current === app.viewer ? AI.nextAction(E, app.state) : null; },
    busy: function () { return app.busy; }, renderer: R, audio: audio, settings: settings, record: function () { return currentRecord('save'); }, loadRecord: loadRecord, openChronicle: openChronicle, openTapestry: openTapestry,
    openSettings: openSettings, openCodex: openCodex, openEnvoys: openEnvoys, openSaves: openSaves, select: select
  };

  buildTitle();
  if (params.get('seed')) $('seed').value = params.get('seed');
  if (params.get('autostart') === '1') { app.tutorialWanted = params.get('tutorial') === '1'; startGame(buildConfig()); }
  else demoWorld();
  requestAnimationFrame(frame);
})();
