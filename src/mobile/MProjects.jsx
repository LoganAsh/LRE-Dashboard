import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../supabase.js';
import { fmt$, fmtFull$ } from '../utils.js';
import { startOfToday } from '../dates.js';
import { moveProject } from '../projectOrder.js';
import { useProjectTasks, summarize } from '../projectTasks.js';
import { billingLabel, nextBillingDate, fmtBillingDate } from '../projectBilling.js';
import { ProjectModal, SovEditor, STATUS_COLORS, STATUS_ORDER } from '../Projects.jsx';
import TaskPanel from '../TaskPanel.jsx';
import Sheet from './Sheet.jsx';
import { SectionHead } from './ui.jsx';

const revisedOf = (p) => (p.original_contract || 0) + (p.approved_cos || 0);
const colorOf = (s) => (STATUS_COLORS[s] || STATUS_COLORS['Not Started']).color;
const fmtDay = (iso) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null);

function Pill({ status }) { return <span className="m-spill" style={{ '--c': colorOf(status) }}>{status}</span>; }

function TaskLine({ stats }) {
  if (!stats.total) return <div className="m-proj-tasks" style={{ color: 'var(--muted)' }}>No tasks yet</div>;
  const pct = Math.round((stats.done / stats.total) * 100);
  return (
    <div className="m-proj-tasks">
      <span style={{ whiteSpace: 'nowrap' }}>{stats.done} of {stats.total} Tasks Done</span>
      <span className="m-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
      {stats.overdue > 0 && <span style={{ color: 'var(--lost)', fontWeight: 700, whiteSpace: 'nowrap' }}>{stats.overdue} Overdue</span>}
    </div>
  );
}

export default function MProjects({ bids }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [editOrder, setEditOrder] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState(null);            // 'new' or a project
  const [sovFor, setSovFor] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [orderError, setOrderError] = useState('');
  const tasksApi = useProjectTasks();
  const wonBids = useMemo(() => (bids || []).filter((b) => (b.effective_status || b.status) === 'Won').sort((a, b) => (b.bid_date || '').localeCompare(a.bid_date || '')), [bids]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('lre_projects').select('*').order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
    setProjects(data || []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, summarize(tasksApi.tasks, p.id)])), [projects, tasksApi.tasks]);
  const filtered = statusFilter === 'All' ? projects : projects.filter((p) => p.status === statusFilter);
  const open = projects.find((p) => p.id === openId) || null;

  const onSave = (p) => setProjects((prev) => (prev.find((x) => x.id === p.id) ? prev.map((x) => (x.id === p.id ? p : x)) : [p, ...prev]));
  const remove = async (p) => {
    await supabase.from('lre_projects').delete().eq('id', p.id);
    setProjects((prev) => prev.filter((x) => x.id !== p.id)); setConfirmDelete(null); setOpenId(null);
  };
  // Same rule as desktop: move one project, save the whole order in one step, undo if it fails
  const move = async (id, delta) => {
    const i = filtered.findIndex((p) => p.id === id); const target = filtered[i + delta]; if (!target) return;
    const next = moveProject(projects, id, target.id, delta > 0 ? 'after' : 'before'); if (next === projects) return;
    const before = projects; setProjects(next); setOrderError('');
    const { error } = await supabase.rpc('lre_reorder_projects', { ids: next.map((p) => p.id) });
    if (error) { setProjects(before); setOrderError(`Couldn't save the new order: ${error.message}`); }
  };

  const active = projects.filter((p) => ['Mobilizing', 'Active', 'Punch List'].includes(p.status));
  const activeValue = active.reduce((s, p) => s + revisedOf(p), 0);
  const total = projects.reduce((s, p) => s + revisedOf(p), 0);

  if (loading) return <div className="m-loading"><div className="spinner" />Loading projects…</div>;

  return (
    <>
      <div className="m-card" style={{ marginBottom: 4 }}>
        <div className="m-proj-kpis">
          <div><div className="l">Active Value</div><div className="v" style={{ color: 'var(--accent-text)' }}>{fmt$(activeValue)}</div></div>
          <div><div className="l">Portfolio</div><div className="v">{fmt$(total)}</div></div>
          <div><div className="l">Active</div><div className="v">{active.length}<span style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600 }}> of {projects.length}</span></div></div>
        </div>
      </div>

      <div className="m-sticky" style={{ marginTop: 6 }}>
        <div className="m-chips" role="tablist" aria-label="Project status" style={{ paddingBottom: 8 }}>
          {['All', ...STATUS_ORDER].map((s) => <button key={s} type="button" role="tab" className="m-chip" aria-selected={statusFilter === s} onClick={() => setStatusFilter(s)}>{s}{s !== 'All' && <small>{projects.filter((p) => p.status === s).length}</small>}</button>)}
        </div>
      </div>

      <SectionHead title={editOrder ? 'Tap the Arrows to Reorder' : 'Projects'} count={filtered.length}
        action={filtered.length > 1 ? <button type="button" className="m-link" onClick={() => setEditOrder((e) => !e)} aria-pressed={editOrder}>{editOrder ? 'Done' : 'Reorder'}</button> : null} />
      {orderError && <div role="alert" style={{ marginBottom: 10, padding: '10px 12px', border: '1px solid var(--lost)', borderRadius: 12, color: 'var(--lost)', fontSize: 13 }}>{orderError}</div>}

      {filtered.length === 0 && <div className="m-card"><div className="m-empty"><b>No Projects</b>{statusFilter === 'All' ? 'Tap New Project to add your first one.' : `No projects are marked ${statusFilter}.`}</div></div>}
      {filtered.map((p, i) => {
        const revised = revisedOf(p), remaining = revised - (p.actual_cost || 0), nb = nextBillingDate(p, startOfToday());
        const Tag = editOrder ? 'div' : 'button';
        return (
          <Tag key={p.id} type={editOrder ? undefined : 'button'} className="m-proj contour" onClick={editOrder ? undefined : () => setOpenId(p.id)} aria-haspopup={editOrder ? undefined : 'dialog'} aria-label={editOrder ? undefined : `${p.name}, ${p.status}`}>
            <div className="m-proj-top"><Pill status={p.status} /><span>{nb ? `Bills ${fmtBillingDate(nb).replace(/, \d{4}$/, '')}` : ''}</span></div>
            <div className="m-proj-name">{p.name}</div>
            {p.client && <div className="m-proj-client">{p.client}</div>}
            <div className="m-proj-nums">
              <div><div className="l">Contract</div><div className="v">{fmt$(revised)}</div></div>
              <div><div className="l">Cost</div><div className="v">{fmt$(p.actual_cost || 0)}</div></div>
              <div><div className="l">Remaining</div><div className="v" style={{ color: remaining < 0 ? 'var(--lost)' : 'var(--won)' }}>{fmt$(remaining)}</div></div>
            </div>
            <TaskLine stats={stats[p.id]} />
            {editOrder ? (
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button type="button" className="m-btn" style={{ height: 46 }} disabled={i === 0} onClick={() => move(p.id, -1)} aria-label={`Move up: ${p.name}`}><ArrowUp size={18} />Up</button>
                <button type="button" className="m-btn" style={{ height: 46 }} disabled={i === filtered.length - 1} onClick={() => move(p.id, 1)} aria-label={`Move down: ${p.name}`}><ArrowDown size={18} />Down</button>
              </div>
            ) : null}
          </Tag>
        );
      })}

      <button type="button" className="m-fab" onClick={() => setForm('new')}><Plus aria-hidden="true" />New Project</button>

      {/* everything about one project */}
      <Sheet open={!!open} onClose={() => setOpenId(null)} full title={open ? open.name : ''} subtitle={open ? [open.client, open.awarded_by && open.awarded_by !== open.client ? `Awarded by ${open.awarded_by}` : null].filter(Boolean).join(' · ') : ''}>
        {open && <ProjectDetail project={open} tasksApi={tasksApi} onEdit={() => { setForm(open); }} onSov={() => setSovFor(open)} onDelete={() => setConfirmDelete(open)} />}
      </Sheet>

      {form && <ProjectModal project={form === 'new' ? null : form} wonBids={wonBids} onClose={() => setForm(null)} onSave={onSave} />}
      {sovFor && <SovEditor projectId={sovFor.id} originalContract={revisedOf(sovFor)} onClose={() => setSovFor(null)} />}

      <Sheet open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete This Project?" subtitle={confirmDelete ? `"${confirmDelete.name}" and its tasks will be deleted. This can't be undone.` : ''}
        footer={<><button type="button" className="m-btn" onClick={() => setConfirmDelete(null)}>Cancel</button><button type="button" className="m-btn m-btn-primary" style={{ background: 'var(--lost)', borderColor: 'var(--lost)' }} onClick={() => remove(confirmDelete)}>Delete</button></>}>
        <div style={{ height: 4 }} />
      </Sheet>
    </>
  );
}

function ProjectDetail({ project: p, tasksApi, onEdit, onSov, onDelete }) {
  const revised = revisedOf(p), remaining = revised - (p.actual_cost || 0), nb = nextBillingDate(p, startOfToday());
  const [sov, setSov] = useState(null);
  useEffect(() => {
    supabase.from('lre_sov').select('budgeted_amount,actual_cost,pct_complete,billed_to_date').eq('project_id', p.id).then(({ data }) => {
      if (data && data.length) setSov({ lines: data.length, billed: data.reduce((s, r) => s + (r.billed_to_date || 0), 0), pct: data.reduce((s, r) => s + (r.pct_complete || 0), 0) / data.length });
    });
  }, [p.id]);
  const rows = [['Start', fmtDay(p.start_date)], ['Est. Complete', fmtDay(p.est_completion_date)], ['Superintendent', p.superintendent], ['Foreman', p.foreman], ['Crew Size', p.crew_size], ['Billing', p.billing_day && p.status !== 'Complete' ? billingLabel(p.billing_day) : null]].filter(([, v]) => v);
  return (
    <div>
      <div style={{ marginBottom: 12 }}><Pill status={p.status} /></div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <button type="button" className="m-btn" style={{ height: 46, fontSize: 15 }} onClick={onEdit}>Edit Project</button>
        <button type="button" className="m-btn" style={{ height: 46, fontSize: 15 }} onClick={onSov}>Schedule of Values</button>
      </div>

      <div className="m-card">
        <div className="m-kv">
          <div><div className="l">Original Contract</div><div className="v">{fmtFull$(p.original_contract || 0)}</div></div>
          <div><div className="l">Approved COs</div><div className="v" style={{ color: '#ca8a04' }}>{fmtFull$(p.approved_cos || 0)}</div></div>
          <div><div className="l">Revised Contract</div><div className="v" style={{ color: 'var(--accent-text)' }}>{fmtFull$(revised)}</div></div>
          <div><div className="l">Actual Cost</div><div className="v">{fmtFull$(p.actual_cost || 0)}</div></div>
          <div className="full"><div className="l">Remaining</div><div className="v" style={{ color: remaining < 0 ? 'var(--lost)' : 'var(--won)' }}>{fmtFull$(remaining)}</div></div>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="m-card" style={{ marginTop: 12 }}>
          {rows.map(([k, v], i) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '12px 14px', borderTop: i ? '1px solid var(--border)' : 0, fontSize: 14.5 }}>
              <span style={{ color: 'var(--muted)' }}>{k}</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
            </div>
          ))}
          {nb && <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', fontSize: 14.5, display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Next Billing</span><span style={{ fontWeight: 600, color: '#0f766e' }}>{fmtBillingDate(nb)}</span></div>}
          {sov && <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', fontSize: 14.5, display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: 'var(--muted)' }}>Schedule of Values</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{sov.lines} Items · {Math.round(sov.pct)}% · {fmt$(sov.billed)} Billed</span></div>}
        </div>
      )}

      <div className="m-section" style={{ marginTop: 20 }}>
        <SectionHead title="Tasks" />
        <div className="m-card" style={{ padding: 0 }}><TaskPanel project={p} api={tasksApi} /></div>
      </div>

      {p.notes && <div className="m-section" style={{ marginTop: 20 }}><SectionHead title="Notes" /><div className="m-card" style={{ padding: '13px 14px', fontSize: 14.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{p.notes}</div></div>}

      <button type="button" className="m-action danger" style={{ marginTop: 22, justifyContent: 'center', borderTop: 0 }} onClick={onDelete}><Trash2 strokeWidth={1.75} /><span className="m-action-text" style={{ flex: 'none' }}>Delete Project</span></button>
    </div>
  );
}
