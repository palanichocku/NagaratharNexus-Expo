import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { createAnonClient, searchProfilesNode } from '../testkit/supabaseTestClient';
import { beforeAll, afterAll } from 'vitest';
import { getAuthedClient } from '../_helpers/authedClient';

const EMAIL = process.env.TEST_USER_EMAIL!;
const PASSWORD = process.env.TEST_USER_PASSWORD!;

let client: any;

beforeAll(async () => {
  client = await getAuthedClient();
});

afterAll(async () => {
  await client?.auth?.signOut?.();
});

describe('Functional: exclude self using real auth session', () => {
  it('does not return the logged-in user profile when caller.userId is passed', async () => {
    const client = createAnonClient();

    const { data, error } = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
    if (error) throw error;

    const userId = data.user?.id;
    expect(userId).toBeTruthy();

    const res = await searchProfilesNode(client, {}, 0, 30, null, { userId, role: 'ADMIN' });
    expect(res.profiles.map(p => p.id)).not.toContain(userId);

    await client.auth.signOut();
  });
});