import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Search, X } from 'lucide-react';
import { fmt$ } from '../utils.js';
import { fmtDate } from '../dates.js';
import { buildClientRows, sortClientRows, clientKey } from '../clientStats.js';
import { useClientLogos } from '../clientLogos.js';
import ClientLogo from '../ClientLogo.jsx';
import ClientDetail from '../ClientDetail.jsx';

const SORTS = [['volume', 'Total Volume'], ['awarded', 'Awarded'], ['count', 'Bid Count'], ['winrate', 'Win Rate'], ['recent', 'Most Recent']];

export default function MClients({ bids: initialBids }) {
  const [bids, setBids] = useState(initialBids);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('volume');
  const [selected, setSelected] = useState(null);
  const { logos, busyKey, error, clearError, upload } = useClientLogos();
  useEffect(() => { setBids(initialBids); }, [initialBids]);

  const rows = useMemo(() => buildClientRows(bids), [bids]);
  const top = useMemo(() => new Set([...rows].sort((a, b) => b.totalVolume - a.totalVolume).slice(0, 10).map((r) => r.name)), [rows]);
  const withLogos = useMemo(() => rows.filter((r) => logos[clientKey(r.name)]?.url).sort((a, b) => b.totalVolume - a.totalVolume), [rows, logos]);
  const list = useMemo(() => { const q = search.toLowerCase(); return sortClientRows(rows.filter((c) => !q || c.name.toLowerCase().includes(q)), sortKey); }, [rows, search, sortKey]);

  return (
    <>
      {selected && (
        <ClientDetail clientName={selected} bids={bids} onBidSave={(u) => setBids((prev) => prev.map((b) => (b.id === u.id ? u : b)))}
          logo={logos[clientKey(selected)]?.url} busy={busyKey === clientKey(selected)} onUpload={(file) => upload(selected, file)}
          logoError={error} onClearLogoError={clearError} onClose={() => { clearError(); setSelected(null); }} />
      )}

      {withLogos.length > 0 && (
        <div className="m-chips" style={{ paddingBottom: 14, gap: 12 }} aria-label="Clients with logos">
          {withLogos.map((r) => (
            <button key={r.name} type="button" onClick={() => setSelected(r.name)} aria-label={r.name} style={{ flex: 'none', width: 64, height: 64, padding: 0, border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', overflow: 'hidden', position: 'relative' }}>
              <ClientLogo name={r.name} logo={logos[clientKey(r.name)].url} size={64} />
            </button>
          ))}
        </div>
      )}

      <div className="m-sticky" style={withLogos.length ? { marginTop: 0 } : undefined}>
        <div className="m-toolbar">
          <label className="m-search">
            <Search aria-hidden="true" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients" aria-label="Search clients" enterKeyHint="search" />
            {search && <button type="button" className="m-search-clear" onClick={() => setSearch('')} aria-label="Clear search"><X size={16} /></button>}
          </label>
        </div>
        <div className="m-chips" role="tablist" aria-label="Sort clients" style={{ paddingBottom: 10 }}>
          {SORTS.map(([k, label]) => <button key={k} type="button" role="tab" className="m-chip" aria-selected={sortKey === k} onClick={() => setSortKey(k)}>{label}</button>)}
        </div>
      </div>

      <div className="m-section" style={{ marginTop: 6 }}>
        <div className="m-section-head"><h2>{list.length} Clients</h2></div>
        <div className="m-card">
          {list.length === 0 && <div className="m-empty"><b>No Clients Found</b>Try a different search.</div>}
          {list.map((r) => (
            <button key={r.name} type="button" className="m-row" onClick={() => setSelected(r.name)} aria-haspopup="dialog" aria-label={r.name} style={{ minHeight: 76 }}>
              <div style={{ flex: 'none', width: 52, height: 52, border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)' }}>
                <ClientLogo name={r.name} logo={logos[clientKey(r.name)]?.url} size={52} />
              </div>
              <div className="m-row-main">
                <div className="m-row-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                  {top.has(r.name) && <span className="m-dot" style={{ '--tone': 'var(--won)', width: 7, height: 7 }} role="img" aria-label="Top 10 client by bid volume" />}
                </div>
                <div className="m-row-sub"><span className="t">{r.bidCount} {r.bidCount === 1 ? 'Bid' : 'Bids'} · {r.wonCount} Won · {r.winRate.toFixed(0)}%</span></div>
                <div className="m-row-meta">{r.lastBidDate ? `Last Bid ${fmtDate(r.lastBidDate)}` : 'No Bids Yet'}</div>
              </div>
              <div style={{ flex: 'none', textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt$(r.totalVolume)}</div>
                <div style={{ fontSize: 11.5, color: r.awardedVolume > 0 ? 'var(--won)' : 'var(--muted)', marginTop: 2, fontWeight: 600 }}>{r.awardedVolume > 0 ? `${fmt$(r.awardedVolume)} Won` : 'None Won'}</div>
              </div>
              <ChevronRight size={18} style={{ color: 'var(--muted)', opacity: 0.55, flex: 'none', marginRight: 4 }} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
