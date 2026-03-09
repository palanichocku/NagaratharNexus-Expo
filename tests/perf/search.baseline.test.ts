import 'dotenv/config';
import { describe, it, expect, beforeAll } from 'vitest';
import { searchProfilesNode } from '../testkit/supabaseTestClient';
import { getAuthedClient } from '../_helpers/authedClient';


let client: any;

beforeAll(async () => {
  client = await getAuthedClient();
});

function percentile(arr: number[], pct: number) {
  const s = [...arr].sort((a,b) => a-b);
  const idx = Math.floor((pct/100) * (s.length - 1));
  return s[idx];
}

describe('Perf: search baseline', () => {
  it('p95 latency under threshold', async () => {
    const runs = 12;
    const times: number[] = [];

    for (let i = 0; i < runs; i++) {
      const t0 = Date.now();
      // ✅ FIX: Pass the authenticated client instead of {}
      const res = await searchProfilesNode(client, {}, 0, 20, null, { role: 'ADMIN' });
      const t1 = Date.now();
      times.push(t1 - t0);

      // payload guardrail: thin pull should not explode
      expect(res.profiles.length).toBeLessThanOrEqual(20);
    }

    const p95 = percentile(times, 95);
    // Start loose; tighten after a few stable runs on your machine/CI
    expect(p95).toBeLessThan(1200);
  });
});