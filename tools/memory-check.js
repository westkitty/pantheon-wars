#!/usr/bin/env node
/*
 * Resource check: ten games in a row in one page (each played to turn 6 with the Hierophant's suggestions), forced garbage collection
 * between games, then JS heap, renderer cache sizes and canvas count are recorded. Fails if the heap grows by more than 25% from the
 * first game to the last or the number of canvases changes. Writes reports/memory-check.json.   node tools/memory-check.js
 */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1440, height: 900 } }), cdp = await p.context().newCDPSession(p), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html') + '?seed=3&autostart=1&nosave=1&speed=0'); await p.waitForTimeout(500);
  const rows = [];
  for (let i = 0; i < 10; i++) {
    await p.evaluate(async i => {
      PW.choice.faction = PW_DATA.factions[i % 10].id; PW.start(PW.buildConfig());
      for (let k = 0; k < 400 && PW.state.turn < 6; k++) { if (PW.busy()) { await new Promise(r => setTimeout(r, 5)); continue; } const a = PW.suggest(); if (!a || a.type === 'endTurn' || !PW.act(a)) PW.endTurn(); document.getElementById('event').hidden = true; await new Promise(r => setTimeout(r, 0)); }
    }, i);
    await p.waitForTimeout(300); await cdp.send('HeapProfiler.collectGarbage'); await p.waitForTimeout(200);
    rows.push(await p.evaluate(() => { const R = PW.renderer, n = o => o ? Object.keys(o).length : 0; return { faction: PW.state.players[0].faction, turn: PW.state.turn, heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1), screenLayers: n(R.layers), villageCache: n(R.villageCache), spriteCache: n(R.spriteCache), canvases: document.querySelectorAll('canvas').length }; }));
  }
  await b.close();
  const growth = rows[rows.length - 1].heapMB / rows[0].heapMB - 1, canvasesStable = rows.every(r => r.canvases === rows[0].canvases);
  const pass = growth <= 0.25 && canvasesStable && !errors.length;
  fs.writeFileSync(path.join(ROOT, 'reports', 'memory-check.json'), JSON.stringify({ generated: new Date().toISOString(), games: rows.length, heapGrowth: +growth.toFixed(3), canvasesStable, errors, pass, rows }, null, 1));
  rows.forEach((r, i) => console.log(i + ': ' + JSON.stringify(r)));
  console.log((pass ? 'MEMORY CHECK PASS' : 'MEMORY CHECK FAIL') + `: heap ${rows[0].heapMB} -> ${rows[rows.length - 1].heapMB} MB (${(growth * 100).toFixed(1)}%), canvases ${canvasesStable ? 'stable' : 'changed'}, errors ${errors.length}`);
  process.exit(pass ? 0 : 1);
})();
