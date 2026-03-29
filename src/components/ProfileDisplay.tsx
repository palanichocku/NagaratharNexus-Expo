import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { supabase } from '../lib/supabase';
import { PROFILE_SCHEMA, type ProfileFieldSchema } from '../constants/profileSchema';
import { PROFESSION_DATA } from '../constants/appData';
import { EXPECTATIONS_QUESTIONS, EXPECTATIONS_QUESTION_MAP } from '../constants/expectationsQuestions';

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

import SignOutButton from '@/src/components/SignOutButton';
import SuggestionInput from '@/src/components/form/SuggestionInput';
import { ExpectationsQuestionnaire } from '@/src/components/ExpectationsQuestionnaire';
import { useDialog } from '@/src/ui/feedback/useDialog';

function computeAge(dob: string | null | undefined): number | null {
  if (!dob || typeof dob !== 'string') return null;

  const parts = dob.split('-').map((p) => Number(p));
  if (parts.length !== 3) return null;

  const [year, month, day] = parts;
  if (!year || !month || !day) return null;

  const today = new Date();
  let age = today.getFullYear() - year;

  const m = today.getMonth() + 1;
  const d = today.getDate();

  if (m < month || (m === month && d < day)) age -= 1;

  return age >= 0 && age < 130 ? age : null;
}

function parseExpectationsPayload(value: any): Record<string, string> | null {
  if (!value) return null;

  if (typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value).length ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return null;
    }
  }

  return null;
}

export const ProfileDisplay = ({ profile, onSaveSection }: any) => {
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [tempData, setTempData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('USER');
  const dialog = useDialog();

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

  const countryOptions = useMemo(() => getCountryOptions(), []);

  if (!profile) return null;

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

    phone:
      profile.phone ??
      profile.phone_number ??
      profile.phoneNumber ??
      '',
    email:
      profile.email ??
      profile.email_address ??
      profile.emailAddress ??
      '',

    hidePhone:
      profile.hidePhone ??
      profile.hide_phone ??
      false,
    hideEmail:
      profile.hideEmail ??
      profile.hide_email ??
      false,

    maritalStatus: profile.maritalStatus ?? profile.marital_status ?? null,

    height: profile.height ?? profile.height_inches ?? '',

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
        ? profile.interests
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [],

    expectations: profile.expectations ?? '',
    profilePhotoUrl: profile.profilePhotoUrl ?? profile.profile_photo_url ?? '',
  };

  const canEditProfile =
    (!!profile?.id && !!currentUserId && String(profile.id) === String(currentUserId)) ||
    (!!currentUserEmail &&
      String(currentUserEmail).toLowerCase() ===
        String(displayProfile.email || '').toLowerCase());

  const isSelf = canEditProfile;
  const isStaff = currentUserRole === 'ADMIN' || currentUserRole === 'MODERATOR';
  const canViewPrivateContact = canEditProfile || isStaff;

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      router.replace('/login');

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.assign('/login');
      }
    } catch (e: any) {
      dialog.show({
        title: 'Sign out failed',
        message: e?.message || 'Please try again.',
        tone: 'error',
      });
    }
  };

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
      dialog.show({
        title: 'Save error',
        message: e?.message || 'Please try again.',
        tone: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const escapeHtml = useCallback((value: any) => {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }, []);

  const formatDobForPdf = useCallback((dob: string | null | undefined) => {
    if (!dob) return 'N/A';
    return dob;
  }, []);

  const getVisibleValueForPdf = useCallback(
    (field: ProfileFieldSchema, rawValue: any) => {
      const isPhoneField = field.key === 'phone' || field.key === 'phone_number';
      const isEmailField = field.key === 'email' || field.key === 'email_address';

      if (!canViewPrivateContact && isPhoneField && displayProfile.hidePhone) {
        return '[Private]';
      }

      if (!canViewPrivateContact && isEmailField && displayProfile.hideEmail) {
        return '[Private]';
      }

      if (field.key === 'dob') {
        const age = computeAge(typeof rawValue === 'string' ? rawValue : '');
        return `${formatDobForPdf(rawValue)}${age !== null ? ` (${age})` : ''}`;
      }

      if (field.type === 'education_history') {
        const arr = Array.isArray(rawValue) ? rawValue : [];
        if (!arr.length) return 'None listed';

        return arr
          .map((edu: any) => {
            const level = edu.level || '?';
            const fieldName = edu.field ? ` in ${edu.field}` : '';
            const university = edu.university ? ` (${edu.university})` : '';
            return `• ${level}${fieldName}${university}`;
          })
          .join('<br/>');
      }

      if (field.type === 'siblings_list') {
        const arr = Array.isArray(rawValue) ? rawValue : [];
        if (!arr.length) return 'None listed';

        return arr
          .map((sib: any) => {
            const name = sib.name || 'Name?';
            const marital = sib.maritalStatus ? ` (${sib.maritalStatus})` : '';
            const occupation = sib.occupation ? ` - ${sib.occupation}` : '';
            return `• ${name}${marital}${occupation}`;
          })
          .join('<br/>');
      }

      if (field.type === 'multiselect') {
        const arr = Array.isArray(rawValue) ? rawValue : [];
        return arr.length ? arr.join(', ') : 'None listed';
      }

      if (field.key === 'expectations') {
        const parsed = parseExpectationsPayload(rawValue);

        if (!parsed) {
          return rawValue || 'N/A';
        }

        const answeredItems = EXPECTATIONS_QUESTIONS
          .map((item) => ({
            ...item,
            answer: String(parsed[item.id] ?? '').trim(),
          }))
          .filter((item) => item.answer.length > 0);

        const knownAnswers = answeredItems.map((item) => {
          return `<strong>${escapeHtml(item.shortLabel)}:</strong> ${escapeHtml(item.answer)}`;
        });

        const extraAnswers = Object.keys(parsed)
          .filter((key) => !EXPECTATIONS_QUESTION_MAP[key] && String(parsed[key] ?? '').trim())
          .map((key) => {
            return `<strong>${escapeHtml(key.toUpperCase())}:</strong> ${escapeHtml(String(parsed[key] ?? ''))}`;
          });

        const allAnswers = [...knownAnswers, ...extraAnswers];

        return allAnswers.length ? allAnswers.join('<br/><br/>') : 'None listed';
      }

      if (rawValue && typeof rawValue === 'object') {
        return escapeHtml(JSON.stringify(rawValue));
      }

      return rawValue || 'N/A';
    },
    [
      canViewPrivateContact,
      displayProfile.hideEmail,
      displayProfile.hidePhone,
      escapeHtml,
      formatDobForPdf,
    ],
  );

  const pdfHtml = useMemo(() => {
    const age = computeAge(displayProfile.dob);
    const titleName = displayProfile.fullName || 'Member Profile';

    const quickFacts = [
      displayProfile.gender || null,
      age !== null ? `${age} years` : null,
      displayProfile.maritalStatus || null,
      displayProfile.residentCountry || null,
      displayProfile.profession || null,
    ].filter(Boolean);

    const quickFactsHtml = quickFacts.length
      ? `
        <div class="quickFacts">
          ${quickFacts.map((item) => `<span class="quickPill">${escapeHtml(item)}</span>`).join('')}
        </div>
      `
      : '';

    const photoHtml = displayProfile.profilePhotoUrl
      ? `
        <div class="heroShell">
          <img class="heroImage" src="${escapeHtml(displayProfile.profilePhotoUrl)}" alt="Profile photo" />
          <div class="heroOverlay"></div>
          <div class="heroTextWrap">
            <div class="heroEyebrow">Nagarathar Nexus</div>
            <div class="heroName">${escapeHtml(titleName)}</div>
            <div class="heroSub">Member profile summary</div>
          </div>
        </div>
      `
      : `
        <div class="coverCard">
          <div class="heroEyebrow">Nagarathar Nexus</div>
          <div class="heroName dark">${escapeHtml(titleName)}</div>
          <div class="heroSub dark">Member profile summary</div>
        </div>
      `;

    const sectionsHtml = PROFILE_SCHEMA.map((group) => {
      const fieldsHtml = group.fields
        .filter((field) => !['hidePhone', 'hideEmail'].includes(field.key))
        .map((field: any) => {
          const fullWidth =
            field.type === 'multiselect' ||
            field.type === 'education_history' ||
            field.type === 'siblings_list' ||
            field.key === 'expectations';

          const rawValue = (displayProfile as any)[field.key];
          const value = getVisibleValueForPdf(field, rawValue);

          return `
            <div class="field ${fullWidth ? 'fieldWide' : ''}">
              <div class="label">${escapeHtml(field.label)}</div>
              <div class="value">${String(value)}</div>
            </div>
          `;
        })
        .join('');

      return `
        <section class="sectionCard">
          <div class="sectionHeader">
            <div class="sectionDot"></div>
            <div class="sectionTitle">${escapeHtml(group.section)}</div>
          </div>
          <div class="grid">
            ${fieldsHtml}
          </div>
        </section>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(titleName)}</title>
          <style>
            @page {
              size: A4;
              margin: 26px;
            }

            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 0;
              background: #f7f5f2;
              color: #1f2937;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              line-height: 1.45;
            }

            .page {
              width: 100%;
            }

            .heroShell {
              position: relative;
              border-radius: 22px;
              overflow: hidden;
              min-height: 270px;
              border: 1px solid #e7dfd4;
              background: #ece7e0;
              margin-bottom: 18px;
            }

            .heroImage {
              width: 100%;
              height: 270px;
              object-fit: cover;
              display: block;
            }

            .heroOverlay {
              position: absolute;
              inset: 0;
              background: linear-gradient(
                180deg,
                rgba(17,24,39,0.08) 0%,
                rgba(17,24,39,0.18) 45%,
                rgba(17,24,39,0.72) 100%
              );
            }

            .heroTextWrap {
              position: absolute;
              left: 24px;
              right: 24px;
              bottom: 22px;
              color: #ffffff;
            }

            .heroEyebrow {
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 1.2px;
              text-transform: uppercase;
              opacity: 0.92;
              margin-bottom: 6px;
            }

            .heroName {
              font-size: 31px;
              font-weight: 800;
              line-height: 1.1;
              margin-bottom: 6px;
            }

            .heroName.dark {
              color: #111827;
            }

            .heroSub {
              font-size: 13px;
              font-weight: 600;
              opacity: 0.94;
            }

            .heroSub.dark {
              color: #6b7280;
            }

            .coverCard {
              border-radius: 22px;
              padding: 28px;
              background: linear-gradient(135deg, #f8f2ea 0%, #f0ebe4 100%);
              border: 1px solid #e7dfd4;
              margin-bottom: 18px;
            }

            .summaryBar {
              background: #fffdfa;
              border: 1px solid #eadfce;
              border-radius: 18px;
              padding: 18px 20px;
              margin-bottom: 18px;
            }

            .summaryTop {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              margin-bottom: 10px;
            }

            .summaryTitle {
              font-size: 16px;
              font-weight: 800;
              color: #111827;
            }

            .summarySub {
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.8px;
              color: #9a7b4f;
            }

            .quickFacts {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
              margin-top: 4px;
            }

            .quickPill {
              display: inline-block;
              padding: 7px 12px;
              border-radius: 999px;
              border: 1px solid #eadfce;
              background: #ffffff;
              color: #5b4630;
              font-size: 12px;
              font-weight: 700;
            }

            .sectionCard {
              background: #ffffff;
              border: 1px solid #ece7df;
              border-radius: 18px;
              padding: 18px 18px 8px 18px;
              margin-bottom: 16px;
              page-break-inside: avoid;
            }

            .sectionHeader {
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: 14px;
            }

            .sectionDot {
              width: 10px;
              height: 10px;
              border-radius: 999px;
              background: linear-gradient(135deg, #b88a52 0%, #8d5d2d 100%);
              flex-shrink: 0;
            }

            .sectionTitle {
              font-size: 12px;
              font-weight: 800;
              letter-spacing: 0.9px;
              text-transform: uppercase;
              color: #7c5c39;
            }

            .grid {
              display: flex;
              flex-wrap: wrap;
              gap: 14px;
            }

            .field {
              width: calc(33.333% - 10px);
              min-width: 160px;
              margin-bottom: 10px;
              page-break-inside: avoid;
            }

            .fieldWide {
              width: 100%;
            }

            .label {
              font-size: 10px;
              font-weight: 800;
              letter-spacing: 0.7px;
              text-transform: uppercase;
              color: #8b8b95;
              margin-bottom: 5px;
            }

            .value {
              font-size: 14px;
              font-weight: 650;
              color: #111827;
              line-height: 1.55;
              word-break: break-word;
            }

            .footer {
              margin-top: 14px;
              padding-top: 10px;
              border-top: 1px solid #e7dfd4;
              font-size: 10px;
              color: #8b8b95;
              text-align: right;
            }
          </style>
        </head>
        <body>
          <div class="page">
            ${photoHtml}

            <div class="summaryBar">
              <div class="summaryTop">
                <div class="summaryTitle">${escapeHtml(titleName)}</div>
                <div class="summarySub">Community Profile</div>
              </div>
              ${quickFactsHtml}
            </div>

            ${sectionsHtml}

            <div class="footer">
              Generated on ${escapeHtml(new Date().toLocaleString())}
            </div>
          </div>
        </body>
      </html>
    `;
  }, [displayProfile, escapeHtml, getVisibleValueForPdf]);

  const printHtmlOnWeb = useCallback(async (html: string, title: string) => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;

  const printWindow = window.open('', '_blank', 'width=1024,height=1400');

  if (!printWindow) {
    throw new Error('Unable to open print window. Please allow pop-ups for this site.');
  }

  printWindow.document.open();
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <style>
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
          }

          @page {
            size: A4;
            margin: 18mm;
          }

          @media print {
            html, body {
              width: 100%;
              height: auto;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `);
  printWindow.document.close();

  const waitForImages = async () => {
    const images = Array.from(printWindow.document.images || []);
    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }
            img.onload = () => resolve();
            img.onerror = () => resolve();
            setTimeout(() => resolve(), 2500);
          }),
      ),
    );
  };

  await waitForImages();

  await new Promise((resolve) => setTimeout(resolve, 300));

  printWindow.focus();
  printWindow.print();

  setTimeout(() => {
    printWindow.close();
  }, 800);

  return true;
}, [escapeHtml]);

 const handleDownloadPdf = useCallback(async () => {
  if (!canEditProfile || isGeneratingPdf) return;

  try {
    setIsGeneratingPdf(true);

    const safeName = String(displayProfile.fullName || 'member-profile')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-_]/g, '')
      .toLowerCase();

    if (Platform.OS === 'web') {
      await printHtmlOnWeb(pdfHtml, `${safeName}.pdf`);
      return;
    }

    const { uri } = await Print.printToFileAsync({
      html: pdfHtml,
      base64: false,
    });

    const canShare = await Sharing.isAvailableAsync();

    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `${safeName}.pdf`,
        UTI: '.pdf',
      });
    } else {
      dialog.show({
        title: 'PDF ready',
        message: `Your profile PDF was created successfully.\n\n${uri}`,
        tone: 'success',
      });
    }
  } catch (e: any) {
    dialog.show({
      title: 'PDF export failed',
      message: e?.message || 'Unable to create your profile PDF right now.',
      tone: 'error',
    });
  } finally {
    setIsGeneratingPdf(false);
  }
}, [
  canEditProfile,
  dialog,
  displayProfile.fullName,
  isGeneratingPdf,
  pdfHtml,
  printHtmlOnWeb,
]);

  const renderExpectationsView = (val: any) => {
    const parsed = parseExpectationsPayload(val);

    if (!parsed) {
      return <Text style={[styles.fieldValue, styles.longText]}>{val || 'N/A'}</Text>;
    }

    const answeredItems = EXPECTATIONS_QUESTIONS
      .map((item) => {
        const answer = String(parsed[item.id] ?? '').trim();
        return {
          ...item,
          answer,
        };
      })
      .filter((item) => item.answer.length > 0);

    if (!answeredItems.length) {
      return <Text style={styles.emptyValue}>None listed</Text>;
    }

    return (
      <View style={styles.expectationsList}>
        {answeredItems.map((item) => (
          <View key={item.id} style={styles.expectationCard}>
            <View style={styles.expectationTopRow}>
              <View style={styles.expectationBadge}>
                <Text style={styles.expectationBadgeText}>{item.shortLabel}</Text>
              </View>
              <Text style={styles.expectationQuestion}>{item.q}</Text>
            </View>

            <View style={styles.expectationAnswerWrap}>
              <Text style={styles.expectationAnswer}>{item.answer}</Text>
            </View>
          </View>
        ))}

        {Object.keys(parsed)
          .filter((key) => !EXPECTATIONS_QUESTION_MAP[key] && String(parsed[key] ?? '').trim())
          .map((key) => (
            <View key={key} style={styles.expectationCard}>
              <View style={styles.expectationTopRow}>
                <View style={styles.expectationBadge}>
                  <Text style={styles.expectationBadgeText}>{key.toUpperCase()}</Text>
                </View>
                <Text style={styles.expectationQuestion}>Additional response</Text>
              </View>

              <View style={styles.expectationAnswerWrap}>
                <Text style={styles.expectationAnswer}>{String(parsed[key] ?? '')}</Text>
              </View>
            </View>
          ))}
      </View>
    );
  };

  const renderViewValue = (field: ProfileFieldSchema, val: any) => {
    const isPhoneField = field.key === 'phone' || field.key === 'phone_number';
    const isEmailField = field.key === 'email' || field.key === 'email_address';

    if (!canViewPrivateContact && isPhoneField && displayProfile.hidePhone) {
      return <Text style={styles.privateValue}>[Private]</Text>;
    }

    if (!canViewPrivateContact && isEmailField && displayProfile.hideEmail) {
      return <Text style={styles.privateValue}>[Private]</Text>;
    }

    if (field.key === 'dob') {
      const dobStr = typeof val === 'string' ? val : '';
      const age = computeAge(dobStr);

      return (
        <View>
          <Text style={styles.fieldValue}>
            {dobStr || 'N/A'}
            {age !== null ? ` (${age})` : ''}
          </Text>
          {age !== null ? <Text style={styles.ageSubText}>{age} years old</Text> : null}
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
              • {edu.level || '?'}
              {edu.field ? ` in ${edu.field}` : ''}
              {edu.university ? ` (${edu.university})` : ''}
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
              • {sib.name || 'Name?'}
              {sib.maritalStatus ? ` (${sib.maritalStatus})` : ''}
              {sib.occupation ? ` - ${sib.occupation}` : ''}
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
      return renderExpectationsView(val);
    }

    if (val && typeof val === 'object') {
      return <Text style={styles.fieldValue}>{JSON.stringify(val)}</Text>;
    }

    return <Text style={styles.fieldValue}>{val || 'N/A'}</Text>;
  };

  const renderEditField = (field: ProfileFieldSchema) => {
    const key = field.key;

    if (key === 'dob') {
      return (
        <input
          type="date"
          value={tempData.dob || ''}
          onChange={(e) => setTempData({ ...tempData, dob: e.target.value })}
          style={webDateInputStyle}
        />
      );
    }

    if (field.editable === false) {
      return (
        <View style={styles.readonlyBox}>
          <Text style={styles.readonlyText}>
            {String(tempData[key] || displayProfile[key] || 'N/A')}
          </Text>
        </View>
      );
    }

    if (field.key === 'expectations') {
      return (
        <ExpectationsQuestionnaire
          value={tempData.expectations}
          onChange={(v) => setTempData({ ...tempData, expectations: v })}
          theme={theme}
        />
      );
    }

    if (field.type === 'country') {
      return (
        <FormSelect
          value={tempData[key] || ''}
          placeholder={`Select ${field.label}`}
          data={countryOptions}
          onChangeValue={(v) => {
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

    if (field.type === 'height') {
      return (
        <HeightStepper
          value={String(tempData[key] ?? '')}
          onChange={(v) => setTempData({ ...tempData, [key]: v })}
          theme={theme}
        />
      );
    }

    if (field.type === 'education_history') {
      return (
        <EducationEditor
          value={Array.isArray(tempData[key]) ? tempData[key] : []}
          onChange={(v) => setTempData({ ...tempData, [key]: v })}
          theme={theme}
        />
      );
    }

    if (field.type === 'siblings_list') {
      return (
        <SiblingsEditor
          value={Array.isArray(tempData[key]) ? tempData[key] : []}
          onChange={(v) => setTempData({ ...tempData, [key]: v })}
          theme={theme}
        />
      );
    }

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

    if (key === 'profession') {
      return (
        <SuggestionInput
          value={String(tempData.profession ?? '')}
          placeholder="Type your profession or pick a suggestion"
          suggestions={PROFESSION_DATA}
          theme={theme}
          onChange={(v) => setTempData({ ...tempData, profession: v })}
        />
      );
    }

    if (field.type === 'select') {
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

      if (key === 'pirivu') {
        const kovil = tempData.kovil || displayProfile.kovil;
        const pirivuOptions = getPirivuOptions(kovil);

        if (!pirivuOptions.length) {
          if (tempData.pirivu) {
            setTimeout(() => {
              setTempData((prev: any) => ({ ...prev, pirivu: '' }));
            }, 0);
          }

          return (
            <FormTextInput
              value=""
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
      <View style={styles.heroWrap}>
        <Image
          source={{ uri: displayProfile.profilePhotoUrl || 'https://i.pravatar.cc/400' }}
          style={styles.heroPhoto}
        />

        <View style={styles.heroGradientOverlay} />

        <View style={styles.heroContent}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroEyebrow}>Nagarathar Nexus</Text>
            <Text style={styles.heroName}>{displayProfile.fullName || 'Member Profile'}</Text>
            <Text style={styles.heroMeta}>
              {[displayProfile.gender, computeAge(displayProfile.dob) ? `${computeAge(displayProfile.dob)} yrs` : null, displayProfile.residentCountry]
                .filter(Boolean)
                .join(' • ')}
            </Text>
          </View>
        </View>

        {canEditProfile && (
          <View style={styles.heroTopActions}>
            <TouchableOpacity
              onPress={handleDownloadPdf}
              disabled={isGeneratingPdf}
              style={[styles.pdfButton, isGeneratingPdf && styles.pdfButtonDisabled]}
            >
              {isGeneratingPdf ? (
                <ActivityIndicator size="small" color="#7C5C39" />
              ) : (
                <Ionicons name="download-outline" size={18} color="#7C5C39" />
              )}
              <Text style={styles.pdfButtonText}>
                {Platform.OS === 'web' ? 'Save as PDF' : 'Download PDF'}
              </Text>
            </TouchableOpacity>

            <SignOutButton variant="row" label="SIGN OUT" style={styles.signOutBtn} />
          </View>
        )}
      </View>

      {!isSelf && (displayProfile.hidePhone || displayProfile.hideEmail) ? (
        <View style={styles.privateBanner}>
          <Ionicons name="lock-closed-outline" size={14} color="#7C5C39" />
          <Text style={styles.privateBannerText}>Contact info is private</Text>
        </View>
      ) : null}

      {PROFILE_SCHEMA.map((group) => {
        const isEditingThis = editingSection === group.section;

        return (
          <View
            key={group.section}
            style={[styles.section, isEditingThis && styles.sectionEditing]}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <View style={styles.sectionIconWrap}>
                  <Ionicons name={group.icon as any} size={14} color="#7C5C39" />
                </View>
                <Text style={styles.sectionTitle}>{group.section}</Text>
              </View>

              {canEditProfile && (
                <>
                  {!isEditingThis && !editingSection && (
                    <TouchableOpacity onPress={() => handleEditInit(group)} style={styles.headerIconBtn}>
                      <Ionicons name="pencil" size={16} color="#111827" />
                    </TouchableOpacity>
                  )}

                  {isEditingThis && (
                    <View style={styles.editIconGroup}>
                      <TouchableOpacity
                        onPress={handleCancel}
                        disabled={isSaving}
                        style={styles.headerIconBtn}
                      >
                        <Ionicons name="close" size={18} color="#FF3B30" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={handleSave}
                        disabled={isSaving}
                        style={styles.headerIconBtn}
                      >
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
                    <View
                      key={field.key}
                      style={fullWidth ? styles.fullWidthItem : styles.gridItem}
                    >
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
  borderRadius: '10px',
  border: '1px solid #DDD',
  fontSize: '14px',
  backgroundColor: '#FFF',
  width: '100%',
  fontFamily: 'inherit',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FCFAF7',
  },

  heroWrap: {
    position: 'relative',
    backgroundColor: '#F3EEE8',
  },

  heroPhoto: {
    width: '100%',
    height: 360,
    backgroundColor: '#EAE5DE',
  },

  heroGradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: 'rgba(17,24,39,0.18)',
  },

  heroContent: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 22,
    zIndex: 2,
  },

  heroTextBlock: {
    maxWidth: 700,
  },

  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F7F2EC',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },

  heroName: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
  },

  heroMeta: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
  },

  heroTopActions: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  pdfButton: {
    backgroundColor: 'rgba(255,250,244,0.96)',
    borderWidth: 1,
    borderColor: '#E6D8C4',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'web' ? 0 : 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },

  pdfButtonDisabled: {
    opacity: 0.75,
  },

  pdfButtonText: {
    color: '#7C5C39',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.2,
  },

  signOutBtn: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: '#F1E5D6',
  },

  privateBanner: {
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 2,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#FFF9F2',
    borderWidth: 1,
    borderColor: '#F0E2CF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  privateBannerText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#7C5C39',
  },

  section: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: '#EFE7DB',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'web' ? 0 : 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },

  sectionEditing: {
    backgroundColor: '#FFFCF8',
    borderColor: '#EADBC7',
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#F2E2CD',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#7C5C39',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  headerIconBtn: {
    padding: 6,
  },

  editIconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 15,
  },

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
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 5,
    letterSpacing: 0.4,
  },

  fieldValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    lineHeight: 22,
  },

  emptyValue: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#8E8E93',
  },

  readonlyBox: {
    backgroundColor: '#F7F7F8',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 10,
  },

  readonlyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },

  longText: {
    width: '100%',
    flexShrink: 1,
    flexWrap: 'wrap',
    lineHeight: 22,
  },

  expectationsList: {
    width: '100%',
    marginTop: 4,
    gap: 10,
  },

  expectationCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#EDE5DA',
    borderRadius: 16,
    backgroundColor: '#FCFAF7',
    padding: 14,
  },

  expectationTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  expectationBadge: {
    minWidth: 44,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DCCB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  expectationBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#7C5C39',
    letterSpacing: 0.4,
  },

  expectationQuestion: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
    color: '#374151',
    paddingTop: 4,
  },

  expectationAnswerWrap: {
    marginTop: 10,
    paddingLeft: 54,
  },

  expectationAnswer: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: '#111827',
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