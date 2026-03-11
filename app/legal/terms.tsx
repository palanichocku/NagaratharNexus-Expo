// app/legal/terms.tsx
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

export default function TermsScreen() {
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
          title: 'Terms & Conditions',
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
        <Text style={styles.title}>Terms & Conditions</Text>
        <Text style={styles.lead}>
          By using Nagarathar Nexus, you agree to these terms, community standards,
          and platform expectations.
        </Text>

        <Section title="Eligibility" styles={styles}>
          You must provide accurate and current information and use this platform only
          for genuine matrimonial purposes. You are responsible for maintaining the
          accuracy of your account and profile details.
        </Section>

        <Section title="Profile accuracy" styles={styles}>
          Members may not impersonate another person or misrepresent age, marital
          status, education, profession, family details, photographs, or any other
          material profile information.
        </Section>

        <Section title="Respectful conduct" styles={styles}>
          Members must behave respectfully at all times. Harassment, abusive language,
          spam, fraud, solicitation, intimidation, or misuse of another member’s
          personal information is not permitted.
        </Section>

        <Section title="Confidentiality of member profiles" styles={styles}>
          All member profiles, photographs, and personal information made available on
          this platform are intended solely for registered community members for
          personal matrimonial consideration. Unauthorized copying, downloading,
          screenshotting, reproducing, forwarding, publishing, or sharing of any
          member content outside the platform is strictly prohibited. If such misuse
          is identified or reasonably suspected, Nagarathar Nexus reserves the right
          to suspend or permanently terminate the offending account.
        </Section>

        <Section title="Privacy and visibility" styles={styles}>
          Certain profile details may be visible based on each member’s privacy
          settings. Members are responsible for the information they choose to publish
          and for the manner in which they engage with others on the platform.
        </Section>

        <Section title="Account moderation" styles={styles}>
          We reserve the right to review, restrict, suspend, or remove accounts or
          profiles that violate these terms, undermine community trust, or conflict
          with applicable law or platform standards.
        </Section>

        <Section title="No guarantee of match outcome" styles={styles}>
          Nagarathar Nexus facilitates profile discovery and member connection, but
          does not guarantee responses, introductions, compatibility, engagement, or
          matrimonial outcomes.
        </Section>

        <Section title="Changes to terms" styles={styles}>
          These terms may be updated from time to time. Continued use of the platform
          after such updates constitutes acceptance of the revised terms.
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