import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from './supabase.js';
import { usePlacements, placementStats } from './hooks.js';
import { fmt$, fmtFull$, classifyStatus } from './utils.js';
import { fmtDate } from './dates.js';
import { bidsForClient, clientDetailStats, matchProjects, projectStats, namesOnBid } from './clientStats.js';
import { ACCEPT } from './clientLogos.js';
import ClientLogo from './ClientLogo.jsx';
import { StatusModal } from './StatusModal.jsx';

// Dot color for a project's stage
const PROJECT_DOT = { 'Not Started': '#8a8580', Mobilizing: '#ca8a04', Active: '#ea580c', 'Punch List': '#ea580c', Complete: '#16a34a' };

const green = 'text-[#15803d] dark:text-[#4ade80]';
const red = 'text-[#b91c1c] dark:text-[#f87171]';
const violet = 'text-[#6d5bd0] dark:text-[#a78bfa]';
const orange = 'text-[#c2540a] dark:text-[#fb923c]';

const textBtn = 'appearance-none border-0 bg-transparent p-0 text-xs font-medium [font-family:inherit] outline-none cursor-pointer hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[#ea580c]';

function Stat({ label, value, tone }) {
  return (
    <div className="min-w-0 sm:border-l sm:border-[color:var(--border)] sm:pl-4 sm:first:border-l-0 sm:first:pl-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">{label}</dt>
      <dd className={cn('mt-1 text-[17px] font-semibold tabular-nums', tone)}>{value}</dd>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 className="mb-3 border-b border-[color:var(--border)] pb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">
      {children}
    </h3>
  );
}

export default function ClientDetail({ clientName, bids, onBidSave, logo, busy, onUpload, onRemove, onClose }) {
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [modalBid, setModalBid] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setLoadingProjects(true);
    supabase.from('lre_projects').select('*').then(({ data }) => {
      if (!alive) return;
      setProjects(matchProjects(data, clientName));
      setLoadingProjects(false);
    });
    return () => { alive = false; };
  }, [clientName]);

  const clientBids = useMemo(() => bidsForClient(bids, clientName).filter((b) => b.bid_amount > 0), [bids, clientName]);
  const stats = useMemo(() => clientDetailStats(clientBids, clientName), [clientBids, clientName]);
  const { placements } = usePlacements();
  const placeStats = useMemo(() => placementStats(placements, clientName), [placements, clientName]);
  const pStats = useMemo(() => projectStats(projects), [projects]);
  const sortedBids = useMemo(() => [...clientBids].sort((a, b) => (b.bid_date || '').localeCompare(a.bid_date || '')), [clientBids]);
  const lastBid = sortedBids[0] && sortedBids[0].bid_date;

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[200] bg-black/30 transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-[200] flex items-center justify-center p-4 max-sm:p-0">
          <Dialog.Popup
            className={cn(
              'flex w-full max-w-[760px] flex-col overflow-hidden border border-[color:var(--border)] bg-[var(--card)] text-[var(--text)] outline-none',
              'sm:max-h-[90vh] sm:rounded-2xl max-sm:h-[100dvh] max-sm:rounded-none max-sm:border-0',
              'transition-[opacity,transform] duration-150 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0'
            )}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center gap-4 border-b border-[color:var(--border)] px-6 py-4">
              <ClientLogo name={clientName} logo={logo} busy={busy} onPick={onUpload} size={60} />
              <div className="min-w-0 flex-1">
                <Dialog.Title className="truncate text-[20px] font-semibold leading-snug tracking-tight">{clientName}</Dialog.Title>
                <Dialog.Description className="mt-0.5 text-xs text-[var(--text-subtle)]">
                  {clientBids.length} {clientBids.length === 1 ? 'Bid' : 'Bids'}{lastBid ? ` · Last Bid ${fmtDate(lastBid)}` : ''}
                </Dialog.Description>
                <div className="mt-1.5 flex items-center gap-4">
                  <input
                    ref={fileRef} type="file" accept={ACCEPT} tabIndex={-1} aria-hidden="true" className="sr-only"
                    onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) onUpload(f); e.target.value = ''; }}
                  />
                  <button type="button" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()} className={cn(textBtn, orange, 'disabled:opacity-50')}>
                    {logo ? 'Change Logo' : 'Upload Logo'}
                  </button>
                  {logo && (
                    <button type="button" disabled={busy} onClick={onRemove} className={cn(textBtn, 'text-[var(--text-subtle)] hover:text-[#b91c1c] disabled:opacity-50 dark:hover:text-[#f87171]')}>
                      Remove Logo
                    </button>
                  )}
                </div>
              </div>
              <Dialog.Close
                aria-label="Close"
                className="-mr-2 flex size-8 shrink-0 appearance-none items-center justify-center rounded-lg border-0 bg-transparent text-[var(--text-subtle)] transition-colors hover:text-[var(--text)] cursor-pointer"
              >
                <X className="size-4" strokeWidth={1.75} />
              </Dialog.Close>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-5">
              <dl className="grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-6 sm:gap-x-0">
                <Stat label="Total Bids" value={clientBids.length} />
                <Stat label="Win Rate" value={`${stats.winRate.toFixed(0)}%`} tone={orange} />
                <Stat label="Won" value={stats.won.length} tone={green} />
                <Stat label="Lost" value={stats.lost.length} tone={red} />
                <Stat label="Pending" value={stats.pending.length} tone={violet} />
                <Stat label="Avg Margin" value={`${stats.avgMargin.toFixed(1)}%`} />
              </dl>

              <dl className="grid grid-cols-2 gap-x-4 sm:gap-x-0">
                <Stat label="Total Bid Volume" value={fmt$(stats.totalVolume)} />
                <Stat label="Awarded Volume" value={fmt$(stats.awardedVolume)} tone={green} />
              </dl>

              {placeStats.count > 0 && (
                <dl className="grid grid-cols-3 gap-x-4 sm:gap-x-0">
                  <Stat
                    label="Avg % High/Low"
                    value={placeStats.avgPctHighLow !== null ? `${placeStats.avgPctHighLow > 0 ? '+' : ''}${placeStats.avgPctHighLow.toFixed(1)}%` : '—'}
                    tone={placeStats.avgPctHighLow !== null && placeStats.avgPctHighLow < 0 ? green : undefined}
                  />
                  <Stat label="Avg Place" value={placeStats.avgPlace !== null ? placeStats.avgPlace.toFixed(1) : '—'} />
                  <Stat label="1st Place Finishes" value={`${placeStats.firstPlaceCount} / ${placeStats.withPlace.length}`} tone={green} />
                </dl>
              )}

              {/* Projects */}
              <section>
                <SectionTitle>Projects {projects.length > 0 && `(${projects.length})`}</SectionTitle>
                {loadingProjects ? (
                  <div className="text-xs text-[var(--text-subtle)]">Loading…</div>
                ) : projects.length === 0 ? (
                  <div className="text-xs text-[var(--text-subtle)]">No projects tracked for this client yet.</div>
                ) : (
                  <>
                    <dl className="mb-4 grid grid-cols-3 gap-x-4 sm:gap-x-0">
                      <Stat label="Active Projects" value={pStats.active.length} tone={orange} />
                      <Stat label="Total Contract" value={fmt$(pStats.totalContract)} />
                      <Stat label="Total Actual Cost" value={fmt$(pStats.totalActual)} />
                    </dl>
                    <div className="divide-y divide-[color:var(--border)]">
                      {projects.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-semibold">{p.name}</div>
                            <div className="text-xs text-[var(--text-subtle)]">{fmtFull$((p.original_contract || 0) + (p.approved_cos || 0))} Revised Contract</div>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium text-[var(--text-secondary)]">
                            <span className="size-1.5 rounded-full" style={{ background: PROJECT_DOT[p.status] || '#8a8580' }} aria-hidden="true" />
                            {p.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              {/* Bid history */}
              <section>
                <SectionTitle>Bid History ({sortedBids.length})</SectionTitle>
                <div className="max-h-[360px] overflow-y-auto">
                  {sortedBids.map((b, i) => {
                    const eff = b.effective_status || b.status;
                    // Won, but awarded to a different client on the same bid: show "Not Awarded" from this client's side
                    const wonByOther = eff === 'Won' && b.awarded_by && b.awarded_by.trim().toLowerCase() !== clientName.toLowerCase() && namesOnBid(b).length > 1;
                    const displayStatus = wonByOther ? 'Not Awarded' : eff;
                    const showAwarded = eff === 'Won' && !wonByOther && b.award_amount > 0;
                    const amount = showAwarded ? b.award_amount : b.bid_amount;
                    const pl = placements.find((p) => p.bid_id === b.id && p.client_name.trim().toLowerCase() === clientName.toLowerCase());
                    const pct = pl && pl.pct_high_low !== null && pl.pct_high_low !== undefined ? Number(pl.pct_high_low) : null;
                    return (
                      <button
                        key={b.id ?? i} type="button" onClick={() => setModalBid(b)} aria-haspopup="dialog"
                        className="-mx-2 flex w-[calc(100%+1rem)] appearance-none items-center gap-3 rounded-lg border-0 bg-transparent px-2 py-2 text-left text-[var(--text)] [font-family:inherit] outline-none cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--text)_3%,transparent)] focus-visible:ring-2 focus-visible:ring-[#ea580c]"
                      >
                        <span className="w-[92px] shrink-0 whitespace-nowrap text-xs tabular-nums text-[var(--text-subtle)]">{fmtDate(b.bid_date)}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px]">{b.name}</span>
                        {pl && pl.place ? <span className="shrink-0 text-[11px] text-[var(--text-subtle)]">#{pl.place}</span> : null}
                        {pct !== null ? (
                          <span className={cn('shrink-0 text-[11px] tabular-nums', pct < 0 ? green : red)}>{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</span>
                        ) : null}
                        <span className={cn('shrink-0 text-[13px] tabular-nums', showAwarded ? cn('font-semibold', green) : 'text-[var(--text-secondary)]')}>{fmtFull$(amount)}</span>
                        <span className={cn('status-pill shrink-0', wonByOther ? 'pill-nobid' : classifyStatus(eff))}>{displayStatus}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* Opened inside this window so Escape closes the top one first */}
            {modalBid && <StatusModal bid={modalBid} onClose={() => setModalBid(null)} onSave={onBidSave} />}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
