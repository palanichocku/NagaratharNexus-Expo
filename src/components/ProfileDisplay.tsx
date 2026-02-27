// ./src/components/ProfileDisplay.tsx
import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { PROFILE_SCHEMA, type ProfileFieldSchema } from '../constants/profileSchema';

import {
  EducationEditor,
  FormMultiSelect,
  FormSelect,
  FormTextInput,
  getCountryOptions,
  getPirivuOptions,
  getStateOptions,
  HeightStepper,
  PROFILE_FIELD_OPTIONS,
  SiblingsEditor,
} from '../profileForm/profileFormKit';
import { router } from 'expo-router';

function computeAge(dob: string | null | undefined): number | null {
  if (!dob || typeof dob !== 'string') return null;

  // Expecting YYYY-MM-DD
  const parts = dob.split('-').map((p) => Number(p));
  if (parts.length !== 3) return null;

  const [year, month, day] = parts;
  if (!year || !month || !day) return null;

  const today = new Date();
  let age = today.getFullYear() - year;

  const m = today.getMonth() + 1; // 1-12
  const d = today.getDate();

  // If birthday hasn't happened yet this year, subtract 1
  if (m < month || (m === month && d < day)) age -= 1;

  return age >= 0 && age < 130 ? age : null;
}

export const ProfileDisplay = ({ profile, onSaveSection }: any) => {
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [tempData, setTempData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('USER');
  

  useEffect(() => {
  let isMounted = true;

  supabase.auth.getUser().then(async ({ data }) => {
    const uid = data.user?.id || null;
    const email = data.user?.email || '';

    if (!isMounted) return;

    setCurrentUserId(uid);
    setCurrentUserEmail(email);

    if (uid) {
      const { data: p } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', uid)
        .maybeSingle();

      if (!isMounted) return;

      setCurrentUserRole(String(p?.role || 'USER').toUpperCase());
    }
  });

  return () => {
    isMounted = false;
  };
}, []);

  const theme = useMemo(
    () => ({
      colors: {
        text: '#111827',
        mutedText: '#8E8E93',
        border: '#E5E7EB',
        inputBg: '#FFFFFF',
        surface2: '#F9FAFB',
        danger: '#FF3B30',
      },
      radius: { input: 12 },
    }),
    [],
  );

  const handleSignOut = async () => {
    try {
      console.log('Signing out user...');

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Double-check session is cleared
      const { data } = await supabase.auth.getSession();
      console.log('Session after signOut:', data.session);

      // Force UI to leave immediately
      router.replace('/(auth)/login');

      // ✅ Web: hard reload prevents any stale in-memory routing/session
      if (Platform.OS === 'web') {
        window.location.href = '/(auth)/login';
      }
    } catch (e: any) {
      Alert.alert('Sign out failed', e?.message || 'Please try again.');
    }
  };

  const countryOptions = useMemo(() => getCountryOptions(), []);

  if (!profile) return null;

  // ✅ Bridge DB snake_case to UI camelCase keys (schema keys)
  const displayProfile = {
    ...profile,

    fullName: profile.fullName ?? profile.full_name ?? '',
    dob: profile.dob ?? null,

    gender: profile.gender ?? null,
    citizenship: profile.citizenship ?? null,

    residentCountry: profile.residentCountry ?? profile.resident_country ?? null,
    residentStatus: profile.residentStatus ?? profile.resident_status ?? null,
    currentState: profile.currentState ?? profile.current_state ?? null,
    currentCity: profile.currentCity ?? profile.current_city ?? '',

    phone: profile.phone ?? '',
    email: profile.email ?? '',
    hidePhone: profile.hidePhone ?? profile.hide_phone ?? false,
    hideEmail: profile.hideEmail ?? profile.hide_email ?? false,

    maritalStatus: profile.maritalStatus ?? profile.marital_status ?? null,

    height: profile.height ?? '',

    profession: profile.profession ?? null,
    workplace: profile.workplace ?? '',
    linkedinProfile: profile.linkedinProfile ?? profile.linkedin_profile ?? '',

    nativePlace: profile.nativePlace ?? profile.native_place ?? null,
    familyInitials: profile.familyInitials ?? profile.family_initials ?? '',

    fatherName: profile.fatherName ?? profile.father_name ?? '',
    fatherWork: profile.fatherWork ?? profile.father_work ?? '',
    fatherPhone: profile.fatherPhone ?? profile.father_phone ?? '',

    motherName: profile.motherName ?? profile.mother_name ?? '',
    motherWork: profile.motherWork ?? profile.mother_work ?? '',
    motherPhone: profile.motherPhone ?? profile.mother_phone ?? '',

    educationHistory: Array.isArray(profile.education_history)
      ? profile.education_history
      : Array.isArray(profile.educationHistory)
        ? profile.educationHistory
        : [],

    siblings: Array.isArray(profile.family_details?.siblings)
      ? profile.family_details.siblings
      : Array.isArray(profile.familyDetails?.siblings)
        ? profile.familyDetails.siblings
        : Array.isArray(profile.siblings)
          ? profile.siblings
          : [],

    kovil: profile.kovil ?? null,
    pirivu: profile.pirivu ?? null,
    rasi: profile.rasi ?? null,
    star: profile.star ?? null,

    interests: Array.isArray(profile.interests)
      ? profile.interests
      : typeof profile.interests === 'string'
        ? profile.interests.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [],

    expectations: profile.expectations ?? '',

    profilePhotoUrl: profile.profilePhotoUrl ?? profile.profile_photo_url ?? '',
  };

  const canEditProfile =
    (!!profile?.id && !!currentUserId && String(profile.id) === String(currentUserId)) ||
    (!!currentUserEmail &&
      String(currentUserEmail).toLowerCase() ===
        String((profile as any)?.email || (displayProfile as any)?.email || '').toLowerCase());
  
  const isSelf = canEditProfile;
  const isStaff = currentUserRole === 'ADMIN' || currentUserRole === 'MODERATOR';
  const canViewPrivateContact = canEditProfile || isStaff;

  const handleEditInit = (group: any) => {
    setTempData({ ...displayProfile });
    setEditingSection(group.section);
  };

  const handleCancel = () => {
    setEditingSection(null);
    setTempData({});
  };

  const handleSave = async () => {
    if (typeof onSaveSection !== 'function') {
      setEditingSection(null);
      return;
    }
    setIsSaving(true);
    try {
      await onSaveSection(tempData);
      setEditingSection(null);
    } catch (e: any) {
      Alert.alert('Save Error', e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const renderViewValue = (field: ProfileFieldSchema, val: any) => {

    // Privacy: hide phone/email for non-owners
    if (!canViewPrivateContact && field.key === 'phone' && displayProfile.hidePhone) {
      return <Text style={styles.privateValue}>[Private]</Text>;
    }

    if (!canViewPrivateContact && field.key === 'email' && displayProfile.hideEmail) {
      return <Text style={styles.privateValue}>[Private]</Text>;
    }

    // ✅ DOB: show age nicely
    if (field.key === 'dob') {
      const dobStr = typeof val === 'string' ? val : '';
      const age = computeAge(dobStr);

      return (
        <View>
          <Text style={styles.fieldValue}>
            {dobStr || 'N/A'}{age !== null ? ` (${age})` : ''}
          </Text>
          {age !== null ? (
            <Text style={styles.ageSubText}>{age} years old</Text>
          ) : null}
        </View>
      );
    }
    
    if (field.type === 'education_history') {
      const arr = Array.isArray(val) ? val : [];
      if (!arr.length) return <Text style={styles.emptyValue}>None listed</Text>;
      return (
        <>
          {arr.map((edu: any, i: number) => (
            <Text key={i} style={styles.fieldValue}>
              • {edu.level || '?'}{edu.field ? ` in ${edu.field}` : ''}{edu.university ? ` (${edu.university})` : ''}
            </Text>
          ))}
        </>
      );
    }

    if (field.type === 'siblings_list') {
      const arr = Array.isArray(val) ? val : [];
      if (!arr.length) return <Text style={styles.emptyValue}>None listed</Text>;
      return (
        <>
          {arr.map((sib: any, i: number) => (
            <Text key={i} style={styles.fieldValue}>
              • {sib.name || 'Name?'}{sib.maritalStatus ? ` (${sib.maritalStatus})` : ''}{sib.occupation ? ` - ${sib.occupation}` : ''}
            </Text>
          ))}
        </>
      );
    }

    if (field.type === 'multiselect') {
      const arr = Array.isArray(val) ? val : [];
      if (!arr.length) return <Text style={styles.emptyValue}>None listed</Text>;
      return <Text style={styles.fieldValue}>{arr.join(', ')}</Text>;
    }

    if (field.key === 'expectations') {
      return <Text style={[styles.fieldValue, styles.longText]}>{val || 'N/A'}</Text>;
    }

    if (val && typeof val === 'object') {
      return <Text style={styles.fieldValue}>{JSON.stringify(val)}</Text>;
    }

    return <Text style={styles.fieldValue}>{val || 'N/A'}</Text>;
  };

  const renderEditField = (field: ProfileFieldSchema) => {
    const key = field.key;

    // DOB web-only input
    // ✅ DOB: show age nicely
    // DOB web-only input 
    if (key === 'dob') { 
      return ( 
        <input 
          type="date" value={tempData.dob || ''} 
          onChange={(e) => setTempData({ ...tempData, dob: e.target.value })} 
          style={webDateInputStyle} /> 
        ); 
    }

    // Non-editable fields
    if (field.editable === false) {
      return (
        <View style={styles.readonlyBox}>
          <Text style={styles.readonlyText}>{String(tempData[key] || displayProfile[key] || 'N/A')}</Text>
        </View>
      );
    }

    // Country picker (open-source Country-State-City)
    if (field.type === 'country') {
      return (
        <FormSelect
          value={tempData[key] || ''}
          placeholder={`Select ${field.label}`}
          data={countryOptions}
          onChangeValue={(v) => {
            // If residentCountry changed, clear state
            if (key === 'residentCountry') {
              setTempData({ ...tempData, residentCountry: v, currentState: '' });
              return;
            }
            setTempData({ ...tempData, [key]: v });
          }}
          theme={theme}
        />
      );
    }

    // State picker depends on residentCountry
    if (field.type === 'state') {
      const states = getStateOptions(tempData.residentCountry || displayProfile.residentCountry);
      if (!states.length) {
        return (
          <FormTextInput
            value={String(tempData[key] ?? '')}
            placeholder={field.label}
            onChange={(v) => setTempData({ ...tempData, [key]: v })}
            theme={theme}
          />
        );
      }
      return (
        <FormSelect
          value={tempData[key] || ''}
          placeholder="Select state"
          data={states}
          onChangeValue={(v) => setTempData({ ...tempData, [key]: v })}
          theme={theme}
        />
      );
    }

    // Height stepper
    if (field.type === 'height') {
      return (
        <HeightStepper
          value={String(tempData[key] ?? '')}
          onChange={(v) => setTempData({ ...tempData, [key]: v })}
          theme={theme}
        />
      );
    }

    // Education history repeater
    if (field.type === 'education_history') {
      return (
        <EducationEditor
          value={Array.isArray(tempData[key]) ? tempData[key] : []}
          onChange={(v) => setTempData({ ...tempData, [key]: v })}
          theme={theme}
        />
      );
    }

    // Siblings repeater
    if (field.type === 'siblings_list') {
      return (
        <SiblingsEditor
          value={Array.isArray(tempData[key]) ? tempData[key] : []}
          onChange={(v) => setTempData({ ...tempData, [key]: v })}
          theme={theme}
        />
      );
    }

    // Multi select
    if (field.type === 'multiselect') {
      const data = (PROFILE_FIELD_OPTIONS as any)[key] || [];
      return (
        <FormMultiSelect
          value={Array.isArray(tempData[key]) ? tempData[key] : []}
          placeholder={`Select ${field.label}`}
          data={data}
          onChangeValue={(v) => setTempData({ ...tempData, [key]: v })}
          theme={theme}
        />
      );
    }

    // Select (appData-driven)
    if (field.type === 'select') {
      // Special: citizenship should be open-source country list (not typed)
      if (key === 'citizenship') {
        return (
          <FormSelect
            value={tempData[key] || ''}
            placeholder="Select citizenship"
            data={countryOptions}
            onChangeValue={(v) => setTempData({ ...tempData, [key]: v })}
            theme={theme}
          />
        );
      }

      // Special: pirivu depends on kovil; clear if kovil has no pirivus
      if (key === 'pirivu') {
        const kovil = tempData.kovil || displayProfile.kovil;
        const pirivuOptions = getPirivuOptions(kovil);
        if (!pirivuOptions.length) {
          // If no pirivus for this kovil, force clear
          if (tempData.pirivu) {
            // avoid setState loop by only clearing when needed
            setTimeout(() => {
              setTempData((prev: any) => ({ ...prev, pirivu: '' }));
            }, 0);
          }
          return (
            <FormTextInput
              value={''}
              placeholder="Not applicable"
              onChange={() => null}
              theme={theme}
            />
          );
        }
        return (
          <FormSelect
            value={tempData.pirivu || ''}
            placeholder="Select pirivu"
            data={pirivuOptions}
            onChangeValue={(v) => setTempData({ ...tempData, pirivu: v })}
            theme={theme}
          />
        );
      }

      // Special: kovil change should clear pirivu if invalid
      if (key === 'kovil') {
        const data = (PROFILE_FIELD_OPTIONS as any)[key] || [];
        return (
          <FormSelect
            value={tempData[key] || ''}
            placeholder="Select kovil"
            data={data}
            onChangeValue={(v) => {
              const pirivuOptions = getPirivuOptions(v);
              const currentPirivu = tempData.pirivu || '';
              const stillValid = pirivuOptions.some((p) => p.value === currentPirivu);
              setTempData({
                ...tempData,
                kovil: v,
                pirivu: pirivuOptions.length && stillValid ? currentPirivu : '',
              });
            }}
            theme={theme}
          />
        );
      }

      const data = (PROFILE_FIELD_OPTIONS as any)[key] || [];
      return (
        <FormSelect
          value={tempData[key] || ''}
          placeholder={`Select ${field.label}`}
          data={data}
          onChangeValue={(v) => setTempData({ ...tempData, [key]: v })}
          theme={theme}
        />
      );
    }

    // Default free-form text
    return (
      <FormTextInput
        value={String(tempData[key] ?? '')}
        placeholder={field.label}
        onChange={(v) => setTempData({ ...tempData, [key]: v })}
        theme={theme}
      />
    );
  };

  return (
    
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={{ position: 'relative' }}>
        <Image
          source={{ uri: displayProfile.profilePhotoUrl || 'https://i.pravatar.cc/400' }}
          style={styles.heroPhoto}
        />
        {canEditProfile && (
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        )}
      </View>

      {!isSelf && (displayProfile.hidePhone || displayProfile.hideEmail) ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 25, paddingTop: 12 }}>
          <Ionicons name="lock-closed-outline" size={14} color="#6B7280" />
          <Text style={styles.privateValue}>Contact info is private</Text>
        </View>
      ) : null}

      {PROFILE_SCHEMA.map((group) => {
        const isEditingThis = editingSection === group.section;
        return (
          <View key={group.section} style={[styles.section, isEditingThis && styles.sectionEditing]}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name={group.icon as any} size={14} color="#111827" />
                <Text style={styles.sectionTitle}>{group.section}</Text>
              </View>

              {canEditProfile && (
                <>
                  {!isEditingThis && !editingSection && (
                    <TouchableOpacity onPress={() => handleEditInit(group)}>
                      <Ionicons name="pencil" size={16} color="#111827" />
                    </TouchableOpacity>
                  )}

                  {isEditingThis && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <TouchableOpacity onPress={handleCancel} disabled={isSaving} style={{ padding: 6 }}>
                        <Ionicons name="close" size={18} color="#FF3B30" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleSave} disabled={isSaving} style={{ padding: 6 }}>
                        {isSaving ? (
                          <ActivityIndicator size="small" />
                        ) : (
                          <Ionicons name="checkmark" size={20} color="#34C759" />
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>

            <View style={styles.fieldGrid}>
              {group.fields
                .filter((field) => !['hidePhone', 'hideEmail'].includes(field.key))
                .map((field: any) => {
                  const fullWidth =
                    field.type === 'multiselect' ||
                    field.type === 'education_history' ||
                    field.type === 'siblings_list' ||
                    field.key === 'expectations';

                const value = (displayProfile as any)[field.key];

                return (
                  <View key={field.key} style={fullWidth ? styles.fullWidthItem : styles.gridItem}>
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    {isEditingThis ? renderEditField(field) : renderViewValue(field, value)}
                  </View>
                );
              })}
            </View>

          </View>
        );
      })}
    </ScrollView>
  );
};

const webDateInputStyle: any = {
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid #DDD',
  fontSize: '14px',
  backgroundColor: '#FFF',
  width: '100%',
  fontFamily: 'inherit',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  heroPhoto: { width: '100%', height: 350 },

  signOutBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    zIndex: 1000,
  },
  signOutText: { color: '#FF3B30', fontWeight: '800', fontSize: 13 },

  section: { padding: 25, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  sectionEditing: { backgroundColor: '#F9FAFB' },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8E8E93',
    textTransform: 'uppercase',
  },

  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 15,
  },

  // 3-per-row on web and native; % math works well with gap
  gridItem: {
    width: '30%',
    marginBottom: 20,
  },

  fullWidthItem: {
    width: '100%',
    marginBottom: 12,
  },

  fieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  fieldValue: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', marginBottom: 4 },
  emptyValue: { fontSize: 14, fontStyle: 'italic', color: '#8E8E93' },

  readonlyBox: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 10,
  },
  readonlyText: { fontSize: 14, fontWeight: '700', color: '#111827' },

  longText: {
    width: '100%',
    flexShrink: 1,
    flexWrap: 'wrap',
    lineHeight: 22,
  },
  privateValue: {
  fontSize: 14,
  fontWeight: '800',
  color: '#6B7280',
  letterSpacing: 0.3,
},
ageSubText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 2,
  },
});
