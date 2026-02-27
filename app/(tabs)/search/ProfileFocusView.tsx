// ./app/(tabs)/search/ProfileFocusView.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { favoriteService } from '../../../src/services/favorite.service';
import { ProfileDisplay } from '../../../src/components/ProfileDisplay';
import { useAppTheme } from '../../../src/theme/ThemeProvider';

interface ProfileFocusProps {
  profile: any;
  onNext: () => void;
  onPrev: () => void;
  onReport: () => void;

  // ✅ parent tells us if navigation is available
  canNext?: boolean;
  canPrev?: boolean;
  onFavoriteRemoved?: (profileId: string) => void; // optional callback to inform parent if a favorite was removed from this screen
}

function usePressScale(disabled: boolean) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = useCallback(() => {
    if (disabled) return;
    Animated.timing(scale, {
      toValue: 0.94,
      duration: 90,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [disabled, scale]);

  const pressOut = useCallback(() => {
    if (disabled) return;
    Animated.spring(scale, {
      toValue: 1,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [disabled, scale]);

  return { scale, pressIn, pressOut };
}

export default function ProfileFocusView({
  profile,
  onNext,
  onPrev,
  onReport,
  canNext = true,
  canPrev = true,
  onFavoriteRemoved // optional callback to inform parent if a favorite was removed from this screen
}: ProfileFocusProps) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [limitUI, setLimitUI] = useState({ visible: false, limit: 5 });
  const [toast, setToast] = useState<{ visible: boolean; text: string }>({ visible: false, text: '' }); 
  const [isAtLimit, setIsAtLimit] = useState(false);

  // Animation hooks
  const prevAnim = usePressScale(!canPrev);
  const nextAnim = usePressScale(!canNext);

  useEffect(() => {
    let isMounted = true;
    const checkFavoriteStatus = async () => {
      if (profile?.id) {
        try {
          const status = await favoriteService.isFavorite(profile.id);
          if (isMounted) setIsFavorited(status);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to check favorite status:', error);
        }
      }
    };
    void checkFavoriteStatus();
    return () => {
      isMounted = false;
    };
  }, [profile]);

  const showToast = (text: string) => {
    setToast({ visible: true, text });
    setTimeout(() => setToast({ visible: false, text: '' }), 2400);
  };

  const handleToggleFavorite = async () => {
    if (!profile?.id || loading) return;

    setLoading(true);
    try {
      if (isFavorited) {
        await favoriteService.removeFavorite(profile.id);
        setIsFavorited(false);
        setIsAtLimit(false);
        // optional: tell parent list (favorites screen) to remove it immediately
        if (typeof onFavoriteRemoved === 'function') {
          onFavoriteRemoved(profile.id);
        }
        showToast('Removed from favorites');
        return;
      }

      // ✅ If we already know the user is at the limit, don't even attempt the POST again.
      // Show the same modal immediately.
      if (isAtLimit) {
        setLimitUI((prev) => ({ visible: true, limit: prev.limit || 5 }));
        showToast(`You can only save up to ${limitUI.limit} favorites.`);
        return;
      }

      // ✅ DO NOT set isFavorited(true) until we confirm success
      const res = await favoriteService.addFavoriteWithLimit(profile.id);

      if (res.ok) {
        setIsFavorited(true);
        showToast('Saved to favorites');
        return;
      }

      if (!res.ok && res.reason === 'LIMIT_REACHED') {
        setIsAtLimit(true);
        setLimitUI({ visible: true, limit: res.limit });
        return;
      }

      setIsFavorited(false);
      setIsAtLimit(false);
      showToast('Could not save favorite. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrev = useCallback(() => {
    if (!canPrev) return;
    onPrev();
  }, [canPrev, onPrev]);

  const handleNext = useCallback(() => {
    if (!canNext) return;
    onNext();
  }, [canNext, onNext]);

  if (!profile) return null;

  const navActive = theme.colors.primary;
  const navDisabled = theme.colors.mutedText;

  const favBg = isFavorited ? (theme.colors.danger ?? theme.colors.primary) : theme.colors.surface2;
  const favIcon = isFavorited ? theme.colors.primaryText : theme.colors.mutedText;
  const favBorder = theme.colors.border;

  return (
    <View style={styles.wrapper}>
      {/* ⬅️ PREVIOUS */}
      <Animated.View style={[styles.navBtnWrap, { transform: [{ scale: prevAnim.scale }] }]}>
        <TouchableOpacity
          onPress={handlePrev}
          disabled={!canPrev}
          onPressIn={prevAnim.pressIn}
          onPressOut={prevAnim.pressOut}
          style={styles.navBtn}
          accessibilityRole="button"
          accessibilityLabel="Previous profile"
        >
          <Ionicons name="play-skip-back" size={42} color={canPrev ? navActive : navDisabled} />
        </TouchableOpacity>
      </Animated.View>

      <Modal visible={limitUI.visible} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 18 }}>
          <View style={{ width: 360, maxWidth: '100%', backgroundColor: '#fff', borderRadius: 22, padding: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Ionicons name="heart-dislike" size={22} color="#7B1E3A" />
              <Text style={{ marginLeft: 10, fontSize: 16, fontWeight: '900', color: '#11181C' }}>
                Favorites limit reached
              </Text>
            </View>

            <Text style={{ color: '#6B7280', fontSize: 13, fontWeight: '700', lineHeight: 18 }}>
              You can save up to {limitUI.limit} favorites. Remove one to save a new profile.
            </Text>

            <View style={{ flexDirection: 'row', gap: 10 as any, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => setLimitUI({ visible: false, limit: limitUI.limit })}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#E8D5C4', alignItems: 'center' }}
              >
                <Text style={{ fontWeight: '900', color: '#11181C' }}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      <View style={styles.card}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
          <ProfileDisplay profile={profile} />

          <TouchableOpacity style={styles.reportRow} onPress={onReport} activeOpacity={0.85}>
            <Ionicons name="flag-outline" size={16} color={theme.colors.danger} />
            <Text style={styles.reportText}>Report Profile for Review</Text>
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity
          style={[styles.floatingHeart, { backgroundColor: favBg, borderColor: favBorder }]}
          onPress={handleToggleFavorite}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={favIcon} size="small" />
          ) : (
            <Ionicons
              name={isFavorited ? 'heart' : 'heart-outline'}
              size={28}
              color={favIcon}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* ➡️ NEXT */}
      <Animated.View style={[styles.navBtnWrap, { transform: [{ scale: nextAnim.scale }] }]}>
        <TouchableOpacity
          onPress={handleNext}
          disabled={!canNext}
          onPressIn={nextAnim.pressIn}
          onPressOut={nextAnim.pressOut}
          style={styles.navBtn}
          accessibilityRole="button"
          accessibilityLabel="Next profile"
        >
          <Ionicons name="play-skip-forward" size={42} color={canNext ? navActive : navDisabled} />
        </TouchableOpacity>
      </Animated.View>

      {toast.visible ? (
        <View style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 18,
          backgroundColor: '#11181C',
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{toast.text}</Text>
        </View>
      ) : null}
          </View>
        );
}

function makeStyles(theme: any) {
  const r = theme.radius;
  const isWeb = Platform.OS === 'web';

  return StyleSheet.create({
    wrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.bg,
    },

    navBtnWrap: { padding: 10 },
    navBtn: { padding: 10 },

    card: {
      width: 480,
      height: '92%',
      backgroundColor: theme.colors.surface2,
      borderRadius: r?.card ?? 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      position: 'relative',

      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isWeb ? 0 : 0.1,
      shadowRadius: 20,
      elevation: 8,
    },

    scrollPad: { paddingBottom: 100 },

    floatingHeart: {
      position: 'absolute',
      bottom: 25,
      right: 25,
      width: 60,
      height: 60,
      borderRadius: 30,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 10,

      borderWidth: 1,
      shadowColor: '#000',
      shadowOpacity: isWeb ? 0 : 0.25,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },

    reportRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      opacity: 0.85,
    },

    reportText: {
      color: theme.colors.danger,
      fontSize: 12,
      fontWeight: '800',
      marginLeft: 6,
      textDecorationLine: 'underline',
    },
  });
}