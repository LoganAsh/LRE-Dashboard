import { useEffect, useMemo, useState } from 'react';
import { BellRing, ChevronRight, Search, SlidersHorizontal, Star, StickyNote, X } from 'lucide-react';
import { fmt$, classifyStatus, YEARS } from '../utils.js';
import { StatusModal } from '../StatusModal.jsx';
import { daysUntil } from '../dates.js';
import { urgencyOf } from '../dashboardHelpers.js';
import { scopeBids, countStatuses, filterAndSort, clientsOf } from '../bidLogLogic.js';
import Sheet from './Sheet.jsx';
import { DateBlock } from './ui.jsx';

const PAGE = 30;
const STATUS_ORDER = ['Upcoming', 'Pending', 'Won', 'Lost', 'No Bid', 'Client Not Awarded', 'Project Re-Bid'];
const SORTS = [['bid_date', 'Bid Date'], ['name', 'Project'], ['client', 'Client'], ['bid_amount', 'Bid Amount'], ['margin_pct', 'Margin']];
const DIR_TEXT = { bid_date: ['Newest First', 'Oldest First'], bid_amount: ['Highest First', 'Lowest First'], margin_pct: ['Highest First', 'Lowest First'], name: ['Z to A', 'A to Z'], client: ['Z to A', 'A to Z'] };

// The tint behind each date: the status color (or how urgent it is, for bids still to come)
const toneOf = (b) => {
  const eff = b.effective_status || b.status;
  if (eff === 'Won') return 'var(--won)';
  if (eff === 'Lost' || eff === 'Client Not Awarded') return 'var(--lost)';
  if (eff === 'Upcoming') return b.bid_date ? urgencyOf(daysUntil(b.bid_date)).color : 'var(--accent)';
  if (eff === 'Pending') return 'var(--accent)';
  if (eff === 'Project Re-Bid') return 'var(--info)';
  return 'var(--muted)';
};

export default function MBidLog({ bids: initialBids }) {
  const [bids, setBids] = useState(initialBids);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [sortKey, setSortKey] = useState('bid_date');
  const [sortDir, setSortDir] = useState(-1);
  const [shown, setShown] = useState(PAGE);
  const [modalBid, setModalBid] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => { setBids(initialBids); }, [initialBids]);
  useEffect(() => { setShown(PAGE); }, [search, statusFilter, yearFilter, typeFilter, sortKey, sortDir]);

  const oneWeekAgo = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; }, []);
  const scoped = useMemo(() => scopeBids(bids, { search, typeFilter, yearFilter, oneWeekAgo }), [bids, search, typeFilter, yearFilter, oneWeekAgo]);
  const counts = useMemo(() => countStatuses(scoped), [scoped]);
  const filtered = useMemo(() => filterAndSort(scoped, { statusFilter, sortKey, sortDir }), [scoped, statusFilter, sortKey, sortDir]);
  const chips = STATUS_ORDER.filter((s) => counts[s] > 0 || s === statusFilter);

  const activeCount = (yearFilter ? 1 : 0) + (typeFilter !== 'All' ? 1 : 0) + (sortKey !== 'bid_date' || sortDir !== -1 ? 1 : 0);
  const clearAll = () => { setYearFilter(''); setTypeFilter('All'); setSortKey('bid_date'); setSortDir(-1); setStatusFilter(''); setSearch(''); };
  const dirText = (DIR_TEXT[sortKey] || DIR_TEXT.bid_date);

  return (
    <>
      {modalBid && <StatusModal bid={modalBid} onClose={() => setModalBid(null)} onSave={(u) => setBids((prev) => prev.map((b) => (b.id === u.id ? u : b)))} />}

      <div className="m-sticky">
        <div className="m-toolbar">
          <label className="m-search">
            <Search aria-hidden="true" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search project or client" aria-label="Search project or client" enterKeyHint="search" />
            {search && <button type="button" className="m-search-clear" onClick={() => setSearch('')} aria-label="Clear search"><X size={16} /></button>}
          </label>
          <button type="button" className="m-hbtn" onClick={() => setFiltersOpen(true)} aria-label={`Filters and sort${activeCount ? `, ${activeCount} active` : ''}`} aria-haspopup="dialog" style={{ position: 'relative', width: 44, height: 44 }}>
            <SlidersHorizontal />
            {activeCount > 0 && <span className="m-badge" style={{ top: -5, left: 'auto', right: -5 }}>{activeCount}</span>}
          </button>
        </div>
        <div className="m-chips" role="tablist" aria-label="Status">
          <button type="button" role="tab" className="m-chip" aria-selected={!statusFilter} onClick={() => setStatusFilter('')}>All <small>{scoped.length}</small></button>
          {chips.map((s) => (
            <button key={s} type="button" role="tab" className="m-chip" aria-selected={statusFilter === s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}>{s} <small>{counts[s] || 0}</small></button>
          ))}
        </div>
      </div>

      <div className="m-card" style={{ marginTop: 4 }}>
        {filtered.length === 0 && (
          <div className="m-empty"><b>No Bids Found</b>Try a different search or clear the filters.<div style={{ marginTop: 14 }}><button type="button" className="m-btn" onClick={clearAll} style={{ width: 'auto', height: 42, margin: '0 auto' }}>Clear Filters</button></div></div>
        )}
        {filtered.slice(0, shown).map((b) => {
          const eff = b.effective_status || b.status;
          return (
            <button key={b.id} type="button" className="m-row" onClick={() => setModalBid(b)} aria-haspopup="dialog" aria-label={`${b.name}, ${eff}`}>
              <DateBlock iso={b.bid_date} tone={toneOf(b)} />
              <div className="m-row-main">
                <div className="m-row-title">{b.name}</div>
                <div className="m-row-sub">
                  <span className="t">{clientsOf(b).join(', ')}</span>
                  {b.high_priority && <Star size={13} fill="#d99a06" color="#d99a06" aria-label="High priority" />}
                  {b.user_notes && <StickyNote size={13} aria-label="Has notes" />}
                  {b.next_followup_date && <BellRing size={13} aria-label="Follow-up set" />}
                </div>
                <div className="m-row-meta">
                  <span className={`status-pill ${classifyStatus(eff)}`}>{eff}</span>
                  {b.bid_amount > 0 && <span>{fmt$(b.bid_amount)}</span>}
                  {b.bid_time && <span>{b.bid_time}</span>}
                </div>
              </div>
              <ChevronRight size={18} style={{ color: 'var(--muted)', opacity: 0.55, flex: 'none', marginRight: 6 }} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {filtered.length > 0 && (
        <div style={{ textAlign: 'center', padding: '16px 0 4px' }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 10 }}>Showing {Math.min(shown, filtered.length)} of {filtered.length}</div>
          {shown < filtered.length && <button type="button" className="m-btn" onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, filtered.length - shown)} More</button>}
        </div>
      )}

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters and Sort"
        footer={<><button type="button" className="m-btn" onClick={clearAll}>Clear All</button><button type="button" className="m-btn m-btn-primary" onClick={() => setFiltersOpen(false)}>Show {filtered.length} Bids</button></>}>
        <div className="m-group-label" style={{ marginTop: 4 }}>Year</div>
        <div className="m-chips" style={{ flexWrap: 'wrap', overflow: 'visible', margin: 0, padding: '0 0 6px' }}>
          {['', ...[...YEARS].reverse()].map((y) => <button key={y || 'all'} type="button" className="m-chip" aria-pressed={yearFilter === y} onClick={() => setYearFilter(y)}>{y || 'All Years'}</button>)}
        </div>
        <div className="m-group-label">Type</div>
        <div className="m-chips" style={{ flexWrap: 'wrap', overflow: 'visible', margin: 0, padding: '0 0 6px' }}>
          {['All', 'Public', 'Private'].map((t) => <button key={t} type="button" className="m-chip" aria-pressed={typeFilter === t} onClick={() => setTypeFilter(t)}>{t === 'All' ? 'All Types' : t}</button>)}
        </div>
        <div className="m-group-label">Sort By</div>
        <div className="m-chips" style={{ flexWrap: 'wrap', overflow: 'visible', margin: 0, padding: '0 0 6px' }}>
          {SORTS.map(([k, label]) => <button key={k} type="button" className="m-chip" aria-pressed={sortKey === k} onClick={() => { setSortKey(k); setSortDir(-1); }}>{label}</button>)}
        </div>
        <div className="m-chips" style={{ flexWrap: 'wrap', overflow: 'visible', margin: 0, padding: '0 0 6px' }}>
          <button type="button" className="m-chip" aria-pressed={sortDir === -1} onClick={() => setSortDir(-1)}>{dirText[0]}</button>
          <button type="button" className="m-chip" aria-pressed={sortDir === 1} onClick={() => setSortDir(1)}>{dirText[1]}</button>
        </div>
      </Sheet>
    </>
  );
}
