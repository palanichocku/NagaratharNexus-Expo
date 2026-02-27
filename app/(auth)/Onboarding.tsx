// ./app/(auth)/Onboarding.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../src/lib/supabase'; // ✅ Use Supabase
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ProfileDisplay } from '../../src/components/ProfileDisplay';
import { Dropdown, MultiSelect } from 'react-native-element-dropdown';
import { Country, State, City } from 'country-state-city';
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
  DEBUG_CONFIG,
} from '../../src/constants/appData';
import { useAppTheme } from '../../src/theme/ThemeProvider';

// --- CONFIG & CONSTANTS ---
const TOTAL_STEPS = 8;
const DRAFT_KEY = 'NN_ONBOARDING_DRAFT_V2';
const SIB_MARITAL_DATA = [...MARITAL_STATUS_DATA, { label: 'Married', value: 'Married' }];
const OCC_DATA = [...OCCUPATION_DATA, { label: 'Student', value: 'Student' }];

const INITIAL_FORM_DATA = {
  // Step 1 & 2
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

  // Step 3 (Now an Array!)
  education_history: [{ level: '', field: '', university: '' }],
  profession: '',
  workplace: '',
  linkedinProfile: '',

  // Step 4 & 5
  nativePlace: '',
  familyInitials: '',
  fatherName: '',
  fatherWork: '',
  fatherPhone: '',
  motherName: '',
  motherWork: '',
  motherPhone: '',
  familyDetails: { siblings: [] }, // Nested object for lineage

  // Step 6 & 7
  kovil: '',
  pirivu: '',
  rasi: '',
  star: '',
  interests: [], // Array for multi-select chips
  expectations: '',
  profilePhotoUrl: '',
};

const STEP_META = [
  { title: 'Personal Details', helper: 'Let’s start with the basics — quick and easy.' },
  { title: 'Location & Residency', helper: 'Where you live helps matches connect better.' },
  { title: 'Professional Profile', helper: 'A little work/education context goes a long way.' },
  { title: 'Cultural Identity', helper: 'Traditional details valued by many families.' },
  { title: 'Family Lineage', helper: 'Family details help create meaningful introductions.' },
  { title: 'Profile Photo', helper: 'A clear photo builds trust.' },
  { title: 'Interests & Expectations', helper: 'Share what you love and what you’re looking for.' },
  { title: 'Final Review', helper: 'Almost done — take a quick look before submitting.' },
];

const FIELD_LABELS: Record<string, string> = {
  fullName: 'Full Name',
  phone: 'Phone Number',
  dob: 'Date of Birth',
  maritalStatus: 'Marital Status',
  gender: 'Gender',
  citizenship: 'Citizenship',
  residentCountry: 'Resident Country',
  currentState: 'State',
  residentStatus: 'Resident Status',
  profession: 'Profession',
  workplace: 'Workplace',
  kovil: 'Temple (Kovil)',
  pirivu: 'Pirivu',
  rasi: 'Rasi',
  star: 'Star/Nakshatra',
  nativePlace: 'Native Place',
  familyInitials: 'Family Initials',
  fatherName: "Father's Name",
  motherName: "Mother's Name",
  profilePhotoUrl: 'Profile Photo',
};

const REQUIRED_BY_STEP: Record<number, string[]> = {
  1: ['fullName', 'phone', 'dob', 'maritalStatus', 'gender'],
  2: ['citizenship', 'residentCountry', 'currentState', 'residentStatus'],
  3: ['profession', 'workplace'],
  4: ['kovil', 'rasi', 'star', 'nativePlace', 'familyInitials'],
  5: ['fatherName', 'motherName'],
  6: ['profilePhotoUrl'],
};

// --- STABLE UI HELPERS (MOVED OUTSIDE TO PREVENT FOCUS LOSS) ---
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
      {required ? (
        <Text style={styles.reqStar}>*</Text>
      ) : (
        <Text style={styles.optTag}>(Optional)</Text>
      )}
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
      {required ? (
        <Text style={styles.reqStar}>*</Text>
      ) : (
        <Text style={styles.optTag}>(Optional)</Text>
      )}
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
      inputSearchStyle={[
        {
          borderRadius: styles._radiusInput,
          borderWidth: 1,
          borderColor: theme.colors.border,
          paddingHorizontal: 10,
          color: theme.colors.text,
        },
      ]}
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
  const radiusInput = theme?.radius?.input ?? 12;
  const styles = useMemo(() => makeStyles(theme), [theme]);
  
  const webDateStyle = useMemo(() => {
  return {
    height: 46,
    borderRadius: radiusInput,
    border: `1px solid ${theme.colors.border}`,
    padding: '0 12px',
    fontSize: 14,
    width: '100%',
    backgroundColor: theme.colors.inputBg,
    color: theme.colors.text,
    outline: 'none',
  } as any;
}, [
  radiusInput,
  theme.colors.border,
  theme.colors.inputBg,
  theme.colors.text,
]);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [missing, setMissing] = useState<Record<string, boolean>>({});
  const [filterCodes, setFilterCodes] = useState({ country: '', state: '' });
  const [isReady, setIsReady] = useState(false); // 🚀 Prevents flash of Step 1
  const [formData, setFormData] = useState<any>(INITIAL_FORM_DATA);

  // 🚀 1. HYDRATE: Load saved data when the app starts
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const savedDraft = await AsyncStorage.getItem(DRAFT_KEY);
        if (savedDraft) {
          const { step: savedStep, formData: savedData, filterCodes: savedFilters } = JSON.parse(savedDraft);
          setFormData(savedData);
          setStep(savedStep);
          setFilterCodes(savedFilters);
          // eslint-disable-next-line no-console
          console.log('📦 Draft restored to Step:', savedStep);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to load draft:', e);
      } finally {
        setIsReady(true);
      }
    };
    void loadDraft();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const hydrateAuthEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const authEmail = user?.email || '';

      if (!authEmail) return;

      // Only set it if onboarding draft doesn't already have a value
      setFormData((prev: any) => {
        if (prev?.email) return prev;
        return { ...prev, email: authEmail };
      });
    };

    if (isReady) {
      hydrateAuthEmail();
    }
    return () => { isMounted = false; };
  }, [isReady]);

  // 🚀 2. PERSIST: Save data every time formData or step changes
  useEffect(() => {
    if (!isReady) return; // Don't save empty state over a draft!

    const saveDraft = async () => {
      try {
        const draft = JSON.stringify({ step, formData, filterCodes });
        await AsyncStorage.setItem(DRAFT_KEY, draft);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to save draft:', e);
      }
    };

    void saveDraft();
  }, [step, formData, filterCodes, isReady]);

  // ✅ Keep ISO codes in sync with form selections (fixes "city not populating")
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
      // Avoid unnecessary state updates
      if (prev.country === countryIso && prev.state === stateIso) return prev;
      return { country: countryIso, state: stateIso };
    });
  }, [formData?.residentCountry, formData?.currentState]);

  // ✅ If country/state changes, clear city (prevents stale/invalid city)
  useEffect(() => {
    setFormData((prev: any) => {
      // If there's no state selected, city should be blank
      if (!prev?.currentState && prev?.currentCity) {
        return { ...prev, currentCity: '' };
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCodes.country, filterCodes.state]);

  const selectedKovilObj = KOVIL_DATA.find((k) => k.value === formData.kovil || k.label === formData.kovil);
  const hasPirivus = !!(selectedKovilObj?.pirivus?.length);

  // --- PHOTO UPLOAD (SUPABASE) ---
  const handlePickImage = async () => {
    // eslint-disable-next-line no-console
    console.log('📸 Image picker triggered...');
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission Denied', 'We need access to your gallery.');
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!result.canceled) uploadPhoto(result.assets[0].uri);
  };

  const resetOnboarding = async () => {
    Alert.alert(
      'Reset All Progress?',
      'This will delete your current draft and take you back to Step 1. This is recommended if you are seeing errors.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Start Over',
          style: 'destructive',
          onPress: async () => {
            try {
              // 1. Wipe the local storage save
              await AsyncStorage.removeItem(DRAFT_KEY);

              // 2. Reset the state to the clean template
              setFormData(INITIAL_FORM_DATA);
              setStep(1);
              setMissing({});
              setFilterCodes({ country: '', state: '' });

              // eslint-disable-next-line no-console
              console.log('🧹 State and Storage have been reset.');
            } catch (e) {
              // eslint-disable-next-line no-console
              console.error('Reset failed:', e);
            }
          },
        },
      ],
    );
  };

  // 1. Updated Upload Logic with "URL Verification"
  const uploadPhoto = async (uri: string) => {
    // eslint-disable-next-line no-console
    console.log('🚀 Step 6: Initializing Web Upload...');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Alert.alert('Error', 'No active session found.');

    setUploading(true);
    try {
      const fileExt = uri.split('.').pop() || 'jpg';
      const path = `${user.id}/${Date.now()}.${fileExt}`;

      // ✅ FIX: Use XHR to get the blob. 'fetch' often hangs on local blob URIs in dev.
      const blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new TypeError('Local file fetch failed'));
        xhr.responseType = 'blob';
        xhr.open('GET', uri, true);
        xhr.send(null);
      }) as Blob;

      // eslint-disable-next-line no-console
      console.log('📦 Blob created successfully. Size:', blob.size);

      const { error } = await supabase.storage.from('profiles').upload(path, blob, {
        contentType: `image/${fileExt}`,
        upsert: true,
      });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('profiles').getPublicUrl(path);
      const finalUrl = `${publicUrl}?t=${Date.now()}`; // Cache buster

      // eslint-disable-next-line no-console
      console.log('✅ FINAL URL:', finalUrl);
      setFormData((p: any) => ({ ...p, profilePhotoUrl: finalUrl }));
      setMissing((p) => ({ ...p, profilePhotoUrl: false }));
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('❌ UPLOAD FAILED:', e);
      Alert.alert('Upload Failed', e.message);
    } finally {
      setUploading(false);
    }
  };

  // --- SUBMISSION ---
  const handleSubmit = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Alert.alert('Error', 'Session expired.');

    setLoading(true);
    try {
      // 🚀 Explicitly mapping Onboarding state to Database columns
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

        // JSONB and Arrays
        education_history: formData.education_history || [],
        family_details: formData.familyDetails || { siblings: [] },
        interests: Array.isArray(formData.interests) ? formData.interests : [],

        // Flags
        // ✅ Privacy defaults
        hide_phone: false,
        hide_email: false,
        is_submitted: true,
        is_approved: false,
        updated_at: new Date(),
      };

      // eslint-disable-next-line no-console
      console.log('📤 Sending payload to Supabase:', dbPayload);

      const { error } = await supabase.from('profiles').upsert(dbPayload, { onConflict: 'id' });
      if (error) throw error;

      // ✅ Clear the draft and move to the waiting room
      await AsyncStorage.removeItem(DRAFT_KEY);
      router.replace('/(auth)/PendingApproval');
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('❌ Submission Error:', e);
      Alert.alert('Submission Failed', e.message || 'Check your network or database schema.');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    const required = REQUIRED_BY_STEP[step] || [];
    const missMap: Record<string, boolean> = {};
    required.forEach((k) => { if (!formData[k]) missMap[k] = true; });
    if (Object.keys(missMap).length > 0) return setMissing(missMap);
    setStep((s) => s + 1);
  };

  const progressPct = Math.round((step / TOTAL_STEPS) * 100);

  if (!isReady) {
    return (
      <ActivityIndicator style={{ flex: 1 }} size="large" color={theme.colors.text} />
    );
  }

  return (
    <View style={styles.webSafeContainer}>
      <View style={styles.progressHeader}>
        <View style={styles.progressTopRow}>
          <Text style={styles.stepText}>
            Step {step} of {TOTAL_STEPS} ({progressPct}%)
          </Text>

          {/* 🚀 THIS IS THE BUTTON TO CALL THE RESET */}
          <TouchableOpacity onPress={resetOnboarding} style={styles.resetBtn} activeOpacity={0.85}>
            <Ionicons name="refresh-circle" size={16} color={theme.colors.danger} />
            <Text style={styles.resetBtnText}>RESET</Text>
          </TouchableOpacity>
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
        <View style={styles.sectionCard}>
          {step === 1 && (
            <View>
              {/* Row 1: Name and Phone */}
              <View style={styles.rowGrid}>
                <FormInput
                  styles={styles}
                  theme={theme}
                  label="Full Name"
                  k="fullName"
                  value={formData.fullName}
                  missing={missing}
                  onChangeText={(v: any) => setFormData({ ...formData, fullName: v })}
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
                  onChangeText={(v: any) => setFormData({ ...formData, phone: v })}
                  required
                  keyboardType="phone-pad"
                  style={{ flex: 1.5, marginLeft: 12 }}
                />
              </View>

              {/* Row 2: DOB, Gender, and Height */}
              <View style={styles.rowGrid}>
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.label}>
                    Date of Birth <Text style={styles.reqStar}>*</Text>
                  </Text>
                  {/* eslint-disable-next-line react/no-unknown-property */}
                  <input
                    type="date"
                    value={formData.dob}
                    style={webDateStyle}
                    onChange={(e: any) => setFormData({ ...formData, dob: e.target.value })}
                  />
                </View>

                <FormDropdown
                  styles={styles}
                  theme={theme}
                  label="Gender"
                  k="gender"
                  value={formData.gender}
                  data={GENDER_DATA}
                  missing={missing}
                  onSelect={(item: any) => setFormData({ ...formData, gender: item.value })}
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
                  onSelect={(item: any) => setFormData({ ...formData, height: item.value })}
                  required
                  style={{ flex: 1, marginLeft: 12 }}
                />
              </View>

              {/* Row 3: Marital Status */}
              <FormDropdown
                styles={styles}
                theme={theme}
                label="Marital Status"
                k="maritalStatus"
                value={formData.maritalStatus}
                data={MARITAL_STATUS_DATA}
                missing={missing}
                onSelect={(item: any) => setFormData({ ...formData, maritalStatus: item.value })}
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
                onSelect={(item: any) => setFormData({ ...formData, citizenship: item.value })}
                required
                style={{ flex: 1 }}
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
                  const iso = Country.getAllCountries().find((c) => c.name === i.value)?.isoCode || '';
                  setFilterCodes({ country: iso, state: '' });
                  setFormData({ ...formData, residentCountry: i.value }); // ✅ stores "United States"
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
                onChangeText={(v: any) => setFormData({ ...formData, currentCity: v })}
              />

              <FormDropdown
                styles={styles}
                theme={theme}
                label="Resident City"
                k="currentCity"
                value={formData.currentCity}
                data={City.getCitiesOfState(filterCodes.country, filterCodes.state).map((c) => ({ label: c.name, value: c.name }))}
                missing={missing}
                onSelect={(i: any) => setFormData({ ...formData, currentCity: i.value })}
              />

              {/* Optional: if city suggestions exist, show a lightweight picker below */}
              {filterCodes.country && filterCodes.state ? (
                (() => {
                  const cities = City.getCitiesOfState(filterCodes.country, filterCodes.state) || [];
                  const top = cities.slice(0, 12); // keep it light

                  if (top.length === 0) return null;

                  return (
                    <View style={{ marginTop: -6, marginBottom: 10 }}>
                      <Text style={styles.label}>Suggestions</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {top.map((c) => (
                          <TouchableOpacity
                            key={c.name}
                            onPress={() => setFormData({ ...formData, currentCity: c.name })}
                            style={[
                              styles.inlineAddBtn,
                              { paddingVertical: 6, paddingHorizontal: 10 },
                            ]}
                            activeOpacity={0.85}
                          >
                            <Text style={{ fontWeight: '900', color: theme.colors.text, fontSize: 12 }}>
                              {c.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  );
                })()
              ) : null}
              
              <FormDropdown
                styles={styles}
                theme={theme}
                label="Resident Status"
                k="residentStatus"
                value={formData.residentStatus}
                data={RESIDENT_STATUS_DATA}
                missing={missing}
                onSelect={(item: any) => setFormData({ ...formData, residentStatus: item.value })}
                required
                style={{ flex: 1, marginLeft: 5 }}
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
                    setFormData({ ...formData, education_history: updated });
                  }}
                  style={styles.inlineAddBtn}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle" size={18} color={theme.colors.text} />
                  <Text style={styles.addBtnText}>Add Degree</Text>
                </TouchableOpacity>
              </View>

              {(formData.education_history || []).map((edu: any, i: number) => (
                <View key={i} style={styles.compactFormBox}>
                  <View style={styles.eduRowHorizontal}>
                    <Dropdown
                      style={[styles.dropdown, { flex: 1 }]}
                      data={EDUCATION_DATA}
                      labelField="label"
                      valueField="value"
                      placeholder="Level"
                      placeholderStyle={{ color: theme.colors.mutedText, fontWeight: '700' }}
                      selectedTextStyle={{ color: theme.colors.text, fontWeight: '800' }}
                      value={edu.level}
                      onChange={(item) => {
                        const updated = [...formData.education_history];
                        updated[i].level = item.value;
                        setFormData({ ...formData, education_history: updated });
                      }}
                    />

                    <Dropdown
                      style={[styles.dropdown, { flex: 1, marginLeft: 8 }]}
                      data={FIELD_OF_STUDY_DATA}
                      labelField="label"
                      valueField="value"
                      placeholder="Field"
                      placeholderStyle={{ color: theme.colors.mutedText, fontWeight: '700' }}
                      selectedTextStyle={{ color: theme.colors.text, fontWeight: '800' }}
                      value={edu.field}
                      onChange={(item) => {
                        const updated = [...formData.education_history];
                        updated[i].field = item.value;
                        setFormData({ ...formData, education_history: updated });
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
                        setFormData({ ...formData, education_history: updated });
                      }}
                    />

                    {formData.education_history.length > 1 && (
                      <TouchableOpacity
                        onPress={() => {
                          const updated = formData.education_history.filter((_: any, idx: number) => idx !== i);
                          setFormData({ ...formData, education_history: updated });
                        }}
                        style={{ marginLeft: 8 }}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}

              <View style={styles.divider} />

              <FormDropdown
                styles={styles}
                theme={theme}
                label="Profession"
                k="profession"
                value={formData.profession}
                data={PROFESSION_DATA}
                missing={missing}
                onSelect={(item: any) => setFormData({ ...formData, profession: item.value })}
                required
              />

              <FormInput
                styles={styles}
                theme={theme}
                label="Workplace"
                k="workplace"
                value={formData.workplace}
                missing={missing}
                onChangeText={(v: any) => setFormData({ ...formData, workplace: v })}
                required
              />

              <FormInput
                styles={styles}
                theme={theme}
                label="LinkedIn Profile"
                k="linkedinProfile"
                value={formData.linkedinProfile}
                missing={missing}
                onChangeText={(v: any) => setFormData({ ...formData, linkedinProfile: v })}
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
                onSelect={(item: any) => setFormData({ ...formData, kovil: item.value, pirivu: '' })}
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
                  onSelect={(item: any) => setFormData({ ...formData, pirivu: item.value })}
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
                onSelect={(item: any) => setFormData({ ...formData, rasi: item.value })}
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
                onSelect={(item: any) => setFormData({ ...formData, star: item.value })}
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
                onSelect={(item: any) => setFormData({ ...formData, nativePlace: item.value })}
                required
              />

              <FormInput
                styles={styles}
                theme={theme}
                label="Family Initials"
                k="familyInitials"
                value={formData.familyInitials}
                missing={missing}
                onChangeText={(v: any) => setFormData({ ...formData, familyInitials: v })}
                required
                style={{ flex: 1, marginLeft: 5 }}
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
                  onChangeText={(v: any) => setFormData({ ...formData, fatherName: v })}
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
                  onChangeText={(v: any) => setFormData({ ...formData, fatherWork: v })}
                  style={{ flex: 1, marginLeft: 12 }}
                />
                <FormInput
                  styles={styles}
                  theme={theme}
                  label="Phone"
                  k="fatherPhone"
                  value={formData.fatherPhone}
                  missing={missing}
                  onChangeText={(v: any) => setFormData({ ...formData, fatherPhone: v })}
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
                  onChangeText={(v: any) => setFormData({ ...formData, motherName: v })}
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
                  onChangeText={(v: any) => setFormData({ ...formData, motherWork: v })}
                  style={{ flex: 1, marginLeft: 12 }}
                />
                <FormInput
                  styles={styles}
                  theme={theme}
                  label="Phone"
                  k="motherPhone"
                  value={formData.motherPhone}
                  missing={missing}
                  onChangeText={(v: any) => setFormData({ ...formData, motherPhone: v })}
                  keyboardType="phone-pad"
                  style={{ flex: 1, marginLeft: 12 }}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.siblingHeader}>
                <Text style={styles.label}>Siblings</Text>
                <TouchableOpacity
                  onPress={() => {
                    const updated = [...formData.familyDetails.siblings, { name: '', maritalStatus: 'Never Married', occupation: '' }];
                    setFormData({ ...formData, familyDetails: { siblings: updated } });
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
                        setFormData({ ...formData, familyDetails: { siblings: updated } });
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
                      onChange={(item) => {
                        const updated = [...formData.familyDetails.siblings];
                        updated[i].maritalStatus = item.value;
                        setFormData({ ...formData, familyDetails: { siblings: updated } });
                      }}
                    />

                    <Dropdown
                      style={[styles.dropdown, { flex: 1, marginLeft: 8 }]}
                      data={OCC_DATA}
                      labelField="label"
                      valueField="value"
                      value={sib.occupation}
                      placeholder="Job"
                      placeholderStyle={{ color: theme.colors.mutedText, fontWeight: '700' }}
                      selectedTextStyle={{ color: theme.colors.text, fontWeight: '800' }}
                      onChange={(item) => {
                        const updated = [...formData.familyDetails.siblings];
                        updated[i].occupation = item.value;
                        setFormData({ ...formData, familyDetails: { siblings: updated } });
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
                {formData.profilePhotoUrl ? (
                  <Image
                    key={formData.profilePhotoUrl}
                    source={{ uri: formData.profilePhotoUrl }}
                    style={styles.uploadedImg}
                    onLoad={() => console.log('🖼️ Image loaded successfully on screen')}
                    onError={(e) => console.error('🖼️ Image failed to render:', e.nativeEvent.error)}
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
                {uploading ? 'Uploading...' : formData.profilePhotoUrl ? 'Attached! ✅' : 'Upload your photo'}
              </Text>
            </View>
          )}

          {step === 7 && (
            <View>
              <Text style={styles.label}>Interests</Text>
              <MultiSelect
                style={styles.dropdown}
                data={INTEREST_DATA.map((i) => ({ label: i, value: i }))}
                labelField="label"
                valueField="value"
                placeholder="Select your interests"
                placeholderStyle={{ color: theme.colors.mutedText, fontWeight: '700' }}
                selectedTextStyle={{ color: theme.colors.text, fontWeight: '800' }}
                value={formData.interests}
                onChange={(item) => setFormData({ ...formData, interests: item })}
                selectedStyle={styles.selectedChip}
                activeColor={theme.colors.surface}
              />

              <FormInput
                styles={styles}
                theme={theme}
                label="Expectations"
                k="expectations"
                value={formData.expectations}
                missing={missing}
                placeholder="Tell us what you are looking for..."
                onChangeText={(v: any) => setFormData({ ...formData, expectations: v })}
                multiline
                style={{ marginTop: 22 }}
              />
            </View>
          )}

          {step === 8 && (
            <View style={styles.reviewBox}>
              <Text style={styles.reviewTitle}>Final Review</Text>
              <ProfileDisplay profile={formData} showPhoto />
              <Text style={styles.reviewFooter}>Please ensure all details are correct before submitting.</Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          {step > 1 && (
            <TouchableOpacity onPress={() => setStep(step - 1)} style={styles.backBtn} activeOpacity={0.85}>
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
  const s = theme.spacing;
  const r = theme.radius;

  return StyleSheet.create({
    // Expose radius for webDateStyle composition
    

    webSafeContainer: { flex: 1, backgroundColor: theme.colors.bg },

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

    stepText: { fontSize: 13, fontWeight: '900', color: theme.colors.text },

    headerTitle: { fontSize: 18, fontWeight: '900', color: theme.colors.text, marginTop: 2 },

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

    progressBarFill: { height: '100%', backgroundColor: theme.colors.primary },

    contentScroller: { flex: 1 },

    scrollArea: { padding: 20, paddingBottom: 40 },

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

    reqStar: { color: theme.colors.danger },

    optTag: { color: theme.colors.mutedText, fontWeight: '900' },

    inputGroup: { marginBottom: 16 },

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

    inputError: { borderColor: theme.colors.danger, borderWidth: 1.5 },

    rowGrid: { flexDirection: 'row', gap: 12 },

    footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },

    nextBtn: {
      flex: 1,
      backgroundColor: theme.colors.primary,
      height: 50,
      borderRadius: r.button,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 10,
    },

    nextText: { color: theme.colors.primaryText, fontWeight: '900' },

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

    backText: { color: theme.colors.text, fontWeight: '800' },

    divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 20 },

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

    addBtnText: { fontSize: 12, fontWeight: '900', color: theme.colors.text },

    compactFormBox: {
      backgroundColor: theme.colors.surface,
      padding: 10,
      borderRadius: r.card,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    eduRowHorizontal: { flexDirection: 'row', alignItems: 'center' },

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

    uploadedImg: { width: '100%', height: '100%' },

    miniLabel: { fontSize: 12, color: theme.colors.mutedText, marginTop: 10, fontWeight: '700' },

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
  });
}