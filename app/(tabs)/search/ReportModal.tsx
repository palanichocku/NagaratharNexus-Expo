// ./app/(tabs)/search/ReportModal.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/lib/supabase';
import { USER_FLAG_REASONS } from '../../../src/constants/appData';

interface ReportModalProps {
  visible: boolean;
  targetUserId: string;
  onClose: () => void;
}

export default function ReportModal({ visible, targetUserId, onClose }: ReportModalProps) {
  const [targetName, setTargetName] = useState('User');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 🔄 Fetch the target user's name when the modal opens
  useEffect(() => {
    if (visible && targetUserId) {
      const fetchTargetName = async () => {
        setLoading(true);
        const { data } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', targetUserId)
          .single();
        if (data) setTargetName(data.full_name);
        setLoading(false);
      };
      fetchTargetName();
    }
  }, [visible, targetUserId]);

  /**
   * 🚩 SUBMIT REPORT TO SUPABASE
   * Creates a row in the 'reports' table.
   */
  const handleConfirmReport = async (reason: string) => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('reports')
        .insert({
          reporter_id: user.id,
          target_id: targetUserId,
          reason: reason,
          status: 'PENDING'
        });

      if (error) throw error;

      Alert.alert("Report Received", "Thank you. Our moderators will review this profile within 24 hours.");
      onClose();
    } catch (error: any) {
      console.error("Report failed:", error.message);
      Alert.alert("Error", "We couldn't submit your report. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* 🏁 HEADER */}
          <View style={styles.header}>
            <Text style={styles.title}>Report Profile</Text>
            <TouchableOpacity onPress={onClose} disabled={submitting}>
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
            scrollEnabled={false} // List is short enough for the card
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.reasonBtn} 
                onPress={() => handleConfirmReport(item.label)}
                disabled={submitting}
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

          <TouchableOpacity 
            style={styles.cancelBtn} 
            onPress={onClose} 
            disabled={submitting}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.4)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalCard: { 
    width: 380, 
    backgroundColor: '#FFF', 
    borderRadius: 24, 
    padding: 24, 
    shadowOpacity: 0.15, 
    shadowRadius: 20, 
    elevation: 10 
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  title: { fontSize: 20, fontWeight: '900', color: '#1C1C1E' },
  subtitle: { fontSize: 14, color: '#8E8E93', marginBottom: 20, lineHeight: 20 },
  targetHighlight: { fontWeight: '800', color: '#000' },
  reasonBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 14, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F2F2F7' 
  },
  reasonText: { 
    flex: 1, 
    marginLeft: 12, 
    fontSize: 15, 
    fontWeight: '600', 
    color: '#1C1C1E' 
  },
  cancelBtn: { marginTop: 15, alignItems: 'center', padding: 10 },
  cancelText: { color: '#8E8E93', fontWeight: '700', fontSize: 14 }
});