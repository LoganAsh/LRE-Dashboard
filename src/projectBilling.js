// Monthly billing dates for projects. A project with a billing_day gets one billing date every month,
// from when it starts until it is marked Complete.
import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { dateOf } from './dates.js';

export const LAST_DAY = 31;     // billing_day 31 means "last day of the month"

// A billing date for display: "Oct 25, 2026"
export const fmtBillingDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// 1 -> "1st", 22 -> "22nd", 11 -> "11th"
export function ordinal(n) {
  const v = n % 100;
  const suffix = ['th', 'st', 'nd', 'rd'];
  return n + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
}

export function billingLabel(day) {
  if (!day) return '';
  return day >= LAST_DAY ? 'Last Day of Each Month' : `The ${ordinal(day)} of Each Month`;
}

// The billing date in a given month. Months with fewer days than the billing day use their last day.
export function billingDateIn(year, monthIndex, day) {
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDayOfMonth));
}

// Billing starts when the project starts (or, if no start date is set, when it was created).
function billingStart(project) {
  if (project.start_date) return dateOf(project.start_date);
  if (project.created_at) {
    const c = new Date(project.created_at);
    return new Date(c.getFullYear(), c.getMonth(), c.getDate());
  }
  return null;
}

// Every billing date between `from` and `to` (inclusive).
//  - never before the project's start
//  - while the project is not Complete: every month
//  - once Complete: only up to its actual completion date (none if that date isn't set)
export function billingDates(project, from, to) {
  const day = project.billing_day;
  if (!day) return [];
  const start = billingStart(project);
  if (!start) return [];
  let end = to;
  if (project.status === 'Complete') {
    if (!project.actual_completion_date) return [];
    const done = dateOf(project.actual_completion_date);
    if (done < end) end = done;
  }
  const lowest = start > from ? start : from;
  const out = [];
  let y = lowest.getFullYear(), m = lowest.getMonth();
  for (let i = 0; i < 1200; i++) {                       // safety limit: 100 years
    const d = billingDateIn(y, m, day);
    if (d > end) break;
    if (d >= lowest) out.push(d);
    m += 1;
    if (m > 11) { m = 0; y += 1; }
  }
  return out;
}

// The next billing date on or after `today`, or null if there isn't one (not set, or the project is Complete).
export function nextBillingDate(project, today) {
  if (!project.billing_day || project.status === 'Complete') return null;
  const horizon = new Date(today.getFullYear() + 2, today.getMonth(), today.getDate());
  return billingDates(project, today, horizon)[0] || null;
}

export function useBillingProjects() {
  const [projects, setProjects] = useState([]);
  useEffect(() => {
    let alive = true;
    supabase.from('lre_projects')
      .select('id,name,client,status,billing_day,start_date,actual_completion_date,created_at')
      .not('billing_day', 'is', null)
      .then(({ data }) => { if (alive && data) setProjects(data); });
    return () => { alive = false; };
  }, []);
  return { projects };
}
