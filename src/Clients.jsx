import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { useTopClients } from './hooks.js';
import { fmt$, CHART_COLORS, CHART_DEFAULTS } from './utils.js';

export default function Clients({ bids }) {
  const clients = useTopClients(bids, 10);
  const maxVal = clients[0]?.total ?? 1;

  const countChart = useMemo(() => ({
    labels: clients.map(c => c.name.length > 18 ? c.name.slice(0, 18) + '…' : c.name),
    datasets: [{
      data: clients.map(c => c.count),
      backgroundColor: 'rgba(59,111,232,0.55)',
      borderColor: CHART_COLORS.accent,
      borderWidth: 1,
      borderRadius: 3,
    }],
  }), [clients]);

  return (
    <div className="page">
      <div className="chart-card" style={{ marginBottom: 14 }}>
        <div className="chart-title">Top 10 Clients by Total Bid Volume</div>
        <div className="client-bar-list">
          {clients.map(c => (
            <div className="client-row" key={c.name}>
              <div className="client-name" title={c.name}>{c.name}</div>
              <div className="client-bar-bg">
                <div className="client-bar-fill" style={{ width: `${(c.total / maxVal * 100).toFixed(1)}%` }} />
              </div>
              <div className="client-amount">{fmt$(c.total)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="chart-card">
        <div className="chart-title">Bid Count by Client <span>top 10</span></div>
        <div className="chart-wrap tall">
          <Bar data={countChart} options={CHART_DEFAULTS} />
        </div>
      </div>
    </div>
  );
}
