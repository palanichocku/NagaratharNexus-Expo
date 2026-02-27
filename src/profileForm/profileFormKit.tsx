// src/profileForm/profileFormKit.tsx
import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Dropdown, MultiSelect } from 'react-native-element-dropdown';
import { Country, State } from 'country-state-city';

import {
  GENDER_DATA,
  RESIDENT_STATUS_DATA,
  EDUCATION_DATA,
  FIELD_OF_STUDY_DATA,
  UNIVERSITY_DATA,
  MARITAL_STATUS_DATA,
  PROFESSION_DATA,
  NATIVE_PLACES_DATA,
  KOVIL_DATA,
  RASI_DATA,
  NAKSHATRA_DATA,
  HEIGHT_DATA,
  INTEREST_DATA,
  OCCUPATION_DATA,
} from '../constants/appData';

type ThemeLike = any;

export type ProfileTempData = Record<string, any>;

export function getCountryOptions() {
  return Country.getAllCountries().map((c) => ({ label: c.name, value: c.name, isoCode: c.isoCode }));
}

export function getCountryIsoByName(countryName?: string): string {
  if (!countryName) return '';
  const found = Country.getAllCountries().find((c) => c.name === countryName);
  return found?.isoCode || '';
}

export function getStateOptions(countryName?: string) {
  const iso = getCountryIsoByName(countryName);
  if (!iso) return [];
  return State.getStatesOfCountry(iso).map((s) => ({ label: s.name, value: s.name }));
}

export function getPirivuOptions(kovilValue?: string) {
  const k = (KOVIL_DATA || []).find((x: any) => x.value === kovilValue || x.label === kovilValue);
  const pirivus: string[] = (k?.pirivus || []) as any;
  return pirivus.map((p) => ({ label: p, value: p }));
}

// ---- Shared Form Controls (used in ProfileDisplay + later in Onboarding) ----

export function FormTextInput({
  label,
  value,
  placeholder,
  onChange,
  theme,
}: {
  label?: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  theme: ThemeLike;
}) {
  return (
    <View>
      {!!label && <Text style={makeInlineStyles(theme).inlineLabel}>{label}</Text>}
      <TextInput
        style={makeInlineStyles(theme).textInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.mutedText}
      />
    </View>
  );
}

export function FormSelect({
  value,
  placeholder,
  data,
  onChangeValue,
  theme,
}: {
  value: any;
  placeholder: string;
  data: Array<{ label: string; value: any }>;
  onChangeValue: (v: any) => void;
  theme: ThemeLike;
}) {
  return (
    <Dropdown
      style={makeInlineStyles(theme).dropdown}
      data={data || []}
      search
      labelField="label"
      valueField="value"
      placeholder={placeholder}
      value={value}
      onChange={(item: any) => onChangeValue(item?.value)}
    />
  );
}

export function FormMultiSelect({
  value,
  placeholder,
  data,
  onChangeValue,
  theme,
}: {
  value: any[];
  placeholder: string;
  data: Array<{ label: string; value: any }>;
  onChangeValue: (v: any[]) => void;
  theme: ThemeLike;
}) {
  return (
    <MultiSelect
      style={makeInlineStyles(theme).dropdown}
      data={data || []}
      labelField="label"
      valueField="value"
      placeholder={placeholder}
      value={Array.isArray(value) ? value : []}
      onChange={(items: any) => onChangeValue(items)}
      selectedStyle={makeInlineStyles(theme).selectedChip}
    />
  );
}

export function HeightStepper({
  value,
  onChange,
  theme,
}: {
  value: string;
  onChange: (v: string) => void;
  theme: ThemeLike;
}) {
  const all = HEIGHT_DATA || [];
  const idx = Math.max(
    0,
    all.findIndex((h: any) => h.value === value || h.label === value),
  );

  const current = all[idx] || all[0];

  const dec = () => {
    const next = all[Math.max(0, idx - 1)];
    onChange(next?.value || '');
  };
  const inc = () => {
    const next = all[Math.min(all.length - 1, idx + 1)];
    onChange(next?.value || '');
  };

  return (
    <View style={makeInlineStyles(theme).stepperWrap}>
      <TouchableOpacity onPress={dec} style={makeInlineStyles(theme).stepBtn} activeOpacity={0.85}>
        <Ionicons name="remove" size={16} color={theme.colors.text} />
      </TouchableOpacity>
      <View style={makeInlineStyles(theme).stepValueWrap}>
        <Text style={makeInlineStyles(theme).stepValueText}>{current?.label || value || 'Select'}</Text>
      </View>
      <TouchableOpacity onPress={inc} style={makeInlineStyles(theme).stepBtn} activeOpacity={0.85}>
        <Ionicons name="add" size={16} color={theme.colors.text} />
      </TouchableOpacity>
    </View>
  );
}

export function EducationEditor({
  value,
  onChange,
  theme,
}: {
  value: Array<{ level: string; field: string; university: string }>;
  onChange: (v: any[]) => void;
  theme: ThemeLike;
}) {
  const items = Array.isArray(value) && value.length > 0 ? value : [{ level: '', field: '', university: '' }];

  const update = (idx: number, patch: any) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange(next);
  };

  const add = () => onChange([...(items || []), { level: '', field: '', university: '' }]);
  const remove = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    onChange(next.length ? next : [{ level: '', field: '', university: '' }]);
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={makeInlineStyles(theme).rowHeader}>
        <Text style={makeInlineStyles(theme).inlineHeader}>Education History</Text>
        <TouchableOpacity onPress={add} style={makeInlineStyles(theme).inlineAddBtn} activeOpacity={0.85}>
          <Ionicons name="add" size={16} color={theme.colors.text} />
          <Text style={makeInlineStyles(theme).inlineAddText}>Add</Text>
        </TouchableOpacity>
      </View>

      {items.map((edu, idx) => (
        <View key={idx} style={makeInlineStyles(theme).repeatCard}>
          <View style={makeInlineStyles(theme).repeatHeader}>
            <Text style={makeInlineStyles(theme).repeatTitle}>Entry {idx + 1}</Text>
            <TouchableOpacity onPress={() => remove(idx)} activeOpacity={0.85}>
              <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
            </TouchableOpacity>
          </View>

          <FormSelect
            value={edu.level}
            placeholder="Select degree"
            data={EDUCATION_DATA || []}
            onChangeValue={(v) => update(idx, { level: v })}
            theme={theme}
          />

          <FormSelect
            value={edu.field}
            placeholder="Select field of study"
            data={FIELD_OF_STUDY_DATA || []}
            onChangeValue={(v) => update(idx, { field: v })}
            theme={theme}
          />

          <FormTextInput
            value={edu.university || ''}
            placeholder="University / Institute"
            onChange={(v) => update(idx, { university: v })}
            theme={theme}
          />
        </View>
      ))}
    </View>
  );
}

export function SiblingsEditor({
  value,
  onChange,
  theme,
}: {
  value: Array<{ name: string; maritalStatus: string; occupation: string }>;
  onChange: (v: any[]) => void;
  theme: ThemeLike;
}) {
  const items = Array.isArray(value) ? value : [];
  const sibMarital = [...(MARITAL_STATUS_DATA || []), { label: 'Married', value: 'Married' }];
  const occ = [...(OCCUPATION_DATA || []), { label: 'Student', value: 'Student' }];

  const add = () => onChange([...(items || []), { name: '', maritalStatus: '', occupation: '' }]);
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const update = (idx: number, patch: any) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange(next);
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={makeInlineStyles(theme).rowHeader}>
        <Text style={makeInlineStyles(theme).inlineHeader}>Siblings</Text>
        <TouchableOpacity onPress={add} style={makeInlineStyles(theme).inlineAddBtn} activeOpacity={0.85}>
          <Ionicons name="add" size={16} color={theme.colors.text} />
          <Text style={makeInlineStyles(theme).inlineAddText}>Add</Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <Text style={{ color: theme.colors.mutedText, fontStyle: 'italic' }}>None added</Text>
      ) : (
        items.map((sib, idx) => (
          <View key={idx} style={makeInlineStyles(theme).repeatCard}>
            <View style={makeInlineStyles(theme).repeatHeader}>
              <Text style={makeInlineStyles(theme).repeatTitle}>Sibling {idx + 1}</Text>
              <TouchableOpacity onPress={() => remove(idx)} activeOpacity={0.85}>
                <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
              </TouchableOpacity>
            </View>

            <FormTextInput
              value={sib.name || ''}
              placeholder="Name"
              onChange={(v) => update(idx, { name: v })}
              theme={theme}
            />

            <FormSelect
              value={sib.maritalStatus}
              placeholder="Marital Status"
              data={sibMarital}
              onChangeValue={(v) => update(idx, { maritalStatus: v })}
              theme={theme}
            />

            <FormSelect
              value={sib.occupation}
              placeholder="Occupation"
              data={occ}
              onChangeValue={(v) => update(idx, { occupation: v })}
              theme={theme}
            />
          </View>
        ))
      )}
    </View>
  );
}

export const PROFILE_FIELD_OPTIONS = {
  gender: GENDER_DATA,
  residentStatus: RESIDENT_STATUS_DATA,
  maritalStatus: MARITAL_STATUS_DATA,
  profession: PROFESSION_DATA,
  nativePlace: NATIVE_PLACES_DATA,
  kovil: KOVIL_DATA,
  rasi: RASI_DATA,
  star: NAKSHATRA_DATA,
  height: HEIGHT_DATA,
  interests: INTEREST_DATA.map((i) => ({ label: i, value: i })),
} as const;

function makeInlineStyles(theme: any) {
  const r = theme?.radius?.input ?? 12;

  return StyleSheet.create({
    textInput: {
      backgroundColor: theme.colors.inputBg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: r,
      padding: 10,
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: '700',
    },

    dropdown: {
      height: 46,
      borderRadius: r,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      backgroundColor: theme.colors.inputBg,
    },

    selectedChip: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    inlineLabel: {
      fontSize: 10,
      fontWeight: '900',
      color: theme.colors.mutedText,
      textTransform: 'uppercase',
      marginBottom: 4,
      letterSpacing: 0.6,
    },

    stepperWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    stepBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: 'center',
      alignItems: 'center',

      shadowColor: '#000',
      shadowOpacity: Platform.OS === 'web' ? 0 : 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },

    stepValueWrap: {
      flex: 1,
      height: 46,
      borderRadius: r,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.inputBg,
      paddingHorizontal: 12,
      justifyContent: 'center',
    },

    stepValueText: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.text,
    },

    rowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    inlineHeader: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.colors.text,
    },

    inlineAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: theme.colors.surface2,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    inlineAddText: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.colors.text,
    },

    repeatCard: {
      padding: 12,
      borderRadius: 16,
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 10,
    },

    repeatHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },

    repeatTitle: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.colors.text,
    },
  });
}
