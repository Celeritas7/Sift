import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { supabase } from '../lib/supabase';

const cache = new Map<string, string>();

/** Local copy first (offline + just pasted), else a 1-hour signed URL from the private keep-attachments bucket. */
export function useImageUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(path ? cache.get(path) ?? null : null);
  useEffect(() => {
    if (!path) { setUrl(null); return; } let live = true;
    (async () => {
      const local = await db().images.get(path); if (local) { if (live) setUrl(local.dataUrl); return; }
      if (cache.has(path)) { if (live) setUrl(cache.get(path)!); return; }
      if (!supabase) return; const r = await supabase.storage.from('keep-attachments').createSignedUrl(path, 3600);
      if (r.data?.signedUrl) { cache.set(path, r.data.signedUrl); if (live) setUrl(r.data.signedUrl); }
    })();
    return () => { live = false; };
  }, [path]);
  return url;
}
