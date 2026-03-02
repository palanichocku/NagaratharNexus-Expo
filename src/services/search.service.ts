// ./src/services/search.service.ts
import { supabase } from "../lib/supabase";

export type SearchCursor = {
  updatedAt: string;
  id: string;
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
  pirivu?: string | null; // ✅ include if your RPC returns it
  native_place: string | null;

  profile_photo_url: string | null;
  updated_at: string;
};

export type SearchResult = {
  profiles: ThinProfileCard[];
  totalCount: number;
  duration: string;
  nextCursor: SearchCursor | null;
};

const hasAny = (arr: any) => Array.isArray(arr) && arr.length > 0;

const syntheticTotalCount = (page: number, pageSize: number, returned: number) => {
  if (returned === pageSize) return (page + 1) * pageSize + 1;
  return page * pageSize + returned;
};

const normalizeStringArray = (arr?: string[]): string[] => {
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => String(s ?? "").trim()).filter((s) => s.length > 0);
};

const uniq = (arr: string[]): string[] => Array.from(new Set(arr));

function normUpper(v: any): string {
  return String(v ?? "").trim().toUpperCase();
}

function normRole(raw: any): "ADMIN" | "MODERATOR" | "USER" {
  const r = normUpper(raw);
  if (r === "ADMIN") return "ADMIN";
  if (r === "MODERATOR") return "MODERATOR";
  return "USER";
}

function oppositeGender(g: string | null): "MALE" | "FEMALE" | null {
  const gg = normUpper(g);
  if (gg === "MALE") return "FEMALE";
  if (gg === "FEMALE") return "MALE";
  return null;
}

function buildHardKovilExclusion(kovil: string | null, pirivu: string | null): string[] {
  const k = String(kovil ?? "").trim();
  const p = String(pirivu ?? "").trim();
  if (!k) return [];
  if (p) return [`${k}||${p}`];
  return [`${k}||*`];
}

export const searchProfiles = async (
  filters: SearchFilters,
  page: number = 0,
  pageSize: number = 20,
  cursor?: SearchCursor | null,
  caller?: SearchCallerContext,
): Promise<SearchResult> => {
  const startTime =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  try {
    const countries = normalizeStringArray(filters?.countries);
    const maritalStatuses = normalizeStringArray(filters?.maritalStatus);

    // ✅ NEW: send these to backend
    const interests = normalizeStringArray(filters?.interests);
    const education = normalizeStringArray(filters?.education);

    const currentUserId = caller?.userId ?? null;
    const role = normRole(caller?.role);
    const myGender = normUpper(caller?.gender || null);
    const forcedTargetGender = role === "USER" ? oppositeGender(myGender) : null;

    const hardExclude = buildHardKovilExclusion(caller?.kovil ?? null, caller?.pirivu ?? null);
    const extraExclude = normalizeStringArray(filters?.excludeKovilPirivu);
    const excludeMerged = uniq([...hardExclude, ...extraExclude]);

    const requestSize = pageSize + 1;

    const { data, error } = await supabase.rpc("search_profile_cards_v1", {
      p_query: (filters?.query || "").trim() || null,
      p_min_age: filters?.minAge ?? 18,
      p_max_age: filters?.maxAge ?? 60,
      p_min_height: filters?.minHeight ?? 48,
      p_max_height: filters?.maxHeight ?? 84,
      p_countries: hasAny(countries) ? countries : null,
      p_marital_statuses: hasAny(maritalStatuses) ? maritalStatuses : null,

      // ✅ NEW
      p_interests: hasAny(interests) ? interests : null,
      p_education: hasAny(education) ? education : null,

      p_exclude_kovil_pirivu: excludeMerged.length ? excludeMerged : null,

      p_page_size: requestSize,
      p_cursor_updated_at: cursor?.updatedAt ?? null,
      p_cursor_id: cursor?.id ?? null,

      p_exclude_user_id: currentUserId,
      p_forced_gender: forcedTargetGender,
    });

    if (error) throw error;

    const rows = Array.isArray(data) ? (data as ThinProfileCard[]) : [];

    const hasMore = rows.length > pageSize;
    const profiles = hasMore ? rows.slice(0, pageSize) : rows;

    const last = profiles[profiles.length - 1];
    const nextCursor: SearchCursor | null =
      hasMore && last?.updated_at && last?.id
        ? { updatedAt: last.updated_at, id: last.id }
        : null;

    const endTime =
      typeof performance !== "undefined" ? performance.now() : Date.now();

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

/** ✅ Robust helper: always returns a single profile object or null */
export async function getProfileById(profileId: string): Promise<any | null> {
  const { data, error } = await supabase.rpc("get_profile_by_id_v1", { p_id: profileId });
  if (error) throw error;

  // Supabase RPC can return: object | [object] | {profile: object} | null
  if (!data) return null;
  if (Array.isArray(data)) return data[0] ?? null;
  if (typeof data === "object") {
    if ((data as any).profile) return (data as any).profile;
    if ((data as any).data) return (data as any).data;
    return data;
  }
  return null;
}

export const getFilterMetadata = async () => {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const { data, error } = await supabase.rpc("get_filter_metadata");
  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();

  if (error) throw error;

  if (__DEV__) {
    const keys = data && typeof data === "object" ? Object.keys(data) : [];
    //console.log(`getFilterMetadata ok in ${(t1 - t0).toFixed(0)}ms keys=`, keys);
  }

  return data;
};