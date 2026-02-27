// src/features/search/useUnifiedSearchController.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { searchProfiles, type SearchCursor, type SearchFilters } from '../../services/search.service';
import { DEFAULT_FILTERS, isDefaultFilters, PAGE_SIZE, type SearchContext } from './types';

type Options = {
  context: SearchContext;
  enabled: boolean; // gate/capability: if false, no searching
  initialFilters?: SearchFilters;
  autoSearchOnMount?: boolean; // admin often wants true
};

function toMsString(v: unknown): string {
  const ms = typeof v === 'number' ? v : parseInt(String(v ?? '0'), 10);
  return String(Number.isFinite(ms) ? ms : 0);
}

export function useUnifiedSearchController(options: Options) {
  const { context, enabled, initialFilters, autoSearchOnMount = false } = options;

  // Draft vs applied (keeps FilterPanel “drafting” behavior consistent)
  const [filters, setFilters] = useState<SearchFilters>(initialFilters ?? DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(initialFilters ?? DEFAULT_FILTERS);

  // Always-latest draft filters for Apply
  const filtersRef = useRef<SearchFilters>(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Results (single page at a time)
  const [profiles, setProfiles] = useState<any[]>([]);
  const [index, setIndex] = useState(0);

  // Perf + search state
  const [loading, setLoading] = useState(false);
  const [durationMs, setDurationMs] = useState('0');
  const [hasSearched, setHasSearched] = useState(false);

  // Keyset paging
  const [page, setPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);

  const cursorStackRef = useRef<(SearchCursor | null)[]>([null]);
  const [cursorStack, setCursorStack] = useState<(SearchCursor | null)[]>([null]); // for debugging/UI parity if needed

  // Avoid stale async responses overriding newer searches
  const reqIdRef = useRef(0);

  const appliedIsDefault = useMemo(() => isDefaultFilters(appliedFilters), [appliedFilters]);

  const resetPagingAndResults = useCallback(() => {
    cursorStackRef.current = [null];
    setCursorStack([null]);
    setHasNextPage(false);
    setPage(0);
    setProfiles([]);
    setIndex(0);
    setLoading(false);
  }, []);

  const executePage = useCallback(
    async (nextPage: number, overrideFilters?: SearchFilters, afterLoadIndex?: number) => {
      if (!enabled) return;

      const f = overrideFilters ?? appliedFilters;

      // Default = no search, show fun state
      if (isDefaultFilters(f)) {
        resetPagingAndResults();
        return;
      }

      setLoading(true);
      setHasSearched(true);
      const myReqId = ++reqIdRef.current;

      try {
        const cursor = cursorStackRef.current[nextPage] ?? null;

        // ✅ IMPORTANT: store result and pass correct args
        const result = await searchProfiles(f, nextPage, PAGE_SIZE, cursor, {
          userId: context?.userId ?? null,
          role: context?.role ?? null,
          gender: context?.gender ?? null,
        });

        if (myReqId !== reqIdRef.current) return;

        setDurationMs(toMsString(result?.duration));
        const rows = result?.profiles || [];

        setProfiles(rows);
        setPage(nextPage);

        // ✅ Only allow a next page if we got a full page of results.
        const computedNextCursor =
          rows.length === PAGE_SIZE ? (result?.nextCursor ?? null) : null;

        setCursorStack((prev) => {
          const updated = [...prev];
          updated[nextPage] = cursor;
          updated[nextPage + 1] = computedNextCursor;
          cursorStackRef.current = updated;
          return updated;
        });

        setHasNextPage(!!computedNextCursor);

        const idx =
          typeof afterLoadIndex === 'number'
            ? Math.max(0, Math.min(afterLoadIndex, Math.max(0, rows.length - 1)))
            : 0;

        setIndex(idx);
      } catch (e) {
        console.error('Search failed:', e);
        setProfiles([]);
        setIndex(0);
        setHasNextPage(false);
        setDurationMs('0');
      } finally {
        if (myReqId === reqIdRef.current) setLoading(false);
      }
    },
    [appliedFilters, context, enabled, resetPagingAndResults],
  );

  const apply = useCallback(() => {
    const nextApplied = filtersRef.current;
    setAppliedFilters(nextApplied);

    // new search resets paging
    cursorStackRef.current = [null];
    setCursorStack([null]);
    setHasNextPage(false);
    setPage(0);
    setIndex(0);

    if (isDefaultFilters(nextApplied)) {
      setProfiles([]);
      return;
    }

    executePage(0, nextApplied);
  }, [executePage]);

  const onDraftChange = useCallback(
    (nextDraft: SearchFilters) => {
      filtersRef.current = nextDraft;
      setFilters(nextDraft);

      // If draft resets to default, clear immediately (nice UX)
      if (isDefaultFilters(nextDraft)) {
        resetPagingAndResults();
      }
    },
    [resetPagingAndResults],
  );

  const next = useCallback(() => {
    if (loading) return;

    if (index < profiles.length - 1) {
      setIndex((i) => i + 1);
      return;
    }

    if (hasNextPage) executePage(page + 1);
  }, [executePage, hasNextPage, index, loading, page, profiles.length]);

  const prev = useCallback(() => {
    if (loading) return;

    if (index > 0) {
      setIndex((i) => i - 1);
      return;
    }

    if (page > 0) executePage(page - 1, undefined, PAGE_SIZE - 1);
  }, [executePage, index, loading, page]);

  const gotoPage = useCallback(
    (p: number) => {
      const nextPage = Math.max(0, p);
      executePage(nextPage);
    },
    [executePage],
  );

  // Auto-search on mount (Admin often wants this)
  useEffect(() => {
    if (!enabled) return;
    if (!autoSearchOnMount) return;
    if (isDefaultFilters(appliedFilters)) return;

    executePage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, autoSearchOnMount]);

  // If enabled flips off, hard reset
  useEffect(() => {
    if (enabled) return;
    resetPagingAndResults();
    setHasSearched(false);
    setDurationMs('0');
  }, [enabled, resetPagingAndResults]);

  const currentProfile = profiles[index];

  const globalPos = useMemo(() => {
    if (!profiles.length) return 0;
    return page * PAGE_SIZE + index + 1;
  }, [page, index, profiles.length]);

  return {
    filters,
    appliedFilters,
    appliedIsDefault,

    profiles,
    currentProfile,
    index,
    setIndex,

    page,
    hasNextPage,
    gotoPage,

    loading,
    durationMs,
    hasSearched,

    apply,
    resetPagingAndResults,
    onDraftChange,
    next,
    prev,

    cursorStack,
    globalPos,
  };
}