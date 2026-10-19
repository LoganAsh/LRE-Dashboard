// node tap.mjs OUT "Tab" "tap label" "scroll:.selector:bottom" ...   (taps match by aria-label or text start)
import { launch, openApp, shot, PHONE } from './harness.mjs';
const [out, tab, ...steps] = process.argv.slice(2); const dark = process.argv.includes('--dark');
const browser = await launch(); const page = await openApp(browser, { url: 'http://127.0.0.1:5199/', viewport: PHONE, tab, dark, freeze: !process.argv.includes('--live') });
for (const t of steps.filter((s) => !s.startsWith('--'))) {
  if (t.startsWith('scroll:')) { const [, sel, where] = t.split(':'); await page.evaluate((sel, where) => { const el = document.querySelector(sel); if (el) el.scrollTop = where === 'bottom' ? el.scrollHeight : Number(where); }, sel, where); }
  else if (t.startsWith('text:')) await page.evaluate((txt) => { const els = [...document.querySelectorAll('body *')].filter((e) => (e.textContent || '').includes(txt) && ![...e.children].some((c) => (c.textContent || '').includes(txt))); if (els[0]) els[0].click(); }, t.slice(5));
  else await page.evaluate((label) => { const exact = label.startsWith('='); const inc = label.startsWith('~'); const want = exact || inc ? label.slice(1) : label; const el = [...document.querySelectorAll('button, [role=button], [role=tab], [role=radio], [role=checkbox], input, [data-tap]')].find((b) => { const t = (b.getAttribute('aria-label') || b.textContent || '').trim(); return exact ? t === want : inc ? t.includes(want) : t.startsWith(want); }); if (el) el.click(); }, t);
  await new Promise((r) => setTimeout(r, 650));
}
await shot(page, out); const errs = page.__errors.filter((e) => !/favicon/.test(e)); if (errs.length) console.log('PAGE ERRORS:', errs.slice(0, 2).join(' | ').slice(0, 250)); await browser.close();
