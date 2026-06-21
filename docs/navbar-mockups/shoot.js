const path = require('path');
const puppeteer = require(path.join('d:/D-Table/JJ Studio/ERP/backend', 'node_modules', 'puppeteer'));

(async () => {
  const dir = __dirname;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 1400, deviceScaleFactor: 2 });
  await page.goto('file://' + path.join(dir, 'navbar-mockups.html').replace(/\\/g, '/'));

  // Full board
  await page.screenshot({ path: path.join(dir, 'all-options.png') });

  // Each option cropped
  for (const id of ['optA', 'optB', 'optC', 'optD']) {
    const el = await page.$('#' + id);
    await el.screenshot({ path: path.join(dir, id + '.png') });
  }

  await browser.close();
  console.log('done');
})();
