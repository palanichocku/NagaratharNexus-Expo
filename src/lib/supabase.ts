import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || {};

const sanitize = (value: unknown) =>
  String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();

// Prefer Expo manifest extra, then direct env fallback.
// This makes Vercel builds work even if app.config.js did not inject `extra`.
const supabaseUrl = sanitize(
  extra.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
);

const supabaseAnonKey = sanitize(
  extra.supabaseAnonKey ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY
);

const nativeRedirectUrl = sanitize(
  extra.nativeRedirectUrl ?? process.env.EXPO_PUBLIC_NATIVE_REDIRECT_URL
);

const appEnv = sanitize(
  extra.appEnv ?? process.env.EXPO_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? 'dev'
).toLowerCase();

const STORAGE_KEY = `nn-auth-v2-${appEnv}`;

console.log('[SUPABASE MANIFEST CONFIG]', {
  appEnv,
  hasExpoExtra: !!Constants.expoConfig?.extra,
  supabaseUrlPresent: !!supabaseUrl,
  supabaseUrlLength: supabaseUrl.length,
  storageKey: STORAGE_KEY,
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials missing! Check environment variables.');
}

function resolveRedirectUrl() {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return '';
  }
  return nativeRedirectUrl;
}

const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  return fetch(input, { ...(init || {}), signal: controller.signal }).finally(() =>
    clearTimeout(timeout)
  );
};

const isWeb = Platform.OS === 'web';

const storage = isWeb
  ? typeof window !== 'undefined'
    ? AsyncStorage
    : {
        getItem: () => Promise.resolve(null),
        setItem: () => Promise.resolve(),
        removeItem: () => Promise.resolve(),
      }
  : AsyncStorage;

export const REDIRECT_URL = resolveRedirectUrl();

console.log('[SUPABASE CONFIG]', {
  appEnv,
  supabaseUrl,
  redirectUrl: REDIRECT_URL,
  storageKey: STORAGE_KEY,
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: STORAGE_KEY,
  },
  global: { fetch: fetchWithTimeout },
});