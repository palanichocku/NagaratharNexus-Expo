// ./app/(tabs)/favorites/Favorites.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Image,
  useWindowDimensions,
  Modal,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import ProfileFocusView from '../search/ProfileFocusView';
import ReportModal from '../search/ReportModal';

import { supabase } from '../../../src/lib/supabase';
import { favoriteService } from '../../../src/services/favorite.service';
import type { ThinProfileCard } from '../../../src/services/search.service';
import { useAppTheme } from '../../../src/theme/ThemeProvider';
import { useFavoritesController } from '../../../src/features/favorites/useFavoritesController';
import { ProfileThinTile } from '../../../src/components/ProfileThinTile';

export default function FavoritesScreen() {
  const navigation = useNavigation();
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const isWeb = Platform.OS === 'web';
  const { width: windowW } = useWindowDimensions();

  const fav = useFavoritesController();

  // ✅ IMPORTANT: depend on functions, not the whole object (prevents flicker)
  const refreshFavorites = fav.refresh;
  const gotoPage = fav.gotoPage;
  const closeFocus = fav.closeFocus;
  const openByIndex = fav.openByIndex;
  const removeFromLocal = fav.removeFromLocal;

  const [isPaused, setIsPaused] = useState(false);
  const [checkingPause, setCheckingPause] = useState(true);
  const [isReportModalVisible, setReportModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      const run = async () => {
        setCheckingPause(true);
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            if (alive) setIsPaused(false);
            return;
          }

          const { data: profile, error } = await supabase
            .from('profiles')
            .select('account_status')
            .eq('id', user.id)
            .single();

          if (error) throw error;

          const paused = profile?.account_status === 'INACTIVE';
          if (!alive) return;

          setIsPaused(paused);

          if (!paused) {
            // ✅ only refresh once per focus
            refreshFavorites();
          }
        } catch (e) {
          console.error('Failed to sync favorites:', e);
        } finally {
          if (alive) setCheckingPause(false);
        }
      };

      void run();
      return () => { alive = false; };
    }, [refreshFavorites]),
  );

  // Match SearchExperience spacing rules
const gutter = isWeb ? 24 : 16;
const contentPadding = gutter;

const usableW = Math.max(320, windowW - (isWeb ? 340 : 0));
const maxListW = isWeb ? 980 : 620; // give favorites same premium width feel
const listW = Math.min(maxListW, usableW - contentPadding * 2);

// ✅ THIS is the important part: make the card narrower than listW
const cardW = Math.max(300, Math.min(listW, isWeb ? listW - 40 : listW - 12));

  const keyExtractor = useCallback((item: ThinProfileCard) => String(item.id), []);

  const handleUnfavorite = useCallback(
    async (profileId: string) => {
      if (!profileId) return;

      // optimistic UI
      removeFromLocal(profileId);

      try {
        await favoriteService.removeFavorite(profileId);
      } catch (e) {
        Alert.alert('Could not remove favorite', 'Please try again.');
        // optional: refresh to re-sync
        refreshFavorites();
      }
    },
    [removeFromLocal, refreshFavorites],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ThinProfileCard; index: number }) => (
      <ProfileThinTile
        item={item}
        theme={theme}
        cardW={cardW}
        onPress={() => openByIndex(index)}
        isFavorited
        favBusy={false}
        onToggleFavorite={() => void handleUnfavorite(String(item.id))}
        />
    ),
    [handleUnfavorite, listW, openByIndex, theme],
  );

  const warnColor = theme.colors.warn ?? theme.colors.primary;
  const perfAccent = theme.colors.success ?? theme.colors.primary;

  const showModal = fav.selectedIndex !== null && !!fav.selectedProfile;

  const showLoading = checkingPause || fav.loading;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.container, isWeb && styles.webContainer]}>
        <View style={styles.sidebar}>
          <View style={{ padding: 18 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: theme.colors.text }}>Favorites</Text>
            <Text style={{ marginTop: 6, fontSize: 12, fontWeight: '700', color: theme.colors.mutedText }}>
              Saved profiles, fast tiles + tap to open.
            </Text>

            <TouchableOpacity
              onPress={refreshFavorites}
              style={{
                marginTop: 14,
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8 as any,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh" size={16} color={theme.colors.primary} />
              <Text style={{ fontWeight: '900', color: theme.colors.primary, fontSize: 12 }}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          {showLoading ? (
            <ActivityIndicator size="large" color={theme.colors.text} />
          ) : isPaused ? (
            <View style={styles.restrictedContainer}>
              <Ionicons name="lock-closed-outline" size={64} color={warnColor} />
              <Text style={styles.titleText}>Favorites Restricted</Text>
              <Text style={styles.subText}>
                Your profile is currently paused. To view your saved matches, resume your profile in Settings.
              </Text>
              <TouchableOpacity
                style={styles.resumeBtn}
                onPress={() => navigation.navigate('Settings' as never)}
                activeOpacity={0.85}
              >
                <Text style={styles.resumeBtnText}>Go to Settings</Text>
              </TouchableOpacity>
            </View>
          ) : fav.cards.length > 0 ? (
            <View style={{ flex: 1, width: '100%' }}>
              <View style={styles.searchHeader}>
                <View>
                  <Text style={styles.searchText}>
                    {fav.cards.length} FAVORITES • PAGE {fav.page + 1}
                  </Text>

                  <View style={styles.perfBadge}>
                    <Ionicons name="flash" size={12} color={perfAccent} />
                    <Text style={[styles.perfText, { color: perfAccent }]}>
                      FAST • {Math.round(Number(fav.durationMs) || 0)}ms
                    </Text>
                  </View>
                </View>

                <View style={styles.paginationRow}>
                  <TouchableOpacity
                    disabled={!fav.canPrevPage}
                    onPress={() => gotoPage(fav.page - 1)}
                    style={[styles.pageBtn, !fav.canPrevPage && { opacity: 0.3 }]}
                  >
                    <Ionicons name="chevron-back" size={18} color={theme.colors.primary} />
                  </TouchableOpacity>

                  <View style={styles.pageIndicator}>
                    <Text style={styles.pageText}>{fav.page + 1}</Text>
                  </View>

                  <TouchableOpacity
                    disabled={!fav.canNextPage}
                    onPress={() => gotoPage(fav.page + 1)}
                    style={[styles.pageBtn, !fav.canNextPage && { opacity: 0.3 }]}
                  >
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              <FlatList
                data={fav.cards}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                contentContainerStyle={{
                  paddingHorizontal: contentPadding,
                  paddingTop: 14,
                  paddingBottom: 40,
                  alignItems: 'stretch', // ✅ let cardW + alignSelf center do the job
                }}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews
                initialNumToRender={10}
                windowSize={9}
                maxToRenderPerBatch={14}
                updateCellsBatchingPeriod={50}
              />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="star-outline" size={60} color={theme.colors.border} />
              <Text style={styles.emptyTitle}>No Favorites Found</Text>
              <Text style={styles.emptySub}>
                Start exploring the directory to save profiles you like.
              </Text>
            </View>
          )}
        </View>
      </View>

      <Modal visible={showModal} animationType="slide" onRequestClose={closeFocus}>
        <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
          <View style={styles.focusTopBar}>
            <TouchableOpacity onPress={closeFocus} style={styles.closeBtn} activeOpacity={0.85}>
              <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
              <Text style={styles.closeText}>Back to favorites</Text>
            </TouchableOpacity>
          </View>

          {fav.selectedProfile ? (
            <ProfileFocusView
              profile={{ id: fav.selectedProfile.id }}
              onPrev={() => {}}
              onNext={() => {}}
              onReport={() => setReportModalVisible(true)}
              showNav={false}
              canPrev={false}
              canNext={false}
            />
          ) : null}
        </View>
      </Modal>

      {fav.selectedProfile ? (
        <ReportModal
          visible={isReportModalVisible}
          targetUserId={String(fav.selectedProfile.id)}
          onClose={() => setReportModalVisible(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function makeStyles(theme: any) {
  const r = theme.radius;
  const s = theme.spacing;

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.colors.bg },

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

    restrictedContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      maxWidth: 520,
      alignSelf: 'center',
    },
    titleText: { fontSize: 24, fontWeight: '900', marginTop: 20, color: theme.colors.text },
    subText: {
      fontSize: 15,
      color: theme.colors.mutedText,
      textAlign: 'center',
      marginTop: 12,
      lineHeight: 22,
      fontWeight: '600',
    },
    resumeBtn: {
      marginTop: 25,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 30,
      paddingVertical: 14,
      borderRadius: r.button,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    resumeBtnText: { color: theme.colors.primaryText, fontWeight: '900', fontSize: 15 },

    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      maxWidth: 520,
      alignSelf: 'center',
    },
    emptyTitle: { fontSize: 18, fontWeight: '900', color: theme.colors.text, marginTop: 15 },
    emptySub: {
      fontSize: 14,
      color: theme.colors.mutedText,
      textAlign: 'center',
      marginTop: 8,
      maxWidth: 280,
      fontWeight: '600',
      lineHeight: 20,
    },

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

    pad: { padding: s?.md ?? 16 },
  });
}