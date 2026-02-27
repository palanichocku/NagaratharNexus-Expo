// app/(tabs)/news/AnnouncementsScreen.tsx
import React, { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { announcementService } from '../../../src/services/announcement.service';

type Announcement = {
  id: string;
  title?: string;
  body?: string;
  created_at?: string; // Supabase
  createdAt?: string;  // older Firestore-style fallback
};

function formatDate(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AnnouncementsScreen() {
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    const data = await announcementService.getAnnouncements();
    setAnnouncements(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const onRefresh = async () => {
    setRefreshing(true);
    const data = await announcementService.getAnnouncements();
    setAnnouncements(Array.isArray(data) ? data : []);
    setRefreshing(false);
  };

  const tint = theme.colors.tint ?? theme.colors.primary;

  const renderItem = ({ item }: { item: Announcement }) => {
    const created = item.created_at ?? item.createdAt;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: `${tint}18`, borderColor: theme.colors.border }]}>
            <Ionicons name="megaphone-outline" size={18} color={tint} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title || 'Announcement'}
            </Text>
            <Text style={styles.cardMeta}>{formatDate(created)}</Text>
          </View>
        </View>

        {!!item.body && <Text style={styles.cardBody}>{item.body}</Text>}

        <View style={styles.cardFooter}>
          <Text style={[styles.tag, { color: tint }]}>Official Broadcast</Text>
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={tint} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Community News</Text>
        <Text style={styles.subtitle}>Official updates from NagaratharNexus</Text>
      </View>

      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={58} color={theme.colors.border} />
            <Text style={styles.emptyTitle}>No updates yet</Text>
            <Text style={styles.emptySub}>Announcements from admins and moderators will appear here.</Text>
          </View>
        }
      />
    </View>
  );
}

function makeStyles(theme: any) {
  const r = theme.radius;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },

    header: {
      paddingHorizontal: 22,
      paddingTop: Platform.OS === 'web' ? 22 : 18,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.bg,
    },
    title: { fontSize: 28, fontWeight: '900', color: theme.colors.text },
    subtitle: { marginTop: 6, fontSize: 14, fontWeight: '600', color: theme.colors.mutedText },

    listContent: { padding: 22, paddingBottom: 30 },

    card: {
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: r?.card ?? 18,
      padding: 16,
      marginBottom: 14,

      shadowColor: '#000',
      shadowOpacity: Platform.OS === 'web' ? 0 : 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
    },

    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },

    iconCircle: {
      width: 38,
      height: 38,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },

    cardTitle: { fontSize: 16, fontWeight: '900', color: theme.colors.text },
    cardMeta: { marginTop: 2, fontSize: 12, fontWeight: '700', color: theme.colors.mutedText },

    cardBody: { marginTop: 4, fontSize: 14, fontWeight: '600', color: theme.colors.text, lineHeight: 20 },

    cardFooter: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
    tag: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },

    empty: { alignItems: 'center', paddingTop: 90, paddingHorizontal: 22 },
    emptyTitle: { marginTop: 14, fontSize: 18, fontWeight: '900', color: theme.colors.text },
    emptySub: {
      marginTop: 8,
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.mutedText,
      textAlign: 'center',
      maxWidth: 360,
      lineHeight: 18,
    },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  });
}