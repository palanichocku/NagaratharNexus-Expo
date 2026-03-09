import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { signInTestUser, signOut, searchProfilesNode } from '../testkit/supabaseTestClient';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAuthedClient } from '../_helpers/authedClient';


let client: any;

beforeAll(async () => {
  client = await getAuthedClient();
});

afterAll(async () => {
  await client?.auth?.signOut?.();
});


describe('Functional: cursor pagination', () => {
  beforeAll(async () => {
    const s = await signInTestUser();
    client = s.client;
  });

  afterAll(async () => {
    if (client) await signOut(client);
  });

  it('no duplicates across cursor pages', async () => {
    const pageSize = 20;

    const first = await searchProfilesNode(client, {}, 0, pageSize, null, { role: 'ADMIN' });
    expect(first.profiles.length).toBeGreaterThan(0);
    expect(first.nextCursor).toBeTruthy();

    const second = await searchProfilesNode(client, {}, 1, pageSize, first.nextCursor, { role: 'ADMIN' });

    const ids1 = new Set(first.profiles.map(p => p.id));
    const overlap = second.profiles.filter(p => ids1.has(p.id));
    expect(overlap.length).toBe(0);
  });
});