import { useState, useMemo, useEffect } from 'react';
import { supabase } from './supabase.js';
import { parseClients } from './hooks.js';

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
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 3,
      background: col + '22', border: `1px solid ${col}55`,
      color: col, fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', whiteSpace: 'nowrap',
    }}>{urgencyLabel(days)}</span>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function BidCard({ bid, onTogglePriority, onNotBidding }) {
  const days = getDaysUntil(bid.bid_date);
  const col = urgencyColor(days);
  const isHP = !!bid.high_priority;
  const clientNames = (bid.clients && bid.clients.length > 0) ? bid.clients : parseClients(bid.client || '');

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${isHP ? 'rgba(250,204,21,0.4)' : 'var(--border)'}`,
      borderLeft: `3px solid ${col}`,
      borderRadius: 8, padding: '14px 16px',
      display: 'flex', alignItems: 'flex-start', gap: 12,
      position: 'relative',
    }}>
      {/* Top-right controls */}
      <div style={{ position: 'absolute', top: 8, right: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={() => onNotBidding(bid)} style={{
          padding: '2px 8px', fontSize: 10, fontFamily: 'var(--font-mono)',
          background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: 3, color: 'var(--muted)', cursor: 'pointer', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#e85c50'; e.currentTarget.style.color = '#e85c50'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; }}
        >Not Bidding ✕</button>
        <button onClick={() => onTogglePriority(bid)} title={isHP ? 'Remove high priority' : 'Mark as high priority'} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 16, lineHeight: 1, padding: 2,
          color: isHP ? '#facc15' : 'var(--border)', transition: 'color 0.15s',
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
      <div style={{ flex: 1, minWidth: 0, paddingRight: 120 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>{bid.name}</span>
          <UrgencyBadge days={days} />
          {isHP && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.35)', borderRadius: 3, color: '#facc15', fontSize: 10, fontWeight: 600 }}>★ HIGH PRIORITY</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
          {clientNames.map(c => (
            <span key={c} style={{ padding: '1px 6px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--muted)', fontSize: 10 }}>{c}</span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {bid.bid_time && <span style={{ fontSize: 11, color: 'var(--muted)' }}>🕐 {bid.bid_time}</span>}
          {bid.bid_amount > 0 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>${(bid.bid_amount / 1e6).toFixed(2)}M bid</span>}
          {bid.notes && <span style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }} title={bid.notes}>📝 {bid.notes}</span>}
        </div>
      </div>
    </div>
  );
}

function PreBidCard({ bid }) {
  const days = getDaysUntil(bid.pre_bid);
  const col = urgencyColor(days);
  const clientNames = (bid.clients && bid.clients.length > 0) ? bid.clients : parseClients(bid.client || '');

  return (
    <div title={bid.notes || ''} style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderLeft: `3px solid ${col}`, borderRadius: 8, padding: '12px 14px',
      cursor: bid.notes ? 'help' : 'default',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
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
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>{bid.name}</span>
            <UrgencyBadge days={days} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {clientNames.map(c => (
              <span key={c} style={{ padding: '1px 5px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--muted)', fontSize: 10 }}>{c}</span>
            ))}
            {bid.pre_bid_time && <span style={{ fontSize: 11, color: 'var(--muted)' }}>🕐 {bid.pre_bid_time}</span>}
            {bid.bid_date && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Bid: {bid.bid_date}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BidDashboard({ bids: initialBids }) {
  const [bids, setBids] = useState(initialBids);
  const [showNotBidding, setShowNotBidding] = useState(false);

  useEffect(() => { setBids(initialBids); }, [initialBids]);

  const today = new Date(); today.setHours(0,0,0,0);
  const oneWeekAgo = new Date(today); oneWeekAgo.setDate(today.getDate() - 7);
  const todayStr = today.toISOString().split('T')[0];

  const upcomingBids = useMemo(() =>
    bids
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
      }),
  [bids]);

  const upcomingPreBids = useMemo(() =>
    bids
      .filter(b => b.pre_bid && String(b.pre_bid) >= todayStr)
      .sort((a, b) => String(a.pre_bid).localeCompare(String(b.pre_bid))),
  [bids]);

  const notBiddingBids = useMemo(() =>
    bids
      .filter(b => b.status_override === 'No Bid' && b.bid_date && new Date(b.bid_date + 'T00:00:00') >= oneWeekAgo)
      .sort((a, b) => a.bid_date.localeCompare(b.bid_date)),
  [bids]);

  const handleTogglePriority = async (bid) => {
    const newVal = !bid.high_priority;
    const { error } = await supabase.from('lre_bids').update({ high_priority: newVal }).eq('id', bid.id);
    if (!error) setBids(prev => prev.map(b => b.id === bid.id ? { ...b, high_priority: newVal } : b));
  };

  const handleNotBidding = async (bid) => {
    const { error } = await supabase.from('lre_bids').update({ status_override: 'No Bid' }).eq('id', bid.id);
    if (!error) setBids(prev => prev.map(b => b.id === bid.id ? { ...b, status_override: 'No Bid', effective_status: 'No Bid' } : b));
  };

  const handleUndoNotBidding = async (bid) => {
    const { error } = await supabase.from('lre_bids').update({ status_override: null }).eq('id', bid.id);
    if (!error) setBids(prev => prev.map(b => b.id === bid.id ? { ...b, status_override: null, effective_status: b.status } : b));
  };

  return (
    <div className="page">
      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
        <StatCard label="Upcoming Bids"    value={upcomingBids.length}                                        color="var(--accent)" />
        <StatCard label="High Priority"    value={upcomingBids.filter(b => b.high_priority).length}           color="#facc15" />
        <StatCard label="Past Due"         value={upcomingBids.filter(b => getDaysUntil(b.bid_date) < 0).length} color="#e85c50" />
        <StatCard label="Upcoming Pre-Bids" value={upcomingPreBids.length}                                    color="#a78bfa" />
      </div>

      {/* Main two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 16, alignItems: 'start' }} className="dashboard-grid">
        {/* Upcoming Bids */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>Upcoming Bids</div>
            <div style={{ padding: '2px 8px', background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 10, fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{upcomingBids.length}</div>
          </div>
          {upcomingBids.length === 0
            ? <div style={{ color: 'var(--muted)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>No upcoming bids</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {upcomingBids.map(b => <BidCard key={b.id} bid={b} onTogglePriority={handleTogglePriority} onNotBidding={handleNotBidding} />)}
              </div>
          }
        </div>

        {/* Pre-Bids */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>Upcoming Pre-Bids</div>
            <div style={{ padding: '2px 8px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 10, fontSize: 11, color: '#a78bfa', fontWeight: 600 }}>{upcomingPreBids.length}</div>
          </div>
          {upcomingPreBids.length === 0
            ? <div style={{ color: 'var(--muted)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>No upcoming pre-bids</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcomingPreBids.map((b, i) => <PreBidCard key={b.id ?? i} bid={b} />)}
              </div>
          }
        </div>
      </div>

      {/* Not Bidding section */}
      <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
        <button onClick={() => setShowNotBidding(v => !v)} style={{
          display: 'flex', alignItems: 'center', gap: 8, background: 'none',
          border: '1px solid var(--border)', borderRadius: 6, padding: '7px 14px',
          cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12,
          color: 'var(--muted)', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; }}
        >
          <span>{showNotBidding ? '▲' : '▼'}</span>
          Not Bidding
          <span style={{ padding: '1px 7px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 11 }}>{notBiddingBids.length}</span>
        </button>

        {showNotBidding && (
          <div style={{ marginTop: 14 }}>
            {notBiddingBids.length === 0
              ? <div style={{ color: 'var(--muted)', fontSize: 12 }}>No bids marked as Not Bidding.</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {notBiddingBids.map(b => {
                    const clientNames = (b.clients && b.clients.length > 0) ? b.clients : parseClients(b.client || '');
                    return (
                      <div key={b.id} style={{
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderLeft: '3px solid var(--muted)', borderRadius: 8,
                        padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: 0.7,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>{b.name}</span>
                            <span style={{ fontSize: 10, color: 'var(--muted)' }}>{b.bid_date}</span>
                            {b.bid_time && <span style={{ fontSize: 10, color: 'var(--muted)' }}>🕐 {b.bid_time}</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {clientNames.map(c => (
                              <span key={c} style={{ padding: '1px 5px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--muted)', fontSize: 10 }}>{c}</span>
                            ))}
                          </div>
                        </div>
                        <button onClick={() => handleUndoNotBidding(b)} style={{
                          padding: '3px 10px', fontSize: 11, fontFamily: 'var(--font-mono)',
                          background: 'var(--surface2)', border: '1px solid var(--border)',
                          borderRadius: 4, color: 'var(--muted)', cursor: 'pointer',
                          transition: 'all 0.15s', whiteSpace: 'nowrap', flexShrink: 0,
                        }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--won)'; e.currentTarget.style.color = 'var(--won)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; }}
                        >↩ Restore</button>
                      </div>
                    );
                  })}
                </div>
            }
          </div>
        )}
      </div>
    </div>
  );
}
