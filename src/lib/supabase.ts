import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Null when no project is configured: Sift then runs local-only (IndexedDB, no sign-in). */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { persistSession: true, detectSessionInUrl: true } }) : null;
export const cloud = !!supabase;
export const LOCAL_USER = 'local';

export const signInWithGoogle = () => supabase?.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + import.meta.env.BASE_URL } });
export const signOut = () => supabase?.auth.signOut();
