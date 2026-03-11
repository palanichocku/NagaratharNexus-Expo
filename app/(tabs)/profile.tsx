import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { profileService } from '../../src/services/profile.service';
import { ProfileDisplay } from '../../src/components/ProfileDisplay';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import { useDialog } from '@/src/ui/feedback/useDialog';
import { useToast } from '@/src/ui/feedback/useToast';

export default function MyProfileScreen() {
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const dialog = useDialog();
  const toast = useToast();

  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await profileService.getProfile();
      setProfile(data);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSectionSave = async (updatedData: any) => {
    try {
      await profileService.updateProfile(updatedData);
      await loadData();
      toast.show('Your updated biodata is now live.', 'success');
    } catch (e: any) {
      dialog.show({
        title: 'Profile update failed',
        message: e?.message || 'Please try again.',
        tone: 'error',
      });
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={theme.colors.text} />
      </View>
    );
  }

  return (
    <View style={[styles.container, Platform.OS === 'web' && styles.webPad]}>
      <ProfileDisplay profile={profile} onSaveSection={handleSectionSave} />
    </View>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },

    webPad: {
      paddingLeft: 80,
    },

    loadingWrap: {
      flex: 1,
      backgroundColor: theme.colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}