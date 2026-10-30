// The sync saves every spreadsheet row under its row number and never removes a row it stops seeing, so when rows
// move or repeat in the bid log, an old copy of the same bid stays behind in the database. Left alone, those twins
// inflate every client count, volume and win rate. This shows one copy of each exact twin and hides the rest.
// Nothing is deleted: the hidden rows are still in the database.

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// Two rows are twins only when project, date, client text and amount all match.
export function bidKey(b) {
  const name = norm(b.name);
  if (!name) return `id:${b.id}`;                                   // an unnamed row is never merged with anything
  const cents = Math.round((Number(b.bid_amount) || 0) * 100);
  return [name, b.bid_date || '', norm(b.client), cents].join('|');
}

// How much of YOUR work a copy carries. The copy with the most wins, so nothing you entered goes out of sight.
export function userStateScore(b, hasResults) {
  let s = 0;
  if (hasResults) s += 4;                                           // bid results / dispositions
  if (String(b.user_notes || '').trim()) s += 3;                    // notes
  if (b.status_override && b.status_override !== 'No Bid') s += 3;  // a status set by hand (Won, Lost, Re-Bid ...)
  if (b.high_priority) s += 1;
  if (b.next_followup_date || b.last_followup_date) s += 1;
  if (b.status_override === 'No Bid') s -= 2;                       // usually the copy that was hidden by hand
  return s;
}

// bids: rows in display order. placementBidIds: Set of bid ids that have bid results entered.
// Returns { bids, hidden } with the original order kept.
export function dedupeBids(bids, placementBidIds = new Set()) {
  const groups = new Map();
  for (const b of bids) {
    const k = bidKey(b);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(b);
  }
  const keep = new Set();
  let hidden = 0;
  for (const list of groups.values()) {
    if (list.length === 1) { keep.add(list[0].id); continue; }
    const best = [...list].sort((a, c) =>
      userStateScore(c, placementBidIds.has(c.id)) - userStateScore(a, placementBidIds.has(a.id))
      || String(c.updated_at || '').localeCompare(String(a.updated_at || ''))      // then the freshest copy
      || a.id - c.id)[0];                                                          // then the oldest id, so it never flips
    keep.add(best.id);
    hidden += list.length - 1;
  }
  return { bids: bids.filter((b) => keep.has(b.id)), hidden };
}
