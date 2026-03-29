import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/src/lib/supabase';
import SlotCard from '@/src/components/moderator-calendar/SlotCard';
import {
  moderatorCalendarService,
  type ModeratorSlot,
  type ModeratorDirectoryItem,
  getModeratorSlotDisplayStatus,
} from '@/src/services/moderatorCalendar.service';
import { CANADA_TIMEZONE, toYMDInTimeZone } from '@/src/utils/timezone';
import { useFocusEffect } from '@react-navigation/native';
import { useDialog } from '@/src/ui/feedback/useDialog';
import { useToast } from '@/src/ui/feedback/useToast';

type Role = 'ADMIN' | 'MODERATOR' | 'USER';

const MAX_DAYS_AHEAD = 28;

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isBeforeDay(a: Date, b: Date) {
  return startOfDay(a).getTime() < startOfDay(b).getTime();
}

function isAfterDay(a: Date, b: Date) {
  return startOfDay(a).getTime() > startOfDay(b).getTime();
}

function sanitizePhoneForWhatsApp(phone?: string | null) {
  if (!phone) return '';
  return phone.replace(/[^\d]/g, '');
}

function buildModeratorReadyMessage(memberName?: string | null, moderatorName?: string | null) {
  const safeMemberName = memberName?.trim() || 'Member';
  const safeModeratorName = moderatorName?.trim() || 'the moderator';

  return `Hello ${safeMemberName}, this is ${safeModeratorName} from Nagarathar Nexus. I’m ready for our scheduled meeting now. Please reply here when you are ready to begin.`;
}

export default function ModeratorChatScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<Role>('USER');
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [slots, setSlots] = useState<ModeratorSlot[]>([]);
  const [rescheduleFromSlotId, setRescheduleFromSlotId] = useState<string | null>(null);
  const [moderators, setModerators] = useState<ModeratorDirectoryItem[]>([]);
  const [selectedModeratorId, setSelectedModeratorId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('');

  const dialog = useDialog();
  const toast = useToast();

  const today = useMemo(() => startOfDay(new Date()), []);
  const maxDay = useMemo(() => startOfDay(addDays(new Date(), MAX_DAYS_AHEAD)), []);

  const isModerator = role === 'MODERATOR';
  const isAdmin = role === 'ADMIN';
  const canCreateSlots = isModerator;

  const dayLabel = useMemo(
    () => toYMDInTimeZone(selectedDay, CANADA_TIMEZONE),
    [selectedDay]
  );

  const selectedModerator = useMemo(
    () => moderators.find((m) => m.id === selectedModeratorId) ?? null,
    [moderators, selectedModeratorId]
  );

  const canGoPrev = useMemo(
    () => !isBeforeDay(addDays(selectedDay, -1), today),
    [selectedDay, today]
  );

  const canGoNext = useMemo(
    () => !isAfterDay(addDays(selectedDay, 1), maxDay),
    [selectedDay, maxDay]
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
        .select('role, full_name')
        .eq('id', authUser.id)
        .single();

      if (profileError) throw profileError;

      setCurrentUserName(profile?.full_name ?? '');

      const nextRole = (profile?.role ?? 'USER').toUpperCase() as Role;
      setRole(nextRole);

      const start = new Date(selectedDay);
      start.setHours(0, 0, 0, 0);

      const end = new Date(selectedDay);
      end.setDate(end.getDate() + 1);
      end.setHours(0, 0, 0, 0);

      if (nextRole === 'MODERATOR' || nextRole === 'ADMIN') {
        const data = await moderatorCalendarService.getMyModeratorSlotsForRange(
          start.toISOString(),
          end.toISOString()
        );
        setSlots(data);
        setSelectedModeratorId(authUser.id);
        return;
      }

      const moderatorList = await moderatorCalendarService.getActiveModerators();
      setModerators(moderatorList);

      const effectiveModeratorId =
        selectedModeratorId && moderatorList.some((m) => m.id === selectedModeratorId)
          ? selectedModeratorId
          : moderatorList[0]?.id ?? null;

      setSelectedModeratorId(effectiveModeratorId);

      if (!effectiveModeratorId) {
        setSlots([]);
        return;
      }

      const data = await moderatorCalendarService.getSlotsForModeratorRange(
        effectiveModeratorId,
        start.toISOString(),
        end.toISOString()
      );

      setSlots(data);
    } catch (e: any) {
      dialog.show({
        title: 'Error',
        message: e.message ?? 'Failed to load slots',
        tone: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [dialog, selectedDay, selectedModeratorId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsubscribe = moderatorCalendarService.subscribeToSlots(() => {
      load();
    });
    return unsubscribe;
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      setSelectedDay(startOfDay(new Date()));
      setRescheduleFromSlotId(null);
    }, [])
  );

  const createDefaultDaySlots = async () => {
    try {
      if (isBeforeDay(selectedDay, today)) {
        dialog.show({
          title: 'Invalid day',
          message: 'You can only open slots from today onward.',
        });
        return;
      }

      if (isAfterDay(selectedDay, maxDay)) {
        dialog.show({
          title: 'Invalid day',
          message: 'You can only open slots up to 4 weeks ahead.',
        });
        return;
      }

      setSaving(true);
      await moderatorCalendarService.createSlotsForDay(
        dayLabel,
        '09:00',
        '17:00',
        CANADA_TIMEZONE
      );
      await load();
      toast.show('Day slots created', 'success');
    } catch (e: any) {
      dialog.show({
        title: 'Unable to create slots',
        message: e.message ?? 'Please try again',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const clearPastOpenSlots = async () => {
    try {
      setSaving(true);
      const deleted = await moderatorCalendarService.clearPastOpenSlots();
      await load();
      toast.show(
        deleted > 0
          ? `Cleared ${deleted} past open slot${deleted === 1 ? '' : 's'}`
          : 'No past open slots to clear',
        'success'
      );
    } catch (e: any) {
      dialog.show({
        title: 'Unable to clear past open slots',
        message: e.message ?? 'Please try again',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const bookSlot = async (slot: ModeratorSlot) => {
    try {
      const displayStatus = getModeratorSlotDisplayStatus(slot);

      if (displayStatus === 'EXPIRED') {
        dialog.show({
          title: 'Slot expired',
          message: 'This slot is no longer available.',
        });
        return;
      }

      setSaving(true);

      if (rescheduleFromSlotId) {
        await moderatorCalendarService.reschedule(rescheduleFromSlotId, slot.id);
        setRescheduleFromSlotId(null);
        dialog.show({
          title: 'Rescheduled',
          message: 'Your appointment has been moved.',
        });
      } else {
        await moderatorCalendarService.bookSlot(slot.id);
        dialog.show({
          title: 'Booked',
          message: 'Your slot has been reserved.',
        });
      }

      await load();
    } catch (e: any) {
      dialog.show({
        title: 'Unable to save',
        message: e.message ?? 'Please try again',
        tone: 'error',
      });
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
      dialog.show({
        title: 'Cancelled',
        message: 'The booking has been cancelled.',
      });
    } catch (e: any) {
      dialog.show({
        title: 'Unable to cancel',
        message: e.message ?? 'Please try again',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteSlot = async (slotId: string) => {
    try {
      setSaving(true);
      await moderatorCalendarService.deleteSlot(slotId);
      await load();
      dialog.show({
        title: 'Deleted',
        message: 'The slot has been removed.',
      });
    } catch (e: any) {
      dialog.show({
        title: 'Unable to delete slot',
        message: e.message ?? 'Please try again',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const openWhatsApp = async (slot: ModeratorSlot) => {
    try {
      const phone = sanitizePhoneForWhatsApp(slot.booked_by_phone);
      if (!phone) {
        dialog.show({
          title: 'No phone number',
          message: 'This member does not have a valid phone number for WhatsApp.',
          tone: 'error',
        });
        return;
      }

      const message = buildModeratorReadyMessage(slot.booked_by_name, currentUserName);
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = url;
        return;
      }

      await Linking.openURL(url);
    } catch (e: any) {
      dialog.show({
        title: 'Unable to open WhatsApp',
        message: e.message ?? 'Please try again',
        tone: 'error',
      });
    }
  };

  const openVideoRoom = async (slot: ModeratorSlot) => {
    try {
      const url = slot.video_room_url?.trim();
      if (!url) {
        dialog.show({
          title: 'No video link',
          message: 'This booking does not have a video link yet.',
          tone: 'error',
        });
        return;
      }

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = url;
        return;
      }

      await Linking.openURL(url);
    } catch (e: any) {
      dialog.show({
        title: 'Unable to open video room',
        message: e.message ?? 'Please try again',
        tone: 'error',
      });
    }
  };

  const copyVideoLink = async (slot: ModeratorSlot) => {
    try {
      const url = slot.video_room_url?.trim();
      if (!url) {
        dialog.show({
          title: 'No video link',
          message: 'This booking does not have a video link yet.',
          tone: 'error',
        });
        return;
      }

      if (
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(url);
      } else {
        await Clipboard.setStringAsync(url);
      }

      toast.show('Video link copied', 'success');
    } catch (e: any) {
      dialog.show({
        title: 'Unable to copy video link',
        message: e.message ?? 'Please try again',
        tone: 'error',
      });
    }
  };

  const shiftDay = (delta: number) => {
    const next = addDays(selectedDay, delta);

    if (isBeforeDay(next, today)) return;
    if (isAfterDay(next, maxDay)) return;

    setSelectedDay(next);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Chat with Moderator</Text>
            <Text style={styles.subtitle}>
              Canada, IST, and GMT times shown together
            </Text>
          </View>
        </View>

        {canCreateSlots ? (
          <View style={styles.createActionsRow}>
            <TouchableOpacity
              style={styles.createBtn}
              onPress={createDefaultDaySlots}
              disabled={saving}
            >
              <Ionicons name="add-circle-outline" size={18} color="#111827" />
              <Text style={styles.createBtnText}>Add Day Slots</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.clearPastBtn}
              onPress={clearPastOpenSlots}
              disabled={saving}
            >
              <Ionicons name="time-outline" size={18} color="#9A3412" />
              <Text style={styles.clearPastBtnText}>Clear Past Open Slots</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {(role === 'USER' || isAdmin) ? (
          <View style={styles.moderatorSection}>
            <Text style={styles.sectionLabel}>Choose Moderator</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.moderatorPillRow}
            >
              {moderators.map((moderator) => {
                const active = moderator.id === selectedModeratorId;

                return (
                  <TouchableOpacity
                    key={moderator.id}
                    style={[styles.moderatorPill, active && styles.moderatorPillActive]}
                    onPress={() => {
                      setSelectedModeratorId(moderator.id);
                      setRescheduleFromSlotId(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.moderatorPillText,
                        active && styles.moderatorPillTextActive,
                      ]}
                    >
                      {moderator.full_name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.helperText}>
              {selectedModerator
                ? `Showing ${selectedModerator.full_name}'s calendar`
                : 'No moderators available right now'}
            </Text>
          </View>
        ) : null}

        <View style={styles.dayBar}>
          <TouchableOpacity
            onPress={() => shiftDay(-1)}
            style={[styles.dayArrow, !canGoPrev && styles.dayArrowDisabled]}
            disabled={!canGoPrev}
          >
            <Ionicons
              name="chevron-back"
              size={18}
              color={canGoPrev ? '#111827' : '#9CA3AF'}
            />
          </TouchableOpacity>

          <View style={styles.dayTextWrap}>
            <Text style={styles.dayText}>{dayLabel}</Text>
            <Text style={styles.dayHint}>Available from today through 4 weeks ahead</Text>
          </View>

          <TouchableOpacity
            onPress={() => shiftDay(1)}
            style={[styles.dayArrow, !canGoNext && styles.dayArrowDisabled]}
            disabled={!canGoNext}
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color={canGoNext ? '#111827' : '#9CA3AF'}
            />
          </TouchableOpacity>
        </View>

        {rescheduleFromSlotId ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Pick a new open slot to complete your reschedule.
            </Text>
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
                    isAdmin={isAdmin}
                    isMine={isMine}
                    moderatorName={currentUserName}
                    onBook={() => bookSlot(slot)}
                    onCancel={() => cancelSlot(slot.id)}
                    onReschedule={() => setRescheduleFromSlotId(slot.id)}
                    onDelete={() => deleteSlot(slot.id)}
                    onWhatsApp={openWhatsApp}
                    onJoinVideo={openVideoRoom}
                    onCopyVideoLink={copyVideoLink}
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
  headerCopy: {
    flex: 1,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 4 },

  createActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
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

  clearPastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  clearPastBtnText: {
    fontWeight: '700',
    color: '#9A3412',
  },

  moderatorSection: {
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 8,
  },
  moderatorPillRow: {
    gap: 8,
    paddingRight: 10,
  },
  moderatorPill: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  moderatorPillActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  moderatorPillText: {
    color: '#111827',
    fontWeight: '700',
  },
  moderatorPillTextActive: {
    color: '#FFF',
  },
  helperText: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 13,
  },

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
  dayArrowDisabled: {
    opacity: 0.5,
  },
  dayTextWrap: {
    alignItems: 'center',
  },
  dayText: { fontSize: 16, fontWeight: '700', color: '#111827' },
  dayHint: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
  },

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