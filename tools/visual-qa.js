#!/usr/bin/env node
/*
 * Visual QA atlas (before/after). Plays real games through the shipped page (Hierophant suggestions as the human's choices, the same
 * validated action path as clicks) and captures:
 *   pantheons.jpg  each of the ten pantheons at turn 14, BEFORE (--before <root>) and AFTER (this tree), same seed per pantheon
 *   ages.jpg       one game at turns 3 (Dawn), 20 (Zenith) and 33 (Twilight), before and after
 *   close.jpg      each pantheon's home town at zoom 3.2, before and after
 *   sprites.jpg    source sprites (shrine healthy, damaged, priest) at world size ×3, before and after
 *   walk.jpg       a priest walking in the running game, 8 frames
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
  // 2b. close inspection: the same game and camera at zoom 3.2, before and after (where the 2× asset detail shows most)
  const close = [];
  for (const [i, f] of D.factions.entries()) for (const [tag, root] of roots) {
    const { ctx, page } = await play(browser, root, f.id, 31 + i, 14);
    close.push({ label: f.shortName + ' · ' + tag + ' · close zoom', url: await page.evaluate(() => { const R = PW.renderer, s = PW.state, h = s.settlements[s.players[0].home].tile; PW.focus(h); R.cam.tz = 3.2; PW.settle(); R.time = 12; R.fx = []; R.texts = []; R.flash = null; R.tint = null; R.revealAnims = []; R.oldFog = null; R.render(0); R.render(0);
      const p = PW.tileScreen(h), d = R.dpr || 1, o = document.createElement('canvas'); o.width = 520; o.height = 340; o.getContext('2d').drawImage(R.canvas, Math.round(p.x * d - 260), Math.round(p.y * d - 250), 520, 340, 0, 0, 520, 340); return o.toDataURL('image/png'); }) });
    await ctx.close();
  }
  await sheet(browser, close, roots.length * 2, 390, 255, 'close.jpg'); manifest.sheets.push({ file: 'reports/visual-qa/close.jpg', content: 'home town of each pantheon at zoom 3.2 (close inspection), same game and camera, ' + roots.map(r => r[0]).join(' vs ') });
  // 2c. native source sprites at their gameplay size ×3 (shrine healthy and damaged, priest emissary), before and after
  const sprites = [];
  for (const [tag, root] of roots) {
    const ctx = await browser.newContext(), page = await ctx.newPage(); await page.goto('file://' + path.join(root, 'index.html') + '?nosave=1'); await page.waitForFunction(() => window.PWArt && window.PW_DATA);
    const cells = await page.evaluate(tag => { const A = PWArt, D = PW_DATA, out = [];
      const fit = (img, w, h) => { const c = document.createElement('canvas'); c.width = w * 3; c.height = h * 3; const g = c.getContext('2d'); g.fillStyle = '#6f7a5a'; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingEnabled = img.width < w * 3 * 0.75; g.drawImage(img, 0, 0, w * 3, h * 3); return c.toDataURL('image/png'); };
      D.factions.forEach(f => { const s = D.shrines.find(x => x.id === f.shrine);
        out.push({ label: f.shortName + ' shrine · ' + tag, url: fit(A.shrineArt(s.art, f.palette, 'healthy', null), 44, 50) });
        out.push({ label: f.shortName + ' damaged · ' + tag, url: fit(A.shrineArt(s.art, f.palette, 'damaged', null), 44, 50) });
        out.push({ label: f.shortName + ' priest · ' + tag, url: fit(A.priestSprite(f.priestStyle, 'emissary', f.palette, 0), 14, 20) }); });
      return out; }, tag);
    sprites.push(cells); await ctx.close();
  }
  const merged = []; for (let i = 0; i < sprites[0].length; i++) sprites.forEach(set => merged.push(set[i]));
  await sheet(browser, merged, roots.length * 3, 150, 160, 'sprites.jpg'); manifest.sheets.push({ file: 'reports/visual-qa/sprites.jpg', content: 'source sprites shown at their world size ×3 (the size they reach at zoom 3): shrine healthy, shrine damaged, priest; ' + roots.map(r => r[0]).join(' vs ') });
  // 2d. walk cycle in the running game: a priest crossing one hex, 8 frames 0.1 s apart (after)
  { const { ctx, page } = await play(browser, ROOT, 'yoruba', 4, 1);
    const walk = await page.evaluate(() => { const R = PW.renderer, s = PW.state, pr = s.priests.find(q => q.owner === 0), out = []; if (!pr) return out;
      const nb = PW.E.helpers.inRadius(s, pr.tile, 1).find(t => t !== pr.tile && s.map.tiles[t].terrain !== 'water') || pr.tile; PW.focus(pr.tile); R.cam.tz = 3.2; PW.settle(); R.fx = []; R.texts = [];
      R.priestAnim[pr.id] = { from: nb, t0: R.time, dur: 0.8 };
      for (let k = 0; k < 8; k++) { R.render(0.1); const p = PW.tileScreen(pr.tile), d = R.dpr || 1, o = document.createElement('canvas'); o.width = 260; o.height = 170; o.getContext('2d').drawImage(R.canvas, Math.round(p.x * d - 170), Math.round(p.y * d - 120), 260, 170, 0, 0, 260, 170); out.push({ label: 'walk t=' + ((k + 1) / 10).toFixed(1) + ' s', url: o.toDataURL('image/png') }); }
      return out; });
    await ctx.close(); if (walk.length) { await sheet(browser, walk, 4, 260, 170, 'walk.jpg'); manifest.sheets.push({ file: 'reports/visual-qa/walk.jpg', content: 'a priest walking between two hexes in the running game at zoom 3.2, 0.1 s apart (distance-driven four-frame cycle, no hop)' }); } else errors.push('walk: no priest'); }
  // 2e. every biome, before and after: a live game with the map revealed for display only, one tile of each land type at normal zoom 2.2
  { const cells = [];
    for (const [tag, root] of roots) { const { ctx, page } = await play(browser, root, 'greek', 31, 2);
      const shots = await page.evaluate(() => { const R = PW.renderer, s = PW.state, out = [], seen = {}; s.players[0].revealed = s.players[0].revealed.map(() => 1); R.setState(s, 0);
        const cx = s.map.w / 2, cy = s.map.h / 2, tiles = s.map.tiles.slice().sort((a, b) => Math.hypot(a.q - cx, a.r - cy) - Math.hypot(b.q - cx, b.r - cy));
        tiles.forEach(t => { if (seen[t.terrain] || t.settlement >= 0 || t.q < 2 || t.r < 2 || t.q > s.map.w - 3 || t.r > s.map.h - 3) return; seen[t.terrain] = 1;
          PW.focus(t.id); R.cam.tz = 2.2; PW.settle(); R.time = 12; R.fx = []; R.texts = []; R.revealAnims = []; R.oldFog = null; R.render(0); R.render(0); R.render(0);
          const p = PW.tileScreen(t.id), d = R.dpr || 1, o = document.createElement('canvas'); o.width = 360; o.height = 220; o.getContext('2d').drawImage(R.canvas, Math.round(p.x * d - 180), Math.round(p.y * d - 140), 360, 220, 0, 0, 360, 220); out.push({ terrain: t.terrain, url: o.toDataURL('image/png') }); });
        return out; });
      shots.sort((a, b) => a.terrain < b.terrain ? -1 : 1).forEach(x => cells.push({ terrain: x.terrain, tag, url: x.url })); await ctx.close(); }
    const order = [...new Set(cells.map(c => c.terrain))], merged = []; order.forEach(tn => roots.forEach(([tag]) => { const c = cells.find(x => x.terrain === tn && x.tag === tag); if (c) merged.push({ label: tn + ' · ' + tag, url: c.url }); }));
    await sheet(browser, merged, roots.length * 2, 360, 220, 'biomes.jpg'); manifest.sheets.push({ file: 'reports/visual-qa/biomes.jpg', content: 'one tile of every land type at zoom 2.2, same game and camera (map revealed for display only), ' + roots.map(r => r[0]).join(' vs ') }); }
  // 2f. the same game on desktop, tablet and phone (whole screen, HUD included), before and after
  { const cells = [];
    for (const vp of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) for (const [tag, root] of roots) {
      const { ctx, page } = await play(browser, root, 'egyptian', 33, 12, vp); await page.evaluate(() => { const R = PW.renderer; R.time = 12; R.fx = []; R.texts = []; R.revealAnims = []; R.oldFog = null; R.render(0); });
      cells.push({ label: vp.width + '×' + vp.height + ' · ' + tag, url: 'data:image/png;base64,' + (await page.screenshot()).toString('base64') }); await ctx.close(); }
    await sheet(browser, cells, roots.length * 3, 380, 300, 'devices.jpg'); manifest.sheets.push({ file: 'reports/visual-qa/devices.jpg', content: 'one game at turn 12 on desktop 1440×900, tablet 1024×768 and phone 390×844, full screen, ' + roots.map(r => r[0]).join(' vs ') }); }
  // 2g. interface art, before and after: the forty power icons and ten emblems at their interface sizes, all nineteen event scenes
  { const sets = {};
    for (const [tag, root] of roots) { const ctx = await browser.newContext(), page = await ctx.newPage(); await page.goto('file://' + path.join(root, 'index.html') + '?nosave=1'); await page.waitForFunction(() => window.PWArt && window.PW_DATA);
      sets[tag] = await page.evaluate(() => { const A = PWArt, D = PW_DATA, mk = (draw, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#141824'; g.fillRect(0, 0, w, h); g.imageSmoothingEnabled = false; draw(g); return c.toDataURL('image/png'); };
        const icons = mk(g => D.powers.forEach((p, i) => g.drawImage(A.icon(p.icon, 48), 6 + (i % 10) * 54, 6 + Math.floor(i / 10) * 54, 48, 48)), 546, 222);
        const emblems = mk(g => D.factions.forEach((f, i) => { g.imageSmoothingEnabled = true; g.drawImage(A.emblem(f.emblem, f.palette, 64), 6 + i * 54, 6, 48, 48); g.drawImage(A.emblem(f.emblem, f.palette, 64), 12 + i * 54, 62, 34, 34); }), 546, 104);
        const events = D.events.map(e => ({ label: e.art, url: mk(g => g.drawImage(A.eventArt(e.art, 7, 'zenith'), 0, 0, 320, 180), 320, 180) }));
        return { icons, emblems, events }; });
      await ctx.close(); }
    const ui = []; roots.forEach(([tag]) => { ui.push({ label: 'power icons at 48 px · ' + tag, url: sets[tag].icons }); ui.push({ label: 'emblems at 48 and 34 px · ' + tag, url: sets[tag].emblems }); });
    await sheet(browser, ui, 2, 546, 222, 'icons.jpg'); manifest.sheets.push({ file: 'reports/visual-qa/icons.jpg', content: 'the forty power icons at 48 px and the ten emblems at 48 and 34 px, ' + roots.map(r => r[0]).join(' vs ') });
    const ev = []; sets[roots[0][0]].events.forEach((e, i) => roots.forEach(([tag]) => ev.push({ label: e.label + ' · ' + tag, url: sets[tag].events[i].url })));
    await sheet(browser, ev, roots.length * 2, 320, 180, 'events.jpg'); manifest.sheets.push({ file: 'reports/visual-qa/events.jpg', content: 'all nineteen event illustrations (Zenith), ' + roots.map(r => r[0]).join(' vs ') }); }
  // 2h. the forty manifestations at their peak (0.75 s), before and after, same live map and camera
  { const per = {};
    for (const [tag, root] of roots) { const { ctx, page } = await play(browser, root, 'greek', 2, 1);
      per[tag] = await page.evaluate(async ids => { const R = PW.renderer, s = PW.state, t = s.settlements[s.players[0].home].tile, out = []; PW.focus(t); PW.settle();
        for (const id of ids) { R.fx = []; R.texts = []; R.flash = null; R.tint = null; R.time = 5; R.playVfx(id, t, { tiles: [t] }); for (let tt = 0; tt < 0.75; tt += 0.05) R.render(0.05);
          const cp = PW.tileScreen(t), d = R.dpr || 1, o = document.createElement('canvas'); o.width = 300; o.height = 200; o.getContext('2d').drawImage(R.canvas, Math.round(cp.x * d - 150), Math.round(cp.y * d - 140), 300, 200, 0, 0, 300, 200); out.push(o.toDataURL('image/png')); }
        return out; }, D.powers.map(p => p.vfx)); await ctx.close(); }
    const vc = []; D.powers.forEach((p, i) => roots.forEach(([tag]) => vc.push({ label: p.vfx + ' · ' + tag, url: per[tag][i] })));
    await sheet(browser, vc, roots.length * 4, 200, 133, 'vfx-compare.jpg'); manifest.sheets.push({ file: 'reports/visual-qa/vfx-compare.jpg', content: 'each of the forty powers at 0.75 s (manifestation), same live map and camera, ' + roots.map(r => r[0]).join(' vs ') }); }
  // 2i. weather, staged for display only: each of the five kinds placed over the home town of a live game at zoom 2.0, before and after
  { const cells = [];
    for (const kind of Object.keys(D.rules.climate.kinds)) for (const [tag, root] of roots) { const { ctx, page } = await play(browser, root, 'egyptian', 33, 6);
      const url = await page.evaluate(k => { const R = PW.renderer, s = PW.state, h = s.settlements[s.players[0].home].tile; s.climate.fronts = [{ id: 99, kind: k, tile: h, radius: 3, phase: 'active', t0: s.turn, t1: s.turn + 3 }]; R.setState(s, 0);
        PW.focus(h); R.cam.tz = 2.0; PW.settle(); R.fx = []; R.texts = []; R.flash = null; R.revealAnims = []; R.oldFog = null; R.time = 12; for (let i = 0; i < 3; i++) R.render(0.05);
        const p = PW.tileScreen(h), d = R.dpr || 1, o = document.createElement('canvas'); o.width = 520; o.height = 320; o.getContext('2d').drawImage(R.canvas, Math.round(p.x * d - 260), Math.round(p.y * d - 200), 520, 320, 0, 0, 520, 320); return o.toDataURL('image/png'); }, kind);
      cells.push({ label: kind + ' · ' + tag + ' (staged)', url }); await ctx.close(); }
    await sheet(browser, cells, roots.length * 2, 390, 240, 'weather.jpg'); manifest.sheets.push({ file: 'reports/visual-qa/weather.jpg', content: 'each weather kind staged over the same town at zoom 2.0 (display-only front), ' + roots.map(r => r[0]).join(' vs ') }); }
  // 2j. heraldry: every pantheon's territory pattern over light grass, dark forest, wet shore and mountain rock, before and after
  { const cells = [];
    for (const [tag, root] of roots) { const ctx = await browser.newContext(), page = await ctx.newPage(); await page.goto('file://' + path.join(root, 'index.html') + '?nosave=1'); await page.waitForFunction(() => window.PWArt && window.PW_DATA);
      cells.push({ label: 'territory patterns over four grounds · ' + tag, url: await page.evaluate(() => { const A = PWArt, D = PW_DATA, c = document.createElement('canvas'); c.width = 600; c.height = 250; const g = c.getContext('2d'); g.fillStyle = '#141824'; g.fillRect(0, 0, 600, 250);
        ['#8ab84e', '#2f5a30', '#5a8a9a', '#8a8478'].forEach((bg, row) => D.factions.forEach((f, i) => { const x = 6 + i * 59, y = 6 + row * 60; g.fillStyle = bg; g.fillRect(x, y, 54, 54); g.fillStyle = A.rgba(f.palette.secondary, 0.25); g.fillRect(x, y, 54, 54); g.globalAlpha = 0.6; g.fillStyle = g.createPattern(A.pattern(f.pattern, A.shade(f.palette.secondary, 0.45), 2), 'repeat'); g.fillRect(x, y, 54, 54); g.globalAlpha = 1; }));
        return c.toDataURL('image/png'); }) }); await ctx.close(); }
    await sheet(browser, cells, roots.length, 600, 250, 'heraldry.jpg'); manifest.sheets.push({ file: 'reports/visual-qa/heraldry.jpg', content: 'the ten territory patterns (as the overlay draws them) over light, dark, wet and rocky ground, ' + roots.map(r => r[0]).join(' vs ') }); }
  // 2k. motion: forest canopies in a storm and the rain, six frames 0.15 s apart (after); a shrine-raised transition, six frames (after, staged)
  { const { ctx, page } = await play(browser, ROOT, 'norse', 33, 4);
    const frames = await page.evaluate(() => { const R = PW.renderer, s = PW.state, E = PW.E, out = [], t = s.map.tiles.find(x => x.terrain === 'forest' && s.players[0].revealed[x.id] && x.n.every(n => n < 0 || s.players[0].revealed[n])) || s.map.tiles[s.settlements[s.players[0].home].tile];
      s.climate.fronts = [{ id: 98, kind: 'storm', tile: t.id, radius: 2, phase: 'active', t0: s.turn, t1: s.turn + 3 }]; R.setState(s, 0); PW.focus(t.id); R.cam.tz = 3; PW.settle(); R.fx = []; R.texts = []; R.flash = null; R.reducedFlash = true;
      const grab = (lbl, id) => { const p = PW.tileScreen(id), d = R.dpr || 1, o = document.createElement('canvas'); o.width = 360; o.height = 240; o.getContext('2d').drawImage(R.canvas, Math.round(p.x * d - 180), Math.round(p.y * d - 170), 360, 240, 0, 0, 360, 240); out.push({ label: lbl, url: o.toDataURL('image/png') }); };
      for (let k = 0; k < 6; k++) { R.render(0.15); grab('forest in a storm t=' + (0.15 * (k + 1)).toFixed(2) + ' s', t.id); }
      s.climate.fronts = []; const town = s.settlements.find(x => s.players[0].revealed[x.tile] && !x.shrine) || s.settlements[s.players[0].home], a = E.clone(s), b = E.clone(s); b.turn = a.turn + 1; if (!b.settlements[town.id].shrine) b.settlements[town.id].shrine = JSON.parse(JSON.stringify(s.settlements[s.players[0].home].shrine));
      R.setState(a, 0); R.prevViewer = 0; R.setState(b, 0); PW.focus(town.tile); R.cam.tz = 3; PW.settle();
      for (let k = 0; k < 6; k++) { R.render(0.25); grab('shrine raised t=' + (0.25 * (k + 1)).toFixed(2) + ' s (staged)', town.tile); }
      return out; });
    await ctx.close(); await sheet(browser, frames, 6, 360, 240, 'motion.jpg'); manifest.sheets.push({ file: 'reports/visual-qa/motion.jpg', content: 'frame sequences in the running game (after): forest canopies and rain in a storm (staged front), and the shrine-raised transition (staged state change)' }); }
  // 2l. the tapestry of one finished game (Hierophant suggestions as the human's moves to turn 45), before and after
  { const cells = [];
    for (const [tag, root] of roots) { const { ctx, page } = await play(browser, root, 'mexica', 61, 99);
      const ok = await page.evaluate(() => !!PW.state.over); if (!ok) { errors.push('tapestry: game did not finish (' + tag + ')'); await ctx.close(); continue; }
      await page.evaluate(() => { document.getElementById('victory').hidden = true; PW.openChronicle(); }); await page.waitForSelector('#chronicle:not([hidden])', { timeout: 120000 });
      await page.click('#chron-tapestry'); await page.waitForTimeout(3200);
      cells.push({ label: 'tapestry · ' + tag, url: await page.evaluate(() => { const c = document.querySelector('#tapestry canvas'); return c.toDataURL('image/png'); }) }); await ctx.close(); }
    if (cells.length) { await sheet(browser, cells, cells.length, 800, 500, 'tapestry.jpg'); manifest.sheets.push({ file: 'reports/visual-qa/tapestry.jpg', content: 'the exported tapestry image of one finished game (same seed and moves), ' + roots.map(r => r[0]).join(' vs ') }); } }
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
