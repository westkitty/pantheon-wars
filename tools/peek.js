// quick dev screenshot: node tools/peek.js "<query>" out.png [w h waitMs]
const puppeteer = require('/workspace/dexter-test/node_modules/puppeteer-core');
const path = require('path');
(async () => {
  const [q, out, w = 1600, h = 900, ms = 2500] = process.argv.slice(2);
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(); await p.setViewport({ width: +w, height: +h });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html') + (q ? '?' + q : ''));
  await new Promise(r => setTimeout(r, +ms));
  await p.screenshot({ path: out });
  const info = await p.evaluate(() => ({ ms: window.PW && PW.renderer.lastFrameMs, q: window.PW && PW.renderer.quality }));
  console.log(JSON.stringify({ errs, info }));
  await b.close();
})();
