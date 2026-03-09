// scripts/lib/admin.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Load .env.scripts.local before running scripts.'
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export function parseArg(name: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === `--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

export function parseIntArg(name: string, fallback?: number): number {
  const raw = parseArg(name);
  if (!raw) {
    if (fallback != null) return fallback;
    throw new Error(`Missing required argument --${name}`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid numeric value for --${name}: ${raw}`);
  }
  return n;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}