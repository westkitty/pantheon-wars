#!/usr/bin/env node
/*
 * Forty-power benchmark: casts every faction power through the real engine action path and measures its visual lifecycle.
 *   node tools/perf-powers.js [--root <build>] [--label name] [--out reports/perf-powers/<label>.json] [--runs 1]
 *                             [--viewport 1440x900] [--dpr 1] [--quality high|low] [--motion full|reduced] [--flash on|off]
 *                             [--repeat 1] [--powers id,id] [--smoke]
 *   node tools/perf-powers.js --compare a.json,b.json,... --md reports/perf-powers.md
 *
 * For each pantheon one page is opened (seed 2, two rivals, Hierophant AI); the engine's own AI plays to turn 14 so shrines, priests and
 * rivals exist, then an ISOLATED TEST FIXTURE is applied to a clone of that state: the whole map revealed for the viewer, Faith 999, Favor 99,
 * cooldowns cleared. Rules and data are untouched; the fixture only supplies resources and visibility. For each of the pantheon's four
 * powers the fixture is restored (turn 14, else 22, 30, 38, 8 or 4: the first with a legal cast, recorded as fixtureTurn), a legal target is found with E.validate over every tile (closest to the home town first), and the power
 * is cast with PW.act — the same validate → step → log → fxFor → playVfx path a click takes. A cast counts only if PW.act returns true, a
 * 'power' log entry for it appears, and the renderer receives playVfx with the power's own VFX id. A power with no legal target is a
 * coverage failure, recorded with the validator's reason.
 * Frames are driven at a fixed 1/60 s step and timed with performance.now() around the renderer's render call (renderer CPU time, not
 * frame intervals); the app's own loop is silenced and every measured frame yields one animation frame, as perf.js's in-game timing does.
 * (Rendering frames back to back without yielding lets canvas work pile up into ~200 ms flushes that never happen in play.)
 * Phases by visual time after the cast: anticipation 0–0.35 s, manifestation 0.35–1.15 s, aftermath 1.15 s until the last effect ends
 * (cap 6 s), then 0.5 s of return to idle; idle = 90 frames of the same scene before the cast. A second, separate pass replays the cast
 * with Canvas calls counted (instrumentation never overlaps the timing pass). --smoke: one cast per power, coverage and cleanup only.
 */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const has = k => process.argv.includes('--' + k);
const ROOT = path.resolve(arg('root', path.join(__dirname, '..')));
const D = require('./load-data.js')();

if (has('compare')) { compare(arg('compare').split(','), arg('md')); process.exit(0); }

const LABEL = arg('label', 'run'), RUNS = +arg('runs', 1), REPEAT = +arg('repeat', 1), SMOKE = has('smoke');
const [VW, VH] = arg('viewport', '1440x900').split('x').map(Number), DPR = +arg('dpr', 1), QUALITY = arg('quality', 'high');
const MOTION = arg('motion', 'full'), FLASH = arg('flash', 'on');
const ONLY = arg('powers', '') ? arg('powers').split(',') : null;
const OUT = path.resolve(arg('out', path.join(__dirname, '..', 'reports', 'perf-powers', LABEL + '.json')));

(async () => {
  const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] });
  const out = { env: { label: LABEL, root: ROOT, date: new Date().toISOString(), viewport: VW + 'x' + VH, dpr: DPR, quality: QUALITY, motion: MOTION, flash: FLASH, runs: RUNS, repeat: REPEAT, smoke: SMOKE,
    browser: 'Playwright Chromium headless, software rendering (no GPU)', node: process.version, fixture: 'seed 2, two rivals, AI to turn 14 (else 22/30/38/8/4, the first with a legal cast for that power), then map revealed for the viewer, Faith 999, Favor 99, cooldowns cleared' }, powers: [], failures: [] };
  for (let run = 0; run < RUNS; run++) for (const f of D.factions) {
    const ids = f.powers.filter(id => !ONLY || ONLY.includes(id)); if (!ids.length) continue;
    const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR }), page = await ctx.newPage(), errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('file://' + path.join(ROOT, 'index.html') + `?seed=2&autostart=1&nosave=1&speed=0&follow=0&faction=${f.id}&rivals=2&diff=hard&quality=${QUALITY}&motion=${MOTION}`);
    await page.waitForFunction(() => window.PW && window.PW.state);
    const res = await page.evaluate(async ({ ids, smoke, repeat, flash }) => {
      const P = window.PW, E = P.E, AI = P.AI, R = P.renderer, app = P.app, D = window.PW_DATA;
      clearTimeout(app.aiTimer); R.autoQuality = false; if (flash === 'off') R.reducedFlash = true;
      const v = app.viewer, bases = {}; let s = E.clone(app.state), g = 0;
      for (const T of [4, 8, 14, 22, 30, 38]) { while (!s.over && s.turn < T && g++ < 40000) AI.playTurn(E, s); const b = E.clone(s); b.current = v; b.players[v].revealed = b.players[v].revealed.map(() => 1); bases[T] = b; }
      let base = bases[14];
      const fixture = () => { const x = E.clone(base); const p = x.players[v]; p.faith = 999; p.favor = 99; p.cooldowns = {}; return x; };
      const home = bases[14].map.tiles[bases[14].settlements[bases[14].players[v].home].tile];
      // the app's own rAF loop is silenced (its render becomes a no-op); each measured frame renders once at a fixed 1/60 s step and then
      // yields one animation frame, so the browser flushes canvas work between frames exactly as it does in play
      const realRender = R.render.bind(R); R.render = function () {};
      const tick = () => new Promise(r => requestAnimationFrame(() => r()));
      const frame = async () => { const t0 = performance.now(); realRender(1 / 60); const ms = performance.now() - t0; await tick(); return ms; };
      const stats = a => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y), q = k => b[Math.min(b.length - 1, Math.floor(b.length * k))]; return { n: a.length, median: +q(0.5).toFixed(3), p95: +q(0.95).toFixed(3), p99: a.length >= 100 ? +q(0.99).toFixed(3) : null, max: +b[b.length - 1].toFixed(3) }; };
      const results = [];
      for (const id of ids) {
        const pw = D.powers.find(x => x.id === id), rec = { id, faction: pw.faction, vfx: pw.vfx, x: pw.x, target: pw.target };
        const setup = () => { app.state = fixture(); R.fx = []; R.texts = []; R.flash = null; R.tint = null; R.setState(app.state, v); };
        let action = { type: 'power', power: id }, err = null;
        for (const T of [14, 22, 30, 38, 8, 4]) { // turn 14 first, then later, then earlier: the first fixture with a legal cast
          base = bases[T]; setup(); action = { type: 'power', power: id }; err = null;
          if (pw.target !== 'none') { const tiles = app.state.map.tiles.slice().sort((a, b) => Math.hypot(a.q - home.q, a.r - home.r) - Math.hypot(b.q - home.q, b.r - home.r)); const t = tiles.find(t => !E.validate(app.state, Object.assign({ tile: t.id }, action)));
            if (!t) err = E.validate(app.state, Object.assign({ tile: home.id }, action)) || 'no legal target'; else action.tile = t.id; }
          else err = E.validate(app.state, action);
          if (!err) { rec.fixtureTurn = T; break; }
        }
        if (err) { rec.ok = false; rec.reason = 'no legal cast in fixtures at turns 14/22/30/38/8/4: ' + err; results.push(rec); continue; }
        rec.targetTile = action.tile === undefined ? null : action.tile;
        const focus = action.tile !== undefined ? action.tile : home.id;
        const prime = async () => { P.focus(focus); R.cam.tz = 1.9; P.settle(); for (let i = 0; i < 20; i++) await frame(); };
        // timing pass
        const casts = [];
        for (let k = 0; k < (smoke ? 1 : repeat); k++) {
          setup(); await prime(); const idle = []; for (let i = 0; i < 90; i++) idle.push(await frame());
          const seen = []; const pv = R.playVfx; R.playVfx = function (vid) { seen.push(vid); return pv.apply(this, arguments); };
          const logLen = app.state.log.length, ok = P.act(Object.assign({}, action)); R.playVfx = pv;
          const entry = app.state.log.slice(logLen).find(e => e.k === 'power' && e.x && e.x.power === id);
          const c = { ok: ok && !!entry && seen.indexOf(pw.vfx) >= 0, dispatched: seen, phases: {}, fxPeak: 0 };
          if (!c.ok) { casts.push(c); break; }
          const A = [], M = [], C = [], back = []; let t = 0, frames = 0;
          while (t < 6) { const ms = await frame(); t += 1 / 60; frames++; c.fxPeak = Math.max(c.fxPeak, R.fx.length); (t <= 0.35 ? A : t <= 1.15 ? M : C).push(ms); if (t > 1.2 && R.fx.length === 0) break; }
          c.lifetime = +t.toFixed(3); c.left = R.fx.length; c.texts = R.texts.length;
          if (c.left) c.ok = false; // an effect still alive after its lifecycle is a failure
          for (let i = 0; i < 30; i++) back.push(await frame());
          c.phases = { idle: stats(idle), anticipation: stats(A), manifestation: stats(M), aftermath: stats(C), cast: stats(A.concat(M, C)), returnIdle: stats(back) };
          c.heapMB = performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(2) : null;
          casts.push(c);
        }
        rec.casts = casts; rec.ok = casts.length > 0 && casts.every(c => c.ok);
        if (!rec.ok) rec.reason = casts.length && !casts[0].ok ? 'cast did not dispatch: dispatched [' + (casts[0].dispatched || []).join(',') + ']' : rec.reason;
        // counting pass (separate): Canvas calls per frame over the cast, on the screen context and every offscreen context
        if (rec.ok && !smoke) {
          setup(); await prime(); const C2 = CanvasRenderingContext2D.prototype, names = ['fill', 'stroke', 'fillRect', 'drawImage', 'createRadialGradient', 'createLinearGradient', 'createPattern', 'save', 'setTransform', 'beginPath'], orig = {}, cnt = {};
          names.forEach(n => { orig[n] = C2[n]; cnt[n] = 0; C2[n] = function () { cnt[n]++; return orig[n].apply(this, arguments); }; });
          const countFrames = async n => { names.forEach(k => cnt[k] = 0); for (let i = 0; i < n; i++) { realRender(1 / 60); await tick(); } const o = {}; names.forEach(k => o[k] = +(cnt[k] / n).toFixed(1)); return o; };
          const idleOps = await countFrames(30); P.act(Object.assign({}, action)); const castOps = await countFrames(60);
          names.forEach(n => { C2[n] = orig[n]; });
          rec.opsPerFrame = { idle: idleOps, cast: castOps };
        }
        results.push(rec);
      }
      return results;
    }, { ids, smoke: SMOKE, repeat: REPEAT, flash: FLASH });
    res.forEach(r => { r.run = run; if (errs.length) { r.pageErrors = errs.slice(); r.ok = false; r.reason = (r.reason || '') + ' page errors: ' + errs.join('; '); } out.powers.push(r); if (!r.ok) out.failures.push(r.id + ': ' + r.reason); });
    process.stdout.write(f.id + ' ' + res.map(r => r.id + (r.ok ? '' : ' FAIL')).join(', ') + '\n');
    await ctx.close();
  }
  await browser.close();
  fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  const covered = new Set(out.powers.filter(p => p.ok).map(p => p.id)), wanted = D.powers.filter(p => !ONLY || ONLY.includes(p.id)).length;
  console.log('cast coverage ' + covered.size + '/' + wanted + (out.failures.length ? ' — failures:\n' + out.failures.join('\n') : '') + ' — ' + path.relative(process.cwd(), OUT));
  process.exit(covered.size === wanted ? 0 : 1);
})();

/* ---------------------------------------------------------------- comparison report */
function compare(files, mdPath) {
  const sets = files.map(f => ({ f, d: JSON.parse(fs.readFileSync(f, 'utf8')) }));
  const med = a => { const b = a.filter(x => x !== null && x !== undefined).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; };
  const agg = (d, id, phase, key) => med(d.powers.filter(p => p.id === id && p.ok).flatMap(p => p.casts.map(c => c.phases[phase] && c.phases[phase][key])));
  const inc = (d, id, phase, key) => { const a = agg(d, id, phase, key), b = agg(d, id, 'idle', key); return a === null || b === null ? null : +(a - b).toFixed(2); };
  const L = [], f2 = x => x === null ? '—' : (+x).toFixed(2);
  L.push('| Power | Pantheon | VFX | ' + sets.map(s => s.d.env.label + ' idle p95 | cast p95 | incr. median | incr. p95').join(' | ') + ' |');
  L.push('|' + '---|'.repeat(3 + sets.length * 4));
  const rows = D.powers.map(p => ({ p, last: inc(sets[sets.length - 1].d, p.id, 'cast', 'p95') }));
  rows.forEach(({ p }) => L.push('| ' + p.id + ' | ' + p.faction + ' | ' + p.vfx + ' | ' + sets.map(s => [agg(s.d, p.id, 'idle', 'p95'), agg(s.d, p.id, 'cast', 'p95'), inc(s.d, p.id, 'cast', 'median'), inc(s.d, p.id, 'cast', 'p95')].map(f2).join(' | ')).join(' | ') + ' |'));
  const md = L.join('\n');
  if (mdPath) fs.writeFileSync(mdPath, md + '\n'); else console.log(md);
}
