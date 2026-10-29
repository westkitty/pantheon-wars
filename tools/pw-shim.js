// Minimal puppeteer-compatible facade over Playwright (dev-only).
const { chromium } = require('playwright');
module.exports.launch = async function (opts) {
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  return {
    async newPage(ctxOpts) {
      const ctx = await browser.newContext(ctxOpts || { viewport: { width: 1600, height: 900 } });
      const page = await ctx.newPage();
      page.setViewport = async v => { await page.setViewportSize({ width: v.width, height: v.height }); };
      page.emulateMediaFeatures = async f => { for (const x of f) if (x.name === 'prefers-reduced-motion') await page.emulateMedia({ reducedMotion: x.value }); };
      const ev = page.evaluate.bind(page);
      page.evaluate = (fn, ...args) => args.length <= 1 ? ev(fn, ...args) : ev(({ src, args }) => (0, eval)('(' + src + ')')(...args), { src: fn.toString(), args });
      return page;
    },
    close: () => browser.close()
  };
};
