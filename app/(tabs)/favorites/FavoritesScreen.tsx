// ./app/(tabs)/favorites/Favorites.tsx
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import FilterPanel from '../search/FilterPanel';
import ProfileFocusView from '../search/ProfileFocusView';
import { favoriteService } from '../../../src/services/favorite.service';
import { supabase } from '../../../src/lib/supabase';
import ReportModal from '../search/ReportModal';

import { useAppTheme } from '../../../src/theme/ThemeProvider';

export default function FavoritesScreen() {
  const navigation = useNavigation();
  const { theme } = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [allFavorites, setAllFavorites] = useState<any[]>([]);
  const [displayProfiles, setDisplayProfiles] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isReportModalVisible, setReportModalVisible] = useState(false);

  const isWeb = Platform.OS === 'web';

  /**
   * 🔄 REFRESH DATA ON TAB FOCUS
   */
  useFocusEffect(
    useCallback(() => {
      void syncAndLoad();
    }, []),
  );

  const syncAndLoad = async () => {
    setLoading(true);
    try {
      // 1. Get current Auth User
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // 2. Verify Own Profile Status (Fair-Play Check)
      const { data: profile } = await supabase
        .from('profiles')
        .select('account_status')
        .eq('id', user.id)
        .single();

      const paused = profile?.account_status === 'INACTIVE';
      setIsPaused(paused);

      // 3. Only fetch favorites if the user is NOT paused
      if (!paused) {
        const data = await favoriteService.getFavorites();
        setAllFavorites(data);
        setDisplayProfiles(data);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to sync favorites:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleFavoriteRemoved = useCallback((profileId: string) => {
    // Remove from both sources of truth
    setAllFavorites((prev) => prev.filter((p) => p.id !== profileId));
    setDisplayProfiles((prev) => {
      const next = prev.filter((p) => p.id !== profileId);

      // Keep index valid after removal
      setCurrentIndex((idx) => {
        if (next.length === 0) return 0;
        return Math.min(idx, next.length - 1);
      });

      return next;
    });
  }, []);

  const handleApplyFilters = (filters: any) => {
    if (isPaused) return;

    const filtered = allFavorites.filter((p: any) => {
      const age = parseInt(p.age || '0', 10);
      if (age < (filters.minAge || 18) || age > (filters.maxAge || 60)) return false;

      if (filters.kovils?.length > 0 && !filters.kovils.includes(p.kovil)) return false;

      if (filters.query) {
        const q = filters.query.toLowerCase();
        return (
          p.full_name?.toLowerCase().includes(q) ||
          p.profession?.toLowerCase().includes(q)
        );
      }

      return true;
    });

    setDisplayProfiles(filtered);
    setCurrentIndex(0);
  };

  const currentProfile = displayProfiles[currentIndex];
  const canPrev = displayProfiles.length > 0 && currentIndex > 0;
  const canNext = displayProfiles.length > 0 && currentIndex < displayProfiles.length - 1;
  const iconMuted = theme.colors.mutedText;
  const warnColor = theme.colors.warn ?? theme.colors.primary;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.container, isWeb && styles.webContainer]}>
        {/* 🛠️ SIDEBAR FILTER */}
        <View style={styles.sidebar}>
          <FilterPanel
            filters={{}} // Initial empty filters
            onFilterChange={handleApplyFilters}
            totalResults={displayProfiles.length}
          />
        </View>

        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator size="large" color={theme.colors.text} />
          ) : isPaused ? (
            /* 🛡️ FAIR-PLAY RESTRICTION UI */
            <View style={styles.restrictedContainer}>
              <Ionicons name="lock-closed-outline" size={64} color={warnColor} />
              <Text style={styles.titleText}>Favorites Restricted</Text>
              <Text style={styles.subText}>
                Your profile is currently paused. To view your saved matches, you must resume your
                profile in Settings.
              </Text>
              <TouchableOpacity
                style={styles.resumeBtn}
                onPress={() => navigation.navigate('Settings' as never)}
                activeOpacity={0.85}
              >
                <Text style={styles.resumeBtnText}>Go to Settings</Text>
              </TouchableOpacity>
            </View>
          ) : displayProfiles.length > 0 ? (
            /* ⭐ FAVORITES VIEW */
            <View style={styles.focusContainer}>
              <View style={styles.topActionRow}>
                <View style={styles.countChip}>
                  <Text style={styles.perfText}>
                    {currentIndex + 1} OF {displayProfiles.length} FAVORITES
                  </Text>
                </View>
              </View>

              <ProfileFocusView
                profile={displayProfiles[currentIndex]}
                  onNext={() => {
                    if (!canNext) return;
                    setCurrentIndex((i) => i + 1);
                  }}
                  onPrev={() => {
                    if (!canPrev) return;
                    setCurrentIndex((i) => i - 1);
                  }}
                  onReport={() => setReportModalVisible(true)}
                  canPrev={canPrev}
                  canNext={canNext}
                  onFavoriteRemoved={handleFavoriteRemoved}
              />
            </View>
          ) : (
            /* 🏜️ EMPTY STATE */
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

      {/* 🚩 Report Modal */}
      {currentProfile && (
        <ReportModal
          visible={isReportModalVisible}
          targetUserId={currentProfile.id}
          onClose={() => setReportModalVisible(false)}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(theme: any) {
  const s = theme.spacing;
  const r = theme.radius;

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.colors.bg },

    container: { flex: 1, flexDirection: 'row', backgroundColor: theme.colors.bg },
    webContainer: { paddingLeft: 80 },

    sidebar: {
      width: 320,
      borderRightWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface2,
      display: Platform.OS === 'web' ? 'flex' : 'none',
    },

    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.bg,
      padding: s.md,
    },

    focusContainer: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },

    topActionRow: { position: 'absolute', top: 16, left: 16, zIndex: 10 },

    countChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    perfText: {
      fontSize: 10,
      color: theme.colors.text,
      fontWeight: '900',
      letterSpacing: 0.7,
    },

    restrictedContainer: { alignItems: 'center', padding: 40, maxWidth: 520 },

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

    emptyContainer: { alignItems: 'center', padding: 20, maxWidth: 520 },

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
  });
}