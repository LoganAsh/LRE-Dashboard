import { useEffect, useId, useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from './supabase.js';
import { fmtFull$, fmt$ } from './utils.js';
import { parseClients } from './hooks.js';

// Same mapping the Bid Log table uses for its status dots.
const STATUSES = [
  { value: 'Won', color: 'var(--won)' },
  { value: 'Pending', color: 'var(--accent)' },
  { value: 'Lost', color: 'var(--lost)' },
  { value: 'Upcoming', color: 'var(--info)' },
  { value: 'Client Not Awarded', color: 'var(--lost)' },
  { value: 'Project Re-Bid', color: 'var(--accent)' },
];

// Local calendar date (not UTC), so "today" is right in the evening too.
const pad = (n) => String(n).padStart(2, '0');
const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Buttons and inputs get no browser styling here, so each one sets its own look.
const labelCls = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]';
const hintCls = 'ml-1 font-normal normal-case tracking-normal';
const inputCls = cn(
  'h-9 w-full appearance-none rounded-lg border border-[color:var(--border)] bg-[var(--card)] px-3 text-[13px] text-[var(--text)]',
  'outline-none [font-family:inherit] transition-colors placeholder:text-[var(--text-subtle)] focus:border-[#ea580c]'
);
const textBtn = cn(
  'appearance-none border-0 bg-transparent p-0 text-xs font-medium text-[#c2540a] [font-family:inherit] cursor-pointer',
  'hover:underline dark:text-[#fb923c]'
);

export function StatusModal({ bid, onClose, onSave }) {
  const clientNames = (bid.clients && bid.clients.length > 0) ? bid.clients : parseClients(bid.client || '');

  const [status, setStatus] = useState(bid.status_override || bid.status || 'Pending');
  const [notes, setNotes] = useState(bid.user_notes || '');
  const [awardAmt, setAwardAmt] = useState(bid.award_amount ?? '');
  const [awardedBy, setAwardedBy] = useState(bid.awarded_by || (clientNames.length === 1 ? clientNames[0] : ''));
  const [lastFollowup, setLastFollowup] = useState(bid.last_followup_date || '');
  const [nextFollowup, setNextFollowup] = useState(bid.next_followup_date || '');
  const [highPriority, setHighPriority] = useState(bid.high_priority || false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Place + % High/Low, one entry per client
  const [placements, setPlacements] = useState(() =>
    Object.fromEntries(clientNames.map((c) => [c, { place: '', pct_high_low: '' }]))
  );

  useEffect(() => {
    let cancelled = false;
    supabase.from('lre_bid_placements').select('*').eq('bid_id', bid.id).then(({ data }) => {
      if (cancelled || !data || data.length === 0) return;
      setPlacements((prev) => {
        const next = { ...prev };
        data.forEach((row) => {
          next[row.client_name] = { place: row.place ?? '', pct_high_low: row.pct_high_low ?? '' };
        });
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [bid.id]);

  const updatePlacement = (clientName, key, value) =>
    setPlacements((prev) => ({ ...prev, [clientName]: { ...prev[clientName], [key]: value } }));

  const setNextPreset = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setNextFollowup(localISO(d));
  };

  const awardNum = awardAmt !== '' ? parseFloat(awardAmt) : null;
  const awarded = !!(awardNum && awardNum > 0);
  const baseVal = awarded ? awardNum : (bid.bid_amount ?? 0);
  const profit = baseVal * (bid.margin_pct ?? 0);

  const needsAwardee = status === 'Won' && clientNames.length > 1 && !awardedBy;
  const blocked = saving || needsAwardee;

  const handleSave = async () => {
    setSaving(true); setError('');
    const { error: err } = await supabase.from('lre_bids').update({
      status_override: status, user_notes: notes || null,
      award_amount: awardNum, last_followup_date: lastFollowup || null,
      next_followup_date: nextFollowup || null,
      awarded_by: status === 'Won' ? (awardedBy || null) : null,
      high_priority: highPriority,
    }).eq('id', bid.id);
    if (err) { setSaving(false); setError(err.message); return; }

    // Save results per client (only rows with a value entered)
    const placementRows = clientNames
      .filter((c) => placements[c] && (placements[c].place !== '' || placements[c].pct_high_low !== ''))
      .map((c) => ({
        bid_id: bid.id,
        client_name: c,
        place: placements[c].place !== '' ? parseInt(placements[c].place) : null,
        pct_high_low: placements[c].pct_high_low !== '' ? parseFloat(placements[c].pct_high_low) : null,
      }));
    if (placementRows.length > 0) {
      const { error: placeErr } = await supabase.from('lre_bid_placements').upsert(placementRows, { onConflict: 'bid_id,client_name' });
      if (placeErr) { setSaving(false); setError(placeErr.message); return; }
    }

    setSaving(false);
    onSave({
      ...bid, status_override: status, effective_status: status, user_notes: notes,
      award_amount: awardNum, last_followup_date: lastFollowup || null,
      next_followup_date: nextFollowup || null, projected_profit: profit,
      awarded_by: status === 'Won' ? (awardedBy || null) : null,
      high_priority: highPriority, placements,
    });
    onClose();
  };

  // Arrow keys move between status options, like a native radio group.
  const statusGroupRef = useRef(null);
  const selectedRef = useRef(null);
  const onStatusKey = (e) => {
    const i = STATUSES.findIndex((s) => s.value === status);
    let n;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % STATUSES.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + STATUSES.length) % STATUSES.length;
    else return;
    e.preventDefault();
    setStatus(STATUSES[n].value);
    statusGroupRef.current?.querySelector(`[data-status="${STATUSES[n].value}"]`)?.focus();
  };

  const id = useId();
  const awardId = `${id}-award`, byId = `${id}-by`, notesId = `${id}-notes`, lastId = `${id}-last`, nextId = `${id}-next`;
  const problem = error || (needsAwardee ? 'Pick the awarding client to save.' : '');

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[250] bg-black/30 transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-[250] flex items-center justify-center p-4 max-sm:p-0">
          <Dialog.Popup
            initialFocus={selectedRef}
            className={cn(
              'flex w-full max-w-[600px] flex-col overflow-hidden border border-[color:var(--border)] bg-[var(--card)] text-[var(--text)] outline-none',
              'sm:max-h-[90vh] sm:rounded-2xl max-sm:h-[100dvh] max-sm:rounded-none max-sm:border-0',
              'transition-[opacity,transform] duration-150 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0'
            )}
          >
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[color:var(--border)] px-6 py-4">
              <div className="min-w-0">
                <Dialog.Title className="line-clamp-2 text-[17px] font-semibold leading-snug tracking-tight">{bid.name}</Dialog.Title>
                <Dialog.Description className="mt-0.5 text-xs text-[var(--text-subtle)]">
                  {bid.client} · {bid.bid_date}{bid.bid_time ? ' ' + bid.bid_time : ''} · {bid.year}
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="Close"
                className="-mr-2 -mt-1 flex size-8 shrink-0 appearance-none items-center justify-center rounded-lg border-0 bg-transparent text-[var(--text-subtle)] transition-colors hover:text-[var(--text)] cursor-pointer"
              >
                <X className="size-4" strokeWidth={1.75} />
              </Dialog.Close>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
              {/* Numbers */}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4 sm:gap-x-0">
                {[
                  ['Bid Amount', fmtFull$(bid.bid_amount ?? 0)],
                  ['Margin %', `${((bid.margin_pct ?? 0) * 100).toFixed(1)}%`],
                  ['Cost', fmtFull$(bid.cost ?? 0)],
                ].map(([label, value], i) => (
                  <div key={label} className={cn('min-w-0', i > 0 && 'sm:border-l sm:border-[color:var(--border)] sm:pl-4')}>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">{label}</dt>
                    <dd className="mt-1 text-[15px] font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
                <div className="min-w-0 sm:border-l sm:border-[color:var(--border)] sm:pl-4">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">
                    Profit + OH {awarded ? '(On Award)' : '(On Bid)'}
                  </dt>
                  <dd className={cn('mt-1 text-[15px] font-semibold tabular-nums', awarded ? 'text-[#15803d] dark:text-[#4ade80]' : 'text-[#c2540a] dark:text-[#fb923c]')}>
                    {fmt$(profit)}
                  </dd>
                </div>
              </dl>

              {(bid.pre_bid || bid.notes) && (
                <div className="space-y-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  {bid.pre_bid && (
                    <p>
                      <span className="mr-1.5 font-semibold text-[var(--text)]">Pre-Bid</span>
                      {bid.pre_bid}{bid.pre_bid_time ? ' · ' + bid.pre_bid_time : ''}
                    </p>
                  )}
                  {bid.notes && (
                    <p>
                      <span className="mr-1.5 font-semibold text-[var(--text)]">Bid Notes</span>
                      {bid.notes}
                    </p>
                  )}
                </div>
              )}

              {/* Status */}
              <div>
                <span id={`${id}-status`} className={labelCls}>Status</span>
                <div
                  ref={statusGroupRef}
                  role="radiogroup"
                  aria-labelledby={`${id}-status`}
                  onKeyDown={onStatusKey}
                  className="flex flex-wrap gap-x-5 gap-y-2"
                >
                  {STATUSES.map((s) => {
                    const on = status === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        data-status={s.value}
                        tabIndex={on ? 0 : -1}
                        ref={on ? selectedRef : undefined}
                        onClick={() => setStatus(s.value)}
                        className={cn(
                          'inline-flex appearance-none items-center gap-2 border-0 border-b-2 bg-transparent pb-1 pt-0.5 text-[13px] [font-family:inherit] outline-none cursor-pointer',
                          'transition-colors focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[#ea580c]',
                          on ? 'font-semibold text-[var(--text)]' : 'font-medium text-[var(--text-subtle)] hover:text-[var(--text)]'
                        )}
                        style={{ borderBottomStyle: 'solid', borderBottomColor: on ? s.color : 'transparent' }}
                      >
                        <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
                        {s.value}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Award */}
              {status === 'Won' && (
                <div>
                  <label htmlFor={byId} className={labelCls}>
                    Awarded By {clientNames.length > 1 && <span className="ml-1 text-[var(--lost)]">*Required</span>}
                  </label>
                  {clientNames.length === 1 ? (
                    <p className="flex items-center gap-2 text-[13px] font-medium">
                      <span className="size-2 rounded-full" style={{ background: 'var(--won)' }} />
                      {clientNames[0]}
                    </p>
                  ) : (
                    <select
                      id={byId}
                      value={awardedBy}
                      onChange={(e) => setAwardedBy(e.target.value)}
                      aria-invalid={!awardedBy}
                      className={cn(inputCls, 'cursor-pointer', !awardedBy && 'border-[color:var(--lost)]')}
                    >
                      <option value="">— Select Awarding Client —</option>
                      {clientNames.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                </div>
              )}

              <div>
                <label htmlFor={awardId} className={labelCls}>
                  Award Amount<span className={hintCls}>(Updates Profit Calculation)</span>
                </label>
                <input
                  id={awardId}
                  type="number"
                  placeholder="Enter award amount if won…"
                  value={awardAmt}
                  onChange={(e) => setAwardAmt(e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* Results per client */}
              <div>
                <span className={labelCls}>
                  Bid Results{clientNames.length > 1 && <span className={hintCls}>(One per Client)</span>}
                </span>
                <div className="space-y-2">
                  <div className="grid grid-cols-[minmax(0,1fr)_72px_104px] gap-2 text-[11px] text-[var(--text-subtle)]" aria-hidden="true">
                    <span>Client</span><span className="text-center">Place</span><span className="text-center">% High/Low</span>
                  </div>
                  {clientNames.map((c) => (
                    <div key={c} className="grid grid-cols-[minmax(0,1fr)_72px_104px] items-center gap-2">
                      <span className="truncate text-[13px]" title={c}>{c}</span>
                      <input
                        type="number" min="1" placeholder="Place"
                        aria-label={`Place for ${c}`}
                        title="What place our bid finished (1 = low bid)"
                        value={placements[c]?.place ?? ''}
                        onChange={(e) => updatePlacement(c, 'place', e.target.value)}
                        className={cn(inputCls, 'px-2 text-center')}
                      />
                      <input
                        type="number" step="0.1" placeholder="% High/Low"
                        aria-label={`Percent high or low for ${c}`}
                        title="Positive = we were X% high, negative = we were X% low"
                        value={placements[c]?.pct_high_low ?? ''}
                        onChange={(e) => updatePlacement(c, 'pct_high_low', e.target.value)}
                        className={cn(inputCls, 'px-2 text-center')}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <button
                type="button"
                role="switch"
                aria-checked={highPriority}
                onClick={() => setHighPriority((p) => !p)}
                className={cn(
                  'flex w-full appearance-none items-center justify-between gap-3 rounded-lg border border-[color:var(--border)] bg-transparent px-3 py-2.5 text-left',
                  '[font-family:inherit] outline-none cursor-pointer transition-colors hover:border-[color-mix(in_srgb,var(--text)_28%,transparent)]',
                  'focus-visible:ring-2 focus-visible:ring-[#ea580c]'
                )}
              >
                <span className="flex items-center gap-2 text-[13px] font-medium text-[var(--text)]">
                  <Star
                    className={cn('size-4', highPriority ? 'fill-[#d99a06] text-[#d99a06]' : 'text-[var(--text-subtle)]')}
                    strokeWidth={1.75}
                  />
                  High Priority
                </span>
                <span className="text-xs text-[var(--text-subtle)]">{highPriority ? 'On — Click to Remove' : 'Off'}</span>
              </button>

              <div>
                <label htmlFor={notesId} className={labelCls}>Notes</label>
                <textarea
                  id={notesId}
                  placeholder="Add notes…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className={cn(inputCls, 'h-auto min-h-[84px] resize-y py-2 leading-relaxed')}
                />
              </div>

              {/* Follow-up */}
              <div className="border-t border-[color:var(--border)] pt-5">
                <span className={labelCls}>Follow-Up</span>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor={lastId} className="mb-1.5 block text-xs text-[var(--text-subtle)]">Last Follow-Up</label>
                    <input id={lastId} type="date" value={lastFollowup} onChange={(e) => setLastFollowup(e.target.value)} className={inputCls} />
                    <div className="mt-1.5">
                      <button type="button" className={textBtn} onClick={() => setLastFollowup(localISO(new Date()))}>Set to Today</button>
                    </div>
                  </div>
                  <div>
                    <label htmlFor={nextId} className="mb-1.5 block text-xs text-[var(--text-subtle)]">Next Follow-Up</label>
                    <input id={nextId} type="date" value={nextFollowup} onChange={(e) => setNextFollowup(e.target.value)} className={inputCls} />
                    <div className="mt-1.5 flex items-center gap-2">
                      {[['1 Wk', 7], ['2 Wks', 14], ['1 Mo', 30]].map(([label, days], i) => (
                        <span key={label} className="flex items-center gap-2">
                          {i > 0 && <span className="text-[var(--text-subtle)]" aria-hidden="true">·</span>}
                          <button type="button" className={textBtn} onClick={() => setNextPreset(days)}>{label}</button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[color:var(--border)] px-6 py-3.5">
              <p role="alert" className="min-w-0 flex-1 text-xs text-[var(--lost)]">{problem}</p>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 appearance-none rounded-lg border border-[color:var(--border)] bg-transparent px-4 text-[13px] font-medium text-[var(--text-secondary)] [font-family:inherit] outline-none cursor-pointer transition-colors hover:border-[color-mix(in_srgb,var(--text)_28%,transparent)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[#ea580c]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={blocked}
                  className="h-9 appearance-none rounded-lg border-0 bg-[#c2540a] px-5 text-[13px] font-semibold text-white [font-family:inherit] outline-none cursor-pointer transition-colors hover:bg-[#a8470a] focus-visible:ring-2 focus-visible:ring-[#ea580c] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default StatusModal;
