import { useState, useEffect } from 'react';
import { LOGO_B64 } from './logo.js';
import { useBids } from './hooks.js';
import { SYNC_FUNCTION_URL } from './supabase.js';
import BidDashboard from './BidDashboard.jsx';
import Projects from './Projects.jsx';
import WeeklySchedule from './WeeklySchedule.jsx';
import Takeoff from './Takeoff.jsx';
import ClientDirectory from './ClientDirectory.jsx';
import Overview from './Overview.jsx';
import Trends from './Trends.jsx';
import Clients from './Clients.jsx';
import BidLog from './BidLog.jsx';

const NAV_ITEMS = [
  { tab: 'Bid Dashboard', icon: '◎' },
  { tab: 'Overview', icon: '▤' },
  { tab: 'Trends', icon: '↗' },
  { tab: 'Clients', icon: '◑' },
  { tab: 'Client Analytics', icon: '◈' },
  { tab: 'Bid Log', icon: '☰' },
  { tab: 'Projects', icon: '▣' },
  { tab: 'Weekly Schedule', icon: '▦' },
  { tab: 'Takeoff', icon: '⌂' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('Bid Dashboard');
  const [theme, setTheme] = useState(() => localStorage.getItem('lre-theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('lre-theme', theme);
  }, [theme]);

  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [typeFilter, setTypeFilter] = useState('All');
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
        setSyncMsg(`Synced ${json.rows_upserted} rows — refreshing…`);
        window.location.reload();
        return;
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
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src={LOGO_B64} alt="Lightning Ridge Excavation" style={{ height: 30, width: 'auto', filter: 'none' }} />
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ tab, icon }) => (
            <button
              key={tab}
              className={`sidebar-nav-item ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              <span className="sidebar-nav-icon">{icon}</span>
              {tab}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">LR</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">Lightning Ridge</div>
              <div className="sidebar-user-org">Excavation</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-area">
        <div className="topbar">
          <div className="topbar-title">{activeTab}</div>
          <div className="topbar-actions">
            {lastSync && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Last sync: {lastSync}</span>}
            {syncMsg && <span style={{ fontSize: 11, color: syncing ? 'var(--accent-text)' : 'var(--won)' }}>{syncMsg}</span>}
            <button className="theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="Toggle theme">
              <span className="theme-toggle-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <button className="btn-primary" onClick={handleSync} disabled={syncing}>
              {syncing ? '⟳ Syncing…' : '⟳ Sync Now'}
            </button>
          </div>
        </div>

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
            {activeTab === 'Bid Dashboard' && <BidDashboard bids={bids} />}
            {activeTab === 'Projects' && <Projects bids={bids} />}
            {activeTab === 'Weekly Schedule' && <WeeklySchedule />}
            {activeTab === 'Takeoff' && <Takeoff />}
            {activeTab === 'Overview' && <Overview bids={bids} yearFilter={yearFilter} setYearFilter={setYearFilter} typeFilter={typeFilter} setTypeFilter={setTypeFilter} />}
            {activeTab === 'Trends' && <Trends bids={bids} typeFilter={typeFilter} setTypeFilter={setTypeFilter} />}
            {activeTab === 'Clients' && <ClientDirectory bids={bids} />}
            {activeTab === 'Client Analytics' && <Clients bids={bids} />}
            {activeTab === 'Bid Log' && <BidLog bids={bids} />}
          </>
        )}
      </div>
    </div>
  );
}
