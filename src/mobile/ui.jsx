import { dateOf } from '../dates.js';

export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// A little calendar tile: month on top, day number below, tinted by `tone`
export function DateBlock({ iso, tone }) {
  const d = dateOf(iso);
  return (
    <div className="m-date" style={tone ? { '--tone': tone } : undefined} aria-hidden="true">
      <span>{MON[d.getMonth()]}</span>
      <b>{d.getDate()}</b>
    </div>
  );
}

export function SectionHead({ title, count, action }) {
  return (
    <div className="m-section-head">
      <h2>{title}</h2>
      {action || (count != null && <span className="m-count">{count}</span>)}
    </div>
  );
}

export function Loading({ children = 'Loading…' }) {
  return <div className="m-loading"><div className="spinner" />{children}</div>;
}

// Activate on Enter/Space like a real button (for rows that contain their own buttons)
export const rowKeys = (fn) => (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); fn(); } };
