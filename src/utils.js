export const fmt$ = (v) => {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

export const fmtFull$ = (v) =>
  '$' + (v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const fmtPct = (v) => `${(v * 100).toFixed(1)}%`;

export const CHART_COLORS = {
  accent: '#3B6FE8',
  accentAlpha: 'rgba(59,111,232,0.55)',
  accentLight: 'rgba(59,111,232,0.1)',
  blue2: '#6b9ff0',
  blue2Alpha: 'rgba(107,159,240,0.5)',
  won: '#2ebd7e',
  wonAlpha: 'rgba(46,189,126,0.7)',
  lost: '#e85c50',
  pending: '#7a8298',
  pendingAlpha: 'rgba(122,130,152,0.4)',
};

// Reads CSS variables so charts respond to light/dark theme
function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function getChartDefaults() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const gridColor  = isLight ? '#d0d4e0' : '#1f2330';
  const tickColor  = isLight ? '#8289a0' : '#525870';
  const tooltipBg  = isLight ? '#ffffff' : '#1c2030';
  const tooltipBdr = isLight ? '#d0d4e0' : '#252a3a';
  const tooltipTitle = isLight ? '#1a1d2e' : '#dde1ed';
  const tooltipBody  = isLight ? '#6b7494' : '#7a8298';
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
        titleFont: { family: 'IBM Plex Mono' },
        bodyFont: { family: 'IBM Plex Mono' },
      },
    },
    scales: {
      x: {
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: tickColor, font: { family: 'IBM Plex Mono', size: 10 } },
      },
      y: {
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: tickColor, font: { family: 'IBM Plex Mono', size: 10 } },
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
      backgroundColor: '#1c2030',
      borderColor: '#252a3a',
      borderWidth: 1,
      titleColor: '#dde1ed',
      bodyColor: '#7a8298',
      titleFont: { family: 'IBM Plex Mono' },
      bodyFont: { family: 'IBM Plex Mono' },
    },
  },
  scales: {
    x: {
      grid: { color: '#1f2330', drawBorder: false },
      ticks: { color: '#525870', font: { family: 'IBM Plex Mono', size: 10 } },
    },
    y: {
      grid: { color: '#1f2330', drawBorder: false },
      ticks: { color: '#525870', font: { family: 'IBM Plex Mono', size: 10 } },
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
  return names.some(n => /city/i.test(n));
}

export function filterByType(bids, type) {
  if (type === 'Public')  return bids.filter(b => isPublicBid(b));
  if (type === 'Private') return bids.filter(b => !isPublicBid(b));
  return bids;
}
