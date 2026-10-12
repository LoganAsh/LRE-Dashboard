// Refreshes the page after a new sync has finished (the hourly one, or anyone's manual one),
// but never while you are in the middle of something.
import { useEffect, useRef } from 'react';
import { supabase } from './supabase.js';

export const POLL_MS = 60000;        // how often to ask the database whether a newer sync exists
export const IDLE_MS = 90000;        // how long you must have been hands-off before the page refreshes itself
export const ABANDONED_MS = 600000;  // a half-typed entry left alone this long is treated as abandoned

const EDITABLE = 'input, textarea, select, [contenteditable="true"], [contenteditable=""]';
const OPEN_WINDOW = '[role="dialog"], [aria-modal="true"], [data-open-window]';   // new pop-ups, plus the older-style ones
const NOT_TEXT = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image']);

// A field that has the cursor AND has something typed in it. An empty field, a dropdown, or a checkbox
// that merely kept the cursor from earlier is not "unfinished work".
function hasUnfinishedEntry(el) {
  if (!el || el === document.body || !el.matches || !el.matches(EDITABLE)) return false;
  if (el.tagName === 'SELECT') return false;
  if (el.tagName === 'INPUT' && NOT_TEXT.has(el.type)) return false;
  const text = el.isContentEditable ? el.textContent : el.value;
  return !!(text && String(text).trim());
}

// True when a refresh now could lose something: a window is open, you touched the page recently,
// or you left something half-typed (until it has been sitting for 10 minutes).
export function userIsBusy(lastActivity, now = Date.now()) {
  if (document.querySelector(OPEN_WINDOW)) return true;
  const idleFor = now - lastActivity;
  if (idleFor < IDLE_MS) return true;
  if (idleFor < ABANDONED_MS && hasUnfinishedEntry(document.activeElement)) return true;
  return false;
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
    let inFlight = false;
    const check = async () => {
      if (!alive || inFlight) return;
      inFlight = true;
      try {
        const { data, error } = await supabase.from('lre_sync_log').select('synced_at').order('synced_at', { ascending: false }).limit(1);
        if (!alive || error || !data || !data[0]) return;
        const latest = new Date(data[0].synced_at).getTime();
        if (!(latest > known)) return;                       // nothing new
        if (userIsBusy(lastActivity.current)) return;        // newer data exists; try again at the next check
        alive = false;
        callback.current(data[0].synced_at);
      } finally {
        inFlight = false;
      }
    };

    // A minimized or sleeping browser slows a page's timers way down (or stops them), so a timer alone is not enough:
    // also check the moment you come back to the page or the connection returns.
    const wake = () => { if (document.visibilityState === 'visible') check(); };
    const id = setInterval(check, POLL_MS);
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('pageshow', wake);
    window.addEventListener('online', check);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('pageshow', wake);
      window.removeEventListener('online', check);
    };
  }, [knownSyncAt, enabled]);
}
