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

export default function AnalyticsScreen() {
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    void loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAnalytics = async () => {
    try {
      const distData = await adminService.getDistributionData();
      setData(distData);
    } finally {
      setLoading(false);
    }
  };

  const getChartWidth = (itemCount: number) => {
    if (itemCount <= 10) return Math.max(350, itemCount * 75);
    return Math.max(fullScreenWidth, itemCount * 50);
  };

  const chartConfig = useMemo(() => {
    return {
      backgroundColor: theme.colors.surface2,
      backgroundGradientFrom: theme.colors.surface2,
      backgroundGradientTo: theme.colors.surface2,
      decimalPlaces: 0,
      color: (opacity = 1) => rgba(theme.colors.text, opacity),
      labelColor: (opacity = 1) => rgba(theme.colors.mutedText, opacity),
      barPercentage: 0.8,
      propsForLabels: { fontSize: 9, fontWeight: '700' as any },
      // Bars use this gradient; keep it aligned with primary.
      fillShadowGradient: theme.colors.primary,
      fillShadowGradientOpacity: 1,
    };
  }, [
    theme.colors.mutedText,
    theme.colors.primary,
    theme.colors.surface2,
    theme.colors.text,
  ]);

  const formatPieData = (obj: any) => {
    const palette = buildChartPalette(
      theme.colors.primary,
      theme.colors.success,
      theme.colors.danger,
      theme.colors.text,
    );

    return Object.keys(obj || {}).map((key, idx) => ({
      name: key,
      population: obj[key],
      color: palette[idx % palette.length],
      legendFontColor: theme.colors.mutedText,
      legendFontSize: 12,
    }));
  };

  const getTopData = (obj: any, limit = 15) => {
    const sorted = Object.entries(obj || {})
      .sort(([, a]: any, [, b]: any) => b - a)
      .slice(0, limit);

    return {
      labels: sorted.map(([label]) => label),
      datasets: [{ data: sorted.map(([, val]) => val as number) }],
    };
  };

  const kpis = useMemo(() => {
    if (!data) return [];

    return [
      {
        label: 'Total Members',
        value: Object.values(data.gender || {}).reduce(
          (a: any, b: any) => a + b,
          0,
        ),
        icon: 'people-outline' as any,
      },
      {
        label: 'Countries',
        value: Object.keys(data.countries || {}).length,
        icon: 'globe-outline' as any,
      },
      {
        label: 'Native Places',
        value: Object.keys(data.nativePlaces || {}).length,
        icon: 'home-outline' as any,
      },
      {
        label: 'Kovils',
        value: Object.keys(data.kovils || {}).length,
        icon: 'business-outline' as any,
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

  const AnalyticsCard = ({ title, icon, children }: any) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons
          name={icon}
          size={18}
          color={theme.colors.text}
          style={{ transformOrigin: 'center' } as any}
        />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );

  const ChartFrame = ({ children }: any) => (
    <View style={styles.chartFrame}>{children}</View>
  );

  return (
    <View style={styles.page}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>System Analytics</Text>
            <Text style={styles.subtitle}>Directory distribution metrics</Text>
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kpiRow}
        >
          {kpis.map((k, idx) => (
            <View key={idx} style={styles.kpiChip}>
              <Ionicons
                name={k.icon}
                size={16}
                color={theme.colors.text}
                style={{ transformOrigin: 'center' } as any}
              />
              <View>
                <Text style={styles.kpiValue}>{k.value.toLocaleString()}</Text>
                <Text style={styles.kpiLabel}>{k.label}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <AnalyticsCard title="Gender Distribution" icon="male-female-outline">
          <ChartFrame>
            <PieChart
              data={formatPieData(data?.gender)}
              width={fullScreenWidth}
              height={220}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              absolute
            />
          </ChartFrame>
        </AnalyticsCard>

        <AnalyticsCard title="Top 15 Native Places" icon="home-outline">
          <ChartFrame>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={getTopData(data?.nativePlaces, 15)}
                width={getChartWidth(15)}
                height={260}
                chartConfig={chartConfig}
                fromZero
                showValuesOnTopOfBars
                withHorizontalLabels={false}
                withInnerLines={false}
                verticalLabelRotation={30}
              />
            </ScrollView>
          </ChartFrame>
        </AnalyticsCard>

        <AnalyticsCard title="System Roles" icon="shield-checkmark-outline">
          <ChartFrame>
            <PieChart
              data={formatPieData(data?.roles)}
              width={fullScreenWidth}
              height={220}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              absolute
            />
          </ChartFrame>
        </AnalyticsCard>

        <AnalyticsCard title="Top 15 Education Levels" icon="school-outline">
          <ChartFrame>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={getTopData(data?.education, 15)}
                width={getChartWidth(15)}
                height={260}
                chartConfig={chartConfig}
                fromZero
                showValuesOnTopOfBars
                withHorizontalLabels={false}
                withInnerLines={false}
                verticalLabelRotation={30}
              />
            </ScrollView>
          </ChartFrame>
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

    kpiRow: { paddingVertical: 8, gap: 10, marginBottom: 6 },
    kpiChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: r.card,
      padding: 12,
    },
    kpiValue: { fontSize: 16, fontWeight: '900', color: theme.colors.text },
    kpiLabel: { fontSize: 11, fontWeight: '800', color: theme.colors.mutedText },

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
      alignItems: 'center',
      gap: 12,
      marginBottom: s.sm,
    },
    cardTitle: { fontSize: 16, fontWeight: '900', color: theme.colors.text },

    chartFrame: {
      borderRadius: r.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface2,
      padding: 10,
      overflow: 'hidden',
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