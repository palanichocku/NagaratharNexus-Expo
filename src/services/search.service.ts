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
  const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();

  try {
    const interests = normalizeInterests(filters?.interests);
    const countries = normalizeStringArray(filters?.countries);
    const maritalStatuses = normalizeStringArray(filters?.maritalStatus);
    const educations = normalizeStringArray(filters?.education);
    const excludeKovilPirivu = normalizeStringArray(filters?.excludeKovilPirivu);

    // ✅ Rule inputs
    const currentUserId = caller?.userId ?? null;
    const role = normRole(caller?.role);
    const myGender = normUpper(caller?.gender || null);

    // ✅ Only USER is constrained to opposite gender
    const forcedTargetGender =
      role === 'USER' ? oppositeGender(myGender) : null;

    // We still do "pageSize+1" semantics, but AFTER filtering.
    const wantFiltered = pageSize + 1;

    // We'll fetch multiple batches until we have enough filtered results or run out.
    // Safety cap prevents accidental infinite loops.
    const MAX_BATCHES = 6;

    let workingCursor: SearchCursor | null | undefined = cursor ?? null;
    let exhausted = false;

    const kept: any[] = [];
    // Track cursor of the *pageSize-th kept profile* for correct nextCursor
    // (cursor should advance after the last returned item).
    let lastReturnedCursor: SearchCursor | null = null;

    for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
      if (kept.length >= wantFiltered || exhausted) break;

      // Fetch one extra row to know if this batch had more,
      // but because we may filter, we’ll likely need multiple batches anyway.
      const requestSize = pageSize + 1;

      console.time('rpc search_profiles_v2');
      const { data, error } = await supabase.rpc('search_profiles_v2', {
        p_query: (filters?.query || '').trim() || null,
        p_min_age: filters?.minAge ?? 18,
        p_max_age: filters?.maxAge ?? 60,
        p_min_height: filters?.minHeight ?? 48,
        p_max_height: filters?.maxHeight ?? 84,
        p_countries: hasAny(countries) ? countries : null,
        p_marital_statuses: hasAny(maritalStatuses) ? maritalStatuses : null,
        p_educations: hasAny(educations) ? educations : null,
        p_interests: hasAny(interests) ? interests : null,
        p_page_size: requestSize,
        p_cursor_updated_at: workingCursor?.updatedAt ?? null,
        p_cursor_id: workingCursor?.id ?? null,
        p_exclude_kovil_pirivu: hasAny(excludeKovilPirivu) ? excludeKovilPirivu : null,
      });
      console.timeEnd('rpc search_profiles_v2');
      
      if (error) throw error;

      const rawRows = Array.isArray(data) ? data.map((r: any) => r.profile_data) : [];
      if (rawRows.length === 0) {
        exhausted = true;
        break;
      }

      // Advance the working cursor to the last RAW row we saw
      const lastRaw = rawRows[rawRows.length - 1];
      if (lastRaw?.updated_at && lastRaw?.id) {
        workingCursor = { updatedAt: lastRaw.updated_at, id: lastRaw.id };
      } else {
        // If RPC doesn’t return cursor fields, we cannot safely continue.
        exhausted = true;
      }

      // If batch returned fewer than requestSize, no more rows exist after this batch.
      if (rawRows.length < requestSize) exhausted = true;

      // Apply required filtering while preserving ordering.
      for (const p of rawRows) {
        if (!p) continue;

        // Rule #2: exclude own profile always
        if (currentUserId && String(p.id) === String(currentUserId)) continue;

        // Rule #1: opposite gender only for USER role
        if (forcedTargetGender) {
          const pg = normUpper(p.gender || null);
          if (pg !== forcedTargetGender) continue;
        }

        kept.push(p);

        // Set lastReturnedCursor when we hit the pageSize-th item,
        // because that is the cursor after the last returned item.
        if (kept.length === pageSize && p?.updated_at && p?.id) {
          lastReturnedCursor = { updatedAt: p.updated_at, id: p.id };
        }

        if (kept.length >= wantFiltered) break;
      }
    }

    const hasMore = kept.length > pageSize;
    const profiles = hasMore ? kept.slice(0, pageSize) : kept;

    // nextCursor should advance after the last item the user received.
    // If we never hit pageSize items, there is no next page anyway.
    const nextCursor: SearchCursor | null =
      hasMore ? (lastReturnedCursor ?? null) : null;

    const endTime = typeof performance !== "undefined" ? performance.now() : Date.now();

    return {
      profiles,
      totalCount: syntheticTotalCount(page, pageSize, profiles.length),
      duration: (endTime - startTime).toFixed(2),
      nextCursor,
    };
  } catch (e) {
    console.error("searchProfiles failed:", e);
    return { profiles: [], totalCount: 0, duration: "0", nextCursor: null };
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