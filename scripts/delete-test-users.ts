import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const FETCH_PAGE_SIZE = 1000;
const DB_DELETE_BATCH_SIZE = 500;
const AUTH_DELETE_CONCURRENCY = 5;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deleteAuthUsers(ids: string[]) {
  let deleted = 0;

  const groups = chunk(ids, AUTH_DELETE_CONCURRENCY);

  for (const group of groups) {
    const results = await Promise.allSettled(
      group.map((id) => supabaseAdmin.auth.admin.deleteUser(id))
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const id = group[i];

      if (result.status === 'fulfilled') {
        const authError = result.value.error;
        if (authError) {
          console.warn(`⚠️ auth delete failed for ${id}: ${authError.message}`);
        } else {
          deleted += 1;
        }
      } else {
        console.warn(`⚠️ auth delete crashed for ${id}: ${String(result.reason)}`);
      }
    }

    await sleep(50);
  }

  return deleted;
}

async function fetchNextTestUsers() {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email')
    .eq('is_test_data', true)
    .order('created_at', { ascending: true })
    .range(0, FETCH_PAGE_SIZE - 1);

  if (error) {
    throw new Error(`Failed to fetch test users: ${error.message}`);
  }

  return data || [];
}

async function main() {
  let totalDeletedProfiles = 0;
  let totalDeletedAuth = 0;
  let cycle = 0;

  while (true) {
    cycle += 1;

    const rows = await fetchNextTestUsers();

    if (!rows.length) {
      break;
    }

    console.log(`🔎 Cycle ${cycle}: found ${rows.length} more test users`);

    const idGroups = chunk(
      rows.map((r) => r.id),
      DB_DELETE_BATCH_SIZE
    );

    for (const ids of idGroups) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .in('user_id', ids);

      if (roleError) {
        console.warn(`⚠️ user_roles delete warning: ${roleError.message}`);
      }

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .in('id', ids);

      if (profileError) {
        throw new Error(`Profile delete failed: ${profileError.message}`);
      }

      totalDeletedProfiles += ids.length;
      console.log(`✅ Deleted ${ids.length} profiles (total profiles=${totalDeletedProfiles})`);

      const deletedAuth = await deleteAuthUsers(ids);
      totalDeletedAuth += deletedAuth;

      console.log(`✅ Deleted ${deletedAuth}/${ids.length} auth users (total auth=${totalDeletedAuth})`);

      await sleep(100);
    }
  }

  console.log(
    `🏁 Test user cleanup complete. profiles deleted=${totalDeletedProfiles}, auth deleted=${totalDeletedAuth}`
  );
}

main().catch((err) => {
  console.error('💥 Script failed:', err);
  process.exit(1);
});