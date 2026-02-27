// ./app/(tabs)/search/FilterPanel.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Fonts } from '../../../constants/theme';
import { getFilterMetadata } from '../../../src/services/search.service';
import FacetFilter from './components/FacetFilter';
import { useAppTheme } from '../../../src/theme/ThemeProvider';

// ✅ Kovil + Pirivu source-of-truth
import { INTEREST_DATA, KOVIL_DATA, EDUCATION_DATA } from '../../../src/constants/appData';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

let globalMetadataCache: any = null;

/** ---------- STATIC BOUNDS (premium + predictable) ---------- */
const AGE_MIN = 18;
const AGE_MAX = 60;

// Height stored/sent as inches: 4'0" to 7'0"
const HEIGHT_MIN = 48;
const HEIGHT_MAX = 84;

const DEFAULT_FILTERS = {
  minAge: AGE_MIN,
  maxAge: AGE_MAX,
  minHeight: HEIGHT_MIN,
  maxHeight: HEIGHT_MAX,
  query: '',
  countries: [],
  education: [],
  interests: [],
  maritalStatus: [],
  excludeKovilPirivu: [],
};

/** ---------- HELPERS ---------- */
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function toInt(value: any, fallback: number): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function heightToInches(value: any, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const raw = String(value ?? '').trim();
  if (!raw) return fallback;

  const ftIn = raw.match(/(\d+)\s*'\s*(\d+)\s*"?/);
  if (ftIn) {
    const ft = parseInt(ftIn[1], 10);
    const inch = parseInt(ftIn[2], 10);
    const total = ft * 12 + inch;
    return Number.isFinite(total) ? total : fallback;
  }

  const cm = raw.match(/(\d+(?:\.\d+)?)\s*cm/i);
  if (cm) {
    const cmVal = parseFloat(cm[1]);
    const total = Math.round(cmVal / 2.54);
    return Number.isFinite(total) ? total : fallback;
  }

  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function formatHeightSmart(inches: number): string {
  if (!Number.isFinite(inches)) return '';
  if (inches < 12) return `${inches}"`;

  const ft = Math.floor(inches / 12);
  const inch = inches % 12;
  return `${ft}'${inch}"`;
}

/** ---------- encode/decode for excluded pairs ---------- */
function encodeExcludePair(kovil: string, pirivu: string): string {
  return `${kovil}||${pirivu}`;
}
function decodeExcludePair(v: string): { kovil: string; pirivu: string } {
  const [kovil, pirivu] = String(v || '').split('||');
  return { kovil: kovil || '', pirivu: pirivu || '' };
}

const MAX_INTERESTS = 3;

export default function FilterPanel({ filters, onFilterChange, onApply, totalResults }: any) {
  const { theme } = useAppTheme();

  // ✅ Map to theme tokens so Warm/Cool changes apply automatically
  const tokens = useMemo(() => {
    const c = theme.colors || ({} as any);
    return {
      bg: c.bg ?? '#FFFFFF',
      surface: c.surface ?? '#FFFFFF',
      surface2: c.surface2 ?? c.surface ?? '#FFFFFF',
      border: c.border ?? '#E5E7EB',
      primary: c.primary ?? '#111827',
      primaryText: c.primaryText ?? '#FFFFFF',
      text: c.text ?? '#111827',
      muted: c.mutedText ?? '#6B7280',
      inputBg: c.inputBg ?? '#FFFFFF',
      danger: c.danger ?? '#EF4444',
    };
  }, [theme]);

  const styles = useMemo(() => makeStyles(theme, tokens), [theme, tokens]);

  // ✅ Local interests list is canonical (fast + consistent)
  const interestOptions = useMemo(() => INTEREST_DATA || [], []);

  const educationOptions = useMemo(
    () => (EDUCATION_DATA || []).map((x: any) => String(x?.value ?? x?.label ?? '')).filter(Boolean),
    [],
  );

  const [loading, setLoading] = useState(!globalMetadataCache);
  const [facets, setFacets] = useState<any>(
    globalMetadataCache || {
      countries: [],
      education: educationOptions,
      interests: interestOptions,
    },
  );

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    query: true,
    age: true,
    height: true,
    location: true,
    excludeKovilPirivu: true,
    education: false,
    marital: false,
    interests: false,
  });

  const [localQuery, setLocalQuery] = useState(filters?.query || '');
  const [openExcludeKovil, setOpenExcludeKovil] = useState<string | null>(null);
  const [interestLimitHit, setInterestLimitHit] = useState(false);

  const minAge = useMemo(
    () => clamp(toInt(filters?.minAge, AGE_MIN), AGE_MIN, AGE_MAX),
    [filters?.minAge],
  );
  const maxAge = useMemo(
    () => clamp(toInt(filters?.maxAge, AGE_MAX), AGE_MIN, AGE_MAX),
    [filters?.maxAge],
  );

  const minHeight = useMemo(
    () => clamp(heightToInches(filters?.minHeight, HEIGHT_MIN), HEIGHT_MIN, HEIGHT_MAX),
    [filters?.minHeight],
  );
  const maxHeight = useMemo(
    () => clamp(heightToInches(filters?.maxHeight, HEIGHT_MAX), HEIGHT_MIN, HEIGHT_MAX),
    [filters?.maxHeight],
  );

  const excludePairs: string[] = useMemo(
    () => (Array.isArray(filters?.excludeKovilPirivu) ? filters.excludeKovilPirivu : []),
    [filters?.excludeKovilPirivu],
  );

  const activeCount = useMemo(() => {
    let n = 0;
    if ((filters?.query || '').trim()) n += 1;
    if (!(minAge === AGE_MIN && maxAge === AGE_MAX)) n += 1;
    if (!(minHeight === HEIGHT_MIN && maxHeight === HEIGHT_MAX)) n += 1;
    if (Array.isArray(filters?.countries) && filters.countries.length) n += 1;
    if (Array.isArray(filters?.education) && filters.education.length) n += 1;
    if (Array.isArray(filters?.maritalStatus) && filters.maritalStatus.length) n += 1;
    if (Array.isArray(filters?.interests) && filters.interests.length) n += 1;
    if (Array.isArray(filters?.excludeKovilPirivu) && filters.excludeKovilPirivu.length) n += 1;
    return n;
  }, [
    filters?.countries,
    filters?.education,
    filters?.excludeKovilPirivu,
    filters?.interests,
    filters?.maritalStatus,
    filters?.query,
    maxAge,
    maxHeight,
    minAge,
    minHeight,
  ]);

  useEffect(() => {
    if (globalMetadataCache) {
      setFacets({ ...globalMetadataCache, interests: interestOptions, education: educationOptions });
      setLoading(false);
      return;
    }

    const fetchMetadata = async () => {
      try {
        const data = await getFilterMetadata();
        const merged = { ...data, interests: interestOptions, education: educationOptions };
        globalMetadataCache = merged;
        setFacets(merged);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Metadata Sync Failed:', e);
        setFacets((prev: any) => ({ ...prev, interests: interestOptions }));
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [interestOptions, educationOptions]);

  useEffect(() => {
    setLocalQuery(filters?.query || '');
  }, [filters?.query]);

  useEffect(() => {
    const n = Array.isArray(filters?.interests) ? filters.interests.length : 0;
    if (n < MAX_INTERESTS && interestLimitHit) setInterestLimitHit(false);
  }, [filters?.interests, interestLimitHit]);

  const toggleSection = useCallback((section: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const commitQueryToParent = useCallback(
    (q: string) => {
      if ((filters?.query || '') !== q) onFilterChange({ ...filters, query: q });
    },
    [filters, onFilterChange],
  );

  const handleApplyPress = useCallback(() => {
    commitQueryToParent(localQuery);
    onApply();
  }, [commitQueryToParent, localQuery, onApply]);

  const handleReset = useCallback(() => {
    onFilterChange(DEFAULT_FILTERS);
    setLocalQuery('');
    setOpenExcludeKovil(null);
    setInterestLimitHit(false);
  }, [onFilterChange]);

  const setAge = useCallback(
    (nextMin: number, nextMax: number) => {
      const lo = clamp(Math.min(nextMin, nextMax), AGE_MIN, AGE_MAX);
      const hi = clamp(Math.max(nextMin, nextMax), AGE_MIN, AGE_MAX);
      onFilterChange({ ...filters, minAge: lo, maxAge: hi });
    },
    [filters, onFilterChange],
  );

  const setHeight = useCallback(
    (nextMin: number, nextMax: number) => {
      const lo = clamp(Math.min(nextMin, nextMax), HEIGHT_MIN, HEIGHT_MAX);
      const hi = clamp(Math.max(nextMin, nextMax), HEIGHT_MIN, HEIGHT_MAX);
      onFilterChange({ ...filters, minHeight: lo, maxHeight: hi });
    },
    [filters, onFilterChange],
  );

  const toggleMulti = useCallback(
    (key: string, value: string) => {
      const current: string[] = Array.isArray(filters?.[key]) ? filters[key] : [];

      if (key === 'interests') {
        const isSelected = current.includes(value);
        if (!isSelected && current.length >= MAX_INTERESTS) {
          setInterestLimitHit(true);
          return;
        }
        if (interestLimitHit) setInterestLimitHit(false);
      }

      const next = current.includes(value)
        ? current.filter((v: string) => v !== value)
        : [...current, value];

      onFilterChange({ ...filters, [key]: next });
    },
    [filters, onFilterChange, interestLimitHit],
  );

  const setExcludePairs = useCallback(
    (next: string[]) => onFilterChange({ ...filters, excludeKovilPirivu: next }),
    [filters, onFilterChange],
  );

  const clearExcludeForKovil = useCallback(
    (kovilValue: string) => {
      const next = excludePairs.filter((x) => decodeExcludePair(x).kovil !== kovilValue);
      setExcludePairs(next);
    },
    [excludePairs, setExcludePairs],
  );

  const isWholeKovilExcluded = useCallback(
    (kovilValue: string) => excludePairs.includes(encodeExcludePair(kovilValue, '*')),
    [excludePairs],
  );

  const toggleExcludeWholeKovil = useCallback(
    (kovilValue: string) => {
      const wholeKey = encodeExcludePair(kovilValue, '*');
      const hasWhole = excludePairs.includes(wholeKey);

      let next = hasWhole ? excludePairs.filter((x) => x !== wholeKey) : [...excludePairs, wholeKey];

      if (!hasWhole) {
        next = next.filter((x) => {
          const p = decodeExcludePair(x);
          if (p.kovil !== kovilValue) return true;
          return p.pirivu === '*';
        });
      }

      setExcludePairs(next);
    },
    [excludePairs, setExcludePairs],
  );

  const toggleExcludePirivu = useCallback(
    (kovilValue: string, pirivu: string) => {
      const wholeKey = encodeExcludePair(kovilValue, '*');
      const base = excludePairs.filter((x) => x !== wholeKey);

      const key = encodeExcludePair(kovilValue, pirivu);
      const next = base.includes(key) ? base.filter((x) => x !== key) : [...base, key];
      setExcludePairs(next);
    },
    [excludePairs, setExcludePairs],
  );

  const excludeKovilChipActive = useCallback(
    (kovilValue: string) => {
      if (openExcludeKovil === kovilValue) return true;
      if (isWholeKovilExcluded(kovilValue)) return true;
      return excludePairs.some((x) => {
        const p = decodeExcludePair(x);
        return p.kovil === kovilValue && p.pirivu !== '*';
      });
    },
    [excludePairs, isWholeKovilExcluded, openExcludeKovil],
  );

  const onPressExcludeKovil = useCallback(
    (kovilValue: string) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      const isActive = excludeKovilChipActive(kovilValue);

      if (isActive) {
        clearExcludeForKovil(kovilValue);
        setOpenExcludeKovil((prev) => (prev === kovilValue ? null : prev));
        return;
      }

      setOpenExcludeKovil(kovilValue);
      toggleExcludeWholeKovil(kovilValue);
    },
    [clearExcludeForKovil, excludeKovilChipActive, toggleExcludeWholeKovil],
  );

  const subtitleText = useMemo(() => {
    const n = Number(totalResults ?? 0);
    if (!Number.isFinite(n) || n <= 0) return 'Update results to refresh';
    return `${n.toLocaleString?.() || n} results`;
  }, [totalResults]);

  const FilterSection = useCallback(
    ({ id, label, children, active = 0 }: { id: string; label: string; children: any; active?: number }) => (
      <View style={styles.card}>
        <TouchableOpacity style={styles.cardHeader} onPress={() => toggleSection(id)}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.cardTitle}>{label}</Text>
            {active > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{active}</Text>
              </View>
            ) : null}
          </View>
          <Ionicons
            name={expanded[id] ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={tokens.muted}
          />
        </TouchableOpacity>
        {expanded[id] ? <View style={styles.cardBody}>{children}</View> : null}
      </View>
    ),
    [expanded, toggleSection, styles, tokens.muted],
  );

  const selectedInterestCount = Array.isArray(filters?.interests) ? filters.interests.length : 0;

  // ✅ UI: Small Stepper (now theme-aware via props)
  const Stepper = useCallback(
    ({
      label,
      valueText,
      onMinus,
      onPlus,
    }: {
      label: string;
      valueText: string;
      onMinus: () => void;
      onPlus: () => void;
    }) => (
      <View style={styles.stepper}>
        <Text style={styles.stepperLabel}>{label}</Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity accessibilityRole="button" style={styles.stepBtn} onPress={onMinus}>
            <Ionicons name="remove" size={16} color={tokens.text} />
          </TouchableOpacity>

          <Text style={styles.stepValue}>{valueText}</Text>

          <TouchableOpacity accessibilityRole="button" style={styles.stepBtn} onPress={onPlus}>
            <Ionicons name="add" size={16} color={tokens.text} />
          </TouchableOpacity>
        </View>
      </View>
    ),
    [styles, tokens.text],
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Refine Search</Text>
          <Text style={styles.headerSubtitle}>
            {subtitleText}
            {activeCount > 0 ? ` • ${activeCount} active` : ''}
          </Text>
        </View>

        <TouchableOpacity accessibilityRole="button" onPress={handleReset} style={styles.resetBtn}>
          <Ionicons name="refresh" size={14} color={tokens.primary} />
          <Text style={styles.resetText}>Reset</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={tokens.primary} />
          </View>
        ) : (
          <>
            {/* Keywords */}
            <FilterSection id="query" label="Keywords" active={(localQuery || '').trim() ? 1 : 0}>
              <View style={styles.searchWrap}>
                <Ionicons name="search" size={18} color={tokens.muted} />
                <TextInput
                  value={localQuery}
                  onChangeText={setLocalQuery}
                  onBlur={() => commitQueryToParent(localQuery)}
                  placeholder="Name, profession, city…"
                  placeholderTextColor={tokens.muted}
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                />
                {!!localQuery && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => setLocalQuery('')}
                    style={styles.searchClearBtn}
                  >
                    <Ionicons name="close" size={16} color={tokens.muted} />
                  </TouchableOpacity>
                )}
              </View>
            </FilterSection>

            {/* Age */}
            <FilterSection id="age" label="Age Range" active={minAge === AGE_MIN && maxAge === AGE_MAX ? 0 : 1}>
              <Text style={styles.rangeText}>
                {minAge} – {maxAge} years
              </Text>
              <View style={styles.stepGrid}>
                <Stepper
                  label="Min"
                  valueText={`${minAge}`}
                  onMinus={() => setAge(minAge - 1, maxAge)}
                  onPlus={() => setAge(minAge + 1, maxAge)}
                />
                <Stepper
                  label="Max"
                  valueText={`${maxAge}`}
                  onMinus={() => setAge(minAge, maxAge - 1)}
                  onPlus={() => setAge(minAge, maxAge + 1)}
                />
              </View>
            </FilterSection>

            {/* Height */}
            <FilterSection id="height" label="Height Range" active={minHeight === HEIGHT_MIN && maxHeight === HEIGHT_MAX ? 0 : 1}>
              <Text style={styles.rangeText}>
                {formatHeightSmart(minHeight)} – {formatHeightSmart(maxHeight)}
                <Text style={styles.unitLabel}>  (inches)</Text>
              </Text>
              <View style={styles.stepGrid}>
                <Stepper
                  label="Min"
                  valueText={formatHeightSmart(minHeight)}
                  onMinus={() => setHeight(minHeight - 1, maxHeight)}
                  onPlus={() => setHeight(minHeight + 1, maxHeight)}
                />
                <Stepper
                  label="Max"
                  valueText={formatHeightSmart(maxHeight)}
                  onMinus={() => setHeight(minHeight, maxHeight - 1)}
                  onPlus={() => setHeight(minHeight, maxHeight + 1)}
                />
              </View>
            </FilterSection>

            {/* Location */}
            <FilterSection id="location" label="Location" active={filters?.countries?.length || 0}>
              <FacetFilter
                options={facets.countries || []}
                selectedValues={filters?.countries || []}
                onToggle={(v: string) => toggleMulti('countries', v)}
              />
            </FilterSection>

            {/* Exclude Kovil/Pirivu */}
            <FilterSection
              id="excludeKovilPirivu"
              label="Exclude Kovil + Pirivu (NOT)"
              active={Array.isArray(filters?.excludeKovilPirivu) ? filters.excludeKovilPirivu.length : 0}
            >
              <Text style={styles.helperText}>
                Exclude your own Kovil/Pirivu (and any others) so disallowed pairs don’t appear in results.
              </Text>

              <View style={styles.chipWrap}>
                {(KOVIL_DATA || []).map((k: any) => {
                  const kovilValue = String(k?.value ?? '');
                  const kovilLabel = String(k?.label ?? kovilValue);
                  if (!kovilValue) return null;

                  const active = excludeKovilChipActive(kovilValue);

                  return (
                    <TouchableOpacity
                      key={kovilValue}
                      accessibilityRole="button"
                      onPress={() => onPressExcludeKovil(kovilValue)}
                      style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
                    >
                      <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextIdle]}>
                        {kovilLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {!!openExcludeKovil && (
                <View style={styles.pirivuBox}>
                  <View style={styles.pirivuHeaderRow}>
                    <Text style={styles.pirivuHeader}>Pirivu for {openExcludeKovil}</Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setOpenExcludeKovil(null);
                      }}
                      style={styles.pirivuCloseBtn}
                    >
                      <Ionicons name="close" size={16} color={tokens.muted} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.chipWrap}>
                    {(() => {
                      const match = (KOVIL_DATA || []).find((x: any) => String(x?.value ?? '') === openExcludeKovil);
                      const pirivus: string[] = Array.isArray(match?.pirivus) ? match.pirivus : [];

                      if (!Array.isArray(pirivus) || pirivus.length === 0) {
                        return <Text style={styles.helperText}>No pirivu list found for this kovil.</Text>;
                      }

                      return pirivus.map((p) => {
                        const key = encodeExcludePair(openExcludeKovil, p);
                        const active = excludePairs.includes(key);
                        return (
                          <TouchableOpacity
                            key={key}
                            accessibilityRole="button"
                            onPress={() => toggleExcludePirivu(openExcludeKovil, p)}
                            style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
                          >
                            <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextIdle]}>
                              {p}
                            </Text>
                          </TouchableOpacity>
                        );
                      });
                    })()}
                  </View>

                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => clearExcludeForKovil(openExcludeKovil)}
                    style={styles.clearRow}
                  >
                    <Ionicons name="trash" size={16} color={tokens.primary} />
                    <Text style={styles.clearText}>Clear exclusions for {openExcludeKovil}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </FilterSection>

            {/* Interests */}
            <FilterSection id="interests" label="Interests" active={filters?.interests?.length || 0}>
              <Text style={styles.helperText}>
                Pick up to {MAX_INTERESTS}. {selectedInterestCount}/{MAX_INTERESTS} selected.
              </Text>
              {interestLimitHit ? (
                <Text style={styles.limitText}>You can select up to {MAX_INTERESTS} interests.</Text>
              ) : null}
              <FacetFilter
                options={facets.interests || []}
                selectedValues={filters?.interests || []}
                onToggle={(v: string) => toggleMulti('interests', v)}
              />
            </FilterSection>

            {/* Education */}
            <FilterSection id="education" label="Education" active={filters?.education?.length || 0}>
              <FacetFilter
                options={facets.education || []}
                selectedValues={filters?.education || []}
                onToggle={(v: string) => toggleMulti('education', v)}
              />
            </FilterSection>
          </>
        )}
      </ScrollView>

      {/* Sticky bottom action bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity accessibilityRole="button" onPress={handleReset} style={styles.bottomGhostBtn}>
          <Text style={styles.bottomGhostText}>Reset</Text>
        </TouchableOpacity>

        <TouchableOpacity accessibilityRole="button" onPress={handleApplyPress} style={styles.bottomPrimaryBtn}>
          <Text style={styles.bottomPrimaryText}>Apply</Text>
          {typeof totalResults !== 'undefined' ? (
            <View style={styles.bottomPill}>
              <Text style={styles.bottomPillText}>
                {Number(totalResults || 0).toLocaleString?.() || totalResults}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(theme: any, t: any) {
  const r = theme.radius || { input: 12, card: 16, button: 16 };

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },

    header: {
      paddingTop: 18,
      paddingHorizontal: 18,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
      backgroundColor: t.bg,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    headerTitle: { fontSize: 18, fontWeight: '900', color: t.text, fontFamily: Fonts?.rounded },
    headerSubtitle: { marginTop: 2, fontSize: 12, fontWeight: '700', color: t.muted },

    resetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    resetText: { marginLeft: 6, fontSize: 12, fontWeight: '900', color: t.primary },

    scrollContent: { padding: 16, paddingBottom: 120 },
    loadingWrap: { paddingVertical: 42, alignItems: 'center' },

    card: {
      backgroundColor: t.surface2,
      borderRadius: r.card ?? 20,
      borderWidth: 1,
      borderColor: t.border,
      marginBottom: 12,
      overflow: 'hidden',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
        android: { elevation: 2 },
        web: { boxShadow: '0px 6px 18px rgba(0,0,0,0.06)' } as any,
      }),
    },
    cardHeader: {
      paddingHorizontal: 14,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
    cardTitle: { fontSize: 13, fontWeight: '900', color: t.text },

    badge: {
      marginLeft: 8,
      paddingHorizontal: 8,
      height: 18,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.primary,
    },
    badgeText: { color: t.primaryText, fontSize: 10, fontWeight: '900' },

    cardBody: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: t.border },

    searchWrap: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.inputBg,
      paddingHorizontal: 12,
    },
    searchInput: { flex: 1, height: 46, fontSize: 14, fontWeight: '700', color: t.text },
    searchClearBtn: { padding: 8, borderRadius: 999 },

    rangeText: { marginTop: 8, marginBottom: 10, fontSize: 14, fontWeight: '900', color: t.text },
    unitLabel: { fontSize: 12, fontWeight: '800', color: t.muted },

    stepGrid: { flexDirection: 'row', gap: 10 as any },
    stepper: {
      flex: 1,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.inputBg,
      padding: 12,
    },
    stepperLabel: { fontSize: 12, fontWeight: '900', color: t.muted, marginBottom: 8 },
    stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    stepValue: { fontSize: 16, fontWeight: '900', color: t.text },
    stepBtn: {
      width: 34,
      height: 34,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },

    helperText: { marginTop: 10, marginBottom: 8, color: t.muted, fontSize: 12, fontWeight: '700', lineHeight: 16 },
    limitText: { marginTop: 4, marginBottom: 8, color: t.primary, fontSize: 12, fontWeight: '900' },

    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 as any },
    chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
    chipIdle: { borderColor: t.border, backgroundColor: t.inputBg },
    chipActive: { borderColor: t.primary, backgroundColor: t.primary },
    chipText: { fontSize: 12, fontWeight: '900' },
    chipTextIdle: { color: t.text },
    chipTextActive: { color: t.primaryText },

    pirivuBox: {
      marginTop: 12,
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.inputBg,
    },
    pirivuHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    pirivuHeader: { fontSize: 12, fontWeight: '900', color: t.text },
    pirivuCloseBtn: { padding: 6, borderRadius: 999 },

    clearRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 as any, paddingVertical: 6 },
    clearText: { color: t.primary, fontSize: 12, fontWeight: '900' },

    bottomBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 14,
      backgroundColor: t.bg,
      borderTopWidth: 1,
      borderTopColor: t.border,
      flexDirection: 'row',
      gap: 10 as any,
    },
    bottomGhostBtn: {
      width: 96,
      borderRadius: r.button ?? 16,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
    },
    bottomGhostText: { fontSize: 13, fontWeight: '900', color: t.text },

    bottomPrimaryBtn: {
      flex: 1,
      borderRadius: r.button ?? 16,
      backgroundColor: t.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      flexDirection: 'row',
      gap: 10 as any,
    },
    bottomPrimaryText: { fontSize: 14, fontWeight: '900', color: t.primaryText },

    bottomPill: {
      paddingHorizontal: 10,
      height: 24,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bottomPillText: { color: t.primaryText, fontSize: 12, fontWeight: '900' },
  });
}