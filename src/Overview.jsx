import { useMemo } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, ArcElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { useBidStats, useMonthlyData } from './hooks.js';
import { fmt$, fmtFull$, CHART_COLORS, CHART_DEFAULTS, YEARS, getChartDefaults } from './utils.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);

function KPI({ label, value, sub, accent }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${accent || ''}`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export default function Overview({ bids, yearFilter, setYearFilter }) {
  const stats = useBidStats(bids, yearFilter);
  const monthly = useMonthlyData(bids, yearFilter);

  const volumeChart = useMemo(() => ({
    labels: monthly.map(m => m.month.slice(5)),
    datasets: [{
      data: monthly.map(m => m.volume),
      backgroundColor: CHART_COLORS.accentAlpha,
      borderColor: CHART_COLORS.accent,
      borderWidth: 1,
      borderRadius: 3,
    }],
  }), [monthly]);

  const countChart = useMemo(() => ({
    labels: monthly.map(m => m.month.slice(5)),
    datasets: [{
      data: monthly.map(m => m.count),
      borderColor: CHART_COLORS.blue2,
      backgroundColor: CHART_COLORS.accentLight,
      pointBackgroundColor: CHART_COLORS.blue2,
      pointRadius: 4,
      fill: true,
      tension: 0.35,
    }],
  }), [monthly]);

  const donutChart = useMemo(() => ({
    labels: ['Won', 'Lost', 'Pending', 'Client Not Awarded', 'Project Re-Bid'],
    datasets: [{
      data: [
        stats.won.length,
        stats.lost.length,
        stats.pending.length,
        stats.active.filter(b => (b.effective_status||b.status) === 'Client Not Awarded').length,
        stats.active.filter(b => (b.effective_status||b.status) === 'Project Re-Bid').length,
      ],
      backgroundColor: [CHART_COLORS.wonAlpha, 'rgba(232,92,80,0.75)', CHART_COLORS.pendingAlpha, 'rgba(249,115,22,0.7)', 'rgba(232,197,71,0.7)'],
      borderWidth: 0,
      hoverOffset: 6,
    }],
  }), [stats]);

  const marginBins = useMemo(() => {
    const bins = [0, 5, 10, 12, 14, 16, 18, 20, 22, 25, 30];
    const counts = Array(bins.length - 1).fill(0);
    stats.active.filter(b => b.margin_pct > 0).forEach(b => {
      const pct = b.margin_pct * 100;
      for (let i = 0; i < bins.length - 1; i++) {
        if (pct >= bins[i] && pct < bins[i + 1]) { counts[i]++; break; }
      }
    });
    return {
      labels: bins.slice(0, -1).map((b, i) => `${b}–${bins[i + 1]}%`),
      datasets: [{
        data: counts,
        backgroundColor: CHART_COLORS.blue2Alpha,
        borderColor: CHART_COLORS.blue2,
        borderWidth: 1,
        borderRadius: 3,
      }],
    };
  }, [stats.active]);

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

  const donutOpts = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        display: true,
        position: 'right',
        labels: { color: '#7a8298', font: { family: 'IBM Plex Mono', size: 11 }, boxWidth: 12, padding: 12 },
      },
      tooltip: { ...getChartDefaults().plugins.tooltip, callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}` } },
    },
  }), []);

  return (
    <div className="page">
      {/* Year filter */}
      <div className="filter-bar">
        <span className="filter-label">Year</span>
        {['all', ...YEARS].map(y => (
          <button
            key={y}
            className={`year-btn ${yearFilter === y ? 'active' : ''}`}
            onClick={() => setYearFilter(y)}
          >
            {y === 'all' ? 'All' : y}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <KPI label="Total Bid Volume" value={fmt$(stats.totalVolume)} sub={`${stats.active.length} active bids`} accent="accent" />
        <KPI label="Won Volume" value={fmt$(stats.wonVolume)} sub={`${stats.won.length} projects awarded`} accent="won" />
        <KPI label="Win Rate" value={`${stats.winRate.toFixed(0)}%`} sub={`${stats.lost.length} confirmed losses`} />
        <KPI label="Avg Margin" value={`${(stats.avgMargin * 100).toFixed(1)}%`} sub={`${fmt$(stats.totalMargin)} total margin $`} />
      </div>

      {/* Charts row 1 */}
      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-title">Bid Volume by Month <span>$</span></div>
          <div className="chart-wrap tall"><Bar data={volumeChart} options={volOpts} /></div>
        </div>
        <div className="chart-card">
          <div className="chart-title">Bid Count by Month <span>#</span></div>
          <div className="chart-wrap tall"><Line data={countChart} options={getChartDefaults()} /></div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-title">Outcome Distribution <span>active bids</span></div>
          <div className="chart-wrap"><Doughnut data={donutChart} options={donutOpts} /></div>
        </div>
        <div className="chart-card">
          <div className="chart-title">Margin % Distribution <span>active bids</span></div>
          <div className="chart-wrap"><Bar data={marginBins} options={getChartDefaults()} /></div>
        </div>
      </div>
    </div>
  );
}
