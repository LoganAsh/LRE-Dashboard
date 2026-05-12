import { useMemo } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { useBidStats } from './hooks.js';
import { fmt$, CHART_COLORS, CHART_DEFAULTS, YEARS, getChartDefaults, filterByType } from './utils.js';

function yearStats(bids, year) {
  const s = useBidStats(bids, year);
  return s;
}

export default function Trends({ bids, typeFilter, setTypeFilter }) {
  const typedBids = filterByType(bids, typeFilter);
  const stats = YEARS.map(y => {
    const active = typedBids.filter(b => b.year === y && b.bid_amount > 0);
    const won = active.filter(b => (b.effective_status || b.status) === 'Won');
    const margins = active.filter(b => b.margin_pct > 0).map(b => b.margin_pct * 100);
    return {
      year: y,
      totalBids: active.length,
      totalVolume: active.reduce((s, b) => s + (b.bid_amount ?? 0), 0),
      wonCount: won.length,
      wonVolume: won.reduce((s, b) => s + (b.bid_amount ?? 0), 0),
      avgMargin: margins.length ? margins.reduce((a, v) => a + v, 0) / margins.length : 0,
    };
  });

  const barColors = [CHART_COLORS.accent, CHART_COLORS.blue2, CHART_COLORS.won, '#e85c50'];
  const barAlphas = ['rgba(59,111,232,0.7)', 'rgba(107,159,240,0.7)', 'rgba(46,189,126,0.7)', 'rgba(232,92,80,0.7)'];

  const volChart = useMemo(() => ({
    labels: YEARS,
    datasets: [{
      label: 'Total Volume',
      data: stats.map(s => s.totalVolume),
      backgroundColor: barAlphas,
      borderColor: barColors,
      borderWidth: 1, borderRadius: 4,
    }],
  }), [bids]);

  const countChart = useMemo(() => ({
    labels: YEARS,
    datasets: [
      {
        label: 'Total Bids',
        data: stats.map(s => s.totalBids),
        backgroundColor: 'rgba(59,111,232,0.5)',
        borderColor: CHART_COLORS.accent,
        borderWidth: 1, borderRadius: 3,
      },
      {
        label: 'Won',
        data: stats.map(s => s.wonCount),
        backgroundColor: 'rgba(46,189,126,0.6)',
        borderColor: CHART_COLORS.won,
        borderWidth: 1, borderRadius: 3,
      },
    ],
  }), [bids]);

  const marginChart = useMemo(() => ({
    labels: YEARS,
    datasets: [{
      label: 'Avg Margin %',
      data: stats.map(s => s.avgMargin),
      borderColor: CHART_COLORS.blue2,
      backgroundColor: CHART_COLORS.accentLight,
      pointBackgroundColor: CHART_COLORS.blue2,
      pointRadius: 6, fill: true, tension: 0.3,
    }],
  }), [bids]);

  const volOpts = useMemo(() => ({
    ...getChartDefaults(),
    plugins: {
      ...getChartDefaults().plugins,
      tooltip: { ...getChartDefaults().plugins.tooltip, callbacks: { label: ctx => fmt$(ctx.raw) } },
    },
    scales: {
      ...getChartDefaults().scales,
      y: { ...getChartDefaults().scales.y, ticks: { ...getChartDefaults().scales.y.ticks, callback: v => fmt$(v) } },
    },
  }), []);

  const countOpts = useMemo(() => ({
    ...getChartDefaults(),
    plugins: {
      ...getChartDefaults().plugins,
      legend: {
        display: true,
        labels: { color: '#7a8298', font: { family: 'IBM Plex Mono', size: 11 }, boxWidth: 12 },
      },
    },
  }), []);

  const marginOpts = useMemo(() => ({
    ...getChartDefaults(),
    plugins: {
      ...getChartDefaults().plugins,
      tooltip: { ...getChartDefaults().plugins.tooltip, callbacks: { label: ctx => ` ${ctx.raw.toFixed(1)}%` } },
    },
    scales: {
      ...getChartDefaults().scales,
      y: { ...getChartDefaults().scales.y, ticks: { ...getChartDefaults().scales.y.ticks, callback: v => v + '%' } },
    },
  }), []);

  return (
    <div className="page">
      <div className="filter-bar" style={{ marginBottom: 20 }}>
        <span className="filter-label">Type</span>
        {['All', 'Public', 'Private'].map(t => (
          <button key={t} className={`year-btn ${typeFilter === t ? 'active' : ''}`} onClick={() => setTypeFilter(t)}>{t}</button>
        ))}
      </div>
      <div className="chart-grid full" style={{ marginBottom: 14 }}>
        <div className="chart-card">
          <div className="chart-title">Annual Bid Volume <span>total $</span></div>
          <div className="chart-wrap"><Bar data={volChart} options={volOpts} /></div>
        </div>
      </div>
      <div className="chart-grid full" style={{ marginBottom: 14 }}>
        <div className="chart-card">
          <div className="chart-title">Bid Count vs. Won Count <span>by year</span></div>
          <div className="chart-wrap"><Bar data={countChart} options={countOpts} /></div>
        </div>
      </div>
      <div className="chart-grid full">
        <div className="chart-card">
          <div className="chart-title">Average Margin % <span>by year</span></div>
          <div className="chart-wrap"><Line data={marginChart} options={marginOpts} /></div>
        </div>
      </div>
    </div>
  );
}
