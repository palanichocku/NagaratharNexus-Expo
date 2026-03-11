// app/legal/privacy.tsx
import React, { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useAppTheme } from '@/src/theme/ThemeProvider';

function Section({
  title,
  children,
  styles,
}: {
  title: string;
  children: React.ReactNode;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

export default function PrivacyScreen() {
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
          title: 'Privacy Policy',
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
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.lead}>
          This policy explains how Nagarathar Nexus handles profile information,
          privacy preferences, and member data within the platform.
        </Text>

        <Section title="Information we collect" styles={styles}>
          We may collect profile details you provide, such as name, age, contact
          information, photographs, education, profession, family details, location,
          partner preferences, and other information submitted as part of your profile.
        </Section>

        <Section title="How your information is used" styles={styles}>
          Your information is used to create your profile, support search and match
          discovery, improve member experience, maintain platform integrity, and
          support moderation, safety, and account administration.
        </Section>

        <Section title="Member visibility" styles={styles}>
          Profile information is intended for registered members within the community.
          Certain details may be visible based on your privacy settings and how the
          platform presents profile data for matrimonial discovery.
        </Section>

        <Section title="Your privacy controls" styles={styles}>
          You may control certain visibility settings, including whether your phone
          number or email address is hidden. You may also mark your profile inactive,
          which hides it from search and match discovery until you reactivate it.
        </Section>

        <Section title="Profile confidentiality" styles={styles}>
          Member profiles, photographs, and personal information are provided for
          private matrimonial consideration within the community. Unauthorized copying,
          downloading, screenshotting, forwarding, or sharing of member content
          outside the platform is not permitted.
        </Section>

        <Section title="Data protection and moderation" styles={styles}>
          We take reasonable steps to protect platform data and maintain member trust.
          We may review or act on accounts, reports, or activity where misuse, policy
          violations, or risks to community safety are identified.
        </Section>

        <Section title="Policy updates" styles={styles}>
          This privacy policy may be updated periodically to reflect platform changes,
          legal requirements, or operational improvements. Continued use of the
          platform after updates means you accept the revised policy.
        </Section>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={goBackToSettings}
          activeOpacity={0.9}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.primaryText} />
          <Text style={styles.primaryBtnText}>I Understand</Text>
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
      marginBottom: 10,
    },

    lead: {
      fontSize: 15,
      lineHeight: 24,
      color: theme.colors.text,
      fontWeight: '600',
      marginBottom: 18,
    },

    card: {
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: r?.card ?? 18,
      padding: 16,
      marginTop: 12,
    },

    sectionTitle: {
      fontSize: 14,
      fontWeight: '900',
      color: theme.colors.text,
      marginBottom: 8,
    },

    body: {
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