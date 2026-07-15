import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase.js';
import { fmtFull$, fmt$ } from './utils.js';

const DEFAULT_SOV = [
  'Mobilization/General Conditions','Site Demo','Utility Demo',
  'Earthwork/Grading','Structural Excavation','Concrete/Site Prep',
  'Sewer','Water','Storm Drain','Erosion Control',
];

const STATUS_COLORS = {
  'Not Started': { color: '#7a8298', bg: 'rgba(122,130,152,0.12)' },
  'Mobilizing':  { color: '#e8c547', bg: 'rgba(232,197,71,0.12)'  },
  'Active':      { color: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  'Punch List':  { color: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  'Complete':    { color: '#2ebd7e', bg: 'rgba(46,189,126,0.12)'  },
};

const STATUS_ORDER = ['Not Started','Mobilizing','Active','Punch List','Complete'];

const field = {
  width: '100%', padding: '7px 10px', background: 'var(--surface)',
  border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)',
  fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none', boxSizing: 'border-box',
};

function pct(part, total) { return total > 0 ? Math.min(100, (part / total) * 100) : 0; }

function ProgressBar({ value, color }) {
  return (
    <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', background: color || 'var(--accent)', borderRadius: 3, transition: 'width 0.4s ease' }} />
    </div>
  );
}

function StatusPill({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS['Not Started'];
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', background: s.bg, color: s.color, border: `1px solid ${s.color}44`, whiteSpace: 'nowrap' }}>{status}</span>
  );
}

// ── SOV Editor ────────────────────────────────────────────────────────────────
function SovEditor({ projectId, originalContract, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('lre_sov').select('*').eq('project_id', projectId).order('sort_order').then(({ data }) => {
      if (data && data.length > 0) {
        setRows(data);
      } else {
        setRows(DEFAULT_SOV.map((cat, i) => ({ id: null, project_id: projectId, sort_order: i, category: cat, description: '', budgeted_amount: 0, actual_cost: 0, pct_complete: 0, billed_to_date: 0 })));
      }
      setLoading(false);
    });
  }, [projectId]);

  const update = (idx, key, val) => setRows(prev => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));
  const addRow = () => setRows(prev => [...prev, { id: null, project_id: projectId, sort_order: prev.length, category: '', description: '', budgeted_amount: 0, actual_cost: 0, pct_complete: 0, billed_to_date: 0 }]);
  const removeRow = (idx) => setRows(prev => prev.filter((_, i) => i !== idx));

  const totalBudget = rows.reduce((s, r) => s + (parseFloat(r.budgeted_amount) || 0), 0);
  const totalActual = rows.reduce((s, r) => s + (parseFloat(r.actual_cost) || 0), 0);
  const totalBilled = rows.reduce((s, r) => s + (parseFloat(r.billed_to_date) || 0), 0);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('lre_sov').delete().eq('project_id', projectId);
    const toInsert = rows.filter(r => r.category.trim()).map((r, i) => ({
      project_id: projectId, sort_order: i, category: r.category,
      description: r.description || null,
      budgeted_amount: parseFloat(r.budgeted_amount) || 0,
      actual_cost: parseFloat(r.actual_cost) || 0,
      pct_complete: parseFloat(r.pct_complete) || 0,
      billed_to_date: parseFloat(r.billed_to_date) || 0,
    }));
    if (toInsert.length > 0) await supabase.from('lre_sov').insert(toInsert);
    setSaving(false);
    onClose();
  };

  const col = { padding: '6px 8px', fontSize: 11, fontFamily: 'var(--font-mono)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, width: '100%', maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>Schedule of Values</div>
            <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>
              Contract: {fmtFull$(originalContract)} · SOV Total:{' '}
              <span style={{ color: totalBudget > originalContract ? 'var(--lost)' : totalBudget === originalContract ? 'var(--won)' : 'var(--text)' }}>{fmtFull$(totalBudget)}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--surface2)', zIndex: 1 }}>
              <tr>
                {['Category','Description','Budgeted','Actual Cost','% Complete','Billed to Date',''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: h === '' ? 'center' : 'left', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>Loading…</td></tr>
                : rows.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 8px', minWidth: 180 }}><input value={row.category} onChange={e => update(idx,'category',e.target.value)} style={col} placeholder="Category" /></td>
                    <td style={{ padding: '6px 8px', minWidth: 140 }}><input value={row.description||''} onChange={e => update(idx,'description',e.target.value)} style={col} placeholder="Notes" /></td>
                    <td style={{ padding: '6px 8px', minWidth: 110 }}><input type="number" value={row.budgeted_amount||''} onChange={e => update(idx,'budgeted_amount',e.target.value)} style={{ ...col, textAlign:'right' }} placeholder="0" /></td>
                    <td style={{ padding: '6px 8px', minWidth: 110 }}><input type="number" value={row.actual_cost||''} onChange={e => update(idx,'actual_cost',e.target.value)} style={{ ...col, textAlign:'right', color: parseFloat(row.actual_cost) > parseFloat(row.budgeted_amount) && row.budgeted_amount > 0 ? 'var(--lost)' : 'var(--text)' }} placeholder="0" /></td>
                    <td style={{ padding: '6px 8px', minWidth: 90 }}><input type="number" min="0" max="100" value={row.pct_complete||''} onChange={e => update(idx,'pct_complete',e.target.value)} style={{ ...col, textAlign:'right' }} placeholder="0" /></td>
                    <td style={{ padding: '6px 8px', minWidth: 110 }}><input type="number" value={row.billed_to_date||''} onChange={e => update(idx,'billed_to_date',e.target.value)} style={{ ...col, textAlign:'right' }} placeholder="0" /></td>
                    <td style={{ padding: '6px 8px', textAlign:'center' }}>
                      <button onClick={() => removeRow(idx)} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:14, padding:2 }}
                        onMouseEnter={e => e.currentTarget.style.color='var(--lost)'}
                        onMouseLeave={e => e.currentTarget.style.color='var(--muted)'}
                      >✕</button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--surface2)' }}>
                <td colSpan={2} style={{ padding:'8px 10px', fontFamily:'var(--font-display)', fontWeight:700, fontSize:12 }}>Totals</td>
                <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600, color: totalBudget > originalContract ? 'var(--lost)' : 'var(--text)' }}>{fmtFull$(totalBudget)}</td>
                <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600, color: totalActual > totalBudget && totalBudget > 0 ? 'var(--lost)' : 'var(--text)' }}>{fmtFull$(totalActual)}</td>
                <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--muted)' }}>—</td>
                <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600 }}>{fmtFull$(totalBilled)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:10, alignItems:'center', flexShrink:0 }}>
          <button onClick={addRow} style={{ padding:'7px 14px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:4, color:'var(--muted)', fontFamily:'var(--font-mono)', fontSize:12, cursor:'pointer' }}>+ Add Line Item</button>
          <div style={{ flex:1 }} />
          <button onClick={onClose} style={{ padding:'7px 14px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:4, color:'var(--muted)', fontFamily:'var(--font-mono)', fontSize:12, cursor:'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding:'7px 20px', background:'var(--accent)', border:'none', borderRadius:4, color:'#fff', fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600, cursor: saving?'not-allowed':'pointer', opacity: saving?0.7:1 }}>{saving?'Saving…':'Save SOV'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Project Modal ─────────────────────────────────────────────────────────────
function ProjectModal({ project, wonBids, onClose, onSave }) {
  const isNew = !project?.id;
  const [form, setForm] = useState({
    bid_id: project?.bid_id || '',
    name: project?.name || '',
    client: project?.client || '',
    awarded_by: project?.awarded_by || '',
    status: project?.status || 'Not Started',
    superintendent: project?.superintendent || '',
    foreman: project?.foreman || '',
    crew_size: project?.crew_size || '',
    start_date: project?.start_date || '',
    est_completion_date: project?.est_completion_date || '',
    actual_completion_date: project?.actual_completion_date || '',
    original_contract: project?.original_contract || '',
    approved_cos: project?.approved_cos || 0,
    actual_cost: project?.actual_cost || 0,
    notes: project?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleBidSelect = (bidId) => {
    const bid = wonBids.find(b => String(b.id) === bidId);
    if (bid) {
      setForm(f => ({ ...f, bid_id: bidId, name: bid.name || '', client: bid.client || '', awarded_by: bid.awarded_by || '', original_contract: bid.award_amount || bid.bid_amount || '' }));
    } else {
      set('bid_id', '');
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Project name is required'); return; }
    setSaving(true); setError('');
    const payload = { ...form, bid_id: form.bid_id || null, crew_size: parseInt(form.crew_size) || null, original_contract: parseFloat(form.original_contract) || 0, approved_cos: parseFloat(form.approved_cos) || 0, actual_cost: parseFloat(form.actual_cost) || 0, start_date: form.start_date || null, est_completion_date: form.est_completion_date || null, actual_completion_date: form.actual_completion_date || null };
    const result = isNew
      ? await supabase.from('lre_projects').insert(payload).select().single()
      : await supabase.from('lre_projects').update(payload).eq('id', project.id).select().single();
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    onSave(result.data);
    onClose();
  };

  const Label = ({ children }) => <label style={{ display:'block', fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:5 }}>{children}</label>;
  const Section = ({ title }) => <div style={{ fontSize:10, color:'var(--accent)', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600, marginBottom:10, marginTop:6, paddingBottom:4, borderBottom:'1px solid var(--border)' }}>{title}</div>;

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div className="modal-inner" style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, width:'100%', maxWidth:580, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,0.7)' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:'var(--surface)', zIndex:1 }}>
          <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:16 }}>{isNew ? 'New Project' : 'Edit Project'}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:18, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ padding:20 }}>
          {isNew && wonBids.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <Label>Link to Won Bid (auto-fills fields)</Label>
              <select value={form.bid_id} onChange={e => handleBidSelect(e.target.value)} style={field}>
                <option value="">— Select a won bid —</option>
                {wonBids.map(b => <option key={b.id} value={b.id}>{b.name} · {b.bid_date} · {fmtFull$(b.award_amount || b.bid_amount)}</option>)}
              </select>
            </div>
          )}

          <Section title="Project Info" />
          <div style={{ marginBottom:12 }}>
            <Label>Project Name *</Label>
            <input value={form.name} onChange={e => set('name',e.target.value)} style={field} placeholder="Project name" />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            <div><Label>Client / GC</Label><input value={form.client} onChange={e => set('client',e.target.value)} style={field} /></div>
            <div><Label>Awarded By</Label><input value={form.awarded_by} onChange={e => set('awarded_by',e.target.value)} style={field} /></div>
          </div>
          <div style={{ marginBottom:16 }}>
            <Label>Status</Label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 }}>
              {STATUS_ORDER.map(s => {
                const active = form.status === s;
                const sc = STATUS_COLORS[s];
                return <button key={s} onClick={() => set('status',s)} style={{ padding:'7px 4px', border:`1px solid ${active?sc.color:'var(--border)'}`, borderRadius:4, cursor:'pointer', fontFamily:'var(--font-mono)', fontSize:10, background:active?sc.bg:'var(--surface)', color:active?sc.color:'var(--muted)', transition:'all 0.15s', textAlign:'center', lineHeight:1.3 }}>{s}</button>;
              })}
            </div>
          </div>

          <Section title="Crew" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 80px', gap:10, marginBottom:16 }}>
            <div><Label>Superintendent</Label><input value={form.superintendent} onChange={e => set('superintendent',e.target.value)} style={field} /></div>
            <div><Label>Foreman</Label><input value={form.foreman} onChange={e => set('foreman',e.target.value)} style={field} /></div>
            <div><Label>Crew Size</Label><input type="number" value={form.crew_size} onChange={e => set('crew_size',e.target.value)} style={field} /></div>
          </div>

          <Section title="Schedule" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:16 }}>
            <div><Label>Start Date</Label><input type="date" value={form.start_date} onChange={e => set('start_date',e.target.value)} style={{ ...field, colorScheme:'dark' }} /></div>
            <div><Label>Est. Completion</Label><input type="date" value={form.est_completion_date} onChange={e => set('est_completion_date',e.target.value)} style={{ ...field, colorScheme:'dark' }} /></div>
            <div><Label>Actual Completion</Label><input type="date" value={form.actual_completion_date} onChange={e => set('actual_completion_date',e.target.value)} style={{ ...field, colorScheme:'dark' }} /></div>
          </div>

          <Section title="Financials" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:16 }}>
            <div><Label>Original Contract</Label><input type="number" value={form.original_contract} onChange={e => set('original_contract',e.target.value)} style={field} /></div>
            <div><Label>Approved COs</Label><input type="number" value={form.approved_cos} onChange={e => set('approved_cos',e.target.value)} style={field} /></div>
            <div><Label>Actual Cost to Date</Label><input type="number" value={form.actual_cost} onChange={e => set('actual_cost',e.target.value)} style={field} /></div>
          </div>

          <Section title="Notes" />
          <textarea value={form.notes} onChange={e => set('notes',e.target.value)} rows={3} style={{ ...field, resize:'vertical', lineHeight:1.6, marginBottom:16 }} placeholder="Project notes…" />

          {error && <div style={{ color:'var(--lost)', fontSize:12, marginBottom:10 }}>{error}</div>}
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} style={{ flex:1, padding:'9px 0', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:4, color:'var(--muted)', fontFamily:'var(--font-mono)', fontSize:12, cursor:'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ flex:2, padding:'9px 0', background:'var(--accent)', border:'none', borderRadius:4, color:'#fff', fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600, cursor:saving?'not-allowed':'pointer', opacity:saving?0.7:1 }}>{saving?'Saving…':(isNew?'Create Project':'Save Changes')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Project Card ──────────────────────────────────────────────────────────────
function ProjectCard({ project, wonBids, onEdit, onDeleted }) {
  const [showSov, setShowSov] = useState(false);
  const [sovSummary, setSovSummary] = useState(null);

  const revised = (project.original_contract || 0) + (project.approved_cos || 0);
  const burnPct = pct(project.actual_cost || 0, revised);
  const remaining = revised - (project.actual_cost || 0);

  useEffect(() => {
    supabase.from('lre_sov').select('budgeted_amount,actual_cost,pct_complete,billed_to_date')
      .eq('project_id', project.id).then(({ data }) => {
        if (data && data.length > 0) setSovSummary({
          totalBudget: data.reduce((s,r) => s+(r.budgeted_amount||0), 0),
          totalActual: data.reduce((s,r) => s+(r.actual_cost||0), 0),
          totalBilled: data.reduce((s,r) => s+(r.billed_to_date||0), 0),
          lineCount: data.length,
          avgPct: data.reduce((s,r) => s+(r.pct_complete||0), 0) / data.length,
        });
      });
  }, [project.id, showSov]);

  const handleDelete = async () => {
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    await supabase.from('lre_projects').delete().eq('id', project.id);
    onDeleted(project.id);
  };

  const btnStyle = (hoverColor) => ({
    padding:'4px 10px', fontSize:11, fontFamily:'var(--font-mono)',
    background:'var(--surface2)', border:'1px solid var(--border)',
    borderRadius:4, color:'var(--muted)', cursor:'pointer',
    onMouseEnter: e => { e.currentTarget.style.borderColor=hoverColor; e.currentTarget.style.color=hoverColor; },
    onMouseLeave: e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--muted)'; },
  });

  return (
    <>
      {showSov && <SovEditor projectId={project.id} originalContract={revised} onClose={() => setShowSov(false)} />}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
        {/* Header */}
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
              <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:16 }}>{project.name}</span>
              <StatusPill status={project.status} />
            </div>
            <div style={{ color:'var(--muted)', fontSize:11 }}>
              {project.client && <span>{project.client}</span>}
              {project.awarded_by && <span> · Awarded by {project.awarded_by}</span>}
              {project.superintendent && <span> · Super: {project.superintendent}</span>}
              {project.crew_size && <span> · 👷 {project.crew_size}</span>}
            </div>
          </div>
          <div style={{ display:'flex', gap:6, flexShrink:0 }}>
            <button onClick={() => onEdit(project)}
              onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.color='var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--muted)'; }}
              style={{ padding:'4px 10px', fontSize:11, fontFamily:'var(--font-mono)', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:4, color:'var(--muted)', cursor:'pointer' }}>Edit</button>
            <button onClick={handleDelete}
              onMouseEnter={e => { e.currentTarget.style.borderColor='var(--lost)'; e.currentTarget.style.color='var(--lost)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--muted)'; }}
              style={{ padding:'4px 10px', fontSize:11, fontFamily:'var(--font-mono)', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:4, color:'var(--muted)', cursor:'pointer' }}>Delete</button>
          </div>
        </div>

        {/* Financials */}
        <div style={{ padding:'14px 18px', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:12, borderBottom:'1px solid var(--border)' }}>
          {[
            ['Original Contract', fmtFull$(project.original_contract||0), 'var(--text)'],
            ['Approved COs',      fmtFull$(project.approved_cos||0), project.approved_cos > 0 ? '#e8c547' : 'var(--muted)'],
            ['Revised Contract',  fmtFull$(revised), 'var(--accent)'],
            ['Actual Cost',       fmtFull$(project.actual_cost||0), burnPct > 90 ? 'var(--lost)' : burnPct > 70 ? '#f97316' : 'var(--text)'],
            ['Remaining',         fmtFull$(remaining), remaining < 0 ? 'var(--lost)' : 'var(--won)'],
          ].map(([label,val,color]) => (
            <div key={label}>
              <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3 }}>{label}</div>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:15, color }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Burn rate */}
        <div style={{ padding:'10px 18px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
            <span style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Cost Burn Rate</span>
            <span style={{ fontSize:11, fontWeight:600, color: burnPct > 100 ? 'var(--lost)' : burnPct > 85 ? '#f97316' : 'var(--text)' }}>{burnPct.toFixed(1)}%</span>
          </div>
          <ProgressBar value={burnPct} color={burnPct > 100 ? 'var(--lost)' : burnPct > 85 ? '#f97316' : 'var(--accent)'} />
        </div>

        {/* Footer */}
        <div style={{ padding:'12px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div style={{ display:'flex', gap:14, flexWrap:'wrap', fontSize:11, color:'var(--muted)' }}>
            {project.start_date && <span>Start: {project.start_date}</span>}
            {project.est_completion_date && <span>Est. Complete: {project.est_completion_date}</span>}
            {sovSummary && <span>SOV: {sovSummary.lineCount} items · {sovSummary.avgPct.toFixed(0)}% avg · {fmtFull$(sovSummary.totalBilled)} billed</span>}
          </div>
          <button onClick={() => setShowSov(true)} style={{ padding:'5px 12px', fontSize:11, fontFamily:'var(--font-mono)', background:'var(--accent-light)', border:'1px solid var(--accent)', borderRadius:4, color:'var(--accent)', cursor:'pointer', whiteSpace:'nowrap' }}>
            📋 Schedule of Values
          </button>
        </div>

        {project.notes && (
          <div style={{ padding:'8px 18px 12px', color:'var(--muted)', fontSize:11, borderTop:'1px solid var(--border)' }}>📝 {project.notes}</div>
        )}
      </div>
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Projects({ bids }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All');

  const wonBids = (bids || [])
    .filter(b => (b.effective_status || b.status) === 'Won')
    .sort((a, b) => (b.bid_date||'').localeCompare(a.bid_date||''));

  const fetchProjects = useCallback(async () => {
    const { data } = await supabase.from('lre_projects').select('*').order('created_at', { ascending: false });
    setProjects(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const handleSave = (p) => setProjects(prev => {
    const exists = prev.find(x => x.id === p.id);
    return exists ? prev.map(x => x.id === p.id ? p : x) : [p, ...prev];
  });

  const handleDeleted = (id) => setProjects(prev => prev.filter(p => p.id !== id));

  const filtered = statusFilter === 'All' ? projects : projects.filter(p => p.status === statusFilter);

  const activeRevised = projects
    .filter(p => ['Mobilizing','Active','Punch List'].includes(p.status))
    .reduce((s,p) => s + (p.original_contract||0) + (p.approved_cos||0), 0);
  const totalRevised = projects.reduce((s,p) => s + (p.original_contract||0) + (p.approved_cos||0), 0);

  return (
    <div className="page">
      {(modal === 'new' || (modal && modal.id)) && (
        <ProjectModal project={modal === 'new' ? null : modal} wonBids={wonBids} onClose={() => setModal(null)} onSave={handleSave} />
      )}

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi"><div className="kpi-label">Total Projects</div><div className="kpi-value accent">{projects.length}</div></div>
        <div className="kpi"><div className="kpi-label">Active Value</div><div className="kpi-value" style={{ fontSize:20, color:'var(--accent)' }}>{fmt$(activeRevised)}</div></div>
        <div className="kpi"><div className="kpi-label">Total Portfolio</div><div className="kpi-value" style={{ fontSize:20 }}>{fmt$(totalRevised)}</div></div>
        {['Active','Punch List','Complete'].map(s => (
          <div key={s} className="kpi">
            <div className="kpi-label">{s}</div>
            <div className="kpi-value" style={{ color: STATUS_COLORS[s].color, fontSize:22 }}>{projects.filter(p=>p.status===s).length}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display:'flex', gap:8, marginBottom:20, alignItems:'center', flexWrap:'wrap' }}>
        <span className="filter-label">Status</span>
        {['All',...STATUS_ORDER].map(s => (
          <button key={s} className={`year-btn ${statusFilter===s?'active':''}`} onClick={() => setStatusFilter(s)}>{s}</button>
        ))}
        <div style={{ marginLeft:'auto' }}>
          <button onClick={() => setModal('new')} style={{ padding:'7px 16px', background:'var(--accent)', border:'none', borderRadius:6, color:'#fff', fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600, cursor:'pointer' }}>+ New Project</button>
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" />Loading projects…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', color:'var(--muted)', padding:'48px 0' }}>
          <div style={{ fontSize:36, marginBottom:12 }}>🏗️</div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:16, marginBottom:8 }}>No projects yet</div>
          <div style={{ fontSize:13, marginBottom:20 }}>Create a project or mark a bid as Won to get started.</div>
          <button onClick={() => setModal('new')} style={{ padding:'8px 20px', background:'var(--accent)', border:'none', borderRadius:6, color:'#fff', fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600, cursor:'pointer' }}>+ New Project</button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {filtered.map(p => <ProjectCard key={p.id} project={p} wonBids={wonBids} onEdit={setModal} onDeleted={handleDeleted} />)}
        </div>
      )}
    </div>
  );
}
