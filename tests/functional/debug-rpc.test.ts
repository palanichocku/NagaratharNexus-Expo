// tests/functional/debug-rpc.test.ts
import 'dotenv/config';
import { beforeAll, describe, expect, it } from 'vitest';
import { signInTestUser } from '../testkit/supabaseTestClient';

describe('DEEP DIAGNOSTIC: Why is RPC returning 0?', () => {
  let client: any;

  beforeAll(async () => {
    const s = await signInTestUser();
    client = s.client;
  });

  it('checks visibility flags on seeded data', async () => {
    // We select the flags for the first 5 rows to see what's actually in the DB
    const { data, error } = await client
      .from('profiles')
      .select('id, full_name, is_approved, is_submitted, role, gender, age')
      .limit(5);

    console.log('🔍 [DIAGNOSTIC] Sample Data Flags:', JSON.stringify(data, null, 2));
    
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);

    const approvedCount = data?.filter((p: any) => p.is_approved === true).length;
    const submittedCount = data?.filter((p: any) => p.is_submitted === true).length;
    const userRoleCount = data?.filter((p: any) => p.role === 'USER').length;

    console.log(`📊 Statistics: Approved: ${approvedCount}/5, Submitted: ${submittedCount}/5, Role USER: ${userRoleCount}/5`);
  });

  it('tests a "Lax" version of the RPC', async () => {
    // Must pass ALL params to v4 to be safe
    const { data, error } = await client.rpc('search_profile_cards_v1', {
      p_query: null, p_min_age: null, p_max_age: null,
      p_min_height: null, p_max_height: null, p_countries: null,
      p_marital_statuses: null, p_interests: null, p_education: null,
      p_exclude_kovil_pirivu: null, p_page_size: 10,
      p_cursor_updated_at: null, p_cursor_id: null,
      p_exclude_user_id: null, p_forced_gender: null
    });
    
    if (error) {
       console.error('❌ RPC Diagnostic Error:', JSON.stringify(error, null, 2));
    }
    console.log('🔍 [DIAGNOSTIC] RPC Result Count:', data?.length);
    expect(error).toBeNull();
  });
});