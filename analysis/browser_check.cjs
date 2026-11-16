// Run with Node.js and playwright-core; set BROWSER_EXECUTABLE to a local Chromium browser.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');

const docs = path.resolve(__dirname, '../docs');
const prefix = '/sna-j-gharchive/';
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};

async function main() {
  const data = JSON.parse(await fs.readFile(path.join(docs, 'data.json'), 'utf8'));
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    try {
      if (!pathname.startsWith(prefix)) throw new Error('Out of scope');
      const file = path.resolve(docs, pathname.slice(prefix.length) || 'index.html');
      if (!file.startsWith(docs + path.sep)) throw new Error('Out of scope');
      const body = await fs.readFile(file);
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE });
    const url = `http://127.0.0.1:${server.address().port}${prefix}`;
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && message.text().includes('Failed to load research')) errors.push(message.text());
    });
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
    await page.goto(url);
    await page.locator('#afterRemoval svg').waitFor();

    const integer = value => Number(value.replaceAll(',', ''));
    assert.equal(integer(await page.locator('#statRows').innerText()), data.metadata.rawRows);
    assert.equal(await page.locator('.repo-chip').count(), data.repositories.length);
    assert.equal(await page.locator('#overlapList .overlap-item').count(), 3);
    assert.equal(await page.locator('#weeklyChart .week-row').count(), 4);
    assert.equal(await page.locator('#centralityGrid .centrality-card').count(), 4);
    for (const layer of ['all', 'issues', 'discussion', 'pulls', 'reviews']) {
      const view = data.views[layer];
      const filter = page.locator(`#layerFilters [data-layer="${layer}"]`);
      await filter.click();
      assert.equal(await filter.getAttribute('aria-pressed'), 'true');
      assert.equal(integer(await page.locator('#viewEvents').innerText()), view.events);
      assert.equal(await page.locator('.graph-actor').count(), view.sampleActors.length);
      const nodes = page.locator('.top-bridge');
      assert.equal(await nodes.count(), view.bridgeLayer?.top.length || 0);
      if (view.bridgeLayer?.top.length) assert.equal(await nodes.first().getAttribute('data-id'), view.bridgeLayer.top[0]);
    }
    const repo = page.locator('.graph-repo').first();
    await repo.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#detailPanel h3').innerText(), data.repositories[0].label);
    assert.equal(await page.locator('.graph-edge.active').count() > 0, true);
    await page.locator('.top-bridge').first().click();
    assert.equal(await page.locator('#detailPanel h3').innerText(), data.views.reviews.bridgeLayer.top[0]);
    await page.locator('#resetSelection').click();
    assert.equal(await page.locator('.graph-edge.active').count(), 0);
    assert.match(await page.locator('#detailPanel').innerText(), /選一個節點/);

    await page.locator('#review-interaction > summary').click();
    const account = Object.keys(data.reviewNetwork.analysis.scores).sort().at(-1);
    await page.locator('#reviewAccount').selectOption(account);
    await page.locator('#reviewEgo summary').click();
    assert.equal(await page.locator('#reviewEgo tbody tr').count(),
      data.reviewNetwork.analysis.arcs.filter(([a, b]) => a === account || b === account).length);
    assert.equal(await page.locator('#constraintPlot circle').count(), data.reviewNetwork.analysis.nodes);
    assert.equal(await page.locator('#constraintPlot .candidate-dot').count(), data.reviewNetwork.analysis.candidates.length);
    assert.equal(await page.locator('#removalResults polyline').count(), 9);
    await page.locator('#attackStrategy').selectOption('degree');
    await page.locator('#attackStep').selectOption('3');
    const row = data.robustness.rows.find(r => r.removed === 3).degree;
    assert.equal(await page.locator('#afterRemoval .removal-edge').count(), row.edges);
    assert.equal(await page.locator('#afterRemoval .removal-repo').count(), data.repositories.length);
    assert.equal(await page.locator('#afterRemoval .removal-actor').count(), data.robustness.accounts - 3);
    assert.match(await page.locator('#afterCaption').innerText(), new RegExp(`${row.edges} 邊`));
    const download = await page.request.get(url + 'repro/bridge-scores.csv');
    assert(download.ok());
    assert.match(await download.text(), /^network,actor_login,degree/);
    await page.locator('#fullscreenBtn').click();
    await page.waitForFunction(() => document.fullscreenElement !== null);
    await page.locator('#fullscreenBtn').click();
    await page.waitForFunction(() => document.fullscreenElement === null);
    assert.deepEqual(errors, []);
    if (process.env.BROWSER_QA_DIR) await page.locator('#rq3').screenshot({ path: path.join(process.env.BROWSER_QA_DIR, 'rq3-desktop.png') });

    await page.getByRole('link', { name: '白話導讀 ↗' }).click();
    await page.locator('#reading .chapter').first().waitFor();
    assert.equal(await page.locator('#reading .chapter').count(), 6);
    assert.equal((await page.request.get(url + 'repro/method.md')).ok(), true);

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await mobile.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
    await mobile.goto(url + '#rq2');
    await mobile.locator('#constraintPlot svg').waitFor();
    for (const id of ['#bridgeResults summary', '#reviewResults summary', '#removalResults summary', '#review-interaction > summary']) {
      await mobile.locator(id).click();
    }
    assert(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    assert(await mobile.locator('#constraintPlot svg').isVisible());
    if (process.env.BROWSER_QA_DIR) await mobile.locator('#constraintPlot').screenshot({ path: path.join(process.env.BROWSER_QA_DIR, 'constraint-mobile.png') });
    console.log('Passed: original explorer, keyboard, presentation mode, data-bound charts, removal/ego controls, guide, CSV, mobile overflow.');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
