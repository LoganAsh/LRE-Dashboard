import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { StatusModal } from '../StatusModal.jsx';
import { buildEvents, billingEventsBetween, KINDS, COLORS } from '../BidCalendar.jsx';
import { useBillingProjects } from '../projectBilling.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const key = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a, b) => key(a) === key(b);
const timeText = (ev) => (ev.hasTime ? ev.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'All Day');
const dayWord = (d, today) => { const n = Math.round((d - today) / 86400000); return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : null; };

function EventRow({ ev, onOpen }) {
  return (
    <button type="button" className="m-row" style={{ minHeight: 64 }} onClick={() => onOpen(ev)} aria-label={`${ev.title}, ${ev.kindLabel}, ${timeText(ev)}`}>
      <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: ev.color, flex: 'none', margin: '2px 0' }} aria-hidden="true" />
      <div style={{ width: 62, flex: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{timeText(ev)}</div>
      <div className="m-row-main">
        <div className="m-row-title">{ev.title}</div>
        <div className="m-row-sub"><span style={{ color: ev.color, fontWeight: 600, flex: 'none', whiteSpace: 'nowrap' }}>{ev.kindLabel}</span><span className="t" style={{ color: 'var(--muted)' }}>{ev.details[0]}</span></div>
      </div>
      {ev.priority && <Star size={15} fill="#d99a06" color="#d99a06" aria-label="High priority" style={{ flex: 'none' }} />}
      <ChevronRight size={18} style={{ color: 'var(--muted)', opacity: 0.55, flex: 'none', marginRight: 6 }} aria-hidden="true" />
    </button>
  );
}

export default function MCalendar({ bids: initialBids, onNavigate }) {
  const today = useMemo(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; }, []);
  const [bids, setBids] = useState(initialBids);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(today);
  const [view, setView] = useState('month');
  const [kind, setKind] = useState('all');
  const [modalBid, setModalBid] = useState(null);
  const touch = useRef(null);
  useEffect(() => { setBids(initialBids); }, [initialBids]);

  const { projects } = useBillingProjects();
  const base = useMemo(() => buildEvents(bids), [bids]);

  // the 6 weeks shown in the month grid, and the next 60 days for the agenda
  const gridStart = useMemo(() => addDays(month, -month.getDay()), [month]);
  const gridEnd = useMemo(() => addDays(gridStart, 41), [gridStart]);
  const agendaEnd = useMemo(() => addDays(today, 60), [today]);
  const billing = useMemo(
    () => billingEventsBetween(projects, view === 'month' ? gridStart : today, view === 'month' ? gridEnd : agendaEnd),
    [projects, view, gridStart, gridEnd, today, agendaEnd]
  );
  const events = useMemo(() => [...base, ...billing].filter((e) => kind === 'all' || e.kind === kind).sort((a, b) => a.start - b.start), [base, billing, kind]);
  const byDay = useMemo(() => { const m = {}; events.forEach((e) => { (m[key(e.start)] = m[key(e.start)] || []).push(e); }); return m; }, [events]);

  const cells = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);
  const goMonth = (n) => {
    const m = new Date(month.getFullYear(), month.getMonth() + n, 1);
    setMonth(m);
    setSelected(m.getMonth() === today.getMonth() && m.getFullYear() === today.getFullYear() ? today : m);
  };
  const goToday = () => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(today); };
  const open = (ev) => {
    if (ev.kind === 'billing') { if (onNavigate) onNavigate('Projects'); return; }
    const b = bids.find((x) => x.id === ev.ref); if (b) setModalBid(b);
  };
  const onTouchEnd = (e) => {
    const t = touch.current; touch.current = null; if (!t) return;
    const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 45) goMonth(dx < 0 ? 1 : -1);
  };

  const dayEvents = byDay[key(selected)] || [];
  const agendaDays = useMemo(() => {
    const out = []; for (let i = 0; i <= 60; i++) { const d = addDays(today, i); if (byDay[key(d)]) out.push(d); } return out;
  }, [byDay, today]);

  return (
    <>
      {modalBid && <StatusModal bid={modalBid} onClose={() => setModalBid(null)} onSave={(u) => setBids((prev) => prev.map((b) => (b.id === u.id ? u : b)))} />}

      <div className="m-sticky">
        <div className="m-toolbar" style={{ justifyContent: 'space-between' }}>
          {view === 'month' ? (
            <>
              <button type="button" className="m-hbtn" onClick={() => goMonth(-1)} aria-label="Previous month"><ChevronLeft /></button>
              <button type="button" onClick={goToday} style={{ flex: 1, textAlign: 'center', border: 0, background: 'none', fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', padding: '8px 0', cursor: 'pointer' }} aria-label={`${MONTHS[month.getMonth()]} ${month.getFullYear()}. Go to today`}>
                {MONTHS[month.getMonth()]} {month.getFullYear()}
              </button>
              <button type="button" className="m-hbtn" onClick={() => goMonth(1)} aria-label="Next month"><ChevronRight /></button>
            </>
          ) : (
            <div style={{ flex: 1, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>Next 60 Days</div>
          )}
        </div>
        <div className="m-chips" role="tablist" aria-label="View and filter" style={{ paddingBottom: 10 }}>
          <button type="button" role="tab" className="m-chip" aria-selected={view === 'month'} onClick={() => setView('month')}>Month</button>
          <button type="button" role="tab" className="m-chip" aria-selected={view === 'agenda'} onClick={() => setView('agenda')}>Agenda</button>
          <span style={{ width: 1, background: 'var(--border)', margin: '6px 2px', flex: 'none' }} aria-hidden="true" />
          <button type="button" className="m-chip" aria-pressed={kind === 'all'} onClick={() => setKind('all')}>All</button>
          {KINDS.map((k) => <button key={k.value} type="button" className="m-chip" aria-pressed={kind === k.value} onClick={() => setKind(kind === k.value ? 'all' : k.value)}><span style={{ width: 8, height: 8, borderRadius: '50%', background: k.color }} aria-hidden="true" />{k.label}</button>)}
        </div>
      </div>

      {view === 'month' ? (
        <>
          <div className="m-card" style={{ padding: '8px 6px 10px' }} onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }} onTouchEnd={onTouchEnd}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2 }} aria-hidden="true">
              {DOW.map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--muted)', padding: '4px 0' }}>{d}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 2 }} role="grid" aria-label={`${MONTHS[month.getMonth()]} ${month.getFullYear()}`}>
              {cells.map((d) => {
                const inMonth = d.getMonth() === month.getMonth();
                const evs = byDay[key(d)] || [];
                const isToday = sameDay(d, today), isSel = sameDay(d, selected);
                const colors = [...new Set(evs.map((e) => e.color))].slice(0, 3);
                return (
                  <button key={key(d)} type="button" role="gridcell" onClick={() => setSelected(d)} aria-selected={isSel} aria-label={`${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${evs.length ? `, ${evs.length} event${evs.length === 1 ? '' : 's'}` : ''}`}
                    style={{ height: 50, border: 0, background: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 3, padding: '3px 0 0', cursor: 'pointer', opacity: inMonth ? 1 : 0.38 }}>
                    <span style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: '50%', fontSize: 15, fontWeight: isToday || isSel ? 700 : 500, fontVariantNumeric: 'tabular-nums',
                      background: isToday ? 'var(--accent)' : 'transparent', color: isToday ? '#fff' : 'var(--text)', outline: isSel && !isToday ? '2px solid var(--accent)' : 'none', outlineOffset: -2 }}>{d.getDate()}</span>
                    <span style={{ display: 'flex', gap: 3, height: 6 }} aria-hidden="true">{colors.map((c) => <i key={c} style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <section className="m-section" style={{ marginTop: 18 }} aria-label="Selected day">
            <div className="m-section-head">
              <h2>{selected.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}{dayWord(selected, today) ? ` · ${dayWord(selected, today)}` : ''}</h2>
              <span className="m-count">{dayEvents.length}</span>
            </div>
            <div className="m-card">
              {dayEvents.length === 0 ? <div className="m-empty">Nothing scheduled this day.</div> : dayEvents.map((ev) => <EventRow key={ev.id} ev={ev} onOpen={open} />)}
            </div>
          </section>
        </>
      ) : (
        <>
          {agendaDays.length === 0 && <div className="m-card"><div className="m-empty"><b>Nothing Coming Up</b>No bids, pre-bids or billing dates in the next 60 days.</div></div>}
          {agendaDays.map((d) => (
            <section key={key(d)} className="m-section" style={{ marginTop: 18 }} aria-label={d.toDateString()}>
              <div className="m-section-head">
                <h2 style={{ color: sameDay(d, today) ? 'var(--accent-text)' : undefined }}>{d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}{dayWord(d, today) ? ` · ${dayWord(d, today)}` : ''}</h2>
                <span className="m-count">{byDay[key(d)].length}</span>
              </div>
              <div className="m-card">{byDay[key(d)].map((ev) => <EventRow key={ev.id} ev={ev} onOpen={open} />)}</div>
            </section>
          ))}
        </>
      )}
    </>
  );
}
