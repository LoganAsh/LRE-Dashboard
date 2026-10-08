// Refreshes the page after a new sync has finished (the hourly one, or anyone's manual one),
// but never while you are in the middle of something.
import { useEffect, useRef } from 'react';
import { supabase } from './supabase.js';

export const POLL_MS = 60000;     // how often to ask the database whether a newer sync exists
export const IDLE_MS = 90000;     // how long you must have been hands-off before the page refreshes itself

const EDITABLE = 'input, textarea, select, [contenteditable="true"], [contenteditable=""]';
const OPEN_WINDOW = '[role="dialog"], [aria-modal="true"], [data-open-window]';   // new pop-ups, plus the older-style ones

// True when a refresh now could lose something: a window is open, a field is focused, or you touched the page recently.
export function userIsBusy(lastActivity, now = Date.now()) {
  if (document.querySelector(OPEN_WINDOW)) return true;
  const el = document.activeElement;
  if (el && el !== document.body && el.matches && el.matches(EDITABLE)) return true;
  return now - lastActivity < IDLE_MS;
}

export function useAutoRefresh({ knownSyncAt, enabled = true, onNewSync }) {
  const lastActivity = useRef(Date.now());
  const callback = useRef(onNewSync);
  callback.current = onNewSync;

  // Remember when you last typed, clicked, tapped or scrolled
  useEffect(() => {
    const bump = () => { lastActivity.current = Date.now(); };
    const events = ['keydown', 'pointerdown', 'touchstart', 'wheel', 'input'];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, bump));
  }, []);

  useEffect(() => {
    if (!knownSyncAt || !enabled) return undefined;
    const known = new Date(knownSyncAt).getTime();
    let alive = true;
    const check = async () => {
      const { data, error } = await supabase.from('lre_sync_log').select('synced_at').order('synced_at', { ascending: false }).limit(1);
      if (!alive || error || !data || !data[0]) return;
      const latest = new Date(data[0].synced_at).getTime();
      if (!(latest > known)) return;                       // nothing new
      if (userIsBusy(lastActivity.current)) return;        // newer data exists; try again at the next check
      alive = false;
      callback.current(data[0].synced_at);
    };
    const id = setInterval(check, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [knownSyncAt, enabled]);
}
