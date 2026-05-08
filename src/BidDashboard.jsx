import { useState, useMemo } from 'react';
import { supabase } from './supabase.js';
import { parseClients } from './hooks.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.ceil((d - today) / (1000 * 60 * 60 * 24));
}

function urgencyColor(days) {
  if (days === null) return 'var(--muted)';
  if (days < 0)  return '#e85c50';
  if (days <= 3) return '#f97316';
  if (days <= 7) return '#e8c547';
  return '#4ade80';
}

function urgencyLabel(days) {
  if (days === null) return '';
  if (days < 0)  return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days}d`;
}

function UrgencyBadge({ days }) {
  const col = urgencyColor(days);
  const label = urgencyLabel(days);
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 3,
      background: col + '22', border: `1px solid ${col}55`,
      color: col, fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
      whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

// ── Bid Card ──────────────────────────────────────────────────────────────────
function BidCard({ bid, onTogglePriority, onNotBidding }) {
  const days = getDaysUntil(bid.bid_date);
  const col = urgencyColor(days);
  const clientNames = (bid.clients && bid.clients.length > 0) ? bid.clients : parseClients(bid.client || '');
  const isHP = bid.high_priority;

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${isHP ? 'rgba(250,204,21,0.4)' : 'var(--border)'}`,
      borderLeft: `3px solid ${col}`,
      borderRadius: 8,
      padding: '14px 16px',
      display: 'flex', alignItems: 'flex-start', gap: 12,
      transition: 'border-color 0.15s',
      position: 'relative',
    }}>
      {/* Controls: top-right */}
      <div style={{ position: 'absolute', top: 8, right: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => onNotBidding(bid)}
          title="Mark as Not Bidding — removes from dashboard"
          style={{
            padding: '2px 8px', fontSize: 10, fontFamily: 'var(--font-mono)',
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 3, color: 'var(--muted)', cursor: 'pointer',
            transition: 'all 0.15s', letterSpacing: '0.04em',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#e85c50'; e.currentTarget.style.color = '#e85c50'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; }}
        >Not Bidding ✕</button>
        <button
          onClick={() => onTogglePriority(bid)}
          title={isHP ? 'Remove high priority' : 'Mark as high priority'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 16, lineHeight: 1, padding: 2,
            color: isHP ? '#facc15' : 'var(--border)',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => { if (!isHP) e.currentTarget.style.color = '#facc1588'; }}
          onMouseLeave={e => { if (!isHP) e.currentTarget.style.color = 'var(--border)'; }}
        >★</button>
      </div>

      {/* Date block */}
      <div style={{ textAlign: 'center', minWidth: 44, flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: col, lineHeight: 1 }}>
          {bid.bid_date ? new Date(bid.bid_date + 'T00:00:00').getDate() : '—'}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {bid.bid_date ? new Date(bid.bid_date + 'T00:00:00').toLocaleString('en-US', { month: 'short' }) : ''}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, paddingRight: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>{bid.name}</span>
          <UrgencyBadge days={days} />
          {isHP && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.35)', borderRadius: 3, color: '#facc15', fontSize: 10, fontWeight: 600 }}>
              ★ HIGH PRIORITY
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {clientNames.map(c => (
            <span key={c} style={{ padding: '1px 6px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--muted)', fontSize: 10 }}>{c}</span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {bid.bid_time && (
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>🕐 {bid.bid_time}</span>
          )}
          {bid.bid_amount > 0 && (
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              ${(bid.bid_amount / 1e6).toFixed(2)}M bid
            </span>
          )}
          {bid.notes && (
            <span style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }} title={bid.notes}>
              📝 {bid.notes}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Pre-Bid Card ──────────────────────────────────────────────────────────────
function PreBidCard({ bid }) {
  const days = getDaysUntil(bid.pre_bid);
  const col = urgencyColor(days);
  const clientNames = (bid.clients && bid.clients.length > 0) ? bid.clients : parseClients(bid.client || '');

  return (
    <div title={bid.notes || ''} style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${col}`,
      borderRadius: 8,
      padding: '12px 14px',
      cursor: bid.notes ? 'help' : 'default',
      transition: 'border-color 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Date block */}
        <div style={{ textAlign: 'center', minWidth: 40, flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: col, lineHeight: 1 }}>
            {bid.pre_bid ? new Date(bid.pre_bid + 'T00:00:00').getDate() : '—'}
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {bid.pre_bid ? new Date(bid.pre_bid + 'T00:00:00').toLocaleString('en-US', { month: 'short' }) : ''}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>{bid.name}</span>
            <UrgencyBadge days={days} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {clientNames.map(c => (
              <span key={c} style={{ padding: '1px 5px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--muted)', fontSize: 10 }}>{c}</span>
            ))}
            {bid.pre_bid_time && (
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>🕐 {bid.pre_bid_time}</span>
            )}
            {bid.bid_date && (
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>Bid: {bid.bid_date}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ title, count, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{title}</div>
      <div style={{ padding: '2px 8px', background: (color || 'var(--accent)') + '22', border: `1px solid ${color || 'var(--accent)'}55`, borderRadius: 10, fontSize: 11, color: color || 'var(--accent)', fontWeight: 600 }}>{count}</div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function BidDashboard({ bids: initialBids }) {
  const [bids, setBids] = useState(initialBids);

  // Keep in sync with parent refetch
  useMemo(() => setBids(initialBids), [initialBids]);

  const today = new Date(); today.setHours(0,0,0,0);
  const oneWeekAgo = new Date(today); oneWeekAgo.setDate(today.getDate() - 7);

  // Upcoming bids = Pending/Upcoming status, date >= 1 week ago, sorted by date ASC (soonest first), high priority first within same date
  const upcomingBids = useMemo(() => {
    return bids
      .filter(b => {
        const eff = b.effective_status || b.status;
        if (!['Pending','Upcoming'].includes(eff)) return false;
        if (!b.bid_date) return false;
        const d = new Date(b.bid_date + 'T00:00:00');
        return d >= oneWeekAgo;
      })
      .sort((a, b) => {
        // High priority first
        if (a.high_priority && !b.high_priority) return -1;
        if (!a.high_priority && b.high_priority) return 1;
        // Then by date ASC (past-due/sooner first)
        return a.bid_date.localeCompare(b.bid_date);
      });
  }, [bids]);

  // Upcoming pre-bids = has pre_bid date >= today, sorted soonest first
  const upcomingPreBids = useMemo(() => {
    const todayStr = today.toISOString().split('T')[0];
    return bids
      .filter(b => b.pre_bid && b.pre_bid >= todayStr)
      .sort((a, b) => a.pre_bid.localeCompare(b.pre_bid));
  }, [bids]);

  const handleTogglePriority = async (bid) => {
    const newVal = !bid.high_priority;
    const { error } = await supabase.from('lre_bids').update({ high_priority: newVal }).eq('id', bid.id);
    if (!error) setBids(prev => prev.map(b => b.id === bid.id ? { ...b, high_priority: newVal } : b));
  };

  const handleNotBidding = async (bid) => {
    const { error } = await supabase.from('lre_bids').update({ status_override: 'No Bid' }).eq('id', bid.id);
    if (!error) setBids(prev => prev.map(b => b.id === bid.id ? { ...b, status_override: 'No Bid', effective_status: 'No Bid' } : b));
  };

  const hpCount = upcomingBids.filter(b => b.high_priority).length;

  return (
    <div className="page">
      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Upcoming Bids', value: upcomingBids.length, color: 'var(--accent)' },
          { label: 'High Priority', value: hpCount, color: '#facc15' },
          { label: 'Past Due', value: upcomingBids.filter(b => getDaysUntil(b.bid_date) < 0).length, color: '#e85c50' },
          { label: 'Upcoming Pre-Bids', value: upcomingPreBids.length, color: '#a78bfa' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--surface)', border: `1px solid var(--border)`, borderRadius: 8, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, transparent)` }} />
            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color, lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>

        {/* Left: Upcoming Bids */}
        <div>
          <SectionHeader title="Upcoming Bids" count={upcomingBids.length} color="var(--accent)" />
          {upcomingBids.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>No upcoming bids</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {upcomingBids.map(b => (
                <BidCard key={b.id} bid={b} onTogglePriority={handleTogglePriority} onNotBidding={handleNotBidding} />
              ))}
            </div>
          )}
        </div>

        {/* Right: Pre-Bids */}
        <div>
          <SectionHeader title="Upcoming Pre-Bids" count={upcomingPreBids.length} color="#a78bfa" />
          {upcomingPreBids.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>No upcoming pre-bids</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcomingPreBids.map((b, i) => (
                <PreBidCard key={b.id ?? i} bid={b} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
