#!/usr/bin/env node
/*
 * Browser journeys J01–J11 (Playwright + the pre-installed Chromium, file:// launch, no server).
 * Each journey drives the real page; game actions go through the same validated engine path as clicks.
 * Writes reports/journeys.json and screenshots to reports/screens/.  Usage: node tools/journeys.js [--only J03,J04]
 */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), URL0 = 'file://' + path.join(ROOT, 'index.html');
const SHOTS = path.join(ROOT, 'reports', 'screens'); fs.mkdirSync(SHOTS, { recursive: true });
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const results = [];

async function newPage(browser, vp, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: vp || { width: 1440, height: 900 }, acceptDownloads: true }, opts || {}));
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return { ctx, page, errors };
}
const q = s => new URLSearchParams(Object.assign({ speed: '0', follow: '0' }, s)).toString();
async function waitIdle(page, ms) { await page.waitForFunction(() => window.PW && PW.state && (PW.state.over || (!PW.busy() && PW.state.current === PW.app.viewer && !PW.app.handoff)), null, { timeout: ms || 60000 }); }
/* play the human seat with the Hierophant's own suggestion (validated by the engine like any click) until the game ends or turn limit */
async function playHuman(page, untilTurn) {
  for (let guard = 0; guard < 4000; guard++) {
    await waitIdle(page, 120000);
    const st = await page.evaluate(lim => {
      const s = PW.state; if (!s.over && s.players[PW.app.viewer].pendingEvent) { const a = PW.suggest(); if (a && a.type === 'event') { PW.act(a); document.getElementById('event').hidden = true; return { acted: 'event' }; } }
      if (s.over || s.turn >= lim) return { done: true, over: s.over, turn: s.turn };
      const a = PW.suggest(); if (!a || a.type === 'endTurn') { PW.endTurn(); return { ended: true }; }
      if (!PW.act(a)) PW.endTurn(); return { acted: a.type };
    }, untilTurn || 999);
    if (st.done) return st;
  }
  throw new Error('playHuman guard exceeded');
}
async function journey(id, title, fn, browser) {
  if (only.length && only.indexOf(id) < 0) return;
  const t0 = Date.now(), rec = { id, title, ok: false, evidence: {} };
  try { await fn(rec.evidence); rec.ok = true; } catch (e) { rec.error = String(e && e.stack || e).split('\n').slice(0, 4).join(' | '); }
  rec.ms = Date.now() - t0; results.push(rec);
  console.log((rec.ok ? 'PASS ' : 'FAIL ') + id + ' ' + title + ' (' + rec.ms + ' ms)' + (rec.error ? '\n   ' + rec.error : ''));
}
function assert(c, m) { if (!c) throw new Error('assertion failed: ' + m); }

(async () => {
  const browser = await chromium.launch();

  await journey('J01', 'Title gallery: ten pantheons, search, compare, each pantheon starts', async ev => {
    const { page, errors } = await newPage(browser);
    await page.goto(URL0 + '?seed=7'); await page.waitForTimeout(500);
    ev.cards = await page.locator('.fcard').count(); assert(ev.cards === 10, 'ten cards');
    await page.fill('#faction-search', 'rice'); ev.searchRice = await page.locator('.fcard').count(); await page.fill('#faction-search', '');
    await page.click('#faction-compare'); await page.click('.fcard[data-faction="norse"]'); await page.click('.fcard[data-faction="vedic"]');
    ev.compareVisible = await page.isVisible('#compare'); assert(ev.compareVisible, 'compare panel');
    await page.click('#faction-compare');
    await page.click('.fcard[data-faction="hittite"]'); ev.chosen = await page.evaluate(() => PW.choice.faction); assert(ev.chosen === 'hittite', 'pick by click');
    await page.screenshot({ path: path.join(SHOTS, 'J01-title-1440.png') });
    ev.started = [];
    for (const id of await page.evaluate(() => PW_DATA.factions.map(f => f.id))) {
      await page.goto(URL0 + '?' + q({ seed: 7, autostart: 1, nosave: 1, faction: id })); await waitIdle(page);
      const r = await page.evaluate(() => ({ f: PW.state.players[0].faction, bar: PW.barItems().length, errs: PW.errors.length }));
      assert(r.f === id && r.bar === 9, 'start ' + id); ev.started.push(id);
    }
    ev.errors = errors; assert(!errors.length, 'no console errors: ' + errors.join('; '));
  }, browser);

  await journey('J02', 'Real input: key arms a rite, click a highlighted hex, Enter ends the turn', async ev => {
    const { page, errors } = await newPage(browser);
    await page.goto(URL0 + '?' + q({ seed: 11, autostart: 1, nosave: 1, faction: 'irish' })); await waitIdle(page);
    await page.keyboard.press('1');
    const tgt = await page.evaluate(() => { const t = PW.app.mode && PW.app.mode.targets; if (!t || !t.length) return null; const home = PW.state.settlements[PW.state.players[0].home].tile; t.sort((a, b) => PW.E.helpers.dist(PW.state, a, home) - PW.E.helpers.dist(PW.state, b, home)); PW.focus(t[0]); PW.settle(); return t[0]; });
    assert(tgt !== null, 'omen targets'); await page.waitForTimeout(150);
    const pt = await page.evaluate(t => PW.tileScreen(t), tgt);
    const before = await page.evaluate(() => PW.state.players[0].revealed.filter(Boolean).length);
    await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(100);
    const after = await page.evaluate(() => PW.state.players[0].revealed.filter(Boolean).length);
    ev.revealedGain = after - before; assert(after > before, 'omen by click revealed hexes');
    await page.screenshot({ path: path.join(SHOTS, 'J02-after-omen.png') });
    await page.locator('#world').focus().catch(() => {}); await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    await page.keyboard.press('Enter'); await waitIdle(page);
    ev.turn = await page.evaluate(() => PW.state.turn); assert(ev.turn === 2, 'Enter ended turn');
    assert(!errors.length, errors.join('; '));
  }, browser);

  let savedRecord = null, finalHash = null;
  await journey('J03', 'Full game to a result screen against two Hierophants (Mexica)', async ev => {
    const { page, errors } = await newPage(browser);
    await page.goto(URL0 + '?' + q({ seed: 23, autostart: 1, nosave: 1, faction: 'mexica', rivals: 'norse,yoruba', diff: 'hard' })); await waitIdle(page);
    const r = await playHuman(page);
    await page.waitForSelector('#victory:not([hidden])', { timeout: 10000 });
    ev.result = await page.evaluate(() => ({ turn: PW.state.turn, winner: PW.state.winner.type, pid: PW.state.winner.pid, hash: PW.hash(), actions: PW.state.actions.length, title: document.getElementById('vic-title').textContent }));
    finalHash = ev.result.hash; savedRecord = await page.evaluate(() => PW.record());
    await page.screenshot({ path: path.join(SHOTS, 'J03-victory.png') });
    assert(r.over, 'game over'); assert(!errors.length, errors.join('; '));
  }, browser);

  await journey('J04', 'Save to slot, reload the page, continue from autosave; hashes match', async ev => {
    const { page, errors } = await newPage(browser);
    await page.goto(URL0 + '?' + q({ seed: 5, autostart: 1, faction: 'japanese' })); await waitIdle(page);
    await playHuman(page, 6);
    ev.hashBefore = await page.evaluate(() => PW.hash()); ev.turnBefore = await page.evaluate(() => PW.state.turn);
    await page.click('#btn-menu'); await page.click('#menu-save'); await page.click('[data-save="slot1"]');
    await page.waitForTimeout(100);
    await page.goto(URL0 + '?speed=0&follow=0'); await page.waitForTimeout(400);
    const cont = await page.locator('#continue-row button').count(); assert(cont === 1, 'continue button present');
    ev.continueLabel = await page.locator('#continue-row button').textContent();
    await page.click('#continue-row button'); await waitIdle(page);
    ev.hashAfter = await page.evaluate(() => PW.hash()); assert(ev.hashAfter === ev.hashBefore, 'autosave hash matches');
    await page.click('#btn-menu'); await page.click('#menu-load'); await page.click('[data-load="slot1"]'); await waitIdle(page);
    ev.slotHash = await page.evaluate(() => PW.hash()); assert(ev.slotHash === ev.hashBefore, 'slot hash matches');
    await playHuman(page, ev.turnBefore + 2); ev.continuedTo = await page.evaluate(() => PW.state.turn);
    assert(!errors.length, errors.join('; '));
  }, browser);

  await journey('J05', 'Export a finished game file, import it in a fresh page, same final hash', async ev => {
    assert(savedRecord, 'J03 record'); const file = path.join(SHOTS, '..', 'journey-export.json'); fs.writeFileSync(file, JSON.stringify(savedRecord));
    const { page, errors } = await newPage(browser);
    await page.goto(URL0 + '?speed=0&nosave=1'); await page.waitForTimeout(300);
    await page.click('#title-load'); await page.setInputFiles('#import-file', file);
    await page.waitForSelector('#victory:not([hidden])', { timeout: 15000 });
    ev.hash = await page.evaluate(() => PW.hash()); assert(ev.hash === finalHash, 'imported hash ' + ev.hash + ' vs ' + finalHash);
    fs.unlinkSync(file); assert(!errors.length, errors.join('; '));
  }, browser);

  await journey('J06', 'Chronicle replay scrubs verified turns; tapestry renders; PNG and JSON download', async ev => {
    assert(savedRecord, 'J03 record');
    const { page, errors } = await newPage(browser);
    await page.goto(URL0 + '?speed=0&nosave=1'); await page.waitForTimeout(300);
    await page.evaluate(r => PW.loadRecord(r), savedRecord); await page.waitForSelector('#victory:not([hidden])');
    await page.click('#vic-chronicle'); await page.waitForSelector('#chronicle:not([hidden])');
    ev.turns = await page.evaluate(() => PW.app.replay.book.turns.length); ev.mismatches = await page.evaluate(() => PW.app.replay.book.mismatches.length);
    assert(ev.mismatches === 0, 'no hash mismatches');
    await page.click('#chron-next'); await page.click('#chron-next'); ev.at = await page.evaluate(() => PW.app.replay.turn);
    await page.screenshot({ path: path.join(SHOTS, 'J06-chronicle.png') });
    await page.click('#chron-tapestry'); await page.waitForTimeout(2800);
    await page.screenshot({ path: path.join(SHOTS, 'J06-tapestry.png') });
    const [png] = await Promise.all([page.waitForEvent('download'), page.click('#tap-png')]);
    const pp = path.join(ROOT, 'reports', 'sample-tapestry.png'); await png.saveAs(pp); ev.pngBytes = fs.statSync(pp).size;
    const [js] = await Promise.all([page.waitForEvent('download'), page.click('#tap-json')]);
    const jp = path.join(ROOT, 'reports', 'sample-chronicle.json'); await js.saveAs(jp); const j = JSON.parse(fs.readFileSync(jp, 'utf8')); ev.jsonKeys = Object.keys(j);
    assert(fs.readFileSync(pp).slice(1, 4).toString() === 'PNG', 'png signature');
    assert(!errors.length, errors.join('; '));
  }, browser);

  await journey('J07', 'Hot-seat: handoff screen hides the previous god, next human sees only their world', async ev => {
    const { page, errors } = await newPage(browser);
    await page.goto(URL0 + '?' + q({ seed: 9, autostart: 1, nosave: 1, faction: 'greek', rivals: 'egyptian', hotseat: 2 })); await page.waitForTimeout(400);
    ev.p1 = await page.evaluate(() => PW.app.viewer);
    await page.evaluate(() => PW.endTurn()); await page.waitForSelector('#handoff:not([hidden])');
    ev.blackout = await page.evaluate(() => PW.renderer.blackout); ev.panelEmpty = await page.evaluate(() => document.getElementById('panel').innerHTML === '');
    await page.screenshot({ path: path.join(SHOTS, 'J07-handoff.png') });
    assert(ev.blackout && ev.panelEmpty, 'hidden during handoff');
    await page.click('#handoff-go'); ev.p2 = await page.evaluate(() => PW.app.viewer);
    ev.p2Faction = await page.evaluate(() => PW.state.players[PW.app.viewer].faction);
    assert(ev.p2 === 1 && ev.p2Faction === 'egyptian', 'seat passed');
    assert(!errors.length, errors.join('; '));
  }, browser);

  await journey('J08', 'Phone 390x844: title and game fit, no horizontal scroll, touch targets at least 44 px', async ev => {
    const { page, errors } = await newPage(browser, { width: 390, height: 844 }, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await page.goto(URL0 + '?seed=3'); await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, 'J08-title-390.png') });
    ev.titleOverflow = await page.evaluate(() => document.getElementById('title').scrollWidth - document.getElementById('title').clientWidth);
    await page.goto(URL0 + '?' + q({ seed: 3, autostart: 1, nosave: 1, faction: 'yoruba' })); await waitIdle(page);
    await page.screenshot({ path: path.join(SHOTS, 'J08-game-390.png') });
    ev.small = await page.evaluate(() => Array.from(document.querySelectorAll('#hud button')).filter(b => b.offsetParent && !b.closest('#panel') && !b.closest('#tb-alerts')).map(b => { const r = b.getBoundingClientRect(); return { id: b.id || b.className, w: Math.round(r.width), h: Math.round(r.height) }; }).filter(r => r.w < 44 || r.h < 44));
    ev.docOverflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    const t = await page.evaluate(() => { const s = PW.state, h = s.settlements[s.players[0].home].tile; PW.focus(h); PW.settle(); return PW.tileScreen(h); });
    await page.touchscreen.tap(t.x, t.y); ev.tapSelected = await page.evaluate(() => PW.app.selTile !== null);
    assert(ev.titleOverflow <= 0 && ev.docOverflow <= 0, 'no horizontal overflow'); assert(!ev.small.length, 'small targets: ' + JSON.stringify(ev.small));
    assert(!errors.length, errors.join('; '));
  }, browser);

  await journey('J09', 'Settings: reduced motion, remapped key and volume persist across reload; encyclopedia and envoys open', async ev => {
    const { page, errors } = await newPage(browser);
    await page.goto(URL0 + '?' + q({ seed: 4, autostart: 1, nosave: 1, faction: 'hittite' })); await waitIdle(page);
    await page.click('#btn-menu'); await page.click('#menu-settings');
    await page.click('#motion-seg [data-motion="reduced"]');
    await page.locator('#keymap button').first().click(); await page.keyboard.press('q');
    await page.fill('#vol-music', '20'); await page.dispatchEvent('#vol-music', 'input');
    await page.keyboard.press('Escape');
    await page.reload(); await waitIdle(page);
    ev.persisted = await page.evaluate(() => ({ motion: PW.settings.motion, key: PW.settings.keys.power1, music: PW.settings.audio.music, reduced: PW.renderer.reduced }));
    assert(ev.persisted.motion === 'reduced' && ev.persisted.key === 'q' && ev.persisted.reduced, 'persisted');
    await page.keyboard.press('q'); ev.armedByQ = await page.evaluate(() => !!PW.app.mode); await page.keyboard.press('Escape');
    await page.click('#btn-codex'); ev.codexSections = await page.locator('.enc-faction').count(); await page.screenshot({ path: path.join(SHOTS, 'J09-codex.png') }); await page.keyboard.press('Escape');
    await page.click('#btn-envoy'); ev.envoyOpen = await page.isVisible('#envoys'); await page.keyboard.press('Escape');
    await page.evaluate(() => localStorage.clear());
    assert(ev.armedByQ && ev.codexSections === 10 && ev.envoyOpen, 'codex/envoys/key');
    assert(!errors.length, errors.join('; '));
  }, browser);

  await journey('J10', 'A v0.1 replay file imports into the read-only legacy Chronicle at its recorded hash', async ev => {
    const fx = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'v0.1-e2e-seed11.json'), 'utf8'));
    const file = path.join(ROOT, 'reports', 'journey-legacy.json'); fs.writeFileSync(file, JSON.stringify({ seed: fx.seed, players: fx.players, actions: fx.actions, hash: fx.hash }));
    const { page, errors } = await newPage(browser);
    await page.goto(URL0 + '?speed=0&nosave=1'); await page.waitForTimeout(300);
    await page.click('#title-load'); await page.setInputFiles('#import-file', file);
    await page.waitForSelector('#chronicle:not([hidden])', { timeout: 20000 });
    ev.legacyHash = await page.evaluate(() => PW.app.replay.E.hash(PW.app.replay.book.final)); ev.expected = fx.hash;
    ev.turns = await page.evaluate(() => PW.app.replay.book.turns.length);
    await page.screenshot({ path: path.join(SHOTS, 'J10-legacy-chronicle.png') });
    fs.unlinkSync(file);
    assert(ev.legacyHash === fx.hash, 'legacy hash'); assert(!errors.length, errors.join('; '));
  }, browser);


  await journey('J11', 'Audio lifecycle: silent until a gesture, ten motifs render, one context across games, hidden tab suspends, mute persists', async ev => {
    const { ctx, page, errors } = await newPage(browser);
    await ctx.addInitScript(() => { const C = window.AudioContext; if (!C) return; window.__pwAudioContexts = 0; window.AudioContext = function (o) { window.__pwAudioContexts++; return new C(o); }; window.AudioContext.prototype = C.prototype; });
    await page.goto(URL0 + '?' + q({ seed: 6, nosave: 1 })); await page.waitForTimeout(300);
    ev.beforeGesture = await page.evaluate(() => ({ ready: PW.audio.ready, ctx: !!PW.audio.ctx, contexts: window.__pwAudioContexts }));
    assert(!ev.beforeGesture.ready && !ev.beforeGesture.ctx && ev.beforeGesture.contexts === 0, 'no audio before a user gesture');
    await page.click('.fcard[data-faction="yoruba"]');
    ev.afterGesture = await page.evaluate(() => ({ ready: PW.audio.ready, state: PW.audio.ctx && PW.audio.ctx.state }));
    assert(ev.afterGesture.ready, 'audio unlocked by the gesture');
    // every pantheon's motif and a set of cues render a non-silent signal through the real bus graph (objective check; not a listening test)
    ev.render = await page.evaluate(async () => {
      const out = {}, ids = PW_DATA.factions.map(f => f.id);
      out.motifKeys = ids.filter(id => PWAudio.MOTIFS[id]).length;
      for (const id of ids) {
        const oc = new OfflineAudioContext(1, 44100 * 4, 44100), a = new PWAudio({ master: 1, music: 1, sfx: 1, ambience: 0, mute: false });
        a.ctx = oc; a.master = oc.createGain(); a.master.connect(oc.destination); a.music = oc.createGain(); a.music.connect(a.master); a.sfxBus = oc.createGain(); a.sfxBus.connect(a.master); a.amb = oc.createGain(); a.amb.connect(a.master); a.ready = true; a.faction = id;
        a.motif(id, a.music, 0.05, 0); ['shrine', 'explore', 'exterminate', 'eclipse'].forEach((k, i) => a.cue(k, { faction: id }));
        const d = (await oc.startRendering()).getChannelData(0); a.ctx = null; let sq = 0, peak = 0; for (let i = 0; i < d.length; i++) { sq += d[i] * d[i]; peak = Math.max(peak, Math.abs(d[i])); }
        out[id] = { rms: +Math.sqrt(sq / d.length).toFixed(4), peak: +peak.toFixed(3) };
      }
      return out;
    });
    assert(ev.render.motifKeys === 10, 'ten motifs');
    Object.keys(ev.render).filter(k => k !== 'motifKeys').forEach(id => assert(ev.render[id].rms > 0.001 && ev.render[id].peak <= 1.0, id + ' renders a non-silent, unclipped signal'));
    // several games in a row reuse one context
    for (let i = 0; i < 4; i++) { await page.evaluate(i => { PW.choice.faction = PW_DATA.factions[i].id; PW.start(PW.buildConfig()); }, i); await page.waitForTimeout(150); }
    ev.contextsAfterGames = await page.evaluate(() => window.__pwAudioContexts); assert(ev.contextsAfterGames === 1, 'one AudioContext across games');
    // hiding the tab suspends audio; showing it resumes
    const vis = async hidden => page.evaluate(async h => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); await new Promise(r => setTimeout(r, 200)); return PW.audio.ctx.state; }, hidden);
    ev.hiddenState = await vis(true); ev.visibleState = await vis(false);
    assert(ev.hiddenState === 'suspended' && ev.visibleState === 'running', 'visibility suspends and resumes');
    // mute persists across reload and keeps the context suspended
    await page.evaluate(() => { PW.openSettings(); }); await page.click('#vol-mute'); await page.keyboard.press('Escape');
    await page.reload(); await page.waitForTimeout(300); await page.click('.fcard[data-faction="norse"]');
    ev.muteAfterReload = await page.evaluate(() => ({ mute: PW.settings.audio.mute, state: PW.audio.ctx && PW.audio.ctx.state }));
    assert(ev.muteAfterReload.mute === true && ev.muteAfterReload.state !== 'running', 'mute persisted');
    await page.evaluate(() => localStorage.clear());
    assert(!errors.length, errors.join('; '));
  }, browser);

  await browser.close();
  const out = { generated: new Date().toISOString(), browser: 'Chromium (Playwright, pre-installed)', launch: 'file:// index.html', results };
  if (!only.length) fs.writeFileSync(path.join(ROOT, 'reports', 'journeys.json'), JSON.stringify(out, null, 1));
  const fails = results.filter(r => !r.ok).length; console.log(results.length - fails + '/' + results.length + ' journeys passed'); process.exit(fails ? 1 : 0);
})();
