// ./app/(tabs)/search/ProfileFocusView.tsx
import React, { useEffect, useCallback, useRef, useMemo, useState } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProfileDisplay } from '../../../src/components/ProfileDisplay';
import { useAppTheme } from '../../../src/theme/ThemeProvider';
import { getProfileById } from '@/src/services/search.service';
import { supabase } from '@/src/lib/supabase';

interface ProfileFocusProps {
  profile: any;
  onNext: () => void;
  onPrev: () => void;
  onReport: () => void;
  canNext?: boolean;
  canPrev?: boolean;
  showNav?: boolean;
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
  showNav = true,
}: ProfileFocusProps) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const profileId = String(profile?.id ?? '');

  const [fullProfile, setFullProfile] = useState<any>(null);
  const [loadingFull, setLoadingFull] = useState(false);

  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [viewerRole, setViewerRole] = useState<string>('USER');

  const prevAnim = usePressScale(!canPrev);
  const nextAnim = usePressScale(!canNext);

  useEffect(() => {
    let alive = true;

    async function loadViewer() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!alive) return;

        const uid = user?.id ?? null;
        setViewerUserId(uid);

        if (!uid) {
          setViewerRole('USER');
          return;
        }

        const { data: p } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', uid)
          .maybeSingle();

        if (!alive) return;

        setViewerRole(String(p?.role || 'USER').toUpperCase());
      } catch (e) {
        console.warn('loadViewer failed', e);
        if (alive) {
          setViewerUserId(null);
          setViewerRole('USER');
        }
      }
    }

    void loadViewer();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function hydrate() {
      if (!profileId) return;

      setLoadingFull(true);
      setFullProfile(null);

      try {
        const p = await getProfileById(profileId);
        if (alive) setFullProfile(p);
      } catch (e) {
        console.warn('hydrate profile failed', e);
        if (alive) setFullProfile(null);
      } finally {
        if (alive) setLoadingFull(false);
      }
    }

    void hydrate();
    return () => {
      alive = false;
    };
  }, [profileId]);

  const rawProfile = fullProfile ?? profile;

  const isStaff = viewerRole === 'ADMIN' || viewerRole === 'MODERATOR';
  const isOwnProfile =
    !!viewerUserId &&
    !!rawProfile?.id &&
    String(viewerUserId) === String(rawProfile.id);

  const canViewPrivateContact = isOwnProfile || isStaff;

  const maskedProfile = useMemo(() => {
    if (!rawProfile) return rawProfile;

    const hidePhone = !!(rawProfile.hide_phone ?? rawProfile.hidePhone);
    const hideEmail = !!(rawProfile.hide_email ?? rawProfile.hideEmail);

    const next = { ...rawProfile };

    if (!canViewPrivateContact && hidePhone) {
      next.phone = '[Private]';
      next.phone_number = '[Private]';
      next.phoneNumber = '[Private]';
    }

    if (!canViewPrivateContact && hideEmail) {
      next.email = '[Private]';
      next.email_address = '[Private]';
      next.emailAddress = '[Private]';
    }

    return next;
  }, [rawProfile, canViewPrivateContact]);

  useEffect(() => {
    if (!rawProfile) return;

  }, [rawProfile, maskedProfile, viewerUserId, viewerRole, isOwnProfile, canViewPrivateContact]);

  const handlePrev = useCallback(() => {
    if (!canPrev) return;
    onPrev();
  }, [canPrev, onPrev]);

  const handleNext = useCallback(() => {
    if (!canNext) return;
    onNext();
  }, [canNext, onNext]);

  if (!profileId) return null;

  const navActive = theme.colors.primary;
  const navDisabled = theme.colors.mutedText;

  return (
    <View style={styles.wrapper}>
      {showNav ? (
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
      ) : (
        <View style={styles.navSpacer} />
      )}

      <View style={styles.card}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
          {loadingFull ? (
            <View style={{ paddingTop: 30, alignItems: 'center' }}>
              <ActivityIndicator />
              <Text style={{ marginTop: 10, fontWeight: '800', color: theme.colors.mutedText }}>
                Loading full profile…
              </Text>
            </View>
          ) : (
            <ProfileDisplay profile={maskedProfile} />
          )}

          <TouchableOpacity style={styles.reportRow} onPress={onReport} activeOpacity={0.85}>
            <Ionicons name="flag-outline" size={16} color={theme.colors.danger} />
            <Text style={styles.reportText}>Report Profile for Review</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {showNav ? (
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
      ) : (
        <View style={styles.navSpacer} />
      )}
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
    navSpacer: { width: 64 },

    card: {
      width: 520,
      maxWidth: '92%',
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

    scrollPad: { paddingBottom: 60 },

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