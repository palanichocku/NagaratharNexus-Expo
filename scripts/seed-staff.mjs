// scripts/seed-staff.mjs
// Usage:
//   node scripts/seed-staff.mjs --email mod2@nexus.com --password 'World@2026' --name 'Seed Moderator2' --role MODERATOR
// Run from Project Home:
//  node scripts/seed-staff.mjs \
//    --email mod2@nexus.com \
//    --password 'World@2026' \
//    --name 'Seed Moderator2' \
//    --role MODERATOR
// Env required:
//   SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE_KEY=...

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

function getArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function requireArg(name) {
  const value = getArg(name);
  if (!value) {
    console.error(`Missing required argument: --${name}`);
    process.exit(1);
  }
  return value;
}

function normalizeRole(role) {
  const value = String(role || '').trim().toUpperCase();
  if (!['ADMIN', 'MODERATOR'].includes(value)) {
    console.error(`Invalid --role "${role}". Expected ADMIN or MODERATOR.`);
    process.exit(1);
  }
  return value;
}

function validateEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (!ok) {
    console.error(`Invalid --email "${email}"`);
    process.exit(1);
  }
  return value;
}

function validatePassword(password) {
  const value = String(password || '');
  if (value.length < 8) {
    console.error('Invalid --password. Use at least 8 characters.');
    process.exit(1);
  }
  return value;
}

async function findAuthUserByEmail(email) {
  let page = 1;

  while (true) {
    const { data, error } = await sb.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) throw error;

    const found =
      data?.users?.find(
        (u) => (u.email || '').toLowerCase() === email.toLowerCase()
      ) || null;

    if (found) return found;

    if (!data?.users?.length || data.users.length < 1000) break;
    page += 1;
  }

  return null;
}

async function ensureStaffUser({ email, password, full_name, role }) {
  let user = await findAuthUserByEmail(email);

  if (!user) {
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
      app_metadata: { role }, // reference only; DB remains source of truth
    });

    if (error) throw error;
    user = data.user;
    console.log(`✅ Created auth user: ${email} (${role})`);
  } else {
    const { error } = await sb.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(user.user_metadata ?? {}), full_name },
      app_metadata: { ...(user.app_metadata ?? {}), role },
    });

    if (error) throw error;
    console.log(`ℹ️ Updated auth user: ${email} (${role})`);
  }

  const { error: profileErr } = await sb
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email,
        full_name,
        role,
        is_approved: true,
        is_submitted: false,
        account_status: 'ACTIVE',
        hide_phone: true,
        hide_email: true,
        is_test_data: false,
      },
      { onConflict: 'id' }
    );

  if (profileErr) throw profileErr;
  console.log(`✅ Upserted profiles: ${email} -> ${role}`);

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
  const email = validateEmail(requireArg('email'));
  const password = validatePassword(requireArg('password'));
  const full_name = requireArg('name');
  const role = normalizeRole(requireArg('role'));

  await ensureStaffUser({
    email,
    password,
    full_name,
    role,
  });

  console.log('🎉 Done seeding staff user.');
}

main().catch((e) => {
  console.error('❌ Seed failed:', e?.message || e);
  process.exit(1);
});