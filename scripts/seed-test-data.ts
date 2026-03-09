import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { Client as PgClient } from 'pg';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const DB_URL = process.env.SUPABASE_DB_URL!;
const EMAIL = process.env.TEST_USER_EMAIL!;
const PASSWORD = process.env.TEST_USER_PASSWORD!;

/**
 * Helper to execute raw SQL via PG driver (bypasses RLS)
 */
async function pgExec(sql: string, params: any[] = []) {
  const pg = new PgClient({ connectionString: DB_URL });
  await pg.connect();
  try {
    return await pg.query(sql, params);
  } finally {
    await pg.end();
  }
}

/**
 * Returns a YYYY-MM-DD date string for someone who is `targetAge` years old today
 */
function dobForAge(targetAge: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - targetAge);
  return d.toISOString().split('T')[0];
}

/**
 * Returns "5'8"" text that the trg_sync_height_inches trigger will parse
 */
function inchesToHeightText(inches: number): string {
  const feet = Math.floor(inches / 12);
  const rem = inches % 12;
  return `${feet}'${rem}"`;
}

async function main() {
  console.log('🌱 Starting Seed (Dev-Mirror Sync)...');

  // Ensure clean slate and visibility for the seed script
  await pgExec(`ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;`);
  await pgExec(`TRUNCATE TABLE public.profiles CASCADE;`);

  const supabase = createClient(SUPABASE_URL, ANON_KEY);
  let auth = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  
  if (auth.error) {
    const { error: signUpError } = await supabase.auth.signUp({ email: EMAIL, password: PASSWORD });
    if (signUpError) throw signUpError;
    auth = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  }
  if (auth.error) throw auth.error;
  const uid = auth.data.user!.id;

  // Use raw columns (dob, height) so the DB triggers compute (age, height_inches)
  const cols = `(id, email, full_name, role, is_approved, is_submitted, gender, dob, height, resident_country, kovil, pirivu, profession, is_test_data, updated_at)`;

  // 1. Insert Auth User
  await pgExec(
    `INSERT INTO public.profiles ${cols} VALUES ($1, $2, 'Test User', 'USER', true, true, 'MALE', $3, $4, 'USA', 'KovilA', 'Pirivu1', 'Engineer', true, now())`,
    [uid, EMAIL, dobForAge(30), inchesToHeightText(68)]
  );

  // 2. Bulk Seed 120 Profiles
  const rows: string[] = [];
  const params: any[] = [];
  for (let i = 0; i < 120; i++) {
    const kovil  = i % 3 === 0 ? 'KovilA' : (i % 3 === 1 ? 'KovilB' : 'KovilC');
    const pirivu = i % 2 === 0 ? 'Pirivu1' : 'Pirivu2';
    const gender = i % 2 === 0 ? 'FEMALE' : 'MALE';
    const age    = 25 + (i % 10);
    const inches = 64 + (i % 7);
    const base   = i * 4;
    
    rows.push(
      `(gen_random_uuid(), $${base+1}, 'Seed ${i}', 'USER', true, true, $${base+2}, $${base+3}, $${base+4}, 'USA', '${kovil}', 'Pirivu1', 'Engineer', true, now() - (interval '1s' * ${i}))`
    );
    rows.push(
      `(gen_random_uuid(), $${base+1}, 'Seed ${i}', 'USER', true, true, $${base+2}, $${base+3}, $${base+4}, 'USA', '${kovil}', '${pirivu}', 'Engineer', true, now() - (interval '1s' * ${i}))`
    );
    params.push(`seed${i}@nexus.local`, gender, dobForAge(age), inchesToHeightText(inches));
  }
  await pgExec(`INSERT INTO public.profiles ${cols} VALUES ${rows.join(',')} ON CONFLICT (email) DO NOTHING`, params);

  // 3. Confirm triggers fired correctly in the local DB
  const { rows: check } = await pgExec(`
    SELECT
      count(*) AS total,
      count(*) FILTER (WHERE age IS NOT NULL) AS with_age,
      count(*) FILTER (WHERE height_inches IS NOT NULL) AS with_height
    FROM public.profiles
    WHERE is_approved = true AND is_submitted = true;
  `);
  console.log(`✅ Table Status: total=${check[0].total}, with_age=${check[0].with_age}, with_height=${check[0].with_height}`);

  // 4. Sanity Check via PostgREST (The Final Hurdle)
  // We use the full object to satisfy the strict signature of search_profile_cards_v1
  const { data, error: rpcErr } = await supabase.rpc('search_profile_cards_v1', {
    p_page_size: 10,
    p_query: null,
    p_min_age: null,
    p_max_age: null,
    p_min_height: null,
    p_max_height: null,
    p_countries: null,
    p_marital_statuses: null,
    p_interests: null,
    p_education: null,
    p_exclude_kovil_pirivu: null,
    p_cursor_updated_at: null,
    p_cursor_id: null,
    p_exclude_user_id: null,
    p_forced_gender: null
  });

  if (rpcErr) {
    console.error('❌ PostgREST RPC Sanity Check Failed:', JSON.stringify(rpcErr, null, 2));
    process.exit(1);
  }

  console.log('✅ Seed Complete. Sanity Count (Lax):', data?.length ?? 0);
  
  if ((data?.length ?? 0) === 0) {
    console.error('❌ RPC returned 0 rows. Verify that search_profile_cards_v1 includes is_approved = true in its WHERE clause.');
    process.exit(1);
  }
  
  console.log('🎉 Seed logic successfully mirrored to Dev-Parity local DB.');
}

main().catch(e => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});