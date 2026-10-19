// Realistic stand-in data for screenshots and tests. Dates are relative to "today" so the screens always look current.
const day = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const GCS = ['Staker Parson', 'Layton Construction', 'Okland Construction', 'Big-D Construction', 'Sundt', 'Jacobsen Construction', 'Hogan & Associates', 'Wadman Corp', 'Herriman City', 'Sandy City', 'UDOT', 'Kier Construction', 'Westland Construction', 'Method Studio'];
const JOBS = ['USPS SLC Site Demo & Utilities - EV Infrastructure', 'MCSD Apex Center', 'PCA Building - Phase 1 - West Façade', 'Riverton Fire Station 4', 'Bangerter Hwy Storm Drain', 'Daybreak Elementary Sitework', 'Lehi Tech Campus Pad B', 'Copper Hills Water Line', 'Kearns Rec Center Expansion', 'South Jordan Pump Station', 'Draper Retail Pad', 'Magna Library Site', 'Taylorsville Park Restroom', 'Bluffdale Lift Station', 'West Valley Trail Crossing', 'Midvale Senior Housing', 'Murray Substation Grading', 'Saratoga Springs Reservoir', 'Eagle Mountain Data Hall', 'Orem Parking Structure'];
const NOTES = ['Waiting on addendum 2', 'Called GC, they like our number', 'Need to confirm dewatering scope', 'Follow up Friday', '', '', '', 'Pipe supplier quote expires soon'];

export function makeBids() {
  const bids = []; let id = 100;
  const add = (o) => {
    const amount = Math.round((150 + rnd() * 2400) / 5) * 5000;
    const margin = 0.06 + rnd() * 0.16;
    const clients = o.clients || (rnd() < 0.3 ? [pick(GCS), pick(GCS)].filter((v, i, a) => a.indexOf(v) === i) : [pick(GCS)]);
    const status = o.status || 'Pending';
    const override = o.override ?? null;
    bids.push({
      id: id++, bid_date: o.date, name: o.name || pick(JOBS), client: clients.join(', '), clients, bid_amount: amount, cost: Math.round(amount * (1 - margin)),
      margin_dollar: Math.round(amount * margin), margin_pct: margin, award: null, status, est_profit: Math.round(amount * margin),
      has_pipe: rnd() < 0.6, has_precast: rnd() < 0.2, has_ew: rnd() < 0.7, notes: null, year: o.date.slice(0, 4), raw_award: null,
      source_row: id, sheet_name: 'Sheet', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      status_override: override, user_notes: (o.notes ?? pick(NOTES)) || null, last_followup_date: null, next_followup_date: o.next ?? null,
      award_amount: o.award ?? null, bid_time: o.time ?? pick(['9:00 AM', '10:30 AM', '1:00 PM', '2:00 PM', '3:00 PM']), pre_bid: o.pre ?? null, pre_bid_time: o.pre ? pick(['8:00 AM', '9:30 AM', '11:00 AM']) : null,
      awarded_by: o.awardedBy ?? null, high_priority: !!o.hp, effective_status: override || status, projected_profit: Math.round(amount * margin),
    });
  };
  // upcoming (some high priority, some with pre-bids)
  [[1, true], [2, false], [3, false], [4, true], [6, false], [8, false], [9, false], [12, false], [15, false], [19, false], [23, false], [30, false]].forEach(([n, hp], i) =>
    add({ date: day(n), status: 'Upcoming', hp, pre: i % 3 === 0 ? day(n - 2) : null, notes: i === 0 ? 'Pre-bid walk is mandatory' : undefined }));
  // past due (still marked upcoming)
  [-1, -3, -5].forEach((n) => add({ date: day(n), status: 'Upcoming' }));
  // pending, won, lost, other
  for (let i = 0; i < 12; i++) add({ date: day(-10 - i * 9), status: 'Pending', next: i < 3 ? day(2 + i) : null });
  for (let i = 0; i < 9; i++) add({ date: day(-30 - i * 21), status: 'Won', award: Math.round((200 + rnd() * 1500) / 5) * 5000, awardedBy: pick(GCS) });
  for (let i = 0; i < 14; i++) add({ date: day(-20 - i * 17), status: 'Lost' });
  for (let i = 0; i < 4; i++) add({ date: day(-15 - i * 30), status: 'Pending', override: 'No Bid' });
  add({ date: day(-60), status: 'Pending', override: 'Client Not Awarded' }); add({ date: day(-80), status: 'Pending', override: 'Project Re-Bid' });
  for (let i = 0; i < 8; i++) add({ date: `2025-${String(1 + i).padStart(2, '0')}-${String(8 + i * 2).padStart(2, '0')}`, status: i % 3 === 0 ? 'Won' : 'Lost', year: '2025' });
  return bids;
}

export function makeProjects() {
  return [
    { id: 1, bid_id: null, name: 'USPS SLC Site Demo & Utilities - EV Infrastructure', client: 'Layton Construction', awarded_by: 'Layton Construction', status: 'Active', superintendent: 'J. Rivera', foreman: 'M. Ortiz', crew_size: 8, start_date: day(-45), est_completion_date: day(70), actual_completion_date: null, original_contract: 1180000, approved_cos: 42000, actual_cost: 702000, notes: 'Phase 2 starts after the electrical rough-in.', billing_day: 25, sort_order: 1, created_at: new Date().toISOString() },
    { id: 2, bid_id: null, name: 'MCSD Apex Center', client: 'Okland Construction', awarded_by: 'Okland Construction', status: 'Mobilizing', superintendent: 'T. Nguyen', foreman: null, crew_size: 6, start_date: day(-6), est_completion_date: day(140), actual_completion_date: null, original_contract: 865000, approved_cos: 0, actual_cost: 38000, notes: null, billing_day: 31, sort_order: 2, created_at: new Date().toISOString() },
    { id: 3, bid_id: null, name: 'PCA Building - Phase 1 - West Façade - Revised', client: 'Big-D Construction', awarded_by: 'Big-D Construction', status: 'Punch List', superintendent: 'R. Alvarez', foreman: 'D. Cole', crew_size: 4, start_date: day(-150), est_completion_date: day(-4), actual_completion_date: null, original_contract: 412000, approved_cos: 18500, actual_cost: 401000, notes: 'Waiting on final inspection.', billing_day: null, sort_order: 3, created_at: new Date().toISOString() },
  ];
}
export function makeTasks() {
  const t = (id, project_id, parent_id, title, status, due, sort) => ({ id, project_id, parent_id, title, status, due_date: due, notes: null, sort_order: sort, completed_at: status === 'Done' ? new Date().toISOString() : null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  return [t(1, 1, null, 'Submit SWPPP', 'Done', day(-20), 1), t(2, 1, null, 'Order 18-inch RCP', 'In Progress', day(-2), 2), t(3, 1, null, 'Schedule utility locate', 'To Do', day(4), 3), t(4, 1, 2, 'Get quotes', 'To Do', day(-1), 1), t(5, 1, 2, 'Confirm delivery date', 'Done', null, 2), t(6, 2, null, 'Pre-con meeting', 'To Do', day(3), 1), t(7, 3, null, 'Final inspection', 'In Progress', day(1), 1)];
}
// fixed at 11:40 today so screenshots are identical from run to run
const syncAt = new Date(); syncAt.setHours(11, 40, 0, 0);
export const SYNC_LOG = [{ id: 1, synced_at: syncAt.toISOString(), status: 'success', rows_upserted: 396, message: 'ok' }];
export { day };
