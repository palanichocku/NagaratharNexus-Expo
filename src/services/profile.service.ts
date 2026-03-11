import { supabase } from '../../src/lib/supabase';

type AnyRecord = Record<string, any>;

/**
 * Minimal, safe key mapper.
 * - Only maps known camelCase keys to existing snake_case columns.
 * - Leaves unknown keys as-is.
 */
function normalizeProfileUpdates(input: AnyRecord): AnyRecord {
  const src: AnyRecord = input || {};
  const out: AnyRecord = {};

  const assign = (dbKey: string, ...candidates: string[]) => {
    for (const key of candidates) {
      if (Object.prototype.hasOwnProperty.call(src, key) && src[key] !== undefined) {
        out[dbKey] = src[key];
        return;
      }
    }
  };

  assign('full_name', 'fullName', 'full_name');
  assign('dob', 'dob');
  assign('gender', 'gender');
  assign('citizenship', 'citizenship');

  assign('resident_country', 'residentCountry', 'resident_country');
  assign('resident_status', 'residentStatus', 'resident_status');
  assign('current_state', 'currentState', 'current_state');
  assign('current_city', 'currentCity', 'current_city');

  assign('phone', 'phone', 'phoneNumber');
  assign('email', 'email');
  assign('hide_phone', 'hidePhone', 'hide_phone');
  assign('hide_email', 'hideEmail', 'hide_email');

  assign('marital_status', 'maritalStatus', 'marital_status');
  assign('height', 'height');

  assign('profession', 'profession');
  assign('workplace', 'workplace');
  assign('linkedin_profile', 'linkedinProfile', 'linkedInProfile', 'linkedin_profile');

  assign('native_place', 'nativePlace', 'native_place');
  assign('family_initials', 'familyInitials', 'family_initials');

  assign('father_name', 'fatherName', 'father_name');
  assign('father_work', 'fatherWork', 'father_work');
  assign('father_phone', 'fatherPhone', 'father_phone');

  assign('mother_name', 'motherName', 'mother_name');
  assign('mother_work', 'motherWork', 'mother_work');
  assign('mother_phone', 'motherPhone', 'mother_phone');

  assign('education_history', 'educationHistory', 'education_history');

  assign('kovil', 'kovil');
  assign('pirivu', 'pirivu');
  assign('rasi', 'rasi');
  assign('star', 'star');

  assign('interests', 'interests');
  assign('expectations', 'expectations');

  assign('profile_photo_url', 'profilePhotoUrl', 'profile_photo_url');

  if (Object.prototype.hasOwnProperty.call(src, 'siblings')) {
    out.family_details = {
      siblings: Array.isArray(src.siblings) ? src.siblings : [],
    };
  } else if (
    Object.prototype.hasOwnProperty.call(src, 'family_details') &&
    src.family_details &&
    typeof src.family_details === 'object'
  ) {
    out.family_details = src.family_details;
  }

  return out;
}

export const profileService = {
  async getProfile() {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

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

  async updateProfile(updates: any) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

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