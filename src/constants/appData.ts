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
  { id: 'data', label: 'Inaccurate Biodata', icon: 'document-text-outline' },
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
  
];

export const RESIDENT_STATUS_DATA = [
  { label: 'Citizen', value: 'Citizen' }, 
  { label: 'Permanent Resident', value: 'Permanent Resident' },
  { label: 'Work Visa', value: 'Work Visa' }, 
  { label: 'Student Visa', value: 'Student Visa' }, 
  { label: 'Other', value: 'Other' }
];

export const EDUCATION_DATA = [
  { label: 'High School', value: 'High School' }, 
  { label: 'Diploma', value: 'Diploma' },
  { label: "Bachelor's", value: "Bachelor's" }, 
  { label: "Master's", value: "Master's" },
  { label: 'Doctorate', value: 'Doctorate' }, 
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
  { label: 'Psychology', value: 'Psychology' },
  { label: 'Education', value: 'Education' },
  { label: 'Physical Therapy', value: 'Physical Therapy' },
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
  { label: 'Physical Therapist', value: 'Physical Therapist' }
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
  'Ashwini', 'Bharani', 'Krithika', 'Rohini', 'Mrigashirsha', 'Thiruvadirai', 'Punarpoosam', 'Poosam', 'Aayilyam', 'Magham', 'Pooram', 'Uttaram', 'Astham', 'Chithirai', 
  'Swathi', 'Visakham', 'Anusham', 'Kaetai', 'Moolam', 'Pooradam', 'Uttaradam', 'Thiruvonam', 'Avittam', 'Sathayam', 'Pooratadhi', 'Uttaratathi', 'Revathi'
].map(s => ({ label: s, value: s }));

export const NATIVE_PLACES_DATA = [
  'A. Muthuppattinam',
  'A. Siruvayal',
  'A. Thekkur',
  'Aavinippatti',
  'Alavakkottai',
  'Amaravathi Puthoor',
  'Arimalam',
  'Ariyakkudi',
  'Attangudi',
  'Chokkalingam Pudur',
  'Chokkanathapuram',
  'Devakottai',
  'K. Alagapuri',
  'K. Alagapuri',
  'K. Lakshmipuram',
  'Kanadukathan',
  'Kadiyapatti',
  'Kalayar Mangalam',
  'Kallal',
  'Kalluppatti',
  'Kandanoor',
  'Kandaramanikkam',
  'Kandavarayan Patti',
  'Karaikudi',
  'Karungulam',
  'Kila Poongudi',
  'Kilachival Patti',
  'Konapattu',
  'Koppanapatti',
  'Kothamangalam',
  'Kottaiyur',
  'Kulipirai',
  'Kuruvikkondan Patti',
  'Madagu Patti',
  'Mahibalan Patti',
  'Managiri',
  'Melaisivapuri',
  'Mithilaippatti',
  'Nachandu Patti',
  'Nachiapuram',
  'Natarajapuram',
  'Nattarasankottai',
  'Nemathanpatti',
  'Nerkuppai',
  'Okkur',
  'P. Alagapuri',
  'Ponnamaravathi',
  'Paganeri',
  'Palavangudi',
  'Pallathur',
  'Panangudi',
  'Panayappatti',
  'Pattamangalam',
  'Poolankurichi',
  'Puduvayal',
  'Rangiem',
  'Rayavaram',
  'Sakkanthy',
  'Sembanoor',
  'Sevvoor',
  'Aaravayal',
  'Sholapuram',
  'Siravayal',
  'Sirukoodal Patti',
  'Siruvayal',
  'Thanichaoorani',
  'Thenipatti',
  'Ulagampatti',
  'V. Lakshmipuram',
  'Valayapatti',
  'Veguppatti',
  'Venthanpatti',
  'Vetriyur',
  'Virachilai',
  'Viramathi'
].map(p => ({ label: p, value: p }));

export const INTEREST_DATA = [
  "Fitness & Wellness", "Travel & Outdoors", "Food & Cooking", "Arts & Creativity", "Music & Entertainment",
  "Reading & Learning", "Sports & Games", "Community & Service"
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