import { supabase } from '@/src/lib/supabase';

export type ModeratorSlotStatus = 'OPEN' | 'BOOKED' | 'BLOCKED' | 'CANCELLED';

export type ModeratorSlot = {
  id: string;
  moderator_user_id: string;
  booked_by_user_id: string | null;
  slot_start_utc: string;
  slot_end_utc: string;
  source_timezone: string;
  status: ModeratorSlotStatus;
  booking_note: string | null;
  cancellation_reason: string | null;
  booked_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;

  booked_by_name?: string | null;
  booked_by_email?: string | null;
  booked_by_phone?: string | null;
};

export const moderatorCalendarService = {
  async getSlotsForRange(startIso: string, endIso: string) {
    const { data, error } = await supabase
      .from('moderator_slots')
      .select('*')
      .gte('slot_start_utc', startIso)
      .lt('slot_start_utc', endIso)
      .order('slot_start_utc', { ascending: true });

    if (error) throw error;
    return (data ?? []) as ModeratorSlot[];
  },

  async createSlotsForDay(day: string, startTime: string, endTime: string, timeZone = 'America/Toronto') {
    const { data, error } = await supabase.rpc('create_moderator_slots', {
      p_day: day,
      p_start_time: startTime,
      p_end_time: endTime,
      p_timezone: timeZone,
    });

    console.log('create_moderator_slots data:', data);
    console.log('create_moderator_slots error:', error);

    if (error) throw error;
    return data as ModeratorSlot[];
  },

  async bookSlot(slotId: string, bookingNote?: string) {
    const { data, error } = await supabase.rpc('book_moderator_slot', {
      p_slot_id: slotId,
      p_booking_note: bookingNote ?? null,
    });

    if (error) throw error;
    return data as ModeratorSlot;
  },

  async cancelBooking(slotId: string, reason?: string) {
    const { data, error } = await supabase.rpc('cancel_moderator_slot_booking', {
      p_slot_id: slotId,
      p_reason: reason ?? null,
    });

    if (error) throw error;
    return data as ModeratorSlot;
  },

  async reschedule(oldSlotId: string, newSlotId: string, bookingNote?: string) {
    const { data, error } = await supabase.rpc('reschedule_moderator_slot', {
      p_old_slot_id: oldSlotId,
      p_new_slot_id: newSlotId,
      p_booking_note: bookingNote ?? null,
    });

    if (error) throw error;
    return data;
  },

  subscribeToSlots(onChange: () => void) {
    const channel = supabase
      .channel('moderator-slots-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'moderator_slots' },
        onChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

    async deleteSlot(slotId: string) {
    const { data, error } = await supabase.rpc('delete_moderator_slot', {
      p_slot_id: slotId,
    });

    if (error) throw error;
    return data as string;
  },

  async clearOpenSlotsForDay(day: string, timeZone = 'America/Toronto') {
    const { data, error } = await supabase.rpc('clear_open_moderator_slots_for_day', {
      p_day: day,
      p_timezone: timeZone,
    });

    if (error) throw error;
    return data as number;
  },
    async getSlotsForRangeWithBookingDetails(startIso: string, endIso: string) {
    const { data, error } = await supabase.rpc('get_moderator_slots_with_booking_details', {
      p_start_utc: startIso,
      p_end_utc: endIso,
    });

    if (error) throw error;
    return (data ?? []) as Array<ModeratorSlot & {
      booked_by_name?: string | null;
      booked_by_email?: string | null;
      booked_by_phone?: string | null;
    }>;
  },
};