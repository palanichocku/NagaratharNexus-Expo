// ./app/(tabs)/profile.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { profileService } from '../../src/services/profile.service';
import { ProfileDisplay } from '../../src/components/ProfileDisplay';
import { useAppTheme } from '../../src/theme/ThemeProvider';

export default function MyProfileScreen() {
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setProfile(updatedData);
      Alert.alert('Success', 'Your updated biodata is now live.');
    } catch (e) {
      Alert.alert('Error', 'Profile update failed. Please try again.');
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