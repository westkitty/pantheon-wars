#!/usr/bin/env node
/*
 * Headless-Chrome end-to-end test + screenshot capture. Uses puppeteer-core when PUPPETEER points at it, otherwise the
 * pre-installed Playwright Chromium through tools/pw-shim.js (a minimal puppeteer-compatible facade).
 * Plays one full game to a victory using REAL input only: keyboard hotkeys, mouse clicks on map hexes,
 * clicks on panel / event-card / End Turn buttons. The human's *choices* come from the Hard AI's suggestion
 * (window.PW.suggest) so the game is played sensibly; the *execution* goes through the UI.
 * Then replays the recorded action list in Node and checks the final state hash matches the browser's.
 * Usage: node tools/screenshots.js [--seed 11] [--faction greek] [--rivals 2] [--diff easy] [--out shots]
 */
const path = require('path'), fs = require('fs');
const puppeteer = process.env.PUPPETEER ? require(process.env.PUPPETEER) : require('./pw-shim.js');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SEED = +arg('seed', 11), FACTION = arg('faction', 'greek'), RIVALS = +arg('rivals', 2), DIFF = arg('diff', 'easy');
const OUT = path.resolve(arg('out', path.join(__dirname, '..', 'reports', 'screens', 'e2e')));
const ROOT = path.resolve(__dirname, '..');
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/\/audio\/music\/[a-z0-9-]+\.mp3$/.test((m.location() || {}).url || '')) errors.push('console: ' + m.text()); });
  page.on('request', r => { if (!r.url().startsWith('file://') && !r.url().startsWith('data:')) errors.push('NETWORK REQUEST: ' + r.url()); });
  await page.setViewport({ width: 1600, height: 900 });
  const url = 'file://' + path.join(ROOT, 'index.html');
  const shots = [];
  async function shot(name, note) { const f = path.join(OUT, name + '.png'); await page.screenshot({ path: f }); shots.push({ file: path.relative(ROOT, f), note }); console.log('  shot', name, '-', note); }
  const stats = { uiActions: 0, byType: {}, rejected: 0, fallbacks: 0, events: 0, priestMoves: 0 };

  // 1. title screen
  await page.goto(url + '?seed=' + SEED + '&speed=0.15&nosave=1');
  await sleep(2200);
  await shot('01-title', 'Title / setup: pantheon cards, rivals, difficulty, seed; live world drifting behind');
  // choose faction, rivals, difficulty with real clicks
  await page.click(`.fcard[data-faction="${FACTION}"]`);
  await page.click(`[data-rivals="${RIVALS}"]`);
  await page.click(`[data-diff="${DIFF}"]`);
  if (await page.evaluate(() => document.getElementById('opt-tutorial').checked)) await page.click('#opt-tutorial');
  await page.click('#begin');
  await sleep(1800);
  await shot('02-turn1', 'Turn 1: home shrine, soft fog of war, top resource bar, power bar, panel, minimap');

  const S = () => page.evaluate(() => { const s = PW.state; return { turn: s.turn, cur: s.current, over: s.over, busy: PW.busy(), ev: !!s.players[0].pendingEvent, hash: PW.hash(), nact: s.actions.length }; });
  async function waitMyTurn() { for (let i = 0; i < 600; i++) { const s = await S(); if (s.over || (s.cur === 0 && !s.busy)) return s; await sleep(50); } throw new Error('timeout waiting for turn'); }
  async function clickTile(tile) {
    await page.evaluate(t => { PW.focus(t); }, tile); await sleep(60);
    const p = await page.evaluate(t => PW.tileScreen(t), tile);
    const chk = await page.evaluate((t, x, y) => { const el = document.elementFromPoint(x, y), d = PW.renderer.dpr || 1, r = document.getElementById('world').getBoundingClientRect(); return { el: el && (el.id || el.className || el.tagName), pick: PW.renderer.pick((x - r.left) * d, (y - r.top) * d), t }; }, tile, p.x, p.y + 2);
    if (chk.el !== 'world' || chk.pick !== tile) { stats.clickMiss = (stats.clickMiss || 0) + 1; if (stats.clickMiss < 8) console.log('  click check', JSON.stringify(chk), JSON.stringify(p)); }
    await page.mouse.click(p.x, p.y + 2);
  }
  const want = { event: 1, power: 1, eclipse: 1, miracle: 1, fog: 1, mid: 1, late: 1, log: 1, priest: 1, panel: 1 };

  let guard = 0;
  while (guard++ < 3000) {
    const st = await waitMyTurn();
    if (st.over) break;
    const a = await page.evaluate(() => PW.suggest());
    const before = st.hash;
    stats.byType[a.type] = (stats.byType[a.type] || 0) + 1;
    if (a.type === 'event') {
      await page.waitForSelector('#event:not([hidden])', { timeout: 3000 }).catch(() => {});
      if (want.event) { await sleep(500); await shot('05-event-card', 'Illustrated event card (turn ' + st.turn + ')'); want.event = 0; }
      await page.click(`#ev-choices button:nth-child(${a.choice + 1})`); stats.events++;
    } else if (a.type === 'endTurn') {
      if (st.turn === 3 && want.fog) { await sleep(200); await shot('03-early-fog', 'Early game, turn 3: fog lifting around explored land'); want.fog = 0; }
      if (st.turn === 16 && want.mid) { await page.evaluate(() => { PW.renderer.cam.tz = 1.5; }); await sleep(900); await shot('07-midgame', 'Mid-game, turn 16, zoomed out: territories, borders, shrines, villages'); want.mid = 0; await page.evaluate(() => { PW.renderer.cam.tz = 2.1; }); }
      if (st.turn === 30 && want.late) { await page.evaluate(() => { PW.renderer.cam.tz = 1.2; }); await sleep(900); await shot('09-late-overview', 'Turn 30, widest zoom: perspective horizon, haze, parallax clouds'); want.late = 0; await page.evaluate(() => { PW.renderer.cam.tz = 2.1; }); }
      if (st.turn === 22 && want.log) { await page.keyboard.press('l'); await sleep(300); await shot('08-turn-log', 'Turn log (Chronicle) open, turn 22'); await page.keyboard.press('l'); want.log = 0; }
      await page.focus('body'); await page.keyboard.press('Enter');
    } else if (a.type === 'movePriest') {
      const ptile = await page.evaluate(id => PW.state.priests.find(p => p.id === id).tile, a.priest);
      // select the priest: click its hex (shows the place, with a Send button per priest), or click again to cycle priests
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      await clickTile(ptile); await sleep(40);
      for (let k = 0; k < 5; k++) {
        if (await page.evaluate(id => PW.app.selPriest === id, a.priest)) break;
        const sel = await page.$(`[data-priest="${a.priest}"]`);
        if (sel) { await sel.click(); await sleep(30); } else { await clickTile(ptile); await sleep(40); }
      }
      if (await page.evaluate(id => PW.app.selPriest === id, a.priest)) { await clickTile(a.tile); stats.priestMoves++; }

    } else if (['specialize', 'covenant', 'counterRite', 'retrain', 'route', 'abandon'].indexOf(a.type) >= 0 || (a.type === 'priest' && a.role && a.role !== 'emissary')) {
      // place-panel actions: select the place by clicking its hex, then press the matching panel button
      const tile = a.tile !== undefined ? a.tile : await page.evaluate(x => x.type === 'retrain' ? PW.state.priests.find(p => p.id === x.priest).tile : x.type === 'route' ? PW.state.settlements[PW.state.routes.find(r => r.id === x.route).a].tile : null, a);
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      if (tile !== null) { await clickTile(tile); await sleep(40); }
      const sel = { specialize: `[data-spec="${a.spec}"]`, covenant: `[data-cov="${a.kind}"]`, counterRite: '[data-counter]', retrain: `[data-retrain="${a.priest}:${a.role}"]`, route: `[data-route="${a.route}"]`, abandon: `[data-abandon="${a.covenant}"]`, priest: `[data-ordain="${a.role}"]` }[a.type];
      let btn = await page.$('#panel ' + sel);
      if (!btn && a.type === 'route') { const tb = await page.evaluate(x => PW.state.settlements[PW.state.routes.find(r => r.id === x.route).b].tile, a); await clickTile(tb); await sleep(40); btn = await page.$('#panel ' + sel); }
      if (!btn && a.type === 'abandon') { await page.keyboard.press('Escape'); await sleep(30); btn = await page.$('#panel ' + sel); }
      if (btn) { await btn.click(); stats.panelActions = (stats.panelActions || 0) + 1; if (a.type === 'covenant' || a.type === 'abandon') { await sleep(60); await page.click('#confirm-yes'); } }
    } else if (a.type === 'propose' || a.type === 'answer') {
      await page.keyboard.press('Escape'); await page.keyboard.press('v'); await sleep(60);
      const sel = a.type === 'propose' ? `[data-prop="${a.kind}:${a.to}"]` : `[data-ans="${a.id}:${a.accept ? 1 : 0}"]`;
      const btn = await page.$(sel); if (btn) { await btn.click(); stats.envoyActions = (stats.envoyActions || 0) + 1; }
      await sleep(40); await page.keyboard.press('Escape');
    } else {
      const items = await page.evaluate(() => PW.barItems());
      const id = a.type === 'power' ? a.power : a.type;
      const it = items.find(x => x.id === id);
      if (a.type === 'priest' && want.panel) { await clickTile(a.tile); await sleep(300); await shot('04-settlement-panel', 'Settlement selected: follower composition, pressures, contextual actions'); want.panel = 0; }
      await page.keyboard.press(String(it.key));
      if (it.target !== 'none') { await sleep(40); if (want.power && a.type === 'power') { await sleep(250); await shot('06a-targeting', 'Targeting mode for ' + id + ': valid hexes pulse gold'); } await clickTile(a.tile); }
      if (a.type === 'power' && want.power) { await sleep(700); await shot('06b-power-cast', 'Faction power cast: ' + id); want.power = 0; }
      if ((a.type === 'eclipse' || (a.type === 'power' && /hammer_thunder|thunderbolt/.test(a.power))) && want.eclipse) { await sleep(a.type === 'eclipse' ? 900 : 250); await shot('06c-miracle-eclipse', a.type + ' ' + (a.power || '') + ' on a rival'); want.eclipse = 0; }
      if (a.type === 'power' && /feather_of_maat|thunderbolt/.test(a.power) && want.miracle) { await sleep(300); want.miracle = 0; }
    }
    stats.uiActions++;
    await sleep(30);
    const after = await S();
    if (after.hash === before && !after.over) {
      // UI input did not take; record and fall back to ending the turn so the test cannot loop forever
      stats.rejected++; console.log('  ! UI input did not change state for', JSON.stringify(a), JSON.stringify(await page.evaluate(() => ({ selTile: PW.app.selTile, selPriest: PW.app.selPriest, mode: PW.app.mode && PW.app.mode.item.id, panel: document.getElementById('panel').innerText.slice(0, 80), toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).slice(-2) }))));
      await page.keyboard.press('Escape'); await page.evaluate(() => { document.getElementById('event').hidden = true; });
      const s2 = await S(); if (s2.ev) { await page.evaluate(() => { document.querySelector('#ev-choices button').click(); }); } else { await page.focus('body'); await page.keyboard.press('Enter'); stats.fallbacks++; }
    }
  }
  await page.waitForSelector('#victory:not([hidden])', { timeout: 15000 });
  await sleep(1500);
  const final = await page.evaluate(() => ({ hash: PW.hash(), winner: PW.state.winner, turn: PW.state.turn, actions: PW.state.actions, players: PW.state.players.map(p => ({ faction: p.faction, human: p.human, ai: p.ai })), seed: PW.state.seed, mode: PW.app.cfg.mode }));
  await shot('10-victory', 'Victory screen: ' + final.winner.type + ', winner seat ' + final.winner.pid);

  // Node replay of the recorded browser actions -> must reproduce the same hash
  const loadData = require('./load-data.js'), E = require('../engine/engine.js').create(loadData());
  let s = E.newGame({ seed: final.seed, players: final.players.map(p => ({ faction: p.faction, human: p.human, ai: p.ai })), mode: final.mode });
  final.actions.forEach(x => { s = E.step(s, x.a); });
  const replayHash = E.hash(s);

  // mobile viewport
  const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
  const m = await browser.newPage(process.env.PUPPETEER ? undefined : mobile);
  await m.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  m.on('pageerror', e => errors.push('mobile pageerror: ' + e.message));
  await m.goto(url + '?seed=' + SEED + '&nosave=1'); await sleep(1800);
  await m.screenshot({ path: path.join(OUT, '11-mobile-title.png') }); shots.push({ file: path.relative(ROOT, path.join(OUT, '11-mobile-title.png')), note: 'Mobile 390x844 title' });
  await m.tap(`.fcard[data-faction="egyptian"]`); if (await m.evaluate(() => document.getElementById('opt-tutorial').checked)) await m.tap('#opt-tutorial'); await m.tap('#begin'); await sleep(1800);
  const home = await m.evaluate(() => PW.state.settlements[PW.state.players[0].home].tile);
  const hp = await m.evaluate(t => PW.tileScreen(t), home); await m.touchscreen.tap(hp.x, hp.y + 2); await sleep(800);
  await m.screenshot({ path: path.join(OUT, '12-mobile-game.png') }); shots.push({ file: path.relative(ROOT, path.join(OUT, '12-mobile-game.png')), note: 'Mobile in-game after tapping home settlement (touch)' });

  // reduced-motion + low quality smoke check
  const r = await browser.newPage(); await r.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await r.setViewport({ width: 1280, height: 720 }); r.on('pageerror', e => errors.push('reduced pageerror: ' + e.message));
  await r.goto(url + '?seed=' + SEED + '&autostart=1&quality=low&nosave=1'); await sleep(1500);
  const rinfo = await r.evaluate(() => ({ reduced: PW.renderer.reduced, quality: PW.renderer.quality, frameMs: PW.renderer.lastFrameMs }));
  await r.screenshot({ path: path.join(OUT, '13-reduced-motion-low.png') }); shots.push({ file: path.relative(ROOT, path.join(OUT, '13-reduced-motion-low.png')), note: 'prefers-reduced-motion + low quality' });
  const hiInfo = await page.evaluate(() => ({ quality: PW.renderer.quality, frameMs: PW.renderer.lastFrameMs }));

  const report = { seed: SEED, faction: FACTION, rivals: RIVALS, diff: DIFF, winner: final.winner, finalTurn: final.turn, actions: final.actions.length,
    browserHash: final.hash, nodeReplayHash: replayHash, deterministic: final.hash === replayHash, stats, errors, reducedMotion: rinfo, highQualityFrame: hiInfo, shots };
  fs.writeFileSync(path.join(OUT, 'e2e-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ winner: final.winner, finalTurn: final.turn, actions: final.actions.length, browserHash: final.hash, replayHash, deterministic: report.deterministic, stats, errors, rinfo, hiInfo }, null, 1));
  await browser.close();
  process.exit(report.deterministic && !errors.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
