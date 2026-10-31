#!/usr/bin/env node
/*
 * Screenshot atlas: each of the ten pantheons played to turn 14 (Hierophant suggestions as the human's choices),
 * captured at 1440x900 and 390x844, plus a contact sheet. Output: reports/screens/atlas/*.png, reports/screens/atlas/index.json
 *   node tools/screen-atlas.js [--turn 14]
 */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'reports', 'screens', 'atlas'); fs.mkdirSync(OUT, { recursive: true });
const TURN = +((process.argv.find(a => a.startsWith('--turn=')) || '--turn=14').slice(7));
const D = require('./load-data.js')();

(async () => {
  const browser = await chromium.launch(), index = [], errors = [];
  for (const [i, f] of D.factions.entries()) {
    const rival = D.factions[(i + 3) % 10].id, url = 'file://' + path.join(ROOT, 'index.html') + `?seed=${31 + i}&autostart=1&nosave=1&speed=0&follow=0&faction=${f.id}&rivals=${rival}&quality=high`;
    for (const vp of [{ w: 1440, h: 900, tag: 'desktop' }, { w: 390, h: 844, tag: 'phone' }]) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.tag === 'phone' ? 2 : 1, isMobile: vp.tag === 'phone', hasTouch: vp.tag === 'phone' });
      const page = await ctx.newPage(); page.on('pageerror', e => errors.push(f.id + ' ' + vp.tag + ': ' + e.message));
      await page.goto(url);
      for (let g = 0; g < 3000; g++) {
        await page.waitForFunction(() => PW.state && (PW.state.over || (!PW.busy() && PW.state.current === PW.app.viewer)), null, { timeout: 120000 });
        const done = await page.evaluate(lim => { const s = PW.state; if (s.over || s.turn >= lim) return true; const a = PW.suggest(); if (!a || a.type === 'endTurn' || !PW.act(a)) PW.endTurn(); document.getElementById('event').hidden = true; return false; }, TURN);
        if (done) break;
      }
      await page.evaluate(() => { const s = PW.state, home = s.settlements[s.players[0].home].tile; PW.renderer.cam.tz = innerWidth < 600 ? 1.25 : 1.6; PW.focus(home); PW.renderer.cam.tz = innerWidth < 600 ? 1.25 : 1.6; PW.settle(); PW.select(home); });
      await page.waitForTimeout(900);
      const file = path.join(OUT, `${String(i + 1).padStart(2, '0')}-${f.id}-${vp.tag}.png`); await page.screenshot({ path: file });
      index.push({ faction: f.id, name: f.name, atmosphere: f.atmosphere, viewport: vp.w + 'x' + vp.h, turn: await page.evaluate(() => PW.state.turn), file: path.relative(ROOT, file) });
      await ctx.close();
    }
    console.log('captured', f.id);
  }
  // contact sheet of the desktop captures
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const imgs = index.filter(x => x.viewport === '1440x900').map(x => ({ name: x.name, data: 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, x.file)).toString('base64') }));
  const sheet = await page.evaluate(async imgs => {
    const W = 480, H = 300, c = document.createElement('canvas'); c.width = W * 5; c.height = (H + 24) * 2; const g = c.getContext('2d'); g.fillStyle = '#0c0f16'; g.fillRect(0, 0, c.width, c.height);
    for (let k = 0; k < imgs.length; k++) { const im = new Image(); im.src = imgs[k].data; await im.decode(); const x = (k % 5) * W, y = Math.floor(k / 5) * (H + 24); g.drawImage(im, x + 4, y + 4, W - 8, H - 8); g.fillStyle = '#f3d98e'; g.font = '15px Georgia'; g.fillText(imgs[k].name, x + 8, y + H + 14); }
    return c.toDataURL('image/png');
  }, imgs);
  fs.writeFileSync(path.join(OUT, 'contact-sheet.png'), Buffer.from(sheet.split(',')[1], 'base64'));
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ generated: new Date().toISOString(), turn: TURN, errors, shots: index }, null, 1));
  console.log(index.length + ' screenshots, contact sheet written, page errors: ' + errors.length); if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
})();
