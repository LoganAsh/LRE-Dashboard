import { useState } from 'react';
import { LOGO_B64 } from './logo.js';
import { useBids } from './hooks.js';
import { SYNC_FUNCTION_URL } from './supabase.js';
import Overview from './Overview.jsx';
import Trends from './Trends.jsx';
import Clients from './Clients.jsx';
import BidLog from './BidLog.jsx';

const TABS = ['Overview', 'Trends', 'Clients', 'Bid Log'];

export default function App() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const { bids, syncLog, loading, error, refetch } = useBids();

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg('Syncing…');
    try {
      const resp = await fetch(SYNC_FUNCTION_URL, { method: 'POST' });
      const json = await resp.json();
      if (json.success) {
        setSyncMsg(`Synced ${json.rows_upserted} rows`);
        await refetch();
      } else {
        setSyncMsg(`Error: ${json.error}`);
      }
    } catch (e) {
      setSyncMsg(`Failed: ${e.message}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(''), 5000);
    }
  };

  const lastSync = syncLog
    ? new Date(syncLog.synced_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <>
      {/* Header */}
      <header className="header">
        <img src={LOGO_B64} alt="Lightning Ridge Excavation" className="header-logo" />
        <div className="header-right">
          <div>
            {lastSync && <div className="sync-status">Last sync: {lastSync}</div>}
            {syncMsg && <div className="sync-status" style={{ color: syncing ? 'var(--accent)' : 'var(--won)' }}>{syncMsg}</div>}
          </div>
          <div className="header-meta">Bid Log Dashboard</div>
          <button className="sync-btn" onClick={handleSync} disabled={syncing}>
            {syncing ? '⟳ Syncing…' : '⟳ Sync Now'}
          </button>
        </div>
      </header>

      {/* Nav */}
      <nav className="nav">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`nav-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Content */}
      {loading ? (
        <div className="loading">
          <div className="spinner" />
          Loading bid data…
        </div>
      ) : error ? (
        <div className="loading" style={{ color: 'var(--lost)' }}>
          Error loading data: {error}
        </div>
      ) : (
        <>
          {activeTab === 'Overview' && <Overview bids={bids} yearFilter={yearFilter} setYearFilter={setYearFilter} />}
          {activeTab === 'Trends' && <Trends bids={bids} />}
          {activeTab === 'Clients' && <Clients bids={bids} />}
          {activeTab === 'Bid Log' && <BidLog bids={bids} />}
        </>
      )}
    </>
  );
}
