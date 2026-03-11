import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ModeratorSlot } from '@/src/services/moderatorCalendar.service';
import { slotLabelTriple } from '@/src/utils/timezone';

type Props = {
  slot: ModeratorSlot;
  isModerator: boolean;
  isMine: boolean;
  onBook?: () => void;
  onCancel?: () => void;
  onReschedule?: () => void;
  onDelete?: () => void;
};

export default function SlotCard({
  slot,
  isModerator,
  isMine,
  onBook,
  onCancel,
  onReschedule,
  onDelete,
}: Props) {
  const labels = useMemo(
    () => slotLabelTriple(slot.slot_start_utc, slot.slot_end_utc),
    [slot.slot_start_utc, slot.slot_end_utc]
  );

  const statusTone =
    slot.status === 'OPEN'
      ? styles.open
      : slot.status === 'BOOKED'
      ? styles.booked
      : styles.blocked;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.timePrimary}>{labels.canada}</Text>

        <View style={styles.headerActions}>
          {isModerator && slot.status === 'BOOKED' ? (
            <TouchableOpacity style={styles.headerActionPill} onPress={onCancel}>
              <Text style={styles.headerActionPillText}>Cancel</Text>
            </TouchableOpacity>
          ) : null}

          <View style={[styles.pill, statusTone]}>
            <Text style={styles.pillText}>{slot.status}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.timeSecondary}>IST: {labels.ist}</Text>
      <Text style={styles.timeSecondary}>GMT: {labels.gmt}</Text>

      <View style={styles.actionsRow}>
        {slot.status === 'OPEN' && !isModerator ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={onBook}>
            <Text style={styles.primaryBtnText}>Book</Text>
          </TouchableOpacity>
          
        ) : null}

        {slot.status === 'OPEN' && isModerator ? (
          <TouchableOpacity style={styles.dangerBtn} onPress={onDelete}>
            <Text style={styles.dangerBtnText}>Delete Slot</Text>
          </TouchableOpacity>
        ) : null}

        {slot.status === 'BOOKED' && isMine ? (
          <>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onReschedule}>
              <Text style={styles.secondaryBtnText}>Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onCancel}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : null}

       {isModerator && slot.status === 'BOOKED' && (
          <View style={styles.bookerPillRow}>
            <View style={styles.infoPill}>
              <Text style={styles.infoPillText}>Name: {slot.booked_by_name || '—'}</Text>
            </View>

            <View style={styles.infoPill}>
              <Text style={styles.infoPillText}>Email: {slot.booked_by_email || '—'}</Text>
            </View>

            <View style={styles.infoPill}>
              <Text style={styles.infoPillText}>Phone: {slot.booked_by_phone || '—'}</Text>
            </View>
          </View>
        )}

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  timePrimary: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  timeSecondary: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B7280',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  open: { backgroundColor: '#ECFDF5' },
  booked: { backgroundColor: '#EFF6FF' },
  blocked: { backgroundColor: '#F3F4F6' },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  primaryBtn: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryBtnText: {
    color: '#FFF',
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryBtnText: {
    color: '#111827',
    fontWeight: '700',
  },
    dangerBtn: {
    backgroundColor: '#FFF1F2',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#FBCFE8',
  },
  dangerBtnText: {
    color: '#BE123C',
    fontWeight: '700',
  },
    bookedInfoBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bookedInfoTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  bookedInfoLine: {
    fontSize: 13,
    color: '#374151',
    marginTop: 2,
  },
  headerActions: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  marginLeft: 12,
},

headerActionPill: {
  backgroundColor: '#FFF7ED',
  borderWidth: 1,
  borderColor: '#FDBA74',
  borderRadius: 999,
  paddingHorizontal: 10,
  paddingVertical: 6,
},

headerActionPillText: {
  color: '#9A3412',
  fontSize: 12,
  fontWeight: '800',
},

bookerPillRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 10,
},

infoPill: {
  backgroundColor: '#F9FAFB',
  borderWidth: 1,
  borderColor: '#E5E7EB',
  borderRadius: 999,
  paddingHorizontal: 10,
  paddingVertical: 7,
  maxWidth: '100%',
},

infoPillText: {
  color: '#374151',
  fontSize: 12,
  fontWeight: '700',
  flexShrink: 1,
},
});