#!/usr/bin/env node
/*
 * Asset manifest + QA atlas. Every visual in the game is drawn by code at runtime (no image files ship), so the "assets" are
 * the drawing functions and their ids. This tool renders each one in Chromium into contact sheets (reports/atlas/*.png)
 * and writes data/asset-manifest.json with id, kind, drawing function, users in the data, and provenance.
 *   node tools/assets.js
 */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'reports', 'atlas'); fs.mkdirSync(OUT, { recursive: true });
const D = require('./load-data.js')();
const ids = require('./validate-data.js').artIds();

(async () => {
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'index.html') + '?seed=1&nosave=1'); await page.waitForTimeout(300);
  const sheets = await page.evaluate(() => {
    const A = PWArt, D = PW_DATA, out = {};
    function sheet(name, cells, cw, ch, cols) {
      const rows = Math.ceil(cells.length / cols), c = document.createElement('canvas'); c.width = cols * cw; c.height = rows * (ch + 16) + 8;
      const g = c.getContext('2d'); g.fillStyle = '#141824'; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingEnabled = false; g.font = '10px sans-serif'; g.fillStyle = '#e6dcc2';
      cells.forEach((cell, i) => { const x = (i % cols) * cw, y = Math.floor(i / cols) * (ch + 16) + 4; const img = cell.img, s = Math.min((cw - 8) / img.width, (ch - 4) / img.height, 4);
        g.drawImage(img, x + (cw - img.width * s) / 2, y + (ch - img.height * s) / 2, img.width * s, img.height * s); g.fillStyle = '#e6dcc2'; g.fillText(cell.label.slice(0, Math.floor(cw / 5.5)), x + 4, y + ch + 11); });
      out[name] = c.toDataURL('image/png');
    }
    const F = D.factions;
    sheet('emblems-patterns', [].concat(...F.map(f => [{ img: A.emblem(f.emblem, f.palette, 64), label: f.emblem }, { img: A.pattern(f.pattern, A.shade(f.palette.secondary, 0.45), 4), label: f.pattern }])), 110, 80, 10);
    sheet('power-icons', D.powers.map(p => ({ img: A.icon(p.icon, 48), label: p.icon })), 100, 64, 10);
    sheet('rite-icons', A.ids.icons.filter(i => !D.powers.some(p => p.icon === i)).map(i => ({ img: A.icon(i, 48), label: i })), 100, 64, 10);
    const conds = A.ids.conditions;
    sheet('shrines-conditions', [].concat(...F.map(f => { const s = D.shrines.find(x => x.id === f.shrine); return conds.map(c => ({ img: A.shrineArt(s.art, f.palette, c, null), label: s.art + ' ' + c })); })), 110, 110, conds.length);
    sheet('shrine-specs', [].concat(...F.map(f => { const s = D.shrines.find(x => x.id === f.shrine); return ['oracle', 'sanctuary', 'beacon'].map(sp => ({ img: A.shrineArt(s.art, f.palette, 'healthy', sp), label: s.art + ' ' + sp })); })), 110, 110, 6);
    sheet('priests', [].concat(...F.map(f => [].concat(...['emissary', 'seer', 'warden'].map(r => [0, 1, 2, 3, 4, 5].map(fr => ({ img: A.priestSprite(f.priestStyle, r, f.palette, fr), label: f.priestStyle + ' ' + r[0] + fr })))))), 70, 90, 18);
    // ten architectural kits: tiers 1-5 by day, then tier 4 at Twilight in decline with an older patron's houses on the outer plots
    sheet('villages', [].concat(...A.ids.kits.map((k, ki) => [1, 2, 3, 4, 5].map(t => ({ img: A.village({ id: ki * 7 + t, tier: t, decline: 0, night: 0, cold: 0, styles: Array(2 + t + (t > 2 ? 1 : 0)).fill(k), current: k, biome: 'tile' }).c, label: k + ' tier ' + t }))
      .concat([{ img: A.village({ id: ki * 7 + 9, tier: 4, decline: 1, night: 1, cold: 0, styles: Array(7).fill(k).map((s, i) => i < 3 ? s : A.ids.kits[(ki + 3) % 10]), current: k, biome: 'tile' }).c, label: k + ' night, decline, mixed' }]))), 160, 116, 6);
    sheet('landmarks', A.ids.landmarks.map(l => ({ img: A.landmarkSprite(l, 0), label: l })), 120, 100, 4);
    sheet('event-art', [].concat(...D.events.map(e => ['dawn', 'zenith', 'twilight'].slice(0, 1).map(a => ({ img: A.eventArt(e.art, 7, a), label: e.art })))), 180, 104, 5);
    sheet('event-art-ages', ['dawn', 'zenith', 'twilight'].map(a => ({ img: A.eventArt('comet', 7, a), label: 'comet ' + a })), 180, 104, 3);
    return out;
  });
  const written = [];
  for (const [name, url] of Object.entries(sheets)) { const f = path.join(OUT, name + '.png'); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); written.push(path.relative(ROOT, f)); }
  // VFX sheet: freeze each power's three-beat signature mid-cast on a live map
  await page.goto('file://' + path.join(ROOT, 'index.html') + '?seed=2&autostart=1&nosave=1&speed=0&faction=greek&quality=high'); await page.waitForTimeout(500);
  const vfxShots = [];
  for (const id of ids.vfx.filter(v => D.powers.some(p => p.vfx === v)).slice(0, 40)) {
    await page.evaluate(v => { const s = PW.state, t = s.settlements[s.players[0].home].tile; PW.renderer.fx = []; PW.renderer.texts = []; PW.focus(t); PW.settle(); PW.renderer.playVfx(v, t, { label: v, tiles: [t] }); }, id);
    await page.waitForTimeout(450);
    const buf = await page.screenshot({ clip: { x: 520, y: 250, width: 400, height: 300 } }); vfxShots.push({ id, buf });
  }
  fs.mkdirSync(path.join(OUT, 'vfx'), { recursive: true });
  vfxShots.forEach(v => fs.writeFileSync(path.join(OUT, 'vfx', v.id + '.png'), v.buf));
  await browser.close();

  const used = (k, pred) => D[k].filter(pred).map(x => x.id);
  const provenance = 'Original procedural drawing written for Pantheon Wars; rendered at runtime from code; no third-party image, font or sample.';
  const items = [];
  const add = (kind, id, fn, users) => items.push({ id, kind, drawnBy: fn, usedBy: users, provenance, license: 'same as the repository', review: 'rendered in reports/atlas' });
  ids.emblems.forEach(i => add('emblem', i, 'ui/art.js EMBLEMS.' + i, used('factions', f => f.emblem === i)));
  ids.patterns.forEach(i => add('heraldic pattern', i, 'ui/art.js PATTERNS.' + i, used('factions', f => f.pattern === i)));
  ids.priests.forEach(i => add('priest family (3 callings x 6 frames, 28x40 at 2x, feet at 13,38)', i, 'ui/kits.js DRESS.' + i, used('factions', f => f.priestStyle === i)));
  ids.atmospheres.forEach(i => add('atmosphere', i, 'ui/art.js ATMOS.' + i, used('factions', f => f.atmosphere === i)));
  ids.shrines.forEach(i => add('shrine (7 conditions + 3 callings, 88x100 at 2x, base y 92)', i, 'ui/kits.js SH.' + i, used('shrines', s => s.art === i)));
  ids.icons.forEach(i => add('icon', i, 'ui/art.js ICONS.' + i, used('powers', p => p.icon === i)));
  ids.landmarks.forEach(i => add('landmark', i, 'ui/kits.js LM.' + i + ' (64x56 at 2x, base y 52)', []));
  ids.kits.forEach(i => add('architectural kit (house, monument, enclosure, props; village 144x104 at 2x, ground 72,76)', i, 'ui/kits.js KITS.' + i, used('factions', f => f.id === i)));
  ids.props.forEach(i => add('kit prop', i, 'ui/kits.js PROP.' + i, []));
  ids.events.forEach(i => add('event illustration (3 age palettes)', i, 'ui/art.js eventArt(' + i + ')', used('events', e => e.art === i)));
  ids.vfx.forEach(i => add('VFX signature (gather, release, aftermath)', i, 'ui/render.js VFX.' + i, used('powers', p => p.vfx === i)));
  const orphans = items.filter(x => ['icon', 'VFX signature (gather, release, aftermath)'].indexOf(x.kind) < 0 && x.kind !== 'landmark' && x.kind !== 'kit prop' && !x.usedBy.length && x.kind.indexOf('event') < 0).map(x => x.kind + ':' + x.id);
  const manifest = { generated: new Date().toISOString().slice(0, 10), note: 'Pantheon Wars ships no image, audio or font files. All art and sound are generated by code at runtime; this manifest lists every drawing id, where it is drawn and what uses it.', audio: 'ui/audio.js: Web Audio synthesis (oscillators and noise), original motifs per pantheon; no samples.', fonts: 'System font stacks only.', resolution: 'v0.4: standing objects (village kits, shrines, priests, landmarks) are authored at 2x in ui/kits.js and drawn in screen space at their world size, so at normal zoom one source pixel is about one screen pixel; sizes and ground anchors are in each kind. Terrain, icons, emblems, event art and VFX are unchanged v0.3 procedural art.', counts: Object.fromEntries(Object.entries(ids).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length])), atlas: written.concat(['reports/atlas/vfx/*.png (' + vfxShots.length + ')']), orphans, items };
  fs.writeFileSync(path.join(ROOT, 'data', 'asset-manifest.json'), JSON.stringify(manifest, null, 1));
  console.log('atlas sheets:', written.length, 'vfx frames:', vfxShots.length, 'manifest items:', items.length, 'orphans:', orphans.length, 'page errors:', errors.length);
  if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
})();
