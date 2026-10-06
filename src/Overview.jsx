import { useMemo } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, ArcElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { useBidStats, useMonthlyData, usePlacements, placementStats, useChartKey } from './hooks.js';
import { Card, CardStatSparkline } from './components/ui/card';
import { fmt$, fmtFull$, CHART_COLORS, CHART_DEFAULTS, YEARS, getChartDefaults, getLegendLabels, CHART_FONT, filterByType } from './utils.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);
ChartJS.defaults.font.family = CHART_FONT;   // global: every chart's legend, ticks and tooltips

function KPI({ label, value, sub, accent, series }) {
  const valueColor = accent === 'won' ? 'var(--won)' : accent === 'accent' ? 'var(--accent-text)' : 'var(--foreground)';
  const hasSeries = series && series.length > 1;
  return (
    <Card interactive className="flex flex-col justify-between">
      <div className="p-5 pb-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted-foreground)]">{label}</div>
        <div className="mt-2 text-[30px] font-extrabold leading-none tracking-tight tabular-nums" style={{ color: valueColor }}>{value}</div>
        {sub && <div className="mt-2 text-xs text-[var(--muted-foreground)]">{sub}</div>}
      </div>
      <div className="mt-3 h-12 w-full" style={{ '--primitive-success': 'var(--accent)' }}>
        {hasSeries && <CardStatSparkline data={series} trend="up" width={280} height={48} preserveAspectRatio="none" className="h-full w-full" />}
      </div>
    </Card>
  );
}

export default function Overview({ bids, yearFilter, setYearFilter, typeFilter, setTypeFilter }) {
  const chartKey = useChartKey();
  const typedBids = filterByType(bids, typeFilter);
  const stats = useBidStats(typedBids, yearFilter);
  const monthly = useMonthlyData(typedBids, yearFilter);
  const { placements } = usePlacements();

  // Filter placements to bids currently in view (respects BOTH year + type filter, matching useBidStats)
  const yearFilteredBids = useMemo(
    () => yearFilter === 'all' ? typedBids : typedBids.filter(b => b.year === yearFilter),
    [typedBids, yearFilter]
  );
  const visibleBidIds = useMemo(() => new Set(yearFilteredBids.map(b => b.id)), [yearFilteredBids]);
  const visiblePlacements = useMemo(() => placements.filter(p => visibleBidIds.has(p.bid_id)), [placements, visibleBidIds]);
  const placeStats = useMemo(() => placementStats(visiblePlacements), [visiblePlacements]);

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
  }), [chartKey]);

  const donutOpts = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        display: true,
        position: 'right',
        labels: getLegendLabels(),
      },
      tooltip: { ...getChartDefaults().plugins.tooltip, callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}` } },
    },
  }), [chartKey]);

  return (
    <div className="page">
      {/* Year + Type filter */}
      <div className="filter-bar">
        <span className="filter-label">Year</span>
        {['all', ...YEARS].map(y => (
          <button key={y} className={`year-btn ${yearFilter === y ? 'active' : ''}`} onClick={() => setYearFilter(y)}>
            {y === 'all' ? 'All' : y}
          </button>
        ))}
        <span className="filter-label" style={{ marginLeft: 12 }}>Type</span>
        {['All', 'Public', 'Private'].map(t => (
          <button key={t} className={`year-btn ${typeFilter === t ? 'active' : ''}`} onClick={() => setTypeFilter(t)}>{t}</button>
        ))}
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <KPI label="Total Bid Volume" value={fmt$(stats.totalVolume)} sub={`${stats.active.length} Active Bids · Monthly Trend`} accent="accent" series={monthly.map(m => m.volume)} />
        <KPI label="Won Volume" value={fmt$(stats.wonVolume)} sub={`${stats.won.length} Projects Awarded`} accent="won" />
        <KPI label="Win Rate" value={`${stats.winRate.toFixed(0)}%`} sub={`${stats.lost.length} Confirmed Losses`} />
        <KPI label="Avg Margin" value={`${(stats.avgMargin * 100).toFixed(1)}%`} sub={`${fmt$(stats.totalMargin)} Total Margin $`} />
      </div>

      {/* Bid Placement KPIs */}
      {placeStats.count > 0 && (
        <div className="kpi-grid" style={{ marginTop: -6 }}>
          <KPI
            label="Avg % High/Low"
            value={placeStats.avgPctHighLow !== null ? `${placeStats.avgPctHighLow > 0 ? '+' : ''}${placeStats.avgPctHighLow.toFixed(1)}%` : '—'}
            sub={placeStats.avgPctHighLow !== null ? (placeStats.avgPctHighLow > 0 ? 'High vs. Competition' : 'Low vs. Competition') : 'No Data Yet'}
            accent={placeStats.avgPctHighLow !== null && placeStats.avgPctHighLow < 0 ? 'won' : undefined}
          />
          <KPI label="Avg Bid Place" value={placeStats.avgPlace !== null ? placeStats.avgPlace.toFixed(1) : '—'} sub={`${placeStats.withPlace.length} Bids Tracked`} />
          <KPI label="1st Place Finishes" value={placeStats.firstPlaceCount} sub={`Of ${placeStats.withPlace.length} Tracked Results`} accent="won" />
        </div>
      )}

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
          <div className="chart-title">Outcome Distribution <span>Active Bids</span></div>
          <div className="chart-wrap"><Doughnut data={donutChart} options={donutOpts} /></div>
        </div>
        <div className="chart-card">
          <div className="chart-title">Margin % Distribution <span>Active Bids</span></div>
          <div className="chart-wrap"><Bar data={marginBins} options={getChartDefaults()} /></div>
        </div>
      </div>
    </div>
  );
}
