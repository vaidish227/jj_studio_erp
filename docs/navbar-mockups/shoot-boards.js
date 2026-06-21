const path = require('path');
const puppeteer = require(path.join('d:/D-Table/JJ Studio/ERP/backend', 'node_modules', 'puppeteer'));

(async () => {
  const dir = __dirname;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 800, deviceScaleFactor: 2 });

  // Board 1: options A–D
  await page.goto('file://' + path.join(dir, 'navbar-mockups.html').replace(/\\/g, '/'));
  await page.screenshot({ path: path.join(dir, 'board-A-D.png'), fullPage: true });

  // Board 2: options E–J
  await page.goto('file://' + path.join(dir, 'navbar-mockups-2.html').replace(/\\/g, '/'));
  await page.screenshot({ path: path.join(dir, 'board-E-J.png'), fullPage: true });

  await browser.close();
  console.log('done');
})();
