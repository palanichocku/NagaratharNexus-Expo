// /app/(admin)/UserManagement.tsx
import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { useAppTheme } from '../../src/theme/ThemeProvider';

const PAGE_SIZE = 20;

type ThemeStatusStyle = { bg: string; text: string; border: string };

export default function UserManagementScreen() {
  const { theme } = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    void fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, currentPage]);

  /**
   * 🚀 CACHE-PROOF USER FETCH
   * Manual join to bypass schema link errors.
   */
  const fetchUsers = async () => {
    setLoading(true);
    try {
      // 1. Fetch Profiles first
      let profRequest = supabase.from('profiles').select('*', { count: 'exact' });
      if (query) profRequest = profRequest.or(`full_name.ilike.%${query}%,email.ilike.%${query}%`);

      const { data: profs, count, error: profError } = await profRequest
        .order('created_at', { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      if (profError) throw profError;

      // 2. Fetch Roles manually
      const userIds = profs?.map((p) => p.id) || [];
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      // 3. Merge
      const merged =
        profs?.map((p) => ({
          ...p,
          role: roles?.find((r) => r.user_id === p.id)?.role || 'USER',
        })) || [];

      setUsers(merged);
      setTotalCount(count || 0);
    } catch (err: any) {
      // keep behavior same, just log
      // eslint-disable-next-line no-console
      console.error('Manual Directory Sync Error:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (approved: boolean): ThemeStatusStyle => {
    // Use theme-safe tints (no hardcoded green/red)
    // Keep it simple: use surface/input + semantic text colors
    if (approved) {
      return {
        bg: theme.colors.success + '14', // light tint
        text: theme.colors.success,
        border: theme.colors.success + '33',
      };
    }
    return {
      bg: theme.colors.danger + '12',
      text: theme.colors.danger,
      border: theme.colors.danger + '33',
    };
  };

  const renderRow = ({ item, index }: any) => {
    const approved = Boolean(item.is_approved);
    const status = getStatusStyle(approved);

    return (
      <View style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}>
        <View style={{ flex: 2 }}>
          <Text style={styles.nameText}>{item.full_name || '—'}</Text>
          <Text style={styles.subText}>ID: {String(item.id).substring(0, 8)}...</Text>
        </View>

        <Text style={[styles.cellText, { flex: 1.5 }]}>{item.phone || '—'}</Text>
        <Text style={[styles.cellText, { flex: 2 }]}>{item.email || 'N/A'}</Text>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={[styles.statusPill, { backgroundColor: status.bg, borderColor: status.border }]}>
            <Text style={[styles.statusText, { color: status.text }]}>
              {approved ? 'ACTIVE' : 'PENDING'}
            </Text>
          </View>
        </View>

        <Text style={[styles.roleText, { flex: 1 }]}>
          {String(item.role || 'USER').toUpperCase()}
        </Text>
      </View>
    );
  };

  const canNext = (currentPage + 1) * PAGE_SIZE < totalCount;
  const iconMuted = theme.colors.mutedText;
  const iconActive = theme.colors.text;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.screenTitle}>User Directory</Text>
          <Text style={styles.screenSubtitle}>Search and manage roles</Text>
        </View>

        <View style={styles.countChip}>
          <Text style={styles.countChipText}>{totalCount.toLocaleString()} Members</Text>
        </View>
      </View>

      <View style={styles.navContainer}>
        <View style={styles.searchPill}>
          <Ionicons name="search" size={18} color={theme.colors.mutedText} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search names, email..."
            placeholderTextColor={theme.colors.mutedText}
            value={query}
            onChangeText={(t) => {
              setCurrentPage(0); // nicer UX: reset paging on new search
              setQuery(t);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <View style={styles.tableCard}>
        {loading && users.length === 0 ? (
          <ActivityIndicator size="large" color={theme.colors.text} style={{ margin: 40 }} />
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            renderItem={renderRow}
            ListHeaderComponent={
              <View style={styles.tableHeader}>
                <Text style={[styles.columnHeader, { flex: 2 }]}>Name</Text>
                <Text style={[styles.columnHeader, { flex: 1.5 }]}>Phone</Text>
                <Text style={[styles.columnHeader, { flex: 2 }]}>Email</Text>
                <Text style={[styles.columnHeader, { flex: 1, textAlign: 'center' }]}>Status</Text>
                <Text style={[styles.columnHeader, { flex: 1, textAlign: 'right' }]}>Role</Text>
              </View>
            }
            stickyHeaderIndices={[0]}
          />
        )}
      </View>

      <View style={styles.bottomNav}>
        <TouchableOpacity disabled={currentPage === 0} onPress={() => setCurrentPage((p) => p - 1)}>
          <Ionicons
            name="chevron-back"
            size={24}
            color={currentPage === 0 ? iconMuted : iconActive}
          />
        </TouchableOpacity>

        <Text style={styles.statsText}>Page {currentPage + 1}</Text>

        <TouchableOpacity disabled={!canNext} onPress={() => setCurrentPage((p) => p + 1)}>
          <Ionicons
            name="chevron-forward"
            size={24}
            color={!canNext ? iconMuted : iconActive}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(theme: any) {
  const s = theme.spacing;
  const r = theme.radius;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
      padding: s.lg,
    },

    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: s.sm,
      gap: s.md,
    },

    screenTitle: {
      fontSize: 20,
      fontWeight: '900',
      color: theme.colors.text,
    },

    screenSubtitle: {
      marginTop: 4,
      fontSize: 13,
      color: theme.colors.mutedText,
      fontWeight: '600',
    },

    countChip: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    countChipText: {
      fontSize: 13,
      fontWeight: '900',
      color: theme.colors.text,
    },

    navContainer: {
      marginBottom: s.sm,
      gap: s.sm,
    },

    searchPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
      backgroundColor: theme.colors.inputBg,
      borderRadius: r.input,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    searchInput: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.text,
    },

    tableCard: {
      flex: 1,
      backgroundColor: theme.colors.surface2,
      borderRadius: r.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },

    tableHeader: {
      flexDirection: 'row',
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },

    columnHeader: {
      fontSize: 11,
      fontWeight: '900',
      color: theme.colors.mutedText,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },

    tableRow: {
      flexDirection: 'row',
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      alignItems: 'center',
    },

    tableRowAlt: {
      backgroundColor: theme.colors.surface,
    },

    nameText: {
      fontSize: 13.5,
      fontWeight: '900',
      color: theme.colors.text,
    },

    subText: {
      marginTop: 3,
      fontSize: 11,
      color: theme.colors.mutedText,
      fontWeight: '700',
    },

    cellText: {
      fontSize: 13,
      color: theme.colors.text,
      fontWeight: '700',
    },

    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      minWidth: 92,
      alignItems: 'center',
      borderWidth: 1,
    },

    statusText: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.6,
    },

    roleText: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.colors.primary,
      textAlign: 'right',
    },

    bottomNav: {
      marginTop: s.sm,
      padding: 12,
      backgroundColor: theme.colors.surface2,
      borderRadius: r.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 20,
    },

    statsText: {
      fontSize: 12,
      color: theme.colors.mutedText,
      fontWeight: '700',
    },
  });
}