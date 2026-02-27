// Shared definitions for both Frontend and Backend - src/shared/types/search.ts

export interface MemberProfile {
  id: string;
  fullName?: string;
  gender?: string;
  role?: string;
  age?: string;
  dob?: string;
  height?: string;
  kovil?: string;
  residentCountry?: string;
  residentStatus?: string;
  interests?: string[];
  educationLevel?: string;
  maritalStatus?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  phonePrivate?: boolean;
  emailPrivate?: boolean;
  whatsappPrivate?: boolean;
  isTestData?: boolean;
  [key: string]: unknown;
}

export interface SearchFilters {
  selectedCountries: string[];
  minAge: string;
  maxAge: string;
  minHeight: string;
  maxHeight: string;
  selectedResidentStatus: string[];
  selectedInterests: string[];
  excludedKovils: string[];
  selectedEducation: string[];
  selectedMaritalStatus: string[];
  genderFilter?: "MALE" | "FEMALE" | "ALL";
}

export interface University {
  name: string;
  country: string;
  alpha_two_code: string;
  domains: string[];
  web_pages: string[];
  "state-province": string | null;
}

export const INITIAL_FILTERS: SearchFilters = {
  selectedCountries: [],
  minAge: '18',
  maxAge: '61',
  minHeight: "4'0\"",
  maxHeight: "7'0\"",
  selectedResidentStatus: [],
  selectedInterests: [],
  excludedKovils: [],
  selectedEducation: [],
  selectedMaritalStatus: [],
  genderFilter: "ALL",
};