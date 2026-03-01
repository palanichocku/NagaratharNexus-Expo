// ./src/services/search.service.ts
//  This file implements the searchProfiles function which performs a keyset paginated search with various filters 
//  and role-based access control.
import { supabase } from "../lib/supabase";

export type SearchCursor = {
  updatedAt: string; // ISO timestamptz
  id: string;        // uuid
};

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

export type SearchResult = {
  profiles: any[];
  totalCount: number; // synthetic (Option A)
  duration: string;
  nextCursor: SearchCursor | null;
};

export type SearchCallerContext = {
  userId?: string | null;
  role?: string | null;   // 'ADMIN' | 'MODERATOR' | 'USER' (case-insensitive)
  gender?: string | null; // 'MALE' | 'FEMALE' (case-insensitive)
  kovil?: string | null;
  pirivu?: string | null;
};

const MAX_INTERESTS = 3;

const hasAny = (arr: any) => Array.isArray(arr) && arr.length > 0;

const syntheticTotalCount = (page: number, pageSize: number, returned: number) => {
  if (returned === pageSize) return (page + 1) * pageSize + 1;
  return page * pageSize + returned;
};

const normalizeStringArray = (arr?: string[]): string[] => {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s) => String(s ?? "").trim())
    .filter((s) => s.length > 0);
};

const uniq = (arr: string[]): string[] => Array.from(new Set(arr));

const normalizeInterests = (interests?: string[]): string[] => {
  const cleaned = uniq(normalizeStringArray(interests));
  return cleaned.slice(0, MAX_INTERESTS);
};

function buildHardKovilExclusion(kovil: string | null, pirivu: string | null): string[] {
  const k = String(kovil ?? '').trim();
  const p = String(pirivu ?? '').trim();
  if (!k) return [];
  if (p) return [`${k}||${p}`]; // ✅ exclude only that pirivu within kovil
  return [`${k}||*`];           // ✅ if pirivu unknown, exclude whole kovil
}

function normUpper(v: any): string {
  return String(v ?? "").trim().toUpperCase();
}

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

/**
 * Keyset paginated search (no COUNT(*), Option A)
 * ✅ Now enforces:
 *  - opposite-gender for USER role
 *  - excludes own profile always
 *  - preserves pagination by fetching more rows if filtering removes too many
 */
export const searchProfiles = async (
  filters: SearchFilters,
  page: number = 0,
  pageSize: number = 20,
  cursor?: SearchCursor | null,
  caller?: SearchCallerContext,
): Promise<SearchResult> => {
  const startTime =
    typeof performance !== 'undefined' ? performance.now() : Date.now();

  try {
    const countries = normalizeStringArray(filters?.countries);
    const maritalStatuses = normalizeStringArray(filters?.maritalStatus);

    const currentUserId = caller?.userId ?? null;
    const role = normRole(caller?.role);
    const myGender = normUpper(caller?.gender || null);

    const forcedTargetGender =
      role === 'USER' ? oppositeGender(myGender) : null;

    // ✅ HARD KOVIL RULE
    const hardExclude = buildHardKovilExclusion(
      caller?.kovil ?? null,
      caller?.pirivu ?? null,
    );

    const extraExclude = normalizeStringArray(
      filters?.excludeKovilPirivu,
    );

    const excludeMerged = uniq([...hardExclude, ...extraExclude]);

    const requestSize = pageSize + 1;

    console.time?.('rpc search_profile_cards_v1');
    const { data, error } = await supabase.rpc(
      'search_profile_cards_v1',
      {
        p_query: (filters?.query || '').trim() || null,
        p_min_age: filters?.minAge ?? 18,
        p_max_age: filters?.maxAge ?? 60,
        p_min_height: filters?.minHeight ?? 48,
        p_max_height: filters?.maxHeight ?? 84,
        p_countries: hasAny(countries) ? countries : null,
        p_marital_statuses: hasAny(maritalStatuses)
          ? maritalStatuses
          : null,

        p_exclude_kovil_pirivu: excludeMerged.length
          ? excludeMerged
          : null,

        p_page_size: requestSize,
        p_cursor_updated_at: cursor?.updatedAt ?? null,
        p_cursor_id: cursor?.id ?? null,

        p_exclude_user_id: currentUserId,
        p_forced_gender: forcedTargetGender,
      },
    );
    console.timeEnd?.('rpc search_profile_cards_v1');

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];

    const hasMore = rows.length > pageSize;
    const profiles = hasMore ? rows.slice(0, pageSize) : rows;

    const last = profiles[profiles.length - 1];
    const nextCursor: SearchCursor | null =
      hasMore && last?.updated_at && last?.id
        ? { updatedAt: last.updated_at, id: last.id }
        : null;

    const endTime =
      typeof performance !== 'undefined' ? performance.now() : Date.now();

    return {
      profiles,
      totalCount: syntheticTotalCount(
        page,
        pageSize,
        profiles.length,
      ),
      duration: (endTime - startTime).toFixed(2),
      nextCursor,
    };
  } catch (e) {
    console.error('searchProfiles failed:', e);
    return {
      profiles: [],
      totalCount: 0,
      duration: '0',
      nextCursor: null,
    };
  }
};

export const getFilterMetadata = async () => {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const { data, error } = await supabase.rpc("get_filter_metadata");
  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();

  if (error) throw error;

  // Safe log (won’t freeze)
  if (__DEV__) {
    const keys = data && typeof data === 'object' ? Object.keys(data) : [];
    console.log(`getFilterMetadata ok in ${(t1 - t0).toFixed(0)}ms keys=`, keys);
  }

  return data;
};