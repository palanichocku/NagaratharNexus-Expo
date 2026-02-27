import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MaintenanceOverlay() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="construct-outline" size={80} color="#007AFF" />
        <Text style={styles.title}>We'll be back shortly</Text>
        <Text style={styles.subtitle}>
          Nagarathar Nexus is currently undergoing scheduled maintenance to improve your experience.
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>SYSTEM UPDATING</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  content: { alignItems: 'center', padding: 40 },
  title: { fontSize: 28, fontWeight: '800', marginTop: 20, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#8E8E93', textAlign: 'center', marginTop: 15, lineHeight: 24 },
  badge: { backgroundColor: '#F2F2F7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginTop: 30 },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#007AFF' }
});