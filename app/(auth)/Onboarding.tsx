import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Dropdown } from 'react-native-element-dropdown';
import { Country, State, City } from 'country-state-city';

import { supabase } from '../../src/lib/supabase';
import { ProfileDisplay } from '../../src/components/ProfileDisplay';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import { ExpectationsQuestionnaire } from '@/src/components/ExpectationsQuestionnaire';
import { useDialog } from '@/src/ui/feedback/useDialog';
import { useToast } from '@/src/ui/feedback/useToast';
import { mapAuthError } from '@/src/features/auth/authMessageMapper';
import StatusBanner from '@/src/components/ui/StatusBanner';
import SignOutButton from '../../src/components/SignOutButton';
import SuggestionInput from '@/src/components/form/SuggestionInput';
import { getSystemConfig } from '../../src/services/systemConfig.service';

import {
  GENDER_DATA,
  RESIDENT_STATUS_DATA,
  EDUCATION_DATA,
  FIELD_OF_STUDY_DATA,
  KOVIL_DATA,
  RASI_DATA,
  NAKSHATRA_DATA,
  NATIVE_PLACES_DATA,
  PROFESSION_DATA,
  HEIGHT_DATA,
  INTEREST_DATA,
  MARITAL_STATUS_DATA,
  OCCUPATION_DATA,
} from '../../src/constants/appData';

const TOTAL_STEPS = 8;
const DRAFT_KEY = 'NN_ONBOARDING_DRAFT_V2';
const SIB_MARITAL_DATA = [...MARITAL_STATUS_DATA];
const OCC_DATA = [...OCCUPATION_DATA];

const INITIAL_FORM_DATA = {
  fullName: '',
  gender: '',
  dob: '',
  height: '',
  phone: '',
  email: '',
  maritalStatus: 'Never Married',
  citizenship: '',
  residentCountry: '',
  residentStatus: '',
  currentState: '',
  currentCity: '',

  education_history: [{ level: '', field: '', university: '' }],
  profession: '',
  workplace: '',
  linkedinProfile: '',

  nativePlace: '',
  familyInitials: '',
  fatherName: '',
  fatherWork: '',
  fatherPhone: '',
  motherName: '',
  motherWork: '',
  motherPhone: '',
  familyDetails: {
    siblings: [] as Array<{ name: string; maritalStatus: string; occupation: string }>,
  },

  kovil: '',
  pirivu: '',
  rasi: '',
  star: '',
  interests: [] as string[],
  expectations: '',
  profilePhotoUrl: '',
};

const STEP_META = [
  { title: 'Personal Details', helper: 'Let’s start with the basics — quick and easy.' },
  { title: 'Location & Residency', helper: 'Where you live helps matches connect better.' },
  { title: 'Professional Profile', helper: 'A little work and education context goes a long way.' },
  { title: 'Cultural Identity', helper: 'Traditional details valued by many families.' },
  { title: 'Family Lineage', helper: 'Family details help create meaningful introductions.' },
  { title: 'Profile Photo', helper: 'A clear photo builds trust.' },
  { title: 'Interests & Expectations', helper: 'Share what you love and what you’re looking for.' },
  { title: 'Final Review', helper: 'Almost done — take a quick look before submitting.' },
];

const REQUIRED_BY_STEP: Record<number, string[]> = {
  1: ['fullName', 'phone', 'dob', 'maritalStatus', 'gender', 'height'],
  2: ['citizenship', 'residentCountry', 'currentState', 'residentStatus'],
  3: ['profession', 'workplace'],
  4: ['kovil', 'rasi', 'star', 'nativePlace', 'familyInitials'],
  5: ['fatherName', 'motherName'],
  6: ['profilePhotoUrl'],
};

const INTEREST_HINTS: Record<string, string> = {
  'Fitness & Wellness': 'Gym, yoga, walking, running, pilates',
  'Travel & Outdoors': 'Travel, hiking, camping, trekking',
  'Food & Cooking': 'Cooking, baking, trying new cuisines',
  'Arts & Creativity': 'Music, painting, photography, writing',
  'Music & Entertainment': 'Music, movies, dance, concerts',
  'Reading & Learning': 'Reading, learning, personal growth',
  'Sports & Games': 'Cricket, tennis, chess, board games',
  'Community & Service': 'Volunteering, mentoring, community involvement',
  'Mindfulness & Spirituality': 'Meditation, reflection, spiritual activities',
  'Home & Lifestyle': 'Gardening, homemaking, collecting, home projects',
};

function isBlank(value: unknown) {
  if (Array.isArray(value)) return value.length === 0;
  return String(value ?? '').trim() === '';
}

const FormInput = ({
  styles,
  theme,
  label,
  k,
  placeholder,
  required,
  keyboardType,
  multiline,
  style,
  value,
  onChangeText,
  missing,
}: any) => (
  <View style={[styles.inputGroup, style]}>
    <Text style={styles.label}>
      {label}{' '}
      {required ? <Text style={styles.reqStar}>*</Text> : <Text style={styles.optTag}>(Optional)</Text>}
    </Text>
    <TextInput
      style={[
        styles.standardInput,
        missing?.[k] && styles.inputError,
        multiline && { height: 120, textAlignVertical: 'top', paddingTop: 12 },
      ]}
      value={value}
      multiline={multiline}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.mutedText}
      keyboardType={keyboardType}
    />
  </View>
);

const FormDropdown = ({
  styles,
  theme,
  label,
  data,
  k,
  placeholder,
  required,
  onSelect,
  style,
  value,
  missing,
}: any) => (
  <View style={[styles.inputGroup, style]}>
    <Text style={styles.label}>
      {label}{' '}
      {required ? <Text style={styles.reqStar}>*</Text> : <Text style={styles.optTag}>(Optional)</Text>}
    </Text>
    <Dropdown
      style={[styles.dropdown, missing?.[k] && styles.inputError]}
      data={data || []}
      search
      labelField="label"
      valueField="value"
      placeholder={placeholder}
      placeholderStyle={{ color: theme.colors.mutedText, fontWeight: '700' }}
      selectedTextStyle={{ color: theme.colors.text, fontWeight: '800' }}
      inputSearchStyle={{
        borderRadius: theme.radius?.input ?? 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingHorizontal: 10,
        color: theme.colors.text,
      }}
      activeColor={theme.colors.surface}
      itemTextStyle={{ color: theme.colors.text }}
      value={value}
      onChange={onSelect}
    />
  </View>
);

export default function Onboarding() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const radiusInput = theme?.radius?.input ?? 12;
  const dialog = useDialog();
  const toast = useToast();

  const webDateStyle = useMemo(
    () =>
      ({
        height: 46,
        borderRadius: radiusInput,
        border: `1px solid ${theme.colors.border}`,
        padding: '0 12px',
        fontSize: 14,
        width: '100%',
        backgroundColor: theme.colors.inputBg,
        color: theme.colors.text,
        outline: 'none',
      }) as any,
    [radiusInput, theme.colors.border, theme.colors.inputBg, theme.colors.text],
  );

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoPreviewUri, setPhotoPreviewUri] = useState('');
  const [missing, setMissing] = useState<Record<string, boolean>>({});
  const [filterCodes, setFilterCodes] = useState({ country: '', state: '' });
  const [isReady, setIsReady] = useState(false);
  const [formData, setFormData] = useState<any>(INITIAL_FORM_DATA);
  const [draftRestored, setDraftRestored] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusTone, setStatusTone] = useState<'info' | 'success' | 'error' | 'warning'>('info');
  const [openInterestHint, setOpenInterestHint] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const validateSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!alive) return;

        if (!session?.user?.id) {
          dialog.show({
            title: 'Session expired',
            message: 'Please sign in again to continue your onboarding.',
            tone: 'error',
            actions: [
              {
                label: 'Go to Sign In',
                variant: 'primary',
                onPress: () => router.replace('/(auth)/login'),
              },
            ],
          });
          return;
        }

        setFormData((prev: any) => {
          if (prev?.email) return prev;
          return { ...prev, email: session.user.email || '' };
        });
      } catch {
        if (!alive) return;
        router.replace('/(auth)/login');
      }
    };

    void validateSession();

    return () => {
      alive = false;
    };
  }, [dialog, router]);

  useEffect(() => {
    let alive = true;

    const loadDraft = async () => {
      try {
        const savedDraft = await AsyncStorage.getItem(DRAFT_KEY);
        if (!alive) return;

        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          setFormData(parsed?.formData || INITIAL_FORM_DATA);
          setStep(parsed?.step || 1);
          setFilterCodes(parsed?.filterCodes || { country: '', state: '' });
          setDraftRestored(true);
          setStatusMessage('Your saved draft was restored on this device.');
          setStatusTone('info');
        }
      } catch (e) {
        console.error('Failed to load draft:', e);
      } finally {
        if (alive) setIsReady(true);
      }
    };

    void loadDraft();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;

    let alive = true;

    const hydrateAuthEmail = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!alive) return;

        const authEmail = user?.email || '';
        if (!authEmail) return;

        setFormData((prev: any) => {
          if (prev?.email) return prev;
          return { ...prev, email: authEmail };
        });
      } catch {
        // silent
      }
    };

    void hydrateAuthEmail();

    return () => {
      alive = false;
    };
  }, [isReady]);

  useEffect(() => {
    if (!isReady) return;

    const saveDraft = async () => {
      try {
        const draft = JSON.stringify({ step, formData, filterCodes });
        await AsyncStorage.setItem(DRAFT_KEY, draft);
      } catch (e) {
        console.error('Failed to save draft:', e);
      }
    };

    void saveDraft();
  }, [step, formData, filterCodes, isReady]);

  useEffect(() => {
    const countryName = String(formData?.residentCountry || '');
    const stateName = String(formData?.currentState || '');

    const countryIso =
      Country.getAllCountries().find((c) => c.name === countryName)?.isoCode || '';

    const stateIso =
      countryIso
        ? State.getStatesOfCountry(countryIso).find((s) => s.name === stateName)?.isoCode || ''
        : '';

    setFilterCodes((prev) => {
      if (prev.country === countryIso && prev.state === stateIso) return prev;
      return { country: countryIso, state: stateIso };
    });
  }, [formData?.residentCountry, formData?.currentState]);

  useEffect(() => {
    setFormData((prev: any) => {
      if (!prev?.currentState && prev?.currentCity) {
        return { ...prev, currentCity: '' };
      }
      return prev;
    });
  }, [filterCodes.country, filterCodes.state]);

  const selectedKovilObj = KOVIL_DATA.find(
    (k: any) => k.value === formData.kovil || k.label === formData.kovil,
  );
  const hasPirivus = !!selectedKovilObj?.pirivus?.length;

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      dialog.show({
        title: 'Permission needed',
        message: 'We need access to your gallery to attach a profile photo.',
        tone: 'warning',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setPhotoPreviewUri(asset.uri);
    await uploadPhoto(asset);
  };

  const resetOnboarding = async () => {
    dialog.show({
      title: 'Reset All Progress?',
      message:
        'This will delete your current draft and take you back to Step 1. This is recommended if you are seeing errors.',
      tone: 'warning',
      actions: [
        { label: 'Cancel', variant: 'secondary' },
        {
          label: 'Yes, Start Over',
          variant: 'danger',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(DRAFT_KEY);
              setFormData(INITIAL_FORM_DATA);
              setPhotoPreviewUri('');
              setStep(1);
              setMissing({});
              setFilterCodes({ country: '', state: '' });
              setDraftRestored(false);
              setOpenInterestHint(null);
              setStatusMessage('Your draft has been cleared. You are back at Step 1.');
              setStatusTone('success');
              toast.show('Draft cleared successfully.', 'success');
            } catch (e) {
              console.error('Reset failed:', e);
              dialog.show({
                title: 'Reset failed',
                message: 'We could not clear your draft right now. Please try again.',
                tone: 'error',
              });
            }
          },
        },
      ],
    });
  };

  const uploadPhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      dialog.show({
        title: 'Session expired',
        message: 'Please sign in again before uploading your photo.',
        tone: 'error',
        actions: [
          {
            label: 'Go to Sign In',
            variant: 'primary',
            onPress: () => router.replace('/(auth)/login'),
          },
        ],
      });
      return;
    }

    setUploading(true);

    try {
      const mimeType = (asset as any).mimeType || 'image/jpeg';
      const fileExt =
        mimeType.split('/')[1] ||
        asset.fileName?.split('.').pop()?.toLowerCase() ||
        'jpg';

      const safeExt = fileExt === 'jpeg' ? 'jpg' : fileExt;
      const path = `${user.id}/profile-${Date.now()}.${safeExt}`;

      let uploadBody: ArrayBuffer | File | Blob;

      if (Platform.OS === 'web' && (asset as any).file) {
        uploadBody = (asset as any).file;
      } else {
        const response = await fetch(asset.uri);
        uploadBody = await response.arrayBuffer();
      }

      const { error } = await supabase.storage.from('profiles').upload(path, uploadBody, {
        contentType: mimeType,
        upsert: true,
      });

      if (error) throw error;

      const { data: publicData } = supabase.storage.from('profiles').getPublicUrl(path);
      const finalUrl = `${publicData.publicUrl}?t=${Date.now()}`;

      setFormData((prev: any) => ({
        ...prev,
        profilePhotoUrl: finalUrl,
      }));

      setMissing((prev) => ({
        ...prev,
        profilePhotoUrl: false,
      }));

      setStatusMessage('Photo attached successfully.');
      setStatusTone('success');
      toast.show('Photo attached successfully.', 'success');
    } catch (e: any) {
      console.error('UPLOAD FAILED:', e);
      const ui = mapAuthError(e, 'submit');
      dialog.show({
        title: 'Upload Failed',
        message: e?.message || ui.message || 'Unable to upload image.',
        tone: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    const config = await getSystemConfig();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      dialog.show({
        title: 'Session expired',
        message: 'Please sign in again before submitting your profile.',
        tone: 'error',
        actions: [
          {
            label: 'Go to Sign In',
            variant: 'primary',
            onPress: () => router.replace('/(auth)/login'),
          },
        ],
      });
      return;
    }

    setLoading(true);

    try {
      const dbPayload = {
        id: user.id,
        full_name: formData.fullName,
        gender: formData.gender,
        dob: formData.dob,
        height: formData.height,
        phone: formData.phone,
        email: formData.email || user.email || '',
        marital_status: formData.maritalStatus,
        citizenship: formData.citizenship,
        resident_country: formData.residentCountry,
        resident_status: formData.residentStatus,
        current_state: formData.currentState,
        current_city: formData.currentCity,
        profession: formData.profession,
        workplace: formData.workplace,
        linkedin_profile: formData.linkedinProfile,
        native_place: formData.nativePlace,
        family_initials: formData.familyInitials,
        father_name: formData.fatherName,
        father_work: formData.fatherWork,
        father_phone: formData.fatherPhone,
        mother_name: formData.motherName,
        mother_work: formData.motherWork,
        mother_phone: formData.motherPhone,
        kovil: formData.kovil,
        pirivu: formData.pirivu,
        rasi: formData.rasi,
        star: formData.star,
        expectations: formData.expectations,
        profile_photo_url: formData.profilePhotoUrl,
        education_history: formData.education_history || [],
        family_details: formData.familyDetails || { siblings: [] },
        interests: Array.isArray(formData.interests) ? formData.interests : [],
        hide_phone: false,
        hide_email: false,
        is_submitted: true,
        is_approved: !config.requireApproval,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('profiles').upsert(dbPayload, { onConflict: 'id' });
      if (error) throw error;

      await AsyncStorage.removeItem(DRAFT_KEY);
      setPhotoPreviewUri('');
      toast.show('Profile submitted successfully.', 'success');

      if (config.requireApproval) {
        router.replace('/(auth)/PendingApproval');
      } else {
        router.replace('/(tabs)/search');
      }
    } catch (e: any) {
      console.error('Submission Error:', e);
      const ui = mapAuthError(e, 'submit');
      dialog.show({
        title: 'Submission Failed',
        message: e?.message || ui.message || 'Check your network or database schema.',
        tone: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

    const toggleInterest = (interest: string) => {
    setFormData((prev: any) => {
      const current = Array.isArray(prev.interests) ? prev.interests : [];
      const exists = current.includes(interest);

      return {
        ...prev,
        interests: exists
          ? current.filter((item: string) => item !== interest)
          : [...current, interest],
      };
    });
  };

  const nextStep = () => {
    const required = REQUIRED_BY_STEP[step] || [];
    const missMap: Record<string, boolean> = {};

    required.forEach((k) => {
      if (isBlank(formData[k])) missMap[k] = true;
    });

    if (Object.keys(missMap).length > 0) {
      setMissing((prev) => ({ ...prev, ...missMap }));
      setStatusMessage('Please complete the highlighted fields before continuing.');
      setStatusTone('warning');
      return;
    }

    setMissing({});
    setStatusMessage('');
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const progressPct = Math.round((step / TOTAL_STEPS) * 100);

  if (!isReady) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color={theme.colors.text} />;
  }

  return (
    <View style={styles.webSafeContainer}>
      <View style={styles.progressHeader}>
        <View style={styles.progressTopRow}>
          <Text style={styles.stepText}>
            Step {step} of {TOTAL_STEPS} ({progressPct}%)
          </Text>

          <View style={styles.headerActions}>
            <TouchableOpacity onPress={resetOnboarding} style={styles.resetBtn} activeOpacity={0.85}>
              <Ionicons name="refresh-circle" size={16} color={theme.colors.danger} />
              <Text style={styles.resetBtnText}>RESET</Text>
            </TouchableOpacity>

            <SignOutButton variant="row" label="SAVE & LOGOUT" style={styles.signOutBtn} />
          </View>
        </View>

        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
        </View>

        <View style={{ marginTop: 6 }}>
          <Text style={styles.headerTitle}>{STEP_META[step - 1]?.title}</Text>
          <Text style={styles.helperText}>{STEP_META[step - 1]?.helper}</Text>
        </View>
      </View>

      <ScrollView style={styles.contentScroller} contentContainerStyle={styles.scrollArea}>
        {!!statusMessage && <StatusBanner theme={theme} tone={statusTone} text={statusMessage} />}

        {draftRestored && !statusMessage && (
          <StatusBanner
            theme={theme}
            tone="info"
            text="Your saved draft was restored on this device."
          />
        )}

        <View style={styles.sectionCard}>
          {step === 1 && (
            <View>
              <View style={styles.rowGrid}>
                <FormInput
                  styles={styles}
                  theme={theme}
                  label="Full Name"
                  k="fullName"
                  value={formData.fullName}
                  missing={missing}
                  onChangeText={(v: any) => setFormData((prev: any) => ({ ...prev, fullName: v }))}
                  required
                  style={{ flex: 2.5 }}
                />

                <FormInput
                  styles={styles}
                  theme={theme}
                  label="Phone"
                  k="phone"
                  value={formData.phone}
                  missing={missing}
                  onChangeText={(v: any) => setFormData((prev: any) => ({ ...prev, phone: v }))}
                  required
                  keyboardType="phone-pad"
                  style={{ flex: 1.5, marginLeft: 12 }}
                />
              </View>

              <View style={styles.rowGrid}>
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.label}>
                    Date of Birth <Text style={styles.reqStar}>*</Text>
                  </Text>

                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      value={formData.dob}
                      style={webDateStyle}
                      onChange={(e: any) =>
                        setFormData((prev: any) => ({ ...prev, dob: e.target.value }))
                      }
                    />
                  ) : (
                    <TextInput
                      style={[styles.standardInput, missing?.dob && styles.inputError]}
                      value={formData.dob}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={theme.colors.mutedText}
                      onChangeText={(v) => setFormData((prev: any) => ({ ...prev, dob: v }))}
                    />
                  )}
                </View>

                <FormDropdown
                  styles={styles}
                  theme={theme}
                  label="Gender"
                  k="gender"
                  value={formData.gender}
                  data={GENDER_DATA}
                  missing={missing}
                  onSelect={(item: any) => setFormData((prev: any) => ({ ...prev, gender: item.value }))}
                  required
                  style={{ flex: 0.8, marginLeft: 12 }}
                />

                <FormDropdown
                  styles={styles}
                  theme={theme}
                  label="Height"
                  k="height"
                  value={formData.height}
                  data={HEIGHT_DATA}
                  missing={missing}
                  onSelect={(item: any) => setFormData((prev: any) => ({ ...prev, height: item.value }))}
                  required
                  style={{ flex: 1, marginLeft: 12 }}
                />
              </View>

              <FormDropdown
                styles={styles}
                theme={theme}
                label="Marital Status"
                k="maritalStatus"
                value={formData.maritalStatus}
                data={MARITAL_STATUS_DATA}
                missing={missing}
                onSelect={(item: any) =>
                  setFormData((prev: any) => ({ ...prev, maritalStatus: item.value }))
                }
                required
                style={{ marginTop: 12 }}
              />
            </View>
          )}

          {step === 2 && (
            <View>
              <FormDropdown
                styles={styles}
                theme={theme}
                label="Citizenship"
                k="citizenship"
                value={formData.citizenship}
                data={Country.getAllCountries().map((c) => ({ label: c.name, value: c.name }))}
                missing={missing}
                onSelect={(item: any) =>
                  setFormData((prev: any) => ({ ...prev, citizenship: item.value }))
                }
                required
              />

              <FormDropdown
                styles={styles}
                theme={theme}
                label="Resident Country"
                k="residentCountry"
                value={formData.residentCountry}
                data={Country.getAllCountries().map((c) => ({ label: c.name, value: c.name }))}
                missing={missing}
                onSelect={(i: any) => {
                  const iso =
                    Country.getAllCountries().find((c) => c.name === i.value)?.isoCode || '';
                  setFilterCodes({ country: iso, state: '' });
                  setFormData((prev: any) => ({
                    ...prev,
                    residentCountry: i.value,
                    currentState: '',
                    currentCity: '',
                  }));
                }}
                required
              />

              <FormDropdown
                styles={styles}
                theme={theme}
                label="Resident State/Province"
                k="currentState"
                value={formData.currentState}
                data={State.getStatesOfCountry(filterCodes.country).map((s) => ({
                  label: s.name,
                  value: s.name,
                }))}
                missing={missing}
                placeholder={filterCodes.country ? 'Select State' : 'Select Country First'}
                onSelect={(i: any) => {
                  const stateIso =
                    State.getStatesOfCountry(filterCodes.country).find((s) => s.name === i.value)
                      ?.isoCode || '';
                  setFilterCodes((prev) => ({ ...prev, state: stateIso }));
                  setFormData((prev: any) => ({
                    ...prev,
                    currentState: i.value,
                    currentCity: '',
                  }));
                }}
                required
              />

              <FormInput
                styles={styles}
                theme={theme}
                label="Resident City"
                k="currentCity"
                value={formData.currentCity}
                missing={missing}
                placeholder="Type your city"
                onChangeText={(v: any) =>
                  setFormData((prev: any) => ({ ...prev, currentCity: v }))
                }
              />

              {filterCodes.country && filterCodes.state
                ? (() => {
                    const cities = City.getCitiesOfState(filterCodes.country, filterCodes.state) || [];
                    const topCities = cities.slice(0, 10);
                    if (topCities.length === 0) return null;

                    return (
                      <View style={{ marginTop: -10, marginBottom: 15, paddingHorizontal: 4 }}>
                        <Text style={[styles.label, { fontSize: 10, marginBottom: 8 }]}>Suggestions</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {topCities.map((c) => (
                            <TouchableOpacity
                              key={c.name}
                              onPress={() =>
                                setFormData((prev: any) => ({ ...prev, currentCity: c.name }))
                              }
                              style={[
                                styles.inlineAddBtn,
                                formData.currentCity === c.name && {
                                  borderColor: theme.colors.primary,
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: '700',
                                  color: theme.colors.text,
                                }}
                              >
                                {c.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    );
                  })()
                : null}

              <FormDropdown
                styles={styles}
                theme={theme}
                label="Resident Status"
                k="residentStatus"
                value={formData.residentStatus}
                data={RESIDENT_STATUS_DATA}
                missing={missing}
                onSelect={(item: any) =>
                  setFormData((prev: any) => ({ ...prev, residentStatus: item.value }))
                }
                required
              />
            </View>
          )}

          {step === 3 && (
            <View>
              <View style={styles.siblingHeader}>
                <Text style={styles.label}>Education History</Text>
                <TouchableOpacity
                  onPress={() => {
                    const currentEdu = formData.education_history || [];
                    const updated = [...currentEdu, { level: '', field: '', university: '' }];
                    setFormData((prev: any) => ({ ...prev, education_history: updated }));
                  }}
                  style={styles.inlineAddBtn}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle" size={18} color={theme.colors.text} />
                  <Text style={styles.addBtnText}>Add Degree</Text>
                </TouchableOpacity>
              </View>

              {(formData.education_history || []).map((edu: any, i: number) => {
                const fieldQuery = String(edu.field || '').trim().toLowerCase();

                const fieldSuggestions = FIELD_OF_STUDY_DATA.filter((f: any) => {
                  const label = String(f?.label ?? '').toLowerCase();
                  const value = String(f?.value ?? '').toLowerCase();
                  return !fieldQuery || label.includes(fieldQuery) || value.includes(fieldQuery);
                });

                return (
                  <View key={i} style={styles.compactFormBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Dropdown
                        style={[styles.dropdown, { flex: 1 }]}
                        data={EDUCATION_DATA}
                        labelField="label"
                        valueField="value"
                        placeholder="Level"
                        placeholderStyle={{ color: theme.colors.mutedText, fontWeight: '700' }}
                        selectedTextStyle={{ color: theme.colors.text, fontWeight: '800' }}
                        value={edu.level}
                        onChange={(item: any) => {
                          setFormData((prev: any) => {
                            const updated = [...(prev.education_history || [])];
                            const previousLevel = updated[i]?.level || '';

                            updated[i] = {
                              ...updated[i],
                              level: item.value,
                              field: previousLevel !== item.value ? '' : updated[i]?.field || '',
                            };

                            return { ...prev, education_history: updated };
                          });
                        }}
                      />

                      <TextInput
                        style={[styles.standardInput, { flex: 1, marginLeft: 8 }]}
                        placeholder="University"
                        placeholderTextColor={theme.colors.mutedText}
                        value={edu.university}
                        onChangeText={(v) => {
                          const updated = [...formData.education_history];
                          updated[i].university = v;
                          setFormData((prev: any) => ({ ...prev, education_history: updated }));
                        }}
                      />

                      {formData.education_history.length > 1 && (
                        <TouchableOpacity
                          onPress={() => {
                            const updated = formData.education_history.filter(
                              (_: any, idx: number) => idx !== i,
                            );
                            setFormData((prev: any) => ({ ...prev, education_history: updated }));
                          }}
                          style={{ marginLeft: 8 }}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={{ marginTop: 10 }}>
                      <SuggestionInput
                        value={edu.field || ''}
                        placeholder="Type or choose a field of study"
                        suggestions={fieldSuggestions}
                        theme={theme}
                        onChange={(v) => {
                          const updated = [...formData.education_history];
                          updated[i].field = v;
                          setFormData((prev: any) => ({ ...prev, education_history: updated }));
                        }}
                      />
                    </View>
                  </View>
                );
              })}

              <View style={styles.divider} />

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Profession <Text style={styles.reqStar}>*</Text>
                </Text>

                <SuggestionInput
                  value={formData.profession || ''}
                  placeholder="Type your profession or pick a suggestion"
                  suggestions={PROFESSION_DATA}
                  theme={theme}
                  onChange={(v) => setFormData((prev: any) => ({ ...prev, profession: v }))}
                />
              </View>

              <FormInput
                styles={styles}
                theme={theme}
                label="Workplace"
                k="workplace"
                value={formData.workplace}
                missing={missing}
                onChangeText={(v: any) =>
                  setFormData((prev: any) => ({ ...prev, workplace: v }))
                }
                required
              />

              <FormInput
                styles={styles}
                theme={theme}
                label="LinkedIn Profile"
                k="linkedinProfile"
                value={formData.linkedinProfile}
                missing={missing}
                onChangeText={(v: any) =>
                  setFormData((prev: any) => ({ ...prev, linkedinProfile: v }))
                }
              />
            </View>
          )}

          {step === 4 && (
            <View>
              <FormDropdown
                styles={styles}
                theme={theme}
                label="Kovil"
                k="kovil"
                value={formData.kovil}
                data={KOVIL_DATA}
                missing={missing}
                onSelect={(item: any) =>
                  setFormData((prev: any) => ({ ...prev, kovil: item.value, pirivu: '' }))
                }
                required
              />

              {hasPirivus && (
                <FormDropdown
                  styles={styles}
                  theme={theme}
                  label="Pirivu"
                  k="pirivu"
                  value={formData.pirivu}
                  data={selectedKovilObj?.pirivus?.map((p: any) => ({ label: p, value: p })) ?? []}
                  missing={missing}
                  onSelect={(item: any) =>
                    setFormData((prev: any) => ({ ...prev, pirivu: item.value }))
                  }
                  required
                />
              )}

              <FormDropdown
                styles={styles}
                theme={theme}
                label="Rasi"
                k="rasi"
                value={formData.rasi}
                data={RASI_DATA}
                missing={missing}
                onSelect={(item: any) =>
                  setFormData((prev: any) => ({ ...prev, rasi: item.value }))
                }
                required
              />

              <FormDropdown
                styles={styles}
                theme={theme}
                label="Star"
                k="star"
                value={formData.star}
                data={NAKSHATRA_DATA}
                missing={missing}
                onSelect={(item: any) =>
                  setFormData((prev: any) => ({ ...prev, star: item.value }))
                }
                required
              />

              <FormDropdown
                styles={styles}
                theme={theme}
                label="Native Place"
                k="nativePlace"
                value={formData.nativePlace}
                data={NATIVE_PLACES_DATA}
                missing={missing}
                onSelect={(item: any) =>
                  setFormData((prev: any) => ({ ...prev, nativePlace: item.value }))
                }
                required
              />

              <FormInput
                styles={styles}
                theme={theme}
                label="Family Initials"
                k="familyInitials"
                value={formData.familyInitials}
                missing={missing}
                onChangeText={(v: any) =>
                  setFormData((prev: any) => ({ ...prev, familyInitials: v }))
                }
                required
              />
            </View>
          )}

          {step === 5 && (
            <View>
              <View style={styles.rowGrid}>
                <FormInput
                  styles={styles}
                  theme={theme}
                  label="Father's Name"
                  k="fatherName"
                  value={formData.fatherName}
                  missing={missing}
                  onChangeText={(v: any) =>
                    setFormData((prev: any) => ({ ...prev, fatherName: v }))
                  }
                  required
                  style={{ flex: 1 }}
                />

                <FormInput
                  styles={styles}
                  theme={theme}
                  label="Occupation"
                  k="fatherWork"
                  value={formData.fatherWork}
                  missing={missing}
                  onChangeText={(v: any) =>
                    setFormData((prev: any) => ({ ...prev, fatherWork: v }))
                  }
                  style={{ flex: 1, marginLeft: 12 }}
                />

                <FormInput
                  styles={styles}
                  theme={theme}
                  label="Phone"
                  k="fatherPhone"
                  value={formData.fatherPhone}
                  missing={missing}
                  onChangeText={(v: any) =>
                    setFormData((prev: any) => ({ ...prev, fatherPhone: v }))
                  }
                  keyboardType="phone-pad"
                  style={{ flex: 1, marginLeft: 12 }}
                />
              </View>

              <View style={[styles.rowGrid, { marginTop: 12 }]}>
                <FormInput
                  styles={styles}
                  theme={theme}
                  label="Mother's Name"
                  k="motherName"
                  value={formData.motherName}
                  missing={missing}
                  onChangeText={(v: any) =>
                    setFormData((prev: any) => ({ ...prev, motherName: v }))
                  }
                  required
                  style={{ flex: 1 }}
                />

                <FormInput
                  styles={styles}
                  theme={theme}
                  label="Occupation"
                  k="motherWork"
                  value={formData.motherWork}
                  missing={missing}
                  onChangeText={(v: any) =>
                    setFormData((prev: any) => ({ ...prev, motherWork: v }))
                  }
                  style={{ flex: 1, marginLeft: 12 }}
                />

                <FormInput
                  styles={styles}
                  theme={theme}
                  label="Phone"
                  k="motherPhone"
                  value={formData.motherPhone}
                  missing={missing}
                  onChangeText={(v: any) =>
                    setFormData((prev: any) => ({ ...prev, motherPhone: v }))
                  }
                  keyboardType="phone-pad"
                  style={{ flex: 1, marginLeft: 12 }}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.siblingHeader}>
                <Text style={styles.label}>Siblings</Text>
                <TouchableOpacity
                  onPress={() => {
                    const updated = [
                      ...formData.familyDetails.siblings,
                      { name: '', maritalStatus: 'Never Married', occupation: '' },
                    ];
                    setFormData((prev: any) => ({
                      ...prev,
                      familyDetails: { siblings: updated },
                    }));
                  }}
                  style={styles.inlineAddBtn}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle" size={18} color={theme.colors.text} />
                  <Text style={styles.addBtnText}>Add Sibling</Text>
                </TouchableOpacity>
              </View>

              {formData.familyDetails.siblings.map((sib: any, i: number) => (
                <View key={i} style={styles.compactFormBox}>
                  <View style={styles.eduRowHorizontal}>
                    <TextInput
                      style={[styles.standardInput, { flex: 1 }]}
                      placeholder="Name"
                      placeholderTextColor={theme.colors.mutedText}
                      value={sib.name}
                      onChangeText={(v) => {
                        const updated = [...formData.familyDetails.siblings];
                        updated[i].name = v;
                        setFormData((prev: any) => ({
                          ...prev,
                          familyDetails: { siblings: updated },
                        }));
                      }}
                    />

                    <Dropdown
                      style={[styles.dropdown, { flex: 1, marginLeft: 8 }]}
                      data={SIB_MARITAL_DATA}
                      labelField="label"
                      valueField="value"
                      value={sib.maritalStatus}
                      placeholder="Status"
                      placeholderStyle={{ color: theme.colors.mutedText, fontWeight: '700' }}
                      selectedTextStyle={{ color: theme.colors.text, fontWeight: '800' }}
                      onChange={(item: any) => {
                        const updated = [...formData.familyDetails.siblings];
                        updated[i].maritalStatus = item.value;
                        setFormData((prev: any) => ({
                          ...prev,
                          familyDetails: { siblings: updated },
                        }));
                      }}
                    />

                    <Dropdown
                      style={[styles.dropdown, { flex: 1, marginLeft: 8 }]}
                      data={OCC_DATA}
                      labelField="label"
                      valueField="value"
                      value={sib.occupation}
                      placeholder="Profession"
                      placeholderStyle={{ color: theme.colors.mutedText, fontWeight: '700' }}
                      selectedTextStyle={{ color: theme.colors.text, fontWeight: '800' }}
                      onChange={(item: any) => {
                        const updated = [...formData.familyDetails.siblings];
                        updated[i].occupation = item.value;
                        setFormData((prev: any) => ({
                          ...prev,
                          familyDetails: { siblings: updated },
                        }));
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}

          {step === 6 && (
            <View style={{ alignItems: 'center' }}>
              <TouchableOpacity
                onPress={handlePickImage}
                style={[styles.photoCircle, missing.profilePhotoUrl && styles.inputError]}
                disabled={uploading}
                activeOpacity={0.85}
              >
                {photoPreviewUri || formData.profilePhotoUrl ? (
                  <Image
                    key={photoPreviewUri || formData.profilePhotoUrl}
                    source={{ uri: photoPreviewUri || formData.profilePhotoUrl }}
                    style={styles.uploadedImg}
                  />
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    {uploading ? (
                      <ActivityIndicator size="large" color={theme.colors.text} />
                    ) : (
                      <Ionicons name="camera" size={40} color={theme.colors.mutedText} />
                    )}
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.miniLabel}>
                {uploading
                  ? 'Uploading...'
                  : formData.profilePhotoUrl
                    ? 'Attached! ✅'
                    : 'Upload your photo'}
              </Text>
            </View>
          )}

          {step === 7 && (
            <View>
              <Text style={styles.label}>Interests & Lifestyle</Text>

              <Text style={styles.helperText}>
                Choose a few broad lifestyle categories that reflect your interests. Tap a pill to select it,
                or tap the info icon to see examples.
              </Text>

              <View style={styles.interestHintChipWrap}>
                {INTEREST_DATA.map((interest) => {
                  const active =
                    Array.isArray(formData.interests) &&
                    formData.interests.includes(interest);
                  const showingHint = openInterestHint === interest;

                  return (
                    <View
                      key={interest}
                      style={[
                        styles.interestHintChip,
                        active && styles.interestHintChipActive,
                        showingHint && styles.interestHintChipOpen,
                      ]}
                    >
                      <TouchableOpacity
                        onPress={() => toggleInterest(interest)}
                        activeOpacity={0.85}
                        style={styles.interestChipMainTap}
                      >
                        <Text
                          style={[
                            styles.interestHintChipText,
                            active && styles.interestHintChipTextActive,
                          ]}
                        >
                          {interest}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() =>
                          setOpenInterestHint((prev) =>
                            prev === interest ? null : interest,
                          )
                        }
                        activeOpacity={0.85}
                        style={styles.interestInfoBtn}
                      >
                        <Ionicons
                          name="information-circle-outline"
                          size={14}
                          color={
                            active
                              ? theme.colors.primaryText
                              : theme.colors.mutedText
                          }
                        />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>

              {!!openInterestHint && (
                <View style={styles.interestHintBubble}>
                  <View style={styles.interestHintHeader}>
                    <Text style={styles.interestHintTitle}>{openInterestHint}</Text>

                    <TouchableOpacity
                      onPress={() => setOpenInterestHint(null)}
                      style={styles.interestHintCloseBtn}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="close" size={16} color={theme.colors.mutedText} />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.interestHintText}>
                    {INTEREST_HINTS[openInterestHint] ||
                      'This category includes related hobbies and activities.'}
                  </Text>
                </View>
              )}

              <ExpectationsQuestionnaire
                value={formData.expectations}
                onChange={(v) => setFormData((prev: any) => ({ ...prev, expectations: v }))}
                theme={theme}
              />
            </View>
          )}

          {step === 8 && (
            <View style={styles.reviewBox}>
              <Text style={styles.reviewTitle}>Final Review</Text>
              <ProfileDisplay profile={formData} showPhoto />
              <Text style={styles.reviewFooter}>
                Please ensure all details are correct before submitting.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          {step > 1 && (
            <TouchableOpacity
              onPress={() => setStep((s) => Math.max(1, s - 1))}
              style={styles.backBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.backText}>Previous</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.nextBtn, (uploading || loading) && { opacity: 0.7 }]}
            onPress={step === 8 ? handleSubmit : nextStep}
            disabled={uploading || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.primaryText} />
            ) : (
              <Text style={styles.nextText}>{step === 8 ? 'Submit Profile' : 'Continue'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: any) {
  const r = theme.radius;

  return StyleSheet.create({
    webSafeContainer: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },

    progressHeader: {
      padding: 20,
      backgroundColor: theme.colors.surface2,
      borderBottomWidth: 1,
      borderColor: theme.colors.border,
    },

    progressTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },

    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    signOutBtn: {
      minWidth: 150,
    },

    stepText: {
      fontSize: 13,
      fontWeight: '900',
      color: theme.colors.text,
    },

    headerTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: theme.colors.text,
      marginTop: 2,
    },

    helperText: {
      marginTop: 6,
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.mutedText,
      lineHeight: 18,
    },

    progressBarBg: {
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.border,
      overflow: 'hidden',
      marginVertical: 10,
    },

    progressBarFill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
    },

    contentScroller: {
      flex: 1,
    },

    scrollArea: {
      padding: 20,
      paddingBottom: 40,
    },

    sectionCard: {
      backgroundColor: theme.colors.surface2,
      borderRadius: r.card,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    label: {
      fontSize: 11,
      fontWeight: '900',
      color: theme.colors.mutedText,
      textTransform: 'uppercase',
      marginBottom: 6,
      letterSpacing: 0.7,
    },

    reqStar: {
      color: theme.colors.danger,
    },

    optTag: {
      color: theme.colors.mutedText,
      fontWeight: '900',
    },

    inputGroup: {
      marginBottom: 16,
    },

    standardInput: {
      height: 46,
      borderRadius: r.input,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      fontSize: 14,
      color: theme.colors.text,
      backgroundColor: theme.colors.inputBg,
      fontWeight: '700',
    },

    dropdown: {
      height: 46,
      borderRadius: r.input,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      backgroundColor: theme.colors.inputBg,
    },

    inputError: {
      borderColor: theme.colors.danger,
      borderWidth: 1.5,
    },

    rowGrid: {
      flexDirection: 'row',
      gap: 12,
    },

    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 10,
    },

    nextBtn: {
      flex: 1,
      backgroundColor: theme.colors.primary,
      height: 50,
      borderRadius: r.button,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 10,
    },

    nextText: {
      color: theme.colors.primaryText,
      fontWeight: '900',
    },

    backBtn: {
      height: 50,
      paddingHorizontal: 25,
      borderRadius: r.button,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
    },

    backText: {
      color: theme.colors.text,
      fontWeight: '800',
    },

    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: 20,
    },

    siblingHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },

    inlineAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: theme.colors.surface,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    addBtnText: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.colors.text,
    },

    compactFormBox: {
      backgroundColor: theme.colors.surface,
      padding: 10,
      borderRadius: r.card,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    eduRowHorizontal: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    photoCircle: {
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: theme.colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    uploadedImg: {
      width: '100%',
      height: '100%',
    },

    miniLabel: {
      fontSize: 12,
      color: theme.colors.mutedText,
      marginTop: 10,
      fontWeight: '700',
    },

    reviewBox: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: r.card,
      padding: 12,
      backgroundColor: theme.colors.surface,
    },

    reviewTitle: {
      fontSize: 20,
      fontWeight: '900',
      color: theme.colors.text,
      marginBottom: 16,
      paddingHorizontal: 4,
    },

    reviewFooter: {
      fontSize: 13,
      color: theme.colors.mutedText,
      textAlign: 'center',
      marginTop: 20,
      lineHeight: 18,
      fontStyle: 'italic',
      fontWeight: '600',
    },

    selectedChip: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginTop: 8,
      marginRight: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },

    resetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    resetBtnText: {
      color: theme.colors.danger,
      fontSize: 10,
      fontWeight: '900',
      marginLeft: 4,
      letterSpacing: 0.6,
    },
    interestHintChipWrap: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 12,
  marginBottom: 8,
},

interestHintChip: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: theme.colors.border,
  backgroundColor: theme.colors.surface,
},

interestHintChipActive: {
  backgroundColor: theme.colors.primary,
  borderColor: theme.colors.primary,
},

interestHintChipOpen: {
  borderColor: theme.colors.primary,
},

interestHintChipText: {
  fontSize: 12,
  fontWeight: '800',
  color: theme.colors.text,
},

interestHintChipTextActive: {
  color: theme.colors.primaryText,
},

interestHintBubble: {
  marginTop: 8,
  marginBottom: 16,
  padding: 12,
  borderRadius: r.card,
  borderWidth: 1,
  borderColor: theme.colors.border,
  backgroundColor: theme.colors.surface,
},

interestHintHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 6,
},

interestHintTitle: {
  fontSize: 12,
  fontWeight: '900',
  color: theme.colors.text,
},

interestHintText: {
  fontSize: 12,
  lineHeight: 18,
  fontWeight: '700',
  color: theme.colors.mutedText,
},

interestHintCloseBtn: {
  padding: 6,
  borderRadius: 999,
},

interestChipMainTap: {
  flexDirection: 'row',
  alignItems: 'center',
},

interestInfoBtn: {
  marginLeft: 6,
  paddingLeft: 2,
  paddingVertical: 2,
},

  });
}