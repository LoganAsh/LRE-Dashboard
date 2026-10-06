// Client calculations, shared by the client grid and the client detail window.
// These are the same rules the old Clients tab used, kept in one place.
import { parseClients } from './hooks.js';

export const clientKey = (name) => String(name || '').trim().toLowerCase();

export const namesOnBid = (b) => (b.clients && b.clients.length > 0) ? b.clients : parseClients(b.client || '');

export function getAllClientNames(bids) {
  const set = new Set();
  bids.forEach((b) => namesOnBid(b).forEach((n) => { if (n.trim()) set.add(n.trim()); }));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function bidsForClient(bids, clientName) {
  return bids.filter((b) => namesOnBid(b).some((n) => n.trim().toLowerCase() === clientName.toLowerCase()));
}

// Only credit awarded volume to THIS client if awarded_by matches (or is unset and this is the only bidder)
export function awardedVolumeFor(won, clientName) {
  return won.reduce((s, b) => {
    if (b.awarded_by) {
      return b.awarded_by.trim().toLowerCase() === clientName.toLowerCase() ? s + (b.award_amount || b.bid_amount || 0) : s;
    }
    return namesOnBid(b).length === 1 ? s + (b.award_amount || b.bid_amount || 0) : s;
  }, 0);
}

const statusOf = (b) => b.effective_status || b.status;

export function buildClientRows(bids) {
  return getAllClientNames(bids).map((name) => {
    const clientBids = bidsForClient(bids, name).filter((b) => b.bid_amount > 0);
    const won = clientBids.filter((b) => statusOf(b) === 'Won');
    const totalVolume = clientBids.reduce((s, b) => s + (b.bid_amount || 0), 0);
    const awardedVolume = awardedVolumeFor(won, name);
    const winRate = clientBids.length ? (won.length / clientBids.length * 100) : 0;
    const lastBidDate = clientBids.reduce((max, b) => (b.bid_date || '') > max ? b.bid_date : max, '');
    return { name, bidCount: clientBids.length, wonCount: won.length, totalVolume, awardedVolume, winRate, lastBidDate };
  }).filter((c) => c.bidCount > 0);
}

export function sortClientRows(rows, sortKey) {
  return [...rows].sort((a, b) => {
    if (sortKey === 'volume') return b.totalVolume - a.totalVolume;
    if (sortKey === 'awarded') return b.awardedVolume - a.awardedVolume;
    if (sortKey === 'count') return b.bidCount - a.bidCount;
    if (sortKey === 'winrate') return b.winRate - a.winRate;
    if (sortKey === 'recent') return (b.lastBidDate || '').localeCompare(a.lastBidDate || '');
    return 0;
  });
}

export function clientDetailStats(clientBids, clientName) {
  const won = clientBids.filter((b) => statusOf(b) === 'Won');
  const lost = clientBids.filter((b) => statusOf(b) === 'Lost');
  const pending = clientBids.filter((b) => ['Pending', 'Upcoming'].includes(statusOf(b)));
  const totalVolume = clientBids.reduce((s, b) => s + (b.bid_amount || 0), 0);
  const awardedVolume = awardedVolumeFor(won, clientName);
  const winRate = clientBids.length ? (won.length / clientBids.length * 100) : 0;
  const margins = clientBids.filter((b) => b.margin_pct > 0).map((b) => b.margin_pct * 100);
  const avgMargin = margins.length ? margins.reduce((a, v) => a + v, 0) / margins.length : 0;
  return { won, lost, pending, totalVolume, awardedVolume, winRate, avgMargin };
}

export function matchProjects(allProjects, clientName) {
  return (allProjects || []).filter((p) => {
    const clientMatch = (p.client || '').toLowerCase().includes(clientName.toLowerCase());
    const awardedMatch = (p.awarded_by || '').toLowerCase() === clientName.toLowerCase();
    return clientMatch || awardedMatch;
  });
}

export function projectStats(projects) {
  const totalContract = projects.reduce((s, p) => s + (p.original_contract || 0) + (p.approved_cos || 0), 0);
  const totalActual = projects.reduce((s, p) => s + (p.actual_cost || 0), 0);
  const active = projects.filter((p) => ['Mobilizing', 'Active', 'Punch List'].includes(p.status));
  const complete = projects.filter((p) => p.status === 'Complete');
  return { totalContract, totalActual, active, complete };
}

export function initialsOf(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
