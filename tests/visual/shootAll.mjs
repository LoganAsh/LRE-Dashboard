// node tests/visual/shootAll.mjs --viewport desktop|phone --out DIR [--dark] [--tabs "Bid Log,Calendar"]
import fs from 'node:fs';
import { launch, openApp, shot, PHONE, DESKTOP } from './harness.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : d; };
const viewport = arg('width', '') ? { width: +arg('width'), height: +arg('height', 900), deviceScaleFactor: 1 } : (arg('viewport', 'phone') === 'desktop' ? DESKTOP : PHONE); const out = arg('out', '/tmp/shots'); const dark = !!arg('dark', false);
const TABS = ['Bid Dashboard', 'Calendar', 'Overview', 'Trends', 'Clients', 'Client Analytics', 'Bid Log', 'Projects', 'Weekly Schedule', 'Takeoff'];
const base = String(arg('url', 'http://127.0.0.1:5199/'));
const tabs = arg('tabs', '') ? String(arg('tabs')).split(',') : TABS;
fs.mkdirSync(out, { recursive: true });
const browser = await launch();
for (const tab of tabs) {
  const page = await openApp(browser, { url: base, viewport, tab, dark });
  await new Promise((r) => setTimeout(r, 1400));       // let charts finish drawing
  const f = `${out}/${tab.replace(/\s+/g, '-').toLowerCase()}.png`;
  await shot(page, f);
  const errs = page.__errors.filter((e) => !/favicon/.test(e));
  console.log(tab.padEnd(18), 'saved', errs.length ? `  PAGE ERRORS: ${errs.slice(0, 2).join(' | ').slice(0, 160)}` : '');
  await page.close();
}
await browser.close();
