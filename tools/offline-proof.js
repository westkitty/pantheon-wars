#!/usr/bin/env node
/*
 * A010 offline distribution proof: loads the game from file:// and from a local static server (python3 -m http.server),
 * starts a match, opens the encyclopedia, and records every request that is not file:, data:, blob: or the local server.
 * Writes reports/offline-proof.json. Nothing is deployed.
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), PORT = 8765;
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 900));
  const browser = await chromium.launch(), out = { generated: new Date().toISOString(), runs: [] };
  for (const base of ['file://' + path.join(ROOT, 'index.html'), `http://127.0.0.1:${PORT}/index.html`]) {
    const page = await browser.newPage(), external = [], local = [], errors = [], optional = [];
    page.on('request', r => { const u = r.url(); if (/^(file|data|blob):/.test(u) || u.startsWith(`http://127.0.0.1:${PORT}/`)) local.push(u.replace(ROOT, '.')); else external.push(u); });
    // a recording whose load is cancelled because the director released that track (net::ERR_ABORTED) is expected and listed apart;
    // any other failed request, a missing recording included, is an error
    page.on('requestfailed', r => (/\/audio\/music\/[a-z0-9-]+\.mp3$/.test(r.url()) && /ERR_ABORTED/.test((r.failure() || {}).errorText || '') ? optional : errors).push('failed: ' + r.url().replace(ROOT, '.') + ' ' + (r.failure() || {}).errorText));
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '?seed=3&autostart=1&nosave=1&speed=0'); await page.waitForTimeout(800);
    await page.click('#btn-codex'); await page.waitForTimeout(300); await page.keyboard.press('Escape');
    await page.click('#btn-menu'); await page.click('#menu-chronicle'); await page.waitForTimeout(500);
    const ok = await page.evaluate(() => !!(window.PW && PW.state && PW.state.players.length === 2));
    out.runs.push({ base: base.replace(ROOT, '.'), started: ok, localRequests: [...new Set(local.map(u => u.split('?')[0]))], externalRequests: external, errors, cancelledSoundtrackLoads: optional, soundtrackRequests: [...new Set(local.filter(u => /\/audio\/music\//.test(u)).map(u => u.split('?')[0]))] });
    await page.close();
  }
  await browser.close(); srv.kill();
  // static scan: no absolute http(s) URLs in shipped code paths other than source citations (opened only on player click)
  const shipped = ['index.html', 'ui/style.css', 'ui/app.js', 'ui/art.js', 'ui/kits.js', 'ui/vfx-art.js', 'ui/terrain-art.js', 'ui/render.js', 'ui/audio.js', 'ui/music.js', 'audio/soundtrack.js', 'ui/storage.js', 'ui/chronicle.js', 'ui/encyclopedia.js', 'engine/engine.js', 'engine/ai.js', 'engine/rng.js'];
  out.staticScan = shipped.map(f => ({ file: f, absoluteUrls: (fs.readFileSync(path.join(ROOT, f), 'utf8').match(/https?:\/\/[^\s'"<>)]+/g) || []) }));
  out.pass = out.runs.every(r => r.started && !r.externalRequests.length && !r.errors.length) && out.staticScan.every(s => !s.absoluteUrls.length);
  fs.writeFileSync(path.join(ROOT, 'reports', 'offline-proof.json'), JSON.stringify(out, null, 1));
  console.log(out.pass ? 'PASS' : 'FAIL', JSON.stringify(out.runs.map(r => ({ base: r.base, started: r.started, local: r.localRequests.length, external: r.externalRequests.length, errors: r.errors }))), JSON.stringify(out.staticScan.filter(s => s.absoluteUrls.length)));
  process.exit(out.pass ? 0 : 1);
})();
