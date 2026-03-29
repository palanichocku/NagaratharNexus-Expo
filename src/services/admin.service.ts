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
  // 1. Pick any kovil from the full list
  const kovil = AppData.KOVIL_DATA[Math.floor(Math.random() * AppData.KOVIL_DATA.length)];
  
  // 2. Check if this kovil has pirivus; if not, default to 'None'
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
 * This ensures the database accepts the ID for the profiles table.
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
      nactiveUserThresholdDays: '30',
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

  delete normalized.registrationEnabled;
  delete normalized.requireApprovalForSearch;
  delete normalized.autoFlagThreshold;

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
    const confirmed = window.confirm("⚠️ DANGER: This will delete all TEST DATA and unsubmitted profiles. Proceed?");
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .or('is_test_data.eq.true,is_submitted.eq.false');

      if (error) throw error;
      await this.logAction('DATA_WIPE', 'Executed mass cleanup of test/unsubmitted data');
      window.alert("Cleanup successful.");
      return true;
    } catch (error: any) {
      console.error("❌ Cleanup failed:", error.message);
      window.alert("Cleanup failed: " + error.message);
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
        reporter:profiles!reporter_id(full_name),
        target:profiles!target_id(full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data.map(report => ({
      ...report,
      reporterName: report.reporter?.full_name || 'Unknown',
      targetName: report.target?.full_name || 'Unknown'
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

  // --- 2. USER MANAGEMENT (Manual Join for Cache Resilience) ---
  async getAllUsers() {
    try {
      // Step 1: Fetch Profiles
      const { data: profs, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });
      
      if (profError) throw profError;
      if (!profs) return [];

      // Step 2: Fetch Roles manually to bypass 400 schema error
      const userIds = profs.map(p => p.id);
      const { data: roles, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      // Step 3: Merge
      return profs.map(u => ({ 
        ...u, 
        role: roles?.find(r => r.user_id === u.id)?.role || 'USER' 
      }));
    } catch (err) {
      console.error("getAllUsers Error:", err);
      return [];
    }
  },

  // --- 3. ANALYTICS ---
async getDistributionData() {
  // 1) Load approved + submitted profiles for member analytics
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select(
      'id, resident_country, age, gender, kovil, native_place, education_history, is_submitted, is_approved'
    )
    .eq('is_submitted', true)
    .eq('is_approved', true);

  if (profileError) {
    console.error('getDistributionData profiles error:', profileError.message);
    return {
      countries: {},
      ageGroups: { '18-25': 0, '26-35': 0, '36-45': 0, '46+': 0 },
      education: {},
      gender: {},
      roles: { USER: 0, ADMIN: 0, MODERATOR: 0 },
      kovils: {},
      nativePlaces: {},
    };
  }

  // 2) Load ALL roles for system-role analytics
  const { data: roleRows, error: roleError } = await supabase
    .from('user_roles')
    .select('user_id, role');

  if (roleError) {
    console.error('getDistributionData roles error:', roleError.message);
  }

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
    roles: {},
    kovils: {},
    nativePlaces: {},
  };

  // 3) Build role chart from ALL user_roles rows
  roleBuckets.forEach((role) => {
    distributions.roles[role] = 0;
  });

  (roleRows || []).forEach((row: any) => {
    const role = String(row?.role || 'USER').toUpperCase().trim() || 'USER';
    distributions.roles[role] = (distributions.roles[role] || 0) + 1;
  });

  // 4) Only USER profiles should contribute to member analytics
  const memberProfiles = (profiles || []).filter((profile: any) => {
    const role = (roleByUserId[profile.id] || 'USER').toUpperCase().trim();
    return role === 'USER';
  });

  // 5) Build member-only distributions
  memberProfiles.forEach((profile: any) => {
    // Country
    const country = String(profile.resident_country || 'Other').trim() || 'Other';
    distributions.countries[country] = (distributions.countries[country] || 0) + 1;

    // Native place
    const nativePlace = String(profile.native_place || 'Other').trim() || 'Other';
    distributions.nativePlaces[nativePlace] =
      (distributions.nativePlaces[nativePlace] || 0) + 1;

    // Age group
    const age = parseInt(String(profile.age || '0'), 10);
    if (age >= 18 && age <= 25) distributions.ageGroups['18-25'] += 1;
    else if (age >= 26 && age <= 35) distributions.ageGroups['26-35'] += 1;
    else if (age >= 36 && age <= 45) distributions.ageGroups['36-45'] += 1;
    else if (age > 45) distributions.ageGroups['46+'] += 1;

    // Gender
    const gender = String(profile.gender || 'UNKNOWN').toUpperCase().trim() || 'UNKNOWN';
    distributions.gender[gender] = (distributions.gender[gender] || 0) + 1;

    // Kovil
    const kovil = String(profile.kovil || 'Other').trim() || 'Other';
    distributions.kovils[kovil] = (distributions.kovils[kovil] || 0) + 1;

    // Education
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
},

// --- 1. SEARCH PERFORMANCE ENGINE (PROFILES ONLY) ---
/**
 * Generates high-density test data matching the specific profiles schema.
 * Bypasses Auth to avoid 429 rate limits, focusing purely on Search/DB performance.
 */
async generateTestUsers(count: number, onProgress: (pct: number) => void) {
  const CHUNK_SIZE = 100; // Optimal balance for browser memory and Supabase limits
  const totalChunks = Math.ceil(count / CHUNK_SIZE);
  console.log(`⚡ starting Turbo Generation: ${count} users in ${totalChunks} chunks.`);

  // ✅ Helpers: coerce AppData items ({label,value}) into strings
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

  // Some sources in appData are arrays of strings (INTEREST_DATA), some are objects.
  const interestsSource = (AppData.INTEREST_DATA || (AppData as any).INTERESTS_DATA) as any[];

  for (let c = 0; c < totalChunks; c++) {
    try {
      const batch: any[] = [];
      const currentBatchSize = Math.min(CHUNK_SIZE, count - c * CHUNK_SIZE);

      for (let i = 0; i < currentBatchSize; i++) {
        const kData = pickKovil();

        // ✅ Always strings, matching schema checks
        const gender = pickValue(AppData.GENDER_DATA); // "MALE"/"FEMALE"
        const firstName = pick(['Arun', 'Senthil', 'Meenakshi', 'Priya', 'Karthik', 'Deepak', 'Anitha', 'Vijay']);
        const lastName = pick(['Palaniappan', 'Chidambaram', 'Muthu', 'Annamalai', 'Vellaiyan']);

        // ✅ Degree/Field/University mirroring onboarding structure
        const makeEdu = () => ({
          level: pickValue(AppData.EDUCATION_DATA), // degree string only
          field: pickValue(AppData.FIELD_OF_STUDY_DATA), // field string
          university: pickValue(AppData.UNIVERSITY_DATA), // free text in real app; here we use a realistic string
        });

        // ✅ Legacy text[] column should be degree strings only (for backward compatibility / indexes)
        const degreeOnly = pickValue(AppData.EDUCATION_DATA);

        // ✅ Height is text in your schema; use the stored "value" (e.g., 5'8")
        const heightText = pickValue(AppData.HEIGHT_DATA);

        // ✅ resident_country/citizenship are TEXT columns; use the string value not {label,value}
        const residentCountry = pickValue(AppData.RESIDENT_COUNTRY_DATA);
        const citizenship = pickValue(AppData.RESIDENT_COUNTRY_DATA);

        // ✅ Dates: dob trigger calculates age; height trigger calculates height_inches
        const dob = getRandomDate(new Date(1985, 0, 1), new Date(2000, 11, 31));

        batch.push({
          id: generateValidUUID(),
          is_test_data: true,
          is_approved: true,
          is_submitted: true,
          role: 'USER',

          // 👤 Basic Identity
          full_name: `${firstName} ${lastName} Test_${c}_${i}`,
          dob,
          gender,
          email: `member_${Date.now()}_${c}_${i}@nexus.com`,
          phone: `+91 900000000${i % 10}`,

          // 📍 Location & Origins
          citizenship,
          resident_country: residentCountry,
          resident_status: pickValue(AppData.RESIDENT_STATUS_DATA),
          current_state: pick(['Tamil Nadu', 'California', 'Ontario', 'London']),
          current_city: pick(['Chennai', 'San Francisco', 'Toronto', 'Coimbatore']),
          native_place: (() => {
            // NATIVE_PLACES_DATA in your appData is already mapped to {label,value}
            const v = pick(AppData.NATIVE_PLACES_DATA);
            return v && typeof v === 'object' ? asString(v.value ?? v.label ?? '') : asString(v);
          })(),

          // 🕍 Community & Astrology
          kovil: asString(kData.kovil),
          pirivu: asString(kData.pirivu),
          rasi: (() => {
            const v = pick(AppData.RASI_DATA); // likely {label,value}
            return v && typeof v === 'object' ? asString(v.value ?? v.label ?? '') : asString(v);
          })(),
          star: (() => {
            const v = pick(AppData.NAKSHATRA_DATA); // likely {label,value}
            return v && typeof v === 'object' ? asString(v.value ?? v.label ?? '') : asString(v);
          })(),

          // 🎓 Professional & Education
          marital_status: pickValue(AppData.MARITAL_STATUS_DATA),
          height: heightText,
          profession: pickValue(AppData.PROFESSION_DATA),
          workplace: pick(['TCS', 'Google', 'Apollo Hospital', 'Self-Employed']),
          linkedin_profile: 'https://linkedin.com/in/testuser',

          // 📚 Array Types
          interests: pickManyValues(interestsSource, 5),
          siblings: [pick(['Brother', 'Sister'])],

          // 👨‍👩‍👧 Family Metadata
          family_initials: pickValue(AppData.FAMILY_INITIALS_DATA),
          father_name: `Father of ${firstName}`,
          father_work: 'Business',
          father_phone: '+11234567890',
          mother_name: `Mother of ${firstName}`,
          mother_work: 'Home Maker',
          mother_phone: '+11234567890',

          /**
           * 🏗️ JSONB: must match ProfileDisplay expectations
           * Store strings for occupation (not {label,value})
           */
          family_details: {
            siblings: [
              {
                name: `${firstName}'s sibling`,
                maritalStatus: 'Married',
                occupation: pickValue(AppData.OCCUPATION_DATA),
              },
            ],
          },

          /**
           * ✅ Mirrors onboarding exactly:
           * education_history: [{ level: string, field: string, university: string }]
           */
          education_history: [makeEdu(), makeEdu()],

          // 🚀 EXPECTATION FIX: Single line string to allow component auto-wrapping
          expectations:
            'Looking for a compatible partner from a traditional background with shared values.'
              .replace(/\s+/g, ' ')
              .trim(),

          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      // 🚀 BULK INSERT: Sends CHUNK_SIZE users in ONE network request
      const { error } = await supabase.from('profiles').insert(batch);

      if (error) {
        console.error(`❌ Batch ${c} failed:`, error.message);
        throw error;
      }

      onProgress(Math.round(((c + 1) / totalChunks) * 100));
      // Give the browser a moment to breathe
      await new Promise((res) => setTimeout(res, 200));
    } catch (err: any) {
      console.error(`🚨 Fatal crash at chunk ${c}:`, err.message);
      break;
    }
  }

  console.log('🏁 Generation cycle complete.');
  return true;
},

  /**
   * 🚀 RPC PURGE (Handles 100K+ Users Instantly)
   * Calls a server-side Postgres function to bypass browser network limits.
   */
  async deleteTestUsers(onProgress: (pct: number) => void) {
    console.log("⚡ Triggering Server-Side Purge...");
    onProgress(10); // Start progress

    try {
      // 🚀 Single RPC call replaces thousands of individual delete requests
      console.time('purge_test_data');
      const { data: count, error } = await supabase.rpc('purge_test_data', { batch_size: 500 });
      console.timeEnd('purge_test_data');

      if (error) throw error;

      console.log(`✅ Server-side purge complete. ${count} rows removed.`);
      onProgress(100);
      return true;
    } catch (error: any) {
      console.error("❌ RPC Purge failed:", error.message);
      // Fallback: If RPC fails, you can still use the batched JS version
      throw error;
    }
  },

  // --- 5. ACCESS & APPROVALS (Manual Join for Cache Resilience) ---
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

  async getPendingProfiles() {
    try {
      // Step 1: Fetch Pending Profiles
      const { data: profs, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_approved', false)
        .eq('is_submitted', true);

      if (profError) throw profError;
      if (!profs) return [];

      // Step 2: Manual Join Roles to filter out Admin profiles
      const userIds = profs.map(p => p.id);
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      return profs
        .map(u => ({ ...u, role: roles?.find(r => r.user_id === u.id)?.role || 'USER' }))
        .filter(u => u.role !== 'ADMIN');
    } catch (err) {
      console.error("getPendingProfiles Error:", err);
      return [];
    }
  },

  async getAnalytics() {
    try {
      const [
        { data: submittedProfiles, error: submittedErr },
        { data: pendingProfiles, error: pendingErr },
        config,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, last_login_at, created_at, is_submitted, is_approved')
          .eq('is_submitted', true),

        supabase
          .from('profiles')
          .select('id')
          .eq('is_submitted', true)
          .eq('is_approved', false),

        this.getSystemConfig(),
      ]);

      if (submittedErr) throw submittedErr;
      if (pendingErr) throw pendingErr;

      const profiles = submittedProfiles ?? [];
      const pending = pendingProfiles ?? [];

      const userIds = profiles.map((p) => p.id).filter(Boolean);

      let roleRows: Array<{ user_id: string; role: string }> = [];
      if (userIds.length > 0) {
        const { data, error } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds);

        if (error) throw error;
        roleRows = data ?? [];
      }

      const roleByUserId: Record<string, string> = {};
      roleRows.forEach((r) => {
        roleByUserId[r.user_id] = String(r.role || 'USER').toUpperCase().trim();
      });

      const thresholdDays = Math.max(
        1,
        parseInt(String(config?.inactiveUserThresholdDays ?? '30'), 10) || 30
      );

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - thresholdDays);

      const inactiveUsers = profiles
        .map((p) => {
          const role = roleByUserId[p.id] || 'USER';
          return {
            id: p.id,
            full_name: p.full_name,
            email: p.email,
            role,
            last_login_at: p.last_login_at ?? null,
            created_at: p.created_at ?? null,
          };
        })
        .filter((u) => {
          if (!u.last_login_at) return true; // never logged in = inactive
          return new Date(u.last_login_at) < cutoff;
        })
        .sort((a, b) => {
          const aTime = a.last_login_at ? new Date(a.last_login_at).getTime() : 0;
          const bTime = b.last_login_at ? new Date(b.last_login_at).getTime() : 0;
          return aTime - bTime; // oldest login first
        })
        .slice(0, 15);

      return {
        totalUsers: profiles.length,
        pendingApprovals: pending.length,
        activeConversations: 0,
        inactiveUsers,
        inactiveThresholdDays: thresholdDays,
      };
    } catch (err: any) {
      console.warn('getAnalytics error:', err?.message || err);
      return {
        totalUsers: 0,
        pendingApprovals: 0,
        activeConversations: 0,
        inactiveUsers: [],
        inactiveThresholdDays: 30,
      };
    }
  },

  async revokeAccess(email: string) {
    const { data: user } = await supabase.from('profiles').select('id').eq('email', email).single();
    if (user) {
      await supabase.from('profiles').update({ is_approved: false }).eq('id', user.id);
      await supabase.from('user_roles').update({ role: 'USER' }).eq('user_id', user.id);
      await this.logAction('PROFILE_REVOKE', `Revoked access for ${email}`, email);

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

  async setupModerator(details: { fullName: string, email: string, role: string }) {
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
      const msg = "Invite Sent! The staff member will be fully active once they click the link and set their password.";
      Platform.OS === 'web' ? alert(msg) : Alert.alert("Success", msg);
      return { success: true };
    } catch (error: any) {
      console.error("Staff Invite Failed:", error.message);
      const errorMsg = error.message || "Could not send invitation.";
      Platform.OS === 'web' ? alert(errorMsg) : Alert.alert("Error", errorMsg);
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
      const { data: profs } = await supabase.from('profiles').select('*');
      if (!profs || profs.length === 0) return '';

      const userIds = profs.map(p => p.id);
      const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('user_id', userIds);

      const flattened = profs.map(u => ({ 
        ...u, 
        role: roles?.find(r => r.user_id === u.id)?.role || 'USER' 
      }));

      const headers = Object.keys(flattened[0]).join(',');
      const rows = flattened.map(u => Object.values(u).map(v => `"${v}"`).join(',')).join('\n');
      return `${headers}\n${rows}`;
    } catch (err) {
      console.error("Export failed:", err);
      return '';
    }
  }
};