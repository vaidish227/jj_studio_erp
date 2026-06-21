const path = require('path');
const puppeteer = require(path.join('d:/D-Table/JJ Studio/ERP/backend', 'node_modules', 'puppeteer'));

(async () => {
  const dir = __dirname;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 1700, deviceScaleFactor: 2 });
  await page.goto('file://' + path.join(dir, 'navbar-mockups-2.html').replace(/\\/g, '/'));

  for (const id of ['optE', 'optF', 'optG', 'optH', 'optI', 'optJ']) {
    const el = await page.$('#' + id);
    await el.screenshot({ path: path.join(dir, id + '.png') });
  }
  await browser.close();
  console.log('done');
})();
