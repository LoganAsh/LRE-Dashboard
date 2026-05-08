import { useState, useMemo } from 'react';
import { fmtFull$, classifyStatus, YEARS } from './utils.js';

const PAGE_SIZE = 25;
const COLS = [
  { key: 'bid_date', label: 'Date' },
  { key: 'name', label: 'Project' },
  { key: 'client', label: 'Client' },
  { key: 'bid_amount', label: 'Bid Amount', right: true },
  { key: 'margin_pct', label: 'Margin %', right: true },
  { key: 'status', label: 'Status' },
  { key: 'notes', label: 'Notes' },
];

export default function BidLog({ bids }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [sortKey, setSortKey] = useState('bid_date');
  const [sortDir, setSortDir] = useState(-1);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return bids
      .filter(b => b.bid_amount > 0)
      .filter(b => !q || b.name?.toLowerCase().includes(q) || b.client?.toLowerCase().includes(q))
      .filter(b => !statusFilter || b.status === statusFilter)
      .filter(b => !yearFilter || b.year === yearFilter)
      .sort((a, b) => {
        let av = a[sortKey], bv = b[sortKey];
        if (typeof av === 'string') return sortDir * (av ?? '').localeCompare(bv ?? '');
        return sortDir * ((av ?? 0) - (bv ?? 0));
      });
  }, [bids, search, statusFilter, yearFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d * -1);
    else { setSortKey(key); setSortDir(-1); }
    setPage(1);
  };

  const handleFilter = (setter) => (e) => { setter(e.target.value); setPage(1); };

  const paginationItems = useMemo(() => {
    const items = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
        items.push({ type: 'page', num: i });
      } else if (Math.abs(i - page) === 2) {
        items.push({ type: 'ellipsis', num: i });
      }
    }
    // Dedupe ellipses
    return items.filter((item, idx) => !(item.type === 'ellipsis' && items[idx - 1]?.type === 'ellipsis'));
  }, [page, totalPages]);

  return (
    <div className="page">
      <div className="table-controls">
        <input
          className="search-input"
          type="text"
          placeholder="Search project or client…"
          value={search}
          onChange={handleFilter(setSearch)}
        />
        <select className="select-filter" value={statusFilter} onChange={handleFilter(setStatusFilter)}>
          <option value="">All Statuses</option>
          <option value="Won">Won</option>
          <option value="Lost">Lost</option>
          <option value="Pending">Pending</option>
          <option value="No Bid">No Bid</option>
        </select>
        <select className="select-filter" value={yearFilter} onChange={handleFilter(setYearFilter)}>
          <option value="">All Years</option>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="table-count">{filtered.length} bids</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {COLS.map(col => (
                <th
                  key={col.key}
                  className={sortKey === col.key ? 'sorted' : ''}
                  style={col.right ? { textAlign: 'right' } : {}}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label} <span style={{ opacity: sortKey === col.key ? 1 : 0.3 }}>{sortKey === col.key ? (sortDir > 0 ? '↑' : '↓') : '↕'}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((b, i) => (
              <tr key={b.id ?? i}>
                <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{b.bid_date ?? '—'}</td>
                <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.name}>{b.name}</td>
                <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{b.client}</td>
                <td className="amount-cell">{fmtFull$(b.bid_amount)}</td>
                <td>
                  <div className="margin-bar">
                    <div className="margin-mini">
                      <div className="margin-fill" style={{ width: `${Math.min((b.margin_pct ?? 0) * 100 / 0.30, 100)}%` }} />
                    </div>
                    <span style={{ color: 'var(--muted)' }}>{((b.margin_pct ?? 0) * 100).toFixed(1)}%</span>
                  </div>
                </td>
                <td><span className={`status-pill ${classifyStatus(b.status)}`}>{b.status}</span></td>
                <td style={{ color: 'var(--muted)', fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.notes}>{b.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          {page > 1 && <button className="page-btn" onClick={() => setPage(p => p - 1)}>‹</button>}
          {paginationItems.map((item, i) =>
            item.type === 'ellipsis'
              ? <span key={i} className="page-ellipsis">…</span>
              : <button key={item.num} className={`page-btn ${item.num === page ? 'active' : ''}`} onClick={() => setPage(item.num)}>{item.num}</button>
          )}
          {page < totalPages && <button className="page-btn" onClick={() => setPage(p => p + 1)}>›</button>}
        </div>
      )}
    </div>
  );
}
