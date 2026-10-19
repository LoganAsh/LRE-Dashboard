// node tests/visual/phoneShots.mjs OUT "Tab:action,..." — screenshot a phone screen, optionally after tapping things
// full-page capture so tall lists can be judged in one picture
import fs from 'node:fs';
import { launch, openApp, shot, PHONE } from './harness.mjs';
const [out, tab, ...rest] = process.argv.slice(2); const dark = process.argv.includes('--dark'); const full = !process.argv.includes('--viewport');
const browser = await launch();
const page = await openApp(browser, { url: 'http://127.0.0.1:5199/', viewport: PHONE, tab, dark, freeze: !process.argv.includes('--live') });
await new Promise((r) => setTimeout(r, 1200));
await shot(page, out, { fullPage: full });
const errs = page.__errors.filter((e) => !/favicon/.test(e)); if (errs.length) console.log('PAGE ERRORS:', errs.slice(0, 3).join(' | ').slice(0, 300));
await browser.close();
