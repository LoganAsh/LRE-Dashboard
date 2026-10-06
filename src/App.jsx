import { useState, useEffect, useMemo } from 'react';
import {
  IconLayoutDashboard, IconChartBar, IconTrendingUp, IconUsers, IconChartDots,
  IconListDetails, IconFolders, IconCalendarWeek, IconRuler2,
} from '@tabler/icons-react';
import { LOGO_B64 } from './logo.js';
import { useBids } from './hooks.js';
import { SYNC_FUNCTION_URL } from './supabase.js';
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from './components/ui/sidebar';
import BidDashboard from './BidDashboard.jsx';
import Projects from './Projects.jsx';
import WeeklySchedule from './WeeklySchedule.jsx';
import Takeoff from './Takeoff.jsx';
import ClientDirectory from './ClientDirectory.jsx';
import Overview from './Overview.jsx';
import Trends from './Trends.jsx';
import Clients from './Clients.jsx';
import BidLog from './BidLog.jsx';

const NAV_SECTIONS = [
  {
    label: 'Bidding',
    items: [
      { tab: 'Bid Dashboard', icon: IconLayoutDashboard },
      { tab: 'Overview', icon: IconChartBar },
      { tab: 'Trends', icon: IconTrendingUp },
      { tab: 'Clients', icon: IconUsers },
      { tab: 'Client Analytics', icon: IconChartDots },
      { tab: 'Bid Log', icon: IconListDetails },
    ],
  },
  {
    label: 'Operations',
    items: [
      { tab: 'Projects', icon: IconFolders },
      { tab: 'Weekly Schedule', icon: IconCalendarWeek },
      { tab: 'Takeoff', icon: IconRuler2 },
    ],
  },
];

function CountBadge({ children }) {
  return (
    <span className="rounded-md bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] px-1.5 py-0.5 text-[10.5px] font-medium leading-none tabular-nums text-[var(--muted-foreground)]">
      {children}
    </span>
  );
}

function Brand() {
  const { open } = useSidebar();
  return (
    <div className="flex h-9 items-center pl-1">
      {open ? (
        <img src={LOGO_B64} alt="Lightning Ridge Excavation" className="h-7 w-auto" />
      ) : (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-[var(--primary)] text-[12px] font-bold text-white">LR</div>
      )}
    </div>
  );
}

function GroupLabel({ children }) {
  const { open } = useSidebar();
  return open ? (
    <div className="px-2 pb-1 pt-5 text-[10.5px] font-medium uppercase leading-none tracking-[0.08em] text-[var(--muted-foreground)]">{children}</div>
  ) : (
    <div className="mx-2 my-3 h-px bg-[var(--border)]" />
  );
}

function UserFooter() {
  return (
    <SidebarLink
      link={{
        label: 'Lightning Ridge Excavation',
        icon: (
          <div className="flex size-5 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[9px] font-bold text-[var(--accent-text)]">LR</div>
        ),
      }}
    />
  );
}

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
  const { bids, syncLog, loading, error } = useBids();

  // Same rule the Bid Dashboard uses for its "Upcoming Bids" list
  const upcomingCount = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today); cutoff.setDate(today.getDate() - 7);
    return bids.filter(b =>
      (b.effective_status || b.status) === 'Upcoming' && b.bid_date &&
      new Date(b.bid_date + 'T00:00:00') >= cutoff
    ).length;
  }, [bids]);

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
    <div className="app-shell flex-col md:flex-row">
      <div className="sticky top-0 z-30 shrink-0 md:h-screen">
        <Sidebar>
          <SidebarBody
            className="justify-between gap-6"
            mobileHeader={<img src={LOGO_B64} alt="Lightning Ridge Excavation" className="h-7 w-auto" />}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
              <Brand />
              {NAV_SECTIONS.map(section => (
                <div key={section.label} className="flex flex-col gap-1">
                  <GroupLabel>{section.label}</GroupLabel>
                  {section.items.map(({ tab, icon: Icon }) => (
                    <SidebarLink
                      key={tab}
                      link={{ label: tab, icon: <Icon className="size-[18px]" stroke={1.75} /> }}
                      active={activeTab === tab}
                      onClick={() => setActiveTab(tab)}
                      badge={tab === 'Bid Dashboard' && upcomingCount > 0 ? <CountBadge>{upcomingCount}</CountBadge> : undefined}
                    />
                  ))}
                </div>
              ))}
            </div>
            <UserFooter />
          </SidebarBody>
        </Sidebar>
      </div>

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
          <div className="loading"><div className="spinner" />Loading bid data…</div>
        ) : error ? (
          <div className="loading" style={{ color: 'var(--lost)' }}>Error loading data: {error}</div>
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
