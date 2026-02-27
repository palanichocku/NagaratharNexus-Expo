// ./src/services/profile.service.ts
import { supabase } from '../../src/lib/supabase';

type AnyRecord = Record<string, any>;

/**
 * Minimal, safe key mapper.
 * - Only maps known camelCase keys to existing snake_case columns.
 * - Leaves unknown keys as-is (so we don't break other updates).
 */
function normalizeProfileUpdates(input: AnyRecord): AnyRecord {
  const updates: AnyRecord = { ...(input || {}) };

  // ✅ Common camelCase -> snake_case mappings used across UI
  const MAP: Record<string, string> = {
    fullName: 'full_name',
    phoneNumber: 'phone', // only if your UI ever uses phoneNumber
    residentCountry: 'resident_country',
    residentStatus: 'resident_status',
    currentState: 'current_state', // ✅ FIX for your current error
    nativePlace: 'native_place',
    maritalStatus: 'marital_status',
    fatherName: 'father_name',
    fatherWork: 'father_work',
    fatherPhone: 'father_phone',
    motherName: 'mother_name',
    motherWork: 'mother_work',
    motherPhone: 'mother_phone',
    familyInitials: 'family_initials',
    linkedInProfile: 'linkedin_profile',
    profilePhotoUrl: 'profile_photo_url',

    hidePhone: 'hide_phone',
    hideEmail: 'hide_email',
    accountStatus: 'account_status',

    updatedAt: 'updated_at',
    createdAt: 'created_at',
  };

  Object.keys(MAP).forEach((fromKey) => {
    if (Object.prototype.hasOwnProperty.call(updates, fromKey)) {
      const toKey = MAP[fromKey];
      // move value to snake_case key
      updates[toKey] = updates[fromKey];
      delete updates[fromKey];
    }
  });

  // Avoid accidentally writing undefined (PostgREST may reject in some cases)
  Object.keys(updates).forEach((k) => {
    if (updates[k] === undefined) delete updates[k];
  });

  return updates;
}

export const profileService = {
  /**
   * 👤 Fetches the current authenticated user's profile from Supabase.
   */
  async getProfile() {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        console.warn('⭐ [PROFILE_SERVICE]: No active session found.');
        return null;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('⭐ [PROFILE_SERVICE]: Fetch error:', error.message);
        return null;
      }

      console.log('⭐ [PROFILE_SERVICE]: Profile loaded for', data.full_name);
      return data;
    } catch (error) {
      console.error('⭐ [PROFILE_SERVICE]: Unexpected error:', error);
      throw error;
    }
  },

  /**
   * 📝 Updates specific fields in the profile.
   * Accepts camelCase OR snake_case. Always writes snake_case to Supabase.
   */
  async updateProfile(updates: any) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user.');

      const normalized = normalizeProfileUpdates(updates || {});

      const { error } = await supabase
        .from('profiles')
        .update({
          ...normalized,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      console.log('⭐ [PROFILE_SERVICE]: Update successful for', user.id);
    } catch (error: any) {
      console.error('⭐ [PROFILE_SERVICE]: Update failed:', error.message);
      throw error;
    }
  },
};