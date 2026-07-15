export const fmt$ = (v) => {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

export const fmtFull$ = (v) =>
  '$' + (v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const fmtPct = (v) => `${(v * 100).toFixed(1)}%`;

export const CHART_COLORS = {
  accent: '#f97316',
  accentAlpha: 'rgba(249,115,22,0.55)',
  accentLight: 'rgba(249,115,22,0.1)',
  blue2: '#fb923c',
  blue2Alpha: 'rgba(251,146,60,0.5)',
  won: '#16a34a',
  wonAlpha: 'rgba(22,163,74,0.7)',
  lost: '#dc2626',
  pending: '#8a8580',
  pendingAlpha: 'rgba(138,133,128,0.4)',
};

// Reads CSS variables so charts respond to light/dark theme
function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function getChartDefaults() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor  = isDark ? '#332e29' : '#ece7e0';
  const tickColor  = isDark ? '#8a8580' : '#8a8580';
  const tooltipBg  = isDark ? '#1e1b17' : '#ffffff';
  const tooltipBdr = isDark ? '#332e29' : '#ece7e0';
  const tooltipTitle = isDark ? '#f5f3f0' : '#1a1a1a';
  const tooltipBody  = isDark ? '#c4bfb8' : '#57534e';
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: tooltipBg,
        borderColor: tooltipBdr,
        borderWidth: 1,
        titleColor: tooltipTitle,
        bodyColor: tooltipBody,
        titleFont: { family: 'Inter' },
        bodyFont: { family: 'Inter' },
      },
    },
    scales: {
      x: {
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: tickColor, font: { family: 'Inter', size: 11 } },
      },
      y: {
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: tickColor, font: { family: 'Inter', size: 11 } },
      },
    },
  };
}

// Static fallback for places that don't need reactivity
export const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#ffffff',
      borderColor: '#ece7e0',
      borderWidth: 1,
      titleColor: '#1a1a1a',
      bodyColor: '#57534e',
      titleFont: { family: 'Inter' },
      bodyFont: { family: 'Inter' },
    },
  },
  scales: {
    x: {
      grid: { color: '#ece7e0', drawBorder: false },
      ticks: { color: '#8a8580', font: { family: 'Inter', size: 11 } },
    },
    y: {
      grid: { color: '#ece7e0', drawBorder: false },
      ticks: { color: '#8a8580', font: { family: 'Inter', size: 11 } },
    },
  },
};

export const classifyStatus = (status) => {
  switch (status) {
    case 'Won':                return 'pill-won';
    case 'Lost':               return 'pill-lost';
    case 'No Bid':             return 'pill-nobid';
    case 'Upcoming':           return 'pill-upcoming';
    case 'Client Not Awarded': return 'pill-cna';
    case 'Project Re-Bid':     return 'pill-rebid';
    default:                   return 'pill-pending';
  }
};

export const YEARS = ['2023', '2024', '2025', '2026'];

// A bid is Public if any parsed client name contains 'City'
export function isPublicBid(bid) {
  const names = (bid.clients && bid.clients.length > 0)
    ? bid.clients
    : (bid.client || '').split(/[,\/;]+/).map(s => s.replace(/^Sub-/i, '').trim());
  return names.some(n => /city/i.test(n) || /^udot$/i.test(n.trim()));
}

export function filterByType(bids, type) {
  if (type === 'Public')  return bids.filter(b => isPublicBid(b));
  if (type === 'Private') return bids.filter(b => !isPublicBid(b));
  return bids;
}
