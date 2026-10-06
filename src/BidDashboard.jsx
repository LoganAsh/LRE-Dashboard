import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, ChevronDown, ChevronUp, Star, TriangleAlert, UsersRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from './supabase.js';
import { parseClients } from './hooks.js';
import { fmtFull$ } from './utils.js';
import { Card, CardStatSparkline } from './components/ui/card';
import { getUpcomingBids, getUpcomingPreBids } from './bidSelectors.js';
import { StatusModal } from './StatusModal.jsx';
import { MS_DAY, startOfToday, dateOf, daysUntil, dateAtTime, parseTime, fmtDate } from './dates.js';

/* ── helpers ──────────────────────────────────────────────────────────────── */

const clientsOf = (b) => (b.clients && b.clients.length > 0) ? b.clients : parseClients(b.client || '');

// Dot color for how soon something is due (same thresholds as the Bid Log)
function urgencyOf(days) {
  if (days < 0)  return { color: '#dc2626' };
  if (days <= 3) return { color: '#ea580c' };
  if (days <= 7) return { color: '#ca8a04' };
  return { color: '#16a34a' };
}
function countdown(days) {
  if (days < 0) return `${-days} ${-days === 1 ? 'Day' : 'Days'} Overdue`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} Days`;
}

const timeMinutes = (b) => { const t = parseTime(b.bid_time); return t ? t.h * 60 + t.min : 24 * 60; };
const byDueDate = (a, b) => a.bid_date.localeCompare(b.bid_date) || timeMinutes(a) - timeMinutes(b);

// Which agenda group a bid belongs to. High priority bids are pinned to the top, as before.
const GROUPS = [
  { key: 'priority', label: 'High Priority' },
  { key: 'overdue',  label: 'Past Due' },
  { key: 'this',     label: 'This Week' },
  { key: 'next',     label: 'Next Week' },
  { key: 'later',    label: 'Later' },
];
function groupOf(bid, today) {
  if (bid.high_priority) return 'priority';
  const d = dateOf(bid.bid_date);
  if (d < today) return 'overdue';
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay());   // weeks start Sunday, like the Calendar
  const weeksOut = Math.floor(Math.round((d - weekStart) / MS_DAY) / 7);
  return weeksOut <= 0 ? 'this' : weeksOut === 1 ? 'next' : 'later';
}

function useNow(ms = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}

/* ── stat card ────────────────────────────────────────────────────────────── */

const TONES = { accent: 'var(--accent)', gold: '#d99a06', danger: 'var(--lost)', violet: '#7c6cf0' };

function StatCard({ label, value, sub, icon: Icon, series, tone = 'accent' }) {
  const color = TONES[tone];
  const hasSeries = series && series.some((n) => n > 0);
  return (
    <Card interactive className="flex flex-col justify-between">
      <div className="relative p-5 pb-0">
        <Icon className="absolute right-5 top-5 size-[18px]" style={{ color }} strokeWidth={1.75} aria-hidden="true" />
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">{label}</div>
        <div className="mt-2 text-[30px] font-extrabold leading-none tracking-tight tabular-nums">{value}</div>
        {sub && <div className="mt-2 text-xs text-[var(--text-subtle)]">{sub}</div>}
      </div>
      <div className="relative mt-3 h-12 w-full" style={{ '--primitive-success': color }}>
        {hasSeries && <CardStatSparkline data={series} trend="up" width={280} height={48} preserveAspectRatio="none" className="h-full w-full" />}
      </div>
    </Card>
  );
}

/* ── next deadline ────────────────────────────────────────────────────────── */

function NextDeadline({ bids, onOpen }) {
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
  const preDays = bid.pre_bid ? daysUntil(bid.pre_bid) : null;
  const others = bids.filter((b) => b.id !== bid.id && daysUntil(b.bid_date) >= 0 && daysUntil(b.bid_date) <= 6).length;
  const detail = [clientsOf(bid).join(', '), hasTime ? bid.bid_time : null, bid.bid_amount > 0 ? `${fmtFull$(bid.bid_amount)} Bid` : null].filter(Boolean).join(' · ');
  const dotColor = urgencyOf(overdue || big === 'Time Passed' ? -1 : days).color;

  return (
    <Card className="mb-4">
      <section aria-labelledby="next-deadline-label" className="relative flex flex-wrap items-end justify-between gap-x-8 gap-y-3 px-6 py-5">
        <div className="min-w-0 flex-1">
          <div id="next-deadline-label" className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">
            {overdue ? 'Most Recent Past Due' : 'Next Deadline'}
          </div>
          <button
            type="button" onClick={() => onOpen(bid)} aria-haspopup="dialog"
            className="mt-1.5 block max-w-full appearance-none truncate border-0 bg-transparent p-0 text-left text-[22px] font-semibold leading-tight tracking-tight text-[var(--text)] [font-family:inherit] outline-none cursor-pointer hover:text-[#c2540a] focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[#ea580c] dark:hover:text-[#fb923c]"
          >
            {bid.name}
          </button>
          {detail && <div className="mt-1 text-[13px] text-[var(--text-secondary)]">{detail}</div>}
          {bid.pre_bid && preDays >= 0 && (
            <div className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
              Pre-Bid {fmtDate(bid.pre_bid)}{bid.pre_bid_time ? ` · ${bid.pre_bid_time}` : ''}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-2.5 text-[28px] font-semibold leading-none tracking-tight tabular-nums">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: dotColor }} aria-hidden="true" />
            {big}
          </div>
          <div className="mt-1.5 text-xs text-[var(--text-subtle)]">
            {fmtDate(bid.bid_date)}{others > 0 ? ` · ${others} More Due in the Next 7 Days` : ''}
          </div>
        </div>
      </section>
    </Card>
  );
}

/* ── upcoming bids: grouped agenda ────────────────────────────────────────── */

const textBtn = 'appearance-none border-0 bg-transparent p-0 text-xs font-medium [font-family:inherit] outline-none cursor-pointer focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[#ea580c]';
const revealOnHover = 'md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100';

function AgendaRow({ bid, onOpen, onTogglePriority, onNotBidding }) {
  const days = daysUntil(bid.bid_date);
  const u = urgencyOf(days);
  const d = dateOf(bid.bid_date);
  const meta = [clientsOf(bid).join(', '), bid.bid_time, bid.bid_amount > 0 ? fmtFull$(bid.bid_amount) : null].filter(Boolean).join(' · ');
  const hp = !!bid.high_priority;
  return (
    <div
      onClick={() => onOpen(bid)}
      className="group -mx-3 flex cursor-pointer items-center gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--text)_3%,transparent)]"
    >
      <div className="w-11 shrink-0 text-center leading-none">
        <div className="text-[22px] font-semibold tabular-nums">{d.getDate()}</div>
        <div className="mt-1 text-[10.5px] font-medium uppercase tracking-wide text-[var(--text-subtle)]">
          {d.toLocaleDateString('en-US', { month: 'short' })}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <button
          type="button" data-bid-name aria-haspopup="dialog" title={bid.name}
          onClick={(e) => { e.stopPropagation(); onOpen(bid); }}
          className="block max-w-full appearance-none truncate border-0 bg-transparent p-0 text-left text-[14px] font-semibold text-[var(--text)] [font-family:inherit] outline-none cursor-pointer hover:text-[#c2540a] focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[#ea580c] dark:hover:text-[#fb923c]"
        >
          {bid.name}
        </button>
        {meta && <div className="mt-0.5 truncate text-xs text-[var(--text-subtle)]">{meta}</div>}
      </div>

      <div className="flex shrink-0 items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => onNotBidding(bid)}
          aria-label={`Mark Not Bidding: ${bid.name}`}
          className={cn(textBtn, 'text-[var(--text-subtle)] hover:text-[#b91c1c] dark:hover:text-[#f87171]', revealOnHover)}
        >
          Not Bidding
        </button>
        <button
          type="button"
          onClick={() => onTogglePriority(bid)}
          aria-label={hp ? `Remove High Priority: ${bid.name}` : `Mark as High Priority: ${bid.name}`}
          title={hp ? 'Remove high priority' : 'Mark as high priority'}
          aria-pressed={hp}
          className={cn(
            'flex size-7 appearance-none items-center justify-center rounded-md border-0 bg-transparent outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-[#ea580c]',
            !hp && revealOnHover
          )}
        >
          <Star className={cn('size-4', hp ? 'fill-[#d99a06] text-[#d99a06]' : 'text-[var(--text-subtle)] hover:text-[#d99a06]')} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <span className={cn('inline-flex w-[104px] items-center justify-end gap-2 whitespace-nowrap text-[13px] tabular-nums max-sm:w-auto', days < 0 ? 'font-medium text-[#b91c1c] dark:text-[#f87171]' : 'text-[var(--text-secondary)]')}>
          <span className="size-1.5 shrink-0 rounded-full" style={{ background: u.color }} aria-hidden="true" />
          {countdown(days)}
        </span>
      </div>
    </div>
  );
}

function SectionHeading({ title, count }) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
      <span className="text-[13px] tabular-nums text-[var(--text-subtle)]">{count}</span>
    </div>
  );
}

/* ── pre-bids: timeline ───────────────────────────────────────────────────── */

function PreBidTimeline({ preBids, onOpen }) {
  return (
    <ol className="relative ml-1 border-l border-[color:var(--border)] pl-5">
      {preBids.map((b) => {
        const days = daysUntil(b.pre_bid);
        const u = urgencyOf(days);
        const when = [fmtDate(b.pre_bid, false), b.pre_bid_time].filter(Boolean).join(' · ');
        return (
          <li key={b.id} title={b.notes || undefined} className="relative pb-5 last:pb-0">
            <span className="absolute -left-[26px] top-[5px] size-2 rounded-full ring-4 ring-[var(--card)]" style={{ background: u.color }} aria-hidden="true" />
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">{when}</span>
              <span className="whitespace-nowrap text-xs tabular-nums text-[var(--text-secondary)]">{countdown(days)}</span>
            </div>
            <button
              type="button" onClick={() => onOpen(b)} aria-haspopup="dialog"
              className="mt-0.5 block max-w-full appearance-none truncate border-0 bg-transparent p-0 text-left text-[14px] font-semibold text-[var(--text)] [font-family:inherit] outline-none cursor-pointer hover:text-[#c2540a] focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[#ea580c] dark:hover:text-[#fb923c]"
            >
              {b.name}
            </button>
            <div className="mt-0.5 truncate text-xs text-[var(--text-subtle)]">
              {[clientsOf(b).join(', '), b.bid_date ? `Bid Due ${fmtDate(b.bid_date, false)}` : null].filter(Boolean).join(' · ')}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ── page ─────────────────────────────────────────────────────────────────── */

export default function BidDashboard({ bids: initialBids }) {
  const [bids, setBids] = useState(initialBids);
  const [showNotBidding, setShowNotBidding] = useState(false);
  const [modalBid, setModalBid] = useState(null);

  useEffect(() => { setBids(initialBids); }, [initialBids]);

  const today = startOfToday();
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(today.getDate() - 7);

  const upcomingBids = useMemo(() => getUpcomingBids(bids), [bids]);
  const upcomingPreBids = useMemo(() => getUpcomingPreBids(bids), [bids]);

  const notBiddingBids = useMemo(() =>
    bids
      .filter((b) => b.status_override === 'No Bid' && b.bid_date && new Date(b.bid_date + 'T00:00:00') >= oneWeekAgo)
      .sort((a, b) => a.bid_date.localeCompare(b.bid_date)),
  [bids]);

  const agenda = useMemo(() => {
    const t = startOfToday();
    const buckets = Object.fromEntries(GROUPS.map((g) => [g.key, []]));
    upcomingBids.forEach((b) => buckets[groupOf(b, t)].push(b));
    GROUPS.forEach((g) => buckets[g.key].sort(byDueDate));
    return GROUPS.map((g) => ({ ...g, items: buckets[g.key] })).filter((g) => g.items.length > 0);
  }, [upcomingBids]);

  const handleTogglePriority = async (bid) => {
    const newVal = !bid.high_priority;
    const { error } = await supabase.from('lre_bids').update({ high_priority: newVal }).eq('id', bid.id);
    if (!error) setBids((prev) => prev.map((b) => (b.id === bid.id ? { ...b, high_priority: newVal } : b)));
  };

  const handleNotBidding = async (bid) => {
    const { error } = await supabase.from('lre_bids').update({ status_override: 'No Bid' }).eq('id', bid.id);
    if (!error) setBids((prev) => prev.map((b) => (b.id === bid.id ? { ...b, status_override: 'No Bid', effective_status: 'No Bid' } : b)));
  };

  const handleUndoNotBidding = async (bid) => {
    const { error } = await supabase.from('lre_bids').update({ status_override: null }).eq('id', bid.id);
    if (!error) setBids((prev) => prev.map((b) => (b.id === bid.id ? { ...b, status_override: null, effective_status: b.status } : b)));
  };

  const handleSave = (updated) => setBids((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));

  // Real series: how many bids / pre-bids land in each of the next 8 weeks
  const weekly = (dates) => {
    const arr = Array(8).fill(0);
    dates.forEach((d) => { const days = daysUntil(d); if (days !== null && days >= 0 && days < 56) arr[Math.floor(days / 7)]++; });
    return arr;
  };
  const bidsWeekly = weekly(upcomingBids.map((b) => b.bid_date));
  const preBidsWeekly = weekly(upcomingPreBids.map((b) => b.pre_bid));
  const pastDue = upcomingBids.filter((b) => daysUntil(b.bid_date) < 0).length;
  const highPri = upcomingBids.filter((b) => b.high_priority).length;

  return (
    <div className="page">
      {modalBid && <StatusModal bid={modalBid} onClose={() => setModalBid(null)} onSave={handleSave} />}

      <NextDeadline bids={upcomingBids} onOpen={setModalBid} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="Upcoming Bids" value={upcomingBids.length} sub={`${bidsWeekly[0]} Due in the Next 7 Days`} icon={CalendarClock} series={bidsWeekly} tone="accent" />
        <StatCard label="High Priority" value={highPri} sub={`Of ${upcomingBids.length} Upcoming`} icon={Star} tone="gold" />
        <StatCard label="Past Due" value={pastDue} sub="Awaiting a Status Update" icon={TriangleAlert} tone="danger" />
        <StatCard label="Upcoming Pre-Bids" value={upcomingPreBids.length} sub={`${preBidsWeekly[0]} in the Next 7 Days`} icon={UsersRound} series={preBidsWeekly} tone="violet" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 16, alignItems: 'start' }} className="dashboard-grid">
        <Card className="p-5">
          <SectionHeading title="Upcoming Bids" count={upcomingBids.length} />
          {agenda.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-[var(--text-subtle)]">No Upcoming Bids</div>
          ) : (
            agenda.map((g, gi) => (
              <section key={g.key} aria-label={g.label} className={gi > 0 ? 'mt-6' : undefined}>
                <div className="mb-1 flex items-center gap-2 border-b border-[color:var(--border)] pb-2">
                  {g.key === 'priority' && <Star className="size-3.5 fill-[#d99a06] text-[#d99a06]" strokeWidth={1.75} aria-hidden="true" />}
                  <h3 className={cn('text-[11px] font-semibold uppercase tracking-[0.06em]', g.key === 'overdue' ? 'text-[#b91c1c] dark:text-[#f87171]' : 'text-[var(--text-subtle)]')}>
                    {g.label}
                  </h3>
                  <span className="text-[11px] tabular-nums text-[var(--text-subtle)]">{g.items.length}</span>
                </div>
                <div>
                  {g.items.map((b) => (
                    <AgendaRow key={b.id} bid={b} onOpen={setModalBid} onTogglePriority={handleTogglePriority} onNotBidding={handleNotBidding} />
                  ))}
                </div>
              </section>
            ))
          )}
        </Card>

        <Card className="p-5">
          <SectionHeading title="Upcoming Pre-Bids" count={upcomingPreBids.length} />
          {upcomingPreBids.length === 0
            ? <div className="py-10 text-center text-[13px] text-[var(--text-subtle)]">No Upcoming Pre-Bids</div>
            : <PreBidTimeline preBids={upcomingPreBids} onOpen={setModalBid} />}
        </Card>
      </div>

      {/* Not Bidding */}
      <div className="mt-8 border-t border-[color:var(--border)] pt-5">
        <button
          type="button" aria-expanded={showNotBidding} onClick={() => setShowNotBidding((v) => !v)}
          className="inline-flex appearance-none items-center gap-2 border-0 bg-transparent p-0 text-[13px] font-medium text-[var(--text-secondary)] [font-family:inherit] outline-none cursor-pointer hover:text-[var(--text)] focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[#ea580c]"
        >
          {showNotBidding ? <ChevronUp className="size-4" strokeWidth={1.75} aria-hidden="true" /> : <ChevronDown className="size-4" strokeWidth={1.75} aria-hidden="true" />}
          Not Bidding{' '}
          <span className="font-normal tabular-nums text-[var(--text-subtle)]">{notBiddingBids.length}</span>
        </button>

        {showNotBidding && (
          <div className="mt-3">
            {notBiddingBids.length === 0 ? (
              <div className="text-xs text-[var(--text-subtle)]">No bids marked as Not Bidding.</div>
            ) : (
              <div className="divide-y divide-[color:var(--border)]">
                {notBiddingBids.map((b) => (
                  <div key={b.id} className="flex items-center gap-4 py-2.5">
                    <span className="w-[104px] shrink-0 text-xs tabular-nums text-[var(--text-subtle)]">{fmtDate(b.bid_date)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-[var(--text-secondary)]">{b.name}</div>
                      <div className="truncate text-xs text-[var(--text-subtle)]">{[clientsOf(b).join(', '), b.bid_time].filter(Boolean).join(' · ')}</div>
                    </div>
                    <button
                      type="button" onClick={() => handleUndoNotBidding(b)} aria-label={`Restore ${b.name}`}
                      className={cn(textBtn, 'shrink-0 text-[#c2540a] hover:underline dark:text-[#fb923c]')}
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
