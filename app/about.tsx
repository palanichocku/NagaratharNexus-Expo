// app/about.tsx
import React, { useMemo } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useAppTheme } from '@/src/theme/ThemeProvider';

export default function AboutScreen() {
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();

  const goBackToSettings = () => {
    router.push('/(tabs)/settings');
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'About',
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontWeight: '800' },
          headerLeft: () => (
            <TouchableOpacity
              onPress={goBackToSettings}
              style={styles.headerBackBtn}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Back to Settings"
            >
              <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>About Nagarathar Nexus</Text>

        <View style={styles.introCard}>
          <Text style={styles.lead}>
            Nagarathar Nexus is a modern matrimonial platform created to serve the
            Nagarathar community through a secure, thoughtful, and searchable member
            experience.
          </Text>
          <Text style={styles.body}>
            Our goal is to make matrimonial discovery more organised, trustworthy,
            and efficient while preserving the privacy, dignity, and values of the
            community.
          </Text>
        </View>

        <Text style={styles.sectionHeader}>Leadership</Text>

        <View style={styles.profileCard}>
          <Image
            source={require('@/assets/images/founder-admin.png')}
            style={styles.profileImage}
            resizeMode="cover"
          />

          <View style={styles.profileContent}>
            <Text style={styles.profileRole}>Founder Administrator</Text>
            <Text style={styles.profileName}>Palaniappan Chockalingam</Text>

            <Text style={styles.body}>
              Palaniappan Chockalingam is the Founder Administrator of Nagarathar
              Nexus, a modern matrimonial platform built exclusively for the
              Nagarathar community.
            </Text>

            <Text style={styles.body}>
              Inspired by the dedicated matrimonial service of Mrs. Valli Vellayan
              through WhatsApp, he recognised the need for a more scalable and
              enduring solution — one where profiles remain accessible, searchable,
              and valuable to members at any time.
            </Text>

            <Text style={styles.bodyLast}>
              Nagarathar Nexus was created to deliver exactly that: a trusted,
              community-focused platform that brings together thoughtful design,
              efficient search, and long-term value for Nagarathar families and
              future generations.
            </Text>
          </View>
        </View>

        <View style={styles.profileCard}>
          <Image
            source={require('@/assets/images/founder-moderator.png')}
            style={styles.profileImage}
            resizeMode="cover"
          />

          <View style={styles.profileContent}>
            <Text style={styles.profileRole}>Founder Moderator</Text>
            <Text style={styles.profileName}>Coming Soon</Text>

            <Text style={styles.bodyLast}>
              This section is reserved to recognise the leadership and community
              service of the Founder Moderator who helps support Nagarathar Nexus
              and its members. Profile details will be added here shortly.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={goBackToSettings}
          activeOpacity={0.9}
        >
          <Ionicons
            name="arrow-back-outline"
            size={18}
            color={theme.colors.primaryText}
          />
          <Text style={styles.primaryBtnText}>Back to Settings</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

function makeStyles(theme: any) {
  const r = theme.radius;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },

    content: {
      padding: 22,
      paddingBottom: 36,
    },

    headerBackBtn: {
      padding: 6,
      marginLeft: 2,
    },

    title: {
      fontSize: 28,
      fontWeight: '900',
      color: theme.colors.text,
      marginBottom: 14,
    },

    introCard: {
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: r?.card ?? 18,
      padding: 16,
      marginBottom: 18,
    },

    lead: {
      fontSize: 15,
      lineHeight: 24,
      color: theme.colors.text,
      fontWeight: '700',
      marginBottom: 10,
    },

    sectionHeader: {
      fontSize: 15,
      fontWeight: '900',
      color: theme.colors.text,
      marginBottom: 10,
      marginTop: 2,
    },

    profileCard: {
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: r?.card ?? 18,
      padding: 16,
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'flex-start',
    },

    profileImage: {
      width: 78,
      height: 98,
      borderRadius: 12,
      marginRight: 14,
      backgroundColor: theme.colors.border,
    },

    profileContent: {
      flex: 1,
    },

    profileRole: {
      fontSize: 13,
      fontWeight: '900',
      color: theme.colors.text,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },

    profileName: {
      fontSize: 17,
      lineHeight: 22,
      color: theme.colors.text,
      fontWeight: '800',
      marginBottom: 10,
    },

    body: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.colors.mutedText,
      fontWeight: '600',
      marginBottom: 10,
    },

    bodyLast: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.colors.mutedText,
      fontWeight: '600',
    },

    primaryBtn: {
      marginTop: 22,
      minHeight: 50,
      borderRadius: r?.button ?? 14,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
    },

    primaryBtnText: {
      color: theme.colors.primaryText,
      fontSize: 15,
      fontWeight: '900',
    },
  });
}