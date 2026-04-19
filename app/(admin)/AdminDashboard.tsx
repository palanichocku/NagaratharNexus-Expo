// ./app/(admin)/AdminDashboard.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
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
  type ModeratorDirectoryItem,
} from '@/src/services/moderatorCalendar.service';
import {
  CANADA_TIMEZONE,
  toYMDInTimeZone,
} from '@/src/utils/timezone';
import { useDialog } from '@/src/ui/feedback/useDialog';
import { useToast } from '@/src/ui/feedback/useToast';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';

const FS: any = FileSystem;
const PAGE_SIZE = 5;
type AdminTab = 'ADMIN' | 'SEARCH' | 'CALENDAR' | 'SETTINGS';

type PendingQueueCursor = {
  created_at: string;
  id: string;
} | null;

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

const EMPTY_STORY_FORM = {
  title: '',
  wedding_date: '',
  short_description: '',
  feedback: '',
  photo_url: '',
  photo_path: '',
  is_published: false,
  is_featured: false,
  sort_order: '0',
};

export default function AdminDashboard() {
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [storiesSaving, setStoriesSaving] = useState(false);
  const [stories, setStories] = useState<any[]>([]);
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  const [storyForm, setStoryForm] = useState(EMPTY_STORY_FORM);

  const toast = useToast();
  const dialog = useDialog();
  const { theme, themeName, setThemeName, availableThemes } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const isWeb = Platform.OS === 'web';
  const hasInitialized = useRef(false);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('ADMIN');
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  // --- ROLE & IDENTITY ---
  const [userRole, setUserRole] = useState<string>('');
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
  const [queueCursor, setQueueCursor] = useState<PendingQueueCursor>(null);
  const [queueHasMore, setQueueHasMore] = useState(false);
  const [queueLoadingMore, setQueueLoadingMore] = useState(false);

  const [reports, setReports] = useState<any[]>([]);
  const [deactivatedUsers, setDeactivatedUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [announcement, setAnnouncement] = useState({ title: '', body: '' });
  const [modForm, setModForm] = useState({ fullName: '', phone: '', email: '', role: 'MODERATOR' });
  const [revokeForm, setRevokeForm] = useState({ fullName: '', phone: '', email: '', role: 'USER' });
  const [revokeComment, setRevokeComment] = useState('');
  const [reactivateForm, setReactivateForm] = useState({ id: '', email: '', fullName: '', note: '' });

  const [settings, setSettings] = useState({
    maintenanceMode: false,
    readOnlyMode: false,
    allowRegistration: true,
    requireApproval: true,
    autoPauseThreshold: '3',
    inactiveUserThresholdDays: '30',
    favoritesLimit: '5',
    themeName: 'warm',
  });

  // --- CALENDAR STATE ---
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

  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarSaving, setCalendarSaving] = useState(false);
  const [calendarSlots, setCalendarSlots] = useState<ModeratorSlot[]>([]);
  const [calendarUserId, setCalendarUserId] = useState<string | null>(null);
  const [calendarDay, setCalendarDay] = useState(() => startOfDay(new Date()));
  const [rescheduleFromSlotId, setRescheduleFromSlotId] = useState<string | null>(null);
  const [slotStartTime, setSlotStartTime] = useState('09:00');
  const [slotEndTime, setSlotEndTime] = useState('17:00');
  const [timePickerMode, setTimePickerMode] = useState<'START' | 'END' | null>(null);

  const [calendarModerators, setCalendarModerators] = useState<ModeratorDirectoryItem[]>([]);
  const [selectedCalendarModeratorId, setSelectedCalendarModeratorId] = useState<string | null>(null);

  const isCalendarModerator = userRole === 'MODERATOR';
  const isCalendarAdmin = userRole === 'ADMIN';
  const canCreateCalendarSlots = isCalendarModerator;

  const today = useMemo(() => startOfDay(new Date()), []);
  const maxCalendarDay = useMemo(() => startOfDay(addDays(new Date(), MAX_DAYS_AHEAD)), []);

  const calendarDayLabel = useMemo(
    () => toYMDInTimeZone(calendarDay, CANADA_TIMEZONE),
    [calendarDay]
  );

  const selectedCalendarModerator = useMemo(
    () => calendarModerators.find((m) => m.id === selectedCalendarModeratorId) ?? null,
    [calendarModerators, selectedCalendarModeratorId]
  );

  const canGoCalendarPrev = useMemo(
    () => !isBeforeDay(addDays(calendarDay, -1), today),
    [calendarDay, today]
  );

  const canGoCalendarNext = useMemo(
    () => !isAfterDay(addDays(calendarDay, 1), maxCalendarDay),
    [calendarDay, maxCalendarDay]
  );

  const loadStories = useCallback(async () => {
    setStoriesLoading(true);
    try {
      const result = await adminService.listSuccessStories();
      setStories(result || []);
    } catch (e) {
      console.error('Failed to load success stories:', e);
      setStories([]);
      dialog.show({
        title: 'Error',
        message: 'Failed to load success stories',
        tone: 'error',
      });
    } finally {
      setStoriesLoading(false);
    }
  }, [dialog]);

  const openCreateStory = useCallback(async () => {
    setEditingStoryId(null);
    setStoryForm(EMPTY_STORY_FORM);
    await loadStories();
    setActiveModal('SUCCESS_STORIES');
  }, [loadStories]);

  const startEditStory = useCallback((story: any) => {
    setEditingStoryId(story.id);
    setStoryForm({
      title: story.title ?? '',
      wedding_date: story.wedding_date ?? '',
      short_description: story.short_description ?? '',
      feedback: story.feedback ?? '',
      photo_url: story.photo_url ?? '',
      photo_path: story.photo_path ?? '',
      is_published: !!story.is_published,
      is_featured: !!story.is_featured,
      sort_order: String(story.sort_order ?? 0),
    });
  }, []);

  const sanitizePhoneForWhatsApp = (phone?: string | null) => {
    if (!phone) return '';
    return phone.replace(/[^\d]/g, '');
  };

  const buildModeratorReadyMessage = (memberName?: string | null, moderatorName?: string | null) => {
    const safeMemberName = memberName?.trim() || 'Member';
    const safeModeratorName = moderatorName?.trim() || 'the moderator';

    return `Hello ${safeMemberName}, this is ${safeModeratorName} from Nagarathar Nexus. I’m ready for our scheduled meeting now. Please reply here when you are ready to begin.`;
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

      const moderatorName = selectedCalendarModerator?.full_name ?? 'the moderator';
      const message = buildModeratorReadyMessage(slot.booked_by_name, moderatorName);
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = url;
        return;
      }

      await Linking.openURL(url);
    } catch (e: any) {
      dialog.show({
        title: 'Unable to open WhatsApp',
        message: e?.message ?? 'Please try again.',
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
        message: e?.message ?? 'Please try again.',
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

      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        await Clipboard.setStringAsync(url);
      }

      toast.show('Video link copied', 'success');
    } catch (e: any) {
      dialog.show({
        title: 'Unable to copy video link',
        message: e?.message ?? 'Please try again.',
        tone: 'error',
      });
    }
  };

  const resetStoryForm = useCallback(() => {
    setEditingStoryId(null);
    setStoryForm(EMPTY_STORY_FORM);
  }, []);

  const handleSaveStory = useCallback(async () => {
    if (!storyForm.title.trim()) {
      dialog.show({
        title: 'Missing data',
        message: 'Title is required',
        tone: 'error',
      });
      return;
    }

    if (!storyForm.wedding_date.trim()) {
      dialog.show({
        title: 'Missing data',
        message: 'Wedding date is required',
        tone: 'error',
      });
      return;
    }

    setStoriesSaving(true);
    try {
      const payload = {
        title: storyForm.title.trim(),
        wedding_date: storyForm.wedding_date.trim() || null,
        short_description: storyForm.short_description.trim() || null,
        feedback: storyForm.feedback.trim() || null,
        photo_url: storyForm.photo_url.trim() || null,
        photo_path: storyForm.photo_path.trim() || null,
        is_published: storyForm.is_published,
        is_featured: storyForm.is_featured,
        sort_order: Number(storyForm.sort_order || '0'),
      };

      await loadStories();
      resetStoryForm();
      toast.show('Success story saved', 'success');

      let savedStory: any;

      if (editingStoryId) {
        savedStory = await adminService.updateSuccessStory(editingStoryId, payload);
      } else {
        savedStory = await adminService.createSuccessStory(payload);
      }

      await loadStories();

      if (savedStory?.id) {
        startEditStory(savedStory);
      }

      toast.show('Success story saved', 'success');
    } catch (e: any) {
      console.error('Save story failed:', e);
      const msg = e?.message ?? 'Unable to save success story';
      dialog.show({
        title: 'Error',
        message: msg,
        tone: 'error',
      });
    } finally {
      setStoriesSaving(false);
    }
  }, [storyForm, editingStoryId, loadStories, resetStoryForm, dialog, toast, startEditStory]);

  const handleUploadStoryPhoto = useCallback(async () => {
    if (!editingStoryId) {
      dialog.show({
        title: 'Create story first',
        message: 'Please create the story first, then upload a photo.',
        tone: 'warning',
      });
      return;
    }

    try {
      let file: File | null = null;

      if (Platform.OS === 'web') {
        file = await new Promise<File | null>((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = () => {
            const selected = input.files?.[0] ?? null;
            resolve(selected);
          };
          input.click();
        });
      } else {
        dialog.show({
          title: 'Not supported yet',
          message: 'Photo upload is currently wired for web first.',
          tone: 'info',
        });
        return;
      }

      if (!file) return;

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `photo.${fileExt}`;
      const filePath = `${editingStoryId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('success-stories')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type || 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('success-stories')
        .getPublicUrl(filePath);

      const photoUrl = publicUrlData?.publicUrl ?? null;

      await adminService.updateSuccessStory(editingStoryId, {
        photo_url: photoUrl,
        photo_path: filePath,
      });

      setStoryForm((prev) => ({
        ...prev,
        photo_url: photoUrl ?? '',
        photo_path: filePath,
      }));

      await loadStories();

      toast.show('Photo uploaded successfully.', 'success');
    } catch (e: any) {
      console.error('Story photo upload failed FULL:', JSON.stringify(e, null, 2));
      console.error('Story photo upload failed RAW:', e);
      const msg = e?.message ?? 'Unable to upload photo';
      dialog.show({
        title: 'Error',
        message: msg,
        tone: 'error',
      });
    }
  }, [editingStoryId, loadStories, dialog, toast]);

  const handleDeleteStory = useCallback(async (id: string) => {
    dialog.show({
      title: 'Delete this success story?',
      message: 'This story will be permanently removed.',
      tone: 'warning',
      actions: [
        { label: 'Cancel', variant: 'secondary' },
        {
          label: 'Delete',
          variant: 'danger',
          onPress: async () => {
            try {
              await adminService.deleteSuccessStory(id);
              await loadStories();
              if (editingStoryId === id) resetStoryForm();
              toast.show('Success story removed', 'success');
            } catch (e: any) {
              const msg = e?.message ?? 'Unable to delete success story';
              dialog.show({
                title: 'Error',
                message: msg,
                tone: 'error',
              });
            }
          },
        },
      ],
    });
  }, [editingStoryId, loadStories, resetStoryForm, dialog, toast]);

  const endTimeOptions = useMemo(
    () => TIME_OPTIONS.filter((t) => t > slotStartTime),
    [slotStartTime]
  );

  const isStaff = useMemo(
    () => userRole === 'ADMIN' || userRole === 'MODERATOR',
    [userRole]
  );

  const resetSearchPaging = useCallback(() => {
    setCursorStack([null]);
    setHasNextPage(false);
    setSearchPage(0);
    setSearchIndex(0);
  }, []);

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
      const [pendingPage, safety, analytics, config, inactiveMembers] = await Promise.all([
        adminService.getPendingProfilesPage(PAGE_SIZE, null),
        adminService.getReports(),
        adminService.getAnalytics(),
        adminService.getSystemConfig(),
        adminService.getDeactivatedUsers(),
      ]);

      setQueue(pendingPage?.items || []);
      setQueueCursor(pendingPage?.nextCursor ?? null);
      setQueueHasMore(!!pendingPage?.hasMore);

      setReports(safety || []);
      setDeactivatedUsers(inactiveMembers || []);
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

  const loadMoreQueue = useCallback(async () => {
    if (!queueHasMore || !queueCursor || queueLoadingMore) return;
    if (queue.length >= PAGE_SIZE) return;

    const slotsRemaining = PAGE_SIZE - queue.length;
    if (slotsRemaining <= 0) return;

    setQueueLoadingMore(true);
    try {
      const nextPage = await adminService.getPendingProfilesPage(slotsRemaining, queueCursor);
      setQueue((prev) => [...prev, ...(nextPage?.items || [])].slice(0, PAGE_SIZE));
      setQueueCursor(nextPage?.nextCursor ?? null);
      setQueueHasMore(!!nextPage?.hasMore);
    } catch (err) {
      console.error('Queue pagination failed:', err);
      toast.show('Failed to load more pending approvals', 'error');
    } finally {
      setQueueLoadingMore(false);
    }
  }, [queueHasMore, queueCursor, queueLoadingMore, queue.length, toast]);

  const removeReviewedUserFromQueue = useCallback((userId: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== userId));
    setStats((prev) => ({
      ...prev,
      pendingApprovals: Math.max(0, Number(prev.pendingApprovals || 0) - 1),
    }));
  }, []);

  const topOffQueueIfNeeded = useCallback(async () => {
    if (queueLoadingMore) return;
    if (!queueHasMore || !queueCursor) return;
    if (queue.length >= PAGE_SIZE) return;

    const slotsRemaining = PAGE_SIZE - queue.length;
    if (slotsRemaining <= 0) return;

    setQueueLoadingMore(true);
    try {
      const nextPage = await adminService.getPendingProfilesPage(slotsRemaining, queueCursor);
      setQueue((prev) => [...prev, ...(nextPage?.items || [])].slice(0, PAGE_SIZE));
      setQueueCursor(nextPage?.nextCursor ?? null);
      setQueueHasMore(!!nextPage?.hasMore);
    } catch (err) {
      console.error('Queue top-off failed:', err);
    } finally {
      setQueueLoadingMore(false);
    }
  }, [queueHasMore, queueCursor, queueLoadingMore, queue.length]);

  const handleReviewAction = useCallback(
    async (action: 'approve' | 'reject') => {
      if (!selectedUser?.id) return;

      const reviewedId = selectedUser.id;
      const remainingAfterRemoval = Math.max(0, queue.length - 1);

      try {
        if (action === 'approve') {
          await adminService.approveProfile(reviewedId);
        } else {
          await adminService.rejectProfile(reviewedId);
        }

        removeReviewedUserFromQueue(reviewedId);
        setSelectedUser(null);
        setActiveModal(null);

        if (remainingAfterRemoval < PAGE_SIZE) {
          await topOffQueueIfNeeded();
        }

        await loadData(true);
      } catch (e: any) {
        dialog.show({
          title: action === 'approve' ? 'Unable to approve' : 'Unable to reject',
          message: e?.message ?? 'Please try again.',
          tone: 'error',
        });
      }
    },
    [selectedUser, queue.length, removeReviewedUserFromQueue, topOffQueueIfNeeded, loadData, dialog]
  );

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

      if (userRole === 'MODERATOR') {
        const data = await moderatorCalendarService.getMyModeratorSlotsForRange(
          start.toISOString(),
          end.toISOString()
        );
        setCalendarSlots(data);
        setSelectedCalendarModeratorId(user.id);
        return;
      }

      if (userRole === 'ADMIN') {
        const moderatorList = await moderatorCalendarService.getActiveModerators();
        setCalendarModerators(moderatorList);

        const effectiveModeratorId =
          selectedCalendarModeratorId &&
          moderatorList.some((m) => m.id === selectedCalendarModeratorId)
            ? selectedCalendarModeratorId
            : moderatorList[0]?.id ?? null;

        setSelectedCalendarModeratorId(effectiveModeratorId);

        if (!effectiveModeratorId) {
          setCalendarSlots([]);
          return;
        }

        const data = await moderatorCalendarService.getModeratorSlotsWithBookingDetails(
          effectiveModeratorId,
          start.toISOString(),
          end.toISOString()
        );

        setCalendarSlots(data);
        return;
      }

      setCalendarSlots([]);
    } catch (e: any) {
      console.error('Calendar load failed:', e);
      if (activeTab === 'CALENDAR') {
        dialog.show({
          title: 'Error',
          message: e?.message ?? 'Failed to load calendar',
          tone: 'error',
        });
      }
    } finally {
      setCalendarLoading(false);
    }
  }, [calendarDay, activeTab, dialog, userRole, selectedCalendarModeratorId]);

  useEffect(() => {
    if (activeTab !== 'CALENDAR') return;

    setCalendarDay(startOfDay(new Date()));
    setRescheduleFromSlotId(null);

    if (userRole !== 'ADMIN') {
      setSelectedCalendarModeratorId(null);
    }
  }, [activeTab, userRole]);

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
      if (!canCreateCalendarSlots) return;

      if (isBeforeDay(calendarDay, today)) {
        dialog.show({
          title: 'Invalid day',
          message: 'You can only open slots from today onward.',
          tone: 'error',
        });
        return;
      }

      if (isAfterDay(calendarDay, maxCalendarDay)) {
        dialog.show({
          title: 'Invalid day',
          message: 'You can only open slots up to 4 weeks ahead.',
          tone: 'error',
        });
        return;
      }

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
      dialog.show({
        title: 'Error',
        message: e.message ?? 'Please try again',
        tone: 'error',
      });
    } finally {
      setCalendarSaving(false);
    }
  }, [
    canCreateCalendarSlots,
    calendarDay,
    today,
    maxCalendarDay,
    slotStartTime,
    slotEndTime,
    calendarDayLabel,
    loadCalendar,
    dialog,
  ]);

  const handleClearPastOpenSlots = useCallback(async () => {
    dialog.show({
      title: 'Clear past open slots?',
      message: 'This will permanently remove only past open slots for you. Booked slots will remain.',
      tone: 'warning',
      actions: [
        { label: 'Cancel', variant: 'secondary' },
        {
          label: 'Clear Past Slots',
          variant: 'danger',
          onPress: async () => {
            try {
              setCalendarSaving(true);

              const count = await moderatorCalendarService.clearPastOpenSlots();

              await loadCalendar();

              toast.show(
                count > 0
                  ? `Removed ${count} past open slot${count === 1 ? '' : 's'}.`
                  : 'No past open slots to clear.',
                'success'
              );
            } catch (e: any) {
              dialog.show({
                title: 'Unable to clear past open slots',
                message: e?.message ?? 'Please try again.',
                tone: 'error',
              });
            } finally {
              setCalendarSaving(false);
            }
          },
        },
      ],
    });
  }, [dialog, loadCalendar, toast]);

  const handleDeleteCalendarSlot = useCallback(
    (slotId: string) => {
      dialog.show({
        title: 'Delete this open slot?',
        message: 'This slot will be removed from the calendar.',
        tone: 'warning',
        actions: [
          { label: 'Cancel', variant: 'secondary' },
          {
            label: 'Delete',
            variant: 'danger',
            onPress: async () => {
              try {
                setCalendarSaving(true);
                await moderatorCalendarService.deleteSlot(slotId);
                await loadCalendar();
                toast.show('The slot has been removed.', 'success');
              } catch (e: any) {
                dialog.show({
                  title: 'Unable to delete slot',
                  message: e?.message ?? 'Please try again.',
                  tone: 'error',
                });
              } finally {
                setCalendarSaving(false);
              }
            },
          },
        ],
      });
    },
    [dialog, loadCalendar, toast]
  );

  const handleBookCalendarSlot = useCallback(
    async (slotId: string) => {
      try {
        setCalendarSaving(true);

        if (rescheduleFromSlotId) {
          await moderatorCalendarService.reschedule(rescheduleFromSlotId, slotId);
          setRescheduleFromSlotId(null);
          toast.show('The booking has been moved.', 'success');
        } else {
          await moderatorCalendarService.bookSlot(slotId);
          toast.show('Booked. The slot has been reserved.', 'success');
        }

        await loadCalendar();
      } catch (e: any) {
        dialog.show({
          title: 'Unable to save',
          message: e.message ?? 'Please try again',
          tone: 'error',
        });
      } finally {
        setCalendarSaving(false);
      }
    },
    [loadCalendar, rescheduleFromSlotId, dialog, toast]
  );

  const handleCancelCalendarSlot = useCallback(
    async (slotId: string) => {
      try {
        setCalendarSaving(true);
        await moderatorCalendarService.cancelBooking(slotId, 'Cancelled from admin dashboard');
        setRescheduleFromSlotId(null);
        await loadCalendar();
        toast.show('Cancelled. The booking has been moved.', 'success');
      } catch (e: any) {
        dialog.show({
          title: 'Unable to cancel',
          message: e?.message ?? 'Please try again',
          tone: 'error',
        });
      } finally {
        setCalendarSaving(false);
      }
    },
    [loadCalendar, dialog, toast]
  );

  const shiftCalendarDay = useCallback(
    (delta: number) => {
      const next = addDays(calendarDay, delta);

      if (isBeforeDay(next, today)) return;
      if (isAfterDay(next, maxCalendarDay)) return;

      setCalendarDay(next);
    },
    [calendarDay, today, maxCalendarDay]
  );

  const renderModeratorCalendar = () => (
    <View style={styles.calendarPage}>
      <View style={styles.calendarHeader}>
        <View style={styles.calendarHeaderCopy}>
          <Text style={styles.settingsTitle}>
            {isCalendarAdmin ? 'Moderator Calendars' : 'Moderator Calendar'}
          </Text>
          <Text style={styles.calendarSubtitle}>
            Toronto, IST, and GMT shown together
          </Text>
        </View>
      </View>

      {isCalendarAdmin ? (
        <View style={styles.calendarModeratorSection}>
          <Text style={styles.calendarModeratorLabel}>Choose Moderator</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.calendarModeratorPillRow}
          >
            {calendarModerators.map((moderator) => {
              const active = moderator.id === selectedCalendarModeratorId;

              return (
                <TouchableOpacity
                  key={moderator.id}
                  style={[
                    styles.calendarModeratorPill,
                    active && styles.calendarModeratorPillActive,
                  ]}
                  onPress={() => {
                    setSelectedCalendarModeratorId(moderator.id);
                    setRescheduleFromSlotId(null);
                  }}
                >
                  <Text
                    style={[
                      styles.calendarModeratorPillText,
                      active && styles.calendarModeratorPillTextActive,
                    ]}
                  >
                    {moderator.full_name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.calendarModeratorHelper}>
            {selectedCalendarModerator
              ? `Showing ${selectedCalendarModerator.full_name}'s calendar`
              : 'No moderators available right now'}
          </Text>
        </View>
      ) : null}

      <View style={styles.calendarDayBar}>
        <TouchableOpacity
          onPress={() => shiftCalendarDay(-1)}
          style={[styles.calendarDayArrow, !canGoCalendarPrev && styles.calendarDayArrowDisabled]}
          disabled={!canGoCalendarPrev}
        >
          <Ionicons
            name="chevron-back"
            size={18}
            color={canGoCalendarPrev ? theme.colors.text : theme.colors.mutedText}
          />
        </TouchableOpacity>

        <View style={styles.calendarDayTextWrap}>
          <Text style={styles.calendarDayText}>{calendarDayLabel}</Text>
          <Text style={styles.calendarDayHint}>Available from today through 4 weeks ahead</Text>
        </View>

        <TouchableOpacity
          onPress={() => shiftCalendarDay(1)}
          style={[styles.calendarDayArrow, !canGoCalendarNext && styles.calendarDayArrowDisabled]}
          disabled={!canGoCalendarNext}
        >
          <Ionicons
            name="chevron-forward"
            size={18}
            color={canGoCalendarNext ? theme.colors.text : theme.colors.mutedText}
          />
        </TouchableOpacity>
      </View>

      {canCreateCalendarSlots ? (
        <View style={styles.slotComposerCard}>
          <Text style={styles.slotComposerTitle}>Create Availability</Text>
          <Text style={styles.slotComposerSub}>
            Add half-hour slots for the selected day in Toronto time.
          </Text>

          <View style={styles.slotComposerGrid}>
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
          </View>

          <View style={styles.slotComposerActions}>
            <TouchableOpacity
              style={styles.calendarCreateBtn}
              onPress={createSlotsForSelectedWindow}
              disabled={calendarSaving}
            >
              <Ionicons name="add-circle-outline" size={18} color={theme.colors.text} />
              <Text style={styles.calendarCreateBtnText}>Add Slots</Text>
            </TouchableOpacity>

            <View style={styles.calendarDangerStack}>
              <TouchableOpacity
                style={styles.calendarDangerBtn}
                onPress={() => {
                  dialog.show({
                    title: 'Clear open slots?',
                    message: `This will remove all unbooked slots for ${calendarDayLabel}. Booked slots will remain.`,
                    tone: 'warning',
                    actions: [
                      { label: 'Cancel', variant: 'secondary' },
                      {
                        label: 'Clear Slots',
                        variant: 'danger',
                        onPress: async () => {
                          try {
                            setCalendarSaving(true);

                            const count = await moderatorCalendarService.clearOpenSlotsForDay(
                              calendarDayLabel,
                              CANADA_TIMEZONE
                            );

                            await loadCalendar();

                            toast.show(
                              `Removed ${count} open slot${count === 1 ? '' : 's'}.`,
                              'success'
                            );
                          } catch (e: any) {
                            dialog.show({
                              title: 'Unable to clear slots',
                              message: e?.message ?? 'Please try again.',
                              tone: 'error',
                            });
                          } finally {
                            setCalendarSaving(false);
                          }
                        },
                      },
                    ],
                  });
                }}
                disabled={calendarSaving}
              >
                <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                <Text style={styles.calendarDangerBtnText}>Clear Open Slots</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.calendarWarnBtn}
                onPress={handleClearPastOpenSlots}
                disabled={calendarSaving}
              >
                <Ionicons name="time-outline" size={18} color="#9A3412" />
                <Text style={styles.calendarWarnBtnText}>Clear Past Open Slots</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : isCalendarAdmin ? (
        <View style={styles.calendarReadOnlyCard}>
          <Text style={styles.calendarReadOnlyTitle}>Read-only view</Text>
          <Text style={styles.calendarReadOnlySub}>
            Admins can inspect all moderator calendars, but only moderators can create or clear slots.
          </Text>
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
                {canCreateCalendarSlots
                  ? 'Create availability for this day to start taking bookings.'
                  : 'No moderator slots are available for this day yet.'}
              </Text>
            </View>
          ) : (
            calendarSlots.map((slot) => {
              const isMine = !!calendarUserId && slot.booked_by_user_id === calendarUserId;

              return (
                <SlotCard
                  key={slot.id}
                  slot={slot}
                  isModerator={isCalendarModerator}
                  isAdmin={isCalendarAdmin}
                  isMine={isMine}
                  onCancel={
                    isCalendarModerator ? () => handleCancelCalendarSlot(slot.id) : undefined
                  }
                  onReschedule={
                    isCalendarModerator ? () => setRescheduleFromSlotId(slot.id) : undefined
                  }
                  onDelete={
                    isCalendarModerator ? () => handleDeleteCalendarSlot(slot.id) : undefined
                  }
                  onWhatsApp={openWhatsApp}
                  onJoinVideo={openVideoRoom}
                  onCopyVideoLink={copyVideoLink}
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

  const { signOut, isSigningOut } = useSignOut({
    redirectTo: '/login',
    onBeforeSignOut: async () => {
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
      toast.show('Success: Test data removed', 'success');
      setActiveModal(null);
    } catch (e: any) {
      toast.show('Success: Test data removed', 'success');
      dialog.show({
        title: 'Error',
        message: e.message,
        tone: 'error',
      });
    } finally {
      setIsProcessing(false);
      setProcessProgress(0);
    }
  }, [loadData, toast, dialog]);

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
                setSettings((prev) => ({ ...prev, themeName: t }));
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

  const renderAdminSearch = () => {
    return (
      <SearchExperience
        mode="ADMIN"
        context={{ role: isSysAdmin ? 'ADMIN' : 'MODERATOR' }}
        gateEnabled={false}
        autoSearchOnMount={true}
        onReport={() =>
          dialog.show({
            title: 'Admin',
            message: 'Use utilities to revoke.',
            tone: 'info',
          })
        }
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
          label="Allow New Member Signups"
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
          label="Inactive User Threshold (Days)"
          value={settings.inactiveUserThresholdDays}
          hint="Users not signed in within this many days will appear in Top Inactive Users."
          onChangeText={(t: string) => {
            const n = clampInt(t, 30, 1, 3650);
            setSettings({ ...settings, inactiveUserThresholdDays: String(n) });
          }}
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
          toast.show('Configuration saved successfully.', 'success');
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
          <Ionicons name="refresh" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
        <SignOutButton
          variant="header"
          onBeforeSignOut={() => setActiveModal(null)}
        />
      </View>

      <View style={styles.scrollContent}>
        <View style={styles.statsRow}>
          <StatCard styles={styles} label="Total Members" value={stats.totalUsers} icon="people" color={theme.colors.primary} />
          <StatCard styles={styles} label="Awaiting Review" value={stats.pendingApprovals} icon="time" color={theme.colors.primary} />
          <StatCard styles={styles} label="Active Reports" value={reports.length} icon="alert-circle" color={theme.colors.danger} />
        </View>

        <View style={styles.mainGrid}>
          <View style={{ flex: 2 }}>
            <SectionHeader styles={styles} title="Verification Queue" />
            <View style={styles.groupCard}>
              <Text style={styles.cardHeader}>Pending Approval ({stats.pendingApprovals})</Text>

              {queue.length === 0 ? (
                <Text style={styles.emptyText}>Queue is currently empty</Text>
              ) : (
                <>
                  {queue.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => {
                        setSelectedUser(item);
                        setActiveModal('REVIEW');
                      }}
                      style={styles.itemRow}
                    >
                      <Text style={{ fontWeight: '600', color: theme.colors.text }}>
                        {item.full_name}
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color={theme.colors.mutedText} />
                    </TouchableOpacity>
                  ))}

                  {queueHasMore && queue.length < PAGE_SIZE ? (
                    <TouchableOpacity
                      style={styles.loadMoreBtn}
                      onPress={loadMoreQueue}
                      disabled={queueLoadingMore}
                    >
                      <Text style={styles.loadMoreBtnText}>
                        {queueLoadingMore ? 'Loading...' : 'Load More'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </>
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
                      setRevokeForm({ ...revokeForm, email: r.targetEmail, fullName: r.targetName || '' });
                      setRevokeComment(r.reason ? `Flagged for: ${r.reason}` : '');
                      setActiveModal('REVOKE_ACCESS');
                    }}
                  >
                    <Text style={styles.banText}>Investigate</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={[styles.groupCard, { marginTop: 20 }]}>
              <Text style={styles.cardHeader}>Deactivated Users ({deactivatedUsers.length})</Text>
              {deactivatedUsers.length === 0 ? (
                <Text style={styles.emptyText}>No deactivated users</Text>
              ) : (
                deactivatedUsers.map((user) => (
                  <View key={user.id} style={styles.itemRow}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={{ fontWeight: '700', color: theme.colors.text }}>
                        {user.full_name || user.email || 'User'}
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.colors.mutedText }}>
                        {user.email || 'No email'}
                      </Text>
                      {!!user.lastActionNote && (
                        <Text style={{ fontSize: 12, color: theme.colors.mutedText, marginTop: 4 }}>
                          {user.lastActionNote}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.banBtn}
                      onPress={() => {
                        setReactivateForm({
                          id: user.id || '',
                          email: user.email || '',
                          fullName: user.full_name || '',
                          note: '',
                        });
                        setActiveModal('REACTIVATE_USER');
                      }}
                    >
                      <Text style={[styles.banText, { color: theme.colors.success ?? theme.colors.primary }]}>
                        Reactivate
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={{ flex: 1.2 }}>
            <SectionHeader styles={styles} title="Quick Actions" />
            <UtilityBtn styles={styles} label="User Explorer" icon="list-circle" color={theme.colors.primary} onPress={() => setActiveModal('USER_REPORT')} />
            <UtilityBtn styles={styles} label="System Analytics" icon="bar-chart" color={theme.colors.success ?? theme.colors.primary} onPress={() => setActiveModal('CHARTS')} />
            <UtilityBtn styles={styles} label="Send Broadcast" icon="megaphone" color={theme.colors.primary} onPress={() => setActiveModal('ANNOUNCEMENT')} />
            <UtilityBtn styles={styles} label="Success Stories" icon="heart" color="#E11D48" onPress={openCreateStory} />

            {isSysAdmin && (
              <>
                <SectionHeader styles={styles} title="Administration" style={{ marginTop: 20, color: theme.colors.danger }} />
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
                <UtilityBtn styles={styles} label="Download CSV" icon="download" color={theme.colors.text} onPress={handleExport} />
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
        <Ionicons name="alert-circle" size={48} color={theme.colors.danger} />
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
      toast.show('Audit log test passed. Row inserted successfully.', 'success');
    } else {
      const message = result?.error || 'Audit log test failed. Check console.';
      dialog.show({
        title: 'Audit Test Failed',
        message,
        tone: 'error',
      });
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

      <Modal visible={activeModal === 'REVIEW'} animationType="slide">
        <View style={styles.modalContentFull}>
          <ModalHeader styles={styles} title="Profile Verification" onClose={() => setActiveModal(null)} />
          <ScrollView>{selectedUser && <ProfileDisplay profile={selectedUser} />}</ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: theme.colors.danger }]}
              onPress={() => handleReviewAction('reject')}
            >
              <Text style={styles.modalBtnText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: theme.colors.success ?? theme.colors.primary }]}
              onPress={() => handleReviewAction('approve')}
            >
              <Text style={styles.modalBtnText}>Approve</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={activeModal === 'USER_REPORT'} animationType="slide">
        <View style={styles.modalContentFull}>
          <ModalHeader styles={styles} title="User Management" onClose={() => setActiveModal(null)} />
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
                toast.show('Broadcast sent', 'success');
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

      <Modal visible={activeModal === 'SUCCESS_STORIES'} animationType="slide">
        <View style={styles.modalContentFull}>
          <ModalHeader
            styles={styles}
            title="Success Stories Manager"
            onClose={() => {
              setActiveModal(null);
              resetStoryForm();
            }}
          />

          <View style={{ flex: 1, flexDirection: Platform.OS === 'web' ? 'row' : 'column' }}>
            <View
              style={{
                width: Platform.OS === 'web' ? 360 : '100%',
                borderRightWidth: Platform.OS === 'web' ? 1 : 0,
                borderColor: '#EEE',
                backgroundColor: '#FAFAFA',
              }}
            >
              <View style={{ padding: 16, borderBottomWidth: 1, borderColor: '#EEE' }}>
                <TouchableOpacity
                  style={[styles.applyBtn, { marginTop: 0 }]}
                  onPress={resetStoryForm}
                >
                  <Text style={styles.applyText}>New Story</Text>
                </TouchableOpacity>
              </View>

              <ScrollView>
                {storiesLoading ? (
                  <ActivityIndicator style={{ marginTop: 20 }} size="small" color="#007AFF" />
                ) : stories.length === 0 ? (
                  <Text style={styles.emptyText}>No success stories yet.</Text>
                ) : (
                  stories.map((story) => (
                    <TouchableOpacity
                      key={story.id}
                      onPress={() => startEditStory(story)}
                      style={[
                        styles.itemRow,
                        editingStoryId === story.id && {
                          backgroundColor: '#EEF6FF',
                          borderLeftWidth: 4,
                          borderLeftColor: '#7B1E3A',
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '800', color: '#111827' }}>{story.title}</Text>
                        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                          {story.wedding_date || 'No wedding date'}
                        </Text>
                        <Text style={{ fontSize: 11, color: story.is_published ? '#16A34A' : '#F59E0B', marginTop: 4 }}>
                          {story.is_published ? 'Published' : 'Draft'}
                          {story.is_featured ? ' • Featured' : ''}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>

            <ScrollView style={{ flex: 1, backgroundColor: '#FFF' }} contentContainerStyle={{ padding: 20 }}>
              <Text style={styles.sectionTitle}>
                {editingStoryId ? 'Edit Story' : 'Create Story'}
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Title"
                value={storyForm.title}
                onChangeText={(t) => setStoryForm({ ...storyForm, title: t })}
              />
              <TextInput
                style={styles.input}
                placeholder="Wedding date (YYYY-MM-DD)"
                value={storyForm.wedding_date}
                onChangeText={(t) => setStoryForm({ ...storyForm, wedding_date: t })}
              />

              <TextInput
                style={[styles.input, { height: 90 }]}
                placeholder="Short description"
                multiline
                value={storyForm.short_description}
                onChangeText={(t) => setStoryForm({ ...storyForm, short_description: t })}
              />

              <TextInput
                style={[styles.input, { height: 100 }]}
                placeholder="Feedback"
                multiline
                value={storyForm.feedback}
                onChangeText={(t) => setStoryForm({ ...storyForm, feedback: t })}
              />

              <TextInput
                style={styles.input}
                placeholder="Sort order"
                keyboardType="numeric"
                value={storyForm.sort_order}
                onChangeText={(t) => setStoryForm({ ...storyForm, sort_order: t })}
              />

              <View style={styles.settingsCard}>
                <SettingsRow
                  styles={styles}
                  label="Published"
                  value={storyForm.is_published}
                  onValueChange={(v: boolean) => setStoryForm({ ...storyForm, is_published: v })}
                />
                <SettingsRow
                  styles={styles}
                  label="Featured"
                  value={storyForm.is_featured}
                  onValueChange={(v: boolean) => setStoryForm({ ...storyForm, is_featured: v })}
                />
              </View>

              <View style={{ gap: 12, marginTop: 20 }}>
                {editingStoryId ? (
                  <View>
                    <TouchableOpacity
                      style={[styles.applyBtn, { marginTop: 0 }]}
                      onPress={handleUploadStoryPhoto}
                      disabled={storiesSaving}
                    >
                      <Text style={styles.applyText}>
                        {storyForm.photo_url ? 'Replace Photo' : 'Upload Photo'}
                      </Text>
                    </TouchableOpacity>

                    {storyForm.photo_url ? (
                      <View style={{ marginTop: 12 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 8 }}>
                          Photo Preview
                        </Text>
                        <Image
                          source={{ uri: storyForm.photo_url }}
                          style={{ width: 180, height: 180, borderRadius: 16, backgroundColor: '#EEE' }}
                          resizeMode="cover"
                        />
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '600' }}>
                    Create the story first, then upload a photo.
                  </Text>
                )}

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    style={[styles.applyBtn, { flex: 1, marginTop: 0 }]}
                    onPress={handleSaveStory}
                    disabled={storiesSaving}
                  >
                    <Text style={styles.applyText}>
                      {storiesSaving ? 'Saving...' : editingStoryId ? 'Update Story' : 'Create Story'}
                    </Text>
                  </TouchableOpacity>

                  {editingStoryId ? (
                    <TouchableOpacity
                      style={[styles.applyBtn, { flex: 1, marginTop: 0, backgroundColor: '#DC2626' }]}
                      onPress={() => handleDeleteStory(editingStoryId)}
                      disabled={storiesSaving}
                    >
                      <Text style={styles.applyText}>Delete</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </ScrollView>
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
                  dialog.show({
                    title: 'Data incomplete',
                    message: 'Please enter both full name and email.',
                    tone: 'error',
                  });
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
            <Text style={[styles.modalTitle, { color: theme.colors.danger }]}>Deactivate User</Text>
            <TextInput style={styles.input} placeholder="User Email" value={revokeForm.email} onChangeText={(t) => setRevokeForm({ ...revokeForm, email: t })} />
            <TextInput
              style={[styles.input, { height: 96 }]}
              placeholder="Comment about what happened"
              value={revokeComment}
              onChangeText={setRevokeComment}
              multiline
            />
            <TouchableOpacity
              style={[styles.applyBtn, { backgroundColor: theme.colors.danger }]}
              onPress={async () => {
                try {
                  await adminService.revokeAccess(revokeForm.email, revokeComment);
                  toast.show('User was deactivated.', 'success');
                  setRevokeComment('');
                  setActiveModal(null);
                  await loadData(true);
                } catch (e: any) {
                  dialog.show({
                    title: 'Unable to deactivate',
                    message: e?.message ?? 'Please try again.',
                    tone: 'error',
                  });
                }
              }}
            >
              <Text style={styles.applyText}>Deactivate Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setRevokeComment('');
                setActiveModal(null);
              }}
            >
              <Text style={styles.cancelText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={activeModal === 'REACTIVATE_USER'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.utilityModal}>
            <Text style={[styles.modalTitle, { color: theme.colors.success ?? theme.colors.primary }]}>Reactivate User</Text>
            <TextInput
              style={styles.input}
              placeholder="User Email"
              value={reactivateForm.email}
              onChangeText={(t) => setReactivateForm((prev) => ({ ...prev, email: t }))}
            />
            <TextInput
              style={[styles.input, { height: 96 }]}
              placeholder="Comment about resolution"
              value={reactivateForm.note}
              onChangeText={(t) => setReactivateForm((prev) => ({ ...prev, note: t }))}
              multiline
            />
            <TouchableOpacity
              style={[styles.applyBtn, { backgroundColor: theme.colors.success ?? theme.colors.primary }]}
              onPress={async () => {
                try {
                  await adminService.reactivateUser(reactivateForm.email, reactivateForm.note);
                  toast.show('User was reactivated.', 'success');
                  setReactivateForm({ id: '', email: '', fullName: '', note: '' });
                  setActiveModal(null);
                  await loadData(true);
                } catch (e: any) {
                  dialog.show({
                    title: 'Unable to reactivate',
                    message: e?.message ?? 'Please try again.',
                    tone: 'error',
                  });
                }
              }}
            >
              <Text style={styles.applyText}>Reactivate Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setReactivateForm({ id: '', email: '', fullName: '', note: '' });
                setActiveModal(null);
              }}
            >
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
                      dialog.show({
                        title: 'Error',
                        message: e.message,
                        tone: 'error',
                      });
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
                    dialog.show({
                      title: 'Purge test profiles?',
                      message: 'Delete all test profiles?',
                      tone: 'warning',
                      actions: [
                        { label: 'Cancel', variant: 'secondary' },
                        { label: 'Purge', variant: 'danger', onPress: handleDeleteTestUsers },
                      ],
                    });
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
          <ModalHeader styles={styles} title="System Audit Logs" onClose={() => setActiveModal(null)} />
          <AuditLogScreen />
        </View>
      </Modal>

      <Modal visible={activeModal === 'CHARTS'} animationType="slide">
        <View style={styles.modalContentFull}>
          <ModalHeader styles={styles} title="Data Analytics" onClose={() => setActiveModal(null)} />
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
      color={active ? (theme?.colors?.text ?? '#11181C') : (theme?.colors?.mutedText ?? '#6B7280')}
    />
    <Text style={[styles.sidebarLabel, active && styles.sidebarLabelActive]}>{label}</Text>
  </TouchableOpacity>
);

const StatCard = ({ label, value, icon, color, styles }: any) => {
  const safeValue = value ?? 0;
  const displayValue = typeof safeValue === 'number' ? safeValue.toLocaleString() : String(safeValue);

  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={24} color={color} />
      <View style={{ marginLeft: 15 }}>
        <Text style={styles.statValue}>{displayValue}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
};

const UtilityBtn = ({ label, icon, color, onPress, styles }: any) => (
  <TouchableOpacity style={styles.utilBtn} onPress={onPress}>
    <Ionicons name={icon} size={18} color={color} />
    <Text style={styles.utilLabel}>{label}</Text>
  </TouchableOpacity>
);

const ModalHeader = ({ title, onClose, styles }: any) => (
  <View style={styles.modalHeader}>
    <Text style={{ fontWeight: '800', fontSize: 16, color: '#111827' }}>{title}</Text>
    <TouchableOpacity onPress={onClose}>
      <Ionicons name="close" size={28} color="#111827" />
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
    <View
      style={{
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
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
            borderColor: '#E8D5C4',
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

const SectionHeader = ({ title, style, styles }: any) => (
  <Text style={[styles.sectionTitle, style]}>{title}</Text>
);

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

    loadMoreBtn: {
      margin: 15,
      marginTop: 8,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: surface2,
      alignItems: 'center',
    },
    loadMoreBtnText: {
      color: text,
      fontSize: 12,
      fontWeight: '800',
    },

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
    slotComposerRow: {
      flexDirection: Platform.OS === 'web' ? 'row' : 'column',
      gap: 12,
      marginTop: 14,
      alignItems: Platform.OS === 'web' ? 'flex-end' : 'stretch',
    },
    dangerBtnText: {
      color: '#BE123C',
      fontWeight: '700',
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

    calendarPage: {
      flex: 1,
      padding: Platform.OS === 'web' ? 32 : 18,
      backgroundColor: bg,
    },

    calendarHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 18,
      gap: 16,
      flexWrap: 'wrap',
    },

    calendarHeaderCopy: {
      flexShrink: 1,
      minWidth: 0,
    },

    calendarSubtitle: {
      marginTop: 6,
      fontSize: 13,
      fontWeight: '700',
      color: muted,
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

    calendarDayArrowDisabled: {
      opacity: 0.5,
    },

    calendarDayTextWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 0,
      flexShrink: 1,
      paddingHorizontal: 6,
    },

    calendarDayText: {
      fontSize: 16,
      fontWeight: '800',
      color: text,
      textAlign: 'center',
    },

    calendarDayHint: {
      marginTop: 4,
      fontSize: 12,
      color: muted,
      fontWeight: '700',
      textAlign: 'center',
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

    slotComposerGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 14,
    },

    slotTimeField: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 220,
      minWidth: 160,
    },

    slotTimeLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: muted,
      marginBottom: 6,
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
      width: '100%',
    },

    slotTimeInputText: {
      fontSize: 14,
      fontWeight: '800',
      color: text,
    },

    slotComposerActions: {
      marginTop: 14,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      alignItems: 'flex-start',
    },

    calendarCreateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 48,
      minWidth: 150,
      flexShrink: 1,
    },

    calendarCreateBtnText: {
      fontWeight: '800',
      color: text,
      fontSize: 13,
      textAlign: 'center',
    },

    calendarDangerStack: {
      flexDirection: 'column',
      gap: 10,
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 220,
    },

    calendarDangerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: danger,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 48,
      width: '100%',
    },

    calendarDangerBtnText: {
      fontWeight: '800',
      color: danger,
      fontSize: 13,
      textAlign: 'center',
    },

    calendarWarnBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#FDBA74',
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 48,
      width: '100%',
    },

    calendarWarnBtnText: {
      fontWeight: '800',
      color: '#9A3412',
      fontSize: 13,
      textAlign: 'center',
    },

    calendarModeratorSection: {
      marginBottom: 14,
    },

    calendarModeratorLabel: {
      fontSize: 13,
      fontWeight: '800',
      color: text,
      marginBottom: 8,
    },

    calendarModeratorPillRow: {
      gap: 8,
      paddingRight: 10,
    },

    calendarModeratorPill: {
      backgroundColor: surface2,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },

    calendarModeratorPillActive: {
      backgroundColor: primary,
      borderColor: primary,
    },

    calendarModeratorPillText: {
      color: text,
      fontWeight: '700',
    },

    calendarModeratorPillTextActive: {
      color: surface2,
    },

    calendarModeratorHelper: {
      marginTop: 8,
      color: muted,
      fontSize: 13,
      fontWeight: '600',
    },

    calendarReadOnlyCard: {
      backgroundColor: surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: border,
      padding: 18,
      marginBottom: 18,
    },

    calendarReadOnlyTitle: {
      fontSize: 15,
      fontWeight: '900',
      color: text,
    },

    calendarReadOnlySub: {
      marginTop: 6,
      fontSize: 12,
      fontWeight: '700',
      color: muted,
      lineHeight: 18,
    },
  });
}