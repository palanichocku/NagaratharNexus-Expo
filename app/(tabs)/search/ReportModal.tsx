import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Platform,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createPortal } from 'react-dom';
import { supabase } from '../../../src/lib/supabase';
import { USER_FLAG_REASONS } from '../../../src/constants/appData';
import { useDialog } from '@/src/ui/feedback/useDialog';
import { useToastContext } from '@/src/ui/feedback/ToastProvider';

interface ReportModalProps {
  visible: boolean;
  targetUserId: string;
  onClose: () => void;
}

type NoticeState =
  | null
  | {
      title: string;
      message: string;
      tone: 'success' | 'info';
    };

export default function ReportModal({ visible, targetUserId, onClose }: ReportModalProps) {
  const [targetName, setTargetName] = useState('User');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const dialog = useDialog();
  const toast = useToastContext();

  useEffect(() => {
    let alive = true;

    async function fetchTargetName() {
      if (!visible || !targetUserId) return;

      setLoading(true);
      setNotice(null);

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', targetUserId)
          .maybeSingle();

        if (error) throw error;
        if (alive) setTargetName(data?.full_name || 'User');
      } catch (error) {
        console.warn('Failed to load report target name', error);
        if (alive) setTargetName('User');
      } finally {
        if (alive) setLoading(false);
      }
    }

    void fetchTargetName();

    return () => {
      alive = false;
    };
  }, [visible, targetUserId]);

  const handleClose = () => {
    setNotice(null);
    onClose();
  };

  const handleConfirmReport = async (reason: string) => {
    if (submitting) return;

    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        target_id: targetUserId,
        reason,
        status: 'PENDING',
      });

      if (error) throw error;

      setNotice({
        title: 'Report submitted',
        message:
          'Thank you. Your report has been submitted successfully. Our moderators will review this profile and take appropriate action.',
        tone: 'success',
      });
    } catch (error: any) {
      console.error('Report failed:', error?.message || error);

      if (error?.code === '23505' || error?.status === 409) {
        setNotice({
          title: 'Already reported',
          message:
            'You have already reported this profile. Our moderators will review it.',
          tone: 'info',
        });
        return;
      }

      dialog.show({
        title: 'Error',
        message: "We couldn't submit your report. Please try again later.",
        tone: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  const content = (
    <View style={styles.overlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={!submitting ? handleClose : undefined}
      />
      <View style={styles.modalCard}>
        {notice ? (
          <>
            <View style={styles.noticeIconWrap}>
              <Ionicons
                name={notice.tone === 'success' ? 'checkmark-circle' : 'information-circle'}
                size={42}
                color={notice.tone === 'success' ? '#16A34A' : '#2563EB'}
              />
            </View>

            <Text style={styles.title}>{notice.title}</Text>
            <Text style={[styles.subtitle, { textAlign: 'center', marginBottom: 24 }]}>
              {notice.message}
            </Text>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleClose} activeOpacity={0.88}>
              <Text style={styles.primaryBtnText}>OK</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Report Profile</Text>
              <TouchableOpacity onPress={handleClose} disabled={submitting}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator size="small" color="#111827" style={{ marginVertical: 20 }} />
            ) : (
              <Text style={styles.subtitle}>
                Why are you flagging <Text style={styles.targetHighlight}>{targetName}</Text>?
              </Text>
            )}

            <FlatList
              data={USER_FLAG_REASONS}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.reasonBtn}
                  onPress={() => handleConfirmReport(item.label)}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  <Ionicons name={item.icon as any} size={20} color="#007AFF" />
                  <Text style={styles.reasonText}>{item.label}</Text>
                  {submitting ? (
                    <ActivityIndicator size="small" color="#C7C7CC" />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
                  )}
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} disabled={submitting}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    zIndex: 99999,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: 380,
    maxWidth: '100%',
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  noticeIconWrap: {
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 12,
    marginBottom: 20,
    lineHeight: 20,
  },
  targetHighlight: {
    fontWeight: '800',
    color: '#000',
  },
  reasonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  reasonText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  primaryBtn: {
    marginTop: 4,
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  cancelBtn: {
    marginTop: 15,
    alignItems: 'center',
    padding: 10,
  },
  cancelText: {
    color: '#8E8E93',
    fontWeight: '700',
    fontSize: 14,
  },
});