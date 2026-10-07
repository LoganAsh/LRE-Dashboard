import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUSES, isOverdue } from './projectTasks.js';
import { TaskCheck, DueLabel, AddInput, resetBtn } from './TaskParts.jsx';

const labelCls = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]';
const inputCls = cn(
  'h-9 w-full appearance-none rounded-lg border border-[color:var(--border)] bg-[var(--card)] px-3 text-[13px] text-[var(--text)]',
  'outline-none [font-family:inherit] transition-colors placeholder:text-[var(--text-subtle)] focus:border-[#ea580c]'
);

// Edits one task: title, status, due date, notes. Top-level tasks also manage their subtasks here.
export default function TaskEditor({ task, parent, subtasks = [], api, onClose }) {
  const [title, setTitle] = useState(task.title);
  const [status, setStatus] = useState(task.status);
  const [due, setDue] = useState(task.due_date || '');
  const [notes, setNotes] = useState(task.notes || '');
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const titleRef = useRef(null);
  const groupRef = useRef(null);

  useEffect(() => {                                   // the delete confirmation expires on its own
    if (!confirming) return;
    const id = setTimeout(() => setConfirming(false), 5000);
    return () => clearTimeout(id);
  }, [confirming]);

  const isSub = !!task.parent_id;
  const canSave = title.trim().length > 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    const patch = {};
    if (title.trim() !== task.title) patch.title = title.trim();
    if (status !== task.status) patch.status = status;
    if ((due || null) !== (task.due_date || null)) patch.due_date = due || null;
    if (notes.trim() !== (task.notes || '').trim()) patch.notes = notes.trim() || null;
    setSaving(true);
    const ok = Object.keys(patch).length ? await api.updateTask(task.id, patch) : true;
    setSaving(false);
    if (ok) onClose();
  };

  const remove = async () => {
    if (!confirming) { setConfirming(true); return; }
    const ok = await api.removeTask(task.id);
    if (ok) onClose();
  };

  const onStatusKey = (e) => {                        // arrow keys move between options, like a radio group
    const i = STATUSES.findIndex((s) => s.value === status);
    let n;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % STATUSES.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + STATUSES.length) % STATUSES.length;
    else return;
    e.preventDefault();
    setStatus(STATUSES[n].value);
    groupRef.current?.querySelector(`[data-status="${STATUSES[n].value}"]`)?.focus();
  };

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[250] bg-black/30 transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-[250] flex items-center justify-center p-4 max-sm:p-0">
          <Dialog.Popup
            initialFocus={titleRef}
            className={cn(
              'flex w-full max-w-[560px] flex-col overflow-hidden border border-[color:var(--border)] bg-[var(--card)] text-[var(--text)] outline-none',
              'sm:max-h-[90vh] sm:rounded-2xl max-sm:h-[100dvh] max-sm:rounded-none max-sm:border-0',
              'transition-[opacity,transform] duration-150 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0'
            )}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[color:var(--border)] px-6 py-4">
              <div className="min-w-0">
                <Dialog.Title className="text-[17px] font-semibold leading-snug tracking-tight">{isSub ? 'Edit Subtask' : 'Edit Task'}</Dialog.Title>
                <Dialog.Description className="mt-0.5 truncate text-xs text-[var(--text-subtle)]">
                  {isSub && parent ? `Subtask of ${parent.title}` : 'Changes here save when you press Save Changes.'}
                </Dialog.Description>
              </div>
              <Dialog.Close aria-label="Close" className="-mr-2 -mt-1 flex size-8 shrink-0 appearance-none items-center justify-center rounded-lg border-0 bg-transparent text-[var(--text-subtle)] transition-colors hover:text-[var(--text)] cursor-pointer">
                <X className="size-4" strokeWidth={1.75} />
              </Dialog.Close>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <div>
                <label htmlFor="task-title" className={labelCls}>Title</label>
                <input id="task-title" ref={titleRef} type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); save(); } }}
                  aria-invalid={!title.trim()} className={cn(inputCls, !title.trim() && 'border-[color:var(--lost)]')} />
              </div>

              <div>
                <span id="task-status-label" className={labelCls}>Status</span>
                <div ref={groupRef} role="radiogroup" aria-labelledby="task-status-label" onKeyDown={onStatusKey} className="flex flex-wrap gap-x-6 gap-y-2">
                  {STATUSES.map((s) => {
                    const on = status === s.value;
                    return (
                      <button
                        key={s.value} type="button" role="radio" aria-checked={on} data-status={s.value} tabIndex={on ? 0 : -1}
                        onClick={() => setStatus(s.value)}
                        className={cn(
                          'inline-flex appearance-none items-center gap-2 border-0 border-b-2 bg-transparent pb-1 pt-0.5 text-[13px] [font-family:inherit] outline-none cursor-pointer transition-colors',
                          'focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[#ea580c]',
                          on ? 'font-semibold text-[var(--text)]' : 'font-medium text-[var(--text-subtle)] hover:text-[var(--text)]'
                        )}
                        style={{ borderBottomStyle: 'solid', borderBottomColor: on ? s.color : 'transparent' }}
                      >
                        <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                        {s.value}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="task-due" className={labelCls}>Due Date</label>
                <div className="flex items-center gap-4">
                  <input id="task-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className={cn(inputCls, 'w-[200px]')} />
                  {due && <button type="button" onClick={() => setDue('')} className={cn(resetBtn, 'text-xs font-medium text-[var(--text-subtle)] hover:text-[var(--text)] hover:underline')}>Clear Date</button>}
                </div>
              </div>

              <div>
                <label htmlFor="task-notes" className={labelCls}>Notes</label>
                <textarea id="task-notes" rows={4} placeholder="Add notes…" value={notes} onChange={(e) => setNotes(e.target.value)}
                  className={cn(inputCls, 'h-auto min-h-[96px] resize-y py-2 leading-relaxed')} />
              </div>

              {!isSub && (
                <div className="border-t border-[color:var(--border)] pt-5">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className={cn(labelCls, 'mb-0')}>Subtasks ({subtasks.length})</span>
                    <span className="text-[11px] text-[var(--text-subtle)]">Subtask changes save instantly</span>
                  </div>
                  <ul className="divide-y divide-[color:var(--border)]">
                    {subtasks.map((s) => (
                      <li key={s.id} className="flex items-center gap-3 py-2">
                        <TaskCheck done={s.status === 'Done'} label={`${s.status === 'Done' ? 'Mark not done' : 'Mark done'}: ${s.title}`} onToggle={() => api.updateTask(s.id, { status: s.status === 'Done' ? 'To Do' : 'Done' })} />
                        <span className={cn('min-w-0 flex-1 truncate text-[13px]', s.status === 'Done' && 'text-[var(--text-subtle)] line-through')}>{s.title}</span>
                        <DueLabel task={s} />
                        <button type="button" aria-label={`Delete subtask: ${s.title}`} onClick={() => api.removeTask(s.id)}
                          className={cn(resetBtn, 'flex size-6 items-center justify-center rounded text-[var(--text-subtle)] hover:text-[#b91c1c] dark:hover:text-[#f87171]')}>
                          <X className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <AddInput className="mt-2" label="Add a subtask" placeholder="Add a subtask…" onAdd={(t) => api.addTask(task.project_id, t, { parentId: task.id })} />
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[color:var(--border)] px-6 py-3.5">
              <button type="button" onClick={remove}
                className={cn(resetBtn, 'text-[13px] font-medium', confirming ? 'text-[#b91c1c] underline dark:text-[#f87171]' : 'text-[var(--text-subtle)] hover:text-[#b91c1c] dark:hover:text-[#f87171]')}>
                {confirming ? (isSub || subtasks.length === 0 ? 'Click Again to Delete' : `Click Again to Delete With ${subtasks.length} ${subtasks.length === 1 ? 'Subtask' : 'Subtasks'}`) : (isSub ? 'Delete Subtask' : 'Delete Task')}
              </button>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={onClose}
                  className="h-9 appearance-none rounded-lg border border-[color:var(--border)] bg-transparent px-4 text-[13px] font-medium text-[var(--text-secondary)] [font-family:inherit] outline-none cursor-pointer transition-colors hover:border-[color-mix(in_srgb,var(--text)_28%,transparent)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[#ea580c]">
                  Cancel
                </button>
                <button type="button" onClick={save} disabled={!canSave}
                  className="h-9 appearance-none rounded-lg border-0 bg-[#c2540a] px-5 text-[13px] font-semibold text-white [font-family:inherit] outline-none cursor-pointer transition-colors hover:bg-[#a8470a] focus-visible:ring-2 focus-visible:ring-[#ea580c] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
