#!/usr/bin/env node
/*
 * Visual QA atlas (before/after). Plays real games through the shipped page (Hierophant suggestions as the human's choices, the same
 * validated action path as clicks) and captures:
 *   pantheons.jpg  each of the ten pantheons at turn 14, BEFORE (--before <root>) and AFTER (this tree), same seed per pantheon
 *   ages.jpg       one game at turns 3 (Dawn), 20 (Zenith) and 33 (Twilight), before and after
 *   vfx.jpg        all 40 power signatures (after) at the three beats: anticipation 0.2 s, manifestation 0.75 s, consequence 1.6 s
 * Display-only VFX frames are cast on the home tile of a live game; they are labelled as such. Writes reports/visual-qa/.
 *   node tools/visual-qa.js --before /path/to/old/checkout
 */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'reports', 'visual-qa'); fs.mkdirSync(OUT, { recursive: true });
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BEFORE = arg('before', null);
const D = require('./load-data.js')();
const errors = [];

async function play(browser, root, faction, seed, turn, vp) {
  const ctx = await browser.newContext({ viewport: vp || { width: 1440, height: 900 } }), page = await ctx.newPage();
  page.on('pageerror', e => errors.push(path.basename(root) + ' ' + faction + ': ' + e.message));
  await page.goto('file://' + path.join(root, 'index.html') + `?seed=${seed}&autostart=1&nosave=1&speed=0&follow=0&faction=${faction}&quality=high`);
  for (let g = 0; g < 4000; g++) {
    await page.waitForFunction(() => PW.state && (PW.state.over || (!PW.busy() && PW.state.current === PW.app.viewer)), null, { timeout: 120000 });
    const done = await page.evaluate(l => { const s = PW.state; if (s.over || s.turn >= l) return true; const a = PW.suggest(); if (!a || a.type === 'endTurn' || !PW.act(a)) PW.endTurn(); document.getElementById('event').hidden = true; return false; }, turn);
    if (done) break;
  }
  return { ctx, page };
}
async function frame(page) {
  // frozen-time frame of the world canvas around the home town, HUD excluded (the HUD is checked by the journeys and screenshots)
  return page.evaluate(() => { const R = PW.renderer, s = PW.state, h = s.settlements[s.players[0].home].tile; R.cam.tz = 1.9; PW.focus(h); R.cam.tz = 1.9; PW.settle(); R.time = 12; R.fx = []; R.texts = []; R.flash = null; R.tint = null; R.revealAnims = []; R.oldFog = null; R.render(0); R.render(0); return R.canvas.toDataURL('image/png'); });
}
async function sheet(browser, cells, cols, cw, ch, file) {
  const page = await browser.newPage();
  const url = await page.evaluate(async ({ cells, cols, cw, ch }) => {
    const rows = Math.ceil(cells.length / cols), c = document.createElement('canvas'); c.width = cols * cw; c.height = rows * (ch + 18); const g = c.getContext('2d');
    g.fillStyle = '#0c0f16'; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < cells.length; i++) { const x = (i % cols) * cw, y = Math.floor(i / cols) * (ch + 18); if (cells[i].url) { const im = new Image(); im.src = cells[i].url; await im.decode(); const s = Math.max(cw / im.width, ch / im.height), sw = cw / s, sh = ch / s; g.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, x + 2, y + 2, cw - 4, ch - 4); }
      g.fillStyle = '#f3d98e'; g.font = '13px Georgia'; g.fillText(cells[i].label, x + 6, y + ch + 13); }
    return c.toDataURL('image/jpeg', 0.84);
  }, { cells, cols, cw, ch });
  fs.writeFileSync(path.join(OUT, file), Buffer.from(url.split(',')[1], 'base64')); await page.close();
}

(async () => {
  const browser = await chromium.launch(), manifest = { generated: new Date().toISOString(), tool: 'node tools/visual-qa.js', before: BEFORE ? 'checkout at ' + path.basename(BEFORE) : null, sheets: [], notes: [] };
  const roots = BEFORE ? [['before', BEFORE], ['after', ROOT]] : [['after', ROOT]];
  // 1. ten pantheons, same seed each
  const cells = [];
  for (const [i, f] of D.factions.entries()) for (const [tag, root] of roots) {
    const { ctx, page } = await play(browser, root, f.id, 31 + i, 14); cells.push({ label: f.shortName + ' · ' + tag + ' · turn 14', url: await frame(page) }); await ctx.close();
  }
  await sheet(browser, cells, roots.length * 2, 480, 300, 'pantheons.jpg'); manifest.sheets.push({ file: 'reports/visual-qa/pantheons.jpg', content: 'ten pantheons at turn 14, real games, ' + roots.map(r => r[0]).join(' vs ') });
  // 2. three ages in one game
  const ages = [];
  for (const [tag, root] of roots) for (const t of [3, 20, 33]) { const { ctx, page } = await play(browser, root, 'mexica', 51, t); ages.push({ label: tag + ' · turn ' + t + ' · ' + (t < 16 ? 'Dawn' : t < 31 ? 'Zenith' : 'Twilight'), url: await frame(page) }); await ctx.close(); }
  await sheet(browser, ages, 3, 480, 300, 'ages.jpg'); manifest.sheets.push({ file: 'reports/visual-qa/ages.jpg', content: 'one Mexica game at turns 3, 20 and 33, ' + roots.map(r => r[0]).join(' vs ') });
  // 3. forty power signatures, three beats each (display-only casts on a live map)
  const { ctx, page } = await play(browser, ROOT, 'greek', 2, 1);
  const vfxIds = D.powers.map(p => p.vfx);
  const vfx = await page.evaluate(async ids => {
    const R = PW.renderer, s = PW.state, t = s.settlements[s.players[0].home].tile, out = []; PW.focus(t); PW.settle();
    for (const id of ids) { R.fx = []; R.texts = []; R.flash = null; R.tint = null; R.time = 5; R.playVfx(id, t, { tiles: [t] }); let tt = 0;
      for (const beat of [0.2, 0.75, 1.6]) { while (tt < beat) { R.render(0.05); tt += 0.05; } const cp = PW.tileScreen(t), d = R.dpr || 1, o = document.createElement('canvas'); o.width = 300; o.height = 200; o.getContext('2d').drawImage(R.canvas, Math.round(cp.x * d - 150), Math.round(cp.y * d - 140), 300, 200, 0, 0, 300, 200); out.push({ label: id + ' ' + beat + 's', url: o.toDataURL('image/png') }); } }
    return out; }, vfxIds);
  await ctx.close();
  await sheet(browser, vfx, 12, 200, 133, 'vfx.jpg'); manifest.sheets.push({ file: 'reports/visual-qa/vfx.jpg', content: 'all 40 power signatures (after) at 0.2 s, 0.75 s and 1.6 s; display-only casts on a live map, not gameplay' });
  await browser.close();
  manifest.errors = errors; manifest.pass = !errors.length;
  manifest.notes.push('World frames are rendered at a frozen visual time with transient effects cleared, so before and after compare the same scene; the HUD is covered by tools/journeys.js and tools/screenshots.js.');
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log((errors.length ? 'VISUAL QA ERRORS\n' + errors.join('\n') : 'VISUAL QA OK') + ' — ' + manifest.sheets.map(s => s.file).join(', '));
  process.exit(errors.length ? 1 : 0);
})();
