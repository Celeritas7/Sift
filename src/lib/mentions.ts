// "Mentioned in": notes whose words cover a Weekly Focus task's words.
import { tokens } from './collage';

export interface MentionNote { id: string; text: string; ts: number; }

/** How many of a task's words a note needs: all of them for one or two words, else 60% (at least two). */
export const needed = (n: number) => (n <= 2 ? n : Math.max(2, Math.ceil(n * 0.6)));

/** Builds a matcher over the notes once; call it per task. Best coverage first, then newest. */
export function mentionIndex(notes: MentionNote[]) {
  const sets = notes.map(n => ({ id: n.id, ts: n.ts, words: new Set(tokens(n.text)) }));
  return (task: string, exclude: string | null = null, limit = 3): string[] => {
    const want = tokens(task); if (!want.length) return [];
    const need = needed(want.length);
    return sets.filter(n => n.id !== exclude).map(n => ({ n, hit: want.filter(w => n.words.has(w)).length }))
      .filter(x => x.hit >= need).sort((a, b) => b.hit - a.hit || b.n.ts - a.n.ts).slice(0, limit).map(x => x.n.id);
  };
}
