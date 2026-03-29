import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import Constants from 'expo-constants'; // Import Expo Constants

// Access the dynamic extra field from app.config.js
const extra = Constants.expoConfig?.extra || {};

// Priority: Expo Constants (app.config.js) -> process.env -> fallback
// Sanitize function to strip any non-visible characters/whitespace
const sanitize = (str: string) => str.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
const supabaseUrl = sanitize(extra.supabaseUrl || '');
const supabaseAnonKey = sanitize(extra.supabaseAnonKey || '');
const nativeRedirectUrl = extra.nativeRedirectUrl || '';
const appEnv = (extra.appEnv || 'dev').toLowerCase();

// Partitioned storage key to prevent session hijacking between Dev/Prod
const STORAGE_KEY = `nn-auth-v2-${appEnv}`;

console.log('[SUPABASE MANIFEST CONFIG]', {
  appEnv,
  supabaseUrl,
  storageKey: STORAGE_KEY
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials missing! Check your environment file.');
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
  storageKey: STORAGE_KEY
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: STORAGE_KEY, // Isolated per environment
  },
  global: { fetch: fetchWithTimeout },
});