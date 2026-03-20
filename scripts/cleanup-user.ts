// This is hard coded for dev in package.json. If you want to run this for prod, use .env.production
// Run: npm run cleanup-user -- --id <uuid>
//   o: npm run cleanup-user -- --email user@nexus.com

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function getArg(name: string): string | undefined {
  const idx = process.argv.findIndex((x) => x === `--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const id = getArg('id')?.trim();
  const email = getArg('email')?.trim().toLowerCase();

  if ((!id && !email) || (id && email)) {
    throw new Error('Pass exactly one of: --id <uuid> or --email <email>');
  }

  let query = supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, is_test_data');

  if (id) {
    query = query.eq('id', id);
  } else {
    query = query.ilike('email', email!);
  }

  const { data, error } = await query.limit(2);
  if (error) throw error;

  const rows = data || [];

  if (!rows.length) {
    console.log('No matching users found.');
    return;
  }

  if (rows.length > 1) {
    console.log('Multiple matches found. Refusing to continue:');
    for (const row of rows) {
      console.log(`${row.id} | ${row.full_name} | ${row.email} | test=${row.is_test_data}`);
    }
    process.exit(1);
  }

  const user = rows[0];
  console.log(`Deleting: ${user.id} | ${user.full_name} | ${user.email}`);

  const { data: cleanupResult, error: cleanupError } = await supabaseAdmin.rpc(
    'delete_user_public_data',
    { p_user_id: user.id }
  );

  if (cleanupError) {
    throw new Error(`Public data cleanup failed: ${cleanupError.message}`);
  }

  console.log('Public cleanup result:', cleanupResult);

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (authError) {
    throw new Error(`Auth delete failed: ${authError.message}`);
  }

  console.log('✅ Complete user cleanup finished.');
}

main().catch((err) => {
  console.error('💥 Script failed:', err);
  process.exit(1);
});