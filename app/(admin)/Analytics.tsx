// ./app/(admin)/Analytics.tsx
import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';

import { adminService } from '../../src/services/admin.service';
import { useAppTheme } from '../../src/theme/ThemeProvider';

const fullScreenWidth =
  Dimensions.get('window').width - (Platform.OS === 'web' ? 120 : 40);

type AnalyticsData = {
  totalUsers?: number;
  staffCount?: number;
  draftProfiles?: number;
  pendingApprovals?: number;
  approvedActiveProfiles?: number;
  accountInactiveProfiles?: number;
  inactiveMembers?: number;
  inactiveUsers?: any[];
  inactiveThresholdDays?: number;
  activeLast7Days?: number;
  activeLast30Days?: number;
  neverLoggedIn?: number;
  newThisMonth?: number;
  profilesWithPhoto?: number;
  profilesWithProfession?: number;
  profilesWithExpectations?: number;
  profilesWithEducation?: number;
  profilePhotoCompletionRate?: number;
  professionCompletionRate?: number;
  expectationsCompletionRate?: number;
  educationCompletionRate?: number;
  openReports?: number;
  countries?: Record<string, number>;
  ageGroups?: Record<string, number>;
  education?: Record<string, number>;
  gender?: Record<string, number>;
  maritalStatus?: Record<string, number>;
  roles?: Record<string, number>;
  kovils?: Record<string, number>;
  nativePlaces?: Record<string, number>;
};

type PieDatum = {
  name: string;
  population: number;
  color: string;
  legendFontColor: string;
  legendFontSize: number;
};

type MetricItem = {
  label: string;
  value: number;
  helper?: string;
};

export default function AnalyticsScreen() {
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    void loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAnalytics = async () => {
    try {
      const [distData, summaryData] = await Promise.all([
        adminService.getDistributionData(),
        adminService.getAnalytics(),
      ]);

      setData({
        ...(distData || {}),
        ...(summaryData || {}),
      });
    } finally {
      setLoading(false);
    }
  };

  const getChartWidth = (itemCount: number) => {
    if (itemCount <= 10) return Math.max(350, itemCount * 75);
    return Math.max(fullScreenWidth, itemCount * 52);
  };

  const chartConfig = useMemo(
    () =>
      ({
        backgroundColor: theme.colors.surface2,
        backgroundGradientFrom: theme.colors.surface2,
        backgroundGradientTo: theme.colors.surface2,
        decimalPlaces: 0,
        color: (opacity = 1) => rgba(theme.colors.text, opacity),
        labelColor: (opacity = 1) => rgba(theme.colors.mutedText, opacity),
        barPercentage: 0.78,
        propsForLabels: { fontSize: 9, fontWeight: '700' as any },
        fillShadowGradient: theme.colors.primary,
        fillShadowGradientOpacity: 1,
      }) as any,
    [
      theme.colors.mutedText,
      theme.colors.primary,
      theme.colors.surface2,
      theme.colors.text,
    ]
  );

  const formatPieData = (obj: Record<string, number> | undefined | null): PieDatum[] => {
    const palette = buildChartPalette(
      theme.colors.primary,
      theme.colors.success,
      theme.colors.danger,
      theme.colors.text
    );

    const entries = Object.entries(obj || {}).filter(([, value]) => Number(value || 0) > 0);

    return entries.map(([key, value], idx) => ({
      name: key,
      population: Number(value || 0),
      color: palette[idx % palette.length],
      legendFontColor: theme.colors.mutedText,
      legendFontSize: 12,
    }));
  };

  const getTopData = (obj: Record<string, number> | undefined | null, limit = 15) => {
    const sorted = Object.entries(obj || {})
      .sort(([, a], [, b]) => Number(b || 0) - Number(a || 0))
      .slice(0, limit);

    return {
      labels: sorted.map(([label]) => label),
      datasets: [{ data: sorted.map(([, val]) => Number(val || 0)) }],
    };
  };

  const summaryCards = useMemo(() => {
    if (!data) return [];

    return [
      {
        label: 'Total Members',
        value: Number(data.totalUsers || 0),
        helper: 'All non-staff profiles in system',
        icon: 'people-outline' as const,
      },
      {
        label: 'Staff',
        value: Number(data.staffCount || 0),
        helper: 'Admins and moderators',
        icon: 'shield-checkmark-outline' as const,
      },
      {
        label: 'Approved Active',
        value: Number(data.approvedActiveProfiles || 0),
        helper: 'Members available in search pool',
        icon: 'checkmark-circle-outline' as const,
      },
      {
        label: 'New This Month',
        value: Number(data.newThisMonth || 0),
        helper: 'Profiles created this month',
        icon: 'sparkles-outline' as const,
      },
      {
        label: 'Open Reports',
        value: Number(data.openReports || 0),
        helper: 'Safety items needing review',
        icon: 'shield-outline' as const,
      },
      {
        label: 'Inactive Members',
        value: Number(data.inactiveMembers || 0),
        helper: `${Number(data.inactiveThresholdDays || 30)}+ days since login`,
        icon: 'pause-circle-outline' as const,
      },
    ];
  }, [data]);

  const lifecycleCards = useMemo<MetricItem[]>(() => {
    if (!data) return [];
    return [
      { label: 'Total Members', value: Number(data.totalUsers || 0) },
      { label: 'Draft', value: Number(data.draftProfiles || 0) },
      { label: 'Pending Approval', value: Number(data.pendingApprovals || 0) },
      { label: 'Approved Active', value: Number(data.approvedActiveProfiles || 0) },
      { label: 'Inactive Status', value: Number(data.accountInactiveProfiles || 0) },
    ];
  }, [data]);

  const engagementCards = useMemo<MetricItem[]>(() => {
    if (!data) return [];
    return [
      { label: 'Active Last 7 Days', value: Number(data.activeLast7Days || 0) },
      { label: 'Active Last 30 Days', value: Number(data.activeLast30Days || 0) },
      { label: 'Never Logged In', value: Number(data.neverLoggedIn || 0) },
      {
        label: `${Number(data.inactiveThresholdDays || 30)}+ Days Inactive`,
        value: Number(data.inactiveMembers || 0),
      },
    ];
  }, [data]);

  const qualityCards = useMemo<MetricItem[]>(() => {
    if (!data) return [];
    return [
      {
        label: 'With Photo',
        value: Number(data.profilesWithPhoto || 0),
        helper: `${Number(data.profilePhotoCompletionRate || 0)}%`,
      },
      {
        label: 'With Education',
        value: Number(data.profilesWithEducation || 0),
        helper: `${Number(data.educationCompletionRate || 0)}%`,
      },
      {
        label: 'With Profession',
        value: Number(data.profilesWithProfession || 0),
        helper: `${Number(data.professionCompletionRate || 0)}%`,
      },
      {
        label: 'With Expectations',
        value: Number(data.profilesWithExpectations || 0),
        helper: `${Number(data.expectationsCompletionRate || 0)}%`,
      },
    ];
  }, [data]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={theme.colors.text} />
        <Text style={styles.loadingText}>Syncing analytics...</Text>
      </View>
    );
  }

  const AnalyticsCard = ({
    title,
    subtitle,
    icon,
    children,
  }: {
    title: string;
    subtitle?: string;
    icon: keyof typeof Ionicons.glyphMap;
    children: React.ReactNode;
  }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name={icon} size={18} color={theme.colors.text} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {children}
    </View>
  );

  const ChartFrame = ({ children }: { children: React.ReactNode }) => (
    <View style={styles.chartFrame}>{children}</View>
  );

  const MetricGrid = ({ items }: { items: MetricItem[] }) => (
    <View style={styles.metricGrid}>
      {items.map((item, idx) => (
        <View key={`${item.label}-${idx}`} style={styles.metricTile}>
          <Text style={styles.metricValue}>
            {Number(item.value || 0).toLocaleString()}
          </Text>
          <Text style={styles.metricLabel}>{item.label}</Text>
          {!!item.helper && <Text style={styles.metricHelper}>{item.helper}</Text>}
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.page}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>System Analytics</Text>
            <Text style={styles.subtitle}>
              Member lifecycle, quality, engagement, and moderation signals without duplicate buckets
            </Text>
          </View>

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => {
              setLoading(true);
              void loadAnalytics();
            }}
          >
            <Ionicons name="refresh" size={16} color={theme.colors.text} />
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBanner}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={theme.colors.mutedText}
          />
          <Text style={styles.infoBannerText}>
            Member analytics count non-staff profiles only. System roles stay separate so operational numbers reflect the real member pool.
          </Text>
        </View>

        <Text style={styles.rowTitle}>At a Glance</Text>
        <View style={styles.kpiRow}>
          {summaryCards.map((k, idx) => (
            <View key={idx} style={styles.kpiChip}>
              <Ionicons name={k.icon} size={16} color={theme.colors.text} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.kpiValue}>{Number(k.value || 0).toLocaleString()}</Text>
                <Text style={styles.kpiLabel}>{k.label}</Text>
                <Text style={styles.kpiHelper}>{k.helper}</Text>
              </View>
            </View>
          ))}
        </View>

        <AnalyticsCard
          title="Member Lifecycle"
          subtitle="One clean funnel from draft to approved pool"
          icon="git-network-outline"
        >
          <MetricGrid items={lifecycleCards} />
        </AnalyticsCard>

        <AnalyticsCard
          title="Engagement"
          subtitle="Recent activity and dormant-member signals"
          icon="pulse-outline"
        >
          <MetricGrid items={engagementCards} />
        </AnalyticsCard>

        <AnalyticsCard
          title="Profile Quality"
          subtitle="How complete the approved active pool looks"
          icon="ribbon-outline"
        >
          <MetricGrid items={qualityCards} />
        </AnalyticsCard>

      <AnalyticsCard
        title="Population Mix"
        subtitle="Approved active member profiles only"
        icon="pie-chart-outline"
      >
        <View style={styles.twoColGrid}>
          <View style={styles.mixCard}>
            <Text style={styles.subSectionTitle}>Gender Distribution</Text>
            <ChartFrame>
              {formatPieData(data?.gender).length ? (
                <PieChart
                  data={formatPieData(data?.gender) as any}
                  width={Platform.OS === 'web' ? 420 : fullScreenWidth - 24}
                  height={220}
                  chartConfig={chartConfig}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="12"
                  absolute
                />
              ) : (
                <Text style={styles.emptyText}>No gender data available.</Text>
              )}
            </ChartFrame>
          </View>

          <View style={styles.mixCard}>
            <Text style={styles.subSectionTitle}>Marital Status</Text>
            <ChartFrame>
              {formatPieData(data?.maritalStatus).length ? (
                <PieChart
                  data={formatPieData(data?.maritalStatus) as any}
                  width={Platform.OS === 'web' ? 420 : fullScreenWidth - 24}
                  height={220}
                  chartConfig={chartConfig}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="12"
                  absolute
                />
              ) : (
                <Text style={styles.emptyText}>No marital status data available.</Text>
              )}
            </ChartFrame>
          </View>
        </View>
      </AnalyticsCard>

        <AnalyticsCard
          title="Top 15 Native Places"
          subtitle="Approved active member profiles only"
          icon="home-outline"
        >
          <ChartFrame>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={getTopData(data?.nativePlaces, 15) as any}
                width={getChartWidth(15)}
                height={260}
                chartConfig={chartConfig}
                fromZero
                showValuesOnTopOfBars
                withHorizontalLabels={false}
                withInnerLines={false}
                verticalLabelRotation={30}
                yAxisLabel=""
                yAxisSuffix=""
              />
            </ScrollView>
          </ChartFrame>
        </AnalyticsCard>

        <AnalyticsCard
          title="Top 15 Education Levels"
          subtitle="Approved active member profiles only"
          icon="school-outline"
        >
          <ChartFrame>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={getTopData(data?.education, 15) as any}
                width={getChartWidth(15)}
                height={260}
                chartConfig={chartConfig}
                fromZero
                showValuesOnTopOfBars
                withHorizontalLabels={false}
                withInnerLines={false}
                verticalLabelRotation={30}
                yAxisLabel=""
                yAxisSuffix=""
              />
            </ScrollView>
          </ChartFrame>
        </AnalyticsCard>

        <AnalyticsCard
          title={`Top 15 Inactive Users (${data?.inactiveThresholdDays ?? 30}+ days)`}
          subtitle="Based on last successful login timestamp"
          icon="time-outline"
        >
          <View style={styles.inactiveList}>
            {data?.inactiveUsers?.length ? (
              data.inactiveUsers.map((user: any) => (
                <View key={user.id} style={styles.inactiveRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inactiveName}>
                      {user.full_name || 'Unknown User'}
                    </Text>
                    <Text style={styles.inactiveMeta}>
                      {(user.role || 'USER').toUpperCase()} • {user.email || 'No email'}
                    </Text>
                    <Text style={styles.inactiveMeta}>
                      Last login:{' '}
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleString()
                        : 'Never'}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>
                No inactive users for this threshold.
              </Text>
            )}
          </View>
        </AnalyticsCard>
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: any) {
  const s = theme.spacing;
  const r = theme.radius;

  return StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.colors.bg },
    container: { flex: 1 },
    content: {
      padding: s.lg,
      paddingLeft: Platform.OS === 'web' ? 100 : s.lg,
      paddingBottom: s.xl,
    },

    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: theme.colors.bg,
    },
    loadingText: { color: theme.colors.mutedText, fontWeight: '700' },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: s.sm,
      gap: s.md,
    },
    title: { fontSize: 22, fontWeight: '900', color: theme.colors.text },
    subtitle: {
      marginTop: 4,
      fontSize: 13,
      color: theme.colors.mutedText,
      fontWeight: '600',
    },

    infoBanner: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
      padding: 12,
      borderRadius: r.card,
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 12,
    },
    infoBannerText: {
      flex: 1,
      color: theme.colors.mutedText,
      fontWeight: '600',
      fontSize: 12,
      lineHeight: 18,
    },

    refreshBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: r.button,
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    refreshText: { fontWeight: '900', color: theme.colors.text },

    rowTitle: {
      marginTop: 6,
      marginBottom: 6,
      fontSize: 12,
      fontWeight: '900',
      color: theme.colors.mutedText,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },

    kpiRow: {
      paddingVertical: 8,
      gap: 10,
      marginBottom: 4,
      flexDirection: Platform.OS === 'web' ? 'row' : 'column',
      flexWrap: Platform.OS === 'web' ? 'wrap' : 'nowrap',
    },
    kpiChip: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: r.card,
      padding: 12,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: Platform.OS === 'web' ? 220 : '100%',
      minWidth: Platform.OS === 'web' ? 180 : 0,
      maxWidth: Platform.OS === 'web' ? 280 : '100%',
    },
    kpiValue: { fontSize: 16, fontWeight: '900', color: theme.colors.text },
    kpiLabel: { fontSize: 11, fontWeight: '800', color: theme.colors.mutedText },
    kpiHelper: {
      marginTop: 4,
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.mutedText,
      lineHeight: 16,
    },

    card: {
      backgroundColor: theme.colors.surface2,
      borderRadius: r.card,
      padding: s.md,
      marginTop: s.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: s.sm,
    },
    cardTitle: { fontSize: 16, fontWeight: '900', color: theme.colors.text },
    cardSubtitle: {
      marginTop: 4,
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.mutedText,
    },

    chartFrame: {
      borderRadius: r.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface2,
      padding: 10,
      overflow: 'hidden',
    },

    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    metricTile: {
      minWidth: 150,
      flexGrow: 1,
      flexBasis: Platform.OS === 'web' ? '18%' : '45%',
      borderRadius: r.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface2,
      padding: 14,
    },
    metricValue: {
      fontSize: 20,
      fontWeight: '900',
      color: theme.colors.text,
    },
    metricLabel: {
      marginTop: 6,
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.mutedText,
    },
    metricHelper: {
      marginTop: 4,
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.mutedText,
    },

    twoColGrid: {
      flexDirection: Platform.OS === 'web' ? 'row' : 'column',
      gap: 12,
    },
    mixCard: {
      flex: 1,
      minWidth: Platform.OS === 'web' ? 0 : 0,
    },

    subSectionTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: 8,
    },

    inactiveList: {
      gap: 10,
    },
    inactiveRow: {
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: r.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface2,
    },
    inactiveName: {
      fontSize: 14,
      fontWeight: '900',
      color: theme.colors.text,
    },
    inactiveMeta: {
      marginTop: 4,
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.mutedText,
    },
    emptyText: {
      color: theme.colors.mutedText,
      fontWeight: '700',
      paddingVertical: 8,
    },
  });
}

function rgba(hex: string, opacity: number) {
  const v = hex.replace('#', '');
  const r = parseInt(v.substring(0, 2), 16);
  const g = parseInt(v.substring(2, 4), 16);
  const b = parseInt(v.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function blend(hexA: string, hexB: string, amount: number) {
  const a = hexA.replace('#', '');
  const b = hexB.replace('#', '');
  const ar = parseInt(a.substring(0, 2), 16);
  const ag = parseInt(a.substring(2, 4), 16);
  const ab = parseInt(a.substring(4, 6), 16);
  const br = parseInt(b.substring(0, 2), 16);
  const bg = parseInt(b.substring(2, 4), 16);
  const bb = parseInt(b.substring(4, 6), 16);
  const rr = Math.round(ar + (br - ar) * amount);
  const rg = Math.round(ag + (bg - ag) * amount);
  const rb = Math.round(ab + (bb - ab) * amount);
  return `#${rr.toString(16).padStart(2, '0')}${rg
    .toString(16)
    .padStart(2, '0')}${rb.toString(16).padStart(2, '0')}`;
}

function buildChartPalette(primary: string, success: string, danger: string, text: string) {
  const white = '#FFFFFF';
  return [
    primary,
    success,
    danger,
    blend(primary, white, 0.35),
    blend(success, white, 0.35),
    blend(danger, white, 0.35),
    blend(text, white, 0.25),
    blend(primary, white, 0.6),
    blend(success, white, 0.6),
    blend(danger, white, 0.6),
  ];
}