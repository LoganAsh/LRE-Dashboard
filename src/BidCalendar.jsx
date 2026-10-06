import { useEffect, useMemo, useState } from 'react';
import { EventCalendar } from './components/ui/event-calendar';
import { StatusModal } from './BidLog.jsx';
import { getUpcomingBids, getUpcomingPreBids } from './bidSelectors.js';
import { parseClients } from './hooks.js';
import { fmtFull$ } from './utils.js';

const COLORS = { bid: '#f97316', prebid: '#7c6cf0', overdue: '#dc2626' };

const KINDS = [
  { value: 'bid', label: 'Bids', color: COLORS.bid },
  { value: 'prebid', label: 'Pre-Bids', color: COLORS.prebid },
];
const LEGEND = [
  { label: 'Bid Due', color: COLORS.bid },
  { label: 'Pre-Bid', color: COLORS.prebid },
  { label: 'Past Due', color: COLORS.overdue },
];

// "2:00 PM" -> { h: 14, min: 0 }; anything unreadable -> null (event shows in the "no time" lane)
function parseTime(str) {
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

function toStart(dateStr, timeStr) {
  const [y, mo, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  const t = parseTime(timeStr);
  return { start: new Date(y, mo - 1, d, t ? t.h : 0, t ? t.min : 0), hasTime: !!t };
}

const clientsOf = (b) =>
  ((b.clients && b.clients.length > 0) ? b.clients : parseClients(b.client || '')).join(', ');
const clip = (s, n = 140) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s);

// Same bids and pre-bids the Bid Dashboard shows (shared selectors), turned into calendar events.
function buildEvents(bids) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out = [];

  getUpcomingBids(bids).forEach((b) => {
    const { start, hasTime } = toStart(b.bid_date, b.bid_time);
    const overdue = new Date(b.bid_date + 'T00:00:00') < today;
    out.push({
      id: `bid-${b.id}`, ref: b.id, kind: 'bid',
      kindLabel: overdue ? 'Bid · Past Due' : 'Bid Due',
      title: b.name, start, hasTime,
      color: overdue ? COLORS.overdue : COLORS.bid,
      priority: !!b.high_priority,
      details: [clientsOf(b), b.bid_amount > 0 ? `${fmtFull$(b.bid_amount)} Bid` : null, clip(b.notes)].filter(Boolean),
    });
  });

  getUpcomingPreBids(bids).forEach((b) => {
    const { start, hasTime } = toStart(b.pre_bid, b.pre_bid_time);
    out.push({
      id: `prebid-${b.id}`, ref: b.id, kind: 'prebid',
      kindLabel: 'Pre-Bid',
      title: b.name, start, hasTime,
      color: COLORS.prebid,
      priority: !!b.high_priority,
      details: [clientsOf(b), b.bid_date ? `Bid Due ${b.bid_date}` : null, clip(b.notes)].filter(Boolean),
    });
  });

  return out;
}

export default function BidCalendar({ bids }) {
  const [localBids, setLocalBids] = useState(bids);
  const [modalBid, setModalBid] = useState(null);
  useEffect(() => { setLocalBids(bids); }, [bids]);

  const events = useMemo(() => buildEvents(localBids), [localBids]);

  return (
    <div className="page">
      <EventCalendar
        events={events}
        kinds={KINDS}
        legend={LEGEND}
        onEventClick={(ev) => setModalBid(localBids.find((b) => b.id === ev.ref) || null)}
      />
      {modalBid && (
        <StatusModal
          bid={modalBid}
          onClose={() => setModalBid(null)}
          onSave={(updated) => setLocalBids((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))}
        />
      )}
    </div>
  );
}
