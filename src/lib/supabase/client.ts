import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Browser Supabase client. When env vars are missing (hackathon demo),
 * returns null — use `getSupabaseOrNull()` and fall back to mock auth in UI.
 */
export function createSupabaseBrowserClient() {
  if (!url || !anon) {
    return null;
  }
  return createBrowserClient(url, anon);
}
