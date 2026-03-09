import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { signInTestUser, signOut, searchProfilesNode, type SearchFilters } from '../testkit/supabaseTestClient';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAuthedClient } from '../_helpers/authedClient';


function all(rows: any[], pred: (r: any) => boolean, msg: string) {
  for (const r of rows) expect(pred(r), msg).toBe(true);
}

describe('Functional: search_profile_cards_v1', () => {
  let client: any;
  beforeAll(async () => {
    const s = await signInTestUser();
    client = s.client;
  });

  afterAll(async () => {
    if (client) await signOut(client);
  });

  it('returns thin profile cards', async () => {
    const res = await searchProfilesNode(client, {}, 0, 10, null, { role: 'ADMIN' });
    expect(res.profiles.length).toBeGreaterThan(0);
  });

  it('age bounds respected', async () => {
    const filters: SearchFilters = { minAge: 26, maxAge: 30 };
    const res = await searchProfilesNode(client, filters, 0, 50, null, { role: 'ADMIN' });
    all(res.profiles, (p) => (p.age ?? 0) >= 26 && (p.age ?? 999) <= 30, 'age out of bounds');
    expect(res.profiles.length).toBeGreaterThan(0);
  });

  it('height bounds respected', async () => {
    const filters: SearchFilters = { minHeight: 64, maxHeight: 70 };
    const res = await searchProfilesNode(client, filters, 0, 50, null, { role: 'ADMIN' });
    all(res.profiles, (p) => (p.height_inches ?? 0) >= 64 && (p.height_inches ?? 999) <= 70, 'height out of bounds');
    expect(res.profiles.length).toBeGreaterThan(0);
  });

  it('countries filter respected', async () => {
    const filters: SearchFilters = { countries: ['USA'] };
    const res = await searchProfilesNode(client, filters, 0, 50, null, { role: 'ADMIN' });
    all(res.profiles, (p) => p.resident_country === 'USA', 'country mismatch');
    expect(res.profiles.length).toBeGreaterThan(0);
  });

  it('query matches name/profession/city/state', async () => {
    const filters: SearchFilters = { query: 'Engineer' };
    const res = await searchProfilesNode(client, filters, 0, 50, null, { role: 'ADMIN' });
    expect(res.profiles.length).toBeGreaterThan(0);

    all(
      res.profiles,
      (p) =>
        String(p.full_name ?? '').toLowerCase().includes('engineer') ||
        String(p.profession ?? '').toLowerCase().includes('engineer') ||
        String(p.current_city ?? '').toLowerCase().includes('engineer') ||
        String(p.current_state ?? '').toLowerCase().includes('engineer'),
      'query mismatch'
    );
  });

  it('USER caller forces opposite gender', async () => {
    const res = await searchProfilesNode(client, {}, 0, 50, null, { role: 'USER', gender: 'MALE' });
    expect(res.profiles.length).toBeGreaterThan(0);
    all(res.profiles, (p) => String(p.gender).toUpperCase() === 'FEMALE', 'forced gender not applied');
  });

  it('excludeKovilPirivu blocks matching pairs', async () => {
    const filters: SearchFilters = { excludeKovilPirivu: ['KovilA||Pirivu1', 'KovilB||*'] };
    const res = await searchProfilesNode(client, filters, 0, 80, null, { role: 'ADMIN' });

    // ✅ ADD THIS: Ensure we actually have data to check
    expect(res.profiles.length).toBeGreaterThan(0);
    
    all(
      res.profiles,
      (p) => {
        const key = `${p.kovil ?? ''}||${p.pirivu ?? ''}`;
        const star = `${p.kovil ?? ''}||*`;
        return key !== 'KovilA||Pirivu1' && star !== 'KovilB||*';
      },
      'kovil/pirivu exclusion violated'
    );
  });
});