import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThinProfileCard } from '../services/search.service';

function cleanText(v: any): string {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  if (lower === 'none' || lower === 'na' || lower === 'n/a') return '';
  return s;
}

function prettyLocationWithStatus(p: ThinProfileCard) {
  const city = cleanText(p.current_city);
  const state = cleanText(p.current_state);
  const country = cleanText(p.resident_country);
  const status = cleanText(p.resident_status);

  const left = [city, state].filter(Boolean).join(', ');
  const base = [left, country].filter(Boolean).join(' • ');

  if (status) return `${base} (Status: ${status})`;
  return base;
}

function inchesToPrettyFeet(inches: number) {
  const total = Math.max(0, Math.floor(inches));
  const ft = Math.floor(total / 12);
  const inch = total % 12;
  return `${ft}'${inch}"`;
}

function Pill({ text, theme }: { text: string; theme: any }) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <Text
        style={{ fontSize: 10, fontWeight: '900', color: theme.colors.text }}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  );
}

function AgeHeightBadge({
  age,
  heightIn,
  theme,
}: {
  age: number | null;
  heightIn: number | null;
  theme: any;
}) {
  const a = age != null ? String(age) : '';
  const h = heightIn != null ? inchesToPrettyFeet(heightIn) : '';
  if (!a && !h) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8 as any,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: theme.colors.surface2,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '900', color: theme.colors.mutedText }}>
        <Text style={{ color: theme.colors.text }}>Age:</Text> {a || '—'}
      </Text>
      <View style={{ width: 1, height: 14, backgroundColor: theme.colors.border, opacity: 0.9 }} />
      <Text style={{ fontSize: 11, fontWeight: '900', color: theme.colors.mutedText }}>
        <Text style={{ color: theme.colors.text }}>Ht:</Text> {h || '—'}
      </Text>
    </View>
  );
}

export type ProfileThinTileProps = {
  item: ThinProfileCard;
  onPress: () => void;

  theme: any;
  cardW: number;

  // Favorite button: if omitted, no heart shown.
  isFavorited?: boolean;
  favBusy?: boolean;
  onToggleFavorite?: () => void;

  // Optional: when true, show chevron on right (default true)
  showChevron?: boolean;
};

function ProfileThinTileImpl({
  item,
  onPress,
  theme,
  cardW,
  isFavorited,
  favBusy = false,
  onToggleFavorite,
  showChevron = true,
}: ProfileThinTileProps) {
  const photo = item.profile_photo_url ? String(item.profile_photo_url) : '';
  const name = item.full_name ? String(item.full_name) : 'Member';
  const age = item.age != null ? Number(item.age) : null;
  const heightIn = item.height_inches != null ? Number(item.height_inches) : null;

  const prof = cleanText(item.profession);
  const loc = prettyLocationWithStatus(item);

  const kovil = cleanText(item.kovil);
  const pirivu = cleanText((item as any)?.pirivu);
  const nativePlace = cleanText(item.native_place);

  const showHeart = typeof onToggleFavorite === 'function';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.92}
      style={[
        {
          width: cardW,
          alignSelf: 'center',
          borderRadius: 22,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface2,
          overflow: 'hidden',
          marginBottom: 14,
        },
        Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 10 },
          },
          android: { elevation: 3 },
          web: { boxShadow: '0px 10px 24px rgba(0,0,0,0.08)' } as any,
        }),
      ]}
    >
      <View style={{ flexDirection: 'row', padding: 14, gap: 12 as any }}>
        {/* photo */}
        <View
          style={{
            width: 92,
            height: 92,
            borderRadius: 18,
            overflow: 'hidden',
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          {photo ? (
            <Image
              source={{ uri: photo }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="person-circle-outline" size={56} color={theme.colors.border} />
            </View>
          )}
        </View>

        {/* body */}
        <View style={{ flex: 1, minWidth: 0 }}>
          {/* Top row: name + right stack (badge + heart) */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 10 as any,
            }}
          >
            <Text
              style={{ fontSize: 16, fontWeight: '900', color: theme.colors.text, flex: 1 }}
              numberOfLines={1}
            >
              {name}
            </Text>

            <View style={{ alignItems: 'center', gap: 8 as any }}>
              <AgeHeightBadge age={age} heightIn={heightIn} theme={theme} /> 
            </View>
          </View>

          {/* Profession */}
          {prof ? (
            <Text
              style={{ marginTop: 6, fontSize: 12, fontWeight: '800', color: theme.colors.mutedText }}
              numberOfLines={1}
            >
              {prof}
            </Text>
          ) : null}

          {/* Location + status */}
          {loc ? (
            <Text
              style={{
                marginTop: 8,
                fontSize: 11,
                fontWeight: '800',
                color: theme.colors.mutedText,
                opacity: 0.92,
              }}
              numberOfLines={2}
            >
              <Ionicons name="location-outline" size={12} /> {loc}
            </Text>
          ) : null}

          {/* Pills row */}
          <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 as any }}>
            {kovil ? <Pill theme={theme} text={`Kovil: ${kovil}`} /> : null}
            {pirivu ? <Pill theme={theme} text={`Pirivu: ${pirivu}`} /> : null}
            {nativePlace ? <Pill theme={theme} text={`Native: ${nativePlace}`} /> : null}

             {/* ✅ Heart moved down here so it never pushes name/profession/location */}
            {showHeart ? (
              <TouchableOpacity
                onPress={(e: any) => {
                  if (e?.stopPropagation) e.stopPropagation();
                  onToggleFavorite?.();
                }}
                disabled={favBusy}
                activeOpacity={0.85}
                style={{
                  height: 28,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 6 as any,
                }}
                accessibilityRole="button"
                accessibilityLabel={isFavorited ? 'Remove favorite' : 'Add favorite'}
              >
                {favBusy ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Ionicons
                    name={isFavorited ? 'heart' : 'heart-outline'}
                    size={16}
                    color={isFavorited ? (theme.colors.danger ?? theme.colors.primary) : theme.colors.mutedText}
                  />
                )}
                <Text style={{ fontSize: 10, fontWeight: '900', color: theme.colors.text }}>
                  {isFavorited ? 'Saved' : 'Save'}
                </Text>
              </TouchableOpacity>
            ) : null}

          </View>
        </View>

        {/* Right affordance */}
        {showChevron ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingLeft: 4 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="chevron-forward" size={16} color={theme.colors.mutedText} />
            </View>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export const ProfileThinTile = memo(ProfileThinTileImpl);