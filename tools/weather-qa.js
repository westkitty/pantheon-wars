#!/usr/bin/env node
/*
 * P039 weather QA. For each implemented weather kind (data/rules.json climate.kinds) an active front is placed next to the viewer's
 * home in the renderer's copy of the state (display only; the engine state is untouched), the frame is rendered at a frozen time and
 * cropped around the front: desktop 1440x900, reduced motion, and phone 390x844. Each crop is compared with the same crop under clear
 * weather and with every other kind (mean absolute channel difference), and the HUD controls are checked to stay on top.
 * Writes reports/weather-qa/weather-atlas.png and reports/weather-qa/manifest.json.   node tools/weather-qa.js
 */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'reports', 'weather-qa'); fs.mkdirSync(OUT, { recursive: true });
const KINDS = Object.keys(require('./load-data.js')().rules.climate.kinds);
const VARIANTS = [{ id: 'desktop', vp: { width: 1440, height: 900 }, dpr: 1, motion: 'full' }, { id: 'reduced', vp: { width: 1440, height: 900 }, dpr: 1, motion: 'reduced' }, { id: 'phone', vp: { width: 390, height: 844 }, dpr: 2, motion: 'full', mobile: true }];

(async () => {
  const browser = await chromium.launch(), crops = {}, metrics = {}, errors = [], controls = {};
  for (const v of VARIANTS) {
    const ctx = await browser.newContext({ viewport: v.vp, deviceScaleFactor: v.dpr, isMobile: !!v.mobile, hasTouch: !!v.mobile });
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(v.id + ': ' + e.message));
    await page.goto('file://' + path.join(ROOT, 'index.html') + `?seed=21&autostart=1&nosave=1&speed=0&faction=greek&rivals=norse&quality=high&motion=${v.motion}`);
    await page.waitForTimeout(700);
    const res = await page.evaluate(kinds => {
      const R = PW.renderer, s = PW.state, H = PW.E.helpers, home = s.settlements[s.players[0].home].tile;
      // a revealed land tile one step from home, so the front covers known ground
      const tile = H.inRadius(s, home, 1).find(id => id !== home && s.players[0].revealed[id] && !PW_DATA.terrain.types[s.map.tiles[id].terrain].water) || home;
      const view = R.state, fronts0 = view.climate.fronts.slice();
      function frame(kind) {
        view.climate.fronts = fronts0.slice(); if (kind) view.climate.fronts.push({ id: 900, kind, tile, radius: 2, phase: 'active', t0: s.turn, t1: s.turn + 2, hitDone: true });
        PW.focus(tile); R.cam.x = R.cam.tx; R.cam.y = R.cam.ty; R.cam.z = R.cam.tz; R.time = 10; R.fx = []; R.texts = []; R.flash = null; R.render(0);
        const c = R.canvas, p = PW.tileScreen(tile), d = R.dpr || 1, r = c.getBoundingClientRect(), cw = Math.round(Math.min(c.width, 520 * d)), ch = Math.round(Math.min(c.height, 340 * d));
        const x = Math.max(0, Math.min(c.width - cw, Math.round((p.x - r.left) * d - cw / 2))), y = Math.max(0, Math.min(c.height - ch, Math.round((p.y - r.top) * d - ch * 0.6)));
        const o = document.createElement('canvas'); o.width = cw; o.height = ch; o.getContext('2d').drawImage(c, x, y, cw, ch, 0, 0, cw, ch);
        return { url: o.toDataURL('image/png'), px: Array.from(o.getContext('2d').getImageData(0, 0, cw, ch).data) };
      }
      const out = { clear: frame(null) };
      kinds.forEach(k => { out[k] = frame(k); });
      view.climate.fronts = fronts0;
      const diff = (a, b) => { let sum = 0, n = 0; for (let i = 0; i < a.length; i += 4) { sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); n += 3; } return +(sum / n).toFixed(2); };
      const m = { vsClear: {}, pairwiseMin: Infinity, pairwiseMinPair: null };
      kinds.forEach(k => { m.vsClear[k] = diff(out[k].px, out.clear.px); });
      kinds.forEach((a, i) => kinds.slice(i + 1).forEach(b => { const d = diff(out[a].px, out[b].px); if (d < m.pairwiseMin) { m.pairwiseMin = d; m.pairwiseMinPair = a + '/' + b; } }));
      // controls stay on top of the weather: the element under each control's centre is the control itself
      const ctl = {}; ['endturn', 'powerbar', 'topbar'].forEach(id => { const el = document.getElementById(id), b = el.getBoundingClientRect(), hit = document.elementFromPoint(b.left + b.width / 2, b.top + Math.min(b.height / 2, 20)); ctl[id] = !!hit && (hit === el || el.contains(hit)); });
      const urls = {}; Object.keys(out).forEach(k => urls[k] = out[k].url);
      return { tile, m, ctl, urls, panel: (PW.select(tile), document.getElementById('panel').innerText.slice(0, 200)) };
    }, KINDS);
    crops[v.id] = res.urls; metrics[v.id] = res.m; controls[v.id] = res.ctl;
    await ctx.close();
  }
  // compact atlas: rows = variants, columns = clear + each kind, thumbnails at 260 px wide
  const page = await browser.newPage();
  const atlas = await page.evaluate(async ({ crops, kinds, variants }) => {
    const cols = ['clear'].concat(kinds), TW = 260, TH = 170, c = document.createElement('canvas'); c.width = cols.length * TW + 90; c.height = variants.length * (TH + 22) + 26;
    const g = c.getContext('2d'); g.fillStyle = '#0c0f16'; g.fillRect(0, 0, c.width, c.height); g.font = '14px Georgia'; g.fillStyle = '#f3d98e';
    cols.forEach((k, i) => g.fillText(k, 90 + i * TW + 6, 18));
    for (let r = 0; r < variants.length; r++) { g.fillStyle = '#f3d98e'; g.fillText(variants[r], 6, 26 + r * (TH + 22) + TH / 2);
      for (let i = 0; i < cols.length; i++) { const im = new Image(); im.src = crops[variants[r]][cols[i]]; await im.decode(); const s = Math.min(TW / im.width, TH / im.height); g.drawImage(im, 90 + i * TW + (TW - im.width * s) / 2, 26 + r * (TH + 22), im.width * s, im.height * s); } }
    return c.toDataURL('image/png');
  }, { crops, kinds: KINDS, variants: VARIANTS.map(v => v.id) });
  fs.writeFileSync(path.join(OUT, 'weather-atlas.png'), Buffer.from(atlas.split(',')[1], 'base64'));
  await browser.close();
  const THRESH = 1.0, fails = [];
  VARIANTS.forEach(v => { KINDS.forEach(k => { if (!(metrics[v.id].vsClear[k] >= THRESH)) fails.push(`${v.id}: ${k} barely differs from clear weather (${metrics[v.id].vsClear[k]})`); });
    if (!(metrics[v.id].pairwiseMin >= THRESH * 0.5)) fails.push(`${v.id}: ${metrics[v.id].pairwiseMinPair} nearly identical (${metrics[v.id].pairwiseMin})`);
    Object.keys(controls[v.id]).forEach(id => { if (!controls[v.id][id]) fails.push(`${v.id}: weather covers #${id}`); }); });
  if (errors.length) fails.push(...errors);
  const manifest = { generated: new Date().toISOString(), tool: 'node tools/weather-qa.js', kinds: KINDS, variants: VARIANTS.map(v => ({ id: v.id, viewport: v.vp.width + 'x' + v.vp.height + '@' + v.dpr, motion: v.motion })),
    method: 'one active front (radius 2) beside the home town in the renderer\'s state copy; frozen render time; crops compared by mean absolute RGB difference (0-255)', thresholds: { vsClear: THRESH, pairwise: THRESH * 0.5 },
    metrics, controlsOnTop: controls, atlas: 'reports/weather-qa/weather-atlas.png', pass: !fails.length, fails, limits: 'Automated distinguishability and layering checks; human judgement of readability on a real phone is not included.' };
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log(fails.length ? 'WEATHER QA FAIL\n- ' + fails.join('\n- ') : 'WEATHER QA PASS'); console.log(JSON.stringify(metrics));
  process.exit(fails.length ? 1 : 0);
})();
