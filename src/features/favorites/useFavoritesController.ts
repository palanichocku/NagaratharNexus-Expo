// ./src/features/favorites/useFavoritesController.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { ThinProfileCard } from '../../services/search.service';

export type FavoriteCursor = {
  createdAt: string;
  favoriteId: string;
};

type FavoriteRow = ThinProfileCard & {
  fav_created_at?: string | null;
};

const PAGE_SIZE = 20;

function toMsString(v: unknown): string {
  const ms = typeof v === 'number' ? v : parseInt(String(v ?? '0'), 10);
  return String(Number.isFinite(ms) ? ms : 0);
}

export function useFavoritesController() {
  const [cards, setCards] = useState<ThinProfileCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [durationMs, setDurationMs] = useState('0');

  const [page, setPage] = useState(0);
  const [canNextPage, setCanNextPage] = useState(false);
  const [canPrevPage, setCanPrevPage] = useState(false);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // cursor stack: index=page, value=cursor for that page
  const cursorStackRef = useRef<(FavoriteCursor | null)[]>([null]);
  const reqIdRef = useRef(0);

  const selectedProfile = selectedIndex === null ? null : cards[selectedIndex];

  const reset = useCallback(() => {
    cursorStackRef.current = [null];
    setCards([]);
    setLoading(false);
    setDurationMs('0');
    setPage(0);
    setCanPrevPage(false);
    setCanNextPage(false);
    setSelectedIndex(null);
  }, []);

  const executePage = useCallback(
    async (nextPage: number) => {
      const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

      setLoading(true);
      const myReqId = ++reqIdRef.current;

      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;

        if (!user) {
          // ✅ critical: don’t get stuck loading
          if (myReqId === reqIdRef.current) {
            reset();
          }
          return;
        }

        const cursor = cursorStackRef.current[nextPage] ?? null;

        const requestSize = PAGE_SIZE + 1;

        const { data, error } = await supabase.rpc('get_favorite_profile_cards_v1', {
          p_user_id: user.id,
          p_page_size: requestSize,
          p_cursor_created_at: cursor?.createdAt ?? null,
          p_cursor_favorite_id: cursor?.favoriteId ?? null,
        });

        if (error) throw error;

        const rows: FavoriteRow[] = Array.isArray(data) ? (data as any) : [];
        const hasMore = rows.length > PAGE_SIZE;
        const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

        // next cursor comes from the *last returned row* (fav ordering)
        const last = pageRows[pageRows.length - 1];
        const computedNextCursor: FavoriteCursor | null =
          hasMore && last?.fav_created_at && last?.id
            ? { createdAt: String(last.fav_created_at), favoriteId: String(last.id) }
            : null;

        if (myReqId !== reqIdRef.current) return;

        setCards(pageRows as ThinProfileCard[]);
        setPage(nextPage);

        cursorStackRef.current[nextPage + 1] = computedNextCursor;

        setCanPrevPage(nextPage > 0);
        setCanNextPage(!!computedNextCursor);

        setSelectedIndex(null);

        const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        setDurationMs(toMsString((endTime as number) - (startTime as number)));
      } catch (e) {
        console.error('[FAV] executePage failed:', e);
        if (myReqId === reqIdRef.current) {
          setCards([]);
          setSelectedIndex(null);
          setCanPrevPage(nextPage > 0);
          setCanNextPage(false);
          setDurationMs('0');
        }
      } finally {
        if (myReqId === reqIdRef.current) setLoading(false);
      }
    },
    [reset],
  );

  const refresh = useCallback(() => {
    cursorStackRef.current = [null];
    setPage(0);
    setCanPrevPage(false);
    setCanNextPage(false);
    setSelectedIndex(null);
    void executePage(0);
  }, [executePage]);

  const gotoPage = useCallback(
    (p: number) => {
      const next = Math.max(0, p);
      void executePage(next);
    },
    [executePage],
  );

  const openByIndex = useCallback(
    (i: number) => {
      setSelectedIndex(() => {
        const clamped = Math.max(0, Math.min(i, Math.max(0, cards.length - 1)));
        return Number.isFinite(clamped) ? clamped : null;
      });
    },
    [cards.length],
  );

  const closeFocus = useCallback(() => setSelectedIndex(null), []);

  const removeFromLocal = useCallback((profileId: string) => {
    if (!profileId) return;

    setCards((prev) => {
      const next = prev.filter((p) => String(p.id) !== String(profileId));
      setSelectedIndex((idx) => {
        if (idx === null) return null;
        if (next.length === 0) return null;
        return Math.min(idx, next.length - 1);
      });

      // If we removed items, pagination might change, but keep it simple:
      // allow user to hit refresh if needed.
      return next;
    });
  }, []);

  // Optional: auto-refresh once on mount (safe)
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useMemo(
    () => ({
      // data
      cards,
      loading,
      durationMs,

      // paging
      page,
      canPrevPage,
      canNextPage,
      gotoPage,
      refresh,

      // focus modal
      selectedIndex,
      selectedProfile,
      openByIndex,
      closeFocus,

      // local ops
      removeFromLocal,

      // debug
      reset,
    }),
    [
      cards,
      loading,
      durationMs,
      page,
      canPrevPage,
      canNextPage,
      gotoPage,
      refresh,
      selectedIndex,
      selectedProfile,
      openByIndex,
      closeFocus,
      removeFromLocal,
      reset,
    ],
  );
}