// Is someone using the dedicated Bid2Win computer through Chrome Remote Desktop?
// A small program on that computer reports in (see tools/bid2win-status); the database works out the ages,
// and this file turns them into what the dashboard says.
import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

export const POLL_MS = 20000;          // how often the dashboard asks
export const OFFLINE_AFTER_S = 150;    // the computer reports every 30 s, so 2.5 minutes of silence means it is offline
export const UNAVAILABLE_AFTER_S = 120; // the dashboard could not reach the database for this long

// "Just Now", "5 Min", "1 Hr 12 Min", "2 Days"
export function fmtDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return 'Just Now';
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} Min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} Hr${min % 60 ? ` ${min % 60} Min` : ''}`;
  const days = Math.floor(hr / 24);
  return `${days} ${days === 1 ? 'Day' : 'Days'}`;
}
const ago = (s) => (s < 60 ? 'Just Now' : `${fmtDuration(s)} Ago`);

// What to show. `fetchedAt` is when the dashboard last heard from the database; the ages in `row` were true at that moment,
// so we add the time since then and the numbers keep moving between checks.
export function describeRemoteStatus({ row, fetchedAt, loading, error }, now = Date.now()) {
  if (loading && !row && !error) return { tone: 'loading', on: false, label: 'Checking…', detail: '' };
  if (!row) {
    if (error) return { tone: 'unavailable', on: false, label: 'Status Unavailable', detail: "Couldn't Check Right Now" };
    return { tone: 'unset', on: false, label: 'Not Set Up Yet', detail: 'Waiting for the Bid2Win Computer to Report In' };
  }
  const since = fetchedAt ? Math.max(0, (now - fetchedAt) / 1000) : 0;
  if (error && since > UNAVAILABLE_AFTER_S) return { tone: 'unavailable', on: false, label: 'Status Unavailable', detail: "Couldn't Check Right Now" };

  const heartbeat = (row.heartbeat_age_s ?? 0) + since;
  if (heartbeat > OFFLINE_AFTER_S) {
    return { tone: 'offline', on: false, label: 'Computer Offline', detail: `Last Heard From It ${ago(heartbeat)} · Can't Tell if Anyone Is on It` };
  }
  const inState = (row.state_age_s ?? 0) + since;
  if (row.connected) {
    const idle = row.idle_s == null ? null : row.idle_s + since;
    const parts = [`Connected for ${fmtDuration(inState)}`];
    if (idle != null) parts.push(idle < 60 ? 'Active Now' : `Last Activity ${ago(idle)}`);
    return { tone: 'inuse', on: true, label: 'In Use', detail: parts.join(' · ') };
  }
  return { tone: 'available', on: false, label: 'Available', detail: `Nobody Is Connected · Free for ${fmtDuration(inState)}` };
}

export function useRemoteStatus(pollMs = POLL_MS) {
  const [state, setState] = useState({ row: null, fetchedAt: null, loading: true, error: null });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase.from('lre_remote_status_view').select('*').limit(1);
      if (!alive) return;
      if (error) setState((s) => ({ ...s, loading: false, error: error.message }));          // keep showing what we had
      else setState({ row: data && data[0] ? data[0] : null, fetchedAt: Date.now(), loading: false, error: null });
    };
    load();
    const id = setInterval(load, pollMs);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [pollMs]);
  return state;
}
