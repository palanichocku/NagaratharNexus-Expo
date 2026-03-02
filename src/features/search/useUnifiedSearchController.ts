// ./src/features/search/useUnifiedSearchController.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { searchProfiles, type SearchCursor, type SearchFilters, type ThinProfileCard } from '../../services/search.service';
import { DEFAULT_FILTERS, isDefaultFilters, PAGE_SIZE, type SearchContext } from './types';

type Options = {
  context: SearchContext;
  enabled: boolean;
  initialFilters?: SearchFilters;
  autoSearchOnMount?: boolean;
};

function toMsString(v: unknown): string {
  const ms = typeof v === 'number' ? v : parseInt(String(v ?? '0'), 10);
  return String(Number.isFinite(ms) ? ms : 0);
}

export function useUnifiedSearchController(options: Options) {
  const { context, enabled, initialFilters, autoSearchOnMount = false } = options;

  // Draft vs applied
  const [filters, setFilters] = useState<SearchFilters>(initialFilters ?? DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(initialFilters ?? DEFAULT_FILTERS);

  const filtersRef = useRef<SearchFilters>(filters);
  useEffect(() => { filtersRef.current = filters; }, [filters]);

  // Current page cards
  const [cards, setCards] = useState<ThinProfileCard[]>([]);

  // Selection for focus view
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Perf + state
  const [loading, setLoading] = useState(false);
  const [durationMs, setDurationMs] = useState('0');
  const [hasSearched, setHasSearched] = useState(false);

  // Paging
  const [page, setPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);

  // Cursor stack: index = page number, value = cursor for that page
  const cursorStackRef = useRef<(SearchCursor | null)[]>([null]);
  const [cursorStack, setCursorStack] = useState<(SearchCursor | null)[]>([null]);

  // Avoid stale responses
  const reqIdRef = useRef(0);

  const appliedIsDefault = useMemo(() => isDefaultFilters(appliedFilters), [appliedFilters]);

  const resetAll = useCallback(() => {
    cursorStackRef.current = [null];
    setCursorStack([null]);
    setHasNextPage(false);
    setPage(0);
    setCards([]);
    setSelectedIndex(null);
    setLoading(false);
    setDurationMs('0');
  }, []);

  const executePage = useCallback(
    async (nextPage: number, overrideFilters?: SearchFilters) => {
      if (!enabled) return;

      const f = overrideFilters ?? appliedFilters;

      if (isDefaultFilters(f)) {
        resetAll();
        return;
      }

      setLoading(true);
      setHasSearched(true);
      const myReqId = ++reqIdRef.current;

      try {
        const cursor = cursorStackRef.current[nextPage] ?? null;

        const result = await searchProfiles(f, nextPage, PAGE_SIZE, cursor, {
          userId: context?.userId ?? null,
          role: context?.role ?? null,
          gender: context?.gender ?? null,
          kovil: (context as any)?.kovil ?? null,
          pirivu: (context as any)?.pirivu ?? null,
        });

        if (myReqId !== reqIdRef.current) return;

        setDurationMs(toMsString(result?.duration));

        const rows = (result?.profiles ?? []) as ThinProfileCard[];
        setCards(rows);
        setPage(nextPage);

        // Only allow next page if we got a full page
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

        // ✅ reset selection when new page loads
        setSelectedIndex(null);
      } catch (e) {
        console.error('Search failed:', e);
        setCards([]);
        setSelectedIndex(null);
        setHasNextPage(false);
        setDurationMs('0');
      } finally {
        if (myReqId === reqIdRef.current) setLoading(false);
      }
    },
    [appliedFilters, context, enabled, resetAll],
  );

  const apply = useCallback(() => {
    const nextApplied = filtersRef.current;
    setAppliedFilters(nextApplied);

    // reset paging + selection
    cursorStackRef.current = [null];
    setCursorStack([null]);
    setHasNextPage(false);
    setPage(0);
    setSelectedIndex(null);

    if (isDefaultFilters(nextApplied)) {
      setCards([]);
      return;
    }

    executePage(0, nextApplied);
  }, [executePage]);

  const onDraftChange = useCallback(
    (nextDraft: SearchFilters) => {
      filtersRef.current = nextDraft;
      setFilters(nextDraft);

      if (isDefaultFilters(nextDraft)) {
        resetAll();
        setHasSearched(false);
      }
    },
    [resetAll],
  );

  const gotoPage = useCallback(
    (p: number) => {
      const nextPage = Math.max(0, p);
      executePage(nextPage);
    },
    [executePage],
  );

  // Focus view helpers
  const openByIndex = useCallback((i: number) => {
    setSelectedIndex(() => {
      const clamped = Math.max(0, Math.min(i, Math.max(0, cards.length - 1)));
      return Number.isFinite(clamped) ? clamped : null;
    });
  }, [cards.length]);

  const closeFocus = useCallback(() => setSelectedIndex(null), []);

  const focusPrev = useCallback(() => {
    if (selectedIndex === null) return;

    if (selectedIndex > 0) {
      setSelectedIndex((v) => (v === null ? null : Math.max(0, v - 1)));
      return;
    }

    // At start: page back if available
    if (page > 0) {
      // load prev page then open last item
      void (async () => {
        await executePage(page - 1);
        setSelectedIndex(PAGE_SIZE - 1);
      })();
    }
  }, [executePage, page, selectedIndex]);

  const focusNext = useCallback(() => {
    if (selectedIndex === null) return;

    if (selectedIndex < cards.length - 1) {
      setSelectedIndex((v) => (v === null ? null : Math.min(cards.length - 1, v + 1)));
      return;
    }

    if (hasNextPage) {
      void (async () => {
        await executePage(page + 1);
        setSelectedIndex(0);
      })();
    }
  }, [cards.length, executePage, hasNextPage, page, selectedIndex]);

  const canFocusPrev = useMemo(() => {
    if (selectedIndex === null) return false;
    return selectedIndex > 0 || page > 0;
  }, [page, selectedIndex]);

  const canFocusNext = useMemo(() => {
    if (selectedIndex === null) return false;
    return selectedIndex < cards.length - 1 || hasNextPage;
  }, [cards.length, hasNextPage, selectedIndex]);

  // Auto-search on mount
  useEffect(() => {
    if (!enabled) return;
    if (!autoSearchOnMount) return;
    if (isDefaultFilters(appliedFilters)) return;

    executePage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, autoSearchOnMount]);

  // If enabled flips off, reset
  useEffect(() => {
    if (enabled) return;
    resetAll();
    setHasSearched(false);
  }, [enabled, resetAll]);

  const selectedProfile = selectedIndex === null ? null : cards[selectedIndex];

  return {
    // filters
    filters,
    appliedFilters,
    appliedIsDefault,
    onDraftChange,
    apply,

    // results
    cards,

    // selection
    selectedIndex,
    selectedProfile,
    openByIndex,
    closeFocus,

    // focus navigation
    focusPrev,
    focusNext,
    canFocusPrev,
    canFocusNext,

    // paging
    page,
    hasNextPage,
    gotoPage,

    // state
    loading,
    durationMs,
    hasSearched,

    // debug
    cursorStack,
    resetAll,
  };
}