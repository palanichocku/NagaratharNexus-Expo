// ./src/services/admin.service.ts
import { supabase } from '../lib/supabase';
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

export const adminService = {

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
        allowRegistration: !!cfg.registrationEnabled,
        requireApproval: !!cfg.requireApprovalForSearch,
        autoPauseThreshold: String(cfg.autoFlagThreshold ?? 3),
        favoritesLimit: String(cfg.favoritesLimit ?? 5),
        welcomeMessage: cfg.welcomeMessage ?? '',
        themeName: String(cfg.themeName ?? 'warm'),
      };
    } catch (err) {
      console.error("Config fetch failed, using defaults:", err);
      return { maintenanceMode: false, registrationEnabled: true, requireApproval: true };
    }
  },

  async updateSystemConfig(updates: any) {
    const { data: current } = await supabase.from('system_settings').select('value').eq('key', 'global_config').single();
    const newValue = { ...current?.value, ...updates };
    
    await supabase.from('system_settings').upsert({
      key: 'global_config',
      value: newValue,
      updated_at: new Date().toISOString()
    });

    await this.logAction('UPDATE_SYSTEM_CONFIG', `Updated: ${Object.keys(updates).join(', ')}`);
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
  
  async logAction(action: keyof typeof AUDIT_SETTINGS.levels, details: string, targetId?: string) {
    if (!AUDIT_SETTINGS.enabled || !AUDIT_SETTINGS.levels[action]) return;

    // ✅ Only set target_id if it is a UUID (audit_logs.target_id is uuid)
    const isUuid = (v?: string) =>
      typeof v === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());

    try {
      const { data: { user }, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;

      // If there is no logged-in user, don’t attempt to write an audit row
      // (avoids FK/RLS weirdness and noisy console errors)
      if (!user?.id) return;

      const payload = {
        action: String(action),
        details,
        actor_id: user.id,
        actor_email: user.email ?? null,
        timestamp: new Date().toISOString(),
        target_id: isUuid(targetId) ? targetId : null,
      };

      const { error } = await supabase.from('audit_logs').insert(payload);
      if (error) throw error;
    } catch (error) {
      console.error('🕵️ Audit Log failed:', error);
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
  // ✅ Only approved, submitted members should drive analytics
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, resident_country, age, gender, kovil, native_place, education_history')
    .eq('is_submitted', true)
    .eq('is_approved', true);

  if (error || !users) return {};

  const distributions: any = {
    countries: {},
    ageGroups: { '18-25': 0, '26-35': 0, '36-45': 0, '46+': 0 },
    education: {},
    gender: {},
    roles: {}, // ✅ dynamic
    kovils: {},
    nativePlaces: {},
  };

  // --- Roles: dynamic buckets + USER default ---
  const userIds = users.map((u: any) => u.id).filter(Boolean);

  const roleByUserId: Record<string, string> = {};
  const roleBuckets = new Set<string>();
  roleBuckets.add('USER'); // default bucket always exists

  if (userIds.length > 0) {
    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', userIds);

    roleRows?.forEach((r: any) => {
      const uid = String(r.user_id || '');
      const role = String(r.role || 'USER').toUpperCase().trim() || 'USER';
      if (uid) roleByUserId[uid] = role;
      roleBuckets.add(role);
    });
  }

  // init roles to 0 so chart shows buckets consistently
  roleBuckets.forEach((r) => { distributions.roles[r] = 0; });

  // --- Iterate users once and build everything ---
  users.forEach((u: any) => {
    // Countries
    const c = u.resident_country || 'Other';
    distributions.countries[c] = (distributions.countries[c] || 0) + 1;

    // Native place
    const nPlace = u.native_place || 'Other';
    distributions.nativePlaces[nPlace] = (distributions.nativePlaces[nPlace] || 0) + 1;

    // Age groups
    const age = parseInt(String(u.age || '0'), 10);
    if (age >= 18 && age <= 25) distributions.ageGroups['18-25']++;
    else if (age >= 26 && age <= 35) distributions.ageGroups['26-35']++;
    else if (age >= 36 && age <= 45) distributions.ageGroups['36-45']++;
    else if (age > 45) distributions.ageGroups['46+']++;

    // Gender (dynamic too, handles OTHER etc)
    const g = String(u.gender || 'UNKNOWN').toUpperCase().trim() || 'UNKNOWN';
    distributions.gender[g] = (distributions.gender[g] || 0) + 1;

    // Kovils
    const k = u.kovil || 'Other';
    distributions.kovils[k] = (distributions.kovils[k] || 0) + 1;

    // Education
    // Preferred: education_history[].level
    // Education (degree-only from education_history[].level)
    if (Array.isArray(u.education_history)) {
      u.education_history.forEach((eh: any) => {
        const degree = String(eh?.level ?? '').trim();
        if (!degree) return;
        distributions.education[degree] = (distributions.education[degree] || 0) + 1;
      });
    }

    // ✅ Role per approved member (default USER)
    const role = (roleByUserId[u.id] || 'USER').toUpperCase().trim() || 'USER';
    distributions.roles[role] = (distributions.roles[role] || 0) + 1;
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
      const { data: count, error } = await supabase.rpc('purge_test_data');

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
  // "Total Members" should reflect actual submitted profiles.
  // Counting rows from `user_roles` is fragile (missing role rows, casing differences, etc.).
    const [{ count: totalMembers, error: totalErr }, { count: pending, error: pendingErr }] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('is_submitted', true),
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('is_approved', false)
          .eq('is_submitted', true),
      ]);

    if (totalErr) console.warn('getAnalytics totalMembers error:', totalErr.message);
    if (pendingErr) console.warn('getAnalytics pendingApprovals error:', pendingErr.message);

    return {
      totalUsers: totalMembers ?? 0,
      pendingApprovals: pending ?? 0,
      activeConversations: 0,
    };
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
      const { error: inviteError } = await supabase.auth.signInWithOtp({
        email: details.email,
        options: {
          data: { full_name: details.fullName, role: details.role.toUpperCase() },
          emailRedirectTo: 'http://localhost:8081/SetPassword',
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
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error('Not authenticated');

  // optional: fetch role from profiles so author_role is accurate
  const { data: prof } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const authorRole = String(prof?.role ?? 'USER').toUpperCase();

  const { error: insErr } = await supabase.from('announcements').insert({
    title,
    body,
    author_id: user.id,
    author_role: authorRole,
    // created_at omitted because table default now()
  });

  if (insErr) throw insErr;

  await this.logAction('POST_ANNOUNCEMENT', `Title: ${title}`, title);
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