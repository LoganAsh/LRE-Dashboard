import { useState, useMemo, useEffect } from 'react';
import { supabase } from './supabase.js';
import { parseClients } from './hooks.js';
import { fmt$, fmtFull$ } from './utils.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getAllClientNames(bids) {
  const set = new Set();
  bids.forEach(b => {
    const names = (b.clients && b.clients.length > 0) ? b.clients : parseClients(b.client || '');
    names.forEach(n => { if (n.trim()) set.add(n.trim()); });
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function bidsForClient(bids, clientName) {
  return bids.filter(b => {
    const names = (b.clients && b.clients.length > 0) ? b.clients : parseClients(b.client || '');
    return names.some(n => n.trim().toLowerCase() === clientName.toLowerCase());
  });
}

// ── Client Detail Panel ───────────────────────────────────────────────────────
function ClientDetail({ clientName, bids, onClose }) {
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    setLoadingProjects(true);
    supabase.from('lre_projects').select('*').then(({ data }) => {
      const matched = (data || []).filter(p => {
        const clientMatch = (p.client || '').toLowerCase().includes(clientName.toLowerCase());
        const awardedMatch = (p.awarded_by || '').toLowerCase() === clientName.toLowerCase();
        return clientMatch || awardedMatch;
      });
      setProjects(matched);
      setLoadingProjects(false);
    });
  }, [clientName]);

  const clientBids = useMemo(() => bidsForClient(bids, clientName).filter(b => b.bid_amount > 0), [bids, clientName]);

  const stats = useMemo(() => {
    const won = clientBids.filter(b => (b.effective_status || b.status) === 'Won');
    const lost = clientBids.filter(b => (b.effective_status || b.status) === 'Lost');
    const pending = clientBids.filter(b => ['Pending', 'Upcoming'].includes(b.effective_status || b.status));
    const totalVolume = clientBids.reduce((s, b) => s + (b.bid_amount || 0), 0);
    // Only credit awarded volume to THIS client if awarded_by matches (or is unset and this is the only bidder)
    const awardedVolume = won.reduce((s, b) => {
      if (b.awarded_by) {
        return b.awarded_by.trim().toLowerCase() === clientName.toLowerCase() ? s + (b.award_amount || b.bid_amount || 0) : s;
      }
      const names = (b.clients && b.clients.length > 0) ? b.clients : parseClients(b.client || '');
      return names.length === 1 ? s + (b.award_amount || b.bid_amount || 0) : s;
    }, 0);
    const winRate = clientBids.length ? (won.length / clientBids.length * 100) : 0;
    const margins = clientBids.filter(b => b.margin_pct > 0).map(b => b.margin_pct * 100);
    const avgMargin = margins.length ? margins.reduce((a, v) => a + v, 0) / margins.length : 0;
    return { won, lost, pending, totalVolume, awardedVolume, winRate, avgMargin };
  }, [clientBids, clientName]);

  const projectStats = useMemo(() => {
    const totalContract = projects.reduce((s, p) => s + (p.original_contract || 0) + (p.approved_cos || 0), 0);
    const totalActual = projects.reduce((s, p) => s + (p.actual_cost || 0), 0);
    const active = projects.filter(p => ['Mobilizing', 'Active', 'Punch List'].includes(p.status));
    const complete = projects.filter(p => p.status === 'Complete');
    return { totalContract, totalActual, active, complete };
  }, [projects]);

  const sortedBids = useMemo(() => [...clientBids].sort((a, b) => (b.bid_date || '').localeCompare(a.bid_date || '')), [clientBids]);

  const STATUS_PILL = {
    'Won': { bg: 'rgba(46,189,126,0.15)', color: 'var(--won)' },
    'Lost': { bg: 'rgba(232,92,80,0.15)', color: 'var(--lost)' },
    'Pending': { bg: 'var(--accent-light)', color: 'var(--accent)' },
    'Upcoming': { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
    'No Bid': { bg: 'rgba(58,63,82,0.3)', color: 'var(--muted)' },
    'Client Not Awarded': { bg: 'rgba(249,115,22,0.15)', color: '#f97316' },
    'Project Re-Bid': { bg: 'rgba(232,197,71,0.15)', color: '#e8c547' },
  };

  const PROJECT_STATUS_COLORS = {
    'Not Started': '#7a8298', 'Mobilizing': '#e8c547', 'Active': '#3B6FE8',
    'Punch List': '#f97316', 'Complete': '#2ebd7e',
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div className="modal-inner" style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
        width: '100%', maxWidth: 760, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>{clientName}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 20 }}>
            {[
              ['Total Bids', clientBids.length, 'var(--text)'],
              ['Win Rate', `${stats.winRate.toFixed(0)}%`, 'var(--accent)'],
              ['Won', stats.won.length, 'var(--won)'],
              ['Lost', stats.lost.length, 'var(--lost)'],
              ['Pending', stats.pending.length, '#a78bfa'],
              ['Avg Margin', `${stats.avgMargin.toFixed(1)}%`, 'var(--text)'],
            ].map(([label, val, color]) => (
              <div key={label} style={{ background: 'var(--surface2)', borderRadius: 6, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
            <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: '12px 14px' }}>
              <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Total Bid Volume</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>{fmt$(stats.totalVolume)}</div>
            </div>
            <div style={{ background: 'rgba(46,189,126,0.08)', border: '1px solid rgba(46,189,126,0.2)', borderRadius: 6, padding: '12px 14px' }}>
              <div style={{ fontSize: 9, color: 'var(--won)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Awarded Volume</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--won)' }}>{fmt$(stats.awardedVolume)}</div>
            </div>
          </div>

          {/* Projects section */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
              Projects {projects.length > 0 && `(${projects.length})`}
            </div>
            {loadingProjects ? (
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>Loading…</div>
            ) : projects.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>No projects tracked for this client yet.</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Active Projects</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--accent)' }}>{projectStats.active.length}</div>
                  </div>
                  <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Total Contract</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>{fmt$(projectStats.totalContract)}</div>
                  </div>
                  <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Total Actual Cost</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>{fmt$(projectStats.totalActual)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {projects.map(p => (
                    <div key={p.id} style={{ background: 'var(--surface2)', borderRadius: 6, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtFull$((p.original_contract || 0) + (p.approved_cos || 0))} revised contract</div>
                      </div>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: (PROJECT_STATUS_COLORS[p.status] || '#7a8298') + '22', color: PROJECT_STATUS_COLORS[p.status] || '#7a8298', whiteSpace: 'nowrap' }}>{p.status}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Bid history */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
              Bid History ({sortedBids.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
              {sortedBids.map((b, i) => {
                const eff = b.effective_status || b.status;
                // If bid was Won but awarded to a *different* client than this one, show "Not Awarded" for this client's context
                const namesOnBid = (b.clients && b.clients.length > 0) ? b.clients : parseClients(b.client || '');
                const wonByOther = eff === 'Won' && b.awarded_by && b.awarded_by.trim().toLowerCase() !== clientName.toLowerCase() && namesOnBid.length > 1;
                const displayStatus = wonByOther ? 'Not Awarded' : eff;
                const pill = wonByOther ? { bg: 'rgba(58,63,82,0.3)', color: 'var(--muted)' } : (STATUS_PILL[eff] || STATUS_PILL['Pending']);
                return (
                  <div key={b.id ?? i} style={{ background: 'var(--surface2)', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{b.bid_date}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtFull$(b.bid_amount)}</span>
                    <span style={{ padding: '2px 7px', borderRadius: 3, fontSize: 10, fontWeight: 600, background: pill.bg, color: pill.color, whiteSpace: 'nowrap', flexShrink: 0 }}>{displayStatus}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Client Directory ─────────────────────────────────────────────────────
export default function ClientDirectory({ bids }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('volume');
  const [selectedClient, setSelectedClient] = useState(null);

  const clientNames = useMemo(() => getAllClientNames(bids), [bids]);

  const clientRows = useMemo(() => {
    return clientNames.map(name => {
      const clientBids = bidsForClient(bids, name).filter(b => b.bid_amount > 0);
      const won = clientBids.filter(b => (b.effective_status || b.status) === 'Won');
      const totalVolume = clientBids.reduce((s, b) => s + (b.bid_amount || 0), 0);
      const awardedVolume = won.reduce((s, b) => {
        if (b.awarded_by) {
          return b.awarded_by.trim().toLowerCase() === name.toLowerCase() ? s + (b.award_amount || b.bid_amount || 0) : s;
        }
        const names = (b.clients && b.clients.length > 0) ? b.clients : parseClients(b.client || '');
        return names.length === 1 ? s + (b.award_amount || b.bid_amount || 0) : s;
      }, 0);
      const winRate = clientBids.length ? (won.length / clientBids.length * 100) : 0;
      const lastBidDate = clientBids.reduce((max, b) => (b.bid_date || '') > max ? b.bid_date : max, '');
      return { name, bidCount: clientBids.length, wonCount: won.length, totalVolume, awardedVolume, winRate, lastBidDate };
    }).filter(c => c.bidCount > 0);
  }, [bids, clientNames]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clientRows
      .filter(c => !q || c.name.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sortKey === 'volume') return b.totalVolume - a.totalVolume;
        if (sortKey === 'awarded') return b.awardedVolume - a.awardedVolume;
        if (sortKey === 'count') return b.bidCount - a.bidCount;
        if (sortKey === 'winrate') return b.winRate - a.winRate;
        if (sortKey === 'recent') return (b.lastBidDate || '').localeCompare(a.lastBidDate || '');
        return 0;
      });
  }, [clientRows, search, sortKey]);

  return (
    <div className="page">
      {selectedClient && <ClientDetail clientName={selectedClient} bids={bids} onClose={() => setSelectedClient(null)} />}

      <div className="table-controls" style={{ marginBottom: 16 }}>
        <input className="search-input" type="text" placeholder="Search clients…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="select-filter" value={sortKey} onChange={e => setSortKey(e.target.value)}>
          <option value="volume">Sort: Total Volume</option>
          <option value="awarded">Sort: Awarded Volume</option>
          <option value="count">Sort: Bid Count</option>
          <option value="winrate">Sort: Win Rate</option>
          <option value="recent">Sort: Most Recent</option>
        </select>
        <span className="table-count">{filtered.length} clients</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(c => (
          <button key={c.name} onClick={() => setSelectedClient(c.name)} style={{
            display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
            cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'border-color 0.15s',
            fontFamily: 'inherit', color: 'inherit',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                {c.bidCount} bids · {c.wonCount} won · {c.winRate.toFixed(0)}% win rate
                {c.lastBidDate && <span> · last bid {c.lastBidDate}</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>{fmt$(c.totalVolume)}</div>
              {c.awardedVolume > 0 && <div style={{ fontSize: 11, color: 'var(--won)' }}>{fmt$(c.awardedVolume)} awarded</div>}
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>No clients found.</div>
        )}
      </div>
    </div>
  );
}
