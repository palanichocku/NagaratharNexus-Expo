import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { signInTestUser } from '../testkit/supabaseTestClient';

describe('Auth context sanity', () => {
  it('sees auth.uid() inside Postgres', async () => {
    const { client, userId } = await signInTestUser();

    // ✅ This should return the user id if the access token is actually applied to requests
    const { data, error } = await client.rpc('is_staff'); // any RPC call ok; but better: auth.uid()
    // If you don't have an auth.uid() RPC, use a direct select:
    const { data: me, error: meErr } = await client.from('profiles').select('id').eq('id', userId).maybeSingle();

    expect(meErr).toBeNull();
    expect(me?.id).toBe(userId);

    await client.auth.signOut();
  });
});