import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const EMAIL = process.env.TEST_USER_EMAIL!;
const PASSWORD = process.env.TEST_USER_PASSWORD!;

if (!SUPABASE_URL || !ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in test env');
}

export function createAnonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function signInTestUser(): Promise<{ client: SupabaseClient; userId: string }> {
  const client = createAnonClient();
  const { data, error } = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error('No userId from signInWithPassword');
  return { client, userId };
}

export async function signOut(client: SupabaseClient) {
  await client.auth.signOut();
}

export type SearchCursor = { updatedAt: string; id: string };

export type SearchFilters = {
  minAge?: number;
  maxAge?: number;
  minHeight?: number;
  maxHeight?: number;
  query?: string;
  countries?: string[];
  education?: string[];
  interests?: string[];
  maritalStatus?: string[];
  excludeKovilPirivu?: string[];
};

export type SearchCallerContext = {
  userId?: string | null;
  role?: string | null;
  gender?: string | null;
  kovil?: string | null;
  pirivu?: string | null;
};

export type ThinProfileCard = {
  id: string;
  full_name: string | null;
  age: number | null;
  gender: string | null;
  resident_country: string | null;
  resident_status: string | null;
  current_state: string | null;
  current_city: string | null;
  profession: string | null;
  height_inches: number | null;
  kovil: string | null;
  pirivu: string | null;
  native_place: string | null;
  profile_photo_url: string | null;
  updated_at: string;
};

const hasAny = (arr: any) => Array.isArray(arr) && arr.length > 0;
const normalizeStringArray = (arr?: string[]) =>
  Array.isArray(arr) ? arr.map(s => String(s ?? '').trim()).filter(Boolean) : [];
const uniq = (arr: string[]) => Array.from(new Set(arr));
const normUpper = (v: any) => String(v ?? '').trim().toUpperCase();

function normRole(raw: any): 'ADMIN' | 'MODERATOR' | 'USER' {
  const r = normUpper(raw);
  if (r === 'ADMIN') return 'ADMIN';
  if (r === 'MODERATOR') return 'MODERATOR';
  return 'USER';
}

function oppositeGender(g: string | null): 'MALE' | 'FEMALE' | null {
  const gg = normUpper(g);
  if (gg === 'MALE') return 'FEMALE';
  if (gg === 'FEMALE') return 'MALE';
  return null;
}

function buildHardKovilExclusion(kovil: string | null, pirivu: string | null): string[] {
  const k = String(kovil ?? '').trim();
  const p = String(pirivu ?? '').trim();
  if (!k) return [];
  if (p) return [`${k}||${p}`];
  return [`${k}||*`];
}

// ✅ client is REQUIRED for RLS-protected reads (authenticated session)
// If you pass no client, it will behave as anon and likely return 0.
export async function searchProfilesNode(
  client: SupabaseClient,
  filters: SearchFilters,
  page = 0,
  pageSize = 20,
  cursor?: SearchCursor | null,
  caller?: SearchCallerContext
): Promise<{ profiles: ThinProfileCard[]; nextCursor: SearchCursor | null }> {
  const countries = normalizeStringArray(filters?.countries);
  const maritalStatuses = normalizeStringArray(filters?.maritalStatus);
  const interests = normalizeStringArray(filters?.interests);
  const education = normalizeStringArray(filters?.education);

  const currentUserId = caller?.userId ?? null;
  const role = normRole(caller?.role);
  const myGender = normUpper(caller?.gender || null);
  const forcedTargetGender = role === 'USER' ? oppositeGender(myGender) : null;

  const hardExclude = buildHardKovilExclusion(caller?.kovil ?? null, caller?.pirivu ?? null);
  const extraExclude = normalizeStringArray(filters?.excludeKovilPirivu);
  const excludeMerged = uniq([...hardExclude, ...extraExclude]);

  const requestSize = pageSize + 1;

  // 1. Declare payload as a variable FIRST
  const payload = {
    p_query: filters?.query?.trim() || null,
    p_min_age: filters?.minAge != null ? Number(filters.minAge) : null,
    p_max_age: filters?.maxAge != null ? Number(filters.maxAge) : null,
    p_min_height: filters?.minHeight != null ? Number(filters.minHeight) : null,
    p_max_height: filters?.maxHeight != null ? Number(filters.maxHeight) : null,
    p_countries: Array.isArray(filters?.countries) && filters.countries.length > 0 ? filters.countries : null,
    p_marital_statuses: Array.isArray(filters?.maritalStatus) && filters.maritalStatus.length > 0 ? filters.maritalStatus : null,
    p_interests: Array.isArray(filters?.interests) && filters.interests.length > 0 ? filters.interests : null,
    p_education: Array.isArray(filters?.education) && filters.education.length > 0 ? filters.education : null,
    p_exclude_kovil_pirivu: excludeMerged.length > 0 ? excludeMerged : null,
    p_page_size: Number(pageSize),
    p_cursor_updated_at: cursor?.updatedAt ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_exclude_user_id: currentUserId,
    p_forced_gender: forcedTargetGender,
  };
  // ✅ POINT TO V2
  const { data, error } = await client.rpc('search_profile_cards_v1', payload);

  if (error) throw error;

  // 3. This logging will now work without ReferenceErrors
  if (!data || data.length === 0) {
    console.warn('⚠️ RPC returned 0 rows for payload:', JSON.stringify(payload, null, 2));
  }

  const rows = Array.isArray(data) ? (data as ThinProfileCard[]) : [];
  const hasMore = rows.length > pageSize;
  const profiles = hasMore ? rows.slice(0, pageSize) : rows;

  const last = profiles[profiles.length - 1];
  const nextCursor: SearchCursor | null =
    hasMore && last?.updated_at && last?.id ? { updatedAt: last.updated_at, id: last.id } : null;

  return { profiles, nextCursor };
}