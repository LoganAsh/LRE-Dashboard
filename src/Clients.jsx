import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { useTopClients } from './hooks.js';
import { fmt$, CHART_COLORS, CHART_DEFAULTS } from './utils.js';

export default function Clients({ bids }) {
  const clients = useTopClients(bids, 10);
  const maxVal = clients[0]?.total ?? 1;

  // Sort by count descending for the count chart
  const clientsByCount = useMemo(() =>
    [...clients].sort((a, b) => b.count - a.count),
  [clients]);

  // Top 10 by total awarded value
  const clientsByAwarded = useMemo(() => {
    const map = {};
    bids.filter(b => b.bid_amount > 0 && b.client).forEach(b => {
      const key = b.client.trim();
      if (!key) return;
      const award = b.award_amount ?? 0;
      const effStatus = b.effective_status || b.status;
      if (!map[key]) map[key] = { name: key, awarded: 0, count: 0 };
      if (effStatus === 'Won' && award > 0) {
        map[key].awarded += award;
        map[key].count += 1;
      }
    });
    return Object.values(map)
      .filter(c => c.awarded > 0)
      .sort((a, b) => b.awarded - a.awarded)
      .slice(0, 10);
  }, [bids]);

  const countChart = useMemo(() => ({
    labels: clientsByCount.map(c => c.name.length > 18 ? c.name.slice(0, 18) + '...' : c.name),
    datasets: [{
      data: clientsByCount.map(c => c.count),
      backgroundColor: 'rgba(59,111,232,0.55)',
      borderColor: CHART_COLORS.accent,
      borderWidth: 1,
      borderRadius: 3,
    }],
  }), [clientsByCount]);

  const awardedChart = useMemo(() => ({
    labels: clientsByAwarded.map(c => c.name.length > 18 ? c.name.slice(0, 18) + '...' : c.name),
    datasets: [{
      data: clientsByAwarded.map(c => c.awarded),
      backgroundColor: 'rgba(46,189,126,0.55)',
      borderColor: CHART_COLORS.won,
      borderWidth: 1,
      borderRadius: 3,
    }],
  }), [clientsByAwarded]);

  const awardedOpts = useMemo(() => ({
    ...CHART_DEFAULTS,
    plugins: {
      ...CHART_DEFAULTS.plugins,
      tooltip: {
        ...CHART_DEFAULTS.plugins.tooltip,
        callbacks: { label: ctx => ' ' + fmt$(ctx.raw) },
      },
    },
    scales: {
      ...CHART_DEFAULTS.scales,
      y: {
        ...CHART_DEFAULTS.scales.y,
        ticks: { ...CHART_DEFAULTS.scales.y.ticks, callback: v => fmt$(v) },
      },
    },
  }), []);

  return (
    <div className="page">
      {/* Volume bar list */}
      <div className="chart-card" style={{ marginBottom: 14 }}>
        <div className="chart-title">Top 10 Clients by Total Bid Volume</div>
        <div className="client-bar-list">
          {clients.map(c => (
            <div className="client-row" key={c.name}>
              <div className="client-name" title={c.name}>{c.name}</div>
              <div className="client-bar-bg">
                <div className="client-bar-fill" style={{ width: (c.total / maxVal * 100).toFixed(1) + '%' }} />
              </div>
              <div className="client-amount">{fmt$(c.total)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Count chart */}
      <div className="chart-card" style={{ marginBottom: 14 }}>
        <div className="chart-title">Top 10 Clients by Total Bid Count</div>
        <div className="chart-wrap tall">
          <Bar data={countChart} options={CHART_DEFAULTS} />
        </div>
      </div>

      {/* Awarded value chart */}
      <div className="chart-card">
        <div className="chart-title">
          Top 10 Clients by Total Awarded Bid Value
          <span> won projects only</span>
        </div>
        {clientsByAwarded.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>
            No awarded bids with award amounts recorded yet. Use the Status modal in Bid Log to enter award amounts.
          </div>
        ) : (
          <div className="chart-wrap tall">
            <Bar data={awardedChart} options={awardedOpts} />
          </div>
        )}
      </div>
    </div>
  );
}
