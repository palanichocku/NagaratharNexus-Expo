// app/(admin)/AuditLog.tsx
import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminService } from '../../src/services/admin.service';
import { useAppTheme } from '../../src/theme/ThemeProvider';

const BATCH_SIZE = 20;

type ActionTone = 'success' | 'danger' | 'warn' | 'info' | 'neutral';
type ToneStyle = { bg: string; text: string; border: string };

export default function AuditLogScreen() {
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    void fetchInitialLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInitialLogs = async () => {
    setLoading(true);
    try {
      const result = await adminService.getAuditLogs(BATCH_SIZE, 0);
      setLogs(result.logs || []);
      setFilteredLogs(result.logs || []);
      setPage(1);
      setHasMore((result.logs || []).length === BATCH_SIZE);
    } finally {
      setLoading(false);
    }
  };

  const handleNextPage = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextOffset = page * BATCH_SIZE;
    try {
      const result = await adminService.getAuditLogs(BATCH_SIZE, nextOffset);
      if (result.logs.length > 0) {
        const newLogs = [...logs, ...result.logs];
        setLogs(newLogs);
        setFilteredLogs(newLogs);
        setPage((p) => p + 1);
        setHasMore(result.logs.length === BATCH_SIZE);
      } else {
        setHasMore(false);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    const lowerText = text.toLowerCase();
    const filtered = logs.filter((l) =>
      l.action?.toLowerCase().includes(lowerText) ||
      l.user_name?.toLowerCase().includes(lowerText) ||
      l.details?.toLowerCase().includes(lowerText),
    );
    setFilteredLogs(filtered);
  };

  const toneForAction = (action: string): ActionTone => {
    const act = (action || '').toUpperCase();
    if (act.includes('APPROVE')) return 'success';
    if (act.includes('REVOKE') || act.includes('DELETE') || act.includes('WIPE')) return 'danger';
    if (act.includes('UPDATE') || act.includes('CONFIG')) return 'warn';
    if (act.includes('LOGIN')) return 'info';
    return 'neutral';
  };

  const getToneStyle = (tone: ActionTone): ToneStyle => {
    // theme-safe tints (no hardcoded palette)
    const pick = (() => {
      switch (tone) {
        case 'success':
          return theme.colors.success;
        case 'danger':
          return theme.colors.danger;
        case 'warn':
          // if your theme doesn’t have warn, primary still looks okay
          return theme.colors.warn ?? theme.colors.primary;
        case 'info':
          return theme.colors.info ?? theme.colors.primary;
        default:
          return theme.colors.mutedText;
      }
    })();

    return {
      bg: pick + '14',
      text: pick,
      border: pick + '33',
    };
  };

  const TableHeader = () => (
    <View style={styles.tableHeader}>
      <Text style={[styles.columnHeader, { flex: 1.5 }]}>Timestamp</Text>
      <Text style={[styles.columnHeader, { flex: 1.5 }]}>Administrator</Text>
      <Text style={[styles.columnHeader, { flex: 1.5 }]}>Action Type</Text>
      <Text style={[styles.columnHeader, { flex: 3 }]}>Details / Changes</Text>
    </View>
  );

  const renderRow = ({ item, index }: { item: any; index: number }) => {
    const tone = toneForAction(item.action);
    const pill = getToneStyle(tone);
    const zebra = index % 2 === 0;

    const dateStr = item.timestamp
      ? new Date(item.timestamp).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

    return (
      <View style={[styles.tableRow, zebra && styles.tableRowAlt]}>
        <Text style={[styles.cellText, { flex: 1.5, fontSize: 11 }]}>{dateStr}</Text>

        <View style={{ flex: 1.5 }}>
          <Text style={styles.adminText} numberOfLines={1}>
            {item.user_name || 'System'}
          </Text>
          <Text style={styles.subText} numberOfLines={1}>
            {item.user_email || '—'}
          </Text>
        </View>

        <View style={{ flex: 1.5 }}>
          <View style={[styles.statusPill, { backgroundColor: pill.bg, borderColor: pill.border }]}>
            <Text style={[styles.statusText, { color: pill.text }]} numberOfLines={1}>
              {item.action || '—'}
            </Text>
          </View>
        </View>

        <Text style={[styles.cellText, { flex: 3, fontSize: 12 }]} numberOfLines={2}>
          {item.details || '—'}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={theme.colors.text} />
        <Text style={styles.loadingText}>Loading audit trail...</Text>
      </View>
    );
  }

  const iconMuted = theme.colors.mutedText;
  const iconActive = theme.colors.text;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.screenTitle}>System Audit Trail</Text>
          <Text style={styles.screenSubtitle}>Tracking administrative actions & system events</Text>
        </View>

        <View style={styles.countChip}>
          <Text style={styles.countChipText}>{(logs?.length || 0).toLocaleString()} Loaded</Text>
        </View>
      </View>

      <View style={styles.navContainer}>
        <View style={styles.searchPill}>
          <Ionicons name="search" size={18} color={iconMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search current batch..."
            placeholderTextColor={theme.colors.mutedText}
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        <View style={styles.paginationRow}>
          <Text style={styles.pageLabel}>BATCH:</Text>

          <TouchableOpacity onPress={fetchInitialLogs} style={styles.pageBtn}>
            <Ionicons name="play-back" size={14} color={iconActive} />
            <Text style={styles.pageText}>First</Text>
          </TouchableOpacity>

          <View style={styles.pageBtnActive}>
            <Text style={styles.pageTextActive}>{page}</Text>
          </View>

          <TouchableOpacity
            onPress={handleNextPage}
            style={[styles.pageBtn, !hasMore && { opacity: 0.5 }]}
            disabled={!hasMore}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color={theme.colors.text} />
            ) : (
              <>
                <Ionicons name="chevron-forward" size={16} color={iconActive} />
                <Text style={styles.pageText}>Load More</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tableCard}>
        <ScrollView horizontal={Platform.OS !== 'web'} showsHorizontalScrollIndicator={false}>
          <View style={{ width: Platform.OS === 'web' ? '100%' : 1000 }}>
            <FlatList
              data={filteredLogs}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderRow}
              ListHeaderComponent={<TableHeader />}
              stickyHeaderIndices={[0]}
            />
          </View>
        </ScrollView>
      </View>

      <View style={styles.bottomNav}>
        <Text style={styles.statsText}>
          Reviewing latest <Text style={styles.statsStrong}>{(logs?.length || 0).toLocaleString()}</Text>{' '}
          entries
        </Text>
      </View>
    </View>
  );
}

function makeStyles(theme: any) {
  const s = theme.spacing;
  const r = theme.radius;

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg, padding: s.lg },

    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: theme.colors.bg,
    },
    loadingText: { color: theme.colors.mutedText, fontWeight: '700' },

    topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: s.sm, gap: s.md },
    screenTitle: { fontSize: 20, fontWeight: '900', color: theme.colors.text },
    screenSubtitle: { marginTop: 4, fontSize: 13, color: theme.colors.mutedText, fontWeight: '600' },

    countChip: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    countChipText: { fontSize: 12, fontWeight: '900', color: theme.colors.text },

    navContainer: { marginBottom: s.sm, gap: 10 },

    searchPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.colors.inputBg,
      borderRadius: r.input,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    searchInput: { flex: 1, fontSize: 14, color: theme.colors.text, fontWeight: '700' },

    paginationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.colors.surface2,
      borderRadius: r.card,
      padding: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexWrap: 'wrap',
    },
    pageLabel: { fontSize: 10, fontWeight: '900', color: theme.colors.mutedText, marginHorizontal: 8 },

    pageBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      height: 30,
      borderRadius: r.button,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: 'center',
    },
    pageBtnActive: {
      width: 32,
      height: 30,
      borderRadius: r.button,
      backgroundColor: theme.colors.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pageText: { fontSize: 11, fontWeight: '800', color: theme.colors.text },
    pageTextActive: { color: theme.colors.surface2, fontSize: 11, fontWeight: '900' },

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
      padding: 14,
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
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      alignItems: 'center',
    },
    tableRowAlt: { backgroundColor: theme.colors.surface },

    adminText: { fontSize: 13, fontWeight: '900', color: theme.colors.text },
    subText: { fontSize: 11, color: theme.colors.mutedText, fontWeight: '700' },
    cellText: { color: theme.colors.text, fontWeight: '700' },

    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      alignSelf: 'flex-start',
      maxWidth: 160,
    },
    statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },

    bottomNav: {
      marginTop: s.sm,
      padding: 12,
      backgroundColor: theme.colors.surface2,
      borderRadius: r.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    statsText: { fontSize: 12, color: theme.colors.mutedText, fontWeight: '700' },
    statsStrong: { fontWeight: '900', color: theme.colors.text },
  });
}