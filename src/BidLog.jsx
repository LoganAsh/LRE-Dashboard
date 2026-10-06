import { useState, useMemo, useCallback, useEffect } from 'react';
import { supabase } from './supabase.js';
import { fmtFull$, fmt$, classifyStatus, YEARS, filterByType, isPublicBid } from './utils.js';
import { parseClients, useTopClients } from './hooks.js';
import { StatusModal } from './StatusModal.jsx';

export { StatusModal };

const PAGE_SIZE = 25;

const COLS = [
  { key: 'bid_date',         label: 'Bid Date',    right: false },
  { key: 'bid_time',         label: 'Bid Time',    right: false },
  { key: 'pre_bid',          label: 'Pre-Bid',     right: false },
  { key: 'pre_bid_time',     label: 'Pre-Bid Time',right: false },
  { key: 'name',             label: 'Project',     right: false },
  { key: 'client',           label: 'Client',      right: false },
  { key: 'bid_amount',       label: 'Bid Amount',  right: true  },
  { key: 'award_amount',     label: 'Award',       right: true  },
  { key: 'margin_pct',       label: 'Margin %',    right: true  },
  { key: 'projected_profit', label: 'Profit + OH', right: true  },
  { key: 'effective_status', label: 'Status',      right: false },
];

// Date color logic for upcoming/no-bid rows
function getDateColor(bid) {
  if (bid.bid_amount > 0) return 'var(--muted)';
  if (!bid.bid_date) return 'var(--muted)';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bidDate = new Date(bid.bid_date + 'T00:00:00');
  const diffDays = Math.ceil((bidDate - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0)  return '#e85c50';  // past — red
  if (diffDays <= 3) return '#f97316';  // within 3 days — orange
  if (diffDays <= 7) return '#e8c547';  // within 7 days — yellow
  return '#4ade80';                      // more than 7 days — green
}

// ── Status Modal ──────────────────────────────────────────────────────────────
// ── Main BidLog ───────────────────────────────────────────────────────────────
export default function BidLog({ bids: initialBids }) {
  const [bids, setBids]                 = useState(initialBids);
  const [typeFilter, setTypeFilter]     = useState('All');
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [yearFilter, setYearFilter]     = useState('');
  const [sortKey, setSortKey]           = useState('bid_date');
  const [sortDir, setSortDir]           = useState(-1);
  const [page, setPage]                 = useState(1);
  const [modalBid, setModalBid]         = useState(null);

  useMemo(() => setBids(initialBids), [initialBids]);

  const handleSave = useCallback((updated) => {
    setBids(prev => prev.map(b => b.id === updated.id ? updated : b));
  }, []);

  // Build top-client set for green pill highlighting
  const topClientNames = useMemo(() => {
    const top = useTopClients ? [] : [];
    const map = {};
    bids.filter(b => b.bid_amount > 0 && b.client).forEach(b => {
      const names = (b.clients && b.clients.length > 0) ? b.clients : parseClients(b.client || '');
      names.forEach(n => {
        const key = n.trim();
        if (!key) return;
        if (!map[key]) map[key] = 0;
        map[key] += b.bid_amount ?? 0;
      });
    });
    return new Set(
      Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k)
    );
  }, [bids]);

  const oneWeekAgo = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return bids
      .filter(b => {
        const effStatus = b.effective_status || b.status;
        if (b.bid_amount > 0) return true;
        if (effStatus === 'Upcoming' && b.bid_date && b.bid_date >= oneWeekAgo) return true;
        return false;
      })
      .filter(b => !q || b.name?.toLowerCase().includes(q) || b.client?.toLowerCase().includes(q))
      .filter(b => !statusFilter || (b.effective_status || b.status) === statusFilter)
      .filter(b => { if (typeFilter === 'All') return true; const pub = isPublicBid(b); return typeFilter === 'Public' ? pub : !pub; })
      .filter(b => !yearFilter || b.year === yearFilter)
      .sort((a, b) => {
        let av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
        if (typeof av === 'string') return sortDir * av.localeCompare(bv);
        return sortDir * (av - bv);
      });
  }, [bids, search, statusFilter, yearFilter, typeFilter, sortKey, sortDir, oneWeekAgo]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d * -1);
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

  return (
    <div className="page">
      {modalBid && <StatusModal bid={modalBid} onClose={() => setModalBid(null)} onSave={handleSave} />}
      <div className="table-controls">
        <input className="search-input" type="text" placeholder="Search project or client…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select className="select-filter" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="Won">Won</option>
          <option value="Lost">Lost</option>
          <option value="Pending">Pending</option>
          <option value="Upcoming">Upcoming</option>
          <option value="No Bid">No Bid</option>
          <option value="Client Not Awarded">Client Not Awarded</option>
          <option value="Project Re-Bid">Project Re-Bid</option>
        </select>
        <select className="select-filter" value={yearFilter} onChange={e => { setYearFilter(e.target.value); setPage(1); }}>
          <option value="">All Years</option>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="select-filter" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="All">All Types</option>
          <option value="Public">Public</option>
          <option value="Private">Private</option>
        </select>
        <span className="table-count">{filtered.length} Bids</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {COLS.map(col => (
                <th key={col.key} className={sortKey === col.key ? 'sorted' : ''} style={col.right ? { textAlign: 'right' } : {}} onClick={() => handleSort(col.key)}>
                  {col.label} <span style={{ opacity: sortKey === col.key ? 1 : 0.3 }}>{sortKey === col.key ? (sortDir > 0 ? '↑' : '↓') : '↕'}</span>
                </th>
              ))}
              <th style={{ width: 90, textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((b, i) => {
              const effStatus  = b.effective_status || b.status;
              const isWon      = effStatus === 'Won';
              const isUpcoming = effStatus === 'Upcoming';
              const awardVal   = b.award_amount ?? 0;
              const baseVal    = awardVal > 0 ? awardVal : (b.bid_amount ?? 0);
              const profit     = baseVal * (b.margin_pct ?? 0);
              const overdue    = b.next_followup_date && new Date(b.next_followup_date) <= new Date();
              const dateColor  = getDateColor(b);
              const rowBg      = isWon ? 'rgba(46,189,126,0.07)' : overdue ? 'rgba(232,197,71,0.04)' : 'transparent';
              const clientNames = (b.clients && b.clients.length > 0) ? b.clients : parseClients(b.client || '');

              return (
                <tr key={b.id ?? i} style={{ background: rowBg }}>
                  {/* Bid Date */}
                  <td style={{ color: dateColor, whiteSpace: 'nowrap', fontSize: 12, fontWeight: dateColor !== 'var(--muted)' ? 500 : 400 }}>
                    {b.bid_date ?? '—'}{overdue && <span title={`Follow-up due: ${b.next_followup_date}`} style={{ marginLeft: 5, color: '#e8c547', fontSize: 9 }}>●</span>}
                  </td>
                  {/* Bid Time */}
                  <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap', fontSize: 11 }}>{b.bid_time || '—'}</td>
                  {/* Pre-Bid */}
                  <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap', fontSize: 11 }}>{b.pre_bid || '—'}</td>
                  {/* Pre-Bid Time */}
                  <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap', fontSize: 11 }}>{b.pre_bid_time || '—'}</td>
                  {/* Project */}
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.name}>
                    {b.name}{b.user_notes && <span title={b.user_notes} style={{ marginLeft: 5, color: 'var(--accent)', fontSize: 10 }}>✎</span>}
                  </td>
                  {/* Client tags */}
                  <td style={{ fontSize: 12 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {clientNames.map(c => {
                        const isTop = topClientNames.has(c.trim());
                        return (
                          <span key={c} style={{
                            display: 'inline-block', padding: '1px 6px',
                            background: isTop ? 'rgba(46,189,126,0.15)' : 'var(--surface2)',
                            border: `1px solid ${isTop ? 'rgba(46,189,126,0.4)' : 'var(--border)'}`,
                            borderRadius: 3, color: isTop ? 'var(--won)' : 'var(--muted)',
                            fontSize: 10, whiteSpace: 'nowrap',
                          }}>{c}</span>
                        );
                      })}
                    </div>
                  </td>
                  {/* Bid Amount */}
                  <td className="amount-cell" style={{ fontSize: 12 }}>{b.bid_amount > 0 ? fmtFull$(b.bid_amount) : '—'}</td>
                  {/* Award */}
                  <td className="amount-cell" style={{ fontSize: 12, color: awardVal > 0 ? 'var(--won)' : 'var(--muted)' }}>{awardVal > 0 ? fmtFull$(awardVal) : '—'}</td>
                  {/* Margin % */}
                  <td className="amount-cell" style={{ fontSize: 12 }}>{b.margin_pct > 0 ? `${((b.margin_pct ?? 0) * 100).toFixed(1)}%` : '—'}</td>
                  {/* Profit + OH */}
                  <td className="amount-cell" style={{ fontSize: 12, fontWeight: isWon ? 600 : 400, color: isWon ? 'var(--won)' : 'var(--muted)' }}>
                    {b.margin_pct > 0 ? fmt$(profit) : '—'}
                  </td>
                  {/* Status */}
                  <td><span className={`status-pill ${isUpcoming ? 'pill-upcoming' : classifyStatus(effStatus)}`}>{effStatus}</span></td>
                  {/* Action */}
                  <td style={{ textAlign: 'center' }}>
                    <button onClick={() => setModalBid(b)}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      style={{ padding: '4px 10px', fontSize: 11, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'border-color 0.15s' }}>Status ↗</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="pagination">
          {page > 1 && <button className="page-btn" onClick={() => setPage(p => p - 1)}>‹</button>}
          {paginationItems.map((item, i) =>
            item.type === 'ellipsis' ? <span key={i} className="page-ellipsis">…</span>
            : <button key={item.num} className={`page-btn ${item.num === page ? 'active' : ''}`} onClick={() => setPage(item.num)}>{item.num}</button>
          )}
          {page < totalPages && <button className="page-btn" onClick={() => setPage(p => p + 1)}>›</button>}
        </div>
      )}
    </div>
  );
}
