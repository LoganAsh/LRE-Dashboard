// A real headless browser (Chromium) pointed at the running app, with a stand-in database.
// Needs: npm i --no-save puppeteer-core @sparticuz/chromium   (kept out of the app's dependencies)
import { createRequire } from 'node:module';
const require = createRequire(process.env.SHOTS_DIR ? process.env.SHOTS_DIR + '/' : '/home/claude/shots/');
const { default: chromium } = await import(require.resolve('@sparticuz/chromium'));
const puppeteer = require('puppeteer-core');
import { makeBids, makeProjects, makeTasks, makeWeekly, SYNC_LOG } from './mockdata.mjs';

export const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
export const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1 };

export async function launch() {
  const path = await chromium.executablePath();
  return puppeteer.launch({ args: [...chromium.args, '--no-sandbox'], executablePath: path, headless: 'shell' });
}

export function dataset() { return { bids: makeBids(), projects: makeProjects(), tasks: makeTasks(), weekly: makeWeekly() }; }

// Open a page that talks to the stand-in database. `tab` picks the starting tab; `dark` picks the theme.
export async function openApp(browser, { url, viewport = PHONE, tab, dark = false, data = dataset(), extra = {}, freeze = true }) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }]);
  await page.evaluateOnNewDocument((tab, dark) => {
    try { if (tab) sessionStorage.setItem('lre-return-tab', tab); localStorage.setItem('lre-theme', dark ? 'dark' : 'light'); } catch {}
  }, tab || null, dark);
  if (freeze) {   // the page's clock stands still at noon today, so countdowns and animations cannot cause false differences
    const noon = new Date(); noon.setHours(12, 0, 0, 0);
    await page.evaluateOnNewDocument((t) => { const R = Date; const F = class extends R { constructor(...a) { if (a.length === 0) super(t); else super(...a); } static now() { return t; } }; globalThis.Date = F; }, noon.getTime());
  }
  const calls = []; page.__calls = calls;
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (/fonts\.(googleapis|gstatic)\.com/.test(u.host)) return req.abort();
    if (!/supabase\.co$/.test(u.host)) return req.continue();
    const table = u.pathname.replace('/rest/v1/', '');
    const method = req.method();
    if (method !== 'GET') { calls.push({ method, table, body: req.postData() }); return req.respond({ status: 204, headers: { 'access-control-allow-origin': '*' } }); }
    const tables = { lre_bids_view: data.bids, lre_bids: data.bids, lre_projects: data.projects, lre_project_tasks: data.tasks, lre_sync_log: SYNC_LOG, ...(data.weekly || {}), ...extra };
    let rows = tables[table] ?? [];
    for (const [k, v] of u.searchParams) if (typeof v === 'string' && v.startsWith('eq.') && k !== 'select') rows = rows.filter((r) => String(r[k]) === v.slice(3));
    const wantsObject = /pgrst\.object/.test(req.headers()['accept'] || '');
    req.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': '*' }, body: JSON.stringify(wantsObject ? (rows[0] ?? null) : rows) });
  });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
  page.__errors = errors;
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 700));
  return page;
}
export const shot = async (page, file, opts = {}) => page.screenshot({ path: file, ...opts });
