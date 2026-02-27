// src/shared/constants/profileSchema.ts

export type ProfileFieldType =
  | 'text'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'country'
  | 'state'
  | 'phone'
  | 'email'
  | 'height'
  | 'education_history'
  | 'siblings_list';

export type OptionSourceKey =
  | 'GENDER'
  | 'CITIZENSHIP'
  | 'RESIDENT_STATUS'
  | 'MARITAL_STATUS'
  | 'PROFESSION'
  | 'NATIVE_PLACE'
  | 'KOVIL'
  | 'PIRIVU'
  | 'RASI'
  | 'STAR'
  | 'INTERESTS';

export type ProfileFieldSchema = {
  key: string; // UI/form key (camelCase)
  label: string;
  type: ProfileFieldType;
  required?: boolean;

  // DB mapping
  dbKey?: string; // direct column name OR a json path alias like "family_details.siblings"
  dbKeys?: string[]; // optional fallback keys for reading/back-compat

  // Options
  optionsSource?: OptionSourceKey;

  // Behavior
  dependsOn?: string; // for dependent selects (pirivu depends on kovil)
  placeholder?: string;

  // Height config (if type === 'height')
  minInches?: number;
  maxInches?: number;

  // Visibility/edit rules
  editable?: boolean;
};

export type ProfileSectionSchema = {
  section: string;
  icon: string;
  fields: ProfileFieldSchema[];
};

/**
 * PROFILE_SCHEMA is a UI schema:
 * - It describes how to edit/display fields
 * - It maps UI keys to DB keys
 * - It does NOT attempt to replicate Postgres constraints/indexes
 */
export const PROFILE_SCHEMA: ProfileSectionSchema[] = [
  {
    section: 'Personal & Status',
    icon: 'person-outline',
    fields: [
      { key: 'fullName', label: 'Full Name', type: 'text', required: true, dbKey: 'full_name' },
      { key: 'dob', label: 'Date of Birth', type: 'date', required: true, dbKey: 'dob' },

      {
        key: 'gender',
        label: 'Gender',
        type: 'select',
        required: true,
        dbKey: 'gender',
        optionsSource: 'GENDER',
      },
      {
        key: 'citizenship',
        label: 'Citizenship',
        type: 'select',
        required: true,
        dbKey: 'citizenship',
        optionsSource: 'CITIZENSHIP',
      },

      {
        key: 'residentCountry',
        label: 'Resident Country',
        type: 'country',
        required: true,
        dbKey: 'resident_country',
      },
      {
        key: 'residentStatus',
        label: 'Resident Status',
        type: 'select',
        required: true,
        dbKey: 'resident_status',
        optionsSource: 'RESIDENT_STATUS',
      },
      {
        key: 'currentState',
        label: 'State/Region',
        type: 'state',
        required: true,
        dbKey: 'current_state',
        dependsOn: 'residentCountry',
      },
      {
        key: 'currentCity',
        label: 'City',
        type: 'text',
        required: false,
        dbKey: 'current_city',
      },

      { key: 'phone', label: 'Phone Number', type: 'phone', required: true, dbKey: 'phone' },

      /**
       * Email: show from auth if profile.email is empty
       * Typically you still store it in DB (unique constraint), but UI should not rely on it.
       */
      { key: 'email', label: 'Email Address', type: 'email', required: true, dbKey: 'email', editable: false },

      {
        key: 'maritalStatus',
        label: 'Marital Status',
        type: 'select',
        required: true,
        dbKey: 'marital_status',
        optionsSource: 'MARITAL_STATUS',
      },

      {
        key: 'height',
        label: 'Height',
        type: 'height',
        required: false,

        // ✅ Write to height (text) so trigger computes height_inches
        dbKey: 'height',

        // ✅ Read fallback (useful if some rows have only one populated)
        dbKeys: ['height', 'height_inches'],

        // UI limits (4'0" to 7'0")
        minInches: 48,
        maxInches: 84,
      },

      // optional privacy flags
      { key: 'hidePhone', label: 'Hide Phone', type: 'select', required: false, dbKey: 'hide_phone' },
      { key: 'hideEmail', label: 'Hide Email', type: 'select', required: false, dbKey: 'hide_email' },
    ],
  },

  {
    section: 'Professional',
    icon: 'briefcase-outline',
    fields: [
      /**
       * Preferred: education_history jsonb (structured entries)
       * Legacy: education text[] (tags)
       */
      {
        key: 'educationHistory',
        label: 'Education History',
        type: 'education_history',
        required: false,
        dbKey: 'education_history',
        dbKeys: ['education_history'],
      },

      {
        key: 'profession',
        label: 'Profession',
        type: 'select',
        required: true,
        dbKey: 'profession',
        optionsSource: 'PROFESSION',
      },
      { key: 'workplace', label: 'Workplace', type: 'text', required: false, dbKey: 'workplace' },
      { key: 'linkedinProfile', label: 'LinkedIn Profile', type: 'text', required: false, dbKey: 'linkedin_profile' },
    ],
  },

  {
    section: 'Family Lineage',
    icon: 'people-outline',
    fields: [
      {
        key: 'nativePlace',
        label: 'Native Place',
        type: 'select',
        required: true,
        dbKey: 'native_place',
        optionsSource: 'NATIVE_PLACE',
      },
      { key: 'familyInitials', label: 'Family Initials', type: 'text', required: true, dbKey: 'family_initials' },

      { key: 'fatherName', label: "Father's Name", type: 'text', required: true, dbKey: 'father_name' },
      { key: 'fatherWork', label: "Father's Work", type: 'text', required: false, dbKey: 'father_work' },
      { key: 'fatherPhone', label: "Father's Phone", type: 'phone', required: false, dbKey: 'father_phone' },

      { key: 'motherName', label: "Mother's Name", type: 'text', required: true, dbKey: 'mother_name' },
      { key: 'motherWork', label: "Mother's Work", type: 'text', required: false, dbKey: 'mother_work' },
      { key: 'motherPhone', label: "Mother's Phone", type: 'phone', required: false, dbKey: 'mother_phone' },

      /**
       * Preferred: family_details.siblings (jsonb array of objects)
       * Legacy: siblings text[] (names/labels)
       */
      {
        key: 'siblings',
        label: 'Siblings',
        type: 'siblings_list',
        required: false,
        dbKey: 'family_details.siblings',
        dbKeys: ['family_details.siblings', 'siblings'],
      },
    ],
  },

  {
    section: 'Cultural Identity',
    icon: 'moon-outline',
    fields: [
      { key: 'kovil', label: 'Kovil', type: 'select', required: true, dbKey: 'kovil', optionsSource: 'KOVIL' },
      {
        key: 'pirivu',
        label: 'Pirivu (Sub-division)',
        type: 'select',
        required: false,
        dbKey: 'pirivu',
        optionsSource: 'PIRIVU',
        dependsOn: 'kovil',
      },
      { key: 'rasi', label: 'Rasi', type: 'select', required: true, dbKey: 'rasi', optionsSource: 'RASI' },
      { key: 'star', label: 'Star', type: 'select', required: true, dbKey: 'star', optionsSource: 'STAR' },
    ],
  },

  {
    section: 'Interests & Expectations',
    icon: 'heart-outline',
    fields: [
      { key: 'interests', label: 'Interests', type: 'multiselect', required: false, dbKey: 'interests', optionsSource: 'INTERESTS' },
      { key: 'expectations', label: 'Expectations', type: 'text', required: false, dbKey: 'expectations' },
    ],
  },
];