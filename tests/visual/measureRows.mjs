// node tests/visual/measureRows.mjs — how many bid lines are visible at once on the phone, and how tall each one is
import { launch, openApp, PHONE } from './harness.mjs';
const b = await launch(); const out = {};
for (const [tab, sel] of [['Bid Dashboard', '.m-row[role=button]'], ['Bid Log', '.m-card .m-row']]) {
  const p = await openApp(b, { url: 'http://127.0.0.1:5199/', viewport: PHONE, tab }); await new Promise((r) => setTimeout(r, 700));
  out[tab] = await p.evaluate((sel) => {
    const tabbarTop = document.querySelector('.m-tabbar').getBoundingClientRect().top;
    const rows = [...document.querySelectorAll(sel)]; const hs = rows.slice(0, 12).map((r) => Math.round(r.getBoundingClientRect().height));
    const fully = rows.filter((r) => { const b = r.getBoundingClientRect(); return b.top >= 0 && b.bottom <= tabbarTop; }).length;
    const avg = Math.round(hs.reduce((a, c) => a + c, 0) / hs.length);
    return { avgHeightPx: avg, rowHeights: hs.join(','), fullyVisibleAtTopOfScreen: fully };
  }, sel);
  await p.close();
}
// scrolled down a screen: how many rows are visible in the middle of the list (the dashboard's top tiles no longer take space)
const p = await openApp(b, { url: 'http://127.0.0.1:5199/', viewport: PHONE, tab: 'Bid Dashboard' }); await new Promise((r) => setTimeout(r, 600));
out['Bid Dashboard, scrolled to the list'] = await p.evaluate(() => { const first = document.querySelector('.m-row[role=button]'); window.scrollTo(0, first.getBoundingClientRect().top + window.scrollY - 70); const tb = document.querySelector('.m-tabbar').getBoundingClientRect().top; const hdr = document.querySelector('.m-header').getBoundingClientRect().bottom; return { fullyVisible: [...document.querySelectorAll('.m-row[role=button]')].filter((r) => { const b = r.getBoundingClientRect(); return b.top >= hdr && b.bottom <= tb; }).length }; });
console.log(JSON.stringify(out, null, 1)); await b.close();
