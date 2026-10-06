"use client";

/**
 * Adapted from 21st.dev "Event Manager" (vaib215). Kept: month / week / day / list views,
 * search + filter, hover detail cards. Changed for a read-only bid calendar: no create / edit /
 * delete / drag-and-drop, "no time" lane for events without a time, no shadcn dependencies.
 */

import * as React from "react";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalView = "month" | "week" | "day" | "list";

export interface CalEvent {
  id: string;
  ref?: number | string;
  title: string;
  kind: string;
  kindLabel: string;
  start: Date;
  hasTime: boolean;
  color: string;
  details: string[];
  priority?: boolean;
}

export interface CalKind {
  value: string;
  label: string;
  color: string;
}

export interface EventCalendarProps {
  events: CalEvent[];
  kinds: CalKind[];
  legend?: { label: string; color: string }[];
  onEventClick?: (event: CalEvent) => void;
  defaultView?: CalView;
  className?: string;
}

/* ─── helpers ───────────────────────────────────────────────── */

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
};
const startOfWeek = (d: Date) => addDays(d, -d.getDay());
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const shortTime = (d: Date) =>
  d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(":00", "").replace(" ", "").toLowerCase();
const longTime = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const hourLabel = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`;
const byStart = (a: CalEvent, b: CalEvent) => a.start.getTime() - b.start.getTime();
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

// Browsers draw a gray fill + bevel on bare <button>s, and the global reset is intentionally not
// loaded, so every button here sets its own look.
const plainBtn = "appearance-none border-0 bg-transparent [font-family:inherit] cursor-pointer";
const outlineBtn = cn(
  "appearance-none border border-[color:var(--border)] bg-transparent [font-family:inherit] cursor-pointer",
  "text-[var(--foreground)] transition-colors hover:border-[color-mix(in_srgb,var(--foreground)_28%,transparent)]"
);

/* ─── event chip with hover card ────────────────────────────── */

function EventChip({
  event,
  onClick,
  alignRight = false,
  showTime = true,
}: {
  event: CalEvent;
  onClick?: (e: CalEvent) => void;
  alignRight?: boolean;
  showTime?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        type="button"
        onClick={() => onClick?.(event)}
        className={cn(
          plainBtn,
          "flex w-full items-center gap-1.5 rounded-md px-1.5 py-[3px] text-left text-[11px] font-medium leading-tight text-[var(--foreground)] transition-colors"
        )}
        style={{ background: `color-mix(in srgb, ${event.color} ${hover ? 22 : 13}%, transparent)` }}
      >
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: event.color }} />
        {event.priority && <span className="shrink-0 text-[#d99a06]">★</span>}
        {showTime && event.hasTime && (
          <span className="shrink-0 tabular-nums text-[var(--muted-foreground)]">{shortTime(event.start)}</span>
        )}
        <span className="truncate">{event.title}</span>
      </button>
      {hover && (
        <div
          className={cn(
            "absolute top-full z-50 mt-1 w-64 rounded-xl border border-[color:var(--border)] bg-[var(--card)] p-3",
            "[box-shadow:0_8px_24px_-12px_rgba(20,16,8,0.3)]",
            alignRight ? "right-0" : "left-0"
          )}
        >
          <div className="text-[13px] font-semibold leading-snug text-[var(--foreground)]">{event.title}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
            <span className="size-2 rounded-full" style={{ background: event.color }} />
            {event.kindLabel}
          </div>
          <div className="mt-2 space-y-1">
            {event.details.map((d, i) => (
              <div key={i} className="text-xs leading-snug text-[var(--text-secondary)]">{d}</div>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-[var(--muted-foreground)]">
            {event.start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            {" · "}
            {event.hasTime ? longTime(event.start) : "no time set"}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── month view ────────────────────────────────────────────── */

function MonthView({
  date, events, onEventClick, onDayClick,
}: { date: Date; events: CalEvent[]; onEventClick?: (e: CalEvent) => void; onDayClick: (d: Date) => void }) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = addDays(first, -first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = new Date();
  const forDay = (d: Date) => events.filter((e) => sameDay(e.start, d)).sort(byStart);

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[var(--card)]">
      <div className="grid grid-cols-7 border-b border-[color:var(--border)]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="p-2 text-center text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d.charAt(0)}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const evs = forDay(day);
          const inMonth = day.getMonth() === date.getMonth();
          const isToday = sameDay(day, today);
          return (
            <div
              key={i}
              className={cn(
                "min-h-[92px] border-b border-r border-[color:var(--border)] p-1.5 sm:min-h-[112px]",
                "[&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0",
                !inMonth && "opacity-45"
              )}
            >
              <div
                className={cn(
                  "mb-1 flex size-6 items-center justify-center rounded-full text-xs",
                  isToday ? "bg-[#c2540a] font-semibold text-white" : "text-[var(--text-secondary)]"
                )}
              >
                {day.getDate()}
              </div>
              <div className="space-y-1">
                {evs.slice(0, 3).map((e) => (
                  <EventChip key={e.id} event={e} onClick={onEventClick} alignRight={i % 7 >= 4} />
                ))}
                {evs.length > 3 && (
                  <button
                    type="button"
                    onClick={() => onDayClick(day)}
                    className={cn(plainBtn, "px-1 text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]")}
                  >
                    +{evs.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── week + day views (shared grid) ────────────────────────── */

function TimeGrid({
  days, events, onEventClick, labelWidth,
}: { days: Date[]; events: CalEvent[]; onEventClick?: (e: CalEvent) => void; labelWidth: number }) {
  const today = new Date();
  const inRange = events.filter((e) => days.some((d) => sameDay(d, e.start)));
  const timed = inRange.filter((e) => e.hasTime);
  const untimed = inRange.filter((e) => !e.hasTime);
  const minH = Math.min(7, ...timed.map((e) => e.start.getHours()));
  const maxH = Math.max(18, ...timed.map((e) => e.start.getHours()));
  const hours = range(minH, maxH);
  const cols = `${labelWidth}px repeat(${days.length}, minmax(0, 1fr))`;
  const cell = "border-b border-r border-[color:var(--border)] p-1 last:border-r-0";

  return (
    <div className="overflow-x-auto rounded-xl border border-[color:var(--border)] bg-[var(--card)]">
      <div className="min-w-[640px]">
        <div className="grid border-b border-[color:var(--border)]" style={{ gridTemplateColumns: cols }}>
          <div className="border-r border-[color:var(--border)]" />
          {days.map((d) => {
            const isToday = sameDay(d, today);
            return (
              <div key={d.toISOString()} className="border-r border-[color:var(--border)] p-2 text-center last:border-r-0">
                <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                  {d.toLocaleDateString("en-US", { weekday: "short" })}
                </div>
                <div
                  className={cn(
                    "mx-auto mt-0.5 flex size-6 items-center justify-center rounded-full text-xs",
                    isToday ? "bg-[#c2540a] font-semibold text-white" : "text-[var(--text-secondary)]"
                  )}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {untimed.length > 0 && (
          <div className="grid" style={{ gridTemplateColumns: cols }}>
            <div className="border-b border-r border-[color:var(--border)] p-2 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
              No time
            </div>
            {days.map((d) => (
              <div key={d.toISOString()} className={cn(cell, "space-y-1")}>
                {untimed.filter((e) => sameDay(e.start, d)).map((e) => (
                  <EventChip key={e.id} event={e} onClick={onEventClick} showTime={false} />
                ))}
              </div>
            ))}
          </div>
        )}

        {hours.map((h) => (
          <div key={h} className="grid" style={{ gridTemplateColumns: cols }}>
            <div className="border-b border-r border-[color:var(--border)] p-1.5 text-right text-[10px] tabular-nums text-[var(--muted-foreground)]">
              {hourLabel(h)}
            </div>
            {days.map((d, di) => (
              <div key={d.toISOString()} className={cn(cell, "min-h-[44px] space-y-1")}>
                {timed
                  .filter((e) => sameDay(e.start, d) && e.start.getHours() === h)
                  .sort(byStart)
                  .map((e) => (
                    <EventChip key={e.id} event={e} onClick={onEventClick} alignRight={days.length > 1 && di >= days.length - 2} />
                  ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── list view ─────────────────────────────────────────────── */

function ListView({ events, onEventClick }: { events: CalEvent[]; onEventClick?: (e: CalEvent) => void }) {
  const sorted = [...events].sort(byStart);
  const groups = sorted.reduce((acc, e) => {
    const key = e.start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    (acc[key] = acc[key] || []).push(e);
    return acc;
  }, {} as Record<string, CalEvent[]>);
  const today = startOfDay(new Date());

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-[color:var(--border)] bg-[var(--card)] py-14 text-center text-sm text-[var(--muted-foreground)]">
        No bids or pre-bids match.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[var(--card)] p-4">
      <div className="space-y-6">
        {Object.entries(groups).map(([label, evs]) => (
          <div key={label}>
            <h3
              className={cn(
                "mb-2 text-xs font-semibold",
                evs[0].start < today ? "text-[var(--muted-foreground)]" : "text-[var(--text-secondary)]"
              )}
            >
              {label}
            </h3>
            <div className="divide-y divide-[color:var(--border)]">
              {evs.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onEventClick?.(e)}
                  className={cn(plainBtn, "group flex w-full items-start gap-3 py-2.5 text-left")}
                >
                  <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: e.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      {e.priority && <span className="text-[#d99a06]">★</span>}
                      <span className="truncate text-[13.5px] font-semibold text-[var(--foreground)] group-hover:text-[#c2540a]">
                        {e.title}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                      {e.kindLabel}
                      {e.hasTime ? ` · ${longTime(e.start)}` : ""}
                      {e.details.length ? ` · ${e.details.join(" · ")}` : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── underline tabs ────────────────────────────────────────── */

function Tabs<T extends string>({
  value, onChange, items, label,
}: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex items-center gap-4">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cn(
              plainBtn,
              "border-b-2 pb-1.5 pt-1 text-[13px] transition-colors",
              active
                ? "border-[#ea580c] font-semibold text-[var(--foreground)]"
                : "border-transparent font-medium text-[#6f6a64] hover:text-[var(--foreground)] dark:text-[#a8a29e]"
            )}
            style={{ borderBottomStyle: "solid" }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── main component ────────────────────────────────────────── */

export function EventCalendar({ events, kinds, legend, onEventClick, defaultView = "month", className }: EventCalendarProps) {
  const [view, setView] = useState<CalView>(defaultView);
  const [date, setDate] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter(
      (e) =>
        (kindFilter === "all" || e.kind === kindFilter) &&
        (!q || `${e.title} ${e.details.join(" ")}`.toLowerCase().includes(q))
    );
  }, [events, query, kindFilter]);

  const navigate = (dir: -1 | 1) =>
    setDate((prev) => {
      const d = new Date(prev);
      if (view === "month") {
        d.setDate(1);
        d.setMonth(d.getMonth() + dir);
      } else if (view === "week") d.setDate(d.getDate() + 7 * dir);
      else d.setDate(d.getDate() + dir);
      return d;
    });

  const title =
    view === "month"
      ? date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : view === "week"
        ? `Week of ${startOfWeek(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
        : view === "day"
          ? date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
          : "All upcoming";

  const openDay = (d: Date) => {
    setDate(d);
    setView("day");
  };

  const kindTabs = [
    { value: "all", label: `All (${events.length})` },
    ...kinds.map((k) => ({ value: k.value, label: `${k.label} (${events.filter((e) => e.kind === k.value).length})` })),
  ];

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">{title}</h2>
          {view !== "list" && (
            <div className="flex items-center gap-1.5">
              <button type="button" aria-label="Previous" onClick={() => navigate(-1)}
                className={cn(outlineBtn, "flex size-8 items-center justify-center rounded-lg")}>
                <ChevronLeft className="size-4" strokeWidth={1.75} />
              </button>
              <button type="button" onClick={() => setDate(new Date())}
                className={cn(outlineBtn, "h-8 rounded-lg px-3 text-[13px] font-medium")}>
                Today
              </button>
              <button type="button" aria-label="Next" onClick={() => navigate(1)}
                className={cn(outlineBtn, "flex size-8 items-center justify-center rounded-lg")}>
                <ChevronRight className="size-4" strokeWidth={1.75} />
              </button>
            </div>
          )}
        </div>
        <Tabs<CalView>
          label="Calendar view"
          value={view}
          onChange={setView}
          items={[
            { value: "month", label: "Month" },
            { value: "week", label: "Week" },
            { value: "day", label: "Day" },
            { value: "list", label: "List" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" strokeWidth={1.75} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bids or clients…"
            className={cn(
              "h-9 w-full appearance-none rounded-lg border border-[color:var(--border)] bg-[var(--card)] pl-9 pr-8 text-[13px]",
              "text-[var(--foreground)] outline-none [font-family:inherit] placeholder:text-[var(--muted-foreground)]",
              "focus:border-[#ea580c]"
            )}
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery("")}
              className={cn(plainBtn, "absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)]")}>
              <X className="size-3.5" strokeWidth={1.75} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Tabs label="Filter by type" value={kindFilter} onChange={setKindFilter} items={kindTabs} />
        </div>
      </div>

      {legend && legend.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--muted-foreground)]">
          {legend.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5"><span className="text-[#d99a06]">★</span>High priority</span>
        </div>
      )}

      {view === "month" && <MonthView date={date} events={filtered} onEventClick={onEventClick} onDayClick={openDay} />}
      {view === "week" && (
        <TimeGrid
          days={Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(date), i))}
          events={filtered}
          onEventClick={onEventClick}
          labelWidth={56}
        />
      )}
      {view === "day" && <TimeGrid days={[startOfDay(date)]} events={filtered} onEventClick={onEventClick} labelWidth={72} />}
      {view === "list" && <ListView events={filtered} onEventClick={onEventClick} />}
    </div>
  );
}
