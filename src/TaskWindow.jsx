import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUSES, treeFor, summarize, nextStatus } from './projectTasks.js';
import { TaskCheck, DueLabel, StatusDot, AddInput, resetBtn } from './TaskParts.jsx';
import TaskEditor from './TaskEditor.jsx';

const outlineBtn = 'h-8 appearance-none rounded-lg border border-[color:var(--border)] bg-transparent px-3.5 text-[12px] font-medium text-[var(--text-secondary)] [font-family:inherit] outline-none cursor-pointer whitespace-nowrap transition-colors hover:border-[color-mix(in_srgb,var(--text)_28%,transparent)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[#ea580c]';
const titleBtn = 'min-w-0 appearance-none border-0 bg-transparent p-0 text-left [font-family:inherit] outline-none cursor-pointer hover:text-[#c2540a] focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[#ea580c] dark:hover:text-[#fb923c]';

/* ── the strip on each project card ───────────────────────────────────────── */

export function TaskSummary({ stats, onOpen }) {
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  return (
    <div data-task-summary className="flex flex-wrap items-center gap-x-6 gap-y-2.5 border-b border-[color:var(--border)] px-[18px] py-3">
      <div className="min-w-[180px] flex-1">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Tasks</span>
          <span className="text-[11px] font-semibold tabular-nums">{stats.total === 0 ? 'No Tasks Yet' : `${stats.done} of ${stats.total} Done`}</span>
        </div>
        <div role="progressbar" aria-label="Tasks done" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
          className="h-1 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text)_8%,transparent)]">
          <div className="h-full rounded-full bg-[#16a34a] transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs">
        {stats.overdue > 0 && <span className="font-medium text-[#b91c1c] dark:text-[#f87171]">{stats.overdue} Overdue</span>}
        {stats.inProgress > 0 && <span className="text-[var(--text-secondary)]">{stats.inProgress} In Progress</span>}
      </div>
      <button type="button" onClick={onOpen} className={outlineBtn}>{stats.total === 0 ? 'Add Tasks' : 'Open Tasks'}</button>
    </div>
  );
}

/* ── list view ────────────────────────────────────────────────────────────── */

function SubtaskRow({ sub, api, onEdit }) {
  const done = sub.status === 'Done';
  return (
    <li className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-[color-mix(in_srgb,var(--text)_3%,transparent)]">
      <TaskCheck done={done} label={`${done ? 'Mark not done' : 'Mark done'}: ${sub.title}`} onToggle={() => api.updateTask(sub.id, { status: done ? 'To Do' : 'Done' })} />
      <button type="button" data-task-title onClick={() => onEdit(sub.id)} aria-haspopup="dialog"
        className={cn(titleBtn, 'flex-1 truncate text-[13px]', done ? 'text-[var(--text-subtle)] line-through' : 'text-[var(--text)]')}>{sub.title}</button>
      <DueLabel task={sub} />
    </li>
  );
}

function TaskRow({ task, expanded, addingSub, onToggleExpand, onStartSub, onEdit, api, project, hideDone }) {
  const done = task.status === 'Done';
  const subs = hideDone ? task.subtasks.filter((s) => s.status !== 'Done') : task.subtasks;
  const subsDone = task.subtasks.filter((s) => s.status === 'Done').length;
  const showSubs = expanded || addingSub;
  return (
    <li>
      <div className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[color-mix(in_srgb,var(--text)_3%,transparent)]">
        <TaskCheck done={done} label={`${done ? 'Mark not done' : 'Mark done'}: ${task.title}`} onToggle={() => api.updateTask(task.id, { status: done ? 'To Do' : 'Done' })} />
        <button type="button" data-task-title onClick={() => onEdit(task.id)} aria-haspopup="dialog"
          className={cn(titleBtn, 'flex-1 truncate text-[14px] font-medium', done ? 'text-[var(--text-subtle)] line-through' : 'text-[var(--text)]')}>{task.title}</button>

        {task.subtasks.length > 0 && (
          <button type="button" aria-expanded={expanded} aria-label={`${expanded ? 'Hide' : 'Show'} subtasks: ${task.title}`} onClick={() => onToggleExpand(task.id)}
            className={cn(resetBtn, 'inline-flex shrink-0 items-center gap-1 text-xs tabular-nums text-[var(--text-subtle)] hover:text-[var(--text)]')}>
            {expanded ? <ChevronDown className="size-3.5" strokeWidth={1.75} aria-hidden="true" /> : <ChevronRight className="size-3.5" strokeWidth={1.75} aria-hidden="true" />}
            {subsDone}/{task.subtasks.length}
          </button>
        )}
        <button type="button" onClick={() => onStartSub(task.id)} aria-label={`Add a subtask to: ${task.title}`}
          className={cn(resetBtn, 'hidden shrink-0 text-xs font-medium text-[var(--text-subtle)] hover:text-[#c2540a] md:inline md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100 dark:hover:text-[#fb923c]')}>
          + Subtask
        </button>
        <button type="button" onClick={() => api.updateTask(task.id, { status: nextStatus(task.status) })}
          aria-label={`Status: ${task.status}. Change to ${nextStatus(task.status)}: ${task.title}`} title="Click to change status"
          className={cn(resetBtn, 'inline-flex w-[92px] shrink-0 items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text)] max-sm:hidden')}>
          <StatusDot status={task.status} />{task.status}
        </button>
        <span className="flex w-[64px] shrink-0 justify-end max-sm:hidden"><DueLabel task={task} /></span>
      </div>

      {showSubs && (
        <div className="ml-[22px] border-l border-[color:var(--border)] pl-3">
          <ul>{subs.map((s) => <SubtaskRow key={s.id} sub={s} api={api} onEdit={onEdit} />)}</ul>
          <AddInput className="my-1.5 pl-2" label={`Add a subtask to ${task.title}`} placeholder="Add a subtask…" autoFocus={addingSub}
            onAdd={(t) => api.addTask(project.id, t, { parentId: task.id })} />
        </div>
      )}
    </li>
  );
}

/* ── board view ───────────────────────────────────────────────────────────── */

function BoardCard({ task, onEdit, api, dragId, setDragId }) {
  const idx = STATUSES.findIndex((s) => s.value === task.status);
  const prev = STATUSES[idx - 1]?.value, next = STATUSES[idx + 1]?.value;
  const subsDone = task.subtasks.filter((s) => s.status === 'Done').length;
  const done = task.status === 'Done';
  return (
    <article
      draggable data-task-id={task.id}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(task.id)); e.dataTransfer.effectAllowed = 'move'; setDragId(task.id); }}
      onDragEnd={() => setDragId(null)}
      className={cn('rounded-xl border border-[color:var(--border)] bg-[var(--card)] p-3 transition-opacity', dragId === task.id && 'opacity-40')}
    >
      <button type="button" data-task-title onClick={() => onEdit(task.id)} aria-haspopup="dialog"
        className={cn(titleBtn, 'block w-full text-[13.5px] font-medium leading-snug', done ? 'text-[var(--text-subtle)] line-through' : 'text-[var(--text)]')}>{task.title}</button>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[var(--text-subtle)]">
        <DueLabel task={task} />
        {task.subtasks.length > 0 && <span className="tabular-nums">{subsDone}/{task.subtasks.length} Subtasks</span>}
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-[color:var(--border)] pt-2">
        {prev ? (
          <button type="button" onClick={() => api.updateTask(task.id, { status: prev })} aria-label={`Move to ${prev}: ${task.title}`}
            className={cn(resetBtn, 'inline-flex items-center gap-1 text-[11px] text-[var(--text-subtle)] hover:text-[var(--text)]')}>
            <ChevronLeft className="size-3.5" strokeWidth={1.75} aria-hidden="true" />{prev}
          </button>
        ) : <span />}
        {next ? (
          <button type="button" onClick={() => api.updateTask(task.id, { status: next })} aria-label={`Move to ${next}: ${task.title}`}
            className={cn(resetBtn, 'inline-flex items-center gap-1 text-[11px] text-[var(--text-subtle)] hover:text-[var(--text)]')}>
            {next}<ChevronRight className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        ) : <span />}
      </div>
    </article>
  );
}

function Board({ tree, project, api, onEdit }) {
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);
  const drop = (e, status) => {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData('text/plain'));
    setOver(null); setDragId(null);
    const t = tree.find((x) => x.id === id);
    if (t && t.status !== status) api.updateTask(id, { status });
  };
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {STATUSES.map((s) => {
        const items = tree.filter((t) => t.status === s.value);
        return (
          <section
            key={s.value} aria-label={s.value} data-column={s.value}
            onDragOver={(e) => { e.preventDefault(); if (over !== s.value) setOver(s.value); }}
            onDragLeave={() => setOver((o) => (o === s.value ? null : o))}
            onDrop={(e) => drop(e, s.value)}
            className={cn('flex min-h-[220px] flex-col rounded-xl border p-3 transition-colors', over === s.value ? 'border-[#ea580c]' : 'border-[color:var(--border)]')}
          >
            <div className="mb-3 flex items-center gap-2 px-1">
              <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">{s.value}</h3>
              <span className="text-[11px] tabular-nums text-[var(--text-subtle)]">{items.length}</span>
            </div>
            {s.value === 'To Do' && <AddInput className="mb-3" label="Add a task" placeholder="Add a task…" onAdd={(t) => api.addTask(project.id, t)} />}
            <div className="flex flex-1 flex-col gap-2.5">
              {items.map((t) => <BoardCard key={t.id} task={t} api={api} onEdit={onEdit} dragId={dragId} setDragId={setDragId} />)}
              {items.length === 0 && <div className="py-6 text-center text-xs text-[var(--text-subtle)]">Nothing here{s.value === 'Done' ? ' yet' : ''}</div>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ── the window ───────────────────────────────────────────────────────────── */

export default function TaskWindow({ project, api, onClose }) {
  const [view, setView] = useState('list');
  const [hideDone, setHideDone] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const [addingSub, setAddingSub] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const tree = useMemo(() => treeFor(api.tasks, project.id), [api.tasks, project.id]);
  const stats = useMemo(() => summarize(api.tasks, project.id), [api.tasks, project.id]);
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  const everything = useMemo(() => tree.flatMap((t) => [t, ...t.subtasks]), [tree]);
  const editing = editingId != null ? everything.find((t) => t.id === editingId) : null;
  const editingParent = editing && editing.parent_id ? tree.find((t) => t.id === editing.parent_id) : null;
  const editingSubs = editing && !editing.parent_id ? (tree.find((t) => t.id === editing.id)?.subtasks || []) : [];
  useEffect(() => { if (editingId != null && !editing) setEditingId(null); }, [editingId, editing]);   // it was deleted

  const toggleExpand = (id) => setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const startSub = (id) => { setExpanded((prev) => new Set(prev).add(id)); setAddingSub(id); };
  const visible = hideDone ? tree.filter((t) => t.status !== 'Done') : tree;

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[200] bg-black/30 transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-[200] flex items-center justify-center p-4 max-sm:p-0">
          <Dialog.Popup className={cn(
            'flex w-full max-w-[960px] flex-col overflow-hidden border border-[color:var(--border)] bg-[var(--card)] text-[var(--text)] outline-none',
            'sm:h-[86vh] sm:rounded-2xl max-sm:h-[100dvh] max-sm:rounded-none max-sm:border-0',
            'transition-[opacity,transform] duration-150 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0'
          )}>
            <div className="shrink-0 border-b border-[color:var(--border)] px-6 pb-3 pt-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Dialog.Title className="truncate text-[19px] font-semibold leading-snug tracking-tight">{project.name}</Dialog.Title>
                  <Dialog.Description className="mt-0.5 text-xs text-[var(--text-subtle)]">
                    {stats.total === 0 ? 'No Tasks Yet' : `${stats.done} of ${stats.total} Tasks Done`}
                    {stats.subtasks > 0 ? ` · ${stats.subtasks} ${stats.subtasks === 1 ? 'Subtask' : 'Subtasks'}` : ''}
                    {stats.overdue > 0 ? <span className="font-medium text-[#b91c1c] dark:text-[#f87171]"> · {stats.overdue} Overdue</span> : null}
                  </Dialog.Description>
                </div>
                <Dialog.Close aria-label="Close" className="-mr-2 flex size-8 shrink-0 appearance-none items-center justify-center rounded-lg border-0 bg-transparent text-[var(--text-subtle)] transition-colors hover:text-[var(--text)] cursor-pointer">
                  <X className="size-4" strokeWidth={1.75} />
                </Dialog.Close>
              </div>
              <div role="progressbar" aria-label="Tasks done" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
                className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text)_8%,transparent)]">
                <div className="h-full rounded-full bg-[#16a34a] transition-[width] duration-300" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-4">
                <div role="tablist" aria-label="Task layout" className="flex items-center gap-5">
                  {[['list', 'List'], ['board', 'Board']].map(([v, label]) => (
                    <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
                      className={cn(resetBtn, 'border-b-2 pb-1.5 pt-1 text-[13px] transition-colors', view === v ? 'border-[#ea580c] font-semibold text-[var(--text)]' : 'border-transparent font-medium text-[var(--text-subtle)] hover:text-[var(--text)]')}
                      style={{ borderBottomStyle: 'solid' }}>{label}</button>
                  ))}
                </div>
                {view === 'list' && (
                  <button type="button" aria-pressed={hideDone} onClick={() => setHideDone((h) => !h)} className={cn(resetBtn, 'text-xs font-medium text-[var(--text-subtle)] hover:text-[var(--text)]')}>
                    {hideDone ? 'Show Done' : 'Hide Done'}
                  </button>
                )}
              </div>
            </div>

            {api.error && (
              <div role="alert" className="mx-6 mt-3 flex items-start justify-between gap-3 rounded-lg border border-[color:var(--lost)] px-3.5 py-2.5 text-[13px] text-[#b91c1c] dark:text-[#f87171]">
                <span>{api.error}</span>
                <button type="button" onClick={api.clearError} aria-label="Dismiss message" className={cn(resetBtn, 'mt-0.5 shrink-0 text-inherit')}><X className="size-4" strokeWidth={1.75} aria-hidden="true" /></button>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {view === 'list' ? (
                <>
                  <AddInput className="mb-3" label="Add a task" placeholder="Add a task…" onAdd={(t) => api.addTask(project.id, t)} />
                  {tree.length === 0 ? (
                    <div className="py-12 text-center text-[13px] text-[var(--text-subtle)]">No tasks yet. Add the first one above.</div>
                  ) : visible.length === 0 ? (
                    <div className="py-12 text-center text-[13px] text-[var(--text-subtle)]">Everything is done. Choose Show Done to see the completed tasks.</div>
                  ) : (
                    <ul className="-mx-2 divide-y divide-[color:var(--border)]">
                      {visible.map((t) => (
                        <TaskRow key={t.id} task={t} project={project} api={api} hideDone={hideDone}
                          expanded={expanded.has(t.id)} addingSub={addingSub === t.id}
                          onToggleExpand={toggleExpand} onStartSub={startSub} onEdit={setEditingId} />
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <Board tree={tree} project={project} api={api} onEdit={setEditingId} />
              )}
            </div>

            {/* Opened inside this window so Escape closes the top one first */}
            {editing && <TaskEditor key={editing.id} task={editing} parent={editingParent} subtasks={editingSubs} api={api} onClose={() => setEditingId(null)} />}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
