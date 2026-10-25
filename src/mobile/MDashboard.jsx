import { useEffect, useMemo, useState } from 'react';
import { Ban, ChevronRight, Ellipsis, ExternalLink, RotateCcw, Star, StickyNote } from 'lucide-react';
import { supabase } from '../supabase.js';
import { fmt$ } from '../utils.js';
import { getUpcomingBids, getUpcomingPreBids } from '../bidSelectors.js';
import { StatusModal } from '../StatusModal.jsx';
import { startOfToday, daysUntil, dateAtTime, fmtDate } from '../dates.js';
import { useBillingProjects, nextBillingDate, billingLabel } from '../projectBilling.js';
import { clientsOf, urgencyOf, countdown, byDueDate, GROUPS, groupOf, shortTime } from '../dashboardHelpers.js';
import Sheet from './Sheet.jsx';
import { DateBlock, SectionHead, rowKeys } from './ui.jsx';

function useNow(ms = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}

/* ── Next Deadline: the big card at the top ───────────────────────────────── */
function Hero({ bids, onOpen }) {
  const now = useNow();
  const pick = useMemo(() => {
    const dated = bids.filter((b) => daysUntil(b.bid_date) >= 0).sort(byDueDate);
    if (dated.length) return { bid: dated[0], overdue: false };
    const late = bids.filter((b) => daysUntil(b.bid_date) < 0).sort(byDueDate).reverse();
    return late.length ? { bid: late[0], overdue: true } : null;
  }, [bids]);
  if (!pick) return null;
  const { bid, overdue } = pick;
  const days = daysUntil(bid.bid_date);
  const { at, hasTime } = dateAtTime(bid.bid_date, bid.bid_time);
  let big = countdown(days);
  if (!overdue && days === 0 && hasTime) {
    const mins = Math.floor((at - now) / 60000);
    big = mins <= 0 ? 'Time Passed' : mins < 60 ? `In ${mins} Min` : `In ${Math.floor(mins / 60)} Hr ${mins % 60} Min`;
  }
  const others = bids.filter((b) => b.id !== bid.id && daysUntil(b.bid_date) >= 0 && daysUntil(b.bid_date) <= 6).length;
  const preDays = bid.pre_bid ? daysUntil(bid.pre_bid) : null;
  const detail = [fmtDate(bid.bid_date), hasTime ? shortTime(bid.bid_time) : null, bid.bid_amount > 0 ? `${fmt$(bid.bid_amount)} Bid` : null, clientsOf(bid).join(', ')].filter(Boolean).join(' · ');   // client last, so a long name is the part that gets cut
  const tone = urgencyOf(overdue || big === 'Time Passed' ? -1 : days).color;
  return (
    <button type="button" className="m-hero contour compact" style={{ '--tone': tone }} onClick={() => onOpen(bid)} aria-haspopup="dialog">
      <div className="m-hero-top">
        <span className="m-eyebrow">{overdue ? 'Most Recent Past Due' : 'Next Deadline'}</span>
        {others > 0 && <span className="m-hero-more">{others} More Due in 7 Days</span>}
      </div>
      <div className="m-hero-big"><span className="m-dot" aria-hidden="true" />{big}</div>
      <div className="m-hero-name">{bid.name}</div>
      {detail && <div className="m-hero-detail">{detail}</div>}
      {bid.pre_bid && preDays >= 0 && <div className="m-hero-detail">Pre-Bid {fmtDate(bid.pre_bid)}{bid.pre_bid_time ? ` · ${shortTime(bid.pre_bid_time)}` : ''}</div>}
    </button>
  );
}

function StatTile({ label, value, sub, tone }) {
  return (
    <div className="m-stat contour" style={tone ? { '--tone': tone } : undefined}>
      <div className="m-stat-label">{label}</div>
      <div className="m-stat-row"><span className="m-stat-num">{value}</span><span className="m-stat-sub">{sub}</span></div>
    </div>
  );
}

/* ── one bid in the list ──────────────────────────────────────────────────── */
function BidRow({ bid, onOpen, onStar, onMore }) {
  const days = daysUntil(bid.bid_date);
  const tone = urgencyOf(days).color;
  return (
    <div className="m-row compact" role="button" tabIndex={0} onClick={() => onOpen(bid)} onKeyDown={rowKeys(() => onOpen(bid))} aria-label={`${bid.name}, ${countdown(days)}`}>
      <DateBlock iso={bid.bid_date} tone={tone} />
      <div className="m-row-main">
        <div className="m-row-titleline"><span className="m-row-title">{bid.name}</span>{bid.user_notes && <StickyNote size={12} aria-label="Has notes" />}</div>
        <div className="m-row-line" style={{ '--tone': tone }}>
          <span className="tone">{countdown(days)}</span>
          {bid.bid_time && days >= 0 && <span>{shortTime(bid.bid_time)}</span>}   {/* an overdue bid's clock time no longer matters; the room goes to the client name */}
          {bid.bid_amount > 0 && <span>{fmt$(bid.bid_amount)}</span>}
          <span className="t">{clientsOf(bid).join(', ')}</span>
        </div>
      </div>
      <div className="m-row-actions" onClick={(e) => e.stopPropagation()}>
        <button type="button" className={`m-icon-btn ${bid.high_priority ? 'on' : ''}`} aria-pressed={!!bid.high_priority}
          aria-label={`${bid.high_priority ? 'Remove High Priority' : 'Mark as High Priority'}: ${bid.name}`} onClick={() => onStar(bid)}><Star strokeWidth={1.75} /></button>
        <button type="button" className="m-icon-btn" aria-label={`More actions: ${bid.name}`} aria-haspopup="dialog" onClick={() => onMore(bid)}><Ellipsis strokeWidth={1.75} /></button>
      </div>
    </div>
  );
}

function SimpleRow({ iso, tone, title, sub, meta, onClick, label }) {
  return (
    <button type="button" className="m-row" onClick={onClick} aria-label={label}>
      <DateBlock iso={iso} tone={tone} />
      <div className="m-row-main">
        <div className="m-row-title">{title}</div>
        {sub && <div className="m-row-sub"><span className="t">{sub}</span></div>}
        {meta && <div className="m-row-meta">{meta}</div>}
      </div>
      <ChevronRight size={18} style={{ color: 'var(--muted)', opacity: 0.6, flex: 'none', marginRight: 6 }} aria-hidden="true" />
    </button>
  );
}

export default function MDashboard({ bids: initialBids, onNavigate }) {
  const [bids, setBids] = useState(initialBids);
  const [modalBid, setModalBid] = useState(null);
  const [actionBid, setActionBid] = useState(null);
  const [showNotBidding, setShowNotBidding] = useState(false);
  useEffect(() => { setBids(initialBids); }, [initialBids]);

  const upcomingBids = useMemo(() => getUpcomingBids(bids), [bids]);
  const upcomingPreBids = useMemo(() => getUpcomingPreBids(bids), [bids]);
  const { projects: billingProjects } = useBillingProjects();
  const upcomingBillings = useMemo(() => {
    const today = startOfToday();
    return billingProjects.map((p) => ({ project: p, date: nextBillingDate(p, today) })).filter((x) => x.date)
      .sort((a, b) => a.date - b.date || a.project.name.localeCompare(b.project.name));
  }, [billingProjects]);
  const notBiddingBids = useMemo(() => {
    const cutoff = startOfToday(); cutoff.setDate(cutoff.getDate() - 7);
    return bids.filter((b) => b.status_override === 'No Bid' && b.bid_date && new Date(b.bid_date + 'T00:00:00') >= cutoff).sort((a, b) => a.bid_date.localeCompare(b.bid_date));
  }, [bids]);
  const agenda = useMemo(() => {
    const t = startOfToday();
    const buckets = Object.fromEntries(GROUPS.map((g) => [g.key, []]));
    upcomingBids.forEach((b) => buckets[groupOf(b, t)].push(b));
    GROUPS.forEach((g) => buckets[g.key].sort(byDueDate));
    return GROUPS.map((g) => ({ ...g, items: buckets[g.key] })).filter((g) => g.items.length > 0);
  }, [upcomingBids]);

  const patch = (id, fields) => setBids((prev) => prev.map((b) => (b.id === id ? { ...b, ...fields } : b)));
  const togglePriority = async (bid) => {
    const v = !bid.high_priority;
    const { error } = await supabase.from('lre_bids').update({ high_priority: v }).eq('id', bid.id);
    if (!error) patch(bid.id, { high_priority: v });
  };
  const notBidding = async (bid) => {
    const { error } = await supabase.from('lre_bids').update({ status_override: 'No Bid' }).eq('id', bid.id);
    if (!error) patch(bid.id, { status_override: 'No Bid', effective_status: 'No Bid' });
  };
  const undoNotBidding = async (bid) => {
    const { error } = await supabase.from('lre_bids').update({ status_override: null }).eq('id', bid.id);
    if (!error) patch(bid.id, { status_override: null, effective_status: bid.status });
  };

  const weekly = (dates) => { const arr = Array(8).fill(0); dates.forEach((d) => { const n = daysUntil(d); if (n !== null && n >= 0 && n < 56) arr[Math.floor(n / 7)]++; }); return arr; };
  const dueSoon = weekly(upcomingBids.map((b) => b.bid_date))[0];
  const preSoon = weekly(upcomingPreBids.map((b) => b.pre_bid))[0];
  const pastDue = upcomingBids.filter((b) => daysUntil(b.bid_date) < 0).length;
  const highPri = upcomingBids.filter((b) => b.high_priority).length;

  return (
    <>
      {modalBid && <StatusModal bid={modalBid} onClose={() => setModalBid(null)} onSave={(u) => setBids((prev) => prev.map((b) => (b.id === u.id ? u : b)))} />}

      <Hero bids={upcomingBids} onOpen={setModalBid} />

      <div className="m-stats">
        <StatTile label="Upcoming Bids" value={upcomingBids.length} sub={`${dueSoon} Due This Week`} tone="var(--accent)" />
        <StatTile label="High Priority" value={highPri} sub={`Of ${upcomingBids.length} Upcoming`} tone="#d99a06" />
        <StatTile label="Past Due" value={pastDue} sub="Awaiting an Update" tone={pastDue ? 'var(--lost)' : undefined} />
        <StatTile label="Pre-Bids" value={upcomingPreBids.length} sub={`${preSoon} This Week`} tone="#7c6cf0" />
      </div>

      <section className="m-section" aria-label="Upcoming Bids">
        <SectionHead title="Upcoming Bids" count={upcomingBids.length} />
        <div className="m-card">
          {agenda.length === 0 && <div className="m-empty"><b>No Upcoming Bids</b>New bids show up here after the next sync.</div>}
          {agenda.map((g) => (
            <div key={g.key} role="group" aria-label={g.label}>
              <div className={`m-group-head ${g.key === 'overdue' ? 'late' : ''}`}>
                {g.key === 'priority' && <Star size={13} fill="#d99a06" color="#d99a06" aria-hidden="true" />}
                {g.label}<span className="m-count" style={{ marginLeft: 'auto' }}>{g.items.length}</span>
              </div>
              {g.items.map((b) => <BidRow key={b.id} bid={b} onOpen={setModalBid} onStar={togglePriority} onMore={setActionBid} />)}
            </div>
          ))}
        </div>
      </section>

      {upcomingPreBids.length > 0 && (
        <section className="m-section" aria-label="Upcoming Pre-Bids">
          <SectionHead title="Upcoming Pre-Bids" count={upcomingPreBids.length} />
          <div className="m-card">
            {upcomingPreBids.map((b) => (
              <SimpleRow key={b.id} iso={b.pre_bid} tone="#7c6cf0" title={b.name} sub={clientsOf(b).join(', ')}
                meta={[<span key="t" className="tone" style={{ '--tone': '#7c6cf0' }}>{countdown(daysUntil(b.pre_bid))}</span>, b.pre_bid_time && <span key="p">{b.pre_bid_time}</span>]}
                onClick={() => setModalBid(b)} label={`Pre-bid for ${b.name}`} />
            ))}
          </div>
        </section>
      )}

      {upcomingBillings.length > 0 && (
        <section className="m-section" aria-label="Upcoming Billings">
          <SectionHead title="Upcoming Billings" count={upcomingBillings.length} />
          <div className="m-card">
            {upcomingBillings.map(({ project, date }) => {
              const days = Math.round((date - startOfToday()) / 86400000);
              return (
                <SimpleRow key={project.id} iso={`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`} tone="#0f766e"
                  title={project.name} sub={[project.client, billingLabel(project.billing_day)].filter(Boolean).join(' · ')}
                  meta={[<span key="c" className="tone" style={{ '--tone': '#0f766e' }}>{countdown(days)}</span>]}
                  onClick={() => onNavigate && onNavigate('Projects')} label={`Billing for ${project.name}`} />
              );
            })}
          </div>
        </section>
      )}

      {notBiddingBids.length > 0 && (
        <section className="m-section" aria-label="Not Bidding">
          <SectionHead title="Not Bidding" count={notBiddingBids.length}
            action={<button type="button" className="m-link" onClick={() => setShowNotBidding((s) => !s)} aria-expanded={showNotBidding}>{showNotBidding ? 'Hide' : `Show ${notBiddingBids.length}`}</button>} />
          {showNotBidding && (
            <div className="m-card">
              {notBiddingBids.map((b) => (
                <div key={b.id} className="m-row" style={{ minHeight: 64 }}>
                  <DateBlock iso={b.bid_date} />
                  <div className="m-row-main"><div className="m-row-title">{b.name}</div><div className="m-row-sub">{clientsOf(b).join(', ')}</div></div>
                  <button type="button" className="m-link" onClick={() => undoNotBidding(b)} aria-label={`Restore ${b.name}`} style={{ padding: '10px 12px', display: 'inline-flex', gap: 5, alignItems: 'center' }}><RotateCcw size={14} aria-hidden="true" />Restore</button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <Sheet open={!!actionBid} onClose={() => setActionBid(null)} title={actionBid ? actionBid.name : ''} subtitle={actionBid ? clientsOf(actionBid).join(', ') : ''}>
        {actionBid && (
          <div>
            <button type="button" className="m-action" onClick={() => { setModalBid(actionBid); setActionBid(null); }}><ExternalLink strokeWidth={1.75} /><span className="m-action-text">Open Details</span></button>
            <button type="button" className="m-action" onClick={() => { togglePriority(actionBid); setActionBid(null); }}>
              <Star strokeWidth={1.75} /><span className="m-action-text">{actionBid.high_priority ? 'Remove High Priority' : 'Mark as High Priority'}</span>
            </button>
            <button type="button" className="m-action danger" onClick={() => { notBidding(actionBid); setActionBid(null); }}>
              <Ban strokeWidth={1.75} /><span className="m-action-text">Mark Not Bidding<small>Moves it to the Not Bidding list. You can restore it.</small></span>
            </button>
          </div>
        )}
      </Sheet>
    </>
  );
}
