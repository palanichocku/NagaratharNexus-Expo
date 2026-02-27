// src/features/search/types.ts
import type { SearchCursor, SearchFilters } from '../../services/search.service';

export type { SearchCursor, SearchFilters };

export const PAGE_SIZE = 20;

export const DEFAULT_FILTERS: SearchFilters = {
  minAge: 18,
  maxAge: 60,
  minHeight: 48,
  maxHeight: 84,
  query: '',
  countries: [],
  education: [],
  interests: [],
  maritalStatus: [],
  excludeKovilPirivu: [],
};

export function isDefaultFilters(f: SearchFilters): boolean {
  return (
    (f.query || '') === '' &&
    Number(f.minAge ?? 18) === 18 &&
    Number(f.maxAge ?? 60) === 60 &&
    Number(f.minHeight ?? 48) === 48 &&
    Number(f.maxHeight ?? 84) === 84 &&
    (f.countries?.length ?? 0) === 0 &&
    (f.education?.length ?? 0) === 0 &&
    (f.interests?.length ?? 0) === 0 &&
    (f.maritalStatus?.length ?? 0) === 0 &&
    (f.excludeKovilPirivu?.length ?? 0) === 0
  );
}

export type SearchContext = {
  // ✅ who is searching
  userId?: string | null;
  gender?: 'MALE' | 'FEMALE' | null;
  // ✅ permissions/role (affects search results and UI)
  role: 'USER' | 'MODERATOR' | 'ADMIN';
  includeUnapproved?: boolean;
  ignoreGenderGuard?: boolean;
};
