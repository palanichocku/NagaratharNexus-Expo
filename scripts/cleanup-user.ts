// Run: npm run cleanup-user -- --id <uuid> OR --fullName "Full Name"
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function getArg(name: string): string | undefined {
  const idx = process.argv.findIndex((x) => x === `--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const id = getArg('id');
  const fullName = getArg('fullName');

  if (!id && !fullName) {
    throw new Error('Pass --id <uuid> or --fullName "Full Name"');
  }

  let query = supabaseAdmin.from('profiles').select('id, full_name, email, is_test_data');

  if (id) query = query.eq('id', id);
  if (fullName) query = query.ilike('full_name', fullName);

  const { data, error } = await query.limit(10);
  if (error) throw error;

  const rows = data || [];
  if (!rows.length) {
    console.log('No matching users found.');
    return;
  }

  if (rows.length > 1 && !id) {
    console.log('Multiple matches found. Re-run with --id:');
    for (const row of rows) {
      console.log(`${row.id} | ${row.full_name} | ${row.email} | test=${row.is_test_data}`);
    }
    process.exit(1);
  }

  const user = rows[0];
  console.log(`Deleting: ${user.id} | ${user.full_name} | ${user.email}`);

  await supabaseAdmin.from('user_roles').delete().eq('user_id', user.id);
  await supabaseAdmin.from('profiles').delete().eq('id', user.id);

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (authError) throw authError;

  console.log('✅ User cleanup complete.');
}

main().catch((err) => {
  console.error('💥 Script failed:', err);
  process.exit(1);
});