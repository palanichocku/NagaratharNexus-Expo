// src/shared/constants/appData.ts

/**
 * 🛠️ DEBUG TOGGLE
 * Set this to true to see detailed step-by-step logs in your console.
 */
export const DEBUG_CONFIG = {
  TRACE_LOG_ENABLED: true, // 🚀 Toggle this to false for production
};

export const USER_FLAG_REASONS = [
  { id: 'photos', label: 'Inappropriate Photos', icon: 'image-outline' },
  { id: 'fake', label: 'Fake Profile', icon: 'person-remove-outline' },
  { id: 'harassment', label: 'Harassment / Hate Speech', icon: 'hand-left-outline' },
  { id: 'spam', label: 'Spam / Advertising', icon: 'mail-unread-outline' },
  { id: 'data', label: 'Inaccurate Biodata', icon: 'document-text-outline' },
  { id: 'other', label: 'Other / System Test', icon: 'bug-outline' },
];
export type FlagReason = typeof USER_FLAG_REASONS[number];

export const MARITAL_STATUS_DATA = [
  { label: 'Never Married', value: 'Never Married' },
  { label: 'Divorced', value: 'Divorced' },
  { label: 'Widowed', value: 'Widowed' },
  { label: 'Married', value: 'Married' },
  { label: 'Awaiting Divorce', value: 'Awaiting Divorce' }
];

export const GENDER_DATA = [
  { label: 'Male', value: 'MALE' }, 
  { label: 'Female', value: 'FEMALE' }
];

export const OCCUPATION_DATA = [
  { label: 'Student', value: 'Student' }, 
  { label: 'Working Professional', value: 'Working Professional' },
  { label: 'Self-Employed', value: 'Self-Employed' },
  { label: 'Business Owner', value: 'Business Owner'},
  { label: 'Home Maker', value: 'Home Maker'},
  { label: 'Other', value: 'Other' }
  
];

export const RESIDENT_STATUS_DATA = [
  { label: 'Citizen', value: 'Citizen' }, 
  { label: 'Permanent Resident', value: 'Permanent Resident' },
  { label: 'Work Visa', value: 'Work Visa' }, 
  { label: 'Student Visa', value: 'Student Visa' }, 
  { label: 'Other', value: 'Other' }
];

export const EDUCATION_DATA = [
  { label: 'Ph.D', value: 'Ph.D' }, 
  { label: "Master's", value: "Master's" },
  { label: 'High School', value: 'High School' }, 
  { label: 'Diploma', value: 'Diploma' },
  { label: "Bachelor's", value: "Bachelor's" }, 
  { label: 'Professional', value: 'Professional' },
  { label: 'M.D', value: 'M.D' },
  { label: 'DPT', value: 'DPT' },
  { label: 'BDS', value: 'BDS' },
  { label: 'DDS', value: 'DDS' },
  { label: 'MDS', value: 'MDS' },
  { label: 'DMD', value: 'DMD' },
  { label: 'JD', value: 'JD' },
  { label: 'M.B.B.S', value: 'M.B.B.S' },

];

export const FIELD_OF_STUDY_DATA = [
  { label: 'Computer Science', value: 'Computer Science' }, 
  { label: 'Medicine', value: 'Medicine' },
  { label: 'Business Administration', value: 'Business Administration' }, 
  { label: 'Engineering', value: 'Engineering' },
  { label: 'Pharmacy', value: 'Pharmacy' }, 
  { label: 'Accounting', value: 'Accounting' }, 
  { label: 'Arts', value: 'Arts' }, 
  { label: 'Science', value: 'Science' }, 
  { label: 'Law', value: 'Law' }, 
  { label: 'Dentistry', value: 'Dentistry' }, 
  { label: 'Finance', value: 'Finance' }, 
  { label: 'Other', value: 'Other' }
];

export const PROFESSION_DATA = [
  { label: 'Doctor', value: 'Doctor' }, 
  { label: 'Software Engineer', value: 'Software Engineer' },
  { label: 'Engineer', value: 'Engineer' }, 
  { label: 'Teacher', value: 'Teacher' },
  { label: 'Lawyer', value: 'Lawyer' }, 
  { label: 'Dentist', value: 'Dentist' }, 
  { label: 'Skilled Trade', value: 'Skilled Trade' }, 
  { label: 'Finance Analyst', value: 'Finance Analyst' }, 
  { label: 'Business Owner', value: 'Business Owner' }, 
  { label: 'Nurse', value: 'Nurse' },   
  { label: 'Business Analyst', value: 'Business Analyst' }, 
  { label: 'Pharmacist', value: 'Pharmacist' },
  { label: 'Other', value: 'Other' }
];

export const KOVIL_DATA = [
  { label: 'Iraniyur', value: 'Iraniyur' },
  { label: 'Nemam', value: 'Nemam' },
  { label: 'Iluppaikudi', value: 'Iluppaikudi' },
  { label: 'Surakudi', value: 'Surakudi' },
  { label: 'Velangudi', value: 'Velangudi' },
  { label: 'Pillaiyarpatti', value: 'Pillaiyarpatti' },
  { 
    label: 'Illayathangudi', 
    value: 'Illayathangudi',
    pirivus: [
      'Okkur udaiyar', 
      'Pattinasamiyar', 
      'Peru maruthur udaiyar', 
      'Kazhani vasal udaiyar', 
      'Kinkini Kooru udaiyar', 
      'Pera senthur udaiyar', 
      'Siru sethur udaiyar'
    ]
  },
  {
    label: 'Mathur',
    value: 'Mathur',
    pirivus: [
      'Uraiyur udaiyar', 
      'Arumbakkur udaiyar', 
      'Mannur udaiyar', 
      'Manalur udaiyar', 
      'Kannur udaiyar', 
      'Karuppur udaiyar', 
      'Kulathur udaiyar'
    ]
  },
  {
    label: 'Vairavankovil',
    value: 'Vairavankovil',
    pirivus: [
      'Sirukulathur Kudiyar - Periya Vaguppu',
      'Sirukulathur Kudiyar - Thaiyanar Vaguppu',
      'Sirukulathur Kudiyar - Pillayar Vaguppu',
      'Kazhani vassal Kudiyar',
      'Marutheinthira puram udaiyar'
    ]
  }
];

export const RASI_DATA = [
  'Mesham', 'Rishabam', 'Mithunam', 'Katakam', 'Simham', 'Kanni', 'Thulam', 'Vrischikam', 'Dhanusu', 'Makaram', 'Kumbham', 'Meenam'
].map(r => ({ label: r, value: r }));

export const NAKSHATRA_DATA = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashirsha', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 
  'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
].map(s => ({ label: s, value: s }));

export const NATIVE_PLACES_DATA = [
  'Aiyanarkulam', 'Alagapuri', 'Amaravathipudur','Ariyakudi', 'Athangudi', 'Devakottai', 'Elayathangudi', 'Ilayathakudi',  'Iluppaikudi', 'Iraniyur', 
  'Kallal', 'Kanadukathan', 'Kandanur', 'Karaikudi', 'Karaiyur', 'Karpagamadurai', 'Kaveripatti', 'Kodukulam', 'Kothamangalam', 'Kottaiyur', 
  'Kulipirai', 'Kunnandarkoil', 'Mathur', 'Muttaraiyur', 'Nallathur', 'Nattarasankottai', 'Nemam', 'Okkur', 'Orathur', 'Palathur', 'Pallathur', 
  'Panayakurichi', 'Pillaiyarpatti', 'Ponnamaravathi', 'Puduvayal', 'Salapathi', 'Sengalipuram', 'Siravayal', 'Sorakudi', 'Soorakudi', 'Sundaravilakku',
  'Thurainallur', 'Vairavanpatti', 'Valayapatti', 'Vandiyur', 'Velangudi', 'Vellur'
].map(p => ({ label: p, value: p }));

export const INTEREST_DATA = [
  "Travel", "Fitness", "Cooking", "Photography", "Music", "Reading", "Painting", "Movies", "Dancing", "Hiking", "Gardening", "Running",
  "Gaming", "Crafting", "Sports", "Technology", "Volunteering", "Writing", "Meditation", "Cycling", "Fishing", "Collecting", "Knitting", 
  "Soccer", "Football", "Basketball", "Theater", "Camping", "Skiing", "Martial Arts", "Calligraphy", "Board Games", "Trekking", "Tennis", 
  "Chess", "Cricket", "Swimming" 
];

// Only used in admin service for generating mock profiles, not in the app itself.
export const RESIDENT_COUNTRY_DATA = [
  { label: 'India', value: 'India' },
  { label: 'Australia', value: 'Australia' },
  { label: 'Malaysia', value: 'Malaysia' },
  { label: 'United States', value: 'United States' },
  { label: 'United Kingdom', value: 'United Kingdom' },
  { label: 'Canada', value: 'Canada' },
  { label: 'Singapore', value: 'Singapore' }
];

export const UNIVERSITY_DATA = [
  { label: 'Anna University', value: 'Anna University' },
  { label: 'Harvard University', value: 'Harvard University' },
  { label: 'Stanford University', value: 'Stanford University' },
  { label: 'MIT', value: 'MIT' },
  { label: 'University of Cambridge', value: 'University of Cambridge' },
  { label: 'University of Oxford', value: 'University of Oxford' },
  { label: 'IIT Madras', value: 'IIT Madras' },
];

export const FAMILY_INITIALS_DATA = [
  { label: 'PL.M', value: 'PL.M' },
  { label: 'S.RM.M', value: 'S.RM.M' },
  { label: 'M.CT.', value: 'M.CT.' },
  { label: 'L.CT.PL', value: 'L.CT.PL' },
  { label: 'CT.PL', value: 'CT.PL' },
];
export const AGE_DATA = Array.from({ length: 44 }, (_, i) => (i + 18).toString());

export const HEIGHT_DATA = Array.from({ length: 37 }, (_, i) => {
  const inches = i + 48;
  return { label: `${Math.floor(inches / 12)}'${inches % 12}"`, value: `${Math.floor(inches / 12)}'${inches % 12}"` };
}

);

export const MASTER_DATA_MAP: any = {
  gender: GENDER_DATA,
  residentStatus: RESIDENT_STATUS_DATA,
  education: EDUCATION_DATA,
  fieldOfStudy: FIELD_OF_STUDY_DATA,
  profession: PROFESSION_DATA,
  nativePlaces: NATIVE_PLACES_DATA,
  age: AGE_DATA,
  height: HEIGHT_DATA,
  interests: INTEREST_DATA, 
  kovil: KOVIL_DATA,
  rasi: RASI_DATA,
  star: NAKSHATRA_DATA, 
  maritalStatus: MARITAL_STATUS_DATA,
};