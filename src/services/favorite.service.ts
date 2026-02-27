// src/services/favorite.service.ts
import { supabase } from '../lib/supabase';

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
  } catch (e) {
    // fallback
    cachedLimit = { value: DEFAULT_LIMIT, fetchedAt: now };
    return DEFAULT_LIMIT;
  }
}

async function countFavorites(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('favorites')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) throw error;
  return Number(count ?? 0);
}

export const favoriteService = {
  async getFavorites() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    try {
      // ✅ Also fetch created_at for stable ordering if you have it
      const { data: favs, error } = await supabase
        .from('favorites')
        .select('favorite_id')
        .eq('user_id', user.id);

      if (error) throw error;
      if (!favs || favs.length === 0) return [];

      const profileIds = favs.map((f: any) => f.favorite_id);
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', profileIds);

      if (profileError) throw profileError;
      return profiles || [];
    } catch (e) {
      console.error('[FAV_SERVICE] Manual fetch error:', e);
      return [];
    }
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

  // ✅ New: add with limit (configurable, max 20)
  async addFavoriteWithLimit(profileId: string): Promise<
    | { ok: true }
    | { ok: false; reason: 'LIMIT_REACHED'; limit: number }
    | { ok: false; reason: 'ERROR'; message?: string }
  > {
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

        // ✅ Expected-ish: already favorited (unique constraint)
        if ((error as any).code === '23505') {
          return { ok: true };
        }

        // Unexpected
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
};