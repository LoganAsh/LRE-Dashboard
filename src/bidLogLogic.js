// The Bid Log's filtering and sorting rules, shared by the desktop table and the phone list.
import { isPublicBid } from './utils.js';
import { parseClients } from './hooks.js';

export const clientsOf = (b) => (b.clients && b.clients.length > 0) ? b.clients : parseClients(b.client || '');

// Everything except the status filter (so each status chip can show its own count)
export function scopeBids(bids, { search = '', typeFilter = 'All', yearFilter = '', oneWeekAgo }) {
  const q = search.toLowerCase();
  return bids
    .filter((b) => {
      const eff = b.effective_status || b.status;
      if (b.bid_amount > 0) return true;
      return eff === 'Upcoming' && b.bid_date && b.bid_date >= oneWeekAgo;
    })
    .filter((b) => !q || b.name?.toLowerCase().includes(q) || b.client?.toLowerCase().includes(q))
    .filter((b) => {
      if (typeFilter === 'All') return true;
      const pub = isPublicBid(b);
      return typeFilter === 'Public' ? pub : !pub;
    })
    .filter((b) => !yearFilter || b.year === yearFilter);
}

export function countStatuses(scoped) {
  const counts = {};
  scoped.forEach((b) => { const s = b.effective_status || b.status; counts[s] = (counts[s] || 0) + 1; });
  return counts;
}

export function filterAndSort(scoped, { statusFilter = '', sortKey = 'bid_date', sortDir = -1 }) {
  const isEmpty = (v) => v == null || v === '';
  return scoped
    .filter((b) => !statusFilter || (b.effective_status || b.status) === statusFilter)
    .sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (isEmpty(av) && isEmpty(bv)) return 0;
      if (isEmpty(av)) return 1;                         // blanks always sort to the bottom
      if (isEmpty(bv)) return -1;
      if (typeof av === 'string' || typeof bv === 'string') return sortDir * String(av).localeCompare(String(bv));
      return sortDir * (av - bv);
    });
}
