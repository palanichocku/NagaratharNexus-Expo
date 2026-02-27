// This is the root layout for the tab-based navigation. It defines the structure and appearance of the tabs across the app.
// It also handles authentication state changes to redirect users appropriately.
// The code is structured to provide a web-specific side rail navigation while maintaining the native bottom tab experience on mobile platforms.
// app/(tabs)/_layout.tsx

import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Tabs, usePathname, useRouter, type Href} from 'expo-router';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';


const IS_WEB = Platform.OS === 'web';
const RAIL_W = 84;

type NavItem = {
  label: string;
  href: Href;
  icon: string;
};

const NAV: NavItem[] = [
  { label: 'Search', href: '/search', icon: 'search-outline' },
  { label: 'Favorites', href: '/favorites', icon: 'heart-outline' },
  { label: 'Profile', href: '/profile', icon: 'person-circle-outline' },
  { label: 'News', href: '/news', icon: 'megaphone-outline' },
  { label: 'Settings', href: '/settings', icon: 'settings-outline' },
];

function WebSideRail() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useAppTheme();

  // ✅ Prefer your app theme surfaces (matches the rest of your UI)
  const bg = theme.colors.surface2 ?? theme.colors.bg;
  const border = theme.colors.border;
  const muted = theme.colors.mutedText;
  const tint = theme.colors.primary;
  const activeBg = theme.colors.surface ?? theme.colors.surface2;
  const activeItemBg = `${tint}14`; // slightly stronger than 18 on iconWrap

  return (
    <View style={[styles.rail, { backgroundColor: bg, borderRightColor: border }]}>
      {NAV.map((item) => {
        const active =
          pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'));

        return (
          <TouchableOpacity
            key={typeof item.href === 'string' ? item.href : item.href.pathname}
            onPress={() => router.push(item.href as any)}
            style={[styles.railItem, active && { backgroundColor: activeBg }]}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            title={item.label} // ← keep this, but remove @ts-expect-error
          >
            <View
              style={[
                styles.iconWrap,
                {
                  borderColor: active ? tint : border,
                  backgroundColor: active ? `${tint}18` : 'transparent',
                },
              ]}
            >
              <Ionicons size={22} name={item.icon as any} color={active ? tint : muted} />
            </View>

            {/* Active indicator bar */}
            {active ? <View style={[styles.activeBar, { backgroundColor: tint }]} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function WebTabShell({ children }: { children: React.ReactNode }) {
  const { theme } = useAppTheme();
  const bg = theme.colors.bg;

  return (
    <View style={[styles.shell, { backgroundColor: bg }]}>
      <WebSideRail />
      <View style={styles.shellContent}>{children}</View>
    </View>
  );
}

export default function TabLayout() {
  const { theme } = useAppTheme();

  const tint = theme.colors.primary;
  const muted = theme.colors.mutedText;

  if (IS_WEB) {
    return (
      <WebTabShell>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: 'none' },
          }}
        >
          <Tabs.Screen name="search" options={{ href: '/search' }} />
          <Tabs.Screen name="favorites" options={{ href: '/favorites' }} />
          <Tabs.Screen name="profile" options={{ href: '/profile' }} />
          <Tabs.Screen name="news" options={{ href: '/news' }} />
          <Tabs.Screen name="settings" options={{ href: '/settings' }} />
        </Tabs>
      </WebTabShell>
    );
  }

  // Native bottom tabs (unchanged)
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tint,
        tabBarInactiveTintColor: muted,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="search"
        options={{
          href: '/(tabs)/search',
          title: 'Search',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="magnifyingglass" color={color} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          href: '/(tabs)/favorites',
          title: 'Favorites',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="heart.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: '/(tabs)/profile',
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="person.crop.circle" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          href: '/(tabs)/news',
          title: 'News',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="megaphone.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: '/(tabs)/settings',
          title: 'Settings',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: 'row' },

  rail: {
    width: RAIL_W,
    borderRightWidth: 1,
    paddingTop: 18,
    alignItems: 'center',
  },

  railItem: {
    width: RAIL_W,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  activeBar: {
    position: 'absolute',
    right: 0,
    top: 14,
    bottom: 14,
    width: 5,
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 5,
  },

  shellContent: { flex: 1 },
});