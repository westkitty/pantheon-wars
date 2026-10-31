#!/usr/bin/env node
/*
 * Adversarial QA checks that complement the journeys: hot-seat leaks through live regions and toasts, blocked browser storage,
 * two-finger pinch zoom, Chronicle viewer privacy in an unfinished game, and resizing mid-game (the renderer clips world
 * compositing to the camera view, so a resize must not leave stale regions), age-driven render caches, and the reduced-motion and
 * Low-quality power cues. Writes reports/qqq.json.   node tools/qqq.js
 */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), URL0 = 'file://' + path.join(ROOT, 'index.html');
const results = [];
async function check(id, title, fn, browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const rec = { id, title, ok: false, evidence: {} };
  try { await fn(page, rec.evidence, ctx); if (errors.length) throw new Error('page errors: ' + errors.join('; ')); rec.ok = true; } catch (e) { rec.error = String(e.message || e); }
  results.push(rec); console.log((rec.ok ? 'PASS ' : 'FAIL ') + id + ' ' + title + (rec.error ? '\n   ' + rec.error : '')); await ctx.close();
}
const assert = (c, m) => { if (!c) throw new Error('assertion failed: ' + m); };

(async () => {
  const browser = await chromium.launch();

  await check('Q01', 'Hot-seat handoff leaves no previous-god text in the live region, toasts, alerts or panel', async (page, ev) => {
    await page.goto(URL0 + '?seed=9&autostart=1&nosave=1&speed=0&faction=greek&rivals=egyptian&hotseat=2'); await page.waitForTimeout(400);
    await page.evaluate(() => { PW.act({ type: 'omen', tile: PW.app.mode ? 0 : PW.E.helpers.inRadius(PW.state, PW.state.settlements[PW.state.players[0].home].tile, 4).find(t => !PW.state.players[0].revealed[t]) }); PW.endTurn(); });
    await page.waitForSelector('#handoff:not([hidden])');
    ev.leak = await page.evaluate(() => ({ sr: document.getElementById('sr-live').textContent, toasts: document.getElementById('toasts').textContent, alerts: document.getElementById('tb-alerts').textContent, panel: document.getElementById('panel').textContent, log: document.getElementById('log').textContent }));
    const prevName = 'Olympian';
    Object.keys(ev.leak).forEach(k => assert(ev.leak[k].indexOf(prevName) < 0 && !/Faith \d/.test(ev.leak[k]), 'no previous-god text in #' + k + ': ' + ev.leak[k].slice(0, 80)));
    // the round turns over on the second human's End Turn: their round summary must not be left for the first human (regression)
    await page.click('#handoff-go'); await page.waitForTimeout(100);
    await page.evaluate(() => { if (PW.state.players[1].pendingEvent) PW.act({ type: 'event', choice: 0 }); PW.endTurn(); });
    await page.waitForSelector('#handoff:not([hidden])');
    ev.turnover = await page.evaluate(() => ({ turn: PW.state.turn, sr: document.getElementById('sr-live').textContent }));
    assert(ev.turnover.turn === 2 && ev.turnover.sr === '', 'live region empty at the round-turnover handoff: ' + ev.turnover.sr);
    await page.click('#handoff-go'); await page.waitForTimeout(150);
    ev.seated = await page.evaluate(() => document.getElementById('sr-live').textContent);
    assert(/Olympian Court, turn 2/.test(ev.seated), 'the incoming player hears their own summary: ' + ev.seated);
  }, browser);

  await check('Q02', 'Blocked browser storage (private window): the game starts, plays, saves gracefully and exports', async (page, ev, ctx) => {
    await ctx.addInitScript(() => { const thrower = { get() { throw new Error('SecurityError: storage blocked'); } }; Object.defineProperty(window, 'localStorage', thrower); Object.defineProperty(window, 'sessionStorage', thrower); });
    await page.goto(URL0 + '?seed=4&autostart=1&speed=0'); await page.waitForTimeout(400);
    ev.started = await page.evaluate(() => !!(PW.state && PW.state.turn === 1));
    await page.evaluate(() => PW.endTurn()); await page.waitForFunction(() => PW.state.turn === 2 && !PW.busy());
    await page.evaluate(() => PW.openSaves()); ev.savesText = (await page.textContent('#saves-body')).slice(0, 120);
    assert(ev.started && /not available/.test(ev.savesText), 'graceful storage message');
  }, browser);

  await check('Q03', 'Two-finger pinch on the map zooms the camera', async (page, ev) => {
    await page.goto(URL0 + '?seed=5&autostart=1&nosave=1&speed=0'); await page.waitForTimeout(400);
    ev.before = await page.evaluate(() => PW.renderer.cam.tz);
    await page.evaluate(() => {
      const c = document.getElementById('world'), fire = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, pointerType: 'touch', bubbles: true, isPrimary: id === 1 }));
      c.setPointerCapture = () => {};
      fire('pointerdown', 1, 600, 450); fire('pointerdown', 2, 700, 450);
      for (let k = 1; k <= 10; k++) { fire('pointermove', 1, 600 - k * 12, 450); fire('pointermove', 2, 700 + k * 12, 450); }
      fire('pointerup', 1, 480, 450); fire('pointerup', 2, 820, 450);
    });
    ev.after = await page.evaluate(() => PW.renderer.cam.tz);
    assert(ev.after > ev.before * 1.2, 'pinch-out zoomed in (' + ev.before + ' -> ' + ev.after + ')');
  }, browser);

  await check('Q04', 'Chronicle of an unfinished solo game offers only the player\'s own view', async (page, ev) => {
    await page.goto(URL0 + '?seed=12&autostart=1&nosave=1&speed=0&rivals=2'); await page.waitForTimeout(400);
    for (let i = 0; i < 3; i++) { await page.evaluate(() => PW.endTurn()); await page.waitForFunction(() => !PW.busy() && PW.state.current === 0); }
    await page.evaluate(() => PW.openChronicle()); await page.waitForSelector('#chronicle:not([hidden])');
    ev.viewers = await page.evaluate(() => Array.from(document.querySelectorAll('#chron-viewer option')).map(o => o.textContent));
    assert(ev.viewers.length === 1, 'one viewer while the game is unfinished: ' + ev.viewers.join(', '));
  }, browser);

  await check('Q05', 'Resizing mid-game keeps the projection complete (no unpainted world regions after the clip)', async (page, ev) => {
    await page.goto(URL0 + '?seed=8&autostart=1&nosave=1&speed=0&quality=high'); await page.waitForTimeout(500);
    const sizes = [{ width: 900, height: 700 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]; ev.sizes = [];
    for (const s of sizes) {
      await page.setViewportSize(s); await page.waitForTimeout(250);
      ev.sizes.push(await page.evaluate(() => { const R = PW.renderer; R.cam.x = R.cam.tx; R.cam.y = R.cam.ty; R.cam.z = R.cam.tz; R.render(0); const c = R.canvas, g = c.getContext('2d'), d = g.getImageData(0, Math.floor(c.height * 0.6), c.width, Math.floor(c.height * 0.35)).data;
        let transparent = 0; for (let i = 3; i < d.length; i += 4) if (d[i] < 250) transparent++; return { canvas: [c.width, c.height], view: R.view, transparentPx: transparent }; }));
    }
    ev.sizes.forEach(r => assert(r.transparentPx === 0 && r.view && r.view.w > 0, 'complete frame at ' + r.canvas.join('x')));
  }, browser);

  await check('Q06', 'Age changes regrade the land and switch towns to their Twilight sprites (no stale render caches)', async (page, ev) => {
    await page.goto(URL0 + '?seed=14&autostart=1&nosave=1&speed=0&quality=high&diff=easy'); await page.waitForTimeout(400);
    const step = async until => { for (let g = 0; g < 3000; g++) { await page.waitForFunction(() => !PW.busy() && PW.state.current === PW.app.viewer, null, { timeout: 120000 }); const done = await page.evaluate(l => { if (PW.state.turn >= l) return true; if (PW.state.players[PW.app.viewer].pendingEvent) PW.act({ type: 'event', choice: 0 }); PW.endTurn(); document.getElementById('event').hidden = true; return false; }, until); if (done) break; } };
    ev.dawn = await page.evaluate(() => ({ age: PW.state.age, staticAge: PW.renderer.staticAge }));
    await step(16); ev.zenith = await page.evaluate(() => ({ age: PW.state.age, staticAge: PW.renderer.staticAge }));
    await step(31); await page.waitForTimeout(100);
    ev.twilight = await page.evaluate(() => { const R = PW.renderer, s = PW.state, town = s.settlements.find(x => s.players[PW.app.viewer].revealed[x.tile]); return { age: s.age, staticAge: R.staticAge, night: R.village(s, town).night }; });
    assert(ev.dawn.staticAge === 'dawn' && ev.zenith.staticAge === 'zenith' && ev.twilight.staticAge === 'twilight' && ev.twilight.night === 1, 'caches follow the age: ' + JSON.stringify(ev));
  }, browser);

  await check('Q07', 'Reduced motion and Low quality keep a stable cue for every power without the world-light envelope', async (page, ev) => {
    await page.goto(URL0 + '?seed=2&autostart=1&nosave=1&speed=0&motion=reduced'); await page.waitForTimeout(400);
    ev.reduced = await page.evaluate(() => { const R = PW.renderer, t = PW.state.settlements[PW.state.players[0].home].tile, ids = PW_DATA.powers.map(p => p.vfx), bad = []; ids.forEach(id => { R.fx = []; R.texts = []; R.playVfx(id, t, { label: id }); if (R.fx.some(e => e.k === 'worldlight') || !R.fx.some(e => e.k === 'ring') || !R.texts.length) bad.push(id); }); return bad; });
    await page.goto(URL0 + '?seed=2&autostart=1&nosave=1&speed=0&quality=low&motion=full'); await page.waitForTimeout(400);
    ev.low = await page.evaluate(() => { const R = PW.renderer, t = PW.state.settlements[PW.state.players[0].home].tile, bad = []; PW_DATA.powers.forEach(p => { R.fx = []; R.playVfx(p.vfx, t, {}); if (R.fx.some(e => e.k === 'worldlight') || !R.fx.length) bad.push(p.vfx); }); return bad; });
    assert(!ev.reduced.length && !ev.low.length, 'reduced: ' + ev.reduced.join(',') + ' low: ' + ev.low.join(','));
  }, browser);

  await check('Q08', 'Staggered town rebuilds never leave an obsolete sprite: within a few frames of a state change every town shows its current sprite', async (page, ev) => {
    await page.goto(URL0 + '?seed=14&autostart=1&nosave=1&speed=0&quality=high&diff=easy'); await page.waitForTimeout(400);
    ev.r = await page.evaluate(() => { const R = PW.renderer, E = PW.E, AI = PW.AI; clearTimeout(PW.app.aiTimer); let s = E.clone(PW.state), g = 0; while (s.turn < 31 && g++ < 20000) AI.playTurn(E, s);
      R.cam.tz = 1.2; R.cam.z = 1.2; R.setState(s, 0); const stale = [];
      for (let f = 0; f < 12; f++) R.render(0.016);
      s.settlements.forEach(x => { if (!s.players[0].revealed[x.tile]) return; const cur = R.village(s, x), last = R.vilLast[x.id]; if (last && last !== cur) stale.push(x.id); });
      return { age: s.age, towns: s.settlements.length, stale }; });
    assert(ev.r.age === 'twilight' && !ev.r.stale.length, 'all towns current after 12 frames: ' + JSON.stringify(ev.r));
  }, browser);

  await check('Q09', 'Every one of the forty power effects ends: after a cast and four seconds of frames no effect objects remain', async (page, ev) => {
    await page.goto(URL0 + '?seed=2&autostart=1&nosave=1&speed=0&quality=high'); await page.waitForTimeout(400);
    ev.left = await page.evaluate(() => { const R = PW.renderer, t = PW.state.settlements[PW.state.players[0].home].tile, bad = [];
      PW_DATA.powers.forEach(p => { R.fx = []; R.texts = []; R.playVfx(p.vfx, t, { label: p.name, tiles: [t] }); for (let f = 0; f < 80; f++) R.render(0.05); if (R.fx.length) bad.push(p.vfx + ':' + R.fx.length); });
      return bad; });
    assert(!ev.left.length, 'effects left running: ' + ev.left.join(','));
  }, browser);

  await browser.close();
  fs.writeFileSync(path.join(ROOT, 'reports', 'qqq.json'), JSON.stringify({ generated: new Date().toISOString(), results }, null, 1));
  const fails = results.filter(r => !r.ok).length; console.log((results.length - fails) + '/' + results.length + ' QQQ checks passed'); process.exit(fails ? 1 : 0);
})();
