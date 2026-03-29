import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  type ModeratorSlot,
  getModeratorSlotDisplayStatus,
} from '@/src/services/moderatorCalendar.service';
import { slotLabelTriple } from '@/src/utils/timezone';

type Props = {
  slot: ModeratorSlot;
  isModerator: boolean;
  isAdmin?: boolean;
  isMine: boolean;
  moderatorName?: string;
  onBook?: () => void;
  onCancel?: () => void;
  onReschedule?: () => void;
  onDelete?: () => void;
  onWhatsApp?: (slot: ModeratorSlot) => void;
  onJoinVideo?: (slot: ModeratorSlot) => void;
  onCopyVideoLink?: (slot: ModeratorSlot) => void;
};

export default function SlotCard({
  slot,
  isModerator,
  isAdmin = false,
  isMine,
  moderatorName,
  onBook,
  onCancel,
  onReschedule,
  onDelete,
  onWhatsApp,
  onJoinVideo,
  onCopyVideoLink,
}: Props) {
  const labels = useMemo(
    () => slotLabelTriple(slot.slot_start_utc, slot.slot_end_utc),
    [slot.slot_start_utc, slot.slot_end_utc]
  );

  const displayStatus = useMemo(
    () => getModeratorSlotDisplayStatus(slot),
    [slot]
  );

  const statusTone =
    displayStatus === 'OPEN'
      ? styles.open
      : displayStatus === 'BOOKED'
      ? styles.booked
      : displayStatus === 'EXPIRED'
      ? styles.expired
      : styles.blocked;

  const showBookedDetails =
    (isModerator || isAdmin) && displayStatus === 'BOOKED';

  const showWhatsAppAction =
    (isModerator || isAdmin) &&
    displayStatus === 'BOOKED' &&
    !!slot.booked_by_phone;

  const showVideoActions =
    displayStatus === 'BOOKED' &&
    !!slot.video_room_url &&
    (isModerator || isAdmin || isMine);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.timePrimary}>{labels.canada}</Text>

        <View style={styles.headerActions}>
          {isModerator && displayStatus === 'BOOKED' ? (
            <TouchableOpacity style={styles.headerActionPill} onPress={onCancel}>
              <Text style={styles.headerActionPillText}>Cancel</Text>
            </TouchableOpacity>
          ) : null}

          <View style={[styles.pill, statusTone]}>
            <Text style={styles.pillText}>{displayStatus}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.timeSecondary}>IST: {labels.ist}</Text>
      <Text style={styles.timeSecondary}>GMT: {labels.gmt}</Text>

      <View style={styles.actionsRow}>
        {displayStatus === 'OPEN' && !isModerator ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={onBook}>
            <Text style={styles.primaryBtnText}>Book</Text>
          </TouchableOpacity>
        ) : null}

        {displayStatus === 'OPEN' && isModerator ? (
          <TouchableOpacity style={styles.dangerBtn} onPress={onDelete}>
            <Text style={styles.dangerBtnText}>Delete Slot</Text>
          </TouchableOpacity>
        ) : null}

        {displayStatus === 'BOOKED' && isMine ? (
          <>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onReschedule}>
              <Text style={styles.secondaryBtnText}>Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onCancel}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>

      {showBookedDetails ? (
        <>
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

            {moderatorName ? (
              <View style={styles.infoPill}>
                <Text style={styles.infoPillText}>Moderator: {moderatorName}</Text>
              </View>
            ) : null}
          </View>

          {(showWhatsAppAction || showVideoActions) ? (
            <View style={styles.contactActionsRow}>
              {showWhatsAppAction ? (
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => onWhatsApp?.(slot)}
                >
                  <Text style={styles.contactBtnText}>WhatsApp</Text>
                </TouchableOpacity>
              ) : null}

              {showVideoActions ? (
                <>
                  <TouchableOpacity
                    style={styles.contactBtn}
                    onPress={() => onJoinVideo?.(slot)}
                  >
                    <Text style={styles.contactBtnText}>
                      {isModerator || isAdmin ? 'Start Video' : 'Join Video'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.contactBtn}
                    onPress={() => onCopyVideoLink?.(slot)}
                  >
                    <Text style={styles.contactBtnText}>Copy Video Link</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}

      {!showBookedDetails && showVideoActions ? (
        <View style={styles.contactActionsRow}>
          <TouchableOpacity
            style={styles.contactBtn}
            onPress={() => onJoinVideo?.(slot)}
          >
            <Text style={styles.contactBtnText}>
              {isModerator || isAdmin ? 'Start Video' : 'Join Video'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactBtn}
            onPress={() => onCopyVideoLink?.(slot)}
          >
            <Text style={styles.contactBtnText}>Copy Video Link</Text>
          </TouchableOpacity>
        </View>
      ) : null}
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
  expired: { backgroundColor: '#FEF2F2' },
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
  contactActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  contactBtn: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  contactBtnText: {
    color: '#166534',
    fontWeight: '800',
    fontSize: 13,
  },
});