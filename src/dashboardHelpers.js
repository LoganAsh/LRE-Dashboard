// Rules the Bid Dashboard shares between the desktop and phone layouts.
import { parseClients } from './hooks.js';
import { MS_DAY, dateOf, parseTime } from './dates.js';

export const clientsOf = (b) => (b.clients && b.clients.length > 0) ? b.clients : parseClients(b.client || '');

// Dot color for how soon something is due (same thresholds as the Bid Log)
export function urgencyOf(days) {
  if (days < 0)  return { color: '#dc2626' };
  if (days <= 3) return { color: '#ea580c' };
  if (days <= 7) return { color: '#ca8a04' };
  return { color: '#16a34a' };
}
export function countdown(days) {
  if (days < 0) return `${-days} ${-days === 1 ? 'Day' : 'Days'} Overdue`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} Days`;
}

export const timeMinutes = (b) => { const t = parseTime(b.bid_time); return t ? t.h * 60 + t.min : 24 * 60; };
export const byDueDate = (a, b) => a.bid_date.localeCompare(b.bid_date) || timeMinutes(a) - timeMinutes(b);

// Which agenda group a bid belongs to. High priority bids are pinned to the top, as before.
export const GROUPS = [
  { key: 'priority', label: 'High Priority' },
  { key: 'overdue',  label: 'Past Due' },
  { key: 'this',     label: 'This Week' },
  { key: 'next',     label: 'Next Week' },
  { key: 'later',    label: 'Later' },
];
export function groupOf(bid, today) {
  if (bid.high_priority) return 'priority';
  const d = dateOf(bid.bid_date);
  if (d < today) return 'overdue';
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay());   // weeks start Sunday, like the Calendar
  const weeksOut = Math.floor(Math.round((d - weekStart) / MS_DAY) / 7);
  return weeksOut <= 0 ? 'this' : weeksOut === 1 ? 'next' : 'later';
}

