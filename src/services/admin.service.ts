// ./src/services/admin.service.ts
import { supabase, REDIRECT_URL } from '../lib/supabase';
import * as AppData from '../constants/appData';
import { Alert, Platform } from 'react-native';
import { AUDIT_SETTINGS } from '../constants/auditConfig';

/**
 * 🚀 ROBUST HELPERS
 */
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const pick = (arr: any[]) => {
  if (!arr || arr.length === 0) return '';
  const item = arr[Math.floor(Math.random() * arr.length)];
  return typeof item === 'object' ? (item.value || item.label) : item;
};

const pickMany = (arr: any[] | undefined, count: number) => {
  const source = arr || [];
  if (source.length === 0) return [];
  return [...source]
    .sort(() => 0.5 - Math.random())
    .slice(0, count)
    .map(item => (typeof item === 'object' ? (item.value || item.label) : item));
};

// Robust picker for kovil/pirivu objects
const pickKovil = () => {
  const kovil = AppData.KOVIL_DATA[Math.floor(Math.random() * AppData.KOVIL_DATA.length)];
  const pirivu = (kovil.pirivus && kovil.pirivus.length > 0)
    ? kovil.pirivus[Math.floor(Math.random() * kovil.pirivus.length)]
    : 'None';

  return { kovil: kovil.value, pirivu };
};

const getRandomDate = (start: Date, end: Date) => {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
};

/**
 * ✅ FIX: Generates a RFC4122 version 4 compliant UUID
 */
const generateValidUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export type SuccessStory = {
  id: string;
  title: string;
  wedding_date: string | null;
  short_description: string | null;
  feedback: string | null;
  photo_url: string | null;
  photo_path: string | null;
  consent_confirmed: boolean;
  is_published: boolean;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type RoleRow = {
  user_id: string;
  role: string | null;
};

type AnalyticsProfileRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  created_at?: string | null;
  last_login_at?: string | null;
  is_submitted?: boolean | null;
  is_approved?: boolean | null;
  account_status?: string | null;
  profile_photo_url?: string | null;
  profession?: string | null;
  expectations?: string | null;
  education_history?: any[] | null;
  resident_country?: string | null;
  age?: number | string | null;
  gender?: string | null;
  marital_status?: string | null;
  kovil?: string | null;
  native_place?: string | null;
};

export type PendingProfileCursor = {
  created_at: string;
  id: string;
};

export type PendingProfilesPage = {
  items: any[];
  nextCursor: PendingProfileCursor | null;
  hasMore: boolean;
};

async function fetchAllPaged<T>(
  table: string,
  selectClause: string,
  pageSize: number = 1000,
  queryBuilder?: (query: any) => any,
  orderBy?: { column: string; ascending?: boolean }
): Promise<T[]> {
  const allRows: T[] = [];
  let from = 0;

  while (true) {
    let query = supabase.from(table).select(selectClause);

    if (queryBuilder) {
      query = queryBuilder(query);
    }

    if (orderBy?.column) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    }

    const { data, error } = await query.range(from, from + pageSize - 1);

    if (error) throw error;

    const rows = (data ?? []) as T[];
    allRows.push(...rows);

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

async function fetchAllAnalyticsProfiles(): Promise<AnalyticsProfileRow[]> {
  return fetchAllPaged<AnalyticsProfileRow>(
    'profiles',
    `
      id,
      full_name,
      email,
      created_at,
      last_login_at,
      is_submitted,
      is_approved,
      account_status,
      profile_photo_url,
      profession,
      expectations,
      education_history,
      resident_country,
      age,
      gender,
      kovil,
      native_place
    `
  );
}

async function fetchAllApprovedSubmittedProfilesForDistribution(): Promise<AnalyticsProfileRow[]> {
  return fetchAllPaged<AnalyticsProfileRow>(
    'profiles',
    `
      id,
      resident_country,
      age,
      gender,
      marital_status,
      kovil,
      native_place,
      education_history,
      is_submitted,
      is_approved
    `,
    1000,
    (query) => query.eq('is_submitted', true).eq('is_approved', true)
  );
}

async function fetchAllUserRoles(): Promise<RoleRow[]> {
  return fetchAllPaged<RoleRow>('user_roles', 'user_id, role');
}

async function fetchAllProfilesBasic(): Promise<any[]> {
  return fetchAllPaged<any>(
    'profiles',
    '*',
    1000,
    undefined,
    { column: 'full_name', ascending: true }
  );
}

async function fetchAllPendingProfilesBasic(): Promise<any[]> {
  return fetchAllPaged<any>(
    'profiles',
    '*',
    1000,
    (query) => query.eq('is_approved', false).eq('is_submitted', true)
  );
}

async function fetchUserRolesByIds(userIds: string[]) {
  const roleMap = new Map<string, string>();

  for (let i = 0; i < userIds.length; i += 500) {
    const chunk = userIds.slice(i, i + 500);

    const { data, error } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', chunk);

    if (error) throw error;

    (data ?? []).forEach((row: any) => {
      roleMap.set(String(row.user_id), String(row.role || 'USER').toUpperCase().trim());
    });
  }

  return roleMap;
}

// --- MAIN SERVICE OBJECT ---
export const adminService = {
  async listSuccessStories() {
    const { data, error } = await supabase
      .from('success_stories')
      .select('*')
      .order('is_featured', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('wedding_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  async createSuccessStory(payload: {
    title: string;
    wedding_date?: string | null;
    short_description?: string | null;
    feedback?: string | null;
    photo_url?: string | null;
    photo_path?: string | null;
    consent_confirmed?: boolean;
    is_published?: boolean;
    is_featured?: boolean;
    sort_order?: number;
  }) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? null;

    const { data, error } = await supabase
      .from('success_stories')
      .insert({
        ...payload,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateSuccessStory(
    id: string,
    payload: Partial<{
      title: string;
      wedding_date: string | null;
      short_description: string | null;
      feedback: string | null;
      photo_url: string | null;
      photo_path: string | null;
      consent_confirmed: boolean;
      is_published: boolean;
      is_featured: boolean;
      sort_order: number;
    }>
  ) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? null;

    const { data, error } = await supabase
      .from('success_stories')
      .update({
        ...payload,
        updated_by: userId,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteSuccessStory(id: string) {
    const { error } = await supabase
      .from('success_stories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async setSuccessStoryPublished(id: string, isPublished: boolean) {
    return this.updateSuccessStory(id, { is_published: isPublished });
  },

  async setSuccessStoryFeatured(id: string, isFeatured: boolean) {
    return this.updateSuccessStory(id, { is_featured: isFeatured });
  },

  // --- 1. GLOBAL SYSTEM CONFIGURATION ---
  async getSystemConfig() {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'global_config')
        .maybeSingle();

      if (error) throw error;

      const cfg = (data?.value ?? {}) as any;

      return {
        maintenanceMode: !!cfg.maintenanceMode,
        allowRegistration:
          typeof cfg.allowRegistration === 'boolean'
            ? cfg.allowRegistration
            : typeof cfg.registrationEnabled === 'boolean'
              ? cfg.registrationEnabled
              : true,
        requireApproval:
          typeof cfg.requireApproval === 'boolean'
            ? cfg.requireApproval
            : typeof cfg.requireApprovalForSearch === 'boolean'
              ? cfg.requireApprovalForSearch
              : true,
        autoPauseThreshold: String(
          cfg.autoPauseThreshold ?? cfg.autoFlagThreshold ?? 3
        ),
        favoritesLimit: String(cfg.favoritesLimit ?? 5),
        inactiveUserThresholdDays: String(cfg.inactiveUserThresholdDays ?? 30),
        welcomeMessage: String(cfg.welcomeMessage ?? ''),
        themeName: String(cfg.themeName ?? 'warm'),
      };
    } catch (err) {
      console.error('Config fetch failed, using defaults:', err);
      return {
        maintenanceMode: false,
        allowRegistration: true,
        requireApproval: true,
        autoPauseThreshold: '3',
        favoritesLimit: '5',
        inactiveUserThresholdDays: '30',
        welcomeMessage: '',
        themeName: 'warm',
      };
    }
  },

  async updateSystemConfig(updates: any) {
    const { data: current, error: readError } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'global_config')
      .maybeSingle();

    if (readError) throw readError;

    const currentValue = (current?.value ?? {}) as any;

    const normalized = {
      ...currentValue,
      maintenanceMode: !!updates.maintenanceMode,
      allowRegistration:
        typeof updates.allowRegistration === 'boolean'
          ? updates.allowRegistration
          : typeof currentValue.allowRegistration === 'boolean'
            ? currentValue.allowRegistration
            : typeof currentValue.registrationEnabled === 'boolean'
              ? currentValue.registrationEnabled
              : true,
      requireApproval:
        typeof updates.requireApproval === 'boolean'
          ? updates.requireApproval
          : typeof currentValue.requireApproval === 'boolean'
            ? currentValue.requireApproval
            : typeof currentValue.requireApprovalForSearch === 'boolean'
              ? currentValue.requireApprovalForSearch
              : true,
      autoPauseThreshold: String(
        updates.autoPauseThreshold ??
          currentValue.autoPauseThreshold ??
          currentValue.autoFlagThreshold ??
          '3'
      ),
      favoritesLimit: String(
        updates.favoritesLimit ?? currentValue.favoritesLimit ?? '5'
      ),
      inactiveUserThresholdDays: String(
        updates.inactiveUserThresholdDays ??
          currentValue.inactiveUserThresholdDays ??
          '30'
      ),
      welcomeMessage: String(
        updates.welcomeMessage ?? currentValue.welcomeMessage ?? ''
      ),
      themeName: String(updates.themeName ?? currentValue.themeName ?? 'warm'),
    };

    delete (normalized as any).registrationEnabled;
    delete (normalized as any).requireApprovalForSearch;
    delete (normalized as any).autoFlagThreshold;

    const { error: upsertError } = await supabase.from('system_settings').upsert({
      key: 'global_config',
      value: normalized,
      updated_at: new Date().toISOString(),
    });

    if (upsertError) throw upsertError;

    await this.logAction(
      'UPDATE_SYSTEM_CONFIG',
      `Updated: ${Object.keys(updates).join(', ')}`
    );
  },

  async executeMassCleanup() {
    const confirmed = window.confirm('⚠️ DANGER: This will delete all TEST DATA and unsubmitted profiles. Proceed?');
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .or('is_test_data.eq.true,is_submitted.eq.false');

      if (error) throw error;
      await this.logAction('DATA_WIPE', 'Executed mass cleanup of test/unsubmitted data');
      window.alert('Cleanup successful.');
      return true;
    } catch (error: any) {
      console.error('❌ Cleanup failed:', error.message);
      window.alert('Cleanup failed: ' + error.message);
      return false;
    }
  },

  async testAuditLogInsert() {
    if (!AUDIT_SETTINGS.enabled || !AUDIT_SETTINGS.levels.PROFILE_APPROVAL) {
      return { success: false, error: 'Audit logging is disabled.' };
    }

    try {
      const payload = {
        action: 'PROFILE_APPROVAL',
        details: 'Manual audit log test from Admin Dashboard',
        target_id: null,
      };

      const { data, error } = await supabase
        .from('audit_logs')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Audit log test row inserted:', data);
      return { success: true, data };
    } catch (err: any) {
      console.error('❌ Audit log test failed:', err);
      return { success: false, error: err?.message || 'Unknown error' };
    }
  },

  async getReports() {
    const { data, error } = await supabase
      .from('reports')
      .select(`
        *,
        reporter:profiles!reporter_id(full_name,email),
        target:profiles!target_id(full_name,email,account_status)
      `)
      .order('created_at', { ascending: false });

    if (error) return [];

    return (data ?? [])
      .filter((report: any) => {
        const status = String(report?.status || 'PENDING').toUpperCase().trim();
        const targetStatus = String(report?.target?.account_status || 'ACTIVE').toUpperCase().trim();
        const isOpen = !status || status === 'PENDING' || status === 'OPEN' || status === 'ACTIVE';
        return isOpen && targetStatus !== 'INACTIVE';
      })
      .map((report: any) => ({
        ...report,
        reporterName: report.reporter?.full_name || 'Unknown',
        reporterEmail: report.reporter?.email || '',
        targetName: report.target?.full_name || 'Unknown',
        targetEmail: report.target?.email || '',
      }));
  },

  async logAction(action: keyof typeof AUDIT_SETTINGS.levels, details: string, targetId?: string) {
    if (!AUDIT_SETTINGS.enabled || !AUDIT_SETTINGS.levels[action]) return;

    const isUuid = (v?: string) =>
      typeof v === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());

    try {
      const { data: { user }, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      if (!user?.id) return;

      const payload = {
        action: String(action),
        details,
        target_id: isUuid(targetId) ? targetId : null,
      };

      const { error } = await supabase.from('audit_logs').insert(payload);
      if (error) throw error;
    } catch (error) {
      console.error('🕵️ Audit Log failed:', error);
    }
  },

  // --- 2. USER MANAGEMENT ---
  async getAllUsers() {
    try {
      const profs = await fetchAllProfilesBasic();
      if (!profs.length) return [];

      const userIds = profs.map((p) => p.id);
      const roleMap = new Map<string, string>();

      for (let i = 0; i < userIds.length; i += 1000) {
        const chunk = userIds.slice(i, i + 1000);
        const { data: roles, error: roleError } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', chunk);

        if (roleError) throw roleError;

        (roles ?? []).forEach((r: any) => {
          roleMap.set(String(r.user_id), String(r.role || 'USER'));
        });
      }

      return profs.map((u) => ({
        ...u,
        role: roleMap.get(String(u.id)) || 'USER',
      }));
    } catch (err) {
      console.error('getAllUsers Error:', err);
      return [];
    }
  },

  // --- 3. ANALYTICS ---
async getDistributionData() {
  try {
    const [profiles, roleRows] = await Promise.all([
      fetchAllApprovedSubmittedProfilesForDistribution(),
      fetchAllUserRoles(),
    ]);

    const roleByUserId: Record<string, string> = {};
    const roleBuckets = new Set<string>(['USER']);

    (roleRows || []).forEach((row: any) => {
      const uid = String(row?.user_id || '').trim();
      const role = String(row?.role || 'USER').toUpperCase().trim() || 'USER';

      if (uid) {
        roleByUserId[uid] = role;
      }

      roleBuckets.add(role);
    });

    const distributions: any = {
      countries: {},
      ageGroups: { '18-25': 0, '26-35': 0, '36-45': 0, '46+': 0 },
      education: {},
      gender: {},
      maritalStatus: {
        Unmarried: 0,
        Married: 0,
        Other: 0,
      },
      roles: {},
      kovils: {},
      nativePlaces: {},
    };

    roleBuckets.forEach((role) => {
      distributions.roles[role] = 0;
    });

    (roleRows || []).forEach((row: any) => {
      const role = String(row?.role || 'USER').toUpperCase().trim() || 'USER';
      distributions.roles[role] = (distributions.roles[role] || 0) + 1;
    });

    const memberProfiles = (profiles || []).filter((profile: any) => {
      const role = (roleByUserId[profile.id] || 'USER').toUpperCase().trim();
      return role === 'USER';
    });

    memberProfiles.forEach((profile: any) => {
      const country = String(profile.resident_country || 'Other').trim() || 'Other';
      distributions.countries[country] = (distributions.countries[country] || 0) + 1;

      const nativePlace = String(profile.native_place || 'Other').trim() || 'Other';
      distributions.nativePlaces[nativePlace] =
        (distributions.nativePlaces[nativePlace] || 0) + 1;

      const age = parseInt(String(profile.age || '0'), 10);
      if (age >= 18 && age <= 25) distributions.ageGroups['18-25'] += 1;
      else if (age >= 26 && age <= 35) distributions.ageGroups['26-35'] += 1;
      else if (age >= 36 && age <= 45) distributions.ageGroups['36-45'] += 1;
      else if (age > 45) distributions.ageGroups['46+'] += 1;

      const gender = String(profile.gender || 'UNKNOWN').toUpperCase().trim() || 'UNKNOWN';
      distributions.gender[gender] = (distributions.gender[gender] || 0) + 1;

      const maritalRaw = String(profile.marital_status || '').trim().toUpperCase();
      if (maritalRaw === 'UNMARRIED') {
        distributions.maritalStatus.Unmarried += 1;
      } else if (maritalRaw === 'MARRIED') {
        distributions.maritalStatus.Married += 1;
      } else {
        distributions.maritalStatus.Other += 1;
      }

      const kovil = String(profile.kovil || 'Other').trim() || 'Other';
      distributions.kovils[kovil] = (distributions.kovils[kovil] || 0) + 1;

      if (Array.isArray(profile.education_history)) {
        profile.education_history.forEach((entry: any) => {
          const degree = String(entry?.level ?? '').trim();
          if (!degree) return;
          distributions.education[degree] =
            (distributions.education[degree] || 0) + 1;
        });
      }
    });

    return distributions;
  } catch (error: any) {
    console.error('getDistributionData error:', error?.message || error);
    return {
      countries: {},
      ageGroups: { '18-25': 0, '26-35': 0, '36-45': 0, '46+': 0 },
      education: {},
      gender: {},
      maritalStatus: { Unmarried: 0, Married: 0, Other: 0 },
      roles: { USER: 0, ADMIN: 0, MODERATOR: 0 },
      kovils: {},
      nativePlaces: {},
    };
  }
},

  // --- 4. SEARCH PERFORMANCE ENGINE (PROFILES ONLY) ---
  async generateTestUsers(count: number, onProgress: (pct: number) => void) {
    const CHUNK_SIZE = 100;
    const totalChunks = Math.ceil(count / CHUNK_SIZE);
    console.log(`⚡ starting Turbo Generation: ${count} users in ${totalChunks} chunks.`);

    const asString = (v: any) => (v == null ? '' : String(v));
    const pickValue = (arr: any[]) => {
      const v = pick(arr);
      if (v && typeof v === 'object') return asString(v.value ?? v.label ?? '');
      return asString(v);
    };
    const pickManyValues = (arr: any[] | undefined, countN: number) => {
      const xs = pickMany(arr, countN);
      return (xs || [])
        .map((v: any) => {
          if (v && typeof v === 'object') return asString(v.value ?? v.label ?? '');
          return asString(v);
        })
        .filter((s: string) => s.trim().length > 0);
    };

    const interestsSource = (AppData.INTEREST_DATA || (AppData as any).INTERESTS_DATA) as any[];

    for (let c = 0; c < totalChunks; c++) {
      try {
        const batch: any[] = [];
        const currentBatchSize = Math.min(CHUNK_SIZE, count - c * CHUNK_SIZE);

        for (let i = 0; i < currentBatchSize; i++) {
          const kData = pickKovil();

          const gender = pickValue(AppData.GENDER_DATA);
          const firstName = pick(['Arun', 'Senthil', 'Meenakshi', 'Priya', 'Karthik', 'Deepak', 'Anitha', 'Vijay']);
          const lastName = pick(['Palaniappan', 'Chidambaram', 'Muthu', 'Annamalai', 'Vellaiyan']);

          const makeEdu = () => ({
            level: pickValue(AppData.EDUCATION_DATA),
            field: pickValue(AppData.FIELD_OF_STUDY_DATA),
            university: pickValue(AppData.UNIVERSITY_DATA),
          });

          const heightText = pickValue(AppData.HEIGHT_DATA);
          const residentCountry = pickValue(AppData.RESIDENT_COUNTRY_DATA);
          const citizenship = pickValue(AppData.RESIDENT_COUNTRY_DATA);
          const dob = getRandomDate(new Date(1985, 0, 1), new Date(2000, 11, 31));

          batch.push({
            id: generateValidUUID(),
            is_test_data: true,
            is_approved: true,
            is_submitted: true,
            role: 'USER',

            full_name: `${firstName} ${lastName} Test_${c}_${i}`,
            dob,
            gender,
            email: `member_${Date.now()}_${c}_${i}@nexus.com`,
            phone: `+91 900000000${i % 10}`,

            citizenship,
            resident_country: residentCountry,
            resident_status: pickValue(AppData.RESIDENT_STATUS_DATA),
            current_state: pick(['Tamil Nadu', 'California', 'Ontario', 'London']),
            current_city: pick(['Chennai', 'San Francisco', 'Toronto', 'Coimbatore']),
            native_place: (() => {
              const v = pick(AppData.NATIVE_PLACES_DATA);
              return v && typeof v === 'object' ? asString(v.value ?? v.label ?? '') : asString(v);
            })(),

            kovil: asString(kData.kovil),
            pirivu: asString(kData.pirivu),
            rasi: (() => {
              const v = pick(AppData.RASI_DATA);
              return v && typeof v === 'object' ? asString(v.value ?? v.label ?? '') : asString(v);
            })(),
            star: (() => {
              const v = pick(AppData.NAKSHATRA_DATA);
              return v && typeof v === 'object' ? asString(v.value ?? v.label ?? '') : asString(v);
            })(),

            marital_status: pickValue(AppData.MARITAL_STATUS_DATA),
            height: heightText,
            profession: pickValue(AppData.PROFESSION_DATA),
            workplace: pick(['TCS', 'Google', 'Apollo Hospital', 'Self-Employed']),
            linkedin_profile: 'https://linkedin.com/in/testuser',

            interests: pickManyValues(interestsSource, 5),
            siblings: [pick(['Brother', 'Sister'])],

            family_initials: pickValue(AppData.FAMILY_INITIALS_DATA),
            father_name: `Father of ${firstName}`,
            father_work: 'Business',
            father_phone: '+11234567890',
            mother_name: `Mother of ${firstName}`,
            mother_work: 'Home Maker',
            mother_phone: '+11234567890',

            family_details: {
              siblings: [
                {
                  name: `${firstName}'s sibling`,
                  maritalStatus: 'Married',
                  occupation: pickValue(AppData.OCCUPATION_DATA),
                },
              ],
            },

            education_history: [makeEdu(), makeEdu()],

            expectations:
              'Looking for a compatible partner from a traditional background with shared values.'
                .replace(/\s+/g, ' ')
                .trim(),

            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }

        const { error } = await supabase.from('profiles').insert(batch);

        if (error) {
          console.error(`❌ Batch ${c} failed:`, error.message);
          throw error;
        }

        onProgress(Math.round(((c + 1) / totalChunks) * 100));
        await new Promise((res) => setTimeout(res, 200));
      } catch (err: any) {
        console.error(`🚨 Fatal crash at chunk ${c}:`, err.message);
        break;
      }
    }

    console.log('🏁 Generation cycle complete.');
    return true;
  },

  async deleteTestUsers(onProgress: (pct: number) => void) {
    console.log('⚡ Triggering Server-Side Purge...');
    onProgress(10);

    try {
      console.time('purge_test_data');
      const { data: count, error } = await supabase.rpc('purge_test_data', { batch_size: 500 });
      console.timeEnd('purge_test_data');

      if (error) throw error;

      console.log(`✅ Server-side purge complete. ${count} rows removed.`);
      onProgress(100);
      return true;
    } catch (error: any) {
      console.error('❌ RPC Purge failed:', error.message);
      throw error;
    }
  },

  // --- 5. ACCESS & APPROVALS ---
  async approveProfile(userId: string) {
    const { error } = await supabase.from('profiles').update({ is_approved: true }).eq('id', userId);
    if (error) throw error;
    await this.logAction('PROFILE_APPROVAL', `Approved user ID: ${userId}`, userId);
  },

  async rejectProfile(userId: string) {
    const { error } = await supabase.from('profiles').update({ is_approved: false, is_submitted: false }).eq('id', userId);
    if (error) throw error;
    await this.logAction('PROFILE_REVOKE', `Rejected user ID: ${userId}`, userId);
  },

  async getPendingProfilesPage(
    limit: number = 20,
    cursor?: PendingProfileCursor | null
  ): Promise<PendingProfilesPage> {
    try {
      const safeLimit = Math.max(1, Math.min(limit, 100));

      let query = supabase
        .from('profiles')
        .select('*')
        .eq('is_approved', false)
        .eq('is_submitted', true)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(safeLimit + 1);

      if (cursor?.created_at && cursor?.id) {
        query = query.or(
          `created_at.gt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.gt.${cursor.id})`
        );
      }

      const { data: profs, error: profError } = await query;

      if (profError) throw profError;

      const rawItems = profs ?? [];
      if (rawItems.length === 0) {
        return {
          items: [],
          nextCursor: null,
          hasMore: false,
        };
      }

      const userIds = rawItems.map((p) => p.id);
      const roleMap = await fetchUserRolesByIds(userIds);

      const filtered = rawItems
        .map((u) => ({
          ...u,
          role: roleMap.get(String(u.id)) || 'USER',
        }))
        .filter((u) => u.role !== 'ADMIN');

      const items = filtered.slice(0, safeLimit);
      const hasMore = rawItems.length > safeLimit;

      const lastItem = items.length > 0 ? items[items.length - 1] : null;

      return {
        items,
        nextCursor:
          hasMore && lastItem?.created_at && lastItem?.id
            ? {
                created_at: String(lastItem.created_at),
                id: String(lastItem.id),
              }
            : null,
        hasMore,
      };
    } catch (err) {
      console.error('getPendingProfilesPage Error:', err);
      return {
        items: [],
        nextCursor: null,
        hasMore: false,
      };
    }
  },

  async getPendingProfiles() {
    const firstPage = await this.getPendingProfilesPage(5, null);
    return firstPage.items;
  },

  async getAnalytics() {
    try {
      const [config, reportsRes, profiles, roleRows] = await Promise.all([
        this.getSystemConfig(),
        supabase.from('reports').select('id, status', { count: 'exact' }),
        fetchAllAnalyticsProfiles(),
        fetchAllUserRoles(),
      ]);

      const staffCount = roleRows.filter((r: any) => {
        const role = String(r.role || 'USER').toUpperCase().trim();
        return role === 'ADMIN' || role === 'MODERATOR';
      }).length;

      if (reportsRes.error) throw reportsRes.error;

      const reports = reportsRes.data ?? [];

      const roleByUserId: Record<string, string> = {};
      roleRows.forEach((r: any) => {
        roleByUserId[String(r.user_id)] = String(r.role || 'USER').toUpperCase().trim();
      });

      const allMemberProfiles = profiles.filter((profile: any) => {
        const role = roleByUserId[profile.id] || 'USER';
        return role === 'USER';
      });

      const approvedMemberProfiles = allMemberProfiles.filter(
        (p: any) => p.is_submitted === true && p.is_approved === true
      );

      const approvedActiveProfiles = approvedMemberProfiles.filter((p: any) => {
        const status = String(p.account_status || 'ACTIVE').toUpperCase().trim();
        return status !== 'INACTIVE';
      });

      const draftProfiles = allMemberProfiles.filter((p: any) => p.is_submitted !== true);
      const pendingProfiles = allMemberProfiles.filter(
        (p: any) => p.is_submitted === true && p.is_approved !== true
      );

      const accountInactiveProfiles = approvedMemberProfiles.filter((p: any) => {
        const status = String(p.account_status || 'ACTIVE').toUpperCase().trim();
        return status === 'INACTIVE';
      });

      const thresholdDays = Math.max(
        1,
        parseInt(String(config?.inactiveUserThresholdDays ?? '30'), 10) || 30
      );

      const now = new Date();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - thresholdDays);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const inactiveCandidates = approvedActiveProfiles
        .map((p: any) => ({
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          role: roleByUserId[p.id] || 'USER',
          last_login_at: p.last_login_at ?? null,
          created_at: p.created_at ?? null,
        }))
        .filter((u: any) => {
          if (!u.last_login_at) return true;
          return new Date(u.last_login_at) < cutoff;
        })
        .sort((a: any, b: any) => {
          const aTime = a.last_login_at ? new Date(a.last_login_at).getTime() : 0;
          const bTime = b.last_login_at ? new Date(b.last_login_at).getTime() : 0;
          return aTime - bTime;
        });

      const activeLast7Days = approvedActiveProfiles.filter((p: any) => {
        if (!p.last_login_at) return false;
        return new Date(p.last_login_at) >= sevenDaysAgo;
      }).length;

      const activeLast30Days = approvedActiveProfiles.filter((p: any) => {
        if (!p.last_login_at) return false;
        return new Date(p.last_login_at) >= thirtyDaysAgo;
      }).length;

      const neverLoggedIn = approvedActiveProfiles.filter((p: any) => !p.last_login_at).length;

      const newThisMonth = allMemberProfiles.filter((p: any) => {
        if (!p.created_at) return false;
        return new Date(p.created_at) >= monthStart;
      }).length;

      const profilesWithPhoto = approvedActiveProfiles.filter((p: any) => {
        return !!String(p.profile_photo_url || '').trim();
      }).length;

      const profilesWithProfession = approvedActiveProfiles.filter((p: any) => {
        return !!String(p.profession || '').trim();
      }).length;

      const profilesWithExpectations = approvedActiveProfiles.filter((p: any) => {
        return !!String(p.expectations || '').trim();
      }).length;

      const profilesWithEducation = approvedActiveProfiles.filter((p: any) => {
        return Array.isArray(p.education_history) && p.education_history.length > 0;
      }).length;

      const openReports = reports.filter((r: any) => {
        const status = String(r.status || 'PENDING').toUpperCase().trim();
        return status !== 'RESOLVED' && status !== 'CLOSED';
      }).length;

      const approvedPoolSize = approvedActiveProfiles.length || 0;

      const percentage = (value: number, total: number) => {
        if (!total) return 0;
        return Math.round((value / total) * 100);
      };

      return {
        totalUsers: allMemberProfiles.length,
        staffCount,
        pendingApprovals: pendingProfiles.length,

        draftProfiles: draftProfiles.length,
        approvedActiveProfiles: approvedActiveProfiles.length,
        accountInactiveProfiles: accountInactiveProfiles.length,

        inactiveMembers: inactiveCandidates.length,
        inactiveUsers: inactiveCandidates.slice(0, 15),
        inactiveThresholdDays: thresholdDays,

        activeLast7Days,
        activeLast30Days,
        neverLoggedIn,
        newThisMonth,

        profilesWithPhoto,
        profilesWithProfession,
        profilesWithExpectations,
        profilesWithEducation,

        profilePhotoCompletionRate: percentage(profilesWithPhoto, approvedPoolSize),
        professionCompletionRate: percentage(profilesWithProfession, approvedPoolSize),
        expectationsCompletionRate: percentage(profilesWithExpectations, approvedPoolSize),
        educationCompletionRate: percentage(profilesWithEducation, approvedPoolSize),

        openReports,

        activeConversations: 0,
      };
    } catch (err: any) {
      console.warn('getAnalytics error:', err?.message || err);
      return {
        totalUsers: 0,
        staffCount: 0,
        pendingApprovals: 0,

        draftProfiles: 0,
        approvedActiveProfiles: 0,
        accountInactiveProfiles: 0,

        inactiveMembers: 0,
        inactiveUsers: [],
        inactiveThresholdDays: 30,

        activeLast7Days: 0,
        activeLast30Days: 0,
        neverLoggedIn: 0,
        newThisMonth: 0,

        profilesWithPhoto: 0,
        profilesWithProfession: 0,
        profilesWithExpectations: 0,
        profilesWithEducation: 0,

        profilePhotoCompletionRate: 0,
        professionCompletionRate: 0,
        expectationsCompletionRate: 0,
        educationCompletionRate: 0,

        openReports: 0,

        activeConversations: 0,
      };
    }
  },

  async revokeAccess(email: string, note?: string) {
    const safeEmail = String(email || '').trim().toLowerCase();
    if (!safeEmail) throw new Error('Email is required');

    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .ilike('email', safeEmail)
      .maybeSingle();

    if (userError) throw userError;
    if (!user?.id) throw new Error('User not found');

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        is_approved: false,
        account_status: 'INACTIVE',
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (profileError) throw profileError;

    const { error: roleError } = await supabase
      .from('user_roles')
      .update({ role: 'USER' })
      .eq('user_id', user.id);

    if (roleError) throw roleError;

    const reportNote = String(note || '').trim();
    const resolvedDetails = reportNote
      ? `Resolved after deactivation. ${reportNote}`
      : 'Resolved after deactivation.';

    const { error: reportsError } = await supabase
      .from('reports')
      .update({
        status: 'RESOLVED',
        details: resolvedDetails,
      })
      .eq('target_id', user.id)
      .or('status.is.null,status.eq.PENDING,status.eq.OPEN,status.eq.ACTIVE');

    if (reportsError) {
      console.warn('resolve reports during revokeAccess failed:', reportsError);
    }

    const detailParts = [`Deactivated ${user.full_name || safeEmail}`];
    if (reportNote) detailParts.push(`Note: ${reportNote}`);
    await this.logAction('PROFILE_REVOKE', detailParts.join(' • '), user.id);

    return { success: true, userId: user.id };
  },

  async reactivateUser(email: string, note?: string) {
    const safeEmail = String(email || '').trim().toLowerCase();
    if (!safeEmail) throw new Error('Email is required');

    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .ilike('email', safeEmail)
      .maybeSingle();

    if (userError) throw userError;
    if (!user?.id) throw new Error('User not found');

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        account_status: 'ACTIVE',
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (profileError) throw profileError;

    const actionNote = String(note || '').trim();
    const detailParts = [`Reactivated ${user.full_name || safeEmail}`];
    if (actionNote) detailParts.push(`Note: ${actionNote}`);
    await this.logAction('PROFILE_APPROVAL', detailParts.join(' • '), user.id);

    return { success: true, userId: user.id };
  },

  async getDeactivatedUsers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, account_status, updated_at')
        .eq('account_status', 'INACTIVE')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const users = data ?? [];
      if (!users.length) return [];

      const targetIds = users.map((u: any) => String(u.id));
      const { data: logs, error: logsError } = await supabase
        .from('audit_logs')
        .select('target_id, details, timestamp, action')
        .in('target_id', targetIds)
        .in('action', ['PROFILE_REVOKE', 'PROFILE_APPROVAL'])
        .order('timestamp', { ascending: false });

      if (logsError) {
        console.warn('getDeactivatedUsers logs lookup failed:', logsError);
      }

      const noteByTarget = new Map<string, string>();
      (logs ?? []).forEach((log: any) => {
        const key = String(log.target_id || '');
        if (!key || noteByTarget.has(key)) return;
        noteByTarget.set(key, String(log.details || ''));
      });

      return users.map((user: any) => ({
        ...user,
        lastActionNote: noteByTarget.get(String(user.id)) || '',
      }));
    } catch (err) {
      console.error('getDeactivatedUsers Error:', err);
      return [];
    }
  },

  async getAuditLogs(limit: number = 20, offset: number = 0) {
    const { data, error, count } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    return { logs: data || [], totalCount: count || 0 };
  },

  async setupModerator(details: { fullName: string; email: string; role: string }) {
    try {
      const redirectBase =
        Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : REDIRECT_URL;

      const { error: inviteError } = await supabase.auth.signInWithOtp({
        email: details.email,
        options: {
          data: { full_name: details.fullName, role: details.role.toUpperCase() },
          emailRedirectTo: `${redirectBase}/SetPassword`,
        },
      });

      if (inviteError) throw inviteError;
      const msg = 'Invite Sent! The staff member will be fully active once they click the link and set their password.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Success', msg);
      return { success: true };
    } catch (error: any) {
      console.error('Staff Invite Failed:', error.message);
      const errorMsg = error.message || 'Could not send invitation.';
      Platform.OS === 'web' ? alert(errorMsg) : Alert.alert('Error', errorMsg);
      return { success: false, error: error.message };
    }
  },

  async postAnnouncement(title: string, body: string) {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) throw new Error('Not authenticated');

    const { data: roleRow, error: roleErr } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleErr) throw roleErr;

    const authorRole = String(roleRow?.role ?? 'USER').toUpperCase().trim();

    const { error: insErr } = await supabase.from('announcements').insert({
      title,
      body,
      author_id: user.id,
      author_role: authorRole,
    });

    if (insErr) throw insErr;

    await this.logAction('POST_ANNOUNCEMENT', `Title: ${title}`, user.id);
  },

  async exportToCSV() {
    try {
      const profs = await fetchAllProfilesBasic();
      if (!profs || profs.length === 0) return '';

      const userIds = profs.map((p) => p.id);
      const roleMap = new Map<string, string>();

      for (let i = 0; i < userIds.length; i += 1000) {
        const chunk = userIds.slice(i, i + 1000);
        const { data: roles, error: roleError } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', chunk);

        if (roleError) throw roleError;

        (roles ?? []).forEach((r: any) => {
          roleMap.set(String(r.user_id), String(r.role || 'USER'));
        });
      }

      const flattened = profs.map((u) => ({
        ...u,
        role: roleMap.get(String(u.id)) || 'USER',
      }));

      const headers = Object.keys(flattened[0]).join(',');
      const rows = flattened
        .map((u) => Object.values(u).map((v) => `"${String(v ?? '')}"`).join(','))
        .join('\n');

      return `${headers}\n${rows}`;
    } catch (err) {
      console.error('Export failed:', err);
      return '';
    }
  },
};