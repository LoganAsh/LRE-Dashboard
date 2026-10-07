// Moves one project next to another and leaves every other project's relative order untouched,
// so it also works when a status filter is hiding some of the projects.
// Returns the SAME list (not a copy) when nothing would change, so callers can skip saving.
export function moveProject(list, id, targetId, where) {
  if (id === targetId) return list;
  const from = list.findIndex((p) => p.id === id);
  if (from < 0 || list.findIndex((p) => p.id === targetId) < 0) return list;
  const without = list.filter((p) => p.id !== id);
  let at = without.findIndex((p) => p.id === targetId);
  if (where === 'after') at += 1;
  const next = [...without.slice(0, at), list[from], ...without.slice(at)];
  return next.every((p, i) => p === list[i]) ? list : next;
}
