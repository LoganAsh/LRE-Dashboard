import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays, CalendarRange, ChartColumn, ChartPie, ChevronLeft, ChevronRight, Ellipsis, FolderKanban,
  LayoutDashboard, ListChecks, Moon, RefreshCw, Ruler, Sun, TrendingUp, Users,
} from 'lucide-react';
import './mobile.css';
import { reloadPage } from '../reload.js';
import Sheet from './Sheet.jsx';
import { Loading } from './ui.jsx';
import MDashboard from './MDashboard.jsx';
import MBidLog from './MBidLog.jsx';
import MCalendar from './MCalendar.jsx';
import MProjects from './MProjects.jsx';
import MClients from './MClients.jsx';
import Overview from '../Overview.jsx';
import Trends from '../Trends.jsx';
import Clients from '../Clients.jsx';
import WeeklySchedule from '../WeeklySchedule.jsx';
import Takeoff from '../Takeoff.jsx';

// The four screens in the bottom bar (everything else lives under More)
const BAR = [
  { tab: 'Bid Dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { tab: 'Bid Log', label: 'Bid Log', icon: ListChecks },
  { tab: 'Calendar', label: 'Calendar', icon: CalendarRange },
  { tab: 'Projects', label: 'Projects', icon: FolderKanban },
];
const MORE = [
  { tab: 'Clients', icon: Users, desc: 'Logos, bid volume and win rates' },
  { tab: 'Client Analytics', icon: ChartPie, desc: 'How each client bids and awards' },
  { tab: 'Overview', icon: ChartColumn, desc: 'Win rate, volume and margins' },
  { tab: 'Trends', icon: TrendingUp, desc: 'Bidding over time' },
  { tab: 'Weekly Schedule', icon: CalendarDays, desc: 'Crews, equipment and work plans' },
  { tab: 'Takeoff', icon: Ruler, desc: 'Quantity takeoff calculator' },
];
const TITLES = { 'Bid Dashboard': 'Dashboard' };
const BAR_TABS = BAR.map((b) => b.tab);

export default function MobileApp({
  activeTab, setActiveTab, bids, loading, error, upcomingCount, lastSync, duplicatesHidden, syncing, syncNote, handleSync,
  theme, setTheme, yearFilter, setYearFilter, typeFilter, setTypeFilter,
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const lastBarTab = useRef('Bid Dashboard');
  if (BAR_TABS.includes(activeTab)) lastBarTab.current = activeTab;
  const secondary = !BAR_TABS.includes(activeTab);

  useEffect(() => { window.scrollTo(0, 0); }, [activeTab]);
  useEffect(() => {                       // keep the phone's status bar the same color as the app
    // Swap in a fresh tag instead of editing the old one: iPhones notice a newly added tag more reliably.
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
    const m = document.createElement('meta');
    m.name = 'theme-color'; m.content = theme === 'dark' ? '#14120f' : '#faf8f5';
    document.head.appendChild(m);
  }, [theme]);

  const go = (tab) => { setMoreOpen(false); setActiveTab(tab); };

  // An installed iPhone app only reads the top-bar color when a page loads, never live. So in the installed app,
  // switching the theme reloads it (landing back on the same screen); in a normal browser tab it updates instantly.
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (window.navigator.standalone === true) {
      try { localStorage.setItem('lre-theme', next); sessionStorage.setItem('lre-return-tab', activeTab); } catch { /* storage blocked: the switch still works, the bar just waits for the next launch */ }
      setMoreOpen(false);
      setTimeout(reloadPage, 150);
    }
  };
  const subtitle = syncNote ? { text: syncNote.text, tone: syncNote.tone } : lastSync ? { text: `Synced ${lastSync}`, tone: '' } : null;

  let screen = null;
  if (loading) screen = <Loading>Loading bid data…</Loading>;
  else if (error) screen = <div className="m-loading" style={{ color: 'var(--lost)' }}>Couldn't load data: {error}</div>;
  else {
    screen = (
      <>
        {activeTab === 'Bid Dashboard' && <MDashboard bids={bids} onNavigate={go} />}
        {activeTab === 'Bid Log' && <MBidLog bids={bids} />}
        {activeTab === 'Calendar' && <MCalendar bids={bids} onNavigate={go} />}
        {activeTab === 'Projects' && <MProjects bids={bids} />}
        {activeTab === 'Clients' && <MClients bids={bids} />}
        {activeTab === 'Client Analytics' && <Clients bids={bids} />}
        {activeTab === 'Overview' && <Overview bids={bids} yearFilter={yearFilter} setYearFilter={setYearFilter} typeFilter={typeFilter} setTypeFilter={setTypeFilter} />}
        {activeTab === 'Trends' && <Trends bids={bids} typeFilter={typeFilter} setTypeFilter={setTypeFilter} />}
        {activeTab === 'Weekly Schedule' && <WeeklySchedule />}
        {activeTab === 'Takeoff' && <Takeoff />}
      </>
    );
  }

  return (
    <div className="m-app">
      <header className="m-header">
        {secondary && (
          <button type="button" className="m-hbtn" onClick={() => go(lastBarTab.current)} aria-label="Back"><ChevronLeft /></button>
        )}
        <div className="m-header-text">
          <h1 className="m-title">{TITLES[activeTab] || activeTab}</h1>
          {subtitle && <div className={`m-subtitle ${subtitle.tone}`} role="status">{subtitle.text}</div>}
        </div>
        <button type="button" className="m-hbtn" onClick={handleSync} disabled={syncing} aria-label={syncing ? 'Syncing' : 'Sync Now'}>
          <RefreshCw className={syncing ? 'm-spin' : ''} />
        </button>
      </header>

      <main className="m-main" id="m-main">{screen}</main>

      <nav className="m-tabbar" aria-label="Main">
        {BAR.map(({ tab, label, icon: Icon }) => (
          <button key={tab} type="button" className="m-tab" aria-current={activeTab === tab ? 'page' : undefined} onClick={() => go(tab)}>
            <Icon aria-hidden="true" />{label}
            {tab === 'Bid Dashboard' && upcomingCount > 0 && <span className="m-badge" aria-label={`${upcomingCount} upcoming`}>{upcomingCount}</span>}
          </button>
        ))}
        <button type="button" className="m-tab" aria-current={secondary ? 'page' : undefined} aria-haspopup="dialog" onClick={() => setMoreOpen(true)}>
          <Ellipsis aria-hidden="true" />More
        </button>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <div>
          {MORE.map(({ tab, icon: Icon, desc }) => (
            <button key={tab} type="button" className="m-action" onClick={() => go(tab)}>
              <Icon strokeWidth={1.75} />
              <span className="m-action-text">{tab}<small>{desc}</small></span>
              <ChevronRight className="chev" aria-hidden="true" />
            </button>
          ))}
        </div>
        <div className="m-group-label">Settings</div>
        <button type="button" className="m-action" role="switch" aria-checked={theme === 'dark'} onClick={toggleTheme}>
          {theme === 'dark' ? <Moon strokeWidth={1.75} /> : <Sun strokeWidth={1.75} />}
          <span className="m-action-text">Dark Mode</span>
          <span className="m-switch" aria-checked={theme === 'dark'} />
        </button>
        <button type="button" className="m-action" onClick={() => { setMoreOpen(false); handleSync(); }} disabled={syncing}>
          <RefreshCw strokeWidth={1.75} />
          <span className="m-action-text">Sync Now<small>{lastSync ? `Last sync ${lastSync}` : 'Pulls the latest bid log'}{duplicatesHidden > 0 ? ` · ${duplicatesHidden} Duplicate Rows Hidden` : ''}</small></span>
        </button>
      </Sheet>
    </div>
  );
}
