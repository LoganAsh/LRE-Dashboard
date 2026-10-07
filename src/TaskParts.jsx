import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dateOf } from './dates.js';
import { isOverdue, statusColor } from './projectTasks.js';

// "Oct 12", or "Oct 12, 2027" when it isn't this year
export function fmtDue(iso) {
  const d = dateOf(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}

export const resetBtn = 'appearance-none border-0 bg-transparent p-0 [font-family:inherit] outline-none cursor-pointer focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[#ea580c]';

export function TaskCheck({ done, label, onToggle }) {
  return (
    <button
      type="button" role="checkbox" aria-checked={done} aria-label={label}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={cn(
        'flex size-[18px] shrink-0 appearance-none items-center justify-center rounded-[5px] border p-0 outline-none cursor-pointer transition-colors',
        'focus-visible:ring-2 focus-visible:ring-[#ea580c] focus-visible:ring-offset-1',
        done
          ? 'border-[#16a34a] bg-[#16a34a] text-white'
          : 'border-[color-mix(in_srgb,var(--text)_30%,transparent)] bg-transparent hover:border-[color-mix(in_srgb,var(--text)_55%,transparent)]'
      )}
    >
      {done && <Check className="size-3" strokeWidth={3} aria-hidden="true" />}
    </button>
  );
}

export function DueLabel({ task, className }) {
  if (!task.due_date) return null;
  const late = isOverdue(task);
  return (
    <span
      title={late ? 'Overdue' : undefined}
      className={cn('whitespace-nowrap text-xs tabular-nums', late ? 'font-medium text-[#b91c1c] dark:text-[#f87171]' : 'text-[var(--text-subtle)]', className)}
    >
      {late && <span className="sr-only">Overdue: </span>}
      {fmtDue(task.due_date)}
    </span>
  );
}

export function StatusDot({ status, className }) {
  return <span className={cn('size-2 shrink-0 rounded-full', className)} style={{ background: statusColor(status) }} aria-hidden="true" />;
}

// A text box that adds on Enter (or the Add button) and clears itself when the add worked.
export function AddInput({ label, placeholder, onAdd, className, autoFocus = false }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const v = value.trim();
    if (!v || busy) return;
    setBusy(true);
    const result = await onAdd(v);
    setBusy(false);
    if (result !== false && result !== null) setValue('');
  };
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Plus className="size-4 shrink-0 text-[var(--text-subtle)]" strokeWidth={1.75} aria-hidden="true" />
      <input
        type="text" aria-label={label} placeholder={placeholder} value={value} autoFocus={autoFocus}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
        className="h-9 min-w-0 flex-1 appearance-none rounded-lg border border-[color:var(--border)] bg-[var(--card)] px-3 text-[13px] text-[var(--text)] outline-none [font-family:inherit] transition-colors placeholder:text-[var(--text-subtle)] focus:border-[#ea580c]"
      />
      <button
        type="button" onClick={submit} disabled={!value.trim() || busy}
        className={cn(resetBtn, 'text-[13px] font-medium text-[#c2540a] hover:underline disabled:cursor-default disabled:no-underline disabled:opacity-40 dark:text-[#fb923c]')}
      >
        Add
      </button>
    </div>
  );
}
