// src/features/search/SearchExperience.tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../../theme/ThemeProvider';
import FilterPanel from '../../../app/(tabs)/search/FilterPanel'; // ✅ reusing your existing panel
import ProfileFocusView from '../../../app/(tabs)/search/ProfileFocusView';

import { useUnifiedSearchController } from './useUnifiedSearchController';
import { DEFAULT_FILTERS, PAGE_SIZE, type SearchContext } from './types';

type GateState = 'LOADING' | 'ACTIVE' | 'PENDING' | 'NEW' | 'REJECTED';

type Props = {
  mode: 'USER' | 'ADMIN';
  context: SearchContext;

  // User screen uses gate; Admin usually doesn’t
  gateEnabled?: boolean;
  gateState?: GateState;

  autoSearchOnMount?: boolean; // Admin might set true
  initialFilters?: typeof DEFAULT_FILTERS;
  onReport?: () => void;
};

/** ---------------- Keyword refinement helpers (client-side) ---------------- */
function tokenizeQuery(q: string): string[] {
  return String(q || '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function profileToSearchBlob(p: any): string {
  // Add/adjust fields based on your schema. This is intentionally broad.
  const parts = [
    p?.full_name,
    p?.name,
    p?.first_name,
    p?.last_name,

    p?.profession,
    p?.occupation,
    p?.workplace,

    p?.education,
    p?.field_of_study,
    p?.university,

    p?.current_city,
    p?.current_state,
    p?.resident_country,
    p?.native_place,

    p?.kovil,
    p?.pirivu,
    p?.rasi,
    p?.nakshatra,
    p?.star,

    p?.bio,
    p?.about,
    p?.partner_expectations,
  ];

  return parts
    .filter((x) => x !== null && x !== undefined)
    .map((x) => String(x).toLowerCase())
    .join(' • ');
}

function matchesKeyword(p: any, q: string): boolean {
  const tokens = tokenizeQuery(q);
  if (tokens.length === 0) return true;

  const blob = profileToSearchBlob(p);
  // AND match: every token must exist somewhere in the blob
  return tokens.every((t) => blob.includes(t));
}

export default function SearchExperience({
  mode,
  context,
  gateEnabled = false,
  gateState = 'ACTIVE',
  autoSearchOnMount = false,
  initialFilters,
  onReport,
}: Props) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const isWeb = Platform.OS === 'web';

  const enabled = gateEnabled ? gateState === 'ACTIVE' : true;

  const c = useUnifiedSearchController({
    context,
    enabled,
    initialFilters: initialFilters ?? DEFAULT_FILTERS,
    autoSearchOnMount,
  });

  const perfAccent = theme.colors.success ?? theme.colors.primary;

  // Gate UI (only when enabled)
  if (gateEnabled && gateState !== 'ACTIVE') {
    return (
      <View style={styles.gateWrap}>
        <Ionicons name="lock-closed-outline" size={60} color={theme.colors.border} />
        <Text style={styles.emptyTitle}>
          {gateState === 'PENDING' ? 'Under Review' : 'Finish Setup'}
        </Text>
        <Text style={styles.emptySub}>
          Your profile must be approved by moderators before you can search the directory.
        </Text>
      </View>
    );
  }

  /** ✅ Client-side refinement (keyword search filters what is already loaded) */
  const keyword = (c.filters?.query || '').trim();
  const refinedProfiles = useMemo(() => {
    if (!keyword) return c.profiles;
    return (c.profiles || []).filter((p: any) => matchesKeyword(p, keyword));
  }, [c.profiles, keyword]);

  const showHeader = c.hasSearched || refinedProfiles.length > 0;

  // Clamp the focused index to the refined list (important when keyword filtering reduces items)
  const safeIndex = useMemo(() => {
    if (!refinedProfiles.length) return 0;
    return Math.max(0, Math.min(c.index, refinedProfiles.length - 1));
  }, [c.index, refinedProfiles.length]);

  const currentProfile = refinedProfiles.length ? refinedProfiles[safeIndex] : null;

  // Keep your header ordinal semantics but based on refined list
  const currentOrdinal = refinedProfiles.length
    ? (c.page * PAGE_SIZE) + safeIndex + 1
    : 0;

  return (
    <View style={[styles.container, isWeb && styles.webContainer]}>
      {/* Sidebar */}
      <View style={styles.sidebar}>
        <FilterPanel
          filters={c.filters}
          onFilterChange={c.onDraftChange}
          onApply={c.apply}
          // ✅ show refined count so the user sees keyword filtering immediately
          totalResults={refinedProfiles.length}
        />
      </View>

      <View style={styles.content}>
        {c.loading ? (
          <ActivityIndicator size="large" color={theme.colors.text} />
        ) : (
          <View style={styles.resultWrap}>
            {showHeader ? (
              <View style={styles.searchHeader}>
                <View>
                  <Text style={styles.searchText}>
                    {refinedProfiles.length > 0
                      ? `${currentOrdinal} • PAGE ${c.page + 1}`
                      : `0 RESULTS • PAGE ${c.page + 1}`}
                  </Text>

                  <View style={styles.perfBadge}>
                    <Ionicons name="flash" size={12} color={perfAccent} />
                    <Text style={[styles.perfText, { color: perfAccent }]}>
                      FAST • {c.durationMs}ms
                    </Text>
                  </View>

                  {/* Optional hint so users understand what happened */}
                  {keyword ? (
                    <Text style={[styles.searchText, { marginTop: 6, opacity: 0.7 }]}>
                      Refined by keywords: “{keyword}”
                    </Text>
                  ) : null}
                </View>

                <View style={styles.paginationRow}>
                  <TouchableOpacity
                    disabled={c.page === 0}
                    onPress={() => c.gotoPage(c.page - 1)}
                    style={[styles.pageBtn, c.page === 0 && { opacity: 0.3 }]}
                  >
                    <Ionicons name="chevron-back" size={18} color={theme.colors.primary} />
                  </TouchableOpacity>

                  <View style={styles.pageIndicator}>
                    <Text style={styles.pageText}>{c.page + 1}</Text>
                  </View>

                  <TouchableOpacity
                    disabled={!c.hasNextPage}
                    onPress={() => c.gotoPage(c.page + 1)}
                    style={[styles.pageBtn, !c.hasNextPage && { opacity: 0.3 }]}
                  >
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {refinedProfiles.length > 0 && currentProfile ? (
              <ProfileFocusView
                profile={currentProfile}
                // ✅ next/prev should move within refined list when keyword is active,
                // but still allow pagination using the controller when crossing edges.
                onNext={() => {
                  if (safeIndex < refinedProfiles.length - 1) {
                    // move focus locally by advancing controller index
                    c.setIndex?.(safeIndex + 1);
                    return;
                  }
                  // end of refined page: fall back to normal pagination behavior
                  c.next();
                }}
                onPrev={() => {
                  if (safeIndex > 0) {
                    c.setIndex?.(safeIndex - 1);
                    return;
                  }
                  c.prev();
                }}
                onReport={onReport ?? (() => {})}
                canPrev={c.page > 0 || safeIndex > 0}
                canNext={c.hasNextPage || safeIndex < refinedProfiles.length - 1}
              />
            ) : c.appliedIsDefault ? (
              <View style={styles.emptyCenter}>
                <Ionicons name="sparkles-outline" size={64} color={theme.colors.border} />
                <Text style={styles.emptyTitle}>Ready for a fresh start ✨</Text>
                <Text style={styles.emptySub}>
                  Set a few filters on the left, then tap Apply to start discovering profiles.
                </Text>
              </View>
            ) : (
              <View style={styles.emptyCenter}>
                <Ionicons name="search-outline" size={64} color={theme.colors.border} />
                <Text style={styles.emptyTitle}>No matches found</Text>
                <Text style={styles.emptySub}>Try widening your age range or clearing filters.</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, flexDirection: 'row', backgroundColor: theme.colors.bg },
    webContainer: { flexDirection: 'row' },

    sidebar: {
      width: 340,
      borderRightWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface2,
      display: Platform.OS === 'web' ? 'flex' : 'none',
    },

    content: { flex: 1, backgroundColor: theme.colors.bg },
    resultWrap: { flex: 1 },

    searchHeader: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderColor: theme.colors.border,
    },

    searchText: { fontSize: 11, fontWeight: '800', color: theme.colors.text },

    perfBadge: {
      marginTop: 6,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface2,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    perfText: { marginLeft: 6, fontSize: 11, fontWeight: '800' },

    paginationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 as any },
    pageBtn: { padding: 6, borderRadius: 8, backgroundColor: theme.colors.bg },
    pageIndicator: {
      backgroundColor: theme.colors.primary,
      width: 24,
      height: 24,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pageText: { color: theme.colors.surface2, fontSize: 11, fontWeight: '900' },

    emptyCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyTitle: { fontSize: 22, fontWeight: '900', color: theme.colors.text, marginTop: 16 },
    emptySub: {
      fontSize: 14,
      color: theme.colors.mutedText,
      marginTop: 8,
      textAlign: 'center',
      maxWidth: 360,
      lineHeight: 20,
      fontWeight: '600',
    },

    gateWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
      backgroundColor: theme.colors.bg,
    },
  });
}