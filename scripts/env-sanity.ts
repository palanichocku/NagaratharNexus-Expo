import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { Client as PgClient } from 'pg';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const DB_URL = process.env.SUPABASE_DB_URL!;
const EMAIL = process.env.TEST_USER_EMAIL!;
const PASSWORD = process.env.TEST_USER_PASSWORD!;

async function main() {
  console.log('SUPABASE_URL =', SUPABASE_URL);
  console.log('DB_URL host  =', new URL(DB_URL.replace('postgresql://', 'http://')).host);

  // 1) Count via direct DB
  const pg = new PgClient({ connectionString: DB_URL });
  await pg.connect();
  const { rows } = await pg.query(`select count(*)::int as c from public.profiles;`);
  await pg.end();
  console.log('DB count profiles =', rows[0].c);

  // 2) Count via Supabase RPC (same path your tests use)
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD }); 
  const { data, error } = await client.rpc('search_profile_cards_v1', {
    p_query: null,
    p_min_age: 18,
    p_max_age: 60,
    p_min_height: 48,
    p_max_height: 84,
    p_countries: null,
    p_marital_statuses: null,
    p_interests: null,
    p_education: null,
    p_exclude_kovil_pirivu: null,
    p_page_size: 5,
    p_cursor_updated_at: null,
    p_cursor_id: null,
    p_exclude_user_id: null,
    p_forced_gender: null,
  });

  if (error) throw error;
  console.log('RPC returned rows =', Array.isArray(data) ? data.length : 0);
  await client.auth.signOut();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});