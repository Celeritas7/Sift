import { useStore } from '../state/store';
import type { NoteV } from '../state/derived';
import { AI_READY } from '../lib/ai';
import { NO_AI } from '../lib/config';
import { inkBtn } from './ui';

/** The function takes up to this many notes for a digest; a bigger week uses its latest ones. */
const MAX_DIGEST = 120;

/** "Write digest" for a week, plus the line under it. Vault notes are never sent. */
export function DigestButton({ week, mobile }: { week: { id: string; notes: NoteV[]; digest: string | null } | null; mobile?: boolean }) {
  const st = useStore();
  const ids = (week?.notes ?? []).filter(n => !n.vault).map(n => n.id).slice(-MAX_DIGEST);
  const busy = !!week && !!st.aiBusy['digest:' + week.id]; const can = AI_READY && !!week && ids.length > 0 && !busy;
  const line = !AI_READY ? NO_AI : !week ? '' : !ids.length ? 'Only vault notes this week, and those are never sent to AI.'
    : `Written by Claude from this week's notes${week.notes.length - ids.length ? '; vault notes are left out' : ''}.`;
  return <>
    <button disabled={!can} onClick={() => week && void st.writeDigest(week.id, ids)} title={!AI_READY ? NO_AI : undefined}
      style={{ ...inkBtn, opacity: can || busy ? 1 : .45, minHeight: mobile ? 44 : undefined }}>{busy ? 'Writing…' : week?.digest ? 'Rewrite digest' : 'Write digest'}</button>
    {line && <span style={{ fontSize: 12, color: 'var(--mu)' }}>{line}</span>}
  </>;
}
