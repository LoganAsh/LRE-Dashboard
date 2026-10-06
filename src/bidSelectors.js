// Single source of truth for "which bids / pre-bids are on the Bid Dashboard".
// Used by both the Bid Dashboard tab and the Calendar tab so they always agree.

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Upcoming status, bid date within the last week or later; high-priority first, then soonest.
export function getUpcomingBids(bids) {
  const today = startOfToday();
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(today.getDate() - 7);
  return bids
    .filter(b => {
      const eff = b.effective_status || b.status;
      if (eff !== 'Upcoming') return false;
      if (!b.bid_date) return false;
      return new Date(b.bid_date + 'T00:00:00') >= oneWeekAgo;
    })
    .sort((a, b) => {
      if (a.high_priority && !b.high_priority) return -1;
      if (!a.high_priority && b.high_priority) return 1;
      return a.bid_date.localeCompare(b.bid_date);
    });
}

// Any bid with a pre-bid today or later, soonest first.
export function getUpcomingPreBids(bids) {
  const todayStr = startOfToday().toISOString().split('T')[0];
  return bids
    .filter(b => b.pre_bid && String(b.pre_bid) >= todayStr)
    .sort((a, b) => String(a.pre_bid).localeCompare(String(b.pre_bid)));
}
