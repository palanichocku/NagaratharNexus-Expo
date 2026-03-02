// ./src/services/favorite.service.ts
import { supabase } from '../lib/supabase';
import type { SearchCursor, ThinProfileCard } from './search.service';

type AddFavoriteResult =
  | { ok: true }
  | { ok: false; reason: 'LIMIT_REACHED'; limit: number }
  | { ok: false; reason: 'ERROR'; message?: string };

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

// Cache config to avoid spamming DB
let cachedLimit: { value: number; fetchedAt: number } | null = null;
const LIMIT_TTL_MS = 60_000;

async function getFavoritesLimit(): Promise<number> {
  const now = Date.now();
  if (cachedLimit && now - cachedLimit.fetchedAt < LIMIT_TTL_MS) return cachedLimit.value;

  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'global_config')
      .maybeSingle();

    if (error) throw error;

    const raw = (data?.value as any)?.favoritesLimit;
    const n = Math.max(
      1,
      Math.min(MAX_LIMIT, parseInt(String(raw ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
    );

    cachedLimit = { value: n, fetchedAt: now };
    return n;
  } catch {
    cachedLimit = { value: DEFAULT_LIMIT, fetchedAt: now };
    return DEFAULT_LIMIT;
  }
}

export type FavoritesCursor = {
  createdAt: string;
  favoriteId: string;
};

export type FavoritesPageResult = {
  profiles: ThinProfileCard[];
  nextCursor: FavoritesCursor | null;
};

const toCursor = (row: any): FavoritesCursor | null => {
  const createdAt = String(row?.fav_created_at ?? '');
  const favoriteId = String(row?.id ?? '');
  if (!createdAt || !favoriteId) return null;
  return { createdAt, favoriteId };
};

export const favoriteService = {
  /** ✅ Fast: paged “thin cards” via RPC */
  async getFavoriteCardsPage(params: {
    pageSize: number;
    cursor?: FavoritesCursor | null;
  }): Promise<FavoritesPageResult> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { profiles: [], nextCursor: null };

    const requestSize = params.pageSize + 1;

    const { data, error } = await supabase.rpc('get_favorite_profile_cards_v1', {
      p_user_id: user.id,
      p_page_size: requestSize,
      p_cursor_created_at: params.cursor?.createdAt ?? null,
      p_cursor_favorite_id: params.cursor?.favoriteId ?? null,
    });

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    const hasMore = rows.length > params.pageSize;
    const profiles = hasMore ? rows.slice(0, params.pageSize) : rows;

    const last = profiles[profiles.length - 1];
    const nextCursor = hasMore ? toCursor(last) : null;

    return { profiles: profiles as ThinProfileCard[], nextCursor };
  },

  async isFavorite(profileId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !profileId) return false;

    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('favorite_id', profileId)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    } catch {
      return false;
    }
  },

  async addFavoriteWithLimit(profileId: string): Promise<AddFavoriteResult> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !profileId) return { ok: false, reason: 'ERROR', message: 'Not authenticated' };

    try {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, favorite_id: profileId });

      if (error) {
        const msg = String((error as any)?.message ?? '');

        // ✅ Trigger error format: favorites_limit_reached:5
        if (msg.includes('favorites_limit_reached:')) {
          const lim = parseInt(msg.split(':').pop() || '5', 10) || 5;
          return { ok: false, reason: 'LIMIT_REACHED', limit: lim };
        }

        // ✅ Already favorited (unique constraint)
        if ((error as any).code === '23505') return { ok: true };

        return { ok: false, reason: 'ERROR', message: msg };
      }

      return { ok: true };
    } catch (e: any) {
      return { ok: false, reason: 'ERROR', message: e?.message };
    }
  },

  async removeFavorite(profileId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !profileId) return;

    try {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('favorite_id', profileId);

      if (error) throw error;
    } catch (e) {
      console.error('[FAV_SERVICE] Remove Error:', e);
    }
  },

  async getFavoritesLimitCached() {
    return getFavoritesLimit();
  },
};