// Project tasks and subtasks (project-management side). Tasks live in lre_project_tasks;
// a subtask is a task whose parent_id points at a top-level task (two levels, enforced in the database).
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase.js';
import { daysUntil } from './dates.js';

const TABLE = 'lre_project_tasks';

export const STATUSES = [
  { value: 'To Do',       color: '#8a8580' },
  { value: 'In Progress', color: '#ea580c' },
  { value: 'Done',        color: '#16a34a' },
];
export const statusColor = (s) => (STATUSES.find((x) => x.value === s) || STATUSES[0]).color;
export const nextStatus = (s) => STATUSES[(STATUSES.findIndex((x) => x.value === s) + 1) % STATUSES.length].value;

export const isOverdue = (t) => t.status !== 'Done' && !!t.due_date && daysUntil(t.due_date) < 0;

const bySort = (a, b) => (a.sort_order - b.sort_order) || (a.id - b.id);

// One project's tasks as a tree: [{ ...task, subtasks: [...] }]
export function treeFor(tasks, projectId) {
  const mine = tasks.filter((t) => t.project_id === projectId);
  const subs = {};
  mine.filter((t) => t.parent_id).forEach((t) => { (subs[t.parent_id] = subs[t.parent_id] || []).push(t); });
  return mine.filter((t) => !t.parent_id).sort(bySort).map((t) => ({ ...t, subtasks: (subs[t.id] || []).sort(bySort) }));
}

// Numbers for the project card. Progress counts top-level tasks; "overdue" counts every open task or subtask past its date.
export function summarize(tasks, projectId) {
  const tree = treeFor(tasks, projectId);
  const everything = tree.flatMap((t) => [t, ...t.subtasks]);
  return {
    total: tree.length,
    done: tree.filter((t) => t.status === 'Done').length,
    inProgress: tree.filter((t) => t.status === 'In Progress').length,
    overdue: everything.filter(isOverdue).length,
    subtasks: everything.length - tree.length,
  };
}

function explain(err) {
  const msg = String((err && (err.message || err)) || '');
  if (err && (err.code === 'PGRST205' || err.code === '42P01' || /schema cache|does not exist/i.test(msg))) {
    return "Tasks aren't set up yet. Run supabase/project_tasks.sql once, then reload.";
  }
  return msg || 'Something went wrong saving that task. Please try again.';
}

export function useProjectTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const latest = useRef(tasks);
  latest.current = tasks;                      // always the newest list, for use inside async handlers

  useEffect(() => {
    let alive = true;
    supabase.from(TABLE).select('*').order('sort_order', { ascending: true }).order('id', { ascending: true }).then(({ data, error: err }) => {
      if (!alive) return;
      if (err) setError(explain(err)); else setTasks(data || []);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const addTask = useCallback(async (projectId, title, { parentId = null, status = 'To Do', due_date = null, notes = null } = {}) => {
    const clean = String(title || '').trim();
    if (!clean) return null;
    setError('');
    const siblings = latest.current.filter((t) => t.project_id === projectId && (t.parent_id || null) === parentId);
    const sort_order = siblings.reduce((m, t) => Math.max(m, t.sort_order || 0), 0) + 1;
    const { data, error: err } = await supabase.from(TABLE)
      .insert({ project_id: projectId, parent_id: parentId, title: clean, status, due_date, notes, sort_order })
      .select().single();
    if (err) { setError(explain(err)); return null; }
    setTasks((prev) => [...prev, data]);
    return data;
  }, []);

  // Changes show immediately, then are saved; if saving fails the change is undone and the reason is shown.
  const updateTask = useCallback(async (id, patch) => {
    const before = latest.current.find((t) => t.id === id);
    if (!before) return false;
    setError('');
    const guess = { ...before, ...patch };
    if (patch.status) guess.completed_at = patch.status === 'Done' ? (before.completed_at || new Date().toISOString()) : null;
    setTasks((prev) => prev.map((t) => (t.id === id ? guess : t)));
    const { data, error: err } = await supabase.from(TABLE).update(patch).eq('id', id).select().single();
    if (err) {
      setTasks((prev) => prev.map((t) => (t.id === id ? before : t)));
      setError(explain(err));
      return false;
    }
    setTasks((prev) => prev.map((t) => (t.id === id ? data : t)));
    return true;
  }, []);

  const removeTask = useCallback(async (id) => {
    const snapshot = latest.current;
    setError('');
    setTasks((prev) => prev.filter((t) => t.id !== id && t.parent_id !== id));   // its subtasks go with it
    const { error: err } = await supabase.from(TABLE).delete().eq('id', id);
    if (err) { setTasks(snapshot); setError(explain(err)); return false; }
    return true;
  }, []);

  return { tasks, loading, error, clearError: () => setError(''), addTask, updateTask, removeTask };
}
