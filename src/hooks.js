import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase.js';

export function useBids() {
  const [bids, setBids] = useState([]);
  const [syncLog, setSyncLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBids = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all bids
      const { data, error: err } = await supabase
        .from('lre_bids_view')
        .select('*')
        .order('bid_date', { ascending: false });
      if (err) throw err;
      setBids(data ?? []);

      // Fetch last sync log entry
      const { data: log } = await supabase
        .from('lre_sync_log')
        .select('*')
        .order('synced_at', { ascending: false })
        .limit(1);
      setSyncLog(log?.[0] ?? null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBids();
  }, [fetchBids]);

  return { bids, syncLog, loading, error, refetch: fetchBids };
}

// Derived stats from bids array
export function useBidStats(bids, yearFilter) {
  const filtered = yearFilter === 'all' ? bids : bids.filter(b => b.year === yearFilter);
  const active = filtered.filter(b => b.bid_amount > 0);
  const won = active.filter(b => b.status === 'Won');
  const lost = active.filter(b => b.status === 'Lost');
  const pending = active.filter(b => b.status === 'Pending');

  const totalVolume = active.reduce((s, b) => s + (b.bid_amount ?? 0), 0);
  const wonVolume = won.reduce((s, b) => s + (b.bid_amount ?? 0), 0);
  const totalMargin = active.reduce((s, b) => s + (b.margin_dollar ?? 0), 0);
  const margins = active.filter(b => b.margin_pct > 0).map(b => b.margin_pct);
  const avgMargin = margins.length ? margins.reduce((s, v) => s + v, 0) / margins.length : 0;
  const winRate = active.length ? (won.length / active.length) * 100 : 0;

  return {
    filtered, active, won, lost, pending,
    totalVolume, wonVolume, totalMargin, avgMargin, winRate,
  };
}

// Monthly aggregation
export function useMonthlyData(bids, yearFilter) {
  const filtered = (yearFilter === 'all' ? bids : bids.filter(b => b.year === yearFilter))
    .filter(b => b.bid_amount > 0 && b.bid_date);

  const monthMap = {};
  filtered.forEach(b => {
    const month = b.bid_date.slice(0, 7); // YYYY-MM
    if (!monthMap[month]) monthMap[month] = { month, volume: 0, count: 0 };
    monthMap[month].volume += b.bid_amount ?? 0;
    monthMap[month].count += 1;
  });

  return Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));
}

// Top clients
export function useTopClients(bids, n = 10) {
  const active = bids.filter(b => b.bid_amount > 0 && b.client);
  const clientMap = {};
  active.forEach(b => {
    // Use pre-parsed clients array from DB, or fall back to parsing client string
    const names = (b.clients && b.clients.length > 0)
      ? b.clients
      : parseClients(b.client || '');
    if (names.length === 0) return;
    names.forEach(name => {
      const key = name.trim();
      if (!key) return;
      if (!clientMap[key]) clientMap[key] = { name: key, total: 0, count: 0 };
      // Divide bid amount equally across co-clients
      clientMap[key].total += b.bid_amount ?? 0;
      clientMap[key].count += 1;
    });
  });
  return Object.values(clientMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}

// Parse a raw client string into individual client names
export function parseClients(raw) {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(/[,\/;]+/)
    .map(s => s.replace(/^Sub-/i, '').trim())
    .filter(s => s.length > 0 && s.toLowerCase() !== 'nan');
}
