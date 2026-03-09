// tests/_helpers/authedClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export async function getAuthedClient(): Promise<SupabaseClient> {
  const url = process.env.SUPABASE_URL!;
  const anon = process.env.SUPABASE_ANON_KEY!;
  const email = process.env.TEST_USER_EMAIL!;
  const password = process.env.TEST_USER_PASSWORD!;

  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error('No session after sign in');

  return client;
}