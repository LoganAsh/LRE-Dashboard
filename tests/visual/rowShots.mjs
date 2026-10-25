// node tests/visual/rowShots.mjs PREFIX [--dark] — phone screenshots of the two bid lists, at the point where the list is on screen
import { launch, openApp, shot, PHONE } from './harness.mjs';
const prefix = process.argv[2], dark = process.argv.includes('--dark');
const b = await launch();
let p = await openApp(b, { url: 'http://127.0.0.1:5199/', viewport: PHONE, tab: 'Bid Dashboard', dark }); await new Promise((r) => setTimeout(r, 700));
await p.evaluate(() => { const g = document.querySelector('.m-group-head'); window.scrollTo(0, g.getBoundingClientRect().top + window.scrollY - 80); }); await new Promise((r) => setTimeout(r, 400));
await p.screenshot({ path: `${prefix}-dash.png` }); await p.close();
p = await openApp(b, { url: 'http://127.0.0.1:5199/', viewport: PHONE, tab: 'Bid Log', dark }); await new Promise((r) => setTimeout(r, 700));
await p.evaluate(() => window.scrollTo(0, 120)); await new Promise((r) => setTimeout(r, 400));
await p.screenshot({ path: `${prefix}-log.png` }); await p.close(); await b.close(); console.log('shots:', prefix);
