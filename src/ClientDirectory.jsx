import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmt$ } from './utils.js';
import { fmtDate } from './dates.js';
import { buildClientRows, sortClientRows, clientKey } from './clientStats.js';
import { useClientLogos } from './clientLogos.js';
import ClientLogo from './ClientLogo.jsx';
import ClientDetail from './ClientDetail.jsx';

const green = 'text-[#15803d] dark:text-[#4ade80]';

function MiniStat({ label, value }) {
  return (
    <div className="min-w-0 border-l border-[color:var(--border)] pl-3 first:border-l-0 first:pl-0">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">{label}</dt>
      <dd className="mt-0.5 text-[15px] font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function ClientCard({ row, isTop, logo, busy, onOpen, onPick }) {
  const { name } = row;
  return (
    <article
      data-client={name}
      data-bids={row.bidCount}
      data-won={row.wonCount}
      data-winrate={row.winRate.toFixed(0)}
      data-last={row.lastBidDate}
      data-volume={fmt$(row.totalVolume)}
      data-awarded={row.awardedVolume > 0 ? fmt$(row.awardedVolume) : ''}
      onClick={() => onOpen(name)}
      className={cn(
        'contour flex aspect-[2/3] cursor-pointer flex-col gap-3.5 rounded-[14px] border border-[color:var(--border)] bg-[var(--card)] p-4',
        'transition-colors hover:border-[color-mix(in_srgb,var(--text)_22%,transparent)]'
      )}
    >
      {/* The logo takes whatever height is left after the details below */}
      <div className="relative min-h-0 flex-1">
        <ClientLogo name={name} logo={logo} busy={busy} onPick={onPick} className="absolute inset-0" />
      </div>

      <div className="shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button" data-client-open aria-haspopup="dialog" title={name}
            onClick={(e) => { e.stopPropagation(); onOpen(name); }}
            className="min-w-0 appearance-none truncate border-0 bg-transparent p-0 text-left text-[15px] font-semibold text-[var(--text)] [font-family:inherit] outline-none cursor-pointer hover:text-[#c2540a] focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[#ea580c] dark:hover:text-[#fb923c]"
          >
            {name}
          </button>
          {isTop && <span className="size-1.5 shrink-0 rounded-full bg-[var(--won)]" title="Top 10 client by bid volume" aria-label="Top 10 client by bid volume" />}
        </div>
        <div className="mt-0.5 truncate text-xs text-[var(--text-subtle)]">
          {row.lastBidDate ? `Last Bid ${fmtDate(row.lastBidDate)}` : 'No Bids Yet'}
        </div>
      </div>

      <div className="shrink-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">Total Bid Volume</div>
        <div className="mt-1 text-[24px] font-semibold leading-none tracking-tight tabular-nums">{fmt$(row.totalVolume)}</div>
        <div className={cn('mt-1.5 text-xs', row.awardedVolume > 0 ? cn('font-medium', green) : 'text-[var(--text-subtle)]')}>
          {row.awardedVolume > 0 ? `${fmt$(row.awardedVolume)} Awarded` : 'No Awards Yet'}
        </div>
      </div>

      <dl className="grid shrink-0 grid-cols-3 border-t border-[color:var(--border)] pt-3">
        <MiniStat label="Bids" value={row.bidCount} />
        <MiniStat label="Won" value={row.wonCount} />
        <MiniStat label="Win Rate" value={`${row.winRate.toFixed(0)}%`} />
      </dl>
    </article>
  );
}

export default function ClientDirectory({ bids: initialBids }) {
  const [bids, setBids] = useState(initialBids);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('volume');
  const [selectedClient, setSelectedClient] = useState(null);
  const { logos, busyKey, error, clearError, upload, remove } = useClientLogos();

  useEffect(() => { setBids(initialBids); }, [initialBids]);

  const handleBidSave = (updated) => setBids((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));

  const rows = useMemo(() => buildClientRows(bids), [bids]);
  const topClients = useMemo(
    () => new Set([...rows].sort((a, b) => b.totalVolume - a.totalVolume).slice(0, 10).map((r) => r.name)),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return sortClientRows(rows.filter((c) => !q || c.name.toLowerCase().includes(q)), sortKey);
  }, [rows, search, sortKey]);

  return (
    <div className="page">
      {selectedClient && (
        <ClientDetail
          clientName={selectedClient}
          bids={bids}
          onBidSave={handleBidSave}
          logo={logos[clientKey(selectedClient)]?.url}
          busy={busyKey === clientKey(selectedClient)}
          onUpload={(file) => upload(selectedClient, file)}
          onRemove={() => remove(selectedClient)}
          onClose={() => setSelectedClient(null)}
        />
      )}

      <div className="table-controls" style={{ marginBottom: 16 }}>
        <input className="search-input" type="text" placeholder="Search clients…" aria-label="Search clients" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select-filter" aria-label="Sort clients" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
          <option value="volume">Sort: Total Volume</option>
          <option value="awarded">Sort: Awarded Volume</option>
          <option value="count">Sort: Bid Count</option>
          <option value="winrate">Sort: Win Rate</option>
          <option value="recent">Sort: Most Recent</option>
        </select>
        <span className="table-count">{filtered.length} Clients</span>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-[color:var(--lost)] px-3.5 py-2.5 text-[13px] text-[#b91c1c] dark:text-[#f87171]">
          <span>{error}</span>
          <button type="button" onClick={clearError} aria-label="Dismiss message" className="mt-0.5 shrink-0 appearance-none border-0 bg-transparent p-0 text-inherit cursor-pointer">
            <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-[13px] text-[var(--text-subtle)]">No clients found.</div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {filtered.map((row) => (
            <ClientCard
              key={row.name}
              row={row}
              isTop={topClients.has(row.name)}
              logo={logos[clientKey(row.name)]?.url}
              busy={busyKey === clientKey(row.name)}
              onOpen={setSelectedClient}
              onPick={(file) => upload(row.name, file)}
            />
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center gap-1.5 text-xs text-[var(--text-subtle)]">
        <span className="size-1.5 rounded-full bg-[var(--won)]" aria-hidden="true" />Top 10 Client by Volume
        <span className="mx-1.5" aria-hidden="true">·</span>Hover a logo to upload or change it
      </div>
    </div>
  );
}
