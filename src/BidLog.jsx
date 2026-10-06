import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, BellRing, ChevronLeft, ChevronRight, ChevronsUpDown, Star, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtFull$, fmt$, classifyStatus, YEARS, filterByType, isPublicBid } from './utils.js';
import { parseClients } from './hooks.js';
import { StatusModal } from './StatusModal.jsx';

export { StatusModal };

const PAGE_SIZE = 25;

const COLS = [
  { key: 'bid_date',         label: 'Bid Date' },
  { key: 'pre_bid',          label: 'Pre-Bid',     small: false },
  { key: 'name',             label: 'Project' },
  { key: 'client',           label: 'Client',      small: false },
  { key: 'bid_amount',       label: 'Bid Amount',  right: true },
  { key: 'award_amount',     label: 'Award',       right: true, small: false },
  { key: 'margin_pct',       label: 'Margin %',    right: true, small: false },
  { key: 'projected_profit', label: 'Profit + OH', right: true, small: false },
  { key: 'effective_status', label: 'Status' },
];
// small === false -> hidden on phones (the project cell shows the client underneath instead)

const STATUS_TABS = ['Won', 'Lost', 'Pending', 'Upcoming', 'No Bid', 'Client Not Awarded', 'Project Re-Bid'];

// "2026-10-12" -> "Oct 12, 2026" (built from parts so the day never shifts with time zones)
function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return String(iso);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Rows with no bid amount yet (upcoming / no-bid) get a small urgency dot next to the date.
function urgency(bid) {
  if (bid.bid_amount > 0 || !bid.bid_date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((new Date(bid.bid_date + 'T00:00:00') - today) / (1000 * 60 * 60 * 24));
  if (diff < 0)  return { color: '#dc2626', label: 'Past due' };
  if (diff <= 3) return { color: '#ea580c', label: 'Due within 3 days' };
  if (diff <= 7) return { color: '#ca8a04', label: 'Due within 7 days' };
  return { color: '#16a34a', label: 'Due in more than 7 days' };
}

const clientsOf = (b) => (b.clients && b.clients.length > 0) ? b.clients : parseClients(b.client || '');
const greenText = 'text-[#15803d] dark:text-[#4ade80]';

export default function BidLog({ bids: initialBids }) {
  const [bids, setBids] = useState(initialBids);
  const [typeFilter, setTypeFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [sortKey, setSortKey] = useState('bid_date');
  const [sortDir, setSortDir] = useState(-1);
  const [page, setPage] = useState(1);
  const [modalBid, setModalBid] = useState(null);

  useEffect(() => { setBids(initialBids); }, [initialBids]);

  const handleSave = (updated) => setBids((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));

  // Top 10 clients by bid volume (marked with a green dot)
  const topClientNames = useMemo(() => {
    const volume = {};
    bids.filter((b) => b.bid_amount > 0 && b.client).forEach((b) => {
      clientsOf(b).forEach((n) => {
        const key = n.trim();
        if (key) volume[key] = (volume[key] || 0) + (b.bid_amount ?? 0);
      });
    });
    return new Set(Object.entries(volume).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k));
  }, [bids]);

  const oneWeekAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  }, []);

  // Everything except the status filter, so each status tab can show its own count.
  const scoped = useMemo(() => {
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
  }, [bids, search, typeFilter, yearFilter, oneWeekAgo]);

  const statusCounts = useMemo(() => {
    const counts = {};
    scoped.forEach((b) => { const s = b.effective_status || b.status; counts[s] = (counts[s] || 0) + 1; });
    return counts;
  }, [scoped]);

  const filtered = useMemo(() => {
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
  }, [scoped, statusFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const from = filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(page * PAGE_SIZE, filtered.length);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => d * -1);
    else { setSortKey(key); setSortDir(-1); }
    setPage(1);
  };

  const paginationItems = useMemo(() => {
    const items = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) items.push({ type: 'page', num: i });
      else if (Math.abs(i - page) === 2) items.push({ type: 'ellipsis', num: i });
    }
    return items.filter((it, idx) => !(it.type === 'ellipsis' && items[idx - 1]?.type === 'ellipsis'));
  }, [page, totalPages]);

  const clearFilters = () => { setSearch(''); setStatusFilter(''); setYearFilter(''); setTypeFilter('All'); setPage(1); };
  const filtersActive = !!(search || statusFilter || yearFilter || typeFilter !== 'All');
  const sub = 'text-[11px] text-[var(--text-subtle)]';

  return (
    <div className="page">
      {modalBid && <StatusModal bid={modalBid} onClose={() => setModalBid(null)} onSave={handleSave} />}

      <div className="table-controls">
        <input
          className="search-input" type="text" placeholder="Search project or client…" aria-label="Search project or client"
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select className="select-filter" aria-label="Filter by year" value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}>
          <option value="">All Years</option>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="select-filter" aria-label="Filter by type" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="All">All Types</option>
          <option value="Public">Public</option>
          <option value="Private">Private</option>
        </select>
        <span className="table-count">{filtered.length} Bids</span>
      </div>

      <div className="filter-bar" role="group" aria-label="Filter by status" style={{ marginBottom: 16 }}>
        {['', ...STATUS_TABS].map((v) => {
          const on = statusFilter === v;
          const n = v ? (statusCounts[v] || 0) : scoped.length;
          return (
            <button key={v || 'all'} type="button" aria-pressed={on} className={`year-btn ${on ? 'active' : ''}`}
              onClick={() => { setStatusFilter(v); setPage(1); }}>
              {v || 'All'} <span className="font-normal tabular-nums text-[var(--text-subtle)]">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="table-wrap">
        <table>
          <caption className="sr-only">Bid log: click a column heading to sort, click a row to update its status</caption>
          <thead>
            <tr>
              {COLS.map((col) => {
                const on = sortKey === col.key;
                const Icon = on ? (sortDir > 0 ? ArrowUp : ArrowDown) : ChevronsUpDown;
                return (
                  <th
                    key={col.key} scope="col"
                    aria-sort={on ? (sortDir > 0 ? 'ascending' : 'descending') : 'none'}
                    className={cn(on && 'sorted', col.right && 'text-right', col.small === false && 'max-md:hidden')}
                  >
                    <button type="button" className="th-btn" onClick={() => handleSort(col.key)}>
                      {col.label}
                      <Icon className={cn('size-3', !on && 'opacity-35')} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageData.map((b, i) => {
              const eff = b.effective_status || b.status;
              const isWon = eff === 'Won';
              const awardVal = b.award_amount ?? 0;
              const baseVal = awardVal > 0 ? awardVal : (b.bid_amount ?? 0);
              const profit = baseVal * (b.margin_pct ?? 0);
              const followUpDue = b.next_followup_date && new Date(b.next_followup_date) <= new Date();
              const urg = urgency(b);
              const names = clientsOf(b);

              return (
                <tr
                  key={b.id ?? i}
                  onClick={() => setModalBid(b)}
                  className="cursor-pointer"
                  style={isWon ? { background: 'color-mix(in srgb, var(--won) 6%, transparent)' } : undefined}
                >
                  <td className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {urg && <span className="size-1.5 shrink-0 rounded-full" style={{ background: urg.color }} title={urg.label} />}
                      <div>
                        <div className="text-[13px] font-medium tabular-nums">{fmtDate(b.bid_date)}</div>
                        {b.bid_time && <div className={sub}>{b.bid_time}</div>}
                      </div>
                    </div>
                  </td>

                  <td className="whitespace-nowrap max-md:hidden">
                    {b.pre_bid ? (
                      <div>
                        <div className="text-[13px] tabular-nums text-[var(--text-secondary)]">{fmtDate(b.pre_bid)}</div>
                        {b.pre_bid_time && <div className={sub}>{b.pre_bid_time}</div>}
                      </div>
                    ) : <span className="text-[var(--text-subtle)]">—</span>}
                  </td>

                  <td className="max-w-[280px]">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button" data-bid-name aria-haspopup="dialog" title={b.name}
                        onClick={(e) => { e.stopPropagation(); setModalBid(b); }}
                        className="min-w-0 appearance-none truncate border-0 bg-transparent p-0 text-left text-[13px] font-semibold text-[var(--text)] [font-family:inherit] outline-none cursor-pointer hover:text-[#c2540a] focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[#ea580c] dark:hover:text-[#fb923c]"
                      >
                        {b.name}
                      </button>
                      {b.high_priority && (
                        <span title="High priority" className="inline-flex shrink-0">
                          <Star className="size-3.5 fill-[#d99a06] text-[#d99a06]" strokeWidth={1.75} aria-hidden="true" />
                          <span className="sr-only">High priority</span>
                        </span>
                      )}
                      {b.user_notes && (
                        <span title={b.user_notes} className="inline-flex shrink-0 text-[var(--text-subtle)]">
                          <StickyNote className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                          <span className="sr-only">Has notes</span>
                        </span>
                      )}
                      {followUpDue && (
                        <span title={`Follow-up due: ${b.next_followup_date}`} className="inline-flex shrink-0 text-[#b45309] dark:text-[#fbbf24]">
                          <BellRing className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                          <span className="sr-only">Follow-up due</span>
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[var(--text-subtle)] md:hidden">{names.join(', ')}</div>
                  </td>

                  <td className="max-md:hidden">
                    <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 text-[13px] text-[var(--text-secondary)]">
                      {names.map((c, ci) => (
                        <span key={c} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          {topClientNames.has(c.trim()) && (
                            <span className="size-1.5 shrink-0 rounded-full bg-[var(--won)]" title="Top 10 client by bid volume" />
                          )}
                          {c}{ci < names.length - 1 && <span aria-hidden="true" className="text-[var(--text-subtle)]">,</span>}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="amount-cell tabular-nums">{b.bid_amount > 0 ? fmtFull$(b.bid_amount) : <span className="text-[var(--text-subtle)]">—</span>}</td>
                  <td className={cn('amount-cell tabular-nums max-md:hidden', awardVal > 0 ? greenText : 'text-[var(--text-subtle)]')}>
                    {awardVal > 0 ? fmtFull$(awardVal) : '—'}
                  </td>
                  <td className="amount-cell tabular-nums max-md:hidden">{b.margin_pct > 0 ? `${((b.margin_pct ?? 0) * 100).toFixed(1)}%` : <span className="text-[var(--text-subtle)]">—</span>}</td>
                  <td className={cn('amount-cell tabular-nums max-md:hidden', isWon ? cn('font-semibold', greenText) : 'text-[var(--text-secondary)]')}>
                    {b.margin_pct > 0 ? fmt$(profit) : '—'}
                  </td>

                  <td><span className={`status-pill ${eff === 'Upcoming' ? 'pill-upcoming' : classifyStatus(eff)}`}>{eff}</span></td>
                </tr>
              );
            })}
            {pageData.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="!py-14 text-center text-[13px] text-[var(--text-subtle)]">
                  No bids match these filters.
                  {filtersActive && (
                    <> <button type="button" onClick={clearFilters} className="appearance-none border-0 bg-transparent p-0 text-[13px] font-medium text-[#c2540a] [font-family:inherit] cursor-pointer hover:underline dark:text-[#fb923c]">Clear Filters</button></>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[var(--text-subtle)]">
          {filtered.length > 0 && <span>Showing {from}–{to} of {filtered.length}</span>}
          <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[var(--won)]" />Top 10 Client by Volume</span>
        </div>
        {totalPages > 1 && (
          <nav aria-label="Pagination" className="flex items-center gap-1">
            <button type="button" className="page-btn" aria-label="Previous page" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
            {paginationItems.map((item, i) =>
              item.type === 'ellipsis'
                ? <span key={`e${i}`} className="page-ellipsis">…</span>
                : <button key={item.num} type="button" className={`page-btn ${item.num === page ? 'active' : ''}`} aria-current={item.num === page ? 'page' : undefined} onClick={() => setPage(item.num)}>{item.num}</button>
            )}
            <button type="button" className="page-btn" aria-label="Next page" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
