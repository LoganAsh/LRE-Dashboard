import { useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmt$ } from './utils.js';
import { fmtDate } from './dates.js';
import { initialsOf } from './clientStats.js';

const TILE_W = 152;          // px
const GAP = 16;              // px between tiles
const SPEED = 40;            // px per second, slow enough to read a logo as it passes
const MIN_ANIMATED = 4;      // fewer logos than this: just show them still
const MIN_PER_HALF = 14;     // repeat the logos until each half of the loop is at least this many tiles wide

/* ── details card shown while a logo is hovered or focused ─────────────────── */

function InfoCard({ item, anchor }) {
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    const w = 264, h = 210;
    const left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 12));
    const below = r.bottom + 10;
    const top = below + h > window.innerHeight - 12 ? Math.max(12, r.top - h - 10) : below;   // flip above when there's no room underneath
    setPos({ left, top });
  }, [anchor]);
  if (!pos) return null;

  const Row = ({ label, value, tone }) => (
    <div className="flex items-baseline justify-between gap-4 text-xs">
      <span className="text-[var(--text-subtle)]">{label}</span>{' '}
      <span className={cn('font-semibold tabular-nums', tone)}>{value}</span>
    </div>
  );

  return createPortal(
    <div
      role="tooltip" id="logo-info-card"
      className="pointer-events-none fixed z-[150] w-[264px] rounded-xl border border-[color:var(--border)] bg-[var(--card)] p-4 [box-shadow:0_8px_24px_-12px_rgba(20,16,8,0.3)]"
      style={{ left: pos.left, top: pos.top }}
    >
      <div className="text-[14px] font-semibold leading-snug text-[var(--text)]">{item.name}</div>
      <div className="mt-0.5 text-xs text-[var(--text-subtle)]">{item.lastBidDate ? `Last Bid ${fmtDate(item.lastBidDate)}` : 'No Bids Yet'}</div>
      <div className="mt-3 space-y-1.5">
        <Row label="Total Bid Volume" value={fmt$(item.totalVolume)} />
        <Row label="Awarded" value={item.awardedVolume > 0 ? fmt$(item.awardedVolume) : '—'} tone={item.awardedVolume > 0 ? 'text-[#15803d] dark:text-[#4ade80]' : undefined} />
        <Row label="Bids" value={item.bidCount} />
        <Row label="Won" value={item.wonCount} />
        <Row label="Win Rate" value={`${item.winRate.toFixed(0)}%`} />
      </div>
      <div className="mt-3 border-t border-[color:var(--border)] pt-2.5 text-[11px] text-[var(--text-subtle)]">Click for full details</div>
    </div>,
    document.body
  );
}

/* ── one logo ──────────────────────────────────────────────────────────────── */

function Tile({ item, duplicate, onOpen, onHover }) {
  const [broken, setBroken] = useState(false);
  return (
    <button
      type="button"
      className="logo-tile h-[88px] shrink-0 appearance-none rounded-xl border border-[color:var(--border)] bg-[#fdfcfa] p-3 outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-[#ea580c]"
      style={{ width: TILE_W, marginRight: GAP }}
      aria-label={`${item.name}: open client details`}
      aria-describedby={undefined}
      aria-hidden={duplicate ? 'true' : undefined}
      tabIndex={duplicate ? -1 : 0}
      onClick={() => onOpen(item.name)}
      onMouseEnter={(e) => onHover(item, e.currentTarget)}
      onMouseLeave={() => onHover(null)}
      onFocus={(e) => onHover(item, e.currentTarget)}
      onBlur={() => onHover(null)}
    >
      {broken ? (
        <span aria-hidden="true" className="text-[26px] font-semibold text-[#8a8580]">{initialsOf(item.name)}</span>
      ) : (
        <img src={item.logo} alt="" loading="lazy" draggable={false} onError={() => setBroken(true)} className="h-full w-full object-contain" />
      )}
    </button>
  );
}

/* ── the strip ─────────────────────────────────────────────────────────────── */

export default function LogoShowcase({ items, onOpen }) {
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(null);     // { item, el }

  const animated = items.length >= MIN_ANIMATED;
  const reps = animated ? Math.ceil(MIN_PER_HALF / items.length) : 1;
  const half = useMemo(() => Array.from({ length: reps }, () => items).flat(), [items, reps]);
  const seconds = Math.round((half.length * (TILE_W + GAP)) / SPEED);   // one loop = one half-width, at a constant speed

  const onHover = (item, el) => setHover(item ? { item, el } : null);

  if (items.length === 0) {
    return (
      <div className="mb-5 rounded-xl border border-dashed border-[color:var(--border)] px-4 py-5 text-center text-[13px] text-[var(--text-subtle)]">
        Upload a logo to any client below and it will scroll across here.
      </div>
    );
  }

  return (
    <section aria-label="Client logos" className="mb-5">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">Client Logos</h2>
        {animated && (
          <button
            type="button" aria-pressed={paused} onClick={() => setPaused((p) => !p)}
            className="inline-flex appearance-none items-center gap-1.5 border-0 bg-transparent p-0 text-xs font-medium text-[var(--text-subtle)] [font-family:inherit] outline-none cursor-pointer hover:text-[var(--text)] focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[#ea580c]"
          >
            {paused ? <Play className="size-3.5" strokeWidth={1.75} aria-hidden="true" /> : <Pause className="size-3.5" strokeWidth={1.75} aria-hidden="true" />}
            {paused ? 'Play' : 'Pause'}
          </button>
        )}
      </div>

      <div className={cn('logo-marquee', paused && 'is-paused', !animated && 'logo-marquee--static')}>
        <div className="logo-track" style={{ '--marquee-duration': `${seconds}s` }}>
          {half.map((it, i) => <Tile key={`a-${i}`} item={it} onOpen={onOpen} onHover={onHover} />)}
          {animated && half.map((it, i) => <Tile key={`b-${i}`} item={it} duplicate onOpen={onOpen} onHover={onHover} />)}
        </div>
      </div>

      {hover && <InfoCard item={hover.item} anchor={hover.el} />}
    </section>
  );
}
