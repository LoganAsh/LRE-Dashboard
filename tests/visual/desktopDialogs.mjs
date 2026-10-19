// node desktopDialogs.mjs --url http://127.0.0.1:5199/ --out DIR   — open each pop-up on DESKTOP and screenshot it
import fs from 'node:fs';
import { launch, openApp, shot, DESKTOP } from './harness.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; };
const base = arg('url', 'http://127.0.0.1:5199/'), out = arg('out', '/tmp/dlg'); fs.mkdirSync(out, { recursive: true });
const scenarios = [
  ['status-window', 'Bid Dashboard', [['sel', 'button[aria-haspopup="dialog"]', 'Draper Retail Pad']]],
  ['client-details', 'Clients', [['sel', 'button[data-client-open]', '']]],
  ['task-editor', 'Projects', [['sel', 'button[aria-controls^="tasks-panel"]', ''], ['sel', '[data-task-title]', 'Order 18-inch RCP']]],
  ['project-form', 'Projects', [['sel', 'button', 'Edit']]],
  ['sov-editor', 'Projects', [['sel', 'button', 'Schedule of Values']]],
  ['roster', 'Weekly Schedule', [['sel', 'button', 'Manage Roster']]],
  ['plan-editor', 'Weekly Schedule', [['sel', 'button', 'Edit']]],
];
const browser = await launch();
for (const [name, tab, steps] of scenarios) {
  const page = await openApp(browser, { url: base, viewport: DESKTOP, tab });
  for (const [, sel, txt] of steps) {
    await page.evaluate((sel, txt) => { const el = [...document.querySelectorAll(sel)].find((e) => (e.textContent || '').trim().includes(txt) && e.offsetParent !== null); if (el) el.click(); }, sel, txt);
    await new Promise((r) => setTimeout(r, 900));
  }
  await shot(page, `${out}/${name}.png`); console.log(name.padEnd(16), page.__errors.filter((e) => !/favicon/.test(e)).length ? 'ERRORS' : 'ok');
  await page.close();
}
await browser.close();
