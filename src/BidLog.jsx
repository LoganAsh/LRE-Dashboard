import { useState, useMemo, useCallback } from 'react';
import { supabase } from './supabase.js';
import { fmtFull$, fmt$, classifyStatus, YEARS, filterByType, isPublicBid } from './utils.js';
import { parseClients, useTopClients } from './hooks.js';

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
export function StatusModal({ bid, onClose, onSave }) {
  const [status, setStatus]             = useState(bid.status_override || bid.status || 'Pending');
  const [notes, setNotes]               = useState(bid.user_notes || '');
  const [awardAmt, setAwardAmt]         = useState(bid.award_amount ?? '');
  const clientNames = (bid.clients && bid.clients.length > 0) ? bid.clients : parseClients(bid.client || '');
  const [awardedBy, setAwardedBy]       = useState(bid.awarded_by || (clientNames.length === 1 ? clientNames[0] : ''));
  const [lastFollowup, setLastFollowup] = useState(bid.last_followup_date || '');
  const [nextFollowup, setNextFollowup] = useState(bid.next_followup_date || '');
  const [highPriority, setHighPriority] = useState(bid.high_priority || false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');

  const today = new Date().toISOString().split('T')[0];
  const setNextPreset = (days) => {
    const d = new Date(); d.setDate(d.getDate() + days);
    setNextFollowup(d.toISOString().split('T')[0]);
  };

  const awardNum = awardAmt !== '' ? parseFloat(awardAmt) : null;
  const baseVal  = (awardNum && awardNum > 0) ? awardNum : (bid.bid_amount ?? 0);
  const profit   = baseVal * (bid.margin_pct ?? 0);

  const handleSave = async () => {
    setSaving(true); setError('');
    const { error: err } = await supabase.from('lre_bids').update({
      status_override: status, user_notes: notes || null,
      award_amount: awardNum, last_followup_date: lastFollowup || null,
      next_followup_date: nextFollowup || null,
      awarded_by: status === 'Won' ? (awardedBy || null) : null,
      high_priority: highPriority,
    }).eq('id', bid.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSave({ ...bid, status_override: status, effective_status: status, user_notes: notes,
      award_amount: awardNum, last_followup_date: lastFollowup || null,
      next_followup_date: nextFollowup || null, projected_profit: profit,
      awarded_by: status === 'Won' ? (awardedBy || null) : null,
      high_priority: highPriority });
    onClose();
  };

  const field = {
    width: '100%', padding: '7px 10px', background: 'var(--surface)',
    border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)',
    fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div className="modal-inner" style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
        width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{bid.name}</div>
            <div style={{ color: 'var(--muted)', fontSize: 11 }}>{bid.client} · {bid.bid_date}{bid.bid_time ? ' ' + bid.bid_time : ''} · {bid.year}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer', padding: 4 }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[['Bid Amount', fmtFull$(bid.bid_amount ?? 0)], ['Margin %', `${((bid.margin_pct ?? 0) * 100).toFixed(1)}%`], ['Cost', fmtFull$(bid.cost ?? 0)]].map(([l, v]) => (
              <div key={l} style={{ background: 'var(--surface2)', borderRadius: 6, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{l}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ background: (awardNum && awardNum > 0) ? 'rgba(46,189,126,0.1)' : 'var(--surface2)', border: `1px solid ${(awardNum && awardNum > 0) ? 'rgba(46,189,126,0.2)' : 'var(--border)'}`, borderRadius: 6, padding: '10px 12px', marginBottom: 16 }}>
            <div style={{ fontSize: 9, color: (awardNum && awardNum > 0) ? 'var(--won)' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Profit + OH {(awardNum && awardNum > 0) ? '(on award)' : '(on bid)'}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: (awardNum && awardNum > 0) ? 'var(--won)' : 'var(--text)' }}>{fmt$(profit)}</div>
          </div>
          {bid.pre_bid && (
            <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: '10px 12px', marginBottom: 14, fontSize: 12 }}>
              <span style={{ color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pre-Bid: </span>
              <span style={{ color: 'var(--text)' }}>{bid.pre_bid}{bid.pre_bid_time ? ' · ' + bid.pre_bid_time : ''}</span>
            </div>
          )}
          {bid.notes && (
            <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
              <span style={{ color: 'var(--text)', fontWeight: 500 }}>Bid Notes: </span>{bid.notes}
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Award Amount <span style={{ color: 'var(--muted)', fontWeight: 400, textTransform: 'none' }}>(updates profit calculation)</span></label>
            <input type="number" placeholder="Enter award amount if won…" value={awardAmt} onChange={e => setAwardAmt(e.target.value)} style={field} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Status</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {[
                ['Won',                'var(--won)',   'rgba(46,189,126,0.15)'],
                ['Pending',            'var(--accent)','var(--accent-light)'],
                ['Lost',               'var(--lost)',  'rgba(232,92,80,0.15)'],
                ['Upcoming',           '#a78bfa',      'rgba(167,139,250,0.15)'],
                ['Client Not Awarded', '#f97316',      'rgba(249,115,22,0.15)'],
                ['Project Re-Bid',     '#e8c547',      'rgba(232,197,71,0.15)'],
              ].map(([s, col, bg]) => {
                const active = status === s;
                return <button key={s} onClick={() => setStatus(s)} style={{ padding: '9px 4px', border: `1px solid ${active ? col : 'var(--border)'}`, borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, background: active ? bg : 'var(--surface)', color: active ? col : 'var(--muted)', transition: 'all 0.15s', textAlign: 'center', lineHeight: 1.3 }}>{s}</button>;
              })}
            </div>
          </div>
          {status === 'Won' && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Awarded By {clientNames.length > 1 && <span style={{ color: 'var(--lost)' }}>*required</span>}
              </label>
              {clientNames.length === 1 ? (
                <div style={{ padding: '7px 10px', background: 'rgba(46,189,126,0.1)', border: '1px solid rgba(46,189,126,0.3)', borderRadius: 4, color: 'var(--won)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {clientNames[0]}
                </div>
              ) : (
                <select value={awardedBy} onChange={e => setAwardedBy(e.target.value)} style={{ ...field, color: awardedBy ? 'var(--text)' : 'var(--muted)', borderColor: !awardedBy ? 'var(--lost)' : 'var(--border)' }}>
                  <option value="">— Select awarding client —</option>
                  {clientNames.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <button onClick={() => setHighPriority(p => !p)} style={{
              width: '100%', padding: '8px 0', cursor: 'pointer',
              background: highPriority ? 'rgba(250,204,21,0.12)' : 'var(--surface)',
              border: `1px solid ${highPriority ? 'rgba(250,204,21,0.5)' : 'var(--border)'}`,
              borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 12,
              color: highPriority ? '#facc15' : 'var(--muted)', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 14 }}>★</span>
              {highPriority ? 'High Priority — click to remove' : 'Mark as High Priority'}
            </button>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Notes</label>
            <textarea placeholder="Add notes…" value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...field, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: 14, marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 12 }}>Follow-Up</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>Last Follow-Up</label>
                <input type="date" value={lastFollowup} onChange={e => setLastFollowup(e.target.value)} style={{ ...field, colorScheme: 'dark' }} />
                <button onClick={() => setLastFollowup(today)} style={{ marginTop: 5, fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-mono)' }}>Set to today</button>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>Next Follow-Up</label>
                <input type="date" value={nextFollowup} onChange={e => setNextFollowup(e.target.value)} style={{ ...field, colorScheme: 'dark' }} />
                <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
                  {[['1 Wk', 7], ['2 Wks', 14], ['1 Mo', 30]].map(([label, days]) => (
                    <button key={label} onClick={() => setNextPreset(days)} style={{ fontSize: 10, padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 3, background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>{label}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {error && <div style={{ color: 'var(--lost)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '9px 0', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving || (status === 'Won' && clientNames.length > 1 && !awardedBy)} style={{ flex: 2, padding: '9px 0', background: 'var(--accent)', border: 'none', borderRadius: 4, color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, cursor: (saving || (status === 'Won' && clientNames.length > 1 && !awardedBy)) ? 'not-allowed' : 'pointer', opacity: (saving || (status === 'Won' && clientNames.length > 1 && !awardedBy)) ? 0.5 : 1 }}>{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
        <span className="table-count">{filtered.length} bids</span>
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
