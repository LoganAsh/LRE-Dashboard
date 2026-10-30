// node tests/unit/dedupeBids.test.mjs
import { dedupeBids, bidKey, userStateScore } from '../../src/dedupeBids.js';
let fails = 0; const ok = (c, l, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${x ? '  ' + x : ''}`); if (!c) fails++; };
let nextId = 1;
const row = (o = {}) => ({ id: nextId++, name: 'Park Restroom', bid_date: '2026-09-01', client: 'Layton', bid_amount: 100000, status: 'Pending', status_override: null, user_notes: null, high_priority: false, next_followup_date: null, last_followup_date: null, updated_at: '2026-10-30T18:00:00Z', ...o });
const ids = (r) => r.bids.map((b) => b.id).join();

let a = row(), b = row({ updated_at: '2026-10-05T21:00:00Z' });
let r = dedupeBids([a, b]); ok(r.bids.length === 1 && r.hidden === 1, 'two exact twins show once, and the hidden count is 1');
ok(r.bids[0].id === a.id, 'with nothing else to go on, the freshest copy is the one shown');
a = row({ updated_at: '2026-10-05T21:00:00Z' }); b = row({ updated_at: '2026-10-05T21:00:00Z' }); r = dedupeBids([b, a]); ok(r.bids[0].id === Math.min(a.id, b.id), 'a complete tie goes to the oldest id, so it never flips between loads');
a = row(); b = row({ user_notes: 'call Jim' }); r = dedupeBids([a, b]); ok(r.bids[0].id === b.id, 'the copy with your notes is kept even though it is older or staler');
a = row(); b = row({ status_override: 'Lost' }); r = dedupeBids([a, b]); ok(r.bids[0].id === b.id, 'the copy with a status you set by hand (Lost) is kept');
a = row(); b = row({ status_override: 'No Bid' }); r = dedupeBids([b, a]); ok(r.bids[0].id === a.id, 'the copy you hid with No Bid loses to the plain copy');
a = row({ high_priority: true }); b = row({ status_override: 'No Bid', high_priority: true }); r = dedupeBids([a, b]); ok(r.bids[0].id === a.id, 'high priority does not rescue a hidden No Bid copy');
a = row(); b = row(); r = dedupeBids([a, b], new Set([b.id])); ok(r.bids[0].id === b.id, 'the copy that has bid results entered is kept');
a = row({ status_override: 'No Bid', user_notes: 'we passed: too far' }); b = row(); r = dedupeBids([a, b]); ok(r.bids[0].id === a.id, 'notes outweigh a No Bid mark (you wrote something real on that copy)', `score ${userStateScore(a, false)} vs ${userStateScore(b, false)}`);

a = row(); b = row({ bid_amount: 90000 }); ok(dedupeBids([a, b]).bids.length === 2, 'same project and date but a different amount: both stay (a revised bid, not a copy)');
a = row(); b = row({ bid_date: '2026-09-15' }); ok(dedupeBids([a, b]).bids.length === 2, 'same project, different date: both stay (a re-bid)');
a = row(); b = row({ client: 'Okland' }); ok(dedupeBids([a, b]).bids.length === 2, 'same project, different client: both stay (two contractors bidding it)');
a = row(); b = row({ name: 'Park Restroom - Phase 2' }); ok(dedupeBids([a, b]).bids.length === 2, 'different project names: both stay');
a = row({ name: '  PARK   restroom ', client: 'LAYTON ' }); b = row(); ok(dedupeBids([a, b]).bids.length === 1, 'capital letters and extra spaces do not hide a twin');
a = row({ bid_amount: '100000.00' }); b = row({ bid_amount: 100000 }); ok(dedupeBids([a, b]).bids.length === 1, 'an amount stored as text still matches the number');
a = row({ bid_amount: 0, name: 'No Amount Yet' }); b = row({ bid_amount: null, name: 'No Amount Yet' }); ok(dedupeBids([a, b]).bids.length === 1, 'twins with no amount yet are still twins');
a = row({ name: '' }); b = row({ name: '' }); ok(dedupeBids([a, b]).bids.length === 2, 'rows with no project name are never merged');

const x = row({ name: 'X' }), y1 = row({ name: 'Y' }), y2 = row({ name: 'Y', updated_at: '2026-01-01T00:00:00Z' }), z = row({ name: 'Z' });
r = dedupeBids([x, y2, z, y1]); ok(ids(r) === [x.id, z.id, y1.id].join(), 'the original order of the list is kept', ids(r));
const t = [row(), row(), row()]; r = dedupeBids(t); ok(r.bids.length === 1 && r.hidden === 2, 'three copies collapse to one, hidden count 2');
const before = JSON.stringify([a, b]); dedupeBids([a, b]); ok(JSON.stringify([a, b]) === before, 'the input rows are never modified');
ok(dedupeBids([]).bids.length === 0 && dedupeBids([]).hidden === 0, 'an empty list is fine');
ok(bidKey(row({ name: 'A' })) !== bidKey(row({ name: 'B' })), 'keys differ for different projects');
// the three real patterns, in miniature: hidden twin + live twin; work done on the stale copy; three copies with identical marks
const live = row({ name: 'P1' }), hid = row({ name: 'P1', status_override: 'No Bid', updated_at: '2026-10-05T21:00:00Z' });
const worked = row({ name: 'P2', status_override: 'Lost', updated_at: '2026-10-05T21:00:00Z' }), plain = row({ name: 'P2' });
const c1 = row({ name: 'P3', status_override: 'Project Re-Bid' }), c2 = row({ name: 'P3', status_override: 'Project Re-Bid', updated_at: '2026-10-06T16:57:00Z' }), c3 = row({ name: 'P3', status_override: 'Project Re-Bid', updated_at: '2026-10-06T16:57:00Z' });
r = dedupeBids([hid, live, plain, worked, c3, c2, c1]);
ok(r.bids.length === 3 && r.hidden === 4 && r.bids.some((b) => b.id === live.id) && r.bids.some((b) => b.id === worked.id) && r.bids.some((b) => b.id === c1.id), 'the three real-world patterns resolve the way they should', ids(r));
console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed'); process.exit(fails ? 1 : 0);
