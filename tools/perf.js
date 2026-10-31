#!/usr/bin/env node
/*
 * Render-cost sampler (dev only; uses the pre-installed Playwright Chromium).
 *   node tools/perf.js [--root <build dir>] [--out reports/perf-after.json] [--seconds 4] [--label after]
 * For each scene the page is driven to a fixed game state with the engine's own AI (no wall-clock randomness in the
 * rules), then frames are sampled for N seconds. Reported per scene: renderer CPU time per frame (PWRenderer.lastFrameMs:
 * median, p95, max), rAF interval median/p95, and JS heap where Chromium exposes it. Works against v0.1 and later builds
 * because it only uses window.PW.{E,AI,app,renderer,start}.
 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('root', path.join(__dirname, '..'))), SECS = +arg('seconds', 4), LABEL = arg('label', 'run');
const OUT = path.resolve(arg('out', path.join(__dirname, '..', 'reports', 'perf-' + LABEL + '.json')));

const SCENES = [
  { id: 'turn1', turn: 1, quality: 'high', w: 1440, h: 900 },
  { id: 'mid16', turn: 16, quality: 'high', w: 1440, h: 900 },
  { id: 'late30-reveal', turn: 30, quality: 'high', w: 1440, h: 900, reveal: true },
  { id: 'late30-low', turn: 30, quality: 'low', w: 1440, h: 900, reveal: true },
  { id: 'mobile16', turn: 16, quality: 'high', w: 390, h: 844, dpr: 2 },
  { id: 'miracle-burst', turn: 16, quality: 'high', w: 1440, h: 900, burst: true }
];

(async () => {
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--enable-precise-memory-info'] });
  const results = [];
  for (const sc of SCENES) {
    const ctx = await browser.newContext({ viewport: { width: sc.w, height: sc.h }, deviceScaleFactor: sc.dpr || 1 });
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const t0 = Date.now();
    await page.goto('file://' + path.join(ROOT, 'index.html') + '?seed=11&faction=greek&rivals=2&diff=hard&autostart=1&quality=' + sc.quality + '&speed=0');
    await page.waitForFunction(() => window.PW && window.PW.state);
    const tti = Date.now() - t0;
    await page.evaluate(({ turn, reveal, burst }) => {
      const P = window.PW, E = P.E, AI = P.AI, app = P.app;
      clearTimeout(app.aiTimer);
      let s = E.clone(app.state), g = 0;
      while (!s.over && s.turn < turn && g++ < 20000) AI.playTurn(E, s);
      if (reveal) s.players[0].revealed = s.players[0].revealed.map(() => 1);
      app.state = s; app.busy = false;
      P.renderer.setState(s, app.human !== undefined ? app.human : 0);
      if (burst) { const st = s.settlements.filter(x => s.players[0].revealed[x.tile]).slice(0, 6); st.forEach((x, i) => { P.renderer.addFx(i % 2 ? 'bolt' : 'topple', x.tile, {}); P.renderer.addFx('reveal', x.tile, { color: '#ffe08a', radius: 3 }); }); }
    }, sc);
    await page.waitForTimeout(400);
    const m = await page.evaluate(secs => new Promise(res => {
      const R = window.PW.renderer, ms = [], iv = []; let last = performance.now(); const end = last + secs * 1000;
      function f(now) { iv.push(now - last); last = now; if (R.lastFrameMs !== undefined) ms.push(R.lastFrameMs); if (now < end) requestAnimationFrame(f); else res({ ms, iv, heap: performance.memory ? performance.memory.usedJSHeapSize : null, quality: R.quality }); }
      requestAnimationFrame(f);
    }), SECS);
    const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? +b[Math.min(b.length - 1, Math.floor(p * b.length))].toFixed(2) : null; };
    results.push({ scene: sc.id, viewport: sc.w + 'x' + sc.h + '@' + (sc.dpr || 1), requestedQuality: sc.quality, finalQuality: m.quality, frames: m.ms.length, timeToStateMs: tti,
      renderMs: { median: q(m.ms, 0.5), p95: q(m.ms, 0.95), max: q(m.ms, 1) }, rafIntervalMs: { median: q(m.iv, 0.5), p95: q(m.iv, 0.95) }, heapMB: m.heap ? +(m.heap / 1048576).toFixed(1) : null, errors });
    console.log(JSON.stringify(results[results.length - 1]));
    await ctx.close();
  }
  const env = { label: LABEL, root: ROOT, date: new Date().toISOString(), node: process.version, browser: 'Playwright Chromium ' + browser.version() + ' headless (software rendering, no GPU)', platform: process.platform + ' ' + require('os').release(), cpus: require('os').cpus().length + 'x ' + require('os').cpus()[0].model, secondsPerScene: SECS };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ env, results }, null, 1));
  console.log('wrote', OUT);
  await browser.close();
})().catch(e => { console.error(e); process.exit(2); });
