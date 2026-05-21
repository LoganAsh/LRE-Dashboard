import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function addWeeks(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n * 7);
  return d.toISOString().split('T')[0];
}

function fmtWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const end = new Date(d); end.setDate(d.getDate() + 6);
  return `${d.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${end.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`;
}

const field = {
  width:'100%', padding:'7px 10px', background:'var(--surface)',
  border:'1px solid var(--border)', borderRadius:4, color:'var(--text)',
  fontFamily:'var(--font-mono)', fontSize:12, outline:'none', boxSizing:'border-box',
};

const Label = ({children}) => <label style={{display:'block',fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:5}}>{children}</label>;
const Section = ({title,action}) => (
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,marginTop:4,paddingBottom:6,borderBottom:'1px solid var(--border)'}}>
    <div style={{fontSize:11,color:'var(--accent)',textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:600}}>{title}</div>
    {action}
  </div>
);

// ── Roster & Equipment Admin Modal ────────────────────────────────────────────
function RosterModal({ onClose }) {
  const [crew, setCrew] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [tab, setTab] = useState('crew');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('lre_crew').select('*').order('name').then(({data}) => setCrew(data||[]));
    supabase.from('lre_equipment').select('*').order('name').then(({data}) => setEquipment(data||[]));
  }, []);

  const addCrew = () => setCrew(p => [...p, {id:null,name:'',role:'',phone:'',active:true}]);
  const addEquip = () => setEquipment(p => [...p, {id:null,name:'',type:'',unit_number:'',active:true}]);
  const updCrew = (i,k,v) => setCrew(p => p.map((r,idx) => idx===i?{...r,[k]:v}:r));
  const updEquip = (i,k,v) => setEquipment(p => p.map((r,idx) => idx===i?{...r,[k]:v}:r));

  const save = async () => {
    setSaving(true);
    for (const c of crew) {
      if (!c.name.trim()) continue;
      if (c.id) await supabase.from('lre_crew').update({name:c.name,role:c.role,phone:c.phone,active:c.active}).eq('id',c.id);
      else await supabase.from('lre_crew').insert({name:c.name,role:c.role||null,phone:c.phone||null,active:true});
    }
    for (const e of equipment) {
      if (!e.name.trim()) continue;
      if (e.id) await supabase.from('lre_equipment').update({name:e.name,type:e.type,unit_number:e.unit_number,active:e.active}).eq('id',e.id);
      else await supabase.from('lre_equipment').insert({name:e.name,type:e.type||null,unit_number:e.unit_number||null,active:true});
    }
    setSaving(false);
    onClose();
  };

  const col = {padding:'6px 8px',fontSize:11,fontFamily:'var(--font-mono)',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:3,color:'var(--text)',outline:'none',width:'100%',boxSizing:'border-box'};

  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,width:'100%',maxWidth:700,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 24px 64px rgba(0,0,0,0.7)'}}>
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:16}}>Roster & Equipment</div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'var(--muted)',fontSize:18,cursor:'pointer'}}>✕</button>
        </div>
        <div style={{display:'flex',gap:0,borderBottom:'1px solid var(--border)',flexShrink:0}}>
          {['crew','equipment'].map(t => (
            <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:'10px',fontFamily:'var(--font-display)',fontSize:12,fontWeight:600,cursor:'pointer',background:'none',border:'none',borderBottom:`2px solid ${tab===t?'var(--accent)':'transparent'}`,color:tab===t?'var(--accent)':'var(--muted)',textTransform:'uppercase',letterSpacing:'0.06em'}}>
              {t==='crew'?'👷 Crew Roster':'🚛 Equipment Fleet'}
            </button>
          ))}
        </div>
        <div style={{overflowY:'auto',flex:1,padding:16}}>
          {tab==='crew' && (
            <>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Name','Role','Phone','Active'].map(h=><th key={h} style={{padding:'6px 8px',textAlign:'left',fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.08em',borderBottom:'1px solid var(--border)'}}>{h}</th>)}</tr></thead>
                <tbody>
                  {crew.map((c,i)=>(
                    <tr key={i} style={{borderBottom:'1px solid var(--border)'}}>
                      <td style={{padding:'6px 6px'}}><input value={c.name} onChange={e=>updCrew(i,'name',e.target.value)} style={col} placeholder="Full name" /></td>
                      <td style={{padding:'6px 6px'}}><input value={c.role||''} onChange={e=>updCrew(i,'role',e.target.value)} style={col} placeholder="Operator, Laborer…" /></td>
                      <td style={{padding:'6px 6px'}}><input value={c.phone||''} onChange={e=>updCrew(i,'phone',e.target.value)} style={col} placeholder="Phone" /></td>
                      <td style={{padding:'6px 6px',textAlign:'center'}}><input type="checkbox" checked={c.active} onChange={e=>updCrew(i,'active',e.target.checked)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addCrew} style={{marginTop:10,padding:'6px 14px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:4,color:'var(--muted)',fontFamily:'var(--font-mono)',fontSize:11,cursor:'pointer'}}>+ Add Crew Member</button>
            </>
          )}
          {tab==='equipment' && (
            <>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Name / Description','Type','Unit #','Active'].map(h=><th key={h} style={{padding:'6px 8px',textAlign:'left',fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.08em',borderBottom:'1px solid var(--border)'}}>{h}</th>)}</tr></thead>
                <tbody>
                  {equipment.map((e,i)=>(
                    <tr key={i} style={{borderBottom:'1px solid var(--border)'}}>
                      <td style={{padding:'6px 6px'}}><input value={e.name} onChange={x=>updEquip(i,'name',x.target.value)} style={col} placeholder="Cat 336 Excavator…" /></td>
                      <td style={{padding:'6px 6px'}}><input value={e.type||''} onChange={x=>updEquip(i,'type',x.target.value)} style={col} placeholder="Excavator, Dozer…" /></td>
                      <td style={{padding:'6px 6px'}}><input value={e.unit_number||''} onChange={x=>updEquip(i,'unit_number',x.target.value)} style={col} placeholder="Unit #" /></td>
                      <td style={{padding:'6px 6px',textAlign:'center'}}><input type="checkbox" checked={e.active} onChange={x=>updEquip(i,'active',x.target.checked)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addEquip} style={{marginTop:10,padding:'6px 14px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:4,color:'var(--muted)',fontFamily:'var(--font-mono)',fontSize:11,cursor:'pointer'}}>+ Add Equipment</button>
            </>
          )}
        </div>
        <div style={{padding:'12px 20px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'flex-end',gap:10,flexShrink:0}}>
          <button onClick={onClose} style={{padding:'7px 14px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:4,color:'var(--muted)',fontFamily:'var(--font-mono)',fontSize:12,cursor:'pointer'}}>Cancel</button>
          <button onClick={save} disabled={saving} style={{padding:'7px 20px',background:'var(--accent)',border:'none',borderRadius:4,color:'#fff',fontFamily:'var(--font-mono)',fontSize:12,fontWeight:600,cursor:saving?'not-allowed':'pointer',opacity:saving?0.7:1}}>{saving?'Saving…':'Save Roster'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Weekly Plan Editor ────────────────────────────────────────────────────────
function PlanEditor({ plan, project, sovCategories, allCrew, allEquipment, allProjects, onClose, onSaved }) {
  const [foreman, setForeman] = useState(plan?.foreman || project?.foreman || '');
  const [notes, setNotes] = useState(plan?.notes || '');
  const [workItems, setWorkItems] = useState([]);
  const [crewList, setCrewList] = useState([]);
  const [equipList, setEquipList] = useState([]);
  const [saving, setSaving] = useState(false);
  const isNew = !plan?.id;

  useEffect(() => {
    if (!isNew) {
      supabase.from('lre_plan_work_items').select('*, lre_plan_checklist(*)').eq('plan_id', plan.id).order('sort_order').then(({data}) => {
        setWorkItems((data||[]).map(w => ({ ...w, checklist: (w.lre_plan_checklist||[]).sort((a,b)=>a.sort_order-b.sort_order) })));
      });
      supabase.from('lre_plan_crew').select('*, lre_crew(*)').eq('plan_id', plan.id).then(({data}) => setCrewList(data||[]));
      supabase.from('lre_plan_equipment').select('*, lre_equipment(*)').eq('plan_id', plan.id).then(({data}) => setEquipList(data||[]));
    }
  }, [plan?.id]);

  // Work items
  const addWork = () => setWorkItems(p => [...p, {id:null,plan_id:plan?.id,sort_order:p.length,sov_category:'',description:'',notes:'',checklist:[]}]);
  const updWork = (i,k,v) => setWorkItems(p => p.map((r,idx)=>idx===i?{...r,[k]:v}:r));
  const removeWork = (i) => setWorkItems(p => p.filter((_,idx)=>idx!==i));
  const addCheck = (wi) => setWorkItems(p => p.map((r,idx)=>idx===wi?{...r,checklist:[...r.checklist,{id:null,description:'',completed:false}]}:r));
  const updCheck = (wi,ci,k,v) => setWorkItems(p => p.map((r,ri)=>ri===wi?{...r,checklist:r.checklist.map((c,idx)=>idx===ci?{...c,[k]:v}:c)}:r));
  const removeCheck = (wi,ci) => setWorkItems(p => p.map((r,ri)=>ri===wi?{...r,checklist:r.checklist.filter((_,idx)=>idx!==ci)}:r));

  // Crew
  const addCrewMember = (crewId) => {
    if (!crewId || crewList.find(c=>String(c.crew_id)===crewId)) return;
    const member = allCrew.find(c=>String(c.id)===crewId);
    setCrewList(p => [...p, {id:null,plan_id:plan?.id,crew_id:parseInt(crewId),role_override:'',lre_crew:member}]);
  };
  const removeCrew = (i) => setCrewList(p => p.filter((_,idx)=>idx!==i));
  const updCrewRole = (i,v) => setCrewList(p => p.map((r,idx)=>idx===i?{...r,role_override:v}:r));

  // Equipment
  const addEquipment = (eqId) => {
    if (!eqId || equipList.find(e=>String(e.equipment_id)===eqId)) return;
    const eq = allEquipment.find(e=>String(e.id)===eqId);
    setEquipList(p => [...p, {id:null,plan_id:plan?.id,equipment_id:parseInt(eqId),project_id:project.id,notes:'',lre_equipment:eq}]);
  };
  const removeEquip = (i) => setEquipList(p => p.filter((_,idx)=>idx!==i));
  const updEquip = (i,k,v) => setEquipList(p => p.map((r,idx)=>idx===i?{...r,[k]:v}:r));

  const handleSave = async () => {
    setSaving(true);
    let planId = plan?.id;

    if (isNew) {
      const {data} = await supabase.from('lre_weekly_plans').insert({project_id:project.id,week_start:plan.week_start,foreman,notes}).select().single();
      planId = data.id;
    } else {
      await supabase.from('lre_weekly_plans').update({foreman,notes}).eq('id',planId);
      await supabase.from('lre_plan_work_items').delete().eq('plan_id',planId);
      await supabase.from('lre_plan_crew').delete().eq('plan_id',planId);
      await supabase.from('lre_plan_equipment').delete().eq('plan_id',planId);
    }

    // Insert work items + checklists
    for (let i=0; i<workItems.length; i++) {
      const w = workItems[i];
      if (!w.description.trim()) continue;
      const {data:wi} = await supabase.from('lre_plan_work_items').insert({plan_id:planId,sort_order:i,sov_category:w.sov_category||null,description:w.description,notes:w.notes||null}).select().single();
      const checks = w.checklist.filter(c=>c.description.trim()).map((c,ci)=>({work_item_id:wi.id,sort_order:ci,description:c.description,completed:c.completed||false}));
      if (checks.length) await supabase.from('lre_plan_checklist').insert(checks);
    }

    // Insert crew
    const crewInsert = crewList.map(c=>({plan_id:planId,crew_id:c.crew_id,role_override:c.role_override||null}));
    if (crewInsert.length) await supabase.from('lre_plan_crew').insert(crewInsert);

    // Insert equipment
    const equipInsert = equipList.map(e=>({plan_id:planId,equipment_id:e.equipment_id,project_id:e.project_id||null,notes:e.notes||null}));
    if (equipInsert.length) await supabase.from('lre_plan_equipment').insert(equipInsert);

    setSaving(false);
    onSaved();
    onClose();
  };

  const availableCrew = allCrew.filter(c => c.active && !crewList.find(cl=>cl.crew_id===c.id));
  const availableEquip = allEquipment.filter(e => e.active && !equipList.find(el=>el.equipment_id===e.id));

  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.78)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div className="modal-inner" style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,width:'100%',maxWidth:680,maxHeight:'92vh',overflowY:'auto',boxShadow:'0 24px 64px rgba(0,0,0,0.7)'}}>
        {/* Header */}
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,background:'var(--surface)',zIndex:1}}>
          <div>
            <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:15}}>{project.name}</div>
            <div style={{color:'var(--muted)',fontSize:11,marginTop:2}}>Weekly Plan · {fmtWeek(plan.week_start)}</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'var(--muted)',fontSize:18,cursor:'pointer'}}>✕</button>
        </div>

        <div style={{padding:20,display:'flex',flexDirection:'column',gap:20}}>

          {/* Foreman + Notes */}
          <div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <div><Label>Foreman</Label><input value={foreman} onChange={e=>setForeman(e.target.value)} style={field} placeholder="Foreman name" /></div>
            </div>
            <Label>Weekly Notes / Goals</Label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} style={{...field,resize:'vertical',lineHeight:1.6}} placeholder="Overall goals for the week…" />
          </div>

          {/* Work Items */}
          <div>
            <Section title="Work Items" action={
              <button onClick={addWork} style={{padding:'4px 10px',fontSize:11,fontFamily:'var(--font-mono)',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:4,color:'var(--muted)',cursor:'pointer'}}>+ Add</button>
            }/>
            {workItems.length===0 && <div style={{color:'var(--muted)',fontSize:12,padding:'8px 0'}}>No work items yet. Add the tasks planned for this week.</div>}
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {workItems.map((w,wi)=>(
                <div key={wi} style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:14}}>
                  <div style={{display:'flex',gap:8,marginBottom:8}}>
                    <select value={w.sov_category||''} onChange={e=>updWork(wi,'sov_category',e.target.value)} style={{...field,flex:'0 0 180px'}}>
                      <option value="">Free text / other</option>
                      {sovCategories.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                    <input value={w.description} onChange={e=>updWork(wi,'description',e.target.value)} style={{...field,flex:1}} placeholder="Work description…" />
                    <button onClick={()=>removeWork(wi)} style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:16,flexShrink:0}} onMouseEnter={e=>e.currentTarget.style.color='var(--lost)'} onMouseLeave={e=>e.currentTarget.style.color='var(--muted)'}>✕</button>
                  </div>
                  <textarea value={w.notes||''} onChange={e=>updWork(wi,'notes',e.target.value)} rows={1} style={{...field,resize:'vertical',lineHeight:1.6,marginBottom:8,fontSize:11}} placeholder="Notes for this work item…" />
                  {/* Checklist */}
                  <div style={{display:'flex',flexDirection:'column',gap:5}}>
                    {w.checklist.map((c,ci)=>(
                      <div key={ci} style={{display:'flex',alignItems:'center',gap:8}}>
                        <input type="checkbox" checked={c.completed} onChange={e=>updCheck(wi,ci,'completed',e.target.checked)} style={{flexShrink:0}} />
                        <input value={c.description} onChange={e=>updCheck(wi,ci,'description',e.target.value)} style={{...field,fontSize:11,textDecoration:c.completed?'line-through':'none',color:c.completed?'var(--muted)':'var(--text)'}} placeholder="Checklist item…" />
                        <button onClick={()=>removeCheck(wi,ci)} style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:13,flexShrink:0}} onMouseEnter={e=>e.currentTarget.style.color='var(--lost)'} onMouseLeave={e=>e.currentTarget.style.color='var(--muted)'}>✕</button>
                      </div>
                    ))}
                    <button onClick={()=>addCheck(wi)} style={{alignSelf:'flex-start',padding:'3px 10px',fontSize:10,fontFamily:'var(--font-mono)',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:3,color:'var(--muted)',cursor:'pointer',marginTop:2}}>+ Checklist item</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Crew */}
          <div>
            <Section title="Crew This Week" action={
              availableCrew.length > 0 ? (
                <select defaultValue="" onChange={e=>{addCrewMember(e.target.value);e.target.value='';}} style={{...field,width:'auto',fontSize:11,padding:'4px 8px'}}>
                  <option value="">+ Add crew member</option>
                  {availableCrew.map(c=><option key={c.id} value={c.id}>{c.name} {c.role?`(${c.role})`:''}</option>)}
                </select>
              ) : null
            }/>
            {crewList.length===0 && <div style={{color:'var(--muted)',fontSize:12,padding:'4px 0'}}>No crew assigned yet.</div>}
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {crewList.map((c,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,background:'var(--surface2)',borderRadius:6,padding:'8px 12px'}}>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:13}}>{c.lre_crew?.name||'—'}</div>
                    <div style={{color:'var(--muted)',fontSize:11}}>{c.lre_crew?.role||''}{c.lre_crew?.phone?` · ${c.lre_crew.phone}`:''}</div>
                  </div>
                  <input value={c.role_override||''} onChange={e=>updCrewRole(i,e.target.value)} style={{...field,width:140,fontSize:11}} placeholder="Role override" />
                  <button onClick={()=>removeCrew(i)} style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:14}} onMouseEnter={e=>e.currentTarget.style.color='var(--lost)'} onMouseLeave={e=>e.currentTarget.style.color='var(--muted)'}>✕</button>
                </div>
              ))}
            </div>
          </div>

          {/* Equipment */}
          <div>
            <Section title="Equipment This Week" action={
              availableEquip.length > 0 ? (
                <select defaultValue="" onChange={e=>{addEquipment(e.target.value);e.target.value='';}} style={{...field,width:'auto',fontSize:11,padding:'4px 8px'}}>
                  <option value="">+ Add equipment</option>
                  {availableEquip.map(e=><option key={e.id} value={e.id}>{e.name}{e.unit_number?` #${e.unit_number}`:''}</option>)}
                </select>
              ) : null
            }/>
            {equipList.length===0 && <div style={{color:'var(--muted)',fontSize:12,padding:'4px 0'}}>No equipment assigned yet.</div>}
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {equipList.map((e,i)=>(
                <div key={i} style={{background:'var(--surface2)',borderRadius:6,padding:'10px 12px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                    <div style={{flex:1}}>
                      <span style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:13}}>{e.lre_equipment?.name||'—'}</span>
                      {e.lre_equipment?.unit_number && <span style={{color:'var(--muted)',fontSize:11}}> · #{e.lre_equipment.unit_number}</span>}
                      {e.lre_equipment?.type && <span style={{color:'var(--muted)',fontSize:11}}> · {e.lre_equipment.type}</span>}
                    </div>
                    <button onClick={()=>removeEquip(i)} style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:14}} onMouseEnter={e=>e.currentTarget.style.color='var(--lost)'} onMouseLeave={e=>e.currentTarget.style.color='var(--muted)'}>✕</button>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <div>
                      <Label>Assigned to Job</Label>
                      <select value={e.project_id||''} onChange={x=>updEquip(i,'project_id',x.target.value?parseInt(x.target.value):null)} style={{...field,fontSize:11}}>
                        <option value="">— Select project —</option>
                        {allProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <input value={e.notes||''} onChange={x=>updEquip(i,'notes',x.target.value)} style={{...field,fontSize:11}} placeholder="Any notes…" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{display:'flex',gap:8,paddingTop:4}}>
            <button onClick={onClose} style={{flex:1,padding:'9px 0',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:4,color:'var(--muted)',fontFamily:'var(--font-mono)',fontSize:12,cursor:'pointer'}}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{flex:2,padding:'9px 0',background:'var(--accent)',border:'none',borderRadius:4,color:'#fff',fontFamily:'var(--font-mono)',fontSize:12,fontWeight:600,cursor:saving?'not-allowed':'pointer',opacity:saving?0.7:1}}>{saving?'Saving…':'Save Plan'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Plan View Card ────────────────────────────────────────────────────────────
function PlanCard({ plan, project, sovCategories, allCrew, allEquipment, allProjects, onEdit, onDeleted }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState(null);
  const [toggling, setToggling] = useState(false);

  const loadDetail = useCallback(async () => {
    const [{data:wi},{data:crew},{data:equip}] = await Promise.all([
      supabase.from('lre_plan_work_items').select('*,lre_plan_checklist(*)').eq('plan_id',plan.id).order('sort_order'),
      supabase.from('lre_plan_crew').select('*,lre_crew(*)').eq('plan_id',plan.id),
      supabase.from('lre_plan_equipment').select('*,lre_equipment(*),lre_projects(name)').eq('plan_id',plan.id),
    ]);
    setDetail({
      workItems: (wi||[]).map(w=>({...w,checklist:(w.lre_plan_checklist||[]).sort((a,b)=>a.sort_order-b.sort_order)})),
      crew: crew||[],
      equipment: equip||[],
    });
  }, [plan.id]);

  useEffect(() => { if (expanded) loadDetail(); }, [expanded, loadDetail]);

  const toggleCheck = async (checkId, current) => {
    setToggling(true);
    await supabase.from('lre_plan_checklist').update({completed:!current, completed_at:!current?new Date().toISOString():null}).eq('id',checkId);
    await loadDetail();
    setToggling(false);
  };

  const handleDelete = async () => {
    if (!confirm('Delete this weekly plan?')) return;
    await supabase.from('lre_weekly_plans').delete().eq('id',plan.id);
    onDeleted(plan.id);
  };

  const totalItems = detail?.workItems.reduce((s,w)=>s+w.checklist.length,0)||0;
  const doneItems  = detail?.workItems.reduce((s,w)=>s+w.checklist.filter(c=>c.completed).length,0)||0;
  const pct = totalItems > 0 ? Math.round(doneItems/totalItems*100) : 0;

  return (
    <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,overflow:'hidden'}}>
      <div style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer'}} onClick={()=>setExpanded(v=>!v)}>
        <span style={{fontSize:14,color:'var(--muted)',transition:'transform 0.2s',transform:expanded?'rotate(90deg)':'none'}}>▶</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:14}}>{fmtWeek(plan.week_start)}</div>
          <div style={{color:'var(--muted)',fontSize:11,marginTop:1}}>
            {plan.foreman && <span>Foreman: {plan.foreman}</span>}
            {totalItems > 0 && <span style={{marginLeft:10}}>{doneItems}/{totalItems} tasks · {pct}% complete</span>}
          </div>
        </div>
        {totalItems > 0 && (
          <div style={{width:80,flexShrink:0}}>
            <div style={{height:4,background:'var(--surface2)',borderRadius:2,overflow:'hidden'}}>
              <div style={{width:`${pct}%`,height:'100%',background:pct===100?'var(--won)':'var(--accent)',borderRadius:2,transition:'width 0.3s'}} />
            </div>
          </div>
        )}
        <div style={{display:'flex',gap:6}} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>onEdit(plan)} style={{padding:'3px 8px',fontSize:11,fontFamily:'var(--font-mono)',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:3,color:'var(--muted)',cursor:'pointer'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent)';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--muted)';}}>Edit</button>
          <button onClick={handleDelete} style={{padding:'3px 8px',fontSize:11,fontFamily:'var(--font-mono)',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:3,color:'var(--muted)',cursor:'pointer'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--lost)';e.currentTarget.style.color='var(--lost)';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--muted)';}}>Delete</button>
        </div>
      </div>

      {expanded && detail && (
        <div style={{borderTop:'1px solid var(--border)',padding:'14px 16px',display:'flex',flexDirection:'column',gap:16}}>
          {plan.notes && <div style={{color:'var(--muted)',fontSize:12,fontStyle:'italic'}}>📝 {plan.notes}</div>}

          {/* Work items */}
          {detail.workItems.length > 0 && (
            <div>
              <div style={{fontSize:10,color:'var(--accent)',textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:600,marginBottom:8}}>Work Items</div>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {detail.workItems.map(w=>(
                  <div key={w.id} style={{background:'var(--surface2)',borderRadius:6,padding:'10px 12px'}}>
                    <div style={{display:'flex',gap:8,alignItems:'baseline',marginBottom:4}}>
                      {w.sov_category && <span style={{fontSize:10,padding:'1px 6px',background:'rgba(59,111,232,0.15)',border:'1px solid rgba(59,111,232,0.3)',borderRadius:3,color:'var(--accent)',whiteSpace:'nowrap'}}>{w.sov_category}</span>}
                      <span style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:13}}>{w.description}</span>
                    </div>
                    {w.notes && <div style={{color:'var(--muted)',fontSize:11,marginBottom:6}}>{w.notes}</div>}
                    {w.checklist.length > 0 && (
                      <div style={{display:'flex',flexDirection:'column',gap:4,marginTop:6}}>
                        {w.checklist.map(c=>(
                          <label key={c.id} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                            <input type="checkbox" checked={c.completed} disabled={toggling}
                              onChange={()=>toggleCheck(c.id,c.completed)}
                              style={{flexShrink:0,width:15,height:15,cursor:'pointer'}} />
                            <span style={{fontSize:12,textDecoration:c.completed?'line-through':'none',color:c.completed?'var(--muted)':'var(--text)'}}>{c.description}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Crew */}
          {detail.crew.length > 0 && (
            <div>
              <div style={{fontSize:10,color:'var(--accent)',textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:600,marginBottom:8}}>Crew ({detail.crew.length})</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {detail.crew.map(c=>(
                  <div key={c.id} style={{padding:'5px 10px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:6,fontSize:12}}>
                    <span style={{fontWeight:600}}>{c.lre_crew?.name||'—'}</span>
                    <span style={{color:'var(--muted)',marginLeft:6}}>{c.role_override||c.lre_crew?.role||''}</span>
                    {c.lre_crew?.phone && <span style={{color:'var(--muted)',marginLeft:6,fontSize:10}}>{c.lre_crew.phone}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Equipment */}
          {detail.equipment.length > 0 && (
            <div>
              <div style={{fontSize:10,color:'var(--accent)',textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:600,marginBottom:8}}>Equipment ({detail.equipment.length})</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {detail.equipment.map(e=>(
                  <div key={e.id} style={{padding:'5px 10px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:6,fontSize:12}}>
                    <span style={{fontWeight:600}}>{e.lre_equipment?.name||'—'}</span>
                    {e.lre_equipment?.unit_number && <span style={{color:'var(--muted)',marginLeft:4}}>#{e.lre_equipment.unit_number}</span>}
                    {e.lre_projects?.name && <span style={{color:'var(--accent)',marginLeft:6,fontSize:11}}>→ {e.lre_projects.name}</span>}
                    {e.notes && <span style={{color:'var(--muted)',marginLeft:6,fontSize:11}}>{e.notes}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Project Weekly Plans View ─────────────────────────────────────────────────
function ProjectPlans({ project, allCrew, allEquipment, allProjects }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [sovCategories, setSovCategories] = useState([]);
  const [weekStart, setWeekStart] = useState(getMonday());

  useEffect(() => {
    supabase.from('lre_weekly_plans').select('*').eq('project_id',project.id).order('week_start',{ascending:false}).then(({data})=>{setPlans(data||[]);setLoading(false);});
    supabase.from('lre_sov').select('category').eq('project_id',project.id).then(({data})=>setSovCategories((data||[]).map(r=>r.category)));
  }, [project.id]);

  const handleNewPlan = () => {
    const existing = plans.find(p=>p.week_start===weekStart);
    if (existing) { setEditing(existing); return; }
    setEditing({week_start:weekStart, project_id:project.id});
  };

  const handleEdit = (plan) => setEditing(plan);
  const handleSaved = async () => {
    const {data} = await supabase.from('lre_weekly_plans').select('*').eq('project_id',project.id).order('week_start',{ascending:false});
    setPlans(data||[]);
  };
  const handleDeleted = (id) => setPlans(p=>p.filter(x=>x.id!==id));

  return (
    <div style={{padding:'12px 0'}}>
      {editing && (
        <PlanEditor plan={editing} project={project} sovCategories={sovCategories} allCrew={allCrew} allEquipment={allEquipment} allProjects={allProjects} onClose={()=>setEditing(null)} onSaved={handleSaved} />
      )}

      <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:14,flexWrap:'wrap'}}>
        <div>
          <Label>Week of</Label>
          <input type="date" value={weekStart} onChange={e=>setWeekStart(getMonday(new Date(e.target.value+'T00:00:00')))} style={{...{width:'100%',padding:'6px 10px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:4,color:'var(--text)',fontFamily:'var(--font-mono)',fontSize:12,outline:'none'},width:160,colorScheme:'dark'}} />
        </div>
        <div style={{alignSelf:'flex-end'}}>
          <button onClick={handleNewPlan} style={{padding:'7px 14px',background:'var(--accent)',border:'none',borderRadius:6,color:'#fff',fontFamily:'var(--font-mono)',fontSize:12,fontWeight:600,cursor:'pointer'}}>
            {plans.find(p=>p.week_start===weekStart) ? '✏️ Edit This Week' : '+ New Week Plan'}
          </button>
        </div>
        <div style={{display:'flex',gap:6,alignSelf:'flex-end'}}>
          <button onClick={()=>setWeekStart(addWeeks(weekStart,-1))} style={{padding:'6px 10px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:4,color:'var(--muted)',fontFamily:'var(--font-mono)',fontSize:11,cursor:'pointer'}}>← Prev</button>
          <button onClick={()=>setWeekStart(addWeeks(weekStart,1))} style={{padding:'6px 10px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:4,color:'var(--muted)',fontFamily:'var(--font-mono)',fontSize:11,cursor:'pointer'}}>Next →</button>
        </div>
      </div>

      {loading ? <div style={{color:'var(--muted)',fontSize:12}}>Loading plans…</div>
        : plans.length === 0 ? <div style={{color:'var(--muted)',fontSize:12,padding:'12px 0'}}>No weekly plans yet for this project.</div>
        : <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {plans.map(p=>(
              <PlanCard key={p.id} plan={p} project={project} sovCategories={sovCategories} allCrew={allCrew} allEquipment={allEquipment} allProjects={allProjects} onEdit={handleEdit} onDeleted={handleDeleted} />
            ))}
          </div>
      }
    </div>
  );
}

// ── Main Weekly Schedule Page ─────────────────────────────────────────────────
export default function WeeklySchedule() {
  const [projects, setProjects] = useState([]);
  const [allCrew, setAllCrew] = useState([]);
  const [allEquipment, setAllEquipment] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showRoster, setShowRoster] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [{ data: proj }, { data: crew }, { data: equip }] = await Promise.all([
      supabase.from('lre_projects').select('id,name,foreman,status').order('created_at',{ascending:false}),
      supabase.from('lre_crew').select('*').eq('active',true).order('name'),
      supabase.from('lre_equipment').select('*').eq('active',true).order('name'),
    ]);
    setProjects(proj||[]);
    setAllCrew(crew||[]);
    setAllEquipment(equip||[]);
    if (!selectedProject && proj?.length) setSelectedProject(proj[0]);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const activeProjects = projects.filter(p => ['Not Started','Mobilizing','Active','Punch List'].includes(p.status));

  return (
    <div className="page">
      {showRoster && <RosterModal onClose={() => { setShowRoster(false); reload(); }} />}

      {/* Header controls */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20,flexWrap:'wrap'}}>
        <div style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:20,flex:1}}>Weekly Schedule</div>
        <button onClick={()=>setShowRoster(true)} style={{padding:'7px 14px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:6,color:'var(--muted)',fontFamily:'var(--font-mono)',fontSize:11,cursor:'pointer'}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent)';}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--muted)';}}>
          👷 Manage Roster & Fleet
        </button>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"/>Loading…</div>
      ) : activeProjects.length === 0 ? (
        <div style={{textAlign:'center',color:'var(--muted)',padding:'48px 0'}}>
          <div style={{fontSize:36,marginBottom:12}}>📅</div>
          <div style={{fontFamily:'var(--font-display)',fontSize:16,marginBottom:8}}>No active projects</div>
          <div style={{fontSize:13}}>Create a project in the Projects tab to get started.</div>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:20,alignItems:'start'}}>
          {/* Project list sidebar */}
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,overflow:'hidden',position:'sticky',top:70}}>
            <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:600}}>Projects</div>
            {activeProjects.map(p=>(
              <button key={p.id} onClick={()=>setSelectedProject(p)} style={{
                width:'100%',textAlign:'left',padding:'10px 14px',background:selectedProject?.id===p.id?'var(--accent-light)':'none',
                border:'none',borderBottom:'1px solid var(--border)',cursor:'pointer',
                borderLeft:`3px solid ${selectedProject?.id===p.id?'var(--accent)':'transparent'}`,
                color:selectedProject?.id===p.id?'var(--accent)':'var(--text)',transition:'all 0.15s',
              }}>
                <div style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</div>
                {p.foreman && <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>{p.foreman}</div>}
              </button>
            ))}
          </div>

          {/* Plans for selected project */}
          <div>
            {selectedProject ? (
              <>
                <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:17,marginBottom:4}}>{selectedProject.name}</div>
                <ProjectPlans project={selectedProject} allCrew={allCrew} allEquipment={allEquipment} allProjects={projects} />
              </>
            ) : (
              <div style={{color:'var(--muted)',fontSize:13}}>Select a project to view plans.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
