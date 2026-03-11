import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/src/lib/supabase';
import SlotCard from '@/src/components/moderator-calendar/SlotCard';
import { moderatorCalendarService, type ModeratorSlot } from '@/src/services/moderatorCalendar.service';
import { CANADA_TIMEZONE, toYMDInTimeZone } from '@/src/utils/timezone';

type Role = 'ADMIN' | 'MODERATOR' | 'USER';

export default function ModeratorChatScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<Role>('USER');
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [slots, setSlots] = useState<ModeratorSlot[]>([]);
  const [rescheduleFromSlotId, setRescheduleFromSlotId] = useState<string | null>(null);

  const isModerator = role === 'MODERATOR' || role === 'ADMIN';

  const dayLabel = useMemo(
    () => toYMDInTimeZone(selectedDay, CANADA_TIMEZONE),
    [selectedDay]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData.user;
      if (!authUser) throw new Error('Not signed in');

      setUserId(authUser.id);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authUser.id)
        .single();

      if (profileError) throw profileError;
      setRole((profile?.role ?? 'USER').toUpperCase() as Role);

      const start = new Date(selectedDay);
      start.setHours(0, 0, 0, 0);

      const end = new Date(selectedDay);
      end.setDate(end.getDate() + 1);
      end.setHours(0, 0, 0, 0);

      const data = await moderatorCalendarService.getSlotsForRange(
        start.toISOString(),
        end.toISOString()
      );

      setSlots(data);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to load slots');
    } finally {
      setLoading(false);
    }
  }, [selectedDay]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsubscribe = moderatorCalendarService.subscribeToSlots(() => {
      load();
    });
    return unsubscribe;
  }, [load]);

  const createDefaultDaySlots = async () => {
    try {
      setSaving(true);
      await moderatorCalendarService.createSlotsForDay(dayLabel, '09:00', '17:00', CANADA_TIMEZONE);
      await load();
    } catch (e: any) {
      Alert.alert('Unable to create slots', e.message ?? 'Please try again');
    } finally {
      setSaving(false);
    }
  };

  const bookSlot = async (slotId: string) => {
    try {
      setSaving(true);

      if (rescheduleFromSlotId) {
        await moderatorCalendarService.reschedule(rescheduleFromSlotId, slotId);
        setRescheduleFromSlotId(null);
        Alert.alert('Rescheduled', 'Your appointment has been moved.');
      } else {
        await moderatorCalendarService.bookSlot(slotId);
        Alert.alert('Booked', 'Your slot has been reserved.');
      }

      await load();
    } catch (e: any) {
      Alert.alert('Unable to save', e.message ?? 'Please try again');
    } finally {
      setSaving(false);
    }
  };

  const cancelSlot = async (slotId: string) => {
    try {
      setSaving(true);
      await moderatorCalendarService.cancelBooking(slotId, 'Cancelled from app');
      setRescheduleFromSlotId(null);
      await load();
      Alert.alert('Cancelled', 'The booking has been cancelled.');
    } catch (e: any) {
      Alert.alert('Unable to cancel', e.message ?? 'Please try again');
    } finally {
      setSaving(false);
    }
  };

  const shiftDay = (delta: number) => {
    const next = new Date(selectedDay);
    next.setDate(next.getDate() + delta);
    setSelectedDay(next);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Chat with Moderator</Text>
            <Text style={styles.subtitle}>
              Canada, IST, and GMT times shown together
            </Text>
          </View>

          {isModerator ? (
            <TouchableOpacity style={styles.createBtn} onPress={createDefaultDaySlots} disabled={saving}>
              <Ionicons name="add-circle-outline" size={18} color="#111827" />
              <Text style={styles.createBtnText}>Add Day Slots</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.dayBar}>
          <TouchableOpacity onPress={() => shiftDay(-1)} style={styles.dayArrow}>
            <Ionicons name="chevron-back" size={18} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.dayText}>{dayLabel}</Text>
          <TouchableOpacity onPress={() => shiftDay(1)} style={styles.dayArrow}>
            <Ionicons name="chevron-forward" size={18} color="#111827" />
          </TouchableOpacity>
        </View>

        {rescheduleFromSlotId ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>Pick a new open slot to complete your reschedule.</Text>
            <TouchableOpacity onPress={() => setRescheduleFromSlotId(null)}>
              <Text style={styles.bannerLink}>Clear</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#111827" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.listContent}>
            {slots.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No slots yet</Text>
                <Text style={styles.emptySub}>
                  {isModerator
                    ? 'Create your availability for this day.'
                    : 'No moderator slots are available for this day yet.'}
                </Text>
              </View>
            ) : (
              slots.map((slot) => {
                const isMine = !!userId && slot.booked_by_user_id === userId;

                return (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    isModerator={isModerator}
                    isMine={isMine}
                    onBook={() => bookSlot(slot.id)}
                    onCancel={() => cancelSlot(slot.id)}
                    onReschedule={() => setRescheduleFromSlotId(slot.id)}
                  />
                );
              })
            )}
          </ScrollView>
        )}

        {saving ? (
          <View style={styles.savingOverlay}>
            <ActivityIndicator size="small" color="#111827" />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFAFA' },
  container: { flex: 1, padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  createBtnText: { fontWeight: '700', color: '#111827' },
  dayBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  dayArrow: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    padding: 8,
  },
  dayText: { fontSize: 16, fontWeight: '700', color: '#111827' },
  banner: {
    marginBottom: 12,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerText: { color: '#92400E', fontWeight: '600', flex: 1, marginRight: 10 },
  bannerLink: { color: '#92400E', fontWeight: '800' },
  listContent: { paddingBottom: 40 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  emptySub: { marginTop: 6, color: '#6B7280', lineHeight: 20 },
  savingOverlay: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});