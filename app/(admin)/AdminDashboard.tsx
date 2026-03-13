// ./app/(admin)/AdminDashboard.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { supabase } from '../../src/lib/supabase';
import { adminService } from '../../src/services/admin.service';
import { SearchCursor } from '../../src/services/search.service';
import { ProfileDisplay } from '../../src/components/ProfileDisplay';
import AnalyticsScreen from './Analytics';
import AuditLogScreen from './AuditLog';
import UserManagementScreen from './UserManagement';
import { useSignOut } from '@/src/features/auth/useSignOut';
import SignOutButton from '@/src/components/SignOutButton';

import { useAppTheme } from '../../src/theme/ThemeProvider';
import SearchExperience from '@/src/features/search/SearchExperience';
import SlotCard from '@/src/components/moderator-calendar/SlotCard';
import {
  moderatorCalendarService,
  type ModeratorSlot,
} from '@/src/services/moderatorCalendar.service';
import {
  CANADA_TIMEZONE,
  toYMDInTimeZone,
} from '@/src/utils/timezone';
import { notify } from '@/src/utils/notify';
import { useDialog } from '@/src/ui/feedback/useDialog';

const FS: any = FileSystem;
const PAGE_SIZE = 20;
type AdminTab = 'ADMIN' | 'SEARCH' | 'CALENDAR' | 'SETTINGS';
const TIME_OPTIONS = [
  '06:00', '06:30',
  '07:00', '07:30',
  '08:00', '08:30',
  '09:00', '09:30',
  '10:00', '10:30',
  '11:00', '11:30',
  '12:00', '12:30',
  '13:00', '13:30',
  '14:00', '14:30',
  '15:00', '15:30',
  '16:00', '16:30',
  '17:00', '17:30',
  '18:00', '18:30',
  '19:00', '19:30',
  '20:00', '20:30',
  '21:00', '21:30',
  '22:00', '22:30',
];

export default function AdminDashboard() {
  const { theme, themeName, setThemeName, availableThemes } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const isWeb = Platform.OS === 'web';
  const hasInitialized = useRef(false);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('ADMIN');
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  // --- ROLE & IDENTITY ---
  const [userRole, setUserRole] = useState<string>('MODERATOR');
  const [adminName, setAdminName] = useState('');
  const isSysAdmin = useMemo(() => userRole === 'ADMIN', [userRole]);

  // --- SEARCH STATE (KEYSET) ---
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [searchPage, setSearchPage] = useState(0);
  const [searchDuration, setSearchDuration] = useState('0');

  const [searchFilters, setSearchFilters] = useState({
    minAge: 18,
    maxAge: 60,
    minHeight: 48,
    maxHeight: 84,
    query: '',
    countries: [],
    kovils: [],
    pirivus: [],
    education: [],
    interests: [],
    maritalStatus: [],
  });

  // ✅ keyset cursor stack (page -> cursor used to fetch that page)
  const [cursorStack, setCursorStack] = useState<(SearchCursor | null)[]>([null]);
  const [hasNextPage, setHasNextPage] = useState(false);

  // --- ENGINE STATE ---
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [processLabel, setProcessLabel] = useState('');
  const [testUserCount, setTestUserCount] = useState('100');

  // --- DATA STATE ---
  const [stats, setStats] = useState({ totalUsers: 0, pendingApprovals: 0, activeConversations: 0 });
  const [queue, setQueue] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [announcement, setAnnouncement] = useState({ title: '', body: '' });
  const [modForm, setModForm] = useState({ fullName: '', phone: '', email: '', role: 'MODERATOR' });
  const [revokeForm, setRevokeForm] = useState({ fullName: '', phone: '', email: '', role: 'USER' });

  const [settings, setSettings] = useState({
    maintenanceMode: false,
    readOnlyMode: false,
    allowRegistration: true,
    requireApproval: true,
    autoPauseThreshold: '3',
    favoritesLimit: '5',
    themeName: 'warm',
  });

  // --- CALENDAR STATE ---
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarSaving, setCalendarSaving] = useState(false);
  const [calendarSlots, setCalendarSlots] = useState<ModeratorSlot[]>([]);
  const [calendarUserId, setCalendarUserId] = useState<string | null>(null);
  const [calendarDay, setCalendarDay] = useState(() => new Date());
  const [rescheduleFromSlotId, setRescheduleFromSlotId] = useState<string | null>(null);
  const [slotStartTime, setSlotStartTime] = useState('09:00');
  const [slotEndTime, setSlotEndTime] = useState('17:00');
  const [timePickerMode, setTimePickerMode] = useState<'START' | 'END' | null>(null);
  const dialog = useDialog();

  const calendarDayLabel = useMemo(
    () => toYMDInTimeZone(calendarDay, CANADA_TIMEZONE),
    [calendarDay]
  );

  const endTimeOptions = useMemo(
    () => TIME_OPTIONS.filter((t) => t > slotStartTime),
    [slotStartTime]
  );

  const isStaff = useMemo(
    () => userRole === 'ADMIN' || userRole === 'MODERATOR',
    [userRole]
  );

  /** Reset keyset pagination state (used on filter change / reset) */
  const resetSearchPaging = useCallback(() => {
    setCursorStack([null]);
    setHasNextPage(false);
    setSearchPage(0);
    setSearchIndex(0);
  }, []);

  /**
   * 🚀 SCHEMA-PROOF IDENTITY FETCH
   * We perform manual lookups to bypass schema join errors (400).
   */
  const fetchAdminProfile = useCallback(async (userId: string) => {
    try {
      const [profRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      ]);

      if (profRes.data) setAdminName(profRes.data.full_name || 'Staff Member');

      if (roleRes.data) {
        setUserRole(roleRes.data.role);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        setUserRole(user?.user_metadata?.role || 'MODERATOR');
      }
    } catch (err) {
      console.error('Manual Identity Fetch Crash:', err);
    }
  }, []);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [pending, safety, analytics, config] = await Promise.all([
        adminService.getPendingProfiles(),
        adminService.getReports(),
        adminService.getAnalytics(),
        adminService.getSystemConfig(),
      ]);
      setQueue(pending || []);
      setReports(safety || []);
      setStats(analytics || { totalUsers: 0, pendingApprovals: 0, activeConversations: 0 });
      if (config) setSettings((prev) => ({ ...prev, ...config }));
      setInitError(null);
    } catch (err: any) {
      console.error('Dashboard Load Error:', err);
      setInitError('Database sync failed. Check RLS policies.');
    } finally {
      setLoading(false);
    }
  }, []);

    const loadCalendar = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('Not signed in');

      setCalendarUserId(user.id);

      const start = new Date(calendarDay);
      start.setHours(0, 0, 0, 0);

      const end = new Date(calendarDay);
      end.setDate(end.getDate() + 1);
      end.setHours(0, 0, 0, 0);

      const data = await moderatorCalendarService.getSlotsForRangeWithBookingDetails(
        start.toISOString(),
        end.toISOString()
      );

      setCalendarSlots(data);
    } catch (e: any) {
      console.error('Calendar load failed:', e);
      if (activeTab === 'CALENDAR') {
        Alert.alert('Error', e.message ?? 'Failed to load calendar');
      }
    } finally {
      setCalendarLoading(false);
    }
  }, [calendarDay, activeTab]);

  useEffect(() => {
    if (activeTab !== 'CALENDAR') return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    setCalendarDay(today);
    setRescheduleFromSlotId(null);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'CALENDAR') return;
    loadCalendar();
  }, [activeTab, loadCalendar]);

  useEffect(() => {
    const unsubscribe = moderatorCalendarService.subscribeToSlots(() => {
      if (activeTab === 'CALENDAR') {
        loadCalendar();
      }

    });

    
    return unsubscribe;
  }, [activeTab, loadCalendar]);

  const createSlotsForSelectedWindow = useCallback(async () => {
    try {
      if (!slotStartTime || !slotEndTime) {
        dialog.show({
          title: 'Missing Time',
          message: 'Please enter both start and end time.',
          tone: 'error',
        });
        return;
      }

      if (slotEndTime <= slotStartTime) {
        dialog.show({
          title: 'Invalid Range',
          message: 'End time must be after start time.',
          tone: 'error',
        });
        return;
      }

      setCalendarSaving(true);

      await moderatorCalendarService.createSlotsForDay(
        calendarDayLabel,
        slotStartTime,
        slotEndTime,
        CANADA_TIMEZONE
      );

      await loadCalendar();
    } catch (e: any) {
      Alert.alert('Unable to create slots', e.message ?? 'Please try again');
    } finally {
      setCalendarSaving(false);
    }
  }, [calendarDayLabel, loadCalendar, slotStartTime, slotEndTime, dialog]);


  const handleDeleteCalendarSlot = useCallback(
    async (slotId: string) => {
      try {
        const ok = isWeb
          ? window.confirm('Delete this open slot?')
          : true;

        if (!ok) return;

        setCalendarSaving(true);
        await moderatorCalendarService.deleteSlot(slotId);
        await loadCalendar();

        if (!isWeb) {
          Alert.alert('Deleted', 'The slot has been removed.');
        }
      } catch (e: any) {
        Alert.alert('Unable to delete slot', e.message ?? 'Please try again');
      } finally {
        setCalendarSaving(false);
      }
    },
    [isWeb, loadCalendar]
  );

  const handleBookCalendarSlot = useCallback(
    async (slotId: string) => {
      try {
        setCalendarSaving(true);

        if (rescheduleFromSlotId) {
          await moderatorCalendarService.reschedule(rescheduleFromSlotId, slotId);
          setRescheduleFromSlotId(null);
          Alert.alert('Rescheduled', 'The booking has been moved.');
        } else {
          await moderatorCalendarService.bookSlot(slotId);
          Alert.alert('Booked', 'The slot has been reserved.');
        }

        await loadCalendar();
      } catch (e: any) {
        Alert.alert('Unable to save', e.message ?? 'Please try again');
      } finally {
        setCalendarSaving(false);
      }
    },
    [loadCalendar, rescheduleFromSlotId]
  );

  const handleCancelCalendarSlot = useCallback(
    async (slotId: string) => {
      try {
        setCalendarSaving(true);
        await moderatorCalendarService.cancelBooking(slotId, 'Cancelled from admin dashboard');
        setRescheduleFromSlotId(null);
        await loadCalendar();
        Alert.alert('Cancelled', 'The booking has been cancelled.');
      } catch (e: any) {
        Alert.alert('Unable to cancel', e.message ?? 'Please try again');
      } finally {
        setCalendarSaving(false);
      }
    },
    [loadCalendar]
  );

  const shiftCalendarDay = useCallback((delta: number) => {
    const next = new Date(calendarDay);
    next.setDate(next.getDate() + delta);
    setCalendarDay(next);
  }, [calendarDay]);

    const renderModeratorCalendar = () => (
      <View style={styles.calendarPage}>
        <View style={styles.calendarHeader}>
          <View>
            <Text style={styles.settingsTitle}>Moderator Calendar</Text>
            <Text style={styles.calendarSubtitle}>
              Toronto, IST, and GMT shown together
            </Text>
          </View>
        </View>

        <View style={styles.calendarDayBar}>
          <TouchableOpacity
            onPress={() => shiftCalendarDay(-1)}
            style={styles.calendarDayArrow}
          >
            <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
          </TouchableOpacity>

          <Text style={styles.calendarDayText}>{calendarDayLabel}</Text>

          <TouchableOpacity
            onPress={() => shiftCalendarDay(1)}
            style={styles.calendarDayArrow}
          >
            <Ionicons name="chevron-forward" size={18} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.slotComposerCard}>
          <Text style={styles.slotComposerTitle}>Create Availability</Text>
          <Text style={styles.slotComposerSub}>
            Add half-hour slots for the selected day in Toronto time.
          </Text>

          <View style={styles.slotComposerRow}>
            <View style={styles.slotTimeField}>
              <Text style={styles.slotTimeLabel}>Start</Text>
              <TouchableOpacity
                style={styles.slotTimeInput}
                onPress={() => setTimePickerMode('START')}
              >
                <Text style={styles.slotTimeInputText}>{slotStartTime}</Text>
                <Ionicons name="chevron-down" size={16} color={theme.colors.mutedText} />
              </TouchableOpacity>
            </View>

            <View style={styles.slotTimeField}>
              <Text style={styles.slotTimeLabel}>End</Text>
              <TouchableOpacity
                style={styles.slotTimeInput}
                onPress={() => setTimePickerMode('END')}
              >
                <Text style={styles.slotTimeInputText}>{slotEndTime}</Text>
                <Ionicons name="chevron-down" size={16} color={theme.colors.mutedText} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.calendarCreateBtn}
              onPress={createSlotsForSelectedWindow}
              disabled={calendarSaving}
            >
              <Ionicons
                name="add-circle-outline"
                size={18}
                color={theme.colors.text}
              />
              <Text style={styles.calendarCreateBtnText}>Add Slots</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.calendarDangerBtn}
              onPress={async () => {
                try {
                  const ok = isWeb
                    ? window.confirm(`Clear all open slots for ${calendarDayLabel}?`)
                    : true;

                  if (!ok) return;

                  setCalendarSaving(true);
                  const count = await moderatorCalendarService.clearOpenSlotsForDay(
                    calendarDayLabel,
                    CANADA_TIMEZONE
                  );
                  await loadCalendar();

                  if (isWeb) {
                    alert(`Cleared ${count} open slot${count === 1 ? '' : 's'}.`);
                  } else {
                    Alert.alert('Cleared', `Removed ${count} open slot${count === 1 ? '' : 's'}.`);
                  }
                } catch (e: any) {
                  Alert.alert('Unable to clear slots', e.message ?? 'Please try again');
                } finally {
                  setCalendarSaving(false);
                }
              }}
              disabled={calendarSaving}
            >
              <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
              <Text style={styles.calendarDangerBtnText}>Clear Open Slots</Text>
            </TouchableOpacity>
                      </View>
                    </View>

                    {rescheduleFromSlotId ? (
                      <View style={styles.calendarBanner}>
                        <Text style={styles.calendarBannerText}>
                          Choose a new open slot to finish rescheduling.
                        </Text>
                        <TouchableOpacity onPress={() => setRescheduleFromSlotId(null)}>
                          <Text style={styles.calendarBannerLink}>Clear</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {calendarLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading calendar...</Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.calendarListContent}
            showsVerticalScrollIndicator={false}
          >
            {calendarSlots.length === 0 ? (
              <View style={styles.calendarEmptyCard}>
                <Text style={styles.calendarEmptyTitle}>No slots yet</Text>
                <Text style={styles.calendarEmptySub}>
                  Create availability for this day to start taking bookings.
                </Text>
              </View>
            ) : (
              calendarSlots.map((slot) => {
                const isMine =
                  !!calendarUserId && slot.booked_by_user_id === calendarUserId;

                return (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    isModerator={true}
                    isMine={isMine}
                    onBook={() => handleBookCalendarSlot(slot.id)}
                    onCancel={() => handleCancelCalendarSlot(slot.id)}
                    onReschedule={() => setRescheduleFromSlotId(slot.id)}
                    onDelete={() => handleDeleteCalendarSlot(slot.id)}
                  />
                );
              })
            )}
          </ScrollView>
        )}

        {calendarSaving ? (
          <View style={styles.calendarSavingOverlay}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : null}
    </View>
);

  // --- INITIALIZATION ---
  useEffect(() => {
    let isMounted = true;
    if (hasInitialized.current) return;

    const initialize = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isMounted) {
          await fetchAdminProfile(session.user.id);
          await loadData();
          hasInitialized.current = true;
        }
      } catch (err) {
        if (isMounted) setInitError('Connection lost.');
      }
    };

    initialize();
    return () => {
      isMounted = false;
    };
  }, [fetchAdminProfile, loadData]);


  /* DEBUG
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log("UID:", user?.id);

      const { data: isAdmin } = await supabase.rpc('is_admin');
      console.log("is_admin:", isAdmin);

      const { data: isStaff } = await supabase.rpc('is_staff');
      console.log("is_staff:", isStaff);

      const { data: isMod } = await supabase.rpc('is_moderator');
      console.log("is_moderator:", isMod);
    })();
  }, []);
  */

  const { signOut, isSigningOut } = useSignOut({
    redirectTo: '/login',
    onBeforeSignOut: async () => {
      // ✅ close overlays so clicks never get eaten / stuck
      setActiveModal(null);
    },
  });
    
  const handleExport = useCallback(async () => {
    setLoading(true);
    try {
      const csvData = await adminService.exportToCSV();
      const fileName = `Nexus_Backup_${new Date().toISOString().split('T')[0]}.csv`;
      if (isWeb) {
        const element = document.createElement('a');
        element.href = URL.createObjectURL(new Blob([csvData], { type: 'text/csv' }));
        element.download = fileName;
        element.click();
      } else {
        const fileUri = (FS.documentDirectory || '') + fileName;
        await FS.writeAsStringAsync(fileUri, csvData, { encoding: FS.EncodingType.UTF8 });
        await Sharing.shareAsync(fileUri);
      }
    } finally {
      setLoading(false);
    }
  }, [isWeb]);

  const handleDeleteTestUsers = useCallback(async () => {
    setIsProcessing(true);
    setProcessLabel('Cleaning Database...');
    try {
      await adminService.deleteTestUsers((p) => setProcessProgress(p));
      await loadData(true);
      if (isWeb) alert('Success: Test data removed.');
      else Alert.alert('Cleaned', 'Test data removed.');
      setActiveModal(null);
    } catch (e: any) {
      if (isWeb) alert('Error: ' + e.message);
      else Alert.alert('Error', e.message);
    } finally {
      setIsProcessing(false);
      setProcessProgress(0);
    }
  }, [isWeb, loadData]);

  // --- THEME PICKER (global) ---
  const ThemePicker = () => (
    <View style={styles.themePickerCard}>
      <Text style={styles.themePickerTitle}>Theme</Text>
      <Text style={styles.themePickerSubtitle}>Switch instantly across the entire app.</Text>
      <View style={styles.themeChipRow}>
        {availableThemes.map((t) => {
          const active = t === themeName;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => {
                setThemeName(t);
                setSettings((prev) => ({ ...prev, themeName: t })); // ✅ persist to DB on Save
              }}
              
              style={[styles.themeChip, active ? styles.themeChipActive : styles.themeChipIdle]}
            >
              <Text style={[styles.themeChipText, active ? styles.themeChipTextActive : styles.themeChipTextIdle]}>
                {String(t).toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // UI RENDERERS
  const renderAdminSearch = () => {
    return (
      <SearchExperience
        mode="ADMIN"
        context={{ role: isSysAdmin ? 'ADMIN' : 'MODERATOR' }}
        gateEnabled={false}
        autoSearchOnMount={true}
        onReport={() => Alert.alert('Admin', 'Use utilities to revoke.')}
      />
    );
 };

  const renderSettings = () => (
    <View style={styles.settingsPage}>
      <Text style={styles.settingsTitle}>System Settings</Text>

      <ThemePicker />

      <View style={styles.settingsCard}>
        <SettingsRow
          styles={styles}
          label="Maintenance Mode"
          value={settings.maintenanceMode}
          onValueChange={(v: boolean) => setSettings({ ...settings, maintenanceMode: v })}
        />
        <SettingsRow
          styles={styles}
          label="Allow New Registrations"
          value={settings.allowRegistration}
          onValueChange={(v: boolean) => setSettings({ ...settings, allowRegistration: v })}
        />
        <SettingsRow
          styles={styles}
          label="Force Profile Approval"
          value={settings.requireApproval}
          onValueChange={(v: boolean) => setSettings({ ...settings, requireApproval: v })}
        />
        <SettingsNumberRow
          styles={styles}
          label="Favorites Limit"
          value={settings.favoritesLimit}
          hint="Max favorites a user can save (1–20)."
          onChangeText={(t: string) => {
            const n = clampInt(t, 5, 1, 20);
            setSettings({ ...settings, favoritesLimit: String(n) });
          }}
      />
      </View>

      <TouchableOpacity
        style={styles.saveSettingsBtn}
        onPress={async () => {
          await adminService.updateSystemConfig(settings);
          isWeb ? alert('Saved') : Alert.alert('Success', 'Settings Saved');
        }}
      >
        <Text style={styles.saveSettingsText}>Save Configuration</Text>
      </TouchableOpacity>
    </View>
  );

  const renderWorkspace = () => (
    <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{isSysAdmin ? 'Admin Workspace' : 'Moderator Workspace'}</Text>
          <Text style={styles.subtitle}>Welcome back, {adminName}</Text>
        </View>
        <TouchableOpacity onPress={() => loadData(false)} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color={theme.colors.primary} style={{ transformOrigin: 'center' } as any} />
        </TouchableOpacity>
        <SignOutButton
          variant="header"
          onBeforeSignOut={() => setActiveModal(null)} // ✅ close overlays first (important!)
        />
      </View>

      <View style={styles.scrollContent}>
        <View style={styles.statsRow}>
          <StatCard styles={styles} theme={theme} label="Total Members" value={stats.totalUsers} icon="people" color={theme.colors.primary} />
          <StatCard styles={styles} theme={theme} label="Awaiting Review" value={stats.pendingApprovals} icon="time" color={theme.colors.primary} />
          <StatCard styles={styles} theme={theme} label="Active Reports" value={reports.length} icon="alert-circle" color={theme.colors.danger} />
        </View>

        <View style={styles.mainGrid}>
          <View style={{ flex: 2 }}>
            <SectionHeader styles={styles} title="Verification Queue" />
            <View style={styles.groupCard}>
              <Text style={styles.cardHeader}>Pending Approval ({queue.length})</Text>
              {queue.length === 0 ? (
                <Text style={styles.emptyText}>Queue is currently empty</Text>
              ) : (
                queue.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => {
                      setSelectedUser(item);
                      setActiveModal('REVIEW');
                    }}
                    style={styles.itemRow}
                  >
                    <Text style={{ fontWeight: '600', color: theme.colors.text }}>{item.full_name}</Text>
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.mutedText} style={{ transformOrigin: 'center' } as any} />
                  </TouchableOpacity>
                ))
              )}
            </View>

            <View style={[styles.groupCard, { marginTop: 20 }]}>
              <Text style={styles.cardHeader}>Flagged Accounts ({reports.length})</Text>
              {reports.map((r) => (
                <View key={r.id} style={styles.itemRow}>
                  <View>
                    <Text style={{ fontWeight: '700', color: theme.colors.text }}>{r.targetName || 'User'}</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.mutedText }}>{r.reason}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.banBtn}
                    onPress={() => {
                      setRevokeForm({ ...revokeForm, email: r.targetEmail });
                      setActiveModal('REVOKE_ACCESS');
                    }}
                  >
                    <Text style={styles.banText}>Investigate</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>

          <View style={{ flex: 1.2 }}>
            <SectionHeader styles={styles} title="Quick Actions" />
            <UtilityBtn styles={styles} label="User Explorer" icon="list-circle" color={theme.colors.primary} onPress={() => setActiveModal('USER_REPORT')} />
            <UtilityBtn styles={styles} label="System Analytics" icon="bar-chart" color={theme.colors.success ?? theme.colors.primary} onPress={() => setActiveModal('CHARTS')} />
            <UtilityBtn styles={styles} label="Send Broadcast" icon="megaphone" color={theme.colors.primary} onPress={() => setActiveModal('ANNOUNCEMENT')} />
            {/* DEBUG <UtilityBtn styles={styles} label="Test Audit Log" icon="bug-outline" color={theme.colors.primary} onPress={runAuditTest}/> */}

            {isSysAdmin && (
              <>
                <SectionHeader styles={styles} title="Administration" style={{ marginTop: 20, color: theme.colors.danger }} />
                {/* <UtilityBtn styles={styles} label="Add Staff Member" icon="person-add" color={theme.colors.primary} onPress={() => setActiveModal('ADD_MOD')} /> */}
                <UtilityBtn styles={styles} label="Manage Privileges" icon="person-remove" color={theme.colors.danger} onPress={() => setActiveModal('REVOKE_ACCESS')} />
                <UtilityBtn
                  styles={styles}
                  label="Security Audit"
                  icon="shield-checkmark"
                  color={theme.colors.text}
                  onPress={async () => {
                    const result = await adminService.getAuditLogs();
                    setLogs(result.logs || []);
                    setActiveModal('LOGS');
                  }}
                />
                {/* <UtilityBtn styles={styles} label="Data Engine" icon="flask" color={theme.colors.primary} onPress={() => setActiveModal('TEST_GEN')} /> */}
                <UtilityBtn styles={styles} label="Download CSV" icon="download" color={theme.colors.text} onPress={handleExport} />
                {/* <TouchableOpacity style={styles.dangerBtn} onPress={() => adminService.executeMassCleanup()}>
                  <Ionicons name="trash" size={20} color={theme.colors.danger} style={{ transformOrigin: 'center' } as any} />
                  <Text style={{ color: theme.colors.danger, fontWeight: '800' }}>Mass Data Cleanup</Text>
                </TouchableOpacity>
                */}
              </>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );

  if (initError) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color={theme.colors.danger} style={{ transformOrigin: 'center' } as any} />
        <Text style={styles.errorText}>{initError}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => (isWeb ? window.location.reload() : loadData())}>
          <Text style={styles.retryText}>RETRY CONNECTION</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && queue.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Synchronizing Workspace...</Text>
      </View>
    );
  }

  const runAuditTest = async () => {
    const result = await adminService.testAuditLogInsert();

    if (result?.success) {
      if (isWeb) {
        alert('Audit log test passed. Row inserted successfully.');
      } else {
        Alert.alert('Success', 'Audit log test passed. Row inserted successfully.');
      }
    } else {
      const message = result?.error || 'Audit log test failed. Check console.';
      if (isWeb) {
        alert(message);
      } else {
        Alert.alert('Audit Test Failed', message);
      }
    }
  };

  return (
    <View style={styles.pageWrapper}>
      <View style={styles.sidebar}>
        <SidebarIcon icon="shield" label="DASHBOARD" active={activeTab === 'ADMIN'} onPress={() => setActiveTab('ADMIN')} styles={styles} theme={theme} />
        <SidebarIcon icon="compass" label="EXPLORER" active={activeTab === 'SEARCH'} onPress={() => setActiveTab('SEARCH')} styles={styles} theme={theme} />
        <SidebarIcon icon="calendar-outline" label="CALENDAR" active={activeTab === 'CALENDAR'} onPress={() => setActiveTab('CALENDAR')} styles={styles} theme={theme} />
        {isSysAdmin && (
          <SidebarIcon icon="options" label="SETTINGS" active={activeTab === 'SETTINGS'} onPress={() => setActiveTab('SETTINGS')} styles={styles} theme={theme} />
        )}
      </View>

      <View style={styles.mainContainer}>
        {activeTab === 'SEARCH'
          ? renderAdminSearch()
          : activeTab === 'CALENDAR'
            ? renderModeratorCalendar()
            : activeTab === 'SETTINGS'
              ? renderSettings()
              : renderWorkspace()}
      </View>

      {/* MODALS (✅ preserved + themed) */}
      <Modal visible={activeModal === 'REVIEW'} animationType="slide">
        <View style={styles.modalContentFull}>
          <ModalHeader styles={styles} theme={theme} title="Profile Verification" onClose={() => setActiveModal(null)} />
          <ScrollView>{selectedUser && <ProfileDisplay profile={selectedUser} />}</ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: theme.colors.danger }]}
              onPress={async () => {
                await adminService.rejectProfile(selectedUser.id);
                setActiveModal(null);
                loadData(true);
              }}
            >
              <Text style={styles.modalBtnText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: theme.colors.success ?? theme.colors.primary }]}
              onPress={async () => {
                await adminService.approveProfile(selectedUser.id);
                setActiveModal(null);
                loadData(true);
              }}
            >
              <Text style={styles.modalBtnText}>Approve</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={activeModal === 'USER_REPORT'} animationType="slide">
        <View style={styles.modalContentFull}>
          <ModalHeader styles={styles} theme={theme} title="User Management" onClose={() => setActiveModal(null)} />
          <UserManagementScreen />
        </View>
      </Modal>

      <Modal visible={activeModal === 'ANNOUNCEMENT'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.utilityModal}>
            <Text style={styles.modalTitle}>System Broadcast</Text>
            <TextInput style={styles.input} placeholder="Subject" onChangeText={(t) => setAnnouncement({ ...announcement, title: t })} />
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Message Body"
              multiline
              onChangeText={(t) => setAnnouncement({ ...announcement, body: t })}
            />
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={async () => {
                await adminService.postAnnouncement(announcement.title, announcement.body);
                setActiveModal(null);
                isWeb ? alert('Broadcast Sent') : Alert.alert('Success', 'Sent');
              }}
            >
              <Text style={styles.applyText}>Dispatch Now</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveModal(null)}>
              <Text style={styles.cancelText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={activeModal === 'ADD_MOD'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.utilityModal}>
            <Text style={styles.modalTitle}>Staff Invitation</Text>
            <TextInput style={styles.input} placeholder="Full Name" value={modForm.fullName} onChangeText={(t) => setModForm({ ...modForm, fullName: t })} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={modForm.email}
              onChangeText={(t) => setModForm({ ...modForm, email: t })}
            />
            <View style={styles.roleRow}>
              {['MODERATOR', 'ADMIN'].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, modForm.role === r && styles.roleChipActive]}
                  onPress={() => setModForm({ ...modForm, role: r })}
                >
                  <Text style={styles.roleText}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={async () => {
                if (!modForm.email || !modForm.fullName) {
                  alert('Data incomplete');
                  return;
                }
                await adminService.setupModerator(modForm);
                setActiveModal(null);
              }}
            >
              <Text style={styles.applyText}>Send Access Link</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveModal(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={activeModal === 'REVOKE_ACCESS'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.utilityModal}>
            <Text style={[styles.modalTitle, { color: theme.colors.danger }]}>Revoke Privileges</Text>
            <TextInput style={styles.input} placeholder="User Email" value={revokeForm.email} onChangeText={(t) => setRevokeForm({ ...revokeForm, email: t })} />
            <TouchableOpacity
              style={[styles.applyBtn, { backgroundColor: theme.colors.danger }]}
              onPress={async () => {
                await adminService.revokeAccess(revokeForm.email);
                setActiveModal(null);
                loadData(true);
              }}
            >
              <Text style={styles.applyText}>Deactivate Now</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveModal(null)}>
              <Text style={styles.cancelText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={activeModal === 'TEST_GEN'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.utilityModal}>
            <Text style={styles.modalTitle}>Data Engine</Text>
            {!isProcessing ? (
              <View style={{ width: '100%' }}>
                <TextInput style={styles.input} keyboardType="number-pad" placeholder="Quantity" value={testUserCount} onChangeText={setTestUserCount} />
                <TouchableOpacity
                  style={styles.applyBtn}
                  onPress={async () => {
                    if (!testUserCount) return;
                    setIsProcessing(true);
                    setProcessLabel('Populating...');
                    try {
                      await adminService.generateTestUsers(parseInt(testUserCount, 10), (p) => setProcessProgress(p));
                      await loadData(true);
                      setActiveModal(null);
                    } catch (e: any) {
                      alert(e.message);
                    } finally {
                      setIsProcessing(false);
                      setProcessProgress(0);
                    }
                  }}
                >
                  <Text style={styles.applyText}>Generate Data</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.applyBtn, { backgroundColor: theme.colors.danger, marginTop: 10 }]}
                  onPress={() => {
                    if (isWeb) {
                      if (window.confirm('Purge test profiles?')) handleDeleteTestUsers();
                    } else {
                      Alert.alert('Purge', 'Delete all test profiles?', [
                        { text: 'Cancel' },
                        { text: 'Purge', onPress: handleDeleteTestUsers },
                      ]);
                    }
                  }}
                >
                  <Text style={styles.applyText}>Wipe Test Data</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setActiveModal(null)} style={{ alignItems: 'center', marginTop: 10 }}>
                  <Text style={styles.cancelText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.progressContainer}>
                <Text style={styles.progressLabel}>{processLabel}</Text>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${processProgress}%` }]} />
                </View>
                <Text style={styles.progressPct}>{processProgress}%</Text>
                <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 15 }} />
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={activeModal === 'LOGS'} animationType="slide">
        <View style={styles.modalContentFull}>
          <ModalHeader styles={styles} theme={theme} title="System Audit Logs" onClose={() => setActiveModal(null)} />
          <AuditLogScreen />
        </View>
      </Modal>

      <Modal visible={activeModal === 'CHARTS'} animationType="slide">
        <View style={styles.modalContentFull}>
          <ModalHeader styles={styles} theme={theme} title="Data Analytics" onClose={() => setActiveModal(null)} />
          <AnalyticsScreen />
        </View>
      </Modal>

      <Modal visible={timePickerMode !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.timePickerModal}>
            <Text style={styles.modalTitle}>
              {timePickerMode === 'START' ? 'Select Start Time' : 'Select End Time'}
            </Text>

            <ScrollView
              style={styles.timePickerList}
              contentContainerStyle={{ paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
            >
              {(timePickerMode === 'START' ? TIME_OPTIONS : endTimeOptions).map((time) => {
                const active =
                  timePickerMode === 'START' ? slotStartTime === time : slotEndTime === time;

                return (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.timePickerItem,
                      active ? styles.timePickerItemActive : null,
                    ]}
                    onPress={() => {
                      if (timePickerMode === 'START') {
                        setSlotStartTime(time);

                        if (slotEndTime <= time) {
                          const nextEnd = TIME_OPTIONS.find((t) => t > time);
                          if (nextEnd) setSlotEndTime(nextEnd);
                        }
                      } else {
                        setSlotEndTime(time);
                      }

                      setTimePickerMode(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.timePickerItemText,
                        active ? styles.timePickerItemTextActive : null,
                      ]}
                    >
                      {time}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity onPress={() => setTimePickerMode(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// SHARED UI COMPONENTS
const SidebarIcon = ({ icon, label, active, onPress, styles, theme }: any) => (
  <TouchableOpacity onPress={onPress} style={[styles.sidebarBtn, active && styles.sidebarBtnActive]}>
    <Ionicons
      name={icon}
      size={24}
      color={active ? theme.colors.text : theme.colors.mutedText}
      style={{ transformOrigin: 'center' } as any}
    />
    <Text style={[styles.sidebarLabel, active && styles.sidebarLabelActive]}>{label}</Text>
  </TouchableOpacity>
);

const StatCard = ({ label, value, icon, color, styles }: any) => {
  const safeValue = value ?? 0;
  const displayValue = typeof safeValue === 'number' ? safeValue.toLocaleString() : String(safeValue);

  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={24} color={color} style={{ transformOrigin: 'center' } as any} />
      <View style={{ marginLeft: 15 }}>
        <Text style={styles.statValue}>{displayValue}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
};

const UtilityBtn = ({ label, icon, color, onPress, styles }: any) => (
  <TouchableOpacity style={styles.utilBtn} onPress={onPress}>
    <Ionicons name={icon} size={18} color={color} style={{ transformOrigin: 'center' } as any} />
    <Text style={styles.utilLabel}>{label}</Text>
  </TouchableOpacity>
);

const ModalHeader = ({ title, onClose, styles, theme }: any) => (
  <View style={styles.modalHeader}>
    <Text style={{ fontWeight: '800', fontSize: 16, color: theme.colors.text }}>{title}</Text>
    <TouchableOpacity onPress={onClose}>
      <Ionicons name="close" size={28} color={theme.colors.text} style={{ transformOrigin: 'center' } as any} />
    </TouchableOpacity>
  </View>
);

const clampInt = (raw: string, fallback: number, min: number, max: number): number => {
  const n = parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const SettingsNumberRow = ({ label, value, onChangeText, styles, hint }: any) => (
  <View style={[styles.settingsRow, { alignItems: 'flex-start', flexDirection: 'column' }]}>
    <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={styles.settingsRowLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        style={[
          styles.input,
          {
            width: 90,
            marginBottom: 0,
            paddingVertical: 10,
            textAlign: 'center',
            borderWidth: 1,
            borderColor: styles?.settingsRowBorderColor ?? undefined,
          },
        ]}
        placeholder="5"
      />
    </View>
    {!!hint && (
      <Text style={{ marginTop: 6, fontSize: 12, color: '#6B7280', fontWeight: '600' }}>
        {hint}
      </Text>
    )}
  </View>
);

const SettingsRow = ({ label, value, onValueChange, styles }: any) => (
  <View style={styles.settingsRow}>
    <Text style={styles.settingsRowLabel}>{label}</Text>
    <Switch value={value} onValueChange={onValueChange} />
  </View>
);

const SectionHeader = ({ title, style, styles }: any) => <Text style={[styles.sectionTitle, style]}>{title}</Text>;

function makeStyles(theme: any) {
  const bg = theme?.colors?.bg ?? '#FDF6EC';
  const surface = theme?.colors?.surface ?? '#FFF8F1';
  const surface2 = theme?.colors?.surface2 ?? '#FFFFFF';
  const border = theme?.colors?.border ?? '#E8D5C4';
  const text = theme?.colors?.text ?? '#11181C';
  const muted = theme?.colors?.mutedText ?? '#6B7280';
  const primary = theme?.colors?.primary ?? '#7B1E3A';
  const danger = theme?.colors?.danger ?? '#B42318';
  const success = theme?.colors?.success ?? '#3E6B48';

  return StyleSheet.create({
    pageWrapper: { flex: 1, flexDirection: 'row', backgroundColor: bg },
    sidebar: { width: 100, backgroundColor: surface, borderRightWidth: 1, borderRightColor: border, paddingTop: 60, alignItems: 'center' },
    sidebarBtn: { width: '100%', paddingVertical: 20, alignItems: 'center', borderLeftWidth: 3, borderLeftColor: 'transparent' },
    sidebarBtnActive: { borderLeftColor: primary, backgroundColor: surface2 },
    sidebarLabel: { fontSize: 10, fontWeight: '800', color: muted, marginTop: 8 },
    sidebarLabelActive: { color: text },
    mainContainer: { flex: 1 },
    scrollContainer: { flex: 1 },
    header: { padding: 30, backgroundColor: surface, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: border },
    title: { fontSize: 24, fontWeight: '800', color: text },
    subtitle: { color: muted, fontSize: 13, marginTop: 4 },
    refreshBtn: { marginLeft: 'auto', marginRight: 15, padding: 10, backgroundColor: bg, borderRadius: 10 },
    signOutHeaderBtn: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: danger, borderRadius: 10 },
    signOutText: { color: danger, fontSize: 11, fontWeight: '800' },
    scrollContent: { padding: 25 },
    statsRow: { flexDirection: 'row', gap: 15, marginBottom: 25 },
    statCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: surface, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: border },
    statValue: { fontSize: 22, fontWeight: '800', color: text },
    statLabel: { fontSize: 11, color: muted, textTransform: 'uppercase' },
    mainGrid: { flexDirection: Platform.OS === 'web' ? 'row' : 'column', gap: 25 },
    sectionTitle: { fontSize: 12, fontWeight: '800', color: muted, textTransform: 'uppercase', marginBottom: 12 },
    groupCard: { backgroundColor: surface, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: border },
    cardHeader: { padding: 15, fontWeight: '800', backgroundColor: surface2, borderBottomWidth: 1, borderBottomColor: border, color: text },
    emptyText: { padding: 20, color: muted, textAlign: 'center' },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: bg, alignItems: 'center' },
    utilBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: surface, padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: border },
    utilLabel: { fontWeight: '700', fontSize: 13, color: text },
    dangerBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: danger, marginTop: 10 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    utilityModal: { backgroundColor: surface, padding: 30, borderRadius: 24, width: 400, alignItems: 'center', ...Platform.select({ web: { boxShadow: '0 10px 25px rgba(0,0,0,0.1)' } as any }) },
    modalContentFull: { flex: 1, backgroundColor: bg, paddingTop: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: border, alignItems: 'center', backgroundColor: surface },
    modalFooter: { flexDirection: 'row', padding: 20, gap: 15, borderTopWidth: 1, borderColor: border, backgroundColor: surface2 },
    modalBtn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
    modalBtnText: { color: surface2, fontWeight: '800' },
    banBtn: { backgroundColor: surface2, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: border },
    banText: { color: danger, fontSize: 11, fontWeight: '800' },

    input: { backgroundColor: bg, padding: 15, borderRadius: 12, width: '100%', marginBottom: 10 },
    applyBtn: { backgroundColor: primary, padding: 18, borderRadius: 30, width: '100%', alignItems: 'center', marginTop: 10 },
    applyText: { color: surface2, fontWeight: '800' },

    roleRow: { flexDirection: 'row', gap: 10, marginBottom: 15, width: '100%' },
    roleChip: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: bg, alignItems: 'center' },
    roleChipActive: { backgroundColor: primary },
    roleText: { fontSize: 12, fontWeight: '700', color: muted },

    cancelText: { color: muted, fontWeight: '600', marginTop: 15 },
    modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20, color: text },

    searchContainer: { flex: 1, flexDirection: 'row', backgroundColor: bg },
    searchSidebar: { width: 340, borderRightWidth: 1, borderColor: bg },
    searchResultArea: { flex: 1, backgroundColor: bg, justifyContent: 'center' },
    searchHeader: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: surface, borderBottomWidth: 1, borderColor: border },
    searchText: { fontSize: 11, fontWeight: '800', color: text },

    paginationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    pageBtn: { padding: 6, borderRadius: 8, backgroundColor: bg },
    pageIndicator: { backgroundColor: primary, width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    pageText: { color: surface2, fontSize: 11, fontWeight: '900' },

    emptyCenter: { alignItems: 'center', flex: 1, justifyContent: 'center' },

    progressContainer: { width: '100%', alignItems: 'center', paddingVertical: 20 },
    progressLabel: { fontSize: 14, fontWeight: '700', marginBottom: 15, color: text },
    progressBarBg: { width: '100%', height: 12, backgroundColor: bg, borderRadius: 6, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: primary },
    progressPct: { fontSize: 12, fontWeight: '800', color: primary, marginTop: 8 },

    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: bg },
    errorText: { marginTop: 15, fontWeight: '700', color: danger },
    retryBtn: { marginTop: 20, backgroundColor: primary, padding: 16, borderRadius: 12 },
    retryText: { color: surface2, fontWeight: '800' },

    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: bg },
    loadingText: { marginTop: 15, color: muted, fontWeight: '600' },

    settingsPage: { flex: 1, padding: 40, backgroundColor: bg },
    settingsTitle: { fontSize: 32, fontWeight: '800', marginBottom: 18, color: text },

    themePickerCard: { backgroundColor: surface, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: border, marginBottom: 14, ...Platform.select({ web: { boxShadow: '0 10px 25px rgba(0,0,0,0.08)' } as any }) },
    themePickerTitle: { fontSize: 14, fontWeight: '900', color: text },
    themePickerSubtitle: { marginTop: 4, fontSize: 12, fontWeight: '700', color: muted },
    themeChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
    themeChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
    themeChipIdle: { backgroundColor: surface2, borderColor: border },
    themeChipActive: { backgroundColor: primary, borderColor: primary },
    themeChipText: { fontSize: 12, fontWeight: '900' },
    themeChipTextIdle: { color: text },
    themeChipTextActive: { color: surface2 },

    settingsCard: { backgroundColor: surface, borderRadius: 20, padding: 25, borderWidth: 1, borderColor: border },
    settingsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: bg, justifyContent: 'space-between' },
    settingsRowLabel: { fontSize: 15, fontWeight: '700', color: text },
    saveSettingsBtn: { marginTop: 30, backgroundColor: success, padding: 20, borderRadius: 15, alignItems: 'center' },
    saveSettingsText: { color: surface2, fontWeight: '800' },

    perfBadge: {
      marginTop: 6,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: surface2,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: border,
    },
    perfText: {
      marginLeft: 6,
      fontSize: 11,
      fontWeight: '800',
      color: success,
    },
    actionBtn: {
      position: 'absolute',
      right: 24,
      bottom: 24,
      backgroundColor: primary,
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: primary,
      ...Platform.select({
        web: { boxShadow: '0 10px 24px rgba(0,0,0,0.14)' } as any,
      }),
    },
    actionText: {
      color: surface2,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.3,
    },
        calendarPage: {
      flex: 1,
      padding: 32,
      backgroundColor: bg,
    },
    calendarHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 18,
      gap: 16,
    },
    calendarSubtitle: {
      marginTop: 6,
      fontSize: 13,
      fontWeight: '700',
      color: muted,
    },
    calendarCreateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: border,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    calendarCreateBtnText: {
      fontWeight: '800',
      color: text,
      fontSize: 13,
    },
    calendarDayBar: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 14,
      marginBottom: 16,
    },
    calendarDayArrow: {
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 999,
      padding: 8,
    },
    calendarDayText: {
      fontSize: 16,
      fontWeight: '800',
      color: text,
    },
    calendarBanner: {
      marginBottom: 14,
      borderRadius: 14,
      padding: 12,
      backgroundColor: '#FFFBEB',
      borderWidth: 1,
      borderColor: '#FDE68A',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    calendarBannerText: {
      color: '#92400E',
      fontWeight: '700',
      flex: 1,
      marginRight: 10,
    },
    calendarBannerLink: {
      color: '#92400E',
      fontWeight: '900',
    },
    calendarListContent: {
      paddingBottom: 40,
    },
    calendarEmptyCard: {
      backgroundColor: surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: border,
      padding: 20,
    },
    calendarEmptyTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: text,
    },
    calendarEmptySub: {
      marginTop: 8,
      color: muted,
      lineHeight: 20,
      fontWeight: '600',
    },
    calendarSavingOverlay: {
      position: 'absolute',
      right: 24,
      bottom: 24,
      backgroundColor: surface2,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    slotComposerCard: {
  backgroundColor: surface,
  borderRadius: 20,
  borderWidth: 1,
  borderColor: border,
  padding: 18,
  marginBottom: 18,
},
slotComposerTitle: {
  fontSize: 15,
  fontWeight: '900',
  color: text,
},
slotComposerSub: {
  marginTop: 4,
  fontSize: 12,
  fontWeight: '700',
  color: muted,
},
slotComposerRow: {
  flexDirection: Platform.OS === 'web' ? 'row' : 'column',
  gap: 12,
  marginTop: 14,
  alignItems: Platform.OS === 'web' ? 'flex-end' : 'stretch',
},
slotTimeField: {
  minWidth: 140,
},
slotTimeLabel: {
  fontSize: 12,
  fontWeight: '800',
  color: muted,
  marginBottom: 6,
},
  dangerBtnText: {
    color: '#BE123C',
    fontWeight: '700',
  },
      calendarDangerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: danger,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    calendarDangerBtnText: {
      fontWeight: '800',
      color: danger,
      fontSize: 13,
    },
    timePickerModal: {
  backgroundColor: surface,
  padding: 24,
  borderRadius: 24,
  width: 360,
  maxWidth: '92%',
  maxHeight: '75%',
  borderWidth: 1,
  borderColor: border,
  ...Platform.select({
    web: { boxShadow: '0 10px 25px rgba(0,0,0,0.1)' } as any,
  }),
},
timePickerList: {
  width: '100%',
  marginTop: 4,
},
timePickerItem: {
  paddingVertical: 12,
  paddingHorizontal: 14,
  borderRadius: 12,
  marginBottom: 8,
  backgroundColor: bg,
  borderWidth: 1,
  borderColor: border,
},
timePickerItemActive: {
  backgroundColor: primary,
  borderColor: primary,
},
timePickerItemText: {
  fontSize: 14,
  fontWeight: '800',
  color: text,
},
timePickerItemTextActive: {
  color: surface2,
},
slotTimeInput: {
  backgroundColor: bg,
  borderWidth: 1,
  borderColor: border,
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 12,
  minHeight: 48,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},
slotTimeInputText: {
  fontSize: 14,
  fontWeight: '800',
  color: text,
},
  });
}