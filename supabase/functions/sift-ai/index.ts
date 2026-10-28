// sift-ai: note summaries, weekly digests and Chat comments ("Let them talk") with Claude. Deploy: supabase functions deploy sift-ai
// Secrets: ANTHROPIC_API_KEY (supabase secrets set). SUPABASE_URL / SUPABASE_ANON_KEY are provided by Supabase.
// It reads notes as the signed-in user (row-level security applies), never sends vault notes, and writes nothing:
// the app saves the results through its normal sync.
import Anthropic from 'npm:@anthropic-ai/sdk@0.133.0';
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { batches, checkComments, checkSummaries, DIGEST_SYSTEM, digestInput, isIdList, isWeekOf, MAX_DIGEST_IDS, MAX_IDS, MAX_TALK_IDS, MODEL, newestThatFit, type NoteRow, SUMMARY_SCHEMA, SUMMARY_SYSTEM, summaryInput, type Summary, TALK_SCHEMA, TALK_SYSTEM, talkInput } from './lib.ts';

const anthropic = new Anthropic(); // ANTHROPIC_API_KEY from the function's secrets
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

/** One request with server-side fallback: if Claude Opus 5.5's safeguards decline, the API retries on its recommended model. */
async function ask(system: string, input: string, effort: 'low' | 'medium', schema?: Record<string, unknown>) {
  const res = await anthropic.beta.messages.create({
    model: MODEL, max_tokens: 16000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    system, messages: [{ role: 'user', content: input }],
    output_config: { effort, ...(schema ? { format: { type: 'json_schema' as const, schema } } : {}) },
  });
  if (res.stop_reason === 'refusal') throw new Error('Claude declined this request.');
  if (res.stop_reason === 'max_tokens') throw new Error('The reply was cut off. Try fewer notes at once.');
  return res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: 'Sign in first.' }, 401);
  // The project is shared with Weekly Focus: only people with a role there may spend the API key.
  const role = await sb.from('authentication_mode_user_roles').select('role').eq('auth_user_id', user.id).maybeSingle();
  if (!role.data) return json({ error: 'Your account has no Sift role.' }, 403);

  let body: { action?: string; ids?: unknown; week_of?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  const max = body.action === 'digest' ? MAX_DIGEST_IDS : body.action === 'talk' ? MAX_TALK_IDS : MAX_IDS;
  if (!isIdList(body.ids, max)) return json({ error: `ids: 1 to ${max} note ids` }, 400);
  const rows = await sb.from('sift_notes').select('id,title,body,topic,lang,created_at')
    .in('id', body.ids).eq('user_id', user.id).eq('vault', false).is('deleted_at', null).order('created_at');
  if (rows.error) return json({ error: rows.error.message }, 500);
  const notes = (rows.data ?? []) as NoteRow[];
  const found = new Set(notes.map(n => n.id)); const skipped = body.ids.filter(id => !found.has(id)); // vault, deleted or not synced yet

  try {
    if (body.action === 'summarize') {
      const out: Summary[] = [];
      for (const group of batches(notes)) {
        const text = await ask(SUMMARY_SYSTEM, summaryInput(group), 'low', SUMMARY_SCHEMA);
        out.push(...checkSummaries(JSON.parse(text), new Set(group.map(n => n.id))));
      }
      return json({ summaries: out, skipped });
    }
    if (body.action === 'digest') {
      if (!isWeekOf(body.week_of)) return json({ error: 'week_of: YYYY-MM-DD' }, 400);
      if (!notes.length) return json({ error: 'No notes to write about (vault notes are left out).' }, 400);
      return json({ text: await ask(DIGEST_SYSTEM, digestInput(body.week_of, notes), 'medium'), skipped });
    }
    if (body.action === 'talk') {
      // Career is the vault topic: never sent (the vault filter above already drops it, this is belt and braces).
      const chat = newestThatFit(notes.filter(n => n.topic !== 'career'));
      if (chat.length < 2) return json({ error: 'Need at least two notes for the topics to talk about.' }, 400);
      const text = await ask(TALK_SYSTEM, talkInput(chat), 'medium', TALK_SCHEMA);
      return json({ comments: checkComments(JSON.parse(text), chat), skipped });
    }
    return json({ error: 'action: summarize, digest or talk' }, 400);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Claude is busy. Try again in a minute.' }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'The Anthropic API key is missing or wrong (supabase secrets set ANTHROPIC_API_KEY=…).' }, 500);
    if (e instanceof Anthropic.APIError) return json({ error: `Claude API error ${e.status}: ${e.message}` }, 502);
    return json({ error: (e as Error).message }, 500);
  }
});
