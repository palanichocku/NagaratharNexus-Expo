import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ipvsnjjhcxluyicfnrgh.supabase.co';
const supabaseAnonKey = 'sb_publishable_qd78737Y0TL_cuVvy_g5rA_zdXqpbIf';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.auth.signInWithPassword({
  email: 'member1@nexus.com',
  password: 'World@2026',
});

console.log('error =', error);
console.log('session? =', !!data?.session);
console.log('user =', data?.user?.email ?? null);
