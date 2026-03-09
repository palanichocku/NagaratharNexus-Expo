// Run it in command: 
// npm i -D dotenv
// node scripts/seed-staff.mjs
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ✅ EDIT THESE
const STAFF = [
  {
    email: 'admin1@nexus.com',
    password: 'password123',
    full_name: 'Seed Admin1',
    role: 'ADMIN',
  },
  {
    email: 'mod1@nexus.com',
    password: 'password123',
    full_name: 'Seed Moderator1',
    role: 'MODERATOR',
  },
];

async function findAuthUserByEmail(email) {
  // Supabase Admin list is paged; this is usually enough for small projects
  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase()) || null;
}

async function ensureStaffUser({ email, password, full_name, role }) {
  let user = await findAuthUserByEmail(email);

  if (!user) {
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
      app_metadata: { role }, // reference only; still authorize via DB
    });
    if (error) throw error;
    user = data.user;
    console.log(`✅ Created auth user: ${email} (${role})`);
  } else {
    // Optional: enforce password & metadata on rerun
    const { error } = await sb.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(user.user_metadata ?? {}), full_name },
      app_metadata: { ...(user.app_metadata ?? {}), role },
    });
    if (error) throw error;
    console.log(`ℹ️ Updated auth user: ${email} (${role})`);
  }

  // ✅ profiles: your schema requires full_name NOT NULL, role has check constraint
  const { error: profileErr } = await sb
    .from('profiles')
    .upsert(
      {
        id: user.id,              // IMPORTANT: auth.users.id == profiles.id
        email,
        full_name,
        role,                     // 'ADMIN' | 'MODERATOR'
        is_approved: true,        // so they can access immediately
        is_submitted: false,      // staff don't need profile submission
        account_status: 'ACTIVE',
        hide_phone: true,
        hide_email: true,
        is_test_data: false,
      },
      { onConflict: 'id' }
    );

  if (profileErr) throw profileErr;
  console.log(`✅ Upserted profiles: ${email} -> ${role}`);

  // ✅ user_roles: keep in sync with profiles.role
  const { error: roleErr } = await sb
    .from('user_roles')
    .upsert(
      { user_id: user.id, role },
      { onConflict: 'user_id' }
    );

  if (roleErr) throw roleErr;
  console.log(`✅ Upserted user_roles: ${email} -> ${role}`);
}

async function main() {
  for (const s of STAFF) {
    await ensureStaffUser(s);
  }
  console.log('🎉 Done seeding staff.');
}

main().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});
