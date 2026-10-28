// Client for the sift-ai Supabase function (supabase/functions/sift-ai): note summaries and weekly digests by Claude.
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { TOPICS } from './config';
import type { Comment, Summary } from '../../supabase/functions/sift-ai/lib';
export type { Comment };

export const AI_READY = !!supabase;
/** Notes per call (the function accepts up to 25). */
export const AI_CHUNK = 20;

async function call<T>(body: Record<string, unknown>): Promise<T & { skipped: string[] }> {
  if (!supabase) throw new Error('AI needs Sift cloud sync (sign-in).');
  const { data, error } = await supabase.functions.invoke('sift-ai', { body });
  if (!error) return data as T & { skipped: string[] };
  if (error instanceof FunctionsHttpError) {
    if (error.context.status === 404) throw new Error("AI isn't set up yet: deploy the sift-ai function (docs/SETUP.md, step 7).");
    let msg = ''; try { msg = (await error.context.json()).error; } catch { /* not JSON */ }
    throw new Error(msg || `The AI function failed (${error.context.status}).`);
  }
  throw new Error(navigator.onLine ? 'Could not reach the AI function.' : "You're offline.");
}

export const aiSummarize = (ids: string[]) => call<{ summaries: Summary[] }>({ action: 'summarize', ids });
/** Notes per "Let them talk" (the function accepts up to 40). */
export const TALK_NOTES = 40;
const topicNames = () => Object.fromEntries(TOPICS.map(t => [t.id, t.name]));
export const aiTalk = (ids: string[]) => call<{ comments: Comment[] }>({ action: 'talk', ids, topics: topicNames() });
export const aiDigest = (weekOf: string, ids: string[]) => call<{ text: string }>({ action: 'digest', week_of: weekOf, ids, topics: topicNames() });
