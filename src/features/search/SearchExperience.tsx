// ./src/features/search/SearchExperience.tsx
import React, { useEffect, useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  Image,
  useWindowDimensions,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../../theme/ThemeProvider';
import FilterPanel from '../../../app/(tabs)/search/FilterPanel';
import ProfileFocusView from '../../../app/(tabs)/search/ProfileFocusView';

import { useUnifiedSearchController } from './useUnifiedSearchController';
import { DEFAULT_FILTERS, PAGE_SIZE, type SearchContext } from './types';
import type { ThinProfileCard } from '../../services/search.service';

import { supabase } from '../../lib/supabase';
import { favoriteService } from '../../services/favorite.service';
import { ProfileThinTile } from '../../components/ProfileThinTile';

type GateState = 'LOADING' | 'ACTIVE' | 'PENDING' | 'NEW' | 'REJECTED';

type Props = {
  mode: 'USER' | 'ADMIN';
  context: SearchContext;

  gateEnabled?: boolean;
  gateState?: GateState;

  autoSearchOnMount?: boolean;
  initialFilters?: typeof DEFAULT_FILTERS;
  onReport?: () => void;
};

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
  const { width: windowW } = useWindowDimensions();

  const enabled = gateEnabled ? gateState === 'ACTIVE' : true;

  const c = useUnifiedSearchController({
    context,
    enabled,
    initialFilters: initialFilters ?? DEFAULT_FILTERS,
    autoSearchOnMount,
  });

  const perfAccent = theme.colors.success ?? theme.colors.primary;

  // ✅ favorites map for current page
  const [favSet, setFavSet] = useState<Set<string>>(new Set());
  const [favBusy, setFavBusy] = useState<Record<string, boolean>>({});

  // Refresh favorite state when cards change (batched)
  useEffect(() => {
    let alive = true;

    async function hydrateFavsForPage() {
      try {
        const ids = (c.cards || []).map((x) => String(x.id)).filter(Boolean);
        if (!ids.length) {
          if (alive) setFavSet(new Set());
          return;
        }

        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (!user) {
          if (alive) setFavSet(new Set());
          return;
        }

        const { data, error } = await supabase
          .from('favorites')
          .select('favorite_id')
          .eq('user_id', user.id)
          .in('favorite_id', ids);

        if (error) throw error;

        const s = new Set<string>((data || []).map((r: any) => String(r.favorite_id)));
        if (alive) setFavSet(s);
      } catch (e) {
        // fail open: show none as favorited
        if (alive) setFavSet(new Set());
      }
    }

    void hydrateFavsForPage();
    return () => {
      alive = false;
    };
  }, [c.cards]);

  const toggleFavorite = useCallback(
    async (profileId: string) => {
      if (!profileId) return;

      setFavBusy((p) => ({ ...p, [profileId]: true }));
      try {
        const currentlyFav = favSet.has(profileId);

        if (currentlyFav) {
          await favoriteService.removeFavorite(profileId);
          setFavSet((prev) => {
            const n = new Set(prev);
            n.delete(profileId);
            return n;
          });
          return;
        }

        const res = await favoriteService.addFavoriteWithLimit(profileId);
        if (res.ok) {
          setFavSet((prev) => new Set(prev).add(profileId));
          return;
        }

        if (!res.ok && res.reason === 'LIMIT_REACHED') {
          Alert.alert('Favorites limit reached', `You can save up to ${res.limit} favorites.`);
          return;
        }

        Alert.alert('Could not save favorite', res.message || 'Please try again.');
      } finally {
        setFavBusy((p) => ({ ...p, [profileId]: false }));
      }
    },
    [favSet],
  );

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

  const showHeader = c.hasSearched || c.cards.length > 0;

  // ✅ gutters + centered premium cards (your “not touching edges” version)
  const gutter = isWeb ? 24 : 16;
  const contentPadding = gutter;

  const usableW = Math.max(320, windowW - (isWeb ? 340 : 0));
  const maxListW = isWeb ? 980 : 620;
  const listW = Math.min(maxListW, usableW - contentPadding * 2);

  const cardW = Math.max(300, Math.min(listW, isWeb ? listW - 40 : listW - 12));

  const keyExtractor = useCallback((item: ThinProfileCard) => String(item.id), []);

  const renderItem = useCallback(
    ({ item, index }: { item: ThinProfileCard; index: number }) => {
      const id = String(item.id);
      return (
        <ProfileThinTile
          item={item}
          onPress={() => c.openByIndex(index)}
          theme={theme}
          cardW={cardW}
          isFavorited={favSet.has(id)}
          favBusy={!!favBusy[id]}
          onToggleFavorite={() => toggleFavorite(id)}
        />
      );
    },
    [c, cardW, theme, favSet, favBusy, toggleFavorite],
  );

  // ✅ “Showing X–Y” (no total count; no extra DB query)
  const hasResults = c.cards.length > 0;
  const startIndex = hasResults ? c.page * PAGE_SIZE + 1 : 0;
  const endIndex = hasResults ? startIndex + c.cards.length - 1 : 0;
  const showingLabel = hasResults ? `Showing ${startIndex}–${endIndex}` : 'No results';

  return (
    <View style={[styles.container, isWeb && styles.webContainer]}>
      <View style={styles.sidebar}>
        <FilterPanel
          filters={c.filters}
          onFilterChange={c.onDraftChange}
          onApply={c.apply}
          totalResults={c.cards.length}
          page={c.page}
          hasNextPage={c.hasNextPage}
        />
      </View>

      <View style={styles.content}>
        {c.loading ? (
          <View style={{ paddingTop: 30 }}>
            <ActivityIndicator size="large" color={theme.colors.text} />
          </View>
        ) : (
          <View style={styles.resultWrap}>
            {showHeader ? (
              <View style={styles.searchHeader}>
                <View>
                  <Text style={styles.searchText}>{showingLabel}</Text>

                  <View style={styles.perfBadge}>
                    <Ionicons name="flash" size={12} color={perfAccent} />
                    <Text style={[styles.perfText, { color: perfAccent }]}>
                      FAST • {c.durationMs}ms
                    </Text>
                  </View>
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

            {c.cards.length > 0 ? (
              <FlatList
                data={c.cards}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                contentContainerStyle={{
                  paddingHorizontal: contentPadding,
                  paddingTop: 14,
                  paddingBottom: 40,
                  alignItems: 'stretch',
                }}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews
                initialNumToRender={10}
                windowSize={9}
                maxToRenderPerBatch={14}
                updateCellsBatchingPeriod={50}
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

      <Modal
        visible={c.selectedIndex !== null && !!c.selectedProfile}
        animationType="slide"
        onRequestClose={c.closeFocus}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
          <View style={styles.focusTopBar}>
            <TouchableOpacity onPress={c.closeFocus} style={styles.closeBtn} activeOpacity={0.85}>
              <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
              <Text style={styles.closeText}>Back to results</Text>
            </TouchableOpacity>
          </View>

          {c.selectedProfile ? (
            <ProfileFocusView
              profile={{ id: c.selectedProfile.id }}
              onPrev={() => {}}
              onNext={() => {}}
              onReport={onReport ?? (() => {})}
              showNav={false}
              canPrev={false}
              canNext={false}
            />
          ) : null}
        </View>
      </Modal>
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

    focusTopBar: {
      paddingTop: 12,
      paddingBottom: 10,
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    closeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8 as any,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    closeText: { fontWeight: '900', color: theme.colors.text, fontSize: 12 },
  });
}