// Small shared date helpers. Dates are built from their parts so a day never shifts with the time zone.
export const MS_DAY = 86400000;

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// "2026-10-12" -> local Date at midnight
export function dateOf(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function daysUntil(iso) {
  if (!iso) return null;
  return Math.round((dateOf(iso) - startOfToday()) / MS_DAY);
}

// "2:00 PM" -> { h: 14, min: 0 }; anything unreadable -> null
export function parseTime(str) {
  if (!str) return null;
  const m = String(str).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return { h, min };
}

// Date + optional "2:00 PM" -> { at: Date, hasTime }
export function dateAtTime(iso, timeStr) {
  const base = dateOf(iso);
  const t = parseTime(timeStr);
  if (t) base.setHours(t.h, t.min, 0, 0);
  return { at: base, hasTime: !!t };
}

export function fmtDate(iso, withYear = true) {
  if (!iso) return '—';
  return dateOf(iso).toLocaleDateString('en-US', withYear ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' });
}
