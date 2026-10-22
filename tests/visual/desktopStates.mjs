// node desktopStates.mjs --url URL --out DIR — desktop screens in non-default states (sorted, filtered, other views)
import fs from 'node:fs';
import { launch, openApp, shot, DESKTOP } from './harness.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; };
const base = arg('url'), out = arg('out'); fs.mkdirSync(out, { recursive: true });
const S = [
  ['log-won', 'Bid Log', [['button', 'Won']]],
  ['log-sort-amount', 'Bid Log', [['button', 'Bid Amount'], ['button', 'Bid Amount']]],
  ['log-search', 'Bid Log', [['type', 'input.search-input', 'Eagle']]],
  ['log-lost', 'Bid Log', [['button', 'Lost']]],
  ['cal-week', 'Calendar', [['button', 'Week']]],
  ['cal-list', 'Calendar', [['button', 'List']]],
  ['cal-billing', 'Calendar', [['button', 'Billing']]],
  ['proj-tasks-board', 'Projects', [['button', 'Show Tasks'], ['button', 'Board']]],
  ['proj-active', 'Projects', [['button', 'Active']]],
  ['clients-sort-winrate', 'Clients', [['select', 'select[aria-label="Sort clients"]', 'winrate']]],
  ['overview-2025', 'Overview', [['button', '2025']]],
  ['trends-public', 'Trends', [['button', 'Public']]],
  ['dash-notbidding', 'Bid Dashboard', [['button', 'Show']]],
];
const browser = await launch();
{ const w = await openApp(browser, { url: base, viewport: DESKTOP, tab: 'Bid Log' }); await w.close(); }   // warm the dev server first
for (const [name, tab, steps] of S) {
  const page = await openApp(browser, { url: base, viewport: DESKTOP, tab });
  for (let i = 0; i < 3; i++) { try { await page.waitForSelector('.app-shell', { timeout: 8000 }); break; } catch { await page.reload({ waitUntil: 'networkidle2' }); } }   // a dev server can reload itself once; wait for the app
  await new Promise((r) => setTimeout(r, 600));
  for (const st of steps) {
    if (st[0] === 'button') await page.waitForFunction((t) => [...document.querySelectorAll('button')].some((b) => b.textContent.trim().startsWith(t) && b.offsetParent !== null), { timeout: 6000 }, st[1]).catch(() => console.log('  (no such button on this page: ' + st[1] + ')'));
    else if (st[0] === 'type' || st[0] === 'select') await page.waitForSelector(st[1], { timeout: 6000 }).catch(() => console.log('  (no such control on this page: ' + st[1] + ')'));
    if (st[0] === 'button') await page.evaluate((t) => { const el = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t) && b.offsetParent !== null); if (el) el.click(); }, st[1]);
    else if (st[0] === 'type') { await page.focus(st[1]); await page.keyboard.type(st[2]); }
    else if (st[0] === 'select') await page.select(st[1], st[2]);
    await new Promise((r) => setTimeout(r, 500));
  }
  await new Promise((r) => setTimeout(r, 1300)); await shot(page, `${out}/${name}.png`); await page.close();
}
await browser.close(); console.log('states captured:', S.length);
