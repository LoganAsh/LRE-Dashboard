// node tests/visual/topShots.mjs PREFIX [--dark] — the phone Dashboard at the top of the page, plus how tall the top cards are
import { launch, openApp, PHONE } from './harness.mjs';
const prefix = process.argv[2], dark = process.argv.includes('--dark');
const b = await launch(); const p = await openApp(b, { url: 'http://127.0.0.1:5199/', viewport: PHONE, tab: 'Bid Dashboard', dark }); await new Promise((r) => setTimeout(r, 800));
const m = await p.evaluate(() => { const r = (s) => Math.round(document.querySelector(s).getBoundingClientRect().height); const top = (s) => Math.round(document.querySelector(s).getBoundingClientRect().top);
  const tb = document.querySelector('.m-tabbar').getBoundingClientRect().top;
  const rows = [...document.querySelectorAll('.m-row[role=button]')].filter((x) => { const q = x.getBoundingClientRect(); return q.top >= 0 && q.bottom <= tb; }).length;
  return { heroPx: r('.m-hero'), statTilesPx: r('.m-stats'), listStartsAtY: top('section[aria-label="Upcoming Bids"]'), bidLinesFullyVisibleOnOpen: rows }; });
await p.screenshot({ path: `${prefix}.png` }); console.log(prefix, JSON.stringify(m)); await p.close(); await b.close();
