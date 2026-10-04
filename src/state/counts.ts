import { useMemo } from 'react';
import { useStore } from './store';
import { useConflicts, useNotes } from './derived';
import { items } from '../lib/wf';
import { mondayOf, weekLabel } from '../lib/format';

/** Weekly Focus progress over visible (not deleted, not parked) subtasks of active items. */
export function useWfStats() {
  const wf = useStore(s => s.wf);
  return useMemo(() => {
    const its = items(Object.values(wf)).filter(i => i.payload.active);
    let total = 0, done = 0, parked = 0;
    its.forEach(i => i.payload.subtasks.forEach(s => { if (s.del) return; if (s.lat) { parked++; return; } total++; if (s.done) done++; }));
    return { items: its, total, done, parked, line: `${done} of ${total} Weekly Focus tasks done`, pct: total ? Math.round(done / total * 100) : 0 };
  }, [wf]);
}

export function useCounts() {
  const { open } = useNotes(); const wf = useWfStats(); const conflicts = useConflicts();
  const openTodos = useMemo(() => open.reduce((k, n) => k + n.todoList.filter(t => !t.done).length, 0), [open]);
  return { week: wf.total - wf.done, todos: openTodos, conflicts: conflicts.length };
}

/** Digest weeks (Monday-keyed) for the last 8 weeks that have notes; vault notes count but stay unnamed. */
export function useWeeks() {
  const { active } = useNotes(); const digests = useStore(s => s.digests); const sel = useStore(s => s.week);
  return useMemo(() => {
    const map = new Map<string, typeof active>();
    active.forEach(n => { const k = mondayOf(n.ts); map.set(k, [...(map.get(k) || []), n]); });
    const weeks = [...map.keys()].sort().slice(-8).map(k => ({ id: k, label: weekLabel(k), notes: map.get(k)!.sort((a, b) => a.ts - b.ts), digest: digests[k]?.text || null, state: digests[k]?.text ? (digests[k].generated_by === 'ai' ? 'AI' : 'written') : '—' }));
    const current = weeks.find(w => w.id === sel) || weeks[weeks.length - 1] || null;
    return { weeks, current };
  }, [active, digests, sel]);
}
