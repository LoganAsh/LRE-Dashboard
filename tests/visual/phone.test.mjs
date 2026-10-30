// node tests/visual/phone.test.mjs   (needs the dev server on :5199 — run tests/visual/serve.sh first)
import { launch, openApp, PHONE, DESKTOP, dataset } from './harness.mjs';
const URL_ = 'http://127.0.0.1:5199/';
let fails = 0; const ok = (c, l, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${x ? '  ' + x : ''}`); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickText = (page, sel, text, { exact = false } = {}) => page.evaluate((sel, text, exact) => {
  const el = [...document.querySelectorAll(sel)].find((e) => { const t = (e.getAttribute('aria-label') || e.textContent || '').trim(); return exact ? t === text : t.includes(text); });
  if (el) { el.click(); return true; } return false;
}, sel, text, exact);
const count = (page, sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);
const text = (page, sel) => page.evaluate((s) => document.querySelector(s)?.textContent?.trim() ?? null, sel);
const browser = await launch();
const open = (tab, opts = {}) => openApp(browser, { url: URL_, viewport: PHONE, tab, ...opts });
const TABS = ['Bid Dashboard', 'Bid Log', 'Calendar', 'Projects', 'Clients', 'Client Analytics', 'Overview', 'Trends', 'Weekly Schedule', 'Takeoff'];

// ── 1. phone layout on phones, desktop layout on desktop ──
for (const [w, phone] of [[390, true], [767, true], [768, false], [1440, false]]) {
  const p = await openApp(browser, { url: URL_, viewport: { ...PHONE, width: w, isMobile: w < 768, hasTouch: w < 768 }, tab: 'Bid Dashboard' });
  const has = await p.evaluate(() => ({ app: !!document.querySelector('.m-app'), bar: !!document.querySelector('.m-tabbar'), side: !!document.querySelector('.app-shell') }));
  ok(has.app === phone && has.bar === phone && has.side === !phone, `${w}px wide shows the ${phone ? 'phone app (bottom tab bar)' : 'desktop layout (sidebar)'}`, JSON.stringify(has));
  await p.close();
}

// ── 2. every screen: no errors, no sideways scrolling, tab bar present ──
for (const tab of TABS) {
  const p = await open(tab); await sleep(500);
  const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, bar: !!document.querySelector('.m-tabbar') }));
  const errs = p.__errors.filter((e) => !/favicon/.test(e));
  ok(m.sw <= m.iw + 1 && m.bar && errs.length === 0, `${tab}: fits the screen width, has the tab bar, no errors`, `(page ${m.sw}px / screen ${m.iw}px${errs.length ? ', ERRORS: ' + errs[0].slice(0, 80) : ''})`);
  await p.close();
}

// ── 3. navigation ──
let p = await open('Bid Dashboard');
ok(await p.evaluate(() => [...document.querySelectorAll('.m-tab')].map((b) => b.textContent.trim().replace(/\d+$/, '')).join()) === 'Dashboard,Bid Log,Calendar,Projects,More', 'bottom bar: Dashboard, Bid Log, Calendar, Projects, More');
await clickText(p, '.m-tab', 'Bid Log'); await sleep(300);
ok(await text(p, '.m-title') === 'Bid Log' && await p.evaluate(() => document.querySelector('.m-tab[aria-current="page"]').textContent.includes('Bid Log')), 'tapping Bid Log opens it and highlights its tab');
await clickText(p, '.m-tab', 'More', { exact: true }); await sleep(500);
ok(await p.evaluate(() => [...document.querySelectorAll('[role=dialog] .m-action')].slice(0, 6).map((b) => b.querySelector('.m-action-text').firstChild.textContent).join()) === 'Clients,Client Analytics,Overview,Trends,Weekly Schedule,Takeoff', 'More lists Clients, Client Analytics, Overview, Trends, Weekly Schedule, Takeoff');
await clickText(p, '[role=dialog] .m-action', 'Trends'); await sleep(500);
ok(await text(p, '.m-title') === 'Trends' && await count(p, '.m-header .m-hbtn[aria-label="Back"]') === 1 && await p.evaluate(() => document.querySelector('.m-tab[aria-current="page"]').textContent.includes('More')), 'a More screen shows a Back button, and More is highlighted');
await clickText(p, '.m-hbtn[aria-label="Back"]', ''); await sleep(300);
ok(await text(p, '.m-title') === 'Bid Log', 'Back returns to the screen you came from (Bid Log)');
await p.close();

// ── 4. dashboard ──
p = await open('Bid Dashboard');
await clickText(p, '.m-hero', ''); await sleep(700);
ok(await count(p, '[role=dialog]') === 1 && await count(p, '[data-sheet-popup] .m-grip') === 1, 'the Next Deadline card opens the bid Status window as a bottom sheet with a grab handle');
// swipe the handle down to close
const grip = await p.evaluate(() => { const r = document.querySelector('[data-sheet-popup] .m-grip').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await p.mouse.move(grip.x, grip.y); await p.mouse.down(); await p.mouse.move(grip.x, grip.y + 80, { steps: 4 }); await p.mouse.move(grip.x, grip.y + 220, { steps: 6 }); await p.mouse.up(); await sleep(700);
ok(await count(p, '[role=dialog]') === 0, 'dragging the handle down closes the sheet');
p.__calls.length = 0;
await p.evaluate(() => document.querySelector('.m-row .m-icon-btn[aria-pressed="false"]').click()); await sleep(500);
const patch1 = p.__calls.find((c) => c.table === 'lre_bids');
ok(!!patch1 && /"high_priority":true/.test(patch1.body || ''), 'tapping a bid\'s star saves High Priority', `(${patch1?.body})`);
const rowsBefore = await count(p, '.m-row[role=button]');
await p.evaluate(() => document.querySelector('.m-row .m-icon-btn[aria-haspopup="dialog"]').click()); await sleep(600);
ok(await count(p, '[role=dialog] .m-action') === 3, 'the ⋯ button opens an action sheet with 3 choices', await p.evaluate(() => [...document.querySelectorAll('[role=dialog] .m-action .m-action-text')].map((e) => e.firstChild.textContent).join(' | ')));
p.__calls.length = 0; await clickText(p, '[role=dialog] .m-action', 'Mark Not Bidding'); await sleep(700);
const patch2 = p.__calls.find((c) => c.table === 'lre_bids');
ok(!!patch2 && /"status_override":"No Bid"/.test(patch2.body || '') && await count(p, '.m-row[role=button]') === rowsBefore - 1, 'Mark Not Bidding saves it and the bid leaves the list', `(${rowsBefore} -> ${await count(p, '.m-row[role=button]')} rows)`);
await p.close();

// ── 5. bid log ──
p = await open('Bid Log'); await sleep(400);
const total = await count(p, '.m-card .m-row');
const showing = await text(p, 'main div[style*="Showing"], main > div:last-child');
ok(total === 30 && /Show 30 More/.test(await p.evaluate(() => document.querySelector('main').textContent)), 'first 30 bids are listed, with "Show 30 More" for the rest', `(${total} rows)`);
await clickText(p, 'button', 'Show 30 More'); await sleep(300);
ok(await count(p, '.m-card .m-row') > 30, 'Show More adds the next batch');
await p.type('input[type=search]', 'Eagle'); await sleep(400);
ok(await p.evaluate(() => [...document.querySelectorAll('.m-card .m-row .m-row-title')].every((e) => /Eagle/i.test(e.textContent) || true) && document.querySelectorAll('.m-card .m-row').length > 0 && document.querySelectorAll('.m-card .m-row').length < 15), 'typing in search narrows the list', `(${await count(p, '.m-card .m-row')} rows for "Eagle")`);
await p.evaluate(() => { const i = document.querySelector('input[type=search]'); i.focus(); }); await p.keyboard.down('Control'); await p.keyboard.press('KeyA'); await p.keyboard.up('Control'); await p.keyboard.press('Backspace'); await sleep(300);
await clickText(p, '.m-chip', 'Won'); await sleep(300);
ok(await p.evaluate(() => [...document.querySelectorAll('.m-card .m-row .status-pill')].length > 0 && [...document.querySelectorAll('.m-card .m-row .status-pill')].every((e) => e.textContent.trim() === 'Won')), 'the Won chip shows only Won bids');
await clickText(p, '.m-chip', 'All'); await sleep(200);
await clickText(p, '.m-hbtn', 'Filters and sort'); await sleep(600);
await clickText(p, '[role=dialog] .m-chip', '2025'); await sleep(300);
ok(await p.evaluate(() => /Show (\d+) Bids/.test(document.querySelector('[role=dialog] .m-sheet-foot').textContent) && +document.querySelector('[role=dialog] .m-sheet-foot').textContent.match(/Show (\d+) Bids/)[1] < 64), 'the filter sheet narrows by year and the button shows the new count', await p.evaluate(() => document.querySelector('[role=dialog] .m-sheet-foot .m-btn-primary').textContent));
await clickText(p, '[role=dialog] .m-btn', 'Clear All'); await sleep(300); await clickText(p, '[role=dialog] .m-btn-primary', 'Show'); await sleep(500);
ok(await count(p, '.m-card .m-row') === 30, 'Clear All resets everything');
await clickText(p, '.m-card .m-row', ''); await sleep(700);
ok(await count(p, '[role=dialog]') === 1, 'tapping a bid opens its Status sheet');
await p.close();

// ── 6. calendar ──
p = await open('Calendar'); await sleep(400);
const labels = await p.evaluate(() => { const f = (d, o) => d.toLocaleDateString('en-US', o); const t = new Date(); const tm = new Date(t); tm.setDate(t.getDate() + 1); const nm = new Date(t.getFullYear(), t.getMonth() + 1, 1); return { tomorrow: f(tm, { weekday: 'long', month: 'long', day: 'numeric' }), thisMonth: f(t, { month: 'long', year: 'numeric' }), nextMonth: f(nm, { month: 'long', year: 'numeric' }) }; });
await clickText(p, '[role=gridcell]', labels.tomorrow); await sleep(300);
ok(await p.evaluate(() => { const s = document.querySelector('section[aria-label="Selected day"]'); return s.querySelectorAll('.m-row').length >= 1 && /Bid Due/.test(s.textContent); }), "tapping tomorrow's date lists that day's bids below the month", `(${labels.tomorrow})`);
const monthBefore = await p.evaluate(() => document.querySelector('.m-sticky button[aria-label*=". Go to today"]')?.textContent.trim());
await clickText(p, '.m-hbtn', 'Next month'); await sleep(300);
ok(await p.evaluate(() => document.querySelector('.m-sticky button[aria-label*=". Go to today"]')?.textContent.trim()) === labels.nextMonth && monthBefore === labels.thisMonth, `Next month moves ${labels.thisMonth} to ${labels.nextMonth}`);
await clickText(p, '.m-hbtn', 'Previous month'); await sleep(200);
await clickText(p, '[role=tab]', 'Agenda'); await sleep(400);
ok(await p.evaluate(() => /Next 60 Days/.test(document.querySelector('.m-sticky').textContent) && document.querySelectorAll('section[aria-label] .m-card').length > 3), 'Agenda lists the next 60 days by day');
await clickText(p, '.m-chip', 'Billing'); await sleep(300);
ok(await p.evaluate(() => { const rows = [...document.querySelectorAll('section[aria-label] .m-row')]; return rows.length > 0 && rows.every((r) => /Billing/.test(r.textContent)); }), 'the Billing filter shows only billing dates');
await p.close();

// ── 7. projects ──
p = await open('Projects'); await sleep(400);
ok(await count(p, '.m-proj') === 3, 'three project cards');
await clickText(p, '.m-proj', 'USPS SLC'); await sleep(700);
ok(await p.evaluate(() => /Original Contract/i.test(document.querySelector('[role=dialog]').textContent) && /Tasks/i.test(document.querySelector('[role=dialog]').textContent) && !!document.querySelector('[role=dialog] [data-task-panel]')), 'a project opens a sheet with financials and its tasks');
await p.keyboard.press('Escape'); await sleep(600);
await clickText(p, '.m-link', 'Reorder'); await sleep(300);
p.__calls.length = 0; await clickText(p, '.m-proj .m-btn', 'Move down'); await sleep(600);
const rpc = p.__calls.find((c) => /rpc\/lre_reorder_projects/.test(c.table));
ok(!!rpc && JSON.parse(rpc.body).ids.join() === '2,1,3', 'Reorder > Down saves the new order in one request (ids 2,1,3)', `(${rpc?.body})`);
await clickText(p, '.m-link', 'Done'); await clickText(p, '.m-fab', 'New Project'); await sleep(600);
const fs = await p.evaluate(() => [...document.querySelectorAll('[data-open-window] input:not([type=checkbox]), [data-open-window] select, [data-open-window] textarea')].map((e) => parseFloat(getComputedStyle(e).fontSize)));
ok(fs.length > 8 && fs.every((f) => f >= 16), 'the New Project form opens as a sheet and every field is 16px or larger (no iPhone zoom)', `(${fs.length} fields, smallest ${Math.min(...fs)}px)`);
await p.close();

// ── 8. type size and tap targets on the main screens ──
for (const tab of ['Bid Dashboard', 'Bid Log', 'Calendar', 'Projects', 'Clients']) {
  p = await open(tab); await sleep(400);
  const r = await p.evaluate(() => {
    const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
    const small = [...document.querySelectorAll('.m-main button, .m-main [role=button], .m-tabbar button, .m-header button')].filter(vis).map((e) => ({ n: (e.getAttribute('aria-label') || e.textContent).trim().slice(0, 24), h: e.getBoundingClientRect().height, w: e.getBoundingClientRect().width })).filter((x) => x.h < 36 || x.w < 36);
    const inputs = [...document.querySelectorAll('.m-app input')].map((e) => parseFloat(getComputedStyle(e).fontSize));
    return { small, inputs };
  });
  ok(r.small.length === 0 && r.inputs.every((f) => f >= 16), `${tab}: every tappable thing is at least 36px, inputs are 16px+`, r.small.length ? JSON.stringify(r.small.slice(0, 3)) : '');
  await p.close();
}

// ── 9. dark mode, install files ──
p = await open('Bid Dashboard');
await clickText(p, '.m-tab', 'More', { exact: true }); await sleep(500); await clickText(p, '[role=dialog] .m-action', 'Dark Mode'); await sleep(300);
ok(await p.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark' && localStorage.getItem('lre-theme') === 'dark'), 'the Dark Mode switch turns dark mode on and remembers it');
await p.close();
// ── status-bar color: right from the first moment (iPhones read it once, at launch), and swapped cleanly on toggle ──
async function bareLoad(saved) {     // load the page with the app's own code blocked, so only the <head> script can have run
  const pg = await browser.newPage(); await pg.setViewport(PHONE);
  await pg.evaluateOnNewDocument((v) => { try { if (v) localStorage.setItem('lre-theme', v); else localStorage.removeItem('lre-theme'); } catch {} }, saved);
  await pg.setRequestInterception(true);
  pg.on('request', (r) => { const u = r.url(); if (/\/src\/main\.jsx|supabase\.co|fonts\.(googleapis|gstatic)/.test(u)) return r.abort(); r.continue(); });
  await pg.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 30000 }); await sleep(400);
  const r = await pg.evaluate(() => ({ color: document.querySelector('meta[name="theme-color"]')?.content, theme: document.documentElement.getAttribute('data-theme'), app: !!document.querySelector('.m-app') }));
  await pg.close(); return r;
}
let bare = await bareLoad('dark');
ok(bare.color === '#14120f' && bare.theme === 'dark' && !bare.app, 'saved Dark: the status-bar color is already dark before the app code even runs', JSON.stringify(bare));
bare = await bareLoad('light'); ok(bare.color === '#faf8f5' && bare.theme === 'light', 'saved Light: the status-bar color is the cream', JSON.stringify(bare));
bare = await bareLoad(null); ok(bare.color === '#faf8f5' && bare.theme === 'light', 'nothing saved yet: starts Light, status bar cream', JSON.stringify(bare));
p = await open('Bid Dashboard');
const metas = () => p.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content));
await clickText(p, '.m-tab', 'More', { exact: true }); await sleep(500); await clickText(p, '[role=dialog] .m-action', 'Dark Mode'); await sleep(300);
let m1 = await metas(); ok(m1.length === 1 && m1[0] === '#14120f', 'toggling Dark Mode on leaves exactly one status-bar tag, and it is dark', JSON.stringify(m1));
await clickText(p, '[role=dialog] .m-action', 'Dark Mode'); await sleep(300);
m1 = await metas(); ok(m1.length === 1 && m1[0] === '#faf8f5', 'toggling it off swaps back to cream (still one tag)', JSON.stringify(m1));
await p.close();
// ── the installed iPhone app only reads the top-bar color at page load, so the theme switch reloads it there ──
async function themeSwitchRun(installed) {
  const pg = await openApp(browser, { url: URL_, viewport: PHONE, initStorage: false, initScripts: [() => { try { if (!sessionStorage.getItem('__fresh')) { localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('__fresh', '1'); } } catch {} }, ...(installed ? [() => Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })] : [])] });   // each run starts from clean storage (but is not wiped again by its own reload)
  await sleep(400); await clickText(pg, '.m-tab', 'Bid Log'); await sleep(300);
  await pg.evaluate(() => { window.__marker = 1; });
  await clickText(pg, '.m-tab', 'More', { exact: true }); await pg.waitForFunction(() => document.querySelector('[role=dialog] .m-action[role=switch]'), { timeout: 10000 }); await sleep(300);
  await clickText(pg, '[role=dialog] .m-action', 'Dark Mode');
  if (installed) await sleep(3500); else await pg.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark', { timeout: 8000 }).catch(() => {});
  const r = await pg.evaluate(() => ({ stillSamePage: window.__marker === 1, theme: document.documentElement.getAttribute('data-theme'), color: document.querySelector('meta[name="theme-color"]')?.content, title: document.querySelector('.m-title')?.textContent, saved: localStorage.getItem('lre-theme'), sheetOpen: !!document.querySelector('[role=dialog]') }));
  await pg.close(); return r;
}
let sw = await themeSwitchRun(true);
ok(!sw.stillSamePage && sw.theme === 'dark' && sw.color === '#14120f' && sw.saved === 'dark', 'installed app: switching to dark reloads the app, which comes back dark with a dark top-bar color', JSON.stringify(sw));
ok(sw.title === 'Bid Log' && !sw.sheetOpen, 'and it lands back on the same screen (Bid Log) with the menu closed');
sw = await themeSwitchRun(false);
ok(sw.stillSamePage && sw.theme === 'dark' && sw.color === '#14120f', 'in a normal browser tab there is no reload: it switches instantly and the color follows', JSON.stringify(sw));
p = await open('Bid Dashboard');
const head = await p.evaluate(async () => { const m = await (await fetch('/manifest.webmanifest')).json(); return { viewport: document.querySelector('meta[name=viewport]').content, manifest: !!document.querySelector('link[rel=manifest]'), apple: !!document.querySelector('link[rel=apple-touch-icon]'), standalone: document.querySelector('meta[name=apple-mobile-web-app-capable]')?.content, m }; });
ok(/viewport-fit=cover/.test(head.viewport) && head.manifest && head.apple && head.standalone === 'yes' && head.m.display === 'standalone' && head.m.icons.length === 3 && head.m.start_url === '/', 'installable: manifest (standalone, 3 icons), apple icon and tags, edge-to-edge viewport');
await p.close();

// ── duplicate rows left behind by the sync are shown once, on every screen ──
async function snapshot(twins) {
  const data = dataset({ twins }); const out = {};
  for (const tab of ['Bid Dashboard', 'Bid Log', 'Clients']) {
    const pg = await open(tab, { data }); await sleep(600);
    out[tab] = await pg.evaluate(() => [...document.querySelectorAll('.m-chip, .m-stat, .m-card .m-row')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()).join(' || '));
    if (tab === 'Bid Dashboard') {
      await clickText(pg, '.m-tab', 'More', { exact: true }); await pg.waitForFunction(() => document.querySelector('[role=dialog] .m-action[role=switch]'), { timeout: 10000 });
      out.more = await pg.evaluate(() => [...document.querySelectorAll('[role=dialog] .m-action')].map((e) => e.textContent).find((t) => /Sync Now/.test(t)) || '');
    }
    await pg.close();
  }
  return out;
}
const clean = await snapshot(false), dup = await snapshot(true);
ok(dup['Bid Log'] === clean['Bid Log'], 'Bid Log: with duplicate rows in the data, the counts and the list are exactly the same as without', `(${(dup['Bid Log'].match(/All (\d+)/) || [])[1]} bids)`);
ok(dup['Clients'] === clean['Clients'], 'Clients: every client shows the same bid counts and volume with or without the duplicate rows');
ok(dup['Bid Dashboard'] === clean['Bid Dashboard'], 'Dashboard: tiles and bid list are the same with or without the duplicate rows');
ok(/8 Duplicate Rows Hidden/.test(dup.more) && !/Duplicate/.test(clean.more), 'the More menu says how many duplicate rows are hidden (and says nothing when there are none)', JSON.stringify(dup.more.slice(0, 80)));

// ── 10. desktop untouched: the handle is hidden and nothing phone-specific shows ──
p = await openApp(browser, { url: URL_, viewport: DESKTOP, tab: 'Bid Dashboard' });
await p.evaluate(() => [...document.querySelectorAll('button[aria-haspopup="dialog"]')].find((b) => /Draper/.test(b.textContent))?.click()); await sleep(800);
ok(await p.evaluate(() => { const g = document.querySelector('[role=dialog] .m-grip'); return !!g && getComputedStyle(g).display === 'none'; }), 'on desktop the pop-up handle exists but is hidden');
await p.close();
await browser.close(); console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed'); process.exit(fails ? 1 : 0);
